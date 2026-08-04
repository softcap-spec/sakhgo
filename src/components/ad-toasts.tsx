"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiGetAdminNotifications, apiMarkNotificationRead } from "@/lib/api";

interface AdminNotification {
  id: string;
  type: string;
  text: string;
  link?: string | null;
  read: boolean;
  created_at: string;
}

interface ToastItem {
  id: string;
  text: string;
  link?: string | null;
  type: string;
  dying: boolean;
}

// ── Browser Notification helpers ──
function isNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function notificationPermission(): NotificationPermission {
  return isNotificationsSupported() ? (Notification as any)?.permission ?? "default" : "denied";
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  if (notificationPermission() === "granted") return true;
  if (notificationPermission() === "denied") return false;
  try {
    const result = await (Notification as any).requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

function showBrowserNotification(text: string, link?: string | null) {
  if (!isNotificationsSupported() || notificationPermission() !== "granted") return;
  const n = new Notification("СахGO · Админ", {
    body: text,
    icon: "/favicon.ico",
    tag: "sakhgo-admin",
    requireInteraction: true,
  });
  if (link) {
    n.onclick = () => {
      window.open(link, "_blank");
      n.close();
    };
  }
}

const TYPE_LABELS: Record<string, string> = {
  new_edit: "Новое объявление",
  new_user: "Новый пользователь",
  new_booking: "Новая бронь",
};

export function AdToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifAllowed, setNotifAllowed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const seenIds = useRef(new Set<string>());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Check permission on mount
  useEffect(() => {
    const perm = notificationPermission();
    setNotifAllowed(perm === "granted");
    if (perm === "default") {
      setShowBanner(true);
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    const ok = await requestNotificationPermission();
    setNotifAllowed(ok);
    setShowBanner(false);
  }, []);

  const poll = async () => {
    try {
      const list = (await apiGetAdminNotifications()) as AdminNotification[];
      for (const n of list) {
        if (!n.read && !seenIds.current.has(n.id)) {
          seenIds.current.add(n.id);

          // Browser (system) notification — shown even when tab is in background or user is on another site
          showBrowserNotification(n.text, n.link);

          // In-page toast
          const toast: ToastItem = { id: n.id, text: n.text, link: n.link, type: n.type, dying: false };
          setToasts((prev) => [...prev, toast]);

          const dismissTimer = setTimeout(() => {
            setToasts((prev) => prev.map((t) => (t.id === n.id ? { ...t, dying: true } : t)));
            const removeTimer = setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== n.id));
              timersRef.current.delete(n.id);
              timersRef.current.delete(n.id + "_remove");
            }, 400);
            timersRef.current.set(n.id + "_remove", removeTimer);
          }, 6000);
          timersRef.current.set(n.id, dismissTimer);
        }
      }
    } catch {}
  };

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 30000);
    return () => {
      clearInterval(timer);
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const dismiss = async (id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dying: true } : t)));
    try {
      await apiMarkNotificationRead(id);
    } catch {}
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 400);
  };

  return (
    <>
      {/* Permission request banner */}
      {showBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-xl shadow-xl px-5 py-3 flex items-center gap-4 max-w-md animate-slide-up">
          <div className="flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4 text-red-600 shrink-0" />
            <span>Включите уведомления, чтобы получать оповещения даже на других сайтах</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={enableNotifications}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Включить
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <style jsx>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translate(-50%, 1rem); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
            .animate-slide-up { animation: slideUp 0.35s ease-out; }
          `}</style>
        </div>
      )}

      {/* Status indicator in page corner */}
      {!notifAllowed && !showBanner && (
        <button
          onClick={enableNotifications}
          className="fixed bottom-4 left-4 z-40 w-9 h-9 bg-muted/50 hover:bg-muted border rounded-full flex items-center justify-center transition-colors"
          title="Включить уведомления"
        >
          <BellOff className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* In-page toast stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "bg-card border rounded-xl shadow-xl p-4 flex gap-3 items-start transition-all duration-300 pointer-events-auto",
                t.dying
                  ? "opacity-0 translate-x-8 scale-95"
                  : "opacity-100 translate-x-0 scale-100 animate-slide-in"
              )}
            >
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">
                  {TYPE_LABELS[t.type] || "Уведомление"}
                </p>
                <p className="text-sm leading-snug line-clamp-2">{t.text}</p>
                {t.link && (
                  <a
                    href={t.link}
                    className="text-xs text-accent hover:underline mt-1.5 inline-block font-medium"
                    onClick={() => dismiss(t.id)}
                  >
                    Перейти →
                  </a>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <style jsx>{`
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(2rem) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateX(0) scale(1);
              }
            }
            .animate-slide-in {
              animation: slideIn 0.35s ease-out;
            }
          `}</style>
        </div>
      )}
    </>
  );
}
