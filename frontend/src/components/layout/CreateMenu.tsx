import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  CheckSquare,
  GitPullRequestArrow,
  Timer,
  Users,
  FileText,
  ShieldAlert,
  FolderPlus,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface CreateMenuItem {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
  action: "dialog" | "navigate";
  path?: string;
  dialogType?: string;
  roles?: string[];
}

interface Props {
  onOpenIssueDialog: () => void;
  onOpenChangeRequestDialog?: () => void;
}

export function CreateMenu({ onOpenIssueDialog, onOpenChangeRequestDialog }: Props) {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const items: CreateMenuItem[] = [
    {
      key: "project",
      labelKey: "create.project",
      icon: <FolderPlus className="h-4 w-4" />,
      action: "navigate",
      path: "/projects/new",
      roles: ["super-admin", "admin"],
    },
    {
      key: "issue",
      labelKey: "create.issue",
      icon: <CheckSquare className="h-4 w-4" />,
      action: "dialog",
      dialogType: "issue",
    },
    {
      key: "changeRequest",
      labelKey: "create.changeRequest",
      icon: <GitPullRequestArrow className="h-4 w-4" />,
      action: "dialog",
      dialogType: "changeRequest",
      roles: ["super-admin", "admin", "project-manager", "team-leader", "developer"],
    },
    {
      key: "sprint",
      labelKey: "create.sprint",
      icon: <Timer className="h-4 w-4" />,
      action: "navigate",
      path: "/sprints",
      roles: ["super-admin", "admin", "project-manager", "team-leader"],
    },
    {
      key: "timeLog",
      labelKey: "create.timeLog",
      icon: <Timer className="h-4 w-4" />,
      action: "navigate",
      path: "/time-logs",
    },
    {
      key: "risk",
      labelKey: "create.risk",
      icon: <ShieldAlert className="h-4 w-4" />,
      action: "navigate",
      path: "/risks",
      roles: ["super-admin", "admin", "project-manager", "team-leader"],
    },
    {
      key: "stakeholder",
      labelKey: "create.stakeholder",
      icon: <Users className="h-4 w-4" />,
      action: "navigate",
      path: "/stakeholders",
      roles: ["super-admin", "admin", "project-manager"],
    },
    {
      key: "document",
      labelKey: "create.document",
      icon: <FileText className="h-4 w-4" />,
      action: "navigate",
      path: "/documents",
    },
  ];

  const visibleItems = items.filter((item) => !item.roles || hasRole(...item.roles));

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleItemClick = (item: CreateMenuItem) => {
    setOpen(false);
    if (item.action === "dialog") {
      if (item.dialogType === "issue") {
        onOpenIssueDialog();
      } else if (item.dialogType === "changeRequest" && onOpenChangeRequestDialog) {
        onOpenChangeRequestDialog();
      }
    } else if (item.action === "navigate" && item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("app.create")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="p-1">
            {visibleItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleItemClick(item)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/70"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
