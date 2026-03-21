import { AIGenerationProfile, AIResolvedModel, AITaskMode } from './types.js';

type ProfileDefaults = {
  temperature?: number;
  maxOutputTokens?: number;
};

const BASE_DEFAULTS: Record<AITaskMode, ProfileDefaults> = {
  chat: {
    temperature: 0.3,
    maxOutputTokens: 6144,
  },
  document_analysis: {
    temperature: 0.2,
    maxOutputTokens: 8192,
  },
  image_analysis: {
    temperature: 0.25,
    maxOutputTokens: 6144,
  },
  quiz: {
    temperature: 0.2,
    maxOutputTokens: 2048,
  },
};

const PROVIDER_OVERRIDES: Record<string, Partial<Record<AITaskMode, ProfileDefaults>>> = {
  anthropic: {
    chat: { temperature: 0.25, maxOutputTokens: 6144 },
    document_analysis: { temperature: 0.15, maxOutputTokens: 8192 },
    image_analysis: { temperature: 0.2, maxOutputTokens: 6144 },
    quiz: { temperature: 0.15, maxOutputTokens: 2048 },
  },
  gemini: {
    chat: { temperature: 0.3, maxOutputTokens: 6144 },
    document_analysis: { temperature: 0.2, maxOutputTokens: 8192 },
    image_analysis: { temperature: 0.25, maxOutputTokens: 6144 },
    quiz: { temperature: 0.2, maxOutputTokens: 2048 },
  },
  groq: {
    chat: { temperature: 0.25, maxOutputTokens: 6144 },
    document_analysis: { temperature: 0.15, maxOutputTokens: 8192 },
    image_analysis: { temperature: 0.2, maxOutputTokens: 6144 },
  },
  openai: {
    chat: { maxOutputTokens: 6144 },
    document_analysis: { maxOutputTokens: 8192 },
    image_analysis: { maxOutputTokens: 6144 },
    quiz: { maxOutputTokens: 2048 },
  },
};

export function detectChatTaskMode(messages: Array<{ images?: string[]; attachmentIds?: string[] }>): Exclude<AITaskMode, 'quiz'> {
  const hasDocuments = messages.some((message) => Array.isArray(message.attachmentIds) && message.attachmentIds.length > 0);
  if (hasDocuments) {
    return 'document_analysis';
  }

  const hasImages = messages.some((message) => Array.isArray(message.images) && message.images.length > 0);
  if (hasImages) {
    return 'image_analysis';
  }

  return 'chat';
}

export function buildGenerationProfile(params: {
  model: Pick<AIResolvedModel, 'providerName'>;
  taskMode: AITaskMode;
  systemPrompt: string;
}): AIGenerationProfile {
  const baseDefaults = BASE_DEFAULTS[params.taskMode];
  const providerDefaults = PROVIDER_OVERRIDES[params.model.providerName]?.[params.taskMode] || {};

  return {
    taskMode: params.taskMode,
    systemPrompt: params.systemPrompt,
    temperature: providerDefaults.temperature ?? baseDefaults.temperature,
    maxOutputTokens: providerDefaults.maxOutputTokens ?? baseDefaults.maxOutputTokens,
  };
}
