import { AnthropicAdapter } from './providers/anthropic.js';
import { GeminiAdapter } from './providers/gemini.js';
import { GroqAdapter } from './providers/groq.js';
import { OpenAIAdapter } from './providers/openai.js';
import { AIProviderAdapter } from './types.js';

const registry: Record<string, AIProviderAdapter> = {
  anthropic: new AnthropicAdapter(),
  gemini: new GeminiAdapter(),
  groq: new GroqAdapter(),
  openai: new OpenAIAdapter(),
};

export function getProviderAdapter(providerName: string): AIProviderAdapter {
  const adapter = registry[providerName];
  if (!adapter) {
    throw new Error(`Провайдер "${providerName}" пока не поддерживается runtime`);
  }
  return adapter;
}
