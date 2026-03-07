import {
  AIProviderAdapter,
  GenerateImageParams,
  GenerateImageResult,
  RunQuizParams,
  RunQuizResult,
  StreamChatParams,
  StreamChatResult,
} from '../types.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function geminiGenerateUrl(model: string): string {
  return `${GEMINI_BASE_URL}/${model}:generateContent`;
}

function geminiStreamUrl(model: string): string {
  return `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse`;
}

function geminiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}

function extractUsageMetadata(data: unknown): { promptTokenCount?: number; candidatesTokenCount?: number } {
  if (!data || typeof data !== 'object') return {};
  const usage = (data as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
  return usage || {};
}

function extractTextDelta(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = (data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates?.[0];
  return candidate?.content?.parts?.[0]?.text || null;
}

export class GeminiAdapter implements AIProviderAdapter {
  async streamChat(params: StreamChatParams): Promise<StreamChatResult> {
    const contents = params.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'user' ? 'user' : 'model',
        parts: [{ text: message.content }],
      }));

    const response = await fetch(geminiStreamUrl(params.model.modelKey), {
      method: 'POST',
      headers: geminiHeaders(params.apiKey),
      body: JSON.stringify({
        systemInstruction: params.model.supportsSystemPrompt ? {
          parts: [{ text: params.systemPrompt }],
        } : undefined,
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      throw new Error(errText || 'Gemini stream error');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            usageMetadata = extractUsageMetadata(parsed);
            const text = extractTextDelta(parsed);
            if (text) params.onDelta(text);
          } catch {
            // Ignore malformed chunks from upstream streaming.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      usage: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
      },
    };
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: params.prompt.trim() },
    ];

    for (const img of params.images) {
      const base64 = String(img).replace(/^data:image\/\w+;base64,/, '');
      const mime = img.startsWith('data:image/')
        ? (img.match(/^data:(image\/\w+);/)?.[1] || 'image/png')
        : 'image/png';
      parts.push({ inlineData: { mimeType: mime, data: base64 } });
    }

    const response = await fetch(geminiGenerateUrl(params.model.modelKey), {
      method: 'POST',
      headers: geminiHeaders(params.apiKey),
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Gemini image error');
    }

    const data = await response.json();
    const usageMetadata = extractUsageMetadata(data);
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts;
    let imageUrl: string | null = null;

    if (content) {
      for (const part of content) {
        const p = part as Record<string, unknown>;
        const inline = (p.inlineData ?? p.inline_data) as { mimeType?: string; mime_type?: string; data: string } | undefined;
        const mime = inline?.mimeType ?? inline?.mime_type;
        const b64 = inline?.data;
        if (b64) {
          imageUrl = `data:${mime || 'image/png'};base64,${b64}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      const errDetail = candidate?.finishReason || data.promptFeedback?.blockReason || 'no image in response';
      throw new Error(`Не удалось сгенерировать изображение: ${errDetail}`);
    }

    return {
      imageUrl,
      usage: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
      },
    };
  }

  async runQuiz(params: RunQuizParams): Promise<RunQuizResult> {
    const isInitialization = params.conversationHistory.length === 0;
    let systemPrompt: string;

    if (isInitialization) {
      systemPrompt = `Ты — AI-тьютор. Курс: AI для помогающих специалистов.

## Урок: ${params.lessonTitle}
${params.lessonDescription}
Темы из видео: ${params.videoTopics.join(', ')}
${params.customPrompt ? `\nДополнительные инструкции: ${params.customPrompt}` : ''}

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
      const currentCrit = params.learningState?.criteria?.find((criterion) => criterion.id === params.learningState?.current_criterion);
      const currentTopic = currentCrit?.topic || 'текущая тема';
      const currentDesc = currentCrit?.description || '';
      const passedCriteria = params.learningState?.criteria?.filter((criterion) => criterion.passed) || [];
      const remainingCriteria = params.learningState?.criteria?.filter((criterion) => !criterion.passed) || [];

      systemPrompt = `Ты — AI-тьютор. Оцени последний ответ студента.

## Урок: ${params.lessonTitle}
${params.customPrompt ? `Инструкции: ${params.customPrompt}` : ''}

## ТЕКУЩИЙ КРИТЕРИЙ: ${params.learningState?.current_criterion}
Тема: "${currentTopic}"
Проверяем: ${currentDesc}

## ПРОГРЕСС: ${passedCriteria.length}/${params.learningState?.criteria?.length || 0} критериев пройдено
Пройдены: ${passedCriteria.map((criterion) => criterion.id).join(', ') || 'нет'}
Осталось: ${remainingCriteria.map((criterion) => criterion.id).join(', ')}

## ПРАВИЛА ОЦЕНКИ:
1. Если ответ показывает понимание темы → passed: true для текущего критерия
2. После прохождения критерия → current_criterion = следующий непройденный
3. Если НЕ понял → задай уточняющий вопрос, passed остаётся false
4. Когда ВСЕ критерии passed: true → all_passed: true

## ТЕКУЩЕЕ СОСТОЯНИЕ (изменяй только нужные поля):
${JSON.stringify(params.learningState, null, 2)}`;
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: systemPrompt }] },
    ];

    for (const message of params.conversationHistory) {
      contents.push({
        role: message.role === 'user' ? 'user' : 'model',
        parts: [{ text: message.content }],
      });
    }

    if (isInitialization) {
      contents.push({ role: 'user', parts: [{ text: 'Начни обучающую сессию.' }] });
    } else if (params.userAnswer) {
      contents.push({ role: 'user', parts: [{ text: params.userAnswer }] });
    }

    const response = await fetch(geminiGenerateUrl(params.model.modelKey), {
      method: 'POST',
      headers: geminiHeaders(params.apiKey),
      body: JSON.stringify({
        contents,
        tools: [{
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
        }],
        toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['update_learning_state'] } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Gemini quiz error');
    }

    const data = await response.json();
    const usageMetadata = extractUsageMetadata(data);
    const candidate = data.candidates?.[0];
    const functionCall = candidate?.content?.parts?.[0]?.functionCall;

    if (!functionCall || functionCall.name !== 'update_learning_state') {
      throw new Error('AI не вернул структурированный ответ');
    }

    const args = typeof functionCall.args === 'string' ? JSON.parse(functionCall.args) : functionCall.args;
    return {
      response: args.message,
      learningState: {
        criteria: args.criteria,
        current_criterion: args.current_criterion,
        all_passed: args.all_passed,
      },
      allPassed: args.all_passed === true,
      usage: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
      },
    };
  }
}
