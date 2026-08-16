

import React from "react";
import { ChevronsUp, ChevronUp, Equal, ChevronDown, ChevronsDown } from "lucide-react";
import { lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";

const iconByLevel = [ChevronsUp, ChevronsUp, ChevronUp, Equal, ChevronDown, ChevronsDown];

interface Props {
  priorityId: string;
  className?: string;
  showLabel?: boolean;
}

export function PriorityIcon({ priorityId, className, showLabel }: Props) {
  const priority = lookups.priorityById[priorityId];
  if (!priority) return null;
  const Icon = iconByLevel[priority.level] ?? Equal;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={priority.name}>
      <Icon className="h-4 w-4 shrink-0" style={{ color: priority.color }} aria-hidden />
      {showLabel && <span className="text-sm">{priority.name}</span>}
    </span>);

}