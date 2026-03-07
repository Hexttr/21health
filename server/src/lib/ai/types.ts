export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
  supportsImageOutput: boolean;
  supportsSystemPrompt: boolean;
  inputPricePer1k: string | null;
  outputPricePer1k: string | null;
  fixedPrice: string | null;
}

export interface StreamChatParams {
  apiKey: string;
  model: AIResolvedModel;
  messages: AIChatMessage[];
  systemPrompt: string;
  onDelta: (text: string) => void;
}

export interface StreamChatResult {
  usage: AIUsage;
}

export interface GenerateImageParams {
  apiKey: string;
  model: AIResolvedModel;
  prompt: string;
  images: string[];
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
  lessonTitle: string;
  lessonDescription: string;
  videoTopics: string[];
  userAnswer?: string;
  conversationHistory: QuizConversationMessage[];
  customPrompt?: string;
  learningState?: QuizLearningState;
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
