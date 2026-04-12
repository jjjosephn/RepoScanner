"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const THEME_STORAGE_KEY = "reposcanner-theme";

export type ThemeName = "dark" | "light";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<ThemeName>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") {
      setTheme(attr);
    }
  }, []);

  const toggle = React.useCallback(() => {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const label =
    theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "shrink-0 rounded-full border-border/80 bg-card/80 shadow-card backdrop-blur-sm",
        className
      )}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {!mounted || theme === "dark" ? (
        <Sun className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      ) : (
        <Moon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      )}
    </Button>
  );
}
