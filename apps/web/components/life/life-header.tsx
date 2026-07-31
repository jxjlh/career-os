"use client";

import { motion } from "framer-motion";

export function LifeHeader({
  nickname,
  avatar,
  level,
}: {
  nickname: string;
  avatar?: string | null;
  level: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-[12px] border border-border bg-surface p-4"
    >
      {avatar ? (
        <img src={avatar} alt={nickname} className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
          {nickname.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{nickname || "我的人生"}</p>
        <p className="text-[13px] text-muted">Lv.{level} 探索者</p>
      </div>
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">LifeOS</span>
    </motion.div>
  );
}
