import React from "react";
import { TrendingUp, BarChart2, DollarSign, Activity } from "lucide-react";
import { formatCurrency, formatHours } from "../SharedUI";

export interface ProgressChartData {
  milestoneName: string;
  plannedProgress: number;
  actualProgress: number;
  plannedHours: number;
  actualHours: number;
  plannedBudget: number;
  actualCost: number;
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

      {/* 2. Effort & Budget Burn Down Comparison */}
      <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-teal-500" />
            <h3 className="text-sm font-semibold text-foreground">
              Effort & Budget Burn Summary
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Financial & Hours Burn</span>
        </div>

        <div className="space-y-5 pt-2">
          {data.slice(0, 5).map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-foreground">{item.milestoneName}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                    <span>Hours Logged</span>
                    <span>{formatHours(item.actualHours)} / {formatHours(item.plannedHours)}</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${
                          item.plannedHours > 0
                            ? Math.min((item.actualHours / item.plannedHours) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
                    <span>Budget Spent</span>
                    <span>{formatCurrency(item.actualCost)} / {formatCurrency(item.plannedBudget)}</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-full"
                      style={{
                        width: `${
                          item.plannedBudget > 0
                            ? Math.min((item.actualCost / item.plannedBudget) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
