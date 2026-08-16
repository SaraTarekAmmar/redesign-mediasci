import { useApi, useCachedApi } from "./useApi";

// ── Projects ───────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  tasks_count?: number;
}

export function useProjects() {
  return useApi<Project[]>("/projects");
}

export function useProject(id: string | null) {
  return useApi<Project>(id ? `/projects/${id}` : null);
}

// ── Issues ─────────────────────────────────────────────────────────

export interface Issue {
  id: string;
  key: string;
  title: string;
  description?: string;
  status: { id: string; name: string; category: string };
  priority?: string;
  assignee?: { id: string; name: string; avatar_url?: string };
  project_id: string;
  created_at: string;
  updated_at: string;
}

export function useIssues(projectId?: string) {
  const path = projectId ? `/projects/${projectId}/issues` : "/issues";
  return useApi<Issue[]>(path);
}

export function useIssue(projectId: string, issueId: string) {
  return useApi<Issue>(
    projectId && issueId ? `/projects/${projectId}/issues/${issueId}` : null
  );
}

// ── Teams ──────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  owner_id?: string;
  department_id?: string;
  members_count?: number;
  department?: { id: string; name: string } | null;
}

export function useTeams() {
  return useCachedApi<Team[]>("/teams");
}

export function useTeam(id: string | null) {
  return useApi<Team>(id ? `/teams/${id}` : null);
}

// ── Users ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
  job_title?: string;
  department_id?: string;
}

export function useUsers() {
  return useCachedApi<User[]>("/users");
}

// ── Departments ────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  type: string;
  description?: string;
  color?: string;
  team_leader_id?: string;
  members_count?: number;
}

export function useDepartments() {
  return useApi<Department[]>("/departments");
}

// ── Skills ─────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  category?: string;
}

export function useSkills() {
  return useApi<Skill[]>("/skills");
}

// ── Stakeholders ───────────────────────────────────────────────────

export interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  role: string;
  company?: string;
  type?: string;
  influence_level?: string;
  interest_level?: string;
  support_level?: string;
  status?: string;
}

export function useStakeholders() {
  return useApi<Stakeholder[]>("/ops/stakeholders");
}

// ── Risks ──────────────────────────────────────────────────────────

export interface Risk {
  id: string;
  title: string;
  description?: string;
  probability: number;
  impact: number;
  status: string;
  severity?: string;
  owner_id?: string;
  project_id?: string;
}

export function useRisks(projectId?: string) {
  const path = projectId ? `/ops/risks?project_id=${projectId}` : "/ops/risks";
  return useApi<Risk[]>(path);
}

// ── Resources ──────────────────────────────────────────────────────

export interface Resource {
  id: string;
  name: string;
  type: string;
  capacity?: number;
  cost_per_hour?: number;
  is_active?: boolean;
}

export function useResources() {
  return useApi<Resource[]>("/ops/resources");
}

// ── Reports / KPI Data ────────────────────────────────────────────

export interface KpiData {
  kpis: Record<string, number>;
  progress_chart: any[];
  status_donut: Record<string, number>;
  cr_trend: any;
  cost_variance: any[];
  risk_summary: Record<string, number>;
}

export function useKpiData(projectIds?: string[]) {
  const params = projectIds?.length ? `?project_ids=${projectIds.join(",")}` : "";
  return useApi<KpiData>(`/reports/kpi-data${params}`);
}

// ── Plans ──────────────────────────────────────────────────────────

export interface Plan {
  id: number;
  name: string;
  description?: string;
  status: string;
  ownerId: number;
  startDate?: string | null;
  endDate?: string | null;
  taskCount: number;
  createdAt?: string | null;
}

export interface PaginatedPlans {
  data: Plan[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from_record: number;
  to_record: number;
}

export function usePlans() {
  return useApi<PaginatedPlans>("/plans");
}
