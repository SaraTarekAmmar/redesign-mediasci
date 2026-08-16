import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/reports/ReportComponents";
import { api } from "../lib/api";
import { buildStakeholderEngagementFallback } from "../data/stakeholderFallbacks";

interface EngagementStakeholder {
  id: string;
  name: string;
  photoUrl: string;
  projects: string[];
  interactionsCount: number;
  lastInteractionDate: string | null;
  engagementLevel: "High" | "Medium" | "Low";
}

interface EngagementInteraction {
  id: string;
  stakeholderId: string;
  stakeholderName: string | null;
  type: string;
  description: string;
  occurredAt: string;
}

interface EngagementData {
  stakeholders: EngagementStakeholder[];
  interactions: EngagementInteraction[];
}

function levelVariant(level: string): "default" | "secondary" | "outline" {
  if (level === "High") return "default";
  if (level === "Medium") return "secondary";
  return "outline";
}

function StakeholderEngagementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<EngagementData>("/stakeholders/engagement")
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: any) => {
        if (!cancelled) {
          const fallback = buildStakeholderEngagementFallback();
          setData(fallback.stakeholders.length > 0 ? fallback : null);
          if (fallback.stakeholders.length === 0) {
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

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("stakeholders.engagement.title")}
          subtitle={t("stakeholders.engagement.subtitle")}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("stakeholders.colName")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.registration.colProjects")}</th>
                  <th className="px-3 py-2.5 font-medium text-center">{t("stakeholders.engagement.colInteractions")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.engagement.colLastContact")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.engagement.colEngagement")}</th>
                </tr>
              </thead>
              <tbody>
                {data.stakeholders.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    onClick={() => navigate(`/stakeholders/${s.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img src={s.photoUrl} alt={s.name} className="h-7 w-7 rounded-full object-cover" />
                        <span className="font-medium text-foreground">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{s.projects.length ? s.projects.join(", ") : "—"}</td>
                    <td className="px-3 py-3 text-center font-mono font-semibold text-foreground">{s.interactionsCount}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {s.lastInteractionDate ? new Date(s.lastInteractionDate).toLocaleDateString() : t("stakeholders.engagement.never")}
                    </td>
                    <td className="px-3 py-3"><Badge variant={levelVariant(s.engagementLevel)}>{s.engagementLevel}</Badge></td>
                  </tr>
                ))}
                {data.stakeholders.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("stakeholders.noStakeholders")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <Panel title={t("stakeholders.engagement.recentActivity")}>
            {data.interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stakeholders.engagement.noRecentActivity")}</p>
            ) : (
              <div className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
                {data.interactions.map((i) => (
                  <div
                    key={i.id}
                    className="cursor-pointer rounded-lg border border-border bg-muted/20 p-2.5 text-xs hover:bg-accent/40"
                    onClick={() => navigate(`/stakeholders/${i.stakeholderId}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{i.stakeholderName || "—"}</span>
                      <Badge variant="outline">{i.type}</Badge>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground">{i.description}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{new Date(i.occurredAt).toLocaleString()}</p>
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

export default StakeholderEngagementPage;
