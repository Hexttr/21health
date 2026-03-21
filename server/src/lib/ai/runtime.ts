import { getActiveModels, getActiveProviderById, resolveActiveModel } from './catalog.js';
import { getAllowedPlatformSetting } from '../platform-settings.js';
import { AIResolvedModel } from './types.js';

function toResolvedModel(
  model: {
    id: string;
    providerId: string;
    modelKey: string;
    displayName: string;
    modelType: 'text' | 'image';
    supportsStreaming: boolean;
    supportsImageInput: boolean;
    supportsDocumentInput: boolean;
    supportsImageOutput: boolean;
    supportsSystemPrompt: boolean;
    inputPricePer1k: string | null;
    outputPricePer1k: string | null;
    fixedPrice: string | null;
  },
  providerName: string,
): AIResolvedModel {
  return {
    id: model.id,
    providerId: model.providerId,
    providerName,
    modelKey: model.modelKey,
    displayName: model.displayName,
    modelType: model.modelType,
    supportsStreaming: model.supportsStreaming,
    supportsImageInput: model.supportsImageInput,
    supportsDocumentInput: model.supportsDocumentInput,
    supportsImageOutput: model.supportsImageOutput,
    supportsSystemPrompt: model.supportsSystemPrompt,
    inputPricePer1k: model.inputPricePer1k,
    outputPricePer1k: model.outputPricePer1k,
    fixedPrice: model.fixedPrice,
  };
}

export async function resolveRuntimeModel(
  modelId: string | undefined,
  modelType: 'text' | 'image',
): Promise<AIResolvedModel | null> {
  const model = await resolveActiveModel(modelId, modelType);
  if (!model) return null;

  const provider = await getActiveProviderById(model.providerId);
  if (!provider) return null;

  return toResolvedModel(model, provider.name);
}

export async function resolveQuizRuntimeModel(): Promise<AIResolvedModel | null> {
  const configuredModelId = await getAllowedPlatformSetting('ai_quiz_model_id');
  if (configuredModelId) {
    const configuredModel = await resolveRuntimeModel(configuredModelId, 'text');
    if (configuredModel) {
      return configuredModel;
    }
  }

  const models = await getActiveModels();
  for (const model of models) {
    if (model.modelType !== 'text') continue;
    const provider = await getActiveProviderById(model.providerId);
    if (!provider) continue;
    if (provider.name !== 'gemini') continue;
    return toResolvedModel(model, provider.name);
  }

  return null;
}

export function ensureModelSupports(model: AIResolvedModel, capability: 'streaming' | 'imageInput' | 'documentInput' | 'imageOutput' | 'systemPrompt'): void {
  const supported = (() => {
    switch (capability) {
      case 'streaming':
        return model.supportsStreaming;
      case 'imageInput':
        return model.supportsImageInput;
      case 'documentInput':
        return model.supportsDocumentInput;
      case 'imageOutput':
        return model.supportsImageOutput;
      case 'systemPrompt':
        return model.supportsSystemPrompt;
    }
  })();

  if (!supported) {
    throw new Error(`Модель "${model.displayName}" не поддерживает capability "${capability}"`);
  }
}
