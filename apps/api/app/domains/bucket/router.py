from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.bucket.service import BucketService

router = APIRouter(tags=["bucket"])


@router.get("/life/bucket/categories")
def list_categories(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": BucketService(db).list_categories(current_user.id)}


@router.get("/life/bucket/progress")
def bucket_progress(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": BucketService(db).progress(current_user.id)}


@router.get("/life/bucket/items")
def list_items(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    category_id: Annotated[str | None, Query()] = None,
    country: Annotated[str | None, Query(max_length=80)] = None,
    city: Annotated[str | None, Query(max_length=120)] = None,
    tag: Annotated[str | None, Query(max_length=60)] = None,
    difficulty: Annotated[int | None, Query(ge=1, le=5)] = None,
    season: Annotated[str | None, Query(max_length=40)] = None,
    completed: Annotated[bool | None, Query()] = None,
    sort: Annotated[str, Query()] = "popular",
    lat: Annotated[float | None, Query()] = None,
    lng: Annotated[float | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> dict:
    return {
        "data": BucketService(db).list_items(
            current_user.id,
            q=q,
            category_id=category_id,
            country=country,
            city=city,
            tag=tag,
            difficulty=difficulty,
            season=season,
            completed=completed,
            sort=sort,
            lat=lat,
            lng=lng,
            page=page,
            page_size=page_size,
        )
    }


@router.get("/life/bucket/items/{item_id}")
def get_item(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = BucketService(db).get_item(current_user.id, item_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bucket item not found"})
    return {"data": result}


@router.post("/life/bucket/items/{item_id}/join", status_code=201)
def join_item(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": BucketService(db).join(current_user.id, item_id)}


@router.delete("/life/bucket/items/{item_id}/join", status_code=204)
def unjoin_item(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not BucketService(db).unjoin(current_user.id, item_id):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Not joined"})


@router.post("/life/bucket/items/{item_id}/favorite")
def toggle_favorite(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = BucketService(db).toggle_favorite(current_user.id, item_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Not joined"})
    return {"data": result}


@router.post("/life/bucket/items/{item_id}/wishlist")
def toggle_wishlist(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = BucketService(db).toggle_wishlist(current_user.id, item_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Not joined"})
    return {"data": result}


@router.post("/life/bucket/items/{item_id}/complete")
def complete_item(
    item_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    result = BucketService(db).complete(current_user.id, item_id)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Not joined"})
    return {"data": result}
