# RailBus SmartSync Intelligence Module (Mysuru Hub)

A backend-integrated, honest Machine Learning & Operations Research recommendation module for passenger demand forecasting and fleet supply optimization at Mysuru Junction railway station.

> **Operational Mandate**: SmartSync **RECOMMENDS** but **NEVER DISPATCHES**. No endpoint in this service can modify a trip or booking directly. Final fleet assignments are authorized by transit operators in the RailBus backend.

---

## 1. System Architecture & The 4-Stage Demand Hierarchy

The four prediction targets form a strictly coherent physical cascade:

```
[MODEL 01] Train Alighting Estimation (A)
      │
      ▼
[MODEL 02] Destination Passenger Split (D_k)
      │   Constraint: sum(D_k) == A, and D_k <= A
      ▼
[MODEL 03] Onward Transportation Need (N_k)
      │   Constraint: N_k <= D_k, and sum(N_k) <= A
      │   Documented Beta Prior (DOCUMENTED_PRIOR_UNTIL_SURVEY_OBSERVED)
      ▼
[MODEL 04] RailBus Adoption Prediction (R_k)
          Constraint: confirmed_bookings_k <= R_k <= N_k <= D_k <= A
```

Every prediction mathematically guarantees:
$$\text{confirmed\_bookings}_k \le R_k \le N_k \le D_k \le A$$

---

## 2. Data Honesty & Censoring Awareness

### `data_source` Field
Every dataset, model artifact, evaluation log, and API response explicitly declares its `data_source`:
- **`SYNTHETIC`**: The synthetic baseline dataset representing Mysore train arrival events and snapshots.
- **`OBSERVED`**: Real-world ticket scans and station ground truth.
All UI badges and metadata are derived directly from this field.

### Censoring & Survivorship Bias
- **App-User Censoring**: Confirmed bookings only capture passengers with smartphone app access and for trips published on the schedule. Unobserved demand from non-app travelers, walk-ins, and unoffered departure slots is downward-censored.
- **Mitigation Features**: Pre-registration search and intent signals (`passengers_submitted_interest`) and velocity (`booking_growth_last_hour_synthetic`) are engineered into Model 04 to mitigate downward bias, while awaiting full intercept survey calibration.

---

## 3. Validation & Promotion Gate

### Chronological Rolling-Origin Validation
- Evaluated strictly using temporal ordering on `service_date` across expanding windows (zero future data leakage).
- All snapshots belonging to a given train event are preserved together in the same split.

### Model 04 Performance per Horizon (Held-out Test Period):
| Snapshot Horizon | MAE (Pax) | RMSE | WAPE (%) | 80% CI Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **T-24.0h (Planning)** | 1.25 | 1.79 | 40.2% | 86.8% |
| **T-6.0h (Lock)** | 0.95 | 1.36 | 30.6% | 88.4% |
| **T-2.0h (Roster)** | 0.63 | 0.88 | 20.1% | 87.4% |
| **T-30m (Boarding)** | 0.27 | 0.46 | 8.5% | 91.2% |

### Promotion Gate Decisions
A candidate model is promoted to active production only if it beats the best baseline by $\ge 0.5\%$ WAPE on held-out test data.

- **Model 01 (Arrivals)**:
  - Naive Mean Baseline: WAPE = 22.4%
  - Poisson Count GLM Baseline: WAPE = 22.4%
  - Candidate XGBoost Regressor: WAPE = 23.1%
  - **Gate Decision**: `REJECTED_BELOW_BASELINE`
  - **Serving Model**: **`BASELINE_POISSON_GLM`** (`is_baseline: true`).
- **Model 04 (RailBus Adoption)**:
  - Confirmed Bookings Baseline: WAPE = 45.1%
  - Candidate XGBoost Regressor: WAPE = 24.9%
  - **Gate Decision**: `PROMOTED_ACTIVE`
  - **Serving Model**: **`CANDIDATE_XGBOOST`** (`is_baseline: false`).

---

## 4. Backend-Integrated Transport Optimizer (Google OR-Tools)

Removes hardcoded vehicle fleets and uses the **RailBus Backend API as the Single Source of Truth**:
- **Buses & Capacities**: Fetches registered buses (e.g. Volvo 9600 Multi-Axle 40s, Tata Starbus 32s) directly from backend.
- **Conductors**: Fetches active conductors from backend.
- **Trips & Demand**: Reads trips with confirmed `demand_count`.

### Optimization Constraints:
1. **20-Confirmed-Booking Threshold**: Trips with $< 20$ confirmed bookings are strictly **ineligible** for vehicle assignment.
2. **Conductor Overlap**: Each conductor is assigned to at most one vehicle across concurrent departure windows.
3. **Shared Fleet**: Each bus serves at most one trip per departure block.
4. **Bus Capacity**: Bus capacity must cover confirmed bookings.

### Strict Output Separation:
- **`confirmed_assignment_recommendations`**: Fleet assignments based strictly on confirmed bookings meeting the 20-booking activation threshold.
- **`forecast_prepositioning_proposals`**: Separate advisory proposals based on Model 04 forecasts (e.g., staging reserve coaches near Bay 3 for upcoming train surges), labeled `ADVISORY_FORECAST_ONLY`.

---

## 5. Backend Integration: `smartsync_recommendations`

SmartSync posts recommendations to the RailBus Backend:
```http
POST /api/v1/smartsync/recommendations
Authorization: Bearer <operator_token>
```
When an operator approves a recommendation in the backend:
```http
POST /api/v1/smartsync/recommendations/{rec_id}/approve/{item_index}
```
The backend invokes the standard, audited assignment function: `TripService.operator_assign_trip(db, trip_id, operator_id, data)`.

---

## 6. Testing & Quality Assurance

Run the comprehensive unit test suite:
```bash
python3 -m pytest -v
```
Test Suites:
1. `tests/test_coherence.py`: Verifies $B \le R \le N \le D \le A$ across normal and zero-demand boundaries.
2. `tests/test_leakage.py`: Verifies zero temporal leakage in chronological rolling-origin splits.
3. `tests/test_optimizer.py`: Verifies the 20-booking threshold, conductor overlap, bus capacity coverage, and strict output separation.

---

## 7. Running SmartSync

```bash
# Start the SmartSync API & Dashboard
python3 app.py
```
Visit the Operator Dashboard:
👉 **`http://localhost:8001/`**

### API Endpoints:
- `GET /api/health` — Service status, data_source, active models, promotion gate status
- `GET /api/pipeline/{event_id}` — 4-stage predictions & OR-Tools fleet optimization
- `POST /api/recommendations/transmit` — Transmits recommendations to RailBus Backend
- `POST /api/audit/post-arrival` — Audits pre-arrival forecasts against station ground truth
- `GET /api/audit/logs` — Post-arrival evaluation audit history
- `GET /api/registry` — Model registry with semantic versions and promotion gate logs
