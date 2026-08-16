import React from "react";
import { CheckCircle2, Clock, ShieldAlert, AlertTriangle, FileCheck } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { DonutChart } from "../SharedUI";

export interface DeliverableSummary {
  completed: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  total: number;
}

interface DeliverableAnalyticsProps {
  summary: DeliverableSummary;
}

export const DeliverableAnalytics: React.FC<DeliverableAnalyticsProps> = ({
  summary,
}) => {
  const completionRate =
    summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  const pending = Math.max(summary.total - summary.completed - summary.inProgress - summary.blocked, 0);

  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Deliverable Analytics
          </h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {summary.total} Total Deliverables
        </Badge>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-[auto_1fr] gap-6 items-center">
        {summary.total > 0 && (
        <div className="flex justify-center">
          <DonutChart
            size={128}
            strokeWidth={18}
            segments={[
              { value: summary.completed, colorClass: "stroke-emerald-500", label: "Completed" },
              { value: summary.inProgress, colorClass: "stroke-blue-500", label: "In Progress" },
              { value: summary.blocked, colorClass: "stroke-rose-500", label: "Blocked" },
              { value: pending, colorClass: "stroke-muted-foreground/40", label: "Pending" },
            ]}
            centerLabel={<span className="text-2xl font-bold text-foreground">{completionRate}%</span>}
            centerSublabel={<span className="text-[10px] text-muted-foreground uppercase tracking-wider">Complete</span>}
          />
        </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* 1. Completed */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.completed}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              {completionRate}% of portfolio deliverables
            </p>
          </div>

          {/* 2. In Progress */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">In Progress</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {summary.inProgress}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Active in current execution sprint
            </p>
          </div>

          {/* 3. Blocked */}
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Blocked</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {summary.blocked}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Waiting on upstream dependencies
            </p>
          </div>

          {/* 4. Overdue */}
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Overdue</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.overdue}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Passed planned target date
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
