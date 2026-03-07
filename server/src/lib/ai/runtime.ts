import { getActiveProviderById, resolveActiveModel } from './catalog.js';
import { AIResolvedModel } from './types.js';

export async function resolveRuntimeModel(
  modelId: string | undefined,
  modelType: 'text' | 'image',
): Promise<AIResolvedModel | null> {
  const model = await resolveActiveModel(modelId, modelType);
  if (!model) return null;

  const provider = await getActiveProviderById(model.providerId);
  if (!provider) return null;

  return {
    id: model.id,
    providerId: model.providerId,
    providerName: provider.name,
    modelKey: model.modelKey,
    displayName: model.displayName,
    modelType: model.modelType,
    supportsStreaming: model.supportsStreaming,
    supportsImageInput: model.supportsImageInput,
    supportsImageOutput: model.supportsImageOutput,
    supportsSystemPrompt: model.supportsSystemPrompt,
    inputPricePer1k: model.inputPricePer1k,
    outputPricePer1k: model.outputPricePer1k,
    fixedPrice: model.fixedPrice,
  };
}

export function ensureModelSupports(model: AIResolvedModel, capability: 'streaming' | 'imageInput' | 'imageOutput' | 'systemPrompt'): void {
  const supported = (() => {
    switch (capability) {
      case 'streaming':
        return model.supportsStreaming;
      case 'imageInput':
        return model.supportsImageInput;
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
