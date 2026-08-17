import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore, lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";
import { UserAvatar } from "../common/UserAvatar";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";

type ZoomLevel = "day" | "week" | "month";

interface GanttTask {
  id: string;
  key: string;
  title: string;
  startDate: Date;
  endDate: Date;
  assigneeId?: string;
  externalAssigneeId?: string;
  typeKey: string;
  priorityId: string;
  statusId: string;
  progress: number;
}

interface GanttDependency {
  from: string;
  to: string;
}

interface GanttChartProps {
  tasks: GanttTask[];
  dependencies?: GanttDependency[];
  zoom: ZoomLevel;
  onTaskClick?: (taskId: string) => void;
  onDateChange?: (taskId: string, start: Date, end: Date) => void;
  className?: string;
}

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 260;
const HEADER_HEIGHT = 40;

function getDaysInRange(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatDateLabel(date: Date, zoom: ZoomLevel): string {
  if (zoom === "day") return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  if (zoom === "week") return `W${Math.ceil((date.getDate()) / 7)} ${date.toLocaleDateString("en-US", { month: "short" })}`;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getStatusColor(statusId: string): string {
  const colors: Record<string, string> = {
    s1: "#94a3b8",
    s2: "#64748b",
    s3: "var(--primary)",
    s4: "#f59e0b",
    s5: "#22c55e",
  };
  return colors[statusId] ?? "var(--primary)";
}

export function GanttChart({
  tasks,
  dependencies = [],
  zoom,
  onTaskClick,
  onDateChange,
  className,
}: GanttChartProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragging, setDragging] = useState<{ taskId: string; startX: number; originalStart: Date; originalEnd: Date } | null>(null);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [tasks]);

  const dateRange = useMemo(() => {
    if (sortedTasks.length === 0) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      return { start, end };
    }
    const starts = sortedTasks.map((t) => t.startDate.getTime());
    const ends = sortedTasks.map((t) => t.endDate.getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...ends));
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);
    return { start: minDate, end: maxDate };
  }, [sortedTasks]);

  const totalDays = getDaysInRange(dateRange.start, dateRange.end);

  const getPixelX = useCallback(
    (date: Date) => {
      const days = getDaysInRange(dateRange.start, date) - 1;
      if (zoom === "day") return days * 40;
      if (zoom === "week") return (days / 7) * 120;
      return (days / 30) * 200;
    },
    [dateRange.start, zoom]
  );

  const getBarWidth = useCallback(
    (start: Date, end: Date) => {
      const days = getDaysInRange(start, end);
      if (zoom === "day") return Math.max(days * 40, 20);
      if (zoom === "week") return Math.max((days / 7) * 120, 20);
      return Math.max((days / 30) * 200, 20);
    },
    [zoom]
  );

  const dateHeaders = useMemo(() => {
    const headers: { label: string; x: number; width: number }[] = [];
    const current = new Date(dateRange.start);

    if (zoom === "day") {
      while (current <= dateRange.end) {
        const x = getPixelX(current);
        const isWeekend = current.getDay() === 0 || current.getDay() === 6;
        headers.push({
          label: current.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          x,
          width: 40,
        });
        if (isWeekend) {
          // Mark weekend
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (zoom === "week") {
      while (current <= dateRange.end) {
        current.setDate(current.getDate() + (7 - current.getDay()));
        if (current > dateRange.end) break;
        headers.push({
          label: formatDateLabel(current, "week"),
          x: getPixelX(current),
          width: 120,
        });
      }
    } else {
      while (current <= dateRange.end) {
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        headers.push({
          label: formatDateLabel(monthStart, "month"),
          x: getPixelX(monthStart),
          width: 200,
        });
        current.setMonth(current.getMonth() + 1);
      }
    }
    return headers;
  }, [dateRange, zoom, getPixelX]);

  const todayX = getPixelX(new Date());

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.stopPropagation();
      setDragging({
        taskId: task.id,
        startX: e.clientX,
        originalStart: new Date(task.startDate),
        originalEnd: new Date(task.endDate),
      });
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      // Resize logic would go here
    };
    const handleMouseUp = () => {
      setDragging(null);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (tasks.length === 0) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl border border-border bg-card p-12 text-muted-foreground", className)}>
        <div className="text-center">
          <p className="text-sm font-medium">{t("gantt.noTasks")}</p>
          <p className="mt-1 text-xs">{t("gantt.noTasksDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex overflow-x-auto" onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
        {/* Task labels */}
        <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card" style={{ width: LABEL_WIDTH }}>
          <div className="flex items-center border-b border-border px-3" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("gantt.task")}</span>
          </div>
          {sortedTasks.map((task) => {
            const status = lookups.statusById[task.statusId];
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 border-b border-border px-3 cursor-pointer hover:bg-accent/40 transition-colors"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onTaskClick?.(task.id)}
              >
                <IssueTypeIcon typeKey={task.typeKey as any} className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  <span className="font-mono text-muted-foreground">{task.key}</span>{" "}
                  <span className="truncate">{task.title}</span>
                </span>
                {task.assigneeId && (
                  <UserAvatar userId={task.assigneeId} externalId={task.externalAssigneeId} size="xs" />
                )}
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="min-w-0 flex-1">
          {/* Date headers */}
          <div className="relative border-b border-border" style={{ height: HEADER_HEIGHT }}>
            <div className="relative" style={{ width: totalDays * (zoom === "day" ? 40 : zoom === "week" ? 120 / 7 : 200 / 30) }}>
              {dateHeaders.map((header, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex items-center border-r border-border/50 px-2"
                  style={{ left: header.x, width: header.width, height: HEADER_HEIGHT }}
                >
                  <span className="text-[10px] font-medium text-muted-foreground truncate">{header.label}</span>
                </div>
              ))}
              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-px bg-primary/60 z-10"
                style={{ left: todayX }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground whitespace-nowrap">
                  {t("gantt.today")}
                </div>
              </div>
            </div>
          </div>

          {/* Bars */}
          <div className="relative">
            {sortedTasks.map((task) => {
              const x = getPixelX(task.startDate);
              const width = getBarWidth(task.startDate, task.endDate);
              const color = getStatusColor(task.statusId);
              const isCompleted = task.statusId === "s5";

              return (
                <div
                  key={task.id}
                  className="flex items-center border-b border-border/50 hover:bg-accent/20 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="relative w-full h-full">
                    {/* Weekend backgrounds */}
                    {zoom === "day" &&
                      dateHeaders.map((header, i) => {
                        const date = new Date(dateRange.start);
                        date.setDate(date.getDate() + i);
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        if (!isWeekend) return null;
                        return (
                          <div
                            key={`we-${i}`}
                            className="absolute top-0 bottom-0 bg-muted/30"
                            style={{ left: header.x, width: header.width }}
                          />
                        );
                      })}

                    {/* Task bar */}
                    <div
                      className="absolute top-2 cursor-pointer rounded-md shadow-sm transition-all hover:shadow-md group"
                      style={{
                        left: x,
                        width: Math.max(width, 24),
                        height: ROW_HEIGHT - 16,
                        backgroundColor: color,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, task)}
                      onClick={() => onTaskClick?.(task.id)}
                    >
                      {/* Progress fill */}
                      {isCompleted && (
                        <div className="absolute inset-0 rounded-md bg-white/20" />
                      )}
                      {/* Label */}
                      {width > 60 && (
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate pointer-events-none">
                          {task.key}
                        </span>
                      )}
                    </div>

                    {/* Dependency arrows */}
                    {dependencies.map((dep, di) => {
                      if (dep.to !== task.id) return null;
                      const fromTask = sortedTasks.find((t) => t.id === dep.from);
                      if (!fromTask) return null;
                      const fromX = getPixelX(fromTask.startDate) + getBarWidth(fromTask.startDate, fromTask.endDate);
                      const toX = x;
                      const midY = ROW_HEIGHT / 2;
                      const fromRow = sortedTasks.findIndex((t) => t.id === dep.from);
                      const toRow = sortedTasks.findIndex((t) => t.id === dep.to);
                      const rowDiff = toRow - fromRow;

                      return (
                        <svg
                          key={`dep-${di}`}
                          className="absolute top-0 left-0 pointer-events-none"
                          style={{ width: "100%", height: "100%" }}
                        >
                          <defs>
                            <marker id={`arrow-${di}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                              <path d="M0,0 L6,2 L0,4" fill="none" stroke="#94a3b8" strokeWidth="1" />
                            </marker>
                          </defs>
                          <path
                            d={`M${fromX},${midY} C${fromX + 20},${midY} ${toX - 20},${midY + rowDiff * ROW_HEIGHT} ${toX},${midY + rowDiff * ROW_HEIGHT}`}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeDasharray="4,2"
                            markerEnd={`url(#arrow-${di})`}
                          />
                        </svg>
                      );
                    })}
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
