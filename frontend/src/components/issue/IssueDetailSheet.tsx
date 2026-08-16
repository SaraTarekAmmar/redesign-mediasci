import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow, format } from "date-fns";
import {
  Send, Link2, X, SlidersHorizontal, Sparkles, ChevronDown, Loader2, Trash2,
  CheckSquare, Clock, GitCommit, MessageSquare, History, Activity, Plus, FileText,
  AlertTriangle, DollarSign, UserCheck, CheckCircle2, Circle, Eye, Download, Upload,
  Layers, Lock, Filter
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";
import { Separator } from "../ui/Separator";
import { Select, SelectTrigger, SelectContent, SelectItem } from "../ui/SelectEnhanced";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/PopoverEnhanced";
import { Checkbox } from "../ui/DropdownMenu";
import { useStore, lookups } from "../../store/useStore";
import { currentUserId } from "../../data/seed";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { UserAvatar } from "../common/UserAvatar";
import { LabelChip } from "../common/LabelChip";
import { WorkforceBadge } from "../common/WorkforceBadge";
import { PriorityIcon } from "../common/PriorityIcon";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";
import { TimerButton } from "../time/TimerButton";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { GithubPrLinks } from "./GithubPrLinks";
import { IssueDependencies } from "./IssueDependencies";
import { useProjectCatalogStore } from "../../store/useProjectCatalog";

interface SubtaskItem {
  id: number;
  key: string;
  title: string;
  statusId: string;
  statusName: string;
  statusCategory: string;
  priorityName: string;
  assigneeName?: string | null;
  estimated_hours: number;
}

interface AttachmentItem {
  id: number;
  issue_id: number;
  uploader_name: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

interface ChecklistItem {
  id: number;
  issue_id: number;
  title: string;
  completed: boolean;
  completed_by?: number | null;
  completed_at?: string | null;
}

interface IssueTimeLog {
  id: number;
  user_name: string;
  hours: number;
  description?: string | null;
  logged_at?: string | null;
  billable: boolean;
  approved?: boolean;
}

interface TaskActivityItem {
  id: number;
  user_name: string;
  activity_type: string;
  description: string;
  created_at: string;
}

interface TaskHistoryItem {
  id: number;
  field: string;
  old_value?: string | null;
  new_value?: string | null;
  action?: string | null;
  created_at: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function IssueDetailSheet() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const selectedIssueId = useStore((s) => s.selectedIssueId);
  const setSelected = useStore((s) => s.setSelectedIssue);
  const issue = useStore((s) => s.issues.find((i) => i.id === s.selectedIssueId));
  const updateIssue = useStore((s) => s.updateIssue);
  const deleteIssue = useStore((s) => s.deleteIssue);
  const addComment = useStore((s) => s.addComment);
  const boardStatusIds = lookups.statuses.map((s) => s.id);

  const [activeTab, setActiveTab] = useState<"overview" | "subtasks" | "checklist" | "attachments" | "time" | "dependencies" | "discussion" | "history">("overview");

  // Task Details State
  const [executionData, setExecutionData] = useState<any>(null);
  const [accCriteria, setAccCriteria] = useState("");
  const [defReady, setDefReady] = useState("");
  const [defDone, setDefDone] = useState("");
  const [estHours, setEstHours] = useState<number>(0);
  const [savingExec, setSavingExec] = useState(false);

  // Subtasks State
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskHours, setNewSubtaskHours] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachmentItem | null>(null);

  // Checklists State
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);

  // Time Logs State
  const [timeLogs, setTimeLogs] = useState<IssueTimeLog[]>([]);
  const [logHours, setLogHours] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [logBillable, setLogBillable] = useState(false);
  const [loggingTime, setLoggingTime] = useState(false);

  // Activities & History State
  const [activities, setActivities] = useState<TaskActivityItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [histories, setHistories] = useState<TaskHistoryItem[]>([]);

  // Base Issue Sheet State
  const [comment, setComment] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { hasRole, hasPermission } = useAuth();
  const canEdit = hasRole("super-admin", "admin", "project-manager", "team-leader") || hasPermission("edit-issues");
  const canDelete = hasRole("super-admin", "admin", "project-manager", "team-leader") || hasPermission("delete-issues");
  const comments = issue?.comments ?? [];

  // Fetch Execution Details, Subtasks, Attachments, Checklists, Time Logs, Activities
  useEffect(() => {
    if (!selectedIssueId) return;
    let cancelled = false;

    // Execution Details
    api.get(`/issues/${selectedIssueId}/details`)
      .then((data: any) => {
        if (cancelled) return;
        setExecutionData(data);
        setAccCriteria(data.acceptance_criteria || "");
        setDefReady(data.definition_of_ready || "");
        setDefDone(data.definition_of_done || "");
        setEstHours(data.estimated_hours || 0);
      })
      .catch(() => {});

    // Subtasks
    api.get(`/issues/${selectedIssueId}/subtasks`)
      .then((data: any) => {
        if (!cancelled && Array.isArray(data)) setSubtasks(data);
      })
      .catch(() => {});

    // Attachments
    api.get(`/issues/${selectedIssueId}/attachments`)
      .then((data: any) => {
        if (!cancelled && Array.isArray(data)) setAttachments(data);
      })
      .catch(() => {});

    // Checklists
    api.get(`/issues/${selectedIssueId}/checklists`)
      .then((data: any) => {
        if (!cancelled && Array.isArray(data)) setChecklists(data);
      })
      .catch(() => {});

    // Time Logs
    api.get(`/issues/${selectedIssueId}/time-logs`)
      .then((data: any) => {
        if (!cancelled && Array.isArray(data)) setTimeLogs(data);
      })
      .catch(() => {});

    // Activities & History
    fetchActivities(activityFilter);
    api.get(`/issues/${selectedIssueId}/history-audit`)
      .then((hists: any) => {
        if (!cancelled && Array.isArray(hists)) setHistories(hists);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedIssueId]);

  const fetchActivities = (filterType: string) => {
    if (!selectedIssueId) return;
    const query = filterType && filterType !== "all" ? `?activity_type=${filterType}` : "";
    api.get(`/issues/${selectedIssueId}/activities${query}`)
      .then((acts: any) => {
        if (Array.isArray(acts)) setActivities(acts);
      })
      .catch(() => {});
  };

  const handleActivityFilterChange = (type: string) => {
    setActivityFilter(type);
    fetchActivities(type);
  };

  const handleDelete = async () => {
    if (!issue) return;
    setIsDeleting(true);
    try {
      await deleteIssue(issue.id);
      toast.success(t("issueDetail.deletedSuccess", { key: issue.key }));
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message || t("issueDetail.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Title update
  const [titleDraft, setTitleDraft] = useState(issue?.title ?? "");
  const debouncedUpdateTitle = useDebouncedCallback((id: string, title: string) => {
    updateIssue(id, { title });
  }, 500);

  useEffect(() => {
    setTitleDraft(issue?.title ?? "");
  }, [issue?.id, issue?.title]);

  const handleSaveExecution = async () => {
    if (!selectedIssueId) return;
    setSavingExec(true);
    try {
      const payload = {
        acceptance_criteria: accCriteria,
        definition_of_ready: defReady,
        definition_of_done: defDone,
        estimated_hours: Number(estHours),
      };
      const updated = await api.put(`/issues/${selectedIssueId}/execution`, payload);
      setExecutionData(updated);
      toast.success(isRTL ? "تم حفظ تفاصيل التنفيذ بنجاح" : "Execution fields saved successfully");
    } catch {
      toast.error(isRTL ? "فشل حفظ التفاصيل" : "Failed to save execution details");
    } finally {
      setSavingExec(false);
    }
  };

  // Subtask Handler
  const handleAddSubtask = async () => {
    if (!selectedIssueId || !newSubtaskTitle.trim()) return;
    setAddingSubtask(true);
    try {
      const query = `?title=${encodeURIComponent(newSubtaskTitle.trim())}&estimated_hours=${newSubtaskHours || 0}`;
      const newSt = await api.post(`/issues/${selectedIssueId}/subtasks${query}`);
      setSubtasks((prev) => [...prev, newSt]);
      setNewSubtaskTitle("");
      setNewSubtaskHours("");
      toast.success(isRTL ? "تم إضافة المهمة الفرعية" : "Subtask added successfully");
    } catch {
      toast.error(isRTL ? "فشل إضافة المهمة الفرعية" : "Failed to add subtask");
    } finally {
      setAddingSubtask(false);
    }
  };

  // Attachments Handler
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedIssueId || !e.target.files || e.target.files.length === 0) return;
    setUploadingAtt(true);
    try {
      const files = Array.from(e.target.files);
      for (const file of files) {
        const query = `?original_filename=${encodeURIComponent(file.name)}&mime_type=${encodeURIComponent(file.type || "application/octet-stream")}&file_size=${file.size}&storage_path=/uploads/${encodeURIComponent(file.name)}`;
        const newAtt = await api.post(`/issues/${selectedIssueId}/attachments${query}`);
        setAttachments((prev) => [newAtt, ...prev]);
      }
      toast.success(isRTL ? "تم رفع المرفقات" : "Attachments uploaded successfully");
    } catch {
      toast.error(isRTL ? "فشل رفع المرفق" : "Failed to upload attachment");
    } finally {
      setUploadingAtt(false);
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    if (!selectedIssueId) return;
    try {
      await api.del(`/issues/${selectedIssueId}/attachments/${attId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      toast.success(isRTL ? "تم حذف المرفق" : "Attachment deleted");
    } catch {
      toast.error(isRTL ? "فشل حذف المرفق" : "Failed to delete attachment");
    }
  };

  // Checklists Handlers
  const handleAddChecklist = async () => {
    if (!selectedIssueId || !newChecklistTitle.trim()) return;
    setAddingChecklist(true);
    try {
      const newItem = await api.post(`/issues/${selectedIssueId}/checklists`, { title: newChecklistTitle.trim() });
      setChecklists((prev) => [...prev, newItem]);
      setNewChecklistTitle("");
    } catch {
      toast.error(isRTL ? "فشل الإضافة" : "Failed to add checklist item");
    } finally {
      setAddingChecklist(false);
    }
  };

  const handleToggleChecklist = async (item: ChecklistItem) => {
    if (!selectedIssueId) return;
    try {
      const updated = await api.put(`/issues/${selectedIssueId}/checklists/${item.id}`, { completed: !item.completed });
      setChecklists((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
    } catch {
      toast.error(isRTL ? "فشل التحديث" : "Failed to update item");
    }
  };

  // Time Log Handler
  const handleLogTime = async () => {
    if (!selectedIssueId || !logHours || isNaN(Number(logHours)) || Number(logHours) <= 0) {
      toast.error(isRTL ? "أدخل عدد ساعات صحيح" : "Enter a valid positive number of hours");
      return;
    }
    setLoggingTime(true);
    try {
      const payload = {
        hours: parseFloat(logHours),
        description: logDesc.trim() || undefined,
        billable: logBillable,
      };
      await api.post(`/issues/${selectedIssueId}/time-logs`, payload);
      toast.success(isRTL ? "تم تسجيل الوقت بنجاح" : "Time logged successfully");
      setLogHours("");
      setLogDesc("");
      setLogBillable(false);

      const [newLogs, newDetails] = await Promise.all([
        api.get(`/issues/${selectedIssueId}/time-logs`),
        api.get(`/issues/${selectedIssueId}/details`),
      ]);
      setTimeLogs(newLogs);
      setExecutionData(newDetails);
    } catch {
      toast.error(isRTL ? "فشل تسجيل الوقت" : "Failed to log time");
    } finally {
      setLoggingTime(false);
    }
  };

  const submitComment = () => {
    if (!comment.trim() || !selectedIssueId) return;
    addComment(selectedIssueId, comment.trim());
    setComment("");
  };

  const open = Boolean(selectedIssueId && issue);

  if (!issue) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  const assignee = issue.assigneeId ? lookups.userById[issue.assigneeId] : null;
  const externalAssignee = issue.externalAssigneeId
    ? lookups.workforce.find((w) => w.type === "external" && w.id === String(issue.externalAssigneeId))
    : null;
  const priority = lookups.priorityById[issue.priorityId];

  // Rollups & Calculations
  const completedChecklists = checklists.filter((c) => c.completed).length;
  const checklistProgress = checklists.length > 0 ? Math.round((completedChecklists / checklists.length) * 100) : 0;

  const completedSubtasks = subtasks.filter((st) => st.statusCategory === "done").length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  // Time Budget Calculation & Indicators
  const totalEst = executionData?.estimated_hours || estHours || 0;
  const totalLogged = executionData?.actual_hours || 0;
  const remHours = executionData?.remaining_hours || 0;
  const isOverBudget = totalEst > 0 && totalLogged > totalEst;
  const budgetPct = totalEst > 0 ? Math.round((totalLogged / totalEst) * 100) : 0;

  let budgetColorClass = "bg-emerald-500 text-emerald-700 border-emerald-500/30";
  let budgetGaugeColor = "bg-emerald-500";
  if (budgetPct >= 80 && budgetPct <= 100) {
    budgetColorClass = "bg-amber-500/10 text-amber-600 border-amber-500/30";
    budgetGaugeColor = "bg-amber-500";
  } else if (budgetPct > 100) {
    budgetColorClass = "bg-rose-500/10 text-rose-600 border-rose-500/30";
    budgetGaugeColor = "bg-rose-500";
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setSelected(null)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <IssueTypeIcon typeKey={issue.typeKey} className="h-4 w-4" />
            <SheetTitle className="font-mono text-sm font-medium text-muted-foreground">{issue.key}</SheetTitle>
          </div>
          <div className="flex items-center gap-1">
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={t("issueDetail.deleteIssue")}
                disabled={isDeleting}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label={t("app.cancel")} onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Title */}
        <div className="px-5 pt-4">
          <input
            value={titleDraft}
            readOnly={!canEdit}
            onChange={(e) => {
              setTitleDraft(e.target.value);
              if (issue) debouncedUpdateTitle(issue.id, e.target.value);
            }}
            className={cn(
              "w-full rounded-md bg-transparent text-xl font-semibold leading-tight text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring",
              canEdit ? "hover:bg-accent/40 focus:bg-accent/40" : "cursor-default"
            )}
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border px-5 gap-3 mt-4 text-xs font-semibold overflow-x-auto scrollbar-none">
          <button onClick={() => setActiveTab("overview")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <FileText className="h-3.5 w-3.5" />
            <span>{isRTL ? "العام والجاهزية" : "Overview & DoD"}</span>
          </button>
          <button onClick={() => setActiveTab("subtasks")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "subtasks" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Layers className="h-3.5 w-3.5" />
            <span>{isRTL ? "المهام الفرعية" : "Subtasks"} ({completedSubtasks}/{subtasks.length})</span>
          </button>
          <button onClick={() => setActiveTab("checklist")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "checklist" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <CheckSquare className="h-3.5 w-3.5" />
            <span>{isRTL ? "قائمة التحقق" : "Checklist"} ({completedChecklists}/{checklists.length})</span>
          </button>
          <button onClick={() => setActiveTab("attachments")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "attachments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Upload className="h-3.5 w-3.5" />
            <span>{isRTL ? "المرفقات" : "Attachments"} ({attachments.length})</span>
          </button>
          <button onClick={() => setActiveTab("time")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "time" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Clock className="h-3.5 w-3.5" />
            <span>{isRTL ? "الوقت والميزانية" : "Time Dashboard"}</span>
          </button>
          <button onClick={() => setActiveTab("dependencies")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "dependencies" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <GitCommit className="h-3.5 w-3.5" />
            <span>{isRTL ? "الارتباطات" : "Dependencies"}</span>
          </button>
          <button onClick={() => setActiveTab("discussion")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "discussion" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{isRTL ? "المناقشة" : "Discussion"} ({comments.length})</span>
          </button>
          <button onClick={() => setActiveTab("history")} className={cn("pb-2 border-b-2 transition-colors flex items-center gap-1.5", activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <History className="h-3.5 w-3.5" />
            <span>{isRTL ? "السجل والأحداث" : "Activity & History"}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* TAB 1: OVERVIEW & QUALITY GATES */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <Field label={t("createIssue.status")}>
                  <Select value={issue.statusId} onValueChange={(v) => updateIssue(issue.id, { statusId: v })}>
                    <SelectTrigger size="sm" className="w-full max-w-[220px]" disabled={!canEdit}>
                      {lookups.statusById[issue.statusId]?.name ?? issue.statusId}
                    </SelectTrigger>
                    <SelectContent>
                      {boardStatusIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {lookups.statusById[id]?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Separator />
                <Field label={t("createIssue.assignee")}>
                  <Select
                    value={
                      issue.externalAssigneeId
                        ? `ext-${issue.externalAssigneeId}`
                        : issue.assigneeId
                        ? `int-${issue.assigneeId}`
                        : "unassigned"
                    }
                    onValueChange={(v) =>
                      updateIssue(issue.id, {
                        assigneeId: v.startsWith("int-") ? v.slice(4) : undefined,
                        externalAssigneeId: v.startsWith("ext-") ? v.slice(4) : undefined,
                      })
                    }
                  >
                    <SelectTrigger size="sm" className="w-full max-w-[220px]" disabled={!canEdit}>
                      <span className="inline-flex items-center gap-1.5 truncate">
                        {(issue.assigneeId || issue.externalAssigneeId) && (
                          <WorkforceBadge type={issue.externalAssigneeId ? "external" : "internal"} />
                        )}
                        {externalAssignee?.name ?? assignee?.name ?? t("createIssue.unassigned")}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t("createIssue.unassigned")}</SelectItem>
                      {/* Eligible project workforce only: internal team members + external partner members */}
                      {lookups.workforce.map((w) => (
                        <SelectItem key={`${w.type}-${w.id}`} value={`${w.type === "internal" ? "int" : "ext"}-${w.id}`}>
                          <span className="inline-flex items-center gap-2">
                            <WorkforceBadge type={w.type} />
                            <span>{w.name}</span>
                            {w.source && <span className="text-xs text-muted-foreground">— {w.source}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Separator />
                <Field label={t("createIssue.priority")}>
                  <Select value={issue.priorityId} onValueChange={(v) => updateIssue(issue.id, { priorityId: v })}>
                    <SelectTrigger size="sm" className="w-full max-w-[220px]" disabled={!canEdit}>
                      {priority?.name ?? issue.priorityId}
                    </SelectTrigger>
                    <SelectContent>
                      {lookups.priorities.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Quality Gates */}
              <div className="space-y-4 rounded-lg border border-border p-4 bg-card shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isRTL ? "معايير الجاهزية والقبول" : "Acceptance Criteria & Quality Gates"}
                  </h4>
                  {canEdit && (
                    <Button size="sm" onClick={handleSaveExecution} disabled={savingExec} className="h-7 text-xs">
                      {savingExec ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ التغييرات" : "Save Criteria")}
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{isRTL ? "معايير القبول (Acceptance Criteria)" : "Acceptance Criteria"}</Label>
                  <Textarea value={accCriteria} onChange={(e) => setAccCriteria(e.target.value)} placeholder="Requirements specified, expectations clear..." rows={3} readOnly={!canEdit} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isRTL ? "تعريف الجاهزية (DoR)" : "Definition of Ready (DoR)"}</Label>
                    <Textarea value={defReady} onChange={(e) => setDefReady(e.target.value)} placeholder="Requirements clear, design attached..." rows={2} readOnly={!canEdit} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isRTL ? "تعريف الإنجاز (DoD)" : "Definition of Done (DoD)"}</Label>
                    <Textarea value={defDone} onChange={(e) => setDefDone(e.target.value)} placeholder="Unit tests passed, code reviewed..." rows={2} readOnly={!canEdit} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ENTERPRISE SUBTASKS */}
          {activeTab === "subtasks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{isRTL ? "المهام الفرعية التابعة" : "Enterprise Subtasks"}</h4>
                  <p className="text-xs text-muted-foreground">{completedSubtasks} of {subtasks.length} subtasks completed</p>
                </div>
                <span className="text-xs font-bold text-primary">{subtaskProgress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${subtaskProgress}%` }} />
              </div>

              {/* Add Subtask Form */}
              {canEdit && (
                <div className="flex gap-2">
                  <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} placeholder={isRTL ? "عنوان المهمة الفرعية..." : "Subtask title..."} className="flex-1" />
                  <Input type="number" step="0.5" placeholder="Est. hrs" value={newSubtaskHours} onChange={(e) => setNewSubtaskHours(e.target.value)} className="w-24 text-xs" />
                  <Button size="sm" onClick={handleAddSubtask} disabled={addingSubtask || !newSubtaskTitle.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    {isRTL ? "إضافة" : "Add Subtask"}
                  </Button>
                </div>
              )}

              {/* Subtasks Roster */}
              <div className="space-y-2 pt-2">
                {subtasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{isRTL ? "لا توجد مهام فرعية." : "No subtasks created."}</p>
                ) : (
                  subtasks.map((st) => (
                    <div key={st.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono text-xs text-muted-foreground">{st.key || `SUB-${st.id}`}</span>
                        <span className={cn("text-sm font-medium truncate", st.statusCategory === "done" && "line-through text-muted-foreground")}>{st.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium text-foreground">{st.statusName}</span>
                        {st.estimated_hours > 0 && <span className="text-xs text-muted-foreground">{st.estimated_hours}h</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{isRTL ? "قائمة التحقق (Checklist)" : "Checklist Items"}</h4>
                  <p className="text-xs text-muted-foreground">{completedChecklists} of {checklists.length} items completed</p>
                </div>
                <span className="text-xs font-bold text-primary">{checklistProgress}%</span>
              </div>

              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${checklistProgress}%` }} />
              </div>

              {canEdit && (
                <div className="flex gap-2">
                  <Input value={newChecklistTitle} onChange={(e) => setNewChecklistTitle(e.target.value)} placeholder={isRTL ? "إضافة عنصر جديد..." : "Add checklist item..."} onKeyDown={(e) => e.key === "Enter" && handleAddChecklist()} />
                  <Button size="sm" onClick={handleAddChecklist} disabled={addingChecklist || !newChecklistTitle.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    {isRTL ? "إضافة" : "Add"}
                  </Button>
                </div>
              )}

              <div className="space-y-2 pt-2">
                {checklists.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{isRTL ? "لا توجد عناصر بالقائمة." : "No checklist items created."}</p>
                ) : (
                  checklists.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                      <label className="flex items-center gap-3 cursor-pointer text-sm flex-1 min-w-0">
                        <input type="checkbox" checked={item.completed} onChange={() => handleToggleChecklist(item)} disabled={!canEdit} className="h-4 w-4 rounded border-border text-primary" />
                        <span className={cn("truncate font-medium", item.completed ? "line-through text-muted-foreground" : "text-foreground")}>{item.title}</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ATTACHMENTS WITH PREVIEWS */}
          {activeTab === "attachments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">{isRTL ? "معرض المرفقات والملفات" : "Attachments & Document Gallery"}</h4>
                {canEdit && (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingAtt ? (isRTL ? "جاري الرفع..." : "Uploading...") : (isRTL ? "رفع مرفق" : "Upload File")}</span>
                    <input type="file" multiple onChange={handleUploadAttachment} disabled={uploadingAtt} className="hidden" />
                  </label>
                )}
              </div>

              {/* Attachments Roster */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {attachments.length === 0 ? (
                  <p className="col-span-2 text-xs text-muted-foreground text-center py-8">{isRTL ? "لا توجد مرفقات مرفوعة." : "No attachments uploaded yet."}</p>
                ) : (
                  attachments.map((att) => (
                    <div key={att.id} className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between space-y-2 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs text-foreground truncate block">{att.original_filename}</span>
                          <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">{att.mime_type} • {Math.round((att.file_size || 0) / 1024)} KB</span>
                        </div>
                        {canEdit && (
                          <button onClick={() => handleDeleteAttachment(att.id)} className="text-muted-foreground hover:text-destructive p-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                        <span className="text-muted-foreground text-[10px]">by {att.uploader_name}</span>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setPreviewFile(att)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Preview Lightbox Dialog */}
              {previewFile && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
                  <div className="bg-background rounded-xl p-4 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{previewFile.original_filename}</h4>
                      <button onClick={() => setPreviewFile(null)}><X className="h-4 w-4" /></button>
                    </div>
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 text-primary opacity-80" />
                      <p>Preview mode for <strong>{previewFile.mime_type}</strong></p>
                      <p className="mt-1 font-mono text-[10px]">Path: {previewFile.storage_path}</p>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setPreviewFile(null)}>{isRTL ? "إغلاق" : "Close Preview"}</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ENTERPRISE TIME DASHBOARD */}
          {activeTab === "time" && (
            <div className="space-y-6">
              {/* Over Budget Alert Banner */}
              {isOverBudget && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{isRTL ? `تنبيه: تجاوز الوقت المقدر للمهمة (${totalLogged}h / ${totalEst}h)` : `Over Budget Warning: Logged hours exceed estimate (${totalLogged}h / ${totalEst}h)`}</span>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-muted-foreground font-medium">{isRTL ? "المقدر" : "Estimated"}</span>
                  <p className="text-base font-bold text-foreground mt-0.5">{totalEst} hrs</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-muted-foreground font-medium">{isRTL ? "المسجل" : "Logged"}</span>
                  <p className="text-base font-bold text-primary mt-0.5">{totalLogged} hrs</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-muted-foreground font-medium">{isRTL ? "المتبقي" : "Remaining"}</span>
                  <p className="text-base font-bold text-amber-600 mt-0.5">{remHours} hrs</p>
                </div>
                <div className={cn("p-3 rounded-lg border font-bold text-xs flex flex-col justify-center items-center", budgetColorClass)}>
                  <span className="text-[10px] uppercase">{isRTL ? "استهلاك الميزانية" : "Budget Consumed"}</span>
                  <p className="text-base mt-0.5">{budgetPct}%</p>
                </div>
              </div>

              {/* Color Coded Budget Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Budget Consumption Gauge</span>
                  <span>{budgetPct}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full transition-all duration-300", budgetGaugeColor)} style={{ width: `${Math.min(100, budgetPct)}%` }} />
                </div>
              </div>

              {/* Log Time Form */}
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isRTL ? "تسجيل وقت عمل جديد" : "Log Work Time"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "عدد الساعات *" : "Hours *"}</Label>
                    <Input type="number" step="0.25" placeholder="e.g. 2.5" value={logHours} onChange={(e) => setLogHours(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "الوصف" : "Description"}</Label>
                    <Input placeholder="What did you work on?" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input type="checkbox" checked={logBillable} onChange={(e) => setLogBillable(e.target.checked)} className="rounded border-border" />
                    <span>{isRTL ? "ساعات قابلة للفلترة (Billable)" : "Billable Hours"}</span>
                  </label>
                  <Button size="sm" onClick={handleLogTime} disabled={loggingTime}>
                    {loggingTime ? (isRTL ? "جاري التسجيل..." : "Logging...") : (isRTL ? "تسجيل الوقت" : "Log Time")}
                  </Button>
                </div>
              </div>

              {/* Time Logs Roster */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isRTL ? "سجل الساعات المدخلة" : "Time Log Entries"}</h4>
                {timeLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{isRTL ? "لا توجد سجلات وقت." : "No time logs recorded yet."}</p>
                ) : (
                  timeLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card text-xs">
                      <div>
                        <span className="font-bold text-foreground">{log.user_name}</span>
                        <p className="text-muted-foreground mt-0.5">{log.description || "Work log"}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-primary">{log.hours} hrs</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{log.billable ? "Billable" : "Non-billable"}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: DEPENDENCIES & BLOCKED ALERT */}
          {activeTab === "dependencies" && (
            <div className="space-y-4">
              <IssueDependencies issueId={issue.id} projectId={issue.projectId} />
            </div>
          )}

          {/* TAB 7: DISCUSSION */}
          {activeTab === "discussion" && (
            <div className="space-y-4">
              <div className="space-y-4">
                {comments.map((cm) => {
                  const author = lookups.userById[cm.authorId];
                  return (
                    <div key={cm.id} className="flex gap-2.5">
                      <UserAvatar userId={cm.authorId} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-foreground">{author?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(cm.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-foreground">{cm.body}</p>
                      </div>
                    </div>
                  );
                })}
                {comments.length === 0 && <p className="text-sm text-muted-foreground">{t("issueDetail.noComments")}</p>}
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-border">
                <UserAvatar userId={currentUserId} size="sm" />
                <div className="flex-1 space-y-2">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("issueDetail.addComment")} rows={2} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submitComment()} />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={submitComment} disabled={!comment.trim()} className="gap-1.5">
                      <Send className="h-3.5 w-3.5" /> {t("issueDetail.comment")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ACTIVITY TIMELINE WITH CATEGORY FILTERS */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {/* Category Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3 text-xs">
                <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {["all", "status", "assignment", "comment", "attachment", "checklist", "time", "dependency"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleActivityFilterChange(cat)}
                    className={cn(
                      "px-2 py-0.5 rounded-full capitalize text-[11px] transition-colors",
                      activityFilter === cat ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Read-only System Activity Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  <span>{isRTL ? "تسلسل الأحداث (Activity Timeline)" : "Filtered Activity Timeline"}</span>
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{isRTL ? "لا توجد أحداث بالفئة المحددة." : "No activities match the selected filter."}</p>
                  ) : (
                    activities.map((act) => (
                      <div key={act.id} className="p-2.5 rounded-lg border border-border bg-card text-xs flex items-start justify-between">
                        <div>
                          <span className="font-semibold text-foreground">{act.user_name}</span>
                          <p className="text-muted-foreground mt-0.5">{act.description}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{act.created_at ? formatDistanceToNow(new Date(act.created_at), { addSuffix: true }) : ""}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Field Change Audit History */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" />
                  <span>{isRTL ? "سجل تعديلات الحقول (Field Change Audit)" : "Field Audit History"}</span>
                </h4>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                      <tr>
                        <th className="p-2">{isRTL ? "الحقل" : "Field"}</th>
                        <th className="p-2">{isRTL ? "القيمة القديمة" : "Old Value"}</th>
                        <th className="p-2">{isRTL ? "القيمة الجديدة" : "New Value"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {histories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-muted-foreground">{isRTL ? "لا توجد تعديلات سابقة." : "No field history recorded."}</td>
                        </tr>
                      ) : (
                        histories.map((h) => (
                          <tr key={h.id} className="hover:bg-muted/30">
                            <td className="p-2 font-bold text-foreground uppercase">{h.field}</td>
                            <td className="p-2 text-muted-foreground">{h.old_value || "—"}</td>
                            <td className="p-2 font-semibold text-primary">{h.new_value || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <PriorityIcon priorityId={issue.priorityId} /> {lookups.priorityById[issue.priorityId]?.name}
          </span>
          <span>{t("issueDetail.updated")} {format(new Date(issue.updatedAt), "MMM d, HH:mm")}</span>
        </div>

        <ConfirmDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} title={t("issueDetail.deleteIssue")} description={t("issueDetail.deleteConfirm", { key: issue.key })} onConfirm={handleDelete} confirmLabel={isDeleting ? t("issueDetail.deleting") : t("issueDetail.deleteIssue")} />
      </SheetContent>
    </Sheet>
  );
}
