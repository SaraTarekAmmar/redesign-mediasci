import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Loader2, Link2, Trash2, Download, Milestone as MilestoneIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { DatePicker } from "../components/ui/DatePicker";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/SelectEnhanced";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { api } from "../lib/api";
import { lookups } from "../store/useStore";
import { PlanGanttChart, type PlanGanttTask, type PlanGanttLink, type PlanGanttMilestoneMarker, type GanttZoom } from "../components/charts/PlanGanttChart";

interface ProjectOption { id: string; name: string; key: string; }
interface PlanOption { id: number; project_id: number; name: string; type: string; tasks_count?: number; }
interface MilestoneRecord { id: number; title: string; description: string | null; date: string; status: string; priority: string; }

const STATUS_OPTIONS = ["not_started", "in_progress", "review", "blocked", "completed"];
const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"];
const TYPE_OPTIONS = ["task", "phase", "wave", "milestone"];
const DEP_TYPES = ["FS", "SS", "FF", "SF"];

const blankTask = (planId: number) => ({
  id: "" as string | number,
  plan_id: planId,
  text: "",
  description: "",
  start_date: new Date().toISOString().slice(0, 10),
  duration: 3,
  status: "not_started",
  priority: "medium",
  type: "task",
  assigned_to: "",
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function EnterpriseGanttPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<PlanGanttTask[]>([]);
  const [links, setLinks] = useState<PlanGanttLink[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [zoom, setZoom] = useState<GanttZoom>("week");
  const [loading, setLoading] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [draft, setDraft] = useState<any>(blankTask(0));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlanGanttTask | null>(null);
  const [depSource, setDepSource] = useState("");
  const [depTarget, setDepTarget] = useState("");
  const [depType, setDepType] = useState("FS");
  const [depLag, setDepLag] = useState(0);
  const [msDialogOpen, setMsDialogOpen] = useState(false);
  const [msDraft, setMsDraft] = useState({ title: "", date: new Date().toISOString().slice(0, 10) });

  // Load projects once
  useEffect(() => {
    api.get<ProjectOption[] | { data: ProjectOption[] }>("/projects").then((res) => {
      const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setProjects(list);
      if (list[0]) setProjectId(String(list[0].id));
    }).catch(() => toast.error(t("enterpriseGantt.loadError")));
  }, []);

  // Load plans + milestones when project changes
  useEffect(() => {
    if (!projectId) return;
    setPlanId(null);
    setTasks([]);
    setLinks([]);
    api.get<{ data: PlanOption[] }>(`/plans?projects[]=${projectId}`).then((res) => {
      const list = Array.isArray(res) ? res : res?.data ?? [];
      setPlans(list);
      if (list[0]) setPlanId(list[0].id);
    }).catch(() => toast.error(t("enterpriseGantt.loadError")));
    api.get<MilestoneRecord[] | { milestones: MilestoneRecord[] }>(`/milestones`).then((res) => {
      setMilestones(Array.isArray(res) ? res : (res as any)?.milestones ?? []);
    }).catch(() => {});
  }, [projectId]);

  const loadGantt = () => {
    if (!planId) return;
    setLoading(true);
    api.get<{ data: PlanGanttTask[]; links: PlanGanttLink[] }>(`/plans/${planId}/gantt-data`)
      .then((res) => {
        setTasks(res?.data ?? []);
        setLinks(res?.links ?? []);
      })
      .catch(() => toast.error(t("enterpriseGantt.loadError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGantt(); }, [planId]);

  const milestoneMarkers: PlanGanttMilestoneMarker[] = useMemo(
    () => milestones.map((m) => ({ id: m.id, title: m.title, date: m.date })),
    [milestones]
  );

  const createDefaultPlan = async () => {
    if (!projectId) return;
    try {
      const res: any = await api.post("/plans", {
        name: "Full Detailed Plan", project_id: projectId, type: "Detailed Plan", description: "",
      });
      const newPlan = res?.plan;
      if (newPlan) {
        setPlans((prev) => [...prev, newPlan]);
        setPlanId(newPlan.id);
      }
      toast.success(t("enterpriseGantt.planCreated"));
    } catch (e: any) {
      toast.error(e?.message || t("enterpriseGantt.saveError"));
    }
  };

  const openCreateTask = () => {
    if (!planId) return;
    setDraft(blankTask(planId));
    setTaskDialogOpen(true);
  };

  const openEditTask = (id: string) => {
    const task = tasks.find((tk) => tk.id === id);
    if (!task) return;
    setDraft({
      id: task.id,
      plan_id: planId,
      text: task.text,
      description: task.description || "",
      start_date: task.start_date.slice(0, 10),
      duration: task.duration,
      status: task.status,
      priority: task.priority,
      type: task.type,
      assigned_to: task.assigned_to || "",
    });
    setTaskDialogOpen(true);
  };

  const saveTask = async () => {
    if (!draft.text.trim()) { toast.error(t("enterpriseGantt.textRequired")); return; }
    setSaving(true);
    const payload = {
      text: draft.text.trim(),
      description: draft.description || null,
      start_date: draft.start_date,
      duration: Number(draft.duration) || 1,
      status: draft.status,
      priority: draft.priority,
      type: draft.type,
      is_milestone: draft.type === "milestone",
      assigned_to: draft.assigned_to || null,
    };
    try {
      if (draft.id) {
        await api.put(`/plan-tasks/${draft.id}`, payload);
      } else {
        await api.post("/plan-tasks", { ...payload, plan_id: planId });
      }
      toast.success(t("enterpriseGantt.taskSaved"));
      setTaskDialogOpen(false);
      loadGantt();
    } catch (e: any) {
      toast.error(e?.message || t("enterpriseGantt.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!confirmDelete) return;
    try {
      await api.del(`/plan-tasks/${confirmDelete.id}`);
      toast.success(t("enterpriseGantt.taskDeleted"));
      setConfirmDelete(null);
      loadGantt();
    } catch (e: any) {
      toast.error(e?.message || t("enterpriseGantt.saveError"));
    }
  };

  const addDependency = async () => {
    if (!depSource || !depTarget || depSource === depTarget) {
      toast.error(t("enterpriseGantt.depInvalid"));
      return;
    }
    try {
      await api.post("/plan-dependencies", { source: depSource, target: depTarget, type: depType, lag: depLag });
      toast.success(t("enterpriseGantt.depAdded"));
      setDepSource(""); setDepTarget(""); setDepLag(0);
      loadGantt();
    } catch (e: any) {
      toast.error(e?.message || t("enterpriseGantt.saveError"));
    }
  };

  const removeDependency = async (link: PlanGanttLink) => {
    try {
      await api.del(`/plan-dependencies?source=${link.source}&target=${link.target}`);
      loadGantt();
    } catch (e: any) {
      toast.error(e?.message || t("enterpriseGantt.saveError"));
    }
  };

  const saveMilestone = async () => {
    if (!msDraft.title.trim() || !projectId) return;
    try {
      // ponytail: /milestones has no project association endpoint yet, so the
      // new milestone isn't scoped to `projectId` server-side — acceptable
      // until that relation is wired into the API.
      await api.post("/milestones", {
        name: msDraft.title.trim(), date: msDraft.date,
        status: "pending", priority: "medium",
      });
      toast.success(t("enterpriseGantt.milestoneSaved"));
      setMsDialogOpen(false);
      setMsDraft({ title: "", date: new Date().toISOString().slice(0, 10) });
      const res = await api.get<MilestoneRecord[] | { milestones: MilestoneRecord[] }>(`/milestones`);
      setMilestones(Array.isArray(res) ? res : (res as any)?.milestones ?? []);
    } catch (e: any) {
      toast.error(e?.message || t("enterpriseGantt.saveError"));
    }
  };

  const exportPlan = (type: "json" | "excel" | "html") => {
    if (!planId) return;

    const payload = {
      projectId,
      planId,
      exportedAt: new Date().toISOString(),
      milestones,
      tasks,
      links,
    };

    if (type === "json") {
      downloadTextFile(
        `enterprise-gantt-plan-${planId}.json`,
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }

    const rows = tasks.map((task) => `
      <tr>
        <td>${escapeHtml(task.text)}</td>
        <td>${escapeHtml(task.status)}</td>
        <td>${escapeHtml(task.priority)}</td>
        <td>${escapeHtml(task.start_date)}</td>
        <td>${escapeHtml(task.duration)}</td>
        <td>${escapeHtml(task.assigned_to ?? "")}</td>
      </tr>
    `).join("");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Enterprise Gantt Plan ${escapeHtml(planId)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1, h2 { margin: 0 0 12px; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
      th { background: #f9fafb; }
    </style>
  </head>
  <body>
    <h1>Enterprise Gantt Plan ${escapeHtml(planId)}</h1>
    <p>Project: ${escapeHtml(projectId)}</p>
    <p>Exported at: ${escapeHtml(payload.exportedAt)}</p>
    <h2>Tasks</h2>
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Start</th>
          <th>Duration</th>
          <th>Assigned To</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan='6'>No tasks</td></tr>"}
      </tbody>
    </table>
  </body>
</html>`;

    downloadTextFile(
      `enterprise-gantt-plan-${planId}.${type === "excel" ? "xls" : "html"}`,
      html,
      type === "excel" ? "application/vnd.ms-excel;charset=utf-8" : "text/html;charset=utf-8"
    );
  };

  const selectedProject = projects.find((p) => String(p.id) === projectId);

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("enterpriseGantt.title")}
          subtitle={t("enterpriseGantt.subtitle")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger size="sm" className="w-[180px]">
                  <SelectValue placeholder={t("enterpriseGantt.project")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={planId ? String(planId) : ""} onValueChange={(v) => setPlanId(Number(v))}>
                <SelectTrigger size="sm" className="w-[180px]">
                  <SelectValue placeholder={t("enterpriseGantt.plan")} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center rounded-lg border border-border bg-card">
                {(["day", "week", "month"] as GanttZoom[]).map((z) => (
                  <Button key={z} size="sm" variant={zoom === z ? "default" : "ghost"} className="rounded-none first:rounded-l-lg last:rounded-r-lg" onClick={() => setZoom(z)}>
                    {t(`gantt.zoom.${z}`)}
                  </Button>
                ))}
              </div>

              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMsDialogOpen(true)} disabled={!projectId}>
                <MilestoneIcon className="h-3.5 w-3.5" /> {t("enterpriseGantt.addMilestone")}
              </Button>

              <Button size="sm" className="gap-1.5" onClick={openCreateTask} disabled={!planId}>
                <Plus className="h-4 w-4" /> {t("enterpriseGantt.addTask")}
              </Button>
            </div>
          }
        />

        {!loading && !planId && projectId && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="mb-3 text-sm text-muted-foreground">{t("enterpriseGantt.noPlan", { project: selectedProject?.name })}</p>
            <Button size="sm" onClick={createDefaultPlan}>{t("enterpriseGantt.createPlan")}</Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && planId && (
          <>
            <PlanGanttChart tasks={tasks} links={links} milestoneMarkers={milestoneMarkers} zoom={zoom} onTaskClick={openEditTask} className="mb-4" />

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Dependencies panel */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Link2 className="h-4 w-4" /> {t("enterpriseGantt.dependencies")}
                </h2>
                <div className="mb-3 flex flex-wrap items-end gap-2">
                  <Select value={depSource} onValueChange={setDepSource}>
                    <SelectTrigger size="sm" className="w-[150px]"><SelectValue placeholder={t("enterpriseGantt.predecessor")} /></SelectTrigger>
                    <SelectContent>
                      {tasks.map((tk) => <SelectItem key={tk.id} value={tk.id}>{tk.text}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={depTarget} onValueChange={setDepTarget}>
                    <SelectTrigger size="sm" className="w-[150px]"><SelectValue placeholder={t("enterpriseGantt.successor")} /></SelectTrigger>
                    <SelectContent>
                      {tasks.map((tk) => <SelectItem key={tk.id} value={tk.id}>{tk.text}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={depType} onValueChange={setDepType}>
                    <SelectTrigger size="sm" className="w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEP_TYPES.map((dt) => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={0} value={depLag} onChange={(e) => setDepLag(Number(e.target.value))} className="w-[70px]" placeholder={t("enterpriseGantt.lag")} />
                  <Button size="sm" onClick={addDependency}>{t("app.create")}</Button>
                </div>
                <div className="space-y-1.5">
                  {links.length === 0 && <p className="text-xs text-muted-foreground">{t("enterpriseGantt.noDependencies")}</p>}
                  {links.map((link) => {
                    const from = tasks.find((tk) => tk.id === link.source)?.text ?? link.source;
                    const to = tasks.find((tk) => tk.id === link.target)?.text ?? link.target;
                    return (
                      <div key={link.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                        <span className="truncate">{from} → {to} <span className="text-muted-foreground">({link.type}{link.lag ? `, +${link.lag}d` : ""})</span></span>
                        <Button variant="ghost" size="icon-sm" className="text-destructive shrink-0" onClick={() => removeDependency(link)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Milestones + export panel */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <MilestoneIcon className="h-4 w-4" /> {t("enterpriseGantt.milestones")}
                </h2>
                <div className="mb-4 space-y-1.5">
                  {milestones.length === 0 && <p className="text-xs text-muted-foreground">{t("enterpriseGantt.noMilestones")}</p>}
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                      <span className="truncate">{m.title}</span>
                      <span className="shrink-0 text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>

                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Download className="h-4 w-4" /> {t("enterpriseGantt.export")}
                </h2>
                <div className="flex gap-2">
                  {["json", "excel", "html"].map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!planId}
                      onClick={() => exportPlan(type as "json" | "excel" | "html")}
                    >
                      {type.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Task create/edit dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? t("enterpriseGantt.editTask") : t("enterpriseGantt.addTask")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("enterpriseGantt.taskName")}</Label>
              <Input value={draft.text} autoFocus onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("enterpriseGantt.taskDescription")}</Label>
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("enterpriseGantt.startDate")}</Label>
                <DatePicker value={draft.start_date} onChange={(v) => setDraft({ ...draft, start_date: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("enterpriseGantt.durationDays")}</Label>
                <Input type="number" min={1} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("enterpriseGantt.status")}</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("enterpriseGantt.priority")}</Label>
                <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v })}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("enterpriseGantt.type")}</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("enterpriseGantt.assignee")}</Label>
              <Select value={draft.assigned_to} onValueChange={(v) => setDraft({ ...draft, assigned_to: v })}>
                <SelectTrigger size="sm"><SelectValue placeholder={t("enterpriseGantt.unassigned")} /></SelectTrigger>
                <SelectContent>
                  {lookups.users.map((u: any) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {draft.id && (
              <Button
                variant="outline"
                className="mr-auto text-destructive"
                onClick={() => {
                  const task = tasks.find((tk) => tk.id === draft.id);
                  if (task) { setTaskDialogOpen(false); setConfirmDelete(task); }
                }}
              >
                {t("app.delete")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveTask} disabled={saving}>{draft.id ? t("app.saveChanges") : t("app.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add milestone dialog */}
      <Dialog open={msDialogOpen} onOpenChange={setMsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("enterpriseGantt.addMilestone")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("enterpriseGantt.milestoneTitle")}</Label>
              <Input value={msDraft.title} onChange={(e) => setMsDraft({ ...msDraft, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("enterpriseGantt.milestoneDate")}</Label>
              <DatePicker value={msDraft.date} onChange={(v) => setMsDraft({ ...msDraft, date: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveMilestone}>{t("app.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={t("enterpriseGantt.deleteTaskTitle")}
        description={t("enterpriseGantt.deleteTaskDesc", { name: confirmDelete?.text })}
        onConfirm={deleteTask}
      />
    </div>
  );
}

export default EnterpriseGanttPage;
