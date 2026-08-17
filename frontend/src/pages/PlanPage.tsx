import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Loader2,
  Target,
  Users,
  Activity,
  FileClock,
  Sparkles,
  Save,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Archive,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  GanttChart,
  Network,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/SelectEnhanced";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/Sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { api, getActiveProjectId } from "../lib/api";
import { cn } from "../lib/utils";

type PlanTab = "overview" | "baseline" | "milestones" | "deliverables" | "dependencies" | "resources" | "timeline";

interface ProjectRecord {
  id: string | number;
  name: string;
  key?: string;
  status?: string;
  classification?: string;
}

interface PlanningBaselineRecord {
  id: number;
  project_id: number;
  planned_duration_days: number;
  planned_hours: number;
  planned_resources_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PlanningSummary {
  health?: { score: number; state: string; tone: "success" | "warning" | "danger" };
  executive_score?: number;
  executive_summary?: { headline?: string; attention?: string[]; summary?: string };
  completion_pct?: number;
  forecast?: {
    original_finish?: string | null;
    forecast_finish?: string | null;
    delay_days?: number;
    confidence?: string;
    main_cause?: string;
  };
  traffic_light?: "Green" | "Yellow" | "Red";
  planned_start?: string | null;
  actual_start?: string | null;
  planned_finish?: string | null;
  forecast_finish?: string | null;
  actual_finish?: string | null;
  planned_hours?: number;
  actual_hours?: number;
  remaining_hours?: number;
  hours_variance?: number;
  blocked_milestones?: number;
  open_risks?: number;
  blocked_project?: boolean;
  blocking_milestone?: { id: number; name: string; title?: string } | null;
  blocking_reason?: string | null;
  milestone_completion_pct?: number;
  issue_completion_pct?: number;
  completed_issues?: number;
  remaining_issues?: number;
  completed_story_points?: number;
  remaining_story_points?: number;
  overdue_milestones?: number;
  critical_path_length?: number;
  critical_path?: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
  critical_dependencies?: {
    predecessor_milestone: { id: number; name: string; title?: string; status?: string; sort_order?: number };
    successor_milestone: { id: number; name: string; title?: string; status?: string; sort_order?: number };
    dependency_type: string;
  }[];
  projects_needing_attention?: number;
  expected_delays?: number;
  total_blocked_work?: number;
  health_breakdown?: {
    overall: number;
    state: "Green" | "Yellow" | "Red";
    tone: "success" | "warning" | "danger";
    schedule: number;
    budget: number;
    completion: number;
    dependencies: number;
    deliverables: number;
    resources: number;
    risks: number;
  };
}

interface MilestoneDeliverable {
  id: number;
  milestone_id?: number;
  title: string;
  description?: string | null;
  status: string;
  planned_completion_date?: string | null;
  actual_completion_date?: string | null;
  owner_resource_id?: number | null;
  owner_resource?: { id: number | string; name: string; position?: string | null } | null;
  late?: boolean;
  blocked?: boolean;
  health?: string;
  progress_pct?: number;
  linked_issues_count?: number;
  linked_issues?: { id: number; key: string; title: string; status?: string | null; done?: boolean }[];
}

interface PlanningDependencyRecord {
  id: number;
  predecessor_milestone_id: number;
  successor_milestone_id: number;
  dependency_type: string;
  predecessor_milestone: { id: number; name: string; title?: string; status?: string; sort_order?: number };
  successor_milestone: { id: number; name: string; title?: string; status?: string; sort_order?: number };
}

function getValidDependencyId(id: unknown): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

interface PlanningResource {
  id: number;
  resource_id?: number;
  name: string;
  position?: string | null;
  role?: string | null;
  availability_status?: string | null;
  weekly_capacity?: number;
  allocation_pct?: number;
  allocated_hours?: number;
  utilization_percentage?: number;
  overloaded?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
}

interface ResourcePickerOption {
  id: number;
  name: string;
  position?: string | null;
}

interface AuditEvent {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at?: string | null;
}

interface PlanningMilestone {
  id: number;
  project_id: number;
  name: string;
  description?: string | null;
  status: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  planned_hours?: number;
  actual_hours?: number;
  hours_variance?: number;
  planned_progress?: number;
  planned_progress_pct?: number;
  actual_progress_pct?: number;
  forecast_progress_pct?: number;
  completion_percentage?: number;
  variance_percentage?: number;
  progress_variance_pct?: number;
  schedule_variance_days?: number;
  delay_days?: number;
  health_status?: string;
  traffic_light?: string;
  risk_level?: string;
  ready_to_start?: boolean;
  blocked?: boolean;
  blocking_reason?: string | null;
  dependencies_completed?: number;
  dependencies_remaining?: number;
  blocking_milestones?: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
  forecast_finish?: string | null;
  forecast_confidence?: string | null;
  main_cause?: string | null;
  owner_resource?: { id: number; name: string; position?: string | null; availability_status?: string | null } | null;
  owner_resource_id?: number | null;
  sort_order?: number;
  deliverables?: MilestoneDeliverable[];
  deliverables_count?: number;
  issues?: { id: number; key: string; title: string; done?: boolean; status?: string; story_points?: number; assignee?: string | null; due_date?: string | null; milestone_id?: number | null; deliverable_id?: number | null }[];
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
    available_resources?: PlanningResource[];
    suggested_replacements?: PlanningResource[];
  };
  activity_timeline?: AuditEvent[];
  critical_path?: boolean;
}

interface IntelligenceResponse {
  project: ProjectRecord;
  summary: PlanningSummary;
  health_breakdown?: PlanningSummary["health_breakdown"];
  ceo_summary?: {
    overall_portfolio_health: number;
    projects_needing_attention: number;
    critical_milestones: number;
    expected_delays: number;
    total_blocked_work: number;
    summary: string;
  };
  forecast?: PlanningSummary["forecast"];
  critical_path?: {
    milestones: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
    critical_dependencies: PlanningDependencyRecord[];
    critical_chain_length: number;
    non_critical_milestones: { id: number; name: string; title?: string; status?: string; sort_order?: number }[];
  };
  resource_planning?: {
    resources: PlanningResource[];
    overloaded_resources: PlanningResource[];
    available_resources: PlanningResource[];
    suggested_replacement_candidates: PlanningResource[];
  };
  audit_trail?: AuditEvent[];
  milestones?: PlanningMilestone[];
  plan_vs_actual?: PlanningMilestone[];
  baseline?: {
    planned_duration_days: number;
    planned_hours: number;
    planned_resources_count: number;
    planning: { planned_hours: number; actual_hours: number; variance: number };
    dates: { planned_finish?: string | null; forecast_finish?: string | null; variance_days: number };
    resources: { planned_count: number; actual_count: number };
  };
}

interface Props {
  projectId?: string;
  embedded?: boolean;
}

interface BaselineForm {
  planned_duration_days: string;
  planned_hours: string;
  planned_resources_count: string;
}

const blankBaseline = (): BaselineForm => ({
  planned_duration_days: "",
  planned_hours: "",
  planned_resources_count: "",
});

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatHours = (value?: number | null) => `${Number(value ?? 0).toFixed(1)}h`;
const formatDays = (value?: number | null) => {
  const amount = Number(value ?? 0);
  if (!amount) return "0d";
  return amount > 0 ? `+${amount}d` : `${amount}d`;
};
const formatPercent = (value?: number | null) => `${Math.round(Number(value ?? 0))}%`;

const trafficTone = (value?: string | null) => {
  if (value === "Red") return "destructive";
  if (value === "Yellow") return "secondary";
  return "default";
};

const createEmptyIntelligence = (): IntelligenceResponse => ({
  project: { id: 0, name: "", key: "" },
  summary: {
    executive_summary: { attention: [], headline: "", summary: "" },
    completion_pct: 0,
    forecast: { original_finish: null, forecast_finish: null, delay_days: 0, confidence: "Low", main_cause: null },
    traffic_light: "Green",
    planned_start: null,
    actual_start: null,
    planned_finish: null,
    forecast_finish: null,
    actual_finish: null,
    planned_hours: 0,
    actual_hours: 0,
    remaining_hours: 0,
    hours_variance: 0,
    blocked_milestones: 0,
    open_risks: 0,
    blocked_project: false,
    blocking_milestone: null,
    blocking_reason: null,
    milestone_completion_pct: 0,
    issue_completion_pct: 0,
    completed_issues: 0,
    remaining_issues: 0,
    completed_story_points: 0,
    remaining_story_points: 0,
    overdue_milestones: 0,
    critical_path_length: 0,
    critical_path: [],
    critical_dependencies: [],
    projects_needing_attention: 0,
    expected_delays: 0,
    total_blocked_work: 0,
  },
  health_breakdown: { overall: 0, state: "Green", tone: "success", schedule: 0, budget: 0, completion: 0, dependencies: 0, deliverables: 0, resources: 0, risks: 0 },
  ceo_summary: { overall_portfolio_health: 0, projects_needing_attention: 0, critical_milestones: 0, expected_delays: 0, total_blocked_work: 0, summary: "" },
  forecast: { original_finish: null, forecast_finish: null, delay_days: 0, confidence: "Low", main_cause: null },
  critical_path: { milestones: [], critical_dependencies: [], critical_chain_length: 0, non_critical_milestones: [] },
  resource_planning: { resources: [], overloaded_resources: [], available_resources: [], suggested_replacement_candidates: [] },
  audit_trail: [],
  milestones: [],
  plan_vs_actual: [],
  baseline: {
    planned_duration_days: 0,
    planned_hours: 0,
    planned_resources_count: 0,
    planning: { planned_hours: 0, actual_hours: 0, variance: 0 },
    dates: { planned_finish: null, forecast_finish: null, variance_days: 0 },
    resources: { planned_count: 0, actual_count: 0 },
  },
});

function PlanPage({ projectId, embedded = false }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const id = projectId ?? getActiveProjectId() ?? "";
  const containerClass = embedded ? "space-y-5" : "h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8";

  const queryParams = new URLSearchParams(location.search);
  const tabParam = queryParams.get("tab");
  const normalizedTab = tabParam === "resource-planning" ? "resources" : tabParam;
  const initialTab = (normalizedTab as PlanTab) || "overview";

  const [activeTab, setActiveTab] = useState<PlanTab>(initialTab);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResponse>(createEmptyIntelligence());
  const [baselineId, setBaselineId] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<BaselineForm>(blankBaseline());
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("");

  // CRUD Dialog States
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<PlanningMilestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    description: "",
    status: "pending",
    planned_start_date: "",
    planned_end_date: "",
    planned_hours: "0",
    planned_budget: "0",
    owner_resource_id: "",
  });

  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<MilestoneDeliverable | null>(null);
  const [deliverableForm, setDeliverableForm] = useState({
    milestone_id: "",
    title: "",
    description: "",
    status: "pending",
    planned_completion_date: "",
    owner_resource_id: "",
  });

  const [dependencies, setDependencies] = useState<PlanningDependencyRecord[]>([]);
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [editingDependency, setEditingDependency] = useState<PlanningDependencyRecord | null>(null);
  const [dependencyForm, setDependencyForm] = useState({
    id: null as number | null,
    predecessor_milestone_id: "",
    successor_milestone_id: "",
    dependency_type: "finish_to_start",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "milestone" | "deliverable" | "dependency" | "baseline" | "resource"; id: number; name: string } | null>(null);

  const [projectResources, setProjectResources] = useState<PlanningResource[]>([]);
  const [resourcePickerOptions, setResourcePickerOptions] = useState<ResourcePickerOption[]>([]);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<PlanningResource | null>(null);
  const [resourceForm, setResourceForm] = useState({
    resource_id: "",
    role: "",
    allocation_pct: "100",
    allocated_hours: "",
    start_date: "",
    end_date: "",
  });
  const [resourceSearch, setResourceSearch] = useState("");

  const loadData = async () => {
    if (!id) {
      setError(t("planning.noProject", { defaultValue: "No project selected." }));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [projectRes, baselineRes, intelligenceRes, dependenciesRes, projectResourcesRes] = await Promise.all([
        api.get<ProjectRecord>(`/projects/${id}`),
        api.get<PlanningBaselineRecord | null>(`/projects/${id}/planning-baseline`),
        api.get<IntelligenceResponse>(`/projects/${id}/planning-intelligence`),
        api.get<PlanningDependencyRecord[]>(`/projects/${id}/milestone-dependencies`),
        api.get<PlanningResource[]>(`/projects/${id}/resources`),
      ]);

      if (!projectRes) {
        setProject(null);
        setIntelligence(createEmptyIntelligence());
        setError(t("planning.projectNotFound", { defaultValue: "Project not found." }));
        return;
      }

      setProject(projectRes);

      if (baselineRes) {
        setBaselineId(baselineRes.id);
        setBaseline({
          planned_duration_days: String(baselineRes.planned_duration_days ?? ""),
          planned_hours: String(baselineRes.planned_hours ?? ""),
          planned_resources_count: String(baselineRes.planned_resources_count ?? ""),
        });
      } else if (intelligenceRes?.baseline) {
        setBaselineId(null);
        setBaseline({
          planned_duration_days: String(intelligenceRes.baseline.planned_duration_days ?? ""),
          planned_hours: String(intelligenceRes.baseline.planned_hours ?? ""),
          planned_resources_count: String(intelligenceRes.baseline.planned_resources_count ?? ""),
        });
      }

      if (intelligenceRes) {
        setIntelligence(intelligenceRes);
      }

      setDependencies(Array.isArray(dependenciesRes) ? dependenciesRes : []);
      setProjectResources(Array.isArray(projectResourcesRes) ? projectResourcesRes : []);
    } catch (e: any) {
      setIntelligence(createEmptyIntelligence());
      setDependencies([]);
      setProjectResources([]);
      setError(e?.message || t("planning.loadFailed", { defaultValue: "Failed to load planning intelligence." }));
      toast.error(e?.message || t("planning.loadFailed", { defaultValue: "Failed to load planning intelligence." }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const handleTabChange = (tab: PlanTab) => {
    setActiveTab(tab);
    navigate(`/projects/${id}/plan?tab=${tab}`, { replace: true });
  };

  const handleStartPlanning = async () => {
    setInitializing(true);
    try {
      await api.post(`/projects/${id}/start-planning`);
      toast.success("Planning workspace initialized.");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to start planning.");
    } finally {
      setInitializing(false);
    }
  };

  const saveBaseline = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const payload = {
        planned_duration_days: Number(baseline.planned_duration_days) || 0,
        planned_hours: Number(baseline.planned_hours) || 0,
        planned_resources_count: Number(baseline.planned_resources_count) || 0,
      };

      const result = await api.put<PlanningBaselineRecord>(`/projects/${project.id}/planning-baseline`, payload);
      if (result) {
        setBaselineId(result.id);
      }
      toast.success("Planning baseline saved.");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save baseline.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBaseline = async () => {
    if (!project || !baselineId) return;
    try {
      await api.del(`/projects/${project.id}/planning-baseline`);
      toast.success("Planning baseline deleted.");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete baseline.");
    }
  };

  // Milestone CRUD
  const openCreateMilestone = () => {
    setEditingMilestone(null);
    setMilestoneForm({
      name: "",
      description: "",
      status: "pending",
      planned_start_date: new Date().toISOString().split("T")[0],
      planned_end_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      planned_hours: "80",
      owner_resource_id: "",
    });
    setMilestoneDialogOpen(true);
  };

  const openEditMilestone = (m: PlanningMilestone) => {
    setEditingMilestone(m);
    setMilestoneForm({
      name: m.name || "",
      description: m.description || "",
      status: m.status || "pending",
      planned_start_date: m.planned_start_date ? m.planned_start_date.split("T")[0] : "",
      planned_end_date: m.planned_end_date ? m.planned_end_date.split("T")[0] : "",
      planned_hours: String(m.planned_hours ?? 0),
      owner_resource_id: m.owner_resource_id ? String(m.owner_resource_id) : "",
    });
    setMilestoneDialogOpen(true);
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.name.trim()) {
      toast.error("Milestone name is required.");
      return;
    }
    try {
      const payload = {
        name: milestoneForm.name.trim(),
        description: milestoneForm.description.trim() || null,
        status: milestoneForm.status,
        planned_start_date: milestoneForm.planned_start_date || null,
        planned_end_date: milestoneForm.planned_end_date || null,
        planned_hours: Number(milestoneForm.planned_hours) || 0,
        owner_resource_id: milestoneForm.owner_resource_id ? Number(milestoneForm.owner_resource_id) : null,
      };

      if (editingMilestone) {
        await api.put(`/projects/${id}/milestones/${editingMilestone.id}`, payload);
        toast.success("Milestone updated.");
      } else {
        await api.post(`/projects/${id}/milestones`, payload);
        toast.success("Milestone created.");
      }
      setMilestoneDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save milestone.");
    }
  };

  const handleDuplicateMilestone = async (m: PlanningMilestone) => {
    try {
      const payload = {
        name: `${m.name} (Copy)`,
        description: m.description || null,
        status: "pending",
        planned_start_date: m.planned_start_date || null,
        planned_end_date: m.planned_end_date || null,
        planned_hours: m.planned_hours || 0,
        owner_resource_id: m.owner_resource_id || null,
      };
      await api.post(`/projects/${id}/milestones`, payload);
      toast.success("Milestone duplicated.");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to duplicate milestone.");
    }
  };

  const handleToggleArchiveMilestone = async (m: PlanningMilestone) => {
    try {
      const newStatus = m.status === "archived" ? "pending" : "archived";
      await api.put(`/projects/${id}/milestones/${m.id}`, { status: newStatus });
      toast.success(newStatus === "archived" ? "Milestone archived." : "Milestone restored.");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update milestone status.");
    }
  };

  // Deliverable CRUD
  const openCreateDeliverable = (milestoneId?: number) => {
    setEditingDeliverable(null);
    setDeliverableForm({
      milestone_id: milestoneId ? String(milestoneId) : (rows[0] ? String(rows[0].id) : ""),
      title: "",
      description: "",
      status: "pending",
      planned_completion_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      owner_resource_id: "",
    });
    setDeliverableDialogOpen(true);
  };

  const openEditDeliverable = (d: MilestoneDeliverable) => {
    setEditingDeliverable(d);
    setDeliverableForm({
      milestone_id: d.milestone_id ? String(d.milestone_id) : "",
      title: d.title || "",
      description: d.description || "",
      status: d.status || "pending",
      planned_completion_date: d.planned_completion_date ? d.planned_completion_date.split("T")[0] : "",
      owner_resource_id: d.owner_resource_id ? String(d.owner_resource_id) : "",
    });
    setDeliverableDialogOpen(true);
  };

  const handleSaveDeliverable = async () => {
    if (!deliverableForm.title.trim() || !deliverableForm.milestone_id) {
      toast.error("Deliverable title and milestone are required.");
      return;
    }
    try {
      const payload = {
        title: deliverableForm.title.trim(),
        description: deliverableForm.description.trim() || null,
        status: deliverableForm.status,
        planned_completion_date: deliverableForm.planned_completion_date || null,
        owner_resource_id: deliverableForm.owner_resource_id ? Number(deliverableForm.owner_resource_id) : null,
      };

      if (editingDeliverable) {
        await api.put(`/deliverables/${editingDeliverable.id}`, payload);
        toast.success("Deliverable updated.");
      } else {
        await api.post(`/milestones/${deliverableForm.milestone_id}/deliverables`, payload);
        toast.success("Deliverable created.");
      }
      setDeliverableDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save deliverable.");
    }
  };

  // Dependency CRUD
  const openCreateDependency = () => {
    setEditingDependency(null);
    setDependencyForm({
      id: null,
      predecessor_milestone_id: "",
      successor_milestone_id: "",
      dependency_type: "finish_to_start",
    });
    setDependencyDialogOpen(true);
  };

  const openEditDependency = (dependency: PlanningDependencyRecord) => {
    const dependencyId = getValidDependencyId(dependency.id);
    if (dependencyId == null) {
      toast.error("Cannot edit dependency: missing dependency ID. Refresh the page and try again.");
      return;
    }

    setEditingDependency(dependency);
    setDependencyForm({
      id: dependencyId,
      predecessor_milestone_id: String(dependency.predecessor_milestone_id),
      successor_milestone_id: String(dependency.successor_milestone_id),
      dependency_type: dependency.dependency_type || "finish_to_start",
    });
    setDependencyDialogOpen(true);
  };

  const handleSaveDependency = async () => {
    const predId = Number(dependencyForm.predecessor_milestone_id);
    const succId = Number(dependencyForm.successor_milestone_id);

    if (!predId || !succId) {
      toast.error("Both predecessor and successor milestones must be selected.");
      return;
    }
    if (predId === succId) {
      toast.error("Circular dependency detected: Milestone cannot depend on itself.");
      return;
    }

    try {
      const payload = {
        predecessor_milestone_id: predId,
        successor_milestone_id: succId,
        dependency_type: dependencyForm.dependency_type,
      };

      if (dependencyForm.id != null || editingDependency) {
        const dependencyId = getValidDependencyId(dependencyForm.id ?? editingDependency?.id);
        if (dependencyId == null) {
          toast.error("Cannot update dependency: missing dependency ID. Refresh the page and try again.");
          return;
        }
        await api.put(`/milestone-dependencies/${dependencyId}`, payload);
        toast.success("Dependency updated.");
      } else {
        await api.post(`/projects/${id}/milestone-dependencies`, payload);
        toast.success("Dependency created.");
      }

      setDependencyDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save dependency.");
    }
  };

  const loadResourcePickerOptions = async (search = "") => {
    try {
      const params = new URLSearchParams({ is_active: "true" });
      if (search.trim()) params.set("q", search.trim());
      const options = await api.get<ResourcePickerOption[]>(`/resources?${params.toString()}`);
      const assignedIds = new Set(projectResources.map((r) => r.resource_id ?? r.id));
      setResourcePickerOptions(
        (Array.isArray(options) ? options : []).filter((r) => !assignedIds.has(r.id))
      );
    } catch {
      setResourcePickerOptions([]);
    }
  };

  const openCreateResource = async () => {
    setEditingResource(null);
    setResourceForm({
      resource_id: "",
      role: "",
      allocation_pct: "100",
      allocated_hours: "",
      start_date: "",
      end_date: "",
    });
    setResourceSearch("");
    await loadResourcePickerOptions();
    setResourceDialogOpen(true);
  };

  const openEditResource = (resource: PlanningResource) => {
    setEditingResource(resource);
    setResourceForm({
      resource_id: String(resource.resource_id ?? resource.id),
      role: resource.role || "",
      allocation_pct: String(resource.allocation_pct ?? 100),
      allocated_hours: resource.allocated_hours != null ? String(resource.allocated_hours) : "",
      start_date: resource.start_date ? resource.start_date.split("T")[0] : "",
      end_date: resource.end_date ? resource.end_date.split("T")[0] : "",
    });
    setResourceDialogOpen(true);
  };

  const handleSaveResource = async () => {
    const allocationPct = Number(resourceForm.allocation_pct);
    if (!editingResource && !resourceForm.resource_id) {
      toast.error("Please select a resource to assign.");
      return;
    }
    if (Number.isNaN(allocationPct) || allocationPct < 0 || allocationPct > 100) {
      toast.error("Allocation must be between 0 and 100.");
      return;
    }

    try {
      const payload = {
        role: resourceForm.role.trim() || null,
        allocation_pct: allocationPct,
        allocated_hours: resourceForm.allocated_hours ? Number(resourceForm.allocated_hours) : null,
        start_date: resourceForm.start_date || null,
        end_date: resourceForm.end_date || null,
      };

      if (editingResource) {
        await api.put(`/projects/${id}/resources/${editingResource.id}`, payload);
        toast.success("Resource assignment updated.");
      } else {
        await api.post(`/projects/${id}/resources`, {
          resource_id: Number(resourceForm.resource_id),
          ...payload,
        });
        toast.success("Resource assigned to project.");
      }
      setResourceDialogOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save resource assignment.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "milestone") {
        await api.del(`/projects/${id}/milestones/${deleteTarget.id}`);
        toast.success("Milestone deleted.");
        window.location.reload();
        return;
      } else if (deleteTarget.type === "deliverable") {
        await api.del(`/deliverables/${deleteTarget.id}`);
        toast.success("Deliverable deleted.");
        window.location.reload();
        return;
      } else if (deleteTarget.type === "dependency") {
        const dependencyId = getValidDependencyId(deleteTarget.id);
        if (dependencyId == null) {
          toast.error("Cannot delete dependency: missing dependency ID. Refresh the page and try again.");
          return;
        }
        await api.del(`/milestone-dependencies/${dependencyId}`);
        toast.success("Dependency deleted.");
        await loadData();
        setDeleteConfirmOpen(false);
        setDeleteTarget(null);
        return;
      } else if (deleteTarget.type === "baseline") {
        await deleteBaseline();
        return;
      } else if (deleteTarget.type === "resource") {
        await api.del(`/projects/${id}/resources/${deleteTarget.id}`);
        toast.success("Resource removed from project.");
        await loadData();
        setDeleteConfirmOpen(false);
        setDeleteTarget(null);
        return;
      }
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete item.");
    }
  };

  const rows = useMemo(() => {
    const list = intelligence?.plan_vs_actual ?? intelligence?.milestones ?? [];
    return list.filter((row) => {
      const matchesSearch =
        !search.trim() ||
        row.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (row.owner_resource?.name ?? "").toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === "all" || row.health_status === statusFilter || row.status === statusFilter || row.traffic_light === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [intelligence, search, statusFilter]);

  const allDeliverables = useMemo(() => {
    const result: MilestoneDeliverable[] = [];
    rows.forEach((m) => {
      if (m.deliverables && m.deliverables.length) {
        m.deliverables.forEach((d) => result.push({ ...d, milestone_id: m.id }));
      }
    });
    return result;
  }, [rows]);

  const selectedMilestone = useMemo(
    () => (selectedMilestoneId ? rows.find((row) => String(row.id) === selectedMilestoneId) ?? null : null),
    [rows, selectedMilestoneId]
  );

  const hasPlanningData = Boolean(baselineId || (intelligence.milestones && intelligence.milestones.length > 0));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project || !intelligence) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div className="max-w-md rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-medium text-foreground">{error || "Plan data is not available."}</p>
        </div>
      </div>
    );
  }

  if (!hasPlanningData) {
    return (
      <div className="flex h-full items-center justify-center p-5">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Target className="mx-auto h-12 w-12 text-primary/70" />
          <h2 className="mt-4 text-xl font-bold text-foreground">No Planning Exists</h2>
          <p className="mt-2 text-sm text-muted-foreground">This project has not been planned.</p>
          <Button
            className="mt-6 gap-2"
            onClick={handleStartPlanning}
            disabled={initializing}
          >
            {initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Start Planning
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="mx-auto max-w-screen-2xl space-y-5">
        {!embedded && (
          <PageHeader
            icon={<Target className="h-5 w-5" />}
            title={`${project.name} Planning Workspace`}
            subtitle="Single source of truth for project planning, baseline, milestones, deliverables, dependencies, and timeline."
            badge={
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={intelligence.summary.traffic_light === "Red" ? "destructive" : intelligence.summary.traffic_light === "Yellow" ? "secondary" : "default"}>
                  {intelligence.summary.traffic_light || "Green"}
                </Badge>
                <Badge variant="outline">{project.key}</Badge>
                <Badge variant="outline">{project.classification === "presale" ? t("projects.presale") : t("settings.flowPostsale")}</Badge>
              </div>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={loadData}>
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/plan-comparison")}>
                  <BarChart3 className="h-4 w-4" /> Compare
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/enterprise-gantt")}>
                  <GanttChart className="h-4 w-4" /> Gantt
                </Button>

              </div>
            }
          />
        )}

        {/* Workspace Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex space-x-6 overflow-x-auto" aria-label="Planning Tabs">
            {[
              { id: "overview", label: "Overview", icon: Target },
              { id: "baseline", label: "Baseline", icon: Save },
              { id: "milestones", label: `Milestones (${rows.length})`, icon: Layers },
              { id: "deliverables", label: `Deliverables (${allDeliverables.length})`, icon: CheckCircle2 },
              { id: "dependencies", label: "Dependencies", icon: Network },
              { id: "resources", label: "Resources", icon: Users },
              { id: "timeline", label: "Timeline", icon: GanttChart },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as PlanTab)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                    active ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {intelligence.ceo_summary && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Executive Summary</p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">{intelligence.ceo_summary.summary}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {intelligence.summary.executive_summary?.headline || "Executive planning intelligence overview."}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Portfolio Health Score</div>
                    <div className="text-3xl font-extrabold text-foreground">{intelligence.summary.health_breakdown?.overall ?? 85}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Health Score" value={`${intelligence.summary.health_breakdown?.overall ?? 85}/100`} tone="text-foreground" />
              <MetricCard label="Completion" value={`${intelligence.summary.milestone_completion_pct ?? 0}%`} tone="text-foreground" />
              <MetricCard label="Schedule Variance" value={formatDays(intelligence.summary.schedule_variance_days)} tone="text-foreground" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Milestones" value={rows.length} tone="text-foreground" />
              <MetricCard label="Deliverables" value={allDeliverables.length} tone="text-foreground" />
              <MetricCard label="Blocked Work" value={intelligence.summary.blocked_milestones ?? 0} tone="text-destructive" />
              <MetricCard label="Open Risks" value={intelligence.summary.open_risks ?? 0} tone="text-amber-500" />
            </div>
          </div>
        )}

        {/* Tab 2: Baseline (Full CRUD) */}
        {activeTab === "baseline" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Planning baseline</h2>
                <p className="text-xs text-muted-foreground">Set the delivery targets used to calculate schedule, effort, and staffing variance.</p>
              </div>
              {baselineId && (
                <Badge variant="outline" className="text-xs">Baseline ID: #{baselineId}</Badge>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Planned Duration (days)">
                <Input
                  type="number"
                  value={baseline.planned_duration_days}
                  onChange={(e) => setBaseline((c) => ({ ...c, planned_duration_days: e.target.value }))}
                  placeholder="30"
                />
              </Field>
              <Field label="Planned Hours">
                <Input
                  type="number"
                  value={baseline.planned_hours}
                  onChange={(e) => setBaseline((c) => ({ ...c, planned_hours: e.target.value }))}
                  placeholder="160"
                />
              </Field>
              <Field label="Planned Resources Count">
                <Input
                  type="number"
                  value={baseline.planned_resources_count}
                  onChange={(e) => setBaseline((c) => ({ ...c, planned_resources_count: e.target.value }))}
                  placeholder="3"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <div className="flex gap-2">
                <Button size="sm" onClick={saveBaseline} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Baseline
                </Button>
                {baselineId && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => {
                      setDeleteTarget({ type: "baseline", id: baselineId, name: "Planning Baseline" });
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete Baseline
                  </Button>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={loadData} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Milestones (Full CRUD) */}
        {activeTab === "milestones" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search milestone..."
                  className="w-64"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5" onClick={openCreateMilestone}>
                <Plus className="h-4 w-4" /> Add Milestone
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Milestone</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Start</th>
                    <th className="px-4 py-3 text-left">Finish</th>
                    <th className="px-4 py-3 text-right">Planned Hours</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{m.name}</div>
                        {m.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{m.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.owner_resource?.name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatShortDate(m.planned_start_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatShortDate(m.planned_end_date)}</td>
                      <td className="px-4 py-3 text-right text-foreground">{formatHours(m.planned_hours)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={m.status === "completed" ? "default" : m.status === "archived" ? "secondary" : "outline"}>
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="xs" variant="ghost" title="Edit" onClick={() => openEditMilestone(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="xs" variant="ghost" title="Duplicate" onClick={() => handleDuplicateMilestone(m)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="xs" variant="ghost" title={m.status === "archived" ? "Restore" : "Archive"} onClick={() => handleToggleArchiveMilestone(m)}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="xs" variant="ghost" className="text-destructive" title="Delete" onClick={() => {
                            setDeleteTarget({ type: "milestone", id: m.id, name: m.name });
                            setDeleteConfirmOpen(true);
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No milestones found. Click "Add Milestone" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Deliverables (Full CRUD) */}
        {activeTab === "deliverables" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deliverable..."
                  className="w-64"
                />
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => openCreateDeliverable()}>
                <Plus className="h-4 w-4" /> Add Deliverable
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Deliverable</th>
                    <th className="px-4 py-3 text-left">Milestone</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Planned Completion</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allDeliverables.map((d) => {
                    const parentMilestone = rows.find((m) => m.id === d.milestone_id);
                    return (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div>{d.title}</div>
                          {d.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{d.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{parentMilestone?.name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.owner_resource?.name || "Unassigned"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatShortDate(d.planned_completion_date)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={d.status === "completed" ? "default" : "outline"}>{d.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="xs" variant="ghost" title="Edit" onClick={() => openEditDeliverable(d)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="xs" variant="ghost" className="text-destructive" title="Delete" onClick={() => {
                              setDeleteTarget({ type: "deliverable", id: d.id, name: d.title });
                              setDeleteConfirmOpen(true);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {allDeliverables.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No deliverables found. Click "Add Deliverable" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Dependencies */}
        {activeTab === "dependencies" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Milestone Dependency Chains</h2>
              <Button size="sm" className="gap-1.5" onClick={openCreateDependency}>
                <Plus className="h-4 w-4" /> Add Dependency
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Dependency</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dependencies.map((dep) => (
                    <tr key={dep.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span>{dep.predecessor_milestone?.name || "Predecessor"}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{dep.successor_milestone?.name || "Successor"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{dep.dependency_type || "Finish-to-Start"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditDependency(dep)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => {
                              const dependencyId = getValidDependencyId(dep.id);
                              if (dependencyId == null) {
                                toast.error("Cannot delete dependency: missing dependency ID. Refresh the page and try again.");
                                return;
                              }
                              setDeleteTarget({
                                type: "dependency",
                                id: dependencyId,
                                name: `${dep.predecessor_milestone?.name || "Predecessor"} → ${dep.successor_milestone?.name || "Successor"}`,
                              });
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {dependencies.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No milestone dependencies configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Resource Planning */}
        {activeTab === "resources" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Project Workforce Resource Allocation</h2>
              <Button className="gap-1.5" onClick={() => void openCreateResource()}>
                <Plus className="h-4 w-4" /> Add Resource
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Resource</th>
                    <th className="px-4 py-3 text-left">Position</th>
                    <th className="px-4 py-3 text-right">Weekly Capacity</th>
                    <th className="px-4 py-3 text-right">Utilization</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projectResources.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.position || "—"}</td>
                      <td className="px-4 py-3 text-right text-foreground">{formatHours(r.weekly_capacity ?? 40)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={cn(r.overloaded ? "text-destructive" : "text-emerald-600")}>
                          {formatPercent(r.utilization_percentage)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={r.overloaded ? "destructive" : "default"}>
                          {r.overloaded ? "Overallocated" : (r.availability_status || r.status || "Available")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditResource(r)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteTarget({ type: "resource", id: r.id, name: r.name });
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {projectResources.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <p className="text-sm text-muted-foreground">No resources assigned to project planning yet.</p>
                        <Button className="mt-4 gap-1.5" onClick={() => void openCreateResource()}>
                          <Plus className="h-4 w-4" /> Add Resource
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Timeline (Interactive Gantt) */}
        {activeTab === "timeline" && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Interactive Gantt Timeline</h2>
              <Badge variant="outline">Gantt View</Badge>
            </div>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground font-semibold">{row.name}</span>
                    <span className="text-muted-foreground">{formatShortDate(row.planned_start_date)} → {formatShortDate(row.planned_end_date)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, row.completion_percentage ?? 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Milestone Dialog */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMilestone ? "Edit Milestone" : "Create Milestone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Milestone Name">
              <Input value={milestoneForm.name} onChange={(e) => setMilestoneForm((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. Phase 1 — Discovery" />
            </Field>
            <Field label="Description">
              <Textarea value={milestoneForm.description} onChange={(e) => setMilestoneForm((c) => ({ ...c, description: e.target.value }))} rows={2} placeholder="Optional details..." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Planned Start Date">
                <Input type="date" value={milestoneForm.planned_start_date} onChange={(e) => setMilestoneForm((c) => ({ ...c, planned_start_date: e.target.value }))} />
              </Field>
              <Field label="Planned End Date">
                <Input type="date" value={milestoneForm.planned_end_date} onChange={(e) => setMilestoneForm((c) => ({ ...c, planned_end_date: e.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Planned Hours">
                <Input type="number" value={milestoneForm.planned_hours} onChange={(e) => setMilestoneForm((c) => ({ ...c, planned_hours: e.target.value }))} />
              </Field>
            </div>
            <Field label="Status">
              <Select value={milestoneForm.status} onValueChange={(val) => setMilestoneForm((c) => ({ ...c, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMilestone}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliverable Dialog */}
      <Dialog open={deliverableDialogOpen} onOpenChange={setDeliverableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDeliverable ? "Edit Deliverable" : "Create Deliverable"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Parent Milestone">
              <Select value={deliverableForm.milestone_id} onValueChange={(val) => setDeliverableForm((c) => ({ ...c, milestone_id: val }))}>
                <SelectTrigger><SelectValue placeholder="Select milestone" /></SelectTrigger>
                <SelectContent>
                  {rows.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Deliverable Title">
              <Input value={deliverableForm.title} onChange={(e) => setDeliverableForm((c) => ({ ...c, title: e.target.value }))} placeholder="e.g. BRD Architecture Document" />
            </Field>
            <Field label="Description">
              <Textarea value={deliverableForm.description} onChange={(e) => setDeliverableForm((c) => ({ ...c, description: e.target.value }))} rows={2} placeholder="Optional details..." />
            </Field>
            <Field label="Planned Completion Date">
              <Input type="date" value={deliverableForm.planned_completion_date} onChange={(e) => setDeliverableForm((c) => ({ ...c, planned_completion_date: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverableDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDeliverable}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dependency Dialog */}
      <Dialog
        open={dependencyDialogOpen}
        onOpenChange={(open) => {
          setDependencyDialogOpen(open);
          if (!open) {
            setEditingDependency(null);
            setDependencyForm({
              id: null,
              predecessor_milestone_id: "",
              successor_milestone_id: "",
              dependency_type: "finish_to_start",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDependency ? "Edit Milestone Dependency" : "Add Milestone Dependency"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Predecessor Milestone (Must finish first)">
              <Select value={dependencyForm.predecessor_milestone_id} onValueChange={(val) => setDependencyForm((c) => ({ ...c, predecessor_milestone_id: val }))}>
                <SelectTrigger><SelectValue placeholder="Select predecessor" /></SelectTrigger>
                <SelectContent>
                  {rows.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Successor Milestone (Depends on predecessor)">
              <Select value={dependencyForm.successor_milestone_id} onValueChange={(val) => setDependencyForm((c) => ({ ...c, successor_milestone_id: val }))}>
                <SelectTrigger><SelectValue placeholder="Select successor" /></SelectTrigger>
                <SelectContent>
                  {rows.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDependencyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDependency}>{editingDependency ? "Update Dependency" : "Create Dependency"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Assignment Dialog */}
      <Dialog
        open={resourceDialogOpen}
        onOpenChange={(open) => {
          setResourceDialogOpen(open);
          if (!open) {
            setEditingResource(null);
            setResourceSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource Assignment" : "Add Resource to Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingResource && (
              <>
                <Field label="Search Resources">
                  <div className="flex gap-2">
                    <Input
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      placeholder="Search by name, email, or position..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void loadResourcePickerOptions(resourceSearch);
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => void loadResourcePickerOptions(resourceSearch)}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
                <Field label="Resource">
                  <Select value={resourceForm.resource_id} onValueChange={(val) => setResourceForm((c) => ({ ...c, resource_id: val }))}>
                    <SelectTrigger><SelectValue placeholder="Select existing resource" /></SelectTrigger>
                    <SelectContent>
                      {resourcePickerOptions.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}{r.position ? ` — ${r.position}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            {editingResource && (
              <Field label="Resource">
                <Input value={editingResource.name} disabled />
              </Field>
            )}
            <Field label="Project Role">
              <Input
                value={resourceForm.role}
                onChange={(e) => setResourceForm((c) => ({ ...c, role: e.target.value }))}
                placeholder="e.g. Lead Developer"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Allocation %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={resourceForm.allocation_pct}
                  onChange={(e) => setResourceForm((c) => ({ ...c, allocation_pct: e.target.value }))}
                />
              </Field>
              <Field label="Weekly Hours">
                <Input
                  type="number"
                  min={0}
                  value={resourceForm.allocated_hours}
                  onChange={(e) => setResourceForm((c) => ({ ...c, allocated_hours: e.target.value }))}
                  placeholder="Auto from allocation"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start Date">
                <Input type="date" value={resourceForm.start_date} onChange={(e) => setResourceForm((c) => ({ ...c, start_date: e.target.value }))} />
              </Field>
              <Field label="End Date">
                <Input type="date" value={resourceForm.end_date} onChange={(e) => setResourceForm((c) => ({ ...c, end_date: e.target.value }))} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResourceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveResource}>{editingResource ? "Update Assignment" : "Assign Resource"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete ${deleteTarget?.type || "Item"}`}
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn("text-2xl font-bold", tone)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default PlanPage;
