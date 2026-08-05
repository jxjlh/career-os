"""SM-2 间隔重复算法简化版.

参考 Anki SM-2: 4 档评分 (again/hard/good/easy), 根据 ease_factor 和
repetitions 计算下次复习间隔. 纯函数, 无副作用, 便于单测.
"""

from dataclasses import dataclass
from datetime import date, timedelta

RATING_AGAIN = "again"
RATING_HARD = "hard"
RATING_GOOD = "good"
RATING_EASY = "easy"

VALID_RATINGS = {RATING_AGAIN, RATING_HARD, RATING_GOOD, RATING_EASY}

# 掌握阈值: 连续答对次数达到此值后标记为 mastered
MASTERY_REPETITIONS = 5


@dataclass
class SRSInput:
    """复习前的 SRS 状态."""

    status: str  # new/learning/review/mastered
    ease_factor: float  # 1.3 ~ 3.0
    interval_days: int
    repetitions: int


@dataclass
class SRSOutput:
    """复习后的新 SRS 状态."""

    status: str
    ease_factor: float
    interval_days: int
    repetitions: int
    due_date: date


def schedule(
    current: SRSInput,
    rating: str,
    today: date | None = None,
) -> SRSOutput:
    """根据评分返回新的 SRS 状态.

    算法逻辑:
    - again: 重置 reps=0, interval=0, 标记 learning, ease 降 0.2
    - hard:  interval×1.2, ease 降 0.15, reps+1
    - good:  reps 0→1天, 1→3天, 2+→interval×ease, reps+1
    - easy:  加速 1.3x, ease 升 0.15, reps+1
    """
    today = today or date.today()
    ease = current.ease_factor
    interval = current.interval_days
    reps = current.repetitions

    if rating == RATING_AGAIN:
        return SRSOutput(
            status="learning",
            ease_factor=max(1.3, round(ease - 0.2, 2)),
            interval_days=0,
            repetitions=0,
            due_date=today,
        )

    if rating == RATING_HARD:
        new_ease = max(1.3, round(ease - 0.15, 2))
        new_interval = max(1, round(interval * 1.2)) if reps > 0 else 1
        new_reps = reps + 1
        return SRSOutput(
            status="review",
            ease_factor=new_ease,
            interval_days=new_interval,
            repetitions=new_reps,
            due_date=today + timedelta(days=new_interval),
        )

    if rating == RATING_GOOD:
        new_ease = ease
        if reps == 0:
            new_interval = 1
        elif reps == 1:
            new_interval = 3
        else:
            new_interval = max(1, round(interval * new_ease))
        new_reps = reps + 1
        new_status = "mastered" if new_reps >= MASTERY_REPETITIONS else "review"
        return SRSOutput(
            status=new_status,
            ease_factor=new_ease,
            interval_days=new_interval,
            repetitions=new_reps,
            due_date=today + timedelta(days=new_interval),
        )

    if rating == RATING_EASY:
        new_ease = min(3.0, round(ease + 0.15, 2))
        if reps == 0:
            new_interval = 3
        elif reps == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(interval * new_ease * 1.3))
        new_reps = reps + 1
        new_status = "mastered" if new_reps >= (MASTERY_REPETITIONS - 1) else "review"
        return SRSOutput(
            status=new_status,
            ease_factor=new_ease,
            interval_days=new_interval,
            repetitions=new_reps,
            due_date=today + timedelta(days=new_interval),
        )

    # 不应到达
    return SRSOutput(
        status=current.status,
        ease_factor=ease,
        interval_days=interval,
        repetitions=reps,
        due_date=today + timedelta(days=max(1, interval)),
    )


def initial_state() -> SRSInput:
    """新单词的初始 SRS 状态."""
    return SRSInput(
        status="new",
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
    )
