import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { DatePicker } from "../ui/DatePicker";

interface TimeLogFormProps {
  onSubmit: (data: {
    issue_id?: number;
    project_id?: number;
    description?: string;
    minutes: number;
    date: string;
  }) => Promise<any>;
  projects?: { id: number; name: string }[];
  issues?: { id: number; key: string; title: string }[];
}

export function TimeLogForm({ onSubmit, projects = [], issues = [] }: TimeLogFormProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [issueId, setIssueId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalMinutes = Number(hours) * 60 + Number(minutes);
    if (totalMinutes <= 0) {
      toast.error(isRTL ? "يجب إدخال وقت أكبر من صفر" : "Time must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        minutes: totalMinutes,
        date,
        description: description.trim() || undefined,
        issue_id: issueId !== "none" ? Number(issueId) : undefined,
        project_id: projectId !== "none" ? Number(projectId) : undefined,
      });
      toast.success(isRTL ? "تم تسجيل الوقت" : "Time logged successfully");
      setDescription("");
      setHours("0");
      setMinutes("30");
    } catch {
      toast.error(isRTL ? "فشل تسجيل الوقت" : "Failed to log time");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{t("timeTracking.manualEntry")}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("timeTracking.date")}</label>
          <DatePicker value={date} onChange={setDate} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("timeTracking.hours")}</label>
            <Input
              type="number"
              min="0"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("timeTracking.minutes")}</label>
            <Input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Issue</label>
          <select
            value={issueId}
            onChange={(e) => setIssueId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="none">No issue</option>
            {issues.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issue.key} — {issue.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {projects.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="none">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("timeTracking.description")}</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={isRTL ? "ماذا عملت؟" : "What did you work on?"}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (isRTL ? "جارٍ الحفظ..." : "Saving...") : t("timeTracking.logTime")}
        </Button>
      </div>
    </form>
  );
}
