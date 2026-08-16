import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export interface BudgetSummary {
  budget_id: number;
  total_budget: number;
  spent: number;
  remaining: number;
  burn_rate: number;
  hourly_rate: number;
  currency: string;
  total_hours: number;
}

export interface BudgetRecord {
  id: number;
  project_id: number;
  total_budget: number;
  spent: number;
  hourly_rate: number;
  currency: string;
  project?: { id: number; name: string };
}

export interface CostByMember {
  hourly_rate: number;
  currency: string;
  members: {
    user_id: string;
    user_name: string;
    total_minutes: number;
    total_hours: number;
    cost: number;
  }[];
}

export interface CostByProject {
  project_id: number;
  project_name: string;
  total_hours: number;
  cost: number;
  budget: number;
  currency: string;
}

export function useBudget(projectId?: string | number) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [costByMember, setCostByMember] = useState<CostByMember | null>(null);
  const [costByProject, setCostByProject] = useState<CostByProject | null>(null);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (pid?: string | number) => {
    const id = pid ?? projectId;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<BudgetSummary>(`/budgets/${id}/summary`);
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch budget summary");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchCostByMember = useCallback(async (pid?: string | number) => {
    const id = pid ?? projectId;
    if (!id) return;
    try {
      const data = await api.get<CostByMember>(`/budgets/${id}/cost-by-member`);
      setCostByMember(data);
    } catch (err: any) {
      console.error("Failed to fetch cost by member", err);
    }
  }, [projectId]);

  const fetchCostByProject = useCallback(async (pid?: string | number) => {
    const id = pid ?? projectId;
    if (!id) return;
    try {
      const data = await api.get<CostByProject>(`/budgets/${id}/cost-by-project`);
      setCostByProject(data);
    } catch (err: any) {
      console.error("Failed to fetch cost by project", err);
    }
  }, [projectId]);

  const fetchBudgets = useCallback(async () => {
    try {
      const data = await api.get<BudgetRecord[]>("/budgets");
      setBudgets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch budgets", err);
    }
  }, []);

  const saveBudget = useCallback(async (body: { project_id: string | number; total_budget?: number; hourly_rate?: number; currency?: string }) => {
    try {
      const result = await api.post<BudgetRecord>("/budgets", body);
      if (projectId) await fetchSummary(projectId);
      return result;
    } catch (err: any) {
      setError(err?.message || "Failed to save budget");
      return null;
    }
  }, [projectId, fetchSummary]);

  const updateBudget = useCallback(async (budgetId: number, body: { total_budget?: number; hourly_rate?: number; currency?: string }) => {
    try {
      const result = await api.put<BudgetRecord>(`/budgets/${budgetId}`, body);
      if (projectId) await fetchSummary(projectId);
      return result;
    } catch (err: any) {
      setError(err?.message || "Failed to update budget");
      return null;
    }
  }, [projectId, fetchSummary]);

  useEffect(() => {
    if (projectId) {
      fetchSummary(projectId);
      fetchCostByMember(projectId);
      fetchCostByProject(projectId);
    }
  }, [projectId, fetchSummary, fetchCostByMember, fetchCostByProject]);

  return {
    summary,
    costByMember,
    costByProject,
    budgets,
    loading,
    error,
    fetchSummary,
    fetchCostByMember,
    fetchCostByProject,
    fetchBudgets,
    saveBudget,
    updateBudget,
  };
}
