import json
import re
from abc import ABC, abstractmethod
from typing import Any


def extract_json(text: str) -> dict | None:
    """从 AI 回复中提取首个 JSON 对象.

    容错处理 markdown 代码块包裹与前后多余文本.
    返回解析后的 dict, 解析失败返回 None.
    """
    if not text:
        return None
    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
        response_format: str | None = None,
        **kwargs: Any,
    ) -> str:
        """Return a complete assistant message."""

    @abstractmethod
    async def healthcheck(self) -> bool:
        """Return whether the provider is configured and reachable."""
