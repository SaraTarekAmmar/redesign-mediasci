import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Plus, X, GitPullRequest } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/Dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../ui/SelectEnhanced";

interface PrLink {
  id: number;
  pr_number: string;
  pr_title: string;
  pr_url: string;
  pr_status: string;
}

interface GithubPrLinksProps {
  issueId: string;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config: Record<string, { color: string; label: string }> = {
    open: { color: "bg-green-500", label: t("github.status.open") },
    closed: { color: "bg-red-500", label: t("github.status.closed") },
    merged: { color: "bg-purple-500", label: t("github.status.merged") },
  };
  const c = config[status] ?? config.open;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${c.color}`} />
      {c.label}
    </span>
  );
}

export function GithubPrLinks({ issueId }: GithubPrLinksProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<PrLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ pr_number: "", pr_title: "", pr_url: "", pr_status: "open" });
  const [saving, setSaving] = useState(false);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const data = await api.get<PrLink[]>(`/issues/${issueId}/github/status`);
      setLinks(Array.isArray(data) ? data : []);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (issueId) fetchLinks();
  }, [issueId]);

  const handleLink = async () => {
    if (!form.pr_number.trim() || !form.pr_title.trim()) {
      toast.error(t("github.prRequired"));
      return;
    }
    setSaving(true);
    try {
      const result = await api.post<PrLink>(`/issues/${issueId}/github/link`, {
        pr_number: form.pr_number.trim(),
        pr_title: form.pr_title.trim(),
        pr_url: form.pr_url.trim() || `https://github.com`,
        pr_status: form.pr_status,
      });
      if (result) {
        setLinks((prev) => [...prev, result]);
        toast.success(t("github.linkSuccess"));
      }
      setDialogOpen(false);
      setForm({ pr_number: "", pr_title: "", pr_url: "", pr_status: "open" });
    } catch (err: any) {
      toast.error(err?.message || t("github.linkFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (linkId: number) => {
    try {
      await api.del(`/issues/${issueId}/github/unlink/${linkId}`);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast.success(t("github.unlinkSuccess"));
    } catch (err: any) {
      toast.error(err?.message || t("github.unlinkFailed"));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("github.title")}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3 w-3" />
          {t("github.linkPr")}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t("github.loading")}</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("github.noLinks")}</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-md border border-border bg-accent/30 px-2.5 py-1.5 group hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate text-xs font-medium text-foreground">
                  #{link.pr_number}
                </span>
                <StatusBadge status={link.pr_status} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {link.pr_url && link.pr_url !== "https://github.com" && (
                  <a
                    href={link.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  onClick={() => handleUnlink(link.id)}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={t("github.unlinkPr")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link PR Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("github.linkPrDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("github.prNumber")}</Label>
              <Input
                value={form.pr_number}
                onChange={(e) => setForm({ ...form, pr_number: e.target.value })}
                placeholder="e.g. 142"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("github.prTitle")}</Label>
              <Input
                value={form.pr_title}
                onChange={(e) => setForm({ ...form, pr_title: e.target.value })}
                placeholder="e.g. Fix onboarding bug"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("github.prUrl")}</Label>
              <Input
                value={form.pr_url}
                onChange={(e) => setForm({ ...form, pr_url: e.target.value })}
                placeholder="https://github.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("github.prStatus")}</Label>
              <Select value={form.pr_status} onValueChange={(v) => setForm({ ...form, pr_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t("github.status.open")}</SelectItem>
                  <SelectItem value="closed">{t("github.status.closed")}</SelectItem>
                  <SelectItem value="merged">{t("github.status.merged")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("app.cancel")}
            </Button>
            <Button onClick={handleLink} disabled={saving}>
              {t("github.linkPr")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
