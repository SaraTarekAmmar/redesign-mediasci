import { useState, useCallback, useEffect } from "react";
import type { IssueTypeKey } from "../data/types";

export interface SavedViewConfig {
  filters: {
    search: string;
    assigneeIds: string[];
    typeKeys: IssueTypeKey[];
    labelIds: string[];
    epicIds: string[];
    workstream: "presale" | "postsale" | "";
  };
  sortField: string;
  sortOrder: "asc" | "desc";
  viewMode: string;
  groupBy: string;
}

export interface SavedView {
  id: string;
  name: string;
  config: SavedViewConfig;
  createdAt: number;
}

const STORAGE_KEY_PREFIX = "mediasci_saved_views_";

function loadViews(pageKey: string): SavedView[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${pageKey}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistViews(pageKey: string, views: SavedView[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${pageKey}`, JSON.stringify(views));
  } catch {
    // silently fail
  }
}

export function useSavedViews(pageKey: string) {
  const [views, setViews] = useState<SavedView[]>(() => loadViews(pageKey));
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    setViews(loadViews(pageKey));
  }, [pageKey]);

  const saveView = useCallback(
    (name: string, config: SavedViewConfig) => {
      const newView: SavedView = {
        id: `sv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        config,
        createdAt: Date.now(),
      };
      const next = [...views, newView];
      setViews(next);
      setActiveViewId(newView.id);
      persistViews(pageKey, next);
      return newView.id;
    },
    [views, pageKey]
  );

  const loadView = useCallback(
    (id: string): SavedViewConfig | null => {
      const view = views.find((v) => v.id === id);
      if (!view) return null;
      setActiveViewId(id);
      return view.config;
    },
    [views]
  );

  const deleteView = useCallback(
    (id: string) => {
      const next = views.filter((v) => v.id !== id);
      setViews(next);
      if (activeViewId === id) setActiveViewId(null);
      persistViews(pageKey, next);
    },
    [views, activeViewId, pageKey]
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      const next = views.map((v) => (v.id === id ? { ...v, name } : v));
      setViews(next);
      persistViews(pageKey, next);
    },
    [views, pageKey]
  );

  const clearActiveView = useCallback(() => {
    setActiveViewId(null);
  }, []);

  return {
    views,
    activeViewId,
    saveView,
    loadView,
    deleteView,
    renameView,
    clearActiveView,
  };
}
