import React from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { ProjectIntelligenceResponse } from "../../pages/PlanComparisonPage";

interface ProjectSummaryPanelProps {
  projectData: ProjectIntelligenceResponse | null;
}

export function ProjectSummaryPanel({ projectData }: ProjectSummaryPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-slate-900">
        Executive Summary
      </h2>
      <div className="grid gap-4">
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <h3 className="font-semibold text-rose-900">Critical Issues</h3>
          </div>
          <div className="space-y-2">
            {(projectData?.summary.executive_summary?.attention ?? []).length > 0 ? (
              (projectData?.summary.executive_summary?.attention ?? []).map((item) => (
                <p key={item} className="text-sm text-rose-700 flex items-start gap-1.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  {item}
                </p>
              ))
            ) : (
              <p className="text-sm text-rose-700">No critical issues reported.</p>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Needs Attention</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-amber-700 flex items-start gap-1.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Schedule variance is trending negative in Phase 2.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-900">On Track</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-emerald-700 flex items-start gap-1.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Delivery remains within the current execution plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
