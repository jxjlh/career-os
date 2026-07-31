import asyncio
import hashlib
import time
from datetime import datetime
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.security import get_current_user
from app.db.models import BackgroundJob, LearningResource, Profile, SearchQuery, SearchResult
from app.providers.search.registry import get_provider_list, get_search_providers

router = APIRouter(tags=["explorer"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    providers: list[str] = Field(default_factory=list)
    filters: dict = Field(default_factory=dict)
    limit: int = Field(default=10, ge=1, le=50)


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    return f"{host}{parsed.path.rstrip('/')}".lower()


def url_hash(normalized: str) -> str:
    return hashlib.sha256(normalized.encode()).hexdigest()


def resource_dict(resource: LearningResource, state: str = "discovered") -> dict:
    return {
        "resourceId": resource.id,
        "title": resource.title,
        "description": resource.description,
        "provider": resource.provider,
        "sourceName": resource.source_name,
        "type": resource.resource_type,
        "language": resource.language,
        "difficulty": resource.difficulty,
        "durationMinutes": resource.duration_minutes,
        "isOfficial": resource.is_official,
        "isFree": resource.is_free,
        "url": resource.url,
        "publishedAt": resource.published_at.isoformat() if resource.published_at else None,
        "myState": state,
    }


async def run_search_job(job_id: str, query: str, limit: int, language: str) -> None:
    started = time.monotonic()
    providers = get_search_providers()
    responses = await asyncio.gather(
        *(provider.search(query, limit=limit, language=language) for provider in providers),
        return_exceptions=True,
    )
    collected: list[dict] = []
    for response in responses:
        if isinstance(response, Exception):
            continue
        collected.extend(response)

    db = SessionLocal()
    try:
        job = db.get(BackgroundJob, job_id)
        if job is None:
            return

        search_query = SearchQuery(
            user_id=job.user_id,
            query=query,
            raw_query=query,
            result_count=0,
            ai_reranked=False,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        db.add(search_query)
        db.flush()

        ranked: list[tuple[LearningResource, str]] = []
        seen: set[str] = set()
        for item in collected:
            normalized = normalize_url(item.get("url", ""))
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            resource = (
                db.query(LearningResource).filter(LearningResource.normalized_url == normalized).first()
            )
            if resource is None:
                published = None
                raw_date = item.get("published_at")
                if raw_date:
                    try:
                        published = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
                    except ValueError:
                        published = None
                resource = LearningResource(
                    url=item.get("url", ""),
                    normalized_url=normalized,
                    title=item.get("title", "Untitled"),
                    description=item.get("snippet"),
                    provider=item.get("provider", "other"),
                    resource_type=item.get("resource_type", "article"),
                    source_name=item.get("source_name"),
                    language=item.get("language", language),
                    difficulty=item.get("difficulty"),
                    duration_minutes=item.get("duration_minutes"),
                    published_at=published,
                    is_official=item.get("is_official", False),
                    is_free=item.get("is_free", True),
                    normalized_hash=url_hash(normalized),
                )
                db.add(resource)
                db.flush()
            ranked.append((resource, item.get("provider", "other")))

        for index, (resource, provider) in enumerate(ranked[:limit]):
            db.add(
                SearchResult(
                    query_id=search_query.id,
                    resource_id=resource.id,
                    provider=provider,
                    rank=index,
                    score=round(1 - index * 0.01, 4),
                    title=resource.title,
                    url=resource.url,
                    snippet=resource.description,
                )
            )

        search_query.result_count = len(ranked[:limit])
        job.status = "succeeded"
        job.result = {
            "queryId": search_query.id,
            "items": [resource_dict(resource) for resource, _ in ranked[:limit]],
        }
        db.commit()
    finally:
        db.close()


@router.post("/explore/search", status_code=202)
def explore_search(
    payload: SearchRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = BackgroundJob(
        user_id=current_user.id,
        job_type="search",
        payload={"query": payload.query, "providers": payload.providers, "filters": payload.filters},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_search_job, job.id, payload.query, payload.limit, current_user.language)
    return {
        "data": {
            "jobId": job.id,
            "status": job.status,
            "pollUrl": f"/api/v1/explore/jobs/{job.id}",
        }
    }


@router.get("/explore/jobs/{job_id}")
def get_explore_job(
    job_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    job = db.get(BackgroundJob, job_id)
    if job is None or (job.user_id and job.user_id != current_user.id):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Job not found"})
    return {
        "data": {
            "jobId": job.id,
            "status": job.status,
            "result": job.result or {},
            "error": job.error,
        }
    }


@router.get("/explore/history")
def explore_history(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    queries = (
        db.query(SearchQuery)
        .filter(SearchQuery.user_id == current_user.id)
        .order_by(SearchQuery.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "data": [
            {
                "id": q.id,
                "query": q.query,
                "resultCount": q.result_count,
                "createdAt": q.created_at.isoformat(),
            }
            for q in queries
        ]
    }


@router.get("/explore/providers")
def explore_providers() -> dict:
    return {"data": get_provider_list()}
