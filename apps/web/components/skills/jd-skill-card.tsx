"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, SectionHeader, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type ExtractedSkill = {
  name: string;
  category: string;
  suggestedLevel: number;
  reason: string;
  alreadyAdded: boolean;
};

export function JdSkillCard() {
  const queryClient = useQueryClient();
  const [jd, setJd] = useState("");
  const [skills, setSkills] = useState<ExtractedSkill[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const extract = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { skills: ExtractedSkill[]; provider: string } }>("/skills/from-jd", {
        method: "POST",
        body: JSON.stringify({ jd }),
      }),
    onSuccess: (res) => {
      setSkills(res.data.skills);
      setSelected(new Set(res.data.skills.filter((s) => !s.alreadyAdded).map((s) => s.name)));
    },
  });

  const addSkills = useMutation({
    mutationFn: (names: string[]) =>
      apiFetch("/jobs/target-role/skills", {
        method: "POST",
        body: JSON.stringify({ skills: names }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
      setSkills((prev) => prev.map((s) => ({ ...s, alreadyAdded: true })));
    },
  });

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const selectedNames = [...selected].filter((n) => !skills.find((s) => s.name === n)?.alreadyAdded);

  return (
    <Card className="p-4">
      <SectionHeader
        title="从 JD 提取技能"
        subtitle="粘贴目标岗位的职位描述（JD），AI 自动提取所需技能，勾选后一键加入技能矩阵。"
        action={<FileText className="h-5 w-5 text-primary" />}
      />
      <Textarea
        className="mt-3 min-h-[120px]"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="粘贴 JD 全文，包括岗位职责、任职要求等…"
      />
      <Button
        className="mt-3"
        size="sm"
        onClick={() => extract.mutate()}
        disabled={extract.isPending || jd.trim().length < 20}
      >
        {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        AI 提取技能
      </Button>

      {skills.length > 0 && (
        <>
          <div className="mt-4 space-y-2">
            {skills.map((skill) => (
              <label
                key={skill.name}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  selected.has(skill.name) && !skill.alreadyAdded
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <button
                  type="button"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    selected.has(skill.name) ? "border-primary bg-primary text-white" : "border-border"
                  }`}
                  onClick={() => !skill.alreadyAdded && toggle(skill.name)}
                >
                  {selected.has(skill.name) && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{skill.name}</p>
                    <Badge variant="default">{skill.category}</Badge>
                    <Badge variant="primary">建议 L{skill.suggestedLevel}</Badge>
                    {skill.alreadyAdded && <Badge variant="ai">已添加</Badge>}
                  </div>
                  {skill.reason && <p className="mt-1 text-xs text-muted">{skill.reason}</p>}
                </div>
              </label>
            ))}
          </div>
          {selectedNames.length > 0 && (
            <Button
              className="mt-4"
              size="sm"
              variant="primary"
              onClick={() => addSkills.mutate(selectedNames)}
              disabled={addSkills.isPending}
            >
              {addSkills.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              加入 {selectedNames.length} 个技能到矩阵
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
