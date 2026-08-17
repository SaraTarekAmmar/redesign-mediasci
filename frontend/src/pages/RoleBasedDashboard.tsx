import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Eye,
  FolderOpen,
  Hourglass,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Target,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { SectionCard } from "../components/common/SectionCard";
import { StatTile } from "../components/common/StatTile";
import { Progress } from "../components/ui/Progress";

const D: Record<string, any> = (typeof window !== "undefined" && (window as any).__DATA__) || {};

function rows(key: string): any[] {
  return Array.isArray(D[key]) ? D[key] : [];
}

function statusId(issue: any): string | number | undefined {
  return issue?.statusId ?? issue?.issue_status_id;
}

function projectId(issue: any): string | number | undefined {
  return issue?.projectId ?? issue?.project_id;
}

function isDone(issue: any, doneIds: Array<string | number>): boolean {
  return doneIds.map(String).includes(String(statusId(issue)));
}

function statusPill(status: any): string {
  const category = status?.category;
  if (category === "done") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (category === "in_progress") return "bg-primary/10 text-primary";
  if (category === "blocked") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function DashboardFrame({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6">
        <PageHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          badge={
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {t("dashboard.roleScoped", { defaultValue: "Role-based view" })}
            </span>
          }
        />
        {children}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "neutral",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "neutral" | "green" | "yellow" | "red";
}) {
  return <StatTile label={label} value={value} icon={icon} color={color} />;
}

function ProjectsSection({
  projects,
  issues,
  doneIds,
  title = "Projects",
  subtitle = "The projects you can access, with progress and next context in one place.",
}: {
  projects: any[];
  issues: any[];
  doneIds: Array<string | number>;
  title?: string;
  subtitle?: string;
}) {
  return (
    <SectionCard title={title} description={subtitle}>
      {projects.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => {
            const projectIssues = issues.filter((issue) => String(projectId(issue)) === String(project.id));
            const done = projectIssues.filter((issue) => isDone(issue, doneIds)).length;
            const pct = projectIssues.length ? Math.round((done / projectIssues.length) * 100) : 0;
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {(project.key || project.name || "PR").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{project.name}</p>
                      <span className="shrink-0 text-xs font-semibold text-foreground">{pct}%</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{project.key || "Project"} · {projectIssues.length} issue{projectIssues.length === 1 ? "" : "s"}</p>
                    <Progress value={pct} className="mt-3 h-1.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<FolderOpen className="h-8 w-8" />} title="No projects in your scope" subtitle="Projects assigned to your account will appear here." />
      )}
    </SectionCard>
  );
}

function ExternalProjectDashboard({ kind }: { kind: "partner" | "client" }) {
  const projects = rows("projects");
  const issues = rows("issues");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const openIssues = issues.filter((issue) => !isDone(issue, doneIds));
  const label = kind === "client" ? "Client project workspace" : "Partner project workspace";
  const subtitle = kind === "client"
    ? "Review the delivery, decisions, and work connected to your projects."
    : "Work on the projects and tasks your organization has been assigned."
  return (
    <DashboardFrame icon={<FolderOpen className="h-4 w-4" />} title={label} subtitle={subtitle}>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Projects" value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label="Open work" value={openIssues.length} icon={<ClipboardList className="h-5 w-5" />} color={openIssues.length > 0 ? "yellow" : "green"} />
        <StatCard label="Completed" value={issues.length - openIssues.length} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
      </section>
      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title="Your projects" subtitle="Everything visible to your account is scoped to these projects." />
      <SectionCard title="Work needing attention" description="Open tasks and project decisions that may need your response.">
        {openIssues.length > 0 ? (
          <div className="space-y-2">
            {openIssues.slice(0, 6).map((issue) => <Link key={issue.id} to="/issues" className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted"><span className="h-2 w-2 shrink-0 rounded-full bg-primary" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{issue.title}</span><span className="font-mono text-xs text-muted-foreground">{issue.key}</span></Link>)}
          </div>
        ) : <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />} title="Nothing needs attention" subtitle="Your project work is clear for now." />}
      </SectionCard>
    </DashboardFrame>
  );
}

function SuperAdminDashboard() {
  const { t } = useTranslation();
  const projects = rows("projects");
  const issues = rows("issues");
  const users = rows("users");
  const departments = rows("departments");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const openIssues = issues.filter((issue) => !isDone(issue, doneIds));

  return (
    <DashboardFrame
      icon={<Shield className="h-4 w-4" />}
      title={t("dashboard.platformOverview")}
      subtitle={t("summary.adminSubtitle")}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.totalProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label={t("dashboard.totalIssues")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("dashboard.teamMembers")} value={users.length} icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label={t("dashboard.openIssues")} value={openIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
      </section>

      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title={t("summary.projects", { defaultValue: "Projects" })} subtitle="Start with the projects your organization is running, then open the work that needs attention." />

      <SectionCard title={t("dashboard.systemHealth")}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("dashboard.database")}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">{t("dashboard.healthy")}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("dashboard.apiResponse")}</span>
            <span className="text-sm font-semibold text-foreground">&lt; 200ms</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("dashboard.departments")}</span>
            <span className="text-sm font-semibold text-foreground">{departments.length}</span>
          </div>
        </div>
      </SectionCard>
    </DashboardFrame>
  );
}

function PMDashboard() {
  const { t } = useTranslation();
  const projects = rows("projects");
  const issues = rows("issues");
  const sprints = rows("sprints");
  const priorities = rows("priorities");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const inProgressIds = statuses.filter((s) => s.category === "in_progress").map((s) => s.id);
  const todoIds = statuses.filter((s) => s.category === "todo").map((s) => s.id);
  const activeIssues = issues.filter((issue) => !isDone(issue, doneIds));
  const criticalIssues = issues.filter((issue) => {
    const priority = priorities.find((candidate) => String(candidate.id) === String(issue.priority_id ?? issue.priorityId));
    return priority?.name === "Critical" && !isDone(issue, doneIds);
  });
  const completedCount = issues.filter((issue) => isDone(issue, doneIds)).length;
  const completionRate = issues.length ? Math.round((completedCount / issues.length) * 100) : 0;
  const activeSprint = sprints.find((sprint) => sprint.status === "active");

  return (
    <DashboardFrame
      icon={<Target className="h-4 w-4" />}
      title={t("summary.projectOverview")}
      subtitle={t("summary.pmSubtitle")}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.activeProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label={t("dashboard.activeIssues")} value={activeIssues.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("dashboard.criticalIssues")} value={criticalIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
        <StatCard label={t("dashboard.completion")} value={`${completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
      </section>

      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title={t("summary.projects", { defaultValue: "Projects" })} subtitle="Your active delivery portfolio, with progress linked directly to project work." />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={t("summary.sprintHealth")}>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("summary.activeSprint")}</span><span className="text-sm font-semibold text-foreground">{activeSprint?.name ?? t("dashboard.none")}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("dashboard.inProgress")}</span><span className="text-sm font-semibold text-foreground">{issues.filter((issue) => inProgressIds.map(String).includes(String(statusId(issue)))).length}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("dashboard.toDo")}</span><span className="text-sm font-semibold text-foreground">{issues.filter((issue) => todoIds.map(String).includes(String(statusId(issue)))).length}</span></div>
            <Progress value={completionRate} className="h-2.5" />
          </div>
        </SectionCard>

        {criticalIssues.length > 0 ? (
          <SectionCard title={t("dashboard.criticalIssues")}>
            <div className="space-y-2">
              {criticalIssues.slice(0, 5).map((issue) => {
                const status = statuses.find((candidate) => String(candidate.id) === String(statusId(issue)));
                return (
                  <div key={issue.id} className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{issue.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                    {status && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusPill(status)}`}>{status.name}</span>}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ) : (
          <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />} title={t("dashboard.criticalIssues")} subtitle={t("dashboard.noCriticalIssues", { defaultValue: "No critical issues need attention." })} />
        )}
      </div>

      <SectionCard title={t("summary.pendingActions")}>
        <div className="grid gap-3 md:grid-cols-3">
          <Link to="/board" className="flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-accent/50"><LayoutDashboard className="h-5 w-5 text-primary" /><span className="text-sm font-medium text-foreground">{t("summary.openBoard")}</span></Link>
          <Link to="/reports" className="flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-accent/50"><BarChart3 className="h-5 w-5 text-primary" /><span className="text-sm font-medium text-foreground">{t("summary.reports")}</span></Link>
          <Link to="/team" className="flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-accent/50"><UsersRound className="h-5 w-5 text-primary" /><span className="text-sm font-medium text-foreground">{t("summary.team")}</span></Link>
        </div>
      </SectionCard>
    </DashboardFrame>
  );
}

function DeveloperDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const issues = rows("issues");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const inProgressIds = statuses.filter((s) => s.category === "in_progress").map((s) => s.id);
  const myIssues = user ? issues.filter((issue) => String(issue.assignee_id ?? issue.assigneeId) === String(user.id)) : issues;
  const inProgress = myIssues.filter((issue) => inProgressIds.map(String).includes(String(statusId(issue))));
  const completed = myIssues.filter((issue) => isDone(issue, doneIds));

  return (
    <DashboardFrame icon={<RefreshCw className="h-4 w-4" />} title={t("summary.myWork")} subtitle={t("summary.devSubtitle")}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("summary.assignedToMe")} value={myIssues.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("dashboard.inProgress")} value={inProgress.length} icon={<RefreshCw className="h-5 w-5" />} />
        <StatCard label={t("dashboard.completed")} value={completed.length} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        <StatCard label={t("summary.open")} value={myIssues.length - completed.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
      </section>

      {inProgress.length > 0 ? (
        <SectionCard title={t("dashboard.inProgress")}>
          <div className="space-y-2">
            {inProgress.slice(0, 8).map((issue) => (
              <div key={issue.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{issue.title}</span>
                <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : (
        <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />} title={t("dashboard.noIssuesInProgress")} subtitle={t("summary.noInProgress", { defaultValue: "Your active work queue is clear." })} />
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/board" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><LayoutDashboard className="h-4 w-4" /> {t("summary.openBoard")}</Link>
        <Link to="/backlog" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/70"><ClipboardList className="h-4 w-4" /> {t("summary.backlog")}</Link>
      </div>
    </DashboardFrame>
  );
}

function ViewerDashboard() {
  const { t } = useTranslation();
  const projects = rows("projects");
  const issues = rows("issues");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const completed = issues.filter((issue) => isDone(issue, doneIds)).length;

  return (
    <DashboardFrame icon={<Eye className="h-4 w-4" />} title={t("summary.overview")} subtitle={t("summary.viewerSubtitle")}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.totalProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label={t("summary.totalTasks")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("dashboard.completed")} value={completed} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        <StatCard label={t("summary.remaining")} value={issues.length - completed} icon={<Hourglass className="h-5 w-5" />} />
      </section>

      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title={t("summary.projects", { defaultValue: "Projects" })} subtitle="Open a project to review progress, work, and delivery context." />
    </DashboardFrame>
  );
}

function ExecutiveDashboard() {
  const { t } = useTranslation();
  const projects = rows("projects");
  const issues = rows("issues");
  const risks = rows("risks");
  const expenses = rows("expenses");
  const resources = rows("resources");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const completed = issues.filter((issue) => isDone(issue, doneIds)).length;
  const completionRate = issues.length ? Math.round((completed / issues.length) * 100) : 0;
  const openRisks = risks.filter((risk) => risk.status !== "closed");
  const totalSpend = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const activeResources = resources.filter((resource) => resource.isActive ?? resource.is_active ?? true).length;
  const perProject = projects.map((project) => {
    const projectIssues = issues.filter((issue) => String(projectId(issue)) === String(project.id));
    const done = projectIssues.filter((issue) => isDone(issue, doneIds)).length;
    return { ...project, issueCount: projectIssues.length, completion: projectIssues.length ? Math.round((done / projectIssues.length) * 100) : 0 };
  });

  return (
    <DashboardFrame icon={<BarChart3 className="h-4 w-4" />} title={t("dashboard.portfolioOverview")} subtitle={t("summary.adminSubtitle")}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.projects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label={t("dashboard.overallCompletion")} value={`${completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
        <StatCard label={t("dashboard.openRisks")} value={openRisks.length} icon={<ShieldAlert className="h-5 w-5" />} color="red" />
        <StatCard label={t("dashboard.totalSpend")} value={`$${totalSpend.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <SectionCard title={t("dashboard.projectHealth")}>
          {perProject.length > 0 ? (
            <div className="space-y-2">
              {perProject.map((project) => (
                <div key={project.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{project.name}</span>
                  <span className="text-xs text-muted-foreground">{t("dashboard.issueCount", { count: project.issueCount })}</span>
                  <div className="w-24"><Progress value={project.completion} className="h-1.5" /></div>
                  <span className="w-9 text-right text-xs font-semibold text-foreground">{project.completion}%</span>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={<FolderOpen className="h-8 w-8" />} title={t("dashboard.noProjectsInScope")} />}
        </SectionCard>

        <SectionCard title={t("dashboard.resourceUtilization")}>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("dashboard.activeResources")}</span><span className="text-sm font-semibold text-foreground">{activeResources} / {resources.length}</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("dashboard.departments")}</span><span className="text-sm font-semibold text-foreground">{rows("departments").length}</span></div>
          </div>
        </SectionCard>
      </div>
    </DashboardFrame>
  );
}

export function RoleBasedDashboard() {
  const { t } = useTranslation();
  const { loading, isSuperAdmin, isAdmin, isPM, isTeamLeader, isDeveloper, isMember, isViewer, isExecutive, isPartner, isClient, isAccountManager, isDepartmentManager, isHrManager, isReviewer } = useAuth();

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }
  if (isExecutive) return <ExecutiveDashboard />;
  if (isSuperAdmin || isAdmin) return <SuperAdminDashboard />;
  if (isPM || isTeamLeader) return <PMDashboard />;
  if (isDeveloper || isMember) return <DeveloperDashboard />;
  if (isPartner) return <ExternalProjectDashboard kind="partner" />;
  if (isClient) return <ExternalProjectDashboard kind="client" />;
  if (isViewer || isAccountManager || isDepartmentManager || isHrManager || isReviewer) return <ViewerDashboard />;
  return <EmptyState icon={<AlertCircle className="h-8 w-8" />} title={t("dashboard.unableToLoadUser")} />;
}

export default RoleBasedDashboard;
