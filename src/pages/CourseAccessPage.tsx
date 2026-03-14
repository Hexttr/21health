import React, { useMemo, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useCourseCommerce } from '@/hooks/useCourseCommerce';
import { api } from '@/api/client';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  Sparkles,
  Brain,
  Wand2,
  MessageSquareText,
  Megaphone,
  Presentation,
  Search,
  Calculator,
  Bot,
  Video,
  Mic2,
  Mail,
  CalendarClock,
  Database,
  Workflow,
  BarChart3,
  UserRound,
  ShieldCheck,
  Target,
  Clock3,
  Library,
  ListChecks,
  Users,
  ChevronDown,
} from 'lucide-react';

type IconComponent = typeof Brain;

const promoImage = (name: string) => `https://promo.21day.club/images/${name}`;

const problemCards = [
  { image: promoImage('problem-time.webp'), text: 'Тратите часы на написание постов, писем и контента вместо работы с клиентами' },
  { image: promoImage('problem-start.webp'), text: 'Слышите про ChatGPT и нейросети, но не понимаете, с чего начать' },
  { image: promoImage('problem-competition.webp'), text: 'Конкуренты уже используют ИИ, а вы отстаете и теряете клиентов' },
  { image: promoImage('problem-routine.webp'), text: 'Рутина съедает время: запись, напоминания, отчеты, рассылки' },
  { image: promoImage('problem-disappointing.webp'), text: 'Пробовали ИИ, но результаты разочаровали: ответы были поверхностными' },
  { image: promoImage('problem-scale.webp'), text: 'Хотите масштабировать практику, но не хватает рук и времени' },
];

const audienceCards = [
  { image: promoImage('whom-psychologist.webp'), title: 'Психологи', text: 'Автоматизируйте документацию сессий, создавайте психообразовательные материалы и планы терапии' },
  { image: promoImage('whom-tarot.webp'), title: 'Тарологи', text: 'Генерируйте персонализированные отчеты, интерпретации раскладов и контент о Таро' },
  { image: promoImage('whom-numerologist.webp'), title: 'Нумерологи', text: 'Автоматизируйте расчеты, создавайте персональные отчеты и прогнозы для клиентов' },
  { image: promoImage('whom-coach.webp'), title: 'Коучи и консультанты', text: 'Оптимизируйте воронку продаж, контент-маркетинг и коммуникацию с клиентами' },
];

const weekSections: Array<{
  image: string;
  week: string;
  title: string;
  goal: string;
  days: Array<{ day: string; title: string; text: string; icon: IconComponent }>;
}> = [
  {
    image: promoImage('week-1.webp'),
    week: 'Неделя 1',
    title: 'Основы ИИ и базовые инструменты',
    goal: 'Цель: познакомиться с ИИ, научиться работать с текстовыми моделями',
    days: [
      { day: 'День 1', title: 'Введение в ИИ для вашей практики', text: 'Как работают нейросети, регистрация в ChatGPT, Claude и Gemini, этика использования', icon: Brain },
      { day: 'День 2', title: 'Основы промпт-инженеринга', text: 'Структура эффективного промпта, техники Zero-shot, Few-shot и Chain-of-thought', icon: Wand2 },
      { day: 'День 3', title: 'ИИ для работы с клиентскими текстами', text: 'Анализ запросов, автоматизация FAQ, шаблоны ответов, персонализация', icon: MessageSquareText },
      { day: 'День 4', title: 'ИИ для контента и маркетинга', text: 'Контент-стратегия, генерация идей, контент-план на месяц, адаптация под платформы', icon: Megaphone },
      { day: 'День 5', title: 'Визуальный контент и презентации', text: 'Midjourney, генерация изображений, Gamma AI для презентаций за 2 минуты', icon: Presentation },
      { day: 'День 6', title: 'ИИ для исследований и аналитики', text: 'Perplexity AI, анализ конкурентов, поиск трендов, сбор данных о ЦА', icon: Search },
      { day: 'День 7', title: 'Считаем новый проект с ИИ', text: 'Генерация бизнес-идей, валидация, unit-экономика, питч-дек за 30 минут', icon: Calculator },
    ],
  },
  {
    image: promoImage('week-2.webp'),
    week: 'Неделя 2',
    title: 'Продвинутые инструменты и автоматизация',
    goal: 'Цель: освоить специализированные инструменты и автоматизацию рутины',
    days: [
      { day: 'День 8', title: 'ИИ для работы с клиентами', text: 'Автоматизация записи, чат-боты в Telegram, автоответчики, follow-up', icon: Bot },
      { day: 'День 9', title: 'Видео-контент с ИИ', text: 'Invideo AI, HeyGen, создание Reels/Shorts, автоматические субтитры', icon: Video },
      { day: 'День 10', title: 'Озвучка и аудио-контент', text: 'ElevenLabs, Yandex SpeechKit, аудио-медитации, клонирование голоса', icon: Mic2 },
      { day: 'День 11', title: 'Email-маркетинг с ИИ', text: 'Сегментация, welcome-письма, триггерные рассылки, персонализация', icon: Mail },
      { day: 'День 12', title: 'Автоматизация соцсетей', text: 'SMMplanner, автопостинг в VK/Telegram, планирование публикаций', icon: CalendarClock },
      { day: 'День 13', title: 'Perplexity AI и база знаний', text: 'RAG-технологии, персональная база знаний, чат-бот на ваших материалах', icon: Database },
      { day: 'День 14', title: 'Практикум: полная воронка', text: 'Мини-проект: лид-магнит + email-серия + лендинг + автопостинг + запись', icon: Target },
    ],
  },
  {
    image: promoImage('week-3.webp'),
    week: 'Неделя 3',
    title: 'Продвинутая автоматизация и специализация',
    goal: 'Цель: создать полноценную экосистему ИИ-инструментов для практики',
    days: [
      { day: 'День 15', title: 'No-code автоматизация: n8n', text: 'Автоматизация без кода, интеграция сервисов, ChatGPT Actions', icon: Workflow },
      { day: 'День 16', title: 'ИИ-аналитика и дашборды', text: 'Яндекс DataLens, Google Looker Studio, KPI, автоматические отчеты', icon: BarChart3 },
      { day: 'День 17', title: 'Персональный ИИ-ассистент', text: 'Создание собственного GPT, обучение на ваших материалах, интеграция', icon: UserRound },
      { day: 'День 18', title: 'ИИ для личного бренда', text: 'Аутентичность, tone of voice, стратегия продвижения на 3 месяца', icon: Sparkles },
      { day: 'День 19', title: 'Специализация под вашу нишу', text: 'Индивидуальные инструменты для психологов, тарологов, нумерологов', icon: Target },
      { day: 'День 20', title: 'Этика и безопасность ИИ', text: 'Конфиденциальность, ограничения, информирование клиентов, ответственность', icon: ShieldCheck },
      { day: 'День 21', title: 'Финальный проект', text: 'Полноценная система: воронка + коммуникация + автоматизация + аналитика + ИИ-ассистент', icon: CheckCircle2 },
    ],
  },
];

const resultCards = [
  { title: '10+ часов в неделю', text: 'Экономия времени на рутинных задачах благодаря автоматизации', icon: Clock3 },
  { title: '15+ ИИ-инструментов', text: 'Освоите весь арсенал: от ChatGPT до автоматизации и аналитики', icon: Brain },
  { title: 'Рост аудитории', text: 'Контент-план, автопостинг, визуалы — все для увеличения охватов', icon: Target },
  { title: 'Рабочая система', text: 'Полноценная экосистема: воронка, рассылки, боты, аналитика, ИИ-ассистент', icon: Workflow },
  { title: '70+ готовых промптов', text: 'Библиотека промптов для вашей ниши: психология, таро, нумерология', icon: Library },
  { title: 'Сообщество и поддержка', text: 'Закрытый Telegram-чат, проверка заданий кураторами, доступ навсегда', icon: Users },
];

const bonusCards = [
  { image: promoImage('bonus-library.webp'), title: 'Библиотека промптов', text: '70+ готовых промптов для психологов, тарологов, нумерологов и универсальных задач' },
  { image: promoImage('bonus-checklist.webp'), title: 'Чек-лист инструментов', text: 'Полный список ИИ-инструментов с описаниями, ссылками и рекомендациями' },
  { image: promoImage('bonus-community.webp'), title: 'Закрытое сообщество', text: 'Telegram-группа выпускников для обмена опытом, кейсами и поддержки' },
  { image: promoImage('bonus-forever.webp'), title: 'Доступ на два месяца', text: 'Все записи уроков и материалы остаются у вас — на два месяца' },
];

const faqItems = [
  {
    question: 'Нужны ли технические навыки для прохождения курса?',
    answer: 'Нет. Курс создан специально для людей без технического бэкграунда. Все инструменты — no-code, мы все показываем пошагово. Если вы умеете пользоваться браузером и мессенджерами — вы справитесь.',
  },
  {
    question: 'Сколько времени нужно уделять в день?',
    answer: '15 минут на просмотр видеоурока и 30-60 минут на практическое задание. Итого около 1 часа в день. Все задания сразу применимы к вашей реальной практике.',
  },
  {
    question: 'Чем отличаются тарифы на 14 и 21 день?',
    answer: 'Тариф на 14 дней включает первые две недели: основы ИИ и продвинутые инструменты. Тариф на 21 день добавляет третью неделю с no-code автоматизацией, созданием персонального ИИ-ассистента, специализацией под вашу нишу и финальным проектом.',
  },
  {
    question: 'Нужно ли платить за ИИ-инструменты?',
    answer: 'Большинство инструментов в курсе бесплатны или имеют бесплатные тарифы, достаточные для обучения. Мы подбираем доступные российские аналоги там, где это возможно.',
  },
  {
    question: 'Что если я не успею пройти курс за 21 день?',
    answer: 'Доступ к записям уроков и материалам остается у вас. Вы можете проходить курс в своем темпе, а чат-сообщество продолжает работать после окончания потока.',
  },
  {
    question: 'Безопасно ли использовать ИИ в работе с клиентами?',
    answer: 'Этому посвящен отдельный урок. Мы учим этичному использованию ИИ: защита данных клиентов, информирование об использовании ИИ, понимание ограничений. ИИ помогает специалисту, а не заменяет его.',
  },
];

export default function CourseAccessPage() {
  const { courses, access, loading } = useCourseCommerce();
  const [isCreatingOrder, setIsCreatingOrder] = useState<string | null>(null);
  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.durationDays - b.durationDays),
    [courses]
  );
  const heroStats = [
    { value: '15+', label: 'ИИ-инструментов' },
    { value: '21', label: 'день практики' },
    { value: '15', label: 'минут в день' },
    { value: '70+', label: 'готовых промптов' },
  ];

  const handlePurchase = async (courseCode: string) => {
    setIsCreatingOrder(courseCode);
    try {
      const data = await api<{ paymentUrl: string }>('/course-orders', {
        method: 'POST',
        body: { courseCode },
      });
      window.location.href = data.paymentUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать заказ');
    } finally {
      setIsCreatingOrder(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
      <div className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
        <span className="font-semibold text-foreground text-sm">Доступ к курсу</span>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,#5d3fd3_0%,#7b5cff_45%,#ae86ff_100%)] px-6 py-8 text-white shadow-soft sm:px-8 sm:py-10">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${promoImage('hero.jpg')})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_35%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]">
              <Sparkles className="h-3.5 w-3.5" />
              Старт нового потока — скоро
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Освойте <span className="text-white/90 underline decoration-white/25 underline-offset-4">искусственный интеллект</span> за 21 день
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-white/85 sm:text-lg">
              Практический курс для психологов, тарологов, нумерологов и других помогающих специалистов. <strong>15 минут в день</strong> — и вы автоматизируете рутину, увеличите охваты и освободите время для клиентов.
            </p>
            {access?.hasCourseAccess && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Сейчас у вас открыт тариф: {access.courseTitle || `${access.grantedLessons} уроков`}
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => document.getElementById('tariffs')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-12 rounded-2xl bg-white px-6 text-base font-semibold text-primary hover:bg-white/95"
              >
                Выбрать тариф
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('program')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-12 rounded-2xl border-white/35 bg-white/10 px-6 text-base font-semibold text-white hover:bg-white/15"
              >
                Смотреть программу
              </Button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {heroStats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                  <div className="text-2xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>{item.value}</div>
                  <div className="mt-1 text-xs text-white/75">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Знакомо?</h2>
            <p className="mt-2 text-muted-foreground">Наш курс поможет вам избавиться от рутины</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {problemCards.map((card) => (
              <div key={card.text} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                <div className="aspect-[4/3] bg-secondary/20">
                  <img src={card.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-5 text-sm leading-6 text-foreground">{card.text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Для кого этот курс?</h2>
            <p className="mt-2 text-muted-foreground">Психологи, тарологи, нумерологи, коучи — все, кто помогает людям и хочет стать еще эффективнее</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {audienceCards.map((card) => (
              <div key={card.title} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                <div className="aspect-[5/3] bg-secondary/20">
                  <img src={card.image} alt={card.title} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="program" className="mt-10">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Программа курса</h2>
            <p className="mt-2 text-muted-foreground">3 недели — от основ до полноценной ИИ-экосистемы</p>
          </div>
          <div className="space-y-5">
            {weekSections.map((week, index) => (
              <div key={week.week} className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-soft">
                <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
                  <div className="relative min-h-[220px] bg-secondary/30 lg:min-h-full">
                    <img src={week.image} alt={week.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-white backdrop-blur-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">{week.week}</div>
                      <div className="mt-1 text-lg font-semibold">{week.title}</div>
                      <div className="mt-2 text-xs text-white/75">{week.goal}</div>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {week.days.map((day) => (
                        <div key={day.day} className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                              index === 0 ? 'bg-violet-500/15 text-violet-700' : index === 1 ? 'bg-sky-500/15 text-sky-700' : 'bg-amber-500/15 text-amber-700'
                            }`}>
                              <day.icon className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{day.day}</span>
                          </div>
                          <h4 className="text-sm font-semibold leading-5 text-foreground">{day.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{day.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Что вы получите?</h2>
            <p className="mt-2 text-muted-foreground">Конкретные результаты после прохождения курса</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {resultCards.map((card) => (
              <div key={card.title} className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="tariffs" className="mt-10">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Выберите свой тариф</h2>
            <p className="mt-2 text-muted-foreground">Начните трансформацию своей практики уже сегодня</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {sortedCourses.map((course) => {
            const isUpgradeCard = course.code === 'course_21' && access?.canUpgradeTo21;
            const priceLabel = isUpgradeCard
              ? `${Number(course.upgradePriceRub || 0).toLocaleString('ru-RU')} руб`
              : `${Number(course.priceRub).toLocaleString('ru-RU')} руб`;
            const isOwned = (access?.grantedLessons || 0) >= course.grantedLessons;
            const isAdvanced = course.code === 'course_21';
            const features = isAdvanced
              ? [
                  'Неделя 3: Продвинутая автоматизация',
                  'No-code автоматизация и персональный ИИ-ассистент',
                  'Финальный проект с обратной связью',
                  'Все из тарифа «Базовый» +',
                ]
              : [
                  'Неделя 1: Основы ИИ',
                  'Неделя 2: Продвинутые инструменты',
                  'Видеоуроки, практические задания и чат-сообщество',
                  'Можно докупить апгрейд до 21 дня позже',
                ];

            return (
              <div
                key={course.id}
                className={`flex h-full flex-col rounded-[2rem] border p-6 shadow-soft ${
                  isAdvanced ? 'border-primary/20 bg-[linear-gradient(180deg,rgba(124,92,255,0.08),rgba(255,255,255,0.96))]' : 'border-border/60 bg-card'
                }`}
              >
                <div>
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <PlayCircle className="h-3.5 w-3.5" />
                      {course.durationDays} дней
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">{course.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{course.description}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-[linear-gradient(135deg,#6d3fe0_0%,#8d5cff_100%)] px-4 py-4 text-center text-white shadow-sm">
                  <div className="text-3xl font-extrabold leading-none sm:text-[2rem]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {priceLabel}
                  </div>
                </div>

                <div className="mt-5 flex-1 space-y-2 rounded-2xl bg-secondary/30 p-4">
                  {features.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handlePurchase(course.code)}
                  disabled={loading || isOwned || isCreatingOrder !== null}
                  className="mt-5 h-12 w-full rounded-2xl text-base font-semibold"
                >
                  {isOwned
                    ? 'Уже доступно'
                    : isCreatingOrder === course.code
                      ? 'Создаем заказ...'
                      : isUpgradeCard
                        ? 'Сделать апгрейд'
                        : 'Оформить доступ'}
                  {!isOwned && isCreatingOrder !== course.code && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            );
          })}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Бонусы для каждого участника</h2>
            <p className="mt-2 text-muted-foreground">Дополнительные материалы в удобном виде</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {bonusCards.map((card) => (
              <div key={card.title} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                <div className="aspect-[5/4] bg-secondary/20">
                  <img src={card.image} alt={card.title} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-border/60 bg-card p-6 shadow-soft sm:p-8">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Частые вопросы</h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <details key={item.question} className="group overflow-hidden rounded-2xl border border-border/50 bg-secondary/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm leading-6 text-muted-foreground">{item.answer}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,#5d3fd3_0%,#8b6cff_100%)] px-6 py-8 text-white shadow-soft sm:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Готовы трансформировать свою практику с помощью ИИ?
            </h2>
            <p className="mt-4 text-sm text-white/85 sm:text-base">
              Присоединяйтесь к курсу и за 21 день постройте полноценную систему ИИ-инструментов для своей работы.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => document.getElementById('tariffs')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-12 rounded-2xl bg-white px-6 text-base font-semibold text-primary hover:bg-white/95"
              >
                Выбрать тариф
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById('program')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-12 rounded-2xl border-white/35 bg-white/10 px-6 text-base font-semibold text-white hover:bg-white/15"
              >
                Смотреть программу
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
