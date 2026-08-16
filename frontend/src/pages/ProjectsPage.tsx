import React, { useState, useEffect, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KanbanSquare, Check, ArrowRight, Loader2, FileText, Plus, Info, CheckCircle2, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

interface ProjectSummary {
  id: string;
  name: string;
  key: string;
  type?: string;
  classification?: string;
  presale_type?: string | null;
  status?: string;
  issueCount?: number;
  client_request_id?: string | number | null;
  client_request?: { id: string | number; title: string } | null;
}

interface ProjectListResponse {
  data?: ProjectSummary[];
  items?: ProjectSummary[];
  projects?: ProjectSummary[];
}

function projectTypeLabel(type: string | undefined, t: (key: string) => string) {
  return type === "kanban" ? t("projects.kanban") : t("projects.scrum");
}

function projectStageLabel(project: ProjectSummary, t: (key: string) => string) {
  if (project.classification === "presale") {
    return project.presale_type ? project.presale_type.toUpperCase() : t("projects.presale");
  }
  if (project.classification === "rnd") {
    return t("projects.rnd", { defaultValue: "R&D" });
  }
  return t("settings.flowPostsale");
}

function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const [deletingProject, setDeletingProject] = useState<ProjectSummary | null>(null);
  const projects = useProjectCatalogStore((s) => s.projects);
  const loading = useProjectCatalogStore((s) => s.loading);
  const error = useProjectCatalogStore((s) => s.error);
  const refreshProjects = useProjectCatalogStore((s) => s.refreshProjects);
  const activeProjectId = useProjectCatalogStore((s) => s.activeProjectId);
  const setProjectContext = useProjectCatalogStore((s) => s.setProjectContext);
  const setActiveProjectId = useProjectCatalogStore((s) => s.setActiveProjectId);
  const canCreate = hasRole("super-admin", "admin");

  useEffect(() => {
    const msg = (location.state as any)?.successMessage;
    if (msg) {
      toast.success(msg, {
        duration: 6000,
        style: {
          backgroundColor: "#10b981",
          color: "#ffffff",
          fontWeight: "600",
        },
      });
    }
  }, [location.state]);

  useLayoutEffect(() => {
    if (!projects.length) return;

    const projectIds = projects.map((project) => String(project.id));
    const projectNames = projects.map((project) => project.name);
    const primaryProjectId = String(activeProjectId ?? projects[0]?.id ?? "");

    setProjectContext({
      mode: "all",
      projectIds,
      primaryProjectId,
      label: t("app.allProjects"),
      projectNames,
    });
  }, [activeProjectId, projects, setProjectContext, t]);

  const handleDeleteProject = async (p: ProjectSummary) => {
    try {
      await api.del(`/projects/${p.id}`);
      await refreshProjects();
      toast.success(t("projects.deletedSuccess", { name: p.name }));
    } catch (e: any) {
      toast.error(e?.message || t("projects.deleteFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("projects.title")}
          subtitle={loading ? t("recovery.loading") : t("projects.subtitle", { count: projects.length, plural: projects.length !== 1 ? "s" : "" })}
          actions={
            canCreate ? (
              <Button size="sm" className="gap-1.5" onClick={() => navigate("/projects/new")}>
                <Plus className="h-4 w-4" /> {t("projects.newProject")}
              </Button>
            ) : undefined
          }
        />

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { void refreshProjects(); }}>
              {t("projects.retry")}
            </Button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/20 bg-primary text-primary-foreground">
              <KanbanSquare className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-foreground">
              {canCreate ? t("projects.emptyAdminTitle", { defaultValue: "Create your first project" }) : t("projects.emptyTitle", { defaultValue: "No projects yet" })}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {canCreate
                ? t("projects.emptyAdminSubtitle", { defaultValue: "Projects hold your issues, sprints, and roadmap. Set one up to get the team moving." })
                : t("projects.emptySubtitle", { defaultValue: "You'll see projects here once one is created and you're added to it." })}
            </p>
            {canCreate && (
              <Button size="sm" className="mt-2 gap-1.5" onClick={() => navigate("/projects/new")}>
                <Plus className="h-4 w-4" /> {t("projects.newProject")}
              </Button>
            )}
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const current = p.id === activeProjectId;
              return (
                // ponytail: role="button" div instead of a real <button> so the
                // nested "from request" link below is valid HTML (no button-in-button).
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveProjectId(p.id, false);
                    navigate(`/projects/${p.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveProjectId(p.id, false);
                      navigate(`/projects/${p.id}`);
                    }
                  }}
                  className={cn(
                    "group flex cursor-pointer flex-col rounded-xl border bg-card p-4 text-left transition-colors",
                    current ?
                    "border-primary ring-1 ring-primary" :
                    "border-border hover:border-muted-foreground/40"
                  )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <KanbanSquare className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.key} · {projectTypeLabel(p.type, t)} · {projectStageLabel(p, t)}
                        </p>
                      </div>
                    </div>
                    {canCreate && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        title={t("projects.deleteProjectTooltip")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(p);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <div>
                      <p className="text-lg font-semibold leading-none text-foreground">
                        {p.issueCount ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("projects.issuesLabel")}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {projectStageLabel(p, t)}
                    </span>
                    {current ?
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Check className="h-4 w-4" /> {t("projects.current")}
                    </span> :

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      {t("projects.open")} <ArrowRight className="h-4 w-4" />
                    </span>
                    }
                  </div>

                  {p.client_request_id && p.client_request?.title && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/requests?requestId=${p.client_request_id}`);
                      }}
                      className="mt-3 truncate text-left text-xs text-primary hover:underline"
                    >
                      {t("projects.fromRequest", { title: p.client_request.title })}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${p.id}`);
                    }}
                    className="mt-2 inline-flex w-fit items-center gap-1 text-left text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    <Info className="h-3 w-3" /> {t("projects.overview")}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <ConfirmDialog
          open={deletingProject !== null}
          onOpenChange={(o) => { if (!o) setDeletingProject(null); }}
          title={t("projects.deleteTitle")}
          description={t("projects.deleteDescription", { name: deletingProject?.name })}
          onConfirm={() => { if (deletingProject) handleDeleteProject(deletingProject); }}
          confirmLabel={t("projects.deleteConfirm")}
        />
      </div>
    </div>
  );
}

export default ProjectsPage;
