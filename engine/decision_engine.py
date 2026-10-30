"""
RailBus Intelligence Engine - Decision Engine (Supply Optimization & Allocation)
Translates forecasted passenger demand and confidence bounds into optimal vehicle supply,
fleet allocation, crew requirements, and actionable operator recommendations.
"""
import math
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta


class VehicleType:
    MINI = {"name": "Mini RailBus", "capacity": 18, "cost_per_trip": 1200, "crew": 2}
    STANDARD = {"name": "Standard RailBus", "capacity": 32, "cost_per_trip": 1800, "crew": 2}
    EXPRESS = {"name": "Express Coach", "capacity": 48, "cost_per_trip": 2500, "crew": 2}


class DecisionEngine:
    """Supply allocation & dispatch recommendation engine."""

    AVG_TICKET_PRICE = {
        "Bengaluru": 250,
        "Mandya": 120,
        "Hassan": 180,
        "Chamarajanagar": 110,
        "Nanjangud": 80,
        "Other": 140
    }

    def __init__(self, target_load_factor_range=(0.70, 0.90)):
        self.min_lf, self.max_lf = target_load_factor_range

    def optimize_route_supply(
        self,
        destination: str,
        predicted_passengers: float,
        p10_lower: float,
        p90_upper: float,
        confirmed_bookings: int,
        risk_tolerance: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Determines the optimal fleet mix to serve forecasted route demand.
        Risk tolerances:
          - 'conservative': sizes capacity for p90 upper bound (zero stranding risk)
          - 'balanced': sizes capacity for p50 + 0.4 * (p90 - p50) (resilient buffer)
          - 'lean': sizes capacity for p50 expected value (cost minimized)
        """
        if risk_tolerance == "conservative":
            planning_demand = p90_upper
        elif risk_tolerance == "lean":
            planning_demand = predicted_passengers
        else:  # balanced
            planning_demand = predicted_passengers + 0.4 * (p90_upper - predicted_passengers)

        planning_demand = max(float(confirmed_bookings), float(planning_demand))
        
        # Determine optimal fleet mix
        vehicles_allocated = []
        total_capacity = 0

        if planning_demand <= 0.5:
            # On-demand micro-feeder / taxi voucher or 1 mini on standby
            vehicles_allocated = [{"type": VehicleType.MINI["name"], "capacity": 18, "count": 1}]
            total_capacity = 18
        elif planning_demand <= 18:
            vehicles_allocated = [{"type": VehicleType.MINI["name"], "capacity": 18, "count": 1}]
            total_capacity = 18
        elif planning_demand <= 32:
            vehicles_allocated = [{"type": VehicleType.STANDARD["name"], "capacity": 32, "count": 1}]
            total_capacity = 32
        elif planning_demand <= 48:
            vehicles_allocated = [{"type": VehicleType.EXPRESS["name"], "capacity": 48, "count": 1}]
            total_capacity = 48
        elif planning_demand <= 64:
            # 2 Standard buses
            vehicles_allocated = [{"type": VehicleType.STANDARD["name"], "capacity": 32, "count": 2}]
            total_capacity = 64
        elif planning_demand <= 80:
            # 1 Express + 1 Standard
            vehicles_allocated = [
                {"type": VehicleType.EXPRESS["name"], "capacity": 48, "count": 1},
                {"type": VehicleType.STANDARD["name"], "capacity": 32, "count": 1}
            ]
            total_capacity = 80
        else:
            # High demand corridor
            n_express = int(math.ceil(planning_demand / 48))
            vehicles_allocated = [{"type": VehicleType.EXPRESS["name"], "capacity": 48, "count": n_express}]
            total_capacity = n_express * 48

        # Load Factor calculations
        expected_pax = round(predicted_passengers, 1)
        projected_load_factor = round((expected_pax / total_capacity) * 100, 1) if total_capacity > 0 else 0
        conservative_load_factor = round((planning_demand / total_capacity) * 100, 1) if total_capacity > 0 else 0

        # Status & Alerts
        if projected_load_factor > 92:
            status = "STRANDING_RISK"
            status_label = "High Stranding Risk — Standby Bus Recommended"
            badge_color = "red"
        elif projected_load_factor < 40:
            status = "LOW_UTILIZATION"
            status_label = "Low Utilization — Downsize or Co-schedule"
            badge_color = "amber"
        elif 65 <= projected_load_factor <= 92:
            status = "OPTIMAL"
            status_label = "Optimal Supply Balance"
            badge_color = "green"
        else:
            status = "ACCEPTABLE"
            status_label = "Adequate Capacity"
            badge_color = "blue"

        # Financial metrics
        ticket_fare = self.AVG_TICKET_PRICE.get(destination, 150)
        est_revenue = int(expected_pax * ticket_fare)
        total_cost = sum(
            v["count"] * (VehicleType.MINI["cost_per_trip"] if "Mini" in v["type"] 
                          else VehicleType.EXPRESS["cost_per_trip"] if "Express" in v["type"] 
                          else VehicleType.STANDARD["cost_per_trip"])
            for v in vehicles_allocated
        )
        total_crew = sum(v["count"] * 2 for v in vehicles_allocated)  # 1 driver + 1 conductor

        # Recommendation Text
        v_summary = " + ".join([f"{v['count']}x {v['type']}" for v in vehicles_allocated])
        if status == "STRANDING_RISK":
            rec_text = f"Deploy {v_summary}. Peak demand expected ({planning_demand:.0f} pax). Station 1 reserve mini-bus at standby bay."
        elif status == "LOW_UTILIZATION":
            rec_text = f"Deploy {v_summary}. Projected load factor is {projected_load_factor}%. Consider bundling with intermediate stops."
        else:
            rec_text = f"Deploy {v_summary} ({total_capacity} seats) for expected {expected_pax} passengers. Optimal allocation."

        return {
            "destination_station": destination,
            "planning_demand": round(planning_demand, 1),
            "expected_passengers": expected_pax,
            "confirmed_bookings": confirmed_bookings,
            "demand_confidence_range": [round(p10_lower, 1), round(p90_upper, 1)],
            "vehicles_allocated": vehicles_allocated,
            "vehicles_summary": v_summary,
            "total_supply_seats": total_capacity,
            "projected_load_factor_pct": projected_load_factor,
            "status": status,
            "status_label": status_label,
            "badge_color": badge_color,
            "crew_required": total_crew,
            "estimated_trip_cost_inr": total_cost,
            "estimated_revenue_inr": est_revenue,
            "projected_margin_inr": est_revenue - total_cost,
            "operator_recommendation": rec_text
        }

    def generate_fleet_manifest(
        self,
        event_data: Dict[str, Any],
        demand_forecasts: List[Dict[str, Any]],
        risk_tolerance: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Generates full multi-route fleet allocation plan for a train arrival event.
        Calculates departure windows (scheduled arrival + 15 min passenger connection).
        """
        event_id = event_data.get("event_id", "UNKNOWN")
        train_id = event_data.get("train_id", "UNKNOWN")
        sched_arrival = event_data.get("scheduled_arrival", "12:00")
        actual_delay = int(event_data.get("arrival_delay_minutes", 0))

        # Calculate estimated train arrival and bus departure slot
        try:
            hour, minute = map(int, sched_arrival.split(":")[:2])
            sched_dt = datetime(2026, 10, 30, hour, minute)
            est_arrival_dt = sched_dt + timedelta(minutes=actual_delay)
            bus_departure_dt = est_arrival_dt + timedelta(minutes=15)
            bus_departure_time = bus_departure_dt.strftime("%H:%M")
            est_arrival_time = est_arrival_dt.strftime("%H:%M")
        except Exception:
            est_arrival_time = sched_arrival
            bus_departure_time = "Arrival + 15m"

        route_allocations = []
        total_pax = 0.0
        total_seats = 0
        total_cost = 0
        total_revenue = 0
        total_vehicles = 0
        total_crew = 0

        for df in demand_forecasts:
            dest = df["destination_station"]
            pred = df["predicted_passengers"]
            p10 = df["lower_bound_p10"]
            p90 = df["upper_bound_p90"]
            bookings = df["current_confirmed_bookings"]

            alloc = self.optimize_route_supply(
                destination=dest,
                predicted_passengers=pred,
                p10_lower=p10,
                p90_upper=p90,
                confirmed_bookings=bookings,
                risk_tolerance=risk_tolerance
            )
            alloc["scheduled_bus_departure"] = bus_departure_time
            route_allocations.append(alloc)

            total_pax += alloc["expected_passengers"]
            total_seats += alloc["total_supply_seats"]
            total_cost += alloc["estimated_trip_cost_inr"]
            total_revenue += alloc["estimated_revenue_inr"]
            total_crew += alloc["crew_required"]
            total_vehicles += sum(v["count"] for v in alloc["vehicles_allocated"])

        overall_load_factor = round((total_pax / total_seats) * 100, 1) if total_seats > 0 else 0

        return {
            "event_id": event_id,
            "train_id": train_id,
            "train_name": event_data.get("train_name_synthetic", "Express Train"),
            "origin_station": event_data.get("origin_station", "Unknown"),
            "scheduled_train_arrival": sched_arrival,
            "actual_delay_minutes": actual_delay,
            "estimated_train_arrival": est_arrival_time,
            "recommended_bus_departure_slot": bus_departure_time,
            "risk_tolerance_mode": risk_tolerance,
            "overall_summary": {
                "total_forecasted_passengers": round(total_pax, 1),
                "total_seats_allocated": total_seats,
                "overall_load_factor_pct": overall_load_factor,
                "total_vehicles_deployed": total_vehicles,
                "total_crew_assigned": total_crew,
                "total_trip_cost_inr": total_cost,
                "projected_revenue_inr": total_revenue,
                "projected_net_margin_inr": total_revenue - total_cost
            },
            "route_plans": route_allocations
        }
