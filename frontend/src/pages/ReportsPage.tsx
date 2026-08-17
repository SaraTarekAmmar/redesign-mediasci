
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Download,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle2,
  Flame,
  Layers,
  AlertTriangle,
  Users,
  Target,
  BarChart3,
  Clock,
  ArrowUpRight,
  UserCheck,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
  
} from "lucide-react";
import { toast } from "sonner";
import { useStore, lookups } from "../store/useStore";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { UserAvatar } from "../components/common/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenuEnhanced";
import { IssueTypeIcon } from "../components/common/IssueTypeIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../components/ui/Dialog";
import type { Issue } from "../data/types";

import { Panel, BarRow } from "../components/reports/ReportComponents";
import { BurndownChart } from "../components/charts/BurndownChart";
import { VelocityChart } from "../components/charts/VelocityChart";
import { getProjectScope } from "../lib/api";
import { useProjectCatalogStore } from "../store/useProjectCatalog";


const formatReportDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function ReportsPage() {
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"plan_vs_actual" | "team_tasks" | "charts">("plan_vs_actual");
  const issues = useStore((s) => s.issues);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const setSelectedIssue = useStore((s) => s.setSelectedIssue);
  const projects = useProjectCatalogStore((s) => s.projects);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectScope = getProjectScope() ?? {
    mode: "single" as const,
    projectIds: activeProject?.id ? [String(activeProject.id)] : [],
    primaryProjectId: String(activeProject?.id ?? ""),
    label: activeProject?.name,
    projectNames: activeProject?.name ? [activeProject.name] : [],
  };

  // Modal State for Chart Click Task Details
  const [chartModal, setChartModal] = useState<{
    title: string;
    subtitle: string;
    tasks: Issue[];
  } | null>(null);

  const navigate = useNavigate();
  const isRTL = i18n.dir() === "rtl";
  const printRequested = searchParams.get("print") === "1";

  useEffect(() => {
    if (!printRequested) return;
    const frame = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(frame);
  }, [printRequested]);

  // Timeline UI state
  const [hoveredTask, setHoveredTask] = useState<{
    task: Issue;
    x: number;
    y: number;
    track: "expected" | "actual";
  } | null>(null);

  const [clickedTask, setClickedTask] = useState<Issue | null>(null);

  const activeSprint = lookups.sprintById[activeSprintId];
  const getAssignee = (task: Issue) => (task.assigneeId ? lookups.userById[task.assigneeId] : null);
  const scopeProjectIds =
    projectScope.mode === "all"
      ? projects.map((p) => p.id)
      : projectScope.projectIds.length
        ? projectScope.projectIds
        : activeProject?.id ? [String(activeProject.id)] : [];
  const scopeProjects = projects.filter((p) => scopeProjectIds.includes(p.id));
  const scopeProjectNames = scopeProjects.map((p) => p.name);
  const csvQuote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const renderHoveredTaskCard = (track: "expected" | "actual", accent: "blue" | "emerald") => {
    if (hoveredTask?.track !== track) return null;

    const task = hoveredTask.task;
    const status = lookups.statusById[task.statusId];
    const priority = task.priorityId ? lookups.priorityById[task.priorityId] : null;
    const assignee = getAssignee(task);
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
    {/* ponytail: "expected" track reads as a neutral baseline, "actual" (emerald) is the
        one highlighted color — clearer hierarchy than two arbitrary hues, and drops the
        off-brand blue. */}
    const borderClass = accent === "blue" ? "border-foreground/15" : "border-emerald-500/20";
    const accentTextClass = accent === "blue" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400";
    const chipClass = accent === "blue" ? "bg-muted text-foreground" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    return (
      <div className={`pointer-events-none absolute inset-2 z-20 rounded-xl border bg-white p-4 shadow-xl ${borderClass}`}>
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <IssueTypeIcon typeKey={task.typeKey} className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-bold text-muted-foreground tracking-wider uppercase text-[10px]">{task.key}</span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chipClass}`}>
              {status?.name}
            </span>
          </div>

          <p className="text-sm font-semibold text-foreground line-clamp-2 break-words">
            {task.title}
          </p>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg border border-border/60 bg-white px-2 py-1.5">
              <p className="text-muted-foreground uppercase tracking-wider">{isRTL ? "المسند إليه" : "Assignee"}</p>
              <p className="truncate font-medium text-foreground">
                {assignee?.name ?? (isRTL ? "غير مسند" : "Unassigned")}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-white px-2 py-1.5">
              <p className="text-muted-foreground uppercase tracking-wider">{isRTL ? "النقاط" : "Story Points"}</p>
              <p className="font-medium text-foreground">{task.storyPoints ?? 0} pts</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {priority && (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-medium"
                style={{ backgroundColor: `${priority.color}18`, color: priority.color }}
              >
                {priority.name}
              </span>
            )}
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-medium ${accentTextClass} bg-white`}>
              {track === "expected" ? (isRTL ? "الخطة المستهدفة" : "Expected Plan") : (isRTL ? "مكتمل" : "Completed")}
            </span>
            <span className="inline-flex items-center rounded px-1.5 py-0.5 font-medium bg-white">
              {dueDate ? `${isRTL ? "الاستحقاق" : "Due"} ${dueDate}` : (isRTL ? "لا يوجد تاريخ استحقاق" : "No due date")}
            </span>
            {task.sprintId && lookups.sprintById[task.sprintId] && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 font-medium bg-background/70">
                {lookups.sprintById[task.sprintId]?.name}
              </span>
            )}
          </div>

          {task.description && (
            <p className="border-t border-border/40 pt-2 text-[10px] leading-4 text-muted-foreground line-clamp-2 italic">
              {task.description.replace(/[#*\[\]]/g, "").slice(0, 140)}
              {task.description.length > 140 ? "..." : ""}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Timeline bounds and calculation
  const timelineDates = useMemo(() => {
    const sprintStart = activeSprint?.startDate ? new Date(activeSprint.startDate) : new Date("2026-07-13");
    const sprintEnd = activeSprint?.endDate ? new Date(activeSprint.endDate) : new Date("2026-07-27");
    
    let minTime = sprintStart.getTime();
    let maxTime = sprintEnd.getTime();

    // Check active sprint tasks
    const activeSprintTasks = issues.filter((i) => i.sprintId === activeSprintId);
    
    activeSprintTasks.forEach((t) => {
      if (t.dueDate) {
        const time = new Date(t.dueDate).getTime();
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
      }
      if (t.updatedAt) {
        const time = new Date(t.updatedAt).getTime();
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
      }
    });

    return {
      start: new Date(minTime),
      end: new Date(maxTime),
      minTime,
      maxTime,
      span: maxTime - minTime || 1
    };
  }, [activeSprint, issues, activeSprintId]);

  // Expected timeline tasks
  const expectedTimelineTasks = useMemo(() => {
    const { minTime, span } = timelineDates;
    const activeSprintTasks = issues.filter((i) => i.sprintId === activeSprintId);

    // Sort by due date
    const sorted = [...activeSprintTasks].sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return aTime - bTime;
    });

    const positioned: { task: Issue; pct: number; level: number; date: Date }[] = [];

    sorted.forEach((task, idx) => {
      let taskTime: number;
      if (task.dueDate) {
        taskTime = new Date(task.dueDate).getTime();
      } else {
        // Distribute tasks without due date across the active sprint duration
        const sprintStart = activeSprint?.startDate ? new Date(activeSprint.startDate).getTime() : new Date("2026-07-13").getTime();
        const sprintEnd = activeSprint?.endDate ? new Date(activeSprint.endDate).getTime() : new Date("2026-07-27").getTime();
        const sprintSpan = sprintEnd - sprintStart;
        taskTime = sprintStart + (idx % 6) * (sprintSpan / 6);
      }

      const pct = ((taskTime - minTime) / span) * 100;
      
      // Collision detection stacking (within 6% horizontal range)
      let level = 0;
      while (true) {
        const collision = positioned.find((p) => p.level === level && Math.abs(p.pct - pct) < 6);
        if (!collision) break;
        level++;
      }

      positioned.push({
        task,
        pct: Math.max(0, Math.min(100, pct)),
        level,
        date: new Date(taskTime)
      });
    });

    return positioned;
  }, [issues, activeSprintId, timelineDates, activeSprint]);

  // Actual timeline tasks
  const actualTimelineTasks = useMemo(() => {
    const { minTime, span } = timelineDates;
    const activeSprintTasks = issues.filter((i) => i.sprintId === activeSprintId);
    const completedTasks = activeSprintTasks.filter((i) => lookups.statusById[i.statusId]?.category === "done");

    // Sort by completion / update date
    const sorted = [...completedTasks].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.dueDate || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.dueDate || b.createdAt).getTime();
      return aTime - bTime;
    });

    const positioned: { task: Issue; pct: number; level: number; date: Date }[] = [];

    sorted.forEach((task) => {
      const dateStr = task.updatedAt || task.dueDate || task.createdAt;
      const taskTime = new Date(dateStr).getTime();
      const pct = ((taskTime - minTime) / span) * 100;

      // Collision detection stacking
      let level = 0;
      while (true) {
        const collision = positioned.find((p) => p.level === level && Math.abs(p.pct - pct) < 6);
        if (!collision) break;
        level++;
      }

      positioned.push({
        task,
        pct: Math.max(0, Math.min(100, pct)),
        level,
        date: new Date(taskTime)
      });
    });

    return positioned;
  }, [issues, activeSprintId, timelineDates]);

  const maxExpectedLevel = useMemo(() => {
    if (expectedTimelineTasks.length === 0) return 0;
    return Math.max(...expectedTimelineTasks.map((t) => t.level));
  }, [expectedTimelineTasks]);

  const maxActualLevel = useMemo(() => {
    if (actualTimelineTasks.length === 0) return 0;
    return Math.max(...actualTimelineTasks.map((t) => t.level));
  }, [actualTimelineTasks]);

  const timelineTicks = useMemo(() => {
    const { minTime, maxTime } = timelineDates;
    const list: Date[] = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      list.push(new Date(minTime + (i / (count - 1)) * (maxTime - minTime)));
    }
    return list;
  }, [timelineDates]);

  const todayPct = useMemo(() => {
    const { minTime, span } = timelineDates;
    const projectToday = new Date("2026-07-20T09:00:00Z").getTime();
    const pct = ((projectToday - minTime) / span) * 100;
    if (pct < 0 || pct > 100) return null;
    return pct;
  }, [timelineDates]);

  const sprintIssues = useMemo(() => issues.filter((i) => i.sprintId === activeSprintId), [issues, activeSprintId]);

  // 1. PLANNED VS ACTUAL METRICS CALCULATION
  const now = new Date();
  
  const expectedTasks = useMemo(() => {
    return issues.filter((i) => {
      if (i.sprintId === activeSprintId) return true;
      if (i.dueDate && new Date(i.dueDate) <= now) return true;
      if (i.sprintId && i.sprintId !== activeSprintId) return true;
      return false;
    });
  }, [issues, activeSprintId]);

  const expectedPoints = expectedTasks.reduce((s, i) => s + (i.storyPoints ?? 1), 0);

  const actualDoneTasks = useMemo(() => {
    return issues.filter((i) => lookups.statusById[i.statusId]?.category === "done");
  }, [issues]);

  const actualDonePoints = actualDoneTasks.reduce((s, i) => s + (i.storyPoints ?? 1), 0);

  const shouldHaveBeenDoneTasks = useMemo(() => {
    return expectedTasks.filter((i) => lookups.statusById[i.statusId]?.category !== "done");
  }, [expectedTasks]);

  const pointVariance = actualDonePoints - expectedPoints;
  const variancePct = expectedPoints ? Math.round((pointVariance / expectedPoints) * 100) : 0;
  const spi = expectedPoints ? (actualDonePoints / expectedPoints).toFixed(2) : "1.00";

  // 2. TEAM WORKLOAD CALCULATION
  const teamWorkload = useMemo(() => {
    return lookups.users.map((u) => {
      const assigned = issues.filter((i) => i.assigneeId === u.id);
      const done = assigned.filter((i) => lookups.statusById[i.statusId]?.category === "done");
      const open = assigned.filter((i) => lookups.statusById[i.statusId]?.category !== "done");
      const inProgress = assigned.filter((i) => lookups.statusById[i.statusId]?.category === "in_progress");
      
      const totalPts = assigned.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
      const openPts = open.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
      const donePts = done.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
      const capacityPct = Math.min(100, Math.round((openPts / 15) * 100));

      return { user: u, assigned, open, done, inProgress, totalPts, openPts, donePts, capacityPct };
    });
  }, [issues]);

  const maxTeamPts = Math.max(1, ...teamWorkload.map((t) => t.totalPts));

  // 3. CHARTS DATA
  const statusDistribution = useMemo(() => {
    return lookups.statuses.map((st) => {
      const matchingTasks = issues.filter((i) => i.statusId === st.id);
      return { ...st, count: matchingTasks.length, tasks: matchingTasks };
    });
  }, [issues]);
  const maxStatus = Math.max(1, ...statusDistribution.map((s) => s.count));

  const byType = useMemo(() => {
    return lookups.issueTypes
      .map((t) => {
        const matchingTasks = issues.filter((i) => i.typeKey === t.key);
        return { ...t, count: matchingTasks.length, tasks: matchingTasks };
      })
      .filter((t) => t.count > 0);
  }, [issues]);
  const maxType = Math.max(1, ...byType.map((t) => t.count));

  const byPriority = useMemo(() => {
    return lookups.priorities
      .map((p) => {
        const matchingTasks = issues.filter((i) => i.priorityId === p.id);
        return { ...p, count: matchingTasks.length, tasks: matchingTasks };
      })
      .filter((p) => p.count > 0);
  }, [issues]);
  const maxPriority = Math.max(1, ...byPriority.map((p) => p.count));

  // Burndown calculations
  const totalPoints = sprintIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const donePoints = sprintIssues
    .filter((i) => lookups.statusById[i.statusId]?.category === "done")
    .reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const days = 10;
  const todayIdx = 4;
  const burndown = Array.from({ length: days + 1 }, (_, d) => {
    const ideal = totalPoints - (totalPoints / days) * d;
    const actual = d <= todayIdx ? totalPoints - ((totalPoints - (totalPoints - donePoints)) / todayIdx) * d : null;
    return { d, ideal, actual };
  });

  // Velocity calculations
  const velocity = useMemo(() => lookups.sprints.map((sp) => {
    const spIssues = issues.filter((i) => i.sprintId === sp.id);
    const committed = spIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const completed = spIssues
      .filter((i) => lookups.statusById[i.statusId]?.category === "done")
      .reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    return { name: sp.name, committed, completed, tasks: spIssues };
  }), [issues, lookups.sprints]);
  const maxVel = Math.max(1, ...velocity.map((v) => v.committed));

  const totalCommittedVelocity = velocity.reduce((s, v) => s + v.committed, 0);
  const totalCompletedVelocity = velocity.reduce((s, v) => s + v.completed, 0);
  const avgVelocity = velocity.length ? Math.round(totalCompletedVelocity / velocity.length) : 0;
  const overallCompletionPct = totalCommittedVelocity ? Math.round((totalCompletedVelocity / totalCommittedVelocity) * 100) : 0;

  // Export Handlers
  const handleExportCsv = () => {
    try {
      const lines: string[] = [];
      const addRow = (cells: unknown[]) => lines.push(cells.map(csvQuote).join(","));

      lines.push("MediaSci Operation Hub - Executive Analytics Report");
      addRow(["Generated", new Date().toLocaleString()]);
      addRow(["Scope", projectScope.mode === "all" ? "All projects" : scopeProjectNames.join(" · ") || activeProject?.name || ""]);
      addRow(["Projects", scopeProjects.length]);
      addRow(["Active Sprint", activeSprint?.name || "N/A"]);
      addRow(["Planned Points", expectedPoints]);
      addRow(["Completed Points", actualDonePoints]);
      addRow(["Variance", `${pointVariance} pts (${variancePct}%)`]);
      addRow(["SPI", spi]);
      lines.push("");
      lines.push("Project overview");
      addRow(["Project", "Type", "Category", "Status", "Tasks"]);
      scopeProjects.forEach((p) => {
        const projectTasks = issues.filter((issue) => issue.projectId === p.id);
        addRow([
          p.name,
          p.type,
          p.category,
          p.status || "",
          projectTasks.length,
        ]);
      });
      lines.push("");
      lines.push("Tasks requiring attention");
      addRow(["Key", "Title", "Project", "Assignee", "Sprint", "Points", "Status", "Due Date"]);
      shouldHaveBeenDoneTasks.forEach((t) => {
        const assignee = lookups.userById[t.assigneeId || ""]?.name || "Unassigned";
        const sprint = lookups.sprintById[t.sprintId || ""]?.name || "Backlog";
        const status = lookups.statusById[t.statusId]?.name || "Open";
        const projectName = projects.find((p) => p.id === t.projectId)?.name || activeProject?.name || "";
        addRow([t.key, t.title, projectName, assignee, sprint, t.storyPoints || 0, status, t.dueDate || "N/A"]);
      });
      lines.push("");
      lines.push("Team workload");
      addRow(["Member", "Role", "Assigned Tasks", "Open Tasks", "Completed Tasks", "Open Points"]);
      teamWorkload.forEach((tw) => {
        addRow([tw.user.name, tw.user.role, tw.assigned.length, tw.open.length, tw.done.length, tw.openPts]);
      });

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `MediaSci_Executive_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV report exported successfully");
    } catch (err) {
      toast.error("Could not export CSV report");
    }
  };

  const handleExportXlsx = () => {
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        throw new Error("SheetJS not available");
      }

      const workbook = XLSX.utils.book_new();

      const overviewRows = [
        ["MediaSci Operation Hub", "Executive Analytics Report"],
        ["Generated", new Date().toLocaleString()],
        ["Scope", projectScope.mode === "all" ? "All projects" : scopeProjectNames.join(" · ") || activeProject?.name || ""],
        ["Projects", scopeProjects.length],
        ["Active Sprint", activeSprint?.name || "N/A"],
        ["Planned Points", expectedPoints],
        ["Completed Points", actualDonePoints],
        ["Variance", `${pointVariance} pts (${variancePct}%)`],
        ["SPI", spi],
      ];
      const overview = XLSX.utils.aoa_to_sheet(overviewRows);
      overview["!cols"] = [{ wch: 28 }, { wch: 42 }];

      const projectSummary = XLSX.utils.json_to_sheet(scopeProjects.map((p) => {
        const projectTasks = issues.filter((issue) => issue.projectId === p.id);
        return {
          Project: p.name,
          Type: p.type,
          Category: p.category,
          Status: p.status || "",
          Tasks: projectTasks.length,
          Completed: projectTasks.filter((issue) => lookups.statusById[issue.statusId]?.category === "done").length,
          Open: projectTasks.filter((issue) => lookups.statusById[issue.statusId]?.category !== "done").length,
        };
      }));
      projectSummary["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];

      const delayedRows = XLSX.utils.json_to_sheet(shouldHaveBeenDoneTasks.map((t) => ({
        Key: t.key,
        Title: t.title,
        Project: projects.find((p) => p.id === t.projectId)?.name || activeProject?.name || "",
        Assignee: lookups.userById[t.assigneeId || ""]?.name || "Unassigned",
        Sprint: lookups.sprintById[t.sprintId || ""]?.name || "Backlog",
        Points: t.storyPoints || 0,
        Status: lookups.statusById[t.statusId]?.name || "Open",
        "Due Date": t.dueDate || "N/A",
      })));
      delayedRows["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];

      const workloadRows = XLSX.utils.json_to_sheet(teamWorkload.map((tw) => ({
        Member: tw.user.name,
        Role: tw.user.role,
        "Assigned Tasks": tw.assigned.length,
        "Open Tasks": tw.open.length,
        "Completed Tasks": tw.done.length,
        "Open Points": tw.openPts,
      })));
      workloadRows["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];

      const statusRows = XLSX.utils.json_to_sheet(statusDistribution.map((st) => ({
        Status: st.name,
        Count: st.count,
      })));
      statusRows["!cols"] = [{ wch: 22 }, { wch: 10 }];

      XLSX.utils.book_append_sheet(workbook, overview, "Overview");
      XLSX.utils.book_append_sheet(workbook, projectSummary, "Project Summary");
      XLSX.utils.book_append_sheet(workbook, delayedRows, "Attention Tasks");
      XLSX.utils.book_append_sheet(workbook, workloadRows, "Team Workload");
      XLSX.utils.book_append_sheet(workbook, statusRows, "Status Mix");
      XLSX.writeFile(workbook, `MediaSci_Executive_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel report exported successfully");
    } catch (err) {
      toast.error("Could not export Excel report");
    }
  };

  const handleExportPdf = () => {
    const params = new URLSearchParams();
    scopeProjectIds.forEach((id) => params.append("project_ids[]", id));
    params.set("from", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
    params.set("to", new Date().toISOString());
    params.set("print", "1");
    const url = `/reports${params.toString() ? `?${params.toString()}` : ""}`;
    // Always open in new tab — never navigate away
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener,noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={i18n.dir()}>
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={isRTL ? "التقارير والتحليلات" : "Reports & Analytics"}
          actions={
            <div className="flex items-center gap-2 no-print">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {isRTL ? "تصدير" : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-1.5">
                  <DropdownMenuItem onSelect={handleExportCsv}>
                    <FileSpreadsheet className="me-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    {isRTL ? "تصدير CSV" : "Export CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportXlsx}>
                    <FileSpreadsheet className="me-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {isRTL ? "تصدير Excel" : "Export Excel"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportPdf}>
                    <Printer className="me-2 h-4 w-4" aria-hidden="true" />
                    {isRTL ? "تصدير PDF / طباعة" : "Export PDF / Print"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        {/* Executive KPI Header Cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div
            onClick={() =>
              setChartModal({
                title: isRTL ? "المهام المخططة المستهدفة" : "Expected Target Plan Tasks",
                subtitle: isRTL ? `${expectedTasks.length} مهمة بإجمالي ${expectedPoints} نقطة قصة` : `${expectedTasks.length} tasks totaling ${expectedPoints} story points`,
                tasks: expectedTasks
              })
            }
            className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 cursor-pointer"
          >
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 bg-muted text-foreground group-hover:scale-105 transition-transform">
              <Target className="h-4 w-4" />
            </span>
            <p className="text-xl font-bold text-foreground">{expectedPoints} pts</p>
            <p className="mt-0.5 text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-between">
              <span>{isRTL ? "الخطة المتوقعة (الهدف)" : "Expected Plan (Target)"}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>

          <div
            onClick={() =>
              setChartModal({
                title: isRTL ? "المهام المكتملة فعليًا" : "Actual Completed Tasks",
                subtitle: isRTL ? `${actualDoneTasks.length} مهمة مكتملة (${actualDonePoints} نقطة قصة)` : `${actualDoneTasks.length} tasks completed (${actualDonePoints} story points)`,
                tasks: actualDoneTasks
              })
            }
            className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-emerald-500/50 cursor-pointer"
          >
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <p className="text-xl font-bold text-foreground">{actualDonePoints} pts</p>
            <p className="mt-0.5 text-xs text-muted-foreground group-hover:text-emerald-500 transition-colors flex items-center justify-between">
              <span>{isRTL ? "المكتمل فعليًا" : "Actual Completed"}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>

          <div
            onClick={() =>
              setChartModal({
                title: isRTL ? "المهام المتأخرة / المتجاوزة (الانحراف)" : "Delayed / Overdue Tasks (Variance)",
                subtitle: isRTL ? `${shouldHaveBeenDoneTasks.length} مهمة تنتظر الإكمال` : `${shouldHaveBeenDoneTasks.length} tasks pending completion`,
                tasks: shouldHaveBeenDoneTasks
              })
            }
            className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-amber-500/50 cursor-pointer"
          >
            <span
              className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
                pointVariance < 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="text-xl font-bold text-foreground">
              {pointVariance > 0 ? `+${pointVariance}` : pointVariance} pts ({variancePct}%)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground group-hover:text-amber-500 transition-colors flex items-center justify-between">
              <span>{isRTL ? "انحراف الخطة مقابل الفعلي" : "Plan vs Actual Variance"}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 bg-muted text-foreground">
              <TrendingUp className="h-4 w-4" />
            </span>
            <p className="text-xl font-bold text-foreground">{spi} SPI</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {Number(spi) >= 1 ? (isRTL ? "متقدم عن الجدول" : "Ahead of Schedule") : (isRTL ? "متأخر عن الجدول" : "Behind Schedule")}
            </p>
          </div>
        </div>

        <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${pointVariance < 0 ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`} role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${pointVariance < 0 ? "text-amber-600" : "text-emerald-600"}`} aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {pointVariance < 0
                ? (isRTL ? `${shouldHaveBeenDoneTasks.length} مهمة تحتاج إلى مراجعة · ${Math.abs(pointVariance)} نقطة خلف الخطة` : `${shouldHaveBeenDoneTasks.length} tasks to review · ${Math.abs(pointVariance)} pts behind plan`)
                : (isRTL ? "الخطة تسير بشكل جيد" : "Plan is tracking well")}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setActiveTab("plan_vs_actual")} className="gap-1.5">
            {isRTL ? "مراجعة الخطة" : "Review plan"}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* View Navigation Tabs */}
        <div className="mb-6 flex flex-wrap border-b border-border text-sm font-medium no-print">
          <button
            onClick={() => setActiveTab("plan_vs_actual")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === "plan_vs_actual"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className="h-4 w-4" /> {isRTL ? "تحليل الخطة مقابل الفعلي" : "Planned vs Actual Analysis"}
          </button>
          <button
            onClick={() => setActiveTab("team_tasks")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === "team_tasks"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> {isRTL ? "مهام الفريق وعبء العمل" : "Team Tasks & Workload"}
          </button>
          <button
            onClick={() => setActiveTab("charts")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === "charts"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" /> {isRTL ? "الرسوم والتحليلات البصرية" : "Charts & Visual Analytics"}
          </button>
        </div>

        {/* TAB 1: PLANNED VS ACTUAL PLAN VARIANCE ANALYSIS */}
        {activeTab === "plan_vs_actual" && (
          <div className="space-y-6">
            {/* Visual Variance Comparison Bar */}
            {/* Visual Variance Comparison Timeline */}
            <Panel
              title={isRTL ? "الجدول الزمني للخطة مقابل الإكمال الفعلي" : "Expected Plan vs Actual Completion Timeline"}
              action={
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-foreground/15 border border-foreground/30" />
                    <span className="text-muted-foreground">{isRTL ? "مخطط" : "Planned"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500/40" />
                    <span className="text-muted-foreground">{isRTL ? "مكتمل" : "Completed"}</span>
                  </div>
                  {todayPct !== null && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-0.5 border-l-2 border-dashed border-rose-500" />
                      <span className="text-muted-foreground">{isRTL ? "اليوم (20 يوليو)" : "Today (July 20)"}</span>
                    </div>
                  )}
                </div>
              }
            >
              <div className="relative mt-2 border border-border bg-card/30 rounded-xl p-6 select-none min-h-[360px] overflow-visible">
                <div className="overflow-x-auto pb-24">
                <div className="min-w-[650px] relative flex-1 flex flex-col justify-between h-full">
                  {/* Today line */}
                  {todayPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px border-l border-dashed border-rose-500/60 z-10 pointer-events-none"
                      style={{ left: `${todayPct}%` }}
                    >
                      <div className="absolute top-0 -translate-x-1/2 -translate-y-6 bg-rose-500 text-[10px] text-white font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                        {isRTL ? "اليوم (20 يوليو)" : "Today (Jul 20)"}
                      </div>
                    </div>
                  )}

                  {/* 1. EXPECTED PLAN TRACK */}
                  <div className="relative mb-8 pt-6">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="font-semibold text-muted-foreground">
                        {isRTL ? "الخطة المستهدفة" : "Expected Target Plan"}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {expectedTimelineTasks.length} {isRTL ? "مهمة مخططة" : "tasks planned"}
                      </span>
                    </div>
                    
                    <div 
                      className="relative w-full rounded bg-muted/40 border border-border flex items-center"
                      style={{ height: `${Math.max(1, maxExpectedLevel + 1) * 36 + 16 + (hoveredTask?.track === "expected" ? 96 : 0)}px` }}
                      onMouseLeave={() => hoveredTask?.track === "expected" && setHoveredTask(null)}
                    >
                      {/* Horizontal timeline track line */}
                      <div className="absolute left-0 right-0 h-1 bg-foreground/20 rounded-full mx-4" />

                      {renderHoveredTaskCard("expected", "blue")}
                      
                      {/* Task nodes */}
                      <div className="absolute inset-0 mx-4">
                        {expectedTimelineTasks.map((t) => {
                          const task = t.task;
                          const priority = lookups.priorityById[t.task.priorityId];
                          return (
                            <div
                              key={t.task.id}
                              className="group absolute"
                              style={{
                                left: `${t.pct}%`,
                                bottom: `${t.level * 36 + 12}px`,
                                transform: "translateX(-50%)"
                              }}
                              onMouseEnter={() =>
                                setHoveredTask({
                                  task: t.task,
                                  x: t.pct,
                                  y: t.level,
                                  track: "expected"
                                })
                              }
                              onClick={() => setClickedTask(t.task)}
                            >
                              <div 
                                className="relative flex h-8 w-8 items-center justify-center rounded-full border bg-background hover:scale-110 active:scale-95 cursor-pointer shadow-md hover:shadow-lg transition-all duration-150"
                                style={{ borderColor: priority?.color || "#3b82f6", borderWidth: "2px" }}
                              >
                                <UserAvatar userId={t.task.assigneeId} externalId={t.task.externalAssigneeId} size="sm" className="pointer-events-none" />
                                
                                {/* Small Badge for Status Category */}
                                <div 
                                  className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full flex items-center justify-center border border-background shadow-sm"
                                  style={{ backgroundColor: lookups.statusById[t.task.statusId]?.color || "#94a3b8" }}
                                  title={lookups.statusById[t.task.statusId]?.name}
                                >
                                  <IssueTypeIcon typeKey={t.task.typeKey} className="h-2.5 w-2.5 text-white" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 2. ACTUAL COMPLETION TRACK */}
                  <div className="relative mb-8 pt-2">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {isRTL ? "تقدم الإكمال الفعلي" : "Actual Completed Progress"}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {actualTimelineTasks.length} / {expectedTimelineTasks.length} {isRTL ? "مهمة مكتملة" : "tasks completed"} ({expectedTimelineTasks.length ? Math.round((actualTimelineTasks.length / expectedTimelineTasks.length) * 100) : 0}%)
                      </span>
                    </div>

                    <div 
                      className="relative w-full rounded bg-emerald-500/5 border border-emerald-500/10 flex items-center"
                      style={{ height: `${Math.max(1, maxActualLevel + 1) * 36 + 16 + (hoveredTask?.track === "actual" ? 96 : 0)}px` }}
                      onMouseLeave={() => hoveredTask?.track === "actual" && setHoveredTask(null)}
                    >
                      {/* Horizontal timeline track line */}
                      <div className="absolute left-0 right-0 h-1 bg-emerald-500/30 rounded-full mx-4" />

                      {renderHoveredTaskCard("actual", "emerald")}

                      {/* Task nodes */}
                      <div className="absolute inset-0 mx-4">
                        {actualTimelineTasks.map((t) => {
                          const task = t.task;
                          const priority = lookups.priorityById[t.task.priorityId];
                          return (
                            <div
                              key={t.task.id}
                              className="group absolute"
                              style={{
                                left: `${t.pct}%`,
                                bottom: `${t.level * 36 + 12}px`,
                                transform: "translateX(-50%)"
                              }}
                              onMouseEnter={() =>
                                setHoveredTask({
                                  task: t.task,
                                  x: t.pct,
                                  y: t.level,
                                  track: "actual"
                                })
                              }
                              onClick={() => setClickedTask(t.task)}
                            >
                              <div 
                                className="relative flex h-8 w-8 items-center justify-center rounded-full border bg-background hover:scale-110 active:scale-95 cursor-pointer shadow-md hover:shadow-lg transition-all duration-150"
                                style={{ borderColor: priority?.color || "#10b981", borderWidth: "2px" }}
                              >
                                <UserAvatar userId={t.task.assigneeId} externalId={t.task.externalAssigneeId} size="sm" className="pointer-events-none" />

                                {/* Small Badge for Done Status */}
                                <div 
                                  className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full flex items-center justify-center border border-background bg-emerald-500 shadow-sm"
                                  title="Done"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 3. TIMELINE AXIS */}
                  <div className="relative border-t border-border pt-4 mt-2">
                    <div className="absolute left-0 right-0 mx-4 flex justify-between">
                      {timelineTicks.map((tick, i) => {
                        const tickPct = expectedTimelineTasks.length ? ((tick.getTime() - timelineDates.minTime) / timelineDates.span) * 100 : (i / 5) * 100;
                        return (
                          <div
                            key={i}
                            className="absolute -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${tickPct}%` }}
                          >
                            <div className="h-1.5 w-px bg-border" />
                            <span className="text-[10px] text-muted-foreground font-semibold mt-1 whitespace-nowrap">
                              {tick.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
              </div>
            </Panel>

            {/* Table: Tasks That Should Have Been Done (Delayed Tasks) */}
            <Panel
              title={isRTL ? `المهام التي كان يجب إنجازها (${shouldHaveBeenDoneTasks.length})` : `Tasks That Should Have Been Done (${shouldHaveBeenDoneTasks.length})`}
              subtitle={isRTL ? "المهام المخطط لها حتى اليوم والتي ما زالت معلقة أو مفتوحة" : "Planned tasks that were scheduled for completion by today but are still pending or open"}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                      <th className="pb-2.5 font-medium">{isRTL ? "رمز المهمة والعنوان" : "Task Key & Title"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "المسند إليه" : "Assignee"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "السبرينت" : "Sprint"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "النقاط" : "Points"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "الحالة" : "Status"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "تاريخ الاستحقاق" : "Due Date"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {shouldHaveBeenDoneTasks.map((t) => {
                      const task = t;
                      const assignee = lookups.userById[t.assigneeId || ""];
                      const sprint = lookups.sprintById[t.sprintId || ""];
                      const st = lookups.statusById[t.statusId];
                      const prio = lookups.priorityById[t.priorityId];

                      return (
                        <tr
                          key={t.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`${t.key}: ${t.title}`}
                          onClick={() => setSelectedIssue(t.id)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedIssue(t.id); } }}
                          className="cursor-pointer transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <IssueTypeIcon typeKey={t.typeKey} className="h-4 w-4 shrink-0" />
                              <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
                              <span className="font-medium text-foreground hover:text-primary transition-colors">
                                {t.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            {assignee || task.externalAssigneeId ? (
                              <div className="flex items-center gap-1.5">
                                <UserAvatar userId={assignee?.id} externalId={task.externalAssigneeId} size="sm" />
                                <span className="text-foreground">
                                  {assignee?.name || lookups.partnerMemberById[task.externalAssigneeId || ""]?.name || (isRTL ? "مسند خارجي" : "Partner assignee")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{isRTL ? "غير مسند" : "Unassigned"}</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 font-medium text-foreground">
                            {sprint?.name || (isRTL ? "المتراكم" : "Backlog")}
                          </td>
                          <td className="py-3 pr-3 font-semibold text-foreground">
                            {t.storyPoints ?? 1} {isRTL ? "نقطة" : "pts"}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: `${st?.color}1f`, color: st?.color }}
                            >
                              {st?.name || (isRTL ? "مفتوحة" : "Open")}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-amber-600 dark:text-amber-400">
                            {formatReportDate(t.dueDate) ?? (isRTL ? "متأخرة" : "Overdue")}
                          </td>
                        </tr>
                      );
                    })}

                    {shouldHaveBeenDoneTasks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-500" /> All planned tasks have been completed on schedule!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 2: TEAM TASKS & WORKLOAD */}
        {activeTab === "team_tasks" && (
          <div className="space-y-6">
            {/* Team Workload Chart */}
            <Panel title={isRTL ? "توزيع عبء العمل للفريق" : "Team Workload Distribution"} subtitle={isRTL ? "انقر على أي عضو لعرض المهام المسندة إليه" : "Click any member row to inspect their assigned tasks"}>
              <div className="space-y-2">
                {teamWorkload.map((tw) => (
                  <BarRow
                    key={tw.user.id}
                    label={tw.user.name}
                    subtitle={isRTL ? `${tw.user.role} · ${tw.open.length} مهام مفتوحة` : `${tw.user.role} · ${tw.open.length} open tasks`}
                    value={tw.openPts}
                    max={maxTeamPts}
                    color="#3b82f6"
                    onClick={() =>
                      setChartModal({
                        title: isRTL ? `المهام المسندة إلى ${tw.user.name}` : `Tasks Assigned to ${tw.user.name}`,
                        subtitle: isRTL ? `${tw.assigned.length} مهمة مسندة (${tw.openPts} نقطة قصة مفتوحة)` : `${tw.assigned.length} assigned tasks (${tw.openPts} open story points)`,
                        tasks: tw.assigned
                      })
                    }
                  />
                ))}
              </div>
            </Panel>

            {/* Team Member Task Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {teamWorkload.map(({ user, assigned, open, done, openPts, capacityPct }) => (
                <div key={user.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar userId={user.id} size="md" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1"
                      onClick={() =>
                        setChartModal({
                          title: isRTL ? `المهام المسندة إلى ${user.name}` : `Tasks Assigned to ${user.name}`,
                          subtitle: isRTL ? `${assigned.length} مهمة مسندة (${openPts} نقطة مفتوحة)` : `${assigned.length} assigned tasks (${openPts} open points)`,
                          tasks: assigned
                        })
                      }
                    >
                      {isRTL ? `عرض الكل (${assigned.length})` : `View All (${assigned.length})`}
                    </Button>
                  </div>

                  {/* Member Capacity Progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{isRTL ? "استخدام عبء العمل" : "Workload Utilization"}</span>
                      <span>{capacityPct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          capacityPct > 85 ? "bg-amber-500" : "bg-primary"
                        }`}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="mt-3 space-y-1.5 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {isRTL ? `المهام المفتوحة (${open.length})` : `Open Tasks (${open.length})`}
                    </p>
                    {open.slice(0, 4).map((task) => {
                      const st = lookups.statusById[task.statusId];
                      return (
                        <button
                          key={task.id}
                          onClick={() => setSelectedIssue(task.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <IssueTypeIcon typeKey={task.typeKey} className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono text-[10px] text-muted-foreground">{task.key}</span>
                            <span className="truncate text-foreground font-medium">{task.title}</span>
                          </div>
                          <span
                            className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: `${st?.color}1f`, color: st?.color }}
                          >
                            {st?.name}
                          </span>
                        </button>
                      );
                    })}

                    {open.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">{isRTL ? "لا توجد مهام مفتوحة مسندة." : "No open tasks assigned."}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CHARTS & VISUAL ANALYTICS */}
        {activeTab === "charts" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={isRTL ? "الاحتراق التنازلي للسبرينت" : "Sprint Burndown"} subtitle={isRTL ? "مرّر فوق النقاط لعرض التفاصيل اليومية، وانقر لعرض مهام السبرينت" : "Hover points to view daily details; click points to inspect sprint tasks"}>
              <BurndownChart
                total={totalPoints}
                metrics={burndown.map((b) => ({
                  date: new Date(Date.now() - (days - b.d) * 86400000).toISOString().slice(0, 10),
                  total_points: totalPoints,
                  completed_points: totalPoints - (b.actual ?? totalPoints),
                  remaining_points: b.actual ?? totalPoints,
                }))}
                sprintDays={days}
                onPointClick={() =>
                  setChartModal({
                    title: isRTL ? `مهام السبرينت النشط (${activeSprint?.name || "سبرينت"})` : `Active Sprint Tasks (${activeSprint?.name || "Sprint"})`,
                    subtitle: isRTL ? `${sprintIssues.length} مهمة بإجمالي ${totalPoints} نقطة قصة` : `${sprintIssues.length} tasks totaling ${totalPoints} story points`,
                    tasks: sprintIssues
                  })
                }
              />
            </Panel>

            <Panel title={isRTL ? "اتجاه السرعة" : "Velocity Trend"} subtitle={isRTL ? "آخر 5 سباقات مكتملة: مخطط مقابل مكتمل" : "Last 5 completed sprints: planned vs completed"}>
              <VelocityChart
                sprints={velocity.map((v, i) => ({
                  sprint_id: i,
                  name: v.name,
                  planned: v.committed,
                  completed: v.completed,
                }))}
                average={avgVelocity}
              />
            </Panel>

            <Panel title={isRTL ? "توزيع حالة المهام" : "Task Status Distribution"} subtitle={isRTL ? "انقر على أي شريط حالة لعرض المهام المطابقة" : "Click any status bar to view matching tasks"}>
              <div className="space-y-2">
                {statusDistribution.map((st) => (
                  <BarRow
                    key={st.id}
                    label={st.name}
                    value={st.count}
                    max={maxStatus}
                    color={st.color}
                    onClick={() =>
                      setChartModal({
                        title: `Tasks with Status: ${st.name}`,
                        subtitle: `${st.count} tasks matching status '${st.name}'`,
                        tasks: st.tasks
                      })
                    }
                  />
                ))}
              </div>
            </Panel>

            <Panel title={isRTL ? "المهام حسب النوع" : "Issues by Type"} subtitle={isRTL ? "انقر على أي شريط نوع لعرض المهام المطابقة" : "Click any issue type bar to view matching tasks"}>
              <div className="space-y-2">
                {byType.map((t) => (
                  <BarRow
                    key={t.key}
                    label={t.name}
                    value={t.count}
                    max={maxType}
                    color={t.color}
                    onClick={() =>
                      setChartModal({
                        title: `Tasks of Type: ${t.name}`,
                        subtitle: `${t.count} tasks matching type '${t.name}'`,
                        tasks: t.tasks
                      })
                    }
                  />
                ))}
              </div>
            </Panel>

            <Panel title={isRTL ? "المهام حسب الأولوية" : "Issues by Priority"} subtitle={isRTL ? "انقر على أي شريط أولوية لعرض المهام المطابقة" : "Click any priority bar to view matching tasks"}>
              <div className="space-y-2">
                {byPriority.map((p) => (
                  <BarRow
                    key={p.id}
                    label={p.name}
                    value={p.count}
                    max={maxPriority}
                    color={p.color}
                    onClick={() =>
                      setChartModal({
                        title: `Tasks with Priority: ${p.name}`,
                        subtitle: `${p.count} tasks matching priority '${p.name}'`,
                        tasks: p.tasks
                      })
                    }
                  />
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* Chart Filtered Tasks Details Modal */}
      <Dialog open={Boolean(chartModal)} onOpenChange={(open) => !open && setChartModal(null)}>
        {chartModal && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{chartModal.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">{chartModal.subtitle}</p>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                      <th className="pb-2.5 font-medium">{isRTL ? "المهمة" : "Task"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "المسند إليه" : "Assignee"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "السبرينت" : "Sprint"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "النقاط" : "Points"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "الأولوية" : "Priority"}</th>
                      <th className="pb-2.5 font-medium">{isRTL ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {chartModal.tasks.map((task) => {
                      const assignee = lookups.userById[task.assigneeId || ""];
                      const sprint = lookups.sprintById[task.sprintId || ""];
                      const st = lookups.statusById[task.statusId];
                      const prio = lookups.priorityById[task.priorityId];

                      return (
                        <tr
                          key={task.id}
                          onClick={() => {
                            setChartModal(null);
                            setSelectedIssue(task.id);
                          }}
                          className="hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-2">
                              <IssueTypeIcon typeKey={task.typeKey} className="h-4 w-4 shrink-0" />
                              <span className="font-mono text-xs text-muted-foreground">{task.key}</span>
                              <span className="font-medium text-foreground hover:text-primary transition-colors">
                                {task.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            {assignee || task.externalAssigneeId ? (
                              <div className="flex items-center gap-1.5">
                                <UserAvatar userId={assignee?.id} externalId={task.externalAssigneeId} size="sm" />
                                <span className="text-foreground">
                                  {assignee?.name || lookups.partnerMemberById[task.externalAssigneeId || ""]?.name || (isRTL ? "مسند خارجي" : "Partner assignee")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{isRTL ? "غير مسند" : "Unassigned"}</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 font-medium text-foreground">
                            {sprint?.name || (isRTL ? "المتراكم" : "Backlog")}
                          </td>
                          <td className="py-3 pr-3 font-semibold text-foreground">
                            {task.storyPoints ?? 1} {isRTL ? "نقطة" : "pts"}
                          </td>
                          <td className="py-3 pr-3">
                            {prio ? (
                              <span
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: `${prio.color}18`, color: prio.color }}
                              >
                                {prio.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: `${st?.color}1f`, color: st?.color }}
                            >
                              {st?.name}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {chartModal.tasks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          {isRTL ? "لا توجد مهام مطابقة لهذا الفلتر" : "No tasks match this filter."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChartModal(null)}>
                {isRTL ? "إغلاق" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Click Interaction Dialog */}
      {clickedTask && (
        <Dialog open={!!clickedTask} onOpenChange={(open) => !open && setClickedTask(null)}>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <IssueTypeIcon typeKey={clickedTask.typeKey} className="h-4 w-4 shrink-0" />
                <span>{clickedTask.key} {isRTL ? "التفاصيل والإجراءات" : "Details & Actions"}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
                <h3 className="font-semibold text-sm text-foreground">{clickedTask.title}</h3>
                {clickedTask.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {clickedTask.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    {isRTL ? "حالة المهمة" : "Task Status"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: lookups.statusById[clickedTask.statusId]?.color }}
                    />
                    <span className="text-xs font-semibold text-foreground">
                      {lookups.statusById[clickedTask.statusId]?.name}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    {isRTL ? "نقاط القصة" : "Story Points"}
                  </span>
                  <p className="text-xs font-semibold text-foreground">
                    {clickedTask.storyPoints ?? 0} pt{clickedTask.storyPoints !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Assignee Card */}
              <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar userId={clickedTask.assigneeId} externalId={clickedTask.externalAssigneeId} size="default" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {clickedTask.assigneeId ? lookups.userById[clickedTask.assigneeId]?.name : clickedTask.externalAssigneeId ? lookups.partnerMemberById[clickedTask.externalAssigneeId]?.name || (isRTL ? "مسند خارجي" : "Partner assignee") : (isRTL ? "غير مسند" : "Unassigned")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {clickedTask.assigneeId ? lookups.userById[clickedTask.assigneeId]?.role : clickedTask.externalAssigneeId ? (isRTL ? "عضو شريك" : "Partner member") : (isRTL ? "لا يوجد مسند إليه" : "No assignee")}
                    </p>
                  </div>
                </div>
                {clickedTask.assigneeId && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px] gap-1"
                    onClick={() => {
                      const assigneeId = clickedTask.assigneeId;
                      setClickedTask(null);
                      navigate(`/team?userId=${assigneeId}`);
                    }}
                  >
                    <Users className="h-3 w-3" /> {isRTL ? "عرض صفحة العضو" : "View Member Page"}
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter className="flex sm:justify-between items-center gap-2">
              <Button
                variant="default"
                className="flex-1 sm:flex-none gap-1.5 text-xs"
                onClick={() => {
                  const id = clickedTask.id;
                  setClickedTask(null);
                  setSelectedIssue(id);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Task Drawer
              </Button>
              <Button variant="outline" className="text-xs" onClick={() => setClickedTask(null)}>
                {isRTL ? "إغلاق" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


export default ReportsPage;
