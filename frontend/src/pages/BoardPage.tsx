import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Target, Loader2, TriangleAlert, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { useStore, lookups, matchesFilters } from "../store/useStore";
import { FilterBar } from "../components/common/FilterBar";
import { SavedViewsDropdown } from "../components/common/SavedViewsDropdown";
import { BoardColumn } from "../components/board/BoardColumn";
import { BoardViewToggle, getStoredViewMode, type ViewMode } from "../components/board/BoardViewToggle";
import { BoardListView } from "../components/board/BoardListView";
import { BoardTableView } from "../components/board/BoardTableView";
import { CreateIssueDialog } from "../components/issue/CreateIssueDialog";
import { WorkflowStageManagerModal, WorkflowStage } from "../components/board/WorkflowStageManagerModal";
import { Button } from "../components/ui/Button";
import { api, getActiveProjectId } from "../lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import type { SavedViewConfig } from "../hooks/useSavedViews";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import { useAuth } from "../hooks/useAuth";

function BoardPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const { hasRole, hasPermission } = useAuth();
  const canManageWorkflow = hasRole("super-admin", "admin", "project-manager", "team-leader") || hasPermission("manage-workflows");

  const issues = useStore((s) => s.issues);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const toggleArrayFilter = useStore((s) => s.toggleArrayFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const moveIssue = useStore((s) => s.moveIssue);
  const setSelected = useStore((s) => s.setSelectedIssue);
  const fetchProjectData = useStore((s) => s.fetchProjectData);
  const isLoading = useStore((s) => s.isLoading);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);

  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatusId, setCreateStatusId] = useState<string>("s2");
  const [sortField, setSortField] = useState("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState("status");
  const lastSavedConfigRef = useRef<string>("");

  // Workflow Stages state
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>([]);
  const [stageManagerOpen, setStageManagerOpen] = useState(false);

  const projectId = getActiveProjectId() || String(activeProject?.id ?? "");

  const fetchStages = useCallback(async () => {
    if (!projectId) return;
    try {
      const stagesData = await api.get<WorkflowStage[]>(`/projects/${projectId}/stages`);
      if (Array.isArray(stagesData)) {
        setWorkflowStages(stagesData);
      }
    } catch {
      // Fallback to default lookups
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchProjectData(projectId);
      fetchStages();
    }
  }, [projectId, fetchProjectData, fetchStages]);

  // Rebalancing states and handlers
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [proposal, setProposal] = useState<any[]>([]);
  const [loadingRebalance, setLoadingRebalance] = useState(false);
  const [applyingRebalance, setApplyingRebalance] = useState(false);

  const handleRequestRebalance = async () => {
    setLoadingRebalance(true);
    setRebalanceOpen(true);
    try {
      const res = await api.post<{ proposal: any[] }>(`/projects/${projectId}/rebalance/propose`);
      setProposal(res?.proposal || []);
    } catch {
      toast.error(t("board.rebalance.loadFailed"));
      setRebalanceOpen(false);
    } finally {
      setLoadingRebalance(false);
    }
  };

  const handleApplyRebalance = async () => {
    if (proposal.length === 0) return;
    setApplyingRebalance(true);
    try {
      const payload = {
        reassignments: proposal.map((p) => ({
          issue_id: p.issue_id,
          to_assignee_id: p.to_assignee_id,
          due_date_shift_days: p.due_date_shift_days,
        })),
      };
      await api.post(`/projects/${projectId}/rebalance/apply`, payload);

      const store = useStore.getState();
      proposal.forEach((p) => {
        const issue = store.issues.find((i) => i.id === String(p.issue_id));
        const patch: any = { assigneeId: String(p.to_assignee_id) };
        if (p.due_date_shift_days && issue?.dueDate) {
          const originalDate = new Date(issue.dueDate);
          originalDate.setDate(originalDate.getDate() + p.due_date_shift_days);
          patch.dueDate = originalDate.toISOString().split("T")[0];
        }
        store.updateIssue(String(p.issue_id), patch);
      });

      toast.success(t("board.rebalance.applySuccess"));
      setRebalanceOpen(false);
    } catch {
      toast.error(t("board.rebalance.applyFailed"));
    } finally {
      setApplyingRebalance(false);
    }
  };

  const getCurrentConfig = useCallback(
    (): SavedViewConfig => ({
      filters: { ...filters },
      sortField,
      sortOrder,
      viewMode,
      groupBy,
    }),
    [filters, sortField, sortOrder, viewMode, groupBy]
  );

  const currentConfig = getCurrentConfig();
  const hasUnsavedChanges = lastSavedConfigRef.current !== "" && JSON.stringify(currentConfig) !== lastSavedConfigRef.current;

  const handleLoadView = useCallback(
    (config: SavedViewConfig) => {
      clearFilters();
      Object.entries(config.filters).forEach(([key, value]) => {
        if (key === "search") setFilter("search", value as string);
        else if (key === "workstream") setFilter("workstream", value as "presale" | "postsale" | "");
        else if (Array.isArray(value)) {
          const filterKey = key as "assigneeIds" | "typeKeys" | "labelIds" | "epicIds";
          const current = filters[filterKey];
          if (Array.isArray(current)) {
            current.forEach((v: string) => toggleArrayFilter(filterKey, v));
          }
          value.forEach((v: string) => toggleArrayFilter(filterKey, v));
        }
      });
      setSortField(config.sortField);
      setSortOrder(config.sortOrder);
      setViewMode(config.viewMode as ViewMode);
      setGroupBy(config.groupBy);
      lastSavedConfigRef.current = JSON.stringify(config);
    },
    [clearFilters, setFilter, toggleArrayFilter, filters, setViewMode]
  );

  const sprint = lookups.sprintById[activeSprintId];
  const boardStatusIds = lookups.statuses.map((s) => s.id);

  const scopedIssues = useMemo(
    () => issues.filter((i) => String(i.projectId ?? "") === String(projectId)),
    [issues, projectId]
  );

  const sprintIssues = useMemo(
    () => scopedIssues.filter((i) => i.sprintId === activeSprintId && matchesFilters(i, filters)),
    [scopedIssues, activeSprintId, filters]
  );

  const totalPoints = sprintIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
  const donePoints = sprintIssues.filter((i) => lookups.statusById[i.statusId]?.category === "done").reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  const overloadedUsers = useMemo(() => {
    const counts: Record<string, number> = {};
    sprintIssues.forEach((issue) => {
      if (issue.assigneeId && lookups.statusById[issue.statusId]?.category !== "done") {
        counts[issue.assigneeId] = (counts[issue.assigneeId] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 3)
      .map(([userId, count]) => ({
        id: userId,
        name: lookups.userById[userId]?.name || "Unknown User",
        count,
      }));
  }, [sprintIssues]);

  const handleDrop = (statusId: string, index: number) => {
    if (draggingId) {
      moveIssue(draggingId, statusId, index);
      setDraggingId(null);
    }
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("board-view-mode", mode);
    } catch {}
  };

  if (isLoading && issues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Active columns derived dynamically from configured workflow stages or fallback statuses
  const displayColumns =
    workflowStages.length > 0
      ? workflowStages.map((stg) => ({
          id: String(stg.id),
          name: stg.name,
          color: stg.color,
          category: stg.category,
          wip_limit: stg.wip_limit,
          matchingStatusIds: lookups.statuses.filter((s) => s.name.toLowerCase() === stg.name.toLowerCase() || s.category === stg.category).map((s) => s.id),
        }))
      : boardStatusIds.map((sId) => {
          const s = lookups.statusById[sId];
          return {
            id: sId,
            name: s.name,
            color: s.color,
            category: s.category,
            wip_limit: null,
            matchingStatusIds: [sId],
          };
        });

  return (
    <div className="flex h-full flex-col" dir={i18n.dir()}>
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {sprint?.name} {t("board.title")}
            </h1>
            {sprint?.goal && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> {sprint.goal}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {sprint?.startDate && sprint?.endDate && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {format(new Date(sprint.startDate), "MMM d")} – {format(new Date(sprint.endDate), "MMM d")}
              </span>
            )}
            <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
              {t("board.xPointsDone", { done: donePoints, total: totalPoints })}
            </span>

            {canManageWorkflow && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setStageManagerOpen(true)}>
                <Settings2 className="h-4 w-4" />
                {isRTL ? "إدارة مسار العمل" : "Manage Workflow"}
              </Button>
            )}

            <SavedViewsDropdown pageKey="board" currentConfig={currentConfig} onLoad={handleLoadView} hasUnsavedChanges={hasUnsavedChanges} />
            <BoardViewToggle value={viewMode} onChange={handleViewChange} />
          </div>
        </div>
        <div className="mt-3">
          <FilterBar />
        </div>
      </div>

      {overloadedUsers.length > 0 && (
        <div className="mx-5 mt-4 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span>
              <strong>{t("board.capacityOverload")}</strong>: {t("board.capacityOverloadDetail", { names: overloadedUsers.map((u) => `${u.name} (${u.count} active tasks)`).join(", ") })}
            </span>
          </div>
          <Button onClick={handleRequestRebalance} size="sm" className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 whitespace-nowrap">
            {t("board.runRebalancer")}
          </Button>
        </div>
      )}

      {viewMode === "board" && (
        <div className="flex-1 overflow-x-auto p-5">
        <div className="flex h-full gap-5">
          {displayColumns.map((col, index) => {
            const columnIssues = sprintIssues.filter((i) => col.matchingStatusIds.includes(i.statusId));
            return (
              <div
                key={col.id}
                className="relative h-full pr-5 last:pr-0 after:absolute after:right-2 after:top-4 after:bottom-4 after:w-px after:bg-border/70 last:after:hidden"
              >
                <BoardColumn
                  status={{ id: col.id, name: col.name, color: col.color, category: col.category as any, position: index }}
                  issues={columnIssues}
                  wipLimit={col.wip_limit}
                  stageColor={col.color}
                  draggingId={draggingId}
                  onOpen={setSelected}
                  onDragStartCard={setDraggingId}
                  onDragEndCard={() => setDraggingId(null)}
                  onDrop={(statusId, idx) => handleDrop(col.matchingStatusIds[0] || statusId, idx)}
                  onAdd={(sid) => {
                    setCreateStatusId(col.matchingStatusIds[0] || sid);
                    setCreateOpen(true);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      )}

      {viewMode === "list" && <BoardListView issues={sprintIssues} onOpen={setSelected} />}

      {viewMode === "table" && <BoardTableView issues={sprintIssues} onOpen={setSelected} />}

      <CreateIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatusId={createStatusId}
        defaultSprintId={activeSprintId}
        readOnlyProject={true}
        readOnlyStatus={true}
      />

      {/* Configurable Workflow Stage Manager Modal */}
      <WorkflowStageManagerModal open={stageManagerOpen} onOpenChange={setStageManagerOpen} projectId={projectId} onStagesUpdated={fetchStages} />

      {/* Rebalance Dialog */}
      <Dialog open={rebalanceOpen} onOpenChange={setRebalanceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("board.rebalance.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t("board.rebalance.description")}</p>
            {loadingRebalance ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">{t("board.rebalance.generating")}</span>
              </div>
            ) : proposal.length === 0 ? (
              <p className="text-sm text-center py-6 text-muted-foreground">{t("board.rebalance.empty")}</p>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="p-3 font-semibold text-muted-foreground">{t("board.rebalance.colIssue")}</th>
                      <th className="p-3 font-semibold text-muted-foreground">{t("board.rebalance.colFrom")}</th>
                      <th className="p-3 font-semibold text-muted-foreground">{t("board.rebalance.colTo")}</th>
                      <th className="p-3 font-semibold text-muted-foreground">{t("board.rebalance.colSchedule")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.map((p: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="p-3 font-medium text-foreground">
                          <span className="font-mono text-muted-foreground mr-1.5">{p.issue_key}</span>
                          {p.title}
                        </td>
                        <td className="p-3 text-muted-foreground">{p.from_assignee_name}</td>
                        <td className="p-3 text-foreground font-medium">{p.to_assignee_name}</td>
                        <td className="p-3 text-amber-600 font-medium">{p.due_date_shift_days > 0 ? t("board.rebalance.daysShift", { days: p.due_date_shift_days }) : t("board.rebalance.optimizedTimeline")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRebalanceOpen(false)} disabled={applyingRebalance}>
              {t("board.rebalance.discard")}
            </Button>
            <Button onClick={handleApplyRebalance} disabled={applyingRebalance || proposal.length === 0}>
              {applyingRebalance ? t("board.rebalance.applying") : t("board.rebalance.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BoardPage;
