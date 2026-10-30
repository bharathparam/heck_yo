# RailBus Backend

Python FastAPI async backend for the RailBus transit platform.

## Quick Start

### 1. Activate Environment
```bash
cd /Users/bharathparameshwara/Desktop/railbus-backend
source .venv/bin/activate
```

### 2. Run Backend Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8008 --reload
```
- Interactive Swagger UI: [http://127.0.0.1:8008/docs](http://127.0.0.1:8008/docs)
- Health Check: [http://127.0.0.1:8008/health](http://127.0.0.1:8008/health)

### 3. Run Test Suite (16/16 Unit & Edge Case Tests)
```bash
PYTHONPATH=. pytest tests/ -v
```

## Seeded Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Operator** | `operator@railbus.com` | `password123` |
| **Conductor** | `conductor@railbus.com` | `password123` |
| **Passenger** | `passenger1@example.com` | `password123` |

## Passenger MCP Server (for Claude / LLMs)

An MCP (Model Context Protocol) server is provided in [`mcp_server.py`](file:///Users/bharathparameshwara/Desktop/railbus-backend/mcp_server.py). It removes credential authentication requirements for passenger actions.

### Add to Claude Desktop

Add this snippet to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "railbus-passenger": {
      "command": "/Users/bharathparameshwara/Desktop/railbus-backend/.venv/bin/python",
      "args": [
        "/Users/bharathparameshwara/Desktop/railbus-backend/mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "/Users/bharathparameshwara/Desktop/railbus-backend"
      }
    }
  }
}
```

### Available Tools in MCP:
- `search_routes(query, limit)`: Search bus routes, origins, destinations, and intermediate stops.
- `list_trips(route_id, status)`: Query active bus/train trips, live seat availability, and fare.
- `get_trip_details(trip_id)`: Detailed trip overview.
- `book_seats(trip_id, seat_count, ...)`: Book seats without passwords or login tokens.
- `confirm_payment_and_issue_ticket(booking_id)`: Confirm simulated payment and generate HMAC digital QR ticket.
- `get_ticket_details(ticket_id)`: View ticket status, route, and boarding QR code.
- `get_my_bookings_and_tickets(passenger_email)`: View passenger's active and past bookings.

## Included Data
- Database: `railbus.db` (SQLite async with 412 Mysore city bus routes, 9,002 stops, active trips, seeded tickets).

