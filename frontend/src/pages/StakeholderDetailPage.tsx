import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Mail, Phone, Building2, Loader2, Send, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Textarea } from "../components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";
import { Panel } from "../components/reports/ReportComponents";
import { api } from "../lib/api";
import { buildStakeholderDetailFallback } from "../data/stakeholderFallbacks";

interface DetailImpact {
  budgetImpact: number;
  scheduleImpact: number;
  scopeImpact: number;
  riskImpact: number;
  communicationScore: number;
}

interface DetailProject {
  id: string;
  name: string;
  key: string;
  status: string;
}

interface DetailInteraction {
  id: string;
  type: string;
  description: string;
  occurredAt: string;
  userName: string | null;
}

interface DetailMessage {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  senderName: string | null;
}

interface StakeholderDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  role: string | null;
  department: string | null;
  photoUrl: string;
  influenceLevel: "High" | "Medium" | "Low";
  interestLevel: "High" | "Medium" | "Low";
  communicationPreference: string;
  status: string;
  notes: string | null;
  type: string;
  category: string;
  supportLevel: "Supporter" | "Neutral" | "Opponent";
  engagementScore: number;
  engagementLevel: string;
  impact: DetailImpact | null;
  projects: DetailProject[];
  interactions: DetailInteraction[];
  messages: DetailMessage[];
}

const INTERACTION_TYPES = ["Meeting", "Call", "Email", "Note"];

function strategyFor(influence: string, interest: string) {
  if (influence === "High" && interest === "High") return "Manage closely";
  if (influence === "High") return "Keep satisfied";
  if (interest === "High") return "Keep informed";
  return "Monitor";
}

function StakeholderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<StakeholderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionType, setInteractionType] = useState("Meeting");
  const [interactionDate, setInteractionDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [interactionDesc, setInteractionDesc] = useState("");
  const [savingInteraction, setSavingInteraction] = useState(false);

  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .get<StakeholderDetail>(`/stakeholders/${id}`)
      .then((res) => setData(res))
      .catch((e: any) => {
        const fallback = buildStakeholderDetailFallback(id);
        if (fallback) {
          setData(fallback);
          return;
        }
        setError(e?.message || t("stakeholders.detail.notFound"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitInteraction = async () => {
    if (!id || !interactionDesc.trim()) return;
    setSavingInteraction(true);
    try {
      await api.post(`/stakeholders/${id}/interaction`, {
        type: interactionType,
        description: interactionDesc.trim(),
        occurredAt: interactionDate,
      });
      toast.success(t("stakeholders.detail.interactionLogged"));
      setInteractionOpen(false);
      setInteractionDesc("");
      load();
    } catch (e: any) {
      toast.error(e?.message || t("stakeholders.detail.interactionError"));
    } finally {
      setSavingInteraction(false);
    }
  };

  const submitMessage = async () => {
    if (!id || !messageSubject.trim() || !messageBody.trim()) return;
    setSendingMessage(true);
    try {
      await api.post(`/stakeholders/${id}/message`, {
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      toast.success(t("stakeholders.detail.messageSent"));
      setMessageSubject("");
      setMessageBody("");
      load();
    } catch (e: any) {
      toast.error(e?.message || t("stakeholders.detail.messageError"));
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate("/stakeholders")}>
          <ArrowLeft className="h-4 w-4" /> {t("stakeholders.detail.back")}
        </Button>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error || t("stakeholders.detail.notFound")}
        </div>
      </div>
    );
  }

  const impactFields = data.impact
    ? [
        { label: "Budget", value: data.impact.budgetImpact, color: "bg-emerald-500" },
        { label: "Schedule", value: data.impact.scheduleImpact, color: "bg-amber-500" },
        { label: "Scope", value: data.impact.scopeImpact, color: "bg-blue-500" },
        { label: "Risk", value: data.impact.riskImpact, color: "bg-rose-500" },
        { label: "Comms", value: data.impact.communicationScore, color: "bg-purple-500" },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-xl">
        <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => navigate("/stakeholders")}>
          <ArrowLeft className="h-4 w-4" /> {t("stakeholders.detail.back")}
        </Button>

        <div className="mb-5 flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
          <img src={data.photoUrl} alt={data.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
              {data.role && <Badge variant="secondary">{data.role}</Badge>}
              <Badge variant={data.status === "Active" ? "default" : "secondary"}>{data.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[data.organization, data.department].filter(Boolean).join(" • ") || "—"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{t("stakeholders.colInfluence")}: {data.influenceLevel}</Badge>
              <Badge variant="outline">{t("stakeholders.colInterest")}: {data.interestLevel}</Badge>
              <Badge variant="outline">{data.supportLevel}</Badge>
              <Badge variant="outline">{data.type}</Badge>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("stakeholders.detail.engagementScore")}</p>
            <p className="text-2xl font-bold text-foreground">{data.engagementLevel}</p>
            <p className="text-[10px] text-muted-foreground">{data.engagementScore} · {t("stakeholders.detail.interactions30d")}</p>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t("stakeholders.detail.tabOverview")}</TabsTrigger>
            <TabsTrigger value="timeline">{t("stakeholders.detail.tabTimeline")} ({data.interactions.length})</TabsTrigger>
            <TabsTrigger value="messages">{t("stakeholders.detail.tabMessages")} ({data.messages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-4 md:col-span-2">
                <Panel title={t("stakeholders.detail.contactDetails")}>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-foreground"><Mail className="h-4 w-4 text-muted-foreground" /> {data.email}</div>
                    <div className="flex items-center gap-2 text-foreground"><Phone className="h-4 w-4 text-muted-foreground" /> {data.phone || "—"}</div>
                    <div className="flex items-center gap-2 text-foreground"><Building2 className="h-4 w-4 text-muted-foreground" /> {data.organization || "—"}</div>
                  </div>
                </Panel>
                <Panel title={t("stakeholders.detail.notesField")}>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{data.notes || t("stakeholders.detail.noNotes")}</p>
                </Panel>
                <Panel title={t("stakeholders.detail.projects")}>
                  {data.projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("stakeholders.detail.noProjects")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.projects.map((p) => (
                        <Badge key={p.id} variant="outline">{p.name}</Badge>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
              <div className="space-y-4">
                <Panel title="Matrix positioning">
                  <p className="text-center text-sm font-semibold text-foreground">
                    {strategyFor(data.influenceLevel, data.interestLevel)}
                  </p>
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    {t("stakeholders.colInfluence")}: {data.influenceLevel} · {t("stakeholders.colInterest")}: {data.interestLevel}
                  </p>
                </Panel>
                {impactFields.length > 0 && (
                  <Panel title="Impact scorecard">
                    <div className="space-y-3">
                      {impactFields.map((f) => (
                        <div key={f.label}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-muted-foreground">{f.label}</span>
                            <span className="font-semibold text-foreground">{f.value}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full ${f.color}`} style={{ width: `${f.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{t("stakeholders.detail.tabTimeline")}</h2>
                <Button size="sm" className="gap-1.5" onClick={() => setInteractionOpen(true)}>
                  <Plus className="h-4 w-4" /> {t("stakeholders.detail.logInteraction")}
                </Button>
              </div>
              {data.interactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("stakeholders.detail.noInteractions")}</p>
              ) : (
                <div className="space-y-3">
                  {data.interactions.map((i) => (
                    <div key={i.id} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{i.type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(i.occurredAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{i.description}</p>
                      {i.userName && <p className="mt-1.5 text-xs text-muted-foreground">{t("stakeholders.detail.loggedBy", { name: i.userName })}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Panel title={t("stakeholders.detail.tabMessages")}>
                  {data.messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t("stakeholders.detail.noMessages")}</p>
                  ) : (
                    <div className="space-y-3">
                      {data.messages.map((m) => (
                        <div key={m.id} className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{m.subject}</p>
                            <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-1.5 text-sm text-muted-foreground">{m.message}</p>
                          {m.senderName && <p className="mt-1.5 text-xs text-muted-foreground">{t("stakeholders.detail.sentBy", { name: m.senderName })}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
              <Panel title={t("stakeholders.detail.sendMessage")}>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-subject">{t("stakeholders.detail.messageSubject")}</Label>
                    <Input id="msg-subject" value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-body">{t("stakeholders.detail.messageBody")}</Label>
                    <Textarea id="msg-body" rows={4} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} />
                  </div>
                  <Button className="w-full gap-1.5" disabled={sendingMessage} onClick={submitMessage}>
                    <Send className="h-4 w-4" /> {t("stakeholders.detail.sendMessage")}
                  </Button>
                </div>
              </Panel>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("stakeholders.detail.logInteraction")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("stakeholders.detail.interactionType")}</Label>
              <Select value={interactionType} onValueChange={setInteractionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((tpe) => <SelectItem key={tpe} value={tpe}>{tpe}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="int-date">{t("stakeholders.detail.interactionDate")}</Label>
              <Input id="int-date" type="datetime-local" value={interactionDate} onChange={(e) => setInteractionDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="int-desc">{t("stakeholders.detail.interactionDescription")}</Label>
              <Textarea id="int-desc" rows={4} value={interactionDesc} onChange={(e) => setInteractionDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInteractionOpen(false)}>{t("app.cancel")}</Button>
            <Button onClick={submitInteraction} disabled={savingInteraction || !interactionDesc.trim()}>
              {t("stakeholders.detail.logInteraction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StakeholderDetailPage;
