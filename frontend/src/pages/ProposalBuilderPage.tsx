import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Sparkles, Plus, AlertCircle, ShieldAlert, CheckSquare, Loader2, ArrowRight } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Proposal, ClientRequest, ProposalVersion } from "../data/types";

interface RfpAnalysisResponse {
  key_requirements: string[];
  estimated_complexity: string;
  suggested_team_size: number;
  risk_factors: string[];
  recommendation: string;
}

interface ProposalDraftResponse {
  content: string;
  estimated_hours: number | null;
  source: "llm" | "template";
}

export default function ProposalBuilderPage() {
  const { t } = useTranslation();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);

  // RFP Analyzer State
  const [rfpText, setRfpText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<RfpAnalysisResponse | null>(null);

  // Form States
  const [proposalForm, setProposalForm] = useState({ client_request_id: "", title: "", content: "", estimated_hours: "" });
  const [versionForm, setVersionForm] = useState({ content: "", estimated_hours: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const pData = await api.get<Proposal[] | { data: Proposal[] }>("/proposals");
      const proposalsList = Array.isArray(pData) ? pData : (pData?.data || []);
      setProposals(proposalsList);

      const rData = await api.get<ClientRequest[] | { data: ClientRequest[] }>("/requests");
      const requestsList = Array.isArray(rData) ? rData : (rData?.data || []);
      // Only link requests that have no active proposal, or list all
      setRequests(requestsList);

      if (selectedProposal) {
        const updated = proposalsList.find((p) => p.id === selectedProposal.id);
        if (updated) setSelectedProposal(updated);
      }
    } catch {
      toast.error(t("proposal.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDraftProposal = async () => {
    if (!proposalForm.client_request_id) {
      toast.error(t("proposalBuilder.aiDraft.selectRequestFirst"));
      return;
    }
    setDrafting(true);
    try {
      const draft = await api.post<ProposalDraftResponse>(`/requests/${proposalForm.client_request_id}/draft-proposal`);
      if (draft) {
        // Populate the form only - the user still reviews/edits before publishing.
        setProposalForm({
          ...proposalForm,
          content: draft.content,
          estimated_hours: draft.estimated_hours != null ? String(draft.estimated_hours) : proposalForm.estimated_hours,
        });
        toast.success(
          draft.source === "llm" ? t("proposalBuilder.aiDraft.readyLlm") : t("proposalBuilder.aiDraft.readyTemplate")
        );
      }
    } catch {
      toast.error(t("proposalBuilder.aiDraft.failed"));
    } finally {
      setDrafting(false);
    }
  };

  const handleAnalyzeRfp = async () => {
    if (!rfpText.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await api.post<{ result: RfpAnalysisResponse }>("/ai/proposals/analyze-rfp", { rfp_content: rfpText });
      if (res?.result) {
        setAnalysisResult(res.result);
        toast.success(t("proposal.rfpComplete"));
      }
    } catch {
      toast.error(t("proposal.rfpFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalForm.client_request_id || !proposalForm.title || !proposalForm.content) return;
    try {
      const data = {
        ...proposalForm,
        estimated_hours: proposalForm.estimated_hours ? Number(proposalForm.estimated_hours) : null,
      };
      const res = await api.post<Proposal>("/proposals", data);
      if (res) {
        toast.success(t("proposal.created"));
        setCreatingProposal(false);
        setProposalForm({ client_request_id: "", title: "", content: "", estimated_hours: "" });
        loadData();
      }
    } catch {
      toast.error(t("proposal.createFailed"));
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposal || !versionForm.content) return;
    try {
      const data = {
        ...versionForm,
        estimated_hours: versionForm.estimated_hours ? Number(versionForm.estimated_hours) : null,
      };
      const res = await api.post<ProposalVersion>(`/proposals/${selectedProposal.id}/versions`, data);
      if (res) {
        toast.success(t("proposal.versionSaved"));
        setCreatingVersion(false);
        setVersionForm({ content: "", estimated_hours: "" });
        loadData();
      }
    } catch {
      toast.error(t("proposal.versionFailed"));
    }
  };

  const handleApplyAnalysis = () => {
    if (!analysisResult) return;
    setProposalForm({
      ...proposalForm,
      content: `Key Requirements:\n${analysisResult.key_requirements.map((r) => `- ${r}`).join("\n")}\n\nRisk Factors:\n${analysisResult.risk_factors.map((r) => `- ${r}`).join("\n")}\n\nRecommendation: ${analysisResult.recommendation}`,
    });
    setCreatingProposal(true);
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("proposal.pageTitle")}
          subtitle={t("proposal.pageSubtitle")}
          action={
            <Button onClick={() => setCreatingProposal(true)} className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> {t("proposal.create")}
            </Button>
          }
        />

        {loading && proposals.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-4 lg:grid-cols-3">
            {/* RFP Text Analyzer Panel */}
            <div className="xl:col-span-1 lg:col-span-1 space-y-4">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-border pb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{t("proposal.rfpAnalyzer")}</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("proposal.pasteRfp")}</label>
                  <Textarea
                    rows={6}
                    placeholder={t("proposal.rfpPlaceholder")}
                    value={rfpText}
                    onChange={(e) => setRfpText(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <Button onClick={handleAnalyzeRfp} disabled={analyzing || !rfpText.trim()} className="w-full text-xs h-8">
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {t("proposal.analyzeReq")}
                </Button>
              </div>

              {analysisResult && (
                <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-4">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("proposal.analysisResults")}
                  </h4>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs border-b pb-1">
                      <span className="text-muted-foreground">{t("proposal.complexity")}</span>
                      <span className="font-bold text-foreground capitalize">{analysisResult.estimated_complexity}</span>
                    </div>
                    <div className="flex justify-between text-xs border-b pb-1">
                      <span className="text-muted-foreground">{t("proposal.suggestedTeamSize")}</span>
                      <span className="font-bold text-foreground">{analysisResult.suggested_team_size}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">{t("proposal.keyRequirements")}</span>
                    <ul className="text-xs space-y-1">
                      {analysisResult.key_requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-1 text-muted-foreground">
                          <CheckSquare className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">{t("proposal.riskFactors")}</span>
                    <ul className="text-xs space-y-1">
                      {analysisResult.risk_factors.map((r, i) => (
                        <li key={i} className="flex items-start gap-1 text-muted-foreground">
                          <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-muted-foreground italic">{analysisResult.recommendation}</p>

                  <Button onClick={handleApplyAnalysis} variant="outline" className="w-full text-xs h-8">
                    {t("proposal.applyToProposal")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>

            {/* Proposal List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t("proposal.activeProposals")}</h3>
                <div className="space-y-2">
                  {proposals.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProposal(p)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex flex-col gap-1 ${
                        selectedProposal?.id === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between w-full">
                        <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          p.status === "accepted" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {p.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Client: {p.request?.client?.name || "Acme Account"}
                      </p>
                    </button>
                  ))}
                  {proposals.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("proposal.noProposals")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Proposal Detail & Version History */}
            <div className="xl:col-span-2 lg:col-span-1 space-y-4">
              {selectedProposal ? (
                <div className="rounded-xl border bg-card p-6 space-y-6">
                  <div className="flex justify-between items-start border-b border-border pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedProposal.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t("proposal.requestId")}: <span className="font-semibold">{selectedProposal.client_request_id}</span>
                      </p>
                    </div>
                    <Button onClick={() => setCreatingVersion(true)} size="sm" variant="outline">
                      <Plus className="h-3.5 w-3.5 mr-1" /> {t("proposal.newVersion")}
                    </Button>
                  </div>

                  {/* Versions List */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">{t("proposal.revisions")}</h3>
                    <div className="space-y-3">
                      {selectedProposal.versions?.map((v) => (
                        <div key={v.id} className="p-4 border rounded-xl bg-muted/20 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                              v{v.version_number}
                            </span>
                            <span className="text-muted-foreground">
                              By {v.creator?.name || "System"} on {new Date(v.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {v.content}
                          </p>
                          <div className="flex gap-4 border-t border-border pt-2.5 text-xs">
                            <div>
                              <span className="text-muted-foreground mr-1">{t("proposal.estimatedHours")}:</span>
                              <span className="font-semibold text-foreground">{v.estimated_hours || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium">{t("proposal.selectToView")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Proposal Dialog */}
        <Dialog open={creatingProposal} onOpenChange={setCreatingProposal}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("proposal.createTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateProposal} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{t("proposal.selectRequest")}</label>
                  <select
                    required
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={proposalForm.client_request_id}
                    onChange={(e) => setProposalForm({ ...proposalForm, client_request_id: e.target.value })}
                  >
                    <option value="">-- {t("proposal.selectRequestOption")} --</option>
                    {requests.map((r) => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">{t("proposal.proposalTitle")}</label>
                  <Input
                    required
                    placeholder="e.g. Acme Billing Engine Proposal"
                    value={proposalForm.title}
                    onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1 sm:max-w-xs">
                <label className="text-xs font-semibold text-foreground">{t("proposal.estimatedHours")}</label>
                <Input
                  type="number"
                  placeholder="e.g. 120"
                  value={proposalForm.estimated_hours}
                  onChange={(e) => setProposalForm({ ...proposalForm, estimated_hours: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">{t("proposal.scopeContent")}</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={drafting || !proposalForm.client_request_id}
                    onClick={handleDraftProposal}
                  >
                    {drafting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    {t("proposalBuilder.aiDraft.button")}
                  </Button>
                </div>
                <Textarea
                  required
                  rows={8}
                  placeholder={t("proposal.scopePlaceholder")}
                  value={proposalForm.content}
                  onChange={(e) => setProposalForm({ ...proposalForm, content: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {t("proposalBuilder.aiDraft.reviewNotice")}
                </p>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setCreatingProposal(false)}>
                  {t("app.cancel")}
                </Button>
                <Button type="submit">{t("proposal.publish")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Version Dialog */}
        <Dialog open={creatingVersion} onOpenChange={setCreatingVersion}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("proposal.newVersionTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateVersion} className="space-y-4 py-2">
              <div className="space-y-1 sm:max-w-xs">
                <label className="text-xs font-semibold text-foreground">{t("proposal.revisedHours")}</label>
                <Input
                  type="number"
                  placeholder="e.g. 130"
                  value={versionForm.estimated_hours}
                  onChange={(e) => setVersionForm({ ...versionForm, estimated_hours: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{t("proposal.revisedContent")}</label>
                <Textarea
                  required
                  rows={8}
                  placeholder={t("proposal.versionPlaceholder")}
                  value={versionForm.content}
                  onChange={(e) => setVersionForm({ ...versionForm, content: e.target.value })}
                />
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setCreatingVersion(false)}>
                  {t("app.cancel")}
                </Button>
                <Button type="submit">{t("proposal.saveRevision")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
