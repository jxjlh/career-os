"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}

/**
 * 数字滚动动画: 元素进入视口时从 0 滚动到目标值.
 * 用于排行榜名次、Feed 计数、概览统计等场景.
 */
export function CountUp({
  value,
  duration = 0.8,
  decimals = 0,
  className,
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
