import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, MessageSquare } from "lucide-react";
import type { Issue, IssueStatus } from "../../data/types";
import { lookups } from "../../store/useStore";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";
import { UserAvatar } from "../common/UserAvatar";
import { cn } from "../../lib/utils";
import { format } from "date-fns";

interface Props {
  issues: Issue[];
  onOpen: (id: string) => void;
}

export const BoardListView = React.memo(function BoardListView({ issues, onOpen }: Props) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const boardStatusIds = lookups.statuses.map((s) => s.id);

  const grouped = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const sid of boardStatusIds) map.set(sid, []);
    for (const issue of issues) {
      const arr = map.get(issue.statusId);
      if (arr) arr.push(issue);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [issues, boardStatusIds]);
  const getComments = (issue: Issue) => issue.comments ?? [];

  const toggle = (statusId: string) =>
    setCollapsed((prev) => ({ ...prev, [statusId]: !prev[statusId] }));

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="space-y-3">
        {boardStatusIds.map((statusId) => {
          const status = lookups.statusById[statusId];
          const groupIssues = grouped.get(statusId) ?? [];
          const isCollapsed = !!collapsed[statusId];

          return (
            <div key={statusId} className="rounded-lg border border-border bg-card">
              <button
                onClick={() => toggle(statusId)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm font-semibold text-foreground">{status.name}</span>
                <span className="text-xs text-muted-foreground">({groupIssues.length})</span>
              </button>

              {!isCollapsed && groupIssues.length > 0 && (
                <div className="border-t border-border">
                  {groupIssues.map((issue) => (
                    <div
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
                      className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-b-0 transition-colors hover:bg-accent/30"
                    >
                      <IssueTypeIcon typeKey={issue.typeKey} className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground shrink-0">{issue.key}</span>
                      <span className="flex-1 truncate text-sm text-foreground">{issue.title}</span>
                      <PriorityIcon priorityId={issue.priorityId} />
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${status.color}18`,
                          color: status.color,
                        }}
                      >
                        {status.name}
                      </span>
                      {typeof issue.storyPoints === "number" && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">
                          {issue.storyPoints}
                        </span>
                      )}
                      <UserAvatar userId={issue.assigneeId} size="sm" />
                      {issue.dueDate && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {format(new Date(issue.dueDate), "MMM d")}
                        </span>
                      )}
                      {getComments(issue).length > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {getComments(issue).length}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isCollapsed && groupIssues.length === 0 && (
                <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
                  {t("backlog.noIssues")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
