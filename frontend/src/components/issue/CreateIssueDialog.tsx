




import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Label } from "../ui/Label";
import { DatePicker } from "../ui/DatePicker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem } from
"../ui/SelectEnhanced";
import { useStore, lookups } from "../../store/useStore";
import { WorkforceBadge } from "../common/WorkforceBadge";
import type { IssueTypeKey } from "../../data/types";
import { LabelChip } from "../common/LabelChip";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getActiveProjectId } from "../../lib/api";
import { useProjectCatalogStore } from "../../store/useProjectCatalog";
import { useParams } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatusId?: string;
  defaultSprintId?: string;
  readOnlyProject?: boolean;
  readOnlyStatus?: boolean;
}

export function CreateIssueDialog({
  open,
  onOpenChange,
  defaultStatusId,
  defaultSprintId,
  readOnlyProject = false,
  readOnlyStatus = false,
}: Props) {
  const { t } = useTranslation();
  const createIssue = useStore((s) => s.createIssue);
  const setSelectedIssue = useStore((s) => s.setSelectedIssue);
  const isLoading = useStore((s) => s.isLoading);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectList = useProjectCatalogStore((s) => s.projects);
  const settings = activeProject?.settings ?? {};
  const requireScopeSummary = Boolean(settings.requireScopeSummary);
  const requireAcceptanceCriteria = Boolean(settings.requireAcceptanceCriteria);
  const requireDueDate = Boolean(settings.requireDueDate);

  const location = useLocation();
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [typeKey, setTypeKey] = useState<IssueTypeKey>("task");
  const [statusId, setStatusId] = useState(defaultStatusId ?? "s2");
  const [priorityId, setPriorityId] = useState("pr3");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [epicId, setEpicId] = useState<string>("none");
  const [points, setPoints] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [workstream, setWorkstream] = useState<"presale" | "postsale" | "none">("none");
  const [openSelect, setOpenSelect] = useState<string | null>(null);

  const isProjectContext = (pathname: string) => {
    if (pathname.startsWith("/projects/") && pathname !== "/projects/new") return true;
    const projectPaths = ["/issues", "/board", "/backlog", "/sprints", "/roadmap", "/gantt", "/scope", "/validation", "/custom-fields"];
    return projectPaths.includes(pathname);
  };

  const inProject = isProjectContext(location.pathname);
  const currentProjectId =
    routeProjectId && location.pathname.startsWith("/projects/") && location.pathname !== "/projects/new"
      ? String(routeProjectId)
      : getActiveProjectId() || String(activeProject?.id ?? "");

  const fetchProjectData = useStore((s) => s.fetchProjectData);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setAcceptanceCriteria("");
      setTypeKey("task");
      setAssigneeId("unassigned");
      setEpicId("none");
      setPoints("");
      setDueDate("");
      setLabelIds([]);
      setWorkstream("none");

      if ((readOnlyProject || inProject) && currentProjectId) {
        setSelectedProjectId(currentProjectId);
      } else {
        setSelectedProjectId("");
      }
    }
  }, [open, inProject, currentProjectId, readOnlyProject]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectData(selectedProjectId);
    }
  }, [selectedProjectId, fetchProjectData]);

  useEffect(() => {
    if (selectedProjectId && !isLoading) {
      const defaultStatus = lookups.statuses[0];
      setStatusId(defaultStatusId || (defaultStatus ? String(defaultStatus.id) : ""));

      const defaultPriority = lookups.priorities.find((p) => p.name.toLowerCase() === "medium") || lookups.priorities[0];
      setPriorityId(defaultPriority ? String(defaultPriority.id) : "");
    }
  }, [selectedProjectId, isLoading, defaultStatusId]);

  const submit = () => {
    if (!selectedProjectId) {
      toast.error(t("createIssue.selectProjectFirst"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("createIssue.summaryRequired"));
      return;
    }
    if (requireScopeSummary && !description.trim()) {
      toast.error(t("createIssue.scopeRequired"));
      return;
    }
    if (requireAcceptanceCriteria && !acceptanceCriteria.trim()) {
      toast.error(t("createIssue.acceptanceRequired"));
      return;
    }
    if (requireDueDate && !dueDate) {
      toast.error(t("createIssue.dueDateRequired"));
      return;
    }
    const issue = createIssue({
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: selectedProjectId,
      typeKey,
      statusId,
      priorityId,
      assigneeId: assigneeId.startsWith("int-") ? assigneeId.slice(4) : undefined,
      externalAssigneeId: assigneeId.startsWith("ext-") ? assigneeId.slice(4) : undefined,
      epicId: epicId === "none" ? undefined : epicId,
      sprintId: defaultSprintId,
      labelIds,
      storyPoints: points ? Number(points) : undefined,
      dueDate: dueDate || undefined,
      workstream: workstream === "none" ? undefined : workstream,
      customFields: {
        acceptance_criteria: acceptanceCriteria.trim() || undefined,
      },
    });
    toast.success(`${issue.key} created`, { description: issue.title });
    onOpenChange(false);
    setSelectedIssue(issue.id);
  };

  const selectedProject = projectList.find((p) => String(p.id) === selectedProjectId);
  const selectedStatus = lookups.statusById[statusId];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createIssue.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>{t("createIssue.project")}</Label>
            {readOnlyProject ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {selectedProject?.name || t("createIssue.selectProject")}
              </div>
            ) : (
              <Select
                value={selectedProjectId}
                open={openSelect === "project"}
                onOpenChange={(open) => setOpenSelect(open ? "project" : null)}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("createIssue.selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projectList.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("createIssue.type")}</Label>
              <Select value={typeKey} open={openSelect === "type"} onOpenChange={(open) => setOpenSelect(open ? "type" : null)} onValueChange={(v) => setTypeKey(v as IssueTypeKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lookups.issueTypes.map((t) =>
                  <SelectItem key={t.key} value={t.key}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("createIssue.status")}</Label>
              {readOnlyStatus ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {selectedStatus?.name || t("createIssue.status")}
                </div>
              ) : (
                <Select value={statusId} open={openSelect === "status"} onOpenChange={(open) => setOpenSelect(open ? "status" : null)} onValueChange={setStatusId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lookups.statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-title">{t("createIssue.summary")}</Label>
            <Input
              id="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("createIssue.summaryPlaceholder")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }} />
            
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-desc" className="flex items-center gap-2">
              <span>{t("createIssue.description")}</span>
              {requireScopeSummary ? <span className="text-xs font-medium text-destructive">{t("createIssue.required")}</span> : null}
            </Label>
            <Textarea
              id="issue-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createIssue.descriptionPlaceholder")}
              rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-acceptance" className="flex items-center gap-2">
              <span>{t("createIssue.acceptanceCriteria")}</span>
              {requireAcceptanceCriteria ? <span className="text-xs font-medium text-destructive">{t("createIssue.required")}</span> : null}
            </Label>
            <Textarea
              id="issue-acceptance"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder={t("createIssue.acceptancePlaceholder")}
              rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("createIssue.priority")}</Label>
              <Select value={priorityId} open={openSelect === "priority"} onOpenChange={(open) => setOpenSelect(open ? "priority" : null)} onValueChange={setPriorityId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lookups.priorities.map((p) =>
                  <SelectItem key={p.id} value={p.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("createIssue.assignee")}</Label>
              <Select value={assigneeId} open={openSelect === "assignee"} onOpenChange={(open) => setOpenSelect(open ? "assignee" : null)} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{t("createIssue.unassigned")}</SelectItem>
                  {/* Only eligible project workforce members (internal teams + external partners) */}
                  {lookups.workforce.map((w) => (
                    <SelectItem key={`${w.type}-${w.id}`} value={`${w.type === "internal" ? "int" : "ext"}-${w.id}`}>
                      <span className="inline-flex items-center gap-2">
                        <WorkforceBadge type={w.type} />
                        <span>{w.name}</span>
                        {w.source && <span className="text-xs text-muted-foreground">— {w.source}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("createIssue.epic")}</Label>
              <Select value={epicId} open={openSelect === "epic"} onOpenChange={(open) => setOpenSelect(open ? "epic" : null)} onValueChange={setEpicId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("createIssue.noEpic")}</SelectItem>
                  {lookups.epics.map((e) =>
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("createIssue.workstream")}</Label>
              <Select value={workstream} open={openSelect === "workstream"} onOpenChange={(open) => setOpenSelect(open ? "workstream" : null)} onValueChange={(v) => setWorkstream(v as "presale" | "postsale" | "none")}>
                <SelectTrigger><SelectValue placeholder={t("createIssue.selectWorkstream")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("createIssue.notSet")}</SelectItem>
                  <SelectItem value="presale">{t("filterBar.presale")}</SelectItem>
                  <SelectItem value="postsale">{t("filterBar.postsale")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <span>{t("createIssue.dueDate")}</span>
                {requireDueDate ? <span className="text-xs font-medium text-destructive">{t("createIssue.required")}</span> : null}
              </Label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder={t("createIssue.selectDueDate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-points">{t("createIssue.storyPoints")}</Label>
              <Input
                id="issue-points"
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="-" />
              
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("createIssue.labels")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const uniqueLabelMap = new Map<string, typeof lookups.labels[0]>();
                lookups.labels.forEach((l) => {
                  if (l && l.name && !uniqueLabelMap.has(l.name.toLowerCase())) {
                    uniqueLabelMap.set(l.name.toLowerCase(), l);
                  }
                });
                return Array.from(uniqueLabelMap.values()).map((l) => {
                  const active = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() =>
                        setLabelIds((prev) =>
                          prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                        )
                      }
                      className={cn(
                        "rounded-full transition-all",
                        active ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100"
                      )}
                    >
                      <LabelChip labelId={l.id} />
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("app.cancel")}</Button>
          <Button onClick={submit}>{t("createIssue.title")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
