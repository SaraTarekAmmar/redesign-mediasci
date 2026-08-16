
import { useTranslation } from "react-i18next";
import React, { useEffect, useRef, useState } from "react";
import { FileText, FileSpreadsheet, FileImage, File, Upload, Download, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { lookups } from "../store/useStore";
import { api } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/Button";
import { UserAvatar } from "../components/common/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { toast } from "sonner";
import { useProjectCatalogStore } from "../store/useProjectCatalog";

interface DocumentItem {
  id: string;
  name: string;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  category: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  uploader?: { id: string; name: string; avatar?: string } | null;
  file_url?: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "application/pdf": FileText,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "image/png": FileImage,
  "image/jpeg": FileImage,
  "image/gif": FileImage,
  "image/webp": FileImage,
};

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDocumentDate = (doc: DocumentItem) => {
  const raw = doc.updated_at || doc.updatedAt || doc.createdAt || "";
  if (!raw) return "—";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "—" : format(parsed, "MMM d, yyyy");
};

const ACCEPTED_TYPES = ".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.txt,.zip";

function xsrfToken() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function DocumentsPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeProject = useProjectCatalogStore((s) => s.activeProject);
  const projectId = String(activeProject?.id ?? "");
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/documents?project_id=${projectId}`);
      const docs = res?.data ?? res?.documents ?? [];
      setItems(Array.isArray(docs) ? docs : []);
    } catch {
      toast.error(t("documents.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchDocuments();
  }, [projectId]);

  const openPicker = () => inputRef.current?.click();

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projectId);

    setUploading(true);
    try {
      const token = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1];
      const res = await fetch(`/api/documents`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error || data?.errors?.file?.[0] || `Upload failed (${res.status})`);
      }

      if (data?.document) {
        setItems((current) => [data.document, ...current]);
        toast.success(t("documents.uploadedToast", { name: file.name }));
      } else {
        throw new Error(t("documents.uploadNoDocReturned"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("documents.uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = (doc: DocumentItem) => {
    window.open(`/api/documents/${doc.id}/download`, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/documents/${deleteTarget.id}`);
      setItems((current) => current.filter((d) => d.id !== deleteTarget.id));
      toast.success(t("documents.deletedToast", { name: deleteTarget.original_name }));
      setDeleteTarget(null);
    } catch {
      toast.error(t("documents.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        <PageHeader
          title={t("documents.title")}
          subtitle={loading ? t("recovery.loading") : t("documents.filesCount", { count: items.length })}
          actions={
            <Button size="sm" className="gap-1.5" onClick={openPicker} disabled={uploading}>
              <Upload className="h-4 w-4" /> {uploading ? t("documents.uploading") : t("documents.upload")}
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-32 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
            <File className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("documents.noDocuments")}</p>
            <Button size="sm" className="mt-3 gap-1.5" onClick={openPicker}>
              <Upload className="h-4 w-4" /> {t("documents.uploadFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((d) => {
              const Icon = ICONS[d.mime_type] ?? File;
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{d.original_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtSize(d.file_size)} · {d.category} · {t("documents.updated")} {formatDocumentDate(d)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.uploader && (
                      <div className="hidden items-center gap-1.5 sm:flex" title={d.uploader.name}>
                        <UserAvatar userId={d.uploader.id} size="sm" />
                        <span className="text-xs text-muted-foreground">{d.uploader.name}</span>
                      </div>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label={t("documents.download")} onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t("documents.delete")} onClick={() => setDeleteTarget(d)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("documents.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("documents.deleteDesc")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("documents.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t("documents.deleting") : t("documents.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DocumentsPage;
