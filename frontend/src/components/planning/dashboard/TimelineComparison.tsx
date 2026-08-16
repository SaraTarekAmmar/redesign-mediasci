import React, { useState } from "react";
import { Calendar, ZoomIn, ZoomOut, Info, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { formatShortDate } from "../SharedUI";

export interface TimelineMilestoneNode {
  id: number;
  name: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: string;
  blocked?: boolean;
  delayDays?: number;
  completionPct?: number;
  ownerName?: string | null;
  deliverablesCount?: number;
}

interface TimelineComparisonProps {
  milestones: TimelineMilestoneNode[];
  onSelectMilestone: (milestoneId: number) => void;
}

export const TimelineComparison: React.FC<TimelineComparisonProps> = ({
  milestones,
  onSelectMilestone,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredNode, setHoveredNode] = useState<TimelineMilestoneNode | null>(null);

  if (!milestones || milestones.length === 0) {
    return (
      <div className="p-8 rounded-xl border border-dashed border-border bg-card text-center">
        <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-60" />
        <h4 className="text-sm font-semibold text-foreground">No Timeline Data</h4>
        <p className="text-xs text-muted-foreground mt-1">
          No active milestones found to visualize in the timeline comparison.
        </p>
      </div>
    );
  }

  const getNodeColor = (m: TimelineMilestoneNode, isPlannedRow: boolean) => {
    if (m.blocked) return "bg-rose-500 text-white border-rose-600 shadow-rose-500/20";
    if (m.status === "completed") return "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20";
    if ((m.delayDays || 0) > 0) return "bg-amber-500 text-white border-amber-600 shadow-amber-500/20";
    if (isPlannedRow) return "bg-blue-500 text-white border-blue-600 shadow-blue-500/20";
    return "bg-indigo-500 text-white border-indigo-600 shadow-indigo-500/20";
  };

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-semibold text-foreground">
              Planned vs Actual Timeline
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Interactive visual comparison of target baselines against live execution nodes.
          </p>
        </div>

        {/* Legend & Zoom Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Planned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Delayed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Blocked
            </span>
          </div>

          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
              className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1.5 text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.2))}
              className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dual Horizontal Timelines */}
      <div className="overflow-x-auto pb-4 pt-2">
        <div
          className="flex flex-col gap-6 relative transition-all duration-300"
          style={{ minWidth: `${Math.max(700, milestones.length * 140) * zoomLevel}px` }}
        >
          {/* TOP ROW: Planned Timeline */}
          <div className="bg-muted/30 p-4 rounded-xl border border-border/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Baseline Planned Timeline
              </span>
              <span className="text-xs text-muted-foreground">
                Target Schedule Nodes
              </span>
            </div>

            <div className="relative py-4">
              {/* Horizontal Connecting Line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500/30 -translate-y-1/2" />

              {/* Milestone Nodes */}
              <div className="flex items-center justify-between relative z-10 gap-4">
                {milestones.map((m) => (
                  <button
                    key={`planned-${m.id}`}
                    onClick={() => onSelectMilestone(m.id)}
                    onMouseEnter={() => setHoveredNode(m)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="flex flex-col items-center group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 shadow-sm group-hover:scale-110 transition-all ${getNodeColor(
                        m,
                        true
                      )}`}
                    >
                      ●
                    </div>
                    <span className="text-xs font-medium text-foreground mt-2 max-w-[110px] truncate text-center group-hover:text-blue-500 transition-colors">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {formatShortDate(m.plannedEnd || m.plannedStart)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Actual Execution Timeline */}
          <div className="bg-muted/30 p-4 rounded-xl border border-border/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live Actual Execution Timeline
              </span>
              <span className="text-xs text-muted-foreground">
                Actual & Projected Progress Nodes
              </span>
            </div>

            <div className="relative py-4">
              {/* Horizontal Connecting Line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-500/30 -translate-y-1/2" />

              {/* Milestone Nodes */}
              <div className="flex items-center justify-between relative z-10 gap-4">
                {milestones.map((m) => (
                  <button
                    key={`actual-${m.id}`}
                    onClick={() => onSelectMilestone(m.id)}
                    onMouseEnter={() => setHoveredNode(m)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="flex flex-col items-center group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 shadow-sm group-hover:scale-110 transition-all ${getNodeColor(
                        m,
                        false
                      )}`}
                    >
                      {m.status === "completed" ? "✓" : "●"}
                    </div>
                    <span className="text-xs font-medium text-foreground mt-2 max-w-[110px] truncate text-center group-hover:text-emerald-500 transition-colors">
                      {m.name}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {formatShortDate(m.actualEnd || m.actualStart || m.plannedEnd)}
                      </span>
                      {(m.delayDays || 0) > 0 && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          (+{m.delayDays}d)
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Node Tooltip Detail Box */}
      {hoveredNode && (
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-semibold text-foreground truncate">{hoveredNode.name}</span>
            {hoveredNode.ownerName && (
              <span className="text-muted-foreground truncate">· Owner: {hoveredNode.ownerName}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
            <span>Planned: {formatShortDate(hoveredNode.plannedEnd)}</span>
            <span>Actual: {formatShortDate(hoveredNode.actualEnd) || "In Progress"}</span>
            {hoveredNode.delayDays ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Delay: {hoveredNode.delayDays} days
              </span>
            ) : (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                On Schedule
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
