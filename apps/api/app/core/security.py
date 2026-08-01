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

    token = authorization.removeprefix("Bearer ")
    alg = ""
    jwks_url = None
    try:
        # 根据 JWT header 的 alg 选择验证方式：
        # - ES256: Supabase 新版 JWT，用 JWKS 公钥验证（不依赖 SUPABASE_JWT_SECRET）
        # - HS256: 旧版或自定义 JWT，用 secret 验证
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "")

        if alg == "ES256":
            jwks_url = settings.supabase_jwks_url
            if not jwks_url and settings.supabase_url:
                jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            if not jwks_url:
                raise HTTPException(
                    status_code=401,
                    detail={"code": "UNAUTHORIZED", "message": "JWKS URL not configured"},
                )
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        elif alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status_code=401,
                    detail={"code": "UNAUTHORIZED", "message": "HS256 secret not configured"},
                )
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            raise HTTPException(
                status_code=401,
                detail={"code": "UNAUTHORIZED", "message": f"Unsupported algorithm: {alg}"},
            )
    except jwt.PyJWTError as exc:
        # 临时诊断：返回详细错误信息，定位 Render 上 JWT 验证失败的真实原因
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid token",
                "debug": f"{type(exc).__name__}: {str(exc)[:300]}",
                "alg": alg,
                "jwks_url": jwks_url,
                "supabase_url_env": settings.supabase_url,
                "jwks_env": settings.supabase_jwks_url,
            },
        ) from exc

    user_id = payload.get("sub", str(uuid.uuid4()))
    profile = db.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id, email=payload.get("email", ""), language="zh-CN")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile
