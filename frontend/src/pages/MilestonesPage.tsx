import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Layers3, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/Sheet";
import { Textarea } from "../components/ui/Textarea";
import { api, getActiveProjectId } from "../lib/api";
import { cn } from "../lib/utils";

interface ProjectRecord {
  id: string | number;
  name: string;
  key?: string;
}

interface ResourceRecord {
  id: string | number;
  name: string;
  position?: string | null;
  availability_status?: string | null;
}

interface DeliverableRecord {
  id: number;
  milestone_id: number;
  title: string;
  description?: string | null;
  acceptance_criteria?: string | null;
  planned_completion_date?: string | null;
  actual_completion_date?: string | null;
  status: string;
  owner_resource_id?: number | null;
  owner_resource?: { id: number | string; name: string; position?: string | null } | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface MilestoneDependencyMilestoneRecord {
  id: number;
  project_id: number;
  name: string;
  title?: string;
  status: string;
  sort_order?: number;
}

interface MilestoneDependencyRecord {
  id: number;
  predecessor_milestone_id: number;
  successor_milestone_id: number;
  dependency_type: string;
  predecessor_milestone: MilestoneDependencyMilestoneRecord;
  successor_milestone: MilestoneDependencyMilestoneRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

interface MilestoneRecord {
  id: number;
  project_id: number;
  name: string;
  title?: string;
  description?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  planned_hours?: number;
  planned_progress?: number;
  status: string;
  owner_resource_id?: number | null;
  owner_resource?: { id: number | string; name: string; position?: string | null; availability_status?: string | null } | null;
  sort_order?: number;
  date?: string | null;
  deliverables?: DeliverableRecord[];
  deliverables_count?: number;
  performance?: MilestonePerformanceRecord;
}

interface MilestonePerformanceRecord {
  completion_percentage?: number;
  ready_to_start?: boolean;
  blocked?: boolean;
  blocking_reason?: string | null;
  dependencies_completed?: number;
  dependencies_remaining?: number;
  blocking_milestones?: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
  completed_issues?: number;
  remaining_issues?: number;
  completed_story_points?: number;
  remaining_story_points?: number;
  health_status?: string;
  traffic_light?: string;
  risk_level?: string;
  forecast_finish?: string | null;
  main_cause?: string | null;
  deliverable_progress?: {
    progress_pct: number;
    completed_tasks: number;
    remaining_tasks: number;
    status: string;
  };
  dependency_impact?: {
    waiting_for?: string[];
    blocked_by?: string[];
    blocking?: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
    estimated_delay_days?: number;
    risk_level?: string;
    critical_dependency?: { id: number; name: string; title?: string; status?: string; sort_order?: number } | null;
    estimated_project_impact?: string | null;
  };
  resource_planning?: {
    owner_resource?: { id: number; name: string; position?: string | null; availability_status?: string | null } | null;
    owner_capacity?: number;
    owner_utilization?: number;
    owner_overloaded?: boolean;
    assigned_resource_ids?: number[];
    available_resources?: ResourceRecord[];
    suggested_replacements?: ResourceRecord[];
  };
  activity_timeline?: AuditEvent[];
}

interface PerformanceResponse {
  summary?: {
    blocked_project?: boolean;
    blocking_milestone?: { id: number; name: string; title?: string } | null;
    blocking_reason?: string | null;
  };
  milestones?: Array<
    MilestoneRecord & {
      completion_percentage?: number;
      ready_to_start?: boolean;
      blocked?: boolean;
      blocking_reason?: string | null;
      dependencies_completed?: number;
      dependencies_remaining?: number;
      blocking_milestones?: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
      completed_issues?: number;
      remaining_issues?: number;
      completed_story_points?: number;
      remaining_story_points?: number;
      deliverable_progress?: {
        progress_pct: number;
        completed_tasks: number;
        remaining_tasks: number;
        status: string;
      };
    }
  >;
}

interface MilestoneDependencyForm {
  id: string;
  predecessor_milestone_id: string;
  dependency_type: string;
}

interface MilestoneForm {
  id: string;
  name: string;
  description: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  planned_hours: string;
  planned_progress: string;
  status: string;
  owner_resource_id: string;
  sort_order: string;
}

interface DeliverableForm {
  id: string;
  milestone_id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  planned_completion_date: string;
  actual_completion_date: string;
  status: string;
  owner_resource_id: string;
}

interface Props {
  projectId?: string;
}

const milestoneStatuses = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "at_risk", label: "At Risk" },
];

const deliverableStatuses = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const dependencyTypes = [
  { value: "finish_to_start", label: "Finish-to-Start" },
  { value: "start_to_start", label: "Start-to-Start" },
  { value: "finish_to_finish", label: "Finish-to-Finish" },
  { value: "start_to_finish", label: "Start-to-Finish" },
];

const blankMilestone = (): MilestoneForm => ({
  id: "",
  name: "",
  description: "",
  planned_start_date: "",
  planned_end_date: "",
  actual_start_date: "",
  actual_end_date: "",
  planned_hours: "",
  planned_progress: "0",
  status: "pending",
  owner_resource_id: "",
  sort_order: "",
});

const blankDeliverable = (milestoneId = ""): DeliverableForm => ({
  id: "",
  milestone_id: milestoneId,
  title: "",
  description: "",
  acceptance_criteria: "",
  planned_completion_date: "",
  actual_completion_date: "",
  status: "pending",
  owner_resource_id: "",
});

const blankDependency = (): MilestoneDependencyForm => ({
  id: "",
  predecessor_milestone_id: "",
  dependency_type: "finish_to_start",
});

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const normalizeResourceList = (value: any): ResourceRecord[] => {
  const list = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
  return list.map((item: any) => ({
    id: item?.id ?? item?.resource_id ?? "",
    name: item?.name ?? "",
    position: item?.position ?? item?.job_title ?? null,
    availability_status: item?.availability_status ?? item?.availability ?? null,
  }));
};

const toMilestoneForm = (milestone: MilestoneRecord): MilestoneForm => ({
  id: String(milestone.id),
  name: milestone.name || milestone.title || "",
  description: milestone.description || "",
  planned_start_date: toDateInput(milestone.planned_start_date),
  planned_end_date: toDateInput(milestone.planned_end_date),
  actual_start_date: toDateInput(milestone.actual_start_date),
  actual_end_date: toDateInput(milestone.actual_end_date),
  planned_hours: String(milestone.planned_hours ?? ""),
  planned_progress: String(milestone.planned_progress ?? 0),
  status: milestone.status || "pending",
  owner_resource_id: milestone.owner_resource_id ? String(milestone.owner_resource_id) : "",
  sort_order: String(milestone.sort_order ?? ""),
});

const toDeliverableForm = (deliverable: DeliverableRecord, milestoneId: number | string): DeliverableForm => ({
  id: String(deliverable.id),
  milestone_id: String(milestoneId),
  title: deliverable.title || "",
  description: deliverable.description || "",
  acceptance_criteria: deliverable.acceptance_criteria || "",
  planned_completion_date: toDateInput(deliverable.planned_completion_date),
  actual_completion_date: toDateInput(deliverable.actual_completion_date),
  status: deliverable.status || "pending",
  owner_resource_id: deliverable.owner_resource_id ? String(deliverable.owner_resource_id) : "",
});

const toDependencyForm = (dependency: MilestoneDependencyRecord): MilestoneDependencyForm => ({
  id: String(dependency.id),
  predecessor_milestone_id: String(dependency.predecessor_milestone_id),
  dependency_type: dependency.dependency_type || "finish_to_start",
});

function MilestonesPage({ projectId }: Props) {
  const { t } = useTranslation();
  const id = projectId ?? getActiveProjectId() ?? "";

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [dependencies, setDependencies] = useState<MilestoneDependencyRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("");
  const selectedMilestone = useMemo(
    () => milestones.find((milestone) => String(milestone.id) === selectedMilestoneId) ?? null,
    [milestones, selectedMilestoneId]
  );
  const selectedMilestoneDependencies = useMemo(
    () => dependencies.filter((dependency) => String(dependency.successor_milestone_id) === selectedMilestoneId),
    [dependencies, selectedMilestoneId]
  );

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneForm>(blankMilestone());

  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
  const [deliverableForm, setDeliverableForm] = useState<DeliverableForm>(blankDeliverable());

  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [dependencyForm, setDependencyForm] = useState<MilestoneDependencyForm>(blankDependency());

  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "milestone"; milestone: MilestoneRecord }
    | { type: "deliverable"; milestoneId: string; deliverable: DeliverableRecord }
    | { type: "dependency"; dependency: MilestoneDependencyRecord }
    | null
  >(null);

  const loadData = async () => {
    if (!id) {
      setProject(null);
      setMilestones([]);
      setDependencies([]);
      setPerformance(null);
      setResources([]);
      setError(t("planning.noProject", { defaultValue: "No project selected." }));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const projectPromise = api.get<ProjectRecord>(`/projects/${id}`);
      const milestonesPromise = api.get<MilestoneRecord[]>(`/projects/${id}/milestones`);
      const dependenciesPromise = api.get<MilestoneDependencyRecord[]>(`/projects/${id}/milestone-dependencies`);
      const performancePromise = api.get<PerformanceResponse>(`/projects/${id}/planning-intelligence`).catch(() => null);
      const resourcesPromise = api.get<any>(`/resources?project_id=${id}`).catch(() => []);
      const [projectRes, milestonesRes, dependenciesRes, performanceRes, resourcesRes] = await Promise.all([
        projectPromise,
        milestonesPromise,
        dependenciesPromise,
        performancePromise,
        resourcesPromise,
      ]);

      if (!projectRes) {
        setProject(null);
        setMilestones([]);
        setDependencies([]);
        setPerformance(null);
        setResources([]);
        setError(t("planning.projectNotFound", { defaultValue: "Project not found." }));
        return;
      }

      setProject(projectRes);
      setMilestones(Array.isArray(milestonesRes) ? milestonesRes : []);
      setDependencies(Array.isArray(dependenciesRes) ? dependenciesRes : []);
      setPerformance(performanceRes ?? null);
      setResources(normalizeResourceList(resourcesRes));
      setSelectedMilestoneId((current) => {
        if (current && (Array.isArray(milestonesRes) ? milestonesRes.some((item) => String(item.id) === current) : false)) {
          return current;
        }
        return Array.isArray(milestonesRes) && milestonesRes[0] ? String(milestonesRes[0].id) : "";
      });
    } catch (e: any) {
      setDependencies([]);
      setPerformance(null);
      setError(e?.message || t("planning.loadFailed", { defaultValue: "Failed to load milestones." }));
      toast.error(e?.message || t("planning.loadFailed", { defaultValue: "Failed to load milestones." }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const resourceLabel = (resourceId?: number | null) => {
    if (!resourceId) return "—";
    return resources.find((resource) => String(resource.id) === String(resourceId))?.name || "—";
  };

  const milestoneStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">{t("planning.completed", { defaultValue: "Completed" })}</Badge>;
      case "in_progress":
        return <Badge variant="secondary">{t("planning.inProgress", { defaultValue: "In Progress" })}</Badge>;
      case "at_risk":
        return <Badge variant="destructive">{t("planning.atRisk", { defaultValue: "At Risk" })}</Badge>;
      default:
        return <Badge variant="outline">{t("planning.pending", { defaultValue: "Pending" })}</Badge>;
    }
  };

  const openCreateMilestone = () => {
    setMilestoneForm(blankMilestone());
    setMilestoneDialogOpen(true);
  };

  const openEditMilestone = (milestone: MilestoneRecord) => {
    setMilestoneForm(toMilestoneForm(milestone));
    setMilestoneDialogOpen(true);
  };

  const saveMilestone = async () => {
    if (!milestoneForm.name.trim()) {
      toast.error(t("planning.milestoneNameRequired", { defaultValue: "Milestone name is required." }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: milestoneForm.name.trim(),
        description: milestoneForm.description.trim() || null,
        planned_start_date: milestoneForm.planned_start_date || null,
        planned_end_date: milestoneForm.planned_end_date || null,
        actual_start_date: milestoneForm.actual_start_date || null,
        actual_end_date: milestoneForm.actual_end_date || null,
        planned_hours: Number(milestoneForm.planned_hours) || 0,
        planned_progress: Number(milestoneForm.planned_progress) || 0,
        status: milestoneForm.status || "pending",
        owner_resource_id: milestoneForm.owner_resource_id ? Number(milestoneForm.owner_resource_id) : null,
        sort_order: milestoneForm.sort_order ? Number(milestoneForm.sort_order) : null,
      };

      if (milestoneForm.id) {
        await api.put(`/projects/${id}/milestones/${milestoneForm.id}`, payload);
        toast.success(t("planning.milestoneUpdated", { defaultValue: "Milestone updated." }));
      } else {
        await api.post(`/projects/${id}/milestones`, payload);
        toast.success(t("planning.milestoneCreated", { defaultValue: "Milestone created." }));
      }

      setMilestoneDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || t("planning.milestoneSaveFailed", { defaultValue: "Failed to save milestone." }));
    } finally {
      setSaving(false);
    }
  };

  const openCreateDeliverable = () => {
    if (!selectedMilestone) return;
    setDeliverableForm(blankDeliverable(selectedMilestone.id));
    setDeliverableDialogOpen(true);
  };

  const openEditDeliverable = (milestone: MilestoneRecord, deliverable: DeliverableRecord) => {
    setDeliverableForm(toDeliverableForm(deliverable, milestone.id));
    setDeliverableDialogOpen(true);
  };

  const openCreateDependency = () => {
    if (!selectedMilestone) return;
    setDependencyForm(blankDependency());
    setDependencyDialogOpen(true);
  };

  const openEditDependency = (dependency: MilestoneDependencyRecord) => {
    setDependencyForm(toDependencyForm(dependency));
    setDependencyDialogOpen(true);
  };

  const saveDeliverable = async () => {
    if (!deliverableForm.title.trim()) {
      toast.error(t("planning.deliverableNameRequired", { defaultValue: "Deliverable title is required." }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: deliverableForm.title.trim(),
        description: deliverableForm.description.trim() || null,
        acceptance_criteria: deliverableForm.acceptance_criteria.trim() || null,
        planned_completion_date: deliverableForm.planned_completion_date || null,
        actual_completion_date: deliverableForm.actual_completion_date || null,
        status: deliverableForm.status || "pending",
        owner_resource_id: deliverableForm.owner_resource_id ? Number(deliverableForm.owner_resource_id) : null,
      };

      if (deliverableForm.id) {
        await api.put(`/deliverables/${deliverableForm.id}`, payload);
        toast.success(t("planning.deliverableUpdated", { defaultValue: "Deliverable updated." }));
      } else {
        await api.post(`/milestones/${deliverableForm.milestone_id}/deliverables`, payload);
        toast.success(t("planning.deliverableCreated", { defaultValue: "Deliverable created." }));
      }

      setDeliverableDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || t("planning.deliverableSaveFailed", { defaultValue: "Failed to save deliverable." }));
    } finally {
      setSaving(false);
    }
  };

  const saveDependency = async () => {
    if (!selectedMilestone) return;
    if (!dependencyForm.predecessor_milestone_id) {
      toast.error(t("planning.selectPredecessor", { defaultValue: "Please select a predecessor milestone." }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        predecessor_milestone_id: Number(dependencyForm.predecessor_milestone_id),
        successor_milestone_id: Number(selectedMilestone.id),
        dependency_type: dependencyForm.dependency_type || "finish_to_start",
      };

      if (dependencyForm.id) {
        await api.put(`/milestone-dependencies/${dependencyForm.id}`, payload);
        toast.success(t("planning.dependencyUpdated", { defaultValue: "Dependency updated." }));
      } else {
        await api.post(`/projects/${id}/milestone-dependencies`, payload);
        toast.success(t("planning.dependencyCreated", { defaultValue: "Dependency created." }));
      }

      setDependencyDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || t("planning.dependencySaveFailed", { defaultValue: "Failed to save dependency." }));
    } finally {
      setSaving(false);
    }
  };

  const dependencyTypeLabel = (value: string) => dependencyTypes.find((item) => item.value === value)?.label || value.replace(/_/g, " ");

  const milestonePerformanceMap = useMemo(() => {
    const map = new Map<string, MilestonePerformanceRecord>();
    (performance?.milestones ?? []).forEach((item) => {
      map.set(String(item.id), item);
    });
    return map;
  }, [performance]);

  const enrichedMilestones = useMemo(
    () =>
      milestones.map((milestone) => ({
        ...milestone,
        performance: milestonePerformanceMap.get(String(milestone.id)),
      })),
    [milestones, milestonePerformanceMap],
  );

  const selectedMilestonePerformance = selectedMilestone ? milestonePerformanceMap.get(String(selectedMilestone.id)) ?? null : null;
  const milestoneCount = enrichedMilestones.length;
  const deliverableCount = enrichedMilestones.reduce((total, milestone) => total + (milestone.deliverables?.length ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title={project ? `${project.name} Milestones` : t("planning.milestones", { defaultValue: "Milestones" })}
          subtitle={project ? `${milestoneCount} milestones · ${deliverableCount} deliverables` : t("planning.subtitle", { defaultValue: "Project planning baseline and milestones." })}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openCreateMilestone} disabled={!project}>
              <Plus className="h-4 w-4" /> {t("planning.newMilestone", { defaultValue: "New Milestone" })}
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers3 className="h-4 w-4" />
                {t("planning.timeline", { defaultValue: "Milestones Timeline" })}
              </div>
              <span className="text-xs text-muted-foreground">
                {t("planning.nestedDeliverables", { defaultValue: "Deliverables are nested under each milestone." })}
              </span>
            </div>

            {enrichedMilestones.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t("planning.noMilestones", { defaultValue: "No milestones yet." })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{t("planning.milestone", { defaultValue: "Milestone" })}</th>
                      <th className="px-4 py-2.5 font-medium">{t("planning.dates", { defaultValue: "Dates" })}</th>
                      <th className="px-4 py-2.5 font-medium">{t("planning.owner", { defaultValue: "Owner" })}</th>
                      <th className="px-4 py-2.5 font-medium">{t("planning.progress", { defaultValue: "Progress" })}</th>
                      <th className="px-4 py-2.5 font-medium">{t("planning.deliverables", { defaultValue: "Deliverables" })}</th>
                      <th className="px-4 py-2.5 font-medium">{t("planning.status", { defaultValue: "Status" })}</th>
                      <th className="px-4 py-2.5 font-medium text-right">{t("planning.actions", { defaultValue: "Actions" })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrichedMilestones.map((milestone) => {
                      const progress = Math.max(0, Math.min(100, Number(milestone.performance?.completion_percentage ?? milestone.planned_progress ?? 0)));
                      return (
                        <tr
                          key={milestone.id}
                          className="cursor-pointer transition-colors hover:bg-accent/40"
                          onClick={() => setSelectedMilestoneId(String(milestone.id))}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                                <CalendarDays className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">{milestone.name}</p>
                                <p className="line-clamp-1 text-xs text-muted-foreground">{milestone.description || "—"}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {milestone.performance?.blocked ? (
                                    <Badge variant="destructive">{t("planning.blocked", { defaultValue: "Blocked" })}</Badge>
                                  ) : milestone.performance?.ready_to_start ? (
                                    <Badge variant="default">{t("planning.ready", { defaultValue: "Ready" })}</Badge>
                                  ) : (
                                    <Badge variant="secondary">{t("planning.waiting", { defaultValue: "Waiting" })}</Badge>
                                  )}
                                  {milestone.performance?.blocking_reason && (
                                    <span className="text-[11px] text-muted-foreground">{milestone.performance.blocking_reason}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <div>{formatDate(milestone.planned_start_date)} → {formatDate(milestone.planned_end_date)}</div>
                            <div>{t("planning.actual", { defaultValue: "Actual" })}: {formatDate(milestone.actual_start_date)} → {formatDate(milestone.actual_end_date)}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{resourceLabel(milestone.owner_resource_id ?? null)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full rounded-full", progress >= 100 ? "bg-emerald-500" : progress >= 60 ? "bg-amber-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-muted-foreground">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {milestone.deliverables_count ?? milestone.deliverables?.length ?? 0}
                          </td>
                          <td className="px-4 py-3">{milestoneStatusBadge(milestone.status)}</td>
                          <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="xs" onClick={() => setSelectedMilestoneId(String(milestone.id))}>
                                {t("app.open", { defaultValue: "Open" })}
                              </Button>
                              <Button variant="outline" size="icon-sm" onClick={() => openEditMilestone(milestone)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ type: "milestone", milestone })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={Boolean(selectedMilestone)} onOpenChange={(open) => !open && setSelectedMilestoneId("")}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
          {selectedMilestone && (
            <>
              <SheetHeader className="flex flex-row items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <SheetTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="truncate">{selectedMilestone.name}</span>
                  </SheetTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedMilestone.description || t("planning.noDescription", { defaultValue: "No description provided." })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditMilestone(selectedMilestone)}>
                    <Pencil className="h-4 w-4" />
                    {t("app.edit", { defaultValue: "Edit" })}
                  </Button>
                  <Button variant="outline" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ type: "milestone", milestone: selectedMilestone })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={() => setSelectedMilestoneId("")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard label={t("planning.plannedDates", { defaultValue: "Planned Dates" })} value={`${formatDate(selectedMilestone.planned_start_date)} → ${formatDate(selectedMilestone.planned_end_date)}`} />
                  <InfoCard label={t("planning.actualDates", { defaultValue: "Actual Dates" })} value={`${formatDate(selectedMilestone.actual_start_date)} → ${formatDate(selectedMilestone.actual_end_date)}`} />
                  <InfoCard label={t("planning.plannedHours", { defaultValue: "Planned Hours" })} value={String(selectedMilestone.planned_hours ?? 0)} />
                  <InfoCard label={t("planning.owner", { defaultValue: "Owner" })} value={resourceLabel(selectedMilestone.owner_resource_id ?? null)} />
                  <InfoCard label={t("planning.status", { defaultValue: "Status" })} value={selectedMilestone.status.replace(/_/g, " ")} />
                  <InfoCard
                    label={t("planning.readiness", { defaultValue: "Readiness" })}
                    value={selectedMilestonePerformance?.blocked
                      ? t("planning.blocked", { defaultValue: "Blocked" })
                      : selectedMilestonePerformance?.ready_to_start
                      ? t("planning.ready", { defaultValue: "Ready" })
                      : t("planning.waiting", { defaultValue: "Waiting" })}
                  />
                  <InfoCard
                    label={t("planning.dependenciesSummary", { defaultValue: "Dependencies" })}
                    value={`${selectedMilestonePerformance?.dependencies_completed ?? 0} / ${((selectedMilestonePerformance?.dependencies_completed ?? 0) + (selectedMilestonePerformance?.dependencies_remaining ?? 0))}`}
                  />
                  <InfoCard
                    label={t("planning.issues", { defaultValue: "Issues" })}
                    value={`${selectedMilestonePerformance?.completed_issues ?? 0} done / ${selectedMilestonePerformance?.remaining_issues ?? 0} remaining`}
                  />
                  <InfoCard
                    label={t("planning.storyPoints", { defaultValue: "Story Points" })}
                    value={`${selectedMilestonePerformance?.completed_story_points ?? 0} done / ${selectedMilestonePerformance?.remaining_story_points ?? 0} remaining`}
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t("planning.executiveIntelligence", { defaultValue: "Executive Intelligence" })}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("planning.executiveIntelligenceHint", { defaultValue: "Forecast, health, and dependency impact are calculated by the backend." })}
                      </p>
                    </div>
                    <Badge variant={selectedMilestonePerformance?.blocked ? "destructive" : selectedMilestonePerformance?.traffic_light === "Red" ? "destructive" : selectedMilestonePerformance?.traffic_light === "Yellow" ? "secondary" : "default"}>
                      {selectedMilestonePerformance?.health_status || selectedMilestonePerformance?.traffic_light || t("planning.green", { defaultValue: "Green" })}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <InfoCard label={t("planning.forecastFinish", { defaultValue: "Forecast Finish" })} value={formatDate(selectedMilestonePerformance?.forecast_finish)} />
                    <InfoCard label={t("planning.mainCause", { defaultValue: "Main Cause" })} value={selectedMilestonePerformance?.main_cause || "—"} />
                    <InfoCard
                      label={t("planning.blockingMilestones", { defaultValue: "Blocking Milestones" })}
                      value={(selectedMilestonePerformance?.blocking_milestones ?? []).map((item) => item.name).join(", ") || "—"}
                    />
                    <InfoCard
                      label={t("planning.estimatedDelay", { defaultValue: "Estimated Delay" })}
                      value={`${selectedMilestonePerformance?.dependency_impact?.estimated_delay_days ?? 0} days`}
                    />
                    <InfoCard
                      label={t("planning.criticalDependency", { defaultValue: "Critical Dependency" })}
                      value={selectedMilestonePerformance?.dependency_impact?.critical_dependency?.name || "—"}
                    />
                    <InfoCard
                      label={t("planning.activityTimeline", { defaultValue: "Activity Timeline" })}
                      value={`${selectedMilestonePerformance?.activity_timeline?.length ?? 0} events`}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t("planning.dependencies", { defaultValue: "Dependencies" })}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("planning.dependenciesHint", { defaultValue: "Milestones that must be completed before this one can begin." })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={openCreateDependency}
                      disabled={milestones.filter((milestone) => String(milestone.id) !== selectedMilestoneId).length === 0}
                    >
                      <Plus className="h-4 w-4" /> {t("planning.addDependency", { defaultValue: "Add Dependency" })}
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedMilestoneDependencies.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("planning.noDependencies", { defaultValue: "No dependencies yet." })}
                      </div>
                    ) : (
                      selectedMilestoneDependencies.map((dependency) => (
                        <div key={dependency.id} className="rounded-lg border border-border bg-background px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{dependency.predecessor_milestone.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{dependencyTypeLabel(dependency.dependency_type)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{t("planning.predecessor", { defaultValue: "Predecessor" })}</Badge>
                              <Button variant="ghost" size="icon-sm" onClick={() => openEditDependency(dependency)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleteTarget({ type: "dependency", dependency })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span>{t("planning.successor", { defaultValue: "Successor" })}: {selectedMilestone.name}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t("planning.deliverables", { defaultValue: "Deliverables" })}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("planning.deliverableHint", { defaultValue: "Business outputs nested under this milestone." })}
                        {selectedMilestonePerformance?.deliverable_progress && (
                          <span className="ml-2 font-medium text-foreground">
                            {selectedMilestonePerformance.deliverable_progress.progress_pct}% complete
                          </span>
                        )}
                      </p>
                    </div>
                    <Button size="sm" className="gap-1.5" onClick={openCreateDeliverable}>
                      <Plus className="h-4 w-4" /> {t("planning.newDeliverable", { defaultValue: "New Deliverable" })}
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(selectedMilestone.deliverables ?? []).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("planning.noDeliverables", { defaultValue: "No deliverables yet." })}
                      </div>
                    ) : (
                      (selectedMilestone.deliverables ?? []).map((deliverable) => (
                        <div key={deliverable.id} className="rounded-lg border border-border bg-background px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{deliverable.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {deliverable.description || deliverable.acceptance_criteria || t("planning.noDescription", { defaultValue: "No description provided." })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {deliverable.status === "completed" ? (
                                <Badge variant="default">{deliverable.status}</Badge>
                              ) : deliverable.status === "in_progress" ? (
                                <Badge variant="secondary">{deliverable.status}</Badge>
                              ) : (
                                <Badge variant="outline">{deliverable.status}</Badge>
                              )}
                              <Button variant="ghost" size="icon-sm" onClick={() => openEditDeliverable(selectedMilestone, deliverable)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleteTarget({ type: "deliverable", milestoneId: String(selectedMilestone.id), deliverable })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                            <span>{t("planning.plannedCompletion", { defaultValue: "Planned completion" })}: {formatDate(deliverable.planned_completion_date)}</span>
                            <span>{t("planning.actualCompletion", { defaultValue: "Actual completion" })}: {formatDate(deliverable.actual_completion_date)}</span>
                            <span>{t("planning.owner", { defaultValue: "Owner" })}: {deliverable.owner_resource?.name || resourceLabel(deliverable.owner_resource_id ?? null)}</span>
                            <span>{t("planning.linkedMilestone", { defaultValue: "Milestone" })}: {selectedMilestone.name}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{milestoneForm.id ? t("planning.editMilestone", { defaultValue: "Edit Milestone" }) : t("planning.newMilestone", { defaultValue: "New Milestone" })}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <Field label={t("planning.name", { defaultValue: "Name" })}>
              <Input value={milestoneForm.name} autoFocus onChange={(e) => setMilestoneForm((current) => ({ ...current, name: e.target.value }))} />
            </Field>
            <Field label={t("planning.owner", { defaultValue: "Owner" })}>
              <Select value={milestoneForm.owner_resource_id || "__none__"} onValueChange={(value) => setMilestoneForm((current) => ({ ...current, owner_resource_id: value === "__none__" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("planning.selectOwner", { defaultValue: "Select owner" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("planning.none", { defaultValue: "None" })}</SelectItem>
                  {resources.map((resource) => (
                    <SelectItem key={resource.id} value={String(resource.id)}>
                      {resource.name}{resource.position ? ` · ${resource.position}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("planning.plannedStart", { defaultValue: "Planned Start" })}>
              <Input type="date" value={milestoneForm.planned_start_date} onChange={(e) => setMilestoneForm((current) => ({ ...current, planned_start_date: e.target.value }))} />
            </Field>
            <Field label={t("planning.plannedEnd", { defaultValue: "Planned End" })}>
              <Input type="date" value={milestoneForm.planned_end_date} onChange={(e) => setMilestoneForm((current) => ({ ...current, planned_end_date: e.target.value }))} />
            </Field>
            <Field label={t("planning.actualStart", { defaultValue: "Actual Start" })}>
              <Input type="date" value={milestoneForm.actual_start_date} onChange={(e) => setMilestoneForm((current) => ({ ...current, actual_start_date: e.target.value }))} />
            </Field>
            <Field label={t("planning.actualEnd", { defaultValue: "Actual End" })}>
              <Input type="date" value={milestoneForm.actual_end_date} onChange={(e) => setMilestoneForm((current) => ({ ...current, actual_end_date: e.target.value }))} />
            </Field>
            <Field label={t("planning.plannedHours", { defaultValue: "Planned Hours" })}>
              <Input type="number" value={milestoneForm.planned_hours} onChange={(e) => setMilestoneForm((current) => ({ ...current, planned_hours: e.target.value }))} />
            </Field>
            <Field label={t("planning.plannedProgress", { defaultValue: "Planned Progress %" })}>
              <Input type="number" value={milestoneForm.planned_progress} onChange={(e) => setMilestoneForm((current) => ({ ...current, planned_progress: e.target.value }))} />
            </Field>
            <Field label={t("planning.sortOrder", { defaultValue: "Sort Order" })}>
              <Input type="number" value={milestoneForm.sort_order} onChange={(e) => setMilestoneForm((current) => ({ ...current, sort_order: e.target.value }))} />
            </Field>
            <Field label={t("planning.status", { defaultValue: "Status" })}>
              <Select value={milestoneForm.status} onValueChange={(value) => setMilestoneForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {milestoneStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("planning.description", { defaultValue: "Description" })} className="sm:col-span-2">
              <Textarea rows={4} value={milestoneForm.description} onChange={(e) => setMilestoneForm((current) => ({ ...current, description: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialogOpen(false)}>
              {t("app.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={saveMilestone} disabled={saving}>
              {saving ? t("app.saving", { defaultValue: "Saving..." }) : t("app.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliverableDialogOpen} onOpenChange={setDeliverableDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{deliverableForm.id ? t("planning.editDeliverable", { defaultValue: "Edit Deliverable" }) : t("planning.newDeliverable", { defaultValue: "New Deliverable" })}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <Field label={t("planning.title", { defaultValue: "Title" })} className="sm:col-span-2">
              <Input value={deliverableForm.title} autoFocus onChange={(e) => setDeliverableForm((current) => ({ ...current, title: e.target.value }))} />
            </Field>
            <Field label={t("planning.owner", { defaultValue: "Owner" })}>
              <Select value={deliverableForm.owner_resource_id || "__none__"} onValueChange={(value) => setDeliverableForm((current) => ({ ...current, owner_resource_id: value === "__none__" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("planning.selectOwner", { defaultValue: "Select owner" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("planning.none", { defaultValue: "None" })}</SelectItem>
                  {resources.map((resource) => (
                    <SelectItem key={resource.id} value={String(resource.id)}>
                      {resource.name}{resource.position ? ` · ${resource.position}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("planning.status", { defaultValue: "Status" })}>
              <Select value={deliverableForm.status} onValueChange={(value) => setDeliverableForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deliverableStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("planning.plannedCompletion", { defaultValue: "Planned Completion" })}>
              <Input type="date" value={deliverableForm.planned_completion_date} onChange={(e) => setDeliverableForm((current) => ({ ...current, planned_completion_date: e.target.value }))} />
            </Field>
            <Field label={t("planning.actualCompletion", { defaultValue: "Actual Completion" })}>
              <Input type="date" value={deliverableForm.actual_completion_date} onChange={(e) => setDeliverableForm((current) => ({ ...current, actual_completion_date: e.target.value }))} />
            </Field>
            <Field label={t("planning.description", { defaultValue: "Description" })} className="sm:col-span-2">
              <Textarea rows={3} value={deliverableForm.description} onChange={(e) => setDeliverableForm((current) => ({ ...current, description: e.target.value }))} />
            </Field>
            <Field label={t("planning.acceptanceCriteria", { defaultValue: "Acceptance Criteria" })} className="sm:col-span-2">
              <Textarea rows={3} value={deliverableForm.acceptance_criteria} onChange={(e) => setDeliverableForm((current) => ({ ...current, acceptance_criteria: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverableDialogOpen(false)}>
              {t("app.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={saveDeliverable} disabled={saving}>
              {saving ? t("app.saving", { defaultValue: "Saving..." }) : t("app.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dependencyDialogOpen} onOpenChange={setDependencyDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dependencyForm.id ? t("planning.editDependency", { defaultValue: "Edit Dependency" }) : t("planning.newDependency", { defaultValue: "New Dependency" })}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <Field label={t("planning.predecessor", { defaultValue: "Predecessor" })} className="sm:col-span-2">
              <Select value={dependencyForm.predecessor_milestone_id || "__none__"} onValueChange={(value) => setDependencyForm((current) => ({ ...current, predecessor_milestone_id: value === "__none__" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("planning.selectPredecessor", { defaultValue: "Select predecessor" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("planning.none", { defaultValue: "None" })}</SelectItem>
                  {milestones
                    .filter((milestone) => String(milestone.id) !== selectedMilestoneId)
                    .map((milestone) => (
                      <SelectItem key={milestone.id} value={String(milestone.id)}>
                        {milestone.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("planning.successor", { defaultValue: "Successor" })} className="sm:col-span-2">
              <Input value={selectedMilestone?.name || ""} readOnly />
            </Field>
            <Field label={t("planning.dependencyType", { defaultValue: "Dependency Type" })} className="sm:col-span-2">
              <Select value={dependencyForm.dependency_type} onValueChange={(value) => setDependencyForm((current) => ({ ...current, dependency_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dependencyTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDependencyDialogOpen(false)}>
              {t("app.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={saveDependency} disabled={saving}>
              {saving ? t("app.saving", { defaultValue: "Saving..." }) : t("app.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.type === "dependency"
            ? t("planning.deleteDependency", { defaultValue: "Delete Dependency" })
            : deleteTarget?.type === "deliverable"
            ? t("planning.deleteDeliverable", { defaultValue: "Delete Deliverable" })
            : t("planning.deleteMilestone", { defaultValue: "Delete Milestone" })
        }
        description={
          deleteTarget?.type === "dependency"
            ? t("planning.deleteDependencyConfirm", {
                defaultValue: `Delete dependency from "${deleteTarget.dependency.predecessor_milestone.name}" to "${selectedMilestone?.name || ""}"?`,
              })
            : deleteTarget?.type === "deliverable"
            ? t("planning.deleteDeliverableConfirm", {
                defaultValue: `Delete deliverable "${deleteTarget.deliverable.title}"?`,
              })
            : t("planning.deleteMilestoneConfirm", {
                defaultValue: `Delete milestone "${deleteTarget?.milestone.name || ""}"?`,
              })
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === "milestone") {
              await api.del(`/projects/${id}/milestones/${deleteTarget.milestone.id}`);
              if (selectedMilestoneId === String(deleteTarget.milestone.id)) {
                setSelectedMilestoneId("");
              }
              toast.success(t("planning.milestoneDeleted", { defaultValue: "Milestone deleted." }));
            } else if (deleteTarget.type === "dependency") {
              await api.del(`/milestone-dependencies/${deleteTarget.dependency.id}`);
              toast.success(t("planning.dependencyDeleted", { defaultValue: "Dependency deleted." }));
            } else {
              await api.del(`/deliverables/${deleteTarget.deliverable.id}`);
              toast.success(t("planning.deliverableDeleted", { defaultValue: "Deliverable deleted." }));
            }
            setDeleteTarget(null);
            await loadData();
          } catch (e: any) {
            toast.error(e?.message || t("planning.deleteFailed", { defaultValue: "Delete failed." }));
          }
        }}
      />
    </div>
  );
}

function Field({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export default MilestonesPage;
