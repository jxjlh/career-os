/**
 * 座右铭 / 人生格言 的富文本模型与存取。
 *
 * 设计要点：
 * - 文案按「片段（seg）」存：每段可以带自己的字体颜色 / 字号，没带就继承默认（白字 24px）。
 *   这样才能做到「选中某几个字单独调颜色、字号」，而不是整句一起变。
 * - 首页「我的座右铭」和「人生目标」页的「人生格言」共用同一份数据 + 同一个组件，改一处两边都一样。
 * - **云端为准**：`GET/PUT /profile/motto` 存 `{segs, image}`；背景图由后端落到对象存储后
 *   只回传公开 URL。localStorage 只当「首屏秒出 + 断网兜底」的本地缓存。
 *   两处一起用（localStorage key 相同），换设备靠云端。
 */

import { apiFetch } from "@/lib/api";

export interface MottoSeg {
  /** 文本片段，可含 \n 换行 */
  t: string;
  /** 该段字体颜色（#RRGGBB 或 rgb(...)） */
  c?: string;
  /** 该段字号（px） */
  s?: number;
}

export interface MottoContent {
  segs: MottoSeg[];
  image: string | null;
}

/** 当前版本存储 key（首页 + 人生目标页共用） */
export const MOTTO_STORAGE_KEY = "career_os_motto_v2";
/** 旧版本存储 key（整句一个颜色 / 一个字号），首次读取时自动迁移 */
export const MOTTO_LEGACY_KEY = "career_os_motto";

/** 后端 profile.lifeMotto 的字段上限 */
export const MOTTO_MAX_LEN = 300;

export const DEFAULT_MOTTO = "持续成长，每一天都在遇见更好的自己";
export const MOTTO_DEFAULT_COLOR = "#FFFFFF";
export const MOTTO_DEFAULT_SIZE = 24;

export const MOTTO_COLORS = ["#FFFFFF", "#1A1A1A", "#5B9DFF", "#C49A5C", "#F5F8FF"];
export const MOTTO_SIZES = [
  { label: "小", value: 18 },
  { label: "中", value: 24 },
  { label: "大", value: 32 },
];

export function segsToPlain(segs: MottoSeg[]): string {
  return segs.map((seg) => seg.t).join("");
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** rgb(255, 255, 255) / rgba(...) → #FFFFFF，方便和色板做等值比较 */
export function toHexColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.toUpperCase();
  const m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return v;
  const parts = m[1].split(",").map((p) => Number.parseFloat(p.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return v;
  const hex = parts
    .slice(0, 3)
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
}

/** segs → 可直接塞进 dangerouslySetInnerHTML 的 HTML（文本已转义，只带我们允许的两种行内样式） */
export function segsToHtml(segs: MottoSeg[]): string {
  return segs
    .map((seg) => {
      const text = escapeHtml(seg.t).replace(/\n/g, "<br/>");
      if (!text) return "";
      const styles: string[] = [];
      if (seg.c) styles.push(`color:${seg.c}`);
      if (seg.s) styles.push(`font-size:${seg.s}px`);
      return styles.length ? `<span style="${styles.join(";")}">${text}</span>` : text;
    })
    .join("");
}

/** 合并相邻同样式片段、丢掉空片段 */
export function normalizeSegs(segs: MottoSeg[]): MottoSeg[] {
  const out: MottoSeg[] = [];
  for (const seg of segs) {
    if (!seg || typeof seg.t !== "string" || seg.t === "") continue;
    const color = seg.c ? toHexColor(seg.c) : undefined;
    const size = typeof seg.s === "number" && Number.isFinite(seg.s) ? seg.s : undefined;
    const last = out[out.length - 1];
    if (last && last.c === color && last.s === size) {
      last.t += seg.t;
    } else {
      out.push({ t: seg.t, c: color, s: size });
    }
  }
  return out;
}

export function plainTextToSegs(text: string): MottoSeg[] {
  return text ? [{ t: text }] : [];
}

/** 把 contentEditable 里的 DOM 拍平成 segs（样式取最近一层行内 style） */
export function domToSegs(root: HTMLElement): MottoSeg[] {
  const out: MottoSeg[] = [];

  const push = (text: string, c?: string, s?: number) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.c === c && last.s === s) {
      last.t += text;
    } else {
      out.push({ t: text, c, s });
    }
  };

  const walk = (node: Node, c?: string, s?: number) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        push(child.textContent ?? "", c, s);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (tag === "BR") {
        push("\n", c, s);
        return;
      }
      // 块级元素（回车换行产生的 div / p）之间补一个换行，但不要在开头补
      if ((tag === "DIV" || tag === "P") && out.length > 0 && !segsToPlain(out).endsWith("\n")) {
        push("\n", c, s);
      }
      const styled = el.getAttribute("style") ?? "";
      const color = /(^|;)\s*color\s*:/.test(styled) ? toHexColor(el.style.color) || c : c;
      const fontSize = /(^|;)\s*font-size\s*:/.test(styled)
        ? Number.parseInt(el.style.fontSize, 10) || s
        : s;
      walk(el, color, fontSize);
    });
  };

  walk(root, undefined, undefined);
  // 去掉首尾空行
  const segs = normalizeSegs(out);
  if (segs.length > 0) {
    segs[0].t = segs[0].t.replace(/^\n+/, "");
    const lastSeg = segs[segs.length - 1];
    lastSeg.t = lastSeg.t.replace(/\n+$/, "");
  }
  return segs.filter((seg) => seg.t !== "");
}

export function readMottoLocal(): MottoContent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOTTO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MottoContent & { segs?: MottoSeg[] };
      if (Array.isArray(parsed?.segs)) {
        return {
          segs: normalizeSegs(parsed.segs),
          image: typeof parsed.image === "string" ? parsed.image : null,
        };
      }
    }
    // 迁移旧版：整句一个颜色 + 一个字号
    const legacy = window.localStorage.getItem(MOTTO_LEGACY_KEY);
    if (legacy) {
      const d = JSON.parse(legacy) as { text?: string; image?: string | null; color?: string; fontSize?: number };
      const seg: MottoSeg = { t: typeof d?.text === "string" && d.text.trim() ? d.text : DEFAULT_MOTTO };
      if (typeof d?.color === "string") seg.c = toHexColor(d.color);
      if (typeof d?.fontSize === "number") seg.s = d.fontSize;
      return { segs: normalizeSegs([seg]), image: typeof d?.image === "string" ? d.image : null };
    }
  } catch {
    // 读不出来就当没存过
  }
  return null;
}

export interface MottoStyleResponse {
  segs: MottoSeg[];
  image: string | null;
  updatedAt?: string | null;
}

function toStyleResponse(res: MottoStyleResponse | null | undefined): MottoStyleResponse {
  return {
    segs: normalizeSegs(res?.segs ?? []),
    image: res?.image ?? null,
    updatedAt: res?.updatedAt ?? null,
  };
}

/** 读云端样式（后端在没有样式记录时会用 life_motto 纯文本兜底成单片段） */
export async function fetchMottoStyle(): Promise<MottoStyleResponse> {
  return toStyleResponse(await apiFetch<MottoStyleResponse>("/profile/motto"));
}

/** 写云端样式：image 传 data URL 时后端会先上传到对象存储，返回公开 URL */
export async function putMottoStyle(content: MottoContent): Promise<MottoStyleResponse> {
  const res = await apiFetch<MottoStyleResponse>("/profile/motto", {
    method: "PUT",
    body: JSON.stringify({ segs: content.segs, image: content.image }),
  });
  return toStyleResponse(res);
}

/** 写本地；返回 false 表示超容量（一般是背景图太大） */
export function writeMottoLocal(content: MottoContent): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      MOTTO_STORAGE_KEY,
      JSON.stringify({ segs: content.segs, image: content.image }),
    );
    return true;
  } catch {
    return false;
  }
}
