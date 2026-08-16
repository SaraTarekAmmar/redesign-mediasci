import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, Link2 } from "lucide-react";
import { Badge } from "../ui/Badge";
import type { PlanningMilestone } from "../../pages/PlanComparisonPage";
import { MiniBar, formatDays, formatHours, formatShortDate } from "./SharedUI";
import { cn } from "../../lib/utils";

interface MilestoneFocusPanelProps {
  milestone: PlanningMilestone;
}

export function MilestoneFocusPanel({ milestone }: MilestoneFocusPanelProps) {
  const { t } = useTranslation();

  const traffic = milestone.traffic_light || milestone.health_status || (milestone.blocked ? "Red" : "Green");
  const tone = traffic === "Red" ? "destructive" : traffic === "Yellow" ? "secondary" : "default";
  const issues = milestone.issues ?? [];
  const deliverables = milestone.deliverables ?? [];
  const blockers = milestone.blocking_milestones ?? milestone.dependency_impact?.blocking ?? [];

  return (
    <div className="max-h-[560px] overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("planning.focusedMilestone", { defaultValue: "Focused Milestone" })}
          </p>
          <h2 className="mt-1 truncate text-[17px] font-semibold text-slate-900">{milestone.name}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {formatShortDate(milestone.planned_start_date)} - {formatShortDate(milestone.planned_end_date)}
          </p>
        </div>
        <Badge variant={tone}>{traffic}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("planning.delay", { defaultValue: "Delay" })}</p>
          <p className={cn("mt-1 text-[20px] font-semibold leading-none", (milestone.delay_days ?? 0) > 0 ? "text-rose-600" : "text-slate-900")}>{formatDays(milestone.delay_days)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("planning.progress", { defaultValue: "Progress" })}</p>
          <p className="mt-1 text-[20px] font-semibold leading-none text-slate-900">{Math.round(Number(milestone.completion_percentage ?? milestone.actual_progress_pct ?? 0))}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("planning.owner", { defaultValue: "Owner" })}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{milestone.owner_resource?.name || "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("planning.risk", { defaultValue: "Risk" })}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{milestone.risk_level || "—"}</p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("planning.overview", { defaultValue: "Overview" })}</p>
            <Badge variant={tone}>{milestone.health_status || milestone.status}</Badge>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t("planning.status", { defaultValue: "Status" })}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{milestone.health_status || milestone.status}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t("planning.trafficLight", { defaultValue: "Traffic Light" })}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{traffic}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("planning.planVsActual", { defaultValue: "Plan vs Actual" })}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t("planning.plannedFinish", { defaultValue: "Planned Finish" })}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatShortDate(milestone.planned_end_date)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t("planning.forecastFinish", { defaultValue: "Forecast Finish" })}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatShortDate(milestone.forecast_finish || milestone.actual_end_date)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t("planning.plannedHours", { defaultValue: "Planned Hours" })}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatHours(milestone.planned_hours)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t("planning.hoursVariance", { defaultValue: "Hours Variance" })}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatHours(milestone.hours_variance)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("planning.progress", { defaultValue: "Progress Intelligence" })}</p>
            <span className="text-[11px] text-slate-500">{Math.round(Number(milestone.actual_progress_pct ?? milestone.completion_percentage ?? 0))}%</span>
          </div>
          <div className="mt-2 space-y-2">
            <MiniBar label={t("planning.plannedProgress", { defaultValue: "Planned" })} value={Math.round(Number(milestone.planned_progress_pct ?? milestone.planned_progress ?? 0))} tone="bg-blue-500" />
            <MiniBar label={t("planning.actualProgress", { defaultValue: "Actual" })} value={Math.round(Number(milestone.actual_progress_pct ?? milestone.completion_percentage ?? 0))} tone="bg-emerald-500" />
            <MiniBar label={t("planning.variance", { defaultValue: "Variance" })} value={Math.abs(Number(milestone.variance_percentage ?? milestone.delay_days ?? 0))} tone="bg-orange-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("planning.keyTask", { defaultValue: "Key Task" })}</p>
          <div className="mt-2 space-y-2">
            {issues.slice(0, 1).map((issue) => (
              <div key={issue.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", issue.done ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600")}>
                    {issue.done ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{issue.key}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{issue.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{issue.status || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
            {!issues.length && <p className="text-sm text-slate-500">{t("planning.noIssues", { defaultValue: "No issue data available." })}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t("planning.dependencies", { defaultValue: "Dependencies" })}</p>
          <div className="mt-2 space-y-2">
            {blockers.slice(0, 3).map((dependency, index) => (
              <div key={dependency.id ?? `${dependency.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <Link2 className="h-4 w-4 shrink-0 text-blue-500" />
                <span className="truncate">{dependency.title || dependency.name}</span>
              </div>
            ))}
            {!blockers.length && <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">{t("planning.noDependencies", { defaultValue: "No blocking dependencies." })}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
