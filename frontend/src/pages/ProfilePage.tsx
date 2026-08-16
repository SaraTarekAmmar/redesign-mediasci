import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, Briefcase, Clock, Shield, Users as UsersIcon, Trophy, ListChecks, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/common/PageHeader";
import { UserAvatar } from "../components/common/UserAvatar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Label } from "../components/ui/Label";
import { Badge } from "../components/ui/Badge";
import { useStore, lookups } from "../store/useStore";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Me {
  id: string | number;
  name: string;
  email: string;
  bio?: string | null;
  phone?: string | null;
  job_title?: string | null;
  timezone?: string | null;
  roles?: { name: string }[];
  teams?: { id: number; name: string }[];
}

interface Achievement {
  id: string | number;
  title: string;
  notes?: string | null;
  achieved_at?: string | null;
  project?: { name: string } | null;
  sprint?: { name: string } | null;
}

type Tab = "info" | "tasks" | "achievements";

function ProfilePage() {
  const { t } = useTranslation();
  const issues = useStore((s) => s.issues);

  const [tab, setTab] = useState<Tab>("info");
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const [form, setForm] = useState({ name: "", bio: "", job_title: "", timezone: "" });
  const [pwd, setPwd] = useState({ password: "", password_confirmation: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Me>("/auth/me");
        if (cancelled || !data) return;
        setMe(data);
        setForm({
          name: data.name ?? "",
          bio: data.bio ?? "",
          job_title: data.job_title ?? "",
          timezone: data.timezone ?? "",
        });
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || t("profile.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    api.get<Achievement[]>("/achievements").then((res) => {
      if (!cancelled) setAchievements(Array.isArray(res) ? res : []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [t]);

  const myTasks = me ? issues.filter((i) => i.assigneeId === String(me.id)) : [];

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = { ...form };
      if (pwd.password) {
        payload.password = pwd.password;
        payload.password_confirmation = pwd.password_confirmation;
      }
      const updated = await api.post<Me>("/auth/profile", payload);
      setMe((prev) => (prev && updated ? { ...prev, ...updated } : updated));
      setPwd({ password: "", password_confirmation: "" });
      toast.success(t("profile.saved"));
    } catch (e: any) {
      toast.error(e?.message || t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "info", label: t("profile.tabInfo"), icon: <Shield className="h-4 w-4" /> },
    { key: "tasks", label: t("profile.tabTasks"), icon: <ListChecks className="h-4 w-4" /> },
    { key: "achievements", label: t("profile.tabAchievements"), icon: <Trophy className="h-4 w-4" /> },
  ];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-screen-lg">
        <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

        <div className="mb-5 flex gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                tab === tb.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {tab === "info" && me && (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <UserAvatar userId={String(me.id)} size="lg" className="mx-auto h-20 w-20 text-2xl" />
                <p className="mt-3 text-base font-semibold text-foreground">{me.name}</p>
                <p className="text-xs text-muted-foreground">{me.email}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {(me.roles ?? []).map((r) => (
                    <Badge key={r.name} variant="default">{r.name}</Badge>
                  ))}
                  {(me.teams ?? []).map((tm) => (
                    <Badge key={tm.id} variant="outline">{tm.name}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {me.email}</div>
                {me.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {me.phone}</div>}
                {me.job_title && <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" /> {me.job_title}</div>}
                {me.timezone && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> {me.timezone}</div>}
              </div>

              <Link
                to="/analytics"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium text-primary hover:bg-muted"
              >
                <BarChart3 className="h-4 w-4" /> {t("profile.viewAnalytics")}
              </Link>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">{t("profile.editSection")}</h2>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">{t("profile.name")}</Label>
                    <Input id="profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-job">{t("profile.jobTitle")}</Label>
                      <Input id="profile-job" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-tz">{t("profile.timezone")}</Label>
                      <Input id="profile-tz" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="e.g. Africa/Cairo" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-bio">{t("profile.bio")}</Label>
                    <Textarea id="profile-bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t("profile.bioPlaceholder")} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">{t("profile.changePassword")}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-pwd">{t("profile.newPassword")}</Label>
                    <Input id="profile-pwd" type="password" value={pwd.password} onChange={(e) => setPwd({ ...pwd, password: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-pwd2">{t("profile.confirmPassword")}</Label>
                    <Input id="profile-pwd2" type="password" value={pwd.password_confirmation} onChange={(e) => setPwd({ ...pwd, password_confirmation: e.target.value })} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("profile.passwordHint")}</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {t("profile.saveChanges")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("profile.assignedTasks")}</h2>
              <Badge variant="outline">{t("profile.taskCount", { count: myTasks.length })}</Badge>
            </div>
            <div className="divide-y divide-border">
              {myTasks.map((task) => {
                const status = lookups.statusById[task.statusId];
                return (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="font-mono text-xs text-primary">{task.key}</span>
                    <span className="flex-1 truncate text-foreground">{task.title}</span>
                    {status && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${status.color}22`, color: status.color }}
                      >
                        {status.name}
                      </span>
                    )}
                  </div>
                );
              })}
              {myTasks.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">{t("profile.noTasks")}</div>
              )}
            </div>
          </div>
        )}

        {tab === "achievements" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4 text-center">
                <Trophy className="mx-auto h-7 w-7 text-amber-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.project?.name || t("profile.achievementGeneric")}</p>
                {a.notes && <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>}
              </div>
            ))}
            {achievements.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-muted-foreground">{t("profile.noAchievements")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
