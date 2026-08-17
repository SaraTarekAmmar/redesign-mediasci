import React from "react";
import { useTranslation } from "react-i18next";
import { ListFilter, Search, X } from "lucide-react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { UserAvatar } from "./UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropdownMenuEnhanced";
import { useStore, lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
        checked && "bg-accent/60"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path
              d="M2.5 6.5l2 2 5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
}

export function FilterBar() {
  const { t } = useTranslation();
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const toggle = useStore((s) => s.toggleArrayFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const count = useStore((s) => s.activeFilterCount());

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          placeholder={t("filterBar.searchIssues")}
          className="h-9 pl-8"
          aria-label={t("filterBar.searchIssuesLabel")}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={count > 0 ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            aria-label={t("filterBar.openFilters", { defaultValue: "Open filters" })}
          >
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            {t("filterBar.filters", { defaultValue: "Filters" })}
            {count > 0 && (
              <span className="ml-0.5 rounded bg-primary-foreground/20 px-1.5 text-[10px] text-current">
                {count}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[min(72vh,32rem)] w-72 overflow-y-auto p-1.5">
          <DropdownMenuLabel>{t("filterBar.assignee", { defaultValue: "Assignee" })}</DropdownMenuLabel>
          {lookups.users.map((u) => (
            <CheckRow
              key={u.id}
              checked={filters.assigneeIds.includes(u.id)}
              onToggle={() => toggle("assigneeIds", u.id)}
            >
              <span className="inline-flex items-center gap-2">
                <UserAvatar userId={u.id} size="xs" />
                <span className="truncate">{u.name}</span>
              </span>
            </CheckRow>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("filterBar.issueType")}</DropdownMenuLabel>
          {lookups.issueTypes.map((it) => (
            <CheckRow
              key={it.key}
              checked={filters.typeKeys.includes(it.key)}
              onToggle={() => toggle("typeKeys", it.key)}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} aria-hidden="true" />
                {it.name}
              </span>
            </CheckRow>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("filterBar.epic")}</DropdownMenuLabel>
          {lookups.epics.map((e) => (
            <CheckRow
              key={e.id}
              checked={filters.epicIds.includes(e.id)}
              onToggle={() => toggle("epicIds", e.id)}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: e.color }} aria-hidden="true" />
                {e.name}
              </span>
            </CheckRow>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("filterBar.label")}</DropdownMenuLabel>
          {lookups.labels.map((l) => (
            <CheckRow
              key={l.id}
              checked={filters.labelIds.includes(l.id)}
              onToggle={() => toggle("labelIds", l.id)}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
                {l.name}
              </span>
            </CheckRow>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("filterBar.workstream")}</DropdownMenuLabel>
          <CheckRow
            checked={filters.workstream === "presale"}
            onToggle={() => setFilter("workstream", filters.workstream === "presale" ? "" : "presale")}
          >
            {t("filterBar.presale")}
          </CheckRow>
          <CheckRow
            checked={filters.workstream === "postsale"}
            onToggle={() => setFilter("workstream", filters.workstream === "postsale" ? "" : "postsale")}
          >
            {t("filterBar.postsale")}
          </CheckRow>
        </DropdownMenuContent>
      </DropdownMenu>

      {count > 0 && (
        <>
          <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {t("filterBar.activeCount", { count, defaultValue: `${count} active filter${count === 1 ? "" : "s"}` })}
          </span>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-4 w-4" aria-hidden="true" />
            {t("filterBar.clear")}
          </Button>
        </>
      )}
    </div>
  );
}
