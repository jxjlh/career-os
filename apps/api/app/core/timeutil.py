"""统一时区工具。

服务器容器跑在 UTC，而用户在中国。此前所有 `date.today()` 都按 UTC 计算，
导致北京时间周一 00:00–08:00 之间还被算成「上周日」：周计划、每日总结、今日任务
在不同设备上会落到不同的周/日 —— 表现为「手机端和电脑端数据不同步」。

统一改为按用户时区（默认 Asia/Shanghai，可用 APP_TIMEZONE 覆盖）计算日期。
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings

DEFAULT_TZ = "Asia/Shanghai"


def user_timezone() -> ZoneInfo:
    name = (get_settings().app_timezone or DEFAULT_TZ).strip()
    try:
        return ZoneInfo(name)
    except Exception:  # noqa: BLE001 - 时区名写错时退回上海，不能让服务起不来
        return ZoneInfo(DEFAULT_TZ)


def today() -> date:
    """用户时区下的『今天』。"""
    return datetime.now(user_timezone()).date()


def week_start(day: date | None = None) -> date:
    """用户时区下的『本周一』（day 缺省=今天）。"""
    target = day or today()
    return target - timedelta(days=target.weekday())


def now_local() -> datetime:
    return datetime.now(user_timezone())
