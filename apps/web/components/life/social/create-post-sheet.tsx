"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Link as LinkIcon, Lock, Send, Users, X } from "lucide-react";
import { useState } from "react";

import { Button, Textarea } from "@/components/life/social/ui-extras";
import { Chip, cn } from "@/components/life/social/ui-extras";
import { createPost, type PostVisibility } from "@/lib/social";

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  /** 预填内容, 来自分享入口 */
  initialContent?: string;
  /** 关联记录 ID */
  lifeRecordId?: string | null;
  bucketItemId?: string | null;
}

const VISIBILITY_OPTIONS: Array<{
  value: PostVisibility;
  label: string;
  icon: typeof Globe;
}> = [
  { value: "public", label: "公开", icon: Globe },
  { value: "friends", label: "好友可见", icon: Users },
  { value: "private", label: "仅自己", icon: Lock },
  { value: "link", label: "链接分享", icon: LinkIcon },
];

/**
 * 发布动态抽屉: 输入文字 + 选择可见性, 可关联记录/清单.
 * 发布成功后刷新 Feed.
 */
export function CreatePostSheet({
  open,
  onClose,
  initialContent = "",
  lifeRecordId,
  bucketItemId,
}: CreatePostSheetProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const [visibility, setVisibility] = useState<PostVisibility>("friends");

  const create = useMutation({
    mutationFn: () =>
      createPost({
        content: content.trim() || null,
        visibility,
        lifeRecordId: lifeRecordId ?? null,
        bucketItemId: bucketItemId ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-overview"] });
      setContent("");
      setVisibility("friends");
      onClose();
    },
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[20px] border border-border bg-surface p-5 shadow-xl sm:rounded-[16px]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">发布动态</h3>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="分享此刻的成长、感悟或一个里程碑…"
              rows={5}
              autoFocus
            />

            <div className="mt-3">
              <p className="mb-2 text-xs text-muted">谁可以看</p>
              <div className="flex flex-wrap gap-2">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = visibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface text-muted hover:border-primary/40",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Chip className="bg-surface-muted text-muted">
                {content.length} 字
              </Chip>
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !content.trim()}
              >
                <Send className="h-4 w-4" />
                发布
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
