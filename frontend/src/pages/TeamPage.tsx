import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Building2, Briefcase, Plus, FolderKanban, Check, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { UserAvatar } from "../components/common/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Resource {
  id: number;
  user_id: number;
  name: string;
  email: string;
  position: string;
  seniority: string;
  weekly_capacity: number;
  availability_status: string;
  utilization_percentage: number;
  avatar_url?: string;
  department?: { id: number; name: string };
  teams: { id: number; name: string }[];
  skills: { id: number; name: string; proficiency: string }[];
}

interface TeamDetail {
  id: number;
  name: string;
  description?: string;
  color?: string;
  department?: { id: number; name: string };
}

export default function TeamPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const isRTL = i18n.dir() === "rtl";

  const [teams, setTeams] = useState<TeamDetail[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamResources, setTeamResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Load Teams list
  useEffect(() => {
    api.get<TeamDetail[]>("/teams")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTeams(list);
        if (list.length > 0) {
          setSelectedTeamId(list[0].id);
        }
      })
      .catch(() => {
        toast.error(isRTL ? "فشل تحميل الفرق" : "Failed to load teams.");
      });
  }, []);

  // Fetch Team-scoped Resources (GET /api/resources?team_id={id})
  useEffect(() => {
    if (!selectedTeamId) return;
    setLoading(true);
    api.get<Resource[]>(`/resources?team_id=${selectedTeamId}`)
      .then((data) => {
        setTeamResources(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        toast.error(isRTL ? "فشل تحميل اعضاء الفريق" : "Failed to load team members.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedTeamId]);

  const currentTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="h-full overflow-y-auto p-5" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-screen-2xl space-y-5">
      {/* Team Header & Switcher */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <FolderKanban className="h-4 w-4" />
              {isRTL ? "فريق العمل المباشر" : "Team Execution View"}
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-1">
              {currentTeam?.name || (isRTL ? "تفاصيل الفريق" : "Team Details")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {currentTeam?.description || (isRTL ? "عرض أعضاء الفريق والموارد المخصصة لهذا الفريق" : "Resources assigned strictly to this team.")}
            </p>
          </div>

          {/* Team Switcher Tabs */}
          <div className="flex flex-wrap gap-2">
            {currentTeam && (
              <Button
                variant="outline"
                onClick={() => navigate(`/resources?team_id=${currentTeam.id}`)}
              >
                {isRTL ? "إدارة الموارد" : "Manage Resources"}
              </Button>
            )}
            {teams.map((tm) => (
              <button
                key={tm.id}
                onClick={() => setSelectedTeamId(tm.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  selectedTeamId === tm.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted text-muted-foreground border-border hover:bg-accent"
                )}
              >
                {tm.name}
              </button>
            ))}
          </div>
        </div>

        {/* Team Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div>
            <span className="text-xs text-muted-foreground block">{isRTL ? "إجمالي أعضاء الفريق" : "Team Members"}</span>
            <span className="text-xl font-bold text-foreground">{teamResources.length}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">{isRTL ? "إجمالي السعة الأسبوعية" : "Total Capacity"}</span>
            <span className="text-xl font-bold text-primary">
              {teamResources.reduce((acc, r) => acc + (r.weekly_capacity || 40), 0)} hrs
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">{isRTL ? "متوسط الاستغلال" : "Avg Utilization"}</span>
            <span className="text-xl font-bold text-emerald-600">
              {teamResources.length
                ? Math.round(teamResources.reduce((acc, r) => acc + r.utilization_percentage, 0) / teamResources.length)
                : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Team Members List (NO global search, NO department filter, NO team dropdown) */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {isRTL ? "أعضاء هذا الفريق" : "Assigned Team Resources"}
          </h3>
          <span className="text-xs text-muted-foreground font-normal">
            {isRTL ? "معروض فقط الموارد المنضمة لهذا الفريق" : "Filtered strictly to selected team"}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading team members..."}</div>
        ) : teamResources.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{isRTL ? "لا يوجد أعضاء في هذا الفريق بعد." : "No resources assigned to this team yet."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground font-medium">
                <tr>
                  <th className="p-4">{isRTL ? "العضو" : "Member"}</th>
                  <th className="p-4">{isRTL ? "المنصب" : "Position"}</th>
                  <th className="p-4">{isRTL ? "الاستغلال" : "Utilization"}</th>
                  <th className="p-4">{isRTL ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamResources.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedResource(r)}
                    className="hover:bg-muted/60 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={r.name} avatarUrl={r.avatar_url} size="md" />
                        <div>
                          <div className="font-semibold text-foreground">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">{r.position}</div>
                      <div className="text-xs text-muted-foreground">{r.seniority}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              r.utilization_percentage > 90 ? "bg-rose-500" : r.utilization_percentage > 60 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(r.utilization_percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                          {r.utilization_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                        {r.availability_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resource Detail Dialog */}
      {selectedResource && (
        <Dialog open={Boolean(selectedResource)} onOpenChange={() => setSelectedResource(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <UserAvatar name={selectedResource.name} avatarUrl={selectedResource.avatar_url} size="md" />
                <div>
                  <div className="text-lg font-bold">{selectedResource.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{selectedResource.position} • {selectedResource.seniority}</div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 border-t border-b text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground block text-xs">{isRTL ? "البريد الإلكتروني" : "Email"}</span>
                  <span className="font-medium">{selectedResource.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">{isRTL ? "نسبة الاستغلال" : "Utilization"}</span>
                  <span className="font-semibold text-primary">{selectedResource.utilization_percentage}%</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedResource(null)}>{isRTL ? "إغلاق" : "Close"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
