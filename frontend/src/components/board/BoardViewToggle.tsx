import React from "react";
import { LayoutGrid, List, Table } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export type ViewMode = "board" | "list" | "table";

const STORAGE_KEY = "board-view-mode";

export function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "board" || v === "list" || v === "table") return v;
  } catch {}
  return "board";
}

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const modes: { key: ViewMode; icon: typeof LayoutGrid; labelKey: string }[] = [
  { key: "board", icon: LayoutGrid, labelKey: "board.view.board" },
  { key: "list", icon: List, labelKey: "board.view.list" },
  { key: "table", icon: Table, labelKey: "board.view.table" },
];

export const BoardViewToggle = React.memo(function BoardViewToggle({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
      {modes.map((m) => {
        const Icon = m.icon;
        const active = value === m.key;
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(m.labelKey)}
          </button>
        );
      })}
    </div>
  );
});
