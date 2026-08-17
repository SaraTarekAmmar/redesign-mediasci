import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Toaster } from "./components/ui/Sonner";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { ChatWidget } from "./components/layout/ChatWidget";
import { IssueDetailSheet } from "./components/issue/IssueDetailSheet";
import { CreateIssueDialog } from "./components/issue/CreateIssueDialog";
import { CommandPalette } from "./components/command/CommandPalette";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { useStore } from "./store/useStore";
import { statuses } from "./data/seed";
import { useProjectCatalogStore } from "./store/useProjectCatalog";

const RoleBasedDashboard = lazy(() => import("./pages/RoleBasedDashboard"));
const BoardPage = lazy(() => import("./pages/BoardPage"));
const BacklogPage = lazy(() => import("./pages/BacklogPage"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ScopePage = lazy(() => import("./pages/ScopePage"));
const RisksPage = lazy(() => import("./pages/RisksPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const ProjectWorkforcePage = lazy(() => import("./pages/ProjectWorkforcePage"));
const AdministrationPage = lazy(() => import("./pages/AdministrationPage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const ProposalBuilderPage = lazy(() => import("./pages/ProposalBuilderPage"));
const PresentationBankPage = lazy(() => import("./pages/PresentationBankPage"));
const ValidationPage = lazy(() => import("./pages/ValidationPage"));
const PriorityImpactPage = lazy(() => import("./pages/PriorityImpactPage"));
const ChangeRequestsAllPage = lazy(() => import("./pages/ChangeRequestsAllPage"));
const ChangeRequestsMyPage = lazy(() => import("./pages/ChangeRequestsMyPage"));
const ChangeRequestsApprovalsPage = lazy(() => import("./pages/ChangeRequestsApprovalsPage"));
const ResourcesPage = lazy(() => import("./pages/ResourcesPage"));
const TimeLogsPage = lazy(() => import("./pages/TimeLogsPage"));
const StakeholdersPage = lazy(() => import("./pages/StakeholdersPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const TeamTasksPage = lazy(() => import("./pages/TeamTasksPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const SprintsPage = lazy(() => import("./pages/SprintsPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const PlanComparisonPage = lazy(() => import("./pages/PlanComparisonPage"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));
const WorkflowTemplatesPage = lazy(() => import("./pages/WorkflowTemplatesPage"));
const GanttPage = lazy(() => import("./pages/GanttPage"));
const TriagePage = lazy(() => import("./pages/TriagePage"));
const IssuesPage = lazy(() => import("./pages/IssuesPage"));
const CustomFieldsPage = lazy(() => import("./pages/CustomFieldsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ProjectCreatePage = lazy(() => import("./pages/ProjectCreatePage"));
const ProjectOverviewPage = lazy(() => import("./pages/ProjectOverviewPage"));
const MilestonesPage = lazy(() => import("./pages/MilestonesPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const RecoveryPage = lazy(() => import("./pages/RecoveryPage"));
const AdminTasksPage = lazy(() => import("./pages/AdminTasksPage"));
const GlobalSprintsPage = lazy(() => import("./pages/GlobalSprintsPage"));
const EnterpriseGanttPage = lazy(() => import("./pages/EnterpriseGanttPage"));
const StakeholderDetailPage = lazy(() => import("./pages/StakeholderDetailPage"));
const StakeholderAnalyticsPage = lazy(() => import("./pages/StakeholderAnalyticsPage"));
const StakeholderRegistrationPage = lazy(() => import("./pages/StakeholderRegistrationPage"));
const StakeholderEngagementPage = lazy(() => import("./pages/StakeholderEngagementPage"));
const StakeholderImpactPage = lazy(() => import("./pages/StakeholderImpactPage"));
const ReportPrintPage = lazy(() => import("./pages/ReportPrintPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));

// ProjectOverviewPage takes an optional `projectId` prop (falls back to the
// active project) rather than reading useParams itself — bridge the route param.
function ProjectOverviewRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ProjectOverviewPage projectId={projectId} />;
}

function ProjectIssueRoute() {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();
  const setSelectedIssue = useStore((s) => s.setSelectedIssue);

  useEffect(() => {
    if (issueId) setSelectedIssue(issueId);
  }, [issueId, setSelectedIssue]);

  return <ProjectOverviewPage projectId={projectId} />;
}

function ProjectMilestonesRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/plan?tab=milestones`} replace />;
}

function ProjectPlanRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ScopePage projectId={projectId} />;
}

const defaultStatusId =
  (statuses.find((s) => s.category !== "done") ?? statuses[0])?.id ?? "";

const getInitialDark = (): boolean => {
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname} fallbackTitle="Page error" fallbackMessage="This page encountered an error. Try again or navigate to another page.">
      {children}
    </ErrorBoundary>
  );
}

// Auth pages render standalone, outside the Sidebar/Topbar shell (no logged-in
// user to show chrome for). index.tsx renders this instead of <App> on those
// paths, so it never competes with <App>'s own hooks/render tree.
export function AuthGate() {
  return (
    <BrowserRouter basename="/">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">Loading login...</div>}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </Suspense>
      <Toaster theme="light" richColors position="bottom-right" />
    </BrowserRouter>
  );
}

export function App() {
  const [dark, setDark] = useState(getInitialDark);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const loadProjects = useProjectCatalogStore((s) => s.loadProjects);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        setDark(e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("[Global]", event.error);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[UnhandledRejection]", event.reason);
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return (
    <BrowserRouter basename="/">
      <TooltipProvider delayDuration={200}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              onOpenIssueDialog={() => setCreateOpen(true)}
              onOpenChangeRequestDialog={() => {}}
              dark={dark}
              onToggleDark={() => setDark((d) => !d)}
              onOpenMobileNav={() => setMobileNavOpen(true)}
            />

            <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden" role="main" aria-label="Main content">
              <ErrorBoundaryWrapper>
                <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>}>
                  <Routes>
                    <Route path="/" element={<ProtectedRoute><RoleBasedDashboard /></ProtectedRoute>} />
                    <Route path="/projects" element={<ProtectedRoute permissions={["view-projects"]}><ProjectsPage /></ProtectedRoute>} />
                    <Route path="/clients" element={<ProtectedRoute permissions={["view-projects", "view-clients"]}><ClientsPage /></ProtectedRoute>} />
                    <Route path="/requests" element={<ProtectedRoute permissions={["view-projects", "view-clients"]}><RequestsPage /></ProtectedRoute>} />
                    <Route path="/proposals" element={<ProtectedRoute permissions={["view-projects", "view-clients"]}><ProposalBuilderPage /></ProtectedRoute>} />
                    <Route path="/presentations" element={<ProtectedRoute permissions={["view-documents"]}><PresentationBankPage /></ProtectedRoute>} />
                    <Route path="/validation" element={<ProtectedRoute permissions={["view-projects"]}><ValidationPage /></ProtectedRoute>} />
                    <Route path="/priority-impact" element={<ProtectedRoute permissions={["view-projects"]}><PriorityImpactPage /></ProtectedRoute>} />
                    <Route path="/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
                    <Route path="/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
                    <Route path="/sprints" element={<ProtectedRoute permissions={["view-sprints"]}><SprintsPage /></ProtectedRoute>} />
                    <Route path="/backlog" element={<ProtectedRoute><BacklogPage /></ProtectedRoute>} />
                    <Route path="/roadmap" element={<ProtectedRoute permissions={["view-projects"]}><RoadmapPage /></ProtectedRoute>} />
                    <Route path="/scope" element={<ProtectedRoute permissions={["view-scope"]}><ScopePage /></ProtectedRoute>} />
                    <Route path="/risks" element={<ProtectedRoute permissions={["view-risks"]}><RisksPage /></ProtectedRoute>} />
                    <Route path="/changes" element={<ProtectedRoute permissions={["view-change-requests"]}><ChangeRequestsAllPage /></ProtectedRoute>} />
                    <Route path="/changes/my-requests" element={<ProtectedRoute permissions={["view-change-requests"]}><ChangeRequestsMyPage /></ProtectedRoute>} />
                    <Route path="/changes/approvals" element={<ProtectedRoute permissions={["approve-change-requests"]}><ChangeRequestsApprovalsPage /></ProtectedRoute>} />
                    <Route path="/resources" element={<ProtectedRoute permissions={["view-resources"]}><ResourcesPage /></ProtectedRoute>} />
                    <Route path="/partners" element={<ProtectedRoute roles={["super-admin", "admin"]}><PartnersPage /></ProtectedRoute>} />
                    <Route path="/workforce" element={<ProtectedRoute permissions={["view-projects"]}><ProjectWorkforcePage /></ProtectedRoute>} />
                    <Route path="/administration" element={<ProtectedRoute roles={["super-admin", "admin"]}><AdministrationPage /></ProtectedRoute>} />
                    <Route path="/time-logs" element={<ProtectedRoute permissions={["view-time-logs"]}><TimeLogsPage /></ProtectedRoute>} />
                    <Route path="/stakeholders" element={<ProtectedRoute permissions={["view-stakeholders"]}><StakeholdersPage /></ProtectedRoute>} />
                    <Route path="/stakeholders/analytics" element={<ProtectedRoute permissions={["view-stakeholders"]}><StakeholderAnalyticsPage /></ProtectedRoute>} />
                    <Route path="/stakeholders/registration" element={<ProtectedRoute permissions={["view-stakeholders"]}><StakeholderRegistrationPage /></ProtectedRoute>} />
                    <Route path="/stakeholders/engagement" element={<ProtectedRoute permissions={["view-stakeholders"]}><StakeholderEngagementPage /></ProtectedRoute>} />
                    <Route path="/stakeholders/impact" element={<ProtectedRoute permissions={["view-stakeholders"]}><StakeholderImpactPage /></ProtectedRoute>} />
                    <Route path="/stakeholders/:id" element={<ProtectedRoute permissions={["view-stakeholders"]}><StakeholderDetailPage /></ProtectedRoute>} />
                    <Route path="/documents" element={<ProtectedRoute permissions={["view-documents"]}><DocumentsPage /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute permissions={["view-reports"]}><ReportsPage /></ProtectedRoute>} />
                    <Route path="/team" element={<ProtectedRoute permissions={["view-teams"]}><TeamPage /></ProtectedRoute>} />
                    <Route path="/teams" element={<ProtectedRoute permissions={["view-teams"]}><TeamsPage /></ProtectedRoute>} />
                    <Route path="/team-tasks" element={<ProtectedRoute permissions={["view-resources"]}><TeamTasksPage /></ProtectedRoute>} />
                    <Route path="/skills" element={<ProtectedRoute permissions={["manage-skills"]}><SkillsPage /></ProtectedRoute>} />
                    <Route path="/plan-comparison" element={<ProtectedRoute permissions={["view-analytics"]}><PlanComparisonPage /></ProtectedRoute>} />
                    <Route path="/automation" element={<ProtectedRoute permissions={["manage-settings"]}><AutomationPage /></ProtectedRoute>} />
                    <Route path="/workflow-templates" element={<ProtectedRoute permissions={["manage-settings"]}><WorkflowTemplatesPage /></ProtectedRoute>} />
                    <Route path="/gantt" element={<ProtectedRoute permissions={["view-projects"]}><GanttPage /></ProtectedRoute>} />
                    <Route path="/sprints/global" element={<ProtectedRoute permissions={["view-sprints"]}><GlobalSprintsPage /></ProtectedRoute>} />
                    <Route path="/enterprise-gantt" element={<ProtectedRoute permissions={["view-projects"]}><EnterpriseGanttPage /></ProtectedRoute>} />
                    <Route path="/departments" element={<ProtectedRoute permissions={["view-departments"]}><DepartmentsPage /></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute permissions={["manage-users"]}><UsersPage /></ProtectedRoute>} />
                    <Route path="/users/:id" element={<ProtectedRoute permissions={["manage-users"]}><UserProfilePage /></ProtectedRoute>} />
                    <Route path="/admin-tasks" element={<ProtectedRoute permissions={["view-teams"]}><AdminTasksPage /></ProtectedRoute>} />
                    <Route path="/recovery" element={<ProtectedRoute permissions={["manage-settings"]}><RecoveryPage /></ProtectedRoute>} />
                    <Route path="/triage" element={<ProtectedRoute permissions={["view-issues"]}><TriagePage /></ProtectedRoute>} />
                    <Route path="/custom-fields" element={<ProtectedRoute permissions={["manage-settings"]}><CustomFieldsPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute permissions={["manage-settings"]}><SettingsPage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                    <Route path="/projects/new" element={<ProtectedRoute roles={["super-admin", "admin"]}><ProjectCreatePage /></ProtectedRoute>} />
                    <Route path="/projects/:projectId/milestones" element={<ProtectedRoute><ProjectMilestonesRoute /></ProtectedRoute>} />
                    <Route path="/projects/:projectId/plan" element={<ProtectedRoute><ProjectPlanRoute /></ProtectedRoute>} />
                    <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectOverviewRoute /></ProtectedRoute>} />
                    <Route path="/projects/:projectId/issues/:issueId" element={<ProtectedRoute><ProjectIssueRoute /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundaryWrapper>
            </main>
          </div>
        </div>

        <ChatWidget />

        <IssueDetailSheet />
        <CreateIssueDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultStatusId={defaultStatusId}
          defaultSprintId={activeSprintId}
        />
        <CommandPalette onCreateIssue={() => setCreateOpen(true)} />

        <Toaster theme={dark ? "dark" : "light"} richColors position="bottom-right" />
      </TooltipProvider>
    </BrowserRouter>
  );
}
