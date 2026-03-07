import { AIChatPage } from '@/components/AIChatPage';

export default function ChatGPT() {
  return (
    <AIChatPage
      modelName="ChatGPT"
      modelIcon="🤖"
      modelColor="from-green-500 to-emerald-500"
      providerName="openai"
      starterPrompts={[
        'Помоги структурировать задачу и разбить ее на шаги.',
        'Проанализируй этот скрин и предложи улучшения интерфейса.',
        'Сделай сильнее мой промпт для рабочей задачи.',
      ]}
    />
  );
}
