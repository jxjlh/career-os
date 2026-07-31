"use client";

import { Button, EmptyState, Input, Skeleton, Textarea, cn } from "@/components/ui";

export { Button, EmptyState, Input, Skeleton, Textarea, cn };

/**
 * 头像: 无图片时使用首字母 + 渐变背景兜底, 保证视觉一致.
 */
export function Avatar({
  name,
  avatarUrl,
  size = 36,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() || "?";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-xs font-semibold text-white",
      )}
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}

/**
 * 圆形进度环: 用于排行榜前三名 / 共同目标进度展示.
 */
export function ProgressRing({
  progress,
  size = 40,
  stroke = 4,
  className,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  return (
    <svg width={size} height={size} className={className}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-border"
        opacity={0.3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="text-primary transition-all duration-500"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/**
 * 段标签: 用于排行榜当前用户高亮、可见性标识等.
 */
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
