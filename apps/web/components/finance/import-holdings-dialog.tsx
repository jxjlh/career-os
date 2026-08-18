"use client";

import { FileImage, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import {
  FINANCE_IMPORT_MAX_FILE_BYTES,
  FINANCE_IMPORT_MAX_FILES,
  validateScreenshotImportFiles,
} from "@/lib/finance-import-form";
import type {
  FinanceAccount,
  FinanceImport,
  FinanceImportRow,
  FinanceScreenshotImportBatch,
} from "@/lib/finance";

type ImportQueueEntry = {
  file: File;
  financeImport: FinanceImport;
  rows: FinanceImportRow[];
};

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

function fileQueuesByName(files: File[]): Map<string, File[]> {
  const queues = new Map<string, File[]>();
  for (const file of files) {
    queues.set(file.name, [...(queues.get(file.name) || []), file]);
  }
  return queues;
}

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
  const [queue, setQueue] = useState<ImportQueueEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFiles([]);
      setQueue([]);
      setActiveIndex(0);
      setUploadFailures([]);
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  const activeEntry = queue[activeIndex] || null;
  const shownError = error || localError;

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
    const nextQueue = result.imports.flatMap((financeImport) => {
      const filename = financeImport.sourceFilename || "";
      const file = filesByName.get(filename)?.shift();
      return file ? [{ file, financeImport, rows: rowsForReview(financeImport, accounts) }] : [];
    });
    setQueue(nextQueue);
    setActiveIndex(0);
    setSelectedFiles(nextQueue.map((entry) => entry.file));
    setUploadFailures(result.failures.map((failure) => `${failure.filename}：${failure.code}`));
    if (nextQueue.length === 0) setLocalError("没有可审核的识别结果，请使用更清晰截图或手动维护。");
  };

  const updateRow = (rowIndex: number, key: keyof FinanceImportRow, value: string) => {
    setQueue((current) => current.map((entry, entryIndex) => {
      if (entryIndex !== activeIndex) return entry;
      return {
        ...entry,
        rows: entry.rows.map((row, index) => index === rowIndex ? { ...row, [key]: value || null } : row),
      };
    }));
  };

  const updateMarket = (rowIndex: number, market: string) => {
    setQueue((current) => current.map((entry, entryIndex) => {
      if (entryIndex !== activeIndex) return entry;
      return {
        ...entry,
        rows: entry.rows.map((row, index) => index === rowIndex ? {
          ...row,
          market: market as FinanceImportRow["market"],
          currency: market === "CN" ? "CNY" : market === "HK" ? "HKD" : market === "US" ? "USD" : null,
        } : row),
      };
    }));
  };

  const finishActive = async (action: "confirm" | "discard") => {
    if (!activeEntry) return;
    if (action === "confirm") await onConfirm(activeEntry.financeImport, activeEntry.rows);
    else await onDiscard(activeEntry.financeImport);

    const nextQueue = queue.filter((_, index) => index !== activeIndex);
    setQueue(nextQueue);
    setSelectedFiles((current) => current.filter((file) => file !== activeEntry.file));
    if (nextQueue.length === 0) {
      onClose();
      return;
    }
    setActiveIndex(Math.min(activeIndex, nextQueue.length - 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="导入持仓截图"
      onMouseDown={onClose}
    >
      <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-text">导入持仓截图</h2>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">
              最多 {FINANCE_IMPORT_MAX_FILES} 张、每张最大 {FINANCE_IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB。识别后逐条确认；确认、丢弃或过期时，原始截图和 OCR 原文都会从云端删除。
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
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
              onChange={(event) => {
                selectFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {selectedFiles.length > 0 && (
              <div className="mx-auto mt-3 max-w-sm text-left text-xs text-text-secondary">
                <p>已选择 {selectedFiles.length} 张：</p>
                <ul className="mt-1 space-y-1">
                  {selectedFiles.map((file, index) => <li key={`${file.name}-${index}`} className="truncate">{file.name}</li>)}
                </ul>
              </div>
            )}
            {uploadFailures.length > 0 && (
              <div className="mx-auto mt-3 max-w-sm text-left text-xs text-danger">
                {uploadFailures.map((failure) => <p key={failure}>{failure} 已清理临时文件。</p>)}
              </div>
            )}
            <Button className="mt-4" variant="primary" onClick={() => void upload()} disabled={selectedFiles.length === 0 || isUploading}>
              {isUploading ? "逐张识别中…" : <><Upload className="h-4 w-4" />开始识别 {selectedFiles.length || ""} 张</>}
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="mb-3 text-sm text-text-secondary">
              正在审核第 {activeIndex + 1} / {queue.length} 张：{activeEntry.file.name}。已识别 {activeEntry.rows.length} 条，请补齐必要信息后确认。
            </p>
            <div className="space-y-3">
              {activeEntry.rows.map((row, rowIndex) => (
                <div key={row.rowId} className="grid gap-2 rounded-xl border border-border-subtle p-3 sm:grid-cols-4">
                  <select className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text" value={row.accountId || ""} onChange={(event) => updateRow(rowIndex, "accountId", event.target.value)}>
                    <option value="">选择账户</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                  <Input className="h-9" value={row.name || ""} onChange={(event) => updateRow(rowIndex, "name", event.target.value)} placeholder="标的名称" />
                  <Input className="h-9" value={row.symbol || ""} onChange={(event) => updateRow(rowIndex, "symbol", event.target.value)} placeholder="代码" />
                  <select className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text" value={row.market || ""} onChange={(event) => updateMarket(rowIndex, event.target.value)}>
                    <option value="">市场</option>
                    <option value="CN">中国内地</option>
                    <option value="HK">香港</option>
                    <option value="US">美国</option>
                  </select>
                  <select className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text" value={row.assetClass || ""} onChange={(event) => updateRow(rowIndex, "assetClass", event.target.value)}>
                    <option value="">资产类型</option>
                    <option value="fund">基金</option>
                    <option value="etf">ETF</option>
                    <option value="stock">股票</option>
                  </select>
                  <Input className="h-9" value={row.quantity || ""} onChange={(event) => updateRow(rowIndex, "quantity", event.target.value)} placeholder="份额" />
                  <Input className="h-9" value={row.unitPrice || ""} onChange={(event) => updateRow(rowIndex, "unitPrice", event.target.value)} placeholder="单价" />
                  <Input className="h-9" type="date" value={row.occurredOn || ""} onChange={(event) => updateRow(rowIndex, "occurredOn", event.target.value)} />
                  <p className="col-span-full text-xs text-text-tertiary">{row.currency || "未设置币种"} · 置信度 {Number(row.confidence || 0) * 100}%</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => void finishActive("discard")} disabled={isSaving}>
                <Trash2 className="h-4 w-4" />丢弃并删除
              </Button>
              <Button variant="primary" onClick={() => void finishActive("confirm")} disabled={isSaving || activeEntry.rows.length === 0}>
                {isSaving ? "保存中…" : "确认并记入交易"}
              </Button>
            </div>
          </div>
        )}
        {shownError && <p className="mt-3 text-sm text-danger">{shownError}</p>}
      </Card>
    </div>
  );
}
