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

function extractOpenAIDeltaText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  return extractOpenAIText(content);
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
        stream: true,
        stream_options: { include_usage: true },
        ...(params.profile.temperature !== undefined ? { temperature: params.profile.temperature } : {}),
        ...(params.profile.maxOutputTokens !== undefined ? { max_completion_tokens: params.profile.maxOutputTokens } : {}),
        messages: [
          { role: 'system', content: params.profile.systemPrompt },
          ...params.messages.map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
            content: toOpenAIContent(message),
          })),
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      throw new Error(parseOpenAIError(errText || 'OpenAI chat error'));
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
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr) as {
              choices?: Array<{ delta?: { content?: string | Array<{ type?: string; text?: string }> } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = extractOpenAIDeltaText(parsed.choices?.[0]?.delta?.content);
            if (text) {
              params.onDelta(text);
            }

            if (parsed.usage) {
              inputTokens = parsed.usage.prompt_tokens || inputTokens;
              outputTokens = parsed.usage.completion_tokens || outputTokens;
            }
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
        inputTokens,
        outputTokens,
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
