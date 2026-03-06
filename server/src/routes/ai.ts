import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiModels, aiProviders } from '../db/schema.js';
import { getAuthFromRequest, JwtPayload } from '../lib/auth.js';
import { checkBilling, calculateCost, deductBalance, logUsage, getMarkupPercent, UsageCost } from '../lib/billing.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const FALLBACK_CHAT_MODEL = 'gemini-2.5-flash';
const FALLBACK_CHAT_LIST = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image';
const FALLBACK_IMAGE_LIST = ['gemini-2.5-flash-image', 'nano-banana-pro-preview'];

const GEMINI_STREAM_URL = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
const GEMINI_GENERATE_URL = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function resolveModel(modelId: string | undefined, modelType: 'text' | 'image') {
  if (modelId) {
    const [model] = await db.select().from(aiModels).where(eq(aiModels.id, modelId));
    if (model?.isActive) return model;
  }
  // Default: first active model of this type
  const [model] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.modelType, modelType))
    .orderBy(aiModels.sortOrder)
    .limit(1);
  return model || null;
}

function requireAuth(req: Parameters<typeof getAuthFromRequest>[0], reply: { status: (code: number) => { send: (body: unknown) => unknown } }): JwtPayload | null {
  const payload = getAuthFromRequest(req);
  if (!payload) { reply.status(401).send({ error: 'Требуется авторизация' }); return null; }
  return payload;
}

export async function aiRoutes(app: FastifyInstance) {
  app.get('/ai/health', async (_req, reply) => reply.send({ ok: true, service: 'ai' }));

  app.get('/ai/models', async (_req, reply) => {
    if (!GEMINI_API_KEY) return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await res.json();
      if (!res.ok) return reply.status(res.status).send(data);
      const models = (data.models || []).map((m: { name: string; supportedGenerationMethods?: string[] }) => ({
        name: m.name?.replace('models/', ''),
        methods: m.supportedGenerationMethods,
      }));
      return reply.send({ models });
    } catch (e) { return reply.status(500).send({ error: String(e) }); }
  });

  // ── AI Chat (streaming) ──
  app.post<{
    Body: { messages: Array<{ role: string; content: string }>; model?: string; modelId?: string };
  }>('/ai/chat', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;
    if (!GEMINI_API_KEY) return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });

    const { messages = [], modelId } = req.body || {};
    const billing = await checkBilling(payload.userId);
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const dbModel = await resolveModel(modelId, 'text');
    const modelKey = dbModel?.modelKey || FALLBACK_CHAT_MODEL;
    const modelsToTry = dbModel ? [modelKey] : FALLBACK_CHAT_LIST;

    const contents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    const systemInstruction = {
      parts: [{ text: 'Ты полезный AI-ассистент. Отвечай на русском языке, если пользователь пишет на русском. Давай четкие и полезные ответы. Используй форматирование Markdown когда это уместно.' }],
    };

    let res: Response | null = null;
    let lastErr = '';
    for (const model of modelsToTry) {
      const url = `${GEMINI_STREAM_URL(model)}?key=${GEMINI_API_KEY}&alt=sse`;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } }),
      });
      if (res.ok) break;
      lastErr = await res.text();
      if (res.status !== 404) return reply.status(res.status).send({ error: lastErr || 'AI error' });
    }
    if (!res || !res.ok) {
      const msg = (() => { try { const e = JSON.parse(lastErr); return e?.error?.message || e?.error || lastErr; } catch { return lastErr || 'AI model not found'; } })();
      return reply.status(502).send({ error: msg });
    }

    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const reader = res.body?.getReader();
    if (!reader) return reply.raw.end();

    const decoder = new TextDecoder();
    let buffer = '';
    let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.usageMetadata) usageMetadata = parsed.usageMetadata;
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
            } catch { /* skip */ }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Bill BEFORE sending [DONE] so client sees updated balance
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const markup = await getMarkupPercent();
    const cost = calculateCost(
      'text',
      parseFloat(dbModel?.inputPricePer1k || '0'),
      parseFloat(dbModel?.outputPricePer1k || '0'),
      0, inputTokens, outputTokens, markup
    );
    const usageId = await logUsage(payload.userId, dbModel?.id || null, 'chat', cost, billing.isFree);
    if (!billing.isFree && cost.finalCost > 0) {
      await deductBalance(payload.userId, cost.finalCost, `Chat: ${inputTokens}+${outputTokens} tokens`, usageId);
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
  });

  // ── AI Image generation ──
  app.post<{
    Body: { prompt: string; image?: string; modelId?: string };
  }>('/ai/image', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;
    if (!GEMINI_API_KEY) return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });

    const { prompt, image, modelId } = req.body || {};
    if (!prompt?.trim()) return reply.status(400).send({ error: 'prompt обязателен' });

    const billing = await checkBilling(payload.userId);
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const dbModel = await resolveModel(modelId, 'image');
    const modelKey = dbModel?.modelKey || FALLBACK_IMAGE_MODEL;
    const modelsToTry = dbModel ? [modelKey] : FALLBACK_IMAGE_LIST;

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: `Сгенерируй изображение по описанию: ${prompt.trim()}` },
    ];
    if (image) {
      const base64 = image.replace(/^data:image\/\w+;base64,/, '');
      parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
    }

    let res: Response | null = null;
    let lastErr = '';
    for (const model of modelsToTry) {
      const url = `${GEMINI_GENERATE_URL(model)}?key=${GEMINI_API_KEY}`;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });
      if (res.ok) break;
      lastErr = await res.text();
      if (res.status !== 404) return reply.status(res.status).send({ error: lastErr || 'AI image error' });
    }
    if (!res || !res.ok) {
      const msg = (() => { try { const e = JSON.parse(lastErr); return e?.error?.message || e?.error || lastErr; } catch { return lastErr || 'Image model not found'; } })();
      return reply.status(502).send({ error: msg });
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts;
    let imageUrl: string | null = null;
    if (content) {
      for (const part of content) {
        const inline = (part as { inlineData?: { mimeType?: string; data: string } }).inlineData;
        if (inline?.data) { imageUrl = `data:${inline.mimeType || 'image/png'};base64,${inline.data}`; break; }
      }
    }
    if (!imageUrl) return reply.status(500).send({ error: 'Не удалось сгенерировать изображение' });

    // Bill image request
    const markup = await getMarkupPercent();
    const cost = calculateCost('image', 0, 0, parseFloat(dbModel?.fixedPrice || '0'), 0, 0, markup);
    const usageId = await logUsage(payload.userId, dbModel?.id || null, 'image', cost, billing.isFree);
    if (!billing.isFree && cost.finalCost > 0) {
      await deductBalance(payload.userId, cost.finalCost, 'Image generation', usageId);
    }

    return reply.send({ imageUrl, cost: { finalCost: cost.finalCost, isFree: billing.isFree } });
  });

  // ── AI Quiz (tool calling) ──
  app.post<{
    Body: {
      lessonTitle: string; lessonDescription: string; videoTopics: string[];
      userAnswer?: string; conversationHistory?: Array<{ role: string; content: string }>;
      customPrompt?: string;
      learningState?: { criteria: Array<{ id: string; topic: string; description: string; passed: boolean }>; current_criterion: string; all_passed: boolean };
    };
  }>('/ai/quiz', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;
    if (!GEMINI_API_KEY) return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });

    const billing = await checkBilling(payload.userId);
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const { lessonTitle, lessonDescription, videoTopics = [], userAnswer, conversationHistory = [], customPrompt, learningState } = req.body || {};

    const dbModel = await resolveModel(undefined, 'text');
    const chatModel = dbModel?.modelKey || FALLBACK_CHAT_MODEL;

    const isInitialization = conversationHistory.length === 0;
    let systemPrompt: string;

    if (isInitialization) {
      systemPrompt = `Ты — AI-тьютор. Курс: AI для помогающих специалистов.

## Урок: ${lessonTitle}
${lessonDescription}
Темы из видео: ${videoTopics.join(', ')}
${customPrompt ? `\nДополнительные инструкции: ${customPrompt}` : ''}

## ТВОЯ ЗАДАЧА:
1. Создай 3-4 критерия для проверки понимания урока (по ключевым темам из видео)
2. Поприветствуй студента и задай первый вопрос по критерию c1

## ПРАВИЛА:
- Критерии должны быть конкретными и проверяемыми
- Вопросы должны быть открытыми (не да/нет)
- Все критерии начинаются с passed: false
- current_criterion: "c1"
- all_passed: false`;
    } else {
      const currentCrit = learningState?.criteria?.find((c: { id: string }) => c.id === learningState.current_criterion);
      const currentTopic = currentCrit?.topic || 'текущая тема';
      const currentDesc = currentCrit?.description || '';
      const passedCriteria = learningState?.criteria?.filter((c: { passed: boolean }) => c.passed) || [];
      const remainingCriteria = learningState?.criteria?.filter((c: { passed: boolean }) => !c.passed) || [];

      systemPrompt = `Ты — AI-тьютор. Оцени последний ответ студента.

## Урок: ${lessonTitle}
${customPrompt ? `Инструкции: ${customPrompt}` : ''}

## ТЕКУЩИЙ КРИТЕРИЙ: ${learningState?.current_criterion}
Тема: "${currentTopic}"
Проверяем: ${currentDesc}

## ПРОГРЕСС: ${passedCriteria.length}/${learningState?.criteria?.length || 0} критериев пройдено
Пройдены: ${passedCriteria.map((c: { id: string }) => c.id).join(', ') || 'нет'}
Осталось: ${remainingCriteria.map((c: { id: string }) => c.id).join(', ')}

## ПРАВИЛА ОЦЕНКИ:
1. Если ответ показывает понимание темы → passed: true для текущего критерия
2. После прохождения критерия → current_criterion = следующий непройденный
3. Если НЕ понял → задай уточняющий вопрос, passed остаётся false
4. Когда ВСЕ критерии passed: true → all_passed: true

## ТЕКУЩЕЕ СОСТОЯНИЕ (изменяй только нужные поля):
${JSON.stringify(learningState, null, 2)}`;
    }

    const msgArr: Array<{ role: string; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: systemPrompt }] },
    ];
    for (const msg of conversationHistory) {
      msgArr.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
    }
    if (isInitialization) msgArr.push({ role: 'user', parts: [{ text: 'Начни обучающую сессию.' }] });
    else if (userAnswer) msgArr.push({ role: 'user', parts: [{ text: userAnswer }] });

    const tools = [{
      functionDeclarations: [{
        name: 'update_learning_state',
        description: 'Обновить состояние обучения. ВСЕГДА используй эту функцию для ответа.',
        parameters: {
          type: 'OBJECT',
          properties: {
            criteria: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, topic: { type: 'STRING' }, description: { type: 'STRING' }, passed: { type: 'BOOLEAN' } } } },
            current_criterion: { type: 'STRING' },
            all_passed: { type: 'BOOLEAN' },
            message: { type: 'STRING' },
          },
          required: ['criteria', 'current_criterion', 'all_passed', 'message'],
        },
      }],
    }];

    const url = `${GEMINI_GENERATE_URL(chatModel)}?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: msgArr,
        tools,
        toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['update_learning_state'] } },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return reply.status(res.status).send({ error: err || 'AI quiz error' });
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const fc = candidate?.content?.parts?.[0]?.functionCall;

    // Bill quiz request
    const usageMeta = data.usageMetadata;
    const inputTokens = usageMeta?.promptTokenCount || 0;
    const outputTokens = usageMeta?.candidatesTokenCount || 0;
    const markup = await getMarkupPercent();
    const cost = calculateCost('text', parseFloat(dbModel?.inputPricePer1k || '0'), parseFloat(dbModel?.outputPricePer1k || '0'), 0, inputTokens, outputTokens, markup);
    const usageId = await logUsage(payload.userId, dbModel?.id || null, 'quiz', cost, billing.isFree);
    if (!billing.isFree && cost.finalCost > 0) {
      await deductBalance(payload.userId, cost.finalCost, `Quiz: ${inputTokens}+${outputTokens} tokens`, usageId);
    }

    if (!fc || fc.name !== 'update_learning_state') {
      if (learningState) {
        return reply.send({ response: 'Произошла ошибка обработки. Попробуйте повторить ваш ответ.', learningState, allPassed: false });
      }
      return reply.status(500).send({ error: 'AI не вернул структурированный ответ' });
    }

    let args: { criteria: Array<{ id: string; topic: string; description: string; passed: boolean }>; current_criterion: string; all_passed: boolean; message: string };
    try { args = typeof fc.args === 'string' ? JSON.parse(fc.args) : fc.args; }
    catch { return reply.status(500).send({ error: 'Ошибка парсинга ответа AI' }); }

    return reply.send({
      response: args.message,
      learningState: { criteria: args.criteria, current_criterion: args.current_criterion, all_passed: args.all_passed },
      allPassed: args.all_passed === true,
    });
  });
}
