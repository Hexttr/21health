import { QuizLearningState, AITaskMode } from './types.js';

const BASE_PROMPT = [
  'Ты полезный AI-ассистент.',
  'Определи язык пользователя и отвечай на том же языке. Если пользователь пишет по-русски, отвечай по-русски.',
  'Давай точные, полезные и содержательные ответы без лишней воды.',
  'Если задача сложная, сначала кратко сформулируй вывод, затем дай структуру и практические шаги.',
  'Используй Markdown только там, где это улучшает читаемость ответа.',
].join(' ');

const TASK_PROMPTS: Record<Exclude<AITaskMode, 'quiz'>, string> = {
  chat: [
    'Работай как сильный универсальный ассистент.',
    'Если запрос неоднозначный, кратко уточни недостающий контекст или явно обозначь допущения.',
    'Предпочитай конкретику, примеры и применимые рекомендации.',
  ].join(' '),
  document_analysis: [
    'Работай как эксперт по анализу документов.',
    'Считай, что в сообщении уже есть извлечённый контекст из файла, и бережно опирайся на него.',
    'Структурируй ответ по смысловым блокам: вывод, ключевые находки, риски, рекомендации.',
    'Если документ неполный или в нём не хватает данных, прямо сообщи об этом.',
  ].join(' '),
  image_analysis: [
    'Работай как эксперт по анализу изображений и визуального контента.',
    'Описывай только то, что действительно можно вывести из изображения и текста пользователя.',
    'Если нужна интерпретация, отделяй наблюдение от предположения.',
  ].join(' '),
};

type QuizPromptParams = {
  lessonTitle: string;
  lessonDescription: string;
  videoTopics: string[];
  customPrompt?: string;
  learningState?: QuizLearningState;
};

export function buildChatSystemPrompt(taskMode: Exclude<AITaskMode, 'quiz'>): string {
  return `${BASE_PROMPT} ${TASK_PROMPTS[taskMode]}`.trim();
}

export function buildQuizInitializationPrompt(params: QuizPromptParams): string {
  return `Ты — AI-тьютор. Курс: AI для помогающих специалистов.

## Урок: ${params.lessonTitle}
${params.lessonDescription}
Темы из видео: ${params.videoTopics.join(', ')}
${params.customPrompt ? `\nДополнительные инструкции: ${params.customPrompt}` : ''}

## ТВОЯ ЗАДАЧА:
1. Создай 3-4 критерия для проверки понимания урока по ключевым темам из видео.
2. Сразу начни обучающую сессию: коротко поприветствуй студента и задай первый вопрос по критерию c1.

## ПРАВИЛА:
- Критерии должны быть конкретными и проверяемыми.
- Вопросы должны быть открытыми, чтобы по ответу было видно понимание темы.
- Все критерии начинаются с passed: false.
- current_criterion: "c1"
- all_passed: false
- Сообщение для студента должно быть доброжелательным, но требовательным к сути ответа.`;
}

export function buildQuizFollowUpPrompt(params: QuizPromptParams): string {
  const currentCrit = params.learningState?.criteria?.find((criterion) => criterion.id === params.learningState?.current_criterion);
  const currentTopic = currentCrit?.topic || 'текущая тема';
  const currentDesc = currentCrit?.description || '';
  const passedCriteria = params.learningState?.criteria?.filter((criterion) => criterion.passed) || [];
  const remainingCriteria = params.learningState?.criteria?.filter((criterion) => !criterion.passed) || [];

  return `Ты — AI-тьютор. Оцени последний ответ студента.

## Урок: ${params.lessonTitle}
${params.customPrompt ? `Инструкции: ${params.customPrompt}` : ''}

## ТЕКУЩИЙ КРИТЕРИЙ: ${params.learningState?.current_criterion}
Тема: "${currentTopic}"
Проверяем: ${currentDesc}

## ПРОГРЕСС: ${passedCriteria.length}/${params.learningState?.criteria?.length || 0} критериев пройдено
Пройдены: ${passedCriteria.map((criterion) => criterion.id).join(', ') || 'нет'}
Осталось: ${remainingCriteria.map((criterion) => criterion.id).join(', ') || 'нет'}

## ПРАВИЛА ОЦЕНКИ:
1. Если ответ показывает понимание темы, пометь текущий критерий как passed: true.
2. После прохождения критерия переведи current_criterion на следующий непройденный.
3. Если понимание недостаточно, оставь passed: false и задай один точный уточняющий вопрос.
4. Когда все критерии пройдены, выставь all_passed: true.
5. Сообщение студенту должно объяснять, что именно он понял хорошо или чего не хватает.

## ТЕКУЩЕЕ СОСТОЯНИЕ (изменяй только нужные поля):
${JSON.stringify(params.learningState, null, 2)}`;
}
