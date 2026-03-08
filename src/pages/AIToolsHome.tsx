import * as React from "react";
import {
  ArrowRight,
  AudioLines,
  FileText,
  ImageIcon,
  Sparkles,
  Stars,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { BalanceWidget } from "@/components/BalanceWidget";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  aiTools,
  getAIToolAccessLabel,
  getAIToolBadge,
  sortAIToolsForRole,
  type AIToolAccent,
  type AIToolCategory,
  type AIToolConfig,
} from "@/lib/ai-tools";
import { cn } from "@/lib/utils";

const accentClassMap: Record<AIToolAccent, string> = {
  violet: "from-primary/18 via-primary/12 to-white/92",
  emerald: "from-emerald-500/18 via-emerald-500/12 to-white/92",
  amber: "from-primary/14 via-primary/8 to-white/94",
  sky: "from-sky-500/18 via-sky-500/12 to-white/92",
  pink: "from-fuchsia-500/18 via-pink-500/12 to-white/92",
};

const accentBorderMap: Record<AIToolAccent, string> = {
  violet: "border-primary/20",
  emerald: "border-emerald-500/20",
  amber: "border-primary/18",
  sky: "border-sky-500/20",
  pink: "border-fuchsia-500/20",
};

const categoryMeta: Record<
  AIToolCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  text: { label: "Текст", icon: FileText },
  image: { label: "Изображения", icon: ImageIcon },
  audio: { label: "Аудио", icon: AudioLines },
};

function ToolVisual({ tool }: { tool: AIToolConfig }) {
  if (tool.icon) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/85 shadow-sm">
        <img src={tool.icon} alt="" className="h-8 w-8 object-contain" />
      </span>
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/85 text-xl shadow-sm">
      {tool.iconEmoji || "•"}
    </span>
  );
}

function ToolCard({
  tool,
  featured = false,
}: {
  tool: AIToolConfig;
  featured?: boolean;
}) {
  const category = categoryMeta[tool.category];
  const CategoryIcon = category.icon;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[28px] border bg-card shadow-soft backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accentBorderMap[tool.accent],
        featured ? "p-5 md:p-6" : "p-4 md:p-5",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-100",
          accentClassMap[tool.accent],
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ToolVisual tool={tool} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground md:text-[1.15rem]">
                  {tool.title}
                </h3>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                    getAIToolBadge(tool.access),
                  )}
                >
                  {getAIToolAccessLabel(tool.access)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/72">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/18 bg-primary/10 px-2.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                  <CategoryIcon className="h-3.5 w-3.5" />
                  {category.label}
                </span>
                {tool.highlights.slice(0, 1).map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-primary/18 bg-primary/10 px-2.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p
          className={cn(
            "mt-4 text-sm text-foreground/90",
            featured ? "line-clamp-3 leading-6" : "line-clamp-2 leading-5.5",
          )}
        >
          {featured ? tool.description : tool.shortDescription}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 overflow-x-auto pb-1">
          {tool.capabilities.map((capability) => (
            <span
              key={capability}
              className="whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground/92 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
            >
              {capability}
            </span>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            asChild
            size={featured ? "default" : "sm"}
            className={cn(
              "shrink-0 rounded-xl shadow-xs",
              featured ? "px-4" : "px-3.5",
            )}
          >
            <NavLink to={tool.url}>
              {tool.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </NavLink>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function AIToolsHome() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isAIUser = user?.role === "ai_user";

  const sortedTools = React.useMemo(
    () => sortAIToolsForRole(aiTools, user?.role),
    [user?.role],
  );
  const recommendedTools = React.useMemo(
    () => sortedTools.slice(0, isMobile ? 2 : 3),
    [isMobile, sortedTools],
  );

  const primaryTool = recommendedTools[0] ?? sortedTools[0];
  const secondaryTool =
    sortedTools.find((tool) => tool.access === "free" && tool.id !== primaryTool?.id) ??
    sortedTools[1];

  const quickStartItems = [
    {
      title: "Быстро написать текст",
      description: "Быстрый старт без лишней настройки для ежедневных задач.",
      href: "/groq",
      label: "Открыть Groq",
      image: "/ai-text-banner.png",
    },
    {
      title: "Проанализировать документ",
      description: "Когда нужен вдумчивый анализ файлов, заметок и рабочих материалов.",
      href: "/chatgpt",
      label: "Открыть ChatGPT",
      image: "/ai-document-banner.png",
    },
    {
      title: "Визуальный креатив",
      description: "Генерация изображений, правки по референсу и быстрые креативные итерации.",
      href: "/nanobanana",
      label: "Открыть NanoBanana",
      image: "/ai-visual-banner.png",
    },
  ];

  return (
    <div className="mesh-bg h-full min-h-0 overflow-y-auto min-[0px]:min-h-[100dvh]">
      <div className="sticky top-0 z-30 border-b border-border/50 bg-background/82 backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="ai-kicker">AI Hub</div>
            <div className="truncate text-sm font-semibold text-foreground">
              Инструменты ИИ
            </div>
          </div>
          {!isAIUser && <BalanceWidget compact />}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-8">
        <section className="relative overflow-hidden rounded-[30px] gradient-hero px-5 py-6 text-white shadow-glow animate-fade-in-up md:px-8 md:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_30%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                AI hub 21DAY
              </div>
              <h1 className="mt-4 max-w-3xl font-extrabold leading-[1.05] tracking-tight text-[2rem] sm:text-[2.3rem] md:text-[3rem]">
                Выберите лучший AI-инструмент под задачу.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/84 md:text-base">
                {isAIUser
                  ? "Всё нужное уже в одном месте: быстрые чаты, работа с документами, мультимодальные модели, генерация изображений и озвучка."
                  : "Откройте раздел AI как полноценный рабочий хаб: от быстрых бесплатных инструментов до сильных мультимодальных моделей для текста, файлов и изображений."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                  {aiTools.length} инструментов
                </span>
                <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                  {aiTools.filter((tool) => tool.access === "free").length} бесплатных
                </span>
                <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                  Документы, изображения, аудио
                </span>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                {primaryTool && (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-2xl bg-white text-primary shadow-lg hover:bg-white/92"
                  >
                    <NavLink to={primaryTool.url}>
                      {primaryTool.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </NavLink>
                  </Button>
                )}
                {secondaryTool && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-2xl border-white/28 bg-white/10 text-white hover:bg-white/16 hover:text-white"
                  >
                    <NavLink to={secondaryTool.url}>
                      {secondaryTool.access === "free"
                        ? "Попробовать бесплатно"
                        : secondaryTool.ctaLabel}
                    </NavLink>
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {!isAIUser && (
                <div className="rounded-[26px] border border-white/40 bg-white p-3.5 text-foreground shadow-[0_16px_40px_rgba(255,255,255,0.14)] backdrop-blur-xl">
                  <BalanceWidget variant="hero" />
                </div>
              )}
              <div className="rounded-[26px] border border-white/24 bg-white/16 p-4 text-white shadow-[0_16px_40px_rgba(22,28,45,0.16)] backdrop-blur-xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/95">Быстрый старт</div>
                <div className="mt-2 space-y-2.5">
                  {recommendedTools.slice(0, 2).map((tool) => (
                    <NavLink
                      key={tool.id}
                      to={tool.url}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/24 bg-white/14 px-3.5 py-3 transition-colors hover:bg-white/22"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {tool.title}
                        </p>
                        <p className="line-clamp-1 text-xs text-white/80">
                          {tool.shortDescription}
                        </p>
                      </div>
                      <Stars className="h-4 w-4 shrink-0 text-white/80" />
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 md:mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="ai-kicker">Recommended</div>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">
                С чего лучше начать сейчас
              </h2>
            </div>
            {!isMobile && (
              <p className="max-w-sm text-right text-sm text-muted-foreground">
                Сначала показываем самые полезные и понятные инструменты для вашей роли.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendedTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} featured />
            ))}
          </div>
        </section>

        <section id="catalog" className="mt-8 md:mt-10">
          <div className="mb-4">
            <div className="ai-kicker">Catalog</div>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">
              Все AI-инструменты
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Каталог отсортирован так, чтобы сначала вы видели самые полезные и
              понятные варианты, а затем более специализированные сценарии.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        <section className="mt-8 pb-6 md:mt-10 md:pb-8">
          <div className="mb-4">
            <div className="ai-kicker">Use Cases</div>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">
              Как быстрее выбрать инструмент
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickStartItems.map((item) => {
              return (
                <article
                  key={item.title}
                  className="flex h-full flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-soft"
                >
                  <div className="overflow-hidden border-b border-primary/10 bg-primary/6">
                    <img
                      src={item.image}
                      alt=""
                      className="h-32 w-full object-cover object-center md:h-28"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                    <Button
                      asChild
                      className="mt-6 h-10 rounded-xl shadow-xs md:mt-auto"
                    >
                      <NavLink to={item.href}>
                        {item.label}
                        <ArrowRight className="h-4 w-4" />
                      </NavLink>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
