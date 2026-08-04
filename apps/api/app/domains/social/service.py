from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import (
    BucketItem,
    CheckinStreak,
    FriendRequest,
    LifeGoal,
    LifeRecord,
    Profile,
    SocialPost,
    UserBucketItem,
    UserLevel,
)
from app.domains.social.repository import (
    CommentRepository,
    FriendRepository,
    FriendRequestRepository,
    LikeRepository,
    NotificationRepository,
    SharedGoalRepository,
    SocialPostRepository,
    _profile_summary,
)
from app.domains.social.schemas import (
    CommentItem,
    FriendItem,
    FriendRequestItem,
    PostItem,
    ProfileSearchItem,
    ProfileSummary,
    RankingItem,
    RankingResponse,
    SharedGoalItem,
    SocialOverview,
)


def _iso(dt: datetime | None) -> str:
    return dt.isoformat() if dt else ""


class FriendService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.friends = FriendRepository(db)
        self.requests = FriendRequestRepository(db)
        self.notifications = NotificationRepository(db)

    def _friend_ids(self, user_id: str) -> list[str]:
        return [f.id for f in self.friends.list_friends(user_id)]

    def list_friends(self, user_id: str) -> list[FriendItem]:
        return [
            FriendItem(profile=ProfileSummary(**_profile_summary(p)), created_at="")
            for p in self.friends.list_friends(user_id)
        ]

    def search(self, user_id: str, keyword: str) -> list[ProfileSearchItem]:
        if not keyword or len(keyword.strip()) < 1:
            return []
        profiles = self.requests.search_profiles(user_id, keyword.strip())
        friend_ids = set(self._friend_ids(user_id))
        # 已发出的 pending 申请
        outgoing = {
            r.to_user
            for r, _ in self.requests.list_outgoing(user_id)
            if r.status == "pending"
        }
        return [
            ProfileSearchItem(
                id=p.id,
                display_name=p.display_name or p.email.split("@")[0],
                avatar_url=p.avatar_url,
                current_title=p.current_title,
                is_friend=p.id in friend_ids,
                request_pending=p.id in outgoing,
            )
            for p in profiles
        ]

    def send_request(self, from_user: str, to_user_id: str | None, email: str | None, message: str | None) -> FriendRequestItem:
        target = None
        if to_user_id:
            target = self.db.get(Profile, to_user_id)
        elif email:
            target = self.requests.find_by_email(email)
        if target is None:
            raise AppError(code="NOT_FOUND", message="用户不存在", status=404)
        if target.id == from_user:
            raise AppError(code="BAD_REQUEST", message="不能向自己发送好友申请", status=400)
        if self.friends.are_friends(from_user, target.id):
            raise AppError(code="BAD_REQUEST", message="你们已经是好友了", status=400)

        # 若对方已向我发过申请, 直接接受 (双向匹配)
        incoming = self.requests.get_pending(from_user=target.id, to_user=from_user)
        if incoming is not None:
            self._accept(incoming, from_user)
            return FriendRequestItem(
                id=incoming.id,
                from_user=ProfileSummary(**_profile_summary(target)),
                message=incoming.message,
                status="accepted",
                created_at=_iso(incoming.created_at),
            )

        # 查找已存在的申请 (含 rejected/accepted 状态, 受唯一约束限制)
        existing = self.requests.get_by_pair(from_user=from_user, to_user=target.id)
        if existing is not None:
            if existing.status == "pending":
                return FriendRequestItem(
                    id=existing.id,
                    from_user=ProfileSummary(**_profile_summary(self.db.get(Profile, from_user))),
                    message=existing.message,
                    status="pending",
                    created_at=_iso(existing.created_at),
                )
            elif existing.status == "rejected":
                # 被拒绝的申请: 更新为 pending, 允许重新发送
                existing.status = "pending"
                existing.message = message
                self.db.commit()
                self.db.refresh(existing)
                return FriendRequestItem(
                    id=existing.id,
                    from_user=ProfileSummary(**_profile_summary(self.db.get(Profile, from_user))),
                    message=existing.message,
                    status="pending",
                    created_at=_iso(existing.created_at),
                )
            elif existing.status == "accepted":
                # 已接受但好友关系未建立的极端情况
                if not self.friends.are_friends(from_user, target.id):
                    self._accept(existing, from_user)
                    return FriendRequestItem(
                        id=existing.id,
                        from_user=ProfileSummary(**_profile_summary(target)),
                        message=existing.message,
                        status="accepted",
                        created_at=_iso(existing.created_at),
                    )
                raise AppError(code="BAD_REQUEST", message="你们已经是好友了", status=400)

        req = self.requests.create_request(from_user, target.id, message)
        self.notifications.create(
            user_id=target.id,
            type="friend_request",
            title="收到一条好友申请",
            body=message or f"{from_user} 想和你成为好友",
            link="/life/friends",
        )
        return FriendRequestItem(
            id=req.id,
            from_user=ProfileSummary(**_profile_summary(self.db.get(Profile, from_user))),
            message=req.message,
            status="pending",
            created_at=_iso(req.created_at),
        )

    def list_incoming(self, user_id: str) -> list[FriendRequestItem]:
        return [
            FriendRequestItem(
                id=req.id,
                from_user=ProfileSummary(**_profile_summary(p)),
                message=req.message,
                status=req.status,
                created_at=_iso(req.created_at),
            )
            for req, p in self.requests.list_incoming(user_id)
        ]

    def accept(self, request_id: str, user_id: str) -> FriendRequestItem:
        req = self.requests.update_status(request_id, "accepted")
        if req is None:
            raise AppError(code="NOT_FOUND", message="好友申请不存在", status=404)
        if req.to_user != user_id:
            raise AppError(code="FORBIDDEN", message="无权处理此申请", status=403)
        self._accept(req, user_id)
        return FriendRequestItem(
            id=req.id,
            from_user=ProfileSummary(**_profile_summary(self.db.get(Profile, req.from_user))),
            message=req.message,
            status="accepted",
            created_at=_iso(req.created_at),
        )

    def _accept(self, req: FriendRequest, accepter_id: str) -> None:
        self.friends.add_pair(req.from_user, req.to_user)
        # 通知对方申请已被接受
        self.notifications.create(
            user_id=req.from_user,
            type="friend_accepted",
            title="好友申请已通过",
            body="你们已成为好友, 一起成长吧!",
            link="/life/friends",
        )

    def reject(self, request_id: str, user_id: str) -> None:
        req = self.requests.update_status(request_id, "rejected")
        if req is None:
            raise AppError(code="NOT_FOUND", message="好友申请不存在", status=404)
        if req.to_user != user_id:
            raise AppError(code="FORBIDDEN", message="无权处理此申请", status=403)

    def remove_friend(self, user_id: str, friend_id: str) -> None:
        if not self.friends.are_friends(user_id, friend_id):
            raise AppError(code="NOT_FOUND", message="你们不是好友", status=404)
        self.friends.remove_pair(user_id, friend_id)


class SocialPostService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.posts = SocialPostRepository(db)
        self.likes = LikeRepository(db)
        self.comments = CommentRepository(db)
        self.friends = FriendRepository(db)
        self.notifications = NotificationRepository(db)

    def _friend_ids(self, user_id: str) -> list[str]:
        return [f.id for f in self.friends.list_friends(user_id)]

    def feed(self, user_id: str, offset: int, limit: int) -> list[PostItem]:
        friend_ids = self._friend_ids(user_id)
        items = self.posts.feed_for_user(user_id, friend_ids, offset, limit)
        return [self._to_item(p, user_id) for p in items]

    def get_post(self, post_id: str, user_id: str) -> PostItem:
        friend_ids = self._friend_ids(user_id)
        post = self.posts.get_visible(post_id, user_id, friend_ids)
        if post is None:
            raise AppError(code="NOT_FOUND", message="动态不存在或不可见", status=404)
        return self._to_item(post, user_id)

    def create_post(self, user_id: str, payload) -> PostItem:
        post = self.posts.create(
            user_id,
            content=payload.content,
            photos=payload.photos,
            videos=payload.videos,
            visibility=payload.visibility,
            life_record_id=payload.life_record_id,
            bucket_item_id=payload.bucket_item_id,
        )
        return self._to_item(post, user_id)

    def toggle_like(self, post_id: str, user_id: str) -> dict:
        post = self.posts.get(post_id)
        if post is None:
            raise AppError(code="NOT_FOUND", message="动态不存在", status=404)
        liked = self.likes.toggle(user_id, post_id)
        if liked and post.user_id != user_id:
            self.notifications.create(
                user_id=post.user_id,
                type="like",
                title="你的动态收到一个赞",
                body="有人点赞了你的动态",
                link=f"/life/post/{post_id}",
            )
        return {"liked": liked, "likesCount": post.likes_count}

    def list_comments(self, post_id: str) -> list[CommentItem]:
        rows = self.comments.list_by_post(post_id)
        return [
            CommentItem(
                id=c.id,
                user=ProfileSummary(**_profile_summary(p)),
                content=c.content,
                created_at=_iso(c.created_at),
            )
            for c, p in rows
        ]

    def add_comment(self, post_id: str, user_id: str, content: str) -> CommentItem:
        post = self.posts.get(post_id)
        if post is None:
            raise AppError(code="NOT_FOUND", message="动态不存在", status=404)
        c = self.comments.create(user_id, post_id, content)
        if post.user_id != user_id:
            self.notifications.create(
                user_id=post.user_id,
                type="comment",
                title="你的动态收到一条评论",
                body=content[:80],
                link=f"/life/post/{post_id}",
            )
        return CommentItem(
            id=c.id,
            user=ProfileSummary(**_profile_summary(self.db.get(Profile, user_id))),
            content=c.content,
            created_at=_iso(c.created_at),
        )

    def _to_item(self, post: SocialPost, user_id: str) -> PostItem:
        author = self.db.get(Profile, post.user_id)
        return PostItem(
            id=post.id,
            user=ProfileSummary(**_profile_summary(author)) if author else ProfileSummary(id=post.user_id, display_name="未知用户"),
            content=post.content,
            photos=post.photos or [],
            videos=post.videos or [],
            visibility=post.visibility,
            likes_count=post.likes_count or 0,
            comments_count=post.comments_count or 0,
            liked_by_me=self.likes.is_liked(user_id, post.id),
            life_record_id=post.life_record_id,
            bucket_item_id=post.bucket_item_id,
            created_at=_iso(post.created_at),
        )


class SharedGoalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.shared = SharedGoalRepository(db)
        self.friends = FriendRepository(db)
        self.notifications = NotificationRepository(db)

    def list_mine(self, user_id: str) -> list[SharedGoalItem]:
        items = self.shared.list_for_user(user_id)
        result = []
        for sg in items:
            members_count = len(self.shared.list_members(sg.id))
            goal = self.db.get(LifeGoal, sg.life_goal_id)
            result.append(
                SharedGoalItem(
                    id=sg.id,
                    life_goal_id=sg.life_goal_id,
                    life_goal_title=goal.title if goal else None,
                    owner=ProfileSummary(**_profile_summary(self.db.get(Profile, sg.owner_id))),
                    visibility=sg.visibility,
                    share_code=sg.share_code,
                    members_count=members_count,
                    joined=True,
                    created_at=_iso(sg.created_at),
                )
            )
        return result

    def create(self, user_id: str, life_goal_id: str, visibility: str, invite_user_ids: list[str]) -> SharedGoalItem:
        goal = self.db.get(LifeGoal, life_goal_id)
        if goal is None or goal.user_id != user_id:
            raise AppError(code="NOT_FOUND", message="人生目标不存在或不属于你", status=404)
        share_code = None
        if visibility in ("link", "public"):
            import secrets

            share_code = secrets.token_urlsafe(6)[:12]
        sg = self.shared.create(owner_id=user_id, life_goal_id=life_goal_id, visibility=visibility, share_code=share_code)
        # 邀请好友加入
        for invitee_id in invite_user_ids:
            if invitee_id == user_id:
                continue
            if not self.friends.are_friends(user_id, invitee_id):
                continue
            if not self.shared.is_member(sg.id, invitee_id):
                self.shared.add_member(sg.id, invitee_id)
                self.notifications.create(
                    user_id=invitee_id,
                    type="shared_goal_invite",
                    title="你被邀请加入共同目标",
                    body=f"一起完成「{goal.title}」吧!",
                    link="/life/shared",
                )
        members_count = len(self.shared.list_members(sg.id))
        return SharedGoalItem(
            id=sg.id,
            life_goal_id=sg.life_goal_id,
            life_goal_title=goal.title,
            owner=ProfileSummary(**_profile_summary(self.db.get(Profile, user_id))),
            visibility=sg.visibility,
            share_code=sg.share_code,
            members_count=members_count,
            joined=True,
            created_at=_iso(sg.created_at),
        )

    def join(self, shared_id: str, user_id: str) -> SharedGoalItem:
        sg = self.shared.get(shared_id)
        if sg is None:
            raise AppError(code="NOT_FOUND", message="共同目标不存在", status=404)
        # friends 可见需为好友; public/link 任何人可加入
        if sg.visibility == "friends" and not self.friends.are_friends(sg.owner_id, user_id):
            raise AppError(code="FORBIDDEN", message="仅好友可加入此共同目标", status=403)
        if self.shared.is_member(shared_id, user_id):
            pass  # 幂等
        else:
            self.shared.add_member(shared_id, user_id)
        members_count = len(self.shared.list_members(sg.id))
        goal = self.db.get(LifeGoal, sg.life_goal_id)
        return SharedGoalItem(
            id=sg.id,
            life_goal_id=sg.life_goal_id,
            life_goal_title=goal.title if goal else None,
            owner=ProfileSummary(**_profile_summary(self.db.get(Profile, sg.owner_id))),
            visibility=sg.visibility,
            share_code=sg.share_code,
            members_count=members_count,
            joined=True,
            created_at=_iso(sg.created_at),
        )

    def members(self, shared_id: str, user_id: str) -> list[dict]:
        sg = self.shared.get(shared_id)
        if sg is None:
            raise AppError(code="NOT_FOUND", message="共同目标不存在", status=404)
        if not self.shared.is_member(shared_id, user_id):
            raise AppError(code="FORBIDDEN", message="你未加入此共同目标", status=403)
        rows = self.shared.list_members(shared_id)
        return [
            {
                "user": ProfileSummary(**_profile_summary(p)),
                "role": m.role,
                "joinedAt": _iso(m.joined_at),
            }
            for m, p in rows
        ]


class RankingService:
    """聚合 XP / 连续打卡 / Bucket / Life Goal / 城市 / 国家 / Achievement 多维度排行榜."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def ranking(self, user_id: str, metric: str, period: str) -> RankingResponse:
        """返回含当前用户的排行榜 (自己 + 好友). period: today/week/month/all."""
        friend_ids = [f.id for f in FriendRepository(self.db).list_friends(user_id)]
        scope_ids = [user_id, *friend_ids]
        rows = self._compute(metric, period, scope_ids, user_id)
        return RankingResponse(metric=metric, period=period, items=rows)

    def _compute(self, metric: str, period: str, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        handlers = {
            "xp": self._rank_xp,
            "streak": self._rank_streak,
            "bucket": self._rank_bucket,
            "goal": self._rank_goal,
            "cities": self._rank_cities,
            "countries": self._rank_countries,
            "achievement": self._rank_achievement,
        }
        handler = handlers.get(metric, self._rank_xp)
        items = handler(scope_ids, current_user)
        return self._backfill_scope(items, scope_ids, current_user, metric)

    def _backfill_scope(
        self, items: list[RankingItem], scope_ids: list[str], current_user: str, metric: str
    ) -> list[RankingItem]:
        """补齐未上榜的 scope 用户 (含当前用户) 为 value=0, 重新排序分配名次.

        保证当前用户永远出现在排行榜中, 即使无任何活动数据.
        """
        present_ids = {it.user.id for it in items}
        for uid in scope_ids:
            if uid in present_ids:
                continue
            profile = self.db.get(Profile, uid)
            items.append(
                RankingItem(
                    user=ProfileSummary(**_profile_summary(profile)) if profile else ProfileSummary(id=uid, display_name="用户"),
                    rank=0,  # 占位, 后续重新编号
                    value=0,
                    metric=metric,
                )
            )
        # 按价值降序重新排序, 重新分配名次
        items.sort(key=lambda it: it.value, reverse=True)
        for idx, it in enumerate(items, start=1):
            it.rank = idx
        return items

    def _rank_xp(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        rows = (
            self.db.query(UserLevel)
            .filter(UserLevel.user_id.in_(scope_ids))
            .order_by(UserLevel.experience.desc())
            .all()
        )
        return self._build_rank(rows, "xp", lambda r: r.experience, current_user, "user_id")

    def _rank_streak(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        rows = (
            self.db.query(CheckinStreak)
            .filter(CheckinStreak.user_id.in_(scope_ids))
            .order_by(CheckinStreak.current_streak.desc())
            .all()
        )
        return self._build_rank(rows, "streak", lambda r: r.current_streak, current_user, "user_id")

    def _rank_bucket(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        from sqlalchemy import func

        rows = (
            self.db.query(UserBucketItem.user_id, func.count(UserBucketItem.id).label("cnt"))
            .filter(UserBucketItem.user_id.in_(scope_ids), UserBucketItem.completed.is_(True))
            .group_by(UserBucketItem.user_id)
            .order_by(func.count(UserBucketItem.id).desc())
            .all()
        )
        return self._build_rank_tuples(rows, "bucket", current_user)

    def _rank_goal(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        from sqlalchemy import func

        rows = (
            self.db.query(LifeGoal.user_id, func.count(LifeGoal.id).label("cnt"))
            .filter(LifeGoal.user_id.in_(scope_ids), LifeGoal.status == "completed")
            .group_by(LifeGoal.user_id)
            .order_by(func.count(LifeGoal.id).desc())
            .all()
        )
        return self._build_rank_tuples(rows, "goal", current_user)

    def _rank_cities(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        from sqlalchemy import distinct, func

        rows = (
            self.db.query(
                LifeRecord.user_id,
                func.count(distinct(LifeRecord.city)).label("cnt"),
            )
            .filter(LifeRecord.user_id.in_(scope_ids), LifeRecord.city.is_not(None))
            .group_by(LifeRecord.user_id)
            .order_by(func.count(distinct(LifeRecord.city)).desc())
            .all()
        )
        return self._build_rank_tuples(rows, "cities", current_user)

    def _rank_countries(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        from sqlalchemy import distinct, func

        rows = (
            self.db.query(
                LifeRecord.user_id,
                func.count(distinct(LifeRecord.country)).label("cnt"),
            )
            .filter(LifeRecord.user_id.in_(scope_ids), LifeRecord.country.is_not(None))
            .group_by(LifeRecord.user_id)
            .order_by(func.count(distinct(LifeRecord.country)).desc())
            .all()
        )
        return self._build_rank_tuples(rows, "countries", current_user)

    def _rank_achievement(self, scope_ids: list[str], current_user: str) -> list[RankingItem]:
        """Achievement 维度: 完成的 Bucket + 完成的 Life Goal 总数 (派生指标)."""
        from sqlalchemy import func

        bucket_rows = (
            self.db.query(UserBucketItem.user_id, func.count(UserBucketItem.id).label("cnt"))
            .filter(UserBucketItem.user_id.in_(scope_ids), UserBucketItem.completed.is_(True))
            .group_by(UserBucketItem.user_id)
            .all()
        )
        goal_rows = (
            self.db.query(LifeGoal.user_id, func.count(LifeGoal.id).label("cnt"))
            .filter(LifeGoal.user_id.in_(scope_ids), LifeGoal.status == "completed")
            .group_by(LifeGoal.user_id)
            .all()
        )
        totals: dict[str, int] = {}
        for uid, cnt in bucket_rows:
            totals[uid] = totals.get(uid, 0) + cnt
        for uid, cnt in goal_rows:
            totals[uid] = totals.get(uid, 0) + cnt
        # 把当前用户纳入 (即使为 0)
        for uid in scope_ids:
            totals.setdefault(uid, 0)
        sorted_rows = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        rows = [(uid, cnt) for uid, cnt in sorted_rows]
        return self._build_rank_tuples(rows, "achievement", current_user)

    def _build_rank(self, rows, metric: str, getter, current_user: str, user_field: str) -> list[RankingItem]:
        items = []
        for idx, row in enumerate(rows, start=1):
            uid = getattr(row, user_field)
            profile = self.db.get(Profile, uid)
            items.append(
                RankingItem(
                    user=ProfileSummary(**_profile_summary(profile)) if profile else ProfileSummary(id=uid, display_name="用户"),
                    rank=idx,
                    value=getter(row),
                    metric=metric,
                )
            )
        return items

    def _build_rank_tuples(self, rows, metric: str, current_user: str) -> list[RankingItem]:
        """rows 为 (user_id, count) 元组列表."""
        items = []
        for idx, (uid, cnt) in enumerate(rows, start=1):
            profile = self.db.get(Profile, uid)
            items.append(
                RankingItem(
                    user=ProfileSummary(**_profile_summary(profile)) if profile else ProfileSummary(id=uid, display_name="用户"),
                    rank=idx,
                    value=cnt,
                    metric=metric,
                )
            )
        return items


class SocialOverviewService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.friends = FriendRepository(db)
        self.requests = FriendRequestRepository(db)
        self.shared = SharedGoalRepository(db)
        self.posts = SocialPostRepository(db)

    def overview(self, user_id: str) -> SocialOverview:
        friend_ids = [f.id for f in self.friends.list_friends(user_id)]
        pending = len(self.requests.list_incoming(user_id))
        shared = len(self.shared.list_for_user(user_id))

        # 今日成长: 今日记录 + 今日动态
        today = date.today()
        today_records = (
            self.db.query(LifeRecord)
            .filter(
                LifeRecord.user_id == user_id,
                LifeRecord.created_at >= datetime.combine(today, datetime.min.time()),
            )
            .count()
        )
        today_posts = (
            self.db.query(SocialPost)
            .filter(
                SocialPost.user_id == user_id,
                SocialPost.created_at >= datetime.combine(today, datetime.min.time()),
            )
            .count()
        )
        streak = self.db.query(CheckinStreak).filter(CheckinStreak.user_id == user_id).first()
        streak_val = streak.current_streak if streak else 0

        # 好友近期完成情况
        recent_completions = []
        for fid in friend_ids[:8]:
            completed_buckets = (
                self.db.query(UserBucketItem)
                .filter(UserBucketItem.user_id == fid, UserBucketItem.completed.is_(True))
                .order_by(UserBucketItem.completed_at.desc().nullslast())
                .first()
            )
            fprofile = self.db.get(Profile, fid)
            if completed_buckets is not None:
                bucket = self.db.get(BucketItem, completed_buckets.bucket_item_id)
                recent_completions.append(
                    {
                        "user": ProfileSummary(**_profile_summary(fprofile)).model_dump(by_alias=True),
                        "title": bucket.title if bucket else "一项人生必做",
                        "completedAt": _iso(completed_buckets.completed_at),
                    }
                )

        return SocialOverview(
            friends_count=len(friend_ids),
            pending_requests=pending,
            shared_goals_count=shared,
            today_growth=today_records + today_posts,
            checkin_streak=streak_val,
            friends_recent_completions=recent_completions,
        )
