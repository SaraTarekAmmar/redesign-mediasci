import React, { useState } from "react";

interface BurndownPoint {
  d: number;
  ideal: number;
  actual: number | null;
}

interface BurndownProps {
  data: BurndownPoint[];
  total: number;
  onPointClick?: () => void;
}

export function BurndownChart({ data, total, onPointClick }: BurndownProps) {
  const [hoveredPoint, setHoveredPoint] = useState<BurndownPoint & { x: number; y: number } | null>(null);

  const w = 460;
  const h = 200;
  const pad = 28;
  const maxY = Math.max(1, total);
  const x = (d: number) => pad + (d / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - v / maxY) * (h - pad * 2);

  const idealPath = data.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.d)},${y(p.ideal)}`).join(" ");
  const actualPts = data.filter((p) => p.actual !== null);
  const actualPath = actualPts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.d)},${y(p.actual as number)}`).join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label="Sprint burndown chart">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={w - pad}
            y1={pad + t * (h - pad * 2)}
            y2={pad + t * (h - pad * 2)}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        <path d={idealPath} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeDasharray="4 4" />
        <path d={actualPath} fill="none" className="stroke-chart-1" strokeWidth={2.5} />
        {data.map((p) => {
          const px = x(p.d);
          const py = y(p.actual !== null ? p.actual : p.ideal);
          return (
            <circle
              key={p.d}
              cx={px}
              cy={py}
              r={hoveredPoint?.d === p.d ? 6 : 4}
              className="fill-chart-1 stroke-background stroke-2 cursor-pointer transition-all hover:scale-125"
              onMouseEnter={() => setHoveredPoint({ ...p, x: px, y: py })}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={onPointClick}
            />
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          className="absolute z-30 rounded-lg border border-border bg-popover p-2 text-xs shadow-lg pointer-events-none transition-all"
          style={{ left: `${(hoveredPoint.x / w) * 100}%`, top: "10%", transform: "translateX(-50%)" }}
        >
          <p className="font-semibold text-foreground">Day {hoveredPoint.d}</p>
          <p className="text-muted-foreground">Ideal Target: {Math.round(hoveredPoint.ideal)} pts</p>
          <p className="font-medium text-chart-1">
            Actual Remaining: {hoveredPoint.actual !== null ? `${Math.round(hoveredPoint.actual)} pts` : "Pending"}
          </p>
          <p className="mt-1 text-[10px] text-primary">Click to inspect sprint tasks</p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-chart-1" /> Actual Remaining Points
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" /> Ideal Target Line
        </span>
      </div>
    </div>
  );
}
