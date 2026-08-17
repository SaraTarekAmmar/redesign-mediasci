import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Check, X, Eye, FileQuestion } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/Dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/SelectEnhanced";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

interface CR {
  id: number;
  project_id: number | null;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  impact: string;
  business_justification: string | null;
  rollback_plan: string | null;
  rejection_reason: string | null;
  requested_by: string | number;
  date: string;
  status: string;
  approved_by: string | number | null;
  assigned_to: string | number | null;
  notes: string | null;
  created_at: string;
  requestedBy?: { id: number; name: string; email: string } | null;
  approvedBy?: { id: number; name: string; email: string } | null;
  project?: { id: number; name: string; key: string } | null;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending:     { label: "Pending",     className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  approved:    { label: "Approved",    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  rejected:    { label: "Rejected",    className: "bg-destructive/10 text-destructive" },
  implemented: { label: "Implemented", className: "bg-primary/10 text-primary" },
};

const IMPACT_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "bg-destructive/10 text-destructive",
};

const TYPE_CLASS: Record<string, string> = {
  standard: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  normal: "bg-muted text-muted-foreground",
  emergency: "bg-destructive/10 text-destructive",
};

type View = "all" | "my" | "approvals";

function ChangeRequestsPage({ view = "all" }: { view?: View }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const { user } = useAuth();
  const isApprover = user?.role === "super-admin" || user?.role === "admin" || user?.role === "project-manager" || user?.role === "team-leader";
  const activeProject = useProjectCatalogStore((s) => s.activeProject);

  const [requests, setRequests] = useState<CR[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CR | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Approval form
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [newReq, setNewReq] = useState({
    title: "",
    description: "",
    type: "normal",
    priority: "medium",
    impact: "medium",
    business_justification: "",
    rollback_plan: "",
  });

  // Fetch change requests
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const url = view === "my"
      ? "/change-requests/my-requests"
      : view === "approvals"
        ? "/change-requests/pending-approvals"
        : "/change-requests";

    api.get<any>(url)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res?.items ?? [];
        setRequests(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load change requests");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [view]);

  const handleCreate = async () => {
    if (!newReq.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const created = await api.post<CR>("/change-requests", {
        ...newReq,
        project_id: activeProject?.id ?? null,
      });
      setRequests((prev) => [created, ...prev]);
      toast.success("Change request submitted");
      setCreateOpen(false);
      setNewReq({ title: "", description: "", type: "normal", priority: "medium", impact: "medium", business_justification: "", rollback_plan: "" });
    } catch (e: any) {
      toast.error(e?.message || "Could not submit request");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      const updated = await api.post<CR>(`/change-requests/${id}/approve`, { notes: approveNotes || undefined });
      setRequests((prev) => prev.map((r) => r.id === id ? updated : r));
      if (selectedRequest?.id === id) setSelectedRequest(updated);
      toast.success("Change request approved");
      setApproveNotes("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) { toast.error("Rejection reason is required"); return; }
    setActionLoading(true);
    try {
      const updated = await api.post<CR>(`/change-requests/${id}/reject`, { reason: rejectReason });
      setRequests((prev) => prev.map((r) => r.id === id ? updated : r));
      if (selectedRequest?.id === id) setSelectedRequest(updated);
      toast.success("Change request rejected");
      setRejectReason("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const viewTitle = view === "my" ? t("changes.myRequests") : view === "approvals" ? t("changes.pendingApprovals") : t("changes.title");
  const viewSubtitle = view === "my"
    ? t("changes.myRequestsSubtitle", { count: requests.length })
    : view === "approvals"
      ? t("changes.approvalsSubtitle", { count: requests.length })
      : t("changes.subtitle", { pending: requests.filter((r) => r.status === "pending").length, total: requests.length });

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={i18n.dir()}>
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={viewTitle}
          subtitle={viewSubtitle}
          actions={
            view !== "approvals" ? (
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> {t("changes.newRequest")}
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("app.loading")}</div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<FileQuestion className="h-8 w-8" />}
            title={view === "my" ? t("changes.noMyRequests") : view === "approvals" ? t("changes.noApprovals") : t("changes.noRequests")}
            subtitle={t("changes.subtitle", { pending: 0, total: 0 })}
            action={view !== "approvals" ? <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {t("changes.newRequest")}</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {requests.map((r) => {
              const st = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 cursor-pointer flex-1" onClick={() => setSelectedRequest(r)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">CR-{String(r.id).padStart(3, "0")}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${st.className}`}>
                          {st.label}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${IMPACT_CLASS[r.impact] ?? IMPACT_CLASS.medium}`}>
                          {r.impact}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_CLASS[r.type] ?? TYPE_CLASS.normal}`}>
                          {r.type}
                        </span>
                        {r.priority && (
                          <span className="text-[11px] text-muted-foreground capitalize">{r.priority} priority</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground hover:text-primary transition-colors">{r.title}</p>
                      {r.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {r.requestedBy?.name && <span>{r.requestedBy.name}</span>}
                        <span>·</span>
                        <span>{format(new Date(r.created_at), "MMM d, yyyy")}</span>
                        {r.project && <span>· {r.project.key}</span>}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setSelectedRequest(r)}>
                        <Eye className="h-4 w-4" /> {t("changes.details")}
                      </Button>
                      {view === "approvals" && r.status === "pending" && isApprover && (Number(r.requestedBy?.id ?? r.requested_by) !== Number(user?.id)) && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive"
                            onClick={() => { setSelectedRequest(r); setRejectReason(""); }}>
                            <X className="h-4 w-4" /> {t("changes.reject")}
                          </Button>
                          <Button size="sm" className="gap-1 text-xs" onClick={() => { setSelectedRequest(r); setApproveNotes(""); }}>
                            <Check className="h-4 w-4" /> {t("changes.approve")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent className="max-w-lg" dir={i18n.dir()}>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">CR-{String(selectedRequest.id).padStart(3, "0")}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_MAP[selectedRequest.status]?.className ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_MAP[selectedRequest.status]?.label ?? selectedRequest.status}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${IMPACT_CLASS[selectedRequest.impact] ?? IMPACT_CLASS.medium}`}>
                  {selectedRequest.impact} impact
                </span>
              </div>
              <DialogTitle className="text-lg font-bold">{selectedRequest.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {selectedRequest.description && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("changes.descriptionScope")}</p>
                  <p className="text-foreground whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
              )}

              {selectedRequest.business_justification && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("changes.businessJustification")}</p>
                  <p className="text-foreground whitespace-pre-wrap">{selectedRequest.business_justification}</p>
                </div>
              )}

              {selectedRequest.rollback_plan && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("changes.rollbackPlan")}</p>
                  <p className="text-foreground whitespace-pre-wrap">{selectedRequest.rollback_plan}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-border bg-card p-2.5">
                  <span className="text-muted-foreground block mb-0.5">{t("changes.requestedBy")}</span>
                  <span className="font-semibold text-foreground">{selectedRequest.requestedBy?.name ?? "-"}</span>
                </div>
                <div className="rounded-lg border border-border bg-card p-2.5">
                  <span className="text-muted-foreground block mb-0.5">{t("changes.dateRequested")}</span>
                  <span className="font-semibold text-foreground">{format(new Date(selectedRequest.created_at), "MMMM d, yyyy")}</span>
                </div>
                {selectedRequest.approvedBy && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-2.5">
                      <span className="text-muted-foreground block mb-0.5">{t("changes.approvedBy")}</span>
                      <span className="font-semibold text-foreground">{selectedRequest.approvedBy.name}</span>
                    </div>
                    {selectedRequest.notes && (
                      <div className="rounded-lg border border-border bg-card p-2.5">
                        <span className="text-muted-foreground block mb-0.5">{t("changes.approvalNotes")}</span>
                        <span className="font-semibold text-foreground">{selectedRequest.notes}</span>
                      </div>
                    )}
                  </>
                )}
                {selectedRequest.rejection_reason && (
                  <div className="col-span-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                    <span className="text-muted-foreground block mb-0.5">{t("changes.rejectionReason")}</span>
                    <span className="font-semibold text-foreground">{selectedRequest.rejection_reason}</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className={isRTL ? "flex items-center justify-between gap-2 sm:flex-row-reverse" : "flex items-center justify-between gap-2"}>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>{t("changes.close")}</Button>
              {selectedRequest.status === "pending" && isApprover && (Number(selectedRequest.requestedBy?.id ?? selectedRequest.requested_by) !== Number(user?.id)) && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleReject(selectedRequest.id)} disabled={actionLoading}>
                    <X className="h-4 w-4 mr-1" /> {t("changes.rejectRequest")}
                  </Button>
                  <Button onClick={() => handleApprove(selectedRequest.id)} disabled={actionLoading}>
                    <Check className="h-4 w-4 mr-1" /> {t("changes.approveRequest")}
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir={i18n.dir()}>
          <DialogHeader>
            <DialogTitle>{t("changes.submitTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("changes.titleLabel")} *</label>
              <Input value={newReq.title} autoFocus onChange={(e) => setNewReq({ ...newReq, title: e.target.value })} placeholder="e.g. Add 2FA Authentication" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("changes.descLabel")}</label>
              <Textarea rows={3} value={newReq.description} onChange={(e) => setNewReq({ ...newReq, description: e.target.value })} placeholder="Explain the reason for this change request..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("changes.type")}</label>
                <Select value={newReq.type} onValueChange={(v) => setNewReq({ ...newReq, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">{t("changes.typeStandard")}</SelectItem>
                    <SelectItem value="normal">{t("changes.typeNormal")}</SelectItem>
                    <SelectItem value="emergency">{t("changes.typeEmergency")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("changes.priority")}</label>
                <Select value={newReq.priority} onValueChange={(v) => setNewReq({ ...newReq, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("changes.priorityLow")}</SelectItem>
                    <SelectItem value="medium">{t("changes.priorityMedium")}</SelectItem>
                    <SelectItem value="high">{t("changes.priorityHigh")}</SelectItem>
                    <SelectItem value="critical">{t("changes.priorityCritical")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("changes.impactLabel")}</label>
              <Select value={newReq.impact} onValueChange={(v) => setNewReq({ ...newReq, impact: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("changes.impactLow")}</SelectItem>
                  <SelectItem value="medium">{t("changes.impactMedium")}</SelectItem>
                  <SelectItem value="high">{t("changes.impactHigh")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("changes.businessJustification")}</label>
              <Textarea rows={2} value={newReq.business_justification} onChange={(e) => setNewReq({ ...newReq, business_justification: e.target.value })} placeholder="Why is this change needed?" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("changes.rollbackPlan")}</label>
              <Textarea rows={2} value={newReq.rollback_plan} onChange={(e) => setNewReq({ ...newReq, rollback_plan: e.target.value })} placeholder="What's the back-out plan if this fails?" />
            </div>
          </div>
          <DialogFooter className={isRTL ? "flex items-center justify-between gap-2 sm:flex-row-reverse" : "flex items-center justify-between gap-2"}>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>{t("changes.submitRequest")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChangeRequestsPage;
