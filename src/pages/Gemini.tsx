import { AIChatPage } from '@/components/AIChatPage';

export default function Gemini() {
  return (
    <AIChatPage
      modelName="Gemini"
      modelIcon="✨"
      modelColor="from-blue-500 to-cyan-500"
      providerName="gemini"
      starterPrompts={[
        'Посмотри на это изображение и опиши, что на нём важно для моей задачи.',
        'Сравни два скрина и найди ключевые отличия.',
        'Проанализируй фото и предложи, как улучшить визуал.',
      ]}
    />
  );
}
