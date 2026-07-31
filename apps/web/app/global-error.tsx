"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <h1 className="text-2xl font-bold">500</h1>
        <p className="text-sm text-muted">服务器出现异常。</p>
        <button
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-white"
          onClick={() => reset()}
        >
          重试
        </button>
      </body>
    </html>
  );
}
