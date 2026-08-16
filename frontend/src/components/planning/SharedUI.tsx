import React from "react";
import { cn } from "../../lib/utils";

export const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export const formatDays = (value?: number | null) => (value === undefined || value === null ? "—" : `${value > 0 ? "+" : ""}${Math.round(value)}d`);
export const formatHours = (value?: number | null) => (value === undefined || value === null ? "—" : `${Math.round(Number(value))}h`);
export const formatCurrency = (value?: number | null) => (value === undefined || value === null ? "—" : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  iconBg = "bg-muted/60",
  iconColor = "text-muted-foreground",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "rounded-[20px] border border-slate-200 bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <div className="mt-1 text-[26px] font-semibold leading-none text-slate-900">{value}</div>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {icon && <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl p-2", iconBg, iconColor)}>{icon}</div>}
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200 bg-card p-3 text-left shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <div className="mt-1 text-[26px] font-semibold leading-none text-slate-900">{value}</div>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl p-2", iconBg, iconColor)}>{icon}</div>}
      </div>
    </div>
  );
}

/**
 * Single-ring circular gauge. Draws an SVG arc via stroke-dasharray and
 * animates it in on mount/update with a CSS transition on stroke-dashoffset.
 */
export function RadialGauge({
  value,
  size = 88,
  strokeWidth = 9,
  color = "stroke-primary",
  trackColor = "stroke-muted",
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={cn(trackColor, "opacity-25")}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={cn(color, "transition-[stroke-dashoffset] duration-700 ease-out")}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label}
        {sublabel}
      </div>
    </div>
  );
}

/**
 * Two concentric rings for comparing a planned target vs actual value
 * (e.g. planned vs actual completion %). Outer ring = planned, inner = actual.
 */
export function DualRadialGauge({
  plannedPct,
  actualPct,
  size = 88,
  strokeWidth = 8,
  label,
  sublabel,
}: {
  plannedPct: number;
  actualPct: number;
  size?: number;
  strokeWidth?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
}) {
  const outerRadius = (size - strokeWidth) / 2;
  const innerRadius = outerRadius - strokeWidth - 3;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const plannedClamped = Math.max(0, Math.min(100, plannedPct));
  const actualClamped = Math.max(0, Math.min(100, actualPct));
  const onTarget = actualClamped >= plannedClamped;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={outerRadius} strokeWidth={strokeWidth} fill="none" className="stroke-blue-500/20" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerRadius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="stroke-blue-500 transition-[stroke-dashoffset] duration-700 ease-out"
          style={{
            strokeDasharray: outerCircumference,
            strokeDashoffset: outerCircumference - (plannedClamped / 100) * outerCircumference,
          }}
        />
        <circle cx={size / 2} cy={size / 2} r={innerRadius} strokeWidth={strokeWidth} fill="none" className="stroke-muted opacity-30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            onTarget ? "stroke-emerald-500" : "stroke-amber-500"
          )}
          style={{
            strokeDasharray: innerCircumference,
            strokeDashoffset: innerCircumference - (actualClamped / 100) * innerCircumference,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label}
        {sublabel}
      </div>
    </div>
  );
}

export interface DonutSegment {
  value: number;
  colorClass: string;
  label: string;
}

/**
 * Multi-segment donut chart built from stacked SVG arcs. Purely presentational,
 * no external chart library required.
 */
export function DonutChart({
  segments,
  size = 120,
  strokeWidth = 16,
  centerLabel,
  centerSublabel,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: React.ReactNode;
  centerSublabel?: React.ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePct = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const pct = total > 0 ? segment.value / total : 0;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const offset = circumference - cumulativePct * circumference;
      cumulativePct += pct;
      return { ...segment, dash, gap, offset };
    });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" className="stroke-muted opacity-30" />
        {total === 0 ? null : (
          arcs.map((arc, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="none"
              className={cn(arc.colorClass, "transition-[stroke-dashoffset] duration-700 ease-out")}
              style={{
                strokeDasharray: `${arc.dash} ${arc.gap}`,
                strokeDashoffset: arc.offset,
              }}
            />
          ))
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerLabel}
        {centerSublabel}
      </div>
    </div>
  );
}

export function MiniBar({
  label,
  value,
  max = 100,
  tone = "bg-primary",
}: {
  label: string;
  value: number;
  max?: number;
  tone?: string;
}) {
  const width = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
