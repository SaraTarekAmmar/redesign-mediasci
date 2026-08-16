import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search, Plus, Pencil, Trash2, X, Loader2, UserMinus, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { UserAvatar } from "../components/common/UserAvatar";
import { Badge } from "../components/ui/Badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Resource {
  id: number;
  user_id: number;
  name: string;
  email: string;
  employee_number: string;
  avatar_url?: string;
  phone?: string;
  position: string;
  seniority: string;
  weekly_capacity: number;
  availability_status: string;
  utilization_percentage: number;
  salary: number;
  currency: string;
  cost_per_hour: number;
  department_id?: number;
  department?: { id: number; name: string };
  teams: { id: number; name: string; color?: string }[];
  skills: { id: number; name: string; category?: string; proficiency: string; years_of_experience: number }[];
  certifications: { id: number; name: string; provider?: string }[];
  assigned_projects: { id: number; name: string; key?: string; status: string; progress: number }[];
  is_active: boolean;
}

interface DraftSkill {
  id: number | string;
  name: string;
  category?: string | null;
  proficiency: string;
  years_of_experience: number;
}

const PROFICIENCY_OPTIONS = ["beginner", "intermediate", "advanced", "expert"];

const defaultDraft = () => ({
  id: 0,
  name: "",
  email: "",
  employee_number: "",
  phone: "",
  position: "Team Member",
  seniority: "Mid",
  department_id: undefined as number | undefined,
  weekly_capacity: 40,
  cost_per_hour: 0,
  salary: 0,
  currency: "USD",
  availability_status: "available",
  contract_type: "full_time",
  is_active: true,
  skills: [] as DraftSkill[],
});

const CUSTOM_POSITION_VALUE = "__custom__";
const DEFAULT_POSITIONS = [
  "Team Member",
  "Backend Developer",
  "Frontend Developer",
  "QA Engineer",
  "Designer",
  "Project Manager",
  "Backend Lead",
  "Frontend Lead",
  "Admin",
];

export default function ResourcesPage() {
  const { i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isRTL = i18n.dir() === "rtl";
  const teamIdParam = new URLSearchParams(location.search).get("team_id");
  const isTeamScoped = Boolean(teamIdParam);

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState(() => teamIdParam || "ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [skillOptions, setSkillOptions] = useState<{ id: number; name: string; category?: string | null }[]>([]);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(defaultDraft());
  const [positionChoice, setPositionChoice] = useState<string>(defaultDraft().position);
  const [customPosition, setCustomPosition] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Resource | null>(null);
  const [confirmRemoveFromTeam, setConfirmRemoveFromTeam] = useState<Resource | null>(null);

  const scopedTeam = useMemo(
    () => (teamIdParam ? teams.find((team) => String(team.id) === String(teamIdParam)) : undefined),
    [teams, teamIdParam],
  );
  const scopedTeamName = scopedTeam?.name
    || (isTeamScoped ? (isRTL ? "الفريق المحدد" : "Selected Team") : "");

  const positionOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_POSITIONS, ...resources.map((resource) => resource.position).filter(Boolean)])).sort((left, right) => left.localeCompare(right)),
    [resources],
  );

  const applyTeamFilter = (value: string) => {
    setTeamFilter(value);
    if (value === "ALL") {
      navigate("/resources");
    } else {
      navigate(`/resources?team_id=${value}`);
    }
  };

  const clearTeamContext = () => applyTeamFilter("ALL");

  const fetchResources = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const activeTeamId = teamIdParam || (teamFilter !== "ALL" ? teamFilter : null);
      let url = "/resources?";
      if (search) url += `q=${encodeURIComponent(search)}&`;
      if (deptFilter !== "ALL") url += `department_id=${deptFilter}&`;
      if (activeTeamId) url += `team_id=${activeTeamId}&`;
      if (projectFilter !== "ALL") url += `project_id=${projectFilter}&`;
      if (availabilityFilter !== "ALL") url += `availability_status=${availabilityFilter}&`;

      const [resData, resDepts, resTeams, resProjects, resSkills] = await Promise.all([
        api.get<Resource[]>(url),
        departments.length ? Promise.resolve(departments) : api.get<{ id: number; name: string }[]>("/departments"),
        teams.length ? Promise.resolve(teams) : api.get<{ id: number; name: string }[]>("/teams"),
        projects.length ? Promise.resolve(projects) : api.get<{ id: number; name: string }[]>("/projects"),
        api.get<{ id: number; name: string; category?: string | null }[]>("/skills"),
      ]);

      setResources(Array.isArray(resData) ? resData : []);
      if (!departments.length) setDepartments(Array.isArray(resDepts) ? resDepts : []);
      if (!teams.length) setTeams(Array.isArray(resTeams) ? resTeams : []);
      if (!projects.length) setProjects(Array.isArray(resProjects) ? resProjects : []);
      setSkillOptions(Array.isArray(resSkills) ? resSkills : []);
    } catch {
      const message = isRTL ? "فشل تحميل الموارد" : "Failed to load company workforce resources.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTeamFilter(teamIdParam || "ALL");
  }, [teamIdParam]);

  useEffect(() => {
    fetchResources();
  }, [search, deptFilter, teamFilter, projectFilter, availabilityFilter, teamIdParam]);

  const selectedSkillIds = useMemo(() => new Set(draft.skills.map((s) => String(s.id))), [draft.skills]);
  const availableSkillOptions = useMemo(
    () => skillOptions.filter((s) => !selectedSkillIds.has(String(s.id))),
    [skillOptions, selectedSkillIds]
  );

  const addSkill = (skillId: string) => {
    const skill = skillOptions.find((s) => String(s.id) === skillId);
    if (!skill) return;
    setDraft((prev) => ({
      ...prev,
      skills: [
        ...prev.skills,
        { id: skill.id, name: skill.name, category: skill.category, proficiency: "intermediate", years_of_experience: 1 },
      ],
    }));
  };

  const removeSkill = (index: number) => {
    setDraft((prev) => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  const updateSkill = (index: number, patch: Partial<DraftSkill>) => {
    setDraft((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const saveResource = async () => {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.error(isRTL ? "الاسم والبريد الإلكتروني مطلوبان" : "Name and email are required.");
      return;
    }
    const nextPosition = positionChoice === CUSTOM_POSITION_VALUE ? customPosition.trim() : positionChoice.trim();
    if (!nextPosition) {
      toast.error(isRTL ? "المنصب مطلوب" : "Position is required.");
      return;
    }
    setSaving(true);
    try {
      const skillsPayload = draft.skills.map((s) => ({
        skill_id: typeof s.id === "number" ? s.id : Number(s.id),
        name: s.name,
        proficiency: s.proficiency,
        years_of_experience: Number(s.years_of_experience) || 0,
      }));

      const basePayload: Record<string, unknown> = {
        name: draft.name.trim(),
        email: draft.email.trim(),
        employee_number: draft.employee_number || null,
        phone: draft.phone || null,
        position: nextPosition,
        seniority: draft.seniority,
        department_id: draft.department_id ? Number(draft.department_id) : null,
        weekly_capacity: Number(draft.weekly_capacity) || 40,
        cost_per_hour: Number(draft.cost_per_hour) || 0,
        salary: Number(draft.salary) || 0,
        currency: draft.currency,
        availability_status: draft.availability_status,
        contract_type: draft.contract_type,
        is_active: draft.is_active,
        skills: skillsPayload,
      };

      if (draft.id) {
        await api.put(`/resources/${draft.id}`, basePayload);
        toast.success(isRTL ? "تم تحديث المورد بنجاح" : "Resource updated successfully.");
      } else {
        if (isTeamScoped && teamIdParam) {
          basePayload.team_ids = [Number(teamIdParam)];
        }
        await api.post("/resources", basePayload);
        toast.success(
          isTeamScoped
            ? (isRTL ? "تم إنشاء المورد وإضافته إلى الفريق" : "Resource created and assigned to this team.")
            : (isRTL ? "تم إنشاء المورد بنجاح" : "Resource created successfully."),
        );
      }
      setFormOpen(false);
      setPositionChoice(CUSTOM_POSITION_VALUE);
      setCustomPosition("");
      setDraft(defaultDraft());
      fetchResources();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل حفظ المورد" : "Failed to save resource."));
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async () => {
    if (!confirmDelete) return;
    try {
      await api.del(`/resources/${confirmDelete.id}`);
      toast.success(isRTL ? "تم حذف المورد بنجاح" : "Resource deleted successfully.");
      setConfirmDelete(null);
      setSelectedResource(null);
      fetchResources();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل حذف المورد" : "Failed to delete resource."));
    }
  };

  const removeFromTeam = async () => {
    if (!confirmRemoveFromTeam || !teamIdParam) return;
    try {
      await api.del(`/teams/${teamIdParam}/resources/${confirmRemoveFromTeam.id}`);
      toast.success(
        isRTL
          ? "تمت إزالة المورد من الفريق دون حذف سجل الموارد"
          : "Resource removed from this team. The global resource record was kept.",
      );
      setConfirmRemoveFromTeam(null);
      setSelectedResource(null);
      fetchResources();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل إزالة المورد من الفريق" : "Failed to remove resource from team."));
    }
  };

  const canManage = hasPermission("manage-teams");
  const memberCountLabel = isRTL
    ? `${resources.length} أعضاء`
    : `${resources.length} ${resources.length === 1 ? "Member" : "Members"}`;

  const openCreateForm = () => {
    const nextDraft = defaultDraft();
    setDraft(nextDraft);
    setPositionChoice(nextDraft.position);
    setCustomPosition("");
    setSelectedResource(null);
    setFormOpen(true);
  };

  const openEditForm = (r: Resource) => {
    setDraft({
      id: r.id,
      name: r.name,
      email: r.email,
      employee_number: r.employee_number || "",
      phone: r.phone || "",
      position: r.position,
      seniority: r.seniority,
      department_id: r.department_id,
      weekly_capacity: r.weekly_capacity,
      cost_per_hour: r.cost_per_hour,
      salary: r.salary,
      currency: r.currency,
      availability_status: r.availability_status,
      contract_type: "full_time",
      is_active: r.is_active,
      skills: (r.skills || []).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        proficiency: s.proficiency || "intermediate",
        years_of_experience: s.years_of_experience ?? 1,
      })),
    });
    setPositionChoice(positionOptions.includes(r.position) ? r.position : CUSTOM_POSITION_VALUE);
    setCustomPosition(positionOptions.includes(r.position) ? "" : r.position);
    setFormOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto p-5" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-screen-2xl space-y-5">
        {isTeamScoped && (
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <button type="button" className="hover:text-foreground transition-colors" onClick={() => navigate("/teams")}>
              {isRTL ? "الفرق" : "Teams"}
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="text-foreground font-medium">{scopedTeamName}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span>{isRTL ? "الأعضاء" : "Members"}</span>
          </nav>
        )}

        <PageHeader
          title={
            isTeamScoped
              ? (isRTL ? `${scopedTeamName} — الأعضاء` : `${scopedTeamName} — Members`)
              : (isRTL ? "دليل الموارد البشرية والعمالة" : "Workforce Directory")
          }
          subtitle={
            isTeamScoped
              ? (isRTL
                ? `عرض أعضاء هذا الفريق فقط ضمن دليل الموارد. ${memberCountLabel}.`
                : `Viewing members of this team through the shared Resources directory. ${memberCountLabel}.`)
              : (isRTL
                ? "إدارة شاملة لجميع الكوادر، المهارات، والقدرات التشغيلية للمؤسسة"
                : "Single source of truth for organization members, skills, availability, and capacity.")
          }
          actions={
            canManage && (
              <Button size="sm" className="gap-1.5" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                {isTeamScoped
                  ? (isRTL ? "إضافة عضو للفريق" : "Add Team Member")
                  : (isRTL ? "إضافة مورد" : "Add Resource")}
              </Button>
            )
          }
        />

        {isTeamScoped && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold text-foreground">{scopedTeamName}</span>
            <span className="text-sm text-muted-foreground">{memberCountLabel}</span>
            <button
              type="button"
              onClick={clearTeamContext}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              title={isRTL ? "إزالة فلتر الفريق والعودة لكل الموارد" : "Clear team filter and return to all resources"}
            >
              {isRTL ? `الفريق: ${scopedTeamName}` : `Team: ${scopedTeamName}`}
              <X className="h-3.5 w-3.5" />
            </button>
            <Button size="xs" variant="ghost" onClick={() => navigate("/teams")}>
              {isRTL ? "العودة للفرق" : "Back to Teams"}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5 bg-card p-4 rounded-xl border border-border">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث بالاسم أو البريد..." : "Search name, email, role..."}
              className="ps-9 h-9"
            />
          </div>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={isRTL ? "القسم" : "Department"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{isRTL ? "جميع الأقسام" : "All Departments"}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isTeamScoped ? (
            <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground">
              <span className="truncate">{isRTL ? `الفريق: ${scopedTeamName}` : `Team: ${scopedTeamName}`}</span>
            </div>
          ) : (
            <Select value={teamFilter} onValueChange={applyTeamFilter}>
              <SelectTrigger size="sm">
                <SelectValue placeholder={isRTL ? "الفريق" : "Team"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{isRTL ? "جميع الفرق" : "All Teams"}</SelectItem>
                {teams.map((teamOption) => (
                  <SelectItem key={teamOption.id} value={String(teamOption.id)}>{teamOption.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={isRTL ? "المشروع" : "Project"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{isRTL ? "جميع المشاريع" : "All Projects"}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={isRTL ? "الحالة" : "Availability"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{isRTL ? "جميع الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="available">{isRTL ? "متاح" : "Available"}</SelectItem>
              <SelectItem value="partially allocated">{isRTL ? "مشغول جزئياً" : "Partially Allocated"}</SelectItem>
              <SelectItem value="fully allocated">{isRTL ? "مشغول بالكامل" : "Fully Allocated"}</SelectItem>
              <SelectItem value="on leave">{isRTL ? "في إجازة" : "On Leave"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resources List */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {isRTL ? "جاري التحميل..." : "Loading resources..."}
            </div>
          ) : loadError ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button size="sm" variant="outline" onClick={fetchResources}>
                {isRTL ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          ) : resources.length === 0 ? (
            <div className="py-12 text-center space-y-3 px-4">
              <p className="text-sm font-medium text-foreground">
                {isTeamScoped
                  ? (isRTL ? `${scopedTeamName}` : scopedTeamName)
                  : (isRTL ? "لا توجد نتائج" : "No resources found")}
              </p>
              <p className="text-sm text-muted-foreground">
                {isTeamScoped
                  ? (isRTL
                    ? "لا توجد موارد معيّنة لهذا الفريق حالياً."
                    : "No resources are currently assigned to this team.")
                  : (isRTL ? "جرّب تعديل معايير البحث أو التصفية." : "Try adjusting search or filter criteria.")}
              </p>
              {isTeamScoped && canManage && (
                <Button size="sm" className="gap-1.5" onClick={openCreateForm}>
                  <Plus className="h-4 w-4" />
                  {isRTL ? "إضافة عضو للفريق" : "Add Team Member"}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{isRTL ? "المورد" : "Resource"}</th>
                    <th className="px-3 py-2.5 font-medium">{isRTL ? "المنصب والقسم" : "Position & Dept"}</th>
                    <th className="px-3 py-2.5 font-medium">{isRTL ? "الفرق" : "Teams"}</th>
                    <th className="px-3 py-2.5 font-medium">{isRTL ? "الاستغلال" : "Utilization"}</th>
                    <th className="px-3 py-2.5 font-medium">{isRTL ? "الحالة" : "Availability"}</th>
                    {canManage && <th className="px-4 py-2.5 text-right font-medium">{isRTL ? "العمليات" : "Actions"}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resources.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedResource(r)}
                      className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={r.name} avatarUrl={r.avatar_url} size="sm" />
                          <div>
                            <div className="font-semibold text-foreground">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{r.position}</div>
                        <div className="text-xs text-muted-foreground">{r.department?.name || "-"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.teams.map((tm) => (
                            <Badge key={tm.id} variant="secondary">
                              {tm.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                r.utilization_percentage > 90 ? "bg-destructive" : r.utilization_percentage > 60 ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(r.utilization_percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {r.utilization_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={r.availability_status === "available" ? "default" : r.availability_status === "on leave" ? "secondary" : "outline"}>
                          {r.availability_status}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button size="xs" variant="outline" onClick={() => openEditForm(r)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {isTeamScoped ? (
                              <Button
                                size="xs"
                                variant="outline"
                                className="text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                                title={isRTL ? "إزالة من الفريق" : "Remove from team"}
                                onClick={() => setConfirmRemoveFromTeam(r)}
                              >
                                <UserMinus className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10"
                                title={isRTL ? "حذف المورد" : "Delete resource"}
                                onClick={() => setConfirmDelete(r)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Profile Drawer */}
        {selectedResource && (
          <Dialog open={Boolean(selectedResource)} onOpenChange={() => setSelectedResource(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <UserAvatar name={selectedResource.name} avatarUrl={selectedResource.avatar_url} size="lg" />
                  <div>
                    <div className="text-xl font-bold text-foreground">{selectedResource.name}</div>
                    <div className="text-sm text-muted-foreground font-normal">{selectedResource.position} • {selectedResource.seniority}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4 border-t border-b border-border text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground block text-xs">{isRTL ? "البريد الإلكتروني" : "Email"}</span>
                    <span className="font-medium text-foreground">{selectedResource.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{isRTL ? "القسم" : "Department"}</span>
                    <span className="font-medium text-foreground">{selectedResource.department?.name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{isRTL ? "السعة الأسبوعية" : "Weekly Capacity"}</span>
                    <span className="font-medium text-foreground">{selectedResource.weekly_capacity} hrs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{isRTL ? "نسبة الاستغلال الحالية" : "Current Utilization"}</span>
                    <span className="font-semibold text-primary">{selectedResource.utilization_percentage}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{isRTL ? "الحالة" : "Availability"}</span>
                    <span className="font-medium text-foreground">{selectedResource.availability_status}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{isRTL ? "الرقم الوظيفي" : "Employee Number"}</span>
                    <span className="font-medium text-foreground">{selectedResource.employee_number || "-"}</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">{isRTL ? "الفرق" : "Teams"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedResource.teams || []).map((tm) => (
                      <Badge key={tm.id} variant="secondary">{tm.name}</Badge>
                    ))}
                    {(selectedResource.teams || []).length === 0 && (
                      <span className="text-muted-foreground text-xs italic">-</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">{isRTL ? "المشاريع الحالية" : "Current Projects"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedResource.assigned_projects || []).map((project) => (
                      <Badge key={project.id} variant="outline">
                        {project.name}
                        {project.status ? ` · ${project.status}` : ""}
                      </Badge>
                    ))}
                    {(selectedResource.assigned_projects || []).length === 0 && (
                      <span className="text-muted-foreground text-xs italic">-</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">{isRTL ? "المهارات" : "Skills"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedResource.skills.map((s) => (
                      <Badge key={s.id} variant="secondary">
                        {s.name} ({s.proficiency})
                      </Badge>
                    ))}
                    {selectedResource.skills.length === 0 && <span className="text-muted-foreground text-xs italic">-</span>}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                {canManage && (
                  <>
                    {isTeamScoped ? (
                      <Button
                        variant="outline"
                        className="text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 mr-auto"
                        onClick={() => setConfirmRemoveFromTeam(selectedResource)}
                      >
                        {isRTL ? "إزالة من الفريق" : "Remove from Team"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 mr-auto"
                        onClick={() => setConfirmDelete(selectedResource)}
                      >
                        {isRTL ? "حذف" : "Delete"}
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => openEditForm(selectedResource)}>
                      {isRTL ? "تعديل" : "Edit"}
                    </Button>
                  </>
                )}
                <Button variant="default" onClick={() => setSelectedResource(null)}>{isRTL ? "إغلاق" : "Close"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Create/Edit Form Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {draft.id
                  ? (isRTL ? "تعديل بيانات المورد" : "Edit Resource Profile")
                  : isTeamScoped
                    ? (isRTL ? "إضافة عضو جديد للفريق" : "Add New Team Member")
                    : (isRTL ? "إضافة مورد جديد" : "Add New Resource")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isRTL ? "الاسم الكامل" : "Full Name"}</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "البريد الإلكتروني" : "Email Address"}</Label>
                  <Input value={draft.email} type="email" onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="john@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isRTL ? "الرقم الوظيفي" : "Employee Number"}</Label>
                  <Input value={draft.employee_number} onChange={(e) => setDraft({ ...draft, employee_number: e.target.value })} placeholder="EMP-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "رقم الهاتف" : "Phone"}</Label>
                  <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+12345678" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isRTL ? "المنصب" : "Position"}</Label>
                  <select
                    value={positionChoice}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPositionChoice(value);
                      if (value !== CUSTOM_POSITION_VALUE) {
                        setDraft({ ...draft, position: value });
                        setCustomPosition("");
                      } else if (!customPosition) {
                        setCustomPosition(draft.position && !positionOptions.includes(draft.position) ? draft.position : "");
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    {positionOptions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                    <option value={CUSTOM_POSITION_VALUE}>{isRTL ? "إضافة منصب آخر..." : "Add another position..."}</option>
                  </select>
                  {positionChoice === CUSTOM_POSITION_VALUE && (
                    <Input
                      value={customPosition}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomPosition(value);
                        setDraft({ ...draft, position: value });
                      }}
                      placeholder={isRTL ? "اكتب المنصب الجديد" : "Type a new position"}
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "المستوى الوظيفي" : "Seniority"}</Label>
                  <select
                    value={draft.seniority}
                    onChange={(e) => setDraft({ ...draft, seniority: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                    <option value="Principal">Principal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 flex flex-col justify-end">
                  <Label className="mb-1.5">{isRTL ? "القسم" : "Department"}</Label>
                  <select
                    value={draft.department_id || ""}
                    onChange={(e) => setDraft({ ...draft, department_id: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    <option value="">{isRTL ? "بلا قسم" : "None"}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "السعة الأسبوعية" : "Weekly Capacity (hrs)"}</Label>
                  <Input type="number" value={draft.weekly_capacity} onChange={(e) => setDraft({ ...draft, weekly_capacity: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{isRTL ? "التكلفة بالساعة" : "Hourly Cost"}</Label>
                  <Input type="number" value={draft.cost_per_hour} onChange={(e) => setDraft({ ...draft, cost_per_hour: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "الراتب" : "Salary"}</Label>
                  <Input type="number" value={draft.salary} onChange={(e) => setDraft({ ...draft, salary: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "العملة" : "Currency"}</Label>
                  <select
                    value={draft.currency}
                    onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="EGP">EGP</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isRTL ? "حالة الإتاحة" : "Availability Status"}</Label>
                  <select
                    value={draft.availability_status}
                    onChange={(e) => setDraft({ ...draft, availability_status: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    <option value="available">Available</option>
                    <option value="partially allocated">Partially Allocated</option>
                    <option value="fully allocated">Fully Allocated</option>
                    <option value="on leave">On Leave</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "نوع العقد" : "Contract Type"}</Label>
                  <select
                    value={draft.contract_type}
                    onChange={(e) => setDraft({ ...draft, contract_type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contractor</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
              </div>

              {/* Skills multi-select */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {isRTL ? "المهارات" : "Skills"}
                  </Label>
                  <span className="text-xs text-muted-foreground">{draft.skills.length}</span>
                </div>

                {availableSkillOptions.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addSkill(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none dark:bg-card"
                    >
                    <option value="">{isRTL ? "إضافة مهارة..." : "Add a skill..."}</option>
                    {availableSkillOptions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} {s.category ? `(${s.category})` : ""}
                      </option>
                    ))}
                  </select>
                )}

                {availableSkillOptions.length === 0 && draft.skills.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    {isRTL ? "لا توجد مهارات متاحة. أنشئ مهارات من صفحة المهارات أولاً." : "No skills available. Create skills from the Skills page first."}
                  </p>
                )}

                <div className="space-y-2">
                  {draft.skills.map((s, idx) => (
                    <div key={`${s.id}-${idx}`} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{s.name}</div>
                        {s.category ? <div className="text-[10px] text-muted-foreground">{s.category}</div> : null}
                      </div>
                  <select
                    value={s.proficiency}
                    onChange={(e) => updateSkill(idx, { proficiency: e.target.value })}
                    className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none"
                  >
                        {PROFICIENCY_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={s.years_of_experience}
                        onChange={(e) => updateSkill(idx, { years_of_experience: Number(e.target.value) })}
                        className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none"
                        title={isRTL ? "سنوات الخبرة" : "Years of experience"}
                      />
                      <button
                        type="button"
                        onClick={() => removeSkill(idx)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={isRTL ? "إزالة المهارة" : "Remove skill"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
                  <Button variant="outline" onClick={() => { setFormOpen(false); setDraft(defaultDraft()); }}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={saveResource} disabled={saving}>
                {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ" : "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(open) => !open && setConfirmDelete(null)}
          title={isRTL ? "حذف المورد" : "Delete Resource"}
          description={
            isRTL
              ? `هل أنت متأكد من رغبتك في حذف المورد "${confirmDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء وسيتم التحقق من عدم وجود مهام نشطة.`
              : `Are you sure you want to delete the resource "${confirmDelete?.name}"? This will fail if the resource has active allocations.`
          }
          onConfirm={deleteResource}
        />

        <ConfirmDialog
          open={!!confirmRemoveFromTeam}
          onOpenChange={(open) => !open && setConfirmRemoveFromTeam(null)}
          title={isRTL ? "إزالة من الفريق" : "Remove from Team"}
          description={
            isRTL
              ? `إزالة "${confirmRemoveFromTeam?.name}" من ${scopedTeamName} فقط؟ سيبقى سجل المورد في الدليل العام.`
              : `Remove "${confirmRemoveFromTeam?.name}" from ${scopedTeamName} only? The global resource record will remain in the directory.`
          }
          onConfirm={removeFromTeam}
          confirmLabel={isRTL ? "إزالة من الفريق" : "Remove from Team"}
        />
      </div>
    </div>
  );
}
