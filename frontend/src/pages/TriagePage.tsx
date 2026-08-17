import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Inbox, XCircle, MessageSquare, Filter, Eye, MoveRight, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import { useUsers } from "../hooks/useDomain";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Textarea } from "../components/ui/Textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/SelectEnhanced";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

interface TriageIssue {
  id: number;
  key: string;
  title: string;
  description: string | null;
  triage_status: string;
  triage_notes: string | null;
  created_at: string;
  project: { id: number; name: string; key: string } | null;
  reporter: { id: number; name: string; avatar: string | null } | null;
  assignee: { id: number; name: string; avatar: string | null } | null;
  type: { id: number; name: string; color: string } | null;
}

function TriagePage() {
  const { t } = useTranslation();
  const setSelectedIssue = useStore((s) => s.setSelectedIssue);
  const { data: userData } = useUsers();
  const projects = useProjectCatalogStore((s) => s.projects);
  const [issues, setIssues] = useState<TriageIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [notesIssue, setNotesIssue] = useState<TriageIssue | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [undoIssue, setUndoIssue] = useState<TriageIssue | null>(null);
  const [undoAction, setUndoAction] = useState<"confirmed" | "dismissed" | null>(null);
  const users = userData ?? [];

  const fetchTriage = async () => {
    setLoading(true);
    try {
      const parts = [];
      if (filterProject !== "all") parts.push(`project_id=${filterProject}`);
      if (filterStatus !== "active") parts.push(`triage_status=${filterStatus}`);
      const query = parts.length ? `?${parts.join("&")}` : "";
      const res = await api.get<{ data: TriageIssue[] }>(`/triage${query}`);
      setIssues(res?.data ?? []);
    } catch {
      toast.error(t("triage.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriage();
  }, [filterProject, filterStatus]);

  const handleConfirm = async (issue: TriageIssue) => {
    try {
      await api.post(`/triage/${issue.id}/confirm`);
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
      setUndoIssue(issue);
      setUndoAction("confirmed");
      toast.success(t("triage.confirmedMoved", { key: issue.key }), {
        action: {
          label: t("triage.undo"),
          onClick: () => {
            void handleRevert(issue);
          },
        },
      });
    } catch {
      toast.error(t("triage.confirmFailed"));
    }
  };

  const handleDismiss = async (issue: TriageIssue) => {
    try {
      await api.post(`/triage/${issue.id}/dismiss`);
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
      setUndoIssue(issue);
      setUndoAction("dismissed");
      toast.success(t("triage.dismissedToast", { key: issue.key }), {
        action: {
          label: t("triage.undo"),
          onClick: () => {
            void handleRevert(issue);
          },
        },
      });
    } catch {
      toast.error(t("triage.dismissFailed"));
    }
  };

  const handleRevert = async (issue: TriageIssue) => {
    try {
      await api.post(`/triage/${issue.id}/revert`);
      await fetchTriage();
      setUndoIssue(null);
      setUndoAction(null);
      toast.success(t("triage.returnedToTriage", { key: issue.key }));
    } catch {
      toast.error(t("triage.undoFailed"));
    }
  };

  const handleAssign = async (issue: TriageIssue, assigneeId: string) => {
    try {
      const selectedUser = assigneeId === "unassigned" ? null : users.find((u) => u.id === assigneeId) ?? null;
      await api.put(`/issues/${issue.id}`, { assignee_id: selectedUser ? selectedUser.id : null });
      setIssues((prev) =>
        prev.map((item) =>
          item.id === issue.id
            ? {
                ...item,
                assignee: selectedUser ? { id: Number(selectedUser.id), name: selectedUser.name, avatar: null } : null,
              }
            : item
        )
      );
      toast.success(t("triage.assignedToast", { key: issue.key }));
    } catch {
      toast.error(t("triage.assignFailed"));
    }
  };

  const handleSaveNotes = async () => {
    if (!notesIssue) return;
    setSaving(true);
    try {
      await api.post(`/triage/${notesIssue.id}/triage`, {
        triage_status: "triaging",
        triage_notes: notesDraft.trim() || null,
      });
      setIssues((prev) =>
        prev.map((i) =>
          i.id === notesIssue.id
            ? { ...i, triage_status: "triaging", triage_notes: notesDraft.trim() || null }
            : i
        )
      );
      setNotesIssue(null);
      toast.success(t("triage.notesSaved"));
    } catch {
      toast.error(t("triage.notesSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("triage.title")}
          subtitle={t("triage.awaitingTriage", { count: issues.length })}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Inbox className="h-4 w-4" />
                <span>{t("triage.awaitingTriage", { count: issues.length })}</span>
              </div>
            </div>
          }
        />

        {undoIssue && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-medium text-foreground">
                {undoIssue.key} {undoAction === "dismissed" ? t("triage.dismissed") : t("triage.confirmed")}
              </span>
              <span className="truncate text-muted-foreground">
                {undoIssue.title}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleRevert(undoIssue)}>
              {t("triage.undo")}
            </Button>
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-4 flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("triage.filterByProject")}</span>
            </div>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("triage.allProjects")}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("triage.filterByStatus", { defaultValue: "Triage Status" })}</span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("triage.active", { defaultValue: "Awaiting Triage" })}</SelectItem>
                <SelectItem value="new">{t("triage.new", { defaultValue: "New" })}</SelectItem>
                <SelectItem value="triaging">{t("triage.triaging", { defaultValue: "Triaging" })}</SelectItem>
                <SelectItem value="confirmed">{t("triage.confirmed", { defaultValue: "Confirmed" })}</SelectItem>
                <SelectItem value="dismissed">{t("triage.dismissed", { defaultValue: "Dismissed" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Issues list */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">{t("triage.issue")}</th>
                <th className="px-3 py-2.5 font-medium">{t("triage.project")}</th>
                <th className="px-3 py-2.5 font-medium">{t("triage.createdBy")}</th>
                <th className="px-3 py-2.5 font-medium">{t("triage.createdAt")}</th>
                <th className="px-3 py-2.5 font-medium">{t("triage.status")}</th>
                <th className="px-3 py-2.5 font-medium text-right">{t("triage.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><div className="skeleton h-4 w-48" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-20" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-24" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-4 w-20" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="px-3 py-3"><div className="skeleton h-7 w-24 ms-auto rounded-lg" /></td>
                  </tr>
                ))
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="animate-bounce-in flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                        <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none">
                          <circle cx="24" cy="24" r="22" stroke="#10b981" strokeWidth="2.5" strokeDasharray="none" />
                          <path d="M14 24.5l7 7 13-14" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-foreground">{t("triage.noIssues", { defaultValue: "All caught up!" })}</p>
                      <p className="text-sm text-muted-foreground">{t("triage.allCaughtUpHint")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                        <p className="mt-0.5 font-medium text-foreground">{issue.title}</p>
                        {issue.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {issue.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {issue.project && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {issue.project.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {issue.reporter?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={issue.triage_status === "triaging" ? "secondary" : "outline"}>
                        {t(`triage.${issue.triage_status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("triage.addNotes")}
                          onClick={() => {
                            setNotesIssue(issue);
                            setNotesDraft(issue.triage_notes ?? "");
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("triage.openDetails")}
                          onClick={() => setSelectedIssue(String(issue.id))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Select
                          value={issue.assignee ? String(issue.assignee.id) : "unassigned"}
                          onValueChange={(value) => handleAssign(issue, value)}
                        >
                          <SelectTrigger className="h-8 w-36 gap-1 text-xs">
                            <span className="truncate">
                              {issue.assignee?.name ?? t("triage.assign")}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">{t("triage.assign")}</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {issue.triage_status !== "confirmed" && issue.triage_status !== "dismissed" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("triage.move")}
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleConfirm(issue)}
                            >
                              <MoveRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("triage.dismiss")}
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDismiss(issue)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={t("triage.undo", { defaultValue: "Return to Triage" })}
                            className="text-amber-600 hover:text-amber-700"
                            onClick={() => handleRevert(issue)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes dialog */}
      <Dialog open={!!notesIssue} onOpenChange={(o) => !o && setNotesIssue(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("triage.notes")} — {notesIssue?.key}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">{notesIssue?.title}</p>
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              placeholder={t("triage.notesPlaceholder")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesIssue(null)}>
              {t("app.cancel")}
            </Button>
            <Button onClick={handleSaveNotes} disabled={saving}>
              {saving ? t("app.saving") : t("app.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TriagePage;
