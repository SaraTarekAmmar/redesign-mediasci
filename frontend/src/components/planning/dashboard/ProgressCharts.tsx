import React from "react";
import { TrendingUp, Activity } from "lucide-react";
import { formatHours } from "../SharedUI";

export interface ProgressChartData {
  milestoneName: string;
  plannedProgress: number;
  actualProgress: number;
  plannedHours: number;
  actualHours: number;
}

interface ProgressChartsProps {
  data: ProgressChartData[];
}

export const ProgressCharts: React.FC<ProgressChartsProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Planned vs Actual Progress Line / Bar Chart */}
      <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Planned vs Actual Completion %
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Milestone Breakdown</span>
        </div>

        <div className="space-y-4 pt-2">
          {data.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-foreground truncate max-w-[200px]">{item.milestoneName}</span>
                <span className="text-muted-foreground">
                  Actual: <strong className="text-emerald-600 dark:text-emerald-400">{item.actualProgress}%</strong> / Target: {item.plannedProgress}%
                </span>
              </div>
              <div className="w-full bg-muted h-3 rounded-full overflow-hidden relative">
                {/* Target Baseline Marker Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                  style={{ left: `${Math.min(item.plannedProgress, 100)}%` }}
                  title={`Planned: ${item.plannedProgress}%`}
                />
                {/* Actual Fill Bar */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.actualProgress >= item.plannedProgress
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(item.actualProgress, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Effort Variance */}
      <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Effort Variance</h3>
          </div>
          <span className="text-xs text-muted-foreground">Actual vs planned hours</span>
        </div>

        <div className="space-y-4 pt-2">
          {data.slice(0, 5).map((item, idx) => {
            const planned = Math.max(0, item.plannedHours);
            const actual = Math.max(0, item.actualHours);
            const variance = actual - planned;
            const ratio = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
            return (
              <div key={idx} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-foreground">{item.milestoneName}</span>
                  <span className={variance > 0 ? "shrink-0 font-semibold text-amber-700 dark:text-amber-300" : "shrink-0 font-semibold text-emerald-700 dark:text-emerald-300"}>
                    {variance > 0 ? "+" : ""}{formatHours(variance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Actual {formatHours(actual)}</span>
                  <span>Plan {formatHours(planned)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={variance > 0 ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-primary"} style={{ width: `${ratio}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
