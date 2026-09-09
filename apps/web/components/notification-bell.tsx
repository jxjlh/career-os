"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/components/ui";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  link: string | null;
  createdAt: string;
};

type Envelope = { data: Notification[] };

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifications = useQuery<Envelope>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/notifications"),
    refetchInterval: 30000,
  });

  const items = notifications.data?.data ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/notifications/${id}/read`, { method: "POST" });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {}
    },
    [queryClient]
  );

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
  }, [queryClient]);

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/notifications/${id}`, { method: "DELETE" });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {}
    },
    [queryClient]
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text",
          open && "bg-surface-muted text-text"
        )}
        aria-label="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-border-subtle bg-surface shadow-xl z-[100] overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border-subtle">
            <h3 className="font-semibold text-sm">通知</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllRead();
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  全部已读
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.isLoading ? (
              <div className="p-8 text-center text-muted text-sm">加载中...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>暂无通知</p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 hover:bg-surface-muted/50 transition-colors cursor-pointer",
                      !n.readAt && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (!n.readAt) markAsRead(n.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.readAt && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">{n.title}</span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-muted mt-1 line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-xs text-muted mt-1">
                          {new Date(n.createdAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {!n.readAt && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="p-1 rounded hover:bg-surface-muted text-muted hover:text-text"
                            title="标记已读"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="p-1 rounded hover:bg-surface-muted text-muted hover:text-danger"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
