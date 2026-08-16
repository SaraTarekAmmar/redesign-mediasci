import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check, CheckCheck, Trash2, AtSign, UserCheck, Play, ShieldAlert, Sparkles, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";

export interface AppNotification {
  id: string;
  type: "assignment" | "mention" | "sprint" | "change_request" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-1",
    type: "assignment",
    title: "New Task Assigned",
    message: "Sara Ammar assigned you to MSCI-101: Redesign the multi-step onboarding wizard",
    read: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: "n-2",
    type: "mention",
    title: "Mentioned in Comment",
    message: "Amr Ammar mentioned you in MSCI-104: 'Found the rounding issue in billing service.'",
    read: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: "n-3",
    type: "sprint",
    title: "Sprint Started",
    message: "Sprint 24 is now active. Target completion: 14 days.",
    read: true,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: "n-4",
    type: "change_request",
    title: "Change Request Approved",
    message: "CR-001: Add 2FA Authentication has been approved.",
    read: true,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  }
];

export function NotificationsPopover() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load real notifications from backend API on mount
  useEffect(() => {
    api.get("/notifications")
      .then((res: any) => {
        const data = res?.data || res;
        if (Array.isArray(data) && data.length > 0) {
          const mapped: AppNotification[] = data.map((item: any) => ({
            id: String(item.id),
            type: item.data?.type || "system",
            title: item.data?.title || "Notification",
            message: item.data?.message || item.data?.body || item.type || "Update in workspace",
            read: Boolean(item.read_at),
            createdAt: item.created_at || new Date().toISOString()
          }));
          setNotifications(mapped);
        }
      })
      .catch((err) => {
        // Keep seed fallback if offline/guest
        console.error("[Notifications] Backend load notice:", err);
      });
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.post(`/notifications/${id}/read`, {}).catch(() => {});
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success(t("notifications.allMarkedRead"));
    api.post("/notifications/read-all", {}).catch(() => {});
  };

  const clearAllRead = () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
    toast.info(t("notifications.clearedRead"));
  };

  const getIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "assignment":
        return <UserCheck className="h-4 w-4 text-primary" />;
      case "mention":
        return <AtSign className="h-4 w-4 text-teal-500" />;
      case "sprint":
        return <Play className="h-4 w-4 text-emerald-500" />;
      case "change_request":
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      default:
        return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef} dir={i18n.dir()}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("app.notifications")}
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none tabular-nums text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute end-0 top-10 z-50 w-80 sm:w-96 rounded-xl border border-border bg-popover p-0 shadow-xl transition-all animate-in fade-in-50 zoom-in-95" dir={i18n.dir()}>
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-border p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{t("app.notifications")}</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {t("app.notifications.new", { count: unreadCount })}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5" /> {t("app.notifications.markAllRead")}
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-border bg-muted/30 px-3 py-1.5 text-xs">
            <button
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter("all")}
            >
              {t("app.notifications.filterAll", { count: notifications.length })}
            </button>
            <button
              className={`ml-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "unread" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter("unread")}
            >
              {t("app.notifications.filterUnread", { count: unreadCount })}
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.read && markAsRead(item.id)}
                className={`flex items-start gap-3 p-3 transition-colors ${
                  item.read ? "bg-popover opacity-80" : "bg-primary/5 hover:bg-primary/10 cursor-pointer"
                }`}
              >
                <div className="mt-0.5 shrink-0 rounded-lg border border-border bg-background p-1.5 shadow-sm">
                  {getIcon(item.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold ${item.read ? "text-foreground" : "text-primary"}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>
                </div>

                {!item.read && (
                  <button
                    title={t("notifications.markAsRead")}
                    onClick={(e) => markAsRead(item.id, e)}
                    className="mt-1 shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                {filter === "unread" ? t("app.notifications.noUnread") : t("app.notifications.none")}
              </div>
            )}
          </div>

          {/* Popover Footer */}
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2 text-xs">
            <span className="text-[11px] text-muted-foreground">{t("app.notifications.realtime")}</span>
            {notifications.some((n) => n.read) && (
              <button
                onClick={clearAllRead}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" /> {t("app.notifications.clearRead")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
