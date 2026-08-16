import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Presentation, Upload, Download, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

interface PresentationItem {
  id: string | number;
  projectId?: string | number | null;
  name: string;
  category: string;
  path: string;
  size: number;
  mimeType?: string | null;
  createdAt?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  "company-overview": "Company Overview",
  "case-study": "Case Study",
  "sales-deck": "Sales Deck",
  "kickoff-deck": "Kickoff Deck",
  "capability-deck": "Capability Deck",
  qbr: "QBR",
};

const fmtSize = (bytes: number) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

function xsrfToken() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function PresentationBankPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("case-study");
  const [deleteTarget, setDeleteTarget] = useState<PresentationItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set("category", activeCategory);
      if (search) params.set("q", search);
      const res = await api.get<PresentationItem[]>(`/presentations?${params.toString()}`);
      setItems(Array.isArray(res) ? res : []);
    } catch {
      toast.error(t("presentations.loadFailed", { defaultValue: "Failed to load the presentation bank." }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search]);

  const openPicker = () => inputRef.current?.click();

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/presentations?category=${encodeURIComponent(uploadCategory)}`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(xsrfToken() ? { "X-XSRF-TOKEN": xsrfToken()! } : {}),
        },
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.detail || `Upload failed (${res.status})`);
      setItems((current) => [data, ...current]);
      toast.success(t("presentations.uploaded", { defaultValue: "{{name}} added to the bank.", name: file.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("presentations.uploadFailed", { defaultValue: "Upload failed." }));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/presentations/${deleteTarget.id}`);
      setItems((current) => current.filter((i) => i.id !== deleteTarget.id));
      toast.success(t("presentations.deleted", { defaultValue: "Presentation removed." }));
    } catch {
      toast.error(t("presentations.deleteFailed", { defaultValue: "Failed to remove presentation." }));
    } finally {
      setDeleteTarget(null);
    }
  };

  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          icon={<Presentation className="h-4 w-4" />}
          title={t("presentations.title", { defaultValue: "Presentation Bank" })}
          subtitle={t("presentations.subtitle", { defaultValue: "Reusable decks — pull one into a proposal instead of rebuilding from scratch." })}
          actions={
            <>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <Button size="sm" className="gap-1.5" onClick={openPicker} disabled={uploading}>
                <Upload className="h-4 w-4" /> {uploading ? t("presentations.uploading", { defaultValue: "Uploading…" }) : t("presentations.upload", { defaultValue: "Upload deck" })}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.ppt,.pptx,.key"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              />
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("presentations.search", { defaultValue: "Search decks…" })}
              className="w-56 rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => setActiveCategory("")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${!activeCategory ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent/60"}`}
          >
            {t("presentations.all", { defaultValue: "All" })}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activeCategory === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent/60"}`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {!loading && items.length === 0 && (
          <EmptyState
            icon={<Presentation className="h-8 w-8" />}
            title={t("presentations.emptyTitle", { defaultValue: "No decks yet" })}
            subtitle={t("presentations.emptySubtitle", { defaultValue: "Upload your first reusable presentation — it'll be here for anyone building a proposal." })}
            action={<Button size="sm" className="gap-1.5" onClick={openPicker}><Upload className="h-4 w-4" /> {t("presentations.upload", { defaultValue: "Upload deck" })}</Button>}
          />
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="card-hover group flex flex-col rounded-xl border border-border bg-card p-4">
                <div className="flex h-24 items-center justify-center rounded-lg border border-foreground/15 bg-muted text-foreground">
                  <Presentation className="h-8 w-8 opacity-70" />
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-foreground" title={item.name}>{item.name}</p>
                <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </span>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{fmtSize(item.size)}</span>
                  <span>{item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy") : "—"}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <a
                    href={`/storage/${item.path}`}
                    download
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                  >
                    <Download className="h-3.5 w-3.5" /> {t("presentations.download", { defaultValue: "Download" })}
                  </a>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label={t("presentations.delete", { defaultValue: "Delete" })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
          title={t("presentations.deleteTitle", { defaultValue: "Remove this deck?" })}
          description={t("presentations.deleteDescription", { defaultValue: "{{name}} will be removed from the bank for everyone.", name: deleteTarget?.name })}
          onConfirm={handleDelete}
          confirmLabel={t("presentations.delete", { defaultValue: "Delete" })}
        />
      </div>
    </div>
  );
}

export default PresentationBankPage;
