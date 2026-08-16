import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Workflow as WorkflowIcon, PlayCircle } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/SelectEnhanced";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { toast } from "sonner";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

// Spatie roles seeded in database/seeders/RolePermissionSeeder.php.
// ponytail: hardcoded list, no /roles API exists yet — swap for a fetch if
// roles become dynamic/tenant-editable.
const ROLE_OPTIONS = [
  "super-admin", "admin", "project-manager", "team-leader", "developer",
  "member", "viewer", "account-manager", "department-manager", "hr-manager",
  "reviewer", "executive",
];

interface WorkflowStep {
  id: number;
  workflow_template_id: number;
  name: string;
  position: number;
  required_fields: string[] | null;
  approver_role: string | null;
  is_final: boolean;
}

interface WorkflowTemplate {
  id: number;
  name: string;
  description: string | null;
  project_id: number | null;
  is_active: boolean;
  steps: WorkflowStep[];
}

function WorkflowTemplatesPage() {
  const { t } = useTranslation();
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const project = activeProject;

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<{ id: number | null; name: string; description: string }>(
    { id: null, name: "", description: "" }
  );
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<WorkflowTemplate | null>(null);

  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [stepDraft, setStepDraft] = useState<{
    id: number | null;
    name: string;
    approver_role: string;
    is_final: boolean;
    required_fields: string[];
  }>({ id: null, name: "", approver_role: "", is_final: false, required_fields: [] });
  const [newField, setNewField] = useState("");
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<WorkflowStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get<WorkflowTemplate[]>("/workflow-templates");
      const list = Array.isArray(res) ? res : [];
      setTemplates(list);
      if (selectedId === null && list.length) setSelectedId(list[0].id);
    } catch {
      toast.error(t("workflowTemplates.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Template CRUD ──
  const openCreateTemplate = () => {
    setTemplateDraft({ id: null, name: "", description: "" });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (tpl: WorkflowTemplate) => {
    setTemplateDraft({ id: tpl.id, name: tpl.name, description: tpl.description ?? "" });
    setTemplateDialogOpen(true);
  };

  const saveTemplate = async () => {
    if (!templateDraft.name.trim()) {
      toast.error(t("workflowTemplates.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = { name: templateDraft.name.trim(), description: templateDraft.description.trim() || null };
      if (templateDraft.id !== null) {
        const res = await api.put<WorkflowTemplate>(`/workflow-templates/${templateDraft.id}`, payload);
        setTemplates((prev) => prev.map((t) => (t.id === templateDraft.id ? { ...t, ...(res as any) } : t)));
        toast.success(t("workflowTemplates.templateUpdated"));
      } else {
        const res = await api.post<WorkflowTemplate>("/workflow-templates", payload);
        if (res) {
          setTemplates((prev) => [...prev, res]);
          setSelectedId(res.id);
        }
        toast.success(t("workflowTemplates.templateCreated"));
      }
      setTemplateDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("workflowTemplates.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (tpl: WorkflowTemplate) => {
    const prev = templates;
    setTemplates((cur) => cur.filter((t) => t.id !== tpl.id));
    if (selectedId === tpl.id) setSelectedId(null);
    try {
      await api.del(`/workflow-templates/${tpl.id}`);
      toast.success(t("workflowTemplates.templateDeleted"));
    } catch (e: any) {
      setTemplates(prev);
      toast.error(e?.message || t("workflowTemplates.deleteError"));
    }
  };

  // ── Step CRUD ──
  const openCreateStep = () => {
    setStepDraft({ id: null, name: "", approver_role: "", is_final: false, required_fields: [] });
    setNewField("");
    setStepDialogOpen(true);
  };

  const openEditStep = (step: WorkflowStep) => {
    setStepDraft({
      id: step.id,
      name: step.name,
      approver_role: step.approver_role ?? "",
      is_final: step.is_final,
      required_fields: step.required_fields ?? [],
    });
    setNewField("");
    setStepDialogOpen(true);
  };

  const addField = () => {
    if (!newField.trim()) return;
    setStepDraft((d) => ({ ...d, required_fields: [...d.required_fields, newField.trim()] }));
    setNewField("");
  };

  const removeField = (idx: number) => {
    setStepDraft((d) => ({ ...d, required_fields: d.required_fields.filter((_, i) => i !== idx) }));
  };

  const saveStep = async () => {
    if (!selected) return;
    if (!stepDraft.name.trim()) {
      toast.error(t("workflowTemplates.stepNameRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: stepDraft.name.trim(),
        approver_role: stepDraft.approver_role || null,
        is_final: stepDraft.is_final,
        required_fields: stepDraft.required_fields,
      };
      if (stepDraft.id !== null) {
        const res = await api.put<WorkflowStep>(`/workflow-templates/${selected.id}/steps/${stepDraft.id}`, payload);
        setTemplates((prev) => prev.map((tpl) => tpl.id !== selected.id ? tpl : {
          ...tpl, steps: tpl.steps.map((s) => (s.id === stepDraft.id ? { ...s, ...(res as any) } : s)),
        }));
      } else {
        const res = await api.post<WorkflowStep>(`/workflow-templates/${selected.id}/steps`, payload);
        if (res) {
          setTemplates((prev) => prev.map((tpl) => tpl.id !== selected.id ? tpl : { ...tpl, steps: [...tpl.steps, res] }));
        }
      }
      toast.success(t("workflowTemplates.stepSaved"));
      setStepDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("workflowTemplates.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeStep = async (step: WorkflowStep) => {
    if (!selected) return;
    const prev = templates;
    setTemplates((cur) => cur.map((tpl) => tpl.id !== selected.id ? tpl : { ...tpl, steps: tpl.steps.filter((s) => s.id !== step.id) }));
    try {
      await api.del(`/workflow-templates/${selected.id}/steps/${step.id}`);
      toast.success(t("workflowTemplates.stepDeleted"));
    } catch (e: any) {
      setTemplates(prev);
      toast.error(e?.message || t("workflowTemplates.deleteError"));
    }
  };

  const moveStep = async (step: WorkflowStep, direction: -1 | 1) => {
    if (!selected) return;
    const ordered = [...selected.steps].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === step.id);
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[idx], ordered[swapWith]] = [ordered[swapWith], ordered[idx]];
    const order = ordered.map((s) => s.id);

    const prev = templates;
    setTemplates((cur) => cur.map((tpl) => tpl.id !== selected.id ? tpl : {
      ...tpl, steps: ordered.map((s, i) => ({ ...s, position: i + 1 })),
    }));
    try {
      await api.post(`/workflow-templates/${selected.id}/steps/reorder`, { order });
    } catch (e: any) {
      setTemplates(prev);
      toast.error(e?.message || t("workflowTemplates.reorderError"));
    }
  };

  const applyToProject = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      await api.post(`/workflow-templates/${selected.id}/apply/${project?.id ?? ""}`);
      toast.success(t("workflowTemplates.applied", { project: project?.name ?? "" }));
    } catch (e: any) {
      toast.error(e?.message || t("workflowTemplates.applyError"));
    } finally {
      setApplying(false);
    }
  };

  const sortedSteps = selected ? [...selected.steps].sort((a, b) => a.position - b.position) : [];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-xl">
        <PageHeader
          title={t("workflowTemplates.title")}
          subtitle={t("workflowTemplates.subtitle")}
          icon={<WorkflowIcon className="h-5 w-5" />}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openCreateTemplate}>
              <Plus className="h-4 w-4" /> {t("workflowTemplates.addTemplate")}
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Template list */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">{t("workflowTemplates.loading")}</p>
            ) : templates.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t("workflowTemplates.noTemplates")}</p>
            ) : (
              <ul>
                {templates.map((tpl) => (
                  <li key={tpl.id}>
                    <button
                      onClick={() => setSelectedId(tpl.id)}
                      className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent/40 ${
                        selectedId === tpl.id ? "bg-accent/60 font-medium" : ""
                      }`}
                    >
                      <span className="truncate">{tpl.name}</span>
                      <Badge variant="outline" className="shrink-0">{tpl.steps?.length ?? 0}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Steps editor */}
          <div className="rounded-xl border border-border bg-card p-4">
            {!selected ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("workflowTemplates.selectTemplate")}</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{selected.name}</h2>
                    {selected.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEditTemplate(selected)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setConfirmDeleteTemplate(selected)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={applying || sortedSteps.length === 0}
                      onClick={applyToProject}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      {t("workflowTemplates.applyToProject")}
                    </Button>
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">{t("workflowTemplates.steps")}</h3>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={openCreateStep}>
                    <Plus className="h-3.5 w-3.5" /> {t("workflowTemplates.addStep")}
                  </Button>
                </div>

                {sortedSteps.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("workflowTemplates.noSteps")}
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {sortedSteps.map((step, idx) => (
                      <li
                        key={step.id}
                        className="flex items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-col">
                          <button
                            disabled={idx === 0}
                            onClick={() => moveStep(step, -1)}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            disabled={idx === sortedSteps.length - 1}
                            onClick={() => moveStep(step, 1)}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{idx + 1}. {step.name}</span>
                            {step.is_final && <Badge variant="default">{t("workflowTemplates.final")}</Badge>}
                            {step.approver_role && (
                              <Badge variant="outline">{t("workflowTemplates.approver")}: {step.approver_role}</Badge>
                            )}
                          </div>
                          {step.required_fields && step.required_fields.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {step.required_fields.map((f) => (
                                <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditStep(step)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            onClick={() => setConfirmDeleteStep(step)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Template dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {templateDraft.id !== null ? t("workflowTemplates.editTemplate") : t("workflowTemplates.addTemplate")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("workflowTemplates.name")}</Label>
              <Input
                value={templateDraft.name}
                autoFocus
                onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                placeholder={t("workflowTemplates.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("workflowTemplates.description")}</Label>
              <Textarea
                value={templateDraft.description}
                onChange={(e) => setTemplateDraft({ ...templateDraft, description: e.target.value })}
                placeholder={t("workflowTemplates.descriptionPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? t("app.saving") : templateDraft.id !== null ? t("app.saveChanges") : t("workflowTemplates.addTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {stepDraft.id !== null ? t("workflowTemplates.editStep") : t("workflowTemplates.addStep")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("workflowTemplates.stepName")}</Label>
              <Input
                value={stepDraft.name}
                autoFocus
                onChange={(e) => setStepDraft({ ...stepDraft, name: e.target.value })}
                placeholder={t("workflowTemplates.stepNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("workflowTemplates.approverRole")}</Label>
              <Select
                value={stepDraft.approver_role || "__none__"}
                onValueChange={(v) => setStepDraft({ ...stepDraft, approver_role: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("workflowTemplates.noApprover")}</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("workflowTemplates.requiredFields")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {stepDraft.required_fields.map((f, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                  >
                    {f}
                    <button onClick={() => removeField(idx)} className="ml-0.5 hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newField}
                  onChange={(e) => setNewField(e.target.value)}
                  placeholder={t("workflowTemplates.addField")}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField())}
                />
                <Button variant="outline" size="sm" type="button" onClick={addField}>
                  {t("customFields.add")}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="step-final"
                type="checkbox"
                checked={stepDraft.is_final}
                onChange={(e) => setStepDraft({ ...stepDraft, is_final: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="step-final" className="cursor-pointer">{t("workflowTemplates.isFinal")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveStep} disabled={saving}>
              {saving ? t("app.saving") : stepDraft.id !== null ? t("app.saveChanges") : t("workflowTemplates.addStep")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteTemplate !== null}
        onOpenChange={(o) => { if (!o) setConfirmDeleteTemplate(null); }}
        title={t("workflowTemplates.deleteTemplate")}
        description={t("workflowTemplates.deleteTemplateConfirm", { name: confirmDeleteTemplate?.name ?? "" })}
        onConfirm={() => { if (confirmDeleteTemplate) removeTemplate(confirmDeleteTemplate); }}
        confirmLabel={t("app.delete")}
      />

      <ConfirmDialog
        open={confirmDeleteStep !== null}
        onOpenChange={(o) => { if (!o) setConfirmDeleteStep(null); }}
        title={t("workflowTemplates.deleteStep")}
        description={t("workflowTemplates.deleteStepConfirm", { name: confirmDeleteStep?.name ?? "" })}
        onConfirm={() => { if (confirmDeleteStep) removeStep(confirmDeleteStep); }}
        confirmLabel={t("app.delete")}
      />
    </div>
  );
}

export default WorkflowTemplatesPage;
