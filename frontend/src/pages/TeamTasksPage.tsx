import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CircleDot, CheckCircle2, Timer, AlertTriangle, Clock, Users, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TaskItem {
  id: string; key: string; title: string; project: string; type: string;
  status: string; category: string; priority: string; due_date: string | null;
  overdue: boolean; estimated_hours: number | null; remaining_hours: number | null;
  workstream?: string | null;
}

interface MemberData {
  user: { id: string; name: string; avatar: string; role?: string; };
  total: number; done: number; in_progress: number; todo: number;
  overdue: number; estimated_hours: number; actual_hours: number;
  capacity_hours?: number; open_hours?: number; load_pct?: number;
  skills?: { id: string; name: string; proficiency: string; }[];
  tasks: TaskItem[];
}

interface TeamTasksData { members: MemberData[]; }

function TeamTasksPage() {
  const { i18n } = useTranslation();
  const [data, setData] = useState<TeamTasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const isRTL = i18n.dir() === "rtl";

  useEffect(() => {
    api.get<TeamTasksData>("/team-tasks/summary").then((res) => {
      if (res) setData(res);
    }).catch(() => setError(isRTL ? "فشل تحميل مهام الفريق" : "Failed to load team tasks"))
    .finally(() => setLoading(false));
  }, [isRTL]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-5">
            <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-4 w-60 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 h-4 w-40 animate-pulse rounded bg-muted" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 border-b border-border/50 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="flex h-full items-center justify-center"><div className="text-sm text-destructive">{error}</div></div>;

  const members = data?.members ?? [];
  const selected = selectedMember ? members.find((m) => m.user.id === selectedMember) : null;

  const totalTasks = members.reduce((s, m) => s + m.total, 0);
  const totalDone = members.reduce((s, m) => s + m.done, 0);
  const totalInProgress = members.reduce((s, m) => s + m.in_progress, 0);
  const totalOverdue = members.reduce((s, m) => s + m.overdue, 0);
  const totalLoad = members.reduce((s, m) => s + (m.load_pct ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto p-5" dir={i18n.dir()}>
      <div className="mx-auto max-w-screen-2xl">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-foreground">{isRTL ? "مهام الفريق" : "Team Tasks"}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isRTL ? `${members.length} أعضاء · ${totalTasks} مهمة إجمالاً` : `${members.length} members · ${totalTasks} total tasks`}
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#64748b1f", color: "#64748b" }}><CircleDot className="h-5 w-5" /></span>
              <div><p className="text-2xl font-semibold leading-none text-foreground">{totalTasks}</p><p className="mt-1 text-xs text-muted-foreground">{isRTL ? "إجمالي المهام" : "Total tasks"}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#22c55e1f", color: "#22c55e" }}><CheckCircle2 className="h-5 w-5" /></span>
              <div><p className="text-2xl font-semibold leading-none text-foreground">{totalDone}</p><p className="mt-1 text-xs text-muted-foreground">{isRTL ? "مكتمل" : "Done"}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#3b82f61f", color: "#3b82f6" }}><Timer className="h-5 w-5" /></span>
              <div><p className="text-2xl font-semibold leading-none text-foreground">{totalInProgress}</p><p className="mt-1 text-xs text-muted-foreground">{isRTL ? "قيد التنفيذ" : "In progress"}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#ef44441f", color: "#ef4444" }}><AlertTriangle className="h-5 w-5" /></span>
              <div><p className="text-2xl font-semibold leading-none text-foreground">{totalOverdue}</p><p className="mt-1 text-xs text-muted-foreground">{isRTL ? "متأخر" : "Overdue"}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#f973161f", color: "#f97316" }}><Flame className="h-5 w-5" /></span>
              <div><p className="text-2xl font-semibold leading-none text-foreground">{members.length ? Math.round(totalLoad / members.length) : 0}%</p><p className="mt-1 text-xs text-muted-foreground">{isRTL ? "متوسط الحمل" : "Avg load"}</p></div>
            </div>
          </div>
        </div>

        {/* Member performance */}
        <div className="mb-4 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{isRTL ? "أداء الأعضاء" : "Member Performance"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th className="px-4 pb-2 font-medium">{isRTL ? "العضو" : "Member"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "الإجمالي" : "Total"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "مكتمل" : "Done"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "قيد التنفيذ" : "In Progress"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "متأخر" : "Overdue"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "الساعات المقدرة" : "Est. hours"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "الساعات الفعلية" : "Actual hours"}</th>
                  <th className="px-4 pb-2 font-medium">{isRTL ? "الحمل" : "Load"}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.user.id}
                    onClick={() => setSelectedMember(selectedMember === m.user.id ? "" : m.user.id)}
                    className="border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {m.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{m.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{m.total}</td>
                    <td className="px-4 py-2.5" style={{ color: m.done > 0 ? "#22c55e" : "var(--muted-foreground)" }}>{m.done}</td>
                    <td className="px-4 py-2.5" style={{ color: m.in_progress > 0 ? "#3b82f6" : "var(--muted-foreground)" }}>{m.in_progress}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: m.overdue > 0 ? "#ef4444" : "var(--muted-foreground)" }}>{m.overdue}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.estimated_hours}h</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.actual_hours}h</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, m.load_pct ?? 0)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{m.load_pct ?? 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected member tasks */}
        {selected && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{isRTL ? `مهام ${selected.user.name}` : `${selected.user.name}'s Tasks`}</h2>
              <button onClick={() => setSelectedMember("")} className="text-xs text-muted-foreground hover:text-foreground">{isRTL ? "إغلاق" : "Close"}</button>
            </div>
                {selected.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد مهام مسندة." : "No tasks assigned."}</p>
                ) : (
                  <div className="divide-y divide-border">
                    {selected.tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 py-2.5">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{t.key}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{t.title}</span>
                        {t.workstream && (
                          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {t.workstream}
                          </span>
                        )}
                        <span
                          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{
                        backgroundColor: t.overdue ? "#ef44441f" : "#64748b1f",
                        color: t.overdue ? "#ef4444" : "#64748b",
                      }}
                    >
                      {t.status}
                    </span>
                    {t.due_date && (
                      <span className="shrink-0 text-xs text-muted-foreground">{t.due_date}</span>
                    )}
                      </div>
                    ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamTasksPage;
