

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Mail, Pencil, Trash2, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import type { InfluenceLevel, Stakeholder } from "../data/opsTypes";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import { fallbackStakeholders } from "../data/stakeholderFallbacks";

const levelValue: Record<InfluenceLevel, number> = { High: 2, Medium: 1, Low: 0 };
const LEVELS: InfluenceLevel[] = ["High", "Medium", "Low"];

const QUADRANTS: { key: string; influence: number; interest: number; }[] = [
  { key: "manage", influence: 1, interest: 1 },
  { key: "satisfy", influence: 1, interest: 0 },
  { key: "inform", influence: 0, interest: 1 },
  { key: "monitor", influence: 0, interest: 0 }
];

function levelOf(value: string | undefined): number {
  const key = LEVELS.find((l) => l.toLowerCase() === String(value ?? "").toLowerCase());
  return key ? levelValue[key] : 0;
}

function quadrantFor(s: Stakeholder) {
  const inf = levelOf(s.influence) >= 2 ? 1 : 0;
  const int = levelOf(s.interest) >= 2 ? 1 : 0;
  return `${inf}-${int}`;
}

const blank = (): Stakeholder => ({
  id: "",
  name: "",
  email: "",
  organization: "",
  role: "",
  influence: "Medium",
  interest: "Medium",
  communicationPreference: "Email",
  status: "Active"
});

function StakeholdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Stakeholder>(blank());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Stakeholder | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<Stakeholder[]>("/ops/stakeholders");
        if (!cancelled) setStakeholders(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) {
          setStakeholders(Array.isArray(fallbackStakeholders) ? fallbackStakeholders : []);
          if (!Array.isArray(fallbackStakeholders) || fallbackStakeholders.length === 0) {
            setError(e?.message || t("stakeholders.loadFailed"));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isEditing = draft.id !== "";

  const openCreate = () => { setDraft(blank()); setDialogOpen(true); };
  const openEdit = (s: Stakeholder) => { setDraft({ ...s }); setDialogOpen(true); };

  const payload = (s: Stakeholder) => ({
    name: s.name.trim(),
    email: s.email ? s.email.trim() : null,
    organization: s.organization ? s.organization.trim() : null,
    role: s.role ? s.role.trim() : null,
    influence: s.influence,
    interest: s.interest,
    communicationPreference: s.communicationPreference ? s.communicationPreference.trim() : null,
    status: s.status
  });

  const save = async () => {
    if (!draft.name.trim()) { toast.error(t("stakeholders.nameRequired")); return; }
    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/ops/stakeholders/${draft.id}`, payload(draft));
        setStakeholders((prev) => prev.map((s) => s.id === draft.id ? { ...draft } : s));
        toast.success(t("stakeholders.updated"));
      } else {
        const res: any = await api.post(`/ops/stakeholders`, payload(draft));
        setStakeholders((prev) => [...prev, { ...draft, id: String(res?.id ?? Date.now()) }]);
        toast.success(t("stakeholders.created"));
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("stakeholders.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Stakeholder) => {
    const prev = stakeholders;
    setStakeholders((cur) => cur.filter((x) => x.id !== s.id));
    try {
      await api.del(`/ops/stakeholders/${s.id}`);
      toast.success(t("stakeholders.deleted"));
    } catch (e: any) {
      setStakeholders(prev);
      toast.error(e?.message || t("stakeholders.deleteError"));
    }
  };

  const activeCount = stakeholders.filter((s) => s.status === "Active").length;

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("stakeholders.title")}
          subtitle={loading ? t("recovery.loading") : t("stakeholders.subtitle", { count: stakeholders.length, active: activeCount })}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("stakeholders.addStakeholder")}
            </Button>
          }
        />

        {loading && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><div className="skeleton h-4 w-40" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-28" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-24" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-20" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
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
          <>
            <div className="mb-4 rounded-xl border border-border bg-card p-5">
              <h2 className="mb-1 text-sm font-semibold text-foreground">{t("stakeholders.powerInterestGrid")}</h2>
              <p className="mb-4 text-xs text-muted-foreground">{t("stakeholders.gridHint")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {QUADRANTS.map((q) => {
                  const items = stakeholders.filter((s) => quadrantFor(s) === `${q.influence}-${q.interest}`);
                  return (
                    <div key={q.key} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-foreground">{t(`stakeholders.quadrant.${q.key}Title`)}</p>
                   <p className="mb-2 text-[11px] text-muted-foreground">{t(`stakeholders.quadrant.${q.key}Hint`)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((s) => (
                          <span key={s.id} className="rounded-full bg-card px-2 py-1 text-xs text-foreground ring-1 ring-border">
                            {s.name}
                          </span>
                        ))}
                        {items.length === 0 && <span className="text-xs text-muted-foreground/60">-</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t("stakeholders.colName")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stakeholders.colOrganization")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stakeholders.colRole")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stakeholders.colInfluence")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stakeholders.colInterest")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stakeholders.colChannel")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stakeholders.colStatus")}</th>
                    <th className="px-3 py-2.5 font-medium text-right">{t("stakeholders.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stakeholders.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{s.name}</p>
                        {s.email && (
                          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {s.email}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{s.organization || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{s.role || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{s.influence}</td>
                      <td className="px-3 py-3 text-muted-foreground">{s.interest}</td>
                      <td className="px-3 py-3 text-muted-foreground">{s.communicationPreference || "-"}</td>
                      <td className="px-3 py-3">
                        <Badge variant={s.status === "Active" ? "default" : "secondary"}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={t("app.view")} onClick={() => navigate(`/stakeholders/${s.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={() => setConfirmDelete(s)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stakeholders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("stakeholders.noStakeholders")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("stakeholders.editStakeholder") : t("stakeholders.addStakeholderDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="st-name">{t("stakeholders.fullName")}</Label>
                <Input
                  id="st-name"
                  value={draft.name}
                  autoFocus
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t("stakeholders.fullNamePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-email">{t("stakeholders.emailField")}</Label>
                <Input
                  id="st-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder={t("stakeholders.emailPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-org">{t("stakeholders.organizationField")}</Label>
                <Input
                  id="st-org"
                  value={draft.organization}
                  onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
                  placeholder={t("stakeholders.organizationPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-role">{t("stakeholders.roleField")}</Label>
                <Input
                  id="st-role"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  placeholder={t("stakeholders.rolePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-comm">{t("stakeholders.preferredChannel")}</Label>
                <Input
                  id="st-comm"
                  value={draft.communicationPreference}
                  onChange={(e) => setDraft({ ...draft, communicationPreference: e.target.value })}
                  placeholder={t("stakeholders.channelPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("stakeholders.influenceField")}</Label>
                <Select value={draft.influence} onValueChange={(v) => setDraft({ ...draft, influence: v as InfluenceLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("stakeholders.interestField")}</Label>
                <Select value={draft.interest} onValueChange={(v) => setDraft({ ...draft, interest: v as InfluenceLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t("stakeholders.statusField")}</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as "Active" | "Inactive" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t("stakeholders.status.active")}</SelectItem>
                    <SelectItem value="Inactive">{t("stakeholders.status.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={save} disabled={saving}>{isEditing ? t("app.saveChanges") : t("stakeholders.addStakeholderDialog")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={t("stakeholders.deleteStakeholder")}
        description={t("stakeholders.deleteConfirm", { name: confirmDelete?.name ?? "" })}
        onConfirm={() => { if (confirmDelete) remove(confirmDelete); }}
        confirmLabel={t("app.delete")}
      />
    </div>
  );
}


export default StakeholdersPage;
