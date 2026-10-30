from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.core.constants import AuditAction, BusStatus, NotificationType, TripStatus


class BusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    registration_number: str
    model: str
    capacity: int
    status: BusStatus
    is_active: bool


class ConductorAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    employee_id: str
    license_number: Optional[str] = None
    is_available: bool
    full_name: str
    email: str
    phone: Optional[str] = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    trip_id: Optional[str] = None
    performed_by: Optional[str] = None
    action: AuditAction
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    trip_id: Optional[str] = None
    title: str
    message: str
    notification_type: NotificationType
    is_read: bool
    created_at: datetime


class AdminOverviewResponse(BaseModel):
    total_trips: int
    active_buses: int
    available_conductors: int
    total_confirmed_bookings: int
    aggregating_trips: int
    threshold_met_trips: int
    scheduled_trips: int
    boarding_trips: int
    completed_trips: int
    cancelled_trips: int


class AdminAssignmentItem(BaseModel):
    trip_id: str
    route_name: str
    travel_date: str
    departure_time: Optional[datetime] = None
    demand_count: int
    min_threshold: int
    status: TripStatus
    bus_registration: Optional[str] = None
    conductor_name: Optional[str] = None
