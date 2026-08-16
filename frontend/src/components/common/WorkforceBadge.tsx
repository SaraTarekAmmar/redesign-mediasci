import React from "react";
import { Handshake, Users } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Internal / External workforce origin badge.
 * Uses icon + text (not color alone) so it stays accessible in dark mode.
 */
export function WorkforceBadge({ type, className }: { type: "internal" | "external"; className?: string }) {
  const isInternal = type === "internal";
  const Icon = isInternal ? Users : Handshake;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        isInternal
          ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {isInternal ? "Internal" : "External"}
    </span>
  );
}
