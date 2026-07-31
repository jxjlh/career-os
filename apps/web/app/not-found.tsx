import Link from "next/link";

import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-sm text-muted">页面不存在或已被移动。</p>
      <Link href="/dashboard">
        <Button>返回首页</Button>
      </Link>
    </div>
  );
}
