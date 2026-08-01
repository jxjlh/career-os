"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";

const INTEREST_OPTIONS = ["摄影", "自然", "美食", "文化", "冒险"];

export function TravelPlanForm({
  defaultDestination,
  onGenerate,
  loading,
}: {
  defaultDestination: string;
  onGenerate: (input: {
    destination: string;
    days: number;
    budget: string;
    people: string;
    interests: string[];
    bestSeason: string;
    region: string;
  }) => void;
  loading: boolean;
}) {
  const [destination, setDestination] = useState(defaultDestination);
  const [days, setDays] = useState("7");
  const [budget, setBudget] = useState("");
  const [people, setPeople] = useState("");
  const [interests, setInterests] = useState<string[]>(["摄影", "自然"]);
  const [bestSeason, setBestSeason] = useState("");
  const [region, setRegion] = useState("");

  const toggleInterest = (value: string) => {
    setInterests((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  return (
    <Card className="p-5">
      <h1 className="text-lg font-semibold">AI 旅行规划助手</h1>
      <p className="mt-1 text-[13px] text-muted">填写旅行偏好，AI 为你生成完整攻略。</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted">目的地</label>
          <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">旅行天数</label>
            <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">预算（可选）</label>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="如 10000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">最佳季节（可选）</label>
            <Input value={bestSeason} onChange={(e) => setBestSeason(e.target.value)} placeholder="如 6-9月" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">地区（可选）</label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="如 北欧 / 中国西南" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">出行人数（可选）</label>
          <Input value={people} onChange={(e) => setPeople(e.target.value)} placeholder="solo / 情侣 / 家庭" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">兴趣标签</label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleInterest(item)}
                className={`rounded-full px-3 py-1 text-xs ${
                  interests.includes(item) ? "bg-primary text-white" : "bg-surface-muted text-muted"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          disabled={loading || !destination.trim()}
          onClick={() =>
            onGenerate({
              destination: destination.trim(),
              days: Math.min(30, Math.max(1, Number(days) || 7)),
              budget,
              people,
              interests,
              bestSeason,
              region,
            })
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "AI 正在规划..." : "🤖 生成旅行攻略"}
        </Button>
      </div>
    </Card>
  );
}
