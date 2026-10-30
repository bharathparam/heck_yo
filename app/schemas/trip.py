from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.core.constants import RouteType, TripStatus


class RouteStopResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    stop_name: str
    stop_order: int
    distance_from_origin_km: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    fare_from_origin: Optional[float] = None


class RouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    origin: str
    destination: str
    distance_km: int
    route_type: RouteType = RouteType.CITY
    base_fare: float = 50.0
    stops: List[RouteStopResponse] = []


class TripCreate(BaseModel):
    route_id: str
    train_arrival_id: Optional[str] = None
    travel_date: Optional[date] = None
    departure_time: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    min_threshold: Optional[int] = Field(default=20, ge=1)
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
    min_threshold: int = 20
    boarded_count: int
    base_fare: float
    travel_date: Optional[date] = None
    departure_time: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    bus_registration: Optional[str] = None
    conductor_name: Optional[str] = None
    threshold_met: bool = False

