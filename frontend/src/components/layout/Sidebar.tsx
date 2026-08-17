import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  KanbanSquare,
  ListTodo,
  Route as RoadmapIcon,
  Target,
  BarChart3,
  Settings,
  ShieldAlert,
  GitPullRequestArrow,
  UsersRound,
  Clock,
  FileText,
  Wallet,
  Building2,
  Repeat,
  Contact,
  BookOpen,
  TrendingUp,
  Check,
  Send,
  ShieldCheck,
  CheckSquare2,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  GanttChart,
  Inbox,
  SlidersHorizontal,
  LineChart,
  PieChart,
  Layers,
  Network,
  FolderKanban,
  Archive,
  ClipboardCheck,
  UserPlus,
  Handshake,
  Activity,
  AlertTriangle,
  ArrowRight,
  X,
  Shield,
  Presentation,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/Dialog";
import { getProjectScope, setProjectScope } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";
import { useProjectCatalogStore } from "../../store/useProjectCatalog";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  roles?: string[];
  permissions?: string[];
}

export const allGroups: { headingKey: string; items: NavItem[] }[] = [
  {
    headingKey: "Administration",
    items: [
      { to: "/administration", labelKey: "nav.administration", icon: Shield, roles: ["super-admin", "admin"] },
    ],
  },
  {
    headingKey: "Planning",
    items: [
      { to: "/", labelKey: "nav.summary", icon: LayoutDashboard, end: true },
      { to: "/scope", labelKey: "nav.scope", icon: Target, roles: ["super-admin", "admin", "project-manager", "team-leader", "viewer"], permissions: ["view-scope"] },
      { to: "/board", labelKey: "nav.board", icon: KanbanSquare },
      { to: "/issues", labelKey: "nav.issues", icon: CheckSquare2, roles: ["super-admin", "admin"] },
      { to: "/sprints", labelKey: "nav.sprints", icon: Repeat, end: true, roles: ["super-admin", "admin", "project-manager", "team-leader", "developer"], permissions: ["view-sprints"] },
      { to: "/sprints/global", labelKey: "nav.globalSprints", icon: Layers },
      { to: "/backlog", labelKey: "nav.backlog", icon: ListTodo },
      { to: "/triage", labelKey: "nav.triage", icon: Inbox, roles: ["super-admin", "admin", "project-manager"], permissions: ["view-issues"] },
      { to: "/roadmap", labelKey: "nav.roadmap", icon: RoadmapIcon, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["view-projects"] },
      { to: "/enterprise-gantt", labelKey: "nav.enterpriseGantt", icon: Network, roles: ["super-admin", "admin", "project-manager"] },
      { to: "/plan-comparison", labelKey: "nav.planComparison", icon: TrendingUp, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["view-analytics"] },
      { to: "/gantt", labelKey: "nav.gantt", icon: GanttChart, roles: ["super-admin", "admin", "project-manager"], permissions: ["view-projects"] },
    ],
  },
  {
    headingKey: "Pre-Sales",
    items: [
      { to: "/clients", labelKey: "nav.clients", icon: Building2, roles: ["super-admin", "admin", "project-manager", "team-leader", "account-manager"] },
      { to: "/requests", labelKey: "nav.requests", icon: Inbox, roles: ["super-admin", "admin", "project-manager", "team-leader", "account-manager"] },
      { to: "/proposals", labelKey: "nav.proposals", icon: BookOpen, roles: ["super-admin", "admin", "project-manager", "team-leader", "account-manager"] },
      { to: "/presentations", labelKey: "nav.presentations", icon: Presentation, roles: ["super-admin", "admin", "project-manager", "team-leader", "account-manager"] },
    ],
  },
  {
    headingKey: "Delivery",
    items: [
      { to: "/risks", labelKey: "nav.risks", icon: ShieldAlert, roles: ["super-admin", "admin", "project-manager", "team-leader", "developer"], permissions: ["view-risks"] },
      { to: "/changes/my-requests", labelKey: "nav.myRequests", icon: Send, roles: ["super-admin", "admin", "project-manager", "team-leader", "developer", "member"], permissions: ["view-change-requests"] },
      { to: "/changes/approvals", labelKey: "nav.approvals", icon: ShieldCheck, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["approve-change-requests"] },
      { to: "/validation", labelKey: "nav.validation", icon: CheckSquare2, roles: ["super-admin", "admin", "project-manager", "team-leader"] },
      { to: "/priority-impact", labelKey: "nav.priorityImpact", icon: GitPullRequestArrow, roles: ["super-admin", "admin", "project-manager", "team-leader"] },
      { to: "/resources", labelKey: "nav.resources", icon: UsersRound, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["view-resources"] },
      { to: "/workforce", labelKey: "nav.workforce", icon: Handshake, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["view-projects"] },
      { to: "/partners", labelKey: "nav.partners", icon: Handshake, roles: ["super-admin", "admin"] },
      { to: "/time-logs", labelKey: "nav.timeLogs", icon: Clock },
      { to: "/stakeholders", labelKey: "nav.stakeholders", icon: Contact, end: true, roles: ["super-admin", "admin", "project-manager", "team-leader", "viewer"], permissions: ["view-stakeholders"] },
      { to: "/stakeholders/analytics", labelKey: "nav.stakeholderAnalytics", icon: PieChart, roles: ["super-admin", "admin", "project-manager", "team-leader", "viewer"], permissions: ["view-stakeholders"] },
      { to: "/stakeholders/registration", labelKey: "nav.stakeholderRegistration", icon: UserPlus, roles: ["super-admin", "admin", "project-manager", "team-leader", "viewer"], permissions: ["view-stakeholders"] },
      { to: "/stakeholders/engagement", labelKey: "nav.stakeholderEngagement", icon: Activity, roles: ["super-admin", "admin", "project-manager", "team-leader", "viewer"], permissions: ["view-stakeholders"] },
      { to: "/stakeholders/impact", labelKey: "nav.stakeholderImpact", icon: AlertTriangle, roles: ["super-admin", "admin", "project-manager", "team-leader", "viewer"], permissions: ["view-stakeholders"] },
      { to: "/documents", labelKey: "nav.documents", icon: FileText },
      { to: "/automation", labelKey: "nav.automation", icon: Zap, roles: ["super-admin", "admin", "project-manager"], permissions: ["manage-settings"] },
    ],
  },
  {
    headingKey: "Insights",
    items: [
      { to: "/reports", labelKey: "nav.reports", icon: BarChart3, permissions: ["view-reports"] },
      { to: "/analytics", labelKey: "nav.analytics", icon: LineChart, roles: ["super-admin", "admin", "project-manager", "team-leader", "developer", "member", "viewer", "account-manager", "department-manager", "hr-manager", "reviewer", "executive"] },
      { to: "/budget", labelKey: "nav.budget", icon: Wallet, roles: ["super-admin", "admin", "project-manager"], permissions: ["manage-budget"] },
    ],
  },
  {
    headingKey: "Workspace",
    items: [
      { to: "/teams", labelKey: "nav.teams", icon: Layers, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["view-teams"] },
      { to: "/skills", labelKey: "nav.skills", icon: BookOpen, roles: ["super-admin", "admin", "project-manager", "team-leader"], permissions: ["manage-skills"] },
      { to: "/departments", labelKey: "nav.departments", icon: Building2, roles: ["super-admin", "admin", "project-manager"], permissions: ["view-departments"] },
      { to: "/users", labelKey: "nav.users", icon: UsersRound, roles: ["super-admin", "admin"], permissions: ["manage-users"] },
      { to: "/admin-tasks", labelKey: "nav.adminTasks", icon: ClipboardCheck, roles: ["super-admin", "admin", "team-leader"] },
      { to: "/recovery", labelKey: "nav.recovery", icon: Archive, roles: ["super-admin", "admin"] },
      { to: "/custom-fields", labelKey: "nav.customFields", icon: SlidersHorizontal, roles: ["super-admin", "admin", "project-manager"], permissions: ["manage-settings"] },
      { to: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["super-admin", "admin"], permissions: ["manage-settings"] },
    ],
  },
];

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const fallbackKey = item.labelKey.replace(/^nav\./, "");
  const commonLabel = t(item.labelKey);
  const label = commonLabel === item.labelKey ? t(fallbackKey, { ns: "nav", defaultValue: fallbackKey }) : commonLabel;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2.5 py-2",
          isRTL && !collapsed && "flex-row-reverse",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-sidebar-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          {!collapsed && isActive && (
            <span
              className={cn(
                "absolute rounded-full bg-primary transition-all duration-200",
                isRTL ? "end-0 top-1 bottom-1 w-[3px]" : "start-0 top-1 bottom-1 w-[3px]"
              )}
              aria-hidden="true"
            />
          )}
          <item.icon
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-150",
              "group-hover:scale-110"
            )}
            aria-hidden="true"
          />
          {!collapsed && <span className="min-w-0 flex-1 text-sm">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function ProjectScopeMenu({ collapsed }: { collapsed: boolean }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const location = useLocation();
  const navigate = useNavigate();
  const projectScope = getProjectScope() ?? { mode: "single" as const, projectIds: [], primaryProjectId: "" };
  const projectList = useProjectCatalogStore((s) => s.projects);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const activeProjectId = useProjectCatalogStore((s) => s.activeProjectId);
  const setActiveProjectId = useProjectCatalogStore((s) => s.setActiveProjectId);
  const setProjectContext = useProjectCatalogStore((s) => s.setProjectContext);
  const [open, setOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(projectScope.projectIds);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const scopeLabel = useMemo(() => {
    if (projectScope.mode === "all") return t("app.allProjects");
    if (projectScope.mode === "multi") return t("app.projectsSelected", { count: projectScope.projectIds.length });
    return projectScope.label || activeProject?.name || t("app.switchProject");
  }, [activeProject?.name, projectScope.label, projectScope.mode, projectScope.projectIds.length, t]);

  const scopeSubtitle = useMemo(() => {
    if (projectScope.mode === "all") return t("app.allProjects");
    if (projectScope.mode === "multi") {
      return projectScope.projectNames?.join(" · ") || projectList
        .filter((p) => projectScope.projectIds.includes(String(p.id)))
        .map((p) => p.name)
        .join(" · ");
    }
    return activeProject
      ? `${activeProject.type === "scrum" ? t("app.projectType.scrum") : t("app.projectType.kanban")} · ${activeProject.classification === "presale" ? (activeProject.presale_type ? activeProject.presale_type.toUpperCase() : t("projects.presale")) : t("settings.flowPostsale")}`
      : t("app.switchProject");
  }, [activeProject, projectScope.mode, projectScope.projectIds, projectScope.projectNames, projectList, t]);

  useEffect(() => {
    const fallbackId = String(activeProjectId ?? activeProject?.id ?? "");
    setSelectedProjectIds(
      projectScope.projectIds.length
        ? projectScope.projectIds
        : fallbackId ? [fallbackId] : []
    );
  }, [activeProject?.id, activeProjectId, projectScope.mode, projectScope.primaryProjectId, projectScope.projectIds.join(",")]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu || typeof window === "undefined") return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const menuWidth = Math.min(menuRect.width || 320, window.innerWidth - 16);
      const menuHeight = menuRect.height || 420;
      const padding = 8;
      const maxLeft = Math.max(padding, window.innerWidth - menuWidth - padding);
      const availableBelow = window.innerHeight - triggerRect.bottom - padding;
      const availableAbove = triggerRect.top - padding;
      const openAbove = availableBelow < menuHeight && availableAbove > availableBelow;

      const top = openAbove
        ? Math.max(padding, triggerRect.top - menuHeight - 8)
        : Math.min(triggerRect.bottom + 8, Math.max(padding, window.innerHeight - menuHeight - padding));

      setMenuStyle({
        position: "fixed",
        top,
        zIndex: 1000,
        width: menuWidth,
        maxHeight: "calc(100vh - 16px)",
        ...(isRTL
          ? { right: Math.min(Math.max(window.innerWidth - triggerRect.right, padding), maxLeft) }
          : { left: Math.min(Math.max(triggerRect.left, padding), maxLeft) }),
      });
    };

    updatePosition();

    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [collapsed, isRTL, open, projectList.length, projectScope.mode, projectScope.projectIds.length, scopeLabel]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const applyCustomScope = () => {
    const selected = projectList.filter((p) => selectedProjectIds.includes(String(p.id)));
    if (!selected.length) return;
    const primaryProject = selected[0];
    setProjectScope({
      mode: selected.length === projectList.length ? "all" : selected.length === 1 ? "single" : "multi",
      projectIds: selected.map((p) => String(p.id)),
      primaryProjectId: String(primaryProject.id),
      label: selected.length === 1 ? primaryProject.name : t("app.projectsSelected", { count: selected.length }),
      projectNames: selected.map((p) => p.name),
    });
  };

  const setAllProjectsScope = () => {
    setProjectContext({
      mode: "all",
      projectIds: projectList.map((p) => String(p.id)),
      primaryProjectId: "",
      label: t("app.allProjects"),
      projectNames: projectList.map((p) => p.name),
    });
    navigate("/projects");
    setOpen(false);
  };

  const openProjectPicker = () => {
    setSelectedProjectIds(projectScope.projectIds.length ? projectScope.projectIds : projectList.map((p) => String(p.id)));
    setProjectPickerOpen(true);
    setOpen(false);
  };

  const handleProjectSelect = (projectId: string) => {
    setActiveProjectId(projectId, false);
    navigate(`/projects/${projectId}`);
    setOpen(false);
  };

  const itemClasses = "cursor-pointer rounded-lg px-2.5 py-2 text-sm transition-colors";
  const triggerContent = collapsed ? (
    <span className="text-xs font-bold">{(activeProject?.key || "PR").slice(0, 2)}</span>
  ) : (
    <>
      <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
        {(activeProject?.key || "PR").slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1 text-start">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{scopeLabel}</p>
        <p className="truncate text-xs text-muted-foreground">{scopeSubtitle}</p>
      </div>
    </>
  );

  return (
    <>
      <div className={collapsed ? "mx-2 mb-2" : "mx-3 mb-2"}>
        <button
          ref={triggerRef}
          type="button"
          title={collapsed ? scopeLabel : t("app.switchProject")}
          aria-label={t("app.switchProject")}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={collapsed
            ? "flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border bg-background/50 transition-colors hover:bg-muted/70"
            : "flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-background/50 px-2.5 py-2 transition-colors hover:bg-muted/70"
          }
        >
          {triggerContent}
        </button>
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("app.switchProject")}
          style={menuStyle}
          className="w-80 max-h-[420px] flex flex-col p-1.5 shadow-xl border border-border rounded-xl bg-popover"
        >
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("app.switchProject")}</div>
          <button
            type="button"
            className={cn(itemClasses, "flex items-center gap-2 font-medium")}
            onClick={setAllProjectsScope}
          >
            <CheckSquare2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 text-start">{t("app.allProjects")}</span>
            {projectScope.mode === "all" && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          </button>

          <div className="my-1 border-t border-border" />

          <div className="max-h-[190px] space-y-0.5 overflow-y-auto pr-1.5 scroll-smooth custom-scrollbar">
            {projectList.map((p) => {
              const current = projectScope.mode === "all" || (projectScope.mode === "single" && String(p.id) === String(projectScope.primaryProjectId || activeProjectId || activeProject?.id || ""));
              const pKey = (p.key || p.name || "PR").slice(0, 2).toUpperCase();
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cn(itemClasses, "flex w-full items-center gap-2")}
                  onClick={() => handleProjectSelect(String(p.id))}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                    {pKey}
                  </span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.key || "PROJ"} · {p.type === "scrum" ? t("app.projectType.scrum") : t("app.projectType.kanban")}
                    </span>
                  </span>
                  {current && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className={cn(itemClasses, "flex items-center gap-2 text-muted-foreground hover:text-foreground")}
            onClick={openProjectPicker}
          >
            <UsersRound className="h-4 w-4 opacity-70" aria-hidden="true" />
            <span>{t("app.selectProjects")}</span>
          </button>
          <button
            type="button"
            className={cn(itemClasses, "flex items-center justify-between font-semibold text-primary hover:text-primary")}
            onClick={() => {
              navigate("/projects");
              setOpen(false);
            }}
          >
            <span>{t("app.viewAllProjects")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>,
        document.body
      )}

      <Dialog open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("app.selectProjects")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
            {projectList.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent/50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(String(p.id))}
                    onChange={(e) => {
                      const projectId = String(p.id);
                      setSelectedProjectIds((current) =>
                        e.target.checked ? [...current, projectId] : current.filter((id) => id !== projectId)
                      );
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.key} · {p.type === "scrum" ? t("app.projectType.scrum") : t("app.projectType.kanban")} · {p.classification === "presale" ? (p.presale_type ? p.presale_type.toUpperCase() : t("projects.presale")) : t("settings.flowPostsale")}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.type === "scrum" ? t("app.projectType.scrum") : t("app.projectType.kanban")} · {p.classification === "presale" ? (p.presale_type ? p.presale_type.toUpperCase() : t("projects.presale")) : t("settings.flowPostsale")}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectPickerOpen(false)}>
              {t("app.cancel")}
            </Button>
            <Button
              onClick={() => {
                applyCustomScope();
                setProjectPickerOpen(false);
              }}
              disabled={!selectedProjectIds.length}
            >
              {t("app.applyScope")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarBody({
  collapsed,
  groups,
  onNavigate,
}: {
  collapsed: boolean;
  groups: { headingKey: string; items: NavItem[] }[];
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className={cn("flex items-center py-4", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <KanbanSquare className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-sidebar-foreground">{t("app.title")}</p>
            <p className="truncate text-xs text-muted-foreground">{t("app.workspace")}</p>
          </div>
        )}
      </div>

      <ProjectScopeMenu collapsed={collapsed} />

      <nav className="flex-1 overflow-y-auto px-3 py-2" onClick={onNavigate}>
        {groups.map((group) => {
          const headingId = `sidebar-group-${group.headingKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          const headingLabel = group.headingKey === "Active Project"
            ? t("nav.activeProject", { defaultValue: "Active project" })
            : t(`${group.headingKey.toLocaleLowerCase()}.heading`, { ns: "nav", defaultValue: group.headingKey });
          return (
            <section key={group.headingKey} aria-labelledby={headingId} className={group.headingKey === "Active Project" ? "mb-0" : "mb-1"}>
              {!collapsed && (
                <h2 id={headingId} className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {headingLabel}
                </h2>
              )}
              {collapsed && <span id={headingId} className="sr-only">{headingLabel}</span>}
              {collapsed && <div className="my-2 border-t border-sidebar-border" aria-hidden="true" />}
              <div className={cn("space-y-0.5", collapsed && "space-y-1")}>
                {group.items.map((item) => (
                  <NavRow key={item.to} item={item} collapsed={collapsed} />
                ))}
              </div>
            </section>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen?: boolean; onCloseMobile?: () => void }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isRTL = i18n.dir() === "rtl";
  const { hasRole, hasPermission } = useAuth();
  const activeProjectIdFromStore = useProjectCatalogStore((s) => s.activeProjectId);
  const projectScopeModeFromStore = useProjectCatalogStore((s) => s.projectScopeMode);
  const projectScope = getProjectScope() ?? { mode: "single" as const, projectIds: [], primaryProjectId: "" };

  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const routeProjectId = (projectMatch && projectMatch[1] !== "new") ? projectMatch[1] : undefined;

  const effectiveActiveProjectId = useMemo(() => {
    if (routeProjectId) return routeProjectId;
    if (location.pathname === "/projects" || location.pathname === "/" || projectScopeModeFromStore === "all" || projectScope.mode === "all") {
      return "";
    }
    return activeProjectIdFromStore || projectScope.primaryProjectId || "";
  }, [routeProjectId, location.pathname, projectScopeModeFromStore, activeProjectIdFromStore, projectScope.mode, projectScope.primaryProjectId]);

  const wideScope = (projectScopeModeFromStore === "all" || projectScope.mode === "all" || projectScope.mode === "multi") && !effectiveActiveProjectId;
  const hiddenWideScopeRoutes = new Set(["/scope", "/board", "/issues", "/triage", "/roadmap", "/sprints", "/backlog", "/validation"]);
  const executiveAllowedRoutes = new Set(["/", "/reports"]);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  const groups = useMemo(() => {
    const baseGroups = allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (wideScope && hiddenWideScopeRoutes.has(item.to)) {
            if (item.to === "/issues" && hasRole("super-admin", "admin")) {
              // Allow Issues page in wide scope for admin roles
            } else {
              return false;
            }
          }
          if (hasRole("executive") && !executiveAllowedRoutes.has(item.to)) return false;
          const roleAllowed = !item.roles || hasRole(...item.roles);
          const permissionAllowed = !item.permissions || item.permissions.some((permission) => hasPermission(permission));
          return roleAllowed && permissionAllowed;
        }),
      }))
      .filter((group) => group.items.length > 0);

    if (effectiveActiveProjectId) {
      baseGroups.push({
        headingKey: "Active Project",
        items: [
          { to: `/projects/${effectiveActiveProjectId}`, labelKey: "nav.projectOverview", icon: FolderKanban, end: true },
        ],
      });
    }

    return baseGroups;
  }, [hasPermission, hasRole, wideScope, effectiveActiveProjectId, location.pathname]);

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseMobile?.(); };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, onCloseMobile]);

  const sidebarCollapseLabel = isRTL ? "اغلاق" : "Collapse sidebar";
  const sidebarExpandLabel = isRTL ? "فتح" : "Expand sidebar";

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-e border-sidebar-border bg-sidebar md:flex transition-[width] duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-[60px]" : "w-60"
        )}
        role="navigation"
        aria-label={t("app.mainNavigation")}
        dir={i18n.dir()}
      >
        <SidebarBody collapsed={collapsed} groups={groups} />

        <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex justify-center")}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? sidebarExpandLabel : sidebarCollapseLabel}
            aria-label={collapsed ? sidebarExpandLabel : sidebarCollapseLabel}
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              collapsed && "px-2"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>{sidebarCollapseLabel}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile nav drawer — below md, the desktop <aside> is hidden entirely. */}
      {mobileOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1200] md:hidden" role="dialog" aria-modal="true" aria-label={t("app.mainNavigation")}>
          <div className="absolute inset-0 bg-black/50" onClick={onCloseMobile} aria-hidden="true" />
          <div
            className={cn(
              "absolute top-0 flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl",
              isRTL ? "end-0 border-s border-sidebar-border" : "start-0 border-e border-sidebar-border"
            )}
            dir={i18n.dir()}
          >
            <div className="flex items-center justify-end px-2 pt-2">
                              <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label={t("app.closeNavigation")}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"

              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarBody collapsed={false} groups={groups} onNavigate={onCloseMobile} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
