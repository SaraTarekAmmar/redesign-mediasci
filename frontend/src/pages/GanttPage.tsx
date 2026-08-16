import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, GitBranch, Filter } from "lucide-react";
import { useStore, lookups } from "../store/useStore";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/SelectEnhanced";
import { GanttChart } from "../components/charts/GanttChart";

type ZoomLevel = "day" | "week" | "month";

function GanttPage() {
  const { t } = useTranslation();
  const issues = useStore((s) => s.issues);
  const setSelectedIssue = useStore((s) => s.setSelectedIssue);

  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [showDeps, setShowDeps] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const ganttTasks = useMemo(() => {
    return issues
      .filter((issue) => {
        if (filterAssignee !== "all" && issue.assigneeId !== filterAssignee) return false;
        if (filterStatus !== "all" && issue.statusId !== filterStatus) return false;
        if (filterType !== "all" && issue.typeKey !== filterType) return false;
        return true;
      })
      .map((issue) => {
        const start = issue.createdAt ? new Date(issue.createdAt) : new Date();
        const end = issue.dueDate ? new Date(issue.dueDate) : new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);

        // Extend start if it's the same as end
        if (start.getTime() === end.getTime()) {
          end.setDate(end.getDate() + 3);
        }

        const status = lookups.statusById[issue.statusId];
        const progress = status?.category === "done" ? 100 : status?.category === "in_progress" ? 50 : 0;

        return {
          id: issue.id,
          key: issue.key,
          title: issue.title,
          startDate: start,
          endDate: end,
          assigneeId: issue.assigneeId,
          typeKey: issue.typeKey,
          priorityId: issue.priorityId,
          statusId: issue.statusId,
          progress,
        };
      });
  }, [issues, filterAssignee, filterStatus, filterType]);

  const ganttSummary = useMemo(() => {
    return {
      tasks: ganttTasks.length,
      zoomLabel:
        zoom === "day" ? t("gantt.zoom.day") : zoom === "week" ? t("gantt.zoom.week") : t("gantt.zoom.month"),
    };
  }, [ganttTasks.length, zoom]);

  // Real declared blocking relationships (TaskDependency), not a same-epic heuristic.
  // "blocks": this issue -> dependsOn is the blocked one (from = this, to = dependsOn).
  // "is_blocked_by": dependsOn blocks this issue (from = dependsOn, to = this).
  // relates_to/duplicates aren't ordering relationships, so they're not drawn as arrows.
  const dependencies = useMemo(() => {
    if (!showDeps) return [];
    const deps: { from: string; to: string }[] = [];
    issues.forEach((issue) => {
      issue.dependencies?.forEach((dep) => {
        if (dep.type === "blocks") deps.push({ from: issue.id, to: dep.dependsOnId });
        else if (dep.type === "is_blocked_by") deps.push({ from: dep.dependsOnId, to: issue.id });
      });
    });
    return deps;
  }, [issues, showDeps]);

  const handleTaskClick = (taskId: string) => {
    setSelectedIssue(taskId);
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("gantt.title")}
          subtitle={t("gantt.subtitle")}
          actions={
            <div className="flex items-center gap-2">
              {/* Filters */}
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger size="sm" className="w-[140px]">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder={t("gantt.filterAssignee")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("gantt.allAssignees")}</SelectItem>
                  {lookups.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger size="sm" className="w-[130px]">
                  <SelectValue placeholder={t("gantt.filterStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("gantt.allStatuses")}</SelectItem>
                  {lookups.statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger size="sm" className="w-[120px]">
                  <SelectValue placeholder={t("gantt.filterType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("gantt.allTypes")}</SelectItem>
                  {lookups.issueTypes.map((tp) => (
                    <SelectItem key={tp.key} value={tp.key}>{tp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Dependency toggle */}
              <Button
                size="sm"
                variant={showDeps ? "default" : "outline"}
                onClick={() => setShowDeps(!showDeps)}
                className="gap-1.5"
              >
                <GitBranch className="h-3.5 w-3.5" />
                {t("gantt.dependencies")}
              </Button>

              {/* Zoom controls */}
              <div className="flex items-center rounded-lg border border-border bg-card">
                <Button
                  size="sm"
                  variant={zoom === "day" ? "default" : "ghost"}
                  onClick={() => setZoom("day")}
                  className="rounded-r-none"
                >
                  {t("gantt.zoom.day")}
                </Button>
                <Button
                  size="sm"
                  variant={zoom === "week" ? "default" : "ghost"}
                  onClick={() => setZoom("week")}
                  className="rounded-none border-x border-border"
                >
                  {t("gantt.zoom.week")}
                </Button>
                <Button
                  size="sm"
                  variant={zoom === "month" ? "default" : "ghost"}
                  onClick={() => setZoom("month")}
                  className="rounded-l-none"
                >
                  {t("gantt.zoom.month")}
                </Button>
              </div>
            </div>
          }
        />

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("gantt.summary.title", { defaultValue: "What this shows" })}</p>
            <p className="mt-1 text-sm text-foreground">
              {t("gantt.summary.body", {
                defaultValue: "A timeline of work items showing when tasks start, finish, and overlap.",
              })}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("gantt.summary.visible", { defaultValue: "Visible tasks" })}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{ganttSummary.tasks}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("gantt.summary.zoom", { defaultValue: "Current zoom" })}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{ganttSummary.zoomLabel}</p>
          </div>
        </div>

        <GanttChart
          tasks={ganttTasks}
          dependencies={dependencies}
          zoom={zoom}
          onTaskClick={handleTaskClick}
        />
      </div>
    </div>
  );
}

export default GanttPage;
