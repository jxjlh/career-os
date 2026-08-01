"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@career-os/utils";

export { cn };

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-[#7a5cd6] text-white shadow-[0_10px_24px_-10px_rgba(91,91,214,0.75)] hover:brightness-105 hover:shadow-[0_14px_30px_-10px_rgba(91,91,214,0.85)] active:scale-[0.98]",
        outline:
          "border border-border bg-surface/80 text-text shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-primary/35 hover:bg-surface hover:shadow-[0_8px_20px_-12px_rgba(91,91,214,0.5)]",
        ghost: "text-muted hover:bg-primary/8 hover:text-primary",
        danger: "bg-gradient-to-r from-danger to-[#f0676c] text-white shadow-[0_10px_24px_-12px_rgba(229,72,77,0.7)] hover:brightness-105 active:scale-[0.98]",
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
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-border/80 bg-surface/70 shadow-[0_1px_2px_rgba(23,21,31,0.04)] backdrop-blur-sm",
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
        ai: "bg-gradient-to-r from-ai/14 to-accent/14 text-ai",
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
      className="relative flex h-[110px] flex-col justify-between overflow-hidden rounded-[14px] border border-border/80 bg-surface/70 p-4 shadow-[0_1px_2px_rgba(23,21,31,0.04)] backdrop-blur-sm"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gradient-to-br from-primary/14 to-accent/12 blur-xl" />
      <div className="flex items-center justify-between">
        <span className="relative text-[13px] font-medium text-muted">{label}</span>
        {icon}
      </div>
      <div className="relative flex items-end gap-1">
        <span className="text-[26px] font-bold leading-none tracking-tight">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
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
  return <div className={cn("animate-pulse rounded-[10px] bg-gradient-to-r from-surface-muted via-primary/6 to-surface-muted", className)} />;
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
