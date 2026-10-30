import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BusStatus, TripStatus, UserRole
from app.core.security import get_password_hash
from app.database import AsyncSessionLocal, init_db
from app.models.bus import Bus, Conductor
from app.models.route import Route, RouteStop
from app.models.trip import Trip
from app.models.user import User


async def seed_data():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        res = await session.execute(select(User).where(User.email == "operator@railbus.com"))
        if res.scalar_one_or_none():
            print("Database already seeded.")
            return

        print("Seeding initial RailBus development data...")

        # 1. Users
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

        # Conductor Profile
        conductor_profile = Conductor(
            id=str(uuid.uuid4()),
            user_id=conductor_user.id,
            employee_id="RB-COND-001",
            license_number="DL-COND-88219",
            is_available=True
        )
        session.add(conductor_profile)

        # 2. Bus
        bus = Bus(
            id=str(uuid.uuid4()),
            registration_number="KA-01-RB-2026",
            model="Volvo 9600 Multi-Axle",
            capacity=40,
            status=BusStatus.ACTIVE,
            is_active=True
        )
        session.add(bus)

        # 3. Trains and Train Arrivals
        from app.models.train import Train, TrainArrival
        from app.core.constants import TrainArrivalStatus, RouteType

        train = Train(
            id=str(uuid.uuid4()),
            name="Chamundi Express",
            number="16216",
            origin="Bengaluru City (SBC)",
            destination="Mysuru Junction (MYS)",
            is_active=True
        )
        session.add(train)
        await session.flush()

        # 4. Route & Stops (Mysore City and Intercity)
        route = Route(
            id=str(uuid.uuid4()),
            name="Mysuru Bus Stand ↔ Electronic City Tech Hub",
            origin="Mysuru Suburban Bus Stand",
            destination="Electronic City Tech Hub",
            distance_km=28,
            route_type=RouteType.CITY,
            base_fare=50.00,
            is_active=True
        )
        session.add(route)
        await session.flush()

        stops = [
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Mysuru Suburban Bus Stand", stop_order=1, distance_from_origin_km=0, latitude=12.3106, longitude=76.6578, fare_from_origin=0.0),
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Koramangala Ring Road", stop_order=2, distance_from_origin_km=14, latitude=12.3250, longitude=76.6720, fare_from_origin=25.0),
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Silk Board Interchange", stop_order=3, distance_from_origin_km=20, latitude=12.3380, longitude=76.6850, fare_from_origin=38.0),
            RouteStop(id=str(uuid.uuid4()), route_id=route.id, stop_name="Electronic City Tech Hub", stop_order=4, distance_from_origin_km=28, latitude=12.3550, longitude=76.7010, fare_from_origin=50.0),
        ]
        session.add_all(stops)

        # Intercity routes
        intercity_destinations = [
            ("Bengaluru Express Connection", "Mysuru Junction", "Bengaluru Majestic (KBS)", 145, 220.00),
            ("Mandya Shuttle Link", "Mysuru Suburban Bus Stand", "Mandya Bus Stand", 45, 60.00),
            ("Hassan Direct Connect", "Mysuru Suburban Bus Stand", "Hassan Central", 120, 160.00),
            ("Nanjangud Temple Corridor", "Mysuru Suburban Bus Stand", "Nanjangud Temple Square", 24, 35.00),
        ]
        for ic_name, ic_orig, ic_dest, ic_dist, ic_fare in intercity_destinations:
            ic_route = Route(
                id=str(uuid.uuid4()),
                name=ic_name,
                origin=ic_orig,
                destination=ic_dest,
                distance_km=ic_dist,
                route_type=RouteType.INTERCITY,
                base_fare=ic_fare,
                is_active=True
            )
            session.add(ic_route)

        await session.flush()

        # Connecting Train Arrival
        arrival = TrainArrival(
            id=str(uuid.uuid4()),
            train_id=train.id,
            route_id=route.id,
            scheduled_arrival=datetime.strptime("18:15", "%H:%M").time(),
            scheduled_departure=datetime.strptime("18:30", "%H:%M").time(),
            status=TrainArrivalStatus.ON_TIME,
            arrival_date=datetime.now(timezone.utc).date()
        )
        session.add(arrival)
        await session.flush()

        # 5. Trip
        dep_time = datetime.now(timezone.utc) + timedelta(hours=2)
        trip = Trip(
            id=str(uuid.uuid4()),
            route_id=route.id,
            train_arrival_id=arrival.id,
            bus_id=bus.id,
            conductor_id=conductor_profile.id,
            approved_by=operator.id,
            status=TripStatus.SCHEDULED,
            demand_count=22,
            capacity=40,
            min_threshold=20,
            boarded_count=0,
            base_fare=50.00,
            travel_date=datetime.now(timezone.utc).date(),
            departure_time=dep_time,
            deadline_at=dep_time - timedelta(minutes=45)
        )
        session.add(trip)
        await session.flush()


        # 5. Seed 22 Confirmed Bookings & Tickets for the trip so conductor can test scanning immediately!
        from app.services.ticket_service import TicketService
        from app.models.booking import Booking, Payment
        from app.core.constants import BookingStatus, PaymentStatus

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

            # Issue ticket
            await TicketService.issue_ticket_for_booking(session, booking)

        await session.commit()
        print("Seeding completed successfully! Created 1 Operator, 1 Conductor, 1 Bus, 1 Route, 1 Trip, and 22 Confirmed Passenger Tickets.")


if __name__ == "__main__":
    asyncio.run(seed_data())
