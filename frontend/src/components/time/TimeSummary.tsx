import React from "react";
import { useTranslation } from "react-i18next";
import type { TimeSummary } from "../../hooks/useTimeTracking";

interface TimeSummaryProps {
  summary: TimeSummary | null;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TimeSummaryCards({ summary }: TimeSummaryProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  if (!summary) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{formatMinutes(summary.total_minutes)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("timeTracking.totalThisWeek")}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{summary.total_hours}h</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{isRTL ? "ساعات هذا الأسبوع" : "Hours this week"}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{summary.by_project.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("timeTracking.byProject")}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{summary.by_user.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("timeTracking.byMember")}</p>
        </div>
      </div>

      {summary.by_project.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-foreground">{t("timeTracking.byProject")}</h4>
          <div className="space-y-2">
            {summary.by_project.map((p) => {
              const pct = summary.total_minutes > 0 ? Math.round((p.total_minutes / summary.total_minutes) * 100) : 0;
              return (
                <div key={p.project_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{p.project_name}</span>
                    <span className="text-muted-foreground">{formatMinutes(p.total_minutes)} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.by_user.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-foreground">{t("timeTracking.byMember")}</h4>
          <div className="space-y-2">
            {summary.by_user.map((u) => {
              const pct = summary.total_minutes > 0 ? Math.round((u.total_minutes / summary.total_minutes) * 100) : 0;
              return (
                <div key={u.user_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{u.user_name}</span>
                    <span className="text-muted-foreground">{formatMinutes(u.total_minutes)} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
