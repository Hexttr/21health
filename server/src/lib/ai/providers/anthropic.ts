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
        system: params.profile.systemPrompt,
        messages: params.messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: toAnthropicContent(message),
          })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(parseAnthropicError(errText || 'Anthropic chat error'));
    }

    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = (data.content || [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');

    if (text) {
      params.onDelta(text);
    }

    return {
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
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
