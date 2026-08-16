import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ArrowUp, ArrowDown, Settings2, Copy, Archive, Pencil } from "lucide-react";

import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/SelectEnhanced";
import { api } from "../../lib/api";

export interface WorkflowStage {
  id: number;
  project_id?: number | null;
  name: string;
  slug: string;
  category: "todo" | "in_progress" | "review" | "done" | string;
  color: string;
  position: number;
  wip_limit?: number | null;
  is_initial?: boolean;
  is_final?: boolean;
  is_active?: boolean;
  is_archived?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onStagesUpdated: () => void;
}

export function WorkflowStageManagerModal({ open, onOpenChange, projectId, onStagesUpdated }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Stage Form State
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("todo");
  const [newColor, setNewColor] = useState("#6366F1");
  const [newWip, setNewWip] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  // Copy Workflow State
  const [copyMode, setCopyMode] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [copying, setCopying] = useState(false);

  // Delete Stage State
  const [deleteTarget, setDeleteTarget] = useState<WorkflowStage | null>(null);
  const [targetMigrationStageId, setTargetMigrationStageId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const fetchStages = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.get<WorkflowStage[]>(`/projects/${projectId}/stages`);
      if (Array.isArray(data)) setStages(data);
    } catch {
      toast.error(isRTL ? "فشل تحميل مراحل العمل" : "Failed to load workflow stages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchStages();
  }, [open, projectId]);

  const handleCreateStage = async () => {
    if (!newName.trim()) {
      toast.error(isRTL ? "اسم المرحلة مطلوب" : "Stage name is required");
      return;
    }
    setSavingAdd(true);
    try {
      const payload = {
        name: newName.trim(),
        category: newCategory,
        color: newColor,
        wip_limit: newWip ? parseInt(newWip) : null,
      };
      await api.post(`/projects/${projectId}/stages`, payload);
      toast.success(isRTL ? "تم إنشاء المرحلة بنجاح" : "Workflow stage created");
      setNewName("");
      setNewWip("");
      setAddMode(false);
      fetchStages();
      onStagesUpdated();
    } catch {
      toast.error(isRTL ? "فشل إنشاء المرحلة" : "Failed to create stage");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleUpdateStage = async (stageId: number, patch: Partial<WorkflowStage>) => {
    try {
      await api.put(`/projects/${projectId}/stages/${stageId}`, patch);
      toast.success(isRTL ? "تم تحديث المرحلة" : "Stage updated");
      fetchStages();
      onStagesUpdated();
    } catch {
      toast.error(isRTL ? "فشل تحديث المرحلة" : "Failed to update stage");
    }
  };

  const beginRenameStage = (stage: WorkflowStage) => {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  };

  const cancelRenameStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const saveRenameStage = async () => {
    if (!editingStageId) return;
    if (!editingStageName.trim()) {
      toast.error(isRTL ? "اسم المرحلة مطلوب" : "Stage name is required");
      return;
    }
    await handleUpdateStage(editingStageId, { name: editingStageName.trim() });
    cancelRenameStage();
  };

  const handleDuplicateStage = async (stageId: number) => {
    try {
      await api.post(`/projects/${projectId}/stages/${stageId}/duplicate`);
      toast.success(isRTL ? "تم تكرار المرحلة بنجاح" : "Stage duplicated successfully");
      fetchStages();
      onStagesUpdated();
    } catch {
      toast.error(isRTL ? "فشل تكرار المرحلة" : "Failed to duplicate stage");
    }
  };

  const handleArchiveStage = async (stageId: number) => {
    try {
      await api.post(`/projects/${projectId}/stages/${stageId}/archive`);
      toast.success(isRTL ? "تم أرشفة المرحلة" : "Stage archived");
      fetchStages();
      onStagesUpdated();
    } catch {
      toast.error(isRTL ? "فشل أرشفة المرحلة" : "Failed to archive stage");
    }
  };

  const handleCopyWorkflow = async () => {
    if (!targetProjectId) return;
    setCopying(true);
    try {
      await api.post(`/projects/${targetProjectId}/copy-workflow-from/${projectId}`);
      toast.success(isRTL ? "تم نسخ مراحل العمل إلى المشروع المحدد" : "Workflow copied to target project successfully");
      setCopyMode(false);
    } catch {
      toast.error(isRTL ? "فشل نسخ مراحل العمل" : "Failed to copy workflow to project");
    } finally {
      setCopying(false);
    }
  };

  const handleReorder = async (startIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? startIndex - 1 : startIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const [moved] = newStages.splice(startIndex, 1);
    newStages.splice(targetIndex, 0, moved);
    setStages(newStages);

    try {
      const stage_ids = newStages.map((s) => s.id);
      await api.post(`/projects/${projectId}/stages/reorder`, { stage_ids });
      onStagesUpdated();
    } catch {
      fetchStages();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const queryStr = targetMigrationStageId ? `?target_stage_id=${targetMigrationStageId}` : "";
      await api.del(`/projects/${projectId}/stages/${deleteTarget.id}${queryStr}`);
      toast.success(isRTL ? "تم حذف المرحلة بنجاح" : "Stage deleted successfully");
      setDeleteTarget(null);
      setTargetMigrationStageId("");
      fetchStages();
      onStagesUpdated();
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? "فشل حذف المرحلة" : "Failed to delete stage"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <span>{isRTL ? "إدارة مراحل عمل المشروع (Board Stages)" : "Manage Board Workflow Stages"}</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCopyMode(true)}>
                <Copy className="h-3.5 w-3.5" />
                {isRTL ? "نسخ لمشروع" : "Copy to Project"}
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? "خصص أعمدة ومراحل لوحة المشروع، وألوانها، وأرشفتها، وتكرارها، وحد WIP."
                : "Customize project board columns, stage colors, categories, archiving, duplication, and WIP limits."}
            </p>

            {/* Stages Roster */}
            <div className="space-y-2 max-h-60 overflow-y-auto p-1">
              {loading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading stages..."}</div>
              ) : stages.map((stg, idx) => (
                <div key={stg.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="color"
                      value={stg.color || "#6366F1"}
                      onChange={(e) => handleUpdateStage(stg.id, { color: e.target.value })}
                      className="h-6 w-6 rounded border-0 cursor-pointer p-0 bg-transparent shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      {editingStageId === stg.id ? (
                        <div className="space-y-2">
                          <Input value={editingStageName} onChange={(e) => setEditingStageName(e.target.value)} className="h-8" autoFocus />
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" className="h-7 text-xs" onClick={saveRenameStage}>
                              {isRTL ? "حفظ" : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelRenameStage}>
                              {isRTL ? "إلغاء" : "Cancel"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-foreground text-sm truncate">{stg.name}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title={isRTL ? "إعادة تسمية" : "Rename Stage"} onClick={() => beginRenameStage(stg)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                            {stg.is_initial && <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold">Initial</span>}
                            {stg.is_final && <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-semibold">Final</span>}
                            <span className="text-muted-foreground font-mono">{stg.category}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="WIP"
                      value={stg.wip_limit ?? ""}
                      onChange={(e) => handleUpdateStage(stg.id, { wip_limit: e.target.value ? parseInt(e.target.value) : null })}
                      className="h-8 w-16 text-xs"
                    />

                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => handleReorder(idx, "up")}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === stages.length - 1} onClick={() => handleReorder(idx, "down")}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Duplicate Stage" onClick={() => handleDuplicateStage(stg.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-500/10" title="Archive Stage" onClick={() => handleArchiveStage(stg.id)}>
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" title="Delete Stage" onClick={() => setDeleteTarget(stg)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Copy Workflow to Project Form */}
            {copyMode && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{isRTL ? "نسخ مراحل العمل لمشروع آخر" : "Copy Workflow to Another Project"}</h4>
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "معرف المشروع المستهدف (Target Project ID)" : "Target Project ID *"}</Label>
                  <Input placeholder="Enter Target Project ID e.g. 2" value={targetProjectId} onChange={(e) => setTargetProjectId(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setCopyMode(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
                  <Button size="sm" onClick={handleCopyWorkflow} disabled={copying || !targetProjectId.trim()}>{copying ? "Copying..." : (isRTL ? "نسخ" : "Copy Workflow")}</Button>
                </div>
              </div>
            )}

            {/* Add Stage Form Toggle */}
            {!addMode ? (
              <Button size="sm" variant="outline" className="w-full gap-2 mt-2" onClick={() => setAddMode(true)}>
                <Plus className="h-4 w-4" />
                {isRTL ? "إضافة مرحلة عمل جديدة" : "Add New Stage"}
              </Button>
            ) : (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">{isRTL ? "مرحلة جديدة" : "New Stage Configuration"}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "اسم المرحلة *" : "Stage Name *"}</Label>
                    <Input placeholder="e.g. Quality Assurance" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "التصنيف *" : "Category *"}</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "اللون" : "Color"}</Label>
                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-8 w-full rounded border border-border bg-background p-1 cursor-pointer" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "حد المهام (WIP Limit)" : "WIP Limit"}</Label>
                    <Input type="number" min={1} placeholder="Optional e.g. 5" value={newWip} onChange={(e) => setNewWip(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => setAddMode(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
                  <Button size="sm" onClick={handleCreateStage} disabled={savingAdd}>{savingAdd ? "Saving..." : (isRTL ? "حفظ المرحلة" : "Create Stage")}</Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? "إغلاق" : "Close"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation with Task Migration Prompt */}
      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{isRTL ? "حذف مرحلة العمل" : "Delete Workflow Stage"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <p className="text-muted-foreground">
                {isRTL
                  ? `هل أنت أكتد من حذف مرحلة "${deleteTarget.name}"؟ حدد المرحلة البديلة لنقل المهام الحالية إليها قبل الحذف.`
                  : `Are you sure you want to delete stage "${deleteTarget.name}"? Select target stage to migrate tasks to.`}
              </p>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isRTL ? "ترحيل المهام إلى مرحلة:" : "Migrate tasks to stage:"}</Label>
                <Select value={targetMigrationStageId} onValueChange={setTargetMigrationStageId}>
                  <SelectTrigger size="sm"><SelectValue placeholder="Select target stage" /></SelectTrigger>
                  <SelectContent>
                    {stages.filter((s) => s.id !== deleteTarget.id).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? "Deleting..." : (isRTL ? "حذف ونقل المهام" : "Confirm Delete")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
