import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";

export interface TimeEntry {
  id: number;
  user_id: number;
  issue_id: number | null;
  project_id: number | null;
  description: string | null;
  minutes: number;
  date: string | null;
  entry_type: "timer" | "manual";
  created_at: string;
  updated_at: string;
  user?: { id: number; name: string; avatar?: string };
  issue?: { id: number; key: string; title: string };
  project?: { id: number; name: string };
}

export interface TimeSummary {
  total_minutes: number;
  total_hours: number;
  by_project: { project_id: number; project_name: string; total_minutes: number }[];
  by_user: { user_id: number; user_name: string; total_minutes: number }[];
  date_range: { start: string; end: string };
}

export interface PaginatedEntries {
  data: TimeEntry[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export function useTimeTracking(filters?: { user_id?: number; project_id?: number; start_date?: string; end_date?: string }) {
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<PaginatedEntries | null>(null);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = activeTimer !== null && activeTimer.date === null;

  const fetchActiveTimer = useCallback(async () => {
    try {
      const data = await apiFetch<TimeEntry | null>("/time-entries/active");
      setActiveTimer(data);
      if (data && data.date === null) {
        const startedAt = new Date(data.created_at).getTime();
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }
    } catch {
      setActiveTimer(null);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.user_id) params.set("user_id", String(filters.user_id));
      if (filters?.project_id) params.set("project_id", String(filters.project_id));
      if (filters?.start_date) params.set("start_date", filters.start_date);
      if (filters?.end_date) params.set("end_date", filters.end_date);
      const qs = params.toString();
      const data = await apiFetch<PaginatedEntries>(`/time-entries${qs ? `?${qs}` : ""}`);
      setEntries(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [filters?.user_id, filters?.project_id, filters?.start_date, filters?.end_date]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters?.user_id) params.set("user_id", String(filters.user_id));
      if (filters?.project_id) params.set("project_id", String(filters.project_id));
      const qs = params.toString();
      const data = await apiFetch<TimeSummary>(`/time-entries/summary${qs ? `?${qs}` : ""}`);
      setSummary(data);
    } catch {
      /* ignore */
    }
  }, [filters?.user_id, filters?.project_id]);

  useEffect(() => {
    fetchActiveTimer();
    fetchEntries();
    fetchSummary();

    const poll = setInterval(fetchActiveTimer, 10_000);
    return () => clearInterval(poll);
  }, [fetchActiveTimer, fetchEntries, fetchSummary]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const startTimer = useCallback(
    async (issueId?: number, projectId?: number) => {
      const body: Record<string, unknown> = {};
      if (issueId) body.issue_id = issueId;
      if (projectId) body.project_id = projectId;

      const data = await apiFetch<TimeEntry>("/time-entries/start", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setActiveTimer(data);
      setElapsedSeconds(0);
      return data;
    },
    []
  );

  const stopTimer = useCallback(async () => {
    const data = await apiFetch<TimeEntry>("/time-entries/stop", {
      method: "POST",
    });
    setActiveTimer(null);
    setElapsedSeconds(0);
    fetchEntries();
    fetchSummary();
    return data;
  }, [fetchEntries, fetchSummary]);

  const logTime = useCallback(
    async (data: { issue_id?: number; project_id?: number; description?: string; minutes: number; date: string }) => {
      const result = await apiFetch<TimeEntry>("/time-entries", {
        method: "POST",
        body: JSON.stringify(data),
      });
      fetchEntries();
      fetchSummary();
      return result;
    },
    [fetchEntries, fetchSummary]
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      await apiFetch(`/time-entries/${id}`, { method: "DELETE" });
      fetchEntries();
      fetchSummary();
    },
    [fetchEntries, fetchSummary]
  );

  const updateEntry = useCallback(
    async (id: number, data: Partial<{ description: string; minutes: number; date: string; issue_id: number | null; project_id: number | null }>) => {
      const result = await apiFetch<TimeEntry>(`/time-entries/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      fetchEntries();
      fetchSummary();
      return result;
    },
    [fetchEntries, fetchSummary]
  );

  return {
    activeTimer,
    entries,
    summary,
    loading,
    error,
    isRunning,
    elapsedSeconds,
    startTimer,
    stopTimer,
    logTime,
    deleteEntry,
    updateEntry,
    refetch: fetchEntries,
    refetchSummary: fetchSummary,
  };
}
