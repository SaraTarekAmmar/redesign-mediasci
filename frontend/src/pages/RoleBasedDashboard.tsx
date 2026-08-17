import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  CalendarClock,
  Gauge,
  ListChecks,
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
            const open = projectIssues.length - done;
            const overdue = projectIssues.filter((issue) => issueIsOverdue(issue, rows("statuses"))).length;
            const pct = projectIssues.length ? Math.round((done / projectIssues.length) * 100) : 0;
            const health = overdue > 0 ? { label: "At risk", className: "bg-destructive/10 text-destructive" } : open === 0 ? { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" } : { label: "In motion", className: "bg-primary/10 text-primary" };
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
                    <Progress value={pct} className="mt-3 h-1.5" aria-label={`${project.name} progress ${pct}%`} />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${health.className}`}>{health.label}</span>
                      <span className="text-[11px] text-muted-foreground">{open} open · {overdue} overdue</span>
                    </div>
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

function issueField(issue: any, ...keys: string[]): any {
  for (const key of keys) {
    if (issue?.[key] !== undefined && issue?.[key] !== null && issue?.[key] !== "") return issue[key];
  }
  return undefined;
}

function issueStatus(issue: any, statuses: any[]) {
  const id = issueField(issue, "statusId", "status_id", "issueStatusId", "issue_status_id");
  return statuses.find((status) => String(status.id) === String(id));
}

function issuePriority(issue: any, priorities: any[]) {
  const id = issueField(issue, "priorityId", "priority_id", "issuePriorityId", "issue_priority_id");
  return priorities.find((priority) => String(priority.id) === String(id));
}

function issueDueDate(issue: any): string | undefined {
  const value = issueField(issue, "dueDate", "due_date");
  return value ? String(value) : undefined;
}

function issueIsOverdue(issue: any, statuses: any[], now = Date.now()): boolean {
  const due = issueDueDate(issue);
  return Boolean(due && new Date(due).getTime() < now && !isDone(issue, statuses.filter((status) => status.category === "done").map((status) => status.id)));
}

function dueLabel(value?: string): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Due date set";
  return `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function WorkQueueSection({
  issues,
  statuses,
  priorities,
  title = "Needs attention",
}: {
  issues: any[];
  statuses: any[];
  priorities: any[];
  title?: string;
}) {
  const doneIds = statuses.filter((status) => status.category === "done").map((status) => status.id);
  const openIssues = issues
    .filter((issue) => !isDone(issue, doneIds))
    .sort((a, b) => {
      const aPriority = Number(issuePriority(a, priorities)?.level ?? 99);
      const bPriority = Number(issuePriority(b, priorities)?.level ?? 99);
      const aOverdue = issueIsOverdue(a, statuses) ? 0 : 1;
      const bOverdue = issueIsOverdue(b, statuses) ? 0 : 1;
      return aOverdue - bOverdue || aPriority - bPriority;
    })
    .slice(0, 6);

  return (
    <SectionCard
      title={title}
      description="The work most likely to slow delivery, with a direct route to resolve it."
      action={<Link to="/issues" className="text-xs font-semibold text-primary hover:underline">View all</Link>}
    >
      {openIssues.length > 0 ? (
        <div className="space-y-2">
          {openIssues.map((issue) => {
            const status = issueStatus(issue, statuses);
            const priority = issuePriority(issue, priorities);
            const overdue = issueIsOverdue(issue, statuses);
            const reason = overdue ? "Overdue" : status?.category === "blocked" ? "Blocked" : priority?.name || status?.name || "Open";
            const reasonClass = overdue || status?.category === "blocked" ? "bg-destructive/10 text-destructive" : priority?.level <= 2 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground";
            return (
              <Link key={issue.id} to="/issues" className="group flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={reason === "Overdue" || reason === "Blocked" ? "h-2 w-2 shrink-0 rounded-full bg-destructive" : "h-2 w-2 shrink-0 rounded-full bg-primary"} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{issue.title || issue.name || "Untitled work"}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{issue.key || "Task"} · {dueLabel(issueDueDate(issue))}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${reasonClass}`}>{reason}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />} title="Nothing needs attention" subtitle="The visible work queue is clear right now." />
      )}
    </SectionCard>
  );
}

function PlanningPulse({ issues, statuses, sprints }: { issues: any[]; statuses: any[]; sprints: any[] }) {
  const doneIds = statuses.filter((status) => status.category === "done").map((status) => status.id);
  const inProgressIds = statuses.filter((status) => status.category === "in_progress").map((status) => status.id);
  const activeSprint = sprints.find((sprint) => sprint.status === "active");
  const sprintIssues = activeSprint ? issues.filter((issue) => String(issueField(issue, "sprintId", "sprint_id")) === String(activeSprint.id)) : [];
  const done = sprintIssues.filter((issue) => isDone(issue, doneIds)).length;
  const inProgress = sprintIssues.filter((issue) => inProgressIds.map(String).includes(String(statusId(issue)))).length;
  const remaining = sprintIssues.length - done;
  const completion = sprintIssues.length ? Math.round((done / sprintIssues.length) * 100) : 0;

  return (
    <SectionCard
      title="Planning pulse"
      description="A compact view of the active sprint and the work still to move."
      action={<Link to="/sprints" className="text-xs font-semibold text-primary hover:underline">Open sprints</Link>}
    >
      <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active sprint</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{activeSprint?.name || "No active sprint"}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{activeSprint?.goal || "Start a sprint to create a shared delivery focus."}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-lg font-semibold text-foreground">{inProgress}</p><p className="text-[10px] text-muted-foreground">In progress</p></div>
        <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-lg font-semibold text-foreground">{remaining}</p><p className="text-[10px] text-muted-foreground">Remaining</p></div>
        <div className="rounded-lg bg-primary/10 px-2 py-2"><p className="text-lg font-semibold text-primary">{completion}%</p><p className="text-[10px] text-muted-foreground">Complete</p></div>
      </div>
      <Progress value={completion} className="mt-4 h-2" />
    </SectionCard>
  );
}

function DeliverySnapshot({ issues, statuses, title = "Delivery snapshot" }: { issues: any[]; statuses: any[]; title?: string }) {
  const doneIds = statuses.filter((status) => status.category === "done").map((status) => status.id);
  const todo = issues.filter((issue) => issueStatus(issue, statuses)?.category === "todo").length;
  const inProgress = issues.filter((issue) => issueStatus(issue, statuses)?.category === "in_progress").length;
  const done = issues.filter((issue) => isDone(issue, doneIds)).length;
  const unassigned = issues.filter((issue) => !issueField(issue, "assigneeId", "assignee_id", "externalAssigneeId", "external_assignee_id")).length;
  const overdue = issues.filter((issue) => issueIsOverdue(issue, statuses)).length;
  const total = issues.length || 1;
  const buckets = [
    { label: "To do", count: todo, className: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40" },
    { label: "In progress", count: inProgress, className: "bg-primary/10 text-primary", bar: "bg-primary" },
    { label: "Done", count: done, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
  ];
  return (
    <SectionCard title={title} description="Understand where work is accumulating before opening a detailed report." action={<Link to="/reports" className="text-xs font-semibold text-primary hover:underline">Open reports</Link>}>
      <div className="grid gap-3 md:grid-cols-3">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-xl border border-border/70 bg-background p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{bucket.label}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${bucket.className}`}>{bucket.count}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${bucket.bar}`} style={{ width: `${Math.min(100, Math.round((bucket.count / total) * 100))}%` }} /></div>
            <p className="mt-2 text-[11px] text-muted-foreground">{Math.round((bucket.count / total) * 100)}% of visible work</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link to="/issues" className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5 hover:bg-accent/30"><span className="text-xs text-muted-foreground">Unassigned work</span><span className={unassigned > 0 ? "text-sm font-semibold text-amber-700 dark:text-amber-300" : "text-sm font-semibold text-foreground"}>{unassigned}</span></Link>
        <Link to="/issues" className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5 hover:bg-accent/30"><span className="text-xs text-muted-foreground">Overdue work</span><span className={overdue > 0 ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-foreground"}>{overdue}</span></Link>
      </div>
    </SectionCard>
  );
}

function QuickActions({ actions }: { actions: Array<{ to: string; label: string; detail: string; icon: React.ReactNode }> }) {
  return (
    <SectionCard title="Quick access" description="Jump straight into the next place you are likely to work.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <Link key={action.to} to={action.to} className="group flex items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><span aria-hidden="true">{action.icon}</span></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-foreground group-hover:text-primary">{action.label}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{action.detail}</span></span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

function ExternalProjectDashboard({ kind }: { kind: "partner" | "client" }) {
  const projects = rows("projects");
  const issues = rows("issues");
  const priorities = rows("priorities");
  const sprints = rows("sprints");
  const statuses = rows("statuses");
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);
  const openIssues = issues.filter((issue) => !isDone(issue, doneIds));
  const label = kind === "client" ? "Client project workspace" : "Partner project workspace";
  const subtitle = kind === "client"
    ? "Review the delivery, decisions, and work connected to your projects."
    : "Work on the projects and tasks your organization has been assigned."
  return (
    <DashboardFrame icon={<FolderOpen className="h-4 w-4" />} title={label} subtitle={subtitle}>
      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title="Your projects" subtitle="Everything visible to your account is scoped to these projects." />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Projects" value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label="Open work" value={openIssues.length} icon={<ClipboardList className="h-5 w-5" />} color={openIssues.length > 0 ? "yellow" : "green"} />
        <StatCard label="Completed" value={issues.length - openIssues.length} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkQueueSection issues={issues} statuses={statuses} priorities={priorities} title="Work needing attention" />
        <PlanningPulse issues={issues} statuses={statuses} sprints={sprints} />
      </div>
      <DeliverySnapshot issues={issues} statuses={statuses} title="Delivery snapshot" />
      <QuickActions actions={[
        { to: "/issues", label: "Project work", detail: "Review tasks and add project comments.", icon: <ListChecks className="h-4 w-4" /> },
        { to: "/board", label: "Open board", detail: "See the delivery flow for your projects.", icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: "/documents", label: "Project documents", detail: "Find the files and decisions shared with you.", icon: <FolderOpen className="h-4 w-4" /> },
        { to: "/projects", label: "All projects", detail: "Switch between the projects in your scope.", icon: <ArrowUpRight className="h-4 w-4" /> },
      ]} />
    </DashboardFrame>
  );
}

function SuperAdminDashboard() {
  const { t } = useTranslation();
  const projects = rows("projects");
  const issues = rows("issues");
  const priorities = rows("priorities");
  const sprints = rows("sprints");
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
      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title={t("dashboard.projectsSection", { defaultValue: "Projects & Work" })} subtitle="Start with the projects your organization is running, then open the work that needs attention." />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.totalProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label={t("dashboard.totalIssues")} value={issues.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("dashboard.teamMembers")} value={users.length} icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label={t("dashboard.openIssues")} value={openIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkQueueSection issues={issues} statuses={statuses} priorities={priorities} title="Platform attention" />
        <PlanningPulse issues={issues} statuses={statuses} sprints={sprints} />
      </div>
      <DeliverySnapshot issues={issues} statuses={statuses} title="Platform delivery snapshot" />
      <QuickActions actions={[
        { to: "/projects", label: "All projects", detail: "Review portfolio status and ownership.", icon: <FolderOpen className="h-4 w-4" /> },
        { to: "/issues", label: "Issue triage", detail: "Resolve blockers and high-priority work.", icon: <ListChecks className="h-4 w-4" /> },
        { to: "/reports", label: "Reports", detail: "Share delivery and performance context.", icon: <BarChart3 className="h-4 w-4" /> },
        { to: "/administration", label: "Administration", detail: "Manage users, teams, and platform settings.", icon: <Shield className="h-4 w-4" /> },
      ]} />

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
  const activeIssues = issues.filter((issue) => !isDone(issue, doneIds));
  const criticalIssues = issues.filter((issue) => {
    const priority = priorities.find((candidate) => String(candidate.id) === String(issue.priority_id ?? issue.priorityId));
    return priority?.name === "Critical" && !isDone(issue, doneIds);
  });
  const completedCount = issues.filter((issue) => isDone(issue, doneIds)).length;
  const completionRate = issues.length ? Math.round((completedCount / issues.length) * 100) : 0;

  return (
    <DashboardFrame
      icon={<Target className="h-4 w-4" />}
      title={t("summary.projectOverview")}
      subtitle={t("summary.pmSubtitle")}
    >
      <ProjectsSection projects={projects} issues={issues} doneIds={doneIds} title={t("dashboard.projectsSection", { defaultValue: "Projects & Work" })} subtitle="Your active delivery portfolio, with progress linked directly to project work." />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.activeProjects")} value={projects.length} icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard label={t("dashboard.activeIssues")} value={activeIssues.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("dashboard.criticalIssues")} value={criticalIssues.length} icon={<AlertCircle className="h-5 w-5" />} color="red" />
        <StatCard label={t("dashboard.completion")} value={`${completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkQueueSection issues={issues} statuses={statuses} priorities={priorities} title="Delivery attention" />
        <PlanningPulse issues={issues} statuses={statuses} sprints={sprints} />
      </div>
      <DeliverySnapshot issues={issues} statuses={statuses} title="Delivery snapshot" />

      <QuickActions actions={[
        { to: "/board", label: "Open board", detail: "Move work across delivery stages.", icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: "/reports", label: "Reports", detail: "Review delivery trends and outcomes.", icon: <BarChart3 className="h-4 w-4" /> },
        { to: "/teams", label: "Team capacity", detail: "Check people, skills, and allocation.", icon: <UsersRound className="h-4 w-4" /> },
        { to: "/scope", label: "Project scope", detail: "Keep commitments and decisions visible.", icon: <Gauge className="h-4 w-4" /> },
      ]} />
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
