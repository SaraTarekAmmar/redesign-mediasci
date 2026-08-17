import React, { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Risk } from "../data/opsTypes";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Label } from "../components/ui/Label";
import { DatePicker } from "../components/ui/DatePicker";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"../components/ui/Dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem } from
"../components/ui/Select";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const CATEGORIES: Risk["category"][] = ["technical", "financial", "resource", "schedule", "external"];
const STATUSES: Risk["status"][] = ["identified", "analyzing", "mitigating", "closed"];

const scoreColor = (s: number) => s >= 15 ? "#dc2626" : s >= 8 ? "#f97316" : s >= 4 ? "#f59e0b" : "#22c55e";

const blank = (): Risk => ({
  id: "", title: "", description: "", category: "technical",
  probability: 3, impact: 3, status: "identified", owner: "", responsePlan: "", dueDate: undefined
});

function RisksPage() {
  const { t } = useTranslation();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Risk>(blank());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Risk | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Risk[]>("/ops/risks");
        if (!cancelled) setRisks(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || t("risks.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isEditing = draft.id !== "";

  const openCreate = () => {setDraft(blank());setDialogOpen(true);};
  const openEdit = (r: Risk) => {setDraft({ ...r });setDialogOpen(true);};

  const payload = (r: Risk) => ({
    title: r.title.trim(),
    description: r.description || null,
    category: r.category,
    probability: r.probability,
    impact: r.impact,
    status: r.status,
    owner: r.owner || null,
    responsePlan: r.responsePlan || null,
    dueDate: r.dueDate || null
  });

  const save = async () => {
    if (!draft.title.trim()) {toast.error(t("risks.giveTitle"));return;}
    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/ops/risks/${draft.id}`, payload(draft));
        setRisks((prev) => prev.map((r) => r.id === draft.id ? { ...draft } : r));
        toast.success(t("risks.updated"));
      } else {
        const res: any = await api.post(`/ops/risks`, payload(draft));
        setRisks((prev) => [...prev, { ...draft, id: String(res?.id ?? Date.now()) }]);
        toast.success(t("risks.logged"));
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("risks.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Risk) => {
    const prev = risks;
    setRisks((cur) => cur.filter((x) => x.id !== r.id));
    try {
      await api.del(`/ops/risks/${r.id}`);
      toast.success(t("risks.deleted"));
    } catch (e: any) {
      setRisks(prev);
      toast.error(e?.message || t("risks.deleteError"));
    }
  };

  const cell = useMemo(() => {
    const map: Record<string, Risk[]> = {};
    risks.forEach((r) => {(map[`${r.impact}-${r.probability}`] ??= []).push(r);});
    return map;
  }, [risks]);

  const open = risks.filter((r) => r.status !== "closed");
  const criticalOpen = open.filter((r) => r.probability * r.impact >= 15).length;
  const ownedOpen = open.filter((r) => Boolean(r.owner)).length;
  const plannedOpen = open.filter((r) => Boolean(r.responsePlan)).length;

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("risks.title")}
          subtitle={loading ? t("recovery.loading") : t("risks.openCount", { open: open.length, plural: open.length !== 1 ? "s" : "", total: risks.length })}
          actions={<Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" /> {t("risks.logRisk")}</Button>} />

        <div className="mb-5 rounded-xl border border-border bg-card p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-foreground">Risk pulse</p><p className="text-xs text-muted-foreground">Keep risk visible, owned, and paired with a response plan before it becomes a delivery issue.</p></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4"><div className="rounded-lg border border-border/70 bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">Open risks</p><p className="mt-1 text-xl font-semibold text-foreground">{open.length}</p></div><div className="rounded-lg border border-border/70 bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">Critical / high</p><p className="mt-1 text-xl font-semibold text-rose-600 dark:text-rose-400">{criticalOpen}</p></div><div className="rounded-lg border border-border/70 bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">With an owner</p><p className="mt-1 text-xl font-semibold text-foreground">{ownedOpen}</p></div><div className="rounded-lg border border-border/70 bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">With response plan</p><p className="mt-1 text-xl font-semibold text-primary">{plannedOpen}</p></div></div></div>

        {loading && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><div className="skeleton h-4 w-48" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-20" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-6 w-8 rounded" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-24" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-7 w-16 ms-auto rounded-lg" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t("risks.colRisk")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("risks.colCategory")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("risks.colScore")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("risks.colOwner")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("risks.colStatus")}</th>
                    <th className="px-3 py-2.5 font-medium text-right">{t("risks.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => {
                    const score = r.probability * r.impact;
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{r.title}</p>
                          {r.responsePlan &&
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.responsePlan}</p>}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{t(`risks.category.${r.category}`)}</td>
                        <td className="px-3 py-3">
                          {(() => {
                            const sev = score >= 15 ? { label: t("risks.severityCritical"), cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-800" }
                              : score >= 8 ? { label: t("risks.severityHigh"),     cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-200" }
                              : score >= 4 ? { label: t("risks.severityMedium"),   cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200" }
                              :               { label: t("risks.severityLow"),      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-200" };
                            return (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${sev.cls}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {score} · {sev.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{r.owner}</td>
                        <td className="px-3 py-3">
                          <Badge variant={r.status === "closed" ? "secondary" : "outline"}>{t(`risks.status.${r.status}`)}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={() => setConfirmDelete(r)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>);
                  })}
                  {risks.length === 0 &&
                  <tr><td colSpan={6} className="px-4 py-16 text-center">
                    <div className="animate-fade-in flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <svg viewBox="0 0 48 48" className="h-7 w-7 text-muted-foreground/50" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M24 8v8M24 32v8M8 24h8M32 24h8" strokeLinecap="round"/>
                          <circle cx="24" cy="24" r="8"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{t("risks.noRisks", { defaultValue: "No risks logged" })}</p>
                      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{t("risks.emptyHint")}</p>
                    </div>
                  </td></tr>}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 text-sm font-semibold text-foreground">{t("risks.riskMatrix")}</h2>
              <p className="mb-3 text-xs text-muted-foreground">{t("risks.matrixDesc")}</p>
              <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1">
                <div />
                {[1, 2, 3, 4, 5].map((p) => <div key={p} className="text-center text-[10px] text-muted-foreground">{p}</div>)}
                {[5, 4, 3, 2, 1].map((impact) =>
                <React.Fragment key={impact}>
                    <div className="flex items-center text-[10px] text-muted-foreground">{impact}</div>
                    {[1, 2, 3, 4, 5].map((p) => {
                    const items = cell[`${impact}-${p}`] ?? [];
                    const score = impact * p;
                    return (
                      <div key={p}
                        className={cn("flex aspect-square items-center justify-center rounded text-xs font-semibold text-white")}
                        style={{ backgroundColor: `${scoreColor(score)}${items.length ? "" : "40"}` }}
                        title={items.map((i) => i.title).join("\n")}>
                          {items.length || ""}
                        </div>);
                  })}
                  </React.Fragment>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("risks.editRisk") : t("risks.logRiskDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="risk-title">{t("risks.titleField")}</Label>
              <Input id="risk-title" value={draft.title} autoFocus
                onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t("risks.titlePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risk-desc">{t("risks.responsePlan")}</Label>
              <Textarea id="risk-desc" rows={2} value={draft.responsePlan ?? ""}
                onChange={(e) => setDraft({ ...draft, responsePlan: e.target.value })} placeholder={t("risks.responsePlanPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("risks.categoryField")}</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as Risk["category"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`risks.category.${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("risks.statusField")}</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Risk["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`risks.status.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("risks.probability")}</Label>
                <Select value={String(draft.probability)} onValueChange={(v) => setDraft({ ...draft, probability: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("risks.impact")}</Label>
                <Select value={String(draft.impact)} onValueChange={(v) => setDraft({ ...draft, impact: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-owner">{t("risks.ownerField")}</Label>
                <Input id="risk-owner" value={draft.owner}
                  onChange={(e) => setDraft({ ...draft, owner: e.target.value })} placeholder={t("risks.ownerPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-due">{t("risks.dueDate")}</Label>
                <DatePicker id="risk-due" value={draft.dueDate ?? ""}
                  onChange={(date) => setDraft({ ...draft, dueDate: date })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={save} disabled={saving}>{isEditing ? t("app.saveChanges") : t("risks.logRiskDialog")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={t("risks.deleteRisk")}
        description={t("risks.deleteConfirm", { name: confirmDelete?.title ?? "" })}
        onConfirm={() => { if (confirmDelete) remove(confirmDelete); }}
        confirmLabel={t("app.delete")}
      />
    </div>);
}

export default RisksPage;
