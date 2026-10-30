import asyncio
import json
import uuid
from sqlalchemy import select, delete
from app.database import AsyncSessionLocal, init_db
from app.models.bus import Bus
from app.models.route import Route, RouteStop
from app.core.constants import BusStatus


async def import_bus_routes():
    await init_db()

    with open('cleaned_bus_routes.json', 'r', encoding='utf-8') as f:
        routes_data = json.load(f)

    print(f"Starting import of {len(routes_data)} bus routes...")

    async with AsyncSessionLocal() as session:
        imported_routes = 0
        imported_stops = 0
        imported_buses = 0

        # Existing buses cache
        res_b = await session.execute(select(Bus.registration_number))
        existing_reg_nums = set(res_b.scalars().all())

        # Existing routes cache (by name)
        res_r = await session.execute(select(Route.name))
        existing_route_names = set(res_r.scalars().all())

        for item in routes_data:
            bus_num = item['bus_num'].strip()
            stops = item['stops']

            if not stops:
                # Skip routes with no stop info
                continue

            origin = stops[0].strip()
            destination = stops[-1].strip()
            distance_km = max(5, int(len(stops) * 1.2))

            # Route Name format: e.g. "Bus 10A Up: JP Nagar Last Stop ➔ LnT"
            raw_name = f"Bus {bus_num}: {origin} ➔ {destination}"
            route_name = raw_name[:250]

            if route_name in existing_route_names:
                continue

            # Create Route
            route_id = str(uuid.uuid4())
            route = Route(
                id=route_id,
                name=route_name,
                origin=origin[:250],
                destination=destination[:250],
                distance_km=distance_km,
                is_active=True
            )
            session.add(route)
            existing_route_names.add(route_name)
            imported_routes += 1

            # Create RouteStops
            for idx, stop_name in enumerate(stops):
                stop_record = RouteStop(
                    id=str(uuid.uuid4()),
                    route_id=route_id,
                    stop_name=stop_name.strip()[:250],
                    stop_order=idx + 1,
                    distance_from_origin_km=int(idx * 1.2)
                )
                session.add(stop_record)
                imported_stops += 1

            # Create corresponding Bus if not exists
            clean_bus_code = bus_num.replace(" ", "-").upper()
            reg_number = f"KA-09-RB-{clean_bus_code}"[:50]
            if reg_number not in existing_reg_nums:
                bus = Bus(
                    id=str(uuid.uuid4()),
                    registration_number=reg_number,
                    model=f"Mysore City Transit ({bus_num})",
                    capacity=40,
                    status=BusStatus.ACTIVE,
                    is_active=True
                )
                session.add(bus)
                existing_reg_nums.add(reg_number)
                imported_buses += 1

            # Commit in batches of 50 routes
            if imported_routes % 50 == 0:
                await session.commit()
                print(f"Progress: {imported_routes} routes committed ({imported_stops} stops)...")

        await session.commit()
        print("\n=== IMPORT COMPLETED SUCCESSFULLY ===")
        print(f"Total Routes Created: {imported_routes}")
        print(f"Total Stops Created:  {imported_stops}")
        print(f"Total Buses Created:  {imported_buses}")


if __name__ == "__main__":
    asyncio.run(import_bus_routes())
