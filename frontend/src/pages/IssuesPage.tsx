import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare2, Loader2, Calendar, Plus } from "lucide-react";
import { useStore, lookups, matchesFilters } from "../store/useStore";
import { PageHeader } from "../components/common/PageHeader";
import { FilterBar } from "../components/common/FilterBar";
import { IssueTypeIcon } from "../components/common/IssueTypeIcon";
import { PriorityIcon } from "../components/common/PriorityIcon";
import { UserAvatar } from "../components/common/UserAvatar";
import { LabelChip } from "../components/common/LabelChip";
import { getActiveProjectId, getProjectScope } from "../lib/api";
import { format } from "date-fns";
import { Button } from "../components/ui/Button";
import { CreateIssueDialog } from "../components/issue/CreateIssueDialog";
import { useAuth } from "../hooks/useAuth";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

export function IssuesPage() {
  const { t } = useTranslation();
  const { hasRole, hasPermission } = useAuth();
  const issues = useStore((s) => s.issues);
  const filters = useStore((s) => s.filters);
  const setSelected = useStore((s) => s.setSelectedIssue);
  const fetchProjectData = useStore((s) => s.fetchProjectData);
  const isLoading = useStore((s) => s.isLoading);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);

  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = hasRole("super-admin", "admin", "project-manager", "team-leader", "developer") || hasPermission("create-issues");

  const projectId = getActiveProjectId() || String(activeProject?.id ?? "");
  const scope = getProjectScope() ?? {
    mode: "single" as const,
    projectIds: projectId ? [projectId] : [],
    primaryProjectId: projectId,
    label: activeProject?.name,
    projectNames: activeProject?.name ? [activeProject.name] : [],
  };
  const projectIds = (scope.projectIds || [projectId]).filter(Boolean).map(String);

  useEffect(() => {
    projectIds.forEach((id) => {
      fetchProjectData(id);
    });
  }, [JSON.stringify(projectIds), fetchProjectData]);

  const projectIssues = useMemo(() => {
    const filtered = issues.filter(
      (i) =>
        projectIds.includes(String(i.projectId ?? activeProject?.id ?? projectId)) &&
        matchesFilters(i, filters)
    );
    return [...filtered].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      const numA = Number(a.id) || 0;
      const numB = Number(b.id) || 0;
      if (numA && numB) return numA - numB;
      return a.id.localeCompare(b.id);
    });
  }, [issues, projectIds, filters]);

  if (isLoading && issues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4 shrink-0">
        <PageHeader
          title={t("nav.issues", { defaultValue: "Issues" })}
          subtitle={t("issuesPage.subtitle", {
            count: projectIssues.length,
            noun: projectIssues.length === 1 ? "issue" : "issues",
          })}
          actions={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> {t("issuesPage.create")}
              </Button>
            ) : undefined
          }
        />
        <div className="mt-3">
          <FilterBar />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("issuesPage.colKey")}</th>
                <th className="px-4 py-3 font-medium">{t("issuesPage.colSummary")}</th>
                <th className="px-4 py-3 font-medium">{t("issuesPage.colType")}</th>
                <th className="px-4 py-3 font-medium">{t("issuesPage.colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("issuesPage.colPriority")}</th>
                <th className="px-4 py-3 font-medium">{t("issuesPage.colAssignee")}</th>
                <th className="px-4 py-3 font-medium">{t("issuesPage.colDueDate")}</th>
              </tr>
            </thead>
            <tbody>
              {projectIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <CheckSquare2 className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{t("issuesPage.empty")}</p>
                      <p className="text-xs text-muted-foreground">{t("issuesPage.emptyHint")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                projectIssues.map((issue) => {
                  const status = lookups.statusById[issue.statusId];
                  const priority = lookups.priorityById[issue.priorityId];
                  const type = lookups.typeByKey[issue.typeKey];

                  return (
                    <tr
                      key={issue.id}
                      onClick={() => setSelected(issue.id)}
                      className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {issue.key}
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground line-clamp-1">
                            {issue.title}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {issue.labelIds.slice(0, 3).map((id) => (
                              <LabelChip key={id} labelId={id} />
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          <IssueTypeIcon typeKey={issue.typeKey} className="h-4 w-4" />
                          <span>{type?.name ?? issue.typeKey}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {status && (
                          <span
                            className="rounded px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              backgroundColor: `${status.color}1a`,
                              color: status.color,
                            }}
                          >
                            {status.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <PriorityIcon priorityId={issue.priorityId} />
                          <span>{priority?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UserAvatar userId={issue.assigneeId} externalId={issue.externalAssigneeId} size="sm" />
                          <span className="text-xs">
                            {issue.assigneeId
                              ? lookups.userById[issue.assigneeId]?.name
                              : issue.externalAssigneeId
                              ? lookups.partnerMemberById[issue.externalAssigneeId]?.name ?? t("issuesPage.unassigned")
                              : t("issuesPage.unassigned")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {issue.dueDate ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(issue.dueDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateIssueDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export default IssuesPage;
