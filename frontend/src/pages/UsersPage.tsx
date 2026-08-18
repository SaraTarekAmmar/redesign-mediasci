import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Trash2, Users, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { UserAvatar } from "../components/common/UserAvatar";
import { StatTile } from "../components/common/StatTile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";
import { Label } from "../components/ui/Label";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  job_title?: string | null;
  is_active: boolean;
}

interface RoleOption {
  id: number;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  "super-admin": "Super Admin",
  admin: "Admin",
  "project-manager": "Project Manager",
  "team-leader": "Team Leader",
  developer: "Developer",
  member: "Member",
  viewer: "Viewer",
  "account-manager": "Account Manager",
  "department-manager": "Department Manager",
  "hr-manager": "HR Manager",
  reviewer: "Reviewer",
  executive: "Executive",
};

function formatRoleLabel(name: string): string {
  if (!name) return "—";
  return ROLE_LABELS[name] || name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const emptyInvite = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
  role: "",
  is_active: true,
};

function UsersPage() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState({ ...emptyInvite });

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    id: 0,
    name: "",
    email: "",
    role: "",
    is_active: true,
  });
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const assignableRoles = useMemo(() => {
    const list = roles.length
      ? roles
      : [
          { id: 0, name: "super-admin" },
          { id: 0, name: "admin" },
          { id: 0, name: "project-manager" },
          { id: 0, name: "team-leader" },
          { id: 0, name: "developer" },
          { id: 0, name: "member" },
          { id: 0, name: "viewer" },
        ];
    // Admins cannot escalate to Super Admin; Super Admin retains full control.
    if (!isSuperAdmin) {
      return list.filter((r) => r.name !== "super-admin");
    }
    return list;
  }, [roles, isSuperAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/users");
      setUsers(res?.data ?? res?.users ?? []);
    } catch {
      toast.error(t("users.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get<RoleOption[] | { data: RoleOption[] }>("/admin/roles");
      const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setRoles(list);
    } catch {
      // Fallback options remain available via assignableRoles.
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const activeCount = users.filter((user) => user.is_active).length;
  const inactiveCount = users.length - activeCount;
  const roleCount = new Set(users.map((user) => user.role).filter(Boolean)).size;

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()) ||
      (u.job_title || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.role || "").toLowerCase().includes(q.toLowerCase())
  );

  const toggleActive = async (u: UserRow) => {
    const endpoint = u.is_active ? "deactivate" : "activate";
    const prev = users;
    setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      await api.post(`/admin/users/${u.id}/${endpoint}`);
      toast.success(u.is_active ? t("users.deactivated", { name: u.name }) : t("users.activated", { name: u.name }));
    } catch (e: any) {
      setUsers(prev);
      toast.error(e?.message || t("users.updateFailed"));
    }
  };

  const invite = async () => {
    if (!inviteDraft.name.trim() || !inviteDraft.email.trim()) {
      toast.error(t("users.nameEmailRequired"));
      return;
    }
    if (!inviteDraft.role) {
      toast.error(t("users.roleRequired", { defaultValue: "Job Title / Role is required" }));
      return;
    }
    if (inviteDraft.password.length < 8) {
      toast.error(t("users.passwordTooShort"));
      return;
    }
    if (inviteDraft.password !== inviteDraft.password_confirmation) {
      toast.error(t("users.passwordMismatch", { defaultValue: "Passwords do not match" }));
      return;
    }
    setSaving(true);
    try {
      // One concept: Job Title / Role. Backend writes users.job_title + model_has_roles.
      await api.post("/admin/users", {
        name: inviteDraft.name.trim(),
        email: inviteDraft.email.trim(),
        password: inviteDraft.password,
        role: inviteDraft.role,
        is_active: inviteDraft.is_active,
      });
      toast.success(t("users.invitationSent", { email: inviteDraft.email }));
      setInviteOpen(false);
      setInviteDraft({ ...emptyInvite });
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message || t("users.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async () => {
    if (!editDraft.name.trim() || !editDraft.email.trim()) {
      toast.error(t("users.nameEmailRequired"));
      return;
    }
    if (!editDraft.role) {
      toast.error(t("users.roleRequired", { defaultValue: "Job Title / Role is required" }));
      return;
    }
    setSaving(true);
    try {
      await api.put(`/admin/users/${editDraft.id}`, {
        name: editDraft.name.trim(),
        email: editDraft.email.trim(),
        role: editDraft.role,
        is_active: editDraft.is_active,
      });
      toast.success(t("users.updateSuccess", { defaultValue: "User updated successfully." }));
      setEditOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message || t("users.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!confirmDelete) return;
    try {
      const res = await api.del(`/admin/users/${confirmDelete.id}`);
      toast.success(res?.message || t("users.deleteSuccess", { defaultValue: "User deactivated/deleted successfully." }));
      setConfirmDelete(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.message || t("users.deleteFailed", { defaultValue: "Failed to delete user." }));
    }
  };

  const roleSelect = (
    value: string,
    onChange: (role: string) => void,
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
      required
    >
      <option value="">{t("users.selectJobTitleRole", { defaultValue: "Select job title / role…" })}</option>
      {assignableRoles.map((r) => (
        <option key={r.name} value={r.name}>
          {formatRoleLabel(r.name)}
        </option>
      ))}
      {value && !assignableRoles.some((r) => r.name === value) && (
        <option value={value}>{formatRoleLabel(value)}</option>
      )}
    </select>
  );

  const statusSelect = (
    value: boolean,
    onChange: (isActive: boolean) => void,
  ) => (
    <select
      value={value ? "active" : "inactive"}
      onChange={(e) => onChange(e.target.value === "active")}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
    >
      <option value="active">{t("users.active")}</option>
      <option value="inactive">{t("users.inactive")}</option>
    </select>
  );

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("users.title")}
          subtitle={t("users.subtitle", { count: users.length })}
          actions={
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setInviteDraft({ ...emptyInvite });
                setInviteOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t("users.inviteUser")}
            </Button>
          }
        />

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <StatTile label="Total users" value={users.length} icon={<Users className="h-4 w-4" />} hint="All workspace accounts" />
          <StatTile label="Active" value={activeCount} color="green" icon={<ShieldCheck className="h-4 w-4" />} hint={`${inactiveCount} inactive`} />
          <StatTile label="Roles in use" value={roleCount} color="neutral" icon={<UserX className="h-4 w-4" />} hint="Distinct access levels" />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Workspace access</h2>
            <p className="mt-1 text-xs text-muted-foreground">Invite, review, or deactivate accounts without leaving the roster.</p>
          </div>
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={t("users.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("users.searchPlaceholder")} className="h-8 pl-8" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">{t("users.colUser")}</th>
                <th className="px-3 py-2.5 font-medium">{t("users.colRole")}</th>
                <th className="px-3 py-2.5 font-medium">{t("users.colEmail")}</th>
                <th className="px-3 py-2.5 font-medium">{t("users.colStatus")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t("users.colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {t("users.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {q ? t("users.noMatch", { q }) : t("users.noUsers")}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link to={`/users/${u.id}`} className="flex items-center gap-2.5 hover:underline">
                        <UserAvatar userId={String(u.id)} size="sm" />
                        <span className="font-medium text-foreground">{u.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {u.job_title || formatRoleLabel(u.role)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-3">
                      <Badge variant={u.is_active ? "default" : "secondary"}>
                        {u.is_active ? t("users.active") : t("users.inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="xs" variant="outline" onClick={() => toggleActive(u)}>
                          {u.is_active ? t("users.deactivate") : t("users.activate")}
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setEditDraft({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              role: u.role || "",
                              is_active: u.is_active,
                            });
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDelete(u)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("users.inviteTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>{t("users.name")}</Label>
                <Input
                  value={inviteDraft.name}
                  onChange={(e) => setInviteDraft({ ...inviteDraft, name: e.target.value })}
                  placeholder={t("users.fullName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("users.email")}</Label>
                <Input
                  type="email"
                  value={inviteDraft.email}
                  onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })}
                  placeholder="user@mediasci.co"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("users.password")}</Label>
                  <Input
                    type="password"
                    value={inviteDraft.password}
                    onChange={(e) => setInviteDraft({ ...inviteDraft, password: e.target.value })}
                    placeholder={t("users.passwordMin")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("users.confirm")}</Label>
                  <Input
                    type="password"
                    value={inviteDraft.password_confirmation}
                    onChange={(e) => setInviteDraft({ ...inviteDraft, password_confirmation: e.target.value })}
                    placeholder={t("users.repeatPassword")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("users.jobTitleRole", { defaultValue: "Job Title / Role" })}</Label>
                {roleSelect(inviteDraft.role, (role) => setInviteDraft({ ...inviteDraft, role }))}
              </div>
              <div className="space-y-1.5">
                <Label>{t("users.colStatus")}</Label>
                {statusSelect(inviteDraft.is_active, (is_active) => setInviteDraft({ ...inviteDraft, is_active }))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("app.cancel")}</Button>
              <Button onClick={invite} disabled={saving}>{saving ? t("users.sending") : t("users.sendInvitation")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("users.editTitle", { defaultValue: "Edit User Profile" })}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>{t("users.name")}</Label>
                <Input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("users.email")}</Label>
                <Input
                  type="email"
                  value={editDraft.email}
                  onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("users.jobTitleRole", { defaultValue: "Job Title / Role" })}</Label>
                {roleSelect(editDraft.role, (role) => setEditDraft({ ...editDraft, role }))}
              </div>
              <div className="space-y-1.5">
                <Label>{t("users.colStatus")}</Label>
                {statusSelect(editDraft.is_active, (is_active) => setEditDraft({ ...editDraft, is_active }))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>{t("app.cancel")}</Button>
              <Button onClick={saveUser} disabled={saving}>{saving ? t("app.saving") : t("app.saveChanges")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(open) => !open && setConfirmDelete(null)}
          title={t("users.deleteTitle", { defaultValue: "Deactivate / Delete User" })}
          description={t("users.deleteDesc", {
            name: confirmDelete?.name,
            defaultValue: `Are you sure you want to deactivate/delete user "${confirmDelete?.name}"? Deletion will be blocked if the user is a project/team owner, department leader, or assigned to active issues.`
          })}
          onConfirm={deleteUser}
        />
      </div>
    </div>
  );
}

export default UsersPage;
