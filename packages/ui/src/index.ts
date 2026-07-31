import { cn } from "@career-os/utils";

export const designTokens = {
  colors: {
    background: "var(--background)",
    surface: "var(--surface)",
    border: "var(--border)",
    text: "var(--text)",
    muted: "var(--muted)",
    primary: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    ai: "var(--ai)",
  },
  radius: {
    card: "8px",
    control: "6px",
  },
  spacing: 4,
} as const;

export type ButtonVariant = "default" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";
export type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "ai";

export { cn };
