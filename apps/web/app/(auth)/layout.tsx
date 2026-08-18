import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
        {/* ambient glow —— 三个极淡 radial 光晕 */}
        <div className="pointer-events-none absolute -right-32 -top-24 h-96 w-96 rounded-full bg-primary/15 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-info/8 blur-[100px]" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-primary-glow/6 blur-[90px]" />
        {/* noise texture */}
        <div className="noise" />

        <div className="relative z-10 w-full max-w-[420px]">
          {/* Logo 区 —— ✦ CareerOS + YOUR LIFE OS */}
          <div className="mb-10 flex flex-col items-center text-center">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="font-display text-2xl font-bold text-primary-glow">✦</span>
              <span className="font-display text-[22px] font-bold tracking-tight text-text">
                CareerOS
              </span>
            </Link>
            <p className="mt-2 font-display text-[10px] font-medium uppercase tracking-[0.24em] text-text-tertiary">
              YOUR LIFE OS
            </p>
          </div>

          {/* 表单容器 */}
          <div className="relative">{children}</div>

          {/* Footer —— editorial 风格 */}
          <p className="mt-8 text-center font-display text-[11px] italic tracking-wide text-text-tertiary">
            Give yourself a direction, then slowly become that person.
          </p>
        </div>
      </div>
    </AuthGuard>
  );
}
