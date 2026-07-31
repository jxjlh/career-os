import { motion } from "framer-motion";

export function YearReviewCover({
  year,
  title,
  summary,
}: {
  year: number;
  title?: string | null;
  summary?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] border border-border bg-gradient-to-br from-ai/15 via-primary/10 to-emerald-400/10 p-6"
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Year Review</p>
      <p className="mt-2 text-3xl font-bold">{year}</p>
      <p className="mt-1 text-lg font-semibold">{title || "我的人生报告"}</p>
      {summary && <p className="mt-3 text-sm leading-relaxed text-text/80">{summary}</p>}
    </motion.div>
  );
}
