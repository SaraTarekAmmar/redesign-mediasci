



import React from "react";
import { lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";

export function LabelChip({ labelId, className }: {labelId: string;className?: string;}) {
  const label = lookups.labelById[labelId];
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        className
      )}
      style={{ backgroundColor: `${label.color}1f`, color: label.color }}>
      
      {label.name}
    </span>);

}