import React, { useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Workflow,
} from "lucide-react";
import { Badge } from "../../ui/Badge";
import { formatCurrency, formatHours, formatShortDate, RadialGauge } from "../SharedUI";

export interface MilestoneDrawerData {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  plannedHours?: number;
  actualHours?: number;
  plannedBudget?: number;
  actualCost?: number;
  completionPercentage?: number;
  scheduleVarianceDays?: number;
  blocked?: boolean;
  blockingReason?: string | null;
  ownerResource?: { name: string; position?: string | null; email?: string | null } | null;
  deliverables?: { id: number; title: string; status: string; planned_completion_date?: string | null }[];
  issues?: { id: number; key: string; title: string; status?: string | null; done?: boolean }[];
  blockingMilestones?: { id: number; name: string }[];
}

interface MilestoneDrawerProps {
  milestone: MilestoneDrawerData | null;
  onClose: () => void;
}

export const MilestoneDrawer: React.FC<MilestoneDrawerProps> = ({
  milestone,
  onClose,
}) => {
  useEffect(() => {
    if (!milestone) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [milestone, onClose]);

  if (!milestone) return null;

  const isCompleted = milestone.status === "completed";
  const isBlocked = milestone.blocked;
  const isDelayed = (milestone.scheduleVarianceDays || 0) > 0;
  const completionPct = milestone.completionPercentage || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Milestone details: ${milestone.name}`}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between gap-4 bg-muted/20 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge
                variant={
                  isBlocked
                    ? "danger"
                    : isCompleted
                    ? "success"
                    : isDelayed
                    ? "warning"
                    : "outline"
                }
              >
                {isBlocked
                  ? "Blocked"
                  : isCompleted
                  ? "Completed"
                  : isDelayed
                  ? "Delayed"
                  : milestone.status}
              </Badge>
              <span className="text-xs text-muted-foreground">ID #{milestone.id}</span>
            </div>
            <h2 className="text-lg font-bold text-foreground leading-snug line-clamp-2">
              {milestone.name}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <RadialGauge
              value={completionPct}
              size={56}
              strokeWidth={6}
              color={isCompleted ? "stroke-emerald-500" : isBlocked ? "stroke-rose-500" : "stroke-primary"}
              label={<span className="text-xs font-bold text-foreground">{completionPct}%</span>}
            />
            <button
              onClick={onClose}
              aria-label="Close milestone details"
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Blocked Alert Notice */}
          {isBlocked && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Milestone Blocked
                </h4>
                <p className="text-xs mt-1">
                  {milestone.blockingReason ||
                    "This milestone is currently waiting on dependent deliverables or uncompleted predecessor milestones."}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {milestone.description && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Description
              </h4>
              <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-border/50 leading-relaxed">
                {milestone.description}
              </p>
            </div>
          )}

          {/* Owner Resource */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {milestone.ownerResource?.name || "Unassigned Owner"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {milestone.ownerResource?.position || "Resource Lead"}
                </p>
              </div>
            </div>
          </div>

          {/* Dates & Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Planned Schedule</span>
              </div>
              <p className="text-xs font-semibold text-foreground">
                {formatShortDate(milestone.plannedStartDate)} - {formatShortDate(milestone.plannedEndDate)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Actual Schedule</span>
              </div>
              <p className="text-xs font-semibold text-foreground">
                {formatShortDate(milestone.actualStartDate) || "Not Started"} - {formatShortDate(milestone.actualEndDate) || "In Progress"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-xs text-muted-foreground">Effort (Planned / Actual)</span>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {formatHours(milestone.plannedHours || 0)} / {formatHours(milestone.actualHours || 0)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-xs text-muted-foreground">Budget (Planned / Actual)</span>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {formatCurrency(milestone.plannedBudget || 0)} / {formatCurrency(milestone.actualCost || 0)}
              </p>
            </div>
          </div>

          {/* Predecessor Dependencies */}
          {milestone.blockingMilestones && milestone.blockingMilestones.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Workflow className="w-4 h-4 text-amber-500" /> Predecessor Dependencies
              </h4>
              <div className="space-y-1.5">
                {milestone.blockingMilestones.map((bm) => (
                  <div
                    key={bm.id}
                    className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-foreground">{bm.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Required
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables Checklist */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" /> Deliverables ({milestone.deliverables?.length || 0})
            </h4>
            {!milestone.deliverables || milestone.deliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-lg border border-border/50">
                No deliverables attached to this milestone.
              </p>
            ) : (
              <div className="space-y-2">
                {milestone.deliverables.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border border-border bg-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          d.status === "completed"
                            ? "text-emerald-500"
                            : "text-muted-foreground opacity-40"
                        }`}
                      />
                      <span className="text-xs font-medium text-foreground">{d.title}</span>
                    </div>
                    <Badge
                      variant={d.status === "completed" ? "success" : "outline"}
                      className="text-[10px]"
                    >
                      {d.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
