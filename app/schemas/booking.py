from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.core.constants import BookingStatus, PaymentStatus


class BookingCreate(BaseModel):
    trip_id: str
    seat_count: int = Field(default=1, ge=1, le=10)


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    trip_id: str
    passenger_id: str
    booking_reference: str
    status: BookingStatus
    fare_amount: float
    seat_count: int
    created_at: datetime


class PaymentSimulationRequest(BaseModel):
    booking_id: str
    idempotency_key: str
    simulate_failure: bool = False


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: str
    status: PaymentStatus
    amount: float
    simulated_reference: Optional[str] = None
    confirmed_at: Optional[datetime] = None
