import * as React from "react";

import { cn } from "@/lib/utils";

type AvatarVariant = "male" | "female";

const sizeMap = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-20 w-20",
} as const;

interface TestimonialAvatarProps {
  variant: AvatarVariant;
  size?: keyof typeof sizeMap;
  className?: string;
}

export function TestimonialAvatar({
  variant,
  size = "md",
  className,
}: TestimonialAvatarProps) {
  const avatarSrc = variant === "female" ? "/w.png" : "/m.png";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border border-white/45 bg-white shadow-[0_16px_32px_rgba(76,29,149,0.16)]",
        sizeMap[size],
        className,
      )}
      aria-hidden="true"
    >
      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
