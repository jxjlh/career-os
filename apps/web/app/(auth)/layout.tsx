import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="grid-fade pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#5b5bd6]/18 blur-[110px]" />
      <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-[#d45f9b]/16 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#18b6b2]/14 blur-[100px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1040px] items-center justify-center px-4 py-10 sm:px-8">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="hidden lg:block">
            <div className="mb-8 flex items-center gap-3">
              <BrandMark className="h-12 w-12" />
              <span className="text-2xl font-bold tracking-tight">
                Career<span className="text-gradient">OS</span>
              </span>
            </div>
            <h1 className="max-w-md text-[44px] font-bold leading-[1.08] tracking-tight">
              把每一次成长，
              <br />
              变成<span className="text-gradient">可见的轨迹</span>
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
              AI 驱动的职业成长操作系统：目标、学习、作品、面试与人生复盘，全部沉淀在一个随时可打开的个人系统里。
            </p>
            <div className="mt-8 flex gap-2">
              {["Learn", "Practice", "Build", "Interview", "Job"].map((item, i) => (
                <span
                  key={item}
                  className="rounded-full border border-border/70 bg-surface/60 px-3 py-1.5 text-[11px] font-semibold text-muted backdrop-blur"
                >
                  {i + 1} · {item}
                </span>
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <BrandMark className="h-10 w-10" />
              <span className="text-lg font-bold tracking-tight">
                Career<span className="text-gradient">OS</span>
              </span>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
