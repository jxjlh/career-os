"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { joinBucketItem } from "@/lib/bucket";
import { Button } from "@/components/ui";

/**
 * 加入人生目标按钮.
 * 成功后弹出 inline toast: "已加入人生目标" + "立即查看" 跳转 LifeGoal.
 */
export function JoinButton({
  itemId,
  joined,
  lifeGoalId,
  size = "md",
  variant = "default",
}: {
  itemId: string;
  joined: boolean;
  lifeGoalId?: string | null;
  size?: "sm" | "md";
  variant?: "default" | "outline";
}) {
  const qc = useQueryClient();
  const [justJoined, setJustJoined] = useState<{ lifeGoalId: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () => joinBucketItem(itemId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bucket-items"] });
      qc.invalidateQueries({ queryKey: ["bucket-item", itemId] });
      qc.invalidateQueries({ queryKey: ["bucket-progress"] });
      qc.invalidateQueries({ queryKey: ["life-dashboard"] });
      setJustJoined({ lifeGoalId: data.lifeGoalId });
      // 3.5s 后自动收起 inline toast
      setTimeout(() => setJustJoined(null), 3500);
    },
  });

  if (joined) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size={size} disabled className="gap-1.5">
          <Check className="h-4 w-4" />
          已加入
        </Button>
        {lifeGoalId && (
          <Link href={`/life/goals/${lifeGoalId}`}>
            <Button variant="ghost" size={size}>
              查看目标
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="gap-1.5"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        加入人生目标
      </Button>

      <AnimatePresence>
        {justJoined && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full z-20 mt-2 flex items-center gap-3 rounded-[12px] border border-success/30 bg-surface p-3 pr-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium">已加入人生目标</p>
              <p className="text-[11px] text-muted">已为你创建对应的人生目标与任务</p>
            </div>
            <Link href={`/life/goals/${justJoined.lifeGoalId}`}>
              <Button size="sm" variant="outline">
                立即查看
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {mutation.isError && (
        <p className="absolute right-0 top-full mt-1 text-[11px] text-danger">
          {(mutation.error as Error)?.message ?? "加入失败"}
        </p>
      )}
    </div>
  );
}
