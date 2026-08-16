import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/SelectEnhanced";
import { api } from "../lib/api";
import { buildStakeholderRegistrationFallback } from "../data/stakeholderFallbacks";

interface RegistrationRow {
  id: string;
  name: string;
  type: string;
  category: string | null;
  role: string | null;
  projects: string[];
  influenceLevel: string;
  interestLevel: string;
  supportLevel: string;
  status: string;
  createdAt: string;
}

function supportVariant(level: string): "default" | "secondary" | "outline" {
  if (level === "Supporter") return "default";
  if (level === "Opponent") return "outline";
  return "secondary";
}

function StakeholderRegistrationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    api.get<RegistrationRow[]>("/stakeholders/registration")
      .then((res) => { if (!cancelled) setRows(Array.isArray(res) ? res : []); })
      .catch((e: any) => {
        if (!cancelled) {
          const fallback = buildStakeholderRegistrationFallback();
          setRows(fallback);
          if (fallback.length === 0) {
            setError(e?.message || "Failed to load");
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.role || "").toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("stakeholders.registration.title")}
          subtitle={t("stakeholders.registration.subtitle", { count: rows.length })}
        />

        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder={t("stakeholders.registration.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("stakeholders.registration.filterAll")}</SelectItem>
              <SelectItem value="Active">{t("stakeholders.status.active")}</SelectItem>
              <SelectItem value="Inactive">{t("stakeholders.status.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">{error}</div>}

        {!error && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t("stakeholders.colName")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.registration.colType")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.registration.colCategory")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.colRole")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.registration.colProjects")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.colInfluence")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.colInterest")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.registration.colSupport")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.colStatus")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("stakeholders.registration.colRegistered")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                    onClick={() => navigate(`/stakeholders/${r.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.type}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.category || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.role || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.projects.length ? r.projects.join(", ") : "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.influenceLevel}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.interestLevel}</td>
                    <td className="px-3 py-3"><Badge variant={supportVariant(r.supportLevel)}>{r.supportLevel}</Badge></td>
                    <td className="px-3 py-3"><Badge variant={r.status === "Active" ? "default" : "secondary"}>{r.status}</Badge></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {t("stakeholders.registration.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default StakeholderRegistrationPage;
