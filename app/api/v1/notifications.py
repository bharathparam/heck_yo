from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.admin import NotificationResponse
from app.core.exceptions import EntityNotFoundException, ForbiddenException

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists notifications for the authenticated user"""
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marks a notification as read"""
    stmt = select(Notification).where(Notification.id == notification_id)
    notif = (await db.execute(stmt)).scalar_one_or_none()
    if not notif:
        raise EntityNotFoundException("Notification", notification_id)

    if notif.user_id != current_user.id:
        raise ForbiddenException("Not authorized to access this notification")

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif
