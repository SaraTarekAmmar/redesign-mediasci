import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, BarChart3, Target, Activity, FolderKanban, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { StatTile } from "../components/common/StatTile";
import { Button } from "../components/ui/Button";
import { Textarea } from "../components/ui/Textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";
import { lookups } from "../store/useStore";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface UserStats {
  completed: number;
  assigned_total: number;
  in_progress: number;
  overdue: number;
  logged_hours: number;
  completion_rate: number;
  efficiency_rate: number;
  speed_avg_days: number;
  performance_score: number;
  chart_data: { date: string; count: number }[];
  project_stats: { name: string; completed: number; in_progress: number }[];
}

interface FeedItem {
  id: string | number;
  label: string;
  time_ago: string;
  user?: { name: string } | null;
}

interface ProjectAnalytics {
  id: string | number;
  name: string;
  key: string;
  status: string;
  type: string;
  description?: string | null;
  notes?: string | null;
  members: { id: string | number; name: string; role?: string; avatar_url?: string }[];
  stats: { total: number; completed: number; in_progress: number; todo: number; completion_rate: number };
  created_at?: string | null;
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}

/** Tiny bar row — no charting lib, just relative-height divs. */
function MiniBars({ data, max }: { data: { label: string; value: number }[]; max: number }) {
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.value}`}>
          <div
            className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
            style={{ height: `${max > 0 ? Math.max(2, (d.value / max) * 100) : 2}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function AnalyticsPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"user" | "project">("user");
  const [days, setDays] = useState("30");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [proj, setProj] = useState<ProjectAnalytics | null>(null);
  const [loadingProj, setLoadingProj] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const allProjects = useProjectCatalogStore((s) => s.projects);

  useEffect(() => {
    api.get<{ data: FeedItem[] }>("/analytics/feed").then((res) => setFeed(res?.data ?? []));
  }, []);

  useEffect(() => {
    if (mode !== "user") return;
    let cancelled = false;
    setLoadingStats(true);
    const url = selectedUserId ? `/analytics/users/${selectedUserId}?days=${days}` : `/analytics/me?days=${days}`;
    api.get<UserStats>(url)
      .then((res) => { if (!cancelled) setStats(res); })
      .catch((e: any) => { if (!cancelled) { setStats(null); toast.error(e?.message || t("analytics.loadError")); } })
      .finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, [mode, selectedUserId, days, t]);

  useEffect(() => {
    if (mode !== "project" || !selectedProjectId) { setProj(null); return; }
    let cancelled = false;
    setLoadingProj(true);
    api.get<ProjectAnalytics>(`/analytics/projects/${selectedProjectId}`)
      .then((res) => { if (!cancelled) { setProj(res); setNotes(res?.notes ?? ""); } })
      .catch((e: any) => { if (!cancelled) toast.error(e?.message || t("analytics.loadError")); })
      .finally(() => { if (!cancelled) setLoadingProj(false); });
    return () => { cancelled = true; };
  }, [mode, selectedProjectId, t]);

  const saveNotes = async () => {
    if (!proj) return;
    setSavingNotes(true);
    try {
      await api.put(`/analytics/projects/${proj.id}/notes`, { notes });
      toast.success(t("analytics.notesSaved"));
    } catch (e: any) {
      toast.error(e?.message || t("analytics.notesSaveError"));
    } finally {
      setSavingNotes(false);
    }
  };

  const chartMax = useMemo(() => Math.max(1, ...(stats?.chart_data ?? []).map((d) => d.count)), [stats]);
  const projMax = useMemo(
    () => Math.max(1, ...(stats?.project_stats ?? []).map((p) => p.completed + p.in_progress)),
    [stats]
  );

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("analytics.title")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={mode} onValueChange={(v) => setMode(v as "user" | "project")}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("analytics.modeUser")}</SelectItem>
                  <SelectItem value="project">{t("analytics.modeProject")}</SelectItem>
                </SelectContent>
              </Select>
              {mode === "user" && (
                <>
                  <Select value={selectedUserId || "__me"} onValueChange={(v) => setSelectedUserId(v === "__me" ? "" : v)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__me">{t("analytics.myStats")}</SelectItem>
                      {lookups.users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">{t("analytics.last7")}</SelectItem>
                      <SelectItem value="30">{t("analytics.last30")}</SelectItem>
                      <SelectItem value="90">{t("analytics.last90")}</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              {mode === "project" && (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder={t("analytics.selectProject")} /></SelectTrigger>
                  <SelectContent>
                    {allProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          }
        />

        {mode === "user" && (
          <div>
            {loadingStats ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !stats ? (
              <EmptyState className="mb-5" icon={<BarChart3 className="h-8 w-8" />} title={t("analytics.loadError", { defaultValue: "Unable to load analytics for this user." })} />
            ) : (
              <>
                <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label={t("analytics.completed")} value={stats.completed} tone="text-emerald-500" />
                  <StatCard label={t("analytics.inProgress")} value={stats.in_progress} tone="text-primary" />
                  <StatCard label={t("analytics.overdue")} value={stats.overdue} tone="text-destructive" />
                  <StatCard label={t("analytics.timeLogged")} value={`${stats.logged_hours}h`} tone="text-amber-500" />
                </div>

                <div className="mb-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <BarChart3 className="h-4 w-4" /> {t("analytics.dailyProductivity")}
                    </h2>
                    {stats.chart_data.length > 0 ? (
                      <MiniBars data={stats.chart_data.map((d) => ({ label: d.date.slice(5), value: d.count }))} max={chartMax} />
                    ) : (
                      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4">
                        <span className="text-xs text-muted-foreground">No completed work in this period</span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Target className="h-4 w-4" /> {t("analytics.efficiency")}
                    </h2>
                    <div
                      className="mx-auto flex h-32 w-32 items-center justify-center rounded-full"
                      style={{ background: `conic-gradient(var(--primary) ${stats.completion_rate * 3.6}deg, var(--muted) 0deg)` }}
                    >
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-card text-center">
                        <div>
                          <div className="text-xl font-bold text-foreground">{stats.completion_rate}%</div>
                          <div className="text-[10px] text-muted-foreground">{t("analytics.complete")}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("analytics.performanceScore")}</div>
                      <div className={cn("text-2xl font-extrabold", scoreTone(stats.performance_score))}>{stats.performance_score}/100</div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Activity className="h-4 w-4" /> {t("analytics.velocity")}
                    </h2>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resolution</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{stats.speed_avg_days}d</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">On time</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{stats.efficiency_rate}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FolderKanban className="h-4 w-4" /> {t("analytics.projectsBreakdown")}
                    </h2>
                    <div className="mt-3 space-y-2">
                      {stats.project_stats.map((p) => (
                        <div key={p.name} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 truncate text-muted-foreground">{p.name}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${((p.completed + p.in_progress) / projMax) * 100}%` }}
                            />
                          </div>
                          <span className="w-16 shrink-0 text-right text-muted-foreground">{p.completed}/{p.completed + p.in_progress}</span>
                        </div>
                      ))}
                      {stats.project_stats.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">{t("analytics.noProjectData")}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{t("analytics.activityTimeline")}</h2>
              <div className="max-h-72 space-y-3 overflow-y-auto">
                {feed.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                    <span className="text-foreground">
                      <span className="font-medium">{log.user?.name ?? t("analytics.system")}</span>{" "}
                      <span className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: log.label }} />
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{log.time_ago}</span>
                  </div>
                ))}
                {feed.length === 0 && <p className="rounded-lg border border-dashed border-border bg-muted/20 py-4 text-center text-xs text-muted-foreground">{t("analytics.noActivity")}</p>}
              </div>
            </div>
          </div>
        )}

        {mode === "project" && (
          <div>
            {!selectedProjectId && (
                              <EmptyState icon={<FolderKanban className="h-8 w-8" />} title={t("analytics.selectProject", { defaultValue: "Select a project" })} subtitle={t("analytics.selectProjectHint")} />

            )}
            {selectedProjectId && loadingProj && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {selectedProjectId && !loadingProj && proj && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-lg font-bold text-foreground">
                      {proj.key}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-foreground">{proj.name}</h2>
                      <p className="text-xs text-muted-foreground">{t("analytics.projectMeta", { key: proj.key, type: proj.type, created: proj.created_at })}</p>
                      {proj.description && <p className="mt-1 text-sm text-muted-foreground">{proj.description}</p>}
                    </div>
                    <div className="rounded-lg bg-muted/50 px-4 py-2 text-center">
                      <div className="text-2xl font-bold text-primary">{proj.stats.completion_rate}%</div>
                      <div className="text-[10px] text-muted-foreground">{t("analytics.completion")}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label={t("analytics.totalTasks")} value={proj.stats.total} tone="text-primary" />
                  <StatCard label={t("analytics.completed")} value={proj.stats.completed} tone="text-emerald-500" />
                  <StatCard label={t("analytics.inProgress")} value={proj.stats.in_progress} tone="text-amber-500" />
                  <StatCard label={t("analytics.todo")} value={proj.stats.todo} tone="text-muted-foreground" />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">{t("analytics.teamMembers", { count: proj.members.length })}</h2>
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {proj.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{m.name}</span>
                        <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">{t("analytics.projectNotes")}</h2>
                    <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="gap-1.5">
                      {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {t("analytics.save")}
                    </Button>
                  </div>
                  <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("analytics.notesPlaceholder")} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  const color = tone.includes("emerald") ? "green" : tone.includes("destructive") ? "red" : tone.includes("amber") ? "yellow" : "neutral";
  return <StatTile label={label} value={value} icon={<BarChart3 className="h-5 w-5" />} color={color as "neutral" | "green" | "yellow" | "red"} />;
}

export default AnalyticsPage;
