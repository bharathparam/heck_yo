from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.core.constants import TicketStatus


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: str
    ticket_reference: str
    trip_id: str
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    route_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    status: TicketStatus
    qr_content: str  # <base64(payload)>.<signature>
    qr_data_url: Optional[str] = None  # data:image/png;base64,...
    issued_at: datetime
    expires_at: Optional[datetime] = None


class TicketValidationRequest(BaseModel):
    qr_code: str  # raw scanned QR string
    trip_id: str


class TicketValidationResponse(BaseModel):
    valid: bool
    ticket_id: Optional[str] = None
    ticket_reference: Optional[str] = None
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    status: Optional[str] = None
    message: str
