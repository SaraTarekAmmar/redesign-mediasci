import React, { useState } from "react";
import { Check, X, FolderPlus, UserPlus, ClipboardList, Timer } from "lucide-react";

export interface ChecklistStep {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}

const DISMISS_KEY = "getting-started-dismissed";

/**
 * Gumroad-style "Getting started" checklist for a brand-new workspace — the app had no
 * first-run guidance at all (empty dashboard, empty project list, no hint what to do
 * first). Driven by real data booleans, not a canned tour. Dismissible, sticks via
 * localStorage like Gumroad's own "Show less".
 */
export function GettingStartedChecklist({ steps }: { steps: ChecklistStep[] }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const allDone = steps.every((s) => s.done);
  if (dismissed || allDone) return null;

  const doneCount = steps.filter((s) => s.done).length;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Getting started</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{doneCount}/{steps.length} complete</p>
        </div>
        <button
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {steps.map((step) => (
          <button
            key={step.key}
            onClick={step.onClick}
            disabled={step.done}
            className={`group relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all ${
              step.done
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
            }`}
          >
            <span
              className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border ${
                step.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
              }`}
            >
              {step.done && <Check className="h-2.5 w-2.5" />}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 bg-muted text-foreground">
              {step.icon}
            </span>
            <span className="text-xs font-semibold text-foreground">{step.label}</span>
            <span className="text-[11px] text-muted-foreground">{step.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
