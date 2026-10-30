import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import DomainException
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.bus import Conductor
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLogin, UserRegister


# Rate limiting trackers: role -> dict(ip/email -> list of timestamps)
_login_attempts: dict = {}

ROLE_RATE_LIMITS = {
    UserRole.OPERATOR: 30,    # 30 login attempts / minute
    UserRole.ADMIN: 30,       # 30 login attempts / minute
    UserRole.CONDUCTOR: 60,   # 60 login attempts / minute
    UserRole.PASSENGER: 120,  # 120 login attempts / minute
}


class AuthService:
    @staticmethod
    def check_rate_limit(role: UserRole, key: str):
        import time
        now = time.time()
        window = 60.0  # 1 minute
        limit = ROLE_RATE_LIMITS.get(role, 60)

        attempts = _login_attempts.setdefault(key, [])
        # Prune old attempts
        _login_attempts[key] = [t for t in attempts if now - t < window]

        if len(_login_attempts[key]) >= limit:
            raise DomainException(
                status_code=429,
                detail=f"Rate limit exceeded for {role.value} login. Maximum {limit} attempts per minute.",
                error_code="RATE_LIMIT_EXCEEDED"
            )
        _login_attempts[key].append(now)

    @staticmethod
    async def register_user(db: AsyncSession, data: UserRegister) -> User:
        # Check existing email
        stmt = select(User).where(User.email == data.email)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            raise DomainException(status_code=400, detail="Email already registered", error_code="EMAIL_EXISTS")

        new_user = User(
            id=str(uuid.uuid4()),
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role=data.role,
            is_active=True
        )
        db.add(new_user)
        await db.flush()

        if data.role == UserRole.CONDUCTOR:
            emp_id = data.employee_id or f"EMP-{new_user.id[:8].upper()}"
            conductor = Conductor(
                id=str(uuid.uuid4()),
                user_id=new_user.id,
                employee_id=emp_id,
                is_available=True
            )
            db.add(conductor)

        await db.commit()
        await db.refresh(new_user)
        return new_user

    @staticmethod
    async def login_user(db: AsyncSession, data: UserLogin) -> TokenResponse:
        stmt = select(User).where(User.email == data.email)
        user = (await db.execute(stmt)).scalar_one_or_none()
        if not user:
            raise DomainException(status_code=401, detail="Email not found. Please register first.", error_code="USER_NOT_FOUND")

        # Apply per-role rate limit
        AuthService.check_rate_limit(user.role, data.email)

        if not user.is_active:
            raise DomainException(status_code=403, detail="Account is disabled", error_code="INACTIVE_ACCOUNT")

        token = create_access_token(subject=user.id, role=user.role.value, email=user.email)

        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role=user.role,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name
        )

