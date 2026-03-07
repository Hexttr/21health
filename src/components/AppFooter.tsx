import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const IP_INFO = {
  name: 'ИП Кузнецов Р.С.',
  inn: '682 668 344 949',
  ogrn: '319 774 600 123 810',
  email: 'info@i-integrator.com',
  phone: '+7 925 685-25-25',
};

export function AppFooter() {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <>
      <footer className="flex-shrink-0 border-t border-border/40 bg-card/50 backdrop-blur-sm px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{IP_INFO.name}</span>
            <span>ИНН {IP_INFO.inn}</span>
            <span>ОГРН {IP_INFO.ogrn}</span>
            <a href={`mailto:${IP_INFO.email}`} className="hover:text-primary transition-colors">{IP_INFO.email}</a>
            <a href={`tel:${IP_INFO.phone.replace(/\s/g, '')}`} className="hover:text-primary transition-colors">{IP_INFO.phone}</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/oferta.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-primary font-medium transition-colors">
              Оферта
            </a>
            <button onClick={() => setRulesOpen(true)} className="hover:text-primary font-medium transition-colors">
              Правила пользования
            </button>
          </div>
        </div>
      </footer>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Правила пользования сервисом 21 DAY</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Сервис 21 DAY предоставляет доступ к образовательным материалам и AI-инструментам (чат, генерация изображений, квиз-тьютор) для курса по AI для помогающих специалистов.
            </p>

            <h3 className="font-semibold text-foreground">Условия использования</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Регистрация и доступ по пригласительному коду</li>
              <li>Пользователь несёт ответственность за использование AI-инструментов в соответствии с законодательством</li>
              <li>Запрещено использование сервиса для генерации запрещённого контента</li>
              <li>Администрация оставляет право ограничить доступ при нарушении правил</li>
            </ul>

            <h3 className="font-semibold text-foreground">Тарификация (примерные цены)</h3>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Чат (текст):</strong> от ~0,005 ₽ за 1K входящих токенов, от ~0,02 ₽ за 1K исходящих</li>
              <li>• <strong>Генерация изображений:</strong> от 2 ₽ за изображение (зависит от модели)</li>
              <li>• <strong>Бесплатно:</strong> 5 — ежедневный лимит бесплатных запросов</li>
            </ul>
            <p className="text-xs italic">
              Точные цены указаны в разделе «Биллинг и модели» в админ-панели. Стоимость может меняться.
            </p>

            <h3 className="font-semibold text-foreground">Оплата и пополнение</h3>
            <p>
              Пополнение баланса осуществляется через платёжную систему. Минимальная сумма пополнения — от 100 ₽. При оплате применяется оферта.
            </p>

            <p className="text-xs pt-2">
              По вопросам: <a href={`mailto:${IP_INFO.email}`} className="text-primary hover:underline">{IP_INFO.email}</a>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
