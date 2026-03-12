import * as React from "react";
import { ArrowLeft, ArrowRight, MessageCircle, Quote, Sparkles } from "lucide-react";

import { api } from "@/api/client";
import { TestimonialAvatar } from "@/components/TestimonialAvatar";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

type AvatarVariant = "male" | "female";

interface TestimonialItem {
  id: string;
  name: string;
  roleOrSubtitle: string;
  text: string;
  avatarVariant: AvatarVariant;
}

interface TestimonialsSectionProps {
  variant?: "public" | "dashboard";
  className?: string;
}

const sectionCopy = {
  public: {
    kicker: "Отзывы",
    title: "Как пользователи ощущают результат",
    description:
      "Короткие живые отзывы тех, кто уже встроил ИИ в учебу, контент и ежедневную практику.",
    shellClassName:
      "border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,245,255,0.96))] shadow-[0_28px_60px_rgba(124,58,237,0.12)]",
  },
  dashboard: {
    kicker: "",
    title: "Отзывы участников",
    description: "",
    shellClassName:
      "border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(251,247,255,0.98))] shadow-[0_24px_50px_rgba(91,33,182,0.1)]",
  },
} as const;

export function TestimonialsSection({
  variant = "public",
  className,
}: TestimonialsSectionProps) {
  const [items, setItems] = React.useState<TestimonialItem[]>([]);
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    api<TestimonialItem[]>("/testimonials")
      .then((data) => {
        if (isMounted) {
          setItems(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setItems([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const updateState = () => {
      setSelectedIndex(carouselApi.selectedScrollSnap());
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
    };

    updateState();
    carouselApi.on("select", updateState);
    carouselApi.on("reInit", updateState);

    return () => {
      carouselApi.off("select", updateState);
      carouselApi.off("reInit", updateState);
    };
  }, [carouselApi]);

  if (items.length === 0) {
    return null;
  }

  const copy = sectionCopy[variant];

  return (
    <section className={cn("animate-fade-in-up", className)}>
      {variant === "dashboard" && (
        <div className="mb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="text-primary" style={{ width: "16px", height: "16px" }} />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground">
            {copy.title}
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-[32px] border px-5 py-5 md:px-7 md:py-7",
          copy.shellClassName,
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {variant === "public" ? (
              <>
                <div className="ai-kicker">{copy.kicker}</div>
                <h2 className="mt-1 text-2xl font-semibold text-foreground md:text-[2rem]">
                  {copy.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
                  {copy.description}
                </p>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => carouselApi?.scrollPrev()}
              disabled={!canScrollPrev}
              className="h-10 w-10 rounded-full border-primary/15 bg-white/80 text-foreground hover:bg-white hover:text-foreground active:text-foreground focus:text-foreground focus-visible:text-foreground [&_svg]:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => carouselApi?.scrollNext()}
              disabled={!canScrollNext}
              className="h-10 w-10 rounded-full border-primary/15 bg-white/80 text-foreground hover:bg-white hover:text-foreground active:text-foreground focus:text-foreground focus-visible:text-foreground [&_svg]:text-foreground"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Carousel
          setApi={setCarouselApi}
          opts={{ align: "start", loop: items.length > 2 }}
          className="mt-6"
        >
          <CarouselContent className="-ml-4">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="pl-4 md:basis-1/2 xl:basis-1/3"
              >
                <article className="flex h-full flex-col rounded-[28px] border border-primary/12 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <TestimonialAvatar variant={item.avatarVariant} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {item.roleOrSubtitle || "Участник платформы"}
                        </p>
                      </div>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Quote className="h-4.5 w-4.5" />
                    </div>
                  </div>

                  <p className="mt-5 flex-1 text-sm leading-6 text-foreground/88 md:text-[15px]">
                    {item.text}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-xs font-medium text-primary/80">
                    <Sparkles className="h-3.5 w-3.5" />
                    Проверенный пользователь платформы 21DAY
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {items.length > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Перейти к отзыву ${index + 1}`}
                onClick={() => carouselApi?.scrollTo(index)}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  index === selectedIndex
                    ? "w-7 bg-primary"
                    : "w-2.5 bg-primary/20 hover:bg-primary/35",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
