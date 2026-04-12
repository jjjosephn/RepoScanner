import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/80 motion-safe:animate-pulse max-[prefers-reduced-motion:reduce]:animate-none",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
