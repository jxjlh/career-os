"use client";

import { Clock, FileImage, RotateCw, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import {
  FINANCE_IMPORT_MAX_FILE_BYTES,
  FINANCE_IMPORT_MAX_FILES,
  validateScreenshotImportFiles,
} from "@/lib/finance-import-form";
import { financeApi, type FinanceAccount, type FinanceImport, type FinanceImportRow, type FinanceScreenshotImportBatch } from "@/lib/finance";

type PendingEntry = { file: File; financeImport: FinanceImport; rows: FinanceImportRow[] };

type ImportHoldingsDialogProps = {
  open: boolean;
  accounts: FinanceAccount[];
  onClose: () => void;
  onUpload: (files: File[]) => Promise<FinanceScreenshotImportBatch>;
  onConfirm: (financeImport: FinanceImport, rows: FinanceImportRow[]) => Promise<void>;
  onDiscard: (financeImport: FinanceImport) => Promise<void>;
  isUploading?: boolean;
  isSaving?: boolean;
  error?: string | null;
};

function rowsForReview(financeImport: FinanceImport, accounts: FinanceAccount[]): FinanceImportRow[] {
  return financeImport.rows.map((row) => ({
    ...row,
    accountId: row.accountId || accounts[0]?.id || null,
    occurredOn: row.occurredOn || new Date().toISOString().slice(0, 10),
  }));
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  OCR_TIMEOUT: "OCR 识别超时（视觉模型推理较慢），请稍后再试或改用手动记账。",
  OCR_EXTRACTION_FAILED: "OCR 识别失败，请稍后重试或改用手动记账。",
  OCR_NOT_CONFIGURED: "识别服务尚未配置，请改用手动记账。",
  OCR_NO_HOLDINGS_FOUND: "未识别到可确认的持仓，请使用更清晰的截图。",
  INVALID_IMPORT_IMAGE: "仅支持 PNG、JPEG 或 WebP 格式的截图。",
  IMPORT_IMAGE_TOO_LARGE: "单张截图不能超过 10 MB。",
  IMPORT_BATCH_TOO_LARGE: "一次最多上传 9 张。",
};

export function ImportHoldingsDialog({
  open,
  accounts,
  onClose,
  onUpload,
  onConfirm,
  onDiscard,
  isUploading,
  isSaving,
  error,
}: ImportHoldingsDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  // 所有上传后需要处理的条目：processing / review / failed 混合排队
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [uploadFailures, setUploadFailures] = useState<{ filename: string; code: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // 清理轮询
  const clearPoll = useCallback((importId: string) => {
    if (pollTimers.current[importId]) {
      clearInterval(pollTimers.current[importId]);
      delete pollTimers.current[importId];
    }
  }, []);

  const clearAllPolls = useCallback(() => {
    Object.keys(pollTimers.current).forEach(clearPoll);
  }, [clearPoll]);

  useEffect(() => {
    if (!open) {
      setSelectedFiles([]);
      setPending([]);
      setActiveIndex(0);
      setUploadFailures([]);
      setLocalError(null);
      clearAllPolls();
    }
    return () => clearAllPolls();
  }, [open, clearAllPolls]);

  // 轮询单条 import 状态直到完成或失败
  const startPolling = useCallback((entry: PendingEntry) => {
    const id = entry.financeImport.id;
    clearPoll(id);
    pollTimers.current[id] = setInterval(async () => {
      try {
        const { data: updated } = await financeApi.getImport(id);
        if (!updated) return;
        setPending((current) => {
          const next = current.map((p) => {
            if (p.financeImport.id !== id) return p;
            return { ...p, financeImport: updated, rows: updated.status === "review" ? rowsForReview(updated, accounts) : p.rows };
          });
          return next;
        });
        if (["review", "confirmed", "discarded", "failed"].includes(updated.status)) {
          clearPoll(id);
        }
      } catch {
        // 网络错误静默，下一轮重试
      }
    }, 2500);
  }, [accounts, clearPoll]);

  const fileQueuesByName = useCallback((files: File[]) => {
    const queues = new Map<string, File[]>();
    for (const file of files) queues.set(file.name, [...(queues.get(file.name) || []), file]);
    return queues;
  }, []);

  const selectFiles = (files: FileList | null) => {
    const nextFiles = Array.from(files || []);
    setLocalError(null);
    const validationError = validateScreenshotImportFiles(nextFiles);
    if (validationError) {
      setSelectedFiles([]);
      setLocalError(validationError);
      return;
    }
    setUploadFailures([]);
    setSelectedFiles(nextFiles);
  };

  const upload = async () => {
    if (selectedFiles.length === 0) return;
    setLocalError(null);
    const result = await onUpload(selectedFiles);
    const filesByName = fileQueuesByName(selectedFiles);
    const nextPending: PendingEntry[] = result.imports.flatMap((fi) => {
      const filename = fi.sourceFilename || "";
      const file = filesByName.get(filename)?.shift();
      if (!file) return [];
      return [{ file, financeImport: fi, rows: rowsForReview(fi, accounts) }];
    });
    // 先入队，再启动轮询（对于 processing 状态）
    setPending(nextPending);
    setActiveIndex(0);
    setSelectedFiles(nextPending.map((e) => e.file));
    setUploadFailures(result.failures);
    nextPending.forEach((entry) => {
      if (entry.financeImport.status === "processing") startPolling(entry);
    });
    if (!nextPending.length) setLocalError("没有可审核的识别结果，请使用更清晰截图或手动维护。");
  };

  // 处理中时重新尝试（点击按钮）
  const retryPolling = (entry: PendingEntry) => {
    if (entry.financeImport.status !== "failed") return;
    // 失败了其实无法重新 OCR（因为后端已经 fail_import），直接给用户提示用重试上传
    setLocalError("此条识别已失败，请删除本条后重新上传清晰截图。");
  };

  const activeEntry = useMemo(() => {
    // 跳转到第一个需要处理的（review 或 failed），如果全在 processing 就展示第一个 processing
    const firstActionable = pending.findIndex((e) => e.financeImport.status !== "processing");
    const target = firstActionable >= 0 ? firstActionable : 0;
    return pending[target] || null;
  }, [pending]);
  useEffect(() => {
    const firstActionable = pending.findIndex((e) => e.financeImport.status !== "processing");
    if (firstActionable >= 0 && firstActionable !== activeIndex) setActiveIndex(firstActionable);
  }, [pending, activeIndex]);

  const updateRow = (rowIndex: number, key: keyof FinanceImportRow, value: string) => {
    const id = activeEntry?.financeImport.id;
    if (!id) return;
    setPending((cur) => cur.map((e) => e.financeImport.id !== id ? e : {
      ...e,
      rows: e.rows.map((row, i) => i === rowIndex ? { ...row, [key]: value || null } : row),
    }));
  };

  const updateMarket = (rowIndex: number, market: string) => {
    const id = activeEntry?.financeImport.id;
    if (!id) return;
    setPending((cur) => cur.map((e) => e.financeImport.id !== id ? e : {
      ...e,
      rows: e.rows.map((row, i) => i === rowIndex ? {
        ...row,
        market: market as FinanceImportRow["market"],
        currency: market === "CN" ? "CNY" : market === "HK" ? "HKD" : market === "US" ? "USD" : null,
      } : row),
    }));
  };

  const processingCount = pending.filter((e) => e.financeImport.status === "processing").length;
  const failedCount = pending.filter((e) => e.financeImport.status === "failed").length;

  const finishActive = async (action: "confirm" | "discard") => {
    if (!activeEntry) return;
    if (action === "confirm") await onConfirm(activeEntry.financeImport, activeEntry.rows);
    else await onDiscard(activeEntry.financeImport);
    const id = activeEntry.financeImport.id;
    clearPoll(id);
    const next = pending.filter((e) => e.financeImport.id !== id);
    setPending(next);
    setSelectedFiles((cur) => cur.filter((f) => f !== activeEntry.file));
    if (next.length === 0) { onClose(); return; }
    setActiveIndex(Math.min(activeIndex, next.length - 1));
  };

  if (!open) return null;
  const shownError = error || localError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="导入持仓截图" onMouseDown={onClose}>
      <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-text">导入持仓截图</h2>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">
              上传后会在后台进行 OCR 识别，关闭此弹窗也不会中断。识别完成后自动排队到待审核。
              最多 {FINANCE_IMPORT_MAX_FILES} 张、每张最大 {FINANCE_IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB。
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭"><X className="h-4 w-4" /></Button>
        </div>

        {!activeEntry ? (
          <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
            <FileImage className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-3 text-sm font-medium text-text">上传基金或券商持仓截图</p>
            <p className="mt-1 text-xs text-text-tertiary">支持 PNG、JPEG、WebP；每张最大 10 MB。</p>
            <Input
              className="mx-auto mt-4 max-w-sm"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }}
            />
            {selectedFiles.length > 0 && (
              <div className="mx-auto mt-3 max-w-sm text-left text-xs text-text-secondary">
                <p>已选择 {selectedFiles.length} 张：</p>
                <ul className="mt-1 space-y-1">
                  {selectedFiles.map((f, i) => <li key={`${f.name}-${i}`} className="truncate">{f.name}</li>)}
                </ul>
              </div>
            )}
            {uploadFailures.length > 0 && (
              <div className="mx-auto mt-3 max-w-sm text-left text-xs text-danger">
                {uploadFailures.map(({ filename, code }) => (
                  <p key={`${filename}-${code}`}>{filename}：{ERROR_CODE_MESSAGES[code] || code}（已清理临时文件）</p>
                ))}
              </div>
            )}
            <Button className="mt-4" variant="primary" onClick={() => void upload()} disabled={selectedFiles.length === 0 || isUploading}>
              {isUploading ? "正在上传…" : <><Upload className="h-4 w-4" />开始识别 {selectedFiles.length || ""} 张</>}
            </Button>
            <p className="mx-auto mt-3 max-w-sm text-left text-[11px] text-text-tertiary">
              上传完成后立即返回（<b className="text-text-secondary">不会出现网关 504 超时</b>），OCR 在后台识别，识别中你可以继续做其他操作。
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <StatusHeader
              activeFile={activeEntry.file.name}
              activeStatus={activeEntry.financeImport.status}
              processingCount={processingCount}
              pendingCount={pending.length}
              failedCount={failedCount}
              errorCode={activeEntry.financeImport.errorCode}
            />
            {activeEntry.financeImport.status === "processing" && (
              <ProcessingCard />
            )}
            {activeEntry.financeImport.status === "failed" && (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                识别失败：{ERROR_CODE_MESSAGES[activeEntry.financeImport.errorCode || "OCR_EXTRACTION_FAILED"] || activeEntry.financeImport.errorCode || "未知错误"}
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => retryPolling(activeEntry)}>
                    <RotateCw className="h-4 w-4" />重试识别
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => void finishActive("discard")} disabled={isSaving}>
                    删除本条
                  </Button>
                </div>
              </div>
            )}
            {activeEntry.financeImport.status === "review" && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-text-secondary">已识别 {activeEntry.rows.length} 条，请补齐必要信息后确认。</p>
                {activeEntry.rows.map((row, rowIndex) => (
                  <div key={row.rowId} className="grid gap-2 rounded-xl border border-border-subtle p-3 sm:grid-cols-4">
                    <select className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text" value={row.accountId || ""} onChange={(e) => updateRow(rowIndex, "accountId", e.target.value)}>
                      <option value="">选择账户</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <Input className="h-9" value={row.name || ""} onChange={(e) => updateRow(rowIndex, "name", e.target.value)} placeholder="标的名称" />
                    <Input className="h-9" value={row.symbol || ""} onChange={(e) => updateRow(rowIndex, "symbol", e.target.value)} placeholder="代码" />
                    <select className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text" value={row.market || ""} onChange={(e) => updateMarket(rowIndex, e.target.value)}>
                      <option value="">市场</option>
                      <option value="CN">中国内地</option>
                      <option value="HK">香港</option>
                      <option value="US">美国</option>
                    </select>
                    <select className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text" value={row.assetClass || ""} onChange={(e) => updateRow(rowIndex, "assetClass", e.target.value)}>
                      <option value="">资产类型</option>
                      <option value="fund">基金</option>
                      <option value="etf">ETF</option>
                      <option value="stock">股票</option>
                    </select>
                    <Input className="h-9" value={row.quantity || ""} onChange={(e) => updateRow(rowIndex, "quantity", e.target.value)} placeholder="份额" />
                    <Input className="h-9" value={row.unitPrice || ""} onChange={(e) => updateRow(rowIndex, "unitPrice", e.target.value)} placeholder="单价" />
                    <Input className="h-9" type="date" value={row.occurredOn || ""} onChange={(e) => updateRow(rowIndex, "occurredOn", e.target.value)} />
                    <p className="col-span-full text-xs text-text-tertiary">
                      {row.currency || "未设置币种"} · 置信度 {Number(row.confidence || 0) * 100}%
                    </p>
                  </div>
                ))}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => void finishActive("discard")} disabled={isSaving}>
                    <Trash2 className="h-4 w-4" />丢弃并删除
                  </Button>
                  <Button variant="primary" onClick={() => void finishActive("confirm")} disabled={isSaving || activeEntry.rows.length === 0}>
                    {isSaving ? "保存中…" : "确认并记入交易"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {shownError && <p className="mt-3 text-sm text-danger">{shownError}</p>}
      </Card>
    </div>
  );
}

function StatusHeader(props: {
  activeFile: string;
  activeStatus: string;
  processingCount: number;
  pendingCount: number;
  failedCount: number;
  errorCode: string | null;
}) {
  const statusLabel: Record<string, string> = {
    processing: "识别中",
    review: "待审核",
    confirmed: "已确认",
    discarded: "已丢弃",
    failed: "识别失败",
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <p className="text-sm text-text-secondary">
        当前文件：<b className="text-text">{props.activeFile}</b> —{" "}
        {props.activeStatus === "processing" ? (
          <span className="inline-flex items-center gap-1 text-warning"><Clock className="h-3.5 w-3.5" />{statusLabel[props.activeStatus] || props.activeStatus}</span>
        ) : props.activeStatus === "failed" ? (
          <span className="text-danger">{statusLabel[props.activeStatus] || props.activeStatus}</span>
        ) : (
          <span className="text-success">{statusLabel[props.activeStatus] || props.activeStatus}</span>
        )}
      </p>
      <p className="text-xs text-text-tertiary">
        队列：还有 {props.pendingCount} 张 · 其中识别中 {props.processingCount} 张{props.failedCount > 0 ? ` · 失败 ${props.failedCount} 张` : ""}
      </p>
    </div>
  );
}

function ProcessingCard() {
  return (
    <div className="mt-4 grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:grid-cols-[auto_1fr]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/60 text-primary">
        <Clock className="h-6 w-6 animate-pulse" />
      </div>
      <div>
        <p className="font-semibold text-text">正在后台识别中…</p>
        <p className="mt-1 text-[13px] leading-6 text-text-secondary">
          视觉大模型识别一张持仓截图通常需要 1~5 分钟。
          <br />• 你可以<b className="text-text">关闭此弹窗</b>，识别不会中断；
          <br />• 识别完成后，此条会自动进入「待审核」队列；
          <br />• 超时后会自动重试 3 次（30s → 60s → 120s），避免 Render 网关 504 报错。
        </p>
      </div>
    </div>
  );
}
