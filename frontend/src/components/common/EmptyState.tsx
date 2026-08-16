import React from "react";

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

/** Shared "nothing here yet" block — dashed border, centered, optional CTA. */
export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
      {icon && <div className="mb-1 text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="max-w-sm text-xs text-muted-foreground">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
