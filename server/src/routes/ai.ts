import { FastifyInstance, FastifyReply } from 'fastify';
import { getAuthFromRequest, JwtPayload } from '../lib/auth.js';
import { buildGenerationProfile, detectChatTaskMode } from '../lib/ai/generation-profiles.js';
import { getProviderApiKey } from '../lib/provider-keys.js';
import { buildChatSystemPrompt, buildQuizFollowUpPrompt, buildQuizInitializationPrompt } from '../lib/ai/prompt-builder.js';
import { getProviderAdapter } from '../lib/ai/provider-registry.js';
import { translateAiProviderErrorMessage } from '../lib/ai/error-messages.js';
import { resolveQuizRuntimeModel } from '../lib/ai/runtime.js';
import { AIResolvedModel, QuizConversationMessage, QuizLearningState } from '../lib/ai/types.js';

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

export async function aiRoutes(app: FastifyInstance) {
  app.get('/ai/health', async (_req, reply) => reply.send({ ok: true, service: 'ai' }));

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
