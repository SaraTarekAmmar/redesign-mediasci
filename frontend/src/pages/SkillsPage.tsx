import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Users, Briefcase, LayoutGrid, List, Sparkles, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/common/PageHeader";

interface Skill {
  id: string; name: string; category: string; proficiency: string;
}

interface UserSkill {
  id: string; name: string; email: string; avatar: string | null;
  job_title: string | null; department: string | null; department_id: string | null;
  skills: Skill[];
}

interface Department { id: string; name: string; }

interface SkillDef { id: string; name: string; category: string; color: string; }

interface SkillsData {
  users: UserSkill[]; skills: SkillDef[]; departments: Department[];
}

const proficiencyDots: Record<string, number> = {
  beginner: 1, intermediate: 2, advanced: 3, expert: 4,
};
const proficiencyColors: Record<string, string> = {
  beginner: "#94a3b8", intermediate: "#3b82f6", advanced: "#8b5cf6", expert: "#22c55e",
};

const catColors: Record<string, string> = {
  frontend: "#3b82f6", backend: "#8b5cf6", design: "#ec4899",
  devops: "#0ea5e9", data: "#f59e0b", management: "#22c55e",
};

function getProficiencyLabel(level: string, isRTL: boolean) {
  if (level === "expert") return isRTL ? "ممتاز" : "Excellent";
  if (level === "advanced") return isRTL ? "جيد" : "Good";
  return isRTL ? "مقبول" : "Fair";
}

function SkillsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskBrief, setTaskBrief] = useState("");
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const isRTL = i18n.dir() === "rtl";

  // CRUD state variables
  const [manageOpen, setManageOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState<{ id: string; name: string; category: string } | null>(null);
  const [skillFormOpen, setSkillFormOpen] = useState(false);
  const [skillDeleteConfirm, setSkillDeleteConfirm] = useState<SkillDef | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageSearch, setManageSearch] = useState("");

  const refreshData = () => {
    api.get<SkillsData>("/skills-directory").then((res) => {
      setData(res ?? { users: [], skills: [], departments: [] });
    }).catch(() => {
      toast.error(isRTL ? "فشل تحديث البيانات" : "Failed to refresh data.");
    });
  };

  useEffect(() => {
    setLoading(true);
    api.get<SkillsData>("/skills-directory").then((res) => {
      setData(res ?? { users: [], skills: [], departments: [] });
    }).catch(() => {
      setData(null);
      setError("Failed to load skills directory");
    })
    .finally(() => setLoading(false));
  }, [isRTL]);

  const saveSkill = async () => {
    if (!skillDraft) return;
    if (!skillDraft.name.trim()) {
      toast.error(isRTL ? "اسم المهارة مطلوب" : "Skill name is required.");
      return;
    }
    setSaving(true);
    try {
      if (skillDraft.id) {
        await api.put(`/skills/${skillDraft.id}`, {
          name: skillDraft.name.trim(),
          category: skillDraft.category
        });
        toast.success(isRTL ? "تم تحديث المهارة بنجاح" : "Skill updated successfully.");
      } else {
        await api.post("/skills", {
          name: skillDraft.name.trim(),
          category: skillDraft.category || "general"
        });
        toast.success(isRTL ? "تم إنشاء المهارة بنجاح" : "Skill created successfully.");
      }
      setSkillFormOpen(false);
      setSkillDraft(null);
      refreshData();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل حفظ المهارة" : "Failed to save skill."));
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async () => {
    if (!skillDeleteConfirm) return;
    try {
      await api.del(`/skills/${skillDeleteConfirm.id}`);
      toast.success(isRTL ? "تم حذف المهارة بنجاح" : "Skill deleted successfully.");
      setSkillDeleteConfirm(null);
      refreshData();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل حذف المهارة" : "Failed to delete skill."));
    }
  };

  const recommendations = useMemo(() => {
    const terms = taskBrief.toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/g).filter(Boolean);
    if (!terms.length || !data) return [];

    return data.users
      .map((user) => {
        const matchedSkills = user.skills.filter((skill) => {
          const text = `${skill.name} ${skill.category} ${skill.proficiency}`.toLowerCase();
          return terms.some((term) => text.includes(term));
        });

        const score = matchedSkills.reduce((sum, skill) => {
          const weight = skill.proficiency === "expert" ? 4 : skill.proficiency === "advanced" ? 3 : skill.proficiency === "intermediate" ? 2 : 1;
          return sum + weight;
        }, 0);

        return { user, matchedSkills, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [taskBrief, data]);

  const filtered = data?.users.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (skillFilter && !u.skills.some((s) => s.id === skillFilter)) return false;
    if (deptFilter && u.department_id !== deptFilter) return false;
    return true;
  }) ?? [];

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" role="status" aria-label={t("skills.loadingLabel")}>
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-5">
            <div className="h-7 w-44 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="h-10 flex-1 animate-pulse rounded-lg bg-muted min-w-[200px]" />
            <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 w-14 animate-pulse rounded-md bg-muted" />
                  <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center" role="alert">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={i18n.dir()}>
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          icon={<Sparkles className="h-4 w-4" />}
          title={t("skills.title")}
          subtitle={t("skills.subtitle", { users: data?.users.length ?? 0, skills: data?.skills.length ?? 0 })}
          actions={
          <>
            <Button size="sm" onClick={() => setManageOpen(true)}>
              {isRTL ? "إدارة المهارات" : "Manage Skills"}
            </Button>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5" role="tablist" aria-label={t("skills.viewMode")}>
            <button
              role="tab"
              aria-selected={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "cards" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              {t("skills.viewCards")}
            </button>
            <button
              role="tab"
              aria-selected={viewMode === "table"}
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              {t("skills.viewTable")}
            </button>
          </div>
          </>
          }
        />

        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{isRTL ? "مُطابِق المهام بالذكاء الاصطناعي" : "AI task matcher"}</h2>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "اكتب وصف المهمة لعرض الأشخاص الذين تناسب مهاراتهم هذه المهمة."
                  : "Enter a task brief and surface the people whose listed skills fit best."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-2">
              <input
                value={taskBrief}
                onChange={(e) => setTaskBrief(e.target.value)}
                placeholder={isRTL ? "صف المهمة أو مجال المهارة أو نوع التسليم..." : "Describe the task, skill area, or delivery type..."}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground">
                {isRTL ? "تتم المطابقة اعتماداً على دليل المهارات فقط." : "Matching is based on the skills directory only."}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
              {recommendations.length > 0 ? recommendations.map(({ user, matchedSkills, score }, index) => (
                <button
                  key={user.id}
                  type="button"
                  className="rounded-lg border border-border bg-background p-3 text-start transition-colors hover:border-primary/50 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      #{index + 1}
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">{score}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {matchedSkills.slice(0, 2).map((skill) => skill.name).join(" · ") || (isRTL ? "لا تطابق مباشر" : "No direct match")}
                  </p>
                </button>
              )) : (
                <div className="col-span-full rounded-lg border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground">
                  {isRTL ? "أضف وصفاً أعلاه لعرض اقتراحات مرتبة." : "Add a brief above to see ranked suggestions."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder={t("skills.search")}
              value={search} onChange={(e) => setSearch(e.target.value)}
              aria-label={t("skills.search")}
              className="w-full rounded-lg border border-border bg-background py-2 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <select
            value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}
            aria-label={t("skills.allSkills")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          >
            <option value="">{t("skills.allSkills")}</option>
            {data?.skills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            aria-label={t("skills.allDepts")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          >
            <option value="">{t("skills.allDepts")}</option>
            {data?.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16" role="status">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("skills.noMatch")}</p>
          </div>
        ) : viewMode === "cards" ? (
          /* Cards view */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                    aria-hidden="true"
                  >
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.job_title || t("skills.teamMember")}</p>
                  </div>
                </div>

                {u.department && (
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                    {u.department}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {u.skills.map((s) => (
                    <div
                      key={s.id}
                    className="group relative inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{
                        backgroundColor: (catColors[s.category] || "#64748b") + "18",
                        color: catColors[s.category] || "#64748b",
                      }}
                    >
                      {s.name} · {getProficiencyLabel(s.proficiency, isRTL)}
                      <span className="flex gap-0.5" aria-label={`${s.proficiency} proficiency`}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <span
                            key={i}
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: i < (proficiencyDots[s.proficiency] || 1)
                                ? (proficiencyColors[s.proficiency] || "#94a3b8")
                                : "transparent",
                              border: `1px solid ${i < (proficiencyDots[s.proficiency] || 1) ? "transparent" : (catColors[s.category] || "#64748b") + "40"}`,
                            }}
                          />
                        ))}
                      </span>
                    </div>
                  ))}
                  {u.skills.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">{t("skills.noSkills")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table view */
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-start font-medium">{t("skills.table.name")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("skills.table.email")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("skills.table.department")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("skills.table.jobTitle")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("skills.table.skills")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.department || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.job_title || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.skills.map((s) => (
                          <span
                            key={s.id}
                            className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: (catColors[s.category] || "#64748b") + "18",
                              color: catColors[s.category] || "#64748b",
                            }}
                          >
                            {s.name} · {getProficiencyLabel(s.proficiency, isRTL)}
                          </span>
                        ))}
                        {u.skills.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">{t("skills.noSkills")}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Manage Skills Dialog */}
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle>{isRTL ? "إدارة المهارات" : "Manage Skills"}</DialogTitle>
              <Button
                size="sm"
                onClick={() => {
                  setSkillDraft({ id: "", name: "", category: "general" });
                  setSkillFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {isRTL ? "إضافة مهارة" : "Add Skill"}
              </Button>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  placeholder={isRTL ? "بحث عن مهارة..." : "Search skills..."}
                  className="ps-9"
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-2 text-start font-medium">{isRTL ? "الاسم" : "Name"}</th>
                      <th className="px-4 py-2 text-start font-medium">{isRTL ? "التصنيف" : "Category"}</th>
                      <th className="px-4 py-2 text-end font-medium">{isRTL ? "العمليات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.skills || [])
                      .filter((s) => s.name.toLowerCase().includes(manageSearch.toLowerCase()))
                      .map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-accent/40 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.category || "general"}</td>
                          <td className="px-4 py-2.5 text-end space-x-2 space-x-reverse">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setSkillDraft({ id: String(s.id), name: s.name, category: s.category || "general" });
                                setSkillFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setSkillDeleteConfirm(s)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManageOpen(false)}>
                {isRTL ? "إغلاق" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Skill Create/Edit Form Dialog */}
        <Dialog open={skillFormOpen} onOpenChange={setSkillFormOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {skillDraft?.id
                  ? (isRTL ? "تعديل المهارة" : "Edit Skill")
                  : (isRTL ? "إنشاء مهارة جديدة" : "Create New Skill")}
              </DialogTitle>
            </DialogHeader>
            {skillDraft && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>{isRTL ? "اسم المهارة" : "Skill Name"}</Label>
                  <Input
                    value={skillDraft.name}
                    onChange={(e) => setSkillDraft({ ...skillDraft, name: e.target.value })}
                    placeholder={isRTL ? "أدخل اسم المهارة..." : "Enter skill name..."}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{isRTL ? "التصنيف" : "Category"}</Label>
                  <select
                    value={skillDraft.category}
                    onChange={(e) => setSkillDraft({ ...skillDraft, category: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="design">Design</option>
                    <option value="devops">DevOps</option>
                    <option value="data">Data</option>
                    <option value="management">Management</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkillFormOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={saveSkill} disabled={saving}>
                {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ" : "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Skill Delete Dialog */}
        <ConfirmDialog
          open={!!skillDeleteConfirm}
          onOpenChange={(open) => !open && setSkillDeleteConfirm(null)}
          title={isRTL ? "حذف المهارة" : "Delete Skill"}
          description={
            isRTL
              ? `هل أنت متأكد من رغبتك في حذف المهارة "${skillDeleteConfirm?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
              : `Are you sure you want to delete the skill "${skillDeleteConfirm?.name}"? This action cannot be undone.`
          }
          onConfirm={deleteSkill}
        />
      </div>
    </div>
  );
}


export default SkillsPage;
