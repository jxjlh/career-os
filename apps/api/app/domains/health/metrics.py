"""手机健康数据接入层（业务路由，挂 /api/v1/health/*）。

与同目录 router.py（/health /ready 系统探针）互不影响：
- router.py 注册在根路径（无 api_prefix）
- 本文件注册在 settings.api_prefix 下（/api/v1/health/...）

多来源合并规则（重要，别改坏）：
- 同一人同一天只有一行；指标逐字段合并
- 新值非 None 且（旧值为空 或 新来源优先级 >= 旧来源优先级）才覆盖
- 即：apple_watch 能覆盖 iphone，iphone 覆盖不了 apple_watch；
  manual 只能填设备没给的空缺字段
- 同步来源的步数/距离/能量绝不相加（iPhone + Watch 双源会重复计数）
"""

import hashlib
import secrets
from datetime import date, datetime, timedelta
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import HealthDailyMetric, HealthSyncToken, Profile

logger_name = "app.domains.health.metrics"

router = APIRouter(prefix="/health", tags=["health-data"])

TZ = ZoneInfo("Asia/Shanghai")

METRIC_FIELDS = [
    "steps",
    "distance_km",
    "active_energy_kcal",
    "exercise_minutes",
    "sleep_minutes",
    "resting_hr",
]
SOURCE_PRIORITY = {"apple_watch": 4, "iphone": 3, "android": 2, "manual": 1}


# ── Schemas ────────────────────────────────────────────────────────

class HealthDayPayload(BaseModel):
    metric_date: str | None = Field(default=None, description="YYYY-MM-DD，缺省今天（Asia/Shanghai）")
    steps: int | None = Field(default=None, ge=0)
    distance_km: float | None = Field(default=None, ge=0)
    active_energy_kcal: float | None = Field(default=None, ge=0)
    exercise_minutes: int | None = Field(default=None, ge=0)
    sleep_minutes: int | None = Field(default=None, ge=0)
    resting_hr: int | None = Field(default=None, ge=20, le=250)
    source: str = Field(default="manual")
    raw: dict[str, Any] | None = None


class SyncRequest(BaseModel):
    days: list[HealthDayPayload] = Field(min_length=1, max_length=60)


class TokenCreate(BaseModel):
    device_label: str = Field(default="iPhone 快捷指令", max_length=80)


def _parse_date(value: str | None) -> date:
    if not value:
        return datetime.now(TZ).date()
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_DATE", "message": f"日期格式应为 YYYY-MM-DD：{value}"},
        ) from exc


def _user_from_sync_token(
    db: Annotated[Session, Depends(get_db)],
    x_sync_token: Annotated[str | None, Header()] = None,
    token_query: Annotated[str | None, Query(alias="token")] = None,
) -> Profile:
    """设备侧鉴权。

    正式场景（快捷指令）用 X-Sync-Token 头；
    首次在手机浏览器里直接点链接验证時，允许用 ?token= 兜底。
    """
    raw = x_sync_token or token_query
    if not raw:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "缺少 X-Sync-Token 头或 ?token= 参数"},
        )
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    row = (
        db.query(HealthSyncToken)
        .filter(HealthSyncToken.token_hash == token_hash, HealthSyncToken.revoked_at.is_(None))
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or revoked sync token"},
        )
    row.last_used_at = datetime.utcnow()
    db.commit()
    profile = db.get(Profile, row.user_id)
    if profile is None:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Unknown user"})
    return profile


def _upsert_day(db: Session, user_id: str, payload: HealthDayPayload) -> dict:
    d = _parse_date(payload.metric_date)
    new_pri = SOURCE_PRIORITY.get(payload.source, 1)

    row = (
        db.query(HealthDailyMetric)
        .filter(HealthDailyMetric.user_id == user_id, HealthDailyMetric.metric_date == d)
        .first()
    )

    if row is None:
        row = HealthDailyMetric(
            user_id=user_id,
            metric_date=d,
            source=payload.source,
            raw=payload.raw,
            **{f: getattr(payload, f) for f in METRIC_FIELDS},
        )
        db.add(row)
        db.flush()  # autoflush=False：add 后立刻返回前确保落库可见
        return {"date": d.isoformat(), "action": "created", "source": payload.source}

    old_pri = SOURCE_PRIORITY.get(row.source, 1)
    changed = False
    for f in METRIC_FIELDS:
        v = getattr(payload, f)
        if v is None:
            continue
        if getattr(row, f) is None or new_pri >= old_pri:
            setattr(row, f, v)
            changed = True
    if changed:
        row.source = payload.source
    if payload.raw is not None:
        row.raw = payload.raw
    row.updated_at = datetime.utcnow()
    db.flush()
    return {"date": d.isoformat(), "action": "updated" if changed else "skipped", "source": payload.source}


# ── 设备推送（快捷指令 / 外部设备，X-Sync-Token 鉴权）─────────────

@router.post("/sync")
def sync_health_data(
    body: SyncRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(_user_from_sync_token)],
) -> dict:
    results = [_upsert_day(db, user.id, day) for day in body.days]
    db.commit()
    return {"code": 0, "message": "ok", "data": {"results": results}}


# ── 极简同步：一个 URL 搞定 ────────────────────────────────────────
# 给 iPhone 快捷指令 / 手机浏览器书签用，不必组装 JSON 或词典。
# 鉴权复用 X-Sync-Token 头，也允许 ?token= 兜底（方便先在浏览器里点一下验证）。

@router.get("/quick")
def quick_sync(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(_user_from_sync_token)],
    # 全部按 str 接收，再自行清洗：模板网址里「没插变量的空占位」（如 steps=）
    # 若交给 FastAPI 按 int 解析会立刻 422，把同一次请求里其它有效指标一起废掉。
    steps: Annotated[str | None, Query()] = None,
    distance_km: Annotated[str | None, Query()] = None,
    active_energy_kcal: Annotated[str | None, Query()] = None,
    exercise_minutes: Annotated[str | None, Query()] = None,
    sleep_minutes: Annotated[str | None, Query()] = None,
    resting_hr: Annotated[str | None, Query()] = None,
    metric_date: Annotated[str | None, Query()] = None,
    source: Annotated[str, Query()] = "iphone",
) -> dict:
    """把 GET 参数当成一天的指标写入。

    例：/health/quick?steps=8642&sleep_minutes=420

    宽容策略——设备端（快捷指令）算出来的数值经常不规整，宁可修正也不要整条请求
    失败，否则一个异常的心率值会把同时传上来的步数一起丢掉：
    - 空字符串当「没给」处理（模板网址里留空、还没插变量的占位）
    - 睡眠：Apple Health 的时长样本经「计算统计信息」求和后单位是**秒**，
      超过 1440 一律按秒处理并换算成分钟（人不可能睡 24 小时以上）
    - 其余指标超出人体合理区间时只丢弃该字段，其它字段照常写入
    - 全部字段都不合格才返回 422
    """
    def _clean(v, lo: float, hi: float, cast):
        if v is None:
            return None
        s = str(v).strip()
        if not s:  # 空占位，跳过
            return None
        try:
            f = float(s)
        except (TypeError, ValueError):
            return None
        return cast(f) if lo <= f <= hi else None

    cleaned: dict[str, int | float] = {}
    for name, val, lo, hi, cast in (
        ("steps", steps, 0, 200000, int),
        ("distance_km", distance_km, 0, 500, float),
        ("active_energy_kcal", active_energy_kcal, 0, 20000, float),
        ("exercise_minutes", exercise_minutes, 0, 1440, int),
        ("resting_hr", resting_hr, 20, 250, int),
    ):
        got = _clean(val, lo, hi, cast)
        if got is not None:
            cleaned[name] = got

    sleep_raw = str(sleep_minutes).strip() if sleep_minutes is not None else ""
    if sleep_raw:
        try:
            sm: float | None = float(sleep_raw)
        except (TypeError, ValueError):
            sm = None
        if sm is not None:
            if 1440 < sm <= 86400:  # 设备端给的是秒
                sm = sm / 60.0
            if 0 <= sm <= 1440:
                cleaned["sleep_minutes"] = int(round(sm))

    if not cleaned:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "NO_METRIC",
                "message": "没有可用的指标值。在网址末尾加上 &steps=8642 这样的参数再试",
            },
        )

    payload = HealthDayPayload(metric_date=metric_date, source=source, **cleaned)
    result = _upsert_day(db, user.id, payload)
    db.commit()
    # accepted 回显真正写入的字段，便于排查设备端算错（如睡眠给了秒）
    return {"code": 0, "message": "ok", "data": {**result, "accepted": sorted(cleaned.keys())}}


# ── 手动补录（页面表单，登录鉴权；安卓那台走这里）────────────────

@router.post("/manual")
def manual_upsert(
    body: HealthDayPayload,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(get_current_user)],
) -> dict:
    if body.source not in ("manual", "android"):
        body.source = "manual"
    result = _upsert_day(db, user.id, body)
    db.commit()
    return {"code": 0, "message": "ok", "data": result}


# ── 查询 ──────────────────────────────────────────────────────────

def _serialize(row: HealthDailyMetric) -> dict:
    return {
        "date": row.metric_date.isoformat(),
        "steps": row.steps,
        "distanceKm": row.distance_km,
        "activeEnergyKcal": row.active_energy_kcal,
        "exerciseMinutes": row.exercise_minutes,
        "sleepMinutes": row.sleep_minutes,
        "restingHr": row.resting_hr,
        "source": row.source,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/daily")
def get_daily(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(get_current_user)],
    from_date: Annotated[str | None, Query(alias="from")] = None,
    to_date: Annotated[str | None, Query(alias="to")] = None,
) -> dict:
    today = datetime.now(TZ).date()
    d_to = _parse_date(to_date) if to_date else today
    d_from = _parse_date(from_date) if from_date else d_to - timedelta(days=6)
    if d_from > d_to:
        d_from, d_to = d_to, d_from

    rows = (
        db.query(HealthDailyMetric)
        .filter(
            HealthDailyMetric.user_id == user.id,
            HealthDailyMetric.metric_date >= d_from,
            HealthDailyMetric.metric_date <= d_to,
        )
        .order_by(HealthDailyMetric.metric_date.asc())
        .all()
    )
    return {"code": 0, "message": "ok", "data": {"from": d_from.isoformat(), "to": d_to.isoformat(), "days": [_serialize(r) for r in rows]}}


@router.get("/summary")
def get_summary(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(get_current_user)],
    days: int = Query(default=7, ge=1, le=90),
) -> dict:
    today = datetime.now(TZ).date()
    d_from = today - timedelta(days=days - 1)
    rows = (
        db.query(HealthDailyMetric)
        .filter(
            HealthDailyMetric.user_id == user.id,
            HealthDailyMetric.metric_date >= d_from,
            HealthDailyMetric.metric_date <= today,
        )
        .all()
    )
    n = len(rows)

    def _avg(field: str) -> float | None:
        vals = [getattr(r, field) for r in rows if getattr(r, field) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "days": days,
            "daysWithData": n,
            "avgSteps": _avg("steps"),
            "avgSleepMinutes": _avg("sleep_minutes"),
            "avgRestingHr": _avg("resting_hr"),
            "avgActiveEnergyKcal": _avg("active_energy_kcal"),
            "totalDistanceKm": round(sum(r.distance_km for r in rows if r.distance_km), 1) if any(r.distance_km for r in rows) else None,
        },
    }


@router.get("/status")
def get_status(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(get_current_user)],
) -> dict:
    today = datetime.now(TZ).date()
    d_from = today - timedelta(days=6)
    rows = (
        db.query(HealthDailyMetric)
        .filter(
            HealthDailyMetric.user_id == user.id,
            HealthDailyMetric.metric_date >= d_from,
        )
        .order_by(HealthDailyMetric.metric_date.desc())
        .all()
    )
    device_rows = [r for r in rows if r.source != "manual"]
    last_synced = max((r.updated_at or r.created_at for r in device_rows), default=None)
    tokens = (
        db.query(HealthSyncToken)
        .filter(HealthSyncToken.user_id == user.id, HealthSyncToken.revoked_at.is_(None))
        .order_by(HealthSyncToken.created_at.desc())
        .all()
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "lastSyncedAt": last_synced.isoformat() + "Z" if last_synced else None,
            "last7DaysCovered": len(rows),
            "sources": sorted({r.source for r in rows}),
            "tokens": [
                {
                    "id": t.id,
                    "deviceLabel": t.device_label,
                    "createdAt": t.created_at.isoformat() + "Z",
                    "lastUsedAt": t.last_used_at.isoformat() + "Z" if t.last_used_at else None,
                }
                for t in tokens
            ],
        },
    }


# ── 设备令牌管理 ─────────────────────────────────────────────────

@router.post("/tokens")
def create_token(
    body: TokenCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(get_current_user)],
) -> dict:
    plaintext = secrets.token_urlsafe(24)
    row = HealthSyncToken(
        user_id=user.id,
        token_hash=hashlib.sha256(plaintext.encode()).hexdigest(),
        device_label=body.device_label,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "id": row.id,
            "token": plaintext,  # 明文只在创建这一次返回
            "deviceLabel": row.device_label,
        },
    }


@router.delete("/tokens/{token_id}")
def revoke_token(
    token_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[Profile, Depends(get_current_user)],
) -> dict:
    row = (
        db.query(HealthSyncToken)
        .filter(HealthSyncToken.id == token_id, HealthSyncToken.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Token not found"})
    row.revoked_at = datetime.utcnow()
    db.commit()
    return {"code": 0, "message": "ok", "data": {"id": row.id, "revoked": True}}
