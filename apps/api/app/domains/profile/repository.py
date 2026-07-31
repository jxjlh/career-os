from app.core.repository import BaseRepository
from app.db.models import UserProfile


class UserProfileRepository(BaseRepository[UserProfile]):
    def __init__(self, db):
        super().__init__(db, UserProfile)

    def get_by_user(self, user_id: str) -> UserProfile | None:
        return self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    def create(self, user_id: str) -> UserProfile:
        profile = UserProfile(user_id=user_id)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile
