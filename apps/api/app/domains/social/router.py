from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.models import Profile
from app.domains.social.schemas import (
    CreateCommentRequest,
    CreatePostRequest,
    CreateSharedGoalRequest,
    FriendRequestCreate,
)
from app.domains.social.service import (
    FriendService,
    RankingService,
    SharedGoalService,
    SocialOverviewService,
    SocialPostService,
)

router = APIRouter(tags=["social"])


# ── 概览 ────────────────────────────────────────────────────────────
@router.get("/social/overview")
def social_overview(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SocialOverviewService(db).overview(current_user.id)}


# ── 好友 ────────────────────────────────────────────────────────────
@router.get("/social/friends")
def list_friends(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": FriendService(db).list_friends(current_user.id)}


@router.get("/social/friends/search")
def search_friends(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str, Query(min_length=1)] = "",
) -> dict:
    return {"data": FriendService(db).search(current_user.id, q)}


@router.post("/social/friend-requests")
def send_friend_request(
    payload: FriendRequestCreate,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": FriendService(db).send_request(current_user.id, payload.to_user_id, payload.email, payload.message)}


@router.get("/social/friend-requests")
def list_incoming_requests(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": FriendService(db).list_incoming(current_user.id)}


@router.post("/social/friend-requests/{request_id}/accept")
def accept_friend_request(
    request_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": FriendService(db).accept(request_id, current_user.id)}


@router.post("/social/friend-requests/{request_id}/reject")
def reject_friend_request(
    request_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    FriendService(db).reject(request_id, current_user.id)
    return {"data": {"ok": True}}


@router.delete("/social/friends/{friend_id}")
def remove_friend(
    friend_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    FriendService(db).remove_friend(current_user.id, friend_id)
    return {"data": {"ok": True}}


# ── 动态 Feed ──────────────────────────────────────────────────────
@router.get("/social/feed")
def list_feed(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> dict:
    return {"data": SocialPostService(db).feed(current_user.id, offset, limit)}


@router.post("/social/posts", status_code=201)
def create_post(
    payload: CreatePostRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SocialPostService(db).create_post(current_user.id, payload)}


@router.get("/social/posts/{post_id}")
def get_post(
    post_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SocialPostService(db).get_post(post_id, current_user.id)}


@router.post("/social/posts/{post_id}/like")
def toggle_like(
    post_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SocialPostService(db).toggle_like(post_id, current_user.id)}


@router.get("/social/posts/{post_id}/comments")
def list_comments(
    post_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SocialPostService(db).list_comments(post_id)}


@router.post("/social/posts/{post_id}/comments", status_code=201)
def add_comment(
    post_id: str,
    payload: CreateCommentRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SocialPostService(db).add_comment(post_id, current_user.id, payload.content)}


# ── 共同目标 ────────────────────────────────────────────────────────
@router.get("/social/shared-goals")
def list_shared_goals(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SharedGoalService(db).list_mine(current_user.id)}


@router.post("/social/shared-goals", status_code=201)
def create_shared_goal(
    payload: CreateSharedGoalRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {
        "data": SharedGoalService(db).create(
            current_user.id, payload.life_goal_id, payload.visibility, payload.invite_user_ids
        )
    }


@router.post("/social/shared-goals/{shared_id}/join")
def join_shared_goal(
    shared_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SharedGoalService(db).join(shared_id, current_user.id)}


@router.get("/social/shared-goals/{shared_id}/members")
def list_shared_members(
    shared_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return {"data": SharedGoalService(db).members(shared_id, current_user.id)}


# ── 排行榜 ──────────────────────────────────────────────────────────
@router.get("/social/ranking")
def get_ranking(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    metric: Annotated[str, Query()] = "xp",
    period: Annotated[str, Query()] = "all",
) -> dict:
    return {"data": RankingService(db).ranking(current_user.id, metric, period)}
