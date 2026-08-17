import React from "react";
import {
  TrendingUp,
  Clock3,
  DollarSign,
  CalendarDays,
  ShieldAlert,
  Target,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "../../ui/Badge";
import { formatCurrency, formatDays, RadialGauge, DualRadialGauge } from "../SharedUI";

export interface KPIData {
  healthScore: number;
  healthState: "Green" | "Yellow" | "Red" | string;
  plannedProgressPct: number;
  actualProgressPct: number;
  scheduleVarianceDays: number;
  budgetVariance: number;
  forecastFinish?: string | null;
  forecastConfidence?: string | null;
  blockedMilestones: number;
  openRisks: number;
}

interface ExecutiveKPICardsProps {
  data: KPIData;
}

export const ExecutiveKPICards: React.FC<ExecutiveKPICardsProps> = ({ data }) => {
  const isAhead = data.scheduleVarianceDays < 0;
  const isDelayed = data.scheduleVarianceDays > 0;
  const hasProgress = data.plannedProgressPct > 0 || data.actualProgressPct > 0;
  const isUnderBudget = data.budgetVariance <= 0;

  const healthBadgeVariant =
    data.healthState === "Green"
      ? "success"
      : data.healthState === "Yellow"
      ? "warning"
      : data.healthState === "Red"
      ? "danger"
      : "outline";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* 1. Health Score */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Health Score
          </span>
          <div className="p-2 rounded-lg border border-foreground/15 bg-muted text-foreground">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <RadialGauge
            value={data.healthScore}
            size={64}
            strokeWidth={7}
            color={
              data.healthScore >= 80
                ? "stroke-emerald-500"
                : data.healthScore >= 60
                ? "stroke-amber-500"
                : "stroke-rose-500"
            }
            label={<span className="text-sm font-bold text-foreground">{data.healthScore}%</span>}
          />
          <Badge variant={healthBadgeVariant} className="text-xs">
            {data.healthState}
          </Badge>
        </div>
      </div>

      {/* 2. Progress % (Planned vs Actual) */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Execution Progress
          </span>
          <div className="p-2 rounded-lg border border-foreground/15 bg-muted text-foreground">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DualRadialGauge
            plannedPct={data.plannedProgressPct}
            actualPct={data.actualProgressPct}
            size={64}
            strokeWidth={6}
            label={<span className="text-sm font-bold text-foreground">{data.actualProgressPct}%</span>}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-foreground/30 inline-block shrink-0" /> Planned {data.plannedProgressPct}%
            </div>
            {!hasProgress ? (
              <span className="text-muted-foreground flex items-center font-medium text-xs mt-1">
                Not started
              </span>
            ) : data.actualProgressPct >= data.plannedProgressPct ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center font-medium text-xs mt-1">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                On Target
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center font-medium text-xs mt-1">
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                {data.plannedProgressPct - data.actualProgressPct}% gap
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Schedule Variance */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Schedule Variance
          </span>
          <div className="p-2 rounded-lg border border-foreground/15 bg-muted text-foreground">
            <Clock3 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground">
            {data.scheduleVarianceDays === 0 ? "0d" : formatDays(isAhead ? -Math.abs(data.scheduleVarianceDays) : Math.abs(data.scheduleVarianceDays))}
          </span>
          <Badge variant={isAhead ? "success" : isDelayed ? "danger" : "outline"} className="text-xs">
            {isAhead ? "Ahead" : isDelayed ? "Delayed" : "On time"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {isAhead
            ? `Ahead of baseline by ${Math.abs(data.scheduleVarianceDays)} days`
            : isDelayed
            ? `${Math.abs(data.scheduleVarianceDays)} days behind baseline`
            : "On baseline schedule"}
        </p>
      </div>

      {/* 4. Budget Variance */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Budget Variance
          </span>
          <div className="p-2 rounded-lg border border-foreground/15 bg-muted text-foreground">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(Math.abs(data.budgetVariance))}
          </span>
          <Badge variant={isUnderBudget ? "success" : "warning"} className="text-xs">
            {isUnderBudget ? "Under" : "Overrun"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {isUnderBudget ? "Under planned budget" : "Over planned budget variance"}
        </p>
      </div>

      {/* 5. Forecast Finish Date */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Forecast Finish
          </span>
          <div className="p-2 rounded-lg border border-foreground/15 bg-muted text-foreground">
            <CalendarDays className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-foreground truncate">
            {data.forecastFinish || "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <Badge variant="outline" className="text-xs font-normal">
            {data.forecastConfidence || "—"}
          </Badge>
        </div>
      </div>

      {/* 6. Blocked & Risks */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Risk & Blockers
          </span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {data.blockedMilestones}
            </span>
            <span className="text-xs text-muted-foreground ml-1">Blocked</span>
          </div>
          <div className="h-6 w-[1px] bg-border" />
          <div>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {data.openRisks}
            </span>
            <span className="text-xs text-muted-foreground ml-1">Risks</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
          {data.blockedMilestones > 0 ? (
            <span className="text-rose-600 dark:text-rose-400 flex items-center font-medium">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Action Required
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              No Critical Blockers
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
