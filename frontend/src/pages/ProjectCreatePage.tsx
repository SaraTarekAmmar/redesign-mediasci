import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronRight, FolderPlus, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Label } from "../components/ui/Label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";
import { api, setActiveProject } from "../lib/api";
import { cn } from "../lib/utils";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import type { Client } from "../data/types";

interface TeamOption {
  id: string | number;
  name: string;
}

interface PartnerMemberOption {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
}

interface PartnerTeamOption {
  id: string | number;
  partner_id?: string | number;
  name: string;
  description?: string;
  members?: PartnerMemberOption[];
  members_count?: number;
}

interface PartnerOption {
  id: string | number;
  name: string;
  company?: string;
  specialty?: string;
  teams?: PartnerTeamOption[];
  members?: PartnerMemberOption[];
}

interface ResourceOption {
  id: string | number;
  name: string;
  position?: string;
  user_id?: string | number;
}

const CATEGORIES = ["software", "system", "cloud", "agency", "azure"] as const;
const PRESALE_TYPES = ["poc", "demo", "rfp", "rfq", "rop"] as const;

function normalizeText(value: string | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function includesQuery(values: Array<string | undefined>, query: string) {
  const needle = normalizeText(query);
  if (!needle) return true;
  return values.some((value) => normalizeText(value).includes(needle));
}

function sortSelectedFirst<T extends { id: string | number; name: string }>(items: T[], selectedIds: string[]) {
  return [...items].sort((a, b) => {
    const aSelected = selectedIds.includes(String(a.id));
    const bSelected = selectedIds.includes(String(b.id));
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

function SelectedChip({
  label,
  onRemove,
  tone = "primary",
}: {
  label: React.ReactNode;
  onRemove: () => void;
  tone?: "primary" | "amber";
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90",
        tone === "amber"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-primary/30 bg-primary/10 text-primary"
      )}
    >
      <span className="max-w-[12rem] truncate">{label}</span>
      <X className="h-3 w-3 shrink-0" />
    </button>
  );
}

function SelectionButton({
  active,
  title,
  subtitle,
  onClick,
  tone = "primary",
  rightLabel,
  className,
}: {
  active: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "amber";
  rightLabel?: React.ReactNode;
  className?: string;
}) {
  const activeClasses =
    tone === "amber"
      ? "border-amber-500/60 bg-amber-500/10 text-foreground dark:bg-amber-500/15"
      : "border-primary/50 bg-primary/10 text-foreground";

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        active ? activeClasses : "border-border bg-background hover:bg-muted/60",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rightLabel}
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            active
              ? tone === "amber"
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function ProjectCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [partnerTeamIds, setPartnerTeamIds] = useState<string[]>([]);
  const [partnerMemberIds, setPartnerMemberIds] = useState<string[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [teamPanelOpen, setTeamPanelOpen] = useState(true);
  const [resourcePanelOpen, setResourcePanelOpen] = useState(true);
  const [teamSearch, setTeamSearch] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [expandedPartnerIds, setExpandedPartnerIds] = useState<string[]>([]);
  const refreshProjects = useProjectCatalogStore((s) => s.refreshProjects);
  const setActiveProjectId = useProjectCatalogStore((s) => s.setActiveProjectId);

  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
    type: "scrum",
    classification: "postsale" as "postsale" | "presale" | "rnd",
    presale_type: "",
    category: "",
    client_id: "",
  });

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [teamRes, partnerRes, resourceRes, clientRes] = await Promise.all([
          api.get<TeamOption[]>("/teams"),
          api.get<PartnerOption[]>("/partners"),
          api.get<ResourceOption[]>("/resources?is_active=true"),
          api.get<Client[]>("/clients"),
        ]);
        setTeams(Array.isArray(teamRes) ? teamRes : []);
        setPartners(Array.isArray(partnerRes) ? partnerRes : []);
        setResources(Array.isArray(resourceRes) ? resourceRes.filter((resource) => resource.user_id) : []);
        const list = Array.isArray(clientRes) ? clientRes : [];
        setClients(list);
        if (list.length > 0) {
          setForm((current) => (current.client_id ? current : { ...current, client_id: String(list[0].id) }));
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to load project administration catalogs");
      }
    };
    void loadCatalogs();
  }, []);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleStringSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((previous) => (previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]));
  };

  const removeStringSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((previous) => previous.filter((item) => item !== value));
  };

  const ensurePartnerExpanded = (partnerId: string) => {
    setExpandedPartnerIds((previous) => (previous.includes(partnerId) ? previous : [...previous, partnerId]));
  };

  const selectedTeamOptions = useMemo(
    () => sortSelectedFirst(teams.filter((team) => teamIds.includes(String(team.id))), teamIds),
    [teams, teamIds]
  );
  const selectedResourceOptions = useMemo(
    () => sortSelectedFirst(resources.filter((resource) => resourceIds.includes(String(resource.id))), resourceIds),
    [resources, resourceIds]
  );

  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim();
    const matches = teams.filter((team) => includesQuery([team.name], query));
    return sortSelectedFirst(matches, teamIds);
  }, [teams, teamIds, teamSearch]);

  const filteredResources = useMemo(() => {
    const query = resourceSearch.trim();
    const matches = resources.filter((resource) => includesQuery([resource.name, resource.position], query));
    return sortSelectedFirst(matches, resourceIds);
  }, [resources, resourceIds, resourceSearch]);

  const filteredPartners = useMemo(() => {
    const query = partnerSearch.trim();
    const matches = partners.filter((partner) =>
      includesQuery(
        [
          partner.name,
          partner.company,
          partner.specialty,
          ...(partner.teams ?? []).flatMap((team) => [team.name, team.description]),
          ...(partner.members ?? []).flatMap((member) => [member.name, member.role, member.email, member.phone]),
        ],
        query
      )
    );
    return sortSelectedFirst(matches, partnerIds);
  }, [partnerIds, partners, partnerSearch]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error(t("projectCreate.nameRequired"));
      return;
    }
    if (!form.client_id) {
      toast.error(t("projectCreate.clientRequired"));
      return;
    }
    if (form.classification === "presale" && !form.presale_type) {
      toast.error(t("projectCreate.presaleTypeRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        type: form.type,
        classification: form.classification,
        presale_type: form.classification === "presale" ? form.presale_type : null,
        client_id: Number(form.client_id),
        description: form.description || null,
        category: form.category || null,
        team_ids: teamIds.map(Number),
        resource_ids: resourceIds.map(Number),
        partner_ids: partnerIds.map(Number),
        partner_team_ids: partnerTeamIds.map(Number),
        partner_member_ids: partnerMemberIds.map(Number),
      };
      if (form.key.trim()) payload.key = form.key.trim().toUpperCase();

      const created = await api.post<{ id: string | number }>("/projects", payload);
      toast.success(t("projectCreate.created"));
      if (created?.id) {
        setActiveProjectId(String(created.id), false);
        setActiveProject(String(created.id), false);
      }
      await refreshProjects();
      navigate("/projects");
    } catch (error: any) {
      toast.error(error?.message || t("projectCreate.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-3xl">
        <PageHeader icon={<FolderPlus className="h-5 w-5" />} title={t("projectCreate.title")} subtitle={t("projectCreate.subtitle")} />

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="pc-name">{t("projectCreate.name")} *</Label>
            <Input
              id="pc-name"
              autoFocus
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder={t("projectCreate.namePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("projectCreate.client")} *</Label>
            <Select value={form.client_id || "__none"} onValueChange={(value) => setField("client_id", value === "__none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder={t("projectCreate.selectClient")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("projectCreate.selectClient")}</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.company || client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("projectCreate.classification")} *</Label>
              <Select value={form.classification} onValueChange={(value) => setField("classification", value as "postsale" | "presale" | "rnd")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presale">{t("projects.presale")}</SelectItem>
                  <SelectItem value="postsale">{t("settings.flowPostsale")}</SelectItem>
                  <SelectItem value="rnd">{t("projects.rnd", { defaultValue: "R&D" })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.classification === "presale" && (
              <div className="space-y-1.5">
                <Label>{t("projectCreate.presaleType")} *</Label>
                <Select value={form.presale_type} onValueChange={(value) => setField("presale_type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("projectCreate.presaleTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESALE_TYPES.map((presaleType) => (
                      <SelectItem key={presaleType} value={presaleType}>
                        {t(`projectCreate.presale.${presaleType}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pc-key">{t("projectCreate.key")}</Label>
              <Input
                id="pc-key"
                value={form.key}
                onChange={(e) => setField("key", e.target.value.toUpperCase())}
                placeholder={t("projectCreate.keyPlaceholder")}
                maxLength={10}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">{t("projectCreate.keyHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("projectCreate.boardType")} *</Label>
              <Select value={form.type} onValueChange={(value) => setField("type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrum">{t("app.projectType.scrum")}</SelectItem>
                  <SelectItem value="kanban">{t("app.projectType.kanban")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-desc">{t("projectCreate.description")}</Label>
            <Textarea
              id="pc-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder={t("projectCreate.descriptionPlaceholder")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("projectCreate.category")}</Label>
              <Select value={form.category || "__none"} onValueChange={(value) => setField("category", value === "__none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("projectCreate.categoryNone")}</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`projectCreate.categoryOptions.${category}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Workforce</h3>
                <p className="text-xs text-muted-foreground">
                  Pick internal teams/resources and external partners through bounded, searchable selectors so nothing spills out of the form.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="secondary">Teams: {teamIds.length}</Badge>
                <Badge variant="secondary">Resources: {resourceIds.length}</Badge>
                <Badge variant="secondary">Partners: {partnerIds.length}</Badge>
              </div>
            </div>

            {teams.length > 0 && (
              <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{t("projectCreate.teams", { defaultValue: "Internal Teams" })}</h4>
                      <Badge variant="secondary">{teamIds.length} selected</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Search and select one or more internal teams. The selected teams become the project&apos;s internal workforce.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {teamIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTeamIds([])}
                        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Clear all
                      </button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setTeamPanelOpen((open) => !open)} className="shrink-0 gap-1.5">
                      {teamPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {teamPanelOpen ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>

                {selectedTeamOptions.length > 0 && (
                  <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
                    {selectedTeamOptions.map((team) => (
                      <SelectedChip
                        key={String(team.id)}
                        label={team.name}
                        onRemove={() => removeStringSelection(setTeamIds, String(team.id))}
                        tone="primary"
                      />
                    ))}
                  </div>
                )}

                {teamPanelOpen && (
                  <div className="space-y-3">
                    <SearchField value={teamSearch} onChange={setTeamSearch} placeholder="Search internal teams" />
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-background p-2">
                      {filteredTeams.length > 0 ? (
                        filteredTeams.map((team) => {
                          const id = String(team.id);
                          const active = teamIds.includes(id);
                          return (
                            <SelectionButton
                              key={id}
                              active={active}
                              title={team.name}
                              subtitle="Internal team"
                              tone="primary"
                              onClick={() => toggleStringSelection(setTeamIds, id)}
                            />
                          );
                        })
                      ) : (
                        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                          {teamSearch.trim() ? "No matching teams found." : "No teams are available."}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {resources.length > 0 && (
              <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">Direct Internal Resources</h4>
                      <Badge variant="secondary">{resourceIds.length} selected</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assign individuals independently of team membership, without turning the page into a chip wall.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {resourceIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setResourceIds([])}
                        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Clear all
                      </button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setResourcePanelOpen((open) => !open)} className="shrink-0 gap-1.5">
                      {resourcePanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {resourcePanelOpen ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>

                {selectedResourceOptions.length > 0 && (
                  <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
                    {selectedResourceOptions.map((resource) => (
                      <SelectedChip
                        key={String(resource.id)}
                        label={
                          <span>
                            {resource.name}
                            {resource.position ? ` - ${resource.position}` : ""}
                          </span>
                        }
                        onRemove={() => removeStringSelection(setResourceIds, String(resource.id))}
                        tone="primary"
                      />
                    ))}
                  </div>
                )}

                {resourcePanelOpen && (
                  <div className="space-y-3">
                    <SearchField value={resourceSearch} onChange={setResourceSearch} placeholder="Search internal resources" />
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-background p-2">
                      {filteredResources.length > 0 ? (
                        filteredResources.map((resource) => {
                          const id = String(resource.id);
                          const active = resourceIds.includes(id);
                          return (
                            <SelectionButton
                              key={id}
                              active={active}
                              title={resource.name}
                              subtitle={resource.position || "Internal resource"}
                              tone="primary"
                              onClick={() => toggleStringSelection(setResourceIds, id)}
                            />
                          );
                        })
                      ) : (
                        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                          {resourceSearch.trim() ? "No matching resources found." : "No internal resources are available."}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {partners.length > 0 && (
              <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{t("projectCreate.partners", { defaultValue: "External Partners" })}</h4>
                    <Badge variant="secondary">{partnerIds.length} whole partners</Badge>
                    <Badge variant="outline">{partnerTeamIds.length} teams</Badge>
                    <Badge variant="outline">{partnerMemberIds.length} members</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expand each partner to assign the entire organization, specific partner teams, and/or individual members (including people who already belong to a team).
                  </p>
                </div>

                <SearchField value={partnerSearch} onChange={setPartnerSearch} placeholder="Search partners, teams, or members" />

                <div className="space-y-3">
                  {filteredPartners.length > 0 ? (
                    filteredPartners.map((partner) => {
                      const partnerId = String(partner.id);
                      const partnerTeams = partner.teams ?? [];
                      const partnerMembers = (partner.members ?? []).filter((member) => member.is_active !== false);
                      const wholePartnerSelected = partnerIds.includes(partnerId);
                      const selectedPartnerTeams = partnerTeams.filter((team) => partnerTeamIds.includes(String(team.id)));
                      const selectedPartnerMembers = partnerMembers.filter((member) => partnerMemberIds.includes(String(member.id)));
                      const isExpanded =
                        expandedPartnerIds.includes(partnerId) ||
                        wholePartnerSelected ||
                        selectedPartnerTeams.length > 0 ||
                        selectedPartnerMembers.length > 0 ||
                        partnerSearch.trim().length > 0;
                      const selectionSummary = [
                        wholePartnerSelected ? "entire partner" : null,
                        selectedPartnerTeams.length ? `${selectedPartnerTeams.length} team${selectedPartnerTeams.length === 1 ? "" : "s"}` : null,
                        selectedPartnerMembers.length ? `${selectedPartnerMembers.length} member${selectedPartnerMembers.length === 1 ? "" : "s"}` : null,
                      ].filter(Boolean);

                      return (
                        <div
                          key={partnerId}
                          className={cn(
                            "rounded-xl border p-4 transition-colors",
                            wholePartnerSelected || selectedPartnerTeams.length > 0 || selectedPartnerMembers.length > 0
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-border/70 bg-background"
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPartnerIds((previous) =>
                                  previous.includes(partnerId)
                                    ? previous.filter((value) => value !== partnerId)
                                    : [...previous, partnerId]
                                )
                              }
                              className="flex min-w-0 flex-1 items-start gap-3 text-left"
                            >
                              <span
                                className={cn(
                                  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                  isExpanded ? "border-amber-500/70 bg-amber-500/10 text-amber-600" : "border-border text-muted-foreground"
                                )}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{partner.name}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {partner.specialty || partner.company || "External partner"}
                                  {" · "}
                                  {partnerTeams.length} teams · {partnerMembers.length} members
                                </span>
                              </span>
                            </button>

                            <label
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                wholePartnerSelected
                                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "border-border text-muted-foreground hover:bg-muted/60"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-amber-600"
                                checked={wholePartnerSelected}
                                onChange={() => {
                                  toggleStringSelection(setPartnerIds, partnerId);
                                  ensurePartnerExpanded(partnerId);
                                }}
                              />
                              Assign entire partner
                            </label>
                          </div>

                          {selectionSummary.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectionSummary.map((item) => (
                                <Badge
                                  key={String(item)}
                                  variant="outline"
                                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                >
                                  Selected: {item}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {isExpanded && (
                            <div className="mt-4 space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teams</span>
                                  <Badge variant="secondary">{partnerTeams.length}</Badge>
                                </div>
                                <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background p-2">
                                  {partnerTeams.length > 0 ? (
                                    partnerTeams.map((team) => {
                                      const teamId = String(team.id);
                                      const active = partnerTeamIds.includes(teamId);
                                      const membersCount = team.members_count ?? team.members?.length ?? 0;
                                      return (
                                        <SelectionButton
                                          key={teamId}
                                          active={active}
                                          title={`${team.name} (${membersCount} member${membersCount === 1 ? "" : "s"})`}
                                          subtitle={team.description || "Partner team"}
                                          tone="amber"
                                          onClick={() => {
                                            toggleStringSelection(setPartnerTeamIds, teamId);
                                            ensurePartnerExpanded(partnerId);
                                          }}
                                        />
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">No partner teams are available.</div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Direct / Individual Members
                                  </span>
                                  <Badge variant="secondary">{partnerMembers.length}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Individuals can be selected even if they already belong to a partner team.
                                </p>
                                <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background p-2">
                                  {partnerMembers.length > 0 ? (
                                    partnerMembers.map((member) => {
                                      const memberId = String(member.id);
                                      const active = partnerMemberIds.includes(memberId);
                                      const memberTeams = partnerTeams
                                        .filter((team) => (team.members ?? []).some((item) => String(item.id) === memberId))
                                        .map((team) => team.name);
                                      return (
                                        <SelectionButton
                                          key={memberId}
                                          active={active}
                                          title={member.name}
                                          subtitle={
                                            memberTeams.length > 0
                                              ? `${member.role || "Partner member"} · ${memberTeams.join(", ")}`
                                              : member.role || member.email || "Direct partner member"
                                          }
                                          tone="amber"
                                          onClick={() => {
                                            toggleStringSelection(setPartnerMemberIds, memberId);
                                            ensurePartnerExpanded(partnerId);
                                          }}
                                        />
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">No partner members are available.</div>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground">
                                Combine entire partner, team, and individual selections. Duplicate people resolve once in the project workforce.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      {partnerSearch.trim() ? "No partners match the current search." : "No external partners are available."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate("/projects")}>
              {t("app.cancel")}
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("projectCreate.submit")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectCreatePage;
