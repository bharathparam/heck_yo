from typing import List
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.database import get_db
from app.models.bus import Conductor
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not credentials or not credentials.credentials:
        raise UnauthorizedException("Authentication token is missing")

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedException("Invalid or expired authentication token")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Token payload missing subject identifier")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedException("User associated with token no longer exists")
    if not user.is_active:
        raise ForbiddenException("User account is inactive")

    return user




def require_role(*roles: UserRole):
    """Dependency factory checking that the current user has one of the allowed roles"""
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ForbiddenException(
                f"Action requires one of the following roles: {[r.value for r in roles]}. Current role: {user.role.value}"
            )
        return user
    return role_checker


async def get_current_conductor(
    user: User = Depends(require_role(UserRole.CONDUCTOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
) -> Conductor:
    """Retrieves conductor profile associated with current conductor user"""
    result = await db.execute(select(Conductor).where(Conductor.user_id == user.id))
    conductor = result.scalar_one_or_none()
    if not conductor and user.role != UserRole.ADMIN:
        raise ForbiddenException("User does not have an active conductor profile")
    return conductor
