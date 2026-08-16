import React from "react";
import { UsersRound } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { formatHours } from "../SharedUI";

export interface ResourceHeatmapItem {
  id: number;
  name: string;
  position?: string | null;
  capacity: number;
  utilizationPct: number;
  overloaded: boolean;
}

interface ResourceHeatmapProps {
  resources: ResourceHeatmapItem[];
}

export const ResourceHeatmap: React.FC<ResourceHeatmapProps> = ({ resources }) => {
  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Resource Utilization & Capacity Heatmap
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {resources.length} Team Resources
        </span>
      </div>

      {!resources || resources.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
          No resources are assigned to this project&apos;s planning yet.
        </p>
      ) : (
      <div className="space-y-3">
        {resources.slice(0, 6).map((r) => {
          const isOverloaded = r.overloaded || r.utilizationPct > 100;
          return (
            <div
              key={r.id}
              className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{r.name}</span>
                  {isOverloaded && (
                    <Badge variant="danger" className="text-[10px]">
                      Overallocated
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.position || "Team Resource"} · {r.capacity > 0 ? `${formatHours(r.capacity)}/wk capacity` : "Capacity not set"}
                </span>
              </div>

              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOverloaded
                        ? "bg-rose-500"
                        : r.utilizationPct >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(r.utilizationPct, 100)}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-bold font-mono min-w-[45px] text-right ${
                    isOverloaded
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
                  }`}
                >
                  {r.utilizationPct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
