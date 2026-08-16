import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Flag, Diamond } from "lucide-react";
import { cn } from "../../lib/utils";

export type GanttZoom = "day" | "week" | "month";

export interface PlanGanttTask {
  id: string;
  text: string;
  description?: string;
  start_date: string; // "Y-m-d H:i"
  end_date: string | null;
  duration: number;
  progress: number;
  completion_pct: number;
  status: string;
  priority: string;
  assigned_to: string;
  type: "task" | "project" | "milestone";
  critical: boolean;
  color: string;
  parent?: number | string;
}

export interface PlanGanttLink {
  id: string;
  source: string;
  target: string;
  type: string;
  lag: number;
}

export interface PlanGanttMilestoneMarker {
  id: number | string;
  title: string;
  date: string; // Y-m-d
}

interface Props {
  tasks: PlanGanttTask[];
  links?: PlanGanttLink[];
  milestoneMarkers?: PlanGanttMilestoneMarker[];
  zoom: GanttZoom;
  onTaskClick?: (id: string) => void;
  className?: string;
}

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 300;
const HEADER_HEIGHT = 40;
const DAY_PX = { day: 40, week: 120 / 7, month: 200 / 30 };

function toDate(v: string): Date {
  return new Date(v.replace(" ", "T"));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function PlanGanttChart({ tasks, links = [], milestoneMarkers = [], zoom, onTaskClick, className }: Props) {
  const { t } = useTranslation();

  const rows = useMemo(
    () => [...tasks].sort((a, b) => toDate(a.start_date).getTime() - toDate(b.start_date).getTime()),
    [tasks]
  );

  const range = useMemo(() => {
    if (rows.length === 0) {
      const today = new Date();
      return { start: new Date(today.getTime() - 7 * 86400000), end: new Date(today.getTime() + 30 * 86400000) };
    }
    const starts = rows.map((r) => toDate(r.start_date).getTime());
    const ends = rows.map((r) => toDate(r.end_date || r.start_date).getTime());
    const start = new Date(Math.min(...starts) - 3 * 86400000);
    const end = new Date(Math.max(...ends) + 7 * 86400000);
    return { start, end };
  }, [rows]);

  const px = DAY_PX[zoom];
  const getX = (d: Date) => daysBetween(range.start, d) * px;
  const getWidth = (s: Date, e: Date) => Math.max(daysBetween(s, e) * px, zoom === "day" ? 20 : 8);
  const totalWidth = Math.max(daysBetween(range.start, range.end) * px, 400);

  const headers = useMemo(() => {
    const list: { label: string; x: number }[] = [];
    const cur = new Date(range.start);
    if (zoom === "day") {
      while (cur <= range.end) {
        list.push({ label: cur.toLocaleDateString("en-US", { day: "numeric", month: "short" }), x: getX(cur) });
        cur.setDate(cur.getDate() + 1);
      }
    } else if (zoom === "week") {
      cur.setDate(cur.getDate() + (7 - cur.getDay()));
      while (cur <= range.end) {
        list.push({ label: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }), x: getX(cur) });
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      cur.setDate(1);
      while (cur <= range.end) {
        list.push({ label: cur.toLocaleDateString("en-US", { month: "short", year: "numeric" }), x: getX(cur) });
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, zoom]);

  const todayX = getX(new Date());
  const rowIndex = useMemo(() => Object.fromEntries(rows.map((r, i) => [r.id, i])), [rows]);

  if (rows.length === 0) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-border bg-card p-12 text-muted-foreground", className)}>
        <p className="text-sm">{t("enterpriseGantt.noTasks")}</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex overflow-x-auto">
        {/* Labels */}
        <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card" style={{ width: LABEL_WIDTH }}>
          <div className="flex items-center border-b border-border px-3" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("enterpriseGantt.task")}</span>
          </div>
          {rows.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskClick?.(task.id)}
              className="flex w-full items-center gap-2 border-b border-border px-3 text-start hover:bg-accent/40 transition-colors"
              style={{ height: ROW_HEIGHT }}
            >
              {task.type === "milestone" ? (
                <Diamond className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              ) : task.critical ? (
                <Flag className="h-3.5 w-3.5 shrink-0 text-rose-500" />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.color }} />
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{task.text}</span>
              {task.assigned_to && (
                <span className="shrink-0 truncate max-w-[70px] text-[10px] text-muted-foreground">{task.assigned_to}</span>
              )}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="min-w-0 flex-1">
          <div className="relative border-b border-border" style={{ height: HEADER_HEIGHT, width: totalWidth }}>
            {headers.map((h, i) => (
              <div key={i} className="absolute top-0 flex items-center border-r border-border/50 px-2" style={{ left: h.x, height: HEADER_HEIGHT }}>
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{h.label}</span>
              </div>
            ))}
            <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-10" style={{ left: todayX }}>
              <div className="absolute left-1/2 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground whitespace-nowrap">
                {t("gantt.today")}
              </div>
            </div>
          </div>

          <div className="relative" style={{ width: totalWidth }}>
            {/* Milestone marker overlay (portfolio milestones) */}
            {milestoneMarkers.map((m) => {
              const x = getX(new Date(m.date + "T00:00:00"));
              return (
                <div key={`mm-${m.id}`} className="absolute top-0 bottom-0 w-px bg-amber-500/50 z-10" style={{ left: x }}>
                  <div className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold text-white whitespace-nowrap">
                    {m.title}
                  </div>
                </div>
              );
            })}

            {/* Dependency lines */}
            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: totalWidth, height: rows.length * ROW_HEIGHT }}>
              <defs>
                <marker id="pgc-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <path d="M0,0 L6,2 L0,4" fill="none" stroke="#94a3b8" strokeWidth="1" />
                </marker>
              </defs>
              {links.map((link) => {
                const fromRow = rowIndex[link.source];
                const toRow = rowIndex[link.target];
                const from = rows.find((r) => r.id === link.source);
                const to = rows.find((r) => r.id === link.target);
                if (fromRow === undefined || toRow === undefined || !from || !to) return null;
                const fromX = getX(toDate(from.end_date || from.start_date));
                const toX = getX(toDate(to.start_date));
                const fromY = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const toY = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                return (
                  <path
                    key={link.id}
                    d={`M${fromX},${fromY} C${fromX + 16},${fromY} ${toX - 16},${toY} ${toX},${toY}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="4,2"
                    markerEnd="url(#pgc-arrow)"
                  />
                );
              })}
            </svg>

            {rows.map((task, i) => {
              const start = toDate(task.start_date);
              const end = toDate(task.end_date || task.start_date);
              const x = getX(start);
              const width = getWidth(start, end);
              const isMilestone = task.type === "milestone";

              return (
                <div key={task.id} className="flex items-center border-b border-border/50 hover:bg-accent/20" style={{ height: ROW_HEIGHT }}>
                  <div className="relative h-full w-full">
                    {isMilestone ? (
                      <div
                        role="button"
                        onClick={() => onTaskClick?.(task.id)}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 cursor-pointer shadow-sm"
                        style={{ left: x, backgroundColor: task.color }}
                        title={task.text}
                      />
                    ) : (
                      <div
                        role="button"
                        onClick={() => onTaskClick?.(task.id)}
                        className={cn(
                          "absolute top-2 cursor-pointer rounded-md shadow-sm transition-shadow hover:shadow-md",
                          task.critical && "ring-2 ring-rose-500"
                        )}
                        style={{ left: x, width, height: ROW_HEIGHT - 16, backgroundColor: task.color }}
                        title={`${task.text} (${task.completion_pct}%)`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-md bg-white/25"
                          style={{ width: `${Math.min(100, Math.max(0, task.completion_pct))}%` }}
                        />
                        {width > 50 && (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate pointer-events-none">
                            {task.text}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
