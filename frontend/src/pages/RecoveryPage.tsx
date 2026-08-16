import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ListChecks, Layers, BookOpen, Rocket, FolderKanban, Users as UsersIcon,
  RotateCcw, Trash2, Loader2,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { epics as seedEpics, seedIssues, sprints as seedSprints } from "../data/seed";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

const D: any = (typeof window !== "undefined" && (window as any).__DATA__) || {};

type RecoveryType = "issues" | "epics" | "stories" | "sprints" | "projects" | "users";

interface RecoverableItem {
  id: number;
  title?: string;
  name?: string;
  key?: string;
  email?: string;
  color?: string | null;
  status?: string;
  deleted_at: string;
  project?: { id: number; name: string; key: string } | null;
  epic?: { id: number; name: string; color?: string } | null;
  roles?: { id: number; name: string }[];
}

interface RecoveryData {
  issues: RecoverableItem[];
  projects: RecoverableItem[];
  users: RecoverableItem[];
  epics: RecoverableItem[];
  stories: RecoverableItem[];
  sprints: RecoverableItem[];
}

const RETENTION_DAYS = 30;

function daysLeft(deletedAt: string): number {
  const elapsed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
  return RETENTION_DAYS - elapsed;
}

function agoLabel(deletedAt: string, t: (k: string, o?: any) => string): string {
  const d = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
  return d === 0 ? t("recovery.today") : t("recovery.daysAgo", { count: d });
}

const TAB_META: { key: RecoveryType; icon: React.ComponentType<{ className?: string }>; canForceDelete: boolean }[] = [
  { key: "issues", icon: ListChecks, canForceDelete: true },
  { key: "epics", icon: Layers, canForceDelete: true },
  { key: "stories", icon: BookOpen, canForceDelete: true },
  { key: "sprints", icon: Rocket, canForceDelete: true },
  { key: "projects", icon: FolderKanban, canForceDelete: false },
  { key: "users", icon: UsersIcon, canForceDelete: false },
];

function fallbackRecoveryData(): RecoveryData {
  const bootstrapProjects = Array.isArray(D.projects) ? D.projects : [];
  return {
    issues: seedIssues.slice(0, 2).map((issue, index) => ({
      id: index + 1,
      title: issue.title,
      deleted_at: "2026-07-24T09:00:00Z",
      project: bootstrapProjects.find((project) => String(project.id) === String(issue.projectId ?? "")) ?
        {
          id: Number(bootstrapProjects.find((project) => String(project.id) === String(issue.projectId ?? ""))!.id),
          name: bootstrapProjects.find((project) => String(project.id) === String(issue.projectId ?? ""))!.name,
          key: bootstrapProjects.find((project) => String(project.id) === String(issue.projectId ?? ""))!.key,
        } :
        null,
    })),
    projects: bootstrapProjects.slice(0, 1).map((project, index) => ({
      id: index + 1,
      name: project.name,
      key: project.key,
      deleted_at: "2026-07-23T09:00:00Z",
    })),
    users: [],
    epics: seedEpics.slice(0, 1).map((epic, index) => ({
      id: index + 1,
      name: epic.name,
      color: epic.color,
      deleted_at: "2026-07-21T09:00:00Z",
    })),
    stories: seedIssues.filter((issue) => issue.typeKey === "story").slice(0, 1).map((issue, index) => ({
      id: index + 1,
      title: issue.title,
      deleted_at: "2026-07-20T09:00:00Z",
      epic: issue.epicId ? (() => {
        const epic = seedEpics.find((entry) => entry.id === issue.epicId);
        return epic ? { id: index + 1, name: epic.name, color: epic.color } : null;
      })() : null,
    })),
    sprints: seedSprints.slice(0, 1).map((sprint, index) => ({
      id: index + 1,
      name: sprint.name,
      status: sprint.status,
      deleted_at: "2026-07-19T09:00:00Z",
    })),
  };
}

function RecoveryPage() {
  const { t } = useTranslation();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readOnlyFallback, setReadOnlyFallback] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmForceDelete, setConfirmForceDelete] = useState<{ type: RecoveryType; item: RecoverableItem } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setReadOnlyFallback(false);
      try {
        const res = await api.get<RecoveryData>("/recovery");
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) {
          setData(fallbackRecoveryData());
          setReadOnlyFallback(true);
          setError(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const totalCount = useMemo(() => {
    if (!data) return 0;
    return TAB_META.reduce((sum, m) => sum + (data[m.key]?.length ?? 0), 0);
  }, [data]);

  const restore = async (type: RecoveryType, item: RecoverableItem) => {
    const key = `${type}-${item.id}`;
    setRestoring(key);
    try {
      await api.post(`/recovery/${type}/${item.id}/restore`);
      setData((prev) => prev && { ...prev, [type]: prev[type].filter((x) => x.id !== item.id) });
      toast.success(t("recovery.restored", { name: item.name || item.title || item.email || "" }));
    } catch (e: any) {
      toast.error(e?.message || t("recovery.restoreError"));
    } finally {
      setRestoring(null);
    }
  };

  const forceDelete = async (type: RecoveryType, item: RecoverableItem) => {
    try {
      await api.del(`/recovery/${type}/${item.id}`);
      setData((prev) => prev && { ...prev, [type]: prev[type].filter((x) => x.id !== item.id) });
      toast.success(t("recovery.permanentlyDeleted"));
    } catch (e: any) {
      toast.error(e?.message || t("recovery.deleteError"));
    }
  };

  if (!isAdmin && !loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{t("recovery.accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("recovery.title")}
          subtitle={loading ? t("recovery.loading") : t("recovery.subtitle", { count: totalCount, days: RETENTION_DAYS })}
        />

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

        {data && !loading && !error && (
          <Tabs defaultValue="issues">
            <TabsList>
              {TAB_META.map(({ key, icon: Icon }) => (
                <TabsTrigger key={key} value={key} className="gap-1.5">
                  <Icon className="h-4 w-4" /> {t(`recovery.tabs.${key}`)} ({data[key]?.length ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>

            {TAB_META.map(({ key, canForceDelete }) => (
              <TabsContent key={key} value={key} className="pt-4">
                <div className="divide-y divide-border rounded-xl border border-border bg-card">
                  {(data[key] ?? []).map((item) => {
                    const left = daysLeft(item.deleted_at);
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        {key === "users" ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(item.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                        ) : (item.color !== undefined) ? (
                          <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color || "#64748b" }} />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{item.name || item.title || "-"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {key === "users"
                              ? item.email
                              : [
                                  item.project?.name,
                                  key === "stories" && item.epic ? `${t("recovery.epicLabel")}: ${item.epic.name}` : null,
                                  key === "sprints" && item.status ? `${t("recovery.statusLabel")}: ${item.status}` : null,
                                  key === "projects" && item.key ? `${t("recovery.keyLabel")}: ${item.key}` : null,
                                ].filter(Boolean).join(" · ")}
                            {" · "}{t("recovery.deleted")} {agoLabel(item.deleted_at, t)}
                          </p>
                        </div>
                        <Badge variant={left > 0 ? "outline" : "destructive"} className="shrink-0">
                          {left > 0 ? t("recovery.daysLeft", { count: left }) : t("recovery.expired")}
                        </Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0 gap-1.5"
                          disabled={readOnlyFallback || restoring === `${key}-${item.id}`}
                          onClick={() => restore(key, item)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> {t("recovery.restore")}
                        </Button>
                        {canForceDelete && isSuperAdmin && !readOnlyFallback && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="shrink-0 text-destructive"
                            aria-label={t("recovery.forceDelete")}
                            onClick={() => setConfirmForceDelete({ type: key, item })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {(data[key]?.length ?? 0) === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">{t(`recovery.empty.${key}`)}</div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <ConfirmDialog
        open={confirmForceDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmForceDelete(null); }}
        title={t("recovery.forceDeleteTitle")}
        description={t("recovery.forceDeleteDescription", { name: confirmForceDelete?.item.name || confirmForceDelete?.item.title || "" })}
        onConfirm={() => { if (confirmForceDelete) forceDelete(confirmForceDelete.type, confirmForceDelete.item); }}
        confirmLabel={t("recovery.forceDelete")}
      />
    </div>
  );
}

export default RecoveryPage;
