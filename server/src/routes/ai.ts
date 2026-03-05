import { FastifyInstance } from 'fastify';
import { getAuthFromRequest } from '../lib/auth.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';

export async function aiRoutes(app: FastifyInstance) {
  const requireAuth = (req: { headers: { authorization?: string } }) => {
    const payload = getAuthFromRequest(req as Parameters<typeof getAuthFromRequest>[0]);
    if (!payload) throw new Error('Unauthorized');
    return payload;
  };

  // AI Chat (streaming)
  app.post<{
    Body: { messages: Array<{ role: string; content: string }>; model?: string };
  }>('/ai/chat', async (req, reply) => {
    requireAuth(req);
    if (!GEMINI_API_KEY) {
      return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });
    }
    const { messages = [] } = req.body || {};
    const contents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    const systemInstruction = {
      parts: [
        {
          text: 'Ты полезный AI-ассистент. Отвечай на русском языке, если пользователь пишет на русском. Давай четкие и полезные ответы. Используй форматирование Markdown когда это уместно.',
        },
      ],
    };
    const url = `${GEMINI_CHAT_URL}?key=${GEMINI_API_KEY}&alt=sse`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return reply.status(res.status).send({ error: err || 'AI error' });
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const reader = res.body?.getReader();
    if (!reader) {
      return reply.raw.end();
    }
    const decoder = new TextDecoder();
    let buffer = '';
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
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
              }
            } catch {
              // skip invalid json
            }
          }
        }
      }
      reply.raw.write('data: [DONE]\n\n');
    } finally {
      reader.releaseLock();
    }
    reply.raw.end();
  });

  // AI Image generation
  app.post<{
    Body: { prompt: string; image?: string };
  }>('/ai/image', async (req, reply) => {
    requireAuth(req);
    if (!GEMINI_API_KEY) {
      return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });
    }
    const { prompt, image } = req.body || {};
    if (!prompt?.trim()) {
      return reply.status(400).send({ error: 'prompt обязателен' });
    }
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: `Сгенерируй изображение по описанию: ${prompt.trim()}` },
    ];
    if (image) {
      const base64 = image.replace(/^data:image\/\w+;base64,/, '');
      parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          responseMimeType: 'image/png',
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return reply.status(res.status).send({ error: err || 'AI image error' });
    }
    const data = await res.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts;
    let imageUrl: string | null = null;
    if (content) {
      for (const part of content) {
        const inline = (part as { inlineData?: { mimeType?: string; data: string } }).inlineData;
        if (inline?.data) {
          imageUrl = `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
          break;
        }
      }
    }
    if (!imageUrl) {
      return reply.status(500).send({ error: 'Не удалось сгенерировать изображение' });
    }
    return reply.send({ imageUrl });
  });

  // AI Quiz (tool calling)
  app.post<{
    Body: {
      lessonTitle: string;
      lessonDescription: string;
      videoTopics: string[];
      userAnswer?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      customPrompt?: string;
      learningState?: {
        criteria: Array<{ id: string; topic: string; description: string; passed: boolean }>;
        current_criterion: string;
        all_passed: boolean;
      };
    };
  }>('/ai/quiz', async (req, reply) => {
    requireAuth(req);
    if (!GEMINI_API_KEY) {
      return reply.status(500).send({ error: 'GEMINI_API_KEY не настроен' });
    }
    const {
      lessonTitle,
      lessonDescription,
      videoTopics = [],
      userAnswer,
      conversationHistory = [],
      customPrompt,
      learningState,
    } = req.body || {};

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

    const messages: Array<{ role: string; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: systemPrompt }] },
    ];
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
    if (isInitialization) {
      messages.push({ role: 'user', parts: [{ text: 'Начни обучающую сессию.' }] });
    } else if (userAnswer) {
      messages.push({ role: 'user', parts: [{ text: userAnswer }] });
    }

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'update_learning_state',
            description: 'Обновить состояние обучения. ВСЕГДА используй эту функцию для ответа.',
            parameters: {
              type: 'OBJECT',
              properties: {
                criteria: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      topic: { type: 'STRING' },
                      description: { type: 'STRING' },
                      passed: { type: 'BOOLEAN' },
                    },
                  },
                },
                current_criterion: { type: 'STRING' },
                all_passed: { type: 'BOOLEAN' },
                message: { type: 'STRING' },
              },
              required: ['criteria', 'current_criterion', 'all_passed', 'message'],
            },
          },
        ],
      },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        tools,
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: ['update_learning_state'],
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return reply.status(res.status).send({ error: err || 'AI quiz error' });
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const fc = candidate?.content?.parts?.[0]?.functionCall;
    if (!fc || fc.name !== 'update_learning_state') {
      if (learningState) {
        return reply.send({
          response: 'Произошла ошибка обработки. Попробуйте повторить ваш ответ.',
          learningState,
          allPassed: false,
        });
      }
      return reply.status(500).send({ error: 'AI не вернул структурированный ответ' });
    }

    let args: {
      criteria: Array<{ id: string; topic: string; description: string; passed: boolean }>;
      current_criterion: string;
      all_passed: boolean;
      message: string;
    };
    try {
      args = typeof fc.args === 'string' ? JSON.parse(fc.args) : fc.args;
    } catch {
      return reply.status(500).send({ error: 'Ошибка парсинга ответа AI' });
    }

    const newLearningState = {
      criteria: args.criteria,
      current_criterion: args.current_criterion,
      all_passed: args.all_passed,
    };

    return reply.send({
      response: args.message,
      learningState: newLearningState,
      allPassed: args.all_passed === true,
    });
  });
}
