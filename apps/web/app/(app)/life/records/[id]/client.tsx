"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { LifeRecordDetail } from "@/components/life/life-record-detail";
import { Button, Skeleton } from "@/components/ui";
import { getLifeRecordDetail } from "@/lib/life";

export default function LifeRecordDetailPage() {
  const params = useParams<{ id: string }>();
  const record = useQuery({
    queryKey: ["life-record", params.id],
    queryFn: () => getLifeRecordDetail(params.id),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/life/records" className="mb-4 inline-flex">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      {record.isLoading && <Skeleton className="h-96" />}
      {record.isError && (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-muted">记录不存在或已删除</p>
          <Button onClick={() => record.refetch()}>
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </div>
      )}
      {record.data && <LifeRecordDetail record={record.data} />}
    </div>
  );
}
