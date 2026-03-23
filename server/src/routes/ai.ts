import { FastifyInstance, FastifyReply } from 'fastify';
import { getAuthFromRequest, JwtPayload } from '../lib/auth.js';
import { checkBilling, calculateCost, deductBalance, getBalance, logUsage, getMarkupPercent, UsageCost } from '../lib/billing.js';
import { aiAttachmentConfig, buildAttachmentContext, resolveAttachmentsForUser } from '../lib/ai/attachments.js';
import { buildGenerationProfile, detectChatTaskMode } from '../lib/ai/generation-profiles.js';
import { getProviderApiKey, getGeminiKey } from '../lib/provider-keys.js';
import { buildChatSystemPrompt, buildQuizFollowUpPrompt, buildQuizInitializationPrompt } from '../lib/ai/prompt-builder.js';
import { getProviderAdapter } from '../lib/ai/provider-registry.js';
import { translateAiProviderErrorMessage } from '../lib/ai/error-messages.js';
import { ensureModelSupports, resolveQuizRuntimeModel, resolveRuntimeModel } from '../lib/ai/runtime.js';
import { AIChatMessage, AIResolvedModel, AITaskMode, QuizConversationMessage, QuizLearningState } from '../lib/ai/types.js';
const MAX_IMAGES = 14;
const MAX_DOCUMENTS_PER_MESSAGE = aiAttachmentConfig.maxDocumentsPerMessage;
const MAX_SINGLE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CHAT_TOTAL_IMAGE_BYTES = 18 * 1024 * 1024;
const MAX_IMAGE_GENERATION_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_BYTES = 30 * 1024 * 1024;

type BillingState = Awaited<ReturnType<typeof checkBilling>>;

function requireAuth(req: Parameters<typeof getAuthFromRequest>[0], reply: { status: (code: number) => { send: (body: unknown) => unknown } }): JwtPayload | null {
  const payload = getAuthFromRequest(req);
  if (!payload) { reply.status(401).send({ error: 'Требуется авторизация' }); return null; }
  return payload;
}

function parseErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw);
    const extracted = parsed?.error?.message || parsed?.error || raw;
    return translateAiProviderErrorMessage(String(extracted));
  } catch {
    return translateAiProviderErrorMessage(raw);
  }
}

function parseMoney(value: string | null | undefined): number {
  return parseFloat(value || '0');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));
}

function writeSseChunk(reply: FastifyReply, text: string): void {
  reply.raw.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
}

function estimateDataUrlBytes(value: string): number {
  if (!value) return 0;
  const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  const normalized = base64.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function collectImagePayloadStats(messages: Array<{ images?: string[] }>): { totalBytes: number; maxSingleBytes: number } {
  let totalBytes = 0;
  let maxSingleBytes = 0;

  for (const message of messages) {
    for (const image of message.images || []) {
      const size = estimateDataUrlBytes(image);
      totalBytes += size;
      maxSingleBytes = Math.max(maxSingleBytes, size);
    }
  }

  return { totalBytes, maxSingleBytes };
}

function createAbortController(req: { raw: NodeJS.EventEmitter & { destroyed?: boolean } }) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.raw.once('close', abort);
  return {
    controller,
    cleanup: () => req.raw.off('close', abort),
  };
}

function wasReplyDelivered(reply: FastifyReply): boolean {
  return Boolean(reply.raw.writableFinished || (reply.raw.writableEnded && !reply.raw.destroyed));
}

async function sendJsonAndWaitForDelivery(reply: FastifyReply, payload: unknown): Promise<boolean> {
  return await new Promise<boolean>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      reply.raw.off('finish', onFinish);
      reply.raw.off('close', onClose);
      reply.raw.off('error', onError);
    };
    const finish = (delivered: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(delivered);
    };
    const onFinish = () => finish(true);
    const onClose = () => finish(wasReplyDelivered(reply));
    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    reply.raw.once('finish', onFinish);
    reply.raw.once('close', onClose);
    reply.raw.once('error', onError);

    try {
      reply.send(payload);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function resolveKeyOrReply(model: AIResolvedModel, reply: FastifyReply): Promise<string | null> {
  const key = await getProviderApiKey(model.providerId);
  if (!key) {
    reply.status(500).send({ error: `API-ключ для провайдера "${model.providerName}" не настроен` });
    return null;
  }
  return key;
}

function buildChatProfile(model: AIResolvedModel, taskMode: Exclude<AITaskMode, 'quiz'>) {
  return buildGenerationProfile({
    model,
    taskMode,
    systemPrompt: buildChatSystemPrompt(taskMode, model.providerName),
  });
}

function isModelFree(model: AIResolvedModel): boolean {
  if (model.modelType === 'image') {
    return parseMoney(model.fixedPrice) <= 0;
  }

  return parseMoney(model.inputPricePer1k) <= 0 && parseMoney(model.outputPricePer1k) <= 0;
}

async function resolveBillingForModel(payload: JwtPayload, model: AIResolvedModel): Promise<BillingState> {
  if (isModelFree(model)) {
    return {
      isFree: false,
      balance: await getBalance(payload.userId),
      canProceed: true,
    };
  }

  return checkBilling(payload.userId, payload.role === 'admin');
}

function hasImageAttachments(messages: Array<{ images?: string[] }>): boolean {
  return messages.some((message) => Array.isArray(message.images) && message.images.length > 0);
}

function exceedsImageLimit(messages: Array<{ images?: string[] }>): boolean {
  return messages.some((message) => Array.isArray(message.images) && message.images.length > MAX_IMAGES);
}

function hasDocumentAttachments(messages: Array<{ attachmentIds?: string[] }>): boolean {
  return messages.some((message) => Array.isArray(message.attachmentIds) && message.attachmentIds.length > 0);
}

function exceedsDocumentLimit(messages: Array<{ attachmentIds?: string[] }>): boolean {
  return messages.some((message) => Array.isArray(message.attachmentIds) && message.attachmentIds.length > MAX_DOCUMENTS_PER_MESSAGE);
}

async function enrichMessagesWithAttachments(
  userId: string,
  messages: Array<{ role: string; content: string; images?: string[]; attachmentIds?: string[] }>,
): Promise<AIChatMessage[]> {
  const result: AIChatMessage[] = [];

  for (const message of messages) {
    const normalizedRole = message.role === 'assistant'
      ? 'assistant'
      : message.role === 'system'
        ? 'system'
        : 'user';

    let content = message.content;
    const attachmentIds = normalizedRole === 'user' && Array.isArray(message.attachmentIds)
      ? message.attachmentIds.slice(0, MAX_DOCUMENTS_PER_MESSAGE)
      : [];

    if (attachmentIds.length > 0) {
      const attachments = await resolveAttachmentsForUser(userId, attachmentIds);
      const attachmentContext = buildAttachmentContext(attachments);
      if (attachmentContext) {
        content = `${content.trim()}\n\n[Контекст из документов]\n${attachmentContext}`.trim();
      }
    }

    result.push({
      role: normalizedRole,
      content,
      images: Array.isArray(message.images) ? message.images.slice(0, MAX_IMAGES) : [],
      attachmentIds,
    });
  }

  return result;
}

async function validateResolvedAttachmentWeight(
  userId: string,
  messages: Array<{ role: string; attachmentIds?: string[] }>,
): Promise<void> {
  let totalBytes = 0;

  for (const message of messages) {
    const attachmentIds = Array.isArray(message.attachmentIds)
      ? message.attachmentIds.slice(0, MAX_DOCUMENTS_PER_MESSAGE)
      : [];

    if (attachmentIds.length === 0) continue;

    const attachments = await resolveAttachmentsForUser(userId, attachmentIds);
    for (const attachment of attachments) {
      totalBytes += attachment.fileSize;
      if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
        throw new Error(`Слишком тяжёлый набор документов. Максимум ${Math.round(MAX_TOTAL_DOCUMENT_BYTES / (1024 * 1024))} MB на запрос.`);
      }
    }
  }
}

async function calculateUsageCost(params: {
  payload: JwtPayload;
  model: AIResolvedModel;
  billing: Awaited<ReturnType<typeof checkBilling>>;
  requestType: 'chat' | 'image' | 'quiz';
  usage: { inputTokens: number; outputTokens: number };
  description: string;
}): Promise<UsageCost> {
  const markup = await getMarkupPercent();
  return calculateCost(
    params.model.modelType,
    parseMoney(params.model.inputPricePer1k),
    parseMoney(params.model.outputPricePer1k),
    parseMoney(params.model.fixedPrice),
    params.usage.inputTokens,
    params.usage.outputTokens,
    markup,
  );
}

async function finalizeUsageBilling(params: {
  payload: JwtPayload;
  model: AIResolvedModel;
  billing: Awaited<ReturnType<typeof checkBilling>>;
  requestType: 'chat' | 'image' | 'quiz';
  usage: { inputTokens: number; outputTokens: number };
  description: string;
}): Promise<UsageCost> {
  const cost = await calculateUsageCost(params);

  const usageId = await logUsage(params.payload.userId, params.model.id, params.requestType, cost, params.billing.isFree);
  if (!params.billing.isFree && cost.finalCost > 0) {
    await deductBalance(params.payload.userId, cost.finalCost, params.description, usageId);
  }

  return cost;
}

export async function aiRoutes(app: FastifyInstance) {
  app.get('/ai/health', async (_req, reply) => reply.send({ ok: true, service: 'ai' }));

  app.get('/ai/models', async (_req, reply) => {
    const key = await getGeminiKey();
    if (!key) return reply.status(500).send({ error: 'API-ключ Gemini не настроен' });
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': key },
      });
      const data = await res.json();
      if (!res.ok) return reply.status(res.status).send(data);
      const models = (data.models || []).map((m: { name: string; supportedGenerationMethods?: string[] }) => ({
        name: m.name?.replace('models/', ''),
        methods: m.supportedGenerationMethods,
      }));
      return reply.send({ models });
    } catch (e) {
      return reply.status(500).send({ error: String(e) });
    }
  });

  app.post<{
    Body: { messages: Array<{ role: string; content: string; images?: string[]; attachmentIds?: string[] }>; modelId?: string };
  }>('/ai/chat', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;

    const { messages = [], modelId } = req.body || {};
    const model = await resolveRuntimeModel(modelId, 'text');
    if (!model) return reply.status(400).send({ error: 'Нет активной текстовой модели' });

    try {
      ensureModelSupports(model, 'streaming');
    } catch (error) {
      return reply.status(400).send({ error: parseErrorMessage(error) });
    }

    if (hasImageAttachments(messages) && !model.supportsImageInput) {
      return reply.status(400).send({ error: `Модель "${model.displayName}" не поддерживает входные изображения` });
    }
    if (exceedsImageLimit(messages)) {
      return reply.status(400).send({ error: `Максимум ${MAX_IMAGES} изображений в одном сообщении` });
    }
    const imageStats = collectImagePayloadStats(messages);
    if (imageStats.maxSingleBytes > MAX_SINGLE_IMAGE_BYTES) {
      return reply.status(400).send({ error: `Одно из изображений слишком большое. Максимум ${Math.round(MAX_SINGLE_IMAGE_BYTES / (1024 * 1024))} MB на изображение.` });
    }
    if (imageStats.totalBytes > MAX_CHAT_TOTAL_IMAGE_BYTES) {
      return reply.status(400).send({ error: `Слишком тяжёлый набор изображений. Максимум ${Math.round(MAX_CHAT_TOTAL_IMAGE_BYTES / (1024 * 1024))} MB на запрос.` });
    }
    if (hasDocumentAttachments(messages) && !model.supportsDocumentInput) {
      return reply.status(400).send({ error: `Модель "${model.displayName}" не поддерживает анализ документов` });
    }
    if (exceedsDocumentLimit(messages)) {
      return reply.status(400).send({ error: `Максимум ${MAX_DOCUMENTS_PER_MESSAGE} документов в одном сообщении` });
    }
    try {
      await validateResolvedAttachmentWeight(payload.userId, messages);
    } catch (error) {
      return reply.status(400).send({ error: parseErrorMessage(error) });
    }

    const key = await resolveKeyOrReply(model, reply);
    if (!key) return;

    const billing = await resolveBillingForModel(payload, model);
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    reply.hijack();
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const { controller, cleanup } = createAbortController(req);

    try {
      const enrichedMessages = await enrichMessagesWithAttachments(payload.userId, messages);
      const taskMode = detectChatTaskMode(messages);
      const profile = buildChatProfile(model, taskMode);
      const adapter = getProviderAdapter(model.providerName);
      const result = await adapter.streamChat({
        apiKey: key,
        model,
        messages: enrichedMessages,
        profile,
        onDelta: (text) => writeSseChunk(reply, text),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      try {
        await finalizeUsageBilling({
          payload,
          model,
          billing,
          requestType: 'chat',
          usage: result.usage,
          description: `Chat: ${result.usage.inputTokens}+${result.usage.outputTokens} tokens`,
        });
      } catch (error) {
        req.log.error({ err: error, userId: payload.userId, modelId: model.id }, 'Failed to finalize chat billing after stream generation');
      }

      reply.raw.write('data: [DONE]\n\n');
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        reply.raw.write(`data: ${JSON.stringify({ error: parseErrorMessage(error) })}\n\n`);
      }
    } finally {
      cleanup();
      if (!reply.raw.writableEnded && !reply.raw.destroyed) {
        reply.raw.end();
      }
    }
  });

  app.post<{
    Body: { prompt: string; image?: string; images?: string[]; modelId?: string };
  }>('/ai/image', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;

    const { prompt, image, images: imagesRaw, modelId } = req.body || {};
    if (!prompt?.trim()) return reply.status(400).send({ error: 'prompt обязателен' });

    const model = await resolveRuntimeModel(modelId, 'image');
    if (!model) return reply.status(400).send({ error: 'Нет активной image-модели' });

    const key = await resolveKeyOrReply(model, reply);
    if (!key) return;

    const billing = await resolveBillingForModel(payload, model);
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const imageList = Array.isArray(imagesRaw) ? imagesRaw : (image ? [image] : []);
    if (imageList.length > MAX_IMAGES) return reply.status(400).send({ error: `Максимум ${MAX_IMAGES} изображений` });
    if (imageList.length > 0 && !model.supportsImageInput) {
      return reply.status(400).send({ error: `Модель "${model.displayName}" не поддерживает входные изображения` });
    }
    const imageStats = collectImagePayloadStats([{ images: imageList }]);
    if (imageStats.maxSingleBytes > MAX_SINGLE_IMAGE_BYTES) {
      return reply.status(400).send({ error: `Одно из изображений слишком большое. Максимум ${Math.round(MAX_SINGLE_IMAGE_BYTES / (1024 * 1024))} MB на изображение.` });
    }
    if (imageStats.totalBytes > MAX_IMAGE_GENERATION_TOTAL_IMAGE_BYTES) {
      return reply.status(400).send({ error: `Слишком тяжёлый набор изображений. Максимум ${Math.round(MAX_IMAGE_GENERATION_TOTAL_IMAGE_BYTES / (1024 * 1024))} MB на запрос.` });
    }
    if (!model.supportsImageOutput) {
      return reply.status(400).send({ error: `Модель "${model.displayName}" не поддерживает генерацию изображений` });
    }

    const { controller, cleanup } = createAbortController(req);
    try {
      const adapter = getProviderAdapter(model.providerName);
      const result = await adapter.generateImage({
        apiKey: key,
        model,
        prompt,
        images: imageList,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const cost = await calculateUsageCost({
        payload,
        model,
        billing,
        requestType: 'image',
        usage: result.usage,
        description: 'Image generation',
      });

      const delivered = await sendJsonAndWaitForDelivery(reply, {
        imageUrl: result.imageUrl,
        cost: { finalCost: cost.finalCost, isFree: billing.isFree },
      });

      if (!delivered || controller.signal.aborted) return;

      try {
        await finalizeUsageBilling({
          payload,
          model,
          billing,
          requestType: 'image',
          usage: result.usage,
          description: 'Image generation',
        });
      } catch (error) {
        req.log.error({ err: error, userId: payload.userId, modelId: model.id }, 'Failed to finalize image billing after response delivery');
      }

      return;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      return reply.status(502).send({ error: parseErrorMessage(error) });
    } finally {
      cleanup();
    }
  });

  app.post<{
    Body: {
      lessonTitle: string;
      lessonDescription: string;
      videoTopics: string[];
      userAnswer?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      customPrompt?: string;
      customPromptIsOverride?: boolean;
      learningState?: QuizLearningState;
    };
  }>('/ai/quiz', async (req, reply) => {
    const payload = requireAuth(req, reply);
    if (!payload) return;

    const model = await resolveQuizRuntimeModel();
    if (!model) return reply.status(400).send({ error: 'Нет активной текстовой модели для квиза' });
    if (model.providerName !== 'gemini') {
      return reply.status(400).send({ error: 'Для AI-квиза нужна совместимая Gemini-модель. Обновите настройку модели квиза в админке.' });
    }

    const key = await resolveKeyOrReply(model, reply);
    if (!key) return;

    const billing = await resolveBillingForModel(payload, model);
    if (!billing.canProceed) return reply.status(402).send({ error: 'Недостаточно средств. Пополните баланс.' });

    const {
      lessonTitle,
      lessonDescription,
      videoTopics = [],
      userAnswer,
      conversationHistory = [],
      customPrompt,
      customPromptIsOverride = false,
      learningState,
    } = req.body || {};
    const systemPrompt = customPromptIsOverride && customPrompt?.trim()
      ? customPrompt.trim()
      : conversationHistory.length === 0
        ? buildQuizInitializationPrompt({
            lessonTitle,
            lessonDescription,
            videoTopics,
            customPrompt,
          })
        : buildQuizFollowUpPrompt({
            lessonTitle,
            lessonDescription,
            videoTopics,
            customPrompt,
            learningState,
          });
    const profile = buildGenerationProfile({
      model,
      taskMode: 'quiz',
      systemPrompt,
    });

    const { controller, cleanup } = createAbortController(req);
    try {
      const adapter = getProviderAdapter(model.providerName);
      const result = await adapter.runQuiz({
        apiKey: key,
        model,
        profile,
        lessonTitle,
        lessonDescription,
        videoTopics,
        userAnswer,
        conversationHistory: conversationHistory as QuizConversationMessage[],
        customPrompt,
        learningState,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const delivered = await sendJsonAndWaitForDelivery(reply, {
        response: result.response,
        learningState: result.learningState,
        allPassed: result.allPassed,
      });

      if (!delivered || controller.signal.aborted) return;

      try {
        await finalizeUsageBilling({
          payload,
          model,
          billing,
          requestType: 'quiz',
          usage: result.usage,
          description: `Quiz: ${result.usage.inputTokens}+${result.usage.outputTokens} tokens`,
        });
      } catch (error) {
        req.log.error({ err: error, userId: payload.userId, modelId: model.id }, 'Failed to finalize quiz billing after response delivery');
      }

      return;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      if (learningState) {
        return reply.send({ response: 'Произошла ошибка обработки. Попробуйте повторить ваш ответ.', learningState, allPassed: false });
      }
      return reply.status(502).send({ error: parseErrorMessage(error) });
    } finally {
      cleanup();
    }
  });

}
