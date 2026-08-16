import React from "react";

interface Props {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * The one card shell every page section should reach for instead of hand-rolling
 * `rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm` inline — that ad-hoc
 * pattern is why pages drifted out of sync with each other. Flat border, no ambient
 * shadow, matches the Gumroad "Getting started" card language.
 */
export function SectionCard({ title, action, className = "", bodyClassName = "", children }: Props) {
  return (
    <div className={`rounded-xl border border-border bg-card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          {title && <h2 className="text-sm font-bold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
