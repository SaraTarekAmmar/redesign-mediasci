import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "../ui/Dialog";
import { UserAvatar } from "../common/UserAvatar";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { allGroups } from "../layout/Sidebar";
import { useStore, lookups } from "../../store/useStore";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";
import { useProjectCatalogStore } from "../../store/useProjectCatalog";

interface Props {
  /** Opens the existing "create issue" dialog owned by App. */
  onCreateIssue: () => void;
}

interface ResultItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface ResultGroup {
  key: string;
  label: string;
  items: ResultItem[];
}

const MAX_PER_GROUP = 6;

export function CommandPalette({ onCreateIssue }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasRole, hasPermission } = useAuth();
  const issues = useStore((s) => s.issues);
  const setSelectedIssue = useStore((s) => s.setSelectedIssue);
  const projects = useProjectCatalogStore((s) => s.projects);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingGRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  // Visible trigger in Topbar opens the palette via a window event, the same
  // pattern already used for the help/chat widget (see Topbar's openHelp).
  useEffect(() => {
    const openFromTopbar = () => setOpen(true);
    window.addEventListener("open-command-palette", openFromTopbar);
    return () => window.removeEventListener("open-command-palette", openFromTopbar);
  }, []);

  // Single global keydown listener for every shortcut this feature owns.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (open) return; // palette has its own onKeyDown while it's showing

      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      // Never hijack browser shortcuts (Ctrl+C copy, Ctrl+V paste, etc.).
      if (isMod || e.altKey || e.shiftKey) return;

      if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label={t("commandPalette.searchIssues")}]')?.focus();
        return;
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        onCreateIssue();
        return;
      }
      if (e.key.toLowerCase() === "g") {
        pendingGRef.current = true;
        clearTimeout(gTimerRef.current);
        gTimerRef.current = setTimeout(() => {
          pendingGRef.current = false;
        }, 800);
        return;
      }
      if (e.key.toLowerCase() === "b" && pendingGRef.current) {
        pendingGRef.current = false;
        navigate("/board");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, navigate, onCreateIssue]);

  const pageItems = useMemo(
    () =>
      allGroups
        .flatMap((g) => g.items)
        .filter((item) => {
          const roleAllowed = !item.roles || hasRole(...item.roles);
          const permAllowed = !item.permissions || item.permissions.some((p) => hasPermission(p));
          return roleAllowed && permAllowed;
        }),
    [hasRole, hasPermission]
  );

  const groups: ResultGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const includes = (s: string | undefined) => !!s && s.toLowerCase().includes(q);

    const pages: ResultItem[] = pageItems
      .filter((item) => !q || includes(t(item.labelKey)))
      .slice(0, q ? MAX_PER_GROUP : 8)
      .map((item) => ({
        id: `page-${item.to}`,
        label: t(item.labelKey),
        icon: <item.icon className="h-4 w-4" />,
        onSelect: () => {
          navigate(item.to);
          close();
        },
      }));

    const result: ResultGroup[] = [{ key: "pages", label: t("commandPalette.pages"), items: pages }];

    if (q) {
      const issueItems: ResultItem[] = issues
        .filter((i) => includes(i.key) || includes(i.title))
        .slice(0, MAX_PER_GROUP)
        .map((i) => ({
          id: `issue-${i.id}`,
          label: i.title,
          sublabel: i.key,
          icon: <IssueTypeIcon typeKey={i.typeKey} className="h-4 w-4" title={false} />,
          onSelect: () => {
            setSelectedIssue(i.id);
            close();
          },
        }));

      const projectItems: ResultItem[] = projects
        .filter((p) => includes(p.name) || includes(p.key))
        .slice(0, MAX_PER_GROUP)
        .map((p) => ({
          id: `project-${p.id}`,
          label: p.name,
          sublabel: p.key,
          icon: (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-chart-1 text-[10px] font-bold text-white">
              {p.key.slice(0, 2)}
            </span>
          ),
          onSelect: () => {
            navigate("/projects");
            close();
          },
        }));

      const peopleItems: ResultItem[] = lookups.users
        .filter((u) => includes(u.name))
        .slice(0, MAX_PER_GROUP)
        .map((u) => ({
          id: `person-${u.id}`,
          label: u.name,
          sublabel: u.role,
          icon: <UserAvatar userId={u.id} size="sm" />,
          onSelect: () => {
            navigate("/team");
            close();
          },
        }));

      result.push(
        { key: "issues", label: t("commandPalette.issues"), items: issueItems },
        { key: "projects", label: t("commandPalette.projects"), items: projectItems },
        { key: "people", label: t("commandPalette.people"), items: peopleItems }
      );
    }

    return result.filter((g) => g.items.length > 0);
  }, [query, pageItems, issues, navigate, setSelectedIssue, t]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (flatItems.length ? (i + 1) % flatItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (flatItems.length ? (i - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatItems[activeIndex]?.onSelect();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent showCloseButton={false} className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={t("commandPalette.search")}
            aria-label={t("commandPalette.search")}
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {flatItems.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("commandPalette.noResults")}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.key} className="mb-1 last:mb-0">
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map((item) => {
                flatIndex += 1;
                const isActive = flatIndex === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-index={flatIndex}
                    onClick={item.onSelect}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60"
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {t("commandPalette.hint")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
