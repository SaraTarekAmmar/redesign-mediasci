import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap, Plus, Pencil, Trash2, Play, ToggleLeft, ToggleRight,
  Clock, CheckCircle2, XCircle, SkipForward, ArrowRight, Bell, CircleCheck, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../components/ui/SelectEnhanced";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AutomationRule {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  execution_count: number;
  last_executed_at: string | null;
  logs_count?: number;
  created_at: string;
  updated_at: string;
}

interface AutomationLogEntry {
  id: string;
  rule_id: string;
  issue_id: string;
  status: "success" | "failed" | "skipped";
  message: string | null;
  details: Record<string, any> | null;
  created_at: string;
  issue?: { id: string; key: string; title: string };
}

interface PaginatedLogs {
  data: AutomationLogEntry[];
  current_page: number;
  last_page: number;
  total: number;
}

interface PaginatedRules {
  data: AutomationRule[];
}

interface AutomationRecipe {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  icon: React.ComponentType<{ className?: string }>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TRIGGER_TYPES = [
  { value: "status_changed",  labelKey: "automation.triggerTypes.statusChanged" },
  { value: "assigned",        labelKey: "automation.triggerTypes.assigned" },
  { value: "created",         labelKey: "automation.triggerTypes.created" },
  { value: "comment_added",   labelKey: "automation.triggerTypes.commentAdded" },
  { value: "field_changed",   labelKey: "automation.triggerTypes.fieldChanged" },
];

const ACTION_TYPES = [
  { value: "notify",         labelKey: "automation.actionTypes.notify" },
  { value: "change_field",   labelKey: "automation.actionTypes.changeField" },
  { value: "add_label",      labelKey: "automation.actionTypes.addLabel" },
  { value: "assign",         labelKey: "automation.actionTypes.assign" },
  { value: "create_comment", labelKey: "automation.actionTypes.createComment" },
];

const STATUS_OPTIONS = [
  { value: "todo",       label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done",       label: "Done" },
  { value: "blocked",    label: "Blocked" },
];

const PRIORITY_OPTIONS = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
];

function blankRule(): Omit<AutomationRule, "id" | "execution_count" | "last_executed_at" | "logs_count" | "created_at" | "updated_at"> {
  return {
    project_id: "",
    name: "",
    description: "",
    enabled: true,
    trigger_type: "status_changed",
    trigger_config: {},
    action_type: "notify",
    action_config: {},
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AutomationPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectId = String(activeProject?.id ?? "");

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(blankRule());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null);

  /* Logs panel */
  const [logsRule, setLogsRule] = useState<AutomationRule | null>(null);
  const [logs, setLogs] = useState<PaginatedLogs | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  /* Test dialog */
  const [testRule, setTestRule] = useState<AutomationRule | null>(null);
  const [testing, setTesting] = useState(false);

  const isEditing = "id" in draft && (draft as AutomationRule).id !== "";

  useEffect(() => {
    if (!projectId) return;
    setDraft((cur) => (cur.project_id === projectId ? cur : { ...cur, project_id: projectId }));
  }, [projectId]);

  /* ── Fetch rules ── */
  const fetchRules = () => {
    setLoading(true);
    api.get<PaginatedRules>(`/projects/${projectId}/automation-rules`)
      .then((res) => { if (res) setRules(res.data ?? []); })
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (projectId) fetchRules(); }, [projectId]);

  /* ── Fetch logs ── */
  const fetchLogs = (rule: AutomationRule, page = 1) => {
    setLogsRule(rule);
    setLogsLoading(true);
    api.get<PaginatedLogs>(`/automation-rules/${rule.id}/logs?page=${page}`)
      .then((res) => { if (res) setLogs(res); })
      .catch(() => toast.error(isRTL ? "فشل تحميل السجلات" : "Failed to load logs"))
      .finally(() => setLogsLoading(false));
  };

  /* ── Toggle ── */
  const toggleRule = async (rule: AutomationRule) => {
    const prev = rules;
    setRules((cur) => cur.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    try {
      await api.post(`/automation-rules/${rule.id}/toggle`);
    } catch {
      setRules(prev);
      toast.error(isRTL ? "فشل التبديل" : "Toggle failed");
    }
  };

  /* ── Save ── */
  const save = async () => {
    if (!draft.name.trim()) {
      toast.error(isRTL ? "الاسم مطلوب" : "Name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEditing) {
        const r = await api.put<AutomationRule>(`/automation-rules/${(draft as AutomationRule).id}`, draft);
        setRules((cur) => cur.map((x) => x.id === (draft as AutomationRule).id ? { ...x, ...r } : x));
        toast.success(isRTL ? "تم تحديث القاعدة" : "Rule updated");
      } else {
        const r = await api.post<AutomationRule>(`/projects/${projectId}/automation-rules`, draft);
        if (r) setRules((cur) => [r, ...cur]);
        toast.success(isRTL ? "تم إنشاء القاعدة" : "Rule created");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "حدث خطأ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const remove = async (rule: AutomationRule) => {
    const prev = rules;
    setRules((cur) => cur.filter((x) => x.id !== rule.id));
    try {
      await api.del(`/automation-rules/${rule.id}`);
      toast.success(isRTL ? "تم حذف القاعدة" : "Rule deleted");
    } catch {
      setRules(prev);
      toast.error(isRTL ? "فشل الحذف" : "Delete failed");
    }
    setConfirmDelete(null);
  };

  /* ── Test ── */
  const testRuleAction = async (rule: AutomationRule) => {
    setTesting(true);
    try {
      const res = await api.post<{ message: string }>(`/automation-rules/${rule.id}/test`);
      toast.success(res?.message || (isRTL ? "تم الاختبار بنجاح" : "Rule tested successfully"));
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "فشل الاختبار" : "Test failed"));
    } finally {
      setTesting(false);
      setTestRule(null);
    }
  };

  /* ── Helpers ── */
  const triggerLabel = (type: string) => {
    const found = TRIGGER_TYPES.find((t) => t.value === type);
    return found ? t(found.labelKey) : type;
  };
  const actionLabel = (type: string) => {
    const found = ACTION_TYPES.find((a) => a.value === type);
    return found ? t(found.labelKey) : type;
  };

  const triggerConfigSummary = (rule: AutomationRule): string => {
    const c = rule.trigger_config;
    if (!c || Object.keys(c).length === 0) return "—";
    if (rule.trigger_type === "status_changed") {
      return `${c.from || "*"} → ${c.to || "*"}`;
    }
    if (rule.trigger_type === "field_changed" && c.field) {
      return `${c.field}: ${c.from || "*"} → ${c.to || "*"}`;
    }
    return Object.entries(c).map(([k, v]) => `${k}=${v}`).join(", ");
  };

  const actionConfigSummary = (rule: AutomationRule): string => {
    const c = rule.action_config;
    if (!c || Object.keys(c).length === 0) return "—";
    return Object.entries(c).map(([k, v]) => {
      if (k === "label_ids") return `labels: ${(v as any[]).length}`;
      return `${k}=${v}`;
    }).join(", ");
  };

  const statusName = (value?: string) => (
    STATUS_OPTIONS.find((s) => s.value === value)?.label
    ?? (value || (isRTL ? "أي حالة" : "any status"))
  );

  const triggerPreview = () => {
    switch (draft.trigger_type) {
      case "status_changed":
        return isRTL
          ? `عند انتقال الحالة من ${statusName(draft.trigger_config.from)} إلى ${statusName(draft.trigger_config.to)}`
          : `when the status changes from ${statusName(draft.trigger_config.from)} to ${statusName(draft.trigger_config.to)}`;
      case "assigned":
        return isRTL
          ? "عند تعيين المهمة إلى شخص"
          : "when the issue is assigned to someone";
      case "created":
        return isRTL
          ? "عند إنشاء مهمة جديدة"
          : "when a new issue is created";
      case "comment_added":
        return isRTL
          ? "عند إضافة تعليق جديد"
          : "when a new comment is added";
      case "field_changed":
        return isRTL
          ? `عند تغيّر حقل ${draft.trigger_config.field || "ما"} من ${draft.trigger_config.from || "أي قيمة"} إلى ${draft.trigger_config.to || "أي قيمة"}`
          : `when ${draft.trigger_config.field || "a field"} changes from ${draft.trigger_config.from || "any value"} to ${draft.trigger_config.to || "any value"}`;
      default:
        return isRTL ? "عند تحقق الشرط المحدد" : "when the chosen condition is met";
    }
  };

  const actionPreview = () => {
    switch (draft.action_type) {
      case "notify":
        return isRTL
          ? `أرسل إشعارًا إلى ${draft.action_config.user_id || "المسؤول عنه"}`
          : `send a notification to ${draft.action_config.user_id || "the assignee"}`;
      case "change_field":
        return isRTL
          ? `غيّر حقل ${draft.action_config.field || "ما"} إلى ${draft.action_config.value || "القيمة المحددة"}`
          : `set ${draft.action_config.field || "a field"} to ${draft.action_config.value || "the configured value"}`;
      case "add_label":
        {
          const labels = (draft.action_config.label_ids || []).join(", ");
          return isRTL
            ? `أضف الملصقات ${labels || "المحددة"}`
            : `add ${labels ? `labels: ${labels}` : "the configured labels"}`;
        }
      case "assign":
        return isRTL
          ? `عيّن المهمة إلى ${draft.action_config.user_id || "مستخدم محدد"}`
          : `assign the issue to ${draft.action_config.user_id || "a specific user"}`;
      case "create_comment":
        return isRTL
          ? "أضف تعليقًا جديدًا على المهمة"
          : "post a new comment on the issue";
      default:
        return isRTL ? "نفّذ الإجراء المحدد" : "run the configured action";
    }
  };

  /* ── Update draft trigger config fields ── */
  const setTriggerConfig = (key: string, value: any) => {
    setDraft((prev) => ({ ...prev, trigger_config: { ...prev.trigger_config, [key]: value } }));
  };
  const setActionConfig = (key: string, value: any) => {
    setDraft((prev) => ({ ...prev, action_config: { ...prev.action_config, [key]: value } }));
  };

  /* ── Reset config when type changes ── */
  const onTriggerTypeChange = (type: string) => {
    setDraft((prev) => ({
      ...prev,
      trigger_type: type,
      trigger_config: type === "created" || type === "comment_added" ? {} : prev.trigger_config,
    }));
  };
  const onActionTypeChange = (type: string) => {
    setDraft((prev) => ({
      ...prev,
      action_type: type,
      action_config: {},
    }));
  };

  const starterRecipes: AutomationRecipe[] = [
    {
      name: isRTL ? "تنبيه عند حظر المهمة" : "Alert when work is blocked",
      description: isRTL ? "أرسل تنبيهًا عندما تنتقل المهمة إلى حالة محظورة." : "Notify the assignee when an issue becomes blocked.",
      trigger_type: "status_changed",
      trigger_config: { to: "blocked" },
      action_type: "notify",
      action_config: {},
      icon: Bell,
    },
    {
      name: isRTL ? "أضف علامة الإنجاز" : "Mark completed work",
      description: isRTL ? "أضف علامة عند اكتمال المهمة لتسهيل المراجعة." : "Add a completion label when an issue reaches Done.",
      trigger_type: "status_changed",
      trigger_config: { to: "done" },
      action_type: "add_label",
      action_config: { label_ids: [] },
      icon: CircleCheck,
    },
    {
      name: isRTL ? "تعيين المهام الجديدة" : "Route new work",
      description: isRTL ? "ابدأ بتعيين المهام الجديدة إلى عضو الفريق المناسب." : "Start with a simple assignment rule for new issues.",
      trigger_type: "created",
      trigger_config: {},
      action_type: "assign",
      action_config: {},
      icon: UserRound,
    },
  ];

  const openStarterRecipe = (recipe: AutomationRecipe) => {
    setDraft({
      ...blankRule(),
      project_id: projectId,
      name: recipe.name,
      description: recipe.description,
      trigger_type: recipe.trigger_type,
      trigger_config: recipe.trigger_config,
      action_type: recipe.action_type,
      action_config: recipe.action_config,
    });
    setDialogOpen(true);
  };

  /* ── Status badge ── */
  const statusBadge = (status: string) => {
    const cfg = {
      success: { icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
      failed:  { icon: XCircle,      cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      skipped: { icon: SkipForward,   cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    }[status] || { icon: Clock, cls: "bg-gray-100 text-gray-700" };
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
        <Icon className="h-3 w-3" /> {status}
      </span>
    );
  };

  const activeRuleCount = rules.filter((rule) => rule.enabled).length;
  const pausedRuleCount = rules.length - activeRuleCount;
  const totalRuns = rules.reduce((total, rule) => total + (Number(rule.execution_count) || 0), 0);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title={t("automation.title")}
        subtitle={`${rules.length} ${isRTL ? "قواعد" : "rules"}`}
        actions={
          <Button size="sm" onClick={() => { setDraft(blankRule()); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 me-1" /> {t("automation.createRule")}
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{isRTL ? "قواعد نشطة" : "Active rules"}</p><p className="mt-1 text-sm font-semibold text-foreground">{activeRuleCount}</p></div>
        <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{isRTL ? "متوقفة" : "Paused"}</p><p className="mt-1 text-sm font-semibold text-foreground">{pausedRuleCount}</p></div>
        <div className="rounded-xl border border-border bg-card px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{isRTL ? "إجمالي التشغيلات" : "Total runs"}</p><p className="mt-1 text-sm font-semibold text-foreground">{totalRuns}</p></div>
      </div>

      {/* ── Rules table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {isRTL ? "جارٍ التحميل..." : "Loading..."}
        </div>
      ) : rules.length === 0 ? (
        <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isRTL ? "ابدأ بوصفة جاهزة" : "Start with a starter recipe"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isRTL ? "اختر مثالًا قريبًا من عملك ثم عدّل التفاصيل قبل الحفظ." : "Choose a familiar workflow, then adjust the details before saving."}
              </p>
            </div>

          <div className="grid gap-3 md:grid-cols-3">
            {starterRecipes.map((recipe) => {
              const Icon = recipe.icon;
              return (
                <button
                  key={recipe.name}
                  type="button"
                  onClick={() => openStarterRecipe(recipe)}
                  className="group rounded-xl border border-border bg-card p-4 text-start transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{recipe.name}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{recipe.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
            <Zap className="mb-3 h-9 w-9 opacity-40" aria-hidden="true" />
            <p className="text-sm">{t("automation.noRules")}</p>
            <p className="mt-1 max-w-md text-xs">{isRTL ? "ستظهر القواعد المحفوظة هنا مع آخر تشغيل وحالتها." : "Saved rules will appear here with their latest run and current status."}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">{isRTL ? "الحالة" : "Status"}</th>
                <th className="px-4 py-3">{isRTL ? "الاسم" : "Name"}</th>
                <th className="px-4 py-3">{t("automation.trigger")}</th>
                <th className="px-4 py-3">{isRTL ? "الإعدادات" : "Config"}</th>
                <th className="px-4 py-3">{t("automation.action")}</th>
                <th className="px-4 py-3">{isRTL ? "الإعدادات" : "Config"}</th>
                <th className="px-4 py-3 text-center">{isRTL ? "التنفيذ" : "Runs"}</th>
                <th className="px-4 py-3 text-end">{isRTL ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleRule(rule)}
                      title={rule.enabled ? t("automation.enabled") : t("automation.disabled")}
                      aria-label={rule.enabled ? t("automation.enabled") : t("automation.disabled")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {rule.enabled ? (
                        <ToggleRight className="h-6 w-6 text-primary" />
                      ) : (
                        <ToggleLeft className="h-6 w-6" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{rule.name}</div>
                    {rule.description && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{rule.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{triggerLabel(rule.trigger_type)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {triggerConfigSummary(rule)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{actionLabel(rule.action_type)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {actionConfigSummary(rule)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                    {rule.execution_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1 ${isRTL ? "justify-start" : "justify-end"}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={t("automation.test")}
                        onClick={() => setTestRule(rule)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={t("automation.logs")}
                        onClick={() => fetchLogs(rule)}
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={isRTL ? "تعديل" : "Edit"}
                        onClick={() => { setDraft(rule); setDialogOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        title={isRTL ? "حذف" : "Delete"}
                        onClick={() => setConfirmDelete(rule)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("automation.editRule") : t("automation.createRule")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <Label>{isRTL ? "الاسم" : "Name"}</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder={isRTL ? "مثال: إشعار عند تغيير الحالة" : "e.g. Notify on status change"}
              />
            </div>

            {/* Description */}
            <div>
              <Label>{isRTL ? "الوصف" : "Description"}</Label>
              <Textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder={isRTL ? "وصف اختياري..." : "Optional description..."}
              />
            </div>

            {/* Enabled */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((p) => ({ ...p, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              {t("automation.enabled")}
            </label>

            {/* ── Trigger ── */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("automation.trigger")}</p>

              <div>
                <Label>{isRTL ? "نوع المُحفِّز" : "Trigger Type"}</Label>
                <Select value={draft.trigger_type} onValueChange={onTriggerTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((tt) => (
                      <SelectItem key={tt.value} value={tt.value}>{t(tt.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{triggerPreview()}</p>
              </div>

              {/* Status Changed config */}
              {draft.trigger_type === "status_changed" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{isRTL ? "من حالة" : "From Status"}</Label>
                    <Select value={draft.trigger_config.from || ""} onValueChange={(v) => setTriggerConfig("from", v)}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isRTL ? "إلى حالة" : "To Status"}</Label>
                    <Select value={draft.trigger_config.to || ""} onValueChange={(v) => setTriggerConfig("to", v)}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Field Changed config */}
              {draft.trigger_type === "field_changed" && (
                <div className="space-y-2">
                  <div>
                    <Label>{isRTL ? "الحقل" : "Field"}</Label>
                    <Input
                      value={draft.trigger_config.field || ""}
                      onChange={(e) => setTriggerConfig("field", e.target.value)}
                      placeholder="e.g. priority, issue_type_id"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{isRTL ? "من قيمة" : "From Value"}</Label>
                      <Input
                        value={draft.trigger_config.from || ""}
                        onChange={(e) => setTriggerConfig("from", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{isRTL ? "إلى قيمة" : "To Value"}</Label>
                      <Input
                        value={draft.trigger_config.to || ""}
                        onChange={(e) => setTriggerConfig("to", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Created / Comment Added — no extra config */}
              {(draft.trigger_type === "created" || draft.trigger_type === "comment_added") && (
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "لا حاجة لإعدادات إضافية — يُفعَّل عند كل حدث." : "No additional config needed — fires on every event."}
                </p>
              )}
            </div>

            {/* ── Action ── */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("automation.action")}</p>

              <div>
                <Label>{isRTL ? "نوع الإجراء" : "Action Type"}</Label>
                <Select value={draft.action_type} onValueChange={onActionTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((at) => (
                      <SelectItem key={at.value} value={at.value}>{t(at.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{actionPreview()}</p>
              </div>

              {/* Change Field */}
              {draft.action_type === "change_field" && (
                <div className="space-y-2">
                  <div>
                    <Label>{isRTL ? "الحقل" : "Field"}</Label>
                    <Input
                      value={draft.action_config.field || ""}
                      onChange={(e) => setActionConfig("field", e.target.value)}
                      placeholder="e.g. issue_priority_id, issue_status_id"
                    />
                  </div>
                  <div>
                    <Label>{isRTL ? "القيمة الجديدة" : "New Value"}</Label>
                    <Input
                      value={draft.action_config.value || ""}
                      onChange={(e) => setActionConfig("value", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Notify */}
              {draft.action_type === "notify" && (
                <div>
                  <Label>{isRTL ? "معرف المستخدم (اتركه فارغاً للمسؤول)" : "User ID (leave empty for assignee)"}</Label>
                  <Input
                    value={draft.action_config.user_id || ""}
                    onChange={(e) => setActionConfig("user_id", e.target.value)}
                    placeholder={t("automation.userIdLabel")}
                  />
                </div>
              )}

              {/* Add Label */}
              {draft.action_type === "add_label" && (
                <div>
                  <Label>{isRTL ? "معرفات الملصقات (مفصولة بفاصلة)" : "Label IDs (comma-separated)"}</Label>
                  <Input
                    value={(draft.action_config.label_ids || []).join(",")}
                    onChange={(e) => setActionConfig("label_ids", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    placeholder="1, 2, 3"
                  />
                </div>
              )}

              {/* Assign */}
              {draft.action_type === "assign" && (
                <div>
                  <Label>{isRTL ? "معرف المستخدم" : "User ID"}</Label>
                  <Input
                    value={draft.action_config.user_id || ""}
                    onChange={(e) => setActionConfig("user_id", e.target.value)}
                    placeholder={t("automation.userIdLabel")}
                  />
                </div>
              )}

              {/* Create Comment */}
              {draft.action_type === "create_comment" && (
                <div>
                  <Label>{isRTL ? "الرسالة" : "Message"}</Label>
                  <Textarea
                    value={draft.action_config.message || ""}
                    onChange={(e) => setActionConfig("message", e.target.value)}
                    rows={2}
                    placeholder={isRTL ? "رسالة التعليق..." : "Comment message..."}
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isRTL ? "معاينة القاعدة" : "Rule preview"}
              </p>
              <div className="mt-2 rounded-md border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  {triggerPreview()}
                  {isRTL ? "، ثم " : ", then "}
                  {actionPreview()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRTL
                    ? "هذه هي النسخة المقروءة من القاعدة. إذا كانت الجملة غير مفهومة، فغالبًا يحتاج الحقل أو القيمة إلى تبسيط."
                    : "This is the plain-language version of the rule. If this sentence is hard to read, the field or value needs to be simplified."}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t("app.saving") : t("app.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Logs Sheet ── */}
      <Dialog open={!!logsRule} onOpenChange={() => setLogsRule(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("automation.logs")} — {logsRule?.name}</DialogTitle>
          </DialogHeader>
          {logsLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{isRTL ? "جارٍ التحميل..." : "Loading..."}</div>
          ) : !logs || logs.data.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("automation.noLogs")}</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">{isRTL ? "الحالة" : "Status"}</th>
                      <th className="px-3 py-2">{isRTL ? "المهمة" : "Issue"}</th>
                      <th className="px-3 py-2">{isRTL ? "الرسالة" : "Message"}</th>
                      <th className="px-3 py-2">{isRTL ? "التاريخ" : "Date"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.data.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2">{statusBadge(log.status)}</td>
                        <td className="px-3 py-2">
                          {log.issue ? (
                            <span className="font-medium text-foreground">{log.issue.key}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">
                          {log.message || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {logs.last_page > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  {Array.from({ length: logs.last_page }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === logs.current_page ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => logsRule && fetchLogs(logsRule, p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Test Confirm ── */}
      <Dialog open={!!testRule} onOpenChange={() => setTestRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("automation.test")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? `سيتم اختبار القاعدة "${testRule?.name}" على أقرب مهمة في المشروع.`
              : `The rule "${testRule?.name}" will be tested against the latest issue in this project.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestRule(null)}>{t("app.cancel")}</Button>
            <Button onClick={() => testRule && testRuleAction(testRule)} disabled={testing}>
              <Play className="h-4 w-4 me-1" />
              {testing ? (isRTL ? "جارٍ الاختبار..." : "Testing...") : t("automation.test")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
        title={isRTL ? "حذف القاعدة" : "Delete Rule"}
        description={
          isRTL
            ? `هل أنت متأكد من حذف "${confirmDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`
        }
        confirmLabel={t("app.delete")}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        variant="destructive"
      />
    </div>
  );
}

export default AutomationPage;
