"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Emoji 分类数据 - 类似微信的表情分类
const EMOJI_CATEGORIES: Record<string, string[]> = {
  smile: [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥳",
    "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖",
    "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯",
    "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔",
    "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦",
    "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴",
  ],
  gesture: [
    "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
    "👈", "👉", "👆", "🖕", "👇", "☝️", "👋", "🤚", "🖐️", "✋",
    "🖖", "👐", "🤲", "🙌", "👏", "🙏", "🫶", "💪", "🦾", "🫵",
    "👀", "🔥", "✨", "💯", "❌", "✅", "⚠️", "❓", "❗", "‼️",
  ],
  heart: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌",
    "💤", "💢", "💣", "💥", "💫", "💦", "💨", "💫", "🌟", "⭐",
    "🎉", "🎊", "🎁", "🏆", "🥇", "🥈", "🥉", "🎖️", "🏅", "🎗️",
  ],
  animal: [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦄", "🐴",
    "🦋", "🐝", "🐛", "🐜", "🐞", "🦗", "🐢", "🐍", "🦖", "🦕",
    "🐙", "🦑", "🦐", "🦞", "🦀", "🐠", "🐟", "🐡", "🦈", "🐬",
  ],
  food: [
    "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈",
    "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦",
    "🥕", "🌽", "🥬", "🥒", "🥗", "🍞", "🥐", "🥖", "🥨", "🥞",
    "🧇", "🧀", "🥚", "🍳", "🧈", "🥞", "🥓", "🍗", "🍖", "🌭",
    "🍔", "🍟", "🍕", "🌮", "🌯", "🥙", "🍣", "🍤", "🍙", "🍱",
  ],
  scene: [
    "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🎱", "🪀",
    "🏓", "🏸", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌",
    "🎮", "🕹️", "🎯", "🎳", "🎲", "♟️", "🎰", "🎼", "🎵", "🎶",
    "🎤", "🎧", "🎷", "🎺", "🥁", "🪘", "🎻", "🪕", "🎹", "🔔",
    "🚗", "🚕", "🚙", "🚌", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚",
  ],
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  smile: { label: "表情", icon: "😊" },
  gesture: { label: "手势", icon: "👍" },
  heart: { label: "爱心", icon: "❤️" },
  animal: { label: "动物", icon: "🐶" },
  food: { label: "食物", icon: "🍎" },
  scene: { label: "其他", icon: "🎮" },
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("smile");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    // 保存最近使用的 emoji
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 20));
  };

  const currentEmojis = activeCategory === "recent"
    ? recentEmojis
    : EMOJI_CATEGORIES[activeCategory] || [];

  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <AnimatePresence>
      <motion.div
        ref={pickerRef}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute bottom-full left-0 mb-2 w-80 h-72 bg-surface-elevated rounded-xl shadow-xl border border-border-subtle overflow-hidden flex flex-col z-50"
      >
        {/* 最近使用 */}
        {recentEmojis.length > 0 && (
          <div className="px-3 pt-2 pb-1 border-b border-border-subtle">
            <p className="text-xs text-muted mb-1">最近使用</p>
            <div className="flex flex-wrap gap-0.5">
              {recentEmojis.slice(0, 10).map((emoji, i) => (
                <button
                  key={`recent-${i}`}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-muted transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Emoji 网格 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-8 gap-0.5">
            {currentEmojis.map((emoji, index) => (
              <button
                key={`${activeCategory}-${index}`}
                onClick={() => handleEmojiSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-muted transition-all hover:scale-125 text-xl"
              >
                {emoji}
              </button>
            ))}
          </div>
          {currentEmojis.length === 0 && recentEmojis.length > 0 && activeCategory === "recent" && (
            <p className="text-center text-muted text-sm py-8">暂无最近使用的表情</p>
          )}
        </div>

        {/* 分类切换 */}
        <div className="flex items-center justify-between border-t border-border-subtle px-2 py-1.5 bg-surface-muted/30">
          <div className="flex gap-1">
            {recentEmojis.length > 0 && (
              <button
                onClick={() => setActiveCategory("recent")}
                className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors ${
                  activeCategory === "recent"
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-surface-muted"
                }`}
                title="最近使用"
              >
                🕐
              </button>
            )}
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-all ${
                  activeCategory === cat
                    ? "bg-primary/20 scale-110"
                    : "hover:bg-surface-muted"
                }`}
                title={CATEGORY_LABELS[cat].label}
              >
                {CATEGORY_LABELS[cat].icon}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-muted transition-colors"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
