


import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Users, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Department } from "../data/opsTypes";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { UserAvatar } from "../components/common/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

interface UserOption {
  id: string;
  name: string;
  role?: string;
}

const normalizeDepartment = (dept: any): Department => ({
  id: String(dept?.id ?? ""),
  name: dept?.name ?? "",
  type: dept?.type ?? "department",
  description: dept?.description ?? "",
  color: dept?.color ?? "#3b82f6",
  leaderId: String(dept?.team_leader_id ?? dept?.leaderId ?? dept?.teamLeader?.id ?? ""),
  membersCount: Number(dept?.users_count ?? dept?.membersCount ?? dept?.members_count ?? 0),
});

const mergeDepartment = (current: Department, next: Department): Department => ({
  ...current,
  ...next,
  membersCount: next.membersCount || current.membersCount || 0,
});

const blank = (): Department => ({
  id: "",
  name: "",
  type: "department",
  leaderId: "",
  membersCount: 0,
  color: "#3b82f6"
});

function DepartmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Department>(blank());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
        setError(null);
      try {
        const [depts, userData] = await Promise.all([
          api.get<Department[]>("/departments"),
          api.get<any>("/skills-directory"),
        ]);
        if (!cancelled) {
          setDepartments(Array.isArray(depts) ? depts.map(normalizeDepartment) : []);
          setUsers(Array.isArray(userData?.users) ? userData.users : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setDepartments([]);
          setUsers([]);
          setError(e?.message || "Failed to load departments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isEditing = draft.id !== "";

  const openCreate = () => { setDraft(blank()); setDialogOpen(true); };
  const openEdit = (d: Department) => { setDraft({ ...d }); setDialogOpen(true); };

  const payload = (d: Department) => ({
    name: d.name.trim(),
    type: d.type === "freelance" ? "freelance" : "department",
    color: d.color || "#3b82f6",
    team_leader_id: d.leaderId || null
  });

  const save = async () => {
    if (!draft.name.trim()) { toast.error(t("departments.nameRequired")); return; }
      setSaving(true);
    try {
      if (isEditing) {
        const res = await api.put(`/departments/${draft.id}`, payload(draft));
        const next = normalizeDepartment(res);
        setDepartments((prev) => prev.map((d) => d.id === draft.id ? mergeDepartment(d, next) : d));
        toast.success(t("departments.updated"));
      } else {
        const res = await api.post(`/departments`, payload(draft));
        setDepartments((prev) => [...prev, normalizeDepartment(res)]);
        toast.success(t("departments.created"));
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("departments.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Department) => {
    const prev = departments;
    setDepartments((cur) => cur.filter((x) => x.id !== d.id));
    try {
      await api.del(`/departments/${d.id}`);
      toast.success(t("departments.deleted"));
    } catch (e: any) {
      setDepartments(prev);
      toast.error(e?.message || t("departments.deleteError"));
    }
  };

  const totalMembers = departments.reduce((s, d) => s + d.membersCount, 0);

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("departments.title")}
          subtitle={loading ? "Loading…" : t("departments.subtitle", { count: departments.length, members: totalMembers })}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("departments.newDepartment")}
            </Button>
          }
        />

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

        {!loading && !error && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => {
              const leader = users.find((u) => String(u.id) === String(d.leaderId));
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/resources?department_id=${d.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/resources?department_id=${d.id}`); }}
                  className="relative group cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: d.color }}
                      >
                        <Users className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={(e) => { e.stopPropagation(); openEdit(d); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                      <UserAvatar userId={d.leaderId} size="sm" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("departments.departmentLeader", { defaultValue: "Department leader" })}</p>
                        <p className="text-xs font-medium text-foreground">{leader?.name || t("departments.unassigned")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold leading-none text-foreground">{d.membersCount}</p>
                      <p className="text-xs text-muted-foreground">{t("departments.members")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {departments.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                {t("departments.noDepartments")}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("departments.editDepartment") : t("departments.newDepartmentDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">{t("departments.departmentName")}</Label>
              <Input
                id="dept-name"
                value={draft.name}
                autoFocus
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("departments.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-type">{t("departments.typeDivision")}</Label>
              <Input
                id="dept-type"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                placeholder={t("departments.typePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("departments.departmentLeader", { defaultValue: "Department leader" })}</Label>
              <Select
                value={draft.leaderId ? String(draft.leaderId) : "__none__"}
                onValueChange={(v) => setDraft({ ...draft, leaderId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("departments.selectDepartmentLeader", { defaultValue: "Select department leader" })} />
                </SelectTrigger>
                <SelectContent className="mt-2 w-[28rem] max-w-[calc(100vw-2rem)] max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto rounded-2xl border border-border/60 bg-popover p-1 shadow-2xl">
                  <SelectItem value="__none__">{t("departments.unassigned")}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("departments.badgeColor")}</Label>
              <div className="flex items-center gap-2 pt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full transition-transform",
                      draft.color === c ? "ring-2 ring-ring ring-offset-2 scale-110" : ""
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setDraft({ ...draft, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={save} disabled={saving}>{isEditing ? t("settings.saveChanges") : t("departments.newDepartmentDialog")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={t("departments.deleteTitle")}
        description={t("departments.deleteDescription", { name: confirmDelete?.name })}
        onConfirm={() => { if (confirmDelete) remove(confirmDelete); }}
        confirmLabel={t("departments.delete")}
      />
    </div>
  );
}
export default DepartmentsPage;
