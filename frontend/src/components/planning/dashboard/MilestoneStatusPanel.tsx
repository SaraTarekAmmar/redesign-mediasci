import React from "react";
import { Layers, User, Calendar, AlertCircle, ArrowRight } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { formatDays, formatHours, formatShortDate } from "../SharedUI";
import type { TimelineMilestoneNode } from "./TimelineComparison";

interface MilestoneStatusPanelProps {
  milestones: TimelineMilestoneNode[];
  onSelectMilestone: (id: number) => void;
}

export const MilestoneStatusPanel: React.FC<MilestoneStatusPanelProps> = ({
  milestones,
  onSelectMilestone,
}) => {
  if (!milestones || milestones.length === 0) return null;

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Milestone Execution Cards
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {milestones.length} Active Milestones
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {milestones.map((m) => {
          const isCompleted = m.status === "completed";
          const isBlocked = m.blocked;
          const isDelayed = (m.delayDays || 0) > 0;

          return (
            <div
              key={m.id}
              onClick={() => onSelectMilestone(m.id)}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge
                    variant={
                      isBlocked
                        ? "danger"
                        : isCompleted
                        ? "success"
                        : isDelayed
                        ? "warning"
                        : "outline"
                    }
                    className="text-[10px]"
                  >
                    {isBlocked
                      ? "Blocked"
                      : isCompleted
                      ? "Completed"
                      : isDelayed
                      ? `+${m.delayDays}d Delay`
                      : m.status}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    #{m.id}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                  {m.name}
                </h4>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <User className="w-3.5 h-3.5" />
                  <span>{m.ownerName || "Unassigned Owner"}</span>
                </div>
              </div>

              <div>
                {/* Progress bar */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-semibold text-foreground">
                      {m.completionPct || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted
                          ? "bg-emerald-500"
                          : isBlocked
                          ? "bg-rose-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(m.completionPct || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {formatShortDate(m.actualEnd || m.plannedEnd)}
                  </span>
                  <span className="group-hover:translate-x-1 transition-transform text-primary font-medium flex items-center gap-0.5">
                    Details <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
