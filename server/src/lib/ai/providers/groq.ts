import {
  AIProviderAdapter,
  GenerateImageParams,
  GenerateImageResult,
  RunQuizParams,
  RunQuizResult,
  StreamChatParams,
  StreamChatResult,
} from '../types.js';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

function groqHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function parseGroqError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error || raw;
  } catch {
    return raw;
  }
}

export class GroqAdapter implements AIProviderAdapter {
  async streamChat(params: StreamChatParams): Promise<StreamChatResult> {
    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: groqHeaders(params.apiKey),
      signal: params.signal,
      body: JSON.stringify({
        model: params.model.modelKey,
        temperature: params.profile.temperature ?? 0.7,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: params.profile.systemPrompt },
          ...params.messages.map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
            content: message.content,
          })),
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      throw new Error(parseGroqError(errText || 'Groq stream error'));
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
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };

            const text = parsed.choices?.[0]?.delta?.content;
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
    throw new Error('Groq не поддерживает генерацию изображений в этом runtime');
  }

  async runQuiz(_params: RunQuizParams): Promise<RunQuizResult> {
    throw new Error('Groq пока не поддерживает режим AI-тьютора');
  }
}
