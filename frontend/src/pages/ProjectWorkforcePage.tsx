import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Handshake, Layers, Loader2, Plus, UserRound, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/Dialog";
import { WorkforceBadge } from "../components/common/WorkforceBadge";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

interface TeamRef { id: number; name: string; color?: string; members_count?: number }
interface ResourceRef { id: number; user_id?: number; name: string; position?: string; is_active?: boolean }
interface ResourceAssignment extends ResourceRef { resource_id: number; allocation_pct: number }
interface PartnerMemberRef { id: number; partner_id: number; name: string; email?: string; role?: string; is_active?: boolean }
interface PartnerTeamRef { id: number; partner_id: number; name: string; description?: string; members_count?: number; partner?: { id: number; name: string; color?: string } }
interface PartnerRef {
  id: number;
  name: string;
  specialty?: string;
  color?: string;
  members_count?: number;
  members?: PartnerMemberRef[];
  teams?: PartnerTeamRef[];
}
interface PartnerMemberAssignment extends PartnerMemberRef { partner: { id: number; name: string; color?: string } }

interface WorkforceSource {
  type: string;
  id: number;
  name: string;
}

interface InternalEntry {
  user_id: number;
  resource_id?: number;
  name: string;
  email?: string;
  avatar?: string;
  title?: string;
  teams: { id: number; name: string; color?: string }[];
  is_direct_member: boolean;
  is_direct_resource: boolean;
  sources?: WorkforceSource[];
}

interface ExternalEntry {
  member_id: number;
  name: string;
  email?: string;
  title?: string;
  partner: { id: number; name: string; color?: string };
  teams: { id: number; name: string }[];
  is_direct_member: boolean;
  is_org_direct_member?: boolean;
  sources?: WorkforceSource[];
}

type PickerKind = "team" | "resource" | "partner" | "partner-team" | "partner-member";

function sourceLabels(entry: ExternalEntry) {
  const labels: string[] = [];
  for (const source of entry.sources ?? []) {
    if (source.type === "partner") labels.push("Entire partner");
    if (source.type === "partner_team") labels.push(source.name);
    if (source.type === "direct_partner_member") labels.push("Directly selected");
  }
  if (!labels.length) {
    if (entry.is_direct_member) labels.push("Directly selected");
    if (entry.teams.length) labels.push(...entry.teams.map((team) => team.name));
    else if (entry.is_org_direct_member) labels.push("Direct member");
  }
  return Array.from(new Set(labels));
}

function ProjectWorkforcePage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const canEdit = hasRole("super-admin", "admin");
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const activeProjectId = useProjectCatalogStore((s) => s.activeProjectId);
  const projectId = activeProjectId || (activeProject ? String(activeProject.id) : "");

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [resources, setResources] = useState<ResourceAssignment[]>([]);
  const [partners, setPartners] = useState<PartnerRef[]>([]);
  const [partnerTeams, setPartnerTeams] = useState<PartnerTeamRef[]>([]);
  const [partnerMembers, setPartnerMembers] = useState<PartnerMemberAssignment[]>([]);
  const [internal, setInternal] = useState<InternalEntry[]>([]);
  const [external, setExternal] = useState<ExternalEntry[]>([]);
  const [allTeams, setAllTeams] = useState<TeamRef[]>([]);
  const [allResources, setAllResources] = useState<ResourceRef[]>([]);
  const [allPartners, setAllPartners] = useState<PartnerRef[]>([]);
  const [pickerOpen, setPickerOpen] = useState<PickerKind | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [teamsRes, resourcesRes, partnersRes, partnerTeamsRes, partnerMembersRes, workforceRes] = await Promise.all([
        api.get<TeamRef[]>(`/projects/${projectId}/teams`),
        api.get<ResourceAssignment[]>(`/projects/${projectId}/resources`),
        api.get<PartnerRef[]>(`/projects/${projectId}/partners`),
        api.get<PartnerTeamRef[]>(`/projects/${projectId}/partner-teams`),
        api.get<PartnerMemberAssignment[]>(`/projects/${projectId}/partner-members`),
        api.get<{ internal: InternalEntry[]; external: ExternalEntry[] }>(`/projects/${projectId}/workforce`),
      ]);
      setTeams(Array.isArray(teamsRes) ? teamsRes : []);
      setResources(Array.isArray(resourcesRes) ? resourcesRes : []);
      setPartners(Array.isArray(partnersRes) ? partnersRes : []);
      setPartnerTeams(Array.isArray(partnerTeamsRes) ? partnerTeamsRes : []);
      setPartnerMembers(Array.isArray(partnerMembersRes) ? partnerMembersRes : []);
      setInternal(Array.isArray(workforceRes?.internal) ? workforceRes.internal : []);
      setExternal(Array.isArray(workforceRes?.external) ? workforceRes.external : []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load project workforce");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadCatalogs = useCallback(async () => {
    if (!canEdit) return;
    try {
      const [teamRes, partnerRes, resourceRes] = await Promise.all([
        api.get<TeamRef[]>("/teams"),
        api.get<PartnerRef[]>("/partners"),
        api.get<ResourceRef[]>("/resources?is_active=true"),
      ]);
      setAllTeams(Array.isArray(teamRes) ? teamRes : []);
      setAllPartners(Array.isArray(partnerRes) ? partnerRes : []);
      setAllResources(Array.isArray(resourceRes) ? resourceRes.filter((r) => r.user_id) : []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load workforce catalogs");
    }
  }, [canEdit]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadCatalogs(); }, [loadCatalogs]);

  const candidates = useMemo(() => {
    const assignedTeamIds = new Set(teams.map((item) => Number(item.id)));
    const assignedResourceIds = new Set(resources.map((item) => Number(item.resource_id)));
    const assignedPartnerIds = new Set(partners.map((item) => Number(item.id)));
    const assignedPartnerTeamIds = new Set(partnerTeams.map((item) => Number(item.id)));
    const assignedPartnerMemberIds = new Set(partnerMembers.map((item) => Number(item.id)));
    return {
      team: allTeams.filter((item) => !assignedTeamIds.has(Number(item.id))),
      resource: allResources.filter((item) => !assignedResourceIds.has(Number(item.id))),
      partner: allPartners.filter((item) => !assignedPartnerIds.has(Number(item.id))),
      "partner-team": allPartners.flatMap((partner) => (partner.teams ?? []).map((team) => ({ ...team, partner: { id: partner.id, name: partner.name, color: partner.color } }))).filter((item) => !assignedPartnerTeamIds.has(Number(item.id))),
      "partner-member": allPartners.flatMap((partner) => (partner.members ?? []).filter((member) => member.is_active !== false).map((member) => ({ ...member, partner: { id: partner.id, name: partner.name, color: partner.color } }))).filter((item) => !assignedPartnerMemberIds.has(Number(item.id))),
    };
  }, [allPartners, allResources, allTeams, partnerMembers, partnerTeams, partners, resources, teams]);

  const externalByPartner = useMemo(() => {
    const groups = new Map<number, {
      partner: { id: number; name: string; color?: string };
      teams: Map<number, { id: number; name: string; members: ExternalEntry[] }>;
      direct: ExternalEntry[];
    }>();

    for (const entry of external) {
      const partnerId = entry.partner.id;
      if (!groups.has(partnerId)) {
        groups.set(partnerId, {
          partner: entry.partner,
          teams: new Map(),
          direct: [],
        });
      }
      const group = groups.get(partnerId)!;
      if (entry.teams.length === 0 || entry.is_org_direct_member) {
        group.direct.push(entry);
        continue;
      }
      // Place under each org team for visibility; still one person overall in resolved list.
      for (const team of entry.teams) {
        if (!group.teams.has(team.id)) {
          group.teams.set(team.id, { id: team.id, name: team.name, members: [] });
        }
        group.teams.get(team.id)!.members.push(entry);
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.partner.name.localeCompare(b.partner.name));
  }, [external]);

  const add = async (kind: PickerKind, id: number) => {
    const config = {
      team: [`/projects/${projectId}/teams`, { team_id: id }, "Team"],
      resource: [`/projects/${projectId}/resources`, { resource_id: id, allocation_pct: 100 }, "Resource"],
      partner: [`/projects/${projectId}/partners`, { partner_id: id }, "Partner"],
      "partner-team": [`/projects/${projectId}/partner-teams`, { partner_team_id: id }, "Partner team"],
      "partner-member": [`/projects/${projectId}/partner-members`, { partner_member_id: id }, "Partner member"],
    }[kind] as [string, Record<string, number>, string];
    try {
      await api.post(config[0], config[1]);
      toast.success(`${config[2]} assigned to project`);
      setPickerOpen(null);
      await load();
    } catch (e: any) { toast.error(e?.message || `Failed to assign ${config[2].toLowerCase()}`); }
  };

  const remove = async (kind: PickerKind, id: number, name: string) => {
    if (!window.confirm(`Remove "${name}" from this project? Historical task records are preserved.`)) return;
    const path = {
      team: `/projects/${projectId}/teams/${id}`,
      resource: `/projects/${projectId}/resources/${id}`,
      partner: `/projects/${projectId}/partners/${id}`,
      "partner-team": `/projects/${projectId}/partner-teams/${id}`,
      "partner-member": `/projects/${projectId}/partner-members/${id}`,
    }[kind];
    try {
      await api.del(path);
      toast.success(`${name} removed from project`);
      await load();
    } catch (e: any) { toast.error(e?.message || `Failed to remove ${name}`); }
  };

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("workforce.noProject", { defaultValue: "Select a project to view its workforce." })}</div>;
  }

  const pickerLabels: Record<PickerKind, string> = {
    team: "Add internal team", resource: "Add direct resource", partner: "Add whole partner",
    "partner-team": "Add partner team", "partner-member": "Add partner member",
  };
  const selectedCandidates = pickerOpen ? candidates[pickerOpen] : [];

  return (
    <div className="h-full overflow-y-auto p-5">
      <PageHeader icon={<UsersRound className="h-5 w-5" />} title={t("workforce.title", { defaultValue: "Project Workforce" })}
        subtitle={activeProject?.name ? `Internal and external assignment paths for ${activeProject.name}` : "Internal and external assignment paths for this project"} />

      {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <AssignmentSection title="Internal assignments" icon={<Layers className="h-4 w-4 text-primary" />} actions={canEdit ? <>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen("team")}><Plus className="me-1 h-3.5 w-3.5" />Team</Button>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen("resource")}><Plus className="me-1 h-3.5 w-3.5" />Resource</Button>
            </> : null}>
              {teams.map((team) => <AssignmentRow key={`team-${team.id}`} name={team.name} detail={`${team.members_count ?? 0} members · internal team`} canEdit={canEdit} onRemove={() => remove("team", team.id, team.name)} />)}
              {resources.map((resource) => <AssignmentRow key={`resource-${resource.id}`} name={resource.name} detail={`${resource.position || "Resource"} · ${resource.allocation_pct}% direct allocation`} canEdit={canEdit} onRemove={() => remove("resource", resource.id, resource.name)} />)}
              {teams.length + resources.length === 0 && <Empty text="No internal teams or direct resources assigned." />}
            </AssignmentSection>

            <AssignmentSection title="External assignments" icon={<Handshake className="h-4 w-4 text-amber-500" />} actions={canEdit ? <>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen("partner")}><Plus className="me-1 h-3.5 w-3.5" />Partner</Button>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen("partner-team")}><Plus className="me-1 h-3.5 w-3.5" />Team</Button>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen("partner-member")}><Plus className="me-1 h-3.5 w-3.5" />Person</Button>
            </> : null}>
              {partners.map((partner) => <AssignmentRow key={`partner-${partner.id}`} name={partner.name} detail={`${partner.members_count ?? 0} members · whole partner`} external canEdit={canEdit} onRemove={() => remove("partner", partner.id, partner.name)} />)}
              {partnerTeams.map((team) => <AssignmentRow key={`partner-team-${team.id}`} name={team.name} detail={`${team.partner?.name || "Partner"} · ${team.members_count ?? 0} members`} external canEdit={canEdit} onRemove={() => remove("partner-team", team.id, team.name)} />)}
              {partnerMembers.map((member) => <AssignmentRow key={`partner-member-${member.id}`} name={member.name} detail={`${member.partner.name} · direct partner member`} external canEdit={canEdit} onRemove={() => remove("partner-member", member.id, member.name)} />)}
              {partners.length + partnerTeams.length + partnerMembers.length === 0 && <Empty text="No external organizations, teams, or people assigned." />}
            </AssignmentSection>
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Resolved, task-eligible workforce ({internal.length + external.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Deduplicated across every active assignment path. Removing an assignment changes future eligibility without deleting historical task records.</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Internal Workforce ({internal.length})
                </h3>
                <div className="space-y-2">
                  {internal.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No eligible internal resources.</p>
                  ) : internal.map((entry) => (
                    <div key={`internal-${entry.user_id}`} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{entry.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
                          <WorkforceBadge type="internal" />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            entry.title,
                            entry.teams.map((team) => team.name).join(", "),
                            entry.is_direct_resource ? "Direct allocation" : "",
                            entry.is_direct_member ? "Direct member" : "",
                          ].filter(Boolean).join(" · ") || "Internal workforce"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  External Workforce ({external.length})
                </h3>
                {externalByPartner.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No eligible external resources.</p>
                ) : (
                  <div className="space-y-3">
                    {externalByPartner.map((group) => (
                      <div key={group.partner.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{group.partner.name}</span>
                          <WorkforceBadge type="external" />
                        </div>

                        <div className="mt-3 space-y-3">
                          {Array.from(group.teams.values()).map((team) => (
                            <div key={team.id}>
                              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span className="font-mono text-muted-foreground/70">├──</span>
                                {team.name}
                              </div>
                              <div className="ms-3 space-y-1.5 border-s border-border/70 ps-3">
                                {team.members.map((entry) => (
                                  <ExternalMemberRow key={`${team.id}-${entry.member_id}`} entry={entry} />
                                ))}
                              </div>
                            </div>
                          ))}

                          {group.direct.length > 0 && (
                            <div>
                              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span className="font-mono text-muted-foreground/70">└──</span>
                                Direct Member
                              </div>
                              <div className="ms-3 space-y-1.5 border-s border-border/70 ps-3">
                                {group.direct.map((entry) => (
                                  <ExternalMemberRow key={`direct-${entry.member_id}`} entry={entry} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <Dialog open={pickerOpen !== null} onOpenChange={(open) => !open && setPickerOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{pickerOpen ? pickerLabels[pickerOpen] : "Add assignment"}</DialogTitle></DialogHeader>
          <div className="max-h-[52vh] space-y-1.5 overflow-y-auto py-1">
            {selectedCandidates.length === 0 ? <Empty text="Every eligible option is already directly assigned." /> : selectedCandidates.map((candidate: any) => (
              <button key={candidate.id} type="button" onClick={() => pickerOpen && add(pickerOpen, Number(candidate.id))}
                className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-start text-sm hover:bg-accent/50">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{candidate.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{candidate.partner?.name || candidate.position || candidate.specialty || "Eligible workforce assignment"}</span></span>
                <WorkforceBadge type={pickerOpen?.startsWith("partner") ? "external" : "internal"} />
              </button>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPickerOpen(null)}>{t("app.cancel")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExternalMemberRow({ entry }: { entry: ExternalEntry }) {
  const labels = sourceLabels(entry);
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
        {entry.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
          <WorkforceBadge type="external" />
          {labels.map((label) => (
            <Badge key={label} variant="outline">{label}</Badge>
          ))}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[entry.title, entry.partner.name, entry.teams.map((team) => team.name).join(", ") || (entry.is_org_direct_member ? "Direct member" : "")].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function AssignmentSection({ title, icon, actions, children }: { title: string; icon: React.ReactNode; actions: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</h2><div className="flex flex-wrap gap-1.5">{actions}</div></div><div className="mt-3 space-y-2">{children}</div></section>;
}

function AssignmentRow({ name, detail, external = false, canEdit, onRemove }: { name: string; detail: string; external?: boolean; canEdit: boolean; onRemove: () => void }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-foreground">{name}</span><WorkforceBadge type={external ? "external" : "internal"} /></div><p className="truncate text-xs text-muted-foreground">{detail}</p></div>{canEdit && <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Remove ${name}`}><X className="h-3.5 w-3.5" /></Button>}</div>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground">{text}</p>; }

export default ProjectWorkforcePage;
