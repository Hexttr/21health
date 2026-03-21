import {
  AIProviderAdapter,
  GenerateImageParams,
  GenerateImageResult,
  RunQuizParams,
  RunQuizResult,
  StreamChatParams,
  StreamChatResult,
} from '../types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
}

function parseAnthropicError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error?.type || raw;
  } catch {
    return raw;
  }
}

function parseDataUrl(image: string): { mediaType: string; data: string } {
  const match = image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!match) {
    return {
      mediaType: 'image/png',
      data: image,
    };
  }

  return {
    mediaType: match[1],
    data: match[2],
  };
}

function toAnthropicContent(message: StreamChatParams['messages'][number]) {
  const blocks: Array<Record<string, unknown>> = [];

  for (const image of message.images || []) {
    const parsed = parseDataUrl(image);
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: parsed.mediaType,
        data: parsed.data,
      },
    });
  }

  if (message.content.trim()) {
    blocks.push({
      type: 'text',
      text: message.content,
    });
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', text: message.content || ' ' }];
}

function extractAnthropicUsage(data: unknown): { inputTokens?: number; outputTokens?: number } {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const usage = (data as {
    usage?: { input_tokens?: number; output_tokens?: number };
    message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  }).usage ?? (data as { message?: { usage?: { input_tokens?: number; output_tokens?: number } } }).message?.usage;

  return {
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
  };
}

function extractAnthropicStreamText(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const delta = (data as { delta?: { type?: string; text?: string } }).delta;
  if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
    return delta.text;
  }

  return null;
}

export class AnthropicAdapter implements AIProviderAdapter {
  async streamChat(params: StreamChatParams): Promise<StreamChatResult> {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: anthropicHeaders(params.apiKey),
      signal: params.signal,
      body: JSON.stringify({
        model: params.model.modelKey,
        max_tokens: params.profile.maxOutputTokens ?? 8192,
        temperature: params.profile.temperature ?? 0.7,
        stream: true,
        system: params.profile.systemPrompt,
        messages: params.messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: toAnthropicContent(message),
          })),
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      throw new Error(parseAnthropicError(errText || 'Anthropic chat error'));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          if (!block.trim()) continue;
          const lines = block.split('\n');
          const event = lines.find((line) => line.startsWith('event: '))?.slice(7).trim() || '';
          const dataLines = lines
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6))
            .join('\n');

          if (!dataLines || dataLines === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataLines) as Record<string, unknown>;
            const usage = extractAnthropicUsage(parsed);
            inputTokens = usage.inputTokens || inputTokens;
            outputTokens = usage.outputTokens || outputTokens;

            if (event === 'error') {
              throw new Error(parseAnthropicError(dataLines));
            }

            const text = extractAnthropicStreamText(parsed);
            if (text) {
              params.onDelta(text);
            }
          } catch (error) {
            if (error instanceof Error) {
              throw error;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }

  async generateImage(_params: GenerateImageParams): Promise<GenerateImageResult> {
    throw new Error('Anthropic не поддерживает генерацию изображений в этом runtime');
  }

  async runQuiz(_params: RunQuizParams): Promise<RunQuizResult> {
    throw new Error('Anthropic пока не поддерживает режим AI-тьютора');
  }
}
