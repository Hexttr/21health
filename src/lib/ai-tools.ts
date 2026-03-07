export type AIToolConfig = {
  title: string;
  url: string;
  access: 'free' | 'paid';
  icon?: string;
  iconEmoji?: string;
  hasChat?: boolean;
  modelPath?: string;
};

export const aiTools: AIToolConfig[] = [
  {
    title: 'Groq',
    url: '/groq',
    access: 'free',
    iconEmoji: '⚡',
    hasChat: true,
    modelPath: 'groq',
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
