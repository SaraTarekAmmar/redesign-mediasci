import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Building2,
  Users as UsersIcon,
  BookOpen,
  Briefcase,
  Clock,
  DollarSign,
  UserPlus,
  ArrowLeft,
  UserCheck,
  FolderKanban,
  CheckSquare2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { UserAvatar } from "../components/common/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/SelectEnhanced";
import { cn } from "../lib/utils";

interface DepartmentOption {
  id: string | number;
  name: string;
}

interface TeamOption {
  id: string | number;
  name: string;
  color?: string | null;
}

interface SkillOption {
  id: string | number;
  name: string;
  category?: string | null;
}

interface UserSkillAssignment {
  id: string | number;
  name: string;
  category?: string | null;
  proficiency_level: string;
  years_of_experience?: number;
}

interface WorkforceMemberProfile {
  id: string | number;
  name: string;
  email: string;
  avatar_url?: string | null;
  phone?: string | null;
  bio?: string | null;
  job_title?: string | null;
  position: string;
  seniority: string;
  capacity: number;
  availability: string;
  salary?: number | null;
  currency?: string | null;
  hourly_cost?: number | null;
  department_id?: number | null;
  department?: DepartmentOption | null;
  teams: TeamOption[];
  skills: UserSkillAssignment[];
  assigned_projects: {
    id: number | string;
    name: string;
    key?: string;
    status: string;
    progress: number;
  }[];
  assigned_issues: {
    id: number | string;
    key: string;
    title: string;
    status: string;
    priority: string;
    due_date?: string | null;
  }[];
}

const POSITIONS = [
  "Backend Developer",
  "Frontend Developer",
  "QA Engineer",
  "DevOps Engineer",
  "UI/UX Designer",
  "Project Manager",
  "Fullstack Developer",
];

const SENIORITIES = ["Intern", "Junior", "Mid", "Senior", "Lead"];

const AVAILABILITIES = [
  "Available",
  "Partially Allocated",
  "Fully Allocated",
  "On Leave",
  "Sick Leave",
  "Vacation",
  "Training",
  "Inactive",
];

const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP", "CAD", "QAR", "KWD"];

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert", "Master"];

// ponytail: distinct per-category colors are worth keeping for fast scanning, but the
// cool blue/indigo/purple/sky hues clashed with the warm cream+pink theme — swapped for
// warmer equivalents (teal stands in for the cool slot, primary ties one state to brand).
const seniorityBadgeColors: Record<string, string> = {
  intern: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  junior: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  mid: "bg-primary/10 text-primary border-primary/20",
  senior: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  lead: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const availabilityBadgeColors: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "partially allocated": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "fully allocated": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  "on leave": "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  "sick leave": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  vacation: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  training: "bg-primary/10 text-primary border-primary/20",
  inactive: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

const formatSalary = (amount?: number | null, curr?: string | null) => {
  if (amount === undefined || amount === null) return "-";
  const formatted = amount.toLocaleString("en-US");
  return `${formatted} ${curr || "USD"}`;
};

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage-teams") || hasPermission("allocate-resources") || hasPermission("manage-users");

  const [profile, setProfile] = useState<WorkforceMemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "workforce" | "skills" | "projects" | "issues">("general");

  const [allDepartments, setAllDepartments] = useState<DepartmentOption[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [allSkills, setAllSkills] = useState<SkillOption[]>([]);

  // Add as Resource Modal State (for non-resource users)
  const [addResourceModalOpen, setAddResourceModalOpen] = useState(false);
  const [addPosition, setAddPosition] = useState("Backend Developer");
  const [addSeniority, setAddSeniority] = useState("Mid");
  const [addCapacity, setAddCapacity] = useState(40);
  const [addAvailability, setAddAvailability] = useState("Available");
  const [addSalary, setAddSalary] = useState("");
  const [addCurrency, setAddCurrency] = useState("USD");
  const [addDeptId, setAddDeptId] = useState<string>("");
  const [addingResource, setAddingResource] = useState(false);

  const fetchProfile = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [resProfile, resDepts, resTeams, resSkills] = await Promise.all([
        api.get<WorkforceMemberProfile>(`/team-members/${id}`).catch(() => null),
        api.get<DepartmentOption[]>("/departments").catch(() => []),
        api.get<TeamOption[]>("/teams").catch(() => []),
        api.get<SkillOption[]>("/skills").catch(() => []),
      ]);

      if (resProfile) {
        setProfile(resProfile);
      } else {
        // Fallback: fetch raw user if team-members returned 404
        const rawUser = await api.get<any>(`/admin/users/${id}`).catch(() => null);
        if (rawUser) {
          setProfile({
            id: rawUser.id,
            name: rawUser.name,
            email: rawUser.email,
            phone: rawUser.phone,
            job_title: rawUser.job_title,
            position: rawUser.position || "Unassigned",
            seniority: rawUser.seniority || "Mid",
            capacity: rawUser.capacity || 40,
            availability: rawUser.availability || "Available",
            department: rawUser.department || null,
            department_id: rawUser.department_id || null,
            teams: rawUser.teams || [],
            skills: [],
            assigned_projects: [],
            assigned_issues: [],
          });
        } else {
          setProfile(null);
        }
      }

      setAllDepartments(resDepts);
      setAllTeams(resTeams);
      setAllSkills(resSkills);
      if (resDepts.length > 0) setAddDeptId(String(resDepts[0].id));
    } catch {
      toast.error(isRTL ? "فشل تحميل ملف المستخدم" : "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const isCompanyResource = useMemo(() => {
    if (!profile) return false;
    return Boolean(profile.department_id || profile.department || (profile.position && profile.position !== "Unassigned") || profile.salary);
  }, [profile]);

  const handleAddAsResource = async () => {
    if (!profile) return;
    if (!addDeptId) {
      toast.error(isRTL ? "القسم مطلوب" : "Department is required");
      return;
    }
    if (!addPosition) {
      toast.error(isRTL ? "المنصب الوظيفي مطلوب" : "Position is required");
      return;
    }
    if (!addSalary || isNaN(Number(addSalary)) || Number(addSalary) <= 0) {
      toast.error(isRTL ? "الراتب يجب أن يكون رقماً موجباً" : "Salary must be a positive number");
      return;
    }

    setAddingResource(true);
    try {
      const payload = {
        position: addPosition,
        seniority: addSeniority,
        capacity: Number(addCapacity),
        availability: addAvailability,
        salary: parseFloat(addSalary),
        currency: addCurrency,
        department_id: parseInt(addDeptId),
      };

      const updated = await api.put<WorkforceMemberProfile>(`/team-members/${profile.id}`, payload);
      toast.success(isRTL ? "تم إضافة المستخدم كعضو فريق بنجاح" : "User converted to company resource successfully");
      setProfile(updated);
      setAddResourceModalOpen(false);
    } catch {
      toast.error(isRTL ? "فشل تحويل المستخدم كعضو فريق" : "Failed to convert user to company resource");
    } finally {
      setAddingResource(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">{isRTL ? "المستخدم غير موجود" : "User Not Found"}</h2>
        <Button variant="outline" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isRTL ? "العودة إلى قائمة المستخدمين" : "Back to Users"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6" dir={i18n.dir()}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back Link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? "العودة" : "Back"}
        </button>

        {/* Profile Card Header */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-4">
              <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} className="h-16 w-16" />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{profile.name}</h1>
                  {isCompanyResource && (
                    <span className={cn("px-2.5 py-0.5 text-xs font-medium rounded-full border", availabilityBadgeColors[profile.availability.toLowerCase()] || "bg-muted")}>
                      {profile.availability}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                {isCompanyResource && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-primary">{profile.position}</span>
                    <span>•</span>
                    <span className="text-muted-foreground">{profile.seniority} Seniority</span>
                    <span>•</span>
                    <span className="text-muted-foreground">{profile.capacity} hrs/week</span>
                  </div>
                )}
              </div>
            </div>

            {!isCompanyResource && canManage && (
              <Button onClick={() => setAddResourceModalOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                {isRTL ? "إضافة كعضو فريق / مورد" : "Add as Resource"}
              </Button>
            )}
          </div>

          {/* Case 2: Lightweight Profile Info Banner for non-resource users */}
          {!isCompanyResource ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 space-y-3">
              <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400 font-semibold">
                <AlertCircle className="h-5 w-5" />
                <span>{isRTL ? "هذا المستخدم غير مضاف حالياً كعضو فريق بالمؤسسة." : "This user is not currently part of the company resources."}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "المستخدم يمتلك حساب نظام فقط. أضف هذا المستخدم إلى موارد الشركة لتخصيص الأقسام والمهارات والتوافر والرواتب."
                  : "This user has a system account. Add them to company resources to assign department, position, availability, skills, and compensation."}
              </p>
              {canManage && (
                <Button size="sm" onClick={() => setAddResourceModalOpen(true)} className="gap-2 mt-2">
                  <UserPlus className="h-4 w-4" />
                  {isRTL ? "إضافة كعضو فريق الآن" : "Add as Resource Now"}
                </Button>
              )}
            </div>
          ) : (
            /* Case 1: Full Workforce Profile Tabs */
            <div className="space-y-6">
              <div className="flex border-b border-border gap-3">
                <button
                  onClick={() => setActiveTab("general")}
                  className={cn(
                    "pb-2.5 text-sm font-medium border-b-2 transition-colors px-1",
                    activeTab === "general"
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isRTL ? "معلومات عامة" : "General Info"}
                </button>
                <button
                  onClick={() => setActiveTab("workforce")}
                  className={cn(
                    "pb-2.5 text-sm font-medium border-b-2 transition-colors px-1",
                    activeTab === "workforce"
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isRTL ? "ملف عضو الفريق" : "Team Member Profile"}
                </button>
                <button
                  onClick={() => setActiveTab("skills")}
                  className={cn(
                    "pb-2.5 text-sm font-medium border-b-2 transition-colors px-1",
                    activeTab === "skills"
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isRTL ? "المهارات والخبرة" : "Skills & Proficiency"} ({profile.skills.length})
                </button>
                <button
                  onClick={() => setActiveTab("projects")}
                  className={cn(
                    "pb-2.5 text-sm font-medium border-b-2 transition-colors px-1",
                    activeTab === "projects"
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isRTL ? "المشاريع المعينة" : "Assigned Projects"} ({profile.assigned_projects.length})
                </button>
                <button
                  onClick={() => setActiveTab("issues")}
                  className={cn(
                    "pb-2.5 text-sm font-medium border-b-2 transition-colors px-1",
                    activeTab === "issues"
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isRTL ? "المهام المعينة" : "Assigned Issues"} ({profile.assigned_issues.length})
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === "general" && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{isRTL ? "القسم" : "Department"}</p>
                      <p className="font-medium text-foreground">{profile.department?.name || "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{isRTL ? "الفرق" : "Teams"}</p>
                      <p className="font-medium text-foreground">
                        {profile.teams.map((t) => t.name).join(", ") || "No teams"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{isRTL ? "الهاتف" : "Phone"}</p>
                      <p className="font-medium text-foreground">{profile.phone || "-"}</p>
                    </div>
                  </div>
                  {profile.bio && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">{isRTL ? "نبذة" : "Bio"}</p>
                      <p className="p-3 rounded-lg bg-muted/40 text-foreground">{profile.bio}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "workforce" && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">{isRTL ? "المنصب الوظيفي" : "Position"}</p>
                    <p className="font-semibold text-foreground text-base mt-0.5">{profile.position}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">{isRTL ? "مستوى الأقدمية" : "Seniority Level"}</p>
                    <p className="font-semibold text-foreground text-base mt-0.5">{profile.seniority}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">{isRTL ? "السعة الأسبوعية" : "Weekly Capacity"}</p>
                    <p className="font-semibold text-foreground text-base mt-0.5">{profile.capacity} hrs/week</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">{isRTL ? "حالة التوافر" : "Availability Status"}</p>
                    <p className="font-semibold text-foreground text-base mt-0.5">{profile.availability}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card col-span-2">
                    <p className="text-xs text-muted-foreground">{isRTL ? "الراتب" : "Salary"}</p>
                    <p className="font-semibold text-foreground text-base mt-0.5">
                      {formatSalary(profile.salary ?? profile.hourly_cost, profile.currency)}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "skills" && (
                <div className="space-y-3">
                  {profile.skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{isRTL ? "لم يتم إسناد أي مهارات بعد." : "No skills assigned yet."}</p>
                  ) : (
                    profile.skills.map((skill) => (
                      <div key={skill.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{skill.name}</p>
                          <p className="text-xs text-muted-foreground">{skill.category}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary">
                            {skill.proficiency_level}
                          </span>
                          {skill.years_of_experience ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{skill.years_of_experience} yrs exp</p>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "projects" && (
                <div className="space-y-3">
                  {profile.assigned_projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{isRTL ? "لا يوجد مشاريع معينة." : "No projects assigned."}</p>
                  ) : (
                    profile.assigned_projects.map((proj) => (
                      <div key={proj.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{proj.name}</p>
                          <span className="text-xs text-muted-foreground">{proj.key || "PROJ"} • {proj.status}</span>
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-xs font-medium text-muted-foreground">{proj.progress}%</span>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
                            <div className="h-full bg-primary" style={{ width: `${proj.progress}%` }} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "issues" && (
                <div className="space-y-3">
                  {profile.assigned_issues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{isRTL ? "لا يوجد مهام معينة." : "No issues assigned."}</p>
                  ) : (
                    profile.assigned_issues.map((issue) => (
                      <div key={issue.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-primary font-bold">{issue.key}</span>
                          <p className="font-medium text-foreground text-sm">{issue.title}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-secondary text-secondary-foreground">
                            {issue.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add as Resource Dialog (pre-filled with name and email) */}
      <Dialog open={addResourceModalOpen} onOpenChange={setAddResourceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? "إضافة المستخدم كعضو فريق" : "Add User to Company Resources"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{isRTL ? "عضو الفريق" : "Team Member"}</Label>
              <p className="font-semibold text-foreground">{profile.name} ({profile.email})</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{isRTL ? "القسم *" : "Department *"}</Label>
              <Select value={addDeptId} onValueChange={setAddDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{isRTL ? "المنصب الوظيفي *" : "Position *"}</Label>
              <Select value={addPosition} onValueChange={setAddPosition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">{isRTL ? "السعة الأسبوعية *" : "Weekly Capacity (hrs/week) *"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={addCapacity}
                  onChange={(e) => setAddCapacity(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">{isRTL ? "حالة التوافر" : "Availability Status"}</Label>
                <Select value={addAvailability} onValueChange={setAddAvailability}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITIES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">{isRTL ? "الراتب *" : "Salary *"}</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 50000"
                  value={addSalary}
                  onChange={(e) => setAddSalary(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">{isRTL ? "العملة *" : "Currency *"}</Label>
                <Select value={addCurrency} onValueChange={setAddCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddResourceModalOpen(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleAddAsResource} disabled={addingResource}>
              {addingResource ? (isRTL ? "جاري الإضافة..." : "Adding...") : (isRTL ? "تأكيد الإضافة" : "Confirm & Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
