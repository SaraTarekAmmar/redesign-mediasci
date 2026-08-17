import React, { useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Trash2, PencilLine, Timer, ClipboardPenLine, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useTimeTracking, type TimeEntry } from "../hooks/useTimeTracking";
import { useApi } from "../hooks/useApi";
import { PageHeader } from "../components/common/PageHeader";
import { UserAvatar } from "../components/common/UserAvatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { DatePicker } from "../components/ui/DatePicker";
import { TimerButton } from "../components/time/TimerButton";
import { TimeLogForm } from "../components/time/TimeLogForm";
import { TimeSummaryCards } from "../components/time/TimeSummary";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/Dialog";

const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function TimeLogsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [editDraft, setEditDraft] = useState({ description: "", minutes: "", date: "" });

  const filters = {
    start_date: dateRange.start || undefined,
    end_date: dateRange.end || undefined,
  };

  const {
    activeTimer,
    entries,
    summary,
    isRunning,
    elapsedSeconds,
    startTimer,
    stopTimer,
    logTime,
    deleteEntry,
    updateEntry,
    refetch,
  } = useTimeTracking(filters);

  const { data: projects } = useApi<{ id: number; name: string }[]>("/projects");
  const { data: issuesData } = useApi<{ id: number; key: string; title: string }[]>(
    "/issues"
  );

  const handleToggleTimer = async () => {
    if (isRunning) {
      try {
        await stopTimer();
        toast.success(isRTL ? "تم إيقاف المؤقت" : "Timer stopped");
      } catch {
        toast.error(isRTL ? "فشل إيقاف المؤقت" : "Failed to stop timer");
      }
    } else {
      try {
        await startTimer();
        toast.success(isRTL ? "بدأ المؤقت" : "Timer started");
      } catch {
        toast.error(isRTL ? "فشل بدء المؤقت" : "Failed to start timer");
      }
    }
  };

  const openEdit = (entry: TimeEntry) => {
    setEditing(entry);
    setEditDraft({
      description: entry.description ?? "",
      minutes: String(entry.minutes),
      date: entry.date ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateEntry(editing.id, {
        description: editDraft.description || undefined,
        minutes: Number(editDraft.minutes) || undefined,
        date: editDraft.date || undefined,
      });
      toast.success(isRTL ? "تم التحديث" : "Updated");
      setEditing(null);
    } catch {
      toast.error(isRTL ? "فشل التحديث" : "Failed to update");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEntry(id);
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch {
      toast.error(isRTL ? "فشل الحذف" : "Failed to delete");
    }
  };

  const timeEntries = entries?.data ?? [];

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 md:px-6 md:py-8" dir={i18n.dir()}>
      <div className="mx-auto max-w-screen-2xl">
        <PageHeader
          title={isRTL ? "تتبع الوقت" : "Time Tracking"}
          subtitle={isRTL ? "سجل العمل وتابع الوقت المنجز" : "Track time and monitor work logged"}
          actions={
            <TimerButton
              isRunning={isRunning}
              elapsedSeconds={elapsedSeconds}
              onToggle={handleToggleTimer}
              variant="full"
            />
          }
        />

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Timer className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">{isRTL ? "اختر الطريقة الأنسب لتسجيل وقتك" : "Choose the easiest way to log your work"}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{isRTL ? "استخدم المؤقت للعمل المباشر أو الإدخال اليدوي لتسجيل وقت سابق." : "Use the timer for work happening now, or Manual Entry for time you already spent."}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"><Timer className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {isRTL ? "مباشر" : "Live work"}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"><ClipboardPenLine className="h-3.5 w-3.5" aria-hidden="true" /> {isRTL ? "سابق" : "Past work"}</span>
          </div>
        </div>

        <div className="mb-6 space-y-6">
          {/* Summary */}
          <TimeSummaryCards summary={summary} />

          {/* Manual Entry Form */}
          <TimeLogForm
            onSubmit={logTime}
            projects={projects ?? []}
            issues={issuesData ?? []}
          />

          {/* Date Range Filter */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "من" : "From"}</label>
              <DatePicker value={dateRange.start} onChange={(v) => setDateRange((r) => ({ ...r, start: v }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "إلى" : "To"}</label>
              <DatePicker value={dateRange.end} onChange={(v) => setDateRange((r) => ({ ...r, end: v }))} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRange({ start: "", end: "" })}
            >
              {isRTL ? "مسح الفلتر" : "Clear filter"}
            </Button>
          </div>

          {/* Entries Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-start text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{isRTL ? "التاريخ" : "Date"}</th>
                  <th className="px-3 py-2.5 font-medium">{isRTL ? "المدة" : "Duration"}</th>
                  <th className="px-3 py-2.5 font-medium">{isRTL ? "المهمة" : "Issue"}</th>
                  <th className="px-3 py-2.5 font-medium">{isRTL ? "المشروع" : "Project"}</th>
                  <th className="px-3 py-2.5 font-medium">{isRTL ? "النوع" : "Type"}</th>
                  <th className="px-3 py-2.5 font-medium">{isRTL ? "الوصف" : "Description"}</th>
                  <th className="px-3 py-2.5 font-medium text-end">{isRTL ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground"><ClipboardPenLine className="h-5 w-5" aria-hidden="true" /></span>
                        <p className="text-sm font-semibold text-foreground">{isRTL ? "لا توجد سجلات وقت بعد" : "Your first time log will appear here"}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{isRTL ? "سجّل وقتًا مباشرًا أو أضف إدخالًا يدويًا لبدء ملخص الساعات." : "Start a timer or submit a manual entry to build your hours summary."}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">{isRTL ? "ابدأ من النموذج أعلاه" : "Start with the form above"} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                      </div>
                    </td>
                  </tr>
                )}
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.date ? format(new Date(entry.date), "MMM d, yyyy") : "-"}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">{fmtDuration(entry.minutes)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {entry.issue ? `${entry.issue.key}` : "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{entry.project?.name ?? "-"}</td>
                    <td className="px-3 py-3">
                      <Badge variant={entry.entry_type === "timer" ? "default" : "outline"}>
                        {entry.entry_type === "timer" ? "Timer" : "Manual"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground truncate max-w-[200px]">
                      {entry.description ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="xs" variant="ghost" onClick={() => openEdit(entry)}>
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? "تعديل سجل الوقت" : "Edit time entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{isRTL ? "التاريخ" : "Date"}</label>
              <DatePicker value={editDraft.date} onChange={(v) => setEditDraft((d) => ({ ...d, date: v }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{isRTL ? "الدقائق" : "Minutes"}</label>
              <Input
                type="number"
                min="1"
                value={editDraft.minutes}
                onChange={(e) => setEditDraft((d) => ({ ...d, minutes: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{isRTL ? "الوصف" : "Description"}</label>
              <Textarea
                value={editDraft.description}
                onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={saveEdit}>{isRTL ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TimeLogsPage;
