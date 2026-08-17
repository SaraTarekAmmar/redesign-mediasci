import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Users, Calendar, Sparkles, KanbanSquare, CheckSquare2, ListTodo, Map as MapIcon, BarChart3, Layers, Rocket, PencilLine, Building2, ArrowRight, AlertTriangle, Target } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useStore, lookups } from "../store/useStore";
import { api, getActiveProjectId } from "../lib/api";
import { cn } from "../lib/utils";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import { useAuth } from "../hooks/useAuth";
import type { Client } from "../data/types";

interface ProjectDetail {
  id: string | number;
  name: string;
  key: string;
  description?: string | null;
  status: string;
  type: string;
  classification?: string;
  presale_type?: string | null;
  client_id?: string | number | null;
  client?: { id: string | number; name: string; company?: string | null; status?: string } | null;
  start_date?: string | null;
  end_date?: string | null;
  owner?: { id: number; name: string } | null;
  team?: { id: number; name: string } | null;
  teams?: {
    id: number;
    name: string;
    color?: string | null;
    description?: string | null;
    members_count?: number;
    resources_count?: number;
  }[];
  partners?: {
    id: number;
    name: string;
    company?: string | null;
    specialty?: string | null;
    color?: string | null;
    members_count?: number;
  }[];
  members?: { id: number; name: string; pivot?: { role?: string } }[];
  issues_count?: number;
  members_count?: number;
  sprints_count?: number;
  contractual_terms?: string | null;
}

interface BriefingItem {
  severity: string;
  tone: "success" | "warning" | "danger";
  icon: string;
  title: string;
  detail: string;
  count: number;
  link: string;
}

interface BriefingResponse {
  briefing: {
    headline: string;
    health: { score: number; tone: "success" | "warning" | "danger"; label: string };
    attention: BriefingItem[];
  };
  sprintForecast: {
    has_sprint: boolean;
    summary: string;
    sprints: { name: string; tone: string; verdict: string; done_pct: number }[];
  };
}

interface PerformanceMilestone {
  id: number;
  project_id: number;
  name: string;
  title?: string;
  status: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  planned_hours?: number;
  planned_budget?: number;
  planned_progress?: number;
  deliverables_count?: number;
  completion_percentage?: number;
  ready_to_start?: boolean;
  blocked?: boolean;
  blocking_reason?: string | null;
  dependencies_completed?: number;
  dependencies_remaining?: number;
  blocking_milestones?: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
  completed_issues?: number;
  remaining_issues?: number;
  completed_story_points?: number;
  remaining_story_points?: number;
  deliverable_progress?: {
    progress_pct: number;
    completed_tasks: number;
    remaining_tasks: number;
    status: string;
  };
}

interface PerformanceResponse {
  project: ProjectDetail;
  summary: {
    health: { score: number; state: "Green" | "Yellow" | "Red"; tone: "success" | "warning" | "danger" };
    completion_pct: number;
    schedule_variance_days: number;
    days_late: number;
    days_ahead: number;
    planned_start?: string | null;
    actual_start?: string | null;
    planned_finish?: string | null;
    forecast_finish?: string | null;
    actual_finish?: string | null;
    planned_hours: number;
    actual_hours: number;
    remaining_hours: number;
    hours_variance: number;
    planned_budget: number;
    actual_cost: number;
    remaining_budget: number;
    budget_variance: number;
    blocked_milestones: number;
    open_risks: number;
    blocked_project: boolean;
    blocking_milestone?: { id: number; name: string; title?: string } | null;
    blocking_reason?: string | null;
    milestone_completion_pct: number;
    issue_completion_pct: number;
    completed_issues: number;
    remaining_issues: number;
    completed_story_points: number;
    remaining_story_points: number;
    overdue_milestones: number;
  };
  baseline_comparison: {
    planning: { planned_hours: number; actual_hours: number; variance: number };
    budget: { planned: number; actual: number; variance: number };
    dates: { planned_finish?: string | null; forecast_finish?: string | null; variance_days: number };
    resources: { planned_count: number; actual_count: number };
  };
  milestones: PerformanceMilestone[];
}

const toneClasses: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

interface Props {
  /** Falls back to the SPA's currently active project, same convention as BoardPage. */
  projectId?: string;
}

function buildFallbackBriefing(detail: ProjectDetail, stats: any, t: (key: string, opts?: any) => string): BriefingResponse {
  const total = Number(stats?.issues ?? 0);
  const completed = Number(stats?.completed_issues ?? 0);
  const overdue = Number(stats?.overdue_issues ?? 0);
  const open = Number(stats?.open_issues ?? 0);
  const scoreBase = total > 0 ? Math.round((completed / total) * 100) : 0;
  const score = Math.max(0, Math.min(100, scoreBase - overdue * 10));
  const tone = score >= 75 && overdue === 0 ? "success" : score >= 45 ? "warning" : "danger";
  const toneLabel = tone === "success" ? t("projectOverview.toneOnTrack") : tone === "warning" ? t("projectOverview.toneNeedsAttention") : t("projectOverview.toneAtRisk");

  return {
    briefing: {
      headline: t("projectOverview.headline", { name: detail.name, status: detail.status || "active", tone: toneLabel }),
      health: {
        score,
        tone,
        label: tone === "success" ? t("projectOverview.healthOnTrack") : tone === "warning" ? t("projectOverview.healthNeedsAttention") : t("projectOverview.healthAtRisk"),
      },
      attention: open > 0 ? [
        {
          severity: overdue > 0 ? "high" : "medium",
          tone: overdue > 0 ? "danger" : "warning",
          icon: overdue > 0 ? "alert-triangle" : "circle-dot",
          title: overdue > 0 ? t("projectOverview.overdueWork") : t("projectOverview.openWork"),
          detail: overdue > 0
            ? t("projectOverview.overdueDetail", { count: overdue })
            : t("projectOverview.openDetail", { count: open }),
          count: overdue > 0 ? overdue : open,
          link: overdue > 0 ? "/issues" : "/board",
        },
      ] : [
        {
          severity: "low",
          tone: "success",
          icon: "check",
          title: t("projectOverview.milestonesTitle"),
          detail: t("projectOverview.milestonesDetail"),
          count: 0,
          link: "/roadmap",
        },
      ],
    },
    sprintForecast: {
      has_sprint: false,
      summary: t("projectOverview.noActiveSprintSummary"),
      sprints: [],
    },
  };
}

function ProjectOverviewPage({ projectId }: Props) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const canAdministerProject = hasRole("super-admin", "admin");
  const isSuperAdmin = hasRole("super-admin");
  const [termsDraft, setTermsDraft] = useState("");
  const [termsEditing, setTermsEditing] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const activeProjectId = getActiveProjectId();
  const id = projectId ?? activeProjectId ?? "";
  const issues = useStore((s) => s.issues);
  const fetchProjectData = useStore((s) => s.fetchProjectData);
  const setActiveProjectId = useProjectCatalogStore((s) => s.setActiveProjectId);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (id) {
      setActiveProjectId(String(id), false);
      void fetchProjectData(String(id));
    }
    setLoading(true);
    setError(null);

    if (!id) {
      setError(t("projectOverview.noActiveProject"));
      setLoading(false);
      return () => { cancelled = true; };
    }

    const detailPromise = api.get<ProjectDetail>(`/projects/${id}`).catch(() => null);
    const briefingPromise = api.get<BriefingResponse>(`/projects/${id}/briefing`).catch(() => null);
    const statsPromise = api.get<any>(`/projects/${id}/stats`).catch(() => null);
    const performancePromise = api.get<PerformanceResponse>(`/projects/${id}/performance`).catch(() => null);
    const clientsPromise = api.get<Client[]>("/clients").catch(() => []);

    Promise.all([detailPromise, briefingPromise, statsPromise, performancePromise, clientsPromise])
      .then(([d, b, s, perf, c]) => {
        if (cancelled) return;
        if (!d) {
          setError(t("projectOverview.projectNotFound"));
          return;
        }

        setDetail(d);
        setTermsDraft(d.contractual_terms ?? "");
        setClients(Array.isArray(c) ? c : []);
        setBriefing(b ?? buildFallbackBriefing(d, s, t));
        setStats(s);
        setPerformance(perf ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || t("projectOverview.loadFailed"));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, fetchProjectData, setActiveProjectId]);

  const total = stats?.issues ?? 0;
  const doneCount = stats?.completed_issues ?? 0;
  const inProgressCount = stats?.open_issues ?? 0;
  const overdueCount = stats?.overdue_issues ?? 0;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const statusCounts = lookups.statuses.map((s) => ({
    status: s,
    count: stats?.status_counts?.[s.id] ?? 0,
  }));
  const resolvedClient =
    detail?.client ?? clients.find((client) => String(client.id) === String(detail?.client_id ?? "")) ?? null;

  const epicProgress = lookups.epics.map((epic) => {
    const epicStat = stats?.epic_stats?.[epic.id] ?? { total: 0, done: 0 };
    return {
      epic,
      total: epicStat.total,
      done: epicStat.done,
      pct: epicStat.total > 0 ? Math.round((epicStat.done / epicStat.total) * 100) : 0
    };
  }).filter((e) => e.total > 0);

  const performanceSummary = performance?.summary;
  const performanceComparison = performance?.baseline_comparison;
  const healthTone = performanceSummary?.health.tone ?? "warning";
  const healthState = performanceSummary?.health.state ?? "Yellow";
  const blockedMilestone = performanceSummary?.blocking_milestone ?? null;
  const canonicalHealthScore = performanceSummary?.health.score ?? briefing?.briefing.health.score ?? 0;
  const canonicalHealthTone = performanceSummary ? healthTone : briefing?.briefing.health.tone ?? "warning";
  const canonicalHealthLabel = performanceSummary ? healthState : briefing?.briefing.health.label ?? "Needs attention";

  const hasPlanning = Boolean(
    performance &&
    ((performance.milestones && performance.milestones.length > 0) ||
     (performanceSummary && (performanceSummary.planned_hours > 0 || performanceSummary.planned_budget > 0)))
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div className="max-w-md rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-medium text-foreground">{error || t("projectOverview.notAvailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <PageHeader
          title={detail.name}
          subtitle={detail.description || t("projectOverview.noDescription")}
          badge={
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={detail.status === "active" ? "default" : "secondary"}>{detail.status}</Badge>
              <Badge variant="outline">{detail.key}</Badge>
              <Badge variant="outline">{detail.type?.toUpperCase()}</Badge>
              {detail.classification === "presale" && detail.presale_type && (
                <Badge variant="secondary">{detail.presale_type.toUpperCase()}</Badge>
              )}
            </div>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {canAdministerProject && <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <PencilLine className="h-4 w-4" /> {t("projectOverview.editProject")}
              </Link>}
              <Link to="/issues" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <CheckSquare2 className="h-4 w-4" /> {t("nav.issues", { defaultValue: "Issues" })}
              </Link>
              <Link to="/board" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <KanbanSquare className="h-4 w-4" /> {t("nav.board")}
              </Link>
              <Link to="/backlog" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <ListTodo className="h-4 w-4" /> {t("nav.backlog")}
              </Link>
              <Link to="/roadmap" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <MapIcon className="h-4 w-4" /> {t("nav.roadmap")}
              </Link>
              <Link to="/reports" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <BarChart3 className="h-4 w-4" /> {t("nav.reports")}
              </Link>
            </div>
          }
        />

        {!hasPlanning && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <Target className="mx-auto h-12 w-12 text-primary/60" />
            <h3 className="mt-3 text-lg font-semibold text-foreground">No Planning Exists</h3>
            <p className="mt-1 text-sm text-muted-foreground">This project has not been planned.</p>
            <div className="mt-5">
              <Link
                to={`/projects/${id}/plan`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" /> Start Planning
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {resolvedClient && <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {resolvedClient.company || resolvedClient.name}</span>}
          {detail.team && <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {detail.team.name}</span>}
          {detail.owner && <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {t("projectOverview.owner", { name: detail.owner.name })}</span>}
          {detail.start_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {detail.start_date} – {detail.end_date || t("projectOverview.ongoing")}
            </span>
          )}
          <span>{t("projectOverview.memberCount", { count: detail.members_count ?? detail.members?.length ?? 0 })}</span>
        </div>

        {performanceSummary?.blocked_project && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-destructive">🚨 {t("projectOverview.projectBlocked", { defaultValue: "Project Blocked" })}</p>
                <p className="text-sm text-muted-foreground">
                  {blockedMilestone?.name || t("projectOverview.blockingMilestone", { defaultValue: "Blocking milestone" })}: {performanceSummary?.blocking_reason || t("projectOverview.blockingReason", { defaultValue: "Blocking dependencies remain incomplete." })}
                </p>
              </div>
              <Link
                to="/plan-comparison"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("projectOverview.reviewDependencies", { defaultValue: "Review dependencies" })}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <PerformanceChip
            label={t("projectOverview.health", { defaultValue: "Health" })}
            value={`${performanceSummary?.health.score ?? 0}/100`}
            note={t("projectOverview.healthScore", { defaultValue: "Overall health score" })}
            tone={healthTone}
          />
          <PerformanceChip
            label={t("projectOverview.completion", { defaultValue: "Completion" })}
            value={`${performanceSummary?.completion_pct ?? 0}%`}
            note={t("projectOverview.issueCompletion", { defaultValue: "Issue completion" })}
            tone={performanceSummary?.completion_pct && performanceSummary.completion_pct >= 80 ? "success" : "warning"}
          />
          <PerformanceChip
            label={t("projectOverview.scheduleVariance", { defaultValue: "Schedule Variance" })}
            value={formatVarianceDays(performanceSummary?.schedule_variance_days ?? 0)}
            note={performanceSummary?.forecast_finish ? `${t("projectOverview.forecastFinish", { defaultValue: "Forecast" })}: ${formatShortDate(performanceSummary.forecast_finish)}` : t("projectOverview.noForecast", { defaultValue: "No forecast yet" })}
            tone={performanceSummary && performanceSummary.schedule_variance_days > 0 ? "danger" : "success"}
          />
          <PerformanceChip
            label={t("projectOverview.budgetVariance", { defaultValue: "Budget Variance" })}
            value={formatCurrencyDelta(performanceSummary?.budget_variance ?? 0)}
            note={performanceSummary ? `${formatCurrency(performanceSummary.actual_cost)} / ${formatCurrency(performanceSummary.planned_budget)}` : t("projectOverview.budgetPending", { defaultValue: "Budget data pending" })}
            tone={performanceSummary && performanceSummary.budget_variance > 0 ? "danger" : "success"}
          />
          <PerformanceChip
            label={t("projectOverview.blockedMilestones", { defaultValue: "Blocked Milestones" })}
            value={performanceSummary?.blocked_milestones ?? 0}
            note={t("projectOverview.dependencies", { defaultValue: "Dependency chain" })}
            tone={(performanceSummary?.blocked_milestones ?? 0) > 0 ? "danger" : "success"}
          />
          <PerformanceChip
            label={t("projectOverview.openRisks", { defaultValue: "Open Risks" })}
            value={performanceSummary?.open_risks ?? 0}
            note={t("projectOverview.riskExposure", { defaultValue: "Risk exposure" })}
            tone={(performanceSummary?.open_risks ?? 0) > 0 ? "warning" : "success"}
          />
          <PerformanceChip
            label={t("projectOverview.forecastFinish", { defaultValue: "Forecast Finish" })}
            value={performanceSummary?.forecast_finish ? formatShortDate(performanceSummary.forecast_finish) : "—"}
            note={performanceSummary?.days_late ? `${t("projectOverview.daysLate", { defaultValue: "Late" })}: +${performanceSummary.days_late}` : performanceSummary?.days_ahead ? `${t("projectOverview.daysAhead", { defaultValue: "Ahead" })}: ${performanceSummary.days_ahead}` : t("projectOverview.onTrack", { defaultValue: "On track" })}
            tone={performanceSummary?.days_late ? "danger" : "success"}
          />
          <PerformanceChip
            label={t("projectOverview.actualHours", { defaultValue: "Actual Hours" })}
            value={formatHours(performanceSummary?.actual_hours ?? 0)}
            note={performanceSummary ? `${t("projectOverview.remaining", { defaultValue: "Remaining" })}: ${formatHours(performanceSummary.remaining_hours)}` : t("projectOverview.executionPending", { defaultValue: "Execution pending" })}
            tone="warning"
          />
          <PerformanceChip
            label={t("projectOverview.plannedHours", { defaultValue: "Planned Hours" })}
            value={formatHours(performanceSummary?.planned_hours ?? 0)}
            note={performanceComparison ? `${t("projectOverview.hoursVariance", { defaultValue: "Variance" })}: ${formatHours(performanceComparison.planning.variance)}` : t("projectOverview.baselinePending", { defaultValue: "Baseline pending" })}
            tone="success"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ComparisonCard
            label={t("projectOverview.planningComparison", { defaultValue: "Planning" })}
            primaryLabel={t("projectOverview.plannedHours", { defaultValue: "Planned Hours" })}
            primaryValue={formatHours(performanceComparison?.planning.planned_hours ?? 0)}
            secondaryLabel={t("projectOverview.actualHours", { defaultValue: "Actual Hours" })}
            secondaryValue={formatHours(performanceComparison?.planning.actual_hours ?? 0)}
            tertiaryLabel={t("projectOverview.hoursVariance", { defaultValue: "Variance" })}
            tertiaryValue={formatHours(performanceComparison?.planning.variance ?? 0)}
          />
          <ComparisonCard
            label={t("projectOverview.budgetComparison", { defaultValue: "Budget" })}
            primaryLabel={t("projectOverview.planned", { defaultValue: "Planned" })}
            primaryValue={formatCurrency(performanceComparison?.budget.planned ?? 0)}
            secondaryLabel={t("projectOverview.actual", { defaultValue: "Actual" })}
            secondaryValue={formatCurrency(performanceComparison?.budget.actual ?? 0)}
            tertiaryLabel={t("projectOverview.variance", { defaultValue: "Variance" })}
            tertiaryValue={formatCurrencyDelta(performanceComparison?.budget.variance ?? 0)}
          />
          <ComparisonCard
            label={t("projectOverview.datesComparison", { defaultValue: "Dates" })}
            primaryLabel={t("projectOverview.plannedFinish", { defaultValue: "Planned Finish" })}
            primaryValue={performanceComparison?.dates.planned_finish ? formatShortDate(performanceComparison.dates.planned_finish) : "—"}
            secondaryLabel={t("projectOverview.forecastFinish", { defaultValue: "Forecast Finish" })}
            secondaryValue={performanceComparison?.dates.forecast_finish ? formatShortDate(performanceComparison.dates.forecast_finish) : "—"}
            tertiaryLabel={t("projectOverview.varianceDays", { defaultValue: "Variance" })}
            tertiaryValue={performanceComparison ? formatVarianceDays(performanceComparison.dates.variance_days) : "—"}
          />
        </div>

        {/* Contractual Terms — manual entry, super-admin only, never auto-generated */}
        {isSuperAdmin && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-foreground">{t("projectOverview.contractualTerms", { defaultValue: "Contractual Terms" })}</h2>
              {!termsEditing ? (
                <Button size="sm" variant="outline" onClick={() => setTermsEditing(true)}>
                  {t("app.edit", { defaultValue: "Edit" })}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={termsSaving} onClick={() => { setTermsDraft(detail?.contractual_terms ?? ""); setTermsEditing(false); }}>
                    {t("app.cancel", { defaultValue: "Cancel" })}
                  </Button>
                  <Button
                    size="sm"
                    disabled={termsSaving}
                    onClick={async () => {
                      setTermsSaving(true);
                      try {
                        await api.put(`/projects/${id}/contractual-terms`, { contractual_terms: termsDraft });
                        setDetail((prev) => (prev ? { ...prev, contractual_terms: termsDraft } : prev));
                        setTermsEditing(false);
                      } catch {
                        toast.error(t("projectOverview.contractualTermsSaveFailed", { defaultValue: "Failed to save contractual terms." }));
                      } finally {
                        setTermsSaving(false);
                      }
                    }}
                  >
                    {termsSaving ? t("app.saving", { defaultValue: "Saving…" }) : t("app.save", { defaultValue: "Save" })}
                  </Button>
                </div>
              )}
            </div>
            {termsEditing ? (
              <textarea
                value={termsDraft}
                onChange={(e) => setTermsDraft(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                placeholder={t("projectOverview.contractualTermsPlaceholder", { defaultValue: "Enter contract terms, SLAs, payment schedule…" })}
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {detail?.contractual_terms || t("projectOverview.contractualTermsEmpty", { defaultValue: "No contractual terms recorded yet." })}
              </p>
            )}
          </div>
        )}

        {/* AI Briefing */}
        {briefing && (
          <div className="rounded-xl border-l-4 border-primary border-y border-r border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> {t("projectOverview.aiBriefing")}
                </div>
                <h2 className="text-base font-semibold text-foreground">{briefing.briefing.headline}</h2>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[canonicalHealthTone])}>
                  {canonicalHealthLabel}
                </span>
                <div className="mt-1 text-xl font-extrabold text-foreground">
                  {canonicalHealthScore}<span className="text-sm font-normal text-muted-foreground">/100</span>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {briefing.briefing.attention.slice(0, 4).map((item, idx) => (
                item.link.startsWith("/") ? (
                  <Link key={idx} to={item.link} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                    <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", toneClasses[item.tone])}>{item.severity}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    {item.count > 0 && <Badge variant="outline">{item.count}</Badge>}
                  </Link>
                ) : (
                <a key={idx} href={item.link} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                  <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", toneClasses[item.tone])}>{item.severity}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  {item.count > 0 && <Badge variant="outline">{item.count}</Badge>}
                </a>
                )
              ))}
              {briefing.briefing.attention.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("projectOverview.allClear")}</p>
              )}
            </div>
            {briefing.sprintForecast.has_sprint && (
              <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-muted/50 px-2.5 py-2 text-sm">
                <Rocket className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-foreground">{briefing.sprintForecast.summary}</span>
              </div>
            )}
          </div>
        )}

        {/* Summary rail */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryChip label={t("projectOverview.totalIssues")} value={total} note={t("projectOverview.allWork")} />
          <SummaryChip label={t("analytics.completed")} value={doneCount} note={t("projectOverview.pctComplete", { pct })} />
          <SummaryChip label={t("analytics.inProgress")} value={inProgressCount} note={t("projectOverview.movingForward")} />
          <SummaryChip label={t("analytics.overdue")} value={overdueCount} note={t("projectOverview.needsAttention")} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Status breakdown */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><BarChart3 className="h-4 w-4" /> {t("projectOverview.statusBreakdown")}</h2>
            <div className="space-y-2">
              {statusCounts.map(({ status, count }) => (
                <div key={status.id} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: status.color }} />
                  <span className="w-28 shrink-0 truncate text-muted-foreground">{status.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, backgroundColor: status.color }} />
                  </div>
                  <span className="w-6 shrink-0 text-right font-medium text-foreground">{count}</span>
                </div>
              ))}
              {statusCounts.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("projectOverview.noStatuses", { defaultValue: "No statuses configured for this project." })}</p>
              )}
            </div>
          </div>

          {/* Project teams preview */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4" /> {t("projectOverview.teams", { defaultValue: "Teams" })}
              </h2>
              <Link
                to="/teams"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                {t("projectOverview.viewAllTeams", { defaultValue: "View All" })}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {(detail.teams ?? []).slice(0, 5).map((team) => (
                <Link
                  key={team.id}
                  to={`/resources?team_id=${team.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: team.color || "#3b82f6" }}
                    >
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{team.name}</p>
                      {team.description && (
                        <p className="truncate text-xs text-muted-foreground">{team.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {team.members_count ?? 0} {t("teams.members", { defaultValue: "Members" })}
                  </span>
                </Link>
              ))}
              {(detail.teams ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("projectOverview.noTeams", { defaultValue: "No teams are currently linked to this project." })}
                </p>
              )}
            </div>

            {/* External partners assigned to this project */}
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("projectOverview.externalPartners", { defaultValue: "External Partners" })}
                </h3>
                <Link
                  to="/workforce"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t("projectOverview.manageWorkforce", { defaultValue: "Manage workforce" })}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {(detail.partners ?? []).slice(0, 4).map((partner) => (
                  <div
                    key={partner.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                        style={{ backgroundColor: `${partner.color || "#F59E0B"}22`, color: partner.color || "#F59E0B" }}
                      >
                        {partner.name.slice(0, 2).toUpperCase()}
                      </span>
                      <p className="truncate text-sm font-medium text-foreground">{partner.name}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {partner.members_count ?? 0} {t("teams.members", { defaultValue: "Members" })}
                    </span>
                  </div>
                ))}
                {(detail.partners ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("projectOverview.noPartners", { defaultValue: "No external partners assigned." })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Team members */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4" /> {t("projectOverview.teamMembers", { count: detail.members?.length ?? 0 })}
              </h2>
              <Link
                to={`/resources?project_id=${detail.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                {t("resources.openDirectory", { defaultValue: "Open directory" })}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {(detail.members ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{m.name}</span>
                  <span className="text-xs capitalize text-muted-foreground">{m.pivot?.role?.replace(/_/g, " ")}</span>
                </div>
              ))}
              {(detail.members ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("projectOverview.noMembers")}</p>}
            </div>
          </div>

          {/* Epics */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Layers className="h-4 w-4" /> {t("projectOverview.epics")}</h2>
            <div className="space-y-2">
              {epicProgress.map(({ epic, done, total: epicTotal, pct: epicPct }) => (
                <div key={epic.id} className="rounded-lg bg-muted/40 p-2.5" style={{ borderInlineStart: `3px solid ${epic.color}` }}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium" style={{ color: epic.color }}>{epic.name}</span>
                    <span className="text-xs text-muted-foreground">{epicPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full" style={{ width: `${epicPct}%`, backgroundColor: epic.color }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("projectOverview.tasksDone", { done, total: epicTotal })}</div>
                </div>
              ))}
              {epicProgress.length === 0 && <p className="text-sm text-muted-foreground">{t("projectOverview.noEpics")}</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Sprints */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Rocket className="h-4 w-4" /> {t("projectOverview.sprints")}</h2>
            <div className="space-y-2">
              {lookups.sprints.slice(0, 5).map((sprint) => (
                <div key={sprint.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="truncate text-foreground">{sprint.name}</span>
                  <Badge variant={sprint.status === "active" ? "default" : "outline"}>{sprint.status}</Badge>
                </div>
              ))}
              {lookups.sprints.length === 0 && <p className="text-sm text-muted-foreground">{t("projectOverview.noSprints")}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function PerformanceChip({ label, value, note, tone }: { label: string; value: React.ReactNode; note: string; tone: "success" | "warning" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Badge variant={tone === "danger" ? "destructive" : tone === "warning" ? "secondary" : "default"}>{tone === "danger" ? "Red" : tone === "warning" ? "Yellow" : "Green"}</Badge>
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function ComparisonCard({
  label,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  tertiaryLabel,
  tertiaryValue,
}: {
  label: string;
  primaryLabel: string;
  primaryValue: React.ReactNode;
  secondaryLabel: string;
  secondaryValue: React.ReactNode;
  tertiaryLabel: string;
  tertiaryValue: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{primaryLabel}</span>
          <span className="font-medium text-foreground">{primaryValue}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{secondaryLabel}</span>
          <span className="font-medium text-foreground">{secondaryValue}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{tertiaryLabel}</span>
          <span className="font-medium text-foreground">{tertiaryValue}</span>
        </div>
      </div>
    </div>
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatVarianceDays(value: number) {
  if (!value) return "0d";
  return value > 0 ? `+${value}d` : `${value}d`;
}

function formatHours(value: number) {
  const rounded = Number(value ?? 0);
  return `${rounded.toFixed(1)}h`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function formatCurrencyDelta(value: number) {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
}

export default ProjectOverviewPage;
