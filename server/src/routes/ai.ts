import { FastifyInstance, FastifyReply } from 'fastify';
import { getAuthFromRequest, JwtPayload } from '../lib/auth.js';
import { checkBilling, calculateCost, deductBalance, logUsage, getMarkupPercent, UsageCost } from '../lib/billing.js';
import { getProviderApiKey, getGeminiKey } from '../lib/provider-keys.js';
import { getProviderAdapter } from '../lib/ai/provider-registry.js';
import { ensureModelSupports, resolveRuntimeModel } from '../lib/ai/runtime.js';
import { AIResolvedModel, QuizConversationMessage, QuizLearningState } from '../lib/ai/types.js';

const DEFAULT_SYSTEM_PROMPT = 'Ты полезный AI-ассистент. Отвечай на русском языке, если пользователь пишет на русском. Давай четкие и полезные ответы. Используй форматирование Markdown когда это уместно.';
const MAX_IMAGES = 14;

function requireAuth(req: Parameters<typeof getAuthFromRequest>[0], reply: { status: (code: number) => { send: (body: unknown) => unknown } }): JwtPayload | null {
  const payload = getAuthFromRequest(req);
  if (!payload) { reply.status(401).send({ error: 'Требуется авторизация' }); return null; }
  return payload;
}

function parseErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error || raw;
  } catch {
    return raw;
  }
}

function parseMoney(value: string | null | undefined): number {
  return parseFloat(value || '0');
}

function writeSseChunk(reply: FastifyReply, text: string): void {
  reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
}

async function resolveKeyOrReply(model: AIResolvedModel, reply: FastifyReply): Promise<string | null> {
  const key = await getProviderApiKey(model.providerId);
  if (!key) {
    reply.status(500).send({ error: `API-ключ для провайдера "${model.providerName}" не настроен` });
    return null;
  }
  return key;
}

async function finalizeUsageBilling(params: {
  payload: JwtPayload;
  model: AIResolvedModel;
  billing: Awaited<ReturnType<typeof checkBilling>>;
  requestType: 'chat' | 'image' | 'quiz';
  usage: { inputTokens: number; outputTokens: number };
  description: string;
}): Promise<UsageCost> {
  const markup = await getMarkupPercent();
  const cost = calculateCost(
    params.model.modelType,
    parseMoney(params.model.inputPricePer1k),
    parseMoney(params.model.outputPricePer1k),
    parseMoney(params.model.fixedPrice),
    params.usage.inputTokens,
    params.usage.outputTokens,
    markup,
  );

  const usageId = await logUsage(params.payload.userId, params.model.id, params.requestType, cost, params.billing.isFree);
  if (!params.billing.isFree && cost.finalCost > 0) {
    await deductBalance(params.payload.userId, cost.finalCost, params.description, usageId);
  }

  return cost;
}

export async function aiRoutes(app: FastifyInstance) {
  app.get('/ai/health', async (_req, reply) => reply.send({ ok: true, service: 'ai' }));

  app.get('/ai/models', async (_req, reply) => {
    const key = await getGeminiKey();
    if (!key) return reply.status(500).send({ error: 'API-ключ Gemini не настроен' });
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': key },
      });
      const data = await res.json();
      if (!res.ok) return reply.status(res.status).send(data);
      const models = (data.models || []).map((m: { name: string; supportedGenerationMethods?: string[] }) => ({
        name: m.name?.replace('models/', ''),
        methods: m.supportedGenerationMethods,
      }));
      return reply.send({ models });
    } catch (e) {
      return reply.status(500).send({ error: String(e) });
    }
  });

  app.post<{
    Body: { messages: Array<{ role: string; content: string }>; modelId?: string };
  }>('/ai/chat', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;

    const { messages = [], modelId } = req.body || {};
    const model = await resolveRuntimeModel(modelId, 'text');
    if (!model) return reply.status(400).send({ error: 'Нет активной текстовой модели' });

    try {
      ensureModelSupports(model, 'streaming');
    } catch (error) {
      return reply.status(400).send({ error: parseErrorMessage(error) });
    }

    const key = await resolveKeyOrReply(model, reply);
    if (!key) return;

    const billing = await checkBilling(payload.userId, payload.role === 'admin');
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });

    try {
      const adapter = getProviderAdapter(model.providerName);
      const result = await adapter.streamChat({
        apiKey: key,
        model,
        messages: messages.map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
          content: message.content,
        })),
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        onDelta: (text) => writeSseChunk(reply, text),
      });

      await finalizeUsageBilling({
        payload,
        model,
        billing,
        requestType: 'chat',
        usage: result.usage,
        description: `Chat: ${result.usage.inputTokens}+${result.usage.outputTokens} tokens`,
      });

      reply.raw.write('data: [DONE]\n\n');
    } catch (error) {
      reply.raw.write(`data: ${JSON.stringify({ error: parseErrorMessage(error) })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  app.post<{
    Body: { prompt: string; image?: string; images?: string[]; modelId?: string };
  }>('/ai/image', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;

    const { prompt, image, images: imagesRaw, modelId } = req.body || {};
    if (!prompt?.trim()) return reply.status(400).send({ error: 'prompt обязателен' });

    const model = await resolveRuntimeModel(modelId, 'image');
    if (!model) return reply.status(400).send({ error: 'Нет активной image-модели' });

    const key = await resolveKeyOrReply(model, reply);
    if (!key) return;

    const billing = await checkBilling(payload.userId, payload.role === 'admin');
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const imageList = Array.isArray(imagesRaw) ? imagesRaw : (image ? [image] : []);
    if (imageList.length > MAX_IMAGES) return reply.status(400).send({ error: `Максимум ${MAX_IMAGES} изображений` });
    if (imageList.length > 0 && !model.supportsImageInput) {
      return reply.status(400).send({ error: `Модель "${model.displayName}" не поддерживает входные изображения` });
    }
    if (!model.supportsImageOutput) {
      return reply.status(400).send({ error: `Модель "${model.displayName}" не поддерживает генерацию изображений` });
    }

    try {
      const adapter = getProviderAdapter(model.providerName);
      const result = await adapter.generateImage({
        apiKey: key,
        model,
        prompt,
        images: imageList,
      });

      const cost = await finalizeUsageBilling({
        payload,
        model,
        billing,
        requestType: 'image',
        usage: result.usage,
        description: 'Image generation',
      });

      return reply.send({
        imageUrl: result.imageUrl,
        cost: { finalCost: cost.finalCost, isFree: billing.isFree },
      });
    } catch (error) {
      return reply.status(502).send({ error: parseErrorMessage(error) });
    }
  });

  app.post<{
    Body: {
      lessonTitle: string;
      lessonDescription: string;
      videoTopics: string[];
      userAnswer?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      customPrompt?: string;
      learningState?: QuizLearningState;
    };
  }>('/ai/quiz', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;

    const model = await resolveRuntimeModel(undefined, 'text');
    if (!model) return reply.status(400).send({ error: 'Нет активной текстовой модели для квиза' });

    const key = await resolveKeyOrReply(model, reply);
    if (!key) return;

    const billing = await checkBilling(payload.userId, payload.role === 'admin');
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const { lessonTitle, lessonDescription, videoTopics = [], userAnswer, conversationHistory = [], customPrompt, learningState } = req.body || {};

    try {
      const adapter = getProviderAdapter(model.providerName);
      const result = await adapter.runQuiz({
        apiKey: key,
        model,
        lessonTitle,
        lessonDescription,
        videoTopics,
        userAnswer,
        conversationHistory: conversationHistory as QuizConversationMessage[],
        customPrompt,
        learningState,
      });

      await finalizeUsageBilling({
        payload,
        model,
        billing,
        requestType: 'quiz',
        usage: result.usage,
        description: `Quiz: ${result.usage.inputTokens}+${result.usage.outputTokens} tokens`,
      });

      return reply.send({
        response: result.response,
        learningState: result.learningState,
        allPassed: result.allPassed,
      });
    } catch (error) {
      if (learningState) {
        return reply.send({ response: 'Произошла ошибка обработки. Попробуйте повторить ваш ответ.', learningState, allPassed: false });
      }
      return reply.status(502).send({ error: parseErrorMessage(error) });
    }
  });
}
