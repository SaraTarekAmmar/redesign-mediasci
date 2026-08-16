import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Calendar, AlertTriangle, CheckCircle2, Clock, Layers, Loader2, Milestone, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, lookups } from "../store/useStore";
import { api } from "../lib/api";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import { IssueTypeIcon } from "../components/common/IssueTypeIcon";
import { PriorityIcon } from "../components/common/PriorityIcon";
import { UserAvatar } from "../components/common/UserAvatar";
import { LabelChip } from "../components/common/LabelChip";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label as LabelUI } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
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

type ViewMode = "epic" | "timeline" | "workstream" | "phases";

interface Epic {
  id: string;
  name: string;
  color: string;
}

interface Phase {
  id: string;
  title: string;
  description?: string | null;
  phase_type: "planning" | "design" | "development" | "testing" | "deployment";
  start_date?: string | null;
  end_date?: string | null;
  status: "not_started" | "in_progress" | "completed";
  status_label: string;
  status_color: string;
  color: string;
  position: number;
  progress: number;
  width_pct: number;
  offset_pct: number;
  goals?: string | null;
  owner?: { id: string; name: string } | null;
}

type PhaseDraft = {
  title: string;
  description: string;
  phase_type: Phase["phase_type"];
  start_date: string;
  end_date: string;
  status: Phase["status"];
  progress: number;
  goals: string;
  owner_id: string;
};

const blankPhaseDraft = (): PhaseDraft => ({
  title: "",
  description: "",
  phase_type: "development",
  start_date: "",
  end_date: "",
  status: "not_started",
  progress: 0,
  goals: "",
  owner_id: ""
});

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted",
  in_progress: "bg-primary/15 text-primary",
  done: "bg-green-500/15 text-green-600 dark:text-green-400",
};

function RoadmapPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const issues = useStore((s) => s.issues);
  const setSelected = useStore((s) => s.setSelectedIssue);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectId = String(activeProject?.id ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("epic");
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [workstreamFilter, setWorkstreamFilter] = useState<"all" | "presale" | "postsale">("all");

  // Phases: project-level timeline (distinct from issue/sprint tracking above).
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(true);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [phaseDraft, setPhaseDraft] = useState<PhaseDraft>(blankPhaseDraft());
  const [savingPhase, setSavingPhase] = useState(false);
  const [confirmDeletePhase, setConfirmDeletePhase] = useState<Phase | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Epic[]>(`/projects/${projectId}/epics`);
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setEpics(list);
          setExpandedEpics(new Set(list.map((e) => e.id)));
        }
      } catch {
        // epics may not have an API yet — fall back to empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Phase[]>(`/projects/${projectId}/phases`);
        if (!cancelled) setPhases(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPhases([]);
      } finally {
        if (!cancelled) setLoadingPhases(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  function openCreatePhase() {
    setEditingPhaseId(null);
    setPhaseDraft(blankPhaseDraft());
    setPhaseDialogOpen(true);
  }

  function openEditPhase(phase: Phase) {
    setEditingPhaseId(phase.id);
    setPhaseDraft({
      title: phase.title,
      description: phase.description ?? "",
      phase_type: phase.phase_type,
      start_date: phase.start_date ?? "",
      end_date: phase.end_date ?? "",
      status: phase.status,
      progress: phase.progress,
      goals: phase.goals ?? "",
      owner_id: phase.owner?.id ?? ""
    });
    setPhaseDialogOpen(true);
  }

  async function savePhase() {
    if (!phaseDraft.title.trim()) {
      toast.error(t("roadmap.phaseTitle"));
      return;
    }
    setSavingPhase(true);
    const payload = {
      title: phaseDraft.title.trim(),
      description: phaseDraft.description || null,
      phase_type: phaseDraft.phase_type,
      start_date: phaseDraft.start_date || null,
      end_date: phaseDraft.end_date || null,
      status: phaseDraft.status,
      progress: phaseDraft.progress,
      goals: phaseDraft.goals || null,
      owner_id: phaseDraft.owner_id || null
    };
    try {
      if (editingPhaseId) {
        const updated = await api.put<Phase>(`/projects/${projectId}/phases/${editingPhaseId}`, payload);
        setPhases((cur) => cur.map((p) => p.id === editingPhaseId ? { ...p, ...updated } : p));
        toast.success(t("roadmap.phaseUpdated"));
      } else {
        const created = await api.post<Phase>(`/projects/${projectId}/phases`, payload);
        if (created) setPhases((cur) => [...cur, created]);
        toast.success(t("roadmap.phaseAdded"));
      }
      setPhaseDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save phase");
    } finally {
      setSavingPhase(false);
    }
  }

  async function deletePhase(phase: Phase) {
    const prev = phases;
    setPhases((cur) => cur.filter((p) => p.id !== phase.id));
    try {
      await api.del(`/projects/${projectId}/phases/${phase.id}`);
      toast.success(t("roadmap.phaseDeleted"));
    } catch (error: any) {
      setPhases(prev);
      toast.error(error?.message ?? "Could not delete phase");
    }
  }

  const toggleEpic = (id: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredIssues = useMemo(() => {
    if (workstreamFilter === "all") return issues;
    return issues.filter((i) => i.workstream === workstreamFilter);
  }, [issues, workstreamFilter]);

  const stats = useMemo(() => {
    const total = filteredIssues.length;
    const done = filteredIssues.filter((i) => lookups.statusById[i.statusId]?.category === "done").length;
    const inProgress = filteredIssues.filter((i) => lookups.statusById[i.statusId]?.category === "in_progress").length;
    const overdue = filteredIssues.filter((i) => {
      if (!i.dueDate) return false;
      return new Date(i.dueDate) < new Date() && lookups.statusById[i.statusId]?.category !== "done";
    }).length;
    const totalPoints = filteredIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const donePoints = filteredIssues.filter((i) => lookups.statusById[i.statusId]?.category === "done")
      .reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    return { total, done, inProgress, overdue, totalPoints, donePoints };
  }, [filteredIssues]);

  const epicGroups = useMemo(() => {
    return epics.map((epic) => {
      const epicIssues = filteredIssues.filter((i) => i.epicId === epic.id);
      const done = epicIssues.filter((i) => lookups.statusById[i.statusId]?.category === "done").length;
      const inProgress = epicIssues.filter((i) => lookups.statusById[i.statusId]?.category === "in_progress").length;
      const overdue = epicIssues.filter((i) => {
        if (!i.dueDate) return false;
        return new Date(i.dueDate) < new Date() && lookups.statusById[i.statusId]?.category !== "done";
      }).length;
      const points = epicIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
      const donePoints = epicIssues.filter((i) => lookups.statusById[i.statusId]?.category === "done")
        .reduce((s, i) => s + (i.storyPoints || 0), 0);
      const pct = epicIssues.length ? Math.round(done / epicIssues.length * 100) : 0;
      return { epic, issues: epicIssues, done, inProgress, overdue, points, donePoints, pct };
    }).filter((g) => g.issues.length > 0);
  }, [filteredIssues, epics]);

  const workstreamGroups = useMemo(() => {
    const groups: Record<string, typeof filteredIssues> = { presale: [], postsale: [], none: [] };
    filteredIssues.forEach((i) => {
      const ws = i.workstream || "none";
      if (!groups[ws]) groups[ws] = [];
      groups[ws].push(i);
    });
    return groups;
  }, [filteredIssues]);

  const timelineIssues = useMemo(() => {
    return [...filteredIssues]
      .filter((i) => i.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [filteredIssues]);

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null;
    const projects = (window as any).__DATA__?.projects ?? [];
    return projects.find((p: any) => p.id === projectId)?.name ?? null;
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("roadmap.title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("roadmap.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Workstream filter */}
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              {(["all", "presale", "postsale"] as const).map((ws) => (
                <button
                  key={ws}
                  onClick={() => setWorkstreamFilter(ws)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    workstreamFilter === ws
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  {ws === "all" ? t("roadmap.allWorkstreams") : ws === "presale" ? t("roadmap.presale") : t("roadmap.postsale")}
                </button>
              ))}
            </div>
            {/* View mode */}
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              {([
                { key: "epic" as const, label: t("roadmap.viewEpic"), icon: Layers },
                { key: "timeline" as const, label: t("roadmap.viewTimeline"), icon: Calendar },
                { key: "workstream" as const, label: t("roadmap.viewWorkstream"), icon: ChevronRight },
                { key: "phases" as const, label: t("roadmap.viewPhases"), icon: Milestone },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: t("roadmap.issues"), value: stats.total, color: "text-foreground" },
            { label: t("roadmap.done"), value: stats.done, color: "text-green-600 dark:text-green-400" },
            { label: t("roadmap.inProgress"), value: stats.inProgress, color: "text-primary" },
            { label: t("roadmap.overdue"), value: stats.overdue, color: "text-rose-600 dark:text-rose-400" },
            { label: t("roadmap.storyPoints"), value: `${stats.donePoints}/${stats.totalPoints}`, color: "text-foreground" },
            { label: t("roadmap.totalProgress"), value: `${stats.total ? Math.round(stats.done / stats.total * 100) : 0}%`, color: "text-foreground" },
          ].map((s, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("mt-1 text-lg font-semibold", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Overall progress bar */}
        <div className="mb-6">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("roadmap.totalProgress")}</span>
            <span>{stats.total ? Math.round(stats.done / stats.total * 100) : 0}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
              style={{ width: `${stats.total ? Math.round(stats.done / stats.total * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* View: By Epic */}
        {viewMode === "epic" && (
          <div className="space-y-4">
            {epicGroups.map(({ epic, issues: epicIssues, done, inProgress, overdue, points, donePoints, pct }) => (
              <div key={epic.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Epic header */}
                <button
                  onClick={() => toggleEpic(epic.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-start transition-colors hover:bg-muted/30"
                  style={{ backgroundColor: `${epic.color}08` }}>
                  <div className="flex items-center gap-3">
                    {expandedEpics.has(epic.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="h-3 w-3 rounded" style={{ backgroundColor: epic.color }} />
                    <h2 className="text-sm font-semibold text-foreground">{epic.name}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {epicIssues.length} {t("roadmap.issues")}
                    </span>
                    {overdue > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="h-3 w-3" />
                        {overdue} {t("roadmap.overdue")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("roadmap.storyPoints")}</p>
                      <p className="text-sm font-medium">{donePoints}/{points}</p>
                    </div>
                    <div className="w-24">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{done}/{epicIssues.length}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: epic.color }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Issues grid */}
                {expandedEpics.has(epic.id) && (
                  <div className="grid gap-px bg-border sm:grid-cols-3">
                    {(["todo", "in_progress", "done"] as const).map((cat) => {
                      const items = epicIssues.filter((i) => lookups.statusById[i.statusId]?.category === cat);
                      const catLabel = cat === "todo" ? t("roadmap.todo") : cat === "in_progress" ? t("roadmap.inProgress") : t("roadmap.done");
                      return (
                        <div key={cat} className="bg-card p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {catLabel}
                            </p>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", STATUS_COLORS[cat])}>
                              {items.length}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map((i) => {
                              const isOverdue = i.dueDate && new Date(i.dueDate) < new Date() && cat !== "done";
                              const projName = getProjectName(i.projectId);
                              return (
                                <button
                                  key={i.id}
                                  onClick={() => setSelected(i.id)}
                                  className="flex w-full flex-col gap-1 rounded-md border border-border bg-background p-2 text-start transition-colors hover:border-ring/40">
                                  <div className="flex items-center gap-1.5">
                                    <IssueTypeIcon typeKey={i.typeKey} className="h-3.5 w-3.5 shrink-0" />
                                    <span className="font-mono text-[10px] text-muted-foreground">{i.key}</span>
                                    <PriorityIcon priorityId={i.priorityId} className="h-3 w-3" />
                                  </div>
                                  <p className="text-xs font-medium text-foreground line-clamp-2">{i.title}</p>
                                  <div className="flex flex-wrap items-center gap-1">
                                    {projName && (
                                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">
                                        {projName}
                                      </span>
                                    )}
                                    {i.dueDate && (
                                      <span className={cn(
                                        "flex items-center gap-0.5 text-[9px]",
                                        isOverdue ? "text-rose-500" : "text-muted-foreground"
                                      )}>
                                        <Calendar className="h-2.5 w-2.5" />
                                        {new Date(i.dueDate).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}
                                      </span>
                                    )}
                                    {i.storyPoints && (
                                      <span className="rounded bg-secondary px-1 py-0.5 text-[9px] font-medium text-secondary-foreground">
                                        {i.storyPoints}sp
                                      </span>
                                    )}
                                  </div>
                                  {i.labelIds.length > 0 && (
                                    <div className="flex flex-wrap gap-0.5">
                                      {i.labelIds.slice(0, 2).map((id) => (
                                        <LabelChip key={id} labelId={id} />
                                      ))}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                            {items.length === 0 && (
                              <p className="py-2 text-center text-xs text-muted-foreground/60">-</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* View: Timeline */}
        {viewMode === "timeline" && (
          <div className="space-y-3">
            {timelineIssues.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("roadmap.noIssues")}</p>
              </div>
            )}
            {timelineIssues.map((i) => {
              const status = lookups.statusById[i.statusId];
              const cat = status?.category ?? "todo";
              const isOverdue = i.dueDate && new Date(i.dueDate) < new Date() && cat !== "done";
              const isDone = cat === "done";
              const projName = getProjectName(i.projectId);
              const epic = i.epicId ? lookups.epicById[i.epicId] : null;
              return (
                <button
                  key={i.id}
                  onClick={() => setSelected(i.id)}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-start transition-all hover:border-ring/40 hover:shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${epic?.color ?? "#888"}15` }}>
                    <IssueTypeIcon typeKey={i.typeKey} className="h-5 w-5" style={{ color: epic?.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{i.key}</span>
                      <PriorityIcon priorityId={i.priorityId} className="h-3.5 w-3.5" />
                      {epic && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${epic.color}15`, color: epic.color }}>
                          {epic.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground line-clamp-1">{i.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {projName && <span>{projName}</span>}
                      {i.assigneeId && <UserAvatar userId={i.assigneeId} size="xs" />}
                      {i.storyPoints && <span>{i.storyPoints}sp</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {i.dueDate && (
                      <span className={cn(
                        "flex items-center gap-1 text-xs",
                        isOverdue ? "text-rose-500 font-medium" : "text-muted-foreground"
                      )}>
                        {isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Clock className="h-3.5 w-3.5" />}
                        {new Date(i.dueDate).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      isDone ? "bg-green-500/15 text-green-600 dark:text-green-400"
                        : cat === "in_progress" ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {status?.name ?? "Unknown"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* View: By Workstream */}
        {viewMode === "workstream" && (
          <div className="space-y-6">
            {(["presale", "postsale", "none"] as const).map((ws) => {
              const items = workstreamGroups[ws] || [];
              if (items.length === 0) return null;
              const wsLabel = ws === "presale" ? t("roadmap.presale") : ws === "postsale" ? t("roadmap.postsale") : t("roadmap.allWorkstreams");
              const wsColor = ws === "presale" ? "#8b5cf6" : ws === "postsale" ? "#06b6d4" : "#6b7280";
              const done = items.filter((i) => lookups.statusById[i.statusId]?.category === "done").length;
              const pct = items.length ? Math.round(done / items.length * 100) : 0;
              return (
                <div key={ws} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: `${wsColor}08` }}>
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded" style={{ backgroundColor: wsColor }} />
                      <h2 className="text-sm font-semibold text-foreground">{wsLabel}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {items.length} {t("roadmap.issues")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{done}/{items.length} {t("roadmap.done")}</span>
                      <div className="w-20">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: wsColor }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((i) => {
                      const status = lookups.statusById[i.statusId];
                      const isOverdue = i.dueDate && new Date(i.dueDate) < new Date() && status?.category !== "done";
                      const projName = getProjectName(i.projectId);
                      const epic = i.epicId ? lookups.epicById[i.epicId] : null;
                      return (
                        <button
                          key={i.id}
                          onClick={() => setSelected(i.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/30">
                          <IssueTypeIcon typeKey={i.typeKey} className="h-4 w-4 shrink-0" />
                          <span className="font-mono text-xs text-muted-foreground">{i.key}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{i.title}</span>
                          {epic && (
                            <span className="hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block" style={{ backgroundColor: `${epic.color}15`, color: epic.color }}>
                              {epic.name}
                            </span>
                          )}
                          {projName && (
                            <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
                              {projName}
                            </span>
                          )}
                          {i.dueDate && (
                            <span className={cn("flex shrink-0 items-center gap-0.5 text-[10px]", isOverdue ? "text-rose-500" : "text-muted-foreground")}>
                              <Calendar className="h-3 w-3" />
                              {new Date(i.dueDate).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          <PriorityIcon priorityId={i.priorityId} className="h-3.5 w-3.5 shrink-0" />
                          <UserAvatar userId={i.assigneeId} size="xs" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View: Phases (project-level timeline, separate from issues/sprints) */}
        {viewMode === "phases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button size="sm" className="gap-1.5" onClick={openCreatePhase}>
                <Plus className="h-4 w-4" /> {t("roadmap.addPhase")}
              </Button>
            </div>

            {loadingPhases && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loadingPhases && phases.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <Milestone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("roadmap.noPhases")}</p>
              </div>
            )}

            {!loadingPhases && phases.length > 0 && (
              <>
                {/* Shared timeline strip */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="relative h-10 w-full rounded-lg bg-muted/40">
                    {phases.map((phase) => (
                      <div
                        key={phase.id}
                        title={phase.title}
                        className="absolute top-1 h-8 rounded-md opacity-90"
                        style={{
                          left: `${phase.offset_pct}%`,
                          width: `${Math.max(phase.width_pct, 2)}%`,
                          backgroundColor: phase.color
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {phases.map((phase) => (
                    <div key={phase.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 h-3 w-3 shrink-0 rounded" style={{ backgroundColor: phase.color }} />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                                {phase.phase_type}
                              </span>
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{ backgroundColor: `${phase.status_color}20`, color: phase.status_color }}
                              >
                                {phase.status === "not_started" ? t("roadmap.statusNotStarted")
                                  : phase.status === "in_progress" ? t("roadmap.statusInProgress")
                                  : t("roadmap.statusCompleted")}
                              </span>
                            </div>
                            {phase.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{phase.description}</p>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {(phase.start_date || phase.end_date) && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {phase.start_date ?? "?"} – {phase.end_date ?? "?"}
                                </span>
                              )}
                              {phase.owner && <span>{t("roadmap.owner")}: {phase.owner.name}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditPhase(phase)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDeletePhase(phase)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{t("roadmap.progress")}</span>
                          <span>{phase.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full transition-all" style={{ width: `${phase.progress}%`, backgroundColor: phase.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPhaseId ? t("roadmap.editPhase") : t("roadmap.newPhase")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <LabelUI htmlFor="phase-title">{t("roadmap.phaseTitle")}</LabelUI>
              <Input
                id="phase-title"
                value={phaseDraft.title}
                autoFocus
                onChange={(e) => setPhaseDraft((cur) => ({ ...cur, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <LabelUI>{t("roadmap.phaseType")}</LabelUI>
                <Select
                  value={phaseDraft.phase_type}
                  onValueChange={(v) => setPhaseDraft((cur) => ({ ...cur, phase_type: v as Phase["phase_type"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["planning", "design", "development", "testing", "deployment"] as const).map((tpe) => (
                      <SelectItem key={tpe} value={tpe} className="capitalize">{tpe}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <LabelUI>{t("roadmap.status")}</LabelUI>
                <Select
                  value={phaseDraft.status}
                  onValueChange={(v) => setPhaseDraft((cur) => ({ ...cur, status: v as Phase["status"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">{t("roadmap.statusNotStarted")}</SelectItem>
                    <SelectItem value="in_progress">{t("roadmap.statusInProgress")}</SelectItem>
                    <SelectItem value="completed">{t("roadmap.statusCompleted")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <LabelUI>{t("roadmap.startDate")}</LabelUI>
                <DatePicker value={phaseDraft.start_date} onChange={(date) => setPhaseDraft((cur) => ({ ...cur, start_date: date ?? "" }))} />
              </div>
              <div className="space-y-1.5">
                <LabelUI>{t("roadmap.endDate")}</LabelUI>
                <DatePicker value={phaseDraft.end_date} onChange={(date) => setPhaseDraft((cur) => ({ ...cur, end_date: date ?? "" }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <LabelUI htmlFor="phase-progress">{t("roadmap.progress")} (%)</LabelUI>
              <Input
                id="phase-progress"
                type="number"
                min={0}
                max={100}
                value={phaseDraft.progress}
                onChange={(e) => setPhaseDraft((cur) => ({ ...cur, progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
              />
            </div>
            <div className="space-y-1.5">
              <LabelUI>{t("roadmap.owner")}</LabelUI>
              <Select
                value={phaseDraft.owner_id || undefined}
                onValueChange={(v) => setPhaseDraft((cur) => ({ ...cur, owner_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder={t("roadmap.owner")} /></SelectTrigger>
                <SelectContent>
                  {lookups.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <LabelUI htmlFor="phase-desc">{t("settings.descField")}</LabelUI>
              <Textarea
                id="phase-desc"
                rows={2}
                value={phaseDraft.description}
                onChange={(e) => setPhaseDraft((cur) => ({ ...cur, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <LabelUI htmlFor="phase-goals">{t("roadmap.goals")}</LabelUI>
              <Textarea
                id="phase-goals"
                rows={2}
                value={phaseDraft.goals}
                onChange={(e) => setPhaseDraft((cur) => ({ ...cur, goals: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={savePhase} disabled={savingPhase}>
              {editingPhaseId ? t("settings.saveChanges") : t("roadmap.addPhase")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeletePhase !== null}
        onOpenChange={(o) => { if (!o) setConfirmDeletePhase(null); }}
        title={t("roadmap.editPhase")}
        description={t("roadmap.deletePhaseConfirm")}
        onConfirm={() => {
          if (confirmDeletePhase) deletePhase(confirmDeletePhase);
        }}
        confirmLabel={t("app.delete")}
      />
    </div>
  );
}

export default RoadmapPage;
