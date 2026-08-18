"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, FileText, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, Card, Input, SectionHeader, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

function formatBytes(size?: number | null): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function ProjectFileAsset({ projectId, file }: { projectId: string; file: any }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    apiFetch<{ data: { url: string } }>(`/projects/${projectId}/files/${file.id}/download`)
      .then((res) => {
        if (mounted) setUrl(res.data.url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [projectId, file.id]);

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-xs text-text transition-colors hover:border-primary/35"
    >
      {file.fileType === "image" && url ? (
        <img src={url} alt="" className="h-6 w-6 rounded-[4px] object-cover" />
      ) : (
        <FileText className="h-3.5 w-3.5 text-muted" />
      )}
      <span className="min-w-0 flex-1 truncate">{file.originalName}</span>
      {formatBytes(file.sizeBytes) && <span className="shrink-0 text-muted">{formatBytes(file.sizeBytes)}</span>}
    </a>
  );
}

export default function ProjectsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const projects = useQuery<Envelope>({
    queryKey: ["projects"],
    queryFn: () => apiFetch("/projects"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ data: any }>("/projects", {
        method: "POST",
        body: JSON.stringify({ title, description: description || undefined }),
      });
      const project = res.data;
      if (files.length > 0) {
        setUploading(true);
        for (const file of files) {
          const form = new FormData();
          form.append("file", file);
          await apiFetch(`/projects/${project.id}/files/upload`, { method: "POST", body: form });
        }
      }
      return project;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setFiles([]);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => {
      setUploading(false);
    },
  });

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  };

  return (
    <div>
      <SectionHeader
        title={t("nav.projects")}
        action={
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && !create.isPending) create.mutate();
            }}
          >
            <div className="flex flex-col gap-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("projects.titlePh")}
                className="w-56"
              />
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="作品简介（可选）"
                className="w-72"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md,.txt,.zip"
              className="hidden"
              onChange={pickFiles}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={create.isPending || uploading}
            >
              <Upload className="h-4 w-4" />
              上传资源
            </Button>
            <Button type="submit" disabled={create.isPending || uploading || !title.trim()}>
              {create.isPending || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Briefcase className="h-4 w-4" />
              )}
              {create.isPending || uploading ? "保存中..." : t("common.save")}
            </Button>
          </form>
        }
      />

      {files.length > 0 && (
        <Card className="mb-4 p-3">
          <p className="mb-2 text-xs font-medium text-muted">已选择 {files.length} 个资源，保存作品集时一起上传</p>
          <div className="flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <span key={`${file.name}-${idx}`} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted" />
                )}
                <span className="max-w-40 truncate">{file.name}</span>
                <span className="text-muted">{formatBytes(file.size)}</span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="移除"
                  className="text-muted hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(projects.data?.data || []).map((p: any) => (
          <Card key={p.id} className="p-4">
            <p className="truncate text-sm font-medium">{p.title}</p>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.description || t("projects.noDesc")}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{p.status}</span>
              {p.role && <span className="text-xs text-muted">{p.role}</span>}
            </div>
            {(p.files || []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {(p.files || []).map((f: any) => (
                  <ProjectFileAsset key={f.id} projectId={p.id} file={f} />
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      {(!projects.data?.data || projects.data.data.length === 0) && (
        <p className="rounded-[8px] border border-dashed border-border bg-surface p-8 text-center text-[13px] text-muted">
          {t("projects.noProjects")}
        </p>
      )}
    </div>
  );
}
