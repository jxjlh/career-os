import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link href="/dashboard" className="mb-6 flex items-center justify-center gap-2">
          <img src="/icons/career-os-appicon.png" alt="Career OS" className="h-10 w-10 rounded-[8px]" />
          <span className="text-lg font-bold">Career OS</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
