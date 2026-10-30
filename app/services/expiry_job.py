import asyncio
from datetime import datetime, timezone
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TripStatus
from app.database import AsyncSessionLocal
from app.models.trip import Trip
from app.services.state_machine import transition_trip_state


async def expire_below_threshold_trips(db: AsyncSession) -> List[Trip]:
    """
    Checks all AGGREGATING trips where deadline_at has passed.
    If demand_count < min_threshold, transitions the trip to CANCELLED via the state machine,
    which refunds payments and notifies passengers.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Trip)
        .where(Trip.status == TripStatus.AGGREGATING)
        .where(Trip.deadline_at.is_not(None))
        .where(Trip.deadline_at <= now)
    )
    result = await db.execute(stmt)
    trips_to_expire = result.scalars().all()

    cancelled = []
    for trip in trips_to_expire:
        threshold = trip.min_threshold or 20
        if trip.demand_count < threshold:
            updated = await transition_trip_state(
                db=db,
                trip_id=trip.id,
                target_status=TripStatus.CANCELLED,
                performed_by=None,
                reason=f"Trip booking deadline ({trip.deadline_at.isoformat()}) passed with demand ({trip.demand_count}) below activation threshold ({threshold}). Automatically cancelled."
            )
            cancelled.append(updated)

    return cancelled


async def run_expiry_check_now():
    """Manual trigger or runner for expiry job"""
    async with AsyncSessionLocal() as session:
        return await expire_below_threshold_trips(session)


if __name__ == "__main__":
    cancelled_trips = asyncio.run(run_expiry_check_now())
    print(f"Expired and cancelled {len(cancelled_trips)} trips.")
