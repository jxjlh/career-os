"use client";

import { motion } from "framer-motion";

import type { BucketCategory } from "@/lib/bucket";
import { cn } from "@career-os/utils";

export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: BucketCategory[];
  activeId?: string;
  onSelect: (id: string | undefined) => void;
}) {
  const items = [
    { id: undefined, name: "全部", icon: "✨", itemCount: categories.reduce((s, c) => s + c.itemCount, 0) },
    ...categories,
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((cat) => {
        const active = (cat.id ?? "") === (activeId ?? "");
        return (
          <motion.button
            key={cat.id ?? "all"}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text hover:border-primary/40",
            )}
          >
            <span className="text-[13px]">{cat.icon ?? "·"}</span>
            <span>{cat.name}</span>
            <span className={cn("text-[10px]", active ? "text-white/70" : "text-muted")}>
              {cat.itemCount}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
