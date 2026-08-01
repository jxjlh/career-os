export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-gradient-to-br from-[#5b5bd6] via-[#7a5cd6] to-[#d45f9b] shadow-[0_10px_24px_-10px_rgba(91,91,214,0.8)] ${className ?? ""}`}
    >
      <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_30%_0%,rgba(255,255,255,0.55),transparent_55%)]" />
      <svg viewBox="0 0 48 48" className="relative h-[62%] w-[62%]" aria-hidden="true">
        <defs>
          <linearGradient id="brand-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3e8ff" />
          </linearGradient>
        </defs>
        <path
          d="M24 6 40 15v18L24 42 8 33V15L24 6Z"
          fill="none"
          stroke="url(#brand-stroke)"
          strokeWidth="3.4"
          strokeLinejoin="round"
        />
        <path
          d="M24 15 32.5 20v10L24 35 15.5 30V20L24 15Z"
          fill="rgba(255,255,255,0.92)"
        />
        <circle cx="24" cy="25" r="3.4" fill="#7a5cd6" />
      </svg>
    </span>
  );
}
