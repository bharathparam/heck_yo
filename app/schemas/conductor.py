from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.core.constants import TicketStatus, TripStatus


class ConductorTripSummary(BaseModel):
    id: str
    route_name: str
    origin: str
    destination: str
    status: TripStatus
    bus_registration: Optional[str] = None
    capacity: int
    boarded_count: int
    total_confirmed_passengers: int
    departure_time: Optional[datetime] = None


class PassengerManifestItem(BaseModel):
    ticket_id: str
    ticket_reference: str
    passenger_name: str
    passenger_phone: Optional[str] = None
    seat_count: int
    status: TicketStatus
    boarded_at: Optional[datetime] = None


class ManifestResponse(BaseModel):
    trip_id: str
    route_name: str
    bus_registration: Optional[str] = None
    status: TripStatus
    total_passengers: int
    boarded_count: int
    manifest: List[PassengerManifestItem]


class BoardTicketRequest(BaseModel):
    qr_code: str
    device_id: Optional[str] = "conductor-app"


class BoardTicketResponse(BaseModel):
    success: bool
    ticket_id: str
    ticket_reference: str
    passenger_name: str
    boarded_at: datetime
    boarded_count: int
    total_passengers: int
    message: str


class OfflineBoardingItem(BaseModel):
    ticket_id: str
    boarded_at: datetime
    device_id: Optional[str] = None


class OfflineSyncBatchRequest(BaseModel):
    trip_id: str
    boardings: List[OfflineBoardingItem]


class OfflineSyncBatchResponse(BaseModel):
    trip_id: str
    synced_count: int
    failed_count: int
    boarded_count: int
    total_passengers: int
    errors: List[str] = []
