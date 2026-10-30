import uuid
from datetime import date, time
from sqlalchemy import String, Boolean, Date, Time, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.core.constants import TrainArrivalStatus


class Train(Base):
    __tablename__ = "trains"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    origin: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    arrivals = relationship("TrainArrival", back_populates="train")


class TrainArrival(Base):
    __tablename__ = "train_arrivals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_id: Mapped[str] = mapped_column(String(36), ForeignKey("trains.id"), nullable=False)
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    scheduled_arrival: Mapped[time] = mapped_column(Time, nullable=False)
    scheduled_departure: Mapped[time] = mapped_column(Time, nullable=True)
    status: Mapped[TrainArrivalStatus] = mapped_column(
        SAEnum(TrainArrivalStatus), default=TrainArrivalStatus.ON_TIME
    )
    arrival_date: Mapped[date] = mapped_column(Date, nullable=False)

    train = relationship("Train", back_populates="arrivals")
    route = relationship("Route", back_populates="train_arrivals")
    trips = relationship("Trip", back_populates="train_arrival")
