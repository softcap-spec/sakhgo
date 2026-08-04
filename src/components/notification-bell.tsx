"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  apiGetAdminNotifications,
  apiGetUnreadCount,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
} from "@/lib/api";

export interface AdminNotification {
  id: string;
  type: string;
  text: string;
  link?: string | null;
  read: boolean;
  created_at: string;
}

interface Props {
  className?: string;
}

const TYPE_LABELS: Record<string, string> = {
  new_edit: "Новое объявление",
  new_user: "Новый пользователь",
  new_booking: "Новая бронь",
};

const TYPE_CLASSES: Record<string, string> = {
  new_edit: "bg-yellow-100 text-yellow-800 border-yellow-200",
  new_user: "bg-blue-100 text-blue-800 border-blue-200",
  new_booking: "bg-green-100 text-green-800 border-green-200",
};

const TIME_FORMAT = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return TIME_FORMAT.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return TIME_FORMAT.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return TIME_FORMAT.format(-days, "day");
  return new Date(dateStr).toLocaleDateString("ru-RU");
}

export function NotificationBell({ className }: Props) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [list, count] = await Promise.all([
        apiGetAdminNotifications(),
        apiGetUnreadCount(),
      ]);
      setNotifications(list as AdminNotification[]);
      setUnreadCount(count as number);
    } catch {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(timer);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notif-bell]")) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={cn("relative", className)} data-notif-bell>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          "hover:bg-muted",
          open && "bg-muted"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <span className="font-display text-sm">Уведомления</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Нет уведомлений
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b last:border-b-0 transition-colors flex gap-3",
                    !n.read && "bg-accent/5 hover:bg-accent/10",
                    n.read && "hover:bg-muted/20"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          TYPE_CLASSES[n.type] || "bg-muted"
                        )}
                      >
                        {TYPE_LABELS[n.type] || n.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm leading-tight">{n.text}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {n.link && (
                        <a
                          href={n.link}
                          className="text-xs text-accent hover:underline"
                          target={n.link.startsWith("http") ? "_blank" : undefined}
                          rel={n.link.startsWith("http") ? "noopener noreferrer" : undefined}
                          onClick={() => handleMarkRead(n.id)}
                        >
                          Открыть →
                        </a>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Отметить прочитанным
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
