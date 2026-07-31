"use client";

import { motion, useMotionValue, animate } from "framer-motion";
import { useEffect, useState } from "react";

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration: duration / 1000,
      onUpdate: (latest) => setValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [target, duration]);
  return value;
}

export function LifeProgressCard({
  total,
  completed,
  rate,
}: {
  total: number;
  completed: number;
  rate: number;
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const animated = useCountUp(completed);
  const progress = useMotionValue(0);

  useEffect(() => {
    const controls = animate(progress, rate, { duration: 0.8 });
    return () => controls.stop();
  }, [progress, rate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-[12px] border border-border bg-surface p-4"
    >
      <p className="text-[13px] text-muted">我的人生进度</p>
      <div className="mt-2 flex items-center gap-4">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth="10" />
            <motion.circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: progress }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold">{animated}</p>
            <p className="text-xs text-muted">/ {total}</p>
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold">{rate}%</p>
          <p className="text-[13px] text-muted">完成率</p>
        </div>
      </div>
    </motion.div>
  );
}
