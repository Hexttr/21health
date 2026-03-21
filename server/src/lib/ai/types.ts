export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  attachmentIds?: string[];
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResolvedModel {
  id: string;
  providerId: string;
  providerName: string;
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
}

export type AITaskMode = 'chat' | 'document_analysis' | 'image_analysis' | 'quiz';

export interface AIGenerationProfile {
  taskMode: AITaskMode;
  systemPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StreamChatParams {
  apiKey: string;
  model: AIResolvedModel;
  messages: AIChatMessage[];
  profile: AIGenerationProfile;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  usage: AIUsage;
}

export interface GenerateImageParams {
  apiKey: string;
  model: AIResolvedModel;
  prompt: string;
  images: string[];
  signal?: AbortSignal;
}

export interface GenerateImageResult {
  imageUrl: string;
  usage: AIUsage;
}

export interface QuizConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuizLearningState {
  criteria: Array<{ id: string; topic: string; description: string; passed: boolean }>;
  current_criterion: string;
  all_passed: boolean;
}

export interface RunQuizParams {
  apiKey: string;
  model: AIResolvedModel;
  profile: AIGenerationProfile;
  lessonTitle: string;
  lessonDescription: string;
  videoTopics: string[];
  userAnswer?: string;
  conversationHistory: QuizConversationMessage[];
  customPrompt?: string;
  learningState?: QuizLearningState;
  signal?: AbortSignal;
}

export interface RunQuizResult {
  response: string;
  learningState: QuizLearningState;
  allPassed: boolean;
  usage: AIUsage;
}

export interface AIProviderAdapter {
  streamChat(params: StreamChatParams): Promise<StreamChatResult>;
  generateImage(params: GenerateImageParams): Promise<GenerateImageResult>;
  runQuiz(params: RunQuizParams): Promise<RunQuizResult>;
}
