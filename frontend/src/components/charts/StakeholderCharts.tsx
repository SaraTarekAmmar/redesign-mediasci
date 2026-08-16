import React from "react";

// Small hand-rolled SVG charts shared by the stakeholder analytics & impact pages.
// Mirrors the existing convention in components/charts/{BurndownChart,VelocityChart}.tsx
// (plain SVG + Tailwind chart-N tokens) instead of pulling in a charting library.

export interface DonutSlice {
  label: string;
  value: number;
  colorHex: string; // SVG stroke doesn't take Tailwind bg- utilities, so plain hex here
}

export function DonutChart({ data, size = 132 }: { data: DonutSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2;
  const stroke = size * 0.22;
  const radius = r - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={r} cy={r} r={radius} fill="none" className="stroke-muted/40" strokeWidth={stroke} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circumference;
          const el = (
            <circle
              key={i}
              cx={r}
              cy={r}
              r={radius}
              fill="none"
              stroke={d.colorHex}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.colorHex }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ScatterPoint {
  x: number;
  y: number;
  r?: number;
  label: string;
  colorHex?: string;
}

export function ScatterChart({
  points,
  xLabel,
  yLabel,
  xMax = 100,
  yMax = 100,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xMax?: number;
  yMax?: number;
}) {
  const w = 460, h = 220, pad = 34;
  const x = (v: number) => pad + (Math.min(v, xMax) / xMax) * (w - pad * 2);
  const y = (v: number) => h - pad - (Math.min(v, yMax) / yMax) * (h - pad * 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label={`${xLabel} vs ${yLabel} chart`}>
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="stroke-border" strokeWidth={1} />
      <line x1={pad} x2={pad} y1={pad} y2={h - pad} className="stroke-border" strokeWidth={1} />
      <line x1={pad} x2={w - pad} y1={y(yMax / 2)} y2={y(yMax / 2)} className="stroke-border/60" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={x(xMax / 2)} x2={x(xMax / 2)} y1={pad} y2={h - pad} className="stroke-border/60" strokeWidth={1} strokeDasharray="3 3" />
      <text x={w / 2} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">{xLabel}</text>
      <text x={12} y={h / 2} textAnchor="middle" className="fill-muted-foreground text-[9px]" transform={`rotate(-90 12 ${h / 2})`}>{yLabel}</text>
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(p.x)}
          cy={y(p.y)}
          r={p.r ?? 5}
          className="fill-chart-1 cursor-pointer transition-opacity hover:opacity-80"
          style={p.colorHex ? { fill: p.colorHex } : undefined}
          fillOpacity={0.78}
        >
          <title>{p.label}</title>
        </circle>
      ))}
    </svg>
  );
}

export function TrendBars({ points }: { points: { x: string; y: number }[] }) {
  const w = 460, h = 110, pad = 18;
  const max = Math.max(1, ...points.map((p) => p.y));
  const barW = points.length ? (w - pad * 2) / points.length : 0;

  if (!points.length) return null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label="Activity trend">
      {points.map((p, i) => {
        const barH = (p.y / max) * (h - pad * 2);
        return (
          <rect
            key={i}
            x={pad + i * barW + 1}
            y={h - pad - barH}
            width={Math.max(1, barW - 2)}
            height={Math.max(0, barH)}
            rx={2}
            className="fill-chart-1 opacity-80 hover:opacity-100 transition-opacity"
          >
            <title>{`${p.x}: ${p.y}`}</title>
          </rect>
        );
      })}
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="stroke-border" strokeWidth={1} />
    </svg>
  );
}
