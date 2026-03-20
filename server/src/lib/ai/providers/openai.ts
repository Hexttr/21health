import {
  AIProviderAdapter,
  GenerateImageParams,
  GenerateImageResult,
  RunQuizParams,
  RunQuizResult,
  StreamChatParams,
  StreamChatResult,
} from '../types.js';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

function openaiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function parseOpenAIError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error || raw;
  } catch {
    return raw;
  }
}

function extractOpenAIText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const value = part as { text?: string; type?: string };
      if (typeof value.text === 'string' && (value.type === 'text' || value.type === 'output_text' || !value.type)) {
        return value.text;
      }
      return '';
    })
    .join('');
}

function toOpenAIContent(message: StreamChatParams['messages'][number]) {
  if (!message.images?.length) {
    return message.content;
  }

  return [
    ...(message.content.trim() ? [{ type: 'text', text: message.content }] : []),
    ...message.images.map((image) => ({
      type: 'image_url',
      image_url: { url: image },
    })),
  ];
}

export class OpenAIAdapter implements AIProviderAdapter {
  async streamChat(params: StreamChatParams): Promise<StreamChatResult> {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: openaiHeaders(params.apiKey),
      signal: params.signal,
      body: JSON.stringify({
        model: params.model.modelKey,
        stream: false,
        messages: [
          { role: 'system', content: params.systemPrompt },
          ...params.messages.map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
            content: toOpenAIContent(message),
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(parseOpenAIError(errText || 'OpenAI chat error'));
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = extractOpenAIText(data.choices?.[0]?.message?.content);
    if (text) {
      params.onDelta(text);
    }

    return {
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }

  async generateImage(_params: GenerateImageParams): Promise<GenerateImageResult> {
    throw new Error('OpenAI image generation пока не подключена в этом runtime');
  }

  async runQuiz(_params: RunQuizParams): Promise<RunQuizResult> {
    throw new Error('OpenAI пока не поддерживает режим AI-тьютора');
  }
}
