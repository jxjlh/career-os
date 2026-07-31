import Link from "next/link";

import { Button, Card } from "@/components/ui";

export default function LifeAiPlaceholderPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl">🤖</span>
        <h1 className="text-lg font-semibold">AI 人生助手</h1>
        <p className="max-w-sm text-[13px] text-muted">
          AI 人生规划、旅行攻略与年度总结正在开发中，即将上线。
        </p>
        <Link href="/life">
          <Button variant="outline">返回人生主页</Button>
        </Link>
      </Card>
    </div>
  );
}
