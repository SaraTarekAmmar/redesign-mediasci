import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Moon, Sun, HelpCircle, Globe, ChevronDown, LogOut, Search, Menu } from "lucide-react";
import { Button } from "../ui/Button";
import { UserAvatar } from "../common/UserAvatar";
import { NotificationsPopover } from "../common/NotificationsPopover";
import { CreateMenu } from "./CreateMenu";
import { SUPPORTED_LANGUAGES, getLanguage } from "../../i18n/languages";
import { toast } from "sonner";
import { getProjectScope, localeUrl, loginUrl, logoutUrl, readXsrfToken } from "../../lib/api";
import { useProjectCatalogStore } from "../../store/useProjectCatalog";
import { lookups } from "../../store/useStore";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  onOpenIssueDialog: () => void;
  onOpenChangeRequestDialog?: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onOpenMobileNav?: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function Topbar({ onOpenIssueDialog, onOpenChangeRequestDialog, dark, onToggleDark, onOpenMobileNav }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectScopeMode = useProjectCatalogStore((s) => s.projectScopeMode);
  const projectScope = getProjectScope();
  const liveUsers = lookups.users;
  const peerAvatars = liveUsers
    .filter((entry) => String(entry.id) !== String(user?.id ?? ""))
    .slice(0, 2);

  React.useEffect(() => {
    const alerts = [
      "Sara Ammar moved issue MSCI-104 to In Review",
      "Amr Ammar completed MSCI-109 task",
      "Sara Ammar edited project scope details",
      "Amr Ammar commented on MSCI-102",
      "Mona Adel uploaded a new design mockup"
    ];
    const timer = setInterval(() => {
      const msg = alerts[Math.floor(Math.random() * alerts.length)];
      toast.info(msg, { duration: 4000 });
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  const openHelp = () => {
    window.dispatchEvent(new Event("open-chat-widget"));
  };

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    try {
      await fetch(localeUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-XSRF-TOKEN": readXsrfToken() ?? "",
        },
        body: JSON.stringify({ locale: lang }),
      });
    } catch {
      /* keep the SPA language even if session sync fails */
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-XSRF-TOKEN": readXsrfToken() ?? "",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch(logoutUrl, {
        method: "POST",
        credentials: "include",
        headers,
      });
    } catch {
      /* ignore */
    } finally {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("activeProjectId");
        localStorage.removeItem("projectScope");
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      window.location.href = "/login";
    }
  };

  const breadcrumb = projectScopeMode === "all" || projectScope.mode === "all"
    ? t("app.allProjects")
    : projectScopeMode === "multi" || projectScope.mode === "multi"
      ? t("app.projectsSelected", { count: projectScope.projectIds.length })
      : activeProject?.name ?? t("app.switchProject");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2 sm:gap-3 sm:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label={t("app.openNavigation")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span className="font-medium text-foreground">{t("app.breadcrumb.projects")}</span>
          <span aria-hidden="true">/</span>
          <span className="max-w-[16ch] truncate font-medium text-foreground">{breadcrumb}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          aria-label={t("commandPalette.search")}
          className="hidden w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 sm:flex"
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate text-start">{t("commandPalette.search")}</span>
          <kbd className="hidden shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          aria-label={t("commandPalette.search")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 sm:hidden"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <div className="relative hidden items-center sm:flex">
          <Globe className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <select
            value={getLanguage(i18n.language).code}
            onChange={(e) => changeLanguage(e.target.value)}
            aria-label={t("app.language.switch")}
            className="cursor-pointer rounded-lg border border-border bg-background ps-7 pe-6 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent/50 focus:border-primary focus:ring-1 focus:ring-primary/30 appearance-none"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeLabel}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-2 h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </div>

        <CreateMenu
          onOpenIssueDialog={onOpenIssueDialog}
          onOpenChangeRequestDialog={onOpenChangeRequestDialog}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleDark}
          aria-label={t("app.theme.toggle")}
          title={t("app.theme.toggle")}
          className="hidden sm:inline-flex"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={openHelp} aria-label={t("app.help")} title={t("app.help")} className="hidden md:inline-flex">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label={t("app.logout")} title={t("app.logout")}>
          <LogOut className="h-4 w-4" />
        </Button>

        {/* Simulated Multiplayer Live Sync Avatars */}
        <div className="hidden items-center -space-x-1.5 mr-2 lg:flex">
          <div className="relative mr-2 flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>LIVE SYNC</span>
          </div>
          {peerAvatars.map((u, index) => (
            <div
              key={u.id}
              className="group relative cursor-pointer hover:z-30 hover:scale-105 transition-all"
              onClick={() => {
                toast.info(`Multiplayer Presence: ${u.name} is currently active in the workspace`);
              }}
            >
              <UserAvatar userId={u.id} size="xs" className="ring-2 ring-background border-0 outline-none" />
              <div className="absolute top-full right-1/2 translate-x-1/2 mt-2 whitespace-nowrap hidden group-hover:block bg-slate-900 px-2 py-1 text-[10px] text-white rounded shadow z-40 dark:bg-slate-800">
                {u.name} - Active member #{index + 1}
              </div>
            </div>
          ))}
        </div>

        <NotificationsPopover />

        <Link to="/profile" className="ms-1" title={t("nav.profile", { defaultValue: "View profile" })} aria-label={t("nav.profile", { defaultValue: "View profile" })}>
          <UserAvatar userId={String(user?.id ?? "")} size="sm" />
        </Link>
      </div>
    </header>
  );
}
