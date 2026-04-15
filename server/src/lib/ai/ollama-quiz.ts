import { buildQuizFollowUpPrompt, buildQuizInitializationPrompt } from './prompt-builder.js';
import { AIGenerationProfile, AIUsage, QuizConversationMessage, QuizLearningState, RunQuizResult } from './types.js';

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:0.5b';
const DEFAULT_OLLAMA_TIMEOUT_MS = 90_000;

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
};

type RawQuizState = {
  criteria?: unknown;
  current_criterion?: unknown;
  all_passed?: unknown;
  message?: unknown;
};

type OllamaQuizParams = {
  profile: AIGenerationProfile;
  lessonTitle: string;
  lessonDescription: string;
  videoTopics: string[];
  userAnswer?: string;
  conversationHistory: QuizConversationMessage[];
  customPrompt?: string;
  learningState?: QuizLearningState;
  signal?: AbortSignal;
};

function buildFallbackCriteria(params: Pick<OllamaQuizParams, 'lessonTitle' | 'lessonDescription' | 'videoTopics'>) {
  const topicPool = params.videoTopics.filter(Boolean).slice(0, 4);
  const generatedTopics = topicPool.length > 0
    ? topicPool
    : [
        params.lessonTitle,
        'Ключевая идея урока',
        'Практическое применение',
      ];

  return generatedTopics.slice(0, 4).map((topic, index) => ({
    id: `c${index + 1}`,
    topic,
    description: index === 0
      ? `Объяснить основную идею темы "${topic}" своими словами.`
      : `Показать понимание темы "${topic}" на примере из практики.`,
    passed: false,
  }));
}

function getOllamaHost(): string {
  return (process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).trim().replace(/\/+$/, '');
}

function getOllamaModel(): string {
  return (process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim();
}

function getOllamaTimeoutMs(): number {
  const raw = Number(process.env.OLLAMA_TIMEOUT_MS || DEFAULT_OLLAMA_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_OLLAMA_TIMEOUT_MS;
}

function buildQuizJsonInstruction(): string {
  return [
    'Верни ТОЛЬКО один JSON-объект без markdown, без пояснений и без дополнительных строк.',
    'Строго обязательные поля JSON:',
    '{',
    '  "criteria": [{ "id": "c1", "topic": "строка", "description": "строка", "passed": false }],',
    '  "current_criterion": "c1",',
    '  "all_passed": false,',
    '  "message": "текст ответа студенту"',
    '}',
    'Требования к JSON:',
    '- criteria должен быть массивом из 3-4 критериев при инициализации;',
    '- id критериев должны быть c1, c2, c3, ...;',
    '- passed только boolean;',
    '- current_criterion должен ссылаться на существующий непройденный критерий, а если все пройдены, укажи последний или текущий;',
    '- message должен быть доброжелательным и содержательным ответом студенту на языке пользователя;',
    '- не добавляй никаких полей кроме criteria, current_criterion, all_passed, message.',
  ].join('\n');
}

function buildConversationTranscript(history: QuizConversationMessage[]): string {
  if (!history.length) {
    return 'История диалога пока пуста.';
  }

  return history
    .map((message) => `${message.role === 'user' ? 'Студент' : 'Тьютор'}: ${message.content}`)
    .join('\n');
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error('Ollama не вернула JSON-объект');
}

function normalizeLearningState(raw: RawQuizState): RunQuizResult['learningState'] {
  if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) {
    throw new Error('Ollama вернула пустые критерии');
  }

  const criteria = raw.criteria.map((criterion, index) => {
    if (!criterion || typeof criterion !== 'object') {
      throw new Error(`Некорректный критерий #${index + 1}`);
    }
    const row = criterion as Record<string, unknown>;
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `c${index + 1}`;
    const topic = typeof row.topic === 'string' ? row.topic.trim() : '';
    const description = typeof row.description === 'string' ? row.description.trim() : '';
    const passed = Boolean(row.passed);
    if (!topic || !description) {
      throw new Error(`Некорректные поля критерия ${id}`);
    }
    return { id, topic, description, passed };
  });

  const currentCriterion = typeof raw.current_criterion === 'string' && raw.current_criterion.trim()
    ? raw.current_criterion.trim()
    : criteria.find((criterion) => !criterion.passed)?.id || criteria[0].id;
  const allPassed = raw.all_passed === true || criteria.every((criterion) => criterion.passed);

  return {
    criteria,
    current_criterion: currentCriterion,
    all_passed: allPassed,
  };
}

function buildUsage(data: OllamaChatResponse): AIUsage {
  return {
    inputTokens: data.prompt_eval_count || 0,
    outputTokens: data.eval_count || 0,
  };
}

function buildFallbackResult(params: OllamaQuizParams, reason: string): RunQuizResult {
  const learningState = params.learningState
    ? {
        criteria: params.learningState.criteria,
        current_criterion: params.learningState.current_criterion,
        all_passed: params.learningState.all_passed,
      }
    : {
        criteria: buildFallbackCriteria(params),
        current_criterion: 'c1',
        all_passed: false,
      };

  const currentCriterion = learningState.criteria.find((criterion) => criterion.id === learningState.current_criterion)
    || learningState.criteria[0];
  const response = params.learningState
    ? `Я продолжу без смены состояния, потому что локальная модель вернула невалидный JSON. Сфокусируйся на критерии "${currentCriterion.topic}" и ответь точнее: ${currentCriterion.description}`
    : `Начинаем квиз. Первый критерий: "${currentCriterion.topic}". ${currentCriterion.description}`;

  console.warn('[ollama-quiz] Falling back to safe quiz state:', reason);

  return {
    response,
    learningState,
    allPassed: learningState.all_passed,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };
}

export async function runQuizWithOllama(params: OllamaQuizParams): Promise<RunQuizResult> {
  const isInitialization = !params.learningState || params.conversationHistory.length === 0;
  const basePrompt = isInitialization
    ? buildQuizInitializationPrompt({
        lessonTitle: params.lessonTitle,
        lessonDescription: params.lessonDescription,
        videoTopics: params.videoTopics,
        customPrompt: params.customPrompt,
      })
    : buildQuizFollowUpPrompt({
        lessonTitle: params.lessonTitle,
        lessonDescription: params.lessonDescription,
        videoTopics: params.videoTopics,
        customPrompt: params.customPrompt,
        learningState: params.learningState,
      });

  const transcript = buildConversationTranscript(params.conversationHistory);
  const systemPrompt = [
    basePrompt,
    '',
    buildQuizJsonInstruction(),
    '',
    'История текущего диалога:',
    transcript,
  ].join('\n');

  const timeoutSignal = AbortSignal.timeout(getOllamaTimeoutMs());
  const signal = params.signal ? AbortSignal.any([params.signal, timeoutSignal]) : timeoutSignal;

  const userContent = isInitialization
    ? 'Инициализируй квиз и верни первый вопрос студенту в виде JSON.'
    : `Оцени последний ответ студента и верни только JSON. Последний ответ: ${params.userAnswer || ''}`;

  const response = await fetch(`${getOllamaHost()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: getOllamaModel(),
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      options: {
        temperature: params.profile.temperature ?? 0.2,
        num_predict: params.profile.maxOutputTokens ?? 768,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Ollama quiz error (${response.status})`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  const rawContent = data.message?.content;
  if (!rawContent) {
    throw new Error('Ollama не вернула текстовый ответ');
  }

  try {
    const parsed = JSON.parse(extractJsonObject(rawContent)) as RawQuizState;
    const learningState = normalizeLearningState(parsed);
    const responseMessage = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : 'Продолжаем обучение.';

    return {
      response: responseMessage,
      learningState,
      allPassed: learningState.all_passed,
      usage: buildUsage(data),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildFallbackResult(params, reason);
  }
}
