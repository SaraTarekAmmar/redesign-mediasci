
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, Clock, Flag, AlertTriangle, Plus, Pencil, Trash2, X, ArrowRight, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Milestone, Objective, Deliverable } from "../data/opsTypes";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { DatePicker } from "../components/ui/DatePicker";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../components/ui/Dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import PlanPage from "./PlanPage";

interface ScopeData {
  scope: {
    id: string;
    description: string | null;
    status: string | null;
    project_id: string;
  };
  objectives: Objective[];
  deliverables: Deliverable[];
}

interface Props {
  projectId?: string;
}

const milestoneStatusMeta = (t: (key: string) => string): Record<Milestone["status"], { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> => ({
  upcoming: { label: t("scope.upcoming"), color: "#64748b", icon: Circle },
  in_progress: { label: t("scope.inProgress"), color: "var(--primary)", icon: Clock },
  completed: { label: t("scope.completed"), color: "#22c55e", icon: CheckCircle2 },
  at_risk: { label: t("scope.atRisk"), color: "#ef4444", icon: AlertTriangle }
});

const blankMilestone = (): Milestone => ({
  id: "",
  name: "",
  dueDate: new Date().toISOString().slice(0, 10),
  status: "upcoming"
});

// Api\MilestoneController stores title/date/status(pending|achieved|missed) —
// map to/from the SPA's name/dueDate/status(upcoming|in_progress|completed|at_risk).
const API_STATUS_TO_UI: Record<string, Milestone["status"]> = {
  pending: "upcoming",
  achieved: "completed",
  missed: "at_risk",
};
const UI_STATUS_TO_API: Record<Milestone["status"], string> = {
  upcoming: "pending",
  in_progress: "pending",
  completed: "achieved",
  at_risk: "missed",
};
const fromApiMilestone = (m: any): Milestone => ({
  id: String(m.id),
  name: m.title ?? "",
  dueDate: m.date ?? new Date().toISOString().slice(0, 10),
  status: API_STATUS_TO_UI[m.status as string] ?? "upcoming",
});
const toApiMilestone = (m: Milestone) => ({
  title: m.name.trim(),
  date: m.dueDate,
  status: UI_STATUS_TO_API[m.status],
});

const blankObjective = (): Objective => ({
  id: "",
  title: "",
  status: "In Progress"
});

const blankDeliverable = (): Deliverable => ({
  id: "",
  name: "",
  description: "",
  dueDate: new Date().toISOString().slice(0, 10),
  status: "Pending"
});

function ScopePage({ projectId: projectIdProp }: Props) {
  const { t } = useTranslation();
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectId = String(projectIdProp ?? activeProject?.id ?? "");
  const [loading, setLoading] = useState(true);
  const [scopeId, setScopeId] = useState<string>("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [scopeStatus, setScopeStatus] = useState<"draft" | "active">("draft");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Dialogs
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);

  // Drafts
  const [milestoneDraft, setMilestoneDraft] = useState<Milestone>(blankMilestone());
  const [objectiveDraft, setObjectiveDraft] = useState<Objective>(blankObjective());
  const [deliverableDraft, setDeliverableDraft] = useState<Deliverable>(blankDeliverable());

  const [saving, setSaving] = useState(false);
  const [scopeDirty, setScopeDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; item: any } | null>(null);

  // Fetch all scope data
  useEffect(() => {
    if (!projectId) return;
    const fetchData = async () => {
      try {
        const [scopeRes, milestonesRes] = await Promise.all([
          api.get<ScopeData>(`/projects/${projectId}/scope`),
          api.get<any[]>(`/projects/${projectId}/milestones`),
        ]);

        if (scopeRes) {
          setScopeId(scopeRes.scope?.id ?? "");
          setScopeDescription(scopeRes.scope?.description ?? "");
          setScopeStatus(scopeRes.scope?.status === "active" ? "active" : "draft");
          setScopeDirty(false);
          setObjectives(scopeRes.objectives ?? []);
          setDeliverables(scopeRes.deliverables ?? []);
        }
        if (Array.isArray(milestonesRes)) {
          setMilestones(milestonesRes.map(fromApiMilestone));
        }
      } catch {
        toast.error(t("scope.loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // ── Objectives CRUD ──
  const openCreateObjective = () => { setObjectiveDraft(blankObjective()); setObjectiveDialogOpen(true); };
  const openEditObjective = (o: Objective) => { setObjectiveDraft({ ...o }); setObjectiveDialogOpen(true); };

  const saveObjective = async () => {
    if (!objectiveDraft.title.trim()) { toast.error(t("scope.titleRequired")); return; }
    setSaving(true);
    try {
      if (objectiveDraft.id) {
        // Edit existing
        await api.put(`/projects/${projectId}/scope/objectives/${objectiveDraft.id}`, {
          title: objectiveDraft.title.trim(),
          status: objectiveDraft.status,
        });
        setObjectives((prev) => prev.map((o) => o.id === objectiveDraft.id ? { ...objectiveDraft } : o));
        toast.success(t("scope.objectiveUpdated"));
      } else {
        // Create new
        const res: any = await api.post(`/projects/${projectId}/scope/${scopeId}/objectives`, {
          title: objectiveDraft.title.trim(),
          status: objectiveDraft.status,
        });
        const newObj = { ...objectiveDraft, id: String(res?.objective?.id ?? Date.now()) };
        setObjectives((prev) => [...prev, newObj]);
        toast.success(t("scope.objectiveCreated"));
      }
      setObjectiveDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("scope.objectiveSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const removeObjective = async (o: Objective) => {
    const prev = objectives;
    setObjectives((cur) => cur.filter((x) => x.id !== o.id));
    try {
      await api.del(`/projects/${projectId}/scope/objectives/${o.id}`);
      toast.success(t("scope.objectiveDeleted"));
    } catch {
      setObjectives(prev);
      toast.error(t("scope.objectiveDeleteFailed"));
    }
  };

  // ── Deliverables CRUD ──
  const openCreateDeliverable = () => { setDeliverableDraft(blankDeliverable()); setDeliverableDialogOpen(true); };
  const openEditDeliverable = (d: Deliverable) => { setDeliverableDraft({ ...d }); setDeliverableDialogOpen(true); };

  const saveDeliverable = async () => {
    if (!deliverableDraft.name.trim()) { toast.error(t("scope.nameRequired")); return; }
    setSaving(true);
    try {
      if (deliverableDraft.id) {
        await api.put(`/projects/${projectId}/scope/deliverables/${deliverableDraft.id}`, {
          name: deliverableDraft.name.trim(),
          description: deliverableDraft.description,
          due_date: deliverableDraft.dueDate || null,
          status: deliverableDraft.status,
        });
        setDeliverables((prev) => prev.map((d) => d.id === deliverableDraft.id ? { ...deliverableDraft } : d));
        toast.success(t("scope.deliverableUpdated"));
      } else {
        const res: any = await api.post(`/projects/${projectId}/scope/${scopeId}/deliverables`, {
          name: deliverableDraft.name.trim(),
          description: deliverableDraft.description,
          due_date: deliverableDraft.dueDate || null,
          status: deliverableDraft.status,
        });
        const newDel = { ...deliverableDraft, id: String(res?.deliverable?.id ?? Date.now()) };
        setDeliverables((prev) => [...prev, newDel]);
        toast.success(t("scope.deliverableCreated"));
      }
      setDeliverableDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("scope.deliverableSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const removeDeliverable = async (d: Deliverable) => {
    const prev = deliverables;
    setDeliverables((cur) => cur.filter((x) => x.id !== d.id));
    try {
      await api.del(`/projects/${projectId}/scope/deliverables/${d.id}`);
      toast.success(t("scope.deliverableDeleted"));
    } catch {
      setDeliverables(prev);
      toast.error(t("scope.deliverableDeleteFailed"));
    }
  };

  // ── Milestones CRUD ──
  const openCreateMilestone = () => { setMilestoneDraft(blankMilestone()); setMilestoneDialogOpen(true); };
  const openEditMilestone = (m: Milestone) => { setMilestoneDraft({ ...m }); setMilestoneDialogOpen(true); };

  const saveMilestone = async () => {
    if (!milestoneDraft.name.trim()) { toast.error(t("scope.titleRequired")); return; }
    setSaving(true);
    try {
      if (milestoneDraft.id) {
        await api.put(`/projects/${projectId}/milestones/${milestoneDraft.id}`, toApiMilestone(milestoneDraft));
        setMilestones((prev) => prev.map((m) => m.id === milestoneDraft.id ? { ...milestoneDraft } : m));
        toast.success(t("scope.milestoneUpdated"));
      } else {
        const res: any = await api.post(`/projects/${projectId}/milestones`, toApiMilestone(milestoneDraft));
        setMilestones((prev) => [...prev, { ...milestoneDraft, id: String(res?.id ?? Date.now()) }]);
        toast.success(t("scope.milestoneCreated"));
      }
      setMilestoneDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("scope.milestoneSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const removeMilestone = async (m: Milestone) => {
    const prev = milestones;
    setMilestones((cur) => cur.filter((x) => x.id !== m.id));
    try {
      await api.del(`/projects/${projectId}/milestones/${m.id}`);
      toast.success(t("scope.milestoneDeleted"));
    } catch {
      setMilestones(prev);
      toast.error(t("scope.milestoneDeleteFailed"));
    }
  };

  // ── Scope save ──
  const saveScope = async () => {
    setSaving(true);
    try {
      await api.put(`/projects/${projectId}/scope`, { description: scopeDescription, status: scopeStatus });
      setScopeDirty(false);
      toast.success(t("scope.scopeSaved"));
    } catch {
      toast.error(t("scope.scopeSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleScopeStatus = async () => {
    const newStatus = scopeStatus === "active" ? "draft" : "active";
    setScopeStatus(newStatus);
    try {
      await api.put(`/projects/${projectId}/scope`, { description: scopeDescription, status: newStatus });
      toast.success(newStatus === "active" ? t("scope.markedActive") : t("scope.markedDraft"));
    } catch {
      setScopeStatus(scopeStatus);
      toast.error(t("scope.statusUpdateFailed"));
    }
  };

  const sortedMs = [...milestones].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  const MILESTONE_STATUS = milestoneStatusMeta(t);
  const scopeNeedsSetup = scopeDescription.trim().length === 0;

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
        <div className="mx-auto max-w-screen-2xl space-y-4">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
            <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("scope.title")}
          subtitle={`${activeProject?.name ?? ""} · Define the boundary, then turn it into outcomes and delivery work.`}
          actions={
            <button
              onClick={toggleScopeStatus}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                scopeStatus === "active"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {scopeStatus === "active" ? `● ${t("scope.active")}` : `○ ${t("scope.draft")}`}
              <span className="text-[10px] opacity-60">{t("scope.clickToToggle")}</span>
            </button>
          }
        />

        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Make the project understandable in two steps</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A useful scope tells the team what success includes, what it does not include, and how the work will be recognized as complete.</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{scopeNeedsSetup ? "Step 1 of 2" : "Step 2 of 2"}</span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <div className={`rounded-lg border p-3 ${scopeNeedsSetup ? "border-primary/50 bg-primary/10" : "border-emerald-500/30 bg-emerald-500/5"}`}>
              <div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${scopeNeedsSetup ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white"}`}>{scopeNeedsSetup ? "1" : "✓"}</span><span className="text-xs font-semibold text-foreground">Define the boundary</span></div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Write what is included, excluded, and why this project exists.</p>
            </div>
            <div className={`rounded-lg border p-3 ${scopeNeedsSetup ? "border-border bg-background" : "border-primary/50 bg-primary/10"}`}>
              <div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${scopeNeedsSetup ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>2</span><span className="text-xs font-semibold text-foreground">Turn it into outcomes</span></div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Add objectives, deliverables, milestones, and dependencies the team can act on.</p>
            </div>
          </div>
        </div>

        {/* Scope Description */}
        <div className={`mb-4 rounded-xl border bg-card p-5 ${scopeNeedsSetup ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">1. Define the project boundary</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Capture the promise of this project in plain language. Include the intended outcome, what is in scope, what is out of scope, and any non-negotiable constraints.</p>
            </div>
            <Button size="sm" onClick={saveScope} disabled={!scopeDirty || saving}>{saving ? "Saving…" : scopeDirty ? "Save changes" : "Saved"}</Button>
          </div>
          <textarea
            value={scopeDescription}
            onChange={(e) => { setScopeDescription(e.target.value); setScopeDirty(true); }}
            placeholder="Example: We will deliver a secure patient intake flow for clinic staff. In scope: intake form, validation, and audit trail. Out of scope: billing and scheduling."
            aria-label="Project scope boundary"
            className="mt-4 min-h-[150px] w-full resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Keep it short enough for a team member to understand in one minute.</span><span>{scopeDescription.length} characters</span></div>
        </div>

        <div className="grid gap-4">
          {/* Objectives */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">2. Turn the boundary into outcomes</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Objectives describe the result. Deliverables, milestones, and dependencies below describe how the team will make it real.</p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={openCreateObjective}>
                <Plus className="h-4 w-4" /> {t("scope.add")}
              </Button>
            </div>
            <div className="space-y-2">
              {objectives.map((o) => (
                <div key={o.id} className="group flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
                  {o.status === "Achieved" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={cn("flex-1 text-sm", o.status === "Achieved" ? "text-muted-foreground line-through" : "text-foreground")}>
                    {o.title}
                  </span>
                  <Badge variant={o.status === "Achieved" ? "secondary" : "outline"}>{o.status}</Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEditObjective(o)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={() => setConfirmDelete({ type: "objective", item: o })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {objectives.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {t("scope.noObjectives", { defaultValue: "No objectives yet." })}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("scope.objectivesHint", { defaultValue: "Objectives turn a broad scope into outcomes the team can review together." })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Reduce onboarding drop-off", "Ship a usable first release", "Improve reporting confidence"].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => { setObjectiveDraft({ ...blankObjective(), title: suggestion }); setObjectiveDialogOpen(true); }}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {projectId && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Execution plan</h2>
                <p className="mt-1 text-xs text-muted-foreground">Turn agreed outcomes into milestones, deliverables, dependencies, resources, and a timeline.</p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{milestones.length} milestones · {deliverables.length} deliverables</span>
            </div>
          </div>
          <PlanPage projectId={projectId} embedded />
        </div>
      )}
      </div>

      {/* Objective Dialog */}
      <Dialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{objectiveDraft.id ? t("scope.editObjective") : t("scope.addObjective")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("scope.titleField")}</Label>
              <Input
                value={objectiveDraft.title}
                autoFocus
                onChange={(e) => setObjectiveDraft({ ...objectiveDraft, title: e.target.value })}
                placeholder="e.g. Reduce onboarding drop-off by 30%"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("scope.statusField")}</Label>
              <Select value={objectiveDraft.status} onValueChange={(v) => setObjectiveDraft({ ...objectiveDraft, status: v as Objective["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Progress">{t("scope.inProgress")}</SelectItem>
                  <SelectItem value="Achieved">{t("scope.achieved")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjectiveDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveObjective} disabled={saving}>{saving ? t("app.saving") : t("scope.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliverable Dialog */}
      <Dialog open={deliverableDialogOpen} onOpenChange={setDeliverableDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{deliverableDraft.id ? t("scope.editDeliverable") : t("scope.addDeliverable")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("scope.nameField")}</Label>
              <Input
                value={deliverableDraft.name}
                autoFocus
                onChange={(e) => setDeliverableDraft({ ...deliverableDraft, name: e.target.value })}
                placeholder="e.g. Onboarding flow (3 steps)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("scope.descriptionField")}</Label>
              <Input
                value={deliverableDraft.description ?? ""}
                onChange={(e) => setDeliverableDraft({ ...deliverableDraft, description: e.target.value })}
                placeholder={t("scope.optionalDescription")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("scope.dueDateField")}</Label>
                <DatePicker
                  value={deliverableDraft.dueDate ?? ""}
                  onChange={(date) => setDeliverableDraft({ ...deliverableDraft, dueDate: date })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scope.statusField")}</Label>
                <Select value={deliverableDraft.status} onValueChange={(v) => setDeliverableDraft({ ...deliverableDraft, status: v as Deliverable["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">{t("scope.pending")}</SelectItem>
                    <SelectItem value="In Progress">{t("scope.inProgress")}</SelectItem>
                    <SelectItem value="Delivered">{t("scope.delivered")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverableDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveDeliverable} disabled={saving}>{saving ? t("app.saving") : t("scope.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone Dialog */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{milestoneDraft.id ? t("scope.editMilestone") : t("scope.addMilestoneDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("scope.titleField")}</Label>
              <Input
                value={milestoneDraft.name}
                autoFocus
                onChange={(e) => setMilestoneDraft({ ...milestoneDraft, name: e.target.value })}
                placeholder="e.g. Beta Release 1.0"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("scope.dueDateField")}</Label>
                <DatePicker
                  value={milestoneDraft.dueDate}
                  onChange={(date) => setMilestoneDraft({ ...milestoneDraft, dueDate: date })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scope.statusField")}</Label>
                <Select value={milestoneDraft.status} onValueChange={(v) => setMilestoneDraft({ ...milestoneDraft, status: v as Milestone["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">{t("scope.upcoming")}</SelectItem>
                    <SelectItem value="in_progress">{t("scope.inProgress")}</SelectItem>
                    <SelectItem value="completed">{t("scope.completed")}</SelectItem>
                    <SelectItem value="at_risk">{t("scope.atRisk")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveMilestone} disabled={saving}>{saving ? t("app.saving") : t("scope.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={`${t("app.delete")} ${confirmDelete?.type ?? ""}`}
        description={t("app.deleteConfirm", { name: confirmDelete?.item?.title ?? confirmDelete?.item?.name ?? "" })}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === "objective") removeObjective(confirmDelete.item);
          else if (confirmDelete.type === "deliverable") removeDeliverable(confirmDelete.item);
          else if (confirmDelete.type === "milestone") removeMilestone(confirmDelete.item);
        }}
        confirmLabel={t("app.delete")}
      />
    </div>
  );
}

export default ScopePage;
