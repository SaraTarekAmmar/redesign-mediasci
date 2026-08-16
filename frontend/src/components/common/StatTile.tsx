import React from "react";

const ACCENT: Record<string, string> = {
  blue: "bg-chart-1",
  green: "bg-emerald-600",
  yellow: "bg-amber-500",
  red: "bg-destructive",
  purple: "bg-primary",
  neutral: "bg-foreground/30",
};

interface Props {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  color?: keyof typeof ACCENT;
  hint?: React.ReactNode;
}

/**
 * Shared stat card: neutral icon chip + a colored left accent bar carrying the meaning —
 * not a full pastel background box. Use this everywhere a page shows a row of KPI numbers
 * instead of re-inventing a `bg-blue-50 text-blue-600` chip per page.
 */
export function StatTile({ label, value, icon, color = "neutral", hint }: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <span className={`absolute start-0 top-3 bottom-3 w-[3px] rounded-full ${ACCENT[color]} opacity-80`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-foreground/15 bg-muted text-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
