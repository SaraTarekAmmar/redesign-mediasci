import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "../ui/DropdownMenuEnhanced";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useSavedViews, type SavedViewConfig } from "../../hooks/useSavedViews";
import { cn } from "../../lib/utils";

interface SavedViewsDropdownProps {
  pageKey: string;
  currentConfig: SavedViewConfig;
  onLoad: (config: SavedViewConfig) => void;
  hasUnsavedChanges?: boolean;
}

export function SavedViewsDropdown({
  pageKey,
  currentConfig,
  onLoad,
  hasUnsavedChanges = false,
}: SavedViewsDropdownProps) {
  const { t } = useTranslation();
  const { views, activeViewId, saveView, loadView, deleteView, renameView, clearActiveView } =
    useSavedViews(pageKey);

  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [open, setOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    saveView(name, currentConfig);
    setSaveName("");
    setIsSaving(false);
  };

  const handleLoad = (id: string) => {
    const config = loadView(id);
    if (config) {
      onLoad(config);
      setOpen(false);
    }
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleConfirmRename = () => {
    if (editingId && editName.trim()) {
      renameView(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const activeView = views.find((v) => v.id === activeViewId);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="h-4 w-4" />
          {activeView ? activeView.name : t("views.saved")}
          {hasUnsavedChanges && (
            <span className="ml-0.5 h-2 w-2 rounded-full bg-amber-500" title={t("views.unsaved")} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1.5">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("views.saved")}</span>
          {!isSaving && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSaving(true);
              }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              {t("views.saveCurrent")}
            </button>
          )}
        </DropdownMenuLabel>

        {isSaving && (
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t("views.namePlaceholder")}
              className="h-7 flex-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setIsSaving(false);
                  setSaveName("");
                }
              }}
            />
            <Button size="icon-xs" variant="ghost" onClick={handleSave} disabled={!saveName.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                setIsSaving(false);
                setSaveName("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {views.length > 0 && <DropdownMenuSeparator />}

        {views.length === 0 && !isSaving && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t("views.noViews")}
          </p>
        )}

        {views
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((view) => (
            <div
              key={view.id}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                view.id === activeViewId ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              {editingId === view.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <Input
                    ref={editInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-6 flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmRename();
                      if (e.key === "Escape") handleCancelRename();
                    }}
                  />
                  <button onClick={handleConfirmRename} className="text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={handleCancelRename} className="text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className="flex-1 truncate text-left"
                    onClick={() => handleLoad(view.id)}
                  >
                    {view.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(view.id, view.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView(view.id);
                    }}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
