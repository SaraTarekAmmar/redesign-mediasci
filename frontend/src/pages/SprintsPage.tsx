import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarDays, Play, CheckCircle2, Loader2, Plus, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useStore, lookups } from "../store/useStore";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { DatePicker } from "../components/ui/DatePicker";
import { Textarea } from "../components/ui/Textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../components/ui/Dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import type { Sprint } from "../data/types";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

function SprintTimer({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
    elapsedPct: number;
  } | null>(null);

  useEffect(() => {
    if (!endDate) return;
    const calculate = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1);
      const start = startDate ? new Date(startDate).getTime() : end - 14 * 24 * 60 * 60 * 1000;
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, elapsedPct: 100 });
        return;
      }

      const totalDuration = end - start;
      const elapsed = now - start;
      const elapsedPct = totalDuration > 0
        ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
        : 50;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, totalMs: diff, elapsedPct });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [startDate, endDate]);

  if (!timeLeft) return null;

  const isExpired = timeLeft.totalMs <= 0;

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 animate-pulse text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">{t("sprints.liveTimer")}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {isExpired ? t("sprints.timeExpired") : t("sprints.elapsed", { pct: timeLeft.elapsedPct })}
        </span>
      </div>

      <div className="my-2 grid grid-cols-4 gap-2 text-center">
        <div className="rounded border border-border bg-card p-2">
          <span className="block text-lg font-bold tabular-nums text-foreground">{timeLeft.days}</span>
          <span className="text-[10px] font-medium uppercase text-muted-foreground">{t("sprints.days")}</span>
        </div>
        <div className="rounded border border-border bg-card p-2">
          <span className="block text-lg font-bold tabular-nums text-foreground">{String(timeLeft.hours).padStart(2, "0")}</span>
          <span className="text-[10px] font-medium uppercase text-muted-foreground">{t("sprints.hours")}</span>
        </div>
        <div className="rounded border border-border bg-card p-2">
          <span className="block text-lg font-bold tabular-nums text-foreground">{String(timeLeft.minutes).padStart(2, "0")}</span>
          <span className="text-[10px] font-medium uppercase text-muted-foreground">{t("sprints.mins")}</span>
        </div>
        <div className="rounded border border-border bg-card p-2">
          <span className="block text-lg font-bold tabular-nums text-foreground">{String(timeLeft.seconds).padStart(2, "0")}</span>
          <span className="text-[10px] font-medium uppercase text-muted-foreground">{t("sprints.secs")}</span>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${timeLeft.elapsedPct}%` }} />
      </div>
    </div>
  );
}

function SprintsPage() {
  const { t } = useTranslation();
  const issues = useStore((s) => s.issues);
  const [sprints, setSprints] = useState<Sprint[]>(lookups.sprints);
  const [busy, setBusy] = useState<string | null>(null);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectId = String(activeProject?.id ?? "");

  const STATUS: Record<string, { label: string; color: string }> = {
    active: { label: t("sprints.active"), color: "#16a34a" },
    planning: { label: t("sprints.planning"), color: "#f59e0b" },
    completed: { label: t("sprints.completed"), color: "#6b7280" }
  };

  // Fetch fresh sprint list on mount
  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/sprints`)
      .then((res: any) => {
        if (Array.isArray(res) && res.length > 0) {
          const mapped: Sprint[] = res.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            goal: s.goal || undefined,
            startDate: s.startDate || s.start_date || undefined,
            endDate: s.endDate || s.end_date || undefined,
            status: s.status || "planning"
          }));
          setSprints(mapped);
        }
      })
      .catch((err) => console.error("[SprintsPage] Could not load sprints:", err));
  }, [projectId]);

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [newSprint, setNewSprint] = useState({
    name: `Sprint ${sprints.length + 1}`,
    goal: "",
    duration: "2 weeks",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  });

  const [startOpen, setStartOpen] = useState(false);
  const [targetSprint, setTargetSprint] = useState<Sprint | null>(null);
  const [autoCompleteActive, setAutoCompleteActive] = useState(true);
  const [startDates, setStartDates] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  });

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeAction, setCompleteAction] = useState<"backlog" | "sprint">("backlog");

  const backlogCount = issues.filter((i) => !i.sprintId).length;

  const setStatus = (id: string, status: Sprint["status"], dates?: { startDate?: string; endDate?: string }) =>
    setSprints((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, status, ...(dates || {}) };
        }
        // If starting a sprint and auto-completing, set other active sprints to completed
        if (status === "active" && autoCompleteActive && s.status === "active") {
          return { ...s, status: "completed" };
        }
        return s;
      })
    );

  // Create Sprint Action
  const handleCreateSprint = async () => {
    if (!newSprint.name.trim()) { toast.error(t("sprints.nameRequired")); return; }
    setBusy("create");
    try {
      const res: any = await api.post(`/projects/${projectId}/sprints`, {
        name: newSprint.name.trim(),
        goal: newSprint.goal.trim() || null,
        start_date: newSprint.startDate || null,
        end_date: newSprint.endDate || null
      });
      const created: Sprint = {
        id: String(res?.id ?? `sp-${Date.now()}`),
        name: newSprint.name.trim(),
        goal: newSprint.goal.trim() || undefined,
        startDate: newSprint.startDate,
        endDate: newSprint.endDate,
        status: "planning"
      };
      setSprints((prev) => [...prev, created]);
      toast.success(t("sprints.created", { name: created.name }));
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || t("sprints.createFailed"));
    } finally {
      setBusy(null);
    }
  };

  // Open Start Modal
  const openStartDialog = (sp: Sprint) => {
    setTargetSprint(sp);
    setStartDates({
      startDate: sp.startDate || new Date().toISOString().slice(0, 10),
      endDate: sp.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    });
    setStartOpen(true);
  };

  // Start Sprint Action
  const handleStartSprint = async () => {
    if (!targetSprint) return;
    setBusy(targetSprint.id);
    const previousStatus = targetSprint.status;
    setStatus(targetSprint.id, "active", startDates);
    try {
      await api.put(`/sprints/${targetSprint.id}`, {
        status: "active",
        start_date: startDates.startDate || null,
        end_date: startDates.endDate || null
      });
      toast.success(t("sprints.nowActive", { name: targetSprint.name }));
      setStartOpen(false);
    } catch (e: any) {
      setStatus(targetSprint.id, previousStatus);
      const errorMsg = e?.response?.data?.errors?.sprint?.[0] || e?.response?.data?.message || e?.message || t("sprints.startFailed");
      toast.error(errorMsg);
    } finally {
      setBusy(null);
    }
  };

  // Open Complete Modal
  const openCompleteDialog = (sp: Sprint) => {
    setTargetSprint(sp);
    setCompleteAction("backlog");
    setCompleteOpen(true);
  };

  // Complete / Close Sprint Action
  const handleCompleteSprint = async () => {
    if (!targetSprint) return;
    setBusy(targetSprint.id);
    setStatus(targetSprint.id, "completed");
    try {
      await api.post(`/sprints/${targetSprint.id}/complete`, { action: completeAction });
      toast.success(t("sprints.closedCompleted", { name: targetSprint.name }));
      setCompleteOpen(false);
    } catch (e: any) {
      setStatus(targetSprint.id, "active");
      toast.error(e?.response?.data?.message || e?.message || t("sprints.completeFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("sprints.title")}
          subtitle={t("sprints.subtitle", {
            sprintCount: sprints.length,
            sprintPlural: sprints.length !== 1 ? "s" : "",
            backlogCount,
            issuePlural: backlogCount !== 1 ? "s" : "",
          })}
          actions={
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t("sprints.createSprint")}
            </Button>
          }
        />

        <div className="space-y-4">
          {sprints.map((sp) => {
            const sprintIssues = issues.filter((i) => i.sprintId === sp.id);
            const totalPts = sprintIssues.reduce((n, i) => n + (i.storyPoints ?? 0), 0);
            const donePts = sprintIssues
              .filter((i) => lookups.statusById[i.statusId]?.category === "done")
              .reduce((n, i) => n + (i.storyPoints ?? 0), 0);
            const pct = totalPts ? Math.round((donePts / totalPts) * 100) : 0;
            const st = STATUS[sp.status] ?? STATUS.planning;
            const isBusy = busy === sp.id;

            return (
              <div key={sp.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{sp.name}</p>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: `${st.color}1f`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    {sp.goal && <p className="mt-1 text-sm text-muted-foreground">{sp.goal}</p>}
                    {(sp.startDate || sp.endDate) && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {sp.startDate ? format(new Date(sp.startDate), "MMM d") : "-"}
                        {" – "}
                        {sp.endDate ? format(new Date(sp.endDate), "MMM d, yyyy") : "-"}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-semibold leading-none text-foreground">{sprintIssues.length}</p>
                      <p className="text-xs text-muted-foreground">{t("sprints.issues")}</p>
                    </div>
                    {sp.status === "planning" && (
                      <Button size="sm" className="gap-1.5" disabled={isBusy} onClick={() => openStartDialog(sp)}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {t("sprints.startSprint")}
                      </Button>
                    )}
                    {sp.status === "active" && (
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={isBusy} onClick={() => openCompleteDialog(sp)}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {t("sprints.closeComplete")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Live Countdown Timer for Active Sprint */}
                {sp.status === "active" && (
                  <SprintTimer startDate={sp.startDate} endDate={sp.endDate} />
                )}

                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("sprints.ptsDone", { done: donePts, total: totalPts })}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}

          {sprints.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("sprints.noSprints")}
            </p>
          )}
        </div>
      </div>

      {/* Create Sprint Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sprints.createSprint")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="sp-name">{t("sprints.sprintName")}</Label>
              <Input
                id="sp-name"
                value={newSprint.name}
                autoFocus
                onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })}
                placeholder="e.g. Sprint 4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-goal">{t("sprints.sprintGoal")}</Label>
              <Textarea
                id="sp-goal"
                rows={2}
                value={newSprint.goal}
                onChange={(e) => setNewSprint({ ...newSprint, goal: e.target.value })}
                placeholder={t("sprints.goalPlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-start">{t("sprints.startDate")}</Label>
                <DatePicker
                  id="sp-start"
                  value={newSprint.startDate}
                  onChange={(date) => setNewSprint({ ...newSprint, startDate: date })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-end">{t("sprints.endDate")}</Label>
                <DatePicker
                  id="sp-end"
                  value={newSprint.endDate}
                  onChange={(date) => setNewSprint({ ...newSprint, endDate: date })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={handleCreateSprint} disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sprints.createSprint")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Sprint Modal */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sprints.startSprint")} {targetSprint?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground">
              {t("sprints.confirmStart")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st-start">{t("sprints.startDate")}</Label>
                <DatePicker
                  id="st-start"
                  value={startDates.startDate}
                  onChange={(date) => setStartDates({ ...startDates, startDate: date })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-end">{t("sprints.endDate")}</Label>
                <DatePicker
                  id="st-end"
                  value={startDates.endDate}
                  onChange={(date) => setStartDates({ ...startDates, endDate: date })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="auto-complete-chk"
                checked={autoCompleteActive}
                onChange={(e) => setAutoCompleteActive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="auto-complete-chk" className="text-xs font-normal text-muted-foreground cursor-pointer">
                {t("sprints.autoComplete")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={handleStartSprint} disabled={busy === targetSprint?.id}>
              {busy === targetSprint?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sprints.startSprint")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete / Close Sprint Modal */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sprints.closeComplete")} {targetSprint?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs">
                {t("sprints.confirmClose")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("sprints.unfinishedAction")}</Label>
              <Select value={completeAction} onValueChange={(v) => setCompleteAction(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">{t("sprints.moveToBacklog")}</SelectItem>
                  <SelectItem value="sprint">{t("sprints.moveToNext")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>{t("app.cancel")}</Button>
            <Button variant="default" onClick={handleCompleteSprint} disabled={busy === targetSprint?.id}>
              {busy === targetSprint?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sprints.closeComplete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



export default SprintsPage;
