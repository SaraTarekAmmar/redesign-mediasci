import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react";
import { api } from "../lib/api";
import { seedIssues } from "../data/seed";
import { lookups } from "../store/useStore";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { SectionCard } from "../components/common/SectionCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";
const D: any = (typeof window !== "undefined" && (window as any).__DATA__) || {};
const bootstrapProjects = Array.isArray(D.projects) ? D.projects : [];

type AdminTaskStatus = "todo" | "in_progress" | "hold" | "done" | "canceled";

interface AdminTask {
  id: number;
  project_id: number | null;
  subject: string;
  comment: string | null;
  person_name: string;
  user_id: number | null;
  start_date: string | null;
  end_date: string | null;
  status: AdminTaskStatus;
  status_label?: string;
  notes: string | null;
  additional_notes: string | null;
  project?: { id: number; name: string } | null;
  assignee?: { id: number; name: string } | null;
}

interface UserOption { id: number | string; name: string; }

const STATUS_COLORS: Record<AdminTaskStatus, string> = {
  todo: "#6B7280", in_progress: "var(--primary)", hold: "#F59E0B", done: "#10B981", canceled: "#EF4444",
};

const STATUS_LABEL_PREFIX = /^admintasks\.status\.|^adminTasks\.status\./i;

function humanizeStatusLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getAdminTaskStatusLabel(t: (key: string) => string, status: string, statusLabel?: string | null) {
  const normalizedLabel = (statusLabel || "").trim().replace(STATUS_LABEL_PREFIX, "");
  if (normalizedLabel) return humanizeStatusLabel(normalizedLabel);
  const translated = t(`adminTasks.status.${status}`);
  return translated === `adminTasks.status.${status}` ? humanizeStatusLabel(status) : translated;
}

function getAdminTaskStatusColor(status: string) {
  return STATUS_COLORS[status as AdminTaskStatus] ?? "#6B7280";
}

function issueToAdminTask(issue: (typeof seedIssues)[number], index: number): AdminTask {
  const project = bootstrapProjects.find((entry) => String(entry.id) === String(issue.projectId ?? ""));
  const assignee = issue.assigneeId ? lookups.userById[issue.assigneeId] : null;
  const status = lookups.statusById[issue.statusId];
  const priority = lookups.priorityById[issue.priorityId];

  return {
    id: index + 1,
    project_id: project ? Number(project.id) : null,
    subject: issue.title,
    comment: issue.description ?? null,
    person_name: assignee?.name ?? "Unassigned",
    user_id: assignee ? Number(assignee.id) || index + 1 : null,
    start_date: null,
    end_date: issue.dueDate ?? null,
    status:
      status?.category === "done" ? "done" :
      status?.category === "in_progress" ? "in_progress" :
      "todo",
    status_label: status?.name,
    notes: [issue.key, priority?.name].filter(Boolean).join(" • ") || null,
    additional_notes: null,
    project: project ? { id: Number(project.id), name: project.name } : null,
    assignee: assignee ? { id: Number(assignee.id) || index + 1, name: assignee.name } : null,
  };
}

function fallbackAdminTasks(search: string, statusFilter: string, projectFilter: string): AdminTask[] {
  return seedIssues.
    map(issueToAdminTask).
    filter((task) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit =
          task.subject.toLowerCase().includes(q) ||
          (task.comment ?? "").toLowerCase().includes(q) ||
          (task.notes ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (projectFilter !== "all" && String(task.project_id ?? "") !== projectFilter) return false;
      return true;
    });
}

const blankForm = () => ({
  project_id: "", subject: "", comment: "", person_name: "", user_id: "",
  start_date: "", end_date: "", status: "todo" as AdminTaskStatus, notes: "", additional_notes: "",
});

function AdminTasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminTask | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (projectFilter !== "all") params.set("project_id", projectFilter);
      const res = await api.get<{ data: AdminTask[] }>(`/admin-tasks?${params}`);
      setTasks(res?.data ?? []);
    } catch (e: any) {
      const fallback = fallbackAdminTasks(search, statusFilter, projectFilter);
      setTasks(fallback);
      setError(fallback.length ? null : e?.message || t("adminTasks.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // /admin/users is admin/PM-only; fall back to the current project's roster (bootstrap) for other roles.
    api.get<UserOption[] | { data: UserOption[] }>("/admin/users")
      .then((res) => setUsers(Array.isArray(res) ? res : (res as any)?.data ?? []))
      .catch(() => setUsers(lookups.users as any));
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, projectFilter]);

  const openCreate = () => { setEditId(null); setForm(blankForm()); setDialogOpen(true); };
  const openEdit = (task: AdminTask) => {
    setEditId(task.id);
    setForm({
      project_id: task.project_id ? String(task.project_id) : "",
      subject: task.subject,
      comment: task.comment || "",
      person_name: task.person_name,
      user_id: task.user_id ? String(task.user_id) : "",
      start_date: task.start_date || "",
      end_date: task.end_date || "",
      status: task.status,
      notes: task.notes || "",
      additional_notes: task.additional_notes || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.subject.trim() || !form.person_name.trim()) {
      toast.error(t("adminTasks.requiredFields"));
      return;
    }
    setSaving(true);
    const payload = {
      project_id: form.project_id || null,
      subject: form.subject.trim(),
      comment: form.comment || null,
      person_name: form.person_name.trim(),
      user_id: form.user_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes || null,
      additional_notes: form.additional_notes || null,
    };
    try {
      if (editId) {
        await api.put(`/admin-tasks/${editId}`, payload);
        toast.success(t("adminTasks.updated"));
      } else {
        await api.post(`/admin-tasks`, payload);
        toast.success(t("adminTasks.created"));
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || t("adminTasks.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (task: AdminTask) => {
    const prev = tasks;
    setTasks((cur) => cur.filter((x) => x.id !== task.id));
    try {
      await api.del(`/admin-tasks/${task.id}`);
      toast.success(t("adminTasks.deleted"));
    } catch (e: any) {
      setTasks(prev);
      toast.error(e?.message || t("adminTasks.deleteError"));
    }
  };

  const statusOptions: AdminTaskStatus[] = ["todo", "in_progress", "hold", "done", "canceled"];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("adminTasks.title")}
          subtitle={t("adminTasks.subtitle")}
          icon={<ClipboardList className="h-5 w-5" />}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("adminTasks.newTask")}
            </Button>
          }
        />

        <SectionCard title={t("adminTasks.filters", { defaultValue: "Filter task queue" })} className="mb-5" bodyClassName="flex flex-wrap gap-2">
          <Input
            placeholder={t("adminTasks.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[220px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminTasks.allStatuses")}</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s}>{t(`adminTasks.status.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminTasks.allProjects")}</SelectItem>
              {bootstrapProjects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </SectionCard>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <EmptyState icon={<ClipboardList className="h-8 w-8" />} title={t("adminTasks.empty")} subtitle={t("adminTasks.emptySubtitle", { defaultValue: "No administrative tasks match the current filters." })} />
        )}

        {!loading && !error && tasks.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.project")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.subject")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.person")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.start")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.end")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.status")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.notes")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("adminTasks.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{task.project?.name || "-"}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{task.subject}</p>
                      {task.comment && <p className="text-xs text-muted-foreground">{task.comment}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <p>{task.person_name}</p>
                      {task.assignee && <p className="text-xs text-primary">@{task.assignee.name}</p>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">{task.start_date || "-"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">{task.end_date || "-"}</td>
                    <td className="px-4 py-2.5">
                      <Badge style={{ backgroundColor: `${getAdminTaskStatusColor(task.status)}22`, color: getAdminTaskStatusColor(task.status) }}>
                        {getAdminTaskStatusLabel(t, task.status, task.status_label)}
                      </Badge>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-muted-foreground">{task.notes || "-"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEdit(task)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={t("app.delete")} onClick={() => setConfirmDelete(task)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? t("adminTasks.editTask") : t("adminTasks.newTask")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("adminTasks.col.project")}</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("adminTasks.none")}</SelectItem>
                  {bootstrapProjects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("adminTasks.col.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AdminTaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => <SelectItem key={s} value={s}>{t(`adminTasks.status.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("adminTasks.col.subject")} *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t("adminTasks.subjectPlaceholder")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("adminTasks.comment")}</Label>
              <Textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("adminTasks.personName")} * ({t("adminTasks.canBeExternal")})</Label>
              <Input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} placeholder={t("adminTasks.personPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("adminTasks.linkToUser")}</Label>
              <Select value={form.user_id || "none"} onValueChange={(v) => setForm({ ...form, user_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("adminTasks.externalOnly")}</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("adminTasks.col.start")}</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("adminTasks.col.end")}</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("adminTasks.col.notes")}</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("adminTasks.additionalNotes")}</Label>
              <Textarea rows={2} value={form.additional_notes} onChange={(e) => setForm({ ...form, additional_notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={save} disabled={saving}>{editId ? t("settings.saveChanges") : t("adminTasks.newTask")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={t("adminTasks.deleteTitle")}
        description={t("adminTasks.deleteDescription", { subject: confirmDelete?.subject })}
        onConfirm={() => { if (confirmDelete) remove(confirmDelete); }}
      />
    </div>
  );
}

export default AdminTasksPage;
