import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronDown, MoveRight, MoveLeft, ListTodo, Loader2 } from "lucide-react";
import { ListChecks } from "lucide-react";
import { useStore, lookups, matchesFilters } from "../store/useStore";
import type { Issue } from "../data/types";
import { FilterBar } from "../components/common/FilterBar";
import { SavedViewsDropdown } from "../components/common/SavedViewsDropdown";
import { CreateIssueDialog } from "../components/issue/CreateIssueDialog";
import { IssueTypeIcon } from "../components/common/IssueTypeIcon";
import { PriorityIcon } from "../components/common/PriorityIcon";
import { UserAvatar } from "../components/common/UserAvatar";
import { LabelChip } from "../components/common/LabelChip";
import { Button } from "../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator } from
"../components/ui/DropdownMenuEnhanced";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import type { SavedViewConfig } from "../hooks/useSavedViews";
import { getActiveProjectId } from "../lib/api";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

function IssueRow({ issue, onOpen }: {issue: Issue;onOpen: (id: string) => void;}) {
  const { t } = useTranslation();
  const moveToSprint = useStore((s) => s.moveToSprint);
  const status = lookups.statusById[issue.statusId];
  const projects = useProjectCatalogStore((s) => s.projects);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(issue.id)}
      onKeyDown={(e) => e.key === "Enter" ? onOpen(issue.id) : undefined}
      className="group flex items-center gap-3 border-b border-border last:border-b-0 last:rounded-b-lg px-4 py-2.5 transition-colors hover:bg-accent/50 focus:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">

      <IssueTypeIcon typeKey={issue.typeKey} className="h-4 w-4" />
      <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
      {(() => {
        const issueProject = projects.find((p) => p.id === issue.projectId);
        return issueProject ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {issueProject.name}
          </span>
        ) : null;
      })()}
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>

      <div className="hidden items-center gap-1.5 sm:flex">
        {issue.labelIds.slice(0, 2).map((id) =>
        <LabelChip key={id} labelId={id} />
        )}
      </div>

      <span
        className="hidden rounded px-2 py-0.5 text-[11px] font-medium md:inline-block"
        style={{ backgroundColor: `${status.color}1f`, color: status.color }}>
        
        {status.name}
      </span>

      <PriorityIcon priorityId={issue.priorityId} />

      {typeof issue.storyPoints === "number" &&
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">
          {issue.storyPoints}
        </span>
      }

      <UserAvatar userId={issue.assigneeId} externalId={issue.externalAssigneeId} size="sm" />

      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100" aria-label={t("backlog.moveIssue")}>
              <MoveRight className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("backlog.moveTo")}</DropdownMenuLabel>
            {lookups.sprints.map((sp) =>
            <DropdownMenuItem
              key={sp.id}
              disabled={issue.sprintId === sp.id}
              onSelect={() => {
                moveToSprint(issue.id, sp.id);
                toast.success(t("backlog.movedToSprint", { key: issue.key, sprint: sp.name }));
              }}>
              
                {sp.name}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!issue.sprintId}
              onSelect={() => {
                moveToSprint(issue.id, undefined);
                toast.success(t("backlog.movedToBacklog", { key: issue.key }));
              }}>
              
              <MoveLeft className="mr-2 h-4 w-4" /> {t("backlog.title")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>);

}

function Section({
  title,
  subtitle,
  issues,
  onOpen,
  onAdd,
  defaultOpen = true







}: {title: string;subtitle?: string;issues: Issue[];onOpen: (id: string) => void;onAdd: () => void;defaultOpen?: boolean;}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const points = issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  return (
    <div className="mb-4 rounded-xl border border-border bg-card overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between bg-muted/30 px-3 py-2.5 border-b border-border/60">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left group">
          <span className="transition-transform duration-200" style={{ display: 'inline-flex', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{title}</span>
          {subtitle && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{subtitle}</span>}
          <span className="flex items-center gap-1">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{issues.length} {t("sprints.issues")}</span>
            {points > 0 && <span className="text-[10px] text-muted-foreground">{points} {t("backlog.points")}</span>}
          </span>
        </button>
        <Button variant="ghost" size="sm" onClick={onAdd} className="gap-1 text-muted-foreground hover:text-primary">
          <Plus className="h-4 w-4" /> {t("backlog.addToSprint")}
        </Button>
      </div>
      {open && (
        <div>
          {issues.length > 0 ?
            issues.map((i) => <IssueRow key={i.id} issue={i} onOpen={onOpen} />) :
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <ListTodo className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">{t("backlog.noIssues")}</p>
            </div>
          }
        </div>
      )}
    </div>);

}

function BacklogPage() {
  const { t } = useTranslation();
  const issues = useStore((s) => s.issues);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const toggleArrayFilter = useStore((s) => s.toggleArrayFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const setSelected = useStore((s) => s.setSelectedIssue);
  const fetchProjectData = useStore((s) => s.fetchProjectData);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const isLoading = useStore((s) => s.isLoading);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSprintId, setCreateSprintId] = useState<string | undefined>(undefined);
  const [sortField, setSortField] = useState("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const lastSavedConfigRef = useRef<string>("");

  const projectId = getActiveProjectId() || String(activeProject?.id ?? "");

  useEffect(() => {
    if (projectId) {
      fetchProjectData(projectId);
    }
  }, [projectId, fetchProjectData]);

  const getCurrentConfig = useCallback((): SavedViewConfig => ({
    filters: { ...filters },
    sortField,
    sortOrder,
    viewMode: "list",
    groupBy: "sprint",
  }), [filters, sortField, sortOrder]);

  const currentConfig = getCurrentConfig();
  const hasUnsavedChanges = lastSavedConfigRef.current !== "" &&
    JSON.stringify(currentConfig) !== lastSavedConfigRef.current;

  const handleLoadView = useCallback((config: SavedViewConfig) => {
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
    lastSavedConfigRef.current = JSON.stringify(config);
  }, [clearFilters, setFilter, toggleArrayFilter, filters]);

  const filtered = useMemo(
    () => issues.filter((i) => matchesFilters(i, filters)),
    [issues, filters]
  );

  const bySprint = (id: string) =>
  filtered.filter((i) => i.sprintId === id).sort((a, b) => a.position - b.position);
  const backlog = filtered.
  filter((i) => !i.sprintId).
  sort((a, b) => a.position - b.position);

  const openCreate = (sprintId?: string) => {
    setCreateSprintId(sprintId);
    setCreateOpen(true);
  };

  if (isLoading && issues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-primary text-primary-foreground">
              <ListChecks className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[1.4rem] font-bold tracking-tight text-foreground leading-tight">{t("backlog.title")}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("backlog.description")}
              </p>
            </div>
          </div>
          <SavedViewsDropdown
            pageKey="backlog"
            currentConfig={currentConfig}
            onLoad={handleLoadView}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
        <div className="mt-3">
          <FilterBar />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {lookups.sprints.map((sp) =>
        <Section
          key={sp.id}
          title={sp.name}
          subtitle={sp.status === "active" ? t("sprints.active") : sp.status === "planning" ? t("sprints.planning") : t("sprints.completed")}
          issues={bySprint(sp.id)}
          onOpen={setSelected}
          onAdd={() => openCreate(sp.id)} />

        )}
        <Section
          title={t("backlog.title")}
          issues={backlog}
          onOpen={setSelected}
          onAdd={() => openCreate(undefined)} />
        
      </div>

      <CreateIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatusId={createSprintId ? "s2" : "s1"}
        defaultSprintId={createSprintId} />
      
    </div>);

}
export default BacklogPage;
