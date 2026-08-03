"use client";

import { useEffect, useState } from "react";

export type SidebarMode = "expanded" | "compact" | "hovering";

export type SidebarWidth = {
  /** 当前展示宽度（px）—— sidebar 自身宽度，hover 时会展开 */
  width: number;
  /** main 内容区的 padding-left（px）—— 不随 hover 变化，hover 时 sidebar overlay */
  contentPadding: number;
  /** 是否处于折叠态（只显 icon） */
  isCompact: boolean;
  /** 是否应该渲染 sidebar（mobile 不渲染） */
  visible: boolean;
  /** 鼠标进入 sidebar 区域 */
  onEnter: () => void;
  /** 鼠标离开 sidebar 区域 */
  onLeave: () => void;
  /** 手动切换偏好（desktop） */
  toggleCompact: () => void;
};

const EXPANDED_WIDTH = 224;
const COMPACT_WIDTH = 64;
const STORAGE_KEY = "career_os_sidebar_compact";

/**
 * Sidebar 宽度状态机：
 *  - desktop (>=1024px)：默认 expanded，hover 临时展开，偏好持久化
 *  - tablet (768-1024px)：永久 compact + hover 展开
 *  - mobile (<768px)：不渲染，用 BottomNav
 *
 * 用 React state 而非纯 CSS hover —— 避免快速移动抖动 + 支持持久化。
 */
export function useSidebarWidth(): SidebarWidth {
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTablet, setIsTablet] = useState(false);
  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [hovering, setHovering] = useState(false);

  // 初始读取持久化偏好
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setUserPrefersCompact(saved === "1");
    } catch {
      // ignore
    }
  }, []);

  // 监听断点
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsDesktop(w >= 1024);
      setIsTablet(w >= 768 && w < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visible = isDesktop || isTablet;

  // tablet：永久 compact，hover 展开
  // desktop：偏好 compact，hover 展开；偏好 expanded 永远 expanded
  const baseCompact = isTablet || (isDesktop && userPrefersCompact);
  const isCompact = baseCompact && !hovering;

  const width = isCompact ? COMPACT_WIDTH : EXPANDED_WIDTH;
  // main 内容区的 padding-left —— 基于 base（非 hover），hover 时 sidebar overlay
  // expanded 偏好：224；compact 偏好 / tablet：64；mobile：0
  const contentPadding = !visible ? 0 : baseCompact ? COMPACT_WIDTH : EXPANDED_WIDTH;

  return {
    width,
    contentPadding,
    isCompact,
    visible,
    onEnter: () => setHovering(true),
    onLeave: () => setHovering(false),
    toggleCompact: () => {
      const next = !userPrefersCompact;
      setUserPrefersCompact(next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
    },
  };
}
