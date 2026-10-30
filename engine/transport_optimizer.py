"""
RailBus Intelligence Engine - Transport Optimization Engine
Solves Vehicle Capacity Allocation, Route Grouping, Fleet Availability, and Timing
using Google OR-Tools Mixed-Integer Linear Programming (MILP).
"""
import math
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from ortools.linear_solver import pywraplp


class FleetCatalog:
    VEHICLES = {
        "MINI": {"name": "Mini RailBus", "capacity": 18, "cost_inr": 1200, "crew": 2, "turnaround_mins": 30},
        "STANDARD": {"name": "Standard RailBus", "capacity": 32, "cost_inr": 1800, "crew": 2, "turnaround_mins": 45},
        "EXPRESS": {"name": "Express Coach", "capacity": 48, "cost_inr": 2500, "crew": 2, "turnaround_mins": 60}
    }
    
    # Fare matrix for financial modeling (INR per passenger)
    TICKET_PRICES = {
        "Bengaluru": 250,
        "Mandya": 120,
        "Hassan": 180,
        "Chamarajanagar": 110,
        "Nanjangud": 80,
        "Other": 140
    }

    # Route grouping compatibility (geographic clusters around Mysuru Junction)
    ROUTE_CLUSTERS = [
        {
            "cluster_name": "South Regional Loop",
            "routes": ["Nanjangud", "Chamarajanagar"],
            "grouping_threshold": 16,  # if sum of demands <= 16, group into 1 Mini RailBus
            "via_description": "Mysuru Station → Nanjangud Town → Chamarajanagar Bus Stand"
        },
        {
            "cluster_name": "East Corridor Local",
            "routes": ["Mandya", "Other"],
            "grouping_threshold": 18,
            "via_description": "Mysuru Station → Srirangapatna → Mandya"
        }
    ]


class TransportOptimizationEngine:
    """OR-Tools based Fleet Allocation & Route Grouping Optimizer."""

    def __init__(self, solver_name: str = "SCIP"):
        self.solver_name = solver_name

    def solve_route_fleet(self, demand: float, max_buses: int = 4) -> Dict[str, Any]:
        """
        Mixed-Integer Linear Program (MILP) solved via Google OR-Tools:
        Minimizes total dispatch operating costs + empty seat penalty while meeting passenger demand.
        """
        solver = pywraplp.Solver.CreateSolver(self.solver_name)
        if not solver:
            solver = pywraplp.Solver.CreateSolver("CBC")
            
        if not solver:
            # Fallback simple solver if SCIP/CBC unavailable
            return self._fallback_solver(demand)

        # Decision variables: integer counts for each vehicle type
        x_mini = solver.IntVar(0, max_buses, "x_mini")
        x_std = solver.IntVar(0, max_buses, "x_std")
        x_exp = solver.IntVar(0, max_buses, "x_exp")

        # Total capacity expression
        cap_mini = FleetCatalog.VEHICLES["MINI"]["capacity"]
        cap_std = FleetCatalog.VEHICLES["STANDARD"]["capacity"]
        cap_exp = FleetCatalog.VEHICLES["EXPRESS"]["capacity"]

        cost_mini = FleetCatalog.VEHICLES["MINI"]["cost_inr"]
        cost_std = FleetCatalog.VEHICLES["STANDARD"]["cost_inr"]
        cost_exp = FleetCatalog.VEHICLES["EXPRESS"]["cost_inr"]

        # Slack variable for empty seats
        empty_seats = solver.NumVar(0, 200, "empty_seats")

        # Demand satisfaction constraint: Capacity - Empty Seats = Demand
        solver.Add(cap_mini * x_mini + cap_std * x_std + cap_exp * x_exp - empty_seats == demand)
        # Ensure at least 1 bus if demand > 0
        if demand > 0:
            solver.Add(x_mini + x_std + x_exp >= 1)

        # Objective function: Dispatch Cost + Small penalty for excess empty seats
        solver.Minimize(
            cost_mini * x_mini +
            cost_std * x_std +
            cost_exp * x_exp +
            10.0 * empty_seats
        )

        status = solver.Solve()
        if status in [pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE]:
            n_mini = int(round(x_mini.solution_value()))
            n_std = int(round(x_std.solution_value()))
            n_exp = int(round(x_exp.solution_value()))
        else:
            return self._fallback_solver(demand)

        allocated = []
        if n_mini > 0:
            allocated.append({"type": "Mini RailBus", "capacity": cap_mini, "count": n_mini})
        if n_std > 0:
            allocated.append({"type": "Standard RailBus", "capacity": cap_std, "count": n_std})
        if n_exp > 0:
            allocated.append({"type": "Express Coach", "capacity": cap_exp, "count": n_exp})

        total_cap = n_mini * cap_mini + n_std * cap_std + n_exp * cap_exp
        total_cost = n_mini * cost_mini + n_std * cost_std + n_exp * cost_exp

        return {
            "vehicles": allocated,
            "total_capacity": total_cap,
            "total_cost_inr": total_cost,
            "solver_status": "OPTIMAL"
        }

    def _fallback_solver(self, demand: float) -> Dict[str, Any]:
        """Greedy heuristic fallback if OR-Tools native solver binary is missing."""
        if demand <= 18:
            return {"vehicles": [{"type": "Mini RailBus", "capacity": 18, "count": 1}], "total_capacity": 18, "total_cost_inr": 1200, "solver_status": "HEURISTIC"}
        elif demand <= 32:
            return {"vehicles": [{"type": "Standard RailBus", "capacity": 32, "count": 1}], "total_capacity": 32, "total_cost_inr": 1800, "solver_status": "HEURISTIC"}
        elif demand <= 48:
            return {"vehicles": [{"type": "Express Coach", "capacity": 48, "count": 1}], "total_capacity": 48, "total_cost_inr": 2500, "solver_status": "HEURISTIC"}
        else:
            n_exp = int(math.ceil(demand / 48))
            return {"vehicles": [{"type": "Express Coach", "capacity": 48, "count": n_exp}], "total_capacity": n_exp * 48, "total_cost_inr": n_exp * 2500, "solver_status": "HEURISTIC"}

    def optimize_transport_plan(
        self,
        event_data: Dict[str, Any],
        model_04_results: Dict[str, Any],
        risk_tolerance: str = "balanced"
    ) -> Dict[str, Any]:
        """
        Generates optimal bus allocation, route grouping, timing, and crew schedules.
        """
        sched_arrival = event_data.get("scheduled_arrival", "12:00")
        actual_delay = int(event_data.get("arrival_delay_minutes", 0))

        # Timing calculation: Train Arrival + 15 min connection transfer
        try:
            h, m = map(int, sched_arrival.split(":")[:2])
            arr_dt = datetime(2026, 10, 30, h, m) + timedelta(minutes=actual_delay)
            dep_dt = arr_dt + timedelta(minutes=15)
            timing_arrival = arr_dt.strftime("%H:%M")
            timing_departure = dep_dt.strftime("%H:%M")
        except Exception:
            timing_arrival = sched_arrival
            timing_departure = "Arrival + 15m"

        routes_data = model_04_results["route_breakdown"]
        
        # 1. Identify potential Route Grouping
        demand_map = {r["destination_station"]: r["expected_railbus_passengers"] for r in routes_data}
        grouping_advisories = []
        grouped_routes_set = set()

        for cluster in FleetCatalog.ROUTE_CLUSTERS:
            sub_routes = cluster["routes"]
            sum_demand = sum(demand_map.get(d, 0) for d in sub_routes)
            if sum_demand <= cluster["grouping_threshold"] and sum_demand > 0:
                grouping_advisories.append({
                    "cluster_name": cluster["cluster_name"],
                    "merged_routes": sub_routes,
                    "combined_demand": sum_demand,
                    "description": cluster["via_description"],
                    "recommended_vehicle": "1x Mini RailBus (18 seats)",
                    "savings_inr": 1200,  # Eliminates one empty vehicle dispatch
                    "action": "CO_ROUTE_RECOMMENDED"
                })

        # 2. Optimize Vehicle Allocation per Route with OR-Tools
        route_plans = []
        total_seats = 0
        total_cost = 0
        total_revenue = 0
        total_pax = 0
        total_crew = 0
        bay_counter = 1

        for r in routes_data:
            dest = r["destination_station"]
            exp_pax = r["expected_railbus_passengers"]
            p10 = r["lower_bound_p10"]
            p90 = r["upper_bound_p90"]
            confirmed = r["current_confirmed_bookings"]

            # Planning demand based on risk tolerance
            if risk_tolerance == "conservative":
                plan_demand = max(confirmed, p90)
            elif risk_tolerance == "lean":
                plan_demand = max(confirmed, exp_pax)
            else:  # balanced
                plan_demand = max(confirmed, int(round(exp_pax + 0.4 * (p90 - exp_pax))))

            # Run OR-Tools MILP optimization
            sol = self.solve_route_fleet(plan_demand)
            cap = sol["total_capacity"]
            cost = sol["total_cost_inr"]

            # Financials
            ticket_price = FleetCatalog.TICKET_PRICES.get(dest, 150)
            rev = exp_pax * ticket_price
            lf = round((exp_pax / max(1, cap)) * 100, 1)

            # Assign crew & platform bay
            v_summary = " + ".join([f"{v['count']}x {v['type']}" for v in sol["vehicles"]])
            crew_count = sum(v["count"] * 2 for v in sol["vehicles"])
            assigned_bay = f"Platform Bay {bay_counter}"
            bay_counter = (bay_counter % 6) + 1

            # Status alert
            if lf > 90:
                status = "STRANDING_ALERT"
                status_color = "red"
                msg = f"High demand ({plan_demand} pax). Fleet capacity tight ({cap}s). Standby reserve advised."
            elif lf < 45:
                status = "LOW_UTILIZATION"
                status_color = "amber"
                msg = f"Projected load factor {lf}%. Co-routing with adjacent destinations recommended."
            else:
                status = "OPTIMAL"
                status_color = "emerald"
                msg = f"Optimal capacity balance. Expected load factor {lf}%."

            route_plans.append({
                "destination_station": dest,
                "planning_demand": plan_demand,
                "expected_passengers": exp_pax,
                "confirmed_bookings": confirmed,
                "confidence_range": [p10, p90],
                "vehicles_allocated": sol["vehicles"],
                "vehicles_summary": v_summary,
                "total_capacity_seats": cap,
                "load_factor_pct": lf,
                "departure_time": timing_departure,
                "platform_bay": assigned_bay,
                "crew_assigned": crew_count,
                "trip_cost_inr": cost,
                "projected_revenue_inr": rev,
                "projected_margin_inr": rev - cost,
                "status": status,
                "status_color": status_color,
                "operator_note": msg
            })

            total_seats += cap
            total_cost += cost
            total_revenue += rev
            total_pax += exp_pax
            total_crew += crew_count

        overall_lf = round((total_pax / max(1, total_seats)) * 100, 1)

        return {
            "optimization_engine": "Google OR-Tools Mixed-Integer Linear Program (MILP)",
            "timing": {
                "scheduled_train_arrival": sched_arrival,
                "actual_delay_minutes": actual_delay,
                "estimated_train_arrival": timing_arrival,
                "recommended_bus_departure": timing_departure,
                "transfer_buffer_mins": 15
            },
            "fleet_summary": {
                "total_forecasted_demand": total_pax,
                "total_seats_allocated": total_seats,
                "overall_load_factor_pct": overall_lf,
                "total_fleet_vehicles": sum(sum(v["count"] for v in rp["vehicles_allocated"]) for rp in route_plans),
                "total_crew_assigned": total_crew,
                "total_operating_cost_inr": total_cost,
                "projected_ticket_revenue_inr": total_revenue,
                "projected_net_margin_inr": total_revenue - total_cost
            },
            "route_plans": route_plans,
            "route_grouping_advisories": grouping_advisories
        }
