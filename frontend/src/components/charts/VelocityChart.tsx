import React, { useState } from "react";

interface SprintVelocity {
  sprint_id: number;
  name: string;
  planned: number;
  completed: number;
}

interface VelocityProps {
  sprints: SprintVelocity[];
  average: number;
}

export function VelocityChart({ sprints, average }: VelocityProps) {
  const [hoveredBar, setHoveredBar] = useState<{
    sprint: SprintVelocity;
    type: "planned" | "completed";
    x: number;
    y: number;
  } | null>(null);

  const w = 460;
  const h = 220;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxVal = Math.max(1, ...sprints.flatMap((s) => [s.planned, s.completed]));
  const barGroupW = chartW / sprints.length;
  const barW = Math.min(24, barGroupW * 0.3);
  const gap = 4;

  const yScale = (v: number) => padT + chartH - (v / maxVal) * chartH;

  // Average line
  const avgY = yScale(average);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label="Velocity chart">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = padT + t * chartH;
          const val = Math.round(maxVal * (1 - t));
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={yy} y2={yy} className="stroke-border" strokeWidth={1} />
              <text x={padL - 6} y={yy + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
                {val}
              </text>
            </g>
          );
        })}

        {/* Average line */}
        {average > 0 && (
          <g>
            <line x1={padL} x2={w - padR} y1={avgY} y2={avgY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
            <text x={w - padR + 2} y={avgY + 3} className="fill-amber-500 text-[8px] font-semibold">
              avg
            </text>
          </g>
        )}

        {/* Bar groups */}
        {sprints.map((s, i) => {
          const cx = padL + i * barGroupW + barGroupW / 2;
          const plannedH = (s.planned / maxVal) * chartH;
          const completedH = (s.completed / maxVal) * chartH;
          const plannedY = yScale(s.planned);
          const completedY = yScale(s.completed);

          return (
            <g key={s.sprint_id}>
              {/* Planned bar */}
              <rect
                x={cx - barW - gap / 2}
                y={plannedY}
                width={barW}
                height={plannedH}
                rx={3}
                className="fill-blue-500/30 hover:fill-blue-500/50 transition-colors cursor-pointer"
                onMouseEnter={() => setHoveredBar({ sprint: s, type: "planned", x: cx - barW, y: plannedY })}
                onMouseLeave={() => setHoveredBar(null)}
              />
              {/* Completed bar */}
              <rect
                x={cx + gap / 2}
                y={completedY}
                width={barW}
                height={completedH}
                rx={3}
                className="fill-emerald-500 hover:fill-emerald-400 transition-colors cursor-pointer"
                onMouseEnter={() => setHoveredBar({ sprint: s, type: "completed", x: cx + gap / 2, y: completedY })}
                onMouseLeave={() => setHoveredBar(null)}
              />
              {/* Sprint label */}
              <text x={cx} y={h - 8} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredBar && (
        <div
          className="absolute z-30 rounded-lg border border-border bg-popover p-2 text-xs shadow-lg pointer-events-none transition-all"
          style={{
            left: `${(hoveredBar.x / w) * 100}%`,
            top: `${Math.max(5, (hoveredBar.y / h) * 100 - 15)}%`,
          }}
        >
          <p className="font-semibold text-foreground">{hoveredBar.sprint.name}</p>
          <p className={hoveredBar.type === "planned" ? "text-blue-500" : "text-emerald-500"}>
            {hoveredBar.type === "planned" ? "Planned" : "Completed"}: {hoveredBar.type === "planned" ? hoveredBar.sprint.planned : hoveredBar.sprint.completed} pts
          </p>
          <p className="text-muted-foreground text-[10px]">
            {hoveredBar.sprint.completed}/{hoveredBar.sprint.planned} pts ({hoveredBar.sprint.planned ? Math.round((hoveredBar.sprint.completed / hoveredBar.sprint.planned) * 100) : 0}%)
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/30" /> Planned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Completed
        </span>
        {average > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" /> Average ({average} pts)
          </span>
        )}
      </div>
    </div>
  );
}
