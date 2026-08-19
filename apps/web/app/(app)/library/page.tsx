"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Download, ExternalLink, Library, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Button, Card, EmptyState, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };
const STATUS_LABELS: Record<string, string> = { want: "想看", reading: "在读", finished: "已看", unread: "未看" };

function ReadingSection() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sourceSearchBookId, setSourceSearchBookId] = useState<string | null>(null);
  const [sourceMessages, setSourceMessages] = useState<Record<string, string>>({});
  const [sourceResults, setSourceResults] = useState<Record<string, any[]>>({});
  const [savingSource, setSavingSource] = useState<string | null>(null);

  const books = useQuery<Envelope>({
    queryKey: ["reading-books"],
    queryFn: () => apiFetch("/library/reading/books"),
  });
  const items = useMemo(() => books.data?.data || [], [books.data]);
  const visibleBooks = useMemo(() => status === "all" ? items : items.filter((book: any) => book.status === status), [items, status]);

  const createBook = useMutation({
    mutationFn: (payload: any) => apiFetch("/library/reading/books", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reading-books"] });
      setTitle("");
    },
  });
  const updateBook = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => apiFetch(`/library/reading/books/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reading-books"] }),
  });
  const deleteBook = useMutation({
    mutationFn: (id: string) => apiFetch(`/library/reading/books/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reading-books"] }),
  });
  const recommend = useMutation({
    mutationFn: () => apiFetch<Envelope>("/library/reading/recommendations", { method: "POST" }),
    onSuccess: (response) => setRecommendations(response.data.books || []),
  });
  const populateClassics = useMutation({
    mutationFn: () => apiFetch<Envelope>("/library/reading/populate-classics", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reading-books"] }),
  });
  const downloadBook = useMutation({
    mutationFn: ({ id, downloadUrl, downloadFormat }: { id: string; downloadUrl: string; downloadFormat?: string }) =>
      apiFetch(`/library/reading/books/${id}/download`, { method: "POST", body: JSON.stringify({ downloadUrl, downloadFormat }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reading-books"] }),
  });

  const searchBookResources = async (searchTerm: string, showInSearchResults = true) => {
    if (!searchTerm.trim()) return [];
    setSearching(true);
    if (showInSearchResults) setSearchResults([]);
    try {
      const response = await apiFetch<Envelope>("/library/reading/search", { method: "POST", body: JSON.stringify({ query: searchTerm.trim(), limit: 10 }) });
      for (let index = 0; index < 30; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const job = await apiFetch<Envelope>(`/explore/jobs/${response.data.jobId}`);
        if (job.data.status === "succeeded") {
          const results = job.data.result.items || [];
          if (showInSearchResults) setSearchResults(results);
          return results;
        }
        if (job.data.status === "failed") return [];
      }
      return [];
    } finally { setSearching(false); }
  };

  const searchBooks = async () => {
    await searchBookResources(query);
  };

  const createBookFromResult = (titleToSave: string, payload: any, fallbackNote?: string) => createBook.mutate({
    title: titleToSave,
    author: payload.author || null,
    description: payload.description || payload.snippet || null,
    sourceUrl: payload.downloadUrl || payload.url || null,
    status: "want",
    notes: fallbackNote || null,
    isComplete: payload.isComplete ?? false,
    aiRecommended: Boolean(payload.reason),
  });

  const addBook = async (payload: any) => {
    if (payload.url) {
      createBookFromResult(payload.title, payload);
      return;
    }
    const results = await searchBookResources(payload.searchQuery || payload.title);
    const source = results.find((item: any) => item.url);
    createBookFromResult(payload.title, { ...payload, ...source }, source ? undefined : "暂未找到可直接阅读的完整来源，可稍后重新搜索。");
  };

  const addCustomBook = async () => {
    const bookTitle = title.trim();
    if (!bookTitle) return;
    const results = await searchBookResources(bookTitle);
    const source = results.find((item: any) => item.url);
    createBookFromResult(bookTitle, source || {}, source ? undefined : "暂未找到可直接阅读的完整来源，可稍后重新搜索。");
  };

  const findBookSource = async (book: any) => {
    setSourceSearchBookId(book.id);
    setSourceMessages((current) => ({ ...current, [book.id]: "正在搜索可阅读来源…" }));
    try {
      const searchTerm = book.author ? `${book.title} - ${book.author}` : book.title;
      const results = await searchBookResources(searchTerm, false);
      setSourceResults((current) => ({ ...current, [book.id]: results.filter((item: any) => item.isBookSource && item.url) }));
      if (results.length === 0) {
        setSourceMessages((current) => ({ ...current, [book.id]: "暂时没有找到可阅读来源，请稍后重试。" }));
        return;
      }
      setSourceMessages((current) => ({ ...current, [book.id]: `找到 ${results.length} 个来源，请选择一个保存到系统。` }));
    } catch (error) {
      setSourceMessages((current) => ({ ...current, [book.id]: error instanceof Error ? error.message : "搜索来源失败，请稍后重试。" }));
    } finally {
      setSourceSearchBookId(null);
    }
  };

  const saveBookSource = async (book: any, source: any) => {
    const key = `${book.id}:${source.url}`;
    setSavingSource(key);
    try {
      await updateBook.mutateAsync({ id: book.id, payload: { sourceUrl: source.url, author: source.author || book.author, description: source.description || source.snippet || book.description, isComplete: source.isComplete ?? book.isComplete } });
      setSourceResults((current) => ({ ...current, [book.id]: [] }));
      setSourceMessages((current) => ({ ...current, [book.id]: `已保存 ${source.sourceName || "该来源"}，现在可以开始阅读。` }));
    } catch (error) {
      setSourceMessages((current) => ({ ...current, [book.id]: error instanceof Error ? error.message : "保存来源失败，请稍后重试。" }));
    } finally {
      setSavingSource(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">阅读书籍</h2><p className="mt-1 text-xs text-muted">AI 推荐完整出版书籍，也可以搜索书名；系统会记住你的页码、状态和阅读计划。</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => populateClassics.mutate()} disabled={populateClassics.isPending}>{populateClassics.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />}导入经典公版书</Button><Button size="sm" onClick={() => recommend.mutate()} disabled={recommend.isPending}><Sparkles className="h-4 w-4" />AI 推荐好书</Button></div></div>
        <div className="mt-4 flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchBooks(); } }} placeholder="搜索书名；精确匹配可输入：书名 - 作者" /><Button variant="outline" onClick={searchBooks} disabled={searching || !query.trim()}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}搜索书籍</Button></div>
        {(recommendations.length > 0 || searchResults.length > 0) && <div className="mt-4 grid gap-3 md:grid-cols-2">{[...recommendations.map((item) => ({ ...item, recommendation: true })), ...searchResults].map((item: any, index) => <div key={`${item.title}-${item.url || index}`} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{item.title}</p>{item.isExactMatch && <Badge variant="success">精确匹配</Badge>}</div><p className="mt-1 text-xs text-muted">{item.author || item.sourceName || item.provider}</p><p className="mt-2 line-clamp-3 text-xs text-text-secondary">{item.description || item.reason || item.snippet || "可加入书单后设置自己的阅读计划。"}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void addBook(item)} disabled={createBook.isPending || searching}><Plus className="h-3.5 w-3.5" />加入想看</Button>{item.url && <a href={item.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">查看来源<ExternalLink className="h-3.5 w-3.5" /></Button></a>}{item.downloadUrl && <a href={item.downloadUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="primary">下载 {item.downloadFormat || "文件"}</Button></a>}</div></div>)}</div>}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">添加自己的书籍与计划</h2>
        <div className="mt-3 flex gap-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addCustomBook(); } }} placeholder="输入书名" /><Button className="shrink-0" size="sm" disabled={!title.trim() || createBook.isPending || searching} onClick={() => void addCustomBook()}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}搜索并加入想看</Button></div>
      </Card>

      <div className="flex flex-wrap gap-2">{[["all", "全部"], ...Object.entries(STATUS_LABELS)].map(([key, label]) => <button key={key} type="button" onClick={() => setStatus(key)} className={`rounded-full border px-3 py-1.5 text-xs ${status === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}>{label} {key === "all" ? items.length : items.filter((book: any) => book.status === key).length}</button>)}</div>
      {visibleBooks.length === 0 ? <Card className="p-8"><EmptyState title="还没有这类书籍" description="从 AI 推荐、搜索结果或输入书名开始。" /></Card> : <div className="grid gap-3 md:grid-cols-2">{visibleBooks.map((book: any) => <ReadingBookCard key={book.id} book={book} onUpdate={(payload) => updateBook.mutate({ id: book.id, payload })} onFindSource={() => void findBookSource(book)} onSaveSource={(source) => void saveBookSource(book, source)} onDownload={(downloadUrl, downloadFormat) => downloadBook.mutate({ id: book.id, downloadUrl, downloadFormat })} sourceResults={sourceResults[book.id] || []} searchingSource={sourceSearchBookId === book.id} savingSource={savingSource} sourceMessage={sourceMessages[book.id]} onDelete={() => { if (window.confirm(`删除《${book.title}》？`)) deleteBook.mutate(book.id); }} />)}</div>}
    </div>
  );
}

function ReadingBookCard({ book, onUpdate, onFindSource, onSaveSource, onDownload, sourceResults, searchingSource, savingSource, sourceMessage, onDelete }: { book: any; onUpdate: (payload: any) => void; onFindSource: () => void; onSaveSource: (source: any) => void; onDownload: (downloadUrl: string, downloadFormat?: string) => void; sourceResults: any[]; searchingSource: boolean; savingSource: string | null; sourceMessage?: string; onDelete: () => void }) {
  const [page, setPage] = useState(String(book.currentPage || 0));
  const progress = Number(book.progressPercent || 0);
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{book.title}</h3><p className="mt-1 text-xs text-muted">{book.author || "作者未填写"}</p></div><div className="flex items-center gap-1"><Badge variant={book.status === "finished" ? "success" : book.status === "reading" ? "primary" : "default"}>{STATUS_LABELS[book.status] || book.status}</Badge>{book.hasFile && <Badge variant="success">已下载</Badge>}{book.isComplete && <Badge variant="success">完整版</Badge>}</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div><div className="mt-1 flex justify-between text-[11px] text-muted"><span>{progress}%</span><span>{book.currentPage}{book.totalPages ? ` / ${book.totalPages} 页` : " 页"}</span></div><div className="mt-3 flex flex-wrap gap-2"><Input className="w-28" type="number" min="0" value={page} onChange={(event) => setPage(event.target.value)} /><Button size="sm" onClick={() => onUpdate({ currentPage: Number(page), status: Number(page) > 0 ? "reading" : book.status })}><Check className="h-3.5 w-3.5" />保存进度</Button><select className="h-8 rounded-[10px] border border-border bg-surface px-2 text-xs" value={book.status} onChange={(event) => onUpdate({ status: event.target.value })}><option value="want">想看</option><option value="reading">在读</option><option value="finished">已看</option><option value="unread">未看</option></select><Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button></div>{book.hasFile && book.fileUrl ? <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={book.fileUrl} target="_blank" rel="noreferrer"><BookOpen className="h-3 w-3" />在线阅读 ({book.fileFormat?.toUpperCase()}) <ExternalLink className="h-3 w-3" /></a> : book.sourceUrl ? <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={book.sourceUrl} target="_blank" rel="noreferrer"><BookOpen className="h-3 w-3" />开始阅读 <ExternalLink className="h-3 w-3" /></a> : <><Button className="mt-2" size="sm" variant="outline" disabled={searchingSource} onClick={onFindSource}>{searchingSource ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}{searchingSource ? "正在搜索…" : "搜索可阅读来源"}</Button>{sourceMessage && <p className="mt-2 text-xs text-muted">{sourceMessage}</p>}{sourceResults.length > 0 && <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-muted/30 p-2">{sourceResults.map((source: any) => <div key={source.url} className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2"><div className="min-w-0"><p className="truncate text-xs font-medium">{source.title}</p><p className="mt-0.5 text-[11px] text-muted">{source.sourceName}</p></div><div className="flex shrink-0 gap-1"><a href={source.url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost">查看</Button></a>{source.downloadUrl && <Button size="sm" variant="outline" onClick={() => onDownload(source.downloadUrl, source.downloadFormat || undefined)}><Download className="h-3 w-3" /></Button>}<Button size="sm" onClick={() => onSaveSource(source)} disabled={savingSource === `${book.id}:${source.url}`}>{savingSource === `${book.id}:${source.url}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}保存</Button></div></div>)}</div>}</>}</Card>;
}

export default function LibraryPage() {
  const { t } = useI18n();
  const bookmarks = useQuery<Envelope>({ queryKey: ["bookmarks"], queryFn: () => apiFetch("/library/bookmarks") });
  const items = bookmarks.data?.data || [];
  return <div className="space-y-6"><SectionHeader title="阅读书籍" subtitle="AI 读书推荐 · 完整书籍来源 · 阅读进度与计划" /><ReadingSection /><section><SectionHeader title={t("nav.library")} />{items.length === 0 ? <EmptyState title="还没有收藏" description="收藏内容会显示在这里。" /> : <div className="space-y-2">{items.map((item: any) => <Card key={item.bookmarkId} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><a href={item.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary">{item.title}</a>{item.note && <p className="mt-0.5 text-[13px] text-muted">{item.note}</p>}<div className="mt-1.5 flex flex-wrap gap-1.5">{item.tags.map((tag: any) => <Badge key={tag.id}>{tag.name}</Badge>)}</div></div></Card>)}</div>}</section></div>;
}
