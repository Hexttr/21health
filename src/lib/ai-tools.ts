export type AIToolCategory = 'text' | 'image' | 'audio';
export type AIToolAudience = 'everyone' | 'ai_user' | 'regular_user';
export type AIToolAccent = 'violet' | 'emerald' | 'amber' | 'sky' | 'pink';

export type AIToolConfig = {
  id: string;
  title: string;
  url: string;
  access: 'free' | 'paid';
  category: AIToolCategory;
  icon?: string;
  iconEmoji?: string;
  hasChat?: boolean;
  modelPath?: string;
  providerName?: string;
  shortDescription: string;
  description: string;
  capabilities: string[];
  highlights: string[];
  recommendedFor: AIToolAudience[];
  ctaLabel: string;
  accent: AIToolAccent;
  priority: number;
  aiUserPriority?: number;
  regularUserPriority?: number;
};

export const aiTools: AIToolConfig[] = [
  {
    id: 'groq',
    title: 'Groq',
    url: '/groq',
    access: 'free',
    category: 'text',
    iconEmoji: '⚡',
    hasChat: true,
    modelPath: 'groq',
    providerName: 'groq',
    shortDescription: 'Быстрый бесплатный чат для повседневных задач.',
    description: 'Когда нужно быстро написать, сократить, придумать или переформулировать текст без лишних затрат.',
    capabilities: ['Быстрые ответы', 'Текстовые задачи', 'Ежедневное использование'],
    highlights: ['Бесплатно', 'Очень быстро', 'Хороший старт'],
    recommendedFor: ['everyone', 'ai_user', 'regular_user'],
    ctaLabel: 'Открыть чат',
    accent: 'emerald',
    priority: 96,
    aiUserPriority: 94,
    regularUserPriority: 100,
  },
  {
    id: 'edge-tts',
    title: 'Озвучка',
    url: '/edge-tts',
    access: 'free',
    category: 'audio',
    iconEmoji: '🎙',
    shortDescription: 'Озвучка текста прямо в браузере. Выбор мужского или женского голоса.',
    description: 'Подходит, когда нужно быстро прослушать текст, сделать голосовую демо-версию или проверить звучание формулировок.',
    capabilities: ['Озвучка текста', '2 голоса', 'Без загрузки файлов'],
    highlights: ['Бесплатно', 'Мгновенный старт', 'Для контента'],
    recommendedFor: ['everyone', 'regular_user'],
    ctaLabel: 'Открыть озвучку',
    accent: 'sky',
    priority: 80,
    regularUserPriority: 84,
  },
  {
    id: 'chatgpt',
    title: 'ChatGPT',
    url: '/chatgpt',
    access: 'paid',
    category: 'text',
    icon: '/icons/chatgpt.png',
    hasChat: true,
    modelPath: 'chatgpt',
    providerName: 'openai',
    shortDescription: 'Универсальный AI-помощник для текста, документов и изображений.',
    description: 'Лучший универсальный старт, если нужен один инструмент для диалога, анализа файлов, рабочих задач и мультимодальных сценариев.',
    capabilities: ['Документы', 'Изображения', 'Универсальный чат'],
    highlights: ['Самый универсальный', 'Для работы', 'Сильный мультимодал'],
    recommendedFor: ['everyone', 'ai_user', 'regular_user'],
    ctaLabel: 'Открыть ChatGPT',
    accent: 'violet',
    priority: 98,
    aiUserPriority: 99,
    regularUserPriority: 96,
  },
  {
    id: 'claude',
    title: 'Claude',
    url: '/claude',
    access: 'paid',
    category: 'text',
    icon: '/icons/claude.png',
    hasChat: true,
    modelPath: 'claude',
    providerName: 'anthropic',
    shortDescription: 'Сильный выбор для длинных текстов и аккуратного анализа.',
    description: 'Полезен для вдумчивого разбора документов, структурирования больших ответов и спокойной аналитической работы.',
    capabilities: ['Длинные тексты', 'Аналитика', 'Структурированные ответы'],
    highlights: ['Для анализа', 'Аккуратный стиль', 'Хорош для документов'],
    recommendedFor: ['everyone', 'ai_user', 'regular_user'],
    ctaLabel: 'Открыть Claude',
    accent: 'amber',
    priority: 90,
    aiUserPriority: 92,
    regularUserPriority: 88,
  },
  {
    id: 'gemini',
    title: 'Gemini',
    url: '/gemini',
    access: 'paid',
    category: 'text',
    icon: '/icons/gemini.png',
    hasChat: true,
    modelPath: 'gemini',
    providerName: 'gemini',
    shortDescription: 'Мультимодальный помощник для текста, документов и изображений.',
    description: 'Сильный инструмент для случаев, когда нужно сочетать диалог, анализ файлов и работу с визуальным контекстом в одном окне.',
    capabilities: ['Документы', 'Изображения', 'Мультимодальный чат'],
    highlights: ['Гибкий выбор', 'Мультимодальность', 'Для сложных задач'],
    recommendedFor: ['everyone', 'ai_user', 'regular_user'],
    ctaLabel: 'Открыть Gemini',
    accent: 'sky',
    priority: 97,
    aiUserPriority: 97,
    regularUserPriority: 95,
  },
  {
    id: 'nanobanana',
    title: 'NanoBanana 3 Pro',
    url: '/nanobanana',
    access: 'paid',
    category: 'image',
    icon: '/icons/banano.png',
    hasChat: true,
    modelPath: 'nanobanana',
    shortDescription: 'Генерация и редактирование изображений по промпту.',
    description: 'Идеально, когда нужно создать новую визуальную концепцию, улучшить изображение или быстро сделать вариации из референсов.',
    capabilities: ['Генерация изображений', 'Редактирование', 'Работа с референсами'],
    highlights: ['Для визуалов', 'Креативный режим', 'До 14 изображений'],
    recommendedFor: ['everyone', 'ai_user', 'regular_user'],
    ctaLabel: 'Открыть NanoBanana',
    accent: 'pink',
    priority: 84,
    aiUserPriority: 88,
    regularUserPriority: 82,
  },
];

export function getAIToolBadge(access: AIToolConfig['access']) {
  return access === 'free'
    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25'
    : 'bg-amber-500/15 text-amber-700 border-amber-500/25';
}

export function getAIToolAccessLabel(access: AIToolConfig['access']) {
  return access === 'free' ? 'Бесплатно' : 'Платно';
}

export function getAIToolByTitle(title: string): AIToolConfig | undefined {
  return aiTools.find((tool) => tool.title === title);
}

export function getAIToolByProvider(providerName?: string): AIToolConfig | undefined {
  if (!providerName) return undefined;
  return aiTools.find((tool) => tool.providerName === providerName);
}

export function getAIToolPriority(tool: AIToolConfig, role?: string | null) {
  if (role === 'ai_user') {
    return tool.aiUserPriority ?? tool.priority;
  }

  return tool.regularUserPriority ?? tool.priority;
}

export function sortAIToolsForRole(tools: AIToolConfig[], role?: string | null) {
  return [...tools].sort((a, b) => {
    const priorityDiff = getAIToolPriority(b, role) - getAIToolPriority(a, role);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.access !== b.access) return a.access === 'free' ? -1 : 1;
    return a.title.localeCompare(b.title, 'ru');
  });
}
