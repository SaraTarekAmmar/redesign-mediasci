import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, AlertTriangle } from "lucide-react";
import type { Issue, IssueStatus } from "../../data/types";
import { IssueCard } from "./IssueCard";
import { cn } from "../../lib/utils";

interface Props {
  status: IssueStatus;
  issues: Issue[];
  wipLimit?: number | null;
  stageColor?: string;
  draggingId: string | null;
  onOpen: (id: string) => void;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDrop: (statusId: string, index: number) => void;
  onAdd: (statusId: string) => void;
}

export const BoardColumn = React.memo(function BoardColumn({
  status,
  issues,
  wipLimit,
  stageColor,
  draggingId,
  onOpen,
  onDragStartCard,
  onDragEndCard,
  onDrop,
  onAdd,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const [isOver, setIsOver] = useState(false);
  const sorted = [...issues].sort((a, b) => a.position - b.position);

  const isWipExceeded = wipLimit !== undefined && wipLimit !== null && wipLimit > 0 && sorted.length > wipLimit;
  const activeColor = stageColor || status.color || "#6366F1";

  return (
    <div className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-border/70 bg-card/95 p-4 shadow-lg shadow-black/5">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: activeColor }} aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            {status.name}
          </h3>
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded font-mono font-semibold",
              isWipExceeded ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" : "text-muted-foreground bg-secondary"
            )}
          >
            {sorted.length}
            {wipLimit ? ` / ${wipLimit}` : ""}
          </span>
        </div>
        <button
          onClick={() => onAdd(status.id)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`${t("app.addIssue")} – ${status.name}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* WIP Limit Warning Banner */}
      {isWipExceeded && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{isRTL ? `تم تجاوز حد العمل (${sorted.length}/${wipLimit})` : `WIP limit exceeded (${sorted.length}/${wipLimit})`}</span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          onDrop(status.id, sorted.length);
        }}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto rounded-lg p-1 transition-colors",
          isOver ? "bg-accent/60 ring-2 ring-inset ring-ring/40" : "bg-transparent"
        )}
      >
        {sorted.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            dragging={draggingId === issue.id}
            onOpen={onOpen}
            onDragStart={onDragStartCard}
            onDragEnd={onDragEndCard}
          />
        ))}

        {sorted.length === 0 && (
          <button
            onClick={() => onAdd(status.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> {t("app.addIssue")}
          </button>
        )}
      </div>
    </div>
  );
});
