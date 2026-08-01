from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.repository import BaseRepository
from app.db.models import (
    Comment,
    Friend,
    FriendRequest,
    GoalMember,
    Like,
    Notification,
    Profile,
    SharedGoal,
    SocialPost,
)


def _profile_summary(p: Profile) -> dict:
    return {
        "id": p.id,
        "displayName": p.display_name or p.email.split("@")[0],
        "avatarUrl": p.avatar_url,
        "currentTitle": p.current_title,
    }


class FriendRepository(BaseRepository[Friend]):
    def __init__(self, db: Session):
        super().__init__(db, Friend)

    def list_friends(self, user_id: str) -> list[Profile]:
        """返回用户的好友 Profile 列表 (双向关系: user_id 侧)."""
        friend_ids = [
            row[0]
            for row in self.db.query(Friend.friend_id)
            .filter(Friend.user_id == user_id, Friend.status == "active")
            .all()
        ]
        if not friend_ids:
            return []
        return self.db.query(Profile).filter(Profile.id.in_(friend_ids)).all()

    def are_friends(self, user_id: str, other_id: str) -> bool:
        return (
            self.db.query(Friend)
            .filter(Friend.user_id == user_id, Friend.friend_id == other_id, Friend.status == "active")
            .first()
            is not None
        )

    def add_pair(self, user_id: str, friend_id: str) -> None:
        """双向写入好友关系 (幂等)."""
        for uid, fid in [(user_id, friend_id), (friend_id, user_id)]:
            exists = (
                self.db.query(Friend)
                .filter(Friend.user_id == uid, Friend.friend_id == fid)
                .first()
            )
            if exists is None:
                self.db.add(Friend(user_id=uid, friend_id=fid, status="active"))
        self.db.commit()

    def remove_pair(self, user_id: str, friend_id: str) -> None:
        for uid, fid in [(user_id, friend_id), (friend_id, user_id)]:
            self.db.query(Friend).filter(Friend.user_id == uid, Friend.friend_id == fid).delete(
                synchronize_session=False
            )
        self.db.commit()


class FriendRequestRepository(BaseRepository[FriendRequest]):
    def __init__(self, db: Session):
        super().__init__(db, FriendRequest)

    def list_incoming(self, user_id: str) -> list[tuple[FriendRequest, Profile]]:
        rows = (
            self.db.query(FriendRequest, Profile)
            .join(Profile, Profile.id == FriendRequest.from_user)
            .filter(FriendRequest.to_user == user_id, FriendRequest.status == "pending")
            .order_by(FriendRequest.created_at.desc())
            .all()
        )
        return rows

    def list_outgoing(self, user_id: str) -> list[tuple[FriendRequest, Profile]]:
        rows = (
            self.db.query(FriendRequest, Profile)
            .join(Profile, Profile.id == FriendRequest.to_user)
            .filter(FriendRequest.from_user == user_id)
            .order_by(FriendRequest.created_at.desc())
            .all()
        )
        return rows

    def get_pending(self, from_user: str, to_user: str) -> FriendRequest | None:
        return (
            self.db.query(FriendRequest)
            .filter(
                FriendRequest.from_user == from_user,
                FriendRequest.to_user == to_user,
                FriendRequest.status == "pending",
            )
            .first()
        )

    def find_by_email(self, email: str) -> Profile | None:
        return self.db.query(Profile).filter(Profile.email == email).first()

    def search_profiles(self, user_id: str, keyword: str, limit: int = 20) -> list[Profile]:
        """按昵称/邮箱搜索用户, 排除自己."""
        like = f"%{keyword}%"
        return (
            self.db.query(Profile)
            .filter(Profile.id != user_id)
            .filter((Profile.display_name.ilike(like)) | (Profile.email.ilike(like)))
            .limit(limit)
            .all()
        )

    def create_request(self, from_user: str, to_user: str, message: str | None) -> FriendRequest:
        req = FriendRequest(from_user=from_user, to_user=to_user, message=message, status="pending")
        self.db.add(req)
        self.db.commit()
        self.db.refresh(req)
        return req

    def update_status(self, request_id: str, status: str) -> FriendRequest | None:
        req = self.db.get(FriendRequest, request_id)
        if req is None:
            return None
        req.status = status
        self.db.commit()
        self.db.refresh(req)
        return req


class SocialPostRepository(BaseRepository[SocialPost]):
    def __init__(self, db: Session):
        super().__init__(db, SocialPost)

    def feed_for_user(self, user_id: str, friend_ids: list[str], offset: int, limit: int) -> list[SocialPost]:
        """Feed: 自己 + 好友的 public/friends 可见动态, 按时间倒序."""
        visible_ids = [user_id, *friend_ids]
        return (
            self.db.query(SocialPost)
            .filter(
                SocialPost.user_id.in_(visible_ids),
                SocialPost.visibility.in_(["public", "friends"]),
            )
            .order_by(SocialPost.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get(self, post_id: str) -> SocialPost | None:
        return self.db.get(SocialPost, post_id)

    def get_visible(self, post_id: str, user_id: str, friend_ids: list[str]) -> SocialPost | None:
        """按可见性返回动态; private 仅作者可见, link 任何人可看."""
        post = self.db.get(SocialPost, post_id)
        if post is None:
            return None
        if post.user_id == user_id:
            return post
        if post.visibility == "private":
            return None
        if post.visibility == "public" or post.visibility == "link":
            return post
        # friends: 仅好友可见
        if post.user_id in friend_ids:
            return post
        return None

    def create(self, user_id: str, **values) -> SocialPost:
        post = SocialPost(user_id=user_id, **values)
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post


class LikeRepository(BaseRepository[Like]):
    def __init__(self, db: Session):
        super().__init__(db, Like)

    def is_liked(self, user_id: str, post_id: str) -> bool:
        return (
            self.db.query(Like)
            .filter(Like.user_id == user_id, Like.post_id == post_id)
            .first()
            is not None
        )

    def toggle(self, user_id: str, post_id: str) -> bool:
        """切换点赞状态, 返回 True=已点赞 / False=已取消. 同步更新 post 计数."""
        existing = (
            self.db.query(Like)
            .filter(Like.user_id == user_id, Like.post_id == post_id)
            .first()
        )
        post = self.db.get(SocialPost, post_id)
        if post is None:
            return False
        if existing is not None:
            self.db.delete(existing)
            post.likes_count = max(0, (post.likes_count or 0) - 1)
            self.db.commit()
            return False
        self.db.add(Like(user_id=user_id, post_id=post_id))
        post.likes_count = (post.likes_count or 0) + 1
        self.db.commit()
        return True


class CommentRepository(BaseRepository[Comment]):
    def __init__(self, db: Session):
        super().__init__(db, Comment)

    def list_by_post(self, post_id: str) -> list[tuple[Comment, Profile]]:
        rows = (
            self.db.query(Comment, Profile)
            .join(Profile, Profile.id == Comment.user_id)
            .filter(Comment.post_id == post_id)
            .order_by(Comment.created_at.asc())
            .all()
        )
        return rows

    def create(self, user_id: str, post_id: str, content: str) -> Comment:
        comment = Comment(user_id=user_id, post_id=post_id, content=content)
        self.db.add(comment)
        post = self.db.get(SocialPost, post_id)
        if post is not None:
            post.comments_count = (post.comments_count or 0) + 1
        self.db.commit()
        self.db.refresh(comment)
        return comment


class SharedGoalRepository(BaseRepository[SharedGoal]):
    def __init__(self, db: Session):
        super().__init__(db, SharedGoal)

    def list_for_user(self, user_id: str) -> list[SharedGoal]:
        """用户参与的所有共同目标 (作为 owner 或 member)."""
        member_goal_ids = [
            row[0]
            for row in self.db.query(GoalMember.shared_goal_id)
            .filter(GoalMember.user_id == user_id)
            .all()
        ]
        if not member_goal_ids:
            return []
        return (
            self.db.query(SharedGoal)
            .filter(SharedGoal.id.in_(member_goal_ids))
            .order_by(SharedGoal.created_at.desc())
            .all()
        )

    def get(self, shared_id: str) -> SharedGoal | None:
        return self.db.get(SharedGoal, shared_id)

    def create(self, owner_id: str, life_goal_id: str, visibility: str, share_code: str | None) -> SharedGoal:
        sg = SharedGoal(
            owner_id=owner_id,
            life_goal_id=life_goal_id,
            visibility=visibility,
            share_code=share_code,
        )
        self.db.add(sg)
        self.db.commit()
        self.db.refresh(sg)
        # owner 自动成为成员
        self.db.add(GoalMember(shared_goal_id=sg.id, user_id=owner_id, role="owner"))
        self.db.commit()
        return sg

    def list_members(self, shared_id: str) -> list[tuple[GoalMember, Profile]]:
        rows = (
            self.db.query(GoalMember, Profile)
            .join(Profile, Profile.id == GoalMember.user_id)
            .filter(GoalMember.shared_goal_id == shared_id)
            .order_by(GoalMember.joined_at.asc())
            .all()
        )
        return rows

    def is_member(self, shared_id: str, user_id: str) -> bool:
        return (
            self.db.query(GoalMember)
            .filter(GoalMember.shared_goal_id == shared_id, GoalMember.user_id == user_id)
            .first()
            is not None
        )

    def add_member(self, shared_id: str, user_id: str, role: str = "member") -> GoalMember:
        member = GoalMember(shared_goal_id=shared_id, user_id=user_id, role=role)
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: Session):
        super().__init__(db, Notification)

    def create(self, user_id: str, type: str, title: str, body: str | None, link: str | None) -> Notification:
        n = Notification(user_id=user_id, type=type, title=title, body=body, link=link)
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        return n

    def unread_count(self, user_id: str) -> int:
        return (
            self.db.query(func.count(Notification.id))
            .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
            .scalar()
            or 0
        )
