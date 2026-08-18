import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, Lightbulb, Sparkles } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Panel, BarRow } from "../components/reports/ReportComponents";
import { DonutChart, ScatterChart } from "../components/charts/StakeholderCharts";
import { api } from "../lib/api";
import { buildStakeholderImpactFallback } from "../data/stakeholderFallbacks";

interface ImpactData {
  schedule: number;
  scope: number;
  risk: number;
  comms: number;
}

interface BubblePoint {
  x: number;
  y: number;
  r: number;
  name: string;
  influence: string;
  score: number;
  interactions: number;
}

interface QuadrantPoint {
  x: number;
  y: number;
  name: string;
  position: string;
}

interface ImpactCharts {
  influenceComms: BubblePoint[];
  engagementFreq: QuadrantPoint[];
  support: Record<string, number>;
  responseTime: { name: string; value: number }[];
}

interface Alert {
  type: string;
  message: string;
  stakeholderId: string;
  stakeholderName: string;
}

interface Insight {
  type: string;
  title: string;
  message: string;
}

interface Recommendation {
  name: string;
  quadrant: string;
  rec: string;
}

interface ImpactResponse {
  impactData: ImpactData;
  charts: ImpactCharts;
  alerts: Alert[];
  insights: Insight[];
  recommendations: Recommendation[];
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-foreground">{Math.round(value)}%</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round(value))}%` }} />
      </div>
    </div>
  );
}

function StakeholderImpactPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<ImpactResponse>("/stakeholders/impact")
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: any) => {
        if (!cancelled) {
          const fallback = buildStakeholderImpactFallback();
          setData(fallback.charts.engagementFreq.length > 0 ? fallback : null);
          if (fallback.charts.engagementFreq.length === 0) {
            setError(e?.message || "Failed to load");
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

  const { impactData, charts, alerts, insights, recommendations } = data;
  const responseTimeRows = charts.responseTime.filter((r) => r.value > 0);
  const responseMax = Math.max(1, ...responseTimeRows.map((r) => r.value));
  const supportDonut = [
    { label: "Supporter", value: charts.support?.Supporter ?? 0, colorHex: "#10b981" },
    { label: "Neutral", value: charts.support?.Neutral ?? 0, colorHex: "#f59e0b" },
    { label: "Opponent", value: charts.support?.Opponent ?? 0, colorHex: "#f43f5e" },
  ];
  const bubbleMaxR = Math.max(1, ...charts.influenceComms.map((p) => p.r));
  const freqMaxX = Math.max(5, ...charts.engagementFreq.map((p) => p.x));
  const freqMaxY = Math.max(5, ...charts.engagementFreq.map((p) => p.y));

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("stakeholders.impact.title")}
          subtitle={t("stakeholders.impact.subtitle", { count: charts.engagementFreq.length })}
        />

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t("stakeholders.impact.avgSchedule")} value={impactData.schedule} />
          <Kpi label={t("stakeholders.impact.avgScope")} value={impactData.scope} />
          <Kpi label={t("stakeholders.impact.avgRisk")} value={impactData.risk} />
          <Kpi label={t("stakeholders.impact.avgComms")} value={impactData.comms} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t("stakeholders.impact.influenceVsComms")} subtitle="Bubble size = interaction count">
            {charts.influenceComms.length ? (
              <ScatterChart
                xLabel="Influence"
                yLabel="Communication score"
                points={charts.influenceComms.map((p) => ({
                  x: p.x, y: p.y, r: 4 + (p.r / bubbleMaxR) * 10, label: `${p.name} · ${p.interactions} interactions`,
                  colorHex: p.influence === "High" && p.score < 40 ? "#f43f5e" : p.influence === "High" && p.score > 70 ? "#10b981" : "var(--foreground)",
                }))}
              />
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.impact.engagementVsFrequency")}>
            {charts.engagementFreq.length ? (
              <ScatterChart
                xLabel="Interaction frequency"
                yLabel="Engagement score"
                xMax={freqMaxX}
                yMax={freqMaxY}
                points={charts.engagementFreq.map((p) => ({ x: p.x, y: p.y, label: `${p.name} (${p.position})` }))}
              />
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>

          <Panel title={t("stakeholders.impact.supportBreakdown")}>
            <DonutChart data={supportDonut} />
          </Panel>

          <Panel title={t("stakeholders.impact.responseTime")}>
            {responseTimeRows.length ? (
              <div className="space-y-1">
                {responseTimeRows.map((r) => (
                  <BarRow key={r.name} label={r.name} value={Math.round(r.value)} max={responseMax} color="var(--foreground)" />
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{t("stakeholders.analytics.noData")}</p>}
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel title={t("stakeholders.impact.alerts")} action={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stakeholders.impact.noAlerts")}</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className="cursor-pointer rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-left text-xs text-foreground hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open stakeholder alert for ${a.stakeholderId}`}
                    onClick={() => navigate(`/stakeholders/${a.stakeholderId}`)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/stakeholders/${a.stakeholderId}`); } }}
                  >
                    {a.message}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={t("stakeholders.impact.insights")} action={<Lightbulb className="h-4 w-4 text-primary" />}>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stakeholders.impact.noInsights")}</p>
            ) : (
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <div key={i} className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs">
                    <p className="font-semibold text-foreground">{ins.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{ins.message}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={t("stakeholders.impact.recommendations")} action={<Sparkles className="h-4 w-4 text-primary" />}>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stakeholders.impact.noRecommendations")}</p>
            ) : (
              <div className="space-y-2">
                {recommendations.map((r, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{r.name}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{r.quadrant}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{r.rec}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default StakeholderImpactPage;
