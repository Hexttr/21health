import { AIChatPage } from '@/components/AIChatPage';

export default function Claude() {
  return (
    <AIChatPage
      modelName="Claude"
      modelIcon="🧠"
      modelColor="from-violet-500 to-fuchsia-500"
      providerName="anthropic"
      starterPrompts={[
        'Помоги глубоко разобрать мою идею и найди слабые места.',
        'Посмотри на изображение и дай структурированную обратную связь.',
        'Сравни два подхода и предложи лучший с аргументами.',
      ]}
    />
  );
}
