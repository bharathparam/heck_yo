# RailBus Intelligence Engine (Mysuru Junction Hub)

A production-grade, multi-stage Machine Learning & Operations Research system for forecasting passenger demand and optimizing RailBus fleet supply allocation at Mysuru Junction railway station.

---

## 1. System Architecture & The 4 Distinct Targets

As per the operational design, **RailBus requires four distinct prediction targets that are modeled independently and never combined into a single prediction**:

```
RailBus Intelligence Engine
├── DATA ACQUISITION LAYER
│   ├── Train data (Schedules, station stops, arrival delays)
│   ├── Passenger data (Pre-bookings, interest submissions, growth velocity)
│   ├── Context data (Calendar, weekdays, holidays, festivals, seasonality, weather)
│   └── Historical data (Footfalls, manual counts, route averages)
│
├── DATA PROCESSING & FEATURE ENGINEERING
│   └── Train-wise, station-wise and time-window aggregations
│
├── PREDICTION ENGINES (4 DISTINCT TARGETS)
│   ├── MODEL 01: Passenger Arrivals (Train alighting count)
│   │   ├── Primary: XGBoost Regressor
│   │   └── Benchmark: Count GLM (Poisson / Negative Binomial)
│   ├── MODEL 02: Destination Distribution (Multi-destination share predictor)
│   ├── MODEL 03: Onward Transportation Demand (Transit need estimator)
│   └── MODEL 04: RailBus Adoption (XGBoost booking propensity & conversion)
│
├── TRANSPORT OPTIMIZATION ENGINE (SUPPLY)
│   ├── Google OR-Tools Mixed-Integer Linear Program (MILP)
│   ├── Fleet mix: Mini (18 seats), Standard (32 seats), Express Coach (48 seats)
│   ├── Route Grouping: Co-routing low-density corridors to boost load factor
│   └── Timing: Dynamic departure windows (train arrival + 15m transfer allowance)
│
└── OPERATOR COMMAND CENTER (FastAPI + Dashboard)
    └── Workflow: PREDICT → PLAN → DEPLOY + What-If Simulation Lab
```

---

## 2. The 4 Distinct RailBus Models

| Model | Operational Question | Target | Algorithm / Methodology | Benchmark Baseline |
| :--- | :--- | :--- | :--- | :--- |
| **Model 01** | *How many passengers will get down at Mysuru from each incoming train?* | `alighting_passengers_actual_synthetic` | **XGBoost Regressor** + Quantile bounds ($P_{10}, P_{90}$) | Count GLM (Poisson / Negative Binomial regression) |
| **Model 02** | *Where will those passengers go after arriving?* | Destination shares ($\sum = 100\%$) across Bengaluru, Mandya, Hassan, Chamarajanagar, Nanjangud, Other | **Multi-destination Share Model** conditioned on origin station and train type | Empirical historical priors |
| **Model 03** | *How many passengers will need onward transportation, irrespective of whether they use RailBus?* | Onward commercial transit demand count & propensity | **Transit Propensity Classifier & Estimator** | Local pickup vs commercial transit split (~63.3% transit demand) |
| **Model 04** | *How many passengers are likely to choose RailBus?* | `final_railbus_passengers_actual_synthetic` | **XGBoost Regressor** on confirmed bookings, interest velocity, snapshot horizon ($T-24, T-6, T-2, T-0.5$) | Simple historical route mean / confirmed bookings |

---

## 3. Transport Optimization Engine (Supply & Fleet)

Powered by **Google OR-Tools Mixed-Integer Linear Programming (MILP)**:
- **Fleet Specifications**:
  - `Mini RailBus`: 18 seats, base cost ₹1,200 per trip, 2 crew (1 driver + 1 conductor)
  - `Standard RailBus`: 32 seats, base cost ₹1,800 per trip, 2 crew
  - `Express Coach`: 48 seats, base cost ₹2,500 per trip, 2 crew
- **Optimization Formulation**:
  $$\min \sum_{v, r} \text{Cost}_v \cdot x_{v, r} + 10 \cdot \text{EmptySeats}_r$$
  $$\text{subject to } \sum_v \text{Capacity}_v \cdot x_{v, r} - \text{EmptySeats}_r = \text{Demand}_r, \quad x_{v, r} \in \mathbb{Z}_{\ge 0}$$
- **Smart Route Grouping**:
  Automatically detects when secondary routes (e.g. Nanjangud & Chamarajanagar, or Mandya & Outskirts) have low individual demand, recommending combined multi-stop loops to save ₹1,200/dispatch and lift load factors from 15% to 75%+.
- **Timing & Platform Bay Assignment**:
  Calculates actual train arrival (scheduled arrival + delay) and sets departure time at `Arrival + 15 min transfer window`, assigning dedicated platform bays (Bays 1-6 at Mysuru Junction).

---

## 4. Operator Workflow: Predict → Plan → Deploy

1. **PREDICT**:
   Operators inspect incoming train arrivals at Mysuru across horizons ($T-24$, $T-6$, $T-2$, $T-0.5$), reviewing predictions from all 4 models side-by-side with confidence intervals.
2. **PLAN**:
   The OR-Tools transport engine computes vehicle allocations, projected load factors, operating costs, fare revenues, and net margins.
3. **DEPLOY**:
   The operator signs off on the plan, issues the official digital dispatch manifest with verification ID, and locks driver/conductor manifests.

---

## 5. Running the Application

### Start the FastAPI Server & Operator Dashboard:
```bash
# Start on port 8001 (or set PORT=8001)
python3 app.py
```
Open your browser to:
👉 **`http://localhost:8001/`**

### Re-training the Models:
```bash
python3 train_models.py
```

### FastAPI API Endpoints:
- `GET /api/health` — System status, loaded models, and OR-Tools optimizer status
- `GET /api/trains?limit=50` — List upcoming train arrival events
- `GET /api/pipeline/{event_id}?horizon=2.0&risk=balanced` — Full 4-stage predictions + OR-Tools supply plan
- `POST /api/deploy` — Issues official signed dispatch manifest
- `POST /api/simulate` — What-If operational scenario simulation (delays, surges, booking spikes)
- `GET /api/metrics` — Accuracy metrics & benchmarks across all 4 models
