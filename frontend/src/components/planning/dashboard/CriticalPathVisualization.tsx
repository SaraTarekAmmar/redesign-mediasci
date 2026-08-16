import React from "react";
import { Workflow, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "../../ui/Badge";

export interface CriticalPathItem {
  id: number;
  name: string;
  status: string;
  blocked?: boolean;
}

interface CriticalPathVisualizationProps {
  criticalPath: CriticalPathItem[];
  nonCriticalCount?: number;
}

export const CriticalPathVisualization: React.FC<CriticalPathVisualizationProps> = ({
  criticalPath,
  nonCriticalCount = 0,
}) => {
  if (!criticalPath || criticalPath.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Workflow className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Critical Path Chain
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          No critical path sequence calculated for this project yet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Critical Path Sequence
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Longest sequential dependency chain determining project target completion date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {criticalPath.length} Critical Nodes
          </Badge>
          {nonCriticalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({nonCriticalCount} non-critical milestones)
            </span>
          )}
        </div>
      </div>

      {/* Visual Sequence Flow */}
      <div className="overflow-x-auto py-3">
        <div className="flex items-center gap-3 min-w-max">
          {criticalPath.map((item, idx) => {
            const isLast = idx === criticalPath.length - 1;
            const isBlocked = item.blocked;
            const isCompleted = item.status === "completed";

            return (
              <React.Fragment key={item.id}>
                <div
                  className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                    isBlocked
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : isCompleted
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-primary/40 bg-primary/5 text-foreground"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      isBlocked
                        ? "bg-rose-500 text-white"
                        : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-snug">{item.name}</h4>
                    <span className="text-[10px] opacity-75 uppercase tracking-wider font-mono">
                      {item.status}
                    </span>
                  </div>
                </div>

                {!isLast && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
