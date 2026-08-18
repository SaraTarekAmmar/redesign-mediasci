// Domain types modeled on the mediasci-operation-hub schema (Jira/ClickUp style issue tracker).

export type StatusCategory = "todo" | "in_progress" | "done";

export type IssueTypeKey = "story" | "task" | "bug" | "epic" | "subtask";
export type ProjectScopeMode = "single" | "multi" | "all";

export interface User {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  role: string;
}

export interface IssueType {
  key: IssueTypeKey;
  name: string;
  color: string;
}

export interface IssueStatus {
  id: string;
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
}

export interface Priority {
  id: string;
  name: string;
  level: number; // 1 = highest
  color: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Epic {
  id: string;
  name: string;
  color: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status: "planning" | "active" | "completed";
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  key: string; // MSCI-101
  title: string;
  description?: string;
  projectId?: string;
  typeKey: IssueTypeKey;
  statusId: string;
  priorityId: string;
  assigneeId?: string;
  /** External workforce assignee (partner member id); distinct from internal assigneeId. */
  externalAssigneeId?: string;
  reporterId: string;
  reportedTo?: string[];
  epicId?: string;
  sprintId?: string; // undefined => backlog
  labelIds: string[];
  storyPoints?: number;
  dueDate?: string;
  workstream?: "presale" | "postsale";
  customFields?: Record<string, string | number | boolean | null>;
  position: number;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
  /** Real declared TaskDependency rows where this issue is the owner (issue_id). */
  dependencies?: { type: "blocks" | "is_blocked_by" | "relates_to" | "duplicates"; dependsOnId: string }[];
}

export interface Project {
  id: string;
  name: string;
  key: string;
  type: "scrum" | "kanban";
  category: string;
  classification?: "project" | "presale";
  presale_type?: "poc" | "demo" | "rfp" | "rfq" | "rop" | null;
  description?: string;
  settings?: ProjectSettings;
  client_id?: string;
  client?: ClientSummary | null;
  client_request_id?: string | null;
}

export interface ClientSummary {
  id: string;
  name: string;
  company?: string | null;
  status?: "active" | "inactive";
}

export interface ProjectSettings {
  flowMode?: "presale" | "postsale" | "both";
  requireScopeSummary?: boolean;
  requireAcceptanceCriteria?: boolean;
  requireDueDate?: boolean;
  enableAiAssignment?: boolean;
  aiConfidenceThreshold?: number;
  visibility?: "team" | "managers" | "admins";
}

export interface ProjectScope {
  mode: ProjectScopeMode;
  projectIds: string[];
  primaryProjectId: string;
  label?: string;
  projectNames?: string[];
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  industry?: string;
  website?: string;
  status: "active" | "inactive";
  projectsCount?: number;
  contacts: ClientContact[];
  createdAt?: string;
  created_at: string;
}

export interface ClientRequest {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  type: "presentation" | "poc" | "demo" | "rfp";
  status: "pending" | "review" | "accepted" | "rejected";
  estimated_hours?: number;
  estimated_cost?: number;
  due_date?: string;
  client?: Client;
  created_at: string;
}

export interface ProposalVersion {
  id: string;
  proposal_id: string;
  version_number: number;
  content?: string;
  estimated_hours?: number;
  estimated_cost?: number;
  file_path?: string;
  creator?: { id: string; name: string };
  created_at: string;
}

export interface Proposal {
  id: string;
  client_request_id: string;
  project_id?: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "declined";
  request?: ClientRequest;
  versions: ProposalVersion[];
  created_at: string;
}

export interface ValidationRule {
  id: string;
  project_id?: string;
  name: string;
  description?: string;
  rule_type: "file_presence" | "status_check" | "resource_availability" | "custom";
  parameters?: Record<string, any>;
  is_active: boolean;
  results?: ValidationResult[];
}

export interface ValidationResult {
  id: string;
  validation_rule_id: string;
  status: "passed" | "failed" | "warning";
  message?: string;
  verifier?: { id: string; name: string };
  created_at: string;
}

