from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.core.constants import TrainArrivalStatus


class TrainBase(BaseModel):
    name: str
    number: str
    origin: str
    destination: str
    is_active: bool = True


class TrainCreate(TrainBase):
    pass


class TrainResponse(TrainBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


class TrainArrivalBase(BaseModel):
    train_id: str
    route_id: str
    scheduled_arrival: time
    scheduled_departure: Optional[time] = None
    status: TrainArrivalStatus = TrainArrivalStatus.ON_TIME
    arrival_date: date


class TrainArrivalCreate(TrainArrivalBase):
    pass


class TrainArrivalResponse(TrainArrivalBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    train_name: Optional[str] = None
    train_number: Optional[str] = None
    route_name: Optional[str] = None
