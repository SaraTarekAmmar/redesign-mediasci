import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Users, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
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
  DialogFooter,
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const COLORS = ["#111827", "#10b981", "#f59e0b", "#ec4899", "#f43f5e", "#64748b", "#374151"];

interface UserOption {
  id: string;
  name: string;
  role?: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  department_id?: string | number | null;
  department?: { id: string | number; name: string } | null;
  description?: string | null;
  color?: string | null;
  owner_id?: string | number | null;
  is_active?: boolean;
  members_count?: number;
  members?: { id: string; name: string; avatar_url?: string | null }[];
}

const normalizeTeam = (team: any): TeamRow => ({
  id: String(team?.id ?? ""),
  name: team?.name ?? "",
  slug: team?.slug ?? "",
  department_id: team?.department_id ?? team?.departmentId ?? team?.department?.id ?? null,
  department: team?.department ? {
    id: String(team.department.id ?? ""),
    name: team.department.name ?? "",
  } : null,
  description: team?.description ?? "",
  color: team?.color ?? "#111827",
  owner_id: team?.owner_id ?? team?.ownerId ?? null,
  is_active: team?.is_active ?? true,
  members_count: Number(team?.members_count ?? team?.membersCount ?? 0),
  members: Array.isArray(team?.members) ? team.members.map((member: any) => ({
    id: String(member?.id ?? ""),
    name: member?.name ?? "",
    avatar_url: member?.avatar_url ?? null,
  })) : [],
});

const blank = (): TeamRow => ({
  id: "",
  name: "",
  slug: "",
  department_id: "",
  department: null,
  description: "",
  color: "#111827",
  owner_id: null,
  is_active: true,
  members_count: 0,
  members: [],
});

function TeamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<TeamRow>(blank());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [teamData, directoryResult] = await Promise.all([
          api.get<TeamRow[]>("/teams"),
          api.get<any>("/skills-directory").catch(() => null),
        ]);
        if (!cancelled) {
          setTeams(Array.isArray(teamData) ? teamData.map(normalizeTeam) : []);
          setUsers(Array.isArray(directoryResult?.users) ? directoryResult.users : []);
          setDepartments(Array.isArray(directoryResult?.departments) ? directoryResult.departments : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setTeams([]);
          setUsers([]);
          setDepartments([]);
          setError(e?.message || "Failed to load teams");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canManage = hasPermission("manage-teams");
  const isEditing = draft.id !== "";
  const ownerName = (ownerId: string | number | null | undefined) =>
    users.find((u) => String(u.id) === String(ownerId ?? ""))?.name || t("teams.unassigned", { defaultValue: "Unassigned" });

  const openCreate = () => {
    setDraft(blank());
    setDialogOpen(true);
  };

  const openEdit = (team: TeamRow) => {
    setDraft({ ...team });
    setDialogOpen(true);
  };

  const payload = (team: TeamRow) => ({
    name: team.name.trim(),
    department_id: team.department_id ? Number(team.department_id) : null,
    slug: team.slug.trim() || null,
    description: team.description?.trim() || null,
    color: team.color || "#111827",
    owner_id: team.owner_id ? Number(team.owner_id) : null,
  });

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error(t("teams.nameRequired", { defaultValue: "Team name is required" }));
      return;
    }
    if (!draft.department_id) {
      toast.error(t("teams.departmentRequired", { defaultValue: "Department is required" }));
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        const res = await api.put(`/teams/${draft.id}`, payload(draft));
        const next = normalizeTeam(res);
        setTeams((prev) => prev.map((team) => (team.id === draft.id ? { ...team, ...next } : team)));
        toast.success(t("teams.updated", { defaultValue: "Team updated" }));
      } else {
        const res = await api.post(`/teams`, payload(draft));
        setTeams((prev) => [...prev, normalizeTeam(res)]);
        toast.success(t("teams.created", { defaultValue: "Team created" }));
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("teams.saveError", { defaultValue: "Failed to save team" }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (team: TeamRow) => {
    const prev = teams;
    setTeams((cur) => cur.filter((x) => x.id !== team.id));
    try {
      await api.del(`/teams/${team.id}`);
      toast.success(t("teams.deleted", { defaultValue: "Team deleted" }));
    } catch (e: any) {
      setTeams(prev);
      toast.error(e?.message || t("teams.deleteError", { defaultValue: "Failed to delete team" }));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("teams.title", { defaultValue: "Teams" })}
          subtitle={
            loading
              ? "Loading…"
              : t("teams.subtitle", {
                  defaultValue: "Open a team to view its members in the Resources directory",
                })
          }
          actions={
            canManage ? (
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" /> {t("teams.newTeam", { defaultValue: "New Team" })}
              </Button>
            ) : null
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
            {teams.map((team) => {
              const owner = users.find((u) => String(u.id) === String(team.owner_id ?? ""));
              return (
                <div
                  key={team.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/resources?team_id=${team.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/resources?team_id=${team.id}`);
                    }
                  }}
                  aria-label={`${team.name}: ${t("teams.viewMembers", { defaultValue: "View team members in Resources" })}`}
                  className="relative group cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  title={t("teams.viewMembers", { defaultValue: "View team members in Resources" })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: team.color || "#111827" }}
                      >
                        <Users className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.slug || team.id}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {team.department?.name || departments.find((dept) => String(dept.id) === String(team.department_id ?? ""))?.name || t("teams.noDepartment", { defaultValue: "No department" })}
                        </p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={(e) => { e.stopPropagation(); openEdit(team); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={(e) => { e.stopPropagation(); setConfirmDelete(team); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {team.description && (
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {team.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {(team.members ?? []).slice(0, 4).map((member) => (
                        <UserAvatar key={member.id} userId={member.id} size="xs" className="ring-2 ring-background border-0" />
                      ))}
                    </div>
                    {(team.members ?? []).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(team.members ?? []).length} {t("teams.members", { defaultValue: "Members" })}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar userId={String(team.owner_id ?? "")} size="sm" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("teams.owner", { defaultValue: "Leader" })}</p>
                        <p className="text-xs font-medium text-foreground">{owner?.name || ownerName(team.owner_id)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold leading-none text-foreground">{team.members_count ?? 0}</p>
                      <p className="text-xs text-muted-foreground">{t("teams.members", { defaultValue: "Members" })}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {teams.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                {t("teams.noTeams", { defaultValue: "No teams yet" })}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("teams.editTeam", { defaultValue: "Edit Team" }) : t("teams.newTeamDialog", { defaultValue: "New Team" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("teams.department", { defaultValue: "Department" })}</Label>
              <Select
                value={draft.department_id ? String(draft.department_id) : "__none__"}
                onValueChange={(v) => setDraft({ ...draft, department_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder={t("teams.selectDepartment", { defaultValue: "Select department" })} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("teams.selectDepartment", { defaultValue: "Select department" })}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">{t("teams.teamName", { defaultValue: "Team name" })}</Label>
              <Input
                id="team-name"
                value={draft.name}
                autoFocus
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("teams.namePlaceholder", { defaultValue: "e.g. Platform Engineering" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-slug">{t("teams.slug", { defaultValue: "Slug" })}</Label>
              <Input
                id="team-slug"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder={t("teams.slugPlaceholder", { defaultValue: "platform-engineering" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-description">{t("teams.description", { defaultValue: "Description" })}</Label>
              <Input
                id="team-description"
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t("teams.descriptionPlaceholder", { defaultValue: "Optional notes" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("teams.owner", { defaultValue: "Leader" })}</Label>
              <Select
                value={draft.owner_id ? String(draft.owner_id) : "__none__"}
                onValueChange={(v) => setDraft({ ...draft, owner_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder={t("teams.selectOwner", { defaultValue: "Select leader" })} /></SelectTrigger>
                <SelectContent className="mt-2 w-[28rem] max-w-[calc(100vw-2rem)] max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto rounded-2xl border border-border/60 bg-popover p-1 shadow-2xl">
                  <SelectItem value="__none__">{t("teams.none", { defaultValue: "None" })}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("teams.color", { defaultValue: "Color" })}</Label>
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
            <Button onClick={save} disabled={saving}>{isEditing ? t("settings.saveChanges") : t("teams.newTeamDialog", { defaultValue: "New Team" })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
        title={t("teams.deleteTitle", { defaultValue: "Delete Team" })}
        description={t("teams.deleteDescription", { defaultValue: "Delete this team?" })}
        onConfirm={() => {
          if (confirmDelete) remove(confirmDelete);
        }}
        confirmLabel={t("teams.delete", { defaultValue: "Delete" })}
      />
    </div>
  );
}

export default TeamsPage;
