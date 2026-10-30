import uuid
from sqlalchemy import String, Integer, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.core.constants import BusStatus


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    registration_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    status: Mapped[BusStatus] = mapped_column(SAEnum(BusStatus), default=BusStatus.ACTIVE)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    trips = relationship("Trip", back_populates="bus")


class Conductor(Base):
    __tablename__ = "conductors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    license_number: Mapped[str] = mapped_column(String(50), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    user = relationship("User", back_populates="conductor_profile")
    trips = relationship("Trip", back_populates="conductor")
    boardings = relationship("BoardingRecord", back_populates="conductor")
