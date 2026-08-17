import React, { useState, useEffect } from "react";
import { GitPullRequestArrow, Sparkles, ShieldAlert, CheckCircle, AlertTriangle, CalendarRange, Users, Loader2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ClientRequest } from "../data/types";

interface Bottleneck {
  id: string;
  name: string;
  role: string;
  current_pct: number;
  simulated_pct: number;
  overload_margin: number;
  conflict_type: string;
}

interface TimelineShift {
  milestone_id: string;
  milestone_name: string;
  original_date: string;
  simulated_date: string;
  shift_days: number;
  status: string;
}

interface ImpactSimulationResponse {
  request_id: string;
  request_title: string;
  simulated_project_hours: number;
  overall_status: "low_risk" | "high_risk";
  bottlenecks: Bottleneck[];
  timeline_shifts: TimelineShift[];
  recommendation: string;
}

const demoRequests: ClientRequest[] = [
  {
    id: "demo-priority-1",
    client_id: "demo-client-1",
    title: "Retail mobile app launch",
    description: "Urgent launch request with checkout, analytics, and QA support.",
    type: "demo",
    status: "pending",
    estimated_hours: 140,
    due_date: "2026-08-15",
    created_at: "2026-07-28T09:00:00Z",
  },
  {
    id: "demo-priority-2",
    client_id: "demo-client-2",
    title: "ERP reporting expansion",
    description: "Add finance dashboards, exports, and role-based access to reports.",
    type: "rfp",
    status: "review",
    estimated_hours: 96,
    due_date: "2026-08-08",
    created_at: "2026-07-28T09:00:00Z",
  },
  {
    id: "demo-priority-3",
    client_id: "demo-client-3",
    title: "Website refresh for product launch",
    description: "Marketing-led request needing design, content, and frontend support.",
    type: "presentation",
    status: "accepted",
    estimated_hours: 64,
    due_date: "2026-08-05",
    created_at: "2026-07-28T09:00:00Z",
  },
];

const demoSimulations: Record<string, ImpactSimulationResponse> = {
  "demo-priority-1": {
    request_id: "demo-priority-1",
    request_title: "Retail mobile app launch",
    simulated_project_hours: 140,
    overall_status: "high_risk",
    bottlenecks: [
      {
        id: "demo-resource-1",
        name: "Alex Developer",
        role: "Backend Engineer",
        current_pct: 82,
        simulated_pct: 117,
        overload_margin: 17,
        conflict_type: "capacity_overload",
      },
      {
        id: "demo-resource-2",
        name: "Jordan Dev",
        role: "Developer",
        current_pct: 76,
        simulated_pct: 111,
        overload_margin: 11,
        conflict_type: "capacity_overload",
      },
    ],
    timeline_shifts: [
      {
        milestone_id: "demo-milestone-1",
        milestone_name: "Checkout integration",
        original_date: "2026-08-04",
        simulated_date: "2026-08-09",
        shift_days: 5,
        status: "delayed",
      },
      {
        milestone_id: "demo-milestone-2",
        milestone_name: "Launch readiness review",
        original_date: "2026-08-12",
        simulated_date: "2026-08-18",
        shift_days: 6,
        status: "delayed",
      },
    ],
    recommendation: "Defer this request or split the scope into phases before committing. Current engineering capacity would overload two active contributors and push the launch timeline.",
  },
  "demo-priority-2": {
    request_id: "demo-priority-2",
    request_title: "ERP reporting expansion",
    simulated_project_hours: 96,
    overall_status: "low_risk",
    bottlenecks: [],
    timeline_shifts: [
      {
        milestone_id: "demo-milestone-3",
        milestone_name: "Finance dashboard release",
        original_date: "2026-08-06",
        simulated_date: "2026-08-08",
        shift_days: 2,
        status: "at_risk",
      },
    ],
    recommendation: "This request is workable if reporting tasks are grouped into one sprint and assigned to analytics capacity first. Monitor the finance dashboard milestone for a minor slip.",
  },
  "demo-priority-3": {
    request_id: "demo-priority-3",
    request_title: "Website refresh for product launch",
    simulated_project_hours: 64,
    overall_status: "low_risk",
    bottlenecks: [],
    timeline_shifts: [],
    recommendation: "Safe to accept. The current team can absorb this request with minimal schedule impact if design review happens before frontend implementation starts.",
  },
};

export default function PriorityImpactPage() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [simulation, setSimulation] = useState<ImpactSimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await api.get<ClientRequest[] | { data: ClientRequest[] }>("/requests");
      const liveRequests = Array.isArray(data) ? data : (data?.data || []);
      const nextRequests = liveRequests.length > 0 ? liveRequests : demoRequests;
      setRequests(nextRequests);
      setSelectedRequestId(nextRequests[0]?.id || "");
      setUsingDemoData(liveRequests.length === 0);
    } catch {
      setRequests(demoRequests);
      setSelectedRequestId(demoRequests[0].id);
      setUsingDemoData(true);
      toast.error("Live requests were unavailable. Showing demo requests instead.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;

  const handleSimulate = async () => {
    if (!selectedRequestId) return;
    setSimulating(true);
    setSimulation(null);
    if (demoSimulations[selectedRequestId]) {
      setSimulation(demoSimulations[selectedRequestId]);
      setSimulating(false);
      toast.success("Demo simulation loaded");
      return;
    }
    try {
      const res = await api.get<ImpactSimulationResponse>(`/priority-impact/simulate?request_id=${selectedRequestId}`);
      if (res) {
        setSimulation(res);
        toast.success("Simulation computed successfully");
      }
    } catch {
      toast.error("Impact simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title="Priority Impact Preview"
          subtitle="Model how assigning a new client request or project affects active resource capacity and Gantt timeline schedules."
        />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {usingDemoData && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                No live client requests were found, so this page is using demo entries. Pick a request, run the simulator, and review bottlenecks, timeline shifts, and the recommendation panel.
              </div>
            )}

            <div className="mb-1 rounded-xl border border-border bg-card p-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-foreground">Answer one decision before you commit</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">This simulation tests whether the incoming request fits current capacity and what it may move on the delivery timeline.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Capacity + timeline</span></div><div className="mt-3 grid gap-2 text-left sm:grid-cols-3"><div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-xs font-semibold text-foreground">1. Select</p><p className="mt-1 text-[11px] text-muted-foreground">Choose the request being considered.</p></div><div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-xs font-semibold text-foreground">2. Simulate</p><p className="mt-1 text-[11px] text-muted-foreground">Model resource and milestone pressure.</p></div><div className="rounded-lg border border-border/70 bg-background p-3"><p className="text-xs font-semibold text-foreground">3. Decide</p><p className="mt-1 text-[11px] text-muted-foreground">Accept, split, defer, or review the plan.</p></div></div></div>

            {/* Control Panel */}
            <div className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row items-end gap-4 max-w-3xl">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-semibold text-foreground">Select Incoming Client Request</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedRequestId}
                  onChange={(e) => setSelectedRequestId(e.target.value)}
                >
                  <option value="">-- Choose Request --</option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>
              {selectedRequest && <div className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs sm:w-auto sm:min-w-[190px]"><p className="font-semibold text-foreground">{selectedRequest.estimated_hours ?? "—"} estimated hours</p><p className="mt-0.5 text-muted-foreground">Due {selectedRequest.due_date ? new Date(selectedRequest.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "not set"}</p></div>}
              <Button onClick={handleSimulate} disabled={simulating || !selectedRequestId} className="h-10 shrink-0 gap-1.5">
                {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitPullRequestArrow className="h-4 w-4" />}
                Run Impact Simulator
              </Button>
            </div>

            {/* Simulation Results */}
            {simulating && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm">AI is computing resource allocations and shifting milestones...</p>
              </div>
            )}

            {simulation && (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Executive Recommendation */}
                <div className="lg:col-span-1 space-y-4">
                  <div className={`rounded-xl border p-6 space-y-4 ${
                    simulation.overall_status === "high_risk" 
                      ? "bg-destructive/5 border-destructive/20" 
                      : "bg-success/5 border-success/20"
                  }`}>
                    <div className="flex items-center gap-2">
                      {simulation.overall_status === "high_risk" ? (
                        <ShieldAlert className="h-6 w-6 text-destructive" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-success" />
                      )}
                      <h3 className="text-sm font-bold text-foreground">AI Priority Decision</h3>
                    </div>

                    <div className="text-xs space-y-2">
                      <p className="text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Status:</span>{" "}
                        {simulation.overall_status === "high_risk" ? "High Risk Capacity Contention" : "Low Risk Safe Capacity"}
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Proposed Scope:</span>{" "}
                        {simulation.simulated_project_hours} estimated hours required.
                      </p>
                    </div>

                    <div className="bg-card border p-3.5 rounded-lg text-xs leading-relaxed text-muted-foreground">
                      <span className="font-bold text-foreground block mb-0.5">Recommendation:</span>
                      {simulation.recommendation}
                    </div>
                  </div>
                </div>

                {/* Resource Over-allocations */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      Resource Bottlenecks
                    </h3>

                    <div className="space-y-3">
                      {simulation.bottlenecks.map((b) => (
                        <div key={b.id} className="p-3.5 border border-warning/30 bg-warning/5 rounded-lg space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{b.name}</p>
                              <p className="text-xs text-muted-foreground">{b.role}</p>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-warning bg-warning/15 px-2 py-0.5 rounded">
                              Overloaded
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 text-xs">
                            <div>
                              <span className="text-muted-foreground mr-1">Current:</span>
                              <span className="font-semibold">{b.current_pct}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground mr-1">Simulated:</span>
                              <span className="font-bold text-destructive">{b.simulated_pct}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {simulation.bottlenecks.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No resource overallocation conflicts detected.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Shifts / Gantt Milestones */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <CalendarRange className="h-5 w-5 text-muted-foreground" />
                      Milestone Shifts
                    </h3>

                    <div className="space-y-3">
                      {simulation.timeline_shifts.map((s) => (
                        <div key={s.milestone_id} className="p-3 border rounded-lg bg-muted/40 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-foreground truncate w-2/3">{s.milestone_name}</span>
                            <span className="text-destructive font-bold">+{s.shift_days} days</span>
                          </div>
                          
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Original: {new Date(s.original_date).toLocaleDateString()}</span>
                            <span>Simulated: {new Date(s.simulated_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                      {simulation.timeline_shifts.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No active milestones to simulate timeline shifts on.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
