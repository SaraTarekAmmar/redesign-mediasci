
import { create } from "zustand";
import type { Issue, IssueTypeKey, Comment } from "../data/types";
import {
  seedIssues,
  statuses,
  priorities,
  labels,
  epics,
  sprints,
  issueTypes,
  normalizeIssue,
} from
"../data/seed";
import { api, getActiveProjectId, setActiveProject } from "../lib/api";

const bootstrapData = typeof window !== "undefined" ? (window as any).__DATA__ || {} : {};
const bootstrapUsers = Array.isArray(bootstrapData.users) ? bootstrapData.users : [];
const bootstrapPartnerMembers = Array.isArray(bootstrapData.partnerMembers) ? bootstrapData.partnerMembers : [];
const currentUserId = String(bootstrapData.user?.id ?? "");

const mapNameToKey = (name: string): string => {
  const n = name.toLowerCase();
  if (n === "bug") return "bug";
  if (n === "task") return "task";
  if (n === "story" || n === "feature") return "story";
  if (n === "epic") return "epic";
  if (n === "sub-task" || n === "subtask") return "subtask";
  return n;
};

const PID = getActiveProjectId() || "";
const typeIdByKey: Record<string, string> = Object.fromEntries(
  (issueTypes as any[]).filter((t) => t.id).map((t) => [t.key, String(t.id)])
);

// Fire-and-forget persistence: the optimistic store update already ran; if the
// API write fails we log it rather than blocking the UI. ponytail: reads are the
// source of truth on next boot, so a lost write self-corrects on refresh.
function persist(p: Promise<unknown>) {
  p.catch((e) => console.error("[persist]", e));
}

export interface Filters {
  search: string;
  assigneeIds: string[];
  typeKeys: IssueTypeKey[];
  labelIds: string[];
  epicIds: string[];
  workstream: "presale" | "postsale" | "";
}

const emptyFilters: Filters = {
  search: "",
  assigneeIds: [],
  typeKeys: [],
  labelIds: [],
  epicIds: [],
  workstream: ""
};

let nextIssueNum = 113;

// A member of the project's derived workforce (internal team member or
// external partner member). Task assignees must come from this pool.
export interface WorkforceEntry {
  type: "internal" | "external";
  id: string; // user_id for internal, partner_member_id for external
  name: string;
  title?: string;
  source?: string; // team name(s) for internal, partner name for external
}

export interface NewIssueInput {
  title: string;
  description?: string;
  projectId?: string;
  typeKey: IssueTypeKey;
  statusId: string;
  priorityId: string;
  assigneeId?: string;
  externalAssigneeId?: string;
  epicId?: string;
  sprintId?: string;
  labelIds: string[];
  storyPoints?: number;
  dueDate?: string;
  workstream?: "presale" | "postsale";
  customFields?: Record<string, string | number | boolean | null>;
  reportedTo?: string[];
}

interface StoreState {
  issues: Issue[];
  filters: Filters;
  activeSprintId: string;
  selectedIssueId: string | null;

  // selectors as helpers
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleArrayFilter: (
  key: "assigneeIds" | "typeKeys" | "labelIds" | "epicIds",
  value: string)
  => void;
  clearFilters: () => void;
  activeFilterCount: () => number;

  setSelectedIssue: (id: string | null) => void;
  setComments: (issueId: string, comments: Comment[]) => void;

  moveIssue: (issueId: string, toStatusId: string, toIndex: number) => void;
  updateIssue: (issueId: string, patch: Partial<Issue>) => void;
  createIssue: (input: NewIssueInput) => Issue;
  deleteIssue: (issueId: string) => Promise<void>;
  addComment: (issueId: string, body: string) => void;
  moveToSprint: (issueId: string, sprintId: string | undefined) => void;
  isLoading: boolean;
  fetchProjectData: (projectId: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  issues: seedIssues,
  filters: emptyFilters,
  activeSprintId:
    (sprints.find((s) => s.status === "active") ?? sprints[0])?.id ?? "",
  selectedIssueId: null,
  isLoading: false,

  fetchProjectData: async (projectId) => {
    set({ isLoading: true });
    try {
      let targetProjectId = projectId;
      if (isNaN(Number(projectId))) {
        const projs = await api.get<any[]>("/projects");
        const list = Array.isArray(projs) ? projs : projs?.data ?? projs?.projects ?? [];
        if (list && list.length > 0) {
          targetProjectId = String(list[0].id);
          setActiveProject(targetProjectId, false);
        }
      }

      const [
        issuesData,
        statusesData,
        prioritiesData,
        issueTypesData,
        labelsData,
        sprintsData,
        epicsData,
        usersData,
        workforceData,
      ] = await Promise.all([
        api.get(`/projects/${targetProjectId}/issues`),
        api.get(`/projects/${targetProjectId}/statuses`),
        api.get(`/projects/${targetProjectId}/priorities`),
        api.get(`/projects/${targetProjectId}/types`),
        api.get(`/projects/${targetProjectId}/labels`),
        api.get(`/projects/${targetProjectId}/sprints`),
        api.get(`/projects/${targetProjectId}/epics`),
        api.get(`/users`),
        api.get(`/projects/${targetProjectId}/workforce`),
      ]);

      const getArray = (res: any) => Array.isArray(res) ? res : res?.data ?? [];
      
      const parsedIssues = getArray(issuesData).map((issue: any) => normalizeIssue(issue));
      const parsedStatuses = getArray(statusesData);
      const parsedPriorities = getArray(prioritiesData);
      const parsedTypes = getArray(issueTypesData).map((t: any) => ({
        ...t,
        key: t.key || mapNameToKey(t.name)
      }));
      const parsedLabels = getArray(labelsData);
      const parsedSprints = getArray(sprintsData);
      const parsedEpics = getArray(epicsData);
      const parsedUsers = getArray(usersData);

      const parsedWorkforce: WorkforceEntry[] = [
        ...(Array.isArray(workforceData?.internal) ? workforceData.internal : []).map((e: any) => ({
          type: "internal" as const,
          id: String(e.user_id),
          name: e.name,
          title: e.title || undefined,
          source: Array.isArray(e.teams) && e.teams.length
            ? e.teams.map((t: any) => t.name).join(", ")
            : undefined,
        })),
        ...(Array.isArray(workforceData?.external) ? workforceData.external : []).map((e: any) => ({
          type: "external" as const,
          id: String(e.member_id),
          name: e.name,
          title: e.title || undefined,
          source: [e.partner?.name, ...(Array.isArray(e.teams) ? e.teams.map((team: any) => team.name) : [])]
            .filter(Boolean)
            .join(" / ") || undefined,
        })),
      ];
      lookups.workforce.splice(0, lookups.workforce.length, ...parsedWorkforce);

      lookups.statuses.splice(0, lookups.statuses.length, ...parsedStatuses);
      lookups.priorities.splice(0, lookups.priorities.length, ...parsedPriorities);
      lookups.users.splice(0, lookups.users.length, ...parsedUsers);
      lookups.labels.splice(0, lookups.labels.length, ...parsedLabels);
      lookups.epics.splice(0, lookups.epics.length, ...parsedEpics);
      lookups.sprints.splice(0, lookups.sprints.length, ...parsedSprints);
      lookups.issueTypes.splice(0, lookups.issueTypes.length, ...parsedTypes);

      // Keep lookup entries from every project in the active multi-project scope.
      // Clearing this map on each concurrent fetch made status pills disappear
      // for projects whose response arrived before the last fetch completed.
      Object.assign(lookups.statusById, Object.fromEntries(parsedStatuses.map((s) => [s.id, s])));
      Object.assign(lookups.priorityById, Object.fromEntries(parsedPriorities.map((p) => [p.id, p])));

      Object.keys(lookups.userById).forEach((k) => delete lookups.userById[k]);
      Object.assign(lookups.userById, Object.fromEntries(parsedUsers.map((u) => [u.id, u])));

      Object.keys(lookups.labelById).forEach((k) => delete lookups.labelById[k]);
      Object.assign(lookups.labelById, Object.fromEntries(parsedLabels.map((l) => [l.id, l])));

      Object.keys(lookups.epicById).forEach((k) => delete lookups.epicById[k]);
      Object.assign(lookups.epicById, Object.fromEntries(parsedEpics.map((e) => [e.id, e])));

      Object.keys(lookups.sprintById).forEach((k) => delete lookups.sprintById[k]);
      Object.assign(lookups.sprintById, Object.fromEntries(parsedSprints.map((s) => [s.id, s])));

      Object.keys(lookups.typeByKey).forEach((k) => delete lookups.typeByKey[k]);
      Object.assign(lookups.typeByKey, Object.fromEntries(parsedTypes.map((t) => [t.key, t])));

      Object.keys(typeIdByKey).forEach((k) => delete typeIdByKey[k]);
      Object.assign(typeIdByKey, Object.fromEntries(parsedTypes.filter((t: any) => t.id).map((t: any) => [t.key, String(t.id)])));

      const activeSprint = parsedSprints.find((s: any) => s.status === "active") ?? parsedSprints[0];
      const otherProjectIssues = get().issues.filter(
        (i) => String(i.projectId) !== String(targetProjectId)
      );

      set({
        issues: [...otherProjectIssues, ...parsedIssues],
        activeSprintId: activeSprint?.id ?? "",
        isLoading: false,
      });
    } catch (e) {
      console.error("Failed to fetch project data:", e);
      set({ isLoading: false });
    }
  },

  setFilter: (key, value) =>
  set((s) => ({ filters: { ...s.filters, [key]: value } })),

  toggleArrayFilter: (key, value) =>
  set((s) => {
    const arr = s.filters[key] as string[];
    const next = arr.includes(value) ?
    arr.filter((v) => v !== value) :
    [...arr, value];
    return { filters: { ...s.filters, [key]: next } };
  }),

  clearFilters: () => set({ filters: emptyFilters }),

  activeFilterCount: () => {
    const f = get().filters;
    return (
      f.assigneeIds.length +
      f.typeKeys.length +
      f.labelIds.length +
      f.epicIds.length +
      (f.workstream ? 1 : 0) + (
      f.search.trim() ? 1 : 0));

  },

  setSelectedIssue: (id) => set({ selectedIssueId: id }),

  // Local-only (no persist): used to hydrate comments fetched from the API.
  setComments: (issueId, comments) =>
  set((s) => ({
    issues: s.issues.map((i) => i.id === issueId ? { ...i, comments } : i)
  })),

  moveIssue: (issueId, toStatusId, toIndex) =>
  set((s) => {
    const issues = [...s.issues];
    const moving = issues.find((i) => i.id === issueId);
    if (!moving) return {};
    const scopeProjectId = moving.projectId ?? PID;

    // Reindex the source column (excluding moving issue).
    const changed = moving.statusId !== toStatusId;
    const updated = { ...moving, statusId: toStatusId, updatedAt: new Date().toISOString() };

    const others = issues.filter((i) => i.id !== issueId);
    const targetCol = others.
    filter((i) => i.projectId === scopeProjectId && i.statusId === toStatusId && i.sprintId === moving.sprintId).
    sort((a, b) => a.position - b.position);

    targetCol.splice(Math.max(0, Math.min(toIndex, targetCol.length)), 0, updated);
    const reindexedTarget = targetCol.map((i, idx) => ({ ...i, position: idx }));

    const rest = others.filter(
      (i) => !(i.projectId === scopeProjectId && i.statusId === toStatusId && i.sprintId === moving.sprintId)
    );

    // reindex the source column too if it changed
    let reindexedSrc = [];
    if (changed) {
      const src = rest.
      filter((i) => i.projectId === scopeProjectId && i.statusId === moving.statusId && i.sprintId === moving.sprintId).
      sort((a, b) => a.position - b.position);
      reindexedSrc = src.map((i, idx) => ({ ...i, position: idx }));
    }

    // Persist the new order + status of the target column.
    persist(
      api.post(`/projects/${scopeProjectId}/issues/reorder`, {
        positions: reindexedTarget.map((i) => ({
          id: i.id,
          position: i.position,
          status_id: i.statusId
        }))
      })
    );

    return { issues: [...rest, ...reindexedTarget, ...(changed ? reindexedSrc : [])] };
  }),

  updateIssue: (issueId, patch) => {
    set((s) => ({
      issues: s.issues.map((i) =>
      i.id === issueId ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i
      )
    }));
    const map: Record<string, any> = {};
    if ("title" in patch) map.title = patch.title;
    if ("description" in patch) map.description = patch.description;
    if ("statusId" in patch) map.issue_status_id = patch.statusId;
    if ("priorityId" in patch) map.issue_priority_id = patch.priorityId;
    if ("assigneeId" in patch) map.assignee_id = patch.assigneeId ?? null;
    if ("externalAssigneeId" in patch) map.external_assignee_id = patch.externalAssigneeId ?? null;
    if ("epicId" in patch) map.epic_id = patch.epicId ?? null;
    if ("reportedTo" in patch) map.reported_to = patch.reportedTo ?? [];
    if ("sprintId" in patch) map.sprint_id = patch.sprintId ?? null;
    if ("storyPoints" in patch) map.story_points = patch.storyPoints ?? null;
    if ("dueDate" in patch) map.due_date = patch.dueDate ?? null;
    if ("workstream" in patch) map.custom_fields = { ...(get().issues.find((i) => i.id === issueId)?.customFields ?? {}), workstream: patch.workstream ?? null };
    if ("labelIds" in patch) map.label_ids = patch.labelIds;
    if ("typeKey" in patch && typeIdByKey[patch.typeKey as string])
      map.issue_type_id = typeIdByKey[patch.typeKey as string];
    if (Object.keys(map).length) persist(api.put(`/issues/${issueId}`, map));
  },

  createIssue: (input) => {
    const num = nextIssueNum++;
    const issueProjectId = input.projectId ?? PID;
    const colIssues = get().issues.filter(
      (i) => (i.projectId ?? PID) === issueProjectId && i.statusId === input.statusId && i.sprintId === input.sprintId
    );
    const issue: Issue = {
      id: `i-${num}`,
      key: `MSCI-${num}`,
      title: input.title,
      description: input.description,
      projectId: issueProjectId,
      typeKey: input.typeKey,
      statusId: input.statusId,
      priorityId: input.priorityId,
      assigneeId: input.assigneeId,
      externalAssigneeId: input.externalAssigneeId,
      reporterId: currentUserId,
      reportedTo: input.reportedTo ?? [],
      epicId: input.epicId,
      sprintId: input.sprintId,
      labelIds: input.labelIds,
      storyPoints: input.storyPoints,
      dueDate: input.dueDate,
      workstream: input.workstream,
      position: colIssues.length,
      customFields: {
        ...(input.customFields ?? {}),
        ...(input.workstream ? { workstream: input.workstream } : {})
      },
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    set((s) => ({ issues: [...s.issues, issue] }));

    const typeId = typeIdByKey[input.typeKey];
    if (typeId) {
      persist(
        api.post(`/projects/${issueProjectId}/issues`, {
          title: input.title,
          description: input.description ?? null,
          issue_type_id: typeId ? Number(typeId) : null,
          issue_status_id: input.statusId ? Number(input.statusId) : null,
          issue_priority_id: input.priorityId ? Number(input.priorityId) : null,
          assignee_id: input.assigneeId ? Number(input.assigneeId) : null,
          external_assignee_id: input.externalAssigneeId ? Number(input.externalAssigneeId) : null,
          reported_to: input.reportedTo ?? [],
          epic_id: input.epicId ? Number(input.epicId) : null,
          sprint_id: input.sprintId ? Number(input.sprintId) : null,
          story_points: input.storyPoints ?? null,
          due_date: input.dueDate ?? null,
          label_ids: (input.labelIds || []).map(Number),
          custom_fields: {
            ...(input.customFields ?? {}),
            ...(input.workstream ? { workstream: input.workstream } : {})
          },
          project_id: Number(issueProjectId)
        }).then((created: any) => {
          if (!created?.id) return;
          set((s) => ({
            issues: s.issues.map((i) =>
            i.id === issue.id ?
            { ...i, id: String(created.id), key: created.key ?? i.key, dueDate: created.due_date ?? i.dueDate, customFields: created.custom_fields ?? i.customFields } :
            i
            )
          }));
        })
      );
    }
    return issue;
  },

  deleteIssue: async (issueId) => {
    const isTemp = issueId.startsWith("i-");
    if (!isTemp) {
      await api.del(`/issues/${issueId}`);
    }
    set((s) => ({
      issues: s.issues.filter((i) => i.id !== issueId),
      selectedIssueId: s.selectedIssueId === issueId ? null : s.selectedIssueId,
    }));
  },

  addComment: (issueId, body) => {
    persist(api.post(`/issues/${issueId}/comments`, { body }));
    set((s) => ({
    issues: s.issues.map((i) =>
    i.id === issueId ?
    {
      ...i,
      comments: [
      ...i.comments,
      {
        id: `c-${Date.now()}`,
        authorId: currentUserId,
        body,
        createdAt: new Date().toISOString()
      }],

      updatedAt: new Date().toISOString()
    } :
    i
    )
  }));
  },

  moveToSprint: (issueId, sprintId) => {
    persist(api.put(`/issues/${issueId}`, { sprint_id: sprintId ?? null }));
    set((s) => ({
    issues: s.issues.map((i) =>
    i.id === issueId ?
    {
      ...i,
      // Backlog membership is driven by sprintId (undefined = backlog); status
      // is kept as-is since the DB has no separate "backlog" status.
      sprintId,
      updatedAt: new Date().toISOString()
    } :
    i
    )
  }));
  }
}));

// Static lookup maps (data is fixed in this prototype).
export const lookups = {
  workforce: [] as WorkforceEntry[],
  statuses,
  priorities,
  users: bootstrapUsers,
  labels,
  epics,
  sprints,
  issueTypes,
  statusById: Object.fromEntries(statuses.map((s) => [s.id, s])),
  priorityById: Object.fromEntries(priorities.map((p) => [p.id, p])),
  userById: Object.fromEntries(bootstrapUsers.map((u) => [u.id, u])),
  partnerMemberById: Object.fromEntries(bootstrapPartnerMembers.map((m: any) => [m.id, m])),
  labelById: Object.fromEntries(labels.map((l) => [l.id, l])),
  epicById: Object.fromEntries(epics.map((e) => [e.id, e])),
  sprintById: Object.fromEntries(sprints.map((s) => [s.id, s])),
  typeByKey: Object.fromEntries(issueTypes.map((t) => [t.key, t]))
};

export function matchesFilters(issue: Issue, filters: Filters): boolean {
  const { search, assigneeIds, typeKeys, labelIds, epicIds, workstream } = filters;
  if (search.trim()) {
    const q = search.toLowerCase();
    const hit =
    issue.title.toLowerCase().includes(q) ||
    issue.key.toLowerCase().includes(q) ||
    (issue.description ?? "").toLowerCase().includes(q);
    if (!hit) return false;
  }
  if (assigneeIds.length) {
    if (!issue.assigneeId || !assigneeIds.includes(issue.assigneeId)) {
      if (!(assigneeIds.includes("unassigned") && !issue.assigneeId)) return false;
    }
  }
  if (typeKeys.length && !typeKeys.includes(issue.typeKey)) return false;
  if (labelIds.length && !issue.labelIds.some((l) => labelIds.includes(l))) return false;
  if (epicIds.length && (!issue.epicId || !epicIds.includes(issue.epicId))) return false;
  if (workstream && issue.workstream !== workstream) return false;
  return true;
}
