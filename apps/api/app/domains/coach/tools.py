"""Life AI Coach 工具注册表.

统一注册机制: 每个工具声明 name / description / build_context.
coach 在构建对话上下文时, 可按用户意图调用工具 enrich 数据.
未来新增工具只需在此注册, 无需改动 coach 主流程.
"""

from dataclasses import dataclass, field
from typing import Awaitable, Callable

from sqlalchemy.orm import Session

CoachContextBuilder = Callable[[Session, str], Awaitable[str]]


@dataclass
class CoachTool:
    """单个教练工具声明."""

    name: str
    description: str
    keywords: list[str] = field(default_factory=list)  # 触发该工具的关键词
    build_context: CoachContextBuilder | None = None  # 异步构建上下文片段


class CoachToolRegistry:
    """工具注册中心: 提供按名称/关键词查找."""

    def __init__(self) -> None:
        self._tools: dict[str, CoachTool] = {}

    def register(self, tool: CoachTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> CoachTool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[CoachTool]:
        return list(self._tools.values())

    def match_by_text(self, text: str) -> list[CoachTool]:
        """根据用户输入文本匹配相关工具 (关键词命中)."""
        lowered = text.lower()
        matched: list[CoachTool] = []
        for tool in self._tools.values():
            if any(kw in lowered for kw in tool.keywords):
                matched.append(tool)
        return matched


# 全局单例: 模块加载时注册默认工具
registry = CoachToolRegistry()


def _register_default_tools() -> None:
    """注册 LifeOS 内置工具 (旅行/成长/年度/地图/好友/团队).

    注意: build_context 采用惰性 import, 避免循环依赖.
    各工具仅返回精简的数据摘要文本, 供 coach 拼入 system prompt.
    """
    from app.domains.coach.tool_impls import (
        build_friend_context,
        build_growth_context,
        build_map_context,
        build_team_context,
        build_travel_context,
        build_year_context,
    )

    registry.register(
        CoachTool(
            name="travel_plan",
            description="旅行规划: 基于目的地/天数/预算生成行程",
            keywords=["旅行", "旅游", "行程", "travel", "去哪", "路线", "出发"],
            build_context=build_travel_context,
        )
    )
    registry.register(
        CoachTool(
            name="growth_plan",
            description="成长规划: 为目标生成阶段计划与每日任务",
            keywords=["成长", "学习", "技能", "计划", "提升", "grow"],
            build_context=build_growth_context,
        )
    )
    registry.register(
        CoachTool(
            name="year_review",
            description="年度复盘: 基于 Year Review 分析全年成长",
            keywords=["今年", "年度", "复盘", "回顾", "year", "annual", "总结"],
            build_context=build_year_context,
        )
    )
    registry.register(
        CoachTool(
            name="map_insight",
            description="地图洞察: 分析足迹与旅行统计",
            keywords=["足迹", "地图", "城市", "国家", "去过", "map", "travel"],
            build_context=build_map_context,
        )
    )
    registry.register(
        CoachTool(
            name="friend_recommendation",
            description="好友推荐: 推荐志趣相投的伙伴",
            keywords=["好友", "朋友", "伙伴", "推荐", "friend", "社交"],
            build_context=build_friend_context,
        )
    )
    registry.register(
        CoachTool(
            name="team_plan",
            description="团队规划: 为共同目标分工",
            keywords=["共同", "一起", "团队", "分工", "team", "组队"],
            build_context=build_team_context,
        )
    )


_register_default_tools()
