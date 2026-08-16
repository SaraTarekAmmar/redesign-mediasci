import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Shield,
  User,
  Eye,
  Target,
  Building2,
  Settings,
  UserPlus,
  KanbanSquare,
  ListTodo,
  Clock3,
  BarChart3,
  Users,
  FolderOpen,
  ClipboardList,
  UsersRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Hourglass,
  X,
} from "lucide-react";
import { useStore, lookups } from "../store/useStore";
import { PriorityIcon } from "../components/common/PriorityIcon";
import { IssueTypeIcon } from "../components/common/IssueTypeIcon";
import { Progress } from "../components/ui/Progress";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useAuth } from "../hooks/useAuth";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import { api } from "../lib/api";

// ── Shared components ─────────────────────────────────────────────

function StatCard({
  label, value, icon, color = "blue", delay = ""
}: {
  label: string; value: string | number; icon: React.ReactNode; color?: string; delay?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-200 dark:border-blue-800" },
    green:  { bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
    yellow: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
    red:    { bg: "bg-red-50 dark:bg-red-900/20",     text: "text-red-600 dark:text-red-400",     border: "border-red-200 dark:border-red-800" },
    purple: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  };
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className={`card-hover animate-slide-up ${delay} group rounded-xl border border-border bg-card p-5 relative overflow-hidden`}>
      {/* colored left accent */}
      <span className={`absolute start-0 top-3 bottom-3 w-[3px] rounded-full ${c.text.replace("text-", "bg-")} opacity-70`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
          {icon}
        </div>
       
      </div>
    </div>
  );
}

const D: any = (typeof window !== "undefined" && (window as any).__DATA__) || {};
const projects = Array.isArray(D.projects) ? D.projects : [];

// ── Main entry: branch by role ────────────────────────────────────

function SummaryPage() {
  const { i18n, t } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const { isAdmin, isPM, isTeamLeader, isDeveloper } = useAuth();

  if (isAdmin) {
    return <AdminLayout isRTL={isRTL} />;
  }
  if (isPM || isTeamLeader) {
    return <PMLayout isRTL={isRTL} />;
  }
  if (isDeveloper) {
    return <DeveloperLayout isRTL={isRTL} />;
  }
  return <ViewerLayout isRTL={isRTL} />;
}

// ── Admin / Super-Admin ───────────────────────────────────────────

function AdminLayout({ isRTL }: { isRTL: boolean }) {
  const { t } = useTranslation();
  const users = Array.isArray(D.users) ? D.users : [];
  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const departments = Array.isArray(D.departments) ? D.departments : [];
  const issues = Array.isArray(D.issues) ? D.issues : [];
  const statuses = Array.isArray(D.statuses) ? D.statuses : [];
  const doneIds = statuses.filter((s: any) => s && s.category === "done").map((s: any) => s.id);
  const openIssues = issues.filter((i: any) => i && !doneIds.includes(i.statusId ?? i.issue_status_id));

  useEffect(() => {
    let cancelled = false;
    setTeamsLoading(true);
    api.get<any[] | { data?: any[] }>("/teams")
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : res?.data ?? [];
        setTeams(rows);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {t("dashboard.platformOverview")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("summary.adminSubtitle")}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard delay="anim-delay-50"  label={t("dashboard.totalProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard delay="anim-delay-100" label={t("dashboard.totalIssues")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} color="yellow" />
          <StatCard delay="anim-delay-150" label={t("dashboard.teamMembers")} value={users.length} icon={<UsersRound className="h-5 w-5" />} color="green" />
          <StatCard delay="anim-delay-200" label={t("dashboard.openIssues")} value={openIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t("dashboard.systemHealth")}</h2>
            <div className="space-y-3">
              {[
                { label: t("dashboard.database"), status: t("dashboard.healthy"), color: "green" },
                { label: t("dashboard.apiResponse"), status: "< 200ms", color: "green" },
                { label: t("dashboard.departments"), status: `${departments.length}`, color: "blue" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.color === "green" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">{t("summary.teams")}</h2>
              <Link
                to="/teams"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/70"
              >
                {t("summary.viewAllTeams", { defaultValue: "View All" })}
              </Link>
            </div>
            <div className="space-y-2">
              {teamsLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("summary.loadingTeams", { defaultValue: "Loading teams…" })}</p>
              )}
              {!teamsLoading && teams.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("summary.noTeams")}</p>
              )}
              {!teamsLoading && teams.slice(0, 5).map((tm: any) => (
                <Link
                  key={tm.id}
                  to={`/resources?team_id=${tm.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: tm.color || "#6366f1" }}
                  >
                    {tm.name?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{tm.name}</p>
                    <p className="text-xs text-muted-foreground">{tm.members_count ?? 0} {t("summary.members")}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/users" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/70">
            <UserPlus className="h-4 w-4" /> {t("summary.manageUsers")}
          </Link>
          <Link to="/departments" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/70">
            <Building2 className="h-4 w-4" /> {t("dashboard.departments")}
          </Link>
          <Link to="/settings" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/70">
            <Settings className="h-4 w-4" /> {t("summary.settings")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── PM / Team Leader ──────────────────────────────────────────────

function PMLayout({ isRTL }: { isRTL: boolean }) {
  const { t } = useTranslation();
  const issues = D.issues ?? [];
  const statuses = D.statuses ?? [];
  const priorities = D.priorities ?? [];
  const sprints = D.sprints ?? [];
  const users = D.users ?? [];

  const doneIds = statuses.filter((s: any) => s.category === "done").map((s: any) => s.id);
  const inProgressIds = statuses.filter((s: any) => s.category === "in_progress").map((s: any) => s.id);

  const activeSprint = sprints.find((s: any) => s.status === "active");
  const completionRate = issues.length > 0
    ? Math.round((issues.filter((i: any) => doneIds.includes(i.issue_status_id)).length / issues.length) * 100)
    : 0;
  const criticalIssues = issues.filter((i: any) => {
    const p = priorities.find((pr: any) => pr.id === i.priority_id);
    return p?.name === "Critical" && !doneIds.includes(i.issue_status_id);
  });

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Target className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {t("summary.projectOverview")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("summary.pmSubtitle")}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("dashboard.activeProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.activeIssues")} value={issues.filter((i: any) => !doneIds.includes(i.issue_status_id)).length} icon={<ClipboardList className="h-5 w-5" />} color="yellow" />
          <StatCard label={t("dashboard.criticalIssues")} value={criticalIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
          <StatCard label={t("dashboard.completion")} value={`${completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t("summary.sprintHealth")}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("summary.activeSprint")}</span>
                <span className="text-sm font-medium text-foreground">{activeSprint?.name ?? t("dashboard.none")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.inProgress")}</span>
                <span className="text-sm font-medium text-foreground">{issues.filter((i: any) => inProgressIds.includes(i.issue_status_id)).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.completed")}</span>
                <span className="text-sm font-medium text-foreground">{issues.filter((i: any) => doneIds.includes(i.issue_status_id)).length}</span>
              </div>
              <Progress value={completionRate} className="h-2.5" />
            </div>
          </div>

          {criticalIssues.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-foreground">{t("dashboard.criticalIssues")}</h2>
              <div className="space-y-2">
                {criticalIssues.slice(0, 5).map((issue: any) => {
                  const status = statuses.find((s: any) => s.id === issue.issue_status_id);
                  return (
                    <div key={issue.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
                      <PriorityIcon priorityId={issue.priority_id} className="h-4 w-4" />
                      <span className="text-sm text-foreground truncate flex-1">{issue.title}</span>
                      <span className="text-xs text-muted-foreground font-mono">{issue.key}</span>
                      {status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: status.color + "18", color: status.color }}>
                          {status.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t("summary.pendingActions")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/board" className="flex items-center gap-3 rounded-xl border border-border/50 p-4 hover:bg-muted/50">
              <KanbanSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("summary.openBoard")}</p>
                <p className="text-xs text-muted-foreground">{issues.filter((i: any) => !doneIds.includes(i.issue_status_id)).length} {t("summary.openIssues")}</p>
              </div>
            </Link>
            <Link to="/reports" className="flex items-center gap-3 rounded-xl border border-border/50 p-4 hover:bg-muted/50">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("summary.reports")}</p>
                <p className="text-xs text-muted-foreground">{t("summary.analyticsMetrics")}</p>
              </div>
            </Link>
            <Link to="/team" className="flex items-center gap-3 rounded-xl border border-border/50 p-4 hover:bg-muted/50">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("summary.team")}</p>
                <p className="text-xs text-muted-foreground">{users.length} {t("summary.members")}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Developer ─────────────────────────────────────────────────────

function DeveloperLayout({ isRTL }: { isRTL: boolean }) {
  const { t } = useTranslation();
  const issues = D.issues ?? [];
  const statuses = D.statuses ?? [];
  const { user } = useAuth();

  const doneIds = statuses.filter((s: any) => s.category === "done").map((s: any) => s.id);
  const inProgressIds = statuses.filter((s: any) => s.category === "in_progress").map((s: any) => s.id);

  const myIssues = user
    ? issues.filter((i: any) => String(i.assignee_id) === String(user.id))
    : issues;
  const inProgress = myIssues.filter((i: any) => inProgressIds.includes(i.issue_status_id));
  const completed = myIssues.filter((i: any) => doneIds.includes(i.issue_status_id));
  const open = myIssues.filter((i: any) => !doneIds.includes(i.issue_status_id));

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <User className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {t("summary.myWork")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("summary.devSubtitle")}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("summary.assignedToMe")} value={myIssues.length} icon={<ClipboardList className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.inProgress")} value={inProgress.length} icon={<RefreshCw className="h-5 w-5" />} color="yellow" />
          <StatCard label={t("dashboard.completed")} value={completed.length} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label={t("summary.open")} value={open.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
        </section>

        {inProgress.length > 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{t("dashboard.inProgress")}</h2>
            <div className="space-y-2">
              {inProgress.map((issue: any) => (
                <div key={issue.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
                  <IssueTypeIcon typeKey={issue.type?.name} className="h-4 w-4" />
                  <span className="text-sm text-foreground truncate flex-1">{issue.title}</span>
                  <span className="text-xs text-muted-foreground font-mono">{issue.key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inProgress.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("summary.noInProgress")}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link to="/board" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <KanbanSquare className="h-4 w-4" /> {t("summary.openBoard")}
          </Link>
          <Link to="/backlog" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/70">
            <ListTodo className="h-4 w-4" /> {t("summary.backlog")}
          </Link>
          <Link to="/time-logs" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/70">
            <Clock3 className="h-4 w-4" /> {t("summary.timeLogs")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Viewer ────────────────────────────────────────────────────────

function ViewerLayout({ isRTL }: { isRTL: boolean }) {
  const { t } = useTranslation();
  const issues = D.issues ?? [];
  const statuses = D.statuses ?? [];
  const doneIds = statuses.filter((s: any) => s.category === "done").map((s: any) => s.id);

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <header className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Eye className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {t("summary.overview")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("summary.viewerSubtitle")}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("dashboard.totalProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard label={t("summary.totalTasks")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} color="yellow" />
          <StatCard label={t("dashboard.completed")} value={issues.filter((i: any) => doneIds.includes(i.issue_status_id)).length} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label={t("summary.remaining")} value={issues.filter((i: any) => !doneIds.includes(i.issue_status_id)).length} icon={<Hourglass className="h-5 w-5" />} color="purple" />
        </section>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">{t("summary.projects")}</h2>
          <div className="space-y-2">
            {projects.map((p: any) => {
              const projectIssues = issues.filter((i: any) => String(i.project_id) === String(p.id));
              const done = projectIssues.filter((i: any) => doneIds.includes(i.issue_status_id)).length;
              const pct = projectIssues.length > 0 ? Math.round((done / projectIssues.length) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-chart-1 text-xs font-bold text-white">
                    {p.key?.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.key} · {projectIssues.length} {t("summary.issues")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{pct}%</p>
                    <Progress value={pct} className="h-1.5 w-16" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("summary.viewerFullAccess")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SummaryPage;
