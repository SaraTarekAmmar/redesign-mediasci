
import React from "react";
import {
  Bookmark,
  CheckSquare,
  Bug,
  Zap,
  GitBranch } from
"lucide-react";
import type { IssueTypeKey } from "../../data/types";
import { lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";

const iconByType: Record<IssueTypeKey, React.ComponentType<{className?: string;}>> = {
  story: Bookmark,
  task: CheckSquare,
  bug: Bug,
  epic: Zap,
  subtask: GitBranch
};

interface Props {
  typeKey: IssueTypeKey;
  className?: string;
  title?: boolean;
}

export function IssueTypeIcon({ typeKey, className, title = true }: Props) {
  const type = lookups.typeByKey[typeKey];
  const Icon = iconByType[typeKey] ?? CheckSquare;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[4px]",
        className
      )}
      style={{ backgroundColor: type?.color, color: "white" }}
      title={title ? type?.name : undefined}
      aria-label={type?.name}>
      
      <Icon className="h-[70%] w-[70%]" />
    </span>);

}