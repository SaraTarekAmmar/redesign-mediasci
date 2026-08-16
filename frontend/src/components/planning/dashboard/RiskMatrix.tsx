import React from "react";
import { ShieldAlert } from "lucide-react";

interface RiskMatrixProps {
  blockedCount?: number;
  openRisksCount?: number;
  onTrackCount?: number;
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({
  blockedCount = 0,
  openRisksCount = 0,
  onTrackCount = 0,
}) => {
  return (
    <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4 h-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">
            Execution Risk Snapshot
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-center text-xs font-semibold">
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
          <span className="text-2xl font-bold block">{blockedCount}</span>
          <span className="text-[11px]">Blocked Milestones</span>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <span className="text-2xl font-bold block">{openRisksCount}</span>
          <span className="text-[11px]">Open Risks</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <span className="text-2xl font-bold block">{onTrackCount}</span>
          <span className="text-[11px]">On-Track Milestones</span>
        </div>
      </div>
    </div>
  );
};
