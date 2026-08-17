import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Inbox, Plus, Sparkles, FolderKanban, Loader2, Calendar, PencilLine, Trash2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Client, ClientRequest } from "../data/types";
import { useAuth } from "../hooks/useAuth";

const blankForm = () => ({ client_id: "", title: "", description: "", type: "rfp", status: "pending" });

export default function RequestsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage-clients");
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [addingRequest, setAddingRequest] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ClientRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<ClientRequest | null>(null);
  const [saving, setSaving] = useState(false);

  const [requestForm, setRequestForm] = useState(blankForm());
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const clientId = searchParams.get("clientId");
    const requestId = searchParams.get("requestId");
    if (clientId && clients.length) {
      setRequestForm((f) => ({ ...f, client_id: clientId }));
      setAddingRequest(true);
      deepLinkHandled.current = true;
    } else if (requestId && requests.length) {
      const match = requests.find((r) => String(r.id) === String(requestId));
      if (match) {
        setSelectedRequest(match);
        deepLinkHandled.current = true;
      }
    }
  }, [searchParams, clients, requests]);

  const loadData = async () => {
    setLoading(true);
    try {
      const requestsRes = await api.get<ClientRequest[] | { data?: ClientRequest[] }>("/requests");
      const requestsData = Array.isArray(requestsRes) ? requestsRes : requestsRes?.data ?? [];
      setRequests(requestsData);
      const clientsData = await api.get<Client[]>("/clients");
      setClients(clientsData || []);
      if (selectedRequest) {
        const updated = requestsData.find((r) => String(r.id) === String(selectedRequest.id));
        if (updated) setSelectedRequest(updated);
        else setSelectedRequest(null);
      }
    } catch {
      toast.error(t("requests.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.client_id || !requestForm.title) return;
    setSaving(true);
    try {
      const newRequest = await api.post<ClientRequest>("/requests", {
        client_id: Number(requestForm.client_id),
        title: requestForm.title,
        description: requestForm.description || null,
        type: requestForm.type,
      });
      if (newRequest) {
        toast.success(t("requests.registeredSuccess"));
        setAddingRequest(false);
        setRequestForm(blankForm());
        loadData();
      }
    } catch (e: any) {
      toast.error(e?.message || t("requests.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (request: ClientRequest) => {
    setEditingRequest(request);
    setRequestForm({
      client_id: String(request.client_id ?? ""),
      title: request.title || "",
      description: request.description || "",
      type: request.type || "rfp",
      status: request.status || "pending",
    });
  };

  const handleUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest || !requestForm.title) return;
    setSaving(true);
    try {
      const updated = await api.put<ClientRequest>(`/requests/${editingRequest.id}`, {
        title: requestForm.title,
        description: requestForm.description || null,
        type: requestForm.type,
        status: requestForm.status,
      });
      toast.success(t("requests.updatedSuccess", { defaultValue: "Request updated" }));
      setEditingRequest(null);
      setRequestForm(blankForm());
      if (updated) setSelectedRequest(updated);
      loadData();
    } catch (e: any) {
      toast.error(e?.message || t("requests.updateFailed", { defaultValue: "Failed to update request" }));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deletingRequest) return;
    try {
      await api.del(`/requests/${deletingRequest.id}`);
      toast.success(t("requests.deletedSuccess", { defaultValue: "Request deleted" }));
      if (selectedRequest && String(selectedRequest.id) === String(deletingRequest.id)) {
        setSelectedRequest(null);
      }
      setDeletingRequest(null);
      loadData();
    } catch (e: any) {
      toast.error(e?.message || t("requests.deleteFailed", { defaultValue: "Failed to delete request" }));
    }
  };

  const handleAiEstimate = async () => {
    if (!selectedRequest) return;
    setEstimating(true);
    setAiExplanation(null);
    try {
      const res = await api.post<{ request: ClientRequest; explanation: string }>(`/requests/${selectedRequest.id}/estimate`);
      if (res) {
        toast.success(t("requests.aiEstimateComplete"));
        setAiExplanation(res.explanation);
        setSelectedRequest(res.request);
        loadData();
      }
    } catch {
      toast.error(t("requests.aiEstimateFailed"));
    } finally {
      setEstimating(false);
    }
  };

  const hasEstimate = !!(selectedRequest?.estimated_hours || selectedRequest?.estimated_cost);

  const handleConvertToProject = async () => {
    if (!selectedRequest) return;
    setConverting(true);
    try {
      const res = await api.post<{ message: string; project: any }>(`/requests/${selectedRequest.id}/convert`);
      if (res) {
        toast.success(t("requests.convertedSuccess", { key: res.project.key }));
        loadData();
      }
    } catch (e: any) {
      toast.error(e?.message || t("requests.convertFailed"));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("requests.title")}
          subtitle={t("requests.subtitle")}
          action={
            canManage ? (
              <Button onClick={() => { setRequestForm(blankForm()); setAddingRequest(true); }} className="flex items-center gap-1">
                <Plus className="h-4 w-4" /> {t("requests.newRequest")}
              </Button>
            ) : null
          }
        />

        {loading && requests.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-3">
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t("requests.registry")}</h3>
                <div className="space-y-2">
                  {requests.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRequest(r);
                        setAiExplanation(null);
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex flex-col gap-1.5 ${
                        selectedRequest?.id === r.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 w-full">
                        <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {r.type}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          r.status === "accepted" ? "bg-success/15 text-success" :
                          r.status === "rejected" ? "bg-destructive/15 text-destructive" :
                          r.status === "review" ? "bg-warning/15 text-warning" : "bg-info/15 text-info"
                        }`}>
                          {(r.status || "pending").toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate w-full">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate w-full">
                        {t("requests.clientLabel")}: {r.client?.name || t("requests.unknownClient")}
                      </p>
                    </button>
                  ))}
                  {requests.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("requests.noRequests")}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {selectedRequest ? (
                <div className="rounded-xl border bg-card p-6 space-y-6">
                  <div className="border-b border-border pb-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold text-foreground">{selectedRequest.title}</h2>
                        <p className="text-sm text-muted-foreground">
                          {t("requests.clientLabel")}: <span className="font-semibold text-foreground">{selectedRequest.client?.name || t("requests.unknownClient")}</span>
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(selectedRequest)}>
                            <PencilLine className="h-3.5 w-3.5" /> {t("requests.edit", { defaultValue: "Edit" })}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingRequest(selectedRequest)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {t("requests.delete", { defaultValue: "Delete" })}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{t("requests.requestDetails")}</h3>
                    <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border leading-relaxed whitespace-pre-wrap">
                      {selectedRequest.description || t("requests.noDescription")}
                    </p>
                  </div>

                  <div className="border border-primary/20 rounded-xl bg-primary/5 p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">{t("requests.aiEstimations")}</h4>
                      </div>
                      <Button onClick={handleAiEstimate} disabled={estimating || selectedRequest.status === "accepted"} size="sm" className="h-8 gap-1">
                        {estimating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {t("requests.estimateScope")}
                      </Button>
                    </div>

                    <div className="grid gap-3 grid-cols-3">
                      <div className="bg-card p-3 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">{t("requests.effort")}</p>
                        <p className="text-lg font-bold text-foreground mt-1">
                          {selectedRequest.estimated_hours ? t("requests.hoursShort", { hours: Math.round(selectedRequest.estimated_hours) }) : "—"}
                        </p>
                      </div>
                      <div className="bg-card p-3 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">{t("requests.estimatedCost")}</p>
                        <p className="text-lg font-bold text-foreground mt-1">
                          {selectedRequest.estimated_cost ? `$${Number(selectedRequest.estimated_cost).toLocaleString()}` : "—"}
                        </p>
                      </div>
                      <div className="bg-card p-3 border rounded-lg text-center flex flex-col items-center justify-center">
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5"><Calendar className="h-3 w-3" /> {t("requests.targetDate")}</p>
                        <p className="text-sm font-bold text-foreground mt-1">
                          {selectedRequest.due_date ? new Date(selectedRequest.due_date).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>

                    {aiExplanation && (
                      <div className="bg-card border p-3 rounded-lg text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground block mb-0.5">{t("requests.aiInsights")}</span>
                        {aiExplanation}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 border-t border-border pt-4">
                    <Button
                      onClick={handleConvertToProject}
                      disabled={converting || selectedRequest.status === "accepted" || !hasEstimate}
                      className="flex items-center gap-1.5"
                    >
                      {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />}
                      {t("requests.approveConvert")}
                    </Button>
                    {!hasEstimate && selectedRequest.status !== "accepted" && (
                      <p className="text-xs text-muted-foreground">{t("requests.runEstimateFirst")}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium">{t("requests.selectHint")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={addingRequest} onOpenChange={setAddingRequest}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("requests.newClientRequest")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRequest} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("requests.selectClientAccount")}</label>
                <select
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={requestForm.client_id}
                  onChange={(e) => setRequestForm({ ...requestForm, client_id: e.target.value })}
                >
                  <option value="">{t("requests.pickClient")}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("requests.requestTitle")}</label>
                <Input
                  required
                  placeholder={t("requests.requestTitlePlaceholder")}
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("requests.requestDescription")}</label>
                <Textarea
                  rows={4}
                  placeholder={t("requests.requestDescriptionPlaceholder")}
                  value={requestForm.description}
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("requests.engagementType")}</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={requestForm.type}
                  onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}
                >
                  <option value="rfp">{t("requests.typeRfp")}</option>
                  <option value="poc">{t("requests.typePoc")}</option>
                  <option value="demo">{t("requests.typeDemo")}</option>
                  <option value="presentation">{t("requests.typePresentation")}</option>
                </select>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setAddingRequest(false)}>
                  {t("requests.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("requests.register")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingRequest} onOpenChange={(open) => { if (!open) { setEditingRequest(null); setRequestForm(blankForm()); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("requests.editRequest", { defaultValue: "Edit Request" })}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateRequest} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("requests.requestTitle")}</label>
                <Input
                  required
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("requests.requestDescription")}</label>
                <Textarea
                  rows={4}
                  value={requestForm.description}
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{t("requests.engagementType")}</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={requestForm.type}
                    onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}
                  >
                    <option value="rfp">{t("requests.typeRfp")}</option>
                    <option value="poc">{t("requests.typePoc")}</option>
                    <option value="demo">{t("requests.typeDemo")}</option>
                    <option value="presentation">{t("requests.typePresentation")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{t("requests.status", { defaultValue: "Status" })}</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={requestForm.status}
                    onChange={(e) => setRequestForm({ ...requestForm, status: e.target.value })}
                  >
                    <option value="pending">pending</option>
                    <option value="review">review</option>
                    <option value="accepted">accepted</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => { setEditingRequest(null); setRequestForm(blankForm()); }}>
                  {t("requests.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("requests.save", { defaultValue: "Save" })}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deletingRequest}
          onOpenChange={(open) => !open && setDeletingRequest(null)}
          title={t("requests.deleteTitle", { defaultValue: "Delete Request" })}
          description={t("requests.deleteDescription", {
            defaultValue: `Are you sure you want to permanently delete "${deletingRequest?.title}"? This cannot be undone.`,
            title: deletingRequest?.title,
          })}
          onConfirm={handleDeleteRequest}
          confirmLabel={t("requests.delete", { defaultValue: "Delete" })}
        />
      </div>
    </div>
  );
}
