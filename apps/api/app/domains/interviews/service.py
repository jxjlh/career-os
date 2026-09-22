"""面试中心服务层.

职责划分（延续本项目"确定性逻辑不进模型"的铁律）：
- 简历事实、JD 拆解、出题、追问决策、面评 → 调大模型（可降级）。
- JD 关键词与简历的粗匹配预览 → 本地字符串匹配，不调模型。
- AI 失败时向上返回 None，由 router 决定降级或报错。
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Interview
from app.domains.ai.prompts.interview import (
    FOLLOWUP_DECISION_PROMPT,
    INTERVIEW_FEEDBACK_PROMPT,
    INTERVIEW_QUESTION_PROMPT,
    JD_INFER_PROMPT,
    JD_NORMALIZE_PROMPT,
    RESUME_FACTS_PROMPT,
)
from app.providers.ai.base import AIProvider, extract_json
from app.providers.ai.registry import get_ai_provider, get_jd_ai_provider
from app.providers.search.registry import get_search_providers


async def _complete_json(
    provider: AIProvider,
    prompt: str,
    temperature: float = 0.4,
    max_tokens: int = 1600,
) -> dict | None:
    try:
        raw = await provider.complete(
            [{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception:
        return None
    return extract_json(raw)


def _jd_facts_to_text(facts: dict) -> str:
    """把结构化 JD 还原成可读文本，供出题/面评 prompt 使用."""
    lines: list[str] = [str(facts.get("title") or "岗位")]
    if facts.get("company"):
        lines.append(f"公司：{facts['company']}")
    if facts.get("seniority"):
        lines.append(f"职级/经验：{facts['seniority']}")
    if facts.get("industry"):
        lines.append(f"行业：{facts['industry']}")
    for label, key in (("职责", "responsibilities"), ("硬性要求", "hardRequirements"), ("加分项", "preferred")):
        items = facts.get(key) or []
        if items:
            lines.append(f"{label}：\n" + "\n".join(f"- {i}" for i in items))
    return "\n".join(lines)


class InterviewPrepService:
    def __init__(self, db: Session) -> None:
        self.db = db

    async def extract_resume_facts(self, resume_text: str) -> dict | None:
        provider = get_ai_provider()
        prompt = RESUME_FACTS_PROMPT.format(resume_text=resume_text[:12000])
        return await _complete_json(provider, prompt, temperature=0.2, max_tokens=2200)

    async def _normalize_jd(self, role: str, company: str | None, source_text: str) -> dict | None:
        provider = get_jd_ai_provider()
        prompt = JD_NORMALIZE_PROMPT.format(
            role=role, company=company or "", search_results=source_text[:12000]
        )
        return await _complete_json(provider, prompt, temperature=0.2, max_tokens=1600)

    async def _infer_jd(self, role: str, company: str | None) -> dict | None:
        provider = get_jd_ai_provider()
        prompt = JD_INFER_PROMPT.format(role=role, company=company or "")
        return await _complete_json(provider, prompt, temperature=0.4, max_tokens=1600)

    async def _jd_search(self, role: str, company: str | None, limit: int = 8) -> list[dict]:
        query = f"{role} 招聘 岗位职责 任职要求"
        if company:
            query = f"{company} {role} 招聘 岗位职责 任职要求"
        # 只挑真正的全网搜索引擎，排除 Wikipedia/GitHub/Dev.to 等不适合搜招聘信息的源。
        providers = [
            p for p in get_search_providers() if p.name in {"duckduckgo", "tavily", "exa", "google", "bing"}
        ]
        if not providers:
            return []
        responses = await asyncio.gather(
            *(p.search(query, limit=limit, language="zh") for p in providers),
            return_exceptions=True,
        )
        seen: set[str] = set()
        collected: list[dict] = []
        for resp in responses:
            if isinstance(resp, Exception):
                continue
            for item in resp or []:
                url = item.get("url") or ""
                if not url or url in seen:
                    continue
                seen.add(url)
                collected.append(
                    {
                        "title": item.get("title", ""),
                        "snippet": item.get("snippet", "")[:300],
                        "url": url,
                        "source": item.get("source_name", ""),
                    }
                )
                if len(collected) >= limit:
                    return collected
        return collected

    async def resolve_jd(
        self, role: str, company: str | None, jd_text: str | None
    ) -> tuple[str, dict, str, dict]:
        """归一 JD，返回 (jd_text, jd_facts, jd_source, jd_meta)."""
        if jd_text and len(jd_text.strip()) >= 30:
            facts = await self._normalize_jd(role, company, jd_text)
            if facts is None:
                raise AppError(code="AI_OUTPUT_INVALID", message="JD 解析失败，请稍后重试", status=502)
            return jd_text.strip(), facts, "user", {"company": company or ""}

        results = await self._jd_search(role, company)
        if results:
            source_text = "\n\n".join(
                f"【来源 {r['source'] or r['url']}】{r['title']}\n{r['snippet']}" for r in results
            )
            facts = await self._normalize_jd(role, company, source_text)
            if facts:
                return _jd_facts_to_text(facts), facts, "search", {"sources": results}
            # 归纳失败但搜到了结果：直接把碎片当 JD 文本，facts 用空结构兜底
            fallback_facts = {
                "title": role,
                "company": company or "",
                "responsibilities": [],
                "hardRequirements": [],
                "preferred": [],
                "keywords": [],
                "confidence": "low",
            }
            return source_text, fallback_facts, "search", {"sources": results}

        facts = await self._infer_jd(role, company)
        if facts:
            return _jd_facts_to_text(facts), facts, "inferred", {}
        raise AppError(
            code="JD_RESOLVE_FAILED",
            message="未能获取该岗位的 JD，请手动粘贴招聘要求后再试。",
            status=502,
        )

    @staticmethod
    def build_match_preview(resume_text: str, resume_facts: dict, jd_facts: dict) -> dict:
        """JD 关键词/硬性要求与简历的粗匹配（本地字符串匹配，仅作预览）."""
        haystack = (resume_text or "").lower()
        skills = " ".join(str(s) for s in (resume_facts or {}).get("skills", [])).lower()
        haystack = haystack + " " + skills

        matched_kw: list[str] = []
        missing_kw: list[str] = []
        for kw in jd_facts.get("keywords", []) or []:
            if not kw:
                continue
            (matched_kw if kw.lower() in haystack else missing_kw).append(kw)

        hard_hits: list[dict] = []
        for req in jd_facts.get("hardRequirements", []) or []:
            if not req:
                continue
            hit = req.lower() in haystack
            hard_hits.append({"requirement": req, "matched": hit})

        return {
            "matchedKeywords": matched_kw,
            "missingKeywords": missing_kw,
            "hardRequirements": hard_hits,
            "note": "粗匹配仅为关键词字面命中，仅供预览；真实匹配度以面试后报告为准。",
        }


class InterviewQuestionService:
    async def generate(
        self, interview: Interview, count: int, mode: str, difficulty: str
    ) -> list[dict] | None:
        provider = get_ai_provider()
        resume_facts = interview.resume_facts or {}
        prompt = INTERVIEW_QUESTION_PROMPT.format(
            jd_text=(interview.jd_text or "")[:8000],
            jd_requirements=json.dumps(interview.jd_facts or {}, ensure_ascii=False),
            resume_facts=json.dumps(resume_facts, ensure_ascii=False),
            resume_risks=json.dumps(resume_facts.get("risks", []), ensure_ascii=False),
            mode=mode,
            difficulty=difficulty,
            question_count=count,
        )
        parsed = await _complete_json(provider, prompt, temperature=0.6, max_tokens=3000)
        if not parsed or not isinstance(parsed.get("questions"), list):
            return None
        return [q for q in parsed["questions"] if isinstance(q, dict) and q.get("question")]


class InterviewFollowupService:
    async def decide(
        self,
        question: str,
        intent: str,
        keywords: list[str],
        answer: str,
        current_round: int,
        max_rounds: int,
    ) -> dict | None:
        provider = get_ai_provider()
        prompt = FOLLOWUP_DECISION_PROMPT.format(
            question=question,
            intent=intent or "验证岗位匹配度",
            expected_keywords=json.dumps(keywords or [], ensure_ascii=False),
            answer=answer[:4000],
            round=current_round,
            max_rounds=max_rounds,
        )
        return await _complete_json(provider, prompt, temperature=0.4, max_tokens=500)


class InterviewFeedbackService:
    async def evaluate(
        self,
        jd_text: str,
        jd_facts: dict,
        resume_facts: dict,
        qa_text: str,
    ) -> dict | None:
        provider = get_ai_provider()
        prompt = INTERVIEW_FEEDBACK_PROMPT.format(
            jd_text=(jd_text or "")[:8000],
            jd_requirements=json.dumps(jd_facts or {}, ensure_ascii=False),
            resume_facts=json.dumps(resume_facts or {}, ensure_ascii=False),
            qa_text=qa_text[:16000],
        )
        return await _complete_json(provider, prompt, temperature=0.3, max_tokens=4000)
