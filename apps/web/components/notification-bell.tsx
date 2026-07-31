"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { apiFetch } from "@/lib/api";

type Envelope = { data: unknown[] };

export function NotificationBell() {
  const notifications = useQuery<Envelope>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/notifications"),
  });
  const count = notifications.data?.data.length ?? 0;

  return (
    <button
      className="relative flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
          {count}
        </span>
      )}
    </button>
  );
}
