import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { api, getActiveProjectId } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Checkbox } from "../components/ui/DropdownMenu";
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

interface CustomField {
  id: number;
  project_id: number;
  name: string;
  field_type: string;
  required: boolean;
  options: string[] | null;
  sort_order: number;
  created_at: string;
}

const FIELD_TYPES: { value: string; labelKey: string }[] = [
  { value: "text", labelKey: "customFields.text" },
  { value: "number", labelKey: "customFields.number" },
  { value: "date", labelKey: "customFields.date" },
  { value: "select", labelKey: "customFields.select" },
  { value: "multiselect", labelKey: "customFields.multiselect" },
  { value: "user", labelKey: "customFields.user" },
  { value: "checkbox", labelKey: "customFields.checkbox" },
  { value: "url", labelKey: "customFields.url" },
  { value: "currency", labelKey: "customFields.currency" },
  { value: "percentage", labelKey: "customFields.percentage" },
];

const FIELD_TYPE_GUIDE: Record<string, {
  helperEn: string;
  helperAr: string;
  exampleEn: string;
  exampleAr: string;
}> = {
  text: {
    helperEn: "Short free text like a note, title, or client name.",
    helperAr: "نص قصير مثل ملاحظة أو عنوان أو اسم عميل.",
    exampleEn: "Example: Executive summary",
    exampleAr: "مثال: ملخص تنفيذي",
  },
  number: {
    helperEn: "A numeric value such as a count, estimate, or score.",
    helperAr: "قيمة رقمية مثل عدد أو تقدير أو درجة.",
    exampleEn: "Example: 12",
    exampleAr: "مثال: 12",
  },
  date: {
    helperEn: "A calendar date the team can pick and track.",
    helperAr: "تاريخ من التقويم يمكن للفريق اختياره وتتبعُه.",
    exampleEn: "Example: 27 Jul 2026",
    exampleAr: "مثال: 27 يوليو 2026",
  },
  select: {
    helperEn: "One choice from the options you define below.",
    helperAr: "اختيار واحد من الخيارات التي تضيفها بالأسفل.",
    exampleEn: "Example: Draft / Review / Approved",
    exampleAr: "مثال: مسودة / مراجعة / معتمد",
  },
  multiselect: {
    helperEn: "More than one choice can be picked.",
    helperAr: "يمكن اختيار أكثر من قيمة واحدة.",
    exampleEn: "Example: Design, Content, QA",
    exampleAr: "مثال: تصميم، محتوى، ضمان جودة",
  },
  user: {
    helperEn: "A person on the team, such as the owner or reviewer.",
    helperAr: "شخص من الفريق مثل المالك أو المراجع.",
    exampleEn: "Example: Jordan Dev",
    exampleAr: "مثال: Jordan Dev",
  },
  checkbox: {
    helperEn: "A yes / no field for simple switches or flags.",
    helperAr: "حقل نعم / لا للخيارات البسيطة.",
    exampleEn: "Example: Client approved",
    exampleAr: "مثال: العميل وافق",
  },
  url: {
    helperEn: "A link to a website, file, or reference page.",
    helperAr: "رابط لموقع أو ملف أو صفحة مرجعية.",
    exampleEn: "Example: https://example.com",
    exampleAr: "مثال: https://example.com",
  },
  currency: {
    helperEn: "A money value for a contract rate, price, or agreed amount.",
    helperAr: "قيمة مالية لسعر تعاقدي أو سعر بيع أو مبلغ متفق عليه.",
    exampleEn: "Example: 3,500 USD",
    exampleAr: "مثال: 3,500 دولار",
  },
  percentage: {
    helperEn: "A percent value such as progress or completion.",
    helperAr: "نسبة مئوية مثل التقدم أو الاكتمال.",
    exampleEn: "Example: 80%",
    exampleAr: "مثال: 80%",
  },
};

const getFieldTypeGuide = (type: string) => FIELD_TYPE_GUIDE[type] ?? FIELD_TYPE_GUIDE.text;

function CustomFieldsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const activeProjectId = getActiveProjectId();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomField | null>(null);
  const [newOption, setNewOption] = useState("");

  const [draft, setDraft] = useState<{
    id: number | null;
    name: string;
    field_type: string;
    required: boolean;
    options: string[];
  }>({
    id: null,
    name: "",
    field_type: "text",
    required: false,
    options: [],
  });

  const isEditing = draft.id !== null;
  const isSelectType = draft.field_type === "select" || draft.field_type === "multiselect";
  const typeGuide = getFieldTypeGuide(draft.field_type);

  const fetchFields = async () => {
    if (!activeProjectId) {
      setFields([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<CustomField[]>(`/projects/${activeProjectId}/custom-fields`);
      setFields(Array.isArray(res) ? res : []);
    } catch {
      toast.error(t("customFields.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [activeProjectId]);

  const openCreate = () => {
    setDraft({ id: null, name: "", field_type: "text", required: false, options: [] });
    setDialogOpen(true);
  };

  const openEdit = (field: CustomField) => {
    setDraft({
      id: field.id,
      name: field.name,
      field_type: field.field_type,
      required: field.required,
      options: field.options ?? [],
    });
    setDialogOpen(true);
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    setDraft((d) => ({ ...d, options: [...d.options, newOption.trim()] }));
    setNewOption("");
  };

  const removeOption = (idx: number) => {
    setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error(t("customFields.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: draft.name.trim(),
        field_type: draft.field_type,
        required: draft.required,
        options: isSelectType ? draft.options : null,
        sort_order: fields.length,
      };

      if (isEditing) {
        await api.put(`/custom-fields/${draft.id}`, payload);
        setFields((prev) =>
          prev.map((f) => (f.id === draft.id ? { ...f, ...payload } : f))
        );
        toast.success(t("customFields.updated"));
      } else {
        if (!activeProjectId) {
          toast.error(t("customFields.selectProjectFirst"));
          return;
        }
        const res: any = await api.post(`/projects/${activeProjectId}/custom-fields`, payload);
        setFields((prev) => [...prev, { ...payload, id: res?.id ?? Date.now(), created_at: new Date().toISOString() }]);
        toast.success(t("customFields.created"));
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("customFields.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (field: CustomField) => {
    const prev = fields;
    setFields((cur) => cur.filter((f) => f.id !== field.id));
    try {
      await api.del(`/custom-fields/${field.id}`);
      toast.success(t("customFields.deleted"));
    } catch (e: any) {
      setFields(prev);
      toast.error(e?.message || t("customFields.deleteFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-xl">
        <PageHeader
          title={t("customFields.title")}
          subtitle={t("customFields.fieldsDefinedCount", { count: fields.length, label: t("customFields.fieldsDefined") })}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("customFields.addField")}
            </Button>
          }
        />

        <div className="mb-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("customFields.title")} {isRTL ? "يضيف حقولاً واضحة للفريق" : "keeps extra data easy to fill in"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRTL
                ? "اعرض فقط الحقول التي يحتاجها المستخدمون عند العمل على المشروع."
                : "Only add the fields people will actually need while working on the project."}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{isRTL ? "اختَر النوع حسب القيمة" : "Choose the type by the value"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRTL ? typeGuide.helperAr : typeGuide.helperEn}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{isRTL ? "مثال سريع" : "Quick example"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRTL ? typeGuide.exampleAr : typeGuide.exampleEn}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">{t("customFields.name")}</th>
                <th className="px-3 py-2.5 font-medium">{t("customFields.type")}</th>
                <th className="px-3 py-2.5 font-medium">{t("customFields.required")}</th>
                <th className="px-3 py-2.5 font-medium">{t("customFields.options")}</th>
                <th className="px-3 py-2.5 font-medium text-right">{t("customFields.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("customFields.loading")}
                  </td>
                </tr>
              ) : fields.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      {activeProjectId ? t("customFields.noFields") : t("customFields.selectProjectHint")}
                    </p>
                  </td>
                </tr>
              ) : (
                fields.map((field) => (
                  <tr key={field.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        <span className="font-medium text-foreground">{field.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">
                        {t(`customFields.${field.field_type}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      {field.required ? (
                        <Badge variant="default">{t("customFields.required")}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {field.options?.length
                        ? field.options.join(", ")
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEdit(field)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("app.delete")}
                          className="text-destructive"
                          onClick={() => setConfirmDelete(field)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("customFields.editField") : t("customFields.addField")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("customFields.name")}</Label>
              <Input
                value={draft.name}
                autoFocus
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("customFields.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("customFields.type")}</Label>
              <Select value={draft.field_type} onValueChange={(v) => setDraft({ ...draft, field_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {t(ft.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isRTL ? "معاينة" : "Preview"}
              </p>
              <div className="mt-2 rounded-md border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{isRTL ? "ما سيراه المستخدم" : "What users will see"}</p>
                    <p className="font-medium text-foreground">
                      {draft.name.trim() || (isRTL ? "اسم الحقل" : "Field name")}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {t(FIELD_TYPES.find((ft) => ft.value === draft.field_type)?.labelKey ?? "customFields.text")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isRTL ? typeGuide.helperAr : typeGuide.helperEn}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isRTL ? typeGuide.exampleAr : typeGuide.exampleEn}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                    {draft.required ? (isRTL ? "مطلوب" : "Required") : (isRTL ? "اختياري" : "Optional")}
                  </span>
                  <span>{isSelectType ? (isRTL ? "أضف خيارات قبل الحفظ" : "Add options before saving") : (isRTL ? "تقبل قيمة واحدة" : "Accepts one value")}</span>
                </div>
                {isSelectType && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {draft.options.length ? draft.options.map((opt) => (
                      <span key={opt} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                        {opt}
                      </span>
                    )) : (
                      <span className="text-xs text-muted-foreground">
                        {isRTL ? "لا توجد خيارات بعد" : "No options added yet"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={draft.required}
                onCheckedChange={(checked) => setDraft({ ...draft, required: !!checked })}
              />
              <Label htmlFor="field-required" className="cursor-pointer">
                {t("customFields.required")}
              </Label>
            </div>
            {isSelectType && (
              <div className="space-y-2">
                <Label>{t("customFields.options")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {draft.options.map((opt, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                    >
                      {opt}
                      <button onClick={() => removeOption(idx)} className="ml-0.5 hover:text-destructive">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder={t("customFields.addOption")}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                  />
                  <Button variant="outline" size="sm" onClick={addOption} type="button">
                    {t("customFields.add")}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("app.cancel")}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t("app.saving") : isEditing ? t("app.saveChanges") : t("customFields.addField")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={t("customFields.deleteField")}
        description={t("customFields.deleteConfirm", { name: confirmDelete?.name ?? "" })}
        onConfirm={() => { if (confirmDelete) remove(confirmDelete); }}
        confirmLabel={t("app.delete")}
      />
    </div>
  );
}

export default CustomFieldsPage;
