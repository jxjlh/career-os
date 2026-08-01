from sqlalchemy.orm import Session

from app.db.models import UserProfile
from app.domains.profile.repository import UserProfileRepository
from app.domains.profile.schemas import ProfileResponse, ProfileUpdate


def to_response(profile: UserProfile) -> ProfileResponse:
    return ProfileResponse(
        userId=profile.user_id,
        nickname=profile.nickname,
        avatar=profile.avatar,
        bio=profile.bio,
        birthYear=profile.birth_year,
        currentStage=profile.current_stage,
        strengths=profile.strengths or [],
        interests=profile.interests or [],
        careerDirection=profile.career_direction,
        lifeMotto=profile.life_motto,
        createdAt=profile.created_at.isoformat() if profile.created_at else None,
        updatedAt=profile.updated_at.isoformat() if profile.updated_at else None,
    )


class ProfileService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = UserProfileRepository(db)

    def get_or_create(self, user_id: str) -> UserProfile:
        profile = self.repository.get_by_user(user_id)
        if profile is None:
            profile = self.repository.create(user_id)
        return profile

    def get(self, user_id: str) -> ProfileResponse:
        return to_response(self.get_or_create(user_id))

    def update(self, user_id: str, payload: ProfileUpdate) -> ProfileResponse:
        profile = self.get_or_create(user_id)
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            if value is not None:
                setattr(profile, field, value)
        self.db.commit()
        self.db.refresh(profile)
        return to_response(profile)
