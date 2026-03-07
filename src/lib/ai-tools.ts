export type AIToolConfig = {
  title: string;
  url: string;
  access: 'free' | 'paid';
  icon?: string;
  iconEmoji?: string;
  hasChat?: boolean;
  modelPath?: string;
  providerName?: string;
};

export const aiTools: AIToolConfig[] = [
  {
    title: 'Groq',
    url: '/groq',
    access: 'free',
    iconEmoji: '⚡',
    hasChat: true,
    modelPath: 'groq',
    providerName: 'groq',
  },
  {
    title: 'Озвучка',
    url: '/edge-tts',
    access: 'free',
    iconEmoji: '🎙',
  },
  {
    title: 'ChatGPT',
    url: '/chatgpt',
    access: 'paid',
    icon: '/icons/chatgpt.png',
    hasChat: true,
    modelPath: 'chatgpt',
  },
  {
    title: 'Gemini',
    url: '/gemini',
    access: 'paid',
    icon: '/icons/gemini.png',
    hasChat: true,
    modelPath: 'gemini',
    providerName: 'gemini',
  },
  {
    title: 'NanoBanana 3 Pro',
    url: '/nanobanana',
    access: 'paid',
    icon: '/icons/banano.png',
    hasChat: true,
    modelPath: 'nanobanana',
  },
];

export function getAIToolBadge(access: AIToolConfig['access']) {
  return access === 'free'
    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25'
    : 'bg-amber-500/15 text-amber-700 border-amber-500/25';
}

export function getAIToolByTitle(title: string): AIToolConfig | undefined {
  return aiTools.find((tool) => tool.title === title);
}

export function getAIToolByProvider(providerName?: string): AIToolConfig | undefined {
  if (!providerName) return undefined;
  return aiTools.find((tool) => tool.providerName === providerName);
}
