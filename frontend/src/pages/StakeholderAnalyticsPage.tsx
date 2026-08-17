import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Users, TrendingUp, ShieldAlert, ThumbsUp } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Panel, BarRow } from "../components/reports/ReportComponents";
import { DonutChart, TrendBars } from "../components/charts/StakeholderCharts";
import { api } from "../lib/api";
import { buildStakeholderAnalyticsFallback } from "../data/stakeholderFallbacks";

interface AnalyticsData {
  total: number;
  byRole: Record<string, number>;
  byProject: Record<string, number>;
  supportLevel: Record<string, number>;
  type: Record<string, number>;
  category: Record<string, number>;
  engagementLevel: Record<string, number>;
  activity: { date: string; count: number }[];
}

const BAR_COLORS = ["#0C66E4", "#10b981", "#f59e0b", "#7c3aed", "#f43f5e", "#06b6d4"];

function toRows(obj: Record<string, number> | undefined) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function StakeholderAnalyticsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<AnalyticsData>("/stakeholders/analytics")
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: any) => {
        if (!cancelled) {
          const fallback = buildStakeholderAnalyticsFallback();
          setData(fallback.total > 0 ? fallback : null);
          if (fallback.total === 0) {
            setError(e?.message || "Failed to load analytics");
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="p-5"><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div></div>;
  }

  const roleRows = toRows(data.byRole);
  const projectRows = toRows(data.byProject);
  const categoryRows = toRows(data.category);
  const engagementRows = toRows(data.engagementLevel);
  const supporterCount = data.supportLevel?.Supporter ?? 0;
  const opponentCount = data.supportLevel?.Opponent ?? 0;
  const highEngagement = (data.engagementLevel?.["Very High"] ?? 0) + (data.engagementLevel?.High ?? 0);

  const supportDonut = [
    { label: "Supporter", value: data.supportLevel?.Supporter ?? 0, colorHex: "#10b981" },
    { label: "Neutral", value: data.supportLevel?.Neutral ?? 0, colorHex: "#f59e0b" },
    { label: "Opponent", value: data.supportLevel?.Opponent ?? 0, colorHex: "#f43f5e" },
  ];
  const typeDonut = [
    { label: "Internal", value: data.type?.Internal ?? 0, colorHex: "#0C66E4" },
    { label: "External", value: data.type?.External ?? 0, colorHex: "#7c3aed" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("stakeholders.analytics.title")}
          subtitle={t("stakeholders.analytics.subtitle", { count: data.total })}
        />

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Users className="h-4 w-4" />} label={t("stakeholders.analytics.kpiTotal")} value={data.total} />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label={t("stakeholders.analytics.kpiHighEngagement")} value={highEngagement} />
          <Kpi icon={<ThumbsUp className="h-4 w-4" />} label={t("stakeholders.analytics.kpiSupporters")} value={supporterCount} />
          <Kpi icon={<ShieldAlert className="h-4 w-4" />} label={t("stakeholders.analytics.kpiOpponents")} value={opponentCount} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t("stakeholders.analytics.supportDistribution")}>
            {data.total ? <DonutChart data={supportDonut} /> : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>
          <Panel title={t("stakeholders.analytics.byType")}>
            {data.total ? <DonutChart data={typeDonut} /> : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.analytics.byRole")}>
            {roleRows.length ? (
              <div className="space-y-1">
                {roleRows.map(([label, value], i) => (
                  <BarRow key={label} label={label} value={value} max={roleRows[0][1]} color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.analytics.byProject")}>
            {projectRows.length ? (
              <div className="space-y-1">
                {projectRows.map(([label, value], i) => (
                  <BarRow key={label} label={label} value={value} max={projectRows[0][1]} color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.analytics.byCategory")}>
            {categoryRows.length ? (
              <div className="space-y-1">
                {categoryRows.map(([label, value], i) => (
                  <BarRow key={label} label={label} value={value} max={categoryRows[0][1]} color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.analytics.byEngagement")}>
            {engagementRows.length ? (
              <div className="space-y-1">
                {engagementRows.map(([label, value], i) => (
                  <BarRow key={label} label={label} value={value} max={engagementRows[0][1]} color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.analytics.activityTrend")}>
            {data.activity.length ? (
              <TrendBars points={data.activity.map((a) => ({ x: a.date.slice(5), y: a.count }))} />
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default StakeholderAnalyticsPage;
