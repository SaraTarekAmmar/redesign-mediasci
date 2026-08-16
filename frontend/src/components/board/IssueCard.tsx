




import React from "react";
import { MessageSquare } from "lucide-react";
import type { Issue } from "../../data/types";
import { lookups } from "../../store/useStore";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";
import { UserAvatar } from "../common/UserAvatar";
import { LabelChip } from "../common/LabelChip";
import { cn } from "../../lib/utils";
import { useProjectCatalogStore } from "../../store/useProjectCatalog";

interface Props {
  issue: Issue;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  dragging?: boolean;
}

export const IssueCard = React.memo(function IssueCard({ issue, onOpen, onDragStart, onDragEnd, dragging }: Props) {
  const epic = issue.epicId ? lookups.epicById[issue.epicId] : undefined;
  const project = useProjectCatalogStore((s) => s.projects.find((p) => String(p.id) === String(issue.projectId)));
  const comments = issue.comments ?? [];

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", issue.id);
        onDragStart(issue.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(issue.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(issue.id);
        }
      }}
      className={cn(
        "group cursor-pointer select-none rounded-lg border border-border bg-card p-3 shadow-sm",
        "transition-all hover:border-ring/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging && "opacity-40"
      )}>
      
      {epic &&
      <div className="mb-2 flex items-center gap-1.5">
          <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${epic.color}1f`, color: epic.color }}>
          
            {epic.name}
          </span>
        </div>
      }

      <p className="text-sm font-medium leading-snug text-card-foreground line-clamp-3">
        {issue.title}
      </p>

      {project &&
      <div className="mt-1.5">
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {project.name}
          </span>
        </div>
      }

      {issue.labelIds.length > 0 &&
      <div className="mt-2 flex flex-wrap gap-1">
          {issue.labelIds.map((id) =>
        <LabelChip key={id} labelId={id} />
        )}
        </div>
      }

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <IssueTypeIcon typeKey={issue.typeKey} className="h-4 w-4" />
          <span className="font-mono text-xs">{issue.key}</span>
          <PriorityIcon priorityId={issue.priorityId} />
          {comments.length > 0 &&
          <span className="flex items-center gap-0.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              {comments.length}
            </span>
          }
        </div>

        <div className="flex items-center gap-2">
          {typeof issue.storyPoints === "number" &&
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground">
              {issue.storyPoints}
            </span>
          }
          <UserAvatar userId={issue.assigneeId} size="sm" />
        </div>
      </div>
    </div>);
});
