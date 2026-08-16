import React, { useState, useEffect } from "react";
import { CheckSquare2, ShieldCheck, ShieldAlert, AlertTriangle, Play, Loader2, ArrowRight, XCircle } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Textarea } from "../components/ui/Textarea";
import { api, getActiveProjectId, getProjectScope } from "../lib/api";
import { toast } from "sonner";
import { ValidationRule, ValidationResult, Project } from "../data/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";

export default function ValidationPage() {
  const activeProjectId = getActiveProjectId();
  const [project, setProject] = useState<Project | null>(null);
  const [gates, setGates] = useState<ValidationRule[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [comments, setComments] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "">("");

  // AI Release Notes state & handlers
  const [notesOpen, setNotesOpen] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState("");

  const handleGenerateReleaseNotes = async () => {
    setGeneratingNotes(true);
    setNotesOpen(true);
    try {
      const res = await api.post<{ markdown: string }>(`/projects/${activeProjectId}/validation/release-notes`);
      setNotesContent(res?.markdown || "");
    } catch {
      toast.error("Failed to generate AI Release Notes");
      setNotesOpen(false);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleDownloadNotes = () => {
    const element = document.createElement("a");
    const file = new Blob([notesContent], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `Release-Notes-${project?.key || 'project'}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const loadData = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const proj = await api.get<Project>(`/projects/${activeProjectId}`);
      setProject(proj);
      const ruleData = await api.get<ValidationRule[]>(`/projects/${activeProjectId}/validation`);
      setGates(ruleData || []);
    } catch {
      toast.error("Failed to load validation gates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeProjectId]);

  const handleRunVerification = async () => {
    if (!activeProjectId) return;
    setRunning(true);
    try {
      const verifiedResults = await api.post<ValidationResult[]>(`/projects/${activeProjectId}/validation/verify`);
      setResults(verifiedResults || []);
      toast.success("Validation gates executed");
      loadData();
    } catch {
      toast.error("Verification execution failed");
    } finally {
      setRunning(false);
    }
  };

  const handleHandoffAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || !action || !comments) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ status: string; message: string }>(
        `/projects/${activeProjectId}/validation/handoff`,
        { action, comments }
      );
      if (res) {
        if (res.status === "approved") {
          toast.success(res.message);
        } else {
          toast.warning(res.message);
        }
        setComments("");
        setAction("");
        loadData();
      }
    } catch {
      toast.error("Failed to submit handoff audit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeProjectId) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-muted-foreground">
        <p>No active project selected. Switch projects to access Validation Gates.</p>
      </div>
    );
  }

  const failedCount = results.filter((r) => r.status === "failed").length;
  const warningCount = results.filter((r) => r.status === "warning").length;

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title="Delivery Validation Gates"
          subtitle={`Enforce quality policies and requirement checks on project handoffs for: ${project?.name || "Active Project"}`}
          actions={
            <div className="flex gap-2.5">
              <Button onClick={handleRunVerification} disabled={running} className="flex items-center gap-1.5">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Verification Gates
              </Button>
              <Button onClick={handleGenerateReleaseNotes} variant="outline" className="flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
                Generate AI Release Notes
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="skeleton h-4 w-40" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 border border-border rounded-xl">
                    <div className="skeleton h-6 w-6 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-48" />
                      <div className="skeleton h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-5">
                <div className="skeleton h-4 w-32 mb-3" />
                <div className="skeleton h-2 w-full rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Gates checklist */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Active Quality Rules</h3>
                  {results.length > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {results.filter(r => r.status === "passed").length} Passing
                      </span>
                      {failedCount > 0 && <span className="flex items-center gap-1 text-destructive"><span className="h-1.5 w-1.5 rounded-full bg-destructive" />{failedCount} Failed</span>}
                      {warningCount > 0 && <span className="flex items-center gap-1 text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{warningCount} Warning</span>}
                    </div>
                  )}
                </div>
                {results.length > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${Math.round((results.filter(r => r.status === "passed").length / results.length) * 100)}%` }}
                    />
                  </div>
                )}
                
                <div className="space-y-3">
                  {gates.map((gate) => {
                    const latestResult = results.find((r) => r.validation_rule_id === gate.id) 
                      || (gate.results && gate.results.length > 0 ? gate.results[0] : null);

                    return (
                      <div key={gate.id} className="p-4 border rounded-xl flex items-start gap-4 hover:bg-muted/30 transition-colors">
                        <div className="shrink-0 mt-0.5">
                          {latestResult?.status === "passed" && (
                            <ShieldCheck className="h-6 w-6 text-success animate-pulse" />
                          )}
                          {latestResult?.status === "failed" && (
                            <ShieldAlert className="h-6 w-6 text-destructive" />
                          )}
                          {latestResult?.status === "warning" && (
                            <AlertTriangle className="h-6 w-6 text-warning" />
                          )}
                          {!latestResult && (
                            <CheckSquare2 className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-semibold text-foreground">{gate.name}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{gate.description}</p>
                          {latestResult && (
                            <div className="pt-2">
                              <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded ${
                                latestResult.status === "passed" ? "bg-success/15 text-success" :
                                latestResult.status === "failed" ? "bg-destructive/15 text-destructive" :
                                "bg-warning/15 text-warning"
                              }`}>
                                {latestResult.status.toUpperCase()}: {latestResult.message || "Rule evaluated."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {gates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No validation gates configured.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Validator Actions */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <h3 className="text-sm font-bold text-foreground">Handoff Sign-off</h3>
                
                {results.length > 0 && (
                  <div className="p-3.5 border rounded-lg text-xs space-y-2">
                    <span className="font-semibold text-foreground block">Verification Result:</span>
                    <div className="flex gap-4">
                      <div>
                        <span className="text-muted-foreground mr-1">Failed Gates:</span>
                        <span className={`font-bold ${failedCount > 0 ? "text-destructive" : "text-success"}`}>{failedCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground mr-1">Warnings:</span>
                        <span className={`font-bold ${warningCount > 0 ? "text-warning" : "text-muted-foreground"}`}>{warningCount}</span>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleHandoffAction} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Review Action</label>
                    <select
                      required
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={action}
                      onChange={(e) => setAction(e.target.value as "approve" | "reject" | "")}
                    >
                      <option value="">-- Choose Sign-off Action --</option>
                      <option value="approve" disabled={failedCount > 0}>Approve Handoff</option>
                      <option value="reject">Reject & Request Fixes</option>
                    </select>
                    {failedCount > 0 && (
                      <p className="text-[10px] text-destructive flex items-center gap-0.5 mt-1">
                        <XCircle className="h-3 w-3 shrink-0" /> Cannot approve while failed gates are remaining.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Review Comments / Justification</label>
                    <Textarea
                      required
                      rows={4}
                      placeholder="Provide validation comments or specific issues to be resolved..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={submitting || !action} className="w-full">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Submit Sign-off Audit
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Release Notes Dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>AI Compiled Sprint Release Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Automatically compiled and generated from completed sprint tasks, commits, and quality validation logs:
            </p>
            {generatingNotes ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Analyzing completed tasks & quality logs...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                  rows={16}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)}>
              Close
            </Button>
            <Button onClick={handleDownloadNotes} disabled={generatingNotes || !notesContent}>
              Download Release Notes (.md)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
