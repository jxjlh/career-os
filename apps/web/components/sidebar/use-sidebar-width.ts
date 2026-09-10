"use client";

import { useEffect, useState } from "react";

export type SidebarWidth = {
  width: number;
  contentPadding: number;
  isCompact: boolean;
  visible: boolean;
  onEnter: () => void;
  onLeave: () => void;
  toggleCompact: () => void;
};

const EXPANDED_WIDTH = 240;
const COMPACT_WIDTH = 64;
const STORAGE_KEY = "career_os_sidebar_compact";

export function useSidebarWidth(): SidebarWidth {
  const [isDesktop, setIsDesktop] = useState(true);
  const [isTablet, setIsTablet] = useState(false);
  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setUserPrefersCompact(saved === "1");
    } catch {}
  }, []);

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
  const baseCompact = isTablet || (isDesktop && userPrefersCompact);
  const isCompact = baseCompact && !hovering;
  const width = isCompact ? COMPACT_WIDTH : EXPANDED_WIDTH;
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
      } catch {}
    },
  };
}
