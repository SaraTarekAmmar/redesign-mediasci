

import { useTranslation } from "react-i18next";
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useStore, lookups } from "../store/useStore";
import type { IssueStatus, Label, ProjectSettings } from "../data/types";
import { api, getActiveProjectId } from "../lib/api";
import { Label as LabelUI } from "../components/ui/Label";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Separator } from "../components/ui/Separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "../components/ui/SelectEnhanced";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import type { Client } from "../data/types";
import { PageHeader } from "../components/common/PageHeader";
import { Settings as SettingsIcon } from "lucide-react";

function syncStatuses(nextStatuses: IssueStatus[]) {
  lookups.statuses.splice(0, lookups.statuses.length, ...nextStatuses);
  Object.keys(lookups.statusById).forEach((key) => delete lookups.statusById[key]);
  nextStatuses.forEach((status) => {
    lookups.statusById[status.id] = status;
  });
}

function syncLabels(nextLabels: Label[]) {
  lookups.labels.splice(0, lookups.labels.length, ...nextLabels);
  Object.keys(lookups.labelById).forEach((key) => delete lookups.labelById[key]);
  nextLabels.forEach((label) => {
    lookups.labelById[label.id] = label;
  });
}

type ProjectDraft = {
  name: string;
  type: "scrum" | "kanban";
  category: string;
  classification: "postsale" | "presale";
  presale_type: "poc" | "demo" | "rfp" | "rfq" | "rop" | "";
  description: string;
  client_id: string;
};

type ProjectContext = ProjectDraft & {
  id: string;
  key: string;
  status: string;
  client?: { id: string; name: string; company?: string | null } | null;
  settings?: ProjectSettings | null;
};

const defaultGovernanceSettings: Required<ProjectSettings> = {
  flowMode: "both",
  requireScopeSummary: true,
  requireAcceptanceCriteria: true,
  requireDueDate: true,
  enableAiAssignment: true,
  aiConfidenceThreshold: 70,
  visibility: "team"
};

function normalizeGovernance(settings?: ProjectSettings | null): Required<ProjectSettings> {
  return {
    ...defaultGovernanceSettings,
    ...settings
  };
}

type CalendarDraft = {
  working_days: number[];
  working_hours_start: string;
  working_hours_end: string;
  auto_schedule: boolean;
  default_task_duration: number;
};

const defaultCalendarDraft: CalendarDraft = {
  working_days: [1, 2, 3, 4, 5],
  working_hours_start: "08:00",
  working_hours_end: "17:00",
  auto_schedule: false,
  default_task_duration: 1
};

type BudgetSettingsDraft = {
  budget: number;
  currency: string;
  enable_time_tracking: boolean;
};

const defaultBudgetSettingsDraft: BudgetSettingsDraft = {
  budget: 0,
  currency: "USD",
  enable_time_tracking: false
};

interface IntegrationStatus {
  connected: boolean;
  [key: string]: any;
}

interface IntegrationsState {
  slack: IntegrationStatus;
  calendar: IntegrationStatus;
  figma: IntegrationStatus;
  jira: IntegrationStatus;
  github: IntegrationStatus;
}

const defaultIntegrations: IntegrationsState = {
  slack: { connected: false },
  calendar: { connected: false },
  figma: { connected: false },
  jira: { connected: false },
  github: { connected: false }
};

interface Member {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  pivot?: { role?: string };
}

const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEMBER_ROLES = ["admin", "manager", "developer", "viewer"] as const;

function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const issues = useStore((s) => s.issues);
  const refreshProjects = useProjectCatalogStore((s) => s.refreshProjects);
  const storeActiveProject = useProjectCatalogStore((s) => s.activeProject);
  const activeProjectId = String(storeActiveProject?.id ?? getActiveProjectId() ?? "");
  const [activeTab, setActiveTab] = useState<
    "general" | "board" | "calendar" | "team" | "budget" | "integrations" | "danger"
  >("general");

  const [project, setProject] = useState<ProjectContext>({
    id: activeProjectId,
    key: "",
    name: "",
    type: "scrum",
    category: "",
    classification: "postsale",
    presale_type: "",
    description: "",
    client_id: "",
    status: "active",
    settings: undefined,
  });

  const [statusRows, setStatusRows] = useState<IssueStatus[]>(() => [...lookups.statuses]);
  const [labelRows, setLabelRows] = useState<Label[]>(() => [...lookups.labels]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; color: string }>({ name: "", color: "#3b82f6" });
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6b7280");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<{ name: string; color: string }>({ name: "", color: "#6b7280" });
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    name: project.name,
    type: project.type,
    category: project.category,
    classification: (project.classification === "project" ? "postsale" : project.classification) ?? "postsale",
    presale_type: project.presale_type ?? "",
    description: project.description ?? "",
    client_id: project.client_id ?? ""
  });
  const [governanceDraft, setGovernanceDraft] = useState<Required<ProjectSettings>>(
    normalizeGovernance(project.settings)
  );
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingGovernance, setSavingGovernance] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Calendar tab
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft>(defaultCalendarDraft);
  const [savingCalendar, setSavingCalendar] = useState(false);

  // Budget tab (baseline settings — the full ledger lives on the Budget page)
  const [budgetSettingsDraft, setBudgetSettingsDraft] = useState<BudgetSettingsDraft>(defaultBudgetSettingsDraft);
  const [savingBudgetSettings, setSavingBudgetSettings] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  // Integrations tab
  const [integrations, setIntegrations] = useState<IntegrationsState>(defaultIntegrations);
  const [githubIntegrations, setGithubIntegrations] = useState<any[]>([]);
  const [slackForm, setSlackForm] = useState({ webhook_url: "", channel: "#general" });
  const [calendarIntForm, setCalendarIntForm] = useState({ calendar_id: "", sync_enabled: true });
  const [figmaForm, setFigmaForm] = useState({ file_key: "", team_id: "" });
  const [jiraForm, setJiraForm] = useState({ jira_url: "", api_token: "", email: "" });
  const [githubForm, setGithubForm] = useState({ repo_owner: "", repo_name: "", github_token: "" });
  const [integrationBusy, setIntegrationBusy] = useState<string | null>(null);

  // Team tab
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<string>("developer");
  const [memberBusy, setMemberBusy] = useState(false);

  // Danger zone
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    let live = true;
    setLoadingBoard(true);
    api.get<any>(`/projects/${activeProjectId}`)
      .then((data) => {
        if (!live) return;
        setProject((current) => ({
          ...current,
          id: String(data?.id ?? current.id),
          name: data?.name ?? current.name,
          key: data?.key ?? current.key,
          type: data?.type ?? current.type,
          category: data?.category ?? current.category,
          classification: data?.classification ?? current.classification,
          presale_type: data?.presale_type ?? current.presale_type,
          description: data?.description ?? current.description,
          client_id: String(data?.client?.id ?? data?.client_id ?? current.client_id ?? ""),
          client: data?.client ?? current.client ?? null,
          status: data?.status ?? current.status,
          settings: data?.settings ?? current.settings,
        }));
        setBoardId(data?.boards?.[0]?.id ?? null);
        setProjectDraft({
          name: data?.name ?? project.name,
          type: data?.type ?? project.type,
          category: data?.category ?? project.category,
          classification: (data?.classification === "project" ? "postsale" : data?.classification) ?? (project.classification === "project" ? "postsale" : project.classification) ?? "postsale",
          presale_type: data?.presale_type ?? project.presale_type ?? "",
          description: data?.description ?? project.description ?? "",
          client_id: String(data?.client?.id ?? data?.client_id ?? project.client_id ?? "")
        });
        setGovernanceDraft(normalizeGovernance(data?.settings ?? project.settings));
        if (data?.labels?.length) {
          setLabelRows(data.labels);
          syncLabels(data.labels);
        }
      })
      .catch((error: any) => {
        if (!live) return;
        setBoardId(null);
        toast.error(error?.message ?? t("settings.couldNotLoadProject", { defaultValue: "Could not load project settings." }));
      })
      .finally(() => {
        if (live) setLoadingBoard(false);
      });
    return () => {
      live = false;
    };
  }, [activeProjectId]);

  // Calendar / Budget baseline / Integration status — one call backs three tabs.
  useEffect(() => {
    let live = true;
    api.get<Client[]>("/clients")
      .then((data) => { if (live) setClients(Array.isArray(data) ? data : []); })
      .catch((error: any) => { if (live) { setClients([]); toast.error(error?.message ?? "Could not load clients."); } });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    let live = true;
    api.get<any>(`/projects/${activeProjectId}/settings`)
      .then((data) => {
        if (!live || !data) return;
        setCalendarDraft({
          working_days: data.working_days ?? defaultCalendarDraft.working_days,
          working_hours_start: data.working_hours_start ?? defaultCalendarDraft.working_hours_start,
          working_hours_end: data.working_hours_end ?? defaultCalendarDraft.working_hours_end,
          auto_schedule: Boolean(data.auto_schedule),
          default_task_duration: data.default_task_duration ?? 1
        });
        setBudgetSettingsDraft({
          budget: Number(data.budget ?? 0),
          currency: data.currency ?? "USD",
          enable_time_tracking: Boolean(data.enable_time_tracking)
        });
        if (data.integrations) {
          setIntegrations((current) => ({ ...current, ...data.integrations }));
          if (data.integrations.slack?.webhook_url) {
            setSlackForm({ webhook_url: data.integrations.slack.webhook_url, channel: data.integrations.slack.channel ?? "#general" });
          }
          if (data.integrations.calendar?.calendar_id) {
            setCalendarIntForm({ calendar_id: data.integrations.calendar.calendar_id, sync_enabled: data.integrations.calendar.sync_enabled ?? true });
          }
          if (data.integrations.figma?.file_key) {
            setFigmaForm({ file_key: data.integrations.figma.file_key, team_id: data.integrations.figma.team_id ?? "" });
          }
          if (data.integrations.jira?.jira_url) {
            setJiraForm((cur) => ({ ...cur, jira_url: data.integrations.jira.jira_url, email: data.integrations.jira.email ?? "" }));
          }
        }
      })
      .catch((error: any) => { if (live) toast.error(error?.message ?? "Could not load calendar and budget settings."); });
    return () => { live = false; };
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let live = true;
    api.get<any[]>(`/projects/${activeProjectId}/github`)
      .then((data) => { if (live) setGithubIntegrations(Array.isArray(data) ? data : []); })
      .catch((error: any) => { if (live) toast.error(error?.message ?? "Could not load GitHub integrations."); });
    return () => { live = false; };
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let live = true;
    setLoadingMembers(true);
    api.get<Member[]>(`/projects/${activeProjectId}/members`)
      .then((data) => { if (live) setMembers(Array.isArray(data) ? data : []); })
      .catch((error: any) => { if (live) { setMembers([]); toast.error(error?.message ?? "Could not load project members."); } })
      .finally(() => { if (live) setLoadingMembers(false); });
    return () => { live = false; };
  }, [activeProjectId]);

  async function handleCreateColumn() {
    if (!boardId) {
      toast.error(t("settings.noBoardFound"));
      return;
    }
    if (!newName.trim()) {
      toast.error(t("settings.enterColumnName"));
      return;
    }
    setCreating(true);
    try {
      const created = await api.post<any>(`/boards/${boardId}/columns`, {
        name: newName.trim(),
        color: newColor
      });
      const board = await api.get<{ columns?: Array<{ status?: IssueStatus }> }>(`/boards/${boardId}`);
      const next = Array.from(
        new Map(
          (board?.columns ?? [])
            .map((column) => column.status)
            .filter((status): status is IssueStatus => Boolean(status))
            .map((status) => [status.id, status] as const)
        ).values()
      );
      if (!next.length) {
        next.push(
          ...statusRows,
          {
            id: String(created?.issue_status_id ?? created?.id ?? Date.now()),
            name: created?.name ?? newName.trim(),
            category: "in_progress",
            color: created?.color ?? newColor,
            position: statusRows.length
          }
        );
      }
      setStatusRows(next);
      syncStatuses(next);
      setNewName("");
      setNewColor("#3b82f6");
      toast.success(t("settings.columnAdded"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotAddColumn"));
    } finally {
      setCreating(false);
    }
  }

  function beginEdit(status: IssueStatus) {
    setEditingId(status.id);
    setDraft({ name: status.name, color: status.color });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({ name: "", color: "#3b82f6" });
  }

  async function saveEdit(statusId: string) {
    if (!draft.name.trim()) {
      toast.error(t("settings.enterColumnName"));
      return;
    }
    setEditingId(statusId);
    try {
      const updated = await api.put<IssueStatus>(`/statuses/${statusId}`, {
        name: draft.name.trim(),
        color: draft.color
      });
      const next = statusRows.map((status) => status.id === statusId ? updated : status);
      setStatusRows(next);
      syncStatuses(next);
      setEditingId(null);
      toast.success(t("settings.columnUpdated"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotUpdateColumn"));
    }
  }

  function beginLabelEdit(label: Label) {
    setEditingLabelId(label.id);
    setLabelDraft({ name: label.name, color: label.color });
  }

  function cancelLabelEdit() {
    setEditingLabelId(null);
    setLabelDraft({ name: "", color: "#6b7280" });
  }

  async function saveLabelEdit(labelId: string) {
    if (!labelDraft.name.trim()) {
      toast.error(t("settings.enterLabelName"));
      return;
    }
    setEditingLabelId(labelId);
    try {
      const updated = await api.put<Label>(`/projects/${project.id}/labels/${labelId}`, {
        name: labelDraft.name.trim(),
        color: labelDraft.color
      });
      const next = labelRows.map((label) => label.id === labelId ? updated : label);
      setLabelRows(next);
      syncLabels(next);
      setEditingLabelId(null);
      toast.success(t("settings.labelUpdated"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotUpdateLabel"));
    }
  }

  async function handleCreateLabel() {
    if (!newLabelName.trim()) {
      toast.error(t("settings.enterLabelName"));
      return;
    }
    setCreating(true);
    try {
      const created = await api.post<Label>(`/projects/${project.id}/labels`, {
        name: newLabelName.trim(),
        color: newLabelColor
      });
      const next = [...labelRows, created];
      setLabelRows(next);
      syncLabels(next);
      setNewLabelName("");
      setNewLabelColor("#6b7280");
      toast.success(t("settings.labelAdded"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotAddLabel"));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveDetails() {
    if (!projectDraft.name.trim()) {
      toast.error(t("settings.enterProjectName"));
      return;
    }
    if (!projectDraft.client_id) {
      toast.error(t("settings.selectClient"));
      return;
    }
    setSavingDetails(true);
    try {
      const updated = await api.put<any>(`/projects/${project.id}`, {
        name: projectDraft.name.trim(),
        type: projectDraft.type,
        category: projectDraft.category.trim(),
        classification: projectDraft.classification,
        presale_type: projectDraft.classification === "presale" ? projectDraft.presale_type || null : null,
        description: projectDraft.description.trim(),
        client_id: Number(projectDraft.client_id)
      });
      setProject((current) => ({
        ...current,
        id: String(updated?.id ?? current.id),
        name: updated?.name ?? current.name,
        key: updated?.key ?? current.key,
        type: updated?.type ?? current.type,
        category: updated?.category ?? current.category,
        classification: updated?.classification ?? current.classification,
        presale_type: updated?.presale_type ?? current.presale_type,
        description: updated?.description ?? current.description,
        client_id: String(updated?.client?.id ?? updated?.client_id ?? current.client_id ?? ""),
        client: updated?.client ?? current.client ?? null,
        status: updated?.status ?? current.status,
        settings: updated?.settings ?? current.settings,
      }));
      setProjectDraft((current) => ({
        ...current,
        name: updated?.name ?? current.name,
        category: updated?.category ?? current.category,
        classification: updated?.classification ?? current.classification,
        presale_type: updated?.presale_type ?? current.presale_type,
        description: updated?.description ?? current.description,
        client_id: String(updated?.client?.id ?? updated?.client_id ?? current.client_id ?? "")
      }));
      await refreshProjects();
      toast.success(t("settings.saveChanges"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotSaveProject"));
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSaveGovernance() {
    setSavingGovernance(true);
    try {
      await api.put(`/projects/${project.id}`, {
        settings: governanceDraft
      });
      toast.success(t("settings.saveGovernance"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotSaveGovernance"));
    } finally {
      setSavingGovernance(false);
    }
  }

  async function handleSaveCalendar() {
    setSavingCalendar(true);
    try {
      await api.put(`/projects/${project.id}/settings`, { section: "calendar", ...calendarDraft });
      toast.success(t("settings.saveCalendar"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotSaveCalendar"));
    } finally {
      setSavingCalendar(false);
    }
  }

  function toggleWorkingDay(day: number) {
    setCalendarDraft((current) => ({
      ...current,
      working_days: current.working_days.includes(day)
        ? current.working_days.filter((d) => d !== day)
        : [...current.working_days, day].sort()
    }));
  }

  async function handleSaveBudgetSettings() {
    setSavingBudgetSettings(true);
    try {
      await api.put(`/projects/${project.id}/settings`, { section: "budget", ...budgetSettingsDraft });
      toast.success(t("settings.saveBudget"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotSaveBudget"));
    } finally {
      setSavingBudgetSettings(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.put(`/projects/${project.id}`, { status: "archived" });
      await refreshProjects();
      toast.success(t("settings.archive"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotArchive"));
    } finally {
      setArchiving(false);
    }
  }

  async function handleDeleteProject() {
    if (deleteConfirmText !== project.name) {
      toast.error(t("settings.deleteMismatch"));
      return;
    }
    setDeleting(true);
    try {
      await api.del(`/projects/${project.id}`);
      await refreshProjects();
      toast.success(t("settings.deleteProject"));
      navigate("/projects");
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotDelete"));
    } finally {
      setDeleting(false);
    }
  }

  // ── Team ──
  async function handleAddMember() {
    if (!newMemberId) {
      toast.error(t("settings.selectUser"));
      return;
    }
    setMemberBusy(true);
    try {
      await api.post(`/projects/${project.id}/members`, { user_id: newMemberId, role: newMemberRole });
      const user = lookups.users.find((u) => u.id === newMemberId);
      setMembers((cur) => [...cur, { id: newMemberId, name: user?.name ?? newMemberId, pivot: { role: newMemberRole } }]);
      setNewMemberId("");
      toast.success(t("settings.memberAdded"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotAddMember"));
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    const prev = members;
    setMembers((cur) => cur.filter((m) => m.id !== userId));
    try {
      await api.del(`/projects/${project.id}/members`, { user_id: userId });
      toast.success(t("settings.memberRemoved"));
    } catch (error: any) {
      setMembers(prev);
      toast.error(error?.message ?? t("settings.couldNotRemoveMember"));
    }
  }

  async function handleChangeMemberRole(userId: string, role: string) {
    const prev = members;
    setMembers((cur) => cur.map((m) => m.id === userId ? { ...m, pivot: { role } } : m));
    try {
      await api.put(`/projects/${project.id}/members/role`, { user_id: userId, role });
      toast.success(t("settings.roleUpdated"));
    } catch (error: any) {
      setMembers(prev);
      toast.error(error?.message ?? t("settings.couldNotUpdateRole"));
    }
  }

  const availableUsers = lookups.users.filter((u) => !members.some((m) => m.id === u.id));

  // ── Integrations ──
  async function connectSlack() {
    if (!slackForm.webhook_url.trim()) { toast.error(t("settings.webhookUrl")); return; }
    setIntegrationBusy("slack");
    try {
      await api.post(`/projects/${project.id}/slack/connect`, slackForm);
      setIntegrations((cur) => ({ ...cur, slack: { connected: true, ...slackForm } }));
      toast.success(t("settings.connected"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotConnect"));
    } finally { setIntegrationBusy(null); }
  }
  async function disconnectSlack() {
    setIntegrationBusy("slack");
    try {
      await api.del(`/projects/${project.id}/slack/disconnect`);
      setIntegrations((cur) => ({ ...cur, slack: { connected: false } }));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotDisconnect"));
    } finally { setIntegrationBusy(null); }
  }

  async function connectCalendarIntegration() {
    if (!calendarIntForm.calendar_id.trim()) { toast.error(t("settings.calendarId")); return; }
    setIntegrationBusy("calendar");
    try {
      await api.post(`/projects/${project.id}/calendar/connect`, calendarIntForm);
      setIntegrations((cur) => ({ ...cur, calendar: { connected: true, ...calendarIntForm } }));
      toast.success(t("settings.connected"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotConnect"));
    } finally { setIntegrationBusy(null); }
  }
  async function disconnectCalendarIntegration() {
    setIntegrationBusy("calendar");
    try {
      await api.del(`/projects/${project.id}/calendar/disconnect`);
      setIntegrations((cur) => ({ ...cur, calendar: { connected: false } }));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotDisconnect"));
    } finally { setIntegrationBusy(null); }
  }

  async function connectFigma() {
    if (!figmaForm.file_key.trim()) { toast.error(t("settings.fileKey")); return; }
    setIntegrationBusy("figma");
    try {
      await api.post(`/projects/${project.id}/figma/connect`, figmaForm);
      setIntegrations((cur) => ({ ...cur, figma: { connected: true, ...figmaForm } }));
      toast.success(t("settings.connected"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotConnect"));
    } finally { setIntegrationBusy(null); }
  }
  async function disconnectFigma() {
    setIntegrationBusy("figma");
    try {
      await api.del(`/projects/${project.id}/figma/disconnect`);
      setIntegrations((cur) => ({ ...cur, figma: { connected: false } }));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotDisconnect"));
    } finally { setIntegrationBusy(null); }
  }

  async function connectJira() {
    if (!jiraForm.jira_url.trim() || !jiraForm.api_token.trim() || !jiraForm.email.trim()) {
      toast.error(t("settings.jiraUrl"));
      return;
    }
    setIntegrationBusy("jira");
    try {
      await api.post(`/projects/${project.id}/jira/connect`, jiraForm);
      setIntegrations((cur) => ({ ...cur, jira: { connected: true, jira_url: jiraForm.jira_url, email: jiraForm.email } }));
      toast.success(t("settings.connected"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotConnect"));
    } finally { setIntegrationBusy(null); }
  }
  async function disconnectJira() {
    setIntegrationBusy("jira");
    try {
      await api.del(`/projects/${project.id}/jira/disconnect`);
      setIntegrations((cur) => ({ ...cur, jira: { connected: false } }));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotDisconnect"));
    } finally { setIntegrationBusy(null); }
  }

  async function connectGithub() {
    if (!githubForm.repo_owner.trim() || !githubForm.repo_name.trim()) {
      toast.error(t("settings.repoOwner"));
      return;
    }
    setIntegrationBusy("github");
    try {
      const created = await api.post<any>(`/projects/${project.id}/github`, githubForm);
      setGithubIntegrations((cur) => [...cur, created]);
      setIntegrations((cur) => ({ ...cur, github: { connected: true } }));
      setGithubForm({ repo_owner: "", repo_name: "", github_token: "" });
      toast.success(t("settings.connected"));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotConnect"));
    } finally { setIntegrationBusy(null); }
  }
  async function disconnectGithub(id: string) {
    setIntegrationBusy("github");
    try {
      await api.del(`/github/${id}`);
      const next = githubIntegrations.filter((g) => g.id !== id);
      setGithubIntegrations(next);
      setIntegrations((cur) => ({ ...cur, github: { connected: next.length > 0 } }));
    } catch (error: any) {
      toast.error(error?.message ?? t("settings.couldNotDisconnect"));
    } finally { setIntegrationBusy(null); }
  }

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          icon={<SettingsIcon className="h-4 w-4" />}
          title={t("settings.title")}
          subtitle={t("settings.description", { name: project.name })}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="general">{t("settings.tabGeneral")}</TabsTrigger>
            <TabsTrigger value="board">{t("settings.tabBoard")}</TabsTrigger>
            <TabsTrigger value="calendar">{t("settings.tabCalendar")}</TabsTrigger>
            <TabsTrigger value="team">{t("settings.tabTeam")}</TabsTrigger>
            <TabsTrigger value="budget">{t("settings.tabBudget")}</TabsTrigger>
            <TabsTrigger value="integrations">{t("settings.tabIntegrations")}</TabsTrigger>
            <TabsTrigger value="danger" className="text-destructive">{t("settings.tabDanger")}</TabsTrigger>
          </TabsList>

          {/* ───────── General ───────── */}
          <TabsContent value="general">
            <div className="space-y-4">
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">{t("settings.details")}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="p-name">{t("settings.name")}</LabelUI>
                    <Input
                      id="p-name"
                      value={projectDraft.name}
                      onChange={(e) => setProjectDraft((current) => ({ ...current, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="p-key">{t("settings.key")}</LabelUI>
                    <Input id="p-key" value={project.key} className="font-mono uppercase" readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI>{t("settings.client")}</LabelUI>
                    <Select
                      value={projectDraft.client_id || "__none"}
                      onValueChange={(value) => setProjectDraft((current) => ({ ...current, client_id: value === "__none" ? "" : value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("settings.selectAClient")}</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={String(client.id)}>
                            {client.company || client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="p-cat">{t("settings.category")}</LabelUI>
                    <Input
                      id="p-cat"
                      value={projectDraft.category}
                      onChange={(e) => setProjectDraft((current) => ({ ...current, category: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="p-type">{t("settings.type")}</LabelUI>
                    <Select
                      value={projectDraft.type}
                      onValueChange={(value) => setProjectDraft((current) => ({ ...current, type: value as ProjectDraft["type"] }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scrum">{t("app.projectType.scrum")}</SelectItem>
                        <SelectItem value="kanban">{t("app.projectType.kanban")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="p-classification">{t("projects.stage")}</LabelUI>
                    <Select
                      value={projectDraft.classification}
                      onValueChange={(value) =>
                        setProjectDraft((current) => ({
                          ...current,
                          classification: value as ProjectDraft["classification"],
                          presale_type: value === "presale" && !current.presale_type ? "poc" : current.presale_type
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="postsale">{t("projects.postsale")}</SelectItem>
                        <SelectItem value="presale">{t("projects.presale")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="p-presale-type">{t("projectCreate.presaleType")}</LabelUI>
                    <Select
                      value={projectDraft.presale_type || undefined}
                      onValueChange={(value) => setProjectDraft((current) => ({ ...current, presale_type: value as ProjectDraft["presale_type"] }))}
                      disabled={projectDraft.classification !== "presale"}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="poc">POC</SelectItem>
                        <SelectItem value="demo">Demo</SelectItem>
                        <SelectItem value="rfp">RFP</SelectItem>
                        <SelectItem value="rfq">RFQ</SelectItem>
                        <SelectItem value="rop">ROP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <LabelUI htmlFor="p-desc">{t("settings.descField")}</LabelUI>
                    <Textarea
                      id="p-desc"
                      rows={3}
                      placeholder={t("settings.descPlaceholder")}
                      value={projectDraft.description}
                      onChange={(e) => setProjectDraft((current) => ({ ...current, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveDetails} disabled={savingDetails}>
                    {savingDetails ? "Saving..." : t("settings.saveChanges")}
                  </Button>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">{t("settings.governance")}</h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{t("settings.governanceDesc")}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <LabelUI>{t("settings.flowMode")}</LabelUI>
                    <Select
                      value={governanceDraft.flowMode}
                      onValueChange={(value) => setGovernanceDraft((current) => ({ ...current, flowMode: value as ProjectSettings["flowMode"] }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("settings.flowMode")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presale">{t("settings.flowPresale")}</SelectItem>
                        <SelectItem value="postsale">{t("settings.flowPostsale")}</SelectItem>
                        <SelectItem value="both">{t("settings.flowBoth")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI>{t("settings.roleVisibility")}</LabelUI>
                    <Select
                      value={governanceDraft.visibility}
                      onValueChange={(value) => setGovernanceDraft((current) => ({ ...current, visibility: value as ProjectSettings["visibility"] }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("settings.roleVisibility")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team">{t("settings.visibilityTeam")}</SelectItem>
                        <SelectItem value="managers">{t("settings.visibilityManagers")}</SelectItem>
                        <SelectItem value="admins">{t("settings.visibilityAdmins")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={governanceDraft.requireScopeSummary}
                      onChange={(e) => setGovernanceDraft((current) => ({ ...current, requireScopeSummary: e.target.checked }))}
                    />
                    <span className="text-sm text-foreground">{t("settings.requireScopeSummary")}</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={governanceDraft.requireAcceptanceCriteria}
                      onChange={(e) => setGovernanceDraft((current) => ({ ...current, requireAcceptanceCriteria: e.target.checked }))}
                    />
                    <span className="text-sm text-foreground">{t("settings.requireAcceptanceCriteria")}</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={governanceDraft.requireDueDate}
                      onChange={(e) => setGovernanceDraft((current) => ({ ...current, requireDueDate: e.target.checked }))}
                    />
                    <span className="text-sm text-foreground">{t("settings.requireDueDate")}</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={governanceDraft.enableAiAssignment}
                      onChange={(e) => setGovernanceDraft((current) => ({ ...current, enableAiAssignment: e.target.checked }))}
                    />
                    <span className="text-sm text-foreground">{t("settings.enableAiAssignment")}</span>
                  </label>
                  <div className="space-y-1.5 md:col-span-2">
                    <LabelUI htmlFor="ai-confidence">{t("settings.aiConfidenceThreshold")}</LabelUI>
                    <Input
                      id="ai-confidence"
                      type="number"
                      min={0}
                      max={100}
                      value={governanceDraft.aiConfidenceThreshold}
                      onChange={(e) => setGovernanceDraft((current) => ({
                        ...current,
                        aiConfidenceThreshold: Number(e.target.value) || 0
                      }))}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveGovernance} disabled={savingGovernance}>
                    {savingGovernance ? "Saving..." : t("settings.saveGovernance")}
                  </Button>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">{t("settings.brandSystem")}</h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  {t("settings.brandSystemDesc")}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { name: "Default Ink", value: "oklch(0.205 0 0)" },
                    { name: "Ocean Blue", value: "#0ea5e9" },
                    { name: "Premium Purple", value: "#8b5cf6" },
                    { name: "Forest Green", value: "#10b981" },
                    { name: "Warm Amber", value: "#f59e0b" },
                    { name: "Crimson Red", value: "#ef4444" },
                  ].map((themeOpt) => (
                    <button
                      key={themeOpt.value}
                      onClick={() => {
                        localStorage.setItem("brand-theme-color", themeOpt.value);
                        document.documentElement.style.setProperty("--primary", themeOpt.value);
                        document.documentElement.style.setProperty("--ring", themeOpt.value);
                        toast.success(t("settings.brandingUpdated"));
                      }}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-accent/40 hover:border-accent transition-all cursor-pointer"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-border"
                        style={{ backgroundColor: themeOpt.value.includes("oklch") ? "#18181b" : themeOpt.value }}
                      />
                      {themeOpt.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </TabsContent>

          {/* ───────── Board (workflow columns + labels) ───────── */}
          <TabsContent value="board">
            <div className="space-y-4">
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">{t("settings.workflowColumns")}</h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  {t("settings.workflowDesc")}
                </p>
                <div className="mb-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                    <div className="space-y-1.5">
                      <LabelUI htmlFor="new-column-name">{t("settings.newColumn")}</LabelUI>
                      <Input
                        id="new-column-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Review"
                        disabled={loadingBoard || !boardId}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <LabelUI htmlFor="new-column-color">Color</LabelUI>
                      <Input
                        id="new-column-color"
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="h-10 w-full p-1"
                        disabled={loadingBoard || !boardId}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleCreateColumn} disabled={creating || loadingBoard || !boardId}>
                        {t("settings.addColumn")}
                      </Button>
                    </div>
                  </div>
                  {!boardId && !loadingBoard && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("settings.noBoard")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {statusRows.map((status, idx) => {
                    const count = issues.filter((issue) => issue.statusId === status.id).length;
                    const isEditing = editingId === status.id;
                    return (
                      <div key={status.id} className="rounded-lg border border-border px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-xs text-muted-foreground">{idx + 1}</span>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                          {isEditing ? (
                            <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_160px]">
                              <Input
                                value={draft.name}
                                onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                              />
                              <Input
                                type="color"
                                value={draft.color}
                                onChange={(e) => setDraft((current) => ({ ...current, color: e.target.value }))}
                                className="h-10 w-full p-1"
                              />
                            </div>
                          ) : (
                            <span className="flex-1 text-sm font-medium text-foreground">{status.name}</span>
                          )}
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                            {status.category.replace("_", " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">{count} {t("sprints.issues")}</span>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(status.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => beginEdit(status)}>
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">{t("settings.labels")}</h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{t("settings.labelsDesc")}</p>
                <div className="mb-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                    <div className="space-y-1.5">
                      <LabelUI htmlFor="new-label-name">{t("settings.newLabel")}</LabelUI>
                      <Input
                        id="new-label-name"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="frontend"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <LabelUI htmlFor="new-label-color">Color</LabelUI>
                      <Input
                        id="new-label-color"
                        type="color"
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="h-10 w-full p-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleCreateLabel} disabled={creating}>
                        {t("settings.addLabel")}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {labelRows.map((label) => {
                    const isEditing = editingLabelId === label.id;
                    return isEditing ? (
                      <div
                        key={label.id}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-xs font-medium">
                        <Input
                          value={labelDraft.name}
                          onChange={(e) => setLabelDraft((current) => ({ ...current, name: e.target.value }))}
                          className="h-7 w-32 rounded-full border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                        />
                        <Input
                          type="color"
                          value={labelDraft.color}
                          onChange={(e) => setLabelDraft((current) => ({ ...current, color: e.target.value }))}
                          className="h-7 w-12 border-0 bg-transparent p-0 shadow-none"
                        />
                        <Button size="sm" onClick={() => saveLabelEdit(label.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelLabelEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => beginLabelEdit(label)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
                        style={{ backgroundColor: `${label.color}1f`, color: label.color }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </TabsContent>

          {/* ───────── Calendar ───────── */}
          <TabsContent value="calendar">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">{t("settings.calendarTitle")}</h2>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{t("settings.calendarDesc")}</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <LabelUI>{t("settings.workingDays")}</LabelUI>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_KEYS.map((day, idx) => {
                      const active = calendarDraft.working_days.includes(idx);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWorkingDay(idx)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="wh-start">{t("settings.workingHours")}</LabelUI>
                    <div className="flex items-center gap-2">
                      <Input
                        id="wh-start"
                        type="time"
                        value={calendarDraft.working_hours_start}
                        onChange={(e) => setCalendarDraft((cur) => ({ ...cur, working_hours_start: e.target.value }))}
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={calendarDraft.working_hours_end}
                        onChange={(e) => setCalendarDraft((cur) => ({ ...cur, working_hours_end: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <LabelUI htmlFor="default-duration">{t("settings.defaultDuration")}</LabelUI>
                    <Input
                      id="default-duration"
                      type="number"
                      min={1}
                      value={calendarDraft.default_task_duration}
                      onChange={(e) => setCalendarDraft((cur) => ({ ...cur, default_task_duration: Number(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={calendarDraft.auto_schedule}
                    onChange={(e) => setCalendarDraft((cur) => ({ ...cur, auto_schedule: e.target.checked }))}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{t("settings.autoSchedule")}</span>
                    <span className="block text-xs text-muted-foreground">{t("settings.autoScheduleDesc")}</span>
                  </span>
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveCalendar} disabled={savingCalendar}>
                  {savingCalendar ? "Saving..." : t("settings.saveCalendar")}
                </Button>
              </div>
            </section>
          </TabsContent>

          {/* ───────── Team ───────── */}
          <TabsContent value="team">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">
                {t("settings.teamTitle")} ({members.length})
              </h2>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{t("settings.teamDesc")}</p>

              <div className="mb-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <Select value={newMemberId} onValueChange={setNewMemberId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("settings.selectUser")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{t(`settings.role${r.charAt(0).toUpperCase()}${r.slice(1)}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddMember} disabled={memberBusy || !newMemberId}>
                    {t("settings.addMember")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {loadingMembers && <p className="text-sm text-muted-foreground">{t("app.loading")}</p>}
                {!loadingMembers && members.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("settings.teamDesc")}</p>
                )}
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">{member.name}</span>
                    <Select
                      value={member.pivot?.role ?? "developer"}
                      onValueChange={(role) => handleChangeMemberRole(member.id, role)}
                    >
                      <SelectTrigger className="w-[140px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBER_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{t(`settings.role${r.charAt(0).toUpperCase()}${r.slice(1)}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRemoveMember(member.id)}>
                      {t("settings.remove")}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* ───────── Budget ───────── */}
          <TabsContent value="budget">
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{t("settings.budgetBaseline")}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.budgetBaselineDesc")}</p>
                </div>
                <Link
                  to="/budget"
                  className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent/40"
                >
                  {t("settings.openLedger")} →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <LabelUI htmlFor="baseline-budget">{t("settings.baselineBudget")}</LabelUI>
                  <Input
                    id="baseline-budget"
                    type="number"
                    min={0}
                    value={budgetSettingsDraft.budget}
                    onChange={(e) => setBudgetSettingsDraft((cur) => ({ ...cur, budget: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <LabelUI htmlFor="baseline-currency">{t("settings.currency")}</LabelUI>
                  <Select
                    value={budgetSettingsDraft.currency}
                    onValueChange={(v) => setBudgetSettingsDraft((cur) => ({ ...cur, currency: v }))}
                  >
                    <SelectTrigger id="baseline-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["USD", "EUR", "GBP", "JPY", "CAD", "AUD"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input
                  type="checkbox"
                  checked={budgetSettingsDraft.enable_time_tracking}
                  onChange={(e) => setBudgetSettingsDraft((cur) => ({ ...cur, enable_time_tracking: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">{t("settings.timeTracking")}</span>
                  <span className="block text-xs text-muted-foreground">{t("settings.timeTrackingDesc")}</span>
                </span>
              </label>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleSaveBudgetSettings} disabled={savingBudgetSettings}>
                  {savingBudgetSettings ? "Saving..." : t("settings.saveBudget")}
                </Button>
              </div>
            </section>
          </TabsContent>

          {/* ───────── Integrations ───────── */}
          <TabsContent value="integrations">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Slack */}
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{t("settings.slackTitle")}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${integrations.slack.connected ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {integrations.slack.connected ? t("settings.connected") : t("settings.notConnected")}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.slackDesc")}</p>
                <div className="space-y-2">
                  <Input
                    placeholder={t("settings.webhookUrl")}
                    value={slackForm.webhook_url}
                    onChange={(e) => setSlackForm((cur) => ({ ...cur, webhook_url: e.target.value }))}
                  />
                  <Input
                    placeholder={t("settings.channel")}
                    value={slackForm.channel}
                    onChange={(e) => setSlackForm((cur) => ({ ...cur, channel: e.target.value }))}
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {integrations.slack.connected && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={disconnectSlack} disabled={integrationBusy === "slack"}>
                      {t("settings.disconnect")}
                    </Button>
                  )}
                  <Button size="sm" onClick={connectSlack} disabled={integrationBusy === "slack"}>
                    {t("settings.connect")}
                  </Button>
                </div>
              </section>

              {/* Calendar */}
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{t("settings.calendarIntegrationTitle")}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${integrations.calendar.connected ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {integrations.calendar.connected ? t("settings.connected") : t("settings.notConnected")}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.calendarIntegrationDesc")}</p>
                <Input
                  placeholder={t("settings.calendarId")}
                  value={calendarIntForm.calendar_id}
                  onChange={(e) => setCalendarIntForm((cur) => ({ ...cur, calendar_id: e.target.value }))}
                />
                <div className="mt-3 flex justify-end gap-2">
                  {integrations.calendar.connected && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={disconnectCalendarIntegration} disabled={integrationBusy === "calendar"}>
                      {t("settings.disconnect")}
                    </Button>
                  )}
                  <Button size="sm" onClick={connectCalendarIntegration} disabled={integrationBusy === "calendar"}>
                    {t("settings.connect")}
                  </Button>
                </div>
              </section>

              {/* Figma */}
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{t("settings.figmaTitle")}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${integrations.figma.connected ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {integrations.figma.connected ? t("settings.connected") : t("settings.notConnected")}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.figmaDesc")}</p>
                <Input
                  placeholder={t("settings.fileKey")}
                  value={figmaForm.file_key}
                  onChange={(e) => setFigmaForm((cur) => ({ ...cur, file_key: e.target.value }))}
                />
                <div className="mt-3 flex justify-end gap-2">
                  {integrations.figma.connected && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={disconnectFigma} disabled={integrationBusy === "figma"}>
                      {t("settings.disconnect")}
                    </Button>
                  )}
                  <Button size="sm" onClick={connectFigma} disabled={integrationBusy === "figma"}>
                    {t("settings.connect")}
                  </Button>
                </div>
              </section>

              {/* Jira */}
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{t("settings.jiraTitle")}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${integrations.jira.connected ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {integrations.jira.connected ? t("settings.connected") : t("settings.notConnected")}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.jiraDesc")}</p>
                <div className="space-y-2">
                  <Input
                    placeholder={t("settings.jiraUrl")}
                    value={jiraForm.jira_url}
                    onChange={(e) => setJiraForm((cur) => ({ ...cur, jira_url: e.target.value }))}
                  />
                  <Input
                    placeholder={t("settings.email")}
                    value={jiraForm.email}
                    onChange={(e) => setJiraForm((cur) => ({ ...cur, email: e.target.value }))}
                  />
                  <Input
                    placeholder={t("settings.apiToken")}
                    type="password"
                    value={jiraForm.api_token}
                    onChange={(e) => setJiraForm((cur) => ({ ...cur, api_token: e.target.value }))}
                  />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {integrations.jira.connected && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={disconnectJira} disabled={integrationBusy === "jira"}>
                      {t("settings.disconnect")}
                    </Button>
                  )}
                  <Button size="sm" onClick={connectJira} disabled={integrationBusy === "jira"}>
                    {t("settings.connect")}
                  </Button>
                </div>
              </section>

              {/* GitHub */}
              <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{t("settings.githubTitle")}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${integrations.github.connected ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {integrations.github.connected ? t("settings.connected") : t("settings.notConnected")}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{t("settings.githubDesc")}</p>

                {githubIntegrations.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {githubIntegrations.map((g) => (
                      <div key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                        <span>{t("settings.connectedToRepo", { repo: `${g.repo_owner}/${g.repo_name}` })}</span>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => disconnectGithub(g.id)} disabled={integrationBusy === "github"}>
                          {t("settings.disconnect")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder={t("settings.repoOwner")}
                    value={githubForm.repo_owner}
                    onChange={(e) => setGithubForm((cur) => ({ ...cur, repo_owner: e.target.value }))}
                  />
                  <Input
                    placeholder={t("settings.repoName")}
                    value={githubForm.repo_name}
                    onChange={(e) => setGithubForm((cur) => ({ ...cur, repo_name: e.target.value }))}
                  />
                  <Button onClick={connectGithub} disabled={integrationBusy === "github"}>
                    {t("settings.connect")}
                  </Button>
                </div>
              </section>
            </div>
          </TabsContent>

          {/* ───────── Danger zone ───────── */}
          <TabsContent value="danger">
            <section className="rounded-xl border border-destructive/40 bg-card p-5">
              <h2 className="text-sm font-semibold text-destructive">{t("settings.dangerZone")}</h2>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("settings.archiveProject")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.archiveDesc")}</p>
                </div>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={handleArchive}
                  disabled={archiving}>
                  {archiving ? "Archiving..." : t("settings.archive")}
                </Button>
              </div>
              <Separator className="my-4" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.deleteProject")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.deleteDesc")}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("settings.deleteConfirmPrompt", { name: project.name })}
                </p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={project.name}
                    className="max-w-xs"
                  />
                  <Button
                    variant="destructive"
                    disabled={deleting || deleteConfirmText !== project.name}
                    onClick={handleDeleteProject}
                  >
                    {deleting ? t("settings.deleting") : t("settings.delete")}
                  </Button>
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default SettingsPage;
