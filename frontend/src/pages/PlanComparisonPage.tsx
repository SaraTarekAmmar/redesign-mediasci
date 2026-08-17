import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Layers3,
  Loader2,
  Workflow,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenuEnhanced";
import { api } from "../lib/api";
import { useProjectCatalogStore } from "../store/useProjectCatalog";
import { formatShortDate } from "../components/planning/SharedUI";

// Reusable Sprint 9 Executive Dashboard Components
import {
  ExecutiveKPICards,
  type KPIData,
} from "../components/planning/dashboard/ExecutiveKPICards";
import {
  TimelineComparison,
  type TimelineMilestoneNode,
} from "../components/planning/dashboard/TimelineComparison";
import {
  MilestoneDrawer,
  type MilestoneDrawerData,
} from "../components/planning/dashboard/MilestoneDrawer";
import { ProgressCharts } from "../components/planning/dashboard/ProgressCharts";
import { MilestoneStatusPanel } from "../components/planning/dashboard/MilestoneStatusPanel";
import { DeliverableAnalytics } from "../components/planning/dashboard/DeliverableAnalytics";
import { CriticalPathVisualization } from "../components/planning/dashboard/CriticalPathVisualization";
import { AIInsightsPanel } from "../components/planning/dashboard/AIInsightsPanel";
import { ResourceHeatmap } from "../components/planning/dashboard/ResourceHeatmap";
import { RiskMatrix } from "../components/planning/dashboard/RiskMatrix";
import { ActivityFeed } from "../components/planning/dashboard/ActivityFeed";

export const PlanComparisonPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, activeProjectId, setActiveProjectId, refreshProjects } =
    useProjectCatalogStore();

  const selectedProjectId = activeProjectId ? Number(activeProjectId) : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [intelligenceData, setIntelligenceData] = useState<any>(null);

  // Selected Milestone state for side drawer
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setActiveProjectId]);

  const activeProject = useMemo(() => {
    return projects.find((p) => String(p.id) === String(selectedProjectId)) || null;
  }, [projects, selectedProjectId]);

  // Hydrate Data from Backend Single Source of Truth
  useEffect(() => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadDashboardData = async () => {
      try {
        setLoadError(null);
        const intelRes = await api.get<any>(`/projects/${selectedProjectId}/planning-intelligence`);

        if (isMounted) {
          setIntelligenceData(intelRes);
        }
      } catch (err: any) {
        if (isMounted) {
          setIntelligenceData(null);
          setLoadError(err?.message || "Failed to load executive dashboard data.");
          toast.error(err?.message || "Failed to load executive dashboard data.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // Derived KPI metrics
  const kpiData: KPIData = useMemo(() => {
    const summary = intelligenceData?.summary || {};
    const health = intelligenceData?.health_breakdown || {};
    const hasHealth = health.overall != null || summary.executive_score != null;
    const rawForecast =
      summary.forecast_finish || intelligenceData?.forecast?.forecast_finish || null;

    return {
      healthScore: hasHealth ? Number(health.overall ?? summary.executive_score ?? 0) : 0,
      healthState: health.state || (hasHealth ? "Unknown" : "—"),
      plannedProgressPct: Number(summary.planned_progress_pct ?? summary.completion_percentage ?? 0),
      actualProgressPct: Number(summary.completion_percentage ?? 0),
      scheduleVarianceDays: Number(summary.schedule_variance_days ?? 0),
      budgetVariance: Number(summary.budget_variance ?? 0),
      forecastFinish: rawForecast ? formatShortDate(String(rawForecast)) : null,
      forecastConfidence: intelligenceData?.forecast?.confidence ?? null,
      blockedMilestones: Number(summary.total_blocked_work ?? summary.blocked_milestones ?? 0),
      openRisks: Number(summary.open_risks ?? 0),
    };
  }, [intelligenceData]);

  // Derived Timeline Milestones
  const timelineMilestones: TimelineMilestoneNode[] = useMemo(() => {
    const rawList = intelligenceData?.milestones || intelligenceData?.plan_vs_actual || [];
    return rawList.map((m: any) => ({
      id: Number(m.id),
      name: m.name || m.title || `Milestone ${m.id}`,
      plannedStart: m.planned_start_date,
      plannedEnd: m.planned_end_date,
      actualStart: m.actual_start_date,
      actualEnd: m.actual_end_date,
      status: m.status || "pending",
      blocked: Boolean(m.blocked),
      delayDays: Number(m.schedule_variance_days || m.delay_days || 0),
      completionPct: Number(m.completion_percentage || m.actual_progress_pct || 0),
      ownerName: m.owner_resource?.name || null,
      deliverablesCount: Number(m.deliverables_count || (m.deliverables || []).length || 0),
    }));
  }, [intelligenceData]);

  const onTrackMilestones = useMemo(() => {
    return timelineMilestones.filter(
      (m) => !m.blocked && (m.delayDays || 0) <= 0 && m.status !== "completed"
    ).length;
  }, [timelineMilestones]);

  // Selected Milestone Detail Object for Drawer
  const selectedMilestoneDetail: MilestoneDrawerData | null = useMemo(() => {
    if (!selectedMilestoneId) return null;
    const rawList = intelligenceData?.milestones || intelligenceData?.plan_vs_actual || [];
    const target = rawList.find((m: any) => Number(m.id) === Number(selectedMilestoneId));
    if (!target) return null;

    return {
      id: Number(target.id),
      name: target.name || target.title,
      description: target.description,
      status: target.status || "pending",
      plannedStartDate: target.planned_start_date,
      plannedEndDate: target.planned_end_date,
      actualStartDate: target.actual_start_date,
      actualEndDate: target.actual_end_date,
      plannedHours: Number(target.planned_hours || 0),
      actualHours: Number(target.actual_hours || 0),
      plannedBudget: Number(target.planned_budget || 0),
      actualCost: Number(target.actual_cost || 0),
      completionPercentage: Number(target.completion_percentage || 0),
      scheduleVarianceDays: Number(target.schedule_variance_days || 0),
      blocked: Boolean(target.blocked),
      blockingReason: target.blocking_reason,
      ownerResource: target.owner_resource,
      deliverables: target.deliverables || [],
      issues: target.issues || [],
      blockingMilestones: target.blocking_milestones || [],
    };
  }, [intelligenceData, selectedMilestoneId]);

  // Derived Progress Charts Data
  const chartData = useMemo(() => {
    const rawList = intelligenceData?.milestones || intelligenceData?.plan_vs_actual || [];
    return rawList.map((m: any) => ({
      milestoneName: m.name || m.title || `Milestone ${m.id}`,
      plannedProgress: Number(m.planned_progress_pct || m.planned_progress || 0),
      actualProgress: Number(m.completion_percentage || m.actual_progress_pct || 0),
      plannedHours: Number(m.planned_hours || 0),
      actualHours: Number(m.actual_hours || 0),
      plannedBudget: Number(m.planned_budget || 0),
      actualCost: Number(m.actual_cost || 0),
    }));
  }, [intelligenceData]);

  // Derived Deliverable Summary
  const deliverableSummary = useMemo(() => {
    const rawList = intelligenceData?.milestones || intelligenceData?.plan_vs_actual || [];
    const allDeliverables = rawList.flatMap((m: any) => m.deliverables || []);

    const completed = allDeliverables.filter(
      (d: any) => (d.status || "").toLowerCase() === "completed"
    ).length;
    const inProgress = allDeliverables.filter(
      (d: any) => (d.status || "").toLowerCase() === "in_progress"
    ).length;
    const blocked = allDeliverables.filter((d: any) => d.blocked).length;
    const overdue = allDeliverables.filter((d: any) => d.late).length;

    return {
      completed,
      inProgress,
      blocked,
      overdue,
      total: allDeliverables.length,
    };
  }, [intelligenceData]);

  // Derived Critical Path
  const criticalPathItems = useMemo(() => {
    const cpData = intelligenceData?.critical_path || {};
    const milestoneMap = (intelligenceData?.milestones || []).reduce((acc: any, m: any) => {
      acc[m.id] = m;
      return acc;
    }, {});

    const cpIds = cpData.milestones || [];
    return cpIds.map((item: any) => {
      const id = typeof item === "object" ? item.id : item;
      const m = milestoneMap[id] || (typeof item === "object" ? item : {});
      return {
        id: Number(id),
        name: m.name || m.title || `Milestone ${id}`,
        status: m.status || "pending",
        blocked: Boolean(m.blocked),
      };
    });
  }, [intelligenceData]);

  // Derived AI Insight
  const aiInsight = useMemo(() => {
    const forecast = intelligenceData?.forecast || {};
    const ceoSummary = intelligenceData?.ceo_summary || {};
    const executiveSummary = intelligenceData?.summary?.executive_summary;

    return {
      summaryText: ceoSummary.summary,
      predictedDelayDays: Number(forecast.delay_days || 0),
      mainCause: forecast.main_cause,
      confidence: forecast.confidence,
      recommendationText:
        typeof executiveSummary === "string"
          ? executiveSummary
          : executiveSummary?.summary || executiveSummary?.headline,
    };
  }, [intelligenceData]);

  // Derived Resource Heatmap
  const resourceItems = useMemo(() => {
    const resData = intelligenceData?.resource_planning?.resources || [];
    return resData.map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      position: r.position,
      capacity: Number(r.weekly_capacity ?? 0),
      utilizationPct: Number(r.utilization_percentage || 0),
      overloaded: Boolean(r.overloaded),
    }));
  }, [intelligenceData]);

  // Derived Audit Events
  const auditEvents = useMemo(() => {
    const logs = intelligenceData?.audit_trail || [];
    return logs.map((l: any) => ({
      id: Number(l.id),
      action: l.action,
      entityType: l.entity_type,
      entityId: Number(l.entity_id),
      createdAt: l.created_at,
    }));
  }, [intelligenceData]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground font-medium">
          Loading Executive Dashboard Intelligence...
        </p>
      </div>
    );
  }

  if (!selectedProjectId || projects.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <PageHeader
          icon={<Layers3 className="h-4 w-4" />}
          title="Plan vs Actual Monitoring"
          subtitle="Real-time execution monitoring against project baselines."
        />
        <EmptyState
          icon={<Layers3 className="h-8 w-8" />}
          title="No project selected"
          subtitle="Create or select a project to view plan vs actual monitoring."
          action={<Button onClick={() => navigate("/projects")}>Browse Projects</Button>}
        />
      </div>
    );
  }

  if (loadError || !intelligenceData) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <PageHeader
          icon={<Layers3 className="h-4 w-4" />}
          title="Plan vs Actual Monitoring"
          subtitle="Real-time execution monitoring against project baselines."
        />
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8 text-rose-500" />}
          title="Unable to load dashboard"
          subtitle={loadError || "Planning intelligence is not available for this project yet."}
          action={activeProject ? (
            <Button className="gap-2" onClick={() => navigate(`/projects/${activeProject.id}/plan`)}>
              <Workflow className="h-4 w-4" />
              Open Planning Workspace
            </Button>
          ) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <PageHeader
        icon={<Layers3 className="h-4 w-4" />}
        title="Plan vs Actual Monitoring"
        subtitle="Real-time execution monitoring against project baselines. Read-only visualization."
        badge={<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">Executive dashboard</span>}
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 text-sm font-semibold">
                  <Layers3 className="h-4 w-4 text-primary" />
                  {activeProject?.name || "Select Project"}
                  <ChevronDown className="ml-1 h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Active Projects</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setActiveProjectId(p.id)} className="cursor-pointer justify-between">
                    <span className="truncate font-medium">{p.name}</span>
                    <Badge variant="outline" className="text-[10px]">{p.key}</Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {activeProject && (
              <Button variant="default" size="sm" className="gap-2" onClick={() => navigate(`/projects/${activeProject.id}/plan`)}>
                <Workflow className="h-4 w-4" />
                Edit Planning
              </Button>
            )}
          </div>
        }
      />

      {/* 1. Executive KPI Cards Row */}
      <div className="animate-slide-up" style={{ animationDelay: "40ms" }}>
        <ExecutiveKPICards data={kpiData} />
      </div>

      {/* 2. Interactive Dual Horizontal Timeline (Highest Priority) */}
      <div className="animate-slide-up" style={{ animationDelay: "80ms" }}>
        <TimelineComparison
          milestones={timelineMilestones}
          onSelectMilestone={(id) => setSelectedMilestoneId(id)}
        />
      </div>

      {/* 3. Progress Charts Section */}
      <div className="animate-slide-up" style={{ animationDelay: "120ms" }}>
        <ProgressCharts data={chartData} />
      </div>

      {/* 4. Critical Path Sequence Diagram */}
      <div className="animate-slide-up" style={{ animationDelay: "160ms" }}>
        <CriticalPathVisualization
          criticalPath={criticalPathItems}
          nonCriticalCount={
            timelineMilestones.length - criticalPathItems.length
          }
        />
      </div>

      {/* 5. AI Planning Intelligence Panel */}
      <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
        <AIInsightsPanel insight={aiInsight} />
      </div>

      {/* 6. Milestone Cards Grid */}
      <div className="animate-slide-up" style={{ animationDelay: "240ms" }}>
        <MilestoneStatusPanel
          milestones={timelineMilestones}
          onSelectMilestone={(id) => setSelectedMilestoneId(id)}
        />
      </div>

      {/* 7. Deliverable Analytics */}
      <div className="animate-slide-up" style={{ animationDelay: "280ms" }}>
        <DeliverableAnalytics summary={deliverableSummary} />
      </div>

      {/* 8. Resource Utilization Heatmap & Risk Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "320ms" }}>
        <div className="lg:col-span-2">
          <ResourceHeatmap resources={resourceItems} />
        </div>
        <div>
          <RiskMatrix
            blockedCount={kpiData.blockedMilestones}
            openRisksCount={kpiData.openRisks}
            onTrackCount={onTrackMilestones}
          />
        </div>
      </div>

      {/* 9. Activity Feed */}
      <div className="animate-slide-up" style={{ animationDelay: "360ms" }}>
        <ActivityFeed events={auditEvents} />
      </div>

      {/* 10. Read-only Milestone Detail Side Drawer */}
      <MilestoneDrawer
        milestone={selectedMilestoneDetail}
        onClose={() => setSelectedMilestoneId(null)}
      />
    </div>
  );
};

export default PlanComparisonPage;
