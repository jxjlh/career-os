"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, Input } from "@/components/ui";
import {
  addTravelChecklistItem,
  deleteTravelChecklistItem,
  getTravelChecklist,
  updateTravelChecklistItem,
} from "@/lib/life";

export function TravelChecklist({ aiContentId }: { aiContentId: string }) {
  const queryClient = useQueryClient();
  const [item, setItem] = useState("");
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["travel-checklist", aiContentId],
    queryFn: () => getTravelChecklist(aiContentId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["travel-checklist", aiContentId] });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      addTravelChecklistItem(aiContentId, {
        item,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setItem("");
      setNote("");
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (row: { id: string; checked: boolean }) =>
      updateTravelChecklistItem(row.id, { checked: !row.checked }),
    onSuccess: invalidate,
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, note: value }: { id: string; note: string }) =>
      updateTravelChecklistItem(id, { note: value }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTravelChecklistItem(id),
    onSuccess: invalidate,
  });

  const items = query.data ?? [];
  const done = items.filter((row) => row.checked).length;

  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">物品清单</p>
        {items.length > 0 && (
          <span className="text-xs text-muted">
            已准备 {done}/{items.length}
          </span>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-border p-4 text-center text-xs text-muted">
          还没有物品，添加你要准备的东西。
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((row) => (
            <div
              key={row.id}
              className="rounded-[10px] border border-border bg-surface-muted/60 p-2.5"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={row.checked ? "取消已准备" : "标记已准备"}
                  onClick={() => toggleMutation.mutate(row)}
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-[6px] border transition-colors ${
                    row.checked
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-transparent hover:border-primary"
                  }`}
                >
                  {toggleMutation.isPending && toggleMutation.variables?.id === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </button>
                <p
                  className={`min-w-0 flex-1 text-[13px] ${
                    row.checked ? "text-muted line-through" : "text-text"
                  }`}
                >
                  {row.item}
                </p>
                <button
                  type="button"
                  aria-label="删除物品"
                  onClick={() => deleteMutation.mutate(row.id)}
                  className="text-muted transition-colors hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 pl-8">
                <Input
                  defaultValue={row.note || ""}
                  placeholder="备注（可选）"
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value !== (row.note || "")) noteMutation.mutate({ id: row.id, note: value });
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="新增物品，如：护照"
          className="h-9 text-xs"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          className="h-9 text-xs"
        />
        <Button
          size="sm"
          disabled={!item.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          添加
        </Button>
      </div>
    </div>
  );
}
