import pytest_asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base, get_db
from app.main import app
from app.seed import seed_data

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_railbus.db"


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    if os.path.exists("./test_railbus.db"):
        os.remove("./test_railbus.db")

    engine = create_async_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Override get_db dependency in app
    async def override_get_db():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    # Seed fresh data using the override session
    async with async_session() as session:
        # Import and run seed logic directly into test db
        import uuid
        from datetime import datetime, timezone, timedelta
        from app.core.constants import UserRole, BusStatus, TripStatus, BookingStatus, PaymentStatus
        from app.core.security import get_password_hash
        from app.models.user import User
        from app.models.bus import Bus, Conductor
        from app.models.route import Route, RouteStop
        from app.models.trip import Trip
        from app.models.booking import Booking, Payment
        from app.services.ticket_service import TicketService

        pwd_hash = get_password_hash("password123")
        operator = User(
            id=str(uuid.uuid4()),
            email="operator@railbus.com",
            password_hash=pwd_hash,
            full_name="Alex Operator",
            phone="+91-9876543210",
            role=UserRole.OPERATOR,
            is_active=True
        )
        session.add(operator)

        conductor_user = User(
            id=str(uuid.uuid4()),
            email="conductor@railbus.com",
            password_hash=pwd_hash,
            full_name="Rajesh Conductor",
            phone="+91-9876543211",
            role=UserRole.CONDUCTOR,
            is_active=True
        )
        session.add(conductor_user)
        await session.flush()

        conductor_profile = Conductor(
            id=str(uuid.uuid4()),
            user_id=conductor_user.id,
            employee_id="RB-COND-001",
            license_number="DL-COND-88219",
            is_available=True
        )
        session.add(conductor_profile)

        bus = Bus(
            id=str(uuid.uuid4()),
            registration_number="KA-01-RB-2026",
            model="Volvo 9600 Multi-Axle",
            capacity=40,
            status=BusStatus.ACTIVE,
            is_active=True
        )
        session.add(bus)

        route = Route(
            id=str(uuid.uuid4()),
            name="Central Station ↔ Electronic City Tech Hub",
            origin="Central Railway Station",
            destination="Electronic City Tech Hub",
            distance_km=28,
            is_active=True
        )
        session.add(route)
        await session.flush()

        stops = [
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Central Railway Station", stop_order=1, distance_from_origin_km=0),
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Koramangala Ring Road", stop_order=2, distance_from_origin_km=14),
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Silk Board Interchange", stop_order=3, distance_from_origin_km=20),
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Electronic City Tech Hub", stop_order=4, distance_from_origin_km=28),
        ]
        session.add_all(stops)

        dep_time = datetime.now(timezone.utc) + timedelta(hours=2)
        trip = Trip(
            id=str(uuid.uuid4()),
            route_id=route.id,
            bus_id=bus.id,
            conductor_id=conductor_profile.id,
            approved_by=operator.id,
            status=TripStatus.SCHEDULED,
            demand_count=22,
            capacity=40,
            boarded_count=0,
            base_fare=50.00,
            departure_time=dep_time
        )
        session.add(trip)
        await session.flush()

        for i in range(1, 23):
            p_user = User(
                id=str(uuid.uuid4()),
                email=f"passenger{i}@example.com",
                password_hash=pwd_hash,
                full_name=f"Passenger {i:02d} Kumar",
                phone=f"+91-98765432{i:02d}",
                role=UserRole.PASSENGER,
                is_active=True
            )
            session.add(p_user)
            await session.flush()

            booking = Booking(
                id=str(uuid.uuid4()),
                trip_id=trip.id,
                passenger_id=p_user.id,
                booking_reference=f"BK-{i:04d}",
                status=BookingStatus.CONFIRMED,
                fare_amount=50.00,
                seat_count=1
            )
            session.add(booking)
            await session.flush()

            payment = Payment(
                id=str(uuid.uuid4()),
                booking_id=booking.id,
                idempotency_key=f"IDEM-SEED-{i}",
                status=PaymentStatus.SUCCESS,
                amount=50.00,
                simulated_reference=f"SIM-TXN-{i:04d}",
                confirmed_at=datetime.now(timezone.utc)
            )
            session.add(payment)

            await TicketService.issue_ticket_for_booking(session, booking)

        await session.commit()

    yield

    app.dependency_overrides.clear()
    await engine.dispose()
    if os.path.exists("./test_railbus.db"):
        os.remove("./test_railbus.db")
