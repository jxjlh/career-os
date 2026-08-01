export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/career-os-mark.png" alt="Career OS" draggable={false} className="h-full w-full object-contain" />
    </span>
  );
}
