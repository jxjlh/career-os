"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 数字滚动动画 (easeOutCubic). 仅依赖 requestAnimationFrame, 无外部依赖.
 * 用于年度报告的统计数字、Hero 副标题数字等需要 Count Up 效果的场景.
 */
export function CountUp({
  value,
  duration = 900,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
