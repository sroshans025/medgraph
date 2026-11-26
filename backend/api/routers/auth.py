import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config.config import settings
from backend.core.security import create_access_token, decode_access_token, hash_password, verify_password
from backend.services.models.storage.database.connection import get_db
from backend.services.models.storage.database.models import UserModel

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=100)
    credentials: str = Field(default="MD, Radiology", max_length=100)


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    credentials: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


def _user_out(u: UserModel) -> UserOut:
    return UserOut(id=u.id, email=u.email, name=u.name, credentials=u.credentials, role=u.role)


def _token_response(u: UserModel) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(u.id, {"email": u.email}),
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        user=_user_out(u),
    )


async def ensure_demo_user(db: AsyncSession) -> None:
    """Seeds the documented demo reader account if it is enabled and missing."""
    if not settings.SEED_DEMO_USER:
        return
    email = settings.DEMO_USER_EMAIL.lower()
    existing = await db.scalar(select(UserModel).where(UserModel.email == email))
    if existing is None:
        db.add(UserModel(
            id=str(uuid.uuid4()), email=email, name="Dr. A. Raman", credentials="MD, Radiology",
            role="reader", password_hash=hash_password(settings.DEMO_USER_PASSWORD),
        ))
        await db.commit()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Self-registration is disabled. Ask an administrator for access.")
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if await db.scalar(select(UserModel).where(UserModel.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    # The first account on a fresh install becomes the administrator.
    count = await db.scalar(select(func.count()).select_from(UserModel))
    user = UserModel(
        id=str(uuid.uuid4()), email=email, name=body.name.strip(), credentials=body.credentials.strip(),
        role="admin" if not count else "reader", password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    await ensure_demo_user(db)
    user = await db.scalar(select(UserModel).where(UserModel.email == body.email.strip().lower()))
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        # Same message either way so the endpoint does not reveal which emails exist.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
    return _token_response(user)


def _bearer(request: Request) -> Optional[str]:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None


async def _resolve(token: Optional[str], db: AsyncSession) -> UserModel:
    payload = decode_access_token(token) if token else None
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.", headers={"WWW-Authenticate": "Bearer"})
    user = await db.get(UserModel, payload["sub"])
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or disabled.", headers={"WWW-Authenticate": "Bearer"})
    return user


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[UserModel]:
    """Bearer-token user. Returns None only when AUTH_REQUIRED is switched off."""
    token = _bearer(request)
    if not settings.AUTH_REQUIRED and token is None:
        return None
    return await _resolve(token, db)


async def get_current_user_for_media(
    request: Request,
    token: Optional[str] = Query(default=None, description="Access token, for <img> tags that cannot send headers"),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserModel]:
    bearer = _bearer(request) or token
    if not settings.AUTH_REQUIRED and bearer is None:
        return None
    return await _resolve(bearer, db)


@router.get("/me", response_model=UserOut)
async def me(user: Optional[UserModel] = Depends(get_current_user)) -> UserOut:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    return _user_out(user)
