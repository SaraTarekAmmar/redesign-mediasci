import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "../ui/Badge";
import type { PlanningMilestone } from "../../pages/PlanComparisonPage";
import { cn } from "../../lib/utils";
import { formatShortDate } from "./SharedUI";

export interface TimelineTaskMarker {
  id: string;
  issueId: number;
  key: string;
  title: string;
  status?: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  dueDate?: string | null;
  milestoneId: number;
  milestoneName: string;
  assignee?: string | null;
  storyPoints?: number;
  delayDays: number;
  arrow: "←" | "→" | "✓" | "↻" | "!";
  tone: "planned" | "done" | "late" | "blocked" | "pending";
  done?: boolean;
  order: number;
}

interface TimelineComparisonGraphProps {
  milestones: PlanningMilestone[];
  tasks: TimelineTaskMarker[];
  selectedMilestoneId: string;
  selectedTaskId: string;
  detailMode: boolean;
  onSelectMilestone: (id: string) => void;
  onSelectTask: (taskId: string) => void;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const MIN_WIDTH = 960;
const TRACK_LEFT = 180;
const ROW_HEIGHT = 102;
const AXIS_HEIGHT = 52;
const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const toneClass = (tone: TimelineTaskMarker["tone"], selected: boolean) => {
  if (selected) return "border-primary bg-primary text-primary-foreground shadow-sm";
  switch (tone) {
    case "done":
      return "border-emerald-200 bg-card text-emerald-600";
    case "late":
      return "border-rose-200 bg-card text-rose-600";
    case "blocked":
      return "border-rose-200 bg-rose-50 text-rose-600";
    case "pending":
      return "border-border bg-card text-muted-foreground";
    default:
      return "border-border bg-card text-muted-foreground";
  }
};

const rowLabel = (value: string) => value.replace(/,\s*\d{4}$/, "");

export function TimelineComparisonGraph({
  milestones,
  tasks,
  selectedMilestoneId,
  selectedTaskId,
  detailMode,
  onSelectMilestone,
  onSelectTask,
}: TimelineComparisonGraphProps) {
  const { t } = useTranslation();
  const visibleTasks = useMemo(() => (detailMode ? tasks : tasks.slice(0, Math.min(tasks.length, 5))), [detailMode, tasks]);
  const [hovered, setHovered] = useState<null | { taskId: string; left: number; top: number; track: "planned" | "actual" }>(null);

  const { startDate, totalDuration, ticks, todayLeft } = useMemo(() => {
    const dates: Date[] = [];
    milestones.forEach((milestone) => {
      [milestone.planned_start_date, milestone.planned_end_date, milestone.actual_start_date, milestone.actual_end_date, milestone.forecast_finish].forEach((value) => {
        const parsed = parseDate(value);
        if (parsed) dates.push(parsed);
      });
    });
    visibleTasks.forEach((task) => {
      const planned = parseDate(task.plannedDate);
      const actual = parseDate(task.actualDate);
      if (planned) dates.push(planned);
      if (actual) dates.push(actual);
    });

    const fallback = new Date();
    const min = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : fallback;
    const max = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : new Date(fallback.getTime() + DAY_MS * 30);
    const span = Math.max(max.getTime() - min.getTime(), DAY_MS * 21);
    const padding = Math.max(DAY_MS * 5, span * 0.08);
    const start = new Date(min.getTime() - padding);
    const end = new Date(max.getTime() + padding);
    const total = Math.max(end.getTime() - start.getTime(), DAY_MS);
    const today = new Date();

    return {
      startDate: start,
      totalDuration: total,
      todayLeft: clamp(((today.getTime() - start.getTime()) / total) * 100),
      ticks: Array.from({ length: 5 }, (_, index) => new Date(start.getTime() + total * (index / 4))),
    };
  }, [milestones, visibleTasks]);

  const toLeft = (value?: string | null) => {
    const parsed = parseDate(value);
    if (!parsed) return null;
    return clamp(((parsed.getTime() - startDate.getTime()) / totalDuration) * 100);
  };

  const plannedTasks = useMemo(
    () => visibleTasks.filter((task) => task.plannedDate).sort((a, b) => (a.plannedDate || "").localeCompare(b.plannedDate || "") || a.order - b.order),
    [visibleTasks],
  );
  const actualTasks = useMemo(
    () => visibleTasks.filter((task) => task.actualDate || task.done || task.tone !== "planned").sort((a, b) => (a.actualDate || a.plannedDate || "").localeCompare(b.actualDate || b.plannedDate || "") || a.order - b.order),
    [visibleTasks],
  );

  const trackRows = [
    {
      key: "planned" as const,
      label: t("planning.expectedTargetPlan", { defaultValue: "Expected Target Plan" }),
      count: `${plannedTasks.length} tasks planned`,
      color: "bg-foreground/40",
      tone: "planned" as const,
      items: plannedTasks,
      resolveDate: (task: TimelineTaskMarker) => task.plannedDate ?? task.dueDate,
    },
    {
      key: "actual" as const,
      label: t("planning.actualCompletedProgress", { defaultValue: "Actual Completed Progress" }),
      count: `${actualTasks.length} tasks completed`,
      color: "bg-emerald-500",
      tone: "actual" as const,
      items: actualTasks,
      resolveDate: (task: TimelineTaskMarker) => task.actualDate ?? task.plannedDate ?? task.dueDate,
    },
  ];

  return (
    <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{t("planning.timeline", { defaultValue: "Plan vs Actual Timeline" })}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("planning.timelineHint", { defaultValue: "Shared timeline view for milestones, tasks, and dependencies." })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-foreground/40" />Planned</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-emerald-500" />Actual</span>
            <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />On time</span>
            <span className="flex items-center gap-1.5 text-primary"><ArrowRight className="h-3.5 w-3.5" />In progress</span>
            <span className="flex items-center gap-1.5 text-rose-500"><ShieldAlert className="h-3.5 w-3.5" />Blocked</span>
            <span className="flex items-center gap-1.5 text-emerald-500">← Early</span>
            <span className="flex items-center gap-1.5 text-rose-500">! Late</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <div className="relative min-w-[960px]">
          <div
            className="grid items-end border-b border-border bg-muted/70 text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
            style={{ gridTemplateColumns: `${TRACK_LEFT}px minmax(0,1fr)`, height: AXIS_HEIGHT }}
          >
            <div />
            <div className="relative h-full px-4">
              {ticks.map((tick, index) => {
                const left = (index / (ticks.length - 1)) * 100;
                return (
                  <div key={tick.toISOString()} className="absolute bottom-2 -translate-x-1/2" style={{ left: `${left}%` }}>
                    {rowLabel(formatShortDate(tick.toISOString()))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-[180px] right-0 z-0">
              {ticks.map((tick, index) => (
                <span
                  key={`${tick.toISOString()}-grid`}
                  className={cn("absolute top-0 bottom-0 border-l", index === ticks.length - 1 ? "border-border" : "border-border/70")}
                  style={{ left: `${(index / (ticks.length - 1)) * 100}%` }}
                />
              ))}
              <div className="absolute bottom-0 top-0 border-l-2 border-dashed border-primary/50" style={{ left: `${todayLeft}%` }}>
                <span className="absolute -top-2 -translate-x-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Today</span>
              </div>
            </div>

            {trackRows.map((row, rowIndex) => (
              <div
                key={row.key}
                className={cn("grid border-b border-border/60", rowIndex % 2 === 0 ? "bg-card" : "bg-muted/35")}
                style={{ gridTemplateColumns: `${TRACK_LEFT}px minmax(0,1fr)`, minHeight: ROW_HEIGHT }}
                onClick={() => row.items[0] && onSelectMilestone(String(row.items[0].milestoneId))}
              >
                <div className="px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">{row.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{row.count}</p>
                </div>

                <div className="relative px-4 py-4">
                  <div className={cn("absolute left-4 right-4 top-1/2 h-px -translate-y-1/2", row.key === "planned" ? "bg-foreground/15" : "bg-emerald-100")} />

                  {row.items.map((task, taskIndex) => {
                    const left = toLeft(row.resolveDate(task)) ?? 0;
                    const selected = task.id === selectedTaskId || (rowIndex === 0 && taskIndex === 0 && !selectedTaskId);
                    const isMilestoneFocused = String(task.milestoneId) === selectedMilestoneId;
                    const label = String(task.order).padStart(2, "0");

                    return (
                      <button
                        key={`${row.key}-${task.id}`}
                        type="button"
                        className={cn(
                          "group absolute -translate-x-1/2 -translate-y-1/2 outline-none transition-transform hover:scale-105",
                          selected ? "z-20" : "z-10",
                        )}
                        style={{ left: `${left}%`, top: "50%" }}
                        onMouseEnter={() => setHovered({ taskId: task.id, left, top: rowIndex * ROW_HEIGHT + 16, track: row.key })}
                        onMouseLeave={() => setHovered(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectTask(task.id);
                        }}
                        title={`${task.key} · ${task.title}`}
                      >
                        <span className={cn("relative flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-semibold", toneClass(task.tone, selected))}>
                          {label}
                          <span className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-card text-[8px] shadow-sm">
                            {task.arrow}
                          </span>
                        </span>
                        <span className="mt-1 block text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {row.key === "planned" ? "P" : "A"}
                        </span>
                        {isMilestoneFocused && (
                          <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                        )}
                      </button>
                    );
                  })}

                  {hovered?.track === row.key && (
                    <div
                      className="pointer-events-none absolute z-30 w-64 -translate-x-1/2 rounded-2xl border border-border bg-card p-3 shadow-lg"
                      style={{ left: `${hovered.left}%`, top: 8 }}
                    >
                      {(() => {
                        const task = visibleTasks.find((item) => item.id === hovered.taskId);
                        if (!task) return null;
                        return (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{task.key}</p>
                                <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{task.title}</p>
                              </div>
                              <Badge variant={task.tone === "late" || task.tone === "blocked" ? "destructive" : task.done ? "default" : "secondary"}>{task.done ? "Done" : task.status || "Planned"}</Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-foreground">
                              <div className="rounded-xl border border-border bg-muted p-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Planned</p>
                                <p className="mt-1 font-medium text-foreground">{formatShortDate(task.plannedDate)}</p>
                              </div>
                              <div className="rounded-xl border border-border bg-muted p-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Actual</p>
                                <p className="mt-1 font-medium text-foreground">{formatShortDate(task.actualDate)}</p>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{task.assignee || "Unassigned"}</span>
                              <span>{task.delayDays > 0 ? `+${task.delayDays}d` : task.delayDays < 0 ? `${task.delayDays}d` : "On time"}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!visibleTasks.length && (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">{t("planning.noMilestones", { defaultValue: "No milestones available." })}</div>
      )}
    </div>
  );
}

export default TimelineComparisonGraph;
