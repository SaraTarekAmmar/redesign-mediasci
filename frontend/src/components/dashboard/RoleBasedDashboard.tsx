import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import {
  FolderOpen,
  ClipboardList,
  UsersRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Hourglass,
  LayoutDashboard,
  DollarSign,
  ShieldAlert,
} from "lucide-react";

// ── Bootstrap data (loaded at boot time, no API calls needed) ───────

const D: any = (typeof window !== "undefined" && (window as any).__DATA__) || {};

// ── Dashboard widget types ─────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  color?: string;
}

function StatCard({ label, value, icon, change, color = "blue" }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {change && (
            <p className={`text-xs mt-1 ${change.startsWith("+") ? "text-green-600" : "text-red-600"}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard sections per role ────────────────────────────────────

function SuperAdminDashboard() {
  const { t } = useTranslation();
  const projects = D.projects ?? [];
  const issues = D.issues ?? [];

  const doneIds = (D.statuses ?? []).filter((s: any) => s.category === "done").map((s: any) => s.id);
  const openIssues = issues.filter((i: any) => !doneIds.includes(i.issue_status_id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("dashboard.platformOverview")}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("dashboard.totalProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.totalIssues")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} color="yellow" />
          <StatCard label={t("dashboard.teamMembers")} value={(D.users ?? []).length} icon={<UsersRound className="h-5 w-5" />} color="green" />
          <StatCard label={t("dashboard.openIssues")} value={openIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.systemHealth")}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.database")}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t("dashboard.healthy")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.apiResponse")}</span>
            <span className="text-xs text-foreground">&lt; 200ms</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.departments")}</span>
            <span className="text-xs text-foreground">{(D.departments ?? []).length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PMDashboard() {
  const { t } = useTranslation();
  const projects = D.projects ?? [];
  const issues = D.issues ?? [];
  const sprints = D.sprints ?? [];

  const doneIds = (D.statuses ?? []).filter((s: any) => s.category === "done").map((s: any) => s.id);
  const inProgressIds = (D.statuses ?? []).filter((s: any) => s.category === "in_progress").map((s: any) => s.id);
  const todoIds = (D.statuses ?? []).filter((s: any) => s.category === "todo").map((s: any) => s.id);

  const activeIssues = issues.filter((i: any) => !doneIds.includes(i.issue_status_id));
  const criticalIssues = issues.filter((i: any) => {
    const prio = D.priorities?.find((p: any) => p.id === i.priority_id);
    return prio?.name === "Critical" && !doneIds.includes(i.issue_status_id);
  });
  const completionRate = issues.length > 0
    ? Math.round((issues.filter((i: any) => doneIds.includes(i.issue_status_id)).length / issues.length) * 100)
    : 0;

  const activeSprint = sprints.find((s: any) => s.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("dashboard.myProjects")}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("dashboard.activeProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.activeIssues")} value={activeIssues.length} icon={<ClipboardList className="h-5 w-5" />} color="yellow" />
          <StatCard label={t("dashboard.criticalIssues")} value={criticalIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
          <StatCard label={t("dashboard.completionRate")} value={`${completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.sprintHealth")}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.activeSprint")}</span>
            <span className="text-sm font-medium text-foreground">{activeSprint?.name ?? t("dashboard.none")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.inProgress")}</span>
            <span className="text-sm font-medium text-foreground">{issues.filter((i: any) => inProgressIds.includes(i.issue_status_id)).length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.toDo")}</span>
            <span className="text-sm font-medium text-foreground">{issues.filter((i: any) => todoIds.includes(i.issue_status_id)).length}</span>
          </div>
        </div>
      </div>

      {criticalIssues.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.criticalIssues")}</h3>
          <div className="space-y-2">
            {criticalIssues.slice(0, 5).map((issue: any) => {
              const status = (D.statuses ?? []).find((s: any) => s.id === issue.issue_status_id);
              return (
                <div key={issue.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
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
    </div>
  );
}

function DeveloperDashboard() {
  const { t } = useTranslation();
  const issues = D.issues ?? [];
  const currentUser = D.user;

  const doneIds = (D.statuses ?? []).filter((s: any) => s.category === "done").map((s: any) => s.id);
  const inProgressIds = (D.statuses ?? []).filter((s: any) => s.category === "in_progress").map((s: any) => s.id);

  // For developers, show issues assigned to the current user (or all if no user-specific filtering)
  const myIssues = currentUser
    ? issues.filter((i: any) => String(i.assignee_id) === String(currentUser.id))
    : issues;

  const inProgress = myIssues.filter((i: any) => inProgressIds.includes(i.issue_status_id));
  const completed = myIssues.filter((i: any) => doneIds.includes(i.issue_status_id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("dashboard.myWork")}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("dashboard.assignedToMe")} value={myIssues.length} icon={<ClipboardList className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.inProgress")} value={inProgress.length} icon={<RefreshCw className="h-5 w-5" />} color="yellow" />
          <StatCard label={t("dashboard.completed")} value={completed.length} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label={t("dashboard.open")} value={myIssues.length - completed.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
        </div>
      </div>

      {inProgress.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.inProgress")}</h3>
          <div className="space-y-2">
            {inProgress.slice(0, 8).map((issue: any) => {
              const status = (D.statuses ?? []).find((s: any) => s.id === issue.issue_status_id);
              const assignee = (D.users ?? []).find((u: any) => String(u.id) === String(issue.assignee_id));
              return (
                <div key={issue.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{issue.title}</span>
                  <span className="text-xs text-muted-foreground font-mono">{issue.key}</span>
                  {assignee && (
                    <span className="text-xs text-muted-foreground">{assignee.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inProgress.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground py-4">{t("dashboard.noIssuesInProgress")}</p>
        </div>
      )}
    </div>
  );
}

function ViewerDashboard() {
  const { t } = useTranslation();
  const projects = D.projects ?? [];
  const issues = D.issues ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("dashboard.projectsOverview")}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("dashboard.projects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.totalIssues")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} color="yellow" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.recentActivity")}</h3>
        <p className="text-sm text-muted-foreground text-center py-4">
          {t("dashboard.viewOnlyAccess")}
        </p>
      </div>
    </div>
  );
}

// Cross-project health/utilization/cost summary. Read-only — no create/edit
// actions, matching the executive role's permission set (view-* only).
function ExecutiveDashboard() {
  const { t } = useTranslation();
  const projects = D.projects ?? [];
  const issues = D.issues ?? [];
  const risks = D.risks ?? [];
  const expenses = D.expenses ?? [];
  const resources = D.resources ?? [];

  const doneIds = (D.statuses ?? []).filter((s: any) => s.category === "done").map((s: any) => s.id);
  const completionRate = issues.length > 0
    ? Math.round((issues.filter((i: any) => doneIds.includes(i.issue_status_id)).length / issues.length) * 100)
    : 0;
  const openRisks = risks.filter((r: any) => r.status !== "closed");
  const totalSpend = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const activeResources = resources.filter((r: any) => r.isActive).length;

  const perProject = projects.map((p: any) => {
    const projectIssues = issues.filter((i: any) => i.projectId === p.id);
    const projectDone = projectIssues.filter((i: any) => doneIds.includes(i.statusId));
    return {
      id: p.id,
      name: p.name,
      issueCount: projectIssues.length,
      completion: projectIssues.length > 0 ? Math.round((projectDone.length / projectIssues.length) * 100) : 0,
      status: p.status ?? "active",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("dashboard.portfolioOverview")}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("dashboard.projects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} color="blue" />
          <StatCard label={t("dashboard.overallCompletion")} value={`${completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label={t("dashboard.openRisks")} value={openRisks.length} icon={<ShieldAlert className="h-5 w-5" />} color="red" />
          <StatCard label={t("dashboard.totalSpend")} value={`$${totalSpend.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} color="purple" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.projectHealth")}</h3>
        <div className="space-y-2">
          {perProject.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground">{t("dashboard.issueCount", { count: p.issueCount })}</span>
              <span className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <span className="block h-full bg-green-500" style={{ width: `${p.completion}%` }} />
              </span>
              <span className="text-xs text-muted-foreground w-9 text-right">{p.completion}%</span>
            </div>
          ))}
          {perProject.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("dashboard.noProjectsInScope")}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.resourceUtilization")}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.activeResources")}</span>
            <span className="text-sm font-medium text-foreground">{activeResources} / {resources.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("dashboard.departments")}</span>
            <span className="text-sm font-medium text-foreground">{(D.departments ?? []).length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard component ───────────────────────────────────────

export function RoleBasedDashboard() {
  const { t } = useTranslation();
  const {
    loading,
    isSuperAdmin,
    isAdmin,
    isPM,
    isTeamLeader,
    isDeveloper,
    isMember,
    isViewer,
    isExecutive,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isExecutive) return <ExecutiveDashboard />;
  if (isSuperAdmin || isAdmin) return <SuperAdminDashboard />;
  if (isPM || isTeamLeader) return <PMDashboard />;
  if (isDeveloper || isMember) return <DeveloperDashboard />;
  if (isViewer) return <ViewerDashboard />;

  return (
    <div className="text-center py-12 text-muted-foreground">
      {t("dashboard.unableToLoadUser")}
    </div>
  );
}
