import { create } from "zustand";
import { api, getActiveProjectId, setActiveProject as persistActiveProject, setProjectScope as persistProjectScope } from "../lib/api";

export interface ProjectCatalogItem {
  id: string | number;
  name: string;
  key: string;
  type?: string;
  classification?: string;
  presale_type?: string | null;
  status?: string;
  description?: string | null;
  issueCount?: number;
  client_request_id?: string | number | null;
  client_request?: { id: string | number; title: string } | null;
  team_id?: string | number | null;
  team?: { id: string | number; name: string } | null;
  owner_id?: string | number | null;
  owner?: { id: string | number; name: string } | null;
  client_id?: string | number | null;
  client?: { id: string | number; name: string; company?: string | null; status?: string } | null;
  settings?: Record<string, any> | null;
  color?: string | null;
}

type ProjectListResponse =
  | ProjectCatalogItem[]
  | { data?: ProjectCatalogItem[]; items?: ProjectCatalogItem[]; projects?: ProjectCatalogItem[] };

function parseProjects(payload: ProjectListResponse | null | undefined): ProjectCatalogItem[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? payload?.items ?? payload?.projects ?? [];
}

function resolveActiveProject(projects: ProjectCatalogItem[], activeProjectId: string | null) {
  const active = activeProjectId
    ? projects.find((project) => String(project.id) === String(activeProjectId))
    : null;
  return active ?? projects[0] ?? null;
}

function readStoredProjectScopeMode(): "single" | "multi" | "all" | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("projectScope");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.mode === "single" || parsed?.mode === "multi" || parsed?.mode === "all"
      ? parsed.mode
      : null;
  } catch {
    return null;
  }
}

interface ProjectCatalogState {
  projects: ProjectCatalogItem[];
  activeProjectId: string | null;
  activeProject: ProjectCatalogItem | null;
  projectScopeMode: "single" | "multi" | "all";
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  setProjectContext: (scope: { mode: "single" | "multi" | "all"; projectIds: string[]; primaryProjectId: string; label?: string; projectNames?: string[] }) => void;
  setActiveProjectId: (id: string | number, reload?: boolean) => void;
}

export const useProjectCatalogStore = create<ProjectCatalogState>((set, get) => ({
  projects: [],
  activeProjectId: getActiveProjectId(),
  activeProject: null,
  projectScopeMode: readStoredProjectScopeMode() ?? "single",
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const payload = await api.get<ProjectListResponse>("/projects");
      const projects = parseProjects(payload);
      const activeProjectId = getActiveProjectId();
      const activeProject = resolveActiveProject(projects, activeProjectId);
      const storedScopeMode = readStoredProjectScopeMode() ?? (activeProject ? "single" : "single");

      if (activeProject && !activeProjectId) {
        persistActiveProject(activeProject.id, false);
      }

      set({
        projects,
        activeProjectId: activeProject ? String(activeProject.id) : activeProjectId,
        activeProject,
        projectScopeMode: storedScopeMode,
        loading: false,
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || "Failed to load projects",
      });
    }
  },

  refreshProjects: async () => {
    await get().loadProjects();
  },

  setProjectContext: (scope) => {
    const current = get();
    const project =
      current.projects.find((item) => String(item.id) === String(scope.primaryProjectId)) ||
      current.activeProject ||
      current.projects[0] ||
      null;

    persistProjectScope(scope, false);
    set({
      activeProjectId: scope.primaryProjectId || current.activeProjectId,
      activeProject: project,
      projectScopeMode: scope.mode,
    });
  },

  setActiveProjectId: (id, reload = false) => {
    const value = String(id);
    const current = get();
    const activeProject = current.projects.find((project) => String(project.id) === value) ?? null;
    persistActiveProject(value, reload);
    set({
      activeProjectId: value,
      activeProject,
      projectScopeMode: "single",
    });
  },
}));
