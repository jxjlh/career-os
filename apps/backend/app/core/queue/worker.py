"""ARQ + Redis async queue worker.

Handles long-running background tasks:
- YouTube content crawling
- Multi-engine aggregated search
- Batch embedding generation
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

from arq import ArqRedis, create_pool
from arq.connections import RedisSettings

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class TaskResult:
    """Standard task return structure."""

    task_id: str
    status: str
    result: dict | None = None
    error: str | None = None


# ── Background task definitions ───────────────────────────────


async def youtube_crawl_task(ctx: dict, url: str) -> TaskResult:
    """Crawl a YouTube video transcript/metadata.

    Pushed to the queue because it's I/O-bound and may take 5-30s.
    """
    task_id = ctx.get("job_id", "unknown")
    logger.info("Starting YouTube crawl for %s (task: %s)", url, task_id)

    try:
        # Placeholder: integrate youtube-transcript-api or yt-dlp
        transcript = await _fetch_youtube_transcript(url)
        return TaskResult(
            task_id=task_id,
            status="success",
            result={"url": url, "transcript": transcript[:500]},
        )
    except Exception as e:
        logger.error("YouTube crawl failed: %s", e)
        return TaskResult(task_id=task_id, status="failed", error=str(e))


async def aggregated_search_task(ctx: dict, query: str) -> TaskResult:
    """Multi-engine aggregated search.

    Uses AggregatedSearch to query all configured providers concurrently.
    """
    from app.core.search.base import AggregatedSearch

    task_id = ctx.get("job_id", "unknown")
    logger.info("Starting aggregated search for '%s' (task: %s)", query, task_id)

    try:
        search = AggregatedSearch(providers=[])  # populated at runtime
        response = await search.query(query, max_per_provider=5)

        return TaskResult(
            task_id=task_id,
            status="success",
            result={
                "query": response.query,
                "total": response.total,
                "results": [asdict(r) for r in response.results[:10]],
                "providers_used": response.providers_used,
            },
        )
    except Exception as e:
        logger.error("Aggregated search failed: %s", e)
        return TaskResult(task_id=task_id, status="failed", error=str(e))


async def _fetch_youtube_transcript(url: str) -> str:
    """Placeholder for YouTube transcript fetching."""
    return f"[Transcript for {url}]"


# ── ARQ Worker configuration ──────────────────────────────────


class WorkerSettings:
    """ARQ worker settings — referenced by `arq app.core.queue.worker.WorkerSettings`."""

    functions = [youtube_crawl_task, aggregated_search_task]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    job_timeout = 300
    queue_name = "ai-aggregation"
    health_check_interval = 30


# ── Queue client helper ──────────────────────────────────────


async def get_redis() -> ArqRedis:
    """Get a connected ARQ Redis client for enqueuing tasks."""
    return await create_pool(WorkerSettings.redis_settings)


async def enqueue_task(
    func_name: str,
    *args,
    **kwargs,
) -> str:
    """Enqueue a background task and return the job ID."""
    redis = await get_redis()
    job = await redis.enqueue_job(func_name, *args, **kwargs)
    return job.job_id if job else ""
