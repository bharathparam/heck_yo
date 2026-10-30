from __future__ import annotations

import asyncio
import base64
import csv
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
BACKEND_ENV = Path(__file__).resolve().parent / ".env"
if BACKEND_ENV.exists():
    for line in BACKEND_ENV.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key, value = stripped.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
DB_PATH = Path(os.getenv("RAILBUS_DB_PATH", str(ROOT / "backend" / "railbus.sqlite3")))
ROUTES_CSV = Path(os.getenv("RAILBUS_ROUTES_CSV", str(ROOT / "bus_routes.csv")))
THRESHOLD = 20
CAPACITY = 20
FARE_INR = float(os.getenv("RAILBUS_FARE_INR", "50"))
DEMAND_WINDOW_HOURS = max(1, int(os.getenv("RAILBUS_DEMAND_WINDOW_HOURS", "12")))
JWT_SECRET = os.getenv("RAILBUS_JWT_SECRET", "railbus-local-mvp-signing-key-change-before-deployment")
QR_SECRET = os.getenv("RAILBUS_QR_SECRET", "railbus-local-mvp-ticket-signing-key-change-before-deployment")
TOKEN_TTL_HOURS = 24
RAILWAY_STOP = "Railway Station"

app = FastAPI(title="RailBus Consolidated API", version="1.0.0", description="Demand-based Mysuru Railway Station feeder bus system API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)


@contextmanager
def db(immediate: bool = False):
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=20)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA journal_mode=WAL")
    if immediate:
        con.execute("BEGIN IMMEDIATE")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


KNOWN_STOP_COORDINATES: dict[str, tuple[float, float]] = {
    "railway station": (12.3168, 76.6468),
    "mysuru junction": (12.3168, 76.6468),
    "city bus stand": (12.3090, 76.6534),
    "suburban bus stand": (12.3086, 76.6558),
    "suburban bus station": (12.3086, 76.6558),
    "kr circle": (12.3075, 76.6508),
    "hardinge circle": (12.3072, 76.6565),
    "mysore palace": (12.3051, 76.6552),
    "palace": (12.3051, 76.6552),
    "chamundi hill": (12.2724, 76.6710),
    "kuvempunagar": (12.2858, 76.6234),
    "kuvempunagar complex": (12.2858, 76.6234),
    "saraswathipuram": (12.3015, 76.6352),
    "jayalakshmipuram": (12.3218, 76.6315),
    "gokulam": (12.3324, 76.6341),
    "vijayanagar": (12.3371, 76.6111),
    "vijayanagar 1st stage": (12.3371, 76.6111),
    "vijayanagar 2nd stage": (12.3410, 76.6080),
    "vijayanagar 3rd stage": (12.3450, 76.6020),
    "vijayanagar 4th stage": (12.3490, 76.5980),
    "infosys": (12.3619, 76.5929),
    "hebbal": (12.3601, 76.6132),
    "hebbal industrial area": (12.3601, 76.6132),
    "metagalli": (12.3456, 76.6234),
    "yadavagiri": (12.3245, 76.6378),
    "bannimantap": (12.3389, 76.6521),
    "ramakrishnanagar": (12.2765, 76.6189),
    "bogadi": (12.2987, 76.6012),
    "bogadi 2nd stage": (12.2987, 76.6012),
    "all india institute of speech and hearing": (12.3056, 76.6298),
    "aiish": (12.3056, 76.6298),
    "university of mysore": (12.3094, 76.6289),
    "manasagangothri": (12.3094, 76.6289),
    "chamarajapuram": (12.2989, 76.6432),
    "ashoka circle": (12.2965, 76.6498),
    "ballal circle": (12.2965, 76.6498),
    "rto": (12.2912, 76.6412),
    "nanjangud road": (12.2710, 76.6512),
    "jp nagar": (12.2654, 76.6389),
    "siddartha nagar": (12.3012, 76.6789),
    "alanahalli": (12.2945, 76.6912),
    "kalyanagiri": (12.3210, 76.6812),
    "shanthinagar": (12.3312, 76.6754),
    "rajiv nagar": (12.3389, 76.6812),
}


def lookup_coordinates(name: str) -> tuple[float | None, float | None]:
    clean = " ".join(re.sub(r"[^a-zA-Z0-9\s]", " ", name.lower()).split())
    for key, coords in KNOWN_STOP_COORDINATES.items():
        if key in clean or clean in key:
            return coords
    return (None, None)


def init_db() -> None:
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS routes (
          id TEXT PRIMARY KEY, route_code TEXT NOT NULL, origin TEXT NOT NULL,
          destination TEXT NOT NULL, path_json TEXT NOT NULL, fixed_fare REAL NOT NULL,
          source TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS buses (
          id TEXT PRIMARY KEY, registration_number TEXT NOT NULL UNIQUE,
          capacity INTEGER NOT NULL DEFAULT 20, model TEXT NOT NULL DEFAULT 'Ashok Leyland Lynx',
          status TEXT NOT NULL DEFAULT 'AVAILABLE', current_trip_id TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS trips (
          id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES routes(id),
          destination_stop_id TEXT NOT NULL, destination TEXT NOT NULL,
          train_number TEXT NOT NULL, travel_date TEXT NOT NULL, status TEXT NOT NULL,
          demand_count INTEGER NOT NULL DEFAULT 0, boarded_count INTEGER NOT NULL DEFAULT 0,
          base_fare REAL NOT NULL, bus_id TEXT REFERENCES buses(id), conductor_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deadline_at TEXT,
          UNIQUE(route_id, destination_stop_id, train_number, travel_date)
        );
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY, booking_reference TEXT NOT NULL UNIQUE,
          passenger_id TEXT NOT NULL REFERENCES users(id), trip_id TEXT NOT NULL REFERENCES trips(id),
          destination_stop_id TEXT NOT NULL, seat_count INTEGER NOT NULL,
          status TEXT NOT NULL, fare_amount REAL NOT NULL, request_key TEXT UNIQUE,
          payment_order_id TEXT, payment_id TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
          ticket_reference TEXT NOT NULL UNIQUE, qr_content TEXT NOT NULL,
          status TEXT NOT NULL, issued_at TEXT NOT NULL, expires_at TEXT NOT NULL,
          boarded_at TEXT
        );
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY, event_type TEXT NOT NULL, trip_id TEXT, route_name TEXT,
          message TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), trip_id TEXT,
          kind TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
          created_at TEXT NOT NULL, read_at TEXT
        );
        CREATE TABLE IF NOT EXISTS payment_orders (
          id TEXT PRIMARY KEY, razorpay_order_id TEXT UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), trip_id TEXT NOT NULL REFERENCES trips(id),
          destination_stop_id TEXT NOT NULL, seat_count INTEGER NOT NULL, amount_paise INTEGER NOT NULL,
          status TEXT NOT NULL, booking_id TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_trips_status_date ON trips(status, travel_date);
        CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id, status);
        CREATE INDEX IF NOT EXISTS idx_tickets_reference ON tickets(ticket_reference);
        """)
        trip_columns = {row[1] for row in con.execute("PRAGMA table_info(trips)")}
        if "deadline_at" not in trip_columns:
            con.execute("ALTER TABLE trips ADD COLUMN deadline_at TEXT")
        if "bus_id" not in trip_columns:
            con.execute("ALTER TABLE trips ADD COLUMN bus_id TEXT REFERENCES buses(id)")
        booking_columns = {row[1] for row in con.execute("PRAGMA table_info(bookings)")}
        for column in ("payment_order_id", "payment_id"):
            if column not in booking_columns:
                con.execute(f"ALTER TABLE bookings ADD COLUMN {column} TEXT")
    seed_users()
    seed_buses()
    import_routes()


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return f"pbkdf2_sha256${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def password_ok(password: str, encoded: str) -> bool:
    try:
        _, salt_text, expected = encoded.split("$", 2)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        return hmac.compare_digest(password_hash(password, salt), encoded)
    except Exception:
        return False


def seed_users() -> None:
    seeds = [
        ("operator@railbus.com", "RailBus Operator", "OPERATOR", "9845011111"),
        ("admin@railbus.com", "RailBus Admin", "ADMIN", "9845022222"),
        ("conductor@railbus.com", "Ravi Kumar (Conductor)", "CONDUCTOR", "9845012345"),
        ("conductor2@railbus.com", "Suresh Gowda (Conductor)", "CONDUCTOR", "9845023456"),
        ("conductor3@railbus.com", "Manjunath B (Conductor)", "CONDUCTOR", "9845034567"),
    ]
    password = os.getenv("RAILBUS_DEMO_PASSWORD", "password123")
    with db() as con:
        for email, name, role, phone in seeds:
            con.execute("INSERT OR IGNORE INTO users(id,email,password_hash,full_name,phone,role,created_at) VALUES(?,?,?,?,?,?,?)",
                        (str(uuid.uuid4()), email, password_hash(password), name, phone, role, now_iso()))


def seed_buses() -> None:
    buses_data = [
        ("bus-1", "KA-09-F-1021", 20, "Ashok Leyland Lynx", "AVAILABLE"),
        ("bus-2", "KA-09-F-1022", 20, "Tata Marcopolo City", "AVAILABLE"),
        ("bus-3", "KA-09-F-2045", 20, "Ashok Leyland Lynx", "AVAILABLE"),
        ("bus-4", "KA-09-F-3012", 20, "Eicher Starline 24", "AVAILABLE"),
        ("bus-5", "KA-09-F-4088", 20, "Tata Starbus Urban", "MAINTENANCE"),
    ]
    with db() as con:
        for bid, reg, cap, model, stat in buses_data:
            con.execute("INSERT OR IGNORE INTO buses(id, registration_number, capacity, model, status, created_at) VALUES(?,?,?,?,?,?)",
                        (bid, reg, cap, model, stat, now_iso()))


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized[:48] or "route"


def import_routes() -> None:
    if not ROUTES_CSV.exists():
        return
    found: dict[str, tuple[str, list[str]]] = {}
    with ROUTES_CSV.open("r", encoding="utf-8-sig", newline="") as file:
        for row_number, row in enumerate(csv.DictReader(file), start=1):
            try:
                route_name = (row.get("bus_num") or "").strip()
                stops = json.loads(row.get("route") or "[]")
            except (ValueError, TypeError):
                continue
            station_index = next((i for i, name in enumerate(stops) if "railway station" in str(name).lower()), -1)
            if station_index < 0 or station_index >= len(stops) - 1:
                continue
            onward = [str(name).strip() for name in stops[station_index + 1:] if str(name).strip()]
            if not onward:
                continue
            route_id = f"rb-{slug(route_name)}-{row_number}"
            found[route_id] = (route_name, onward)
    with db() as con:
        for route_id, (route_name, onward) in found.items():
            stops = []
            for index, name in enumerate(onward):
                lat, lon = lookup_coordinates(name)
                stops.append({
                    "id": f"{route_id}:{index+1}",
                    "sequence_order": index + 1,
                    "stop_order": index + 1,
                    "stop_name": name,
                    "distance_from_origin_km": round((index + 1) * 1.5, 1),
                    "latitude": lat,
                    "longitude": lon,
                })
            con.execute("INSERT OR REPLACE INTO routes(id,route_code,origin,destination,path_json,fixed_fare,source) VALUES(?,?,?,?,?,?,?)",
                        (route_id, route_name.strip(), "Mysuru Junction (Railway Station)", onward[-1],
                         json.dumps(stops, ensure_ascii=False), FARE_INR, "bus_routes.csv"))


def expire_demand_groups() -> None:
    stamp = now_iso()
    with db(immediate=True) as con:
        trips = con.execute("SELECT * FROM trips WHERE status='AGGREGATING' AND ((deadline_at IS NOT NULL AND deadline_at<=?) OR travel_date<?)", (stamp, date.today().isoformat())).fetchall()
        for trip in trips:
            bookings = con.execute("SELECT * FROM bookings WHERE trip_id=? AND status IN ('WAITING_DISPATCH','PENDING_PAYMENT')", (trip["id"],)).fetchall()
            con.execute("UPDATE trips SET status='CANCELLED',updated_at=? WHERE id=? AND status='AGGREGATING'", (stamp, trip["id"]))
            con.execute("UPDATE bookings SET status='CANCELLED' WHERE trip_id=? AND status IN ('WAITING_DISPATCH','PENDING_PAYMENT')", (trip["id"],))
            add_event(con, "DEMAND_EXPIRED", trip["id"], trip["destination"], f"Demand deadline passed at {trip['demand_count']}/{CAPACITY} seats. Reservations cancelled; eligible for refund.")
            con.execute("UPDATE payment_orders SET status='CANCELLED' WHERE trip_id=? AND status='PAID'", (trip["id"],))
            for booking in bookings:
                notify_user(con, booking["passenger_id"], trip["id"], "SERVICE_CANCELLED", "Bus service unavailable",
                            f"The Mysuru Junction service to {trip['destination']} did not reach {CAPACITY} seats before deadline. Your reservation was cancelled and will be refunded.")


async def demand_expiry_loop() -> None:
    while True:
        await asyncio.sleep(30)
        await asyncio.to_thread(expire_demand_groups)


@app.on_event("startup")
async def startup() -> None:
    init_db()
    app.state.demand_expiry_task = asyncio.create_task(demand_expiry_loop())


@app.on_event("shutdown")
async def shutdown() -> None:
    task = getattr(app.state, "demand_expiry_task", None)
    if task:
        task.cancel()


def user_public(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "user_id": row["id"], "email": row["email"], "full_name": row["full_name"],
            "phone": row["phone"], "role": row["role"], "is_active": bool(row["is_active"]), "created_at": row["created_at"]}


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def encode_token(user: sqlite3.Row) -> str:
    issued = int(datetime.now(timezone.utc).timestamp())
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64(json.dumps({"sub": user["id"], "role": user["role"], "iat": issued,
                             "exp": issued + TOKEN_TTL_HOURS * 3600}, separators=(",", ":")).encode())
    body = f"{header}.{payload}"
    signature = b64(hmac.new(JWT_SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}"


def decode_token(token: str) -> str:
    try:
        header, payload, signature = token.split(".")
        body = f"{header}.{payload}"
        expected = b64(hmac.new(JWT_SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature):
            raise ValueError("signature")
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(claims["exp"]) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired")
        return str(claims["sub"])
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired login session") from exc


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> sqlite3.Row:
    if not credentials:
        raise HTTPException(401, "Bearer token required")
    user_id = decode_token(credentials.credentials)
    with db() as con:
        row = con.execute("SELECT * FROM users WHERE id=? AND is_active=1", (user_id,)).fetchone()
    if not row:
        raise HTTPException(401, "Account is inactive or no longer exists")
    return row


def require_role(*roles: str):
    def dependency(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
        if user["role"] not in roles:
            raise HTTPException(403, "This account does not have access to this operation")
        return user
    return dependency


def add_event(con: sqlite3.Connection, event_type: str, trip_id: str | None, route_name: str, message: str) -> None:
    con.execute("INSERT INTO events(id,event_type,trip_id,route_name,message,created_at) VALUES(?,?,?,?,?,?)",
                (str(uuid.uuid4()), event_type, trip_id, route_name, message, now_iso()))


def notify_user(con: sqlite3.Connection, user_id: str, trip_id: str, kind: str, title: str, message: str) -> None:
    con.execute("INSERT INTO notifications(id,user_id,trip_id,kind,title,message,created_at) VALUES(?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), user_id, trip_id, kind, title, message, now_iso()))


def route_json(row: sqlite3.Row) -> dict[str, Any]:
    stops = json.loads(row["path_json"])
    return {"id": row["id"], "route_code": row["route_code"], "name": row["route_code"],
            "origin": row["origin"], "destination": row["destination"], "distance_km": round(len(stops) * 1.5, 1),
            "fixed_fare": row["fixed_fare"], "stops": stops}


def trip_json(con: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    route = con.execute("SELECT * FROM routes WHERE id=?", (row["route_id"],)).fetchone()
    seats = con.execute("SELECT COALESCE(SUM(seat_count),0) FROM bookings WHERE trip_id=? AND status IN ('WAITING_DISPATCH','CONFIRMED')", (row["id"],)).fetchone()[0]
    boarded = con.execute("SELECT COALESCE(SUM(b.seat_count),0) FROM bookings b JOIN tickets t ON t.booking_id=b.id WHERE b.trip_id=? AND t.status='BOARDED'", (row["id"],)).fetchone()[0]

    bus_id = row["bus_id"] if "bus_id" in row.keys() else None
    bus_reg = None
    if bus_id:
        b_row = con.execute("SELECT registration_number FROM buses WHERE id=?", (bus_id,)).fetchone()
        if b_row:
            bus_reg = b_row["registration_number"]

    conductor_id = row["conductor_id"] if "conductor_id" in row.keys() else None
    conductor_name = None
    if conductor_id:
        c_row = con.execute("SELECT full_name FROM users WHERE id=?", (conductor_id,)).fetchone()
        if c_row:
            conductor_name = c_row["full_name"]

    status = row["status"]
    is_threshold = status in ("THRESHOLD_MET", "READY_TO_DISPATCH", "SCHEDULED", "DISPATCHED", "BOARDING", "DEPARTED", "COMPLETED")

    result = {
        "id": row["id"], "route_id": row["route_id"],
        "route_name": route["route_code"] if route else "Route",
        "origin": route["origin"] if route else "Mysuru Junction",
        "destination": row["destination"], "status": status,
        "demand_count": int(seats), "confirmed_bookings_count": int(seats),
        "target_threshold": THRESHOLD, "capacity": CAPACITY,
        "seats_remaining": max(0, CAPACITY - int(seats)), "boarded_count": int(boarded),
        "base_fare": row["base_fare"], "departure_time": None,
        "train_number": row["train_number"], "travel_date": row["travel_date"],
        "destination_stop_id": row["destination_stop_id"], "deadline_at": row["deadline_at"],
        "bus_id": bus_id, "bus_registration": bus_reg,
        "conductor_id": conductor_id, "conductor_name": conductor_name,
        "threshold_met": is_threshold
    }
    return result


def make_ticket(con: sqlite3.Connection, booking_id: str, trip_id: str, travel_date: str) -> dict[str, Any]:
    ticket_id = str(uuid.uuid4())
    reference = "RB-" + secrets.token_hex(4).upper()
    issued = now_iso()
    expires = datetime.fromisoformat(f"{travel_date}T23:59:59+05:30").astimezone(timezone.utc).isoformat()
    payload = json.dumps({"ticket_id": ticket_id, "booking_id": booking_id, "trip_id": trip_id, "issued_at": issued}, separators=(",", ":")).encode()
    encoded = b64(payload)
    signature = b64(hmac.new(QR_SECRET.encode(), encoded.encode(), hashlib.sha256).digest())
    qr_content = f"{encoded}.{signature}"
    con.execute("INSERT INTO tickets(id,booking_id,ticket_reference,qr_content,status,issued_at,expires_at) VALUES(?,?,?,?,'ISSUED',?,?)",
                (ticket_id, booking_id, reference, qr_content, issued, expires))
    return {"id": ticket_id, "ticket_id": ticket_id, "ticket_reference": reference, "qr_content": qr_content,
            "status": "ISSUED", "issued_at": issued, "expires_at": expires}


def booking_json(con: sqlite3.Connection, booking: sqlite3.Row, include_ticket: bool = True) -> dict[str, Any]:
    user = con.execute("SELECT id,full_name,phone,email FROM users WHERE id=?", (booking["passenger_id"],)).fetchone()
    trip = con.execute("SELECT * FROM trips WHERE id=?", (booking["trip_id"],)).fetchone()
    route = con.execute("SELECT * FROM routes WHERE id=?", (trip["route_id"],)).fetchone()
    stops = json.loads(route["path_json"])
    destination_stop = next((stop for stop in stops if stop["id"] == booking["destination_stop_id"]), None)
    trip_data = trip_json(con, trip)
    trip_data["route"] = route_json(route)
    response = {
        "id": booking["id"], "booking_id": booking["id"], "booking_reference": booking["booking_reference"],
        "passenger_id": booking["passenger_id"], "passenger_name": user["full_name"], "passenger_phone": user["phone"], "passenger_email": user["email"],
        "trip_id": booking["trip_id"], "route_id": trip["route_id"], "destination_stop_id": booking["destination_stop_id"],
        "destination_stop": destination_stop, "route_name": trip["destination"], "seat_count": booking["seat_count"],
        "fare_amount": booking["fare_amount"], "status": booking["status"], "created_at": booking["created_at"],
        "trip": trip_data, "route": route_json(route)
    }
    payment = con.execute("SELECT status FROM payment_orders WHERE id=?", (booking["payment_order_id"],)).fetchone() if booking["payment_order_id"] else None
    response["payment_status"] = payment["status"] if payment else "UNKNOWN"
    if include_ticket:
        ticket = con.execute("SELECT * FROM tickets WHERE booking_id=?", (booking["id"],)).fetchone()
        if ticket:
            response["ticket"] = {
                "id": ticket["id"], "ticket_id": ticket["id"], "ticket_reference": ticket["ticket_reference"],
                "qr_content": ticket["qr_content"], "status": ticket["status"], "issued_at": ticket["issued_at"],
                "expires_at": ticket["expires_at"]
            }
            response["ticket_id"] = ticket["id"]
            response["ticket_reference"] = ticket["ticket_reference"]
            response["qr_content"] = ticket["qr_content"]
    return response


# Schemas
class LoginBody(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    password: str = Field(min_length=1, max_length=256)


class RegisterBody(LoginBody):
    password: str = Field(min_length=8, max_length=256)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=30)


class ResolveTripBody(BaseModel):
    route_id: str
    destination_stop_id: str
    train_number: str = Field(min_length=1, max_length=30)
    travel_date: date


class SearchServicesBody(BaseModel):
    destination: str = Field(min_length=1, max_length=120)
    train_number: str = Field(min_length=1, max_length=30)
    travel_date: date


class CreateBookingBody(BaseModel):
    trip_id: str
    destination_stop_id: str
    seat_count: int = Field(default=1, ge=1, le=6)
    idempotency_key: str | None = Field(default=None, max_length=120)
    request_key: str | None = Field(default=None, max_length=120)


class PaymentBody(BaseModel):
    trip_id: str | None = None
    destination_stop_id: str | None = None
    seat_count: int = Field(default=1, ge=1, le=6)
    booking_id: str | None = None
    idempotency_key: str | None = Field(default=None, max_length=120)
    request_key: str | None = Field(default=None, max_length=120)
    simulate_failure: bool = False


DirectPaymentBody = PaymentBody


class AssignTripBody(BaseModel):
    bus_id: str | None = None
    conductor_id: str | None = None
    departure_note: str | None = Field(default=None, max_length=200)


DispatchBody = AssignTripBody


class BoardBody(BaseModel):
    qr_code: str
    device_id: str | None = "conductor-app"


class OfflineBoarding(BaseModel):
    ticket_id: str
    boarded_at: datetime
    device_id: str | None = None


class OfflineSyncBody(BaseModel):
    trip_id: str
    boardings: list[OfflineBoarding]


# Routes and Health
@app.get("/health")
def health():
    with db() as con:
        route_count = con.execute("SELECT COUNT(*) FROM routes").fetchone()[0]
    return {"status": "ok", "service": "railbus-mvp", "routes": route_count}


# Auth
@app.post("/api/v1/auth/register")
@app.post("/auth/register")
def register(body: RegisterBody):
    email = str(body.email).lower()
    with db() as con:
        if con.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists")
        user_id = str(uuid.uuid4())
        con.execute("INSERT INTO users(id,email,password_hash,full_name,phone,role,created_at) VALUES(?,?,?,?,?,'PASSENGER',?)",
                    (user_id, email, password_hash(body.password), body.full_name.strip(), body.phone.strip(), now_iso()))
        user = con.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return {"access_token": encode_token(user), "token_type": "bearer", **user_public(user)}


@app.post("/api/v1/auth/login")
@app.post("/auth/login")
def login(body: LoginBody):
    with db() as con:
        user = con.execute("SELECT * FROM users WHERE email=? AND is_active=1", (str(body.email).lower(),)).fetchone()
    if not user or not password_ok(body.password, user["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect")
    return {"access_token": encode_token(user), "token_type": "bearer", **user_public(user)}


@app.get("/api/v1/auth/me")
@app.get("/auth/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return user_public(user)


# Routes
@app.get("/api/v1/routes")
@app.get("/routes")
def list_routes(limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0), q: str | None = None):
    with db() as con:
        if q:
            rows = con.execute("SELECT * FROM routes WHERE route_code LIKE ? OR destination LIKE ? ORDER BY route_code LIMIT ? OFFSET ?",
                               (f"%{q}%", f"%{q}%", limit, offset)).fetchall()
        else:
            rows = con.execute("SELECT * FROM routes ORDER BY route_code,id LIMIT ? OFFSET ?", (limit, offset)).fetchall()
    return [route_json(row) for row in rows]


@app.get("/api/v1/routes/{route_id}")
@app.get("/routes/{route_id}")
def get_route(route_id: str):
    with db() as con:
        row = con.execute("SELECT * FROM routes WHERE id=?", (route_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Route not found")
    return route_json(row)


# Search Services / Trips
def execute_trip_search(destination: str, train_number: str, travel_date: date) -> list[dict[str, Any]]:
    if travel_date < date.today():
        raise HTTPException(400, "Travel date cannot be in the past")
    if not train_number.strip() or not destination.strip():
        raise HTTPException(400, "Train number and destination are required")
    name = " ".join(destination.split()).casefold()
    train = train_number.strip().upper()
    date_str = travel_date.isoformat()
    expire_demand_groups()
    with db() as con:
        routes = con.execute("SELECT * FROM routes ORDER BY route_code,id").fetchall()
        result = []
        for route in routes:
            stops = json.loads(route["path_json"])
            stop = next((item for item in stops if item["stop_name"].strip().casefold() == name), None)
            if not stop:
                continue
            trip = con.execute("SELECT * FROM trips WHERE route_id=? AND destination_stop_id=? AND train_number=? AND travel_date=?",
                               (route["id"], stop["id"], train, date_str)).fetchone()
            if trip:
                seats = int(trip_json(con, trip)["demand_count"])
                status = trip["status"]
                if status in ("CANCELLED", "COMPLETED"):
                    continue
                trip_id = trip["id"]
                deadline_at = trip["deadline_at"]
            else:
                seats = 0
                status = "AGGREGATING"
                trip_id = None
                deadline_at = None
            result.append({
                "trip_id": trip_id,
                "route": route_json(route),
                "destination_stop": stop,
                "train_number": train,
                "travel_date": date_str,
                "status": status,
                "capacity": CAPACITY,
                "confirmed_seats": seats,
                "seats_remaining": max(0, CAPACITY - seats),
                "active_checkout_holds": 0,
                "fare_per_seat": float(route["fixed_fare"]),
                "deadline_at": deadline_at,
                "target_threshold": THRESHOLD
            })
    return result


@app.get("/api/v1/trips/search")
@app.get("/trips/search")
def get_trips_search(
    destination: str = Query(..., min_length=1),
    train_number: str = Query(..., min_length=1),
    travel_date: date = Query(...),
    user: sqlite3.Row = Depends(current_user)
):
    return execute_trip_search(destination, train_number, travel_date)


@app.post("/api/v1/services/search")
@app.post("/services/search")
def search_services(body: SearchServicesBody, user: sqlite3.Row = Depends(require_role("PASSENGER"))):
    return execute_trip_search(body.destination, body.train_number, body.travel_date)


@app.post("/api/v1/trips/resolve")
@app.post("/trips/resolve")
def resolve_trip(body: ResolveTripBody, user: sqlite3.Row = Depends(require_role("PASSENGER"))):
    if body.travel_date < date.today():
        raise HTTPException(400, "Travel date cannot be in the past")
    if not body.train_number.strip():
        raise HTTPException(400, "Train number is required")
    with db(immediate=True) as con:
        route = con.execute("SELECT * FROM routes WHERE id=?", (body.route_id,)).fetchone()
        if not route:
            raise HTTPException(404, "Route not found")
        stops = json.loads(route["path_json"])
        if not any(stop["id"] == body.destination_stop_id for stop in stops):
            raise HTTPException(400, "Destination stop is not served by the selected route")
        destination = next(stop["stop_name"] for stop in stops if stop["id"] == body.destination_stop_id)
        row = con.execute("SELECT * FROM trips WHERE route_id=? AND destination_stop_id=? AND train_number=? AND travel_date=?",
                          (body.route_id, body.destination_stop_id, body.train_number.strip().upper(), body.travel_date.isoformat())).fetchone()
        if not row:
            trip_id = str(uuid.uuid4())
            created = now_iso()
            deadline = (datetime.now(timezone.utc) + timedelta(hours=DEMAND_WINDOW_HOURS)).isoformat()
            con.execute("INSERT INTO trips(id,route_id,destination_stop_id,destination,train_number,travel_date,status,demand_count,base_fare,created_at,updated_at,deadline_at) VALUES(?,?,?,?,?,?,'AGGREGATING',0,?,?,?,?)",
                        (trip_id, body.route_id, body.destination_stop_id, destination, body.train_number.strip().upper(), body.travel_date.isoformat(), route["fixed_fare"], created, created, deadline))
            row = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
            add_event(con, "DEMAND_OPENED", trip_id, route["route_code"], f"Demand opened for train {body.train_number.upper()} to {destination}.")
        result = trip_json(con, row)
    return result


@app.get("/api/v1/trips")
@app.get("/trips")
def list_trips(status: str | None = None, route_id: str | None = None,
               user: sqlite3.Row = Depends(require_role("ADMIN", "OPERATOR", "PASSENGER", "CONDUCTOR"))):
    expire_demand_groups()
    with db(immediate=True) as con:
        query = "SELECT * FROM trips WHERE 1=1"
        params: list[Any] = []
        if status:
            target_status = status.upper()
            if target_status == "THRESHOLD_MET":
                query += " AND status IN ('THRESHOLD_MET', 'READY_TO_DISPATCH')"
            elif target_status == "SCHEDULED":
                query += " AND status IN ('SCHEDULED', 'DISPATCHED')"
            else:
                query += " AND status=?"
                params.append(target_status)
        if route_id:
            query += " AND route_id=?"
            params.append(route_id)
        rows = con.execute(query + " ORDER BY travel_date,created_at DESC", params).fetchall()
        return [trip_json(con, row) for row in rows]


@app.get("/api/v1/trips/{trip_id}")
@app.get("/trips/{trip_id}")
def get_trip(trip_id: str, user: sqlite3.Row = Depends(current_user)):
    expire_demand_groups()
    with db() as con:
        row = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Demand trip not found")
        return trip_json(con, row)


# Bookings
@app.post("/api/v1/bookings")
@app.post("/bookings")
def create_booking(body: CreateBookingBody, user: sqlite3.Row = Depends(require_role("PASSENGER"))):
    expire_demand_groups()
    key = body.idempotency_key or body.request_key
    with db(immediate=True) as con:
        if key:
            existing = con.execute("SELECT * FROM bookings WHERE passenger_id=? AND (request_key=? OR request_key=?)",
                                   (user["id"], key, f"direct:{key}")).fetchone()
            if existing:
                return booking_json(con, existing)
        trip = con.execute("SELECT * FROM trips WHERE id=?", (body.trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Trip not found")
        if trip["status"] != "AGGREGATING" or (trip["deadline_at"] and trip["deadline_at"] <= now_iso()):
            raise HTTPException(409, "This trip is no longer open for reservations")
        existing_seats = int(con.execute("SELECT COALESCE(SUM(seat_count),0) FROM bookings WHERE trip_id=? AND status IN ('WAITING_DISPATCH','CONFIRMED')", (trip["id"],)).fetchone()[0])
        if existing_seats + body.seat_count > CAPACITY:
            raise HTTPException(409, f"Only {max(0, CAPACITY - existing_seats)} seat(s) remain on this route")
        booking_id = str(uuid.uuid4())
        ref = "RBW-" + secrets.token_hex(4).upper()
        amount = float(trip["base_fare"]) * body.seat_count
        created = now_iso()
        con.execute(
            "INSERT INTO bookings(id, booking_reference, passenger_id, trip_id, destination_stop_id, seat_count, status, fare_amount, request_key, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (booking_id, ref, user["id"], body.trip_id, body.destination_stop_id, body.seat_count, "PENDING_PAYMENT", amount, key, created)
        )
        row = con.execute("SELECT * FROM bookings WHERE id=?", (booking_id,)).fetchone()
        return booking_json(con, row)


@app.post("/api/v1/payments/pay")
@app.post("/payments/pay")
@app.post("/api/v1/bookings/simulate-payment")
@app.post("/bookings/simulate-payment")
def pay_for_reservation(body: PaymentBody, user: sqlite3.Row = Depends(require_role("PASSENGER"))):
    if body.simulate_failure:
        raise HTTPException(402, "Simulated payment failure. Please retry.")
    expire_demand_groups()
    stamp = now_iso()
    key = body.idempotency_key or body.request_key
    with db(immediate=True) as con:
        if key:
            existing_booking = con.execute("SELECT * FROM bookings WHERE passenger_id=? AND (request_key=? OR request_key=?)",
                                           (user["id"], key, f"direct:{key}")).fetchone()
            if existing_booking and existing_booking["status"] in ("WAITING_DISPATCH", "CONFIRMED"):
                return booking_json(con, existing_booking)

        booking_row = None
        if body.booking_id:
            booking_row = con.execute("SELECT * FROM bookings WHERE id=? AND passenger_id=?", (body.booking_id, user["id"])).fetchone()
            if not booking_row:
                raise HTTPException(404, "Booking not found")
            trip_id = booking_row["trip_id"]
            destination_stop_id = booking_row["destination_stop_id"]
            seat_count = booking_row["seat_count"]
        else:
            trip_id = body.trip_id
            destination_stop_id = body.destination_stop_id
            seat_count = body.seat_count

        if not trip_id or not destination_stop_id:
            raise HTTPException(400, "trip_id and destination_stop_id are required")

        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Search for buses again; this service is no longer available")
        if trip["status"] != "AGGREGATING" or not trip["deadline_at"] or trip["deadline_at"] <= stamp:
            raise HTTPException(409, "This route group is closed to new reservations")
        if destination_stop_id != trip["destination_stop_id"]:
            raise HTTPException(400, "Destination does not match the selected route")

        existing = int(con.execute("SELECT COALESCE(SUM(seat_count),0) FROM bookings WHERE trip_id=? AND status IN ('WAITING_DISPATCH','CONFIRMED')", (trip["id"],)).fetchone()[0])
        if existing + seat_count > CAPACITY:
            raise HTTPException(409, f"Only {max(0, CAPACITY - existing)} seat(s) remain on this route")

        amount = round(float(trip["base_fare"]) * seat_count * 100)
        order_id = str(uuid.uuid4())
        payment_id = "direct_" + secrets.token_hex(8)

        if booking_row:
            booking_id = booking_row["id"]
            con.execute("UPDATE bookings SET status='WAITING_DISPATCH', payment_order_id=?, payment_id=?, request_key=? WHERE id=?",
                        (order_id, payment_id, key or f"direct:{payment_id}", booking_id))
        else:
            booking_id = str(uuid.uuid4())
            con.execute("INSERT INTO bookings(id,booking_reference,passenger_id,trip_id,destination_stop_id,seat_count,status,fare_amount,request_key,payment_order_id,payment_id,created_at) VALUES(?,?,?,?,?,?,'WAITING_DISPATCH',?,?,?,?,?)",
                        (booking_id, "RBW-" + secrets.token_hex(4).upper(), user["id"], trip["id"], destination_stop_id, seat_count, amount / 100, key or f"direct:{payment_id}", order_id, payment_id, stamp))

        con.execute("INSERT INTO payment_orders(id,user_id,trip_id,destination_stop_id,seat_count,amount_paise,status,created_at,expires_at,booking_id) VALUES(?,?,?,?,?,?,'PAID',?,?,?)",
                    (order_id, user["id"], trip["id"], destination_stop_id, seat_count, amount, stamp, stamp, booking_id))

        updated = existing + seat_count
        status = "THRESHOLD_MET" if updated >= CAPACITY else "AGGREGATING"
        con.execute("UPDATE trips SET demand_count=?,status=?,updated_at=? WHERE id=?", (updated, status, stamp, trip["id"]))

        route = con.execute("SELECT * FROM routes WHERE id=?", (trip["route_id"],)).fetchone()
        add_event(con, "PAID_WAITLIST_BOOKING", trip["id"], f"{route['route_code']} · {trip['destination']}", f"Passenger booking {booking_id[:8]} recorded as paid for {seat_count} seat(s); {updated}/{CAPACITY} seats.")
        if status == "THRESHOLD_MET":
            add_event(con, "THRESHOLD_REACHED", trip["id"], f"{route['route_code']} · {trip['destination']}", f"Capacity reached ({updated}/{CAPACITY}). Bus and conductor assignment required.")
            admins = con.execute("SELECT id FROM users WHERE role IN ('ADMIN','OPERATOR') AND is_active=1").fetchall()
            for admin in admins:
                notify_user(con, admin["id"], trip["id"], "DISPATCH_REQUIRED", "Bus ready for dispatch", f"Train {trip['train_number']} to {trip['destination']} has reached {CAPACITY} paid seats. Dispatch assignment is required.")
        notify_user(con, user["id"], trip["id"], "WAITING_DISPATCH", "Payment recorded · waiting for bus", f"Your {seat_count} seat(s) are marked paid and reserved. {updated}/{CAPACITY} seats are filled; your ticket will be issued after bus assignment.")
        return booking_json(con, con.execute("SELECT * FROM bookings WHERE id=?", (booking_id,)).fetchone())


@app.get("/api/v1/bookings")
@app.get("/bookings")
def passenger_bookings(user: sqlite3.Row = Depends(require_role("PASSENGER"))):
    expire_demand_groups()
    with db() as con:
        rows = con.execute("SELECT * FROM bookings WHERE passenger_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
        return [booking_json(con, row) for row in rows]


@app.get("/api/v1/operator/bookings")
@app.get("/operator/bookings")
def operator_bookings(user: sqlite3.Row = Depends(require_role("ADMIN", "OPERATOR")), limit: int = Query(200, ge=1, le=1000)):
    expire_demand_groups()
    with db() as con:
        rows = con.execute("SELECT * FROM bookings ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [booking_json(con, row, include_ticket=False) for row in rows]


# Tickets
def ticket_json(con: sqlite3.Connection, ticket: sqlite3.Row) -> dict[str, Any]:
    booking = con.execute("SELECT * FROM bookings WHERE id=?", (ticket["booking_id"],)).fetchone()
    response = booking_json(con, booking)
    response.update({
        "id": ticket["id"], "ticket_id": ticket["id"], "ticket_reference": ticket["ticket_reference"],
        "qr_content": ticket["qr_content"], "qr_data_url": None, "status": ticket["status"],
        "issued_at": ticket["issued_at"], "expires_at": ticket["expires_at"]
    })
    response["ticket"] = {
        "id": ticket["id"], "ticket_id": ticket["id"], "ticket_reference": ticket["ticket_reference"],
        "qr_content": ticket["qr_content"], "status": ticket["status"], "issued_at": ticket["issued_at"],
        "expires_at": ticket["expires_at"]
    }
    return response


@app.get("/api/v1/tickets/{ticket_key}")
@app.get("/tickets/{ticket_key}")
def get_ticket(ticket_key: str, user: sqlite3.Row = Depends(current_user)):
    with db() as con:
        ticket = con.execute("SELECT t.* FROM tickets t JOIN bookings b ON b.id=t.booking_id WHERE t.id=? OR t.ticket_reference=? OR b.id=? OR b.booking_reference=?",
                             (ticket_key, ticket_key, ticket_key, ticket_key)).fetchone()
        if not ticket:
            booking = con.execute("SELECT * FROM bookings WHERE id=? OR booking_reference=?", (ticket_key, ticket_key)).fetchone()
            if not booking:
                raise HTTPException(404, "Booking or ticket not found")
            if user["role"] != "PASSENGER" or booking["passenger_id"] != user["id"]:
                raise HTTPException(403, "This booking belongs to another passenger")
            return booking_json(con, booking)
        booking = con.execute("SELECT * FROM bookings WHERE id=?", (ticket["booking_id"],)).fetchone()
        if user["role"] != "PASSENGER":
            raise HTTPException(403, "Ticket lookup is restricted to the ticket owner; conductors validate tickets through trip boarding")
        if booking["passenger_id"] != user["id"]:
            raise HTTPException(403, "This ticket belongs to another passenger")
        return ticket_json(con, ticket)


# Notifications
@app.get("/api/v1/notifications")
@app.get("/notifications")
def passenger_notifications(user: sqlite3.Row = Depends(current_user)):
    with db() as con:
        return [dict(row) for row in con.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100", (user["id"],)).fetchall()]


@app.post("/api/v1/notifications/{notification_id}/read")
@app.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: sqlite3.Row = Depends(current_user)):
    with db() as con:
        updated = con.execute("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?", (now_iso(), notification_id, user["id"])).rowcount
        if not updated:
            raise HTTPException(404, "Notification not found")
    return {"success": True}


# Fleet & Conductors
@app.get("/api/v1/buses")
@app.get("/buses")
def list_buses(user: sqlite3.Row = Depends(require_role("ADMIN", "OPERATOR"))):
    with db() as con:
        rows = con.execute("SELECT * FROM buses ORDER BY registration_number").fetchall()
        return [dict(row) for row in rows]


@app.get("/api/v1/conductors")
@app.get("/conductors")
def list_conductors(user: sqlite3.Row = Depends(require_role("ADMIN", "OPERATOR"))):
    with db() as con:
        conductors = con.execute("SELECT id, full_name, phone, email, is_active FROM users WHERE role='CONDUCTOR' ORDER BY full_name").fetchall()
        result = []
        for c in conductors:
            active_trip = con.execute("SELECT id, train_number, travel_date FROM trips WHERE conductor_id=? AND status IN ('SCHEDULED','DISPATCHED','BOARDING','DEPARTED')", (c["id"],)).fetchone()
            result.append({
                "id": c["id"],
                "full_name": c["full_name"],
                "phone": c["phone"],
                "email": c["email"],
                "status": "ASSIGNED" if active_trip else "AVAILABLE",
                "current_trip_id": active_trip["id"] if active_trip else None
            })
        return result


# Dispatch & Assignment
@app.post("/api/v1/trips/{trip_id}/assign")
@app.post("/trips/{trip_id}/assign")
@app.post("/api/v1/operator/trips/{trip_id}/dispatch")
def assign_trip(trip_id: str, body: AssignTripBody | None = None, user: sqlite3.Row = Depends(require_role("ADMIN", "OPERATOR"))):
    if user["role"] not in ("ADMIN", "OPERATOR"):
        raise HTTPException(403, "This account does not have access to this operation")
    with db(immediate=True) as con:
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Demand trip not found")
        if trip["status"] not in ("THRESHOLD_MET", "READY_TO_DISPATCH") or int(trip["demand_count"]) < CAPACITY:
            raise HTTPException(409, f"Dispatch requires {CAPACITY} paid seats. This group has {trip['demand_count']}/{CAPACITY} seats (status: {trip['status']}).")

        bus_id = body.bus_id if body and body.bus_id else trip["bus_id"]
        if bus_id:
            bus = con.execute("SELECT * FROM buses WHERE id=?", (bus_id,)).fetchone()
            if not bus:
                raise HTTPException(404, f"Bus {bus_id} not found in fleet")
            if bus["status"] == "MAINTENANCE":
                raise HTTPException(409, f"Bus conflict: Bus {bus['registration_number']} is currently under maintenance")
            conflict = con.execute(
                "SELECT * FROM trips WHERE bus_id=? AND travel_date=? AND status IN ('SCHEDULED','DISPATCHED','BOARDING','DEPARTED') AND id!=?",
                (bus_id, trip["travel_date"], trip_id)
            ).fetchone()
            if conflict:
                raise HTTPException(409, f"Bus conflict: Bus {bus['registration_number']} is already assigned to active trip {conflict['id'][:8]} (Train {conflict['train_number']}) on {conflict['travel_date']}.")

        conductor_id = body.conductor_id if body and body.conductor_id else trip["conductor_id"]
        if conductor_id:
            conductor = con.execute("SELECT * FROM users WHERE id=? AND role='CONDUCTOR'", (conductor_id,)).fetchone()
            if not conductor:
                raise HTTPException(404, f"Conductor {conductor_id} not found or account is not a conductor")
            conflict = con.execute(
                "SELECT * FROM trips WHERE conductor_id=? AND travel_date=? AND status IN ('SCHEDULED','DISPATCHED','BOARDING','DEPARTED') AND id!=?",
                (conductor_id, trip["travel_date"], trip_id)
            ).fetchone()
            if conflict:
                raise HTTPException(409, f"Conductor conflict: Conductor {conductor['full_name']} is already assigned to active trip {conflict['id'][:8]} (Train {conflict['train_number']}) on {conflict['travel_date']}.")

        if not bus_id:
            avail_bus = con.execute("SELECT id FROM buses WHERE status='AVAILABLE' LIMIT 1").fetchone()
            if avail_bus:
                bus_id = avail_bus["id"]
        if not conductor_id:
            avail_conductor = con.execute("SELECT id FROM users WHERE role='CONDUCTOR' LIMIT 1").fetchone()
            if avail_conductor:
                conductor_id = avail_conductor["id"]

        route = con.execute("SELECT * FROM routes WHERE id=?", (trip["route_id"],)).fetchone()
        pending = con.execute("SELECT * FROM bookings WHERE trip_id=? AND status='WAITING_DISPATCH' ORDER BY created_at", (trip_id,)).fetchall()
        for b in pending:
            make_ticket(con, b["id"], trip_id, trip["travel_date"])
        con.execute("UPDATE bookings SET status='CONFIRMED' WHERE trip_id=? AND status='WAITING_DISPATCH'", (trip_id,))

        stamp = now_iso()
        con.execute("UPDATE trips SET status='SCHEDULED', bus_id=?, conductor_id=?, updated_at=? WHERE id=?",
                    (bus_id, conductor_id, stamp, trip_id))
        if bus_id:
            con.execute("UPDATE buses SET status='ASSIGNED', current_trip_id=? WHERE id=?", (trip_id, bus_id))

        note = body.departure_note if body and body.departure_note else ""
        add_event(con, "BUS_SCHEDULED", trip_id, f"{route['route_code']} · {trip['destination']}",
                  f"Trip scheduled and assigned by {user['full_name']}. {note}".strip())
        message = f"Bus confirmed for dispatch on Train {trip['train_number']} to {trip['destination']}. Your ticket is ready."
        for b in pending:
            notify_user(con, b["passenger_id"], trip_id, "TICKET_CONFIRMED", "Bus dispatched · ticket confirmed", message)

        result = trip_json(con, con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone())
        result["tickets_issued"] = len(pending)
        return result


dispatch_service = assign_trip


@app.get("/api/v1/operator/activity")
@app.get("/operator/activity")
@app.get("/api/v1/audit")
@app.get("/audit")
def audit_activity(user: sqlite3.Row = Depends(require_role("ADMIN", "OPERATOR")), limit: int = Query(100, ge=1, le=500)):
    with db() as con:
        rows = con.execute("SELECT * FROM events ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(row) for row in rows]


# Train Intelligence & SmartSync
@app.get("/api/v1/trains/intelligence")
@app.get("/trains/intelligence")
@app.get("/api/v1/smartsync/status")
@app.get("/smartsync/status")
def get_smartsync_intelligence(user: sqlite3.Row = Depends(current_user)):
    integration_state = os.getenv("RAILBUS_INTEGRATION_STATE", "SYNTHETIC_DATA")
    return {
        "integration_state": integration_state,
        "badge_text": f"{integration_state} · SYNTHETIC RAIL DATA",
        "is_synthetic": integration_state != "LIVE",
        "disclaimer": "Synthetic railway simulation for Mysuru Railway Station feeder planning. Real Indian Railways / CRIS telemetry is not connected.",
        "last_sync_at": now_iso(),
        "trains": [
            {
                "train_number": "12614",
                "train_name": "Tippu Express",
                "origin": "KSR Bengaluru (SBC)",
                "destination": "Mysuru Junction (MYS)",
                "scheduled_arrival": "11:00",
                "estimated_arrival": "11:06",
                "delay_minutes": 6,
                "platform": "PF 1",
                "status": "RUNNING",
                "feeder_demand_status": "THRESHOLD_MET",
                "confidence_score": 0.94,
                "is_synthetic": True
            },
            {
                "train_number": "16216",
                "train_name": "Chamundi Express",
                "origin": "KSR Bengaluru (SBC)",
                "destination": "Mysuru Junction (MYS)",
                "scheduled_arrival": "21:05",
                "estimated_arrival": "21:05",
                "delay_minutes": 0,
                "platform": "PF 2",
                "status": "ON_TIME",
                "feeder_demand_status": "AGGREGATING",
                "confidence_score": 0.98,
                "is_synthetic": True
            },
            {
                "train_number": "12007",
                "train_name": "Chennai Shatabdi",
                "origin": "MGR Chennai Central (MAS)",
                "destination": "Mysuru Junction (MYS)",
                "scheduled_arrival": "13:00",
                "estimated_arrival": "13:18",
                "delay_minutes": 18,
                "platform": "PF 3",
                "status": "DELAYED",
                "feeder_demand_status": "THRESHOLD_MET",
                "confidence_score": 0.89,
                "is_synthetic": True
            },
            {
                "train_number": "16536",
                "train_name": "Gol Gumbaz Express",
                "origin": "Pandharpur (PVR)",
                "destination": "Mysuru Junction (MYS)",
                "scheduled_arrival": "10:45",
                "estimated_arrival": "10:55",
                "delay_minutes": 10,
                "platform": "PF 4",
                "status": "RUNNING",
                "feeder_demand_status": "SCHEDULED",
                "confidence_score": 0.91,
                "is_synthetic": True
            }
        ]
    }


# Conductor Portal
@app.get("/api/v1/conductor/trips")
@app.get("/conductor/trips")
def conductor_trips(user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db() as con:
        rows = con.execute("SELECT * FROM trips WHERE status IN ('SCHEDULED','DISPATCHED','BOARDING','DEPARTED') AND (conductor_id IS NULL OR conductor_id=?) ORDER BY travel_date,created_at", (user["id"],)).fetchall()
        return [{**trip_json(con, row), "total_confirmed_passengers": int(row["demand_count"]), "route_name": row["destination"]} for row in rows]


def conductor_trip(con: sqlite3.Connection, trip_id: str) -> sqlite3.Row:
    trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
    if not trip:
        raise HTTPException(404, "Demand trip not found")
    if trip["status"] not in ("SCHEDULED", "DISPATCHED", "BOARDING", "DEPARTED", "COMPLETED"):
        raise HTTPException(409, "Admin must approve dispatch after the group reaches 20 paid seats")
    return trip


def require_claimed_trip(trip: sqlite3.Row, user: sqlite3.Row) -> None:
    if not trip["conductor_id"]:
        raise HTTPException(409, "Open boarding to claim this service before viewing passenger names")
    if trip["conductor_id"] != user["id"]:
        raise HTTPException(403, "This service has already been claimed by another conductor")


@app.get("/api/v1/conductor/trips/{trip_id}/manifest")
@app.get("/conductor/trips/{trip_id}/manifest")
def manifest(trip_id: str, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db() as con:
        trip = conductor_trip(con, trip_id)
        require_claimed_trip(trip, user)
        rows = con.execute("SELECT b.*,t.id AS ticket_id,t.ticket_reference,t.status AS ticket_status,t.boarded_at,u.full_name,u.phone FROM bookings b JOIN tickets t ON t.booking_id=b.id JOIN users u ON u.id=b.passenger_id WHERE b.trip_id=? ORDER BY b.created_at", (trip_id,)).fetchall()
        passengers = [{"ticket_id": row["ticket_id"], "ticket_reference": row["ticket_reference"],
                       "passenger_name": row["full_name"], "seat_count": row["seat_count"], "status": row["ticket_status"], "boarded_at": row["boarded_at"]} for row in rows]
        return {"trip_id": trip_id, "route_name": trip["destination"], "status": trip["status"],
                "total_passengers": int(trip["demand_count"]), "boarded_count": int(trip["boarded_count"]), "manifest": passengers}


@app.post("/api/v1/conductor/trips/{trip_id}/boarding/open")
@app.post("/conductor/trips/{trip_id}/boarding/open")
def open_boarding(trip_id: str, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db(immediate=True) as con:
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Demand trip not found")
        if trip["status"] not in ("SCHEDULED", "DISPATCHED"):
            raise HTTPException(409, f"Cannot open boarding while service is {trip['status']}")
        con.execute("UPDATE trips SET status='BOARDING',conductor_id=?,updated_at=? WHERE id=?", (user["id"], now_iso(), trip_id))
        add_event(con, "BOARDING_STARTED", trip_id, trip["destination"], f"Conductor {user['full_name']} opened boarding.")
        return {"trip_id": trip_id, "status": "BOARDING"}


def verify_qr(value: str) -> dict[str, Any] | None:
    try:
        encoded, signature = value.strip().split(".", 1)
        expected = b64(hmac.new(QR_SECRET.encode(), encoded.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature):
            return None
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        return payload
    except Exception:
        return None


@app.post("/api/v1/conductor/trips/{trip_id}/board")
@app.post("/conductor/trips/{trip_id}/board")
def board_ticket(trip_id: str, body: BoardBody, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db(immediate=True) as con:
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Demand trip not found")
        if trip["status"] != "BOARDING":
            raise HTTPException(409, "Boarding is not open for this service")
        require_claimed_trip(trip, user)
        payload = verify_qr(body.qr_code)
        if "." in body.qr_code and not payload:
            raise HTTPException(400, "Ticket QR signature is invalid")
        ticket_id = payload.get("ticket_id") if payload else None
        ticket = con.execute("SELECT * FROM tickets WHERE id=? OR ticket_reference=?", (ticket_id or "", body.qr_code.strip())).fetchone()
        if not ticket:
            raise HTTPException(404, "Ticket not found")
        booking = con.execute("SELECT * FROM bookings WHERE id=?", (ticket["booking_id"],)).fetchone()
        if booking["trip_id"] != trip_id or (payload and payload.get("trip_id") != trip_id):
            raise HTTPException(400, "Ticket is for a different service")
        if ticket["status"] == "BOARDED":
            raise HTTPException(409, "ALREADY_BOARDED: this ticket was already scanned")
        if ticket["status"] != "ISSUED":
            raise HTTPException(409, f"Ticket status is {ticket['status']}")
        boarded_at = now_iso()
        con.execute("UPDATE tickets SET status='BOARDED',boarded_at=? WHERE id=?", (boarded_at, ticket["id"]))
        con.execute("UPDATE trips SET boarded_count=boarded_count+?,updated_at=? WHERE id=?", (booking["seat_count"], boarded_at, trip_id))
        add_event(con, "PASSENGER_BOARDED", trip_id, trip["destination"], f"Ticket {ticket['ticket_reference']} boarded.")
        updated = con.execute("SELECT boarded_count,demand_count FROM trips WHERE id=?", (trip_id,)).fetchone()
        passenger = con.execute("SELECT full_name FROM users WHERE id=?", (booking["passenger_id"],)).fetchone()
        return {"success": True, "ticket_id": ticket["id"], "ticket_reference": ticket["ticket_reference"],
                "passenger_name": passenger["full_name"], "boarded_at": boarded_at,
                "boarded_count": updated["boarded_count"], "total_passengers": updated["demand_count"], "message": "Passenger boarded"}


@app.post("/api/v1/conductor/trips/{trip_id}/sync-offline")
@app.post("/conductor/trips/{trip_id}/sync-offline")
def sync_offline(trip_id: str, body: OfflineSyncBody, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    if body.trip_id != trip_id:
        raise HTTPException(400, "Trip ID in body does not match URL")
    synced, errors = 0, []
    with db(immediate=True) as con:
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Demand trip not found")
        if trip["status"] not in ("BOARDING", "DEPARTED"):
            raise HTTPException(409, "Offline scans can only sync during boarding or after departure")
        require_claimed_trip(trip, user)
        for item in body.boardings:
            ticket = con.execute("SELECT * FROM tickets WHERE id=?", (item.ticket_id,)).fetchone()
            if not ticket:
                errors.append(f"{item.ticket_id}: ticket not found")
                continue
            booking = con.execute("SELECT * FROM bookings WHERE id=?", (ticket["booking_id"],)).fetchone()
            if booking["trip_id"] != trip_id or ticket["status"] != "ISSUED":
                errors.append(f"{item.ticket_id}: invalid service or already used")
                continue
            con.execute("UPDATE tickets SET status='BOARDED',boarded_at=? WHERE id=?", (item.boarded_at.isoformat(), ticket["id"]))
            con.execute("UPDATE trips SET boarded_count=boarded_count+? WHERE id=?", (booking["seat_count"], trip_id))
            synced += 1
        updated = con.execute("SELECT boarded_count,demand_count FROM trips WHERE id=?", (trip_id,)).fetchone()
        return {"trip_id": trip_id, "synced_count": synced, "failed_count": len(errors),
                "boarded_count": updated["boarded_count"], "total_passengers": updated["demand_count"], "errors": errors}


@app.post("/api/v1/conductor/trips/{trip_id}/depart")
@app.post("/conductor/trips/{trip_id}/depart")
def depart(trip_id: str, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db(immediate=True) as con:
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Demand trip not found")
        if trip["status"] != "BOARDING":
            raise HTTPException(409, "Service must be boarding before it can depart")
        require_claimed_trip(trip, user)
        con.execute("UPDATE trips SET status='DEPARTED',updated_at=? WHERE id=?", (now_iso(), trip_id))
        add_event(con, "TRIP_DEPARTED", trip_id, trip["destination"], "Service departed Mysuru Railway Station.")
        return {"trip_id": trip_id, "status": "DEPARTED"}


@app.post("/api/v1/conductor/trips/{trip_id}/complete")
@app.post("/conductor/trips/{trip_id}/complete")
def complete(trip_id: str, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db(immediate=True) as con:
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        if not trip:
            raise HTTPException(404, "Demand trip not found")
        if trip["status"] != "DEPARTED":
            raise HTTPException(409, "Service must depart before completion")
        require_claimed_trip(trip, user)
        con.execute("UPDATE trips SET status='COMPLETED',updated_at=? WHERE id=?", (now_iso(), trip_id))
        if trip["bus_id"]:
            con.execute("UPDATE buses SET status='AVAILABLE', current_trip_id=NULL WHERE id=?", (trip["bus_id"],))
        add_event(con, "TRIP_COMPLETED", trip_id, trip["destination"], "Service completed at its destination.")
        return {"trip_id": trip_id, "status": "COMPLETED"}


@app.get("/api/v1/conductor/trips/{trip_id}/ticket/{ticket_key}")
@app.get("/conductor/trips/{trip_id}/ticket/{ticket_key}")
def conductor_ticket(trip_id: str, ticket_key: str, user: sqlite3.Row = Depends(require_role("CONDUCTOR"))):
    with db() as con:
        ticket = con.execute("SELECT * FROM tickets WHERE id=? OR ticket_reference=?", (ticket_key, ticket_key)).fetchone()
        if not ticket:
            raise HTTPException(404, "Ticket not found")
        booking = con.execute("SELECT * FROM bookings WHERE id=?", (ticket["booking_id"],)).fetchone()
        if booking["trip_id"] != trip_id:
            raise HTTPException(400, "Ticket is for a different service")
        trip = con.execute("SELECT * FROM trips WHERE id=?", (trip_id,)).fetchone()
        require_claimed_trip(trip, user)
        return ticket_json(con, ticket)
