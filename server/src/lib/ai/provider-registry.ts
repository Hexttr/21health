import { GeminiAdapter } from './providers/gemini.js';
import { AIProviderAdapter } from './types.js';

const registry: Record<string, AIProviderAdapter> = {
  gemini: new GeminiAdapter(),
};

export function getProviderAdapter(providerName: string): AIProviderAdapter {
  const adapter = registry[providerName];
  if (!adapter) {
    throw new Error(`Провайдер "${providerName}" пока не поддерживается runtime`);
  }
  return adapter;
}
