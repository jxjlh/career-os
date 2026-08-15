"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";

const INTERESTS = ["数据", "产品", "增长", "用户", "内容", "技术", "系统", "编程", "商业", "研究"];

export function TargetRoleCard() {
  const queryClient = useQueryClient();
  const [interests, setInterests] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const target = useQuery<{ data: any }>({ queryKey: ["target-role"], queryFn: () => apiFetch("/jobs/target-role") });
  const recommend = useMutation({ mutationFn: () => apiFetch<{ data: { roles: any[] } }>("/jobs/target-role/recommend", { method: "POST", body: JSON.stringify({ interests }) }), onSuccess: (response) => setSuggestions(response.data.roles) });
  const save = useMutation({ mutationFn: (title: string) => apiFetch<{ data: any }>("/jobs/target-role", { method: "PUT", body: JSON.stringify({ title }) }), onSuccess: (response) => { setSelected(response.data.role); void queryClient.invalidateQueries({ queryKey: ["target-role"] }); } });
  const addSkills = useMutation({ mutationFn: (skills: string[]) => apiFetch("/jobs/target-role/skills", { method: "POST", body: JSON.stringify({ skills }) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["skill-matrix"] }) });
  const role = selected || target.data?.data?.role;

  return <Card className="p-4"><SectionHeader title="目标岗位" subtitle="还不确定方向？选择兴趣后获得推荐；确认岗位后查看 JD 要求并一键加入待学技能。" action={<BriefcaseBusiness className="h-5 w-5 text-primary" />} /><div className="mt-3 flex flex-wrap gap-2">{INTERESTS.map((item) => <Button key={item} size="sm" variant={interests.includes(item) ? "primary" : "outline"} onClick={() => setInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}>{item}</Button>)}</div><Button className="mt-3" size="sm" onClick={() => recommend.mutate()} disabled={recommend.isPending || interests.length === 0}>{recommend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}推荐岗位</Button>{suggestions.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-3">{suggestions.map((item) => <button type="button" key={item.title} onClick={() => save.mutate(item.title)} className="rounded-xl border border-border p-3 text-left hover:border-primary"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted">{item.jd}</p></button>)}</div>}{role && <div className="mt-4 rounded-xl bg-surface-muted/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">已选：{role.title}</p><p className="mt-1 text-xs text-muted">{role.jd}</p></div><Button size="sm" onClick={() => addSkills.mutate((role.requirements || []).map((item: any) => item.name))} disabled={addSkills.isPending}>{addSkills.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}加入想学技能</Button></div><div className="mt-3 flex flex-wrap gap-2">{(role.requirements || []).map((item: any) => <Badge key={item.name} variant="primary">{item.name} · L{item.level}</Badge>)}</div></div>}</Card>;
}
