import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Handshake,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/Dialog";
import { WorkforceBadge } from "../components/common/WorkforceBadge";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";

interface PartnerMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
}

interface PartnerTeam {
  id: number;
  partner_id: number;
  name: string;
  description: string;
  is_active: boolean;
  members: PartnerMember[];
  member_ids: number[];
  members_count: number;
}

interface Partner {
  id: number;
  name: string;
  company: string;
  specialty: string;
  email: string;
  phone: string;
  website: string;
  status: string;
  notes: string;
  color: string;
  members: PartnerMember[];
  members_count: number;
  teams: PartnerTeam[];
  teams_count: number;
}

const emptyPartnerForm = { name: "", company: "", specialty: "", email: "", phone: "", website: "", notes: "" };
const emptyMemberForm = { name: "", email: "", phone: "", role: "" };
const emptyTeamForm = { name: "", description: "", member_ids: [] as number[] };

function memberCountLabel(count: number) {
  return count === 1 ? "1 member" : `${count} members`;
}

function PartnersPage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const canManage = hasRole("super-admin", "admin");

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<number[]>([]);

  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<PartnerMember | null>(null);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<PartnerTeam | null>(null);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Partner[]>("/partners");
      setPartners(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load partners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(
    () => partners.filter((p) => `${p.name} ${p.company} ${p.specialty}`.toLowerCase().includes(query.toLowerCase())),
    [partners, query]
  );
  const selected = partners.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  const teamMemberIds = useMemo(() => {
    const ids = new Set<number>();
    for (const team of selected?.teams ?? []) {
      for (const member of team.members ?? []) ids.add(member.id);
      for (const memberId of team.member_ids ?? []) ids.add(memberId);
    }
    return ids;
  }, [selected]);

  const directMembers = useMemo(
    () => (selected?.members ?? []).filter((member) => !teamMemberIds.has(member.id)),
    [selected, teamMemberIds]
  );

  useEffect(() => {
    if (!selected) {
      setExpandedTeamIds([]);
      return;
    }
    setExpandedTeamIds((selected.teams ?? []).map((team) => team.id));
  }, [selected?.id]);

  const openCreatePartner = () => {
    setEditingPartner(null);
    setPartnerForm(emptyPartnerForm);
    setPartnerDialogOpen(true);
  };

  const openEditPartner = (p: Partner) => {
    setEditingPartner(p);
    setPartnerForm({ name: p.name, company: p.company, specialty: p.specialty, email: p.email, phone: p.phone, website: p.website, notes: p.notes });
    setPartnerDialogOpen(true);
  };

  const savePartner = async () => {
    if (!partnerForm.name.trim()) { toast.error("Partner name is required"); return; }
    setSaving(true);
    try {
      if (editingPartner) {
        await api.put(`/partners/${editingPartner.id}`, partnerForm);
        toast.success("Partner updated");
      } else {
        const created = await api.post<Partner>("/partners", partnerForm);
        toast.success("Partner created");
        if (created?.id) setSelectedId(created.id);
      }
      setPartnerDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save partner");
    } finally {
      setSaving(false);
    }
  };

  const deletePartner = async (p: Partner) => {
    if (!window.confirm(`Remove partner "${p.name}"? Historical project data is preserved.`)) return;
    try {
      await api.del(`/partners/${p.id}`);
      toast.success("Partner removed");
      if (selectedId === p.id) setSelectedId(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove partner");
    }
  };

  const openCreateMember = () => {
    setEditingMember(null);
    setMemberForm(emptyMemberForm);
    setMemberDialogOpen(true);
  };

  const openEditMember = (member: PartnerMember) => {
    setEditingMember(member);
    setMemberForm({ name: member.name, email: member.email || "", phone: member.phone || "", role: member.role || "" });
    setMemberDialogOpen(true);
  };

  const saveMember = async () => {
    if (!selected) return;
    if (!memberForm.name.trim()) { toast.error("Member name is required"); return; }
    setSaving(true);
    try {
      if (editingMember) {
        await api.put(`/partners/${selected.id}/members/${editingMember.id}`, memberForm);
        toast.success("Member updated");
      } else {
        await api.post(`/partners/${selected.id}/members`, memberForm);
        toast.success("Member added");
      }
      setMemberDialogOpen(false);
      setEditingMember(null);
      setMemberForm(emptyMemberForm);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: PartnerMember) => {
    if (!selected) return;
    if (!window.confirm(`Remove ${member.name} from ${selected.name}? Historical task assignments are preserved.`)) return;
    try {
      await api.del(`/partners/${selected.id}/members/${member.id}`);
      toast.success("Member removed");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove member");
    }
  };

  const openCreateTeam = () => {
    setEditingTeam(null);
    setTeamForm(emptyTeamForm);
    setTeamDialogOpen(true);
  };

  const openEditTeam = (team: PartnerTeam) => {
    setEditingTeam(team);
    setTeamForm({ name: team.name, description: team.description || "", member_ids: [...team.member_ids] });
    setTeamDialogOpen(true);
  };

  const saveTeam = async () => {
    if (!selected || !teamForm.name.trim()) { toast.error("Team name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...teamForm, name: teamForm.name.trim() };
      if (editingTeam) await api.put(`/partners/${selected.id}/teams/${editingTeam.id}`, payload);
      else await api.post(`/partners/${selected.id}/teams`, payload);
      toast.success(editingTeam ? "Partner team updated" : "Partner team created");
      setTeamDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save partner team");
    } finally {
      setSaving(false);
    }
  };

  const removeTeam = async (team: PartnerTeam) => {
    if (!selected || !window.confirm(`Remove partner team "${team.name}"? Historical task assignments are preserved.`)) return;
    try {
      await api.del(`/partners/${selected.id}/teams/${team.id}`);
      toast.success("Partner team removed");
      await load();
    } catch (e: any) { toast.error(e?.message || "Failed to remove partner team"); }
  };

  const removeTeamMember = async (team: PartnerTeam, member: PartnerMember) => {
    if (!selected) return;
    if (!window.confirm(`Remove ${member.name} from ${team.name}? They remain a partner member.`)) return;
    try {
      await api.del(`/partners/${selected.id}/teams/${team.id}/members/${member.id}`);
      toast.success(`${member.name} removed from ${team.name}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove team member");
    }
  };

  const toggleTeamExpanded = (teamId: number) => {
    setExpandedTeamIds((previous) =>
      previous.includes(teamId) ? previous.filter((id) => id !== teamId) : [...previous, teamId]
    );
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <PageHeader
        icon={<Handshake className="h-5 w-5" />}
        title={t("partners.title", { defaultValue: "External Partners" })}
        subtitle={t("partners.subtitle", { defaultValue: "External delivery organizations with teams and members" })}
        actions={canManage ? (
          <Button onClick={openCreatePartner} className="gap-1.5">
            <Plus className="h-4 w-4" /> {t("partners.add", { defaultValue: "Add Partner" })}
          </Button>
        ) : undefined}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="ps-8" placeholder={t("partners.search", { defaultValue: "Search partners..." })} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("partners.empty", { defaultValue: "No external partners yet." })}
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start transition-colors ${selected?.id === p.id ? "bg-accent" : "hover:bg-muted/60"}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: `${p.color}22`, color: p.color }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.specialty || p.company || "—", `${p.teams_count ?? 0} teams`, memberCountLabel(p.members_count ?? 0)].join(" · ")}
                    </span>
                  </span>
                  <Badge variant={p.status === "active" ? "secondary" : "outline"}>{p.members_count}</Badge>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {!selected ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("partners.selectPrompt", { defaultValue: "Select a partner to view teams and members." })}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold" style={{ backgroundColor: `${selected.color}22`, color: selected.color }}>
                    {selected.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                      <WorkforceBadge type="external" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[selected.specialty, selected.company].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditPartner(selected)}>
                      <Pencil className="h-3.5 w-3.5" /> {t("app.edit", { defaultValue: "Edit" })}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => deletePartner(selected)}>
                      <Trash2 className="h-3.5 w-3.5" /> {t("app.delete", { defaultValue: "Delete" })}
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Email: </span>{selected.email || "—"}</div>
                <div><span className="text-muted-foreground">Phone: </span>{selected.phone || "—"}</div>
                <div><span className="text-muted-foreground">Website: </span>{selected.website || "—"}</div>
                <div><span className="text-muted-foreground">Status: </span><Badge variant={selected.status === "active" ? "secondary" : "outline"}>{selected.status}</Badge></div>
              </div>
              {selected.notes && <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{selected.notes}</p>}

              <div className="mt-6 rounded-xl border border-border/80 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Layers className="h-4 w-4" /> Organization hierarchy
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Partner → Teams → Members. Team membership is explicit; members not linked to a team appear under Direct Members.
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={openCreateTeam}>
                        <Plus className="h-3.5 w-3.5" /> Add Team
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={openCreateMember}>
                        <UserPlus className="h-3.5 w-3.5" /> Add Member
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="font-mono text-muted-foreground/70">├──</span>
                    Partner Teams
                    <Badge variant="secondary">{selected.teams?.length ?? 0}</Badge>
                  </div>

                  {(selected.teams ?? []).length === 0 ? (
                    <p className="ms-6 rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
                      No partner teams yet. Create a team, then assign members explicitly.
                    </p>
                  ) : (
                    <div className="ms-2 space-y-2 border-s border-border/70 ps-4">
                      {(selected.teams ?? []).map((team) => {
                        const count = team.members_count ?? team.members?.length ?? 0;
                        const expanded = expandedTeamIds.includes(team.id);
                        return (
                          <div key={team.id} className="rounded-lg border border-border bg-card">
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => toggleTeamExpanded(team.id)}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                                aria-expanded={expanded}
                                aria-label={`${expanded ? "Collapse" : "Expand"} ${team.name}`}
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-medium text-foreground">{team.name}</span>
                                  <Badge variant={count === 0 ? "outline" : "secondary"}>{memberCountLabel(count)}</Badge>
                                </div>
                                {team.description ? (
                                  <p className="truncate text-xs text-muted-foreground">{team.description}</p>
                                ) : null}
                              </div>
                              {canManage && (
                                <div className="flex shrink-0">
                                  <Button variant="ghost" size="sm" onClick={() => openEditTeam(team)} aria-label={`Edit ${team.name}`}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeTeam(team)} aria-label={`Remove ${team.name}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {expanded && (
                              <div className="border-t border-border px-3 py-2">
                                {count === 0 ? (
                                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-3">
                                    <p className="text-sm text-muted-foreground">0 members — assign people to this team.</p>
                                    {canManage && (
                                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEditTeam(team)}>
                                        <Users className="h-3.5 w-3.5" /> Assign members
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {team.members.map((member) => (
                                      <div key={member.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-[10px] text-muted-foreground/70">└──</span>
                                            <span className="truncate text-sm text-foreground">{member.name}</span>
                                            <WorkforceBadge type="external" />
                                          </div>
                                          <p className="ms-7 truncate text-xs text-muted-foreground">
                                            {[member.role, member.email].filter(Boolean).join(" · ") || "Team member"}
                                          </p>
                                        </div>
                                        {canManage && (
                                          <div className="flex shrink-0">
                                            <Button variant="ghost" size="sm" onClick={() => openEditMember(member)} aria-label={`Edit ${member.name}`}>
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeTeamMember(team, member)} aria-label={`Remove ${member.name} from team`}>
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="font-mono text-muted-foreground/70">└──</span>
                    Direct Members
                    <Badge variant="secondary">{directMembers.length}</Badge>
                  </div>
                  <p className="ms-6 text-xs text-muted-foreground">
                    Partner members who are not assigned to any partner team.
                  </p>

                  <div className="ms-2 space-y-2 border-s border-border/70 ps-4">
                    {directMembers.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
                        No direct members. Add a member without assigning them to a team, or remove someone from all teams.
                      </p>
                    ) : (
                      directMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">{member.name}</span>
                              <WorkforceBadge type="external" />
                              <Badge variant="outline">Direct member</Badge>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {[member.role, member.email].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => openEditMember(member)} aria-label={`Edit ${member.name}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeMember(member)} aria-label={`Remove ${member.name}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    All partner members ({selected.members.length})
                  </h3>
                  {canManage && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={openCreateMember}>
                      <UserPlus className="h-3.5 w-3.5" /> Add Member
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Full roster for this partner. Team membership is managed above and is never inferred from partner membership alone.
                </p>
                <div className="mt-3 space-y-2">
                  {selected.members.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                      {t("partners.noMembers", { defaultValue: "No members yet. Add the people who will work on projects." })}
                    </p>
                  ) : (
                    selected.members.map((member) => {
                      const memberTeams = (selected.teams ?? []).filter((team) =>
                        (team.member_ids ?? []).includes(member.id) || (team.members ?? []).some((item) => item.id === member.id)
                      );
                      return (
                        <div key={member.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">{member.name}</span>
                              <WorkforceBadge type="external" />
                              {memberTeams.length === 0 ? (
                                <Badge variant="outline">Direct member</Badge>
                              ) : (
                                memberTeams.map((team) => (
                                  <Badge key={team.id} variant="secondary">{team.name}</Badge>
                                ))
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {[member.role, member.email].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => openEditMember(member)} aria-label={`Edit ${member.name}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeMember(member)} aria-label={`Remove ${member.name}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPartner ? "Edit Partner" : "Add External Partner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={partnerForm.name} onChange={(e) => setPartnerForm((f) => ({ ...f, name: e.target.value }))} placeholder="ABC Technology" autoFocus />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input value={partnerForm.company} onChange={(e) => setPartnerForm((f) => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Specialty</Label>
                <Input value={partnerForm.specialty} onChange={(e) => setPartnerForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="Cloud Consulting" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={partnerForm.email} onChange={(e) => setPartnerForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={partnerForm.phone} onChange={(e) => setPartnerForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={partnerForm.website} onChange={(e) => setPartnerForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={partnerForm.notes} onChange={(e) => setPartnerForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartnerDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={savePartner} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingPartner ? "Save Changes" : "Create Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingTeam ? "Edit Partner Team" : "Add Partner Team"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5"><Label>Team name *</Label><Input value={teamForm.name} onChange={(e) => setTeamForm((form) => ({ ...form, name: e.target.value }))} placeholder="Development Team" autoFocus /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={teamForm.description} onChange={(e) => setTeamForm((form) => ({ ...form, description: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Team members ({teamForm.member_ids.length})</Label>
              <p className="text-xs text-muted-foreground">Explicit links only — selecting a partner member here assigns them to this team.</p>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {(selected?.members ?? []).filter((member) => member.is_active).length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Add active partner members before composing a team.</p>
                ) : (selected?.members ?? []).filter((member) => member.is_active).map((member) => {
                  const active = teamForm.member_ids.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTeamForm((form) => ({
                        ...form,
                        member_ids: active ? form.member_ids.filter((id) => id !== member.id) : [...form.member_ids, member.id],
                      }))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        active
                          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-border text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
              {teamForm.member_ids.length === 0 && (
                <p className="text-xs text-muted-foreground">This team currently has 0 members.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveTeam} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTeam ? "Save Changes" : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Partner Member" : "Add Partner Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ahmed" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input value={memberForm.role} onChange={(e) => setMemberForm((f) => ({ ...f, role: e.target.value }))} placeholder="Cloud Architect" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={memberForm.phone} onChange={(e) => setMemberForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            {!editingMember && (
              <p className="text-xs text-muted-foreground">
                New members start as direct partner members. Assign them to a team explicitly afterward if needed.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveMember} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingMember ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PartnersPage;
