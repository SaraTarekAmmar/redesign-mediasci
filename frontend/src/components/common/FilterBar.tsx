

import React from "react";
import { useTranslation } from "react-i18next";
import { Search, X, ListFilter } from "lucide-react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { UserAvatar } from "./UserAvatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator } from
"../ui/DropdownMenuEnhanced";
import { useStore, lookups } from "../../store/useStore";
import { cn } from "../../lib/utils";

function CheckRow({
  checked,
  onToggle,
  children




}: {checked: boolean;onToggle: () => void;children: React.ReactNode;}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
        checked && "bg-accent/60"
      )}>
      
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}>
        
        {checked &&
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2.5 6.5l2 2 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      </span>
      <span className="flex-1 text-left">{children}</span>
    </button>);

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
      <div className="relative w-64 max-w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          placeholder={t("filterBar.searchIssues")}
          className="h-8 pl-8"
          aria-label={t("filterBar.searchIssuesLabel")} />
        
      </div>

      {/* Assignee quick filter avatars */}
      <div className="flex items-center -space-x-1.5">
        {lookups.users.map((u) => {
          const active = filters.assigneeIds.includes(u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle("assigneeIds", u.id)}
              className={cn(
                "rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-0.5",
                active ? "z-10 ring-ring" : "ring-background"
              )}
              title={t("filterBar.filterByUser", { name: u.name })}
              aria-pressed={active}>
              
              <UserAvatar userId={u.id} size="sm" />
            </button>);

        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ListFilter className="h-4 w-4" />
            {t("filterBar.type")}
            {filters.typeKeys.length > 0 &&
            <span className="ml-0.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                {filters.typeKeys.length}
              </span>
            }
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 p-1.5">
          <DropdownMenuLabel>{t("filterBar.issueType")}</DropdownMenuLabel>
          {lookups.issueTypes.map((it) =>
          <CheckRow
            key={it.key}
            checked={filters.typeKeys.includes(it.key)}
            onToggle={() => toggle("typeKeys", it.key)}>

              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
                {it.name}
              </span>
            </CheckRow>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            {t("filterBar.epic")}
            {filters.epicIds.length > 0 &&
            <span className="ml-0.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                {filters.epicIds.length}
              </span>
            }
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 p-1.5">
          <DropdownMenuLabel>{t("filterBar.epic")}</DropdownMenuLabel>
          {lookups.epics.map((e) =>
          <CheckRow
            key={e.id}
            checked={filters.epicIds.includes(e.id)}
            onToggle={() => toggle("epicIds", e.id)}>
            
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: e.color }} />
                {e.name}
              </span>
            </CheckRow>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            {t("filterBar.label")}
            {filters.labelIds.length > 0 &&
            <span className="ml-0.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                {filters.labelIds.length}
              </span>
            }
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 p-1.5">
          <DropdownMenuLabel>{t("filterBar.label")}</DropdownMenuLabel>
          {lookups.labels.map((l) =>
          <CheckRow
            key={l.id}
            checked={filters.labelIds.includes(l.id)}
            onToggle={() => toggle("labelIds", l.id)}>
            
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
              </span>
            </CheckRow>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            {t("filterBar.workstream")}
            {filters.workstream &&
            <span className="ml-0.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                1
              </span>
            }
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 p-1.5">
          <DropdownMenuLabel>{t("filterBar.workstream")}</DropdownMenuLabel>
          <CheckRow
            checked={filters.workstream === "presale"}
            onToggle={() => setFilter("workstream", filters.workstream === "presale" ? "" : "presale")}>
            {t("filterBar.presale")}
          </CheckRow>
          <CheckRow
            checked={filters.workstream === "postsale"}
            onToggle={() => setFilter("workstream", filters.workstream === "postsale" ? "" : "postsale")}>
            {t("filterBar.postsale")}
          </CheckRow>
        </DropdownMenuContent>
      </DropdownMenu>

      {count > 0 &&
      <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
          <X className="h-4 w-4" /> {t("filterBar.clear")}
        </Button>
      }
    </div>);

}