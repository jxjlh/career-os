import uuid
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.db.models import Profile

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
    x_dev_user_id: Annotated[str | None, Header()] = None,
) -> Profile:
    settings = get_settings()

    if settings.app_env in ("dev", "test") and (authorization is None or authorization == "Bearer dev"):
        user_id = x_dev_user_id or DEV_USER_ID
        profile = db.get(Profile, user_id)
        if profile is None:
            profile = Profile(
                id=user_id,
                email=f"dev-{user_id}@career-os.local",
                display_name="Developer",
                language="zh-CN",
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Missing bearer token"})

    if not settings.supabase_jwt_secret and not settings.supabase_jwks_url:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Auth not configured"})

    token = authorization.removeprefix("Bearer ")
    try:
        if settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            jwks_client = jwt.PyJWKClient(settings.supabase_jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid token"}) from exc

    user_id = payload.get("sub", str(uuid.uuid4()))
    profile = db.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id, email=payload.get("email", ""), language="zh-CN")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile
