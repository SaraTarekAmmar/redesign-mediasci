import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Issue } from "../../data/types";
import { lookups } from "../../store/useStore";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";
import { UserAvatar } from "../common/UserAvatar";
import { LabelChip } from "../common/LabelChip";
import { cn } from "../../lib/utils";
import { format } from "date-fns";

interface Props {
  issues: Issue[];
  onOpen: (id: string) => void;
}

type SortKey = "key" | "title" | "status" | "priority" | "type" | "assignee" | "storyPoints" | "sprint" | "dueDate" | "labels";
type SortDir = "asc" | "desc";

export const BoardTableView = React.memo(function BoardTableView({ issues, onOpen }: Props) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>("key");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...issues];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "key":
          cmp = a.key.localeCompare(b.key);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status": {
          const sa = lookups.statusById[a.statusId]?.position ?? 0;
          const sb = lookups.statusById[b.statusId]?.position ?? 0;
          cmp = sa - sb;
          break;
        }
        case "priority": {
          const pa = lookups.priorityById[a.priorityId]?.level ?? 99;
          const pb = lookups.priorityById[b.priorityId]?.level ?? 99;
          cmp = pa - pb;
          break;
        }
        case "type":
          cmp = a.typeKey.localeCompare(b.typeKey);
          break;
        case "assignee": {
          const ua = a.assigneeId ? lookups.userById[a.assigneeId]?.name ?? "" : "";
          const ub = b.assigneeId ? lookups.userById[b.assigneeId]?.name ?? "" : "";
          cmp = ua.localeCompare(ub);
          break;
        }
        case "storyPoints":
          cmp = (a.storyPoints ?? 0) - (b.storyPoints ?? 0);
          break;
        case "sprint": {
          const sa = a.sprintId ? lookups.sprintById[a.sprintId]?.name ?? "" : "";
          const sb = b.sprintId ? lookups.sprintById[b.sprintId]?.name ?? "" : "";
          cmp = sa.localeCompare(sb);
          break;
        }
        case "dueDate":
          cmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
          break;
        case "labels":
          cmp = a.labelIds.length - b.labelIds.length;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [issues, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  const th = (col: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {th("key", t("planComparison.col.task"))}
              {th("title", "Title")}
              {th("status", t("planComparison.col.status"))}
              {th("priority", t("roadmap.priority"))}
              {th("type", "Type")}
              {th("assignee", t("planComparison.col.assignee"))}
              {th("storyPoints", t("roadmap.storyPoints"))}
              {th("sprint", "Sprint")}
              {th("dueDate", t("planComparison.col.due"))}
              {th("labels", "Labels")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue) => {
              const status = lookups.statusById[issue.statusId];
              const priority = lookups.priorityById[issue.priorityId];
              const sprint = issue.sprintId ? lookups.sprintById[issue.sprintId] : undefined;

              return (
                <tr
                  key={issue.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(issue.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(issue.id);
                    }
                  }}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/30 last:border-b-0"
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <IssueTypeIcon typeKey={issue.typeKey} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{issue.key}</span>
                    </span>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 font-medium text-foreground">
                    {issue.title}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${status?.color}18`, color: status?.color }}
                    >
                      {status?.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      <PriorityIcon priorityId={issue.priorityId} />
                      <span className="text-xs text-muted-foreground">{priority?.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs capitalize text-muted-foreground">
                    {issue.typeKey}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <UserAvatar userId={issue.assigneeId} externalId={issue.externalAssigneeId} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {typeof issue.storyPoints === "number" ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">
                        {issue.storyPoints}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {sprint?.name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {issue.dueDate ? format(new Date(issue.dueDate), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {issue.labelIds.map((id) => (
                        <LabelChip key={id} labelId={id} />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("backlog.noIssues")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
