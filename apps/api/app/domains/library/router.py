from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Bookmark, BookmarkTag, LearningResource, Profile, Tag

router = APIRouter(tags=["library"])


class BookmarkCreate(BaseModel):
    resourceId: str
    note: str | None = None


class BookmarkUpdate(BaseModel):
    note: str | None = None


class TagCreate(BaseModel):
    name: str
    color: str | None = None


def bookmark_dict(db: Session, bookmark: Bookmark) -> dict:
    resource = db.get(LearningResource, bookmark.resource_id)
    tags = (
        db.query(Tag)
        .join(BookmarkTag, BookmarkTag.tag_id == Tag.id)
        .filter(BookmarkTag.bookmark_id == bookmark.id)
        .all()
    )
    return {
        "bookmarkId": bookmark.id,
        "resourceId": bookmark.resource_id,
        "title": resource.title if resource else None,
        "url": resource.url if resource else None,
        "note": bookmark.note,
        "tags": [{"id": tag.id, "name": tag.name, "color": tag.color} for tag in tags],
        "createdAt": bookmark.created_at.isoformat(),
    }


@router.get("/library/bookmarks")
def list_bookmarks(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    bookmarks = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
        .all()
    )
    return {"data": [bookmark_dict(db, b) for b in bookmarks]}


@router.post("/library/bookmarks", status_code=201)
def create_bookmark(
    payload: BookmarkCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    resource = db.get(LearningResource, payload.resourceId)
    if resource is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Resource not found"})
    existing = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id, Bookmark.resource_id == payload.resourceId)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail={"code": "CONFLICT", "message": "Already bookmarked"})
    bookmark = Bookmark(user_id=current_user.id, resource_id=payload.resourceId, note=payload.note)
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return {"data": bookmark_dict(db, bookmark)}


@router.patch("/library/bookmarks/{bookmark_id}")
def update_bookmark(
    bookmark_id: str,
    payload: BookmarkUpdate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if bookmark is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bookmark not found"})
    if payload.note is not None:
        bookmark.note = payload.note
    db.commit()
    db.refresh(bookmark)
    return {"data": bookmark_dict(db, bookmark)}


@router.delete("/library/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(
    bookmark_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if bookmark is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bookmark not found"})
    db.delete(bookmark)
    db.commit()


@router.get("/library/tags")
def list_tags(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    tags = db.query(Tag).filter(Tag.user_id == current_user.id).order_by(Tag.name).all()
    return {"data": [{"id": t.id, "name": t.name, "color": t.color} for t in tags]}


@router.post("/library/tags", status_code=201)
def create_tag(
    payload: TagCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    tag = Tag(user_id=current_user.id, name=payload.name, color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return {"data": {"id": tag.id, "name": tag.name, "color": tag.color}}


@router.post("/library/bookmarks/{bookmark_id}/tags", status_code=201)
def add_tag_to_bookmark(
    bookmark_id: str,
    tag_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if bookmark is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bookmark not found"})
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if tag is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Tag not found"})
    existing = (
        db.query(BookmarkTag)
        .filter(BookmarkTag.bookmark_id == bookmark.id, BookmarkTag.tag_id == tag.id)
        .first()
    )
    if existing is None:
        db.add(BookmarkTag(bookmark_id=bookmark.id, tag_id=tag.id))
        db.commit()
    return {"data": bookmark_dict(db, bookmark)}


@router.delete("/library/bookmarks/{bookmark_id}/tags/{tag_id}", status_code=204)
def remove_tag_from_bookmark(
    bookmark_id: str,
    tag_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if bookmark is None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bookmark not found"})
    link = (
        db.query(BookmarkTag)
        .filter(BookmarkTag.bookmark_id == bookmark.id, BookmarkTag.tag_id == tag_id)
        .first()
    )
    if link:
        db.delete(link)
        db.commit()
