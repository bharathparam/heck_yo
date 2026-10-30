from datetime import datetime, time
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.core.constants import TripStatus


class RouteStopResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    stop_name: str
    stop_order: int
    distance_from_origin_km: int


class RouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    origin: str
    destination: str
    distance_km: int
    stops: List[RouteStopResponse] = []


class TripCreate(BaseModel):
    route_id: str
    train_arrival_id: Optional[str] = None
    departure_time: Optional[datetime] = None
    base_fare: float = Field(default=50.0, ge=1.0)


class TripAssignRequest(BaseModel):
    bus_id: str
    conductor_id: str


class TripResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    route_id: str
    route_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    status: TripStatus
    demand_count: int
    capacity: int
    boarded_count: int
    base_fare: float
    departure_time: Optional[datetime] = None
    bus_registration: Optional[str] = None
    conductor_name: Optional[str] = None
    threshold_met: bool = False
