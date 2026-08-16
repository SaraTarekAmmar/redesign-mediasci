import React, { useState } from "react";

interface BurndownMetric {
  date: string;
  total_points: number;
  completed_points: number;
  remaining_points: number;
}

interface BurndownChartProps {
  total: number;
  metrics: BurndownMetric[];
  sprintDays: number;
  onPointClick?: () => void;
  compact?: boolean;
}

export function BurndownChart({ total, metrics, sprintDays, onPointClick, compact }: BurndownChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    idx: number;
    date: string;
    ideal: number;
    actual: number;
    x: number;
    y: number;
  } | null>(null);

  const w = compact ? 380 : 460;
  const h = compact ? 160 : 200;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = compact ? 28 : 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxY = Math.max(1, total);

  const xScale = (idx: number) => padL + (idx / Math.max(1, sprintDays)) * chartW;
  const yScale = (v: number) => padT + (1 - v / maxY) * chartH;

  // Build ideal line points
  const idealPoints = Array.from({ length: sprintDays + 1 }, (_, i) => ({
    idx: i,
    value: total - (total / sprintDays) * i,
  }));

  // Build actual line from metrics
  const actualPoints = metrics.map((m, i) => ({
    idx: i,
    value: m.remaining_points,
    date: m.date,
  }));

  const idealPath = idealPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.idx)},${yScale(p.value)}`).join(" ");
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.idx)},${yScale(p.value)}`).join(" ");

  // Compute day labels
  const dayLabels = Array.from({ length: sprintDays + 1 }, (_, i) => {
    if (metrics[i]) {
      const d = new Date(metrics[i].date);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return `Day ${i}`;
  });

  // X-axis tick positions (show ~5 ticks)
  const tickCount = Math.min(6, sprintDays + 1);
  const tickStep = Math.max(1, Math.floor(sprintDays / (tickCount - 1)));
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.min(i * tickStep, sprintDays));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label="Sprint burndown chart">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = padT + t * chartH;
          const val = Math.round(maxY * (1 - t));
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={yy} y2={yy} className="stroke-border" strokeWidth={0.5} />
              <text x={padL - 4} y={yy + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">
                {val}
              </text>
            </g>
          );
        })}

        {/* Ideal line */}
        <path d={idealPath} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* Actual line */}
        {actualPath && (
          <path d={actualPath} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" />
        )}

        {/* Actual fill area */}
        {actualPoints.length > 1 && (
          <path
            d={`${actualPath} L${xScale(actualPoints[actualPoints.length - 1].idx)},${yScale(0)} L${xScale(actualPoints[0].idx)},${yScale(0)} Z`}
            className="fill-primary/5"
          />
        )}

        {/* Actual dots */}
        {actualPoints.map((p, i) => {
          const cx = xScale(p.idx);
          const cy = yScale(p.value);
          const isHovered = hoveredPoint?.idx === p.idx;
          return (
            <circle
              key={p.idx}
              cx={cx}
              cy={cy}
              r={isHovered ? 5 : 3.5}
              className="fill-primary stroke-background stroke-2 cursor-pointer transition-all hover:scale-125"
              onMouseEnter={() =>
                setHoveredPoint({
                  idx: p.idx,
                  date: p.date,
                  ideal: idealPoints[p.idx]?.value ?? 0,
                  actual: p.value,
                  x: cx,
                  y: cy,
                })
              }
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={onPointClick}
            />
          );
        })}

        {/* X-axis ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xScale(t)} x2={xScale(t)} y1={h - padB} y2={h - padB + 4} className="stroke-border" strokeWidth={0.5} />
            <text x={xScale(t)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[8px]">
              {dayLabels[t]}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute z-30 rounded-lg border border-border bg-popover p-2.5 text-xs shadow-lg pointer-events-none transition-all"
          style={{
            left: `${(hoveredPoint.x / w) * 100}%`,
            top: `${Math.max(5, (hoveredPoint.y / h) * 100 - 20)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-semibold text-foreground">{hoveredPoint.date}</p>
          <p className="text-muted-foreground">Ideal: {Math.round(hoveredPoint.ideal)} pts</p>
          <p className="font-medium text-primary">Remaining: {Math.round(hoveredPoint.actual)} pts</p>
          {onPointClick && (
            <p className="mt-1 text-[10px] text-primary animate-pulse">Click to inspect sprint tasks</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-1.5 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 border-t border-dashed border-muted-foreground" /> Ideal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-primary" /> Actual
        </span>
      </div>
    </div>
  );
}
