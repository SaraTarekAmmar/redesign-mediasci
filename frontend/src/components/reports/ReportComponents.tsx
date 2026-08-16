import React from "react";

export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function BarRow({
  label,
  value,
  max,
  color,
  subtitle,
  onClick,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  const pct = max ? Math.round((value / max) * 100) : 0;

  return (
    <div
      onClick={onClick}
      title={`Click to view tasks for "${label}" (${value} items · ${pct}%)`}
      className={`group flex items-center gap-3 p-1.5 rounded-lg transition-all ${
        onClick ? "cursor-pointer hover:bg-accent/60" : ""
      }`}
    >
      <div className="w-32 shrink-0 min-w-0">
        <span className="truncate block text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {label}
        </span>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground block truncate">{subtitle}</span>
        )}
      </div>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-16 shrink-0 text-right">
        <span className="text-xs font-semibold tabular-nums text-foreground">{value}</span>
        <span className="ml-1 text-[10px] text-muted-foreground">({pct}%)</span>
      </div>
    </div>
  );
}
