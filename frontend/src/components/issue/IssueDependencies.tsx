import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/SelectEnhanced";
import { useStore } from "../../store/useStore";

type DependencyType = "blocks" | "is_blocked_by" | "relates_to" | "duplicates";

const TYPE_LABELS: Record<DependencyType, string> = {
  blocks: "Blocks",
  is_blocked_by: "Blocked by",
  relates_to: "Relates to",
  duplicates: "Duplicates",
};

interface DependencyRow {
  id: number;
  type: DependencyType;
  depends_on: { id: number; key?: string; title: string };
}

interface Props {
  issueId: string;
  projectId?: string;
}

export function IssueDependencies({ issueId, projectId }: Props) {
  const allIssues = useStore((s) => s.issues);
  const [deps, setDeps] = useState<DependencyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pickedIssueId, setPickedIssueId] = useState<string | null>(null);
  const [type, setType] = useState<DependencyType>("blocks");
  const [saving, setSaving] = useState(false);

  const fetchDeps = async () => {
    setLoading(true);
    try {
      const data = await api.get<DependencyRow[]>(`/issues/${issueId}/dependencies`);
      setDeps(Array.isArray(data) ? data : []);
    } catch {
      setDeps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (issueId) fetchDeps();
  }, [issueId]);

  const openAdd = () => {
    setSearch("");
    setPickedIssueId(null);
    setType("blocks");
    setDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!pickedIssueId) {
      toast.error("Pick an issue first");
      return;
    }
    setSaving(true);
    try {
      const result = await api.post<DependencyRow>(`/issues/${issueId}/dependencies`, {
        depends_on_id: Number(pickedIssueId),
        type,
      });
      if (result) setDeps((prev) => [...prev, result]);
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't add dependency");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (depId: number) => {
    try {
      await api.del(`/dependencies/${depId}`);
      setDeps((prev) => prev.filter((d) => d.id !== depId));
    } catch (err: any) {
      toast.error(err?.message || "Couldn't remove dependency");
    }
  };

  const linkedIds = new Set(deps.map((d) => String(d.depends_on?.id)));
  const candidates = allIssues
    .filter((i) => {
      if (i.id === issueId || linkedIds.has(i.id)) return false;
      if (projectId && i.projectId !== projectId) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q);
    })
    .slice(0, 20);

  const grouped = (Object.keys(TYPE_LABELS) as DependencyType[])
    .map((t) => ({ type: t, items: deps.filter((d) => d.type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dependencies
        </span>
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-xs" onClick={openAdd}>
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground">No dependencies linked.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map((g) => (
            <div key={g.type} className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">{TYPE_LABELS[g.type]}</span>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((d) => (
                  <span
                    key={d.id}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/30 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent/50"
                  >
                    <span className="font-mono text-muted-foreground">{d.depends_on?.key}</span>
                    <span className="max-w-[140px] truncate">{d.depends_on?.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(d.id)}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove dependency"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add dependency</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Select value={type} onValueChange={(v) => setType(v as DependencyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as DependencyType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPickedIssueId(null);
              }}
              placeholder="Search issues by title or key..."
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-1">
              {candidates.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching issues.</p>
              ) : (
                candidates.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setPickedIssueId(i.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent/40 ${
                      pickedIssueId === i.id ? "bg-accent/60" : ""
                    }`}
                  >
                    <span className="font-mono text-muted-foreground">{i.key}</span>
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving || !pickedIssueId}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
