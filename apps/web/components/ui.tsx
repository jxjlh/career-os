"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@career-os/utils";

import { useMagneticHover } from "@/lib/motion";

export { cn };

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // default —— 克制：surface-elevated 底 + 细边框，紫色仅 hover 时浮现
        default:
          "border border-border-subtle bg-surface-elevated text-text hover:border-primary/40 hover:bg-surface hover:text-primary active:scale-[0.98]",
        // primary —— 柔和蓝仅关键 CTA，用纯色 + 轻微 glow
        primary:
          "bg-primary text-white shadow-[0_8px_24px_-12px_rgba(91,141,239,0.5)] hover:bg-primary-hover hover:shadow-[0_12px_28px_-12px_rgba(91,141,239,0.65)] active:scale-[0.98]",
        outline:
          "border border-border bg-surface/60 text-text hover:border-primary/35 hover:bg-surface-elevated",
        ghost: "text-text-secondary hover:bg-surface-elevated/60 hover:text-text",
        danger: "bg-danger text-white hover:brightness-105 active:scale-[0.98]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  // primary / danger 这种关键 CTA 启用 magnetic hover，其他 variant 保持普通
  const magnetic = variant === "primary" || variant === "danger";
  const ref = useMagneticHover<HTMLButtonElement>();
  return (
    <button
      ref={magnetic ? ref : undefined}
      className={cn(buttonVariants({ variant, size }), magnetic && "will-change-transform", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-border-subtle bg-surface/60 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm text-text shadow-[0_1px_2px_rgba(23,21,31,0.04)] placeholder:text-muted transition-shadow focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-primary/15",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[10px] border border-border bg-surface/80 px-3 py-2 text-sm text-text placeholder:text-muted transition-shadow focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-primary/15",
        className,
      )}
      {...props}
    />
  );
}

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        default: "bg-surface-muted text-muted",
        primary: "bg-primary/12 text-primary",
        success: "bg-success/12 text-success",
        warning: "bg-warning/12 text-warning",
        danger: "bg-danger/12 text-danger",
        ai: "bg-ai/12 text-ai",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative flex h-[110px] flex-col justify-between overflow-hidden rounded-[16px] border border-border-subtle bg-surface/60 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-text-secondary">{label}</span>
        {icon}
      </div>
      <div className="flex items-end gap-1">
        {/* editorial 字体 —— 数字成为视觉焦点 */}
        <span className="font-display text-[28px] font-semibold leading-none tracking-tight text-text">{value}</span>
        {unit && <span className="text-xs text-text-tertiary">{unit}</span>}
      </div>
      {trend && <div className="text-xs text-success">{trend}</div>}
    </motion.div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border bg-surface/50 p-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[10px] bg-gradient-to-r from-surface-muted via-surface-elevated to-surface-muted", className)} />;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  editorial,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** editorial 模式：英文大写小字 + 极简，用于 YOUR LIFE RIGHT NOW / LIFE STATS 等 */
  editorial?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        {editorial ? (
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            {title}
          </h2>
        ) : (
          <h1 className="font-display text-[22px] font-bold tracking-tight text-text">{title}</h1>
        )}
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
