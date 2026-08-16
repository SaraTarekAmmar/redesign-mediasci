
import React from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon, badge, actions, action }: Props) {
  const displayActions = actions || action;
  return (
    <div className="page-header mb-7 flex flex-wrap items-end justify-between gap-4 animate-fade-in">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="page-header__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/20 bg-primary text-primary-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.035em] text-foreground leading-tight">{title}</h1>
            {badge && <div className="animate-scale-in">{badge}</div>}
          </div>
          {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {displayActions && <div className="flex items-center gap-2">{displayActions}</div>}
    </div>
  );
}