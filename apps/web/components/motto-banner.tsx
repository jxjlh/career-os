"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Pencil, RotateCcw, TextSelect } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { Button, cn } from "@/components/ui";
import {
  DEFAULT_MOTTO,
  MOTTO_COLORS,
  MOTTO_DEFAULT_COLOR,
  MOTTO_DEFAULT_SIZE,
  MOTTO_MAX_LEN,
  MOTTO_SIZES,
  domToSegs,
  escapeHtml,
  fetchMottoStyle,
  normalizeSegs,
  plainTextToSegs,
  putMottoStyle,
  readMottoLocal,
  segsToHtml,
  segsToPlain,
  writeMottoLocal,
  type MottoSeg,
} from "@/lib/motto";

/**
 * 座右铭 / 人生格言 Banner（首页 + 人生目标页共用同一个组件、同一份云端数据）。
 *
 * 编辑方式：点铅笔进入编辑 → 用鼠标/手指**选中一部分文字** → 点颜色或字号，
 * 样式只作用于选中的那几个字。想整句一起改就先点「全选文字」。
 *
 * 同步：本地缓存负责首屏秒出与断网兜底，云端（/profile/motto）负责跨设备。
 */
export function MottoBanner({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [segs, setSegs] = useState<MottoSeg[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const editingRef = useRef(false);

  // 本地缓存先出字（不等网络）
  useEffect(() => {
    const local = readMottoLocal();
    if (local && (segsToPlain(local.segs).trim() || local.image)) {
      setSegs(local.segs);
      setImage(local.image);
    }
    setHydrated(true);
  }, []);

  const remote = useQuery({
    queryKey: ["motto-style"],
    queryFn: fetchMottoStyle,
    staleTime: 30_000,
  });

  // 云端有内容就以云端为准 —— 这是换设备能看到同样样式的关键
  useEffect(() => {
    const data = remote.data;
    if (!data) return;
    if (!segsToPlain(data.segs).trim() && !data.image) return;
    if (editingRef.current) return; // 正在编辑就别冲掉用户手上的改动
    setSegs(data.segs);
    setImage(data.image);
    writeMottoLocal({ segs: data.segs, image: data.image });
  }, [remote.data]);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const plain = segsToPlain(segs);
  const isEmpty = !plain.trim();
  const html = useMemo(
    () => segsToHtml(isEmpty ? plainTextToSegs(DEFAULT_MOTTO) : segs),
    [segs, isEmpty],
  );

  /** 进入编辑模式时把当前内容写进 contentEditable，并记住这次编辑会话 */
  const startEdit = () => {
    savedRangeRef.current = null;
    setEditing(true);
  };

  const persist = (nextSegs: MottoSeg[], nextImage: string | null) => {
    const clean = normalizeSegs(nextSegs);
    const text = segsToPlain(clean).trim();
    if (!text) {
      alert("座右铭不能为空");
      return false;
    }
    if (text.length > MOTTO_MAX_LEN) {
      alert(`最多 ${MOTTO_MAX_LEN} 个字（当前 ${text.length} 个）`);
      return false;
    }
    // 先落本地：断网也不丢，且首屏秒出
    writeMottoLocal({ segs: clean, image: nextImage });
    setSegs(clean);
    setImage(nextImage);
    return true;
  };

  /** 存云端（跨设备同步）。背景图若是新选的 data URL，后端会先上传再回传公开 URL。 */
  const syncRemote = async (nextSegs: MottoSeg[], nextImage: string | null) => {
    try {
      const saved = await putMottoStyle({ segs: nextSegs, image: nextImage });
      setSegs(saved.segs);
      setImage(saved.image);
      writeMottoLocal({ segs: saved.segs, image: saved.image });
      queryClient.setQueryData(["motto-style"], saved);
      queryClient.invalidateQueries({ queryKey: ["life-profile"] });
      return true;
    } catch (error) {
      alert(
        `已保存在本机，但同步到云端失败：${error instanceof Error ? error.message : "未知错误"}\n` +
          "（换设备暂时看不到这次修改，可稍后重新保存一次）",
      );
      return false;
    }
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // blob URL 直读 + canvas 压缩（最长边 1280、JPEG 0.8），比 base64 FileReader 快数倍
    const blobUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const MAX_W = 1280;
      const scale = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      let out: string;
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        out = canvas.toDataURL("image/jpeg", 0.8);
      } else {
        out = blobUrl;
      }
      URL.revokeObjectURL(blobUrl);
      if (out.length > 3 * 1024 * 1024) {
        alert("背景图太大了（压缩后仍超 3MB），请换一张较小的图片。");
        return;
      }
      // 只更新预览，等点「保存」再上传/写库
      setImage(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      alert("图片读取失败，请换一张试试");
    };
    img.src = blobUrl;
  };

  const removeImage = () => setImage(null);

  // 编辑期间记住最后一次有效选区：手机上点工具栏按钮会失焦，选区会被清掉
  useEffect(() => {
    if (!editing) return;
    const remember = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, [editing]);

  /** 取当前选区；选区被清掉时回退到记住的选区 */
  const activeRange = (): Range | null => {
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!editor) return null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && editor.contains(range.commonAncestorContainer)) return range;
    }
    const saved = savedRangeRef.current;
    if (saved && editor.contains(saved.commonAncestorContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(saved);
      return saved;
    }
    return null;
  };

  const restoreSelection = (range: Range | null) => {
    const sel = window.getSelection();
    if (!sel || !range) return;
    sel.removeAllRanges();
    sel.addRange(range);
  };

  /** 把颜色 / 字号套到「选中的那几个字」上 */
  const applyStyle = (patch: { c?: string; s?: number }) => {
    const range = activeRange();
    if (!range) {
      alert("先用手指（或鼠标）选中要调整的文字，再点颜色 / 字号。\n想整句一起改，先点「全选文字」。");
      return;
    }
    const span = document.createElement("span");
    if (patch.c) span.style.color = patch.c;
    if (patch.s) span.style.fontSize = `${patch.s}px`;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    } catch {
      alert("这段选择横跨了多段文字，缩小范围再试一次。");
      return;
    }
    // 重新选中刚包好的内容，方便连续调整
    const next = document.createRange();
    next.selectNodeContents(span);
    restoreSelection(next);
    savedRangeRef.current = next.cloneRange();
  };

  const selectAll = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    restoreSelection(range);
    savedRangeRef.current = range.cloneRange();
    editor.focus();
  };

  /** 清掉全部局部样式，回到默认白字中等字号 */
  const resetStyle = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = segsToPlain(domToSegs(editor));
    editor.innerHTML = escapeHtml(text).replace(/\n/g, "<br/>");
    savedRangeRef.current = null;
  };

  const cancelEdit = () => {
    savedRangeRef.current = null;
    setEditing(false);
  };

  const commitEdit = async () => {
    const editor = editorRef.current;
    const nextSegs = editor ? domToSegs(editor) : segs;
    if (!persist(nextSegs, image)) return;
    savedRangeRef.current = null;
    setSaving(true);
    await syncRemote(nextSegs, image);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border-subtle shadow-sm", className)}>
      {/* 背景图 / 默认渐变 */}
      {image ? (
        <img src={image} alt="座右铭背景" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#5B9DFF] via-[#3D7EDB] to-[#1E3A5F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

      <div className="relative flex min-h-[224px] flex-col justify-end p-6 pb-8 sm:min-h-[240px]">
        {editing ? (
          <MottoEditor html={html} editorRef={editorRef} placeholder="写下你的座右铭" />
        ) : (
          <p
            className={cn(
              "font-display font-bold leading-snug tracking-tight drop-shadow-sm",
              isEmpty && "opacity-60",
            )}
            style={{ color: MOTTO_DEFAULT_COLOR, fontSize: MOTTO_DEFAULT_SIZE }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>

      {/* 编辑按钮 */}
      {!editing && (
        <button
          onClick={startEdit}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
          aria-label="编辑座右铭"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {/* 编辑面板 */}
      {editing && (
        // 面板走正常文档流（不是绝对定位），这样展开时 banner 自己变高，
        // 不会把正在编辑的正文盖住
        <div className="relative z-10 space-y-2.5 border-t border-white/15 bg-black/65 p-4 backdrop-blur-xl">
          <p className="text-[11px] text-white/60">
            选中一部分文字，再点颜色 / 字号，只改这几个字；保存后自动同步到其它设备
          </p>

          {/* 字体颜色 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-8 shrink-0 text-[12px] text-white/70">颜色</span>
            {MOTTO_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyStyle({ c })}
                className="h-7 w-7 rounded-full border-2 border-transparent transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: "0 0 0 1px rgba(255,255,255,0.35)" }}
                aria-label={`颜色 ${c}`}
              />
            ))}
            <input
              type="color"
              defaultValue={MOTTO_DEFAULT_COLOR}
              onChange={(e) => applyStyle({ c: e.target.value })}
              className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
              aria-label="自定义颜色"
            />
          </div>

          {/* 字体大小 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-8 shrink-0 text-[12px] text-white/70">字号</span>
            {MOTTO_SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyStyle({ s: s.value })}
                className="rounded-md bg-white/10 px-3 py-1 text-[12px] text-white/80 transition-colors hover:bg-white/20"
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectAll}
              className="ml-1 flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[12px] text-white/80 transition-colors hover:bg-white/20"
            >
              <TextSelect className="h-3.5 w-3.5" />
              全选文字
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={resetStyle}
              className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[12px] text-white/80 transition-colors hover:bg-white/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置样式
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-white/80 hover:text-white">
              <ImageIcon className="h-4 w-4" />
              更换背景图
              <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
            </label>
            <div className="flex items-center gap-3">
              {image && (
                <button type="button" onClick={removeImage} className="text-[12px] text-white/70 hover:text-white">
                  移除背景
                </button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
                disabled={saving}
                className="text-white/80 hover:bg-white/15 hover:text-white"
              >
                取消
              </Button>
              <Button size="sm" variant="primary" onClick={commitEdit} disabled={saving}>
                {saving ? "同步中…" : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 编辑态正文。用 memo + 只在挂载时注入一次 HTML，
 * 避免上层因为工具栏状态变化而重渲染、把用户正在编辑的内容冲掉。
 */
const MottoEditor = memo(function MottoEditor({
  html,
  editorRef,
  placeholder,
}: {
  html: string;
  editorRef: React.RefObject<HTMLDivElement | null>;
  placeholder: string;
}) {
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={placeholder}
      onPaste={onPaste}
      className="font-display font-bold leading-snug tracking-tight drop-shadow-sm outline-none"
      style={{ color: MOTTO_DEFAULT_COLOR, fontSize: MOTTO_DEFAULT_SIZE }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
