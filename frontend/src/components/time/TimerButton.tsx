import React from "react";
import { Play, Square, TimerReset } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

interface TimerButtonProps {
  isRunning: boolean;
  elapsedSeconds: number;
  onToggle: () => void;
  variant?: "compact" | "full";
  className?: string;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function TimerButton({ isRunning, elapsedSeconds, onToggle, variant = "full", className }: TimerButtonProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  if (variant === "compact") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          isRunning
            ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
            : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
          className
        )}
        title={isRunning ? t("timeTracking.stopTimer") : t("timeTracking.startTimer")}
      >
        {isRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {isRunning && (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300" aria-live="polite">
          <TimerReset className="h-3.5 w-3.5 animate-pulse" />
          <span className="font-mono">{formatElapsed(elapsedSeconds)}</span>
          <span className="text-[11px] font-normal opacity-80">{t("timeTracking.running")}</span>
        </div>
      )}
      <Button
        size="sm"
        variant={isRunning ? "destructive" : "default"}
        onClick={onToggle}
        className="gap-1.5"
      >
        {isRunning ? (
          <>
            <Square className="h-4 w-4" />
            {t("timeTracking.stopTimer")}
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            {t("timeTracking.startTimer")}
          </>
        )}
      </Button>
    </div>
  );
}
