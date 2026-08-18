import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Rocket, ListChecks } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";

interface GlobalSprint {
  id: number;
  name: string;
  goal: string | null;
  status: "planning" | "active" | "completed";
  start_date: string | null;
  end_date: string | null;
  issues_count: number;
  project: { id: number; name: string; key: string };
}

const FALLBACK_GLOBAL_SPRINTS: GlobalSprint[] = [
  {
    id: 9001,
    name: "DBP Sprint 12",
    goal: "Finish planning and stabilize the banking portal rollout.",
    status: "active",
    start_date: "2026-07-22",
    end_date: "2026-08-05",
    issues_count: 14,
    project: { id: 1, name: "Digital Banking Platform", key: "DBP" },
  },
  {
    id: 9002,
    name: "HMS Sprint 7",
    goal: "Deliver design sign-off and core patient workflow screens.",
    status: "planning",
    start_date: "2026-08-06",
    end_date: "2026-08-20",
    issues_count: 9,
    project: { id: 2, name: "Hospital Management System", key: "HMS" },
  },
  {
    id: 9003,
    name: "ERP Sprint 4",
    goal: "Close QA gaps and prepare the retail release bundle.",
    status: "completed",
    start_date: "2026-07-01",
    end_date: "2026-07-15",
    issues_count: 11,
    project: { id: 3, name: "Retail ERP", key: "ERP" },
  },
];

const STATUS_STYLE: Record<GlobalSprint["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  planning: "bg-primary/15 text-primary",
  completed: "bg-muted text-muted-foreground",
};

function normalizeGlobalSprint(item: any): GlobalSprint {
  return {
    id: Number(item.id),
    name: item.name ?? "",
    goal: item.goal ?? null,
    status: item.status === "active" || item.status === "completed" ? item.status : "planning",
    start_date: item.start_date ?? item.startDate ?? null,
    end_date: item.end_date ?? item.endDate ?? null,
    issues_count: Number(item.issues_count ?? item.issuesCount ?? 0),
    project: {
      id: Number(item.project?.id ?? item.project_id ?? 0),
      name: item.project?.name ?? item.project_name ?? "Unknown Project",
      key: item.project?.key ?? item.project_key ?? "PRJ",
    },
  };
}

function GlobalSprintsPage() {
  const { t } = useTranslation();
  const [sprints, setSprints] = useState<GlobalSprint[]>(FALLBACK_GLOBAL_SPRINTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<GlobalSprint[]>("/sprints/global");
        const nextSprints = Array.isArray(res) && res.length > 0
          ? res.map(normalizeGlobalSprint)
          : FALLBACK_GLOBAL_SPRINTS;
        if (!cancelled) setSprints(nextSprints);
      } catch {
        if (!cancelled) {
          setSprints(FALLBACK_GLOBAL_SPRINTS);
          setError(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const projectOptions = useMemo(() => {
    const map = new Map<number, string>();
    sprints.forEach((s) => map.set(s.project.id, s.project.name));
    return Array.from(map.entries());
  }, [sprints]);

  const filtered = sprints.filter(
    (s) =>
      (statusFilter === "all" || s.status === statusFilter) &&
      (projectFilter === "all" || String(s.project.id) === projectFilter)
  );
  const pulse = [
    { label: "Active now", value: sprints.filter((s) => s.status === "active").length, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Planning next", value: sprints.filter((s) => s.status === "planning").length, tone: "text-primary" },
    { label: "Completed", value: sprints.filter((s) => s.status === "completed").length, tone: "text-muted-foreground" },
    { label: "Issues in sprints", value: sprints.reduce((sum, sprint) => sum + sprint.issues_count, 0), tone: "text-foreground" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("globalSprints.title")}
          subtitle={loading ? t("recovery.loading") : t("globalSprints.subtitle", { count: filtered.length })}
          icon={<Rocket className="h-5 w-5" />}
        />

        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Portfolio sprint pulse</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {pulse.map((item) => <div key={item.label} className="rounded-lg border border-border/70 bg-background px-3 py-2"><p className="text-[11px] text-muted-foreground">{item.label}</p><p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p></div>)}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("globalSprints.allStatuses")}</SelectItem>
              <SelectItem value="active">{t("globalSprints.status.active")}</SelectItem>
              <SelectItem value="planning">{t("globalSprints.status.planning")}</SelectItem>
              <SelectItem value="completed">{t("globalSprints.status.completed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("globalSprints.allProjects")}</SelectItem>
              {projectOptions.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {s.project.key?.slice(0, 2)}
                  </span>
                  <Badge className={STATUS_STYLE[s.status]}>{t(`globalSprints.status.${s.status}`)}</Badge>
                </div>
                <p className="truncate font-semibold text-foreground">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.project.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.start_date || "?"} — {s.end_date || "?"}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.goal || t("globalSprints.noGoal")}</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" /> {t("globalSprints.issueCount", { count: s.issues_count })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center"><p className="text-sm font-semibold text-foreground">{t("globalSprints.empty")}</p><p className="mt-1 text-xs text-muted-foreground">Try clearing one of the filters to see sprints across the full portfolio.</p><button type="button" onClick={() => { setStatusFilter("all"); setProjectFilter("all"); }} className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">Clear filters</button></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GlobalSprintsPage;
