


import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CloudCog, KeyRound, Receipt, Plus, Pencil, Trash2, TrendingUp, Users, DollarSign, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Expense, CloudService, SoftwareLicense } from "../data/opsTypes";
import { PageHeader } from "../components/common/PageHeader";
import { StatTile } from "../components/common/StatTile";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { DatePicker } from "../components/ui/DatePicker";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "../components/ui/Tabs";
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
import { useBudget } from "../hooks/useBudget";
import { getActiveProjectId } from "../lib/api";

const money = (n: number) => `$${n.toLocaleString()}`;

const expenseCategories = [
  { name: "Development", color: "var(--primary)" },
  { name: "Design", color: "#ec4899" },
  { name: "Hosting", color: "#6b7280" },
  { name: "Cloud Services", color: "#0f766e" },
  { name: "Licenses", color: "#f59e0b" },
  { name: "Marketing", color: "#f97316" },
];

const blankExpense = (): Expense => ({
  id: "",
  title: "",
  category: "General",
  amount: 0,
  currency: "USD",
  date: new Date().toISOString().slice(0, 10),
  paymentType: "Credit Card"
});

const blankCloud = (): CloudService => ({
  id: "",
  serviceName: "",
  provider: "",
  planType: "Standard",
  monthlyCost: 0,
  renewalDate: new Date().toISOString().slice(0, 10),
  autoRenewal: true,
  status: "active"
});

const blankLicense = (): SoftwareLicense => ({
  id: "",
  softwareName: "",
  licenseType: "SaaS",
  seats: 10,
  monthlyCost: 0,
  renewalDate: new Date().toISOString().slice(0, 10),
  department: "Engineering"
});

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function BudgetPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "cloud" | "licenses">("overview");
  const projectId = getActiveProjectId();
  const projectBudgetBase = projectId ? `/projects/${projectId}` : null;
  const { summary, costByMember, costByProject, saveBudget, updateBudget } = useBudget(projectId ?? undefined);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cloudServices, setCloudServices] = useState<CloudService[]>([]);
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Budget setup state
  const [budgetDraft, setBudgetDraft] = useState({ total_budget: summary?.total_budget ?? 0, hourly_rate: summary?.hourly_rate ?? 50 });
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Dialog states
  const [expOpen, setExpOpen] = useState(false);
  const [expDraft, setExpDraft] = useState<Expense>(blankExpense());

  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudDraft, setCloudDraft] = useState<CloudService>(blankCloud());

  const [licOpen, setLicOpen] = useState(false);
  const [licDraft, setLicDraft] = useState<SoftwareLicense>(blankLicense());

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; item: any } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      if (!projectBudgetBase) {
        if (!cancelled) {
          setExpenses([]);
          setCloudServices([]);
          setLicenses([]);
          setDataLoading(false);
        }
        return;
      }
      try {
        const [expData, cloudData, licData] = await Promise.all([
          api.get<Expense[]>(`${projectBudgetBase}/expenses`),
          api.get<CloudService[]>(`${projectBudgetBase}/cloud-services`),
          api.get<SoftwareLicense[]>(`${projectBudgetBase}/licenses`),
        ]);
        if (!cancelled) {
          setExpenses(Array.isArray(expData) ? expData : []);
          setCloudServices(Array.isArray(cloudData) ? cloudData : []);
          setLicenses(Array.isArray(licData) ? licData : []);
        }
      } catch {
        // non-critical — show empty
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync budget draft when summary loads
  useEffect(() => {
    if (summary) {
      setBudgetDraft({ total_budget: summary.total_budget, hourly_rate: summary.hourly_rate });
    }
  }, [summary]);

  const saveBudgetConfig = async () => {
    if (!projectId) { toast.error(t("budget.noProjectSelected")); return; }
    setBudgetSaving(true);
    try {
      await saveBudget({ project_id: projectId, total_budget: budgetDraft.total_budget, hourly_rate: budgetDraft.hourly_rate });
      toast.success(t("budget.budgetSaved"));
    } catch {
      toast.error(t("budget.saveBudgetFailed"));
    } finally { setBudgetSaving(false); }
  };

  // ── Expenses CRUD ──
  const openCreateExpense = () => { setExpDraft(blankExpense()); setExpOpen(true); };
  const openEditExpense = (e: Expense) => { setExpDraft({ ...e }); setExpOpen(true); };
  const saveExpense = async () => {
    if (!expDraft.title.trim()) { toast.error(t("budget.expenseTitleRequired")); return; }
    setSaving(true);
    try {
      const isEditing = expDraft.id !== "";
      const payload = {
        title: expDraft.title.trim(),
        amount: Number(expDraft.amount) || 0,
        currency: expDraft.currency || "USD",
        date: expDraft.date || null,
        paymentType: expDraft.paymentType || "Credit Card"
      };
      if (isEditing) {
        if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
        await api.put(`${projectBudgetBase}/expenses/${expDraft.id}`, payload);
        setExpenses((prev) => prev.map((item) => item.id === expDraft.id ? { ...expDraft } : item));
        toast.success(t("budget.expenseUpdated"));
      } else {
        if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
        const res: any = await api.post(`${projectBudgetBase}/expenses`, payload);
        setExpenses((prev) => [...prev, { ...expDraft, id: String(res?.id ?? Date.now()) }]);
        toast.success(t("budget.expenseAdded"));
      }
      setExpOpen(false);
    } catch (err: any) {
      toast.error(err?.message || t("budget.expenseSaveFailed"));
    } finally { setSaving(false); }
  };
  const removeExpense = async (e: Expense) => {
    const prev = expenses;
    setExpenses((cur) => cur.filter((x) => x.id !== e.id));
    try {
      if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
      await api.del(`${projectBudgetBase}/expenses/${e.id}`);
      toast.success(t("budget.expenseDeleted"));
    } catch (err: any) {
      setExpenses(prev);
      toast.error(err?.message || t("budget.expenseDeleteFailed"));
    }
  };

  // ── Cloud Services CRUD ──
  const openCreateCloud = () => { setCloudDraft(blankCloud()); setCloudOpen(true); };
  const openEditCloud = (c: CloudService) => { setCloudDraft({ ...c }); setCloudOpen(true); };
  const saveCloud = async () => {
    if (!cloudDraft.serviceName.trim()) { toast.error(t("budget.serviceNameRequired")); return; }
    setSaving(true);
    try {
      const isEditing = cloudDraft.id !== "";
      const payload = {
        serviceName: cloudDraft.serviceName.trim(),
        provider: cloudDraft.provider ? cloudDraft.provider.trim() : null,
        planType: cloudDraft.planType ? cloudDraft.planType.trim() : null,
        monthlyCost: Number(cloudDraft.monthlyCost) || 0,
        renewalDate: cloudDraft.renewalDate || null,
        autoRenewal: Boolean(cloudDraft.autoRenewal)
      };
      if (isEditing) {
        if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
        await api.put(`${projectBudgetBase}/cloud-services/${cloudDraft.id}`, payload);
        setCloudServices((prev) => prev.map((item) => item.id === cloudDraft.id ? { ...cloudDraft } : item));
        toast.success(t("budget.cloudUpdated"));
      } else {
        if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
        const res: any = await api.post(`${projectBudgetBase}/cloud-services`, payload);
        setCloudServices((prev) => [...prev, { ...cloudDraft, id: String(res?.id ?? Date.now()) }]);
        toast.success(t("budget.cloudAdded"));
      }
      setCloudOpen(false);
    } catch (err: any) {
      toast.error(err?.message || t("budget.cloudSaveFailed"));
    } finally { setSaving(false); }
  };
  const removeCloud = async (c: CloudService) => {
    const prev = cloudServices;
    setCloudServices((cur) => cur.filter((x) => x.id !== c.id));
    try {
      if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
      await api.del(`${projectBudgetBase}/cloud-services/${c.id}`);
      toast.success(t("budget.cloudDeleted"));
    } catch (err: any) {
      setCloudServices(prev);
      toast.error(err?.message || t("budget.cloudDeleteFailed"));
    }
  };

  // ── Software Licenses CRUD ──
  const openCreateLicense = () => { setLicDraft(blankLicense()); setLicOpen(true); };
  const openEditLicense = (l: SoftwareLicense) => { setLicDraft({ ...l }); setLicOpen(true); };
  const saveLicense = async () => {
    if (!licDraft.softwareName.trim()) { toast.error(t("budget.softwareNameRequired")); return; }
    setSaving(true);
    try {
      const isEditing = licDraft.id !== "";
      const payload = {
        softwareName: licDraft.softwareName.trim(),
        licenseType: licDraft.licenseType ? licDraft.licenseType.trim() : null,
        seats: Number(licDraft.seats) || 0,
        monthlyCost: Number(licDraft.monthlyCost) || 0,
        renewalDate: licDraft.renewalDate || null,
        department: licDraft.department ? licDraft.department.trim() : null
      };
      if (isEditing) {
        if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
        await api.put(`${projectBudgetBase}/licenses/${licDraft.id}`, payload);
        setLicenses((prev) => prev.map((item) => item.id === licDraft.id ? { ...licDraft } : item));
        toast.success(t("budget.licenseUpdated"));
      } else {
        if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
        const res: any = await api.post(`${projectBudgetBase}/licenses`, payload);
        setLicenses((prev) => [...prev, { ...licDraft, id: String(res?.id ?? Date.now()) }]);
        toast.success(t("budget.licenseAdded"));
      }
      setLicOpen(false);
    } catch (err: any) {
      toast.error(err?.message || t("budget.licenseSaveFailed"));
    } finally { setSaving(false); }
  };
  const removeLicense = async (l: SoftwareLicense) => {
    const prev = licenses;
    setLicenses((cur) => cur.filter((x) => x.id !== l.id));
    try {
      if (!projectBudgetBase) throw new Error(t("budget.noProjectSelected"));
      await api.del(`${projectBudgetBase}/licenses/${l.id}`);
      toast.success(t("budget.licenseDeleted"));
    } catch (err: any) {
      setLicenses(prev);
      toast.error(err?.message || t("budget.licenseDeleteFailed"));
    }
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthlyCloud = cloudServices.reduce((s, c) => s + c.monthlyCost, 0);
  const monthlyLicenses = licenses.reduce((s, l) => s + l.monthlyCost, 0);
  const monthlyRecurring = monthlyCloud + monthlyLicenses;

  const byCategory = expenseCategories
    .map((c) => ({
      ...c,
      total: expenses.filter((e) => e.category === c.name).reduce((s, e) => s + e.amount, 0)
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));
  const budgetConfigured = Boolean(summary?.total_budget && summary.total_budget > 0);

  const exportCsv = () => {
    const rows: unknown[][] = [
      ["Budget export"],
      ["Project", projectId ?? ""],
      ["Generated at", new Date().toISOString()],
      ["Total budget", summary?.total_budget ?? 0],
      ["Hourly rate", summary?.hourly_rate ?? 0],
      [],
      ["Section", "Type", "Name", "Category", "Amount", "Currency", "Date", "Details"],
      ...expenses.map((item) => ["Expenses", "Expense", item.title, item.category, item.amount, item.currency, item.date, item.paymentType]),
      ...cloudServices.map((item) => ["Cloud", "Service", item.serviceName, item.provider, item.monthlyCost, "USD", item.renewalDate, item.planType]),
      ...licenses.map((item) => ["Licenses", "License", item.softwareName, item.department, item.monthlyCost, "USD", item.renewalDate, `${item.licenseType} · ${item.seats} seats`]),
    ];
    downloadTextFile(
      `budget-export-${projectId ?? "all"}.csv`,
      rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("budget.title")}
          subtitle={t("budget.subtitle")}
          actions={
            <div className="flex items-center gap-2">
              {activeTab !== "overview" && projectId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={exportCsv}
                >
                  {t("budget.exportCsv")}
                </Button>
              )}
              {activeTab === "expenses" ? (
                <Button size="sm" className="gap-1.5" onClick={openCreateExpense}>
                  <Plus className="h-4 w-4" /> {t("budget.logExpense")}
                </Button>
              ) : activeTab === "cloud" ? (
                <Button size="sm" className="gap-1.5" onClick={openCreateCloud}>
                  <Plus className="h-4 w-4" /> {t("budget.addCloud")}
                </Button>
              ) : activeTab === "licenses" ? (
                <Button size="sm" className="gap-1.5" onClick={openCreateLicense}>
                  <Plus className="h-4 w-4" /> {t("budget.addLicense")}
                </Button>
              ) : null}
            </div>
          }
        />

        {dataLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!dataLoading && (
          <>
            <div className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${budgetConfigured ? "border-primary/30 bg-primary/5" : "border-primary/40 bg-primary/10"}`}>
              {budgetConfigured ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {budgetConfigured
                    ? t("budget.trackingReady", { defaultValue: "Budget tracking is ready" })
                    : t("budget.setupPrompt", { defaultValue: "Set up your budget to make every number useful" })}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {budgetConfigured
                    ? t("budget.trackingReadyHint", { defaultValue: "Add expenses, cloud services, or licenses as they appear to keep this view current." })
                    : t("budget.setupPromptHint", { defaultValue: "Start with a total budget and hourly rate below. You can add detailed costs afterward." })}
                </p>
              </div>
              <ArrowRight className="ms-auto mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label={t("budget.oneOffExpenses")} value={money(totalExpenses)} icon={<Receipt className="h-5 w-5" />} />
              <StatTile label={t("budget.monthlyCloud")} value={money(monthlyCloud)} icon={<CloudCog className="h-5 w-5" />} />
              <StatTile label={t("budget.monthlyLicenses")} value={money(monthlyLicenses)} icon={<KeyRound className="h-5 w-5" />} />
              <StatTile label={t("budget.recurringMo")} value={money(monthlyRecurring)} icon={<Receipt className="h-5 w-5" />} />
            </div>

            {byCategory.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">{t("budget.spendByCategory")}</h2>
                <div className="space-y-3">
                  {byCategory.map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-sm text-foreground">{c.name}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, backgroundColor: c.color }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{money(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="overview">{t("budget.overview")}</TabsTrigger>
                <TabsTrigger value="expenses">{t("budget.expenses")}</TabsTrigger>
                <TabsTrigger value="cloud">{t("budget.cloudServices")}</TabsTrigger>
                <TabsTrigger value="licenses">{t("budget.licenses")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Budget Setup */}
                  <div className={`rounded-xl border bg-card p-5 ${!budgetConfigured ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{t("budget.budgetSetup")}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {t("budget.setupHint", { defaultValue: "Two values unlock your budget runway and cost reporting." })}
                        </p>
                      </div>
                      {!budgetConfigured && <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">{t("budget.startHere", { defaultValue: "Start here" })}</span>}
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>{t("budget.totalBudget")}</Label>
                        <Input
                          id="budget-setup"
                          type="number"
                          min={0}
                          value={budgetDraft.total_budget}
                          onChange={(e) => setBudgetDraft({ ...budgetDraft, total_budget: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("budget.hourlyRate")}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={budgetDraft.hourly_rate}
                          onChange={(e) => setBudgetDraft({ ...budgetDraft, hourly_rate: Number(e.target.value) })}
                        />
                      </div>
                      <Button onClick={saveBudgetConfig} disabled={budgetSaving} size="sm">
                        {t("app.saveChanges")}
                      </Button>
                    </div>
                  </div>

                  {/* Budget Summary */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">{t("budget.budgetSummary")}</h3>
                    {summary ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.totalBudget")}</span>
                          <span className="font-medium text-foreground">{money(summary.total_budget)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.spent")}</span>
                          <span className="font-medium text-foreground">{money(summary.spent)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.remaining")}</span>
                          <span className={`font-medium ${summary.remaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
                            {money(summary.remaining)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.burnRate")}</span>
                          <span className="font-medium text-foreground">{money(summary.burn_rate)}/hr</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.totalHours")}</span>
                          <span className="font-medium text-foreground">{summary.total_hours.toFixed(1)}h</span>
                        </div>
                        {/* Progress bar */}
                        <div className="pt-2">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min((summary.spent / Math.max(summary.total_budget, 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {t("budget.pctUtilized", { pct: ((summary.spent / Math.max(summary.total_budget, 1)) * 100).toFixed(0) })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-foreground">{t("budget.noBudget")}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {t("budget.noBudgetHint", { defaultValue: "Save a total budget above to see remaining budget, burn rate, and utilization here." })}
                        </p>
                        <button type="button" onClick={() => document.getElementById("budget-setup")?.focus()} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          {t("budget.goToSetup", { defaultValue: "Go to setup" })}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cost by Member */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">{t("budget.costByMember")}</h3>
                    {costByMember && costByMember.members.length > 0 ? (
                      <div className="space-y-3">
                        {costByMember.members.map((m) => {
                          const maxCost = Math.max(...costByMember.members.map((x) => x.cost));
                          return (
                            <div key={m.user_id} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground">{m.user_name}</span>
                                <span className="text-muted-foreground">{m.total_hours}h · {money(m.cost)}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-chart-1"
                                  style={{ width: `${(m.cost / Math.max(maxCost, 1)) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-foreground">{t("budget.noTimeEntries")}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("budget.noTimeEntriesHint", { defaultValue: "Time entries will appear here as the team logs work." })}</p>
                      </div>
                    )}
                  </div>

                  {/* Budget vs Actual by Project */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="mb-4 text-sm font-semibold text-foreground">{t("budget.budgetVsActual")}</h3>
                    {costByProject ? (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.totalBudget")}</span>
                          <span className="font-medium">{money(costByProject.budget)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.spent")}</span>
                          <span className="font-medium">{money(costByProject.cost)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("budget.totalHours")}</span>
                          <span className="font-medium">{costByProject.total_hours}h</span>
                        </div>
                        <div className="pt-2">
                          <div className="h-3 overflow-hidden rounded-full bg-muted relative">
                            <div
                              className="h-full rounded-full bg-primary absolute left-0 top-0"
                              style={{ width: `${Math.min((costByProject.cost / Math.max(costByProject.budget, 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-foreground">{t("budget.noData")}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("budget.noDataHint", { defaultValue: "Add a budget and log work to compare planned cost with actual cost." })}</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="expenses">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("budget.colItem")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colCategory")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colDate")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colMethod")}</th>
                        <th className="px-4 py-2.5 text-right font-medium">{t("budget.colAmount")}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{t("budget.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                          <td className="px-4 py-3 font-medium text-foreground">{e.title}</td>
                          <td className="px-3 py-3 text-muted-foreground">{e.category}</td>
                          <td className="px-3 py-3 text-muted-foreground">{e.date ? format(new Date(e.date), "MMM d, yyyy") : "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{e.paymentType}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{money(e.amount)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEditExpense(e)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={() => setConfirmDelete({ type: "expense", item: e })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            {t("budget.noExpenses")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="cloud">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("budget.colService")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colProvider")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colRenewal")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colAutoRenew")}</th>
                        <th className="px-4 py-2.5 text-right font-medium">{t("budget.colMonthly")}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{t("budget.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cloudServices.map((c) => (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                          <td className="px-4 py-3 font-medium text-foreground">{c.serviceName}</td>
                          <td className="px-3 py-3 text-muted-foreground">{c.provider || "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{c.renewalDate ? format(new Date(c.renewalDate), "MMM d, yyyy") : "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{c.autoRenewal ? t("budget.yes") : t("budget.no")}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{money(c.monthlyCost)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEditCloud(c)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={() => setConfirmDelete({ type: "cloud", item: c })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {cloudServices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            {t("budget.noCloud")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="licenses">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("budget.colSoftware")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colType")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colSeats")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("budget.colDepartment")}</th>
                        <th className="px-4 py-2.5 text-right font-medium">{t("budget.colMonthly")}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{t("budget.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenses.map((l) => (
                        <tr key={l.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                          <td className="px-4 py-3 font-medium text-foreground">{l.softwareName}</td>
                          <td className="px-3 py-3 text-muted-foreground">{l.licenseType || "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{l.seats}</td>
                          <td className="px-3 py-3 text-muted-foreground">{l.department || "-"}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{money(l.monthlyCost)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" aria-label={t("app.edit")} onClick={() => openEditLicense(l)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={t("app.delete")} className="text-destructive" onClick={() => setConfirmDelete({ type: "license", item: l })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {licenses.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            {t("budget.noLicenses")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Expense Modal */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{expDraft.id ? t("budget.editExpense") : t("budget.logExpenseDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">{t("budget.titleItem")}</Label>
              <Input
                id="exp-title"
                value={expDraft.title}
                autoFocus
                onChange={(e) => setExpDraft({ ...expDraft, title: e.target.value })}
                placeholder="e.g. AWS Cloud Infra"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">{t("budget.amount")}</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min={0}
                  value={expDraft.amount}
                  onChange={(e) => setExpDraft({ ...expDraft, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">{t("budget.colDate")}</Label>
                <DatePicker
                  id="exp-date"
                  value={expDraft.date}
                  onChange={(date) => setExpDraft({ ...expDraft, date })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("budget.paymentMethod")}</Label>
              <Select value={expDraft.paymentType} onValueChange={(v) => setExpDraft({ ...expDraft, paymentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Credit Card">{t("budget.creditCard")}</SelectItem>
                  <SelectItem value="Bank Transfer">{t("budget.bankTransfer")}</SelectItem>
                  <SelectItem value="Invoice">{t("budget.invoice")}</SelectItem>
                  <SelectItem value="Reimbursement">{t("budget.reimbursement")}</SelectItem>
                  <SelectItem value="Direct Debit">{t("budget.directDebit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveExpense} disabled={saving}>{expDraft.id ? t("app.saveChanges") : t("budget.logExpenseDialog")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cloud Service Modal */}
      <Dialog open={cloudOpen} onOpenChange={setCloudOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{cloudDraft.id ? t("budget.editCloud") : t("budget.addCloudDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cs-name">{t("budget.serviceName")}</Label>
              <Input
                id="cs-name"
                value={cloudDraft.serviceName}
                autoFocus
                onChange={(e) => setCloudDraft({ ...cloudDraft, serviceName: e.target.value })}
                placeholder="e.g. AWS Production Cluster"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cs-provider">{t("budget.provider")}</Label>
                <Input
                  id="cs-provider"
                  value={cloudDraft.provider}
                  onChange={(e) => setCloudDraft({ ...cloudDraft, provider: e.target.value })}
                  placeholder="e.g. Amazon Web Services"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-plan">{t("budget.planType")}</Label>
                <Input
                  id="cs-plan"
                  value={cloudDraft.planType}
                  onChange={(e) => setCloudDraft({ ...cloudDraft, planType: e.target.value })}
                  placeholder="e.g. Enterprise Tier"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cs-cost">{t("budget.monthlyCost")}</Label>
                <Input
                  id="cs-cost"
                  type="number"
                  min={0}
                  value={cloudDraft.monthlyCost}
                  onChange={(e) => setCloudDraft({ ...cloudDraft, monthlyCost: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-renew">{t("budget.renewalDate")}</Label>
                <DatePicker
                  id="cs-renew"
                  value={cloudDraft.renewalDate}
                  onChange={(date) => setCloudDraft({ ...cloudDraft, renewalDate: date })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloudOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveCloud} disabled={saving}>{cloudDraft.id ? t("app.saveChanges") : t("budget.addCloudDialog")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Software License Modal */}
      <Dialog open={licOpen} onOpenChange={setLicOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{licDraft.id ? t("budget.editLicense") : t("budget.addLicenseDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="lic-name">{t("budget.softwareName")}</Label>
              <Input
                id="lic-name"
                value={licDraft.softwareName}
                autoFocus
                onChange={(e) => setLicDraft({ ...licDraft, softwareName: e.target.value })}
                placeholder="e.g. Figma Enterprise"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lic-type">{t("budget.licenseType")}</Label>
                <Input
                  id="lic-type"
                  value={licDraft.licenseType}
                  onChange={(e) => setLicDraft({ ...licDraft, licenseType: e.target.value })}
                  placeholder="e.g. Annual SaaS"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lic-dept">{t("budget.colDepartment")}</Label>
                <Input
                  id="lic-dept"
                  value={licDraft.department}
                  onChange={(e) => setLicDraft({ ...licDraft, department: e.target.value })}
                  placeholder="e.g. Product Design"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lic-seats">{t("budget.seats")}</Label>
                <Input
                  id="lic-seats"
                  type="number"
                  min={1}
                  value={licDraft.seats}
                  onChange={(e) => setLicDraft({ ...licDraft, seats: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lic-cost">{t("budget.monthlyCost")}</Label>
                <Input
                  id="lic-cost"
                  type="number"
                  min={0}
                  value={licDraft.monthlyCost}
                  onChange={(e) => setLicDraft({ ...licDraft, monthlyCost: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lic-renew">{t("budget.renewalDate")}</Label>
              <DatePicker
                id="lic-renew"
                value={licDraft.renewalDate}
                onChange={(date) => setLicDraft({ ...licDraft, renewalDate: date })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLicOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={saveLicense} disabled={saving}>{licDraft.id ? t("app.saveChanges") : t("budget.addLicenseDialog")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={`${t("app.delete")} ${confirmDelete?.type ?? ""}`}
        description={`${t("app.deleteConfirm", { name: confirmDelete?.item?.title ?? confirmDelete?.item?.serviceName ?? confirmDelete?.item?.softwareName ?? "" })}`}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === "expense") removeExpense(confirmDelete.item);
          else if (confirmDelete.type === "cloud") removeCloud(confirmDelete.item);
          else if (confirmDelete.type === "license") removeLicense(confirmDelete.item);
        }}
        confirmLabel={t("app.delete")}
      />
    </div>
  );
}


export default BudgetPage;
