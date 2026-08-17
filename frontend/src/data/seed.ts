
import type {
  User,
  IssueType,
  IssueStatus,
  Priority,
  Label,
  Epic,
  Sprint,
  Issue,
  Project,
  ProjectScope } from
"./types";

// Data is injected by the Laravel bootstrap (window.__DATA__); the literals
// below are the offline fallback used only when the API payload is absent.
const D: any = (typeof window !== "undefined" && (window as any).__DATA__) || {};

export const project: Project = D.project ?? {
  id: "p1",
  name: "MediaSci Platform",
  key: "MSCI",
  type: "scrum",
  category: "Software",
  classification: "project",
  presale_type: null,
  settings: {
    flowMode: "both",
    requireScopeSummary: false,
    requireAcceptanceCriteria: false,
    requireDueDate: false,
    enableAiAssignment: false,
    aiConfidenceThreshold: 75,
    visibility: "team"
  }
};

// All projects the user can switch between (from the bootstrap payload).
export interface ProjectSummary extends Project {status?: string;issueCount?: number;}
export const projects: ProjectSummary[] = D.projects ?? [project];

export const projectScope: ProjectScope = D.projectScope ?? {
  mode: "single",
  projectIds: [project.id],
  primaryProjectId: project.id,
  label: project.name,
  projectNames: [project.name]
};

export const users: User[] = Array.isArray(D.users) ? D.users : [];


export const currentUserId = D.user?.id ?? "";

export const issueTypes: IssueType[] = D.issueTypes ?? [
{ key: "epic", name: "Epic", color: "#8b5cf6" },
{ key: "story", name: "Story", color: "#22c55e" },
{ key: "task", name: "Task", color: "#3b82f6" },
{ key: "bug", name: "Bug", color: "#ef4444" },
{ key: "subtask", name: "Sub-task", color: "#0ea5e9" }];


export const statuses: IssueStatus[] = D.statuses ?? [
{ id: "s1", name: "Backlog", category: "todo", color: "#94a3b8", position: 0 },
{ id: "s2", name: "To Do", category: "todo", color: "#64748b", position: 1 },
{ id: "s3", name: "In Progress", category: "in_progress", color: "#3b82f6", position: 2 },
{ id: "s4", name: "In Review", category: "in_progress", color: "#f59e0b", position: 3 },
{ id: "s5", name: "Done", category: "done", color: "#22c55e", position: 4 }];



export const priorities: Priority[] = D.priorities ?? [
{ id: "pr1", name: "Highest", level: 1, color: "#dc2626" },
{ id: "pr2", name: "High", level: 2, color: "#f97316" },
{ id: "pr3", name: "Medium", level: 3, color: "#f59e0b" },
{ id: "pr4", name: "Low", level: 4, color: "#3b82f6" },
{ id: "pr5", name: "Lowest", level: 5, color: "#64748b" }];


export const labels: Label[] = D.labels ?? [
{ id: "l1", name: "frontend", color: "#3b82f6" },
{ id: "l2", name: "backend", color: "#8b5cf6" },
{ id: "l3", name: "design", color: "#ec4899" },
{ id: "l4", name: "infra", color: "#0ea5e9" },
{ id: "l5", name: "tech-debt", color: "#f59e0b" },
{ id: "l6", name: "customer", color: "#22c55e" }];


export const epics: Epic[] = D.epics ?? [
{ id: "e1", name: "Onboarding Revamp", color: "#8b5cf6" },
{ id: "e2", name: "Billing & Invoicing", color: "#0ea5e9" },
{ id: "e3", name: "Reporting Dashboard", color: "#22c55e" }];


export const sprints: Sprint[] = D.sprints ?? [
{
  id: "sp1",
  name: "Sprint 24",
  goal: "Ship the new onboarding flow and stabilize billing.",
  startDate: "2026-07-13",
  endDate: "2026-07-27",
  status: "active"
},
{
  id: "sp2",
  name: "Sprint 25",
  goal: "Reporting dashboard MVP.",
  status: "planning"
}];


const now = "2026-07-20T09:00:00Z";

export function normalizeIssue(issue: any): Issue {
  const rawType = String(issue.typeKey ?? issue.type_key ?? issue.type ?? issue.issue_type?.key ?? issue.issue_type?.name ?? "task").toLowerCase();
  const normalizedType = rawType === "feature" ? "story" : rawType === "sub-task" ? "subtask" : rawType;
  return {
    ...issue,
    id: String(issue.id),
    key: String(issue.key ?? issue.issue_key ?? `ISSUE-${issue.id}`),
    title: issue.title ?? issue.summary ?? "Untitled issue",
    projectId: String(issue.projectId ?? issue.project_id ?? project.id),
    statusId: String(issue.statusId ?? issue.status_id ?? issue.issue_status_id ?? ""),
    priorityId: String(issue.priorityId ?? issue.priority_id ?? issue.issue_priority_id ?? ""),
    typeKey: normalizedType as IssueTypeKey,
    assigneeId: issue.assigneeId ?? issue.assignee_id ? String(issue.assigneeId ?? issue.assignee_id) : undefined,
    externalAssigneeId: issue.externalAssigneeId ?? issue.external_assignee_id ? String(issue.externalAssigneeId ?? issue.external_assignee_id) : undefined,
    reporterId: String(issue.reporterId ?? issue.reporter_id ?? ""),
    sprintId: issue.sprintId ?? issue.sprint_id ? String(issue.sprintId ?? issue.sprint_id) : undefined,
    epicId: issue.epicId ?? issue.epic_id ? String(issue.epicId ?? issue.epic_id) : undefined,
    labelIds: Array.isArray(issue.labelIds) ? issue.labelIds.map(String) : Array.isArray(issue.label_ids) ? issue.label_ids.map(String) : [],
    storyPoints: issue.storyPoints ?? issue.story_points,
    dueDate: issue.dueDate ?? issue.due_date,
    startDate: issue.startDate ?? issue.start_date,
    workstream: issue.workstream ?? issue.custom_fields?.workstream,
    customFields: issue.customFields ?? issue.custom_fields,
    comments: Array.isArray(issue.comments) ? issue.comments : [],
    position: Number(issue.position ?? 0),
  };
}

function c(id: string, authorId: string, body: string, day: number): {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
} {
  return { id, authorId, body, createdAt: `2026-07-${day}T10:30:00Z` };
}

export const seedIssues: Issue[] = (D.issues || []).map(normalizeIssue);
