/**
 * RailBus SmartSync Module — Honest Operator Command Center Application
 * Connects frontend dashboard with FastAPI honest 4-stage hierarchy,
 * OR-Tools supply optimization, backend recommendation transmission, and post-arrival audits.
 */

// Global State
let currentEventId = null;
let currentHorizon = 2.0;
let currentRisk = "balanced";
let cachedPipelineData = null;

// DOM Elements
const trainSelect = document.getElementById("train-select");
const clockDisplay = document.getElementById("clock-display");
const btnRefresh = document.getElementById("btn-refresh");
const btnTransmitTop = document.getElementById("btn-transmit-top");
const btnTransmitAction = document.getElementById("btn-transmit-action");
const btnRunAudit = document.getElementById("btn-run-audit");

// Clock Updater
function updateClock() {
  const now = new Date();
  clockDisplay.textContent = now.toLocaleTimeString("en-IN", { hour12: false }) + " IST";
}
setInterval(updateClock, 1000);
updateClock();

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await loadUpcomingTrains();
});

function setupEventListeners() {
  // Train Selector Change
  trainSelect.addEventListener("change", (e) => {
    currentEventId = e.target.value;
    loadPipelineData(currentEventId, currentHorizon, currentRisk);
  });

  // Horizon Buttons
  const horizonBtns = document.querySelectorAll("#horizon-selector .segment-btn");
  horizonBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      horizonBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentHorizon = parseFloat(btn.dataset.horizon);
      if (currentEventId) loadPipelineData(currentEventId, currentHorizon, currentRisk);
    });
  });

  // Risk Strategy Buttons
  const riskBtns = document.querySelectorAll("#risk-selector .segment-btn");
  riskBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      riskBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRisk = btn.dataset.risk;
      if (currentEventId) loadPipelineData(currentEventId, currentHorizon, currentRisk);
    });
  });

  // Refresh Button
  btnRefresh.addEventListener("click", () => {
    if (currentEventId) loadPipelineData(currentEventId, currentHorizon, currentRisk);
  });

  // Transmit Actions (Replaces old deploy)
  btnTransmitAction.addEventListener("click", executeTransmission);
  btnTransmitTop.addEventListener("click", executeTransmission);

  // Post-Arrival Audit
  btnRunAudit.addEventListener("click", executePostArrivalAudit);
}

// 1. Fetch Incoming Trains
async function loadUpcomingTrains() {
  try {
    const res = await fetch("/api/trains?limit=30");
    const data = await res.json();
    trainSelect.innerHTML = "";

    if (!data.trains || data.trains.length === 0) {
      trainSelect.innerHTML = "<option>No trains scheduled</option>";
      return;
    }

    data.trains.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.event_id;
      const delayText = t.arrival_delay_minutes > 0 ? ` (+${t.arrival_delay_minutes}m)` : " (On-time)";
      opt.textContent = `${t.event_id} • ${t.train_id} ${t.train_name_synthetic} (${t.origin_station} → MYS, ${t.scheduled_arrival}${delayText})`;
      trainSelect.appendChild(opt);
    });

    currentEventId = data.trains[0].event_id;
    trainSelect.value = currentEventId;
    await loadPipelineData(currentEventId, currentHorizon, currentRisk);
  } catch (err) {
    console.error("Failed to load trains:", err);
  }
}

// 2. Fetch Pipeline Data
async function loadPipelineData(eventId, horizon, risk) {
  try {
    const res = await fetch(`/api/pipeline/${eventId}?horizon=${horizon}&risk=${risk}`);
    const data = await res.json();
    cachedPipelineData = data;

    // Update Data Honesty Badges
    document.getElementById("badge-source-text").textContent = `DATA SOURCE: ${data.data_source}`;
    document.getElementById("hero-data-source").textContent = `SOURCE: ${data.data_source}`;
    document.getElementById("disp-source-tag").textContent = data.data_source;
    document.getElementById("version-badge").textContent = data.model_version;

    renderTrainHero(data.train_info);
    renderStage1Predict(data.predictions);
    renderStage2Optimization(data.optimization_plan);
  } catch (err) {
    console.error("Failed to fetch pipeline data:", err);
  }
}

// Render Train Hero Header
function renderTrainHero(info) {
  document.getElementById("hero-train-id").textContent = info.train_id;
  document.getElementById("hero-train-name").textContent = info.train_name;
  document.getElementById("hero-route").textContent = `Origin: ${info.origin_station} → Mysuru Junction (MYS) • Type: ${info.train_type}`;
  document.getElementById("hero-sched-arrival").textContent = info.scheduled_arrival;
  
  const delayElem = document.getElementById("hero-delay-status");
  const delay = info.actual_delay_minutes || 0;
  if (delay > 0) {
    delayElem.textContent = `+${delay} mins late`;
    delayElem.style.color = "var(--accent-amber)";
  } else {
    delayElem.textContent = "On Schedule (0m)";
    delayElem.style.color = "var(--accent-emerald)";
  }

  document.getElementById("hero-weather").textContent = `${info.weather} • ${info.peak_season ? "Peak Season" : "Regular Season"}`;
  
  const calFlags = [];
  if (info.is_holiday) calFlags.push("Gazetted Holiday");
  if (info.festival_period) calFlags.push("Festival Rush");
  if (calFlags.length === 0) calFlags.push("Regular Service Day");
  document.getElementById("hero-calendar").textContent = calFlags.join(" • ");
}

// Render Stage 1: Coherent 4-Stage Hierarchy
function renderStage1Predict(predictions) {
  const m1 = predictions.model_01;
  const m2 = predictions.model_02;
  const m3 = predictions.model_03;
  const m4 = predictions.model_04;

  // Model 01 (Shows Promotion Gate Decision)
  document.getElementById("m1-alighting-val").textContent = m1.expected_alighting_passengers;
  document.getElementById("m1-poisson-val").textContent = `${m1.poisson_baseline_estimate} pax`;
  document.getElementById("m1-xgb-val").textContent = `${m1.candidate_xgboost_estimate} pax`;
  document.getElementById("m1-interval").textContent = `[${m1.lower_bound_p10} , ${m1.upper_bound_p90}] pax`;
  document.getElementById("m1-served-badge").textContent = `ACTIVE: ${m1.served_by}`;
  document.getElementById("m1-gate-reason").textContent = m1.gate_reason;

  // Model 02
  const destList = document.getElementById("m2-destination-list");
  destList.innerHTML = "";
  const counts = m2.destination_passenger_counts;
  const shares = m2.destination_shares_pct;
  document.getElementById("m2-sum-val").textContent = m2.total_accounted_passengers;

  Object.keys(counts).forEach(dest => {
    const pax = counts[dest];
    const pct = shares[dest] || 0;
    const row = document.createElement("div");
    row.className = "dest-row";
    row.innerHTML = `
      <div class="dest-info">
        <span class="dest-name">${dest}</span>
        <span class="dest-val">${pax} pax (${pct}%)</span>
      </div>
      <div class="dest-bar-bg">
        <div class="dest-bar-fill" style="width: ${Math.min(100, pct * 1.5)}%"></div>
      </div>
    `;
    destList.appendChild(row);
  });

  // Model 03 (Shows Documented Beta Prior)
  document.getElementById("m3-transit-val").textContent = m3.total_onward_transit_demand;
  document.getElementById("m3-pct-val").textContent = `${m3.overall_transit_need_rate_pct}%`;
  document.getElementById("m3-local-val").textContent = `${m3.total_private_or_local_passengers} pax`;
  document.getElementById("m3-fill-transit").style.width = `${m3.overall_transit_need_rate_pct}%`;
  document.getElementById("m3-fill-private").style.width = `${100 - m3.overall_transit_need_rate_pct}%`;

  // Model 04 & Hierarchy verification values
  document.getElementById("m4-adopted-val").textContent = m4.total_expected_railbus_passengers;
  document.getElementById("m4-rate-val").textContent = `${m4.overall_adoption_rate_pct}% of transit need`;
  document.getElementById("m4-confirmed-val").textContent = `${m4.total_confirmed_bookings} bookings`;
  document.getElementById("m4-range-val").textContent = `[${m4.total_confidence_range[0]} , ${m4.total_confidence_range[1]}] pax`;

  // Hierarchy strip
  document.getElementById("hier-b").textContent = m4.total_confirmed_bookings;
  document.getElementById("hier-r").textContent = m4.total_expected_railbus_passengers;
  document.getElementById("hier-n").textContent = m3.total_onward_transit_demand;
  document.getElementById("hier-a").textContent = m1.expected_alighting_passengers;
}

// Render Stage 2: OR-Tools Optimization (Confirmed vs Forecast)
function renderStage2Optimization(plan) {
  // A. Confirmed Assignments Table
  const tbody = document.getElementById("confirmed-table-body");
  tbody.innerHTML = "";

  const assignments = plan.confirmed_assignment_recommendations || [];
  if (assignments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">No active trips found in backend.</td></tr>`;
  } else {
    assignments.forEach(c => {
      const tr = document.createElement("tr");
      const isMet = c.confirmed_bookings >= 20;
      const statusBadge = isMet
        ? `<span class="badge-met">ELIGIBLE (≥20)</span>`
        : `<span class="badge-unmet">INELIGIBLE (${c.confirmed_bookings}/20)</span>`;

      tr.innerHTML = `
        <td><strong>${c.trip_id ? c.trip_id.slice(0, 8) + '...' : 'Trip'}</strong><br><small class="text-secondary">${c.route_name}</small></td>
        <td>${c.destination}</td>
        <td><strong>${c.confirmed_bookings} pax</strong></td>
        <td>${statusBadge}</td>
        <td>${c.bus_registration ? `<strong class="text-cyan">${c.bus_registration}</strong><br><small class="text-muted">${c.bus_model}</small>` : '<span class="text-muted">—</span>'}</td>
        <td>${c.bus_capacity ? `${c.bus_capacity} seats` : '<span class="text-muted">—</span>'}</td>
        <td>${c.conductor_name ? `<strong class="text-emerald">${c.conductor_name}</strong>` : '<span class="text-muted">—</span>'}</td>
        <td>${c.departure_time || '—'}</td>
        <td><small>${c.reason || c.recommendation_status}</small></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // B. Forecast Pre-Positioning Proposals
  const propContainer = document.getElementById("proposals-container");
  propContainer.innerHTML = "";

  const proposals = plan.forecast_prepositioning_proposals || [];
  if (proposals.length === 0) {
    propContainer.innerHTML = `<p class="placeholder-text">No pre-positioning needed. Current confirmed bookings match anticipated volume.</p>`;
  } else {
    proposals.forEach(p => {
      const card = document.createElement("div");
      card.className = "proposal-card";
      card.innerHTML = `
        <div class="proposal-header">
          <span class="proposal-dest">${p.destination} Corridor</span>
          <span class="proposal-badge">${p.status}</span>
        </div>
        <div class="proposal-stats">
          <span>Predicted Demand: <strong>${p.forecasted_passengers} pax</strong></span>
          <span>Confirmed: <strong>${p.current_confirmed_bookings} pax</strong></span>
          <span>Threshold Gap: <strong>${p.threshold_gap} pax</strong></span>
        </div>
        <div class="proposal-action">
          <strong>Advisory Proposal:</strong> ${p.recommended_preposition_action}
        </div>
      `;
      propContainer.appendChild(card);
    });
  }
}

// Transmit Recommendations to Backend API
async function executeTransmission() {
  if (!currentEventId) return;
  const statusBadge = document.getElementById("transmit-status-badge");
  const dispId = document.getElementById("disp-trans-id");
  const dispBody = document.getElementById("disp-trans-body");

  statusBadge.className = "badge badge-pending";
  statusBadge.textContent = "Transmitting to Backend...";

  try {
    const res = await fetch("/api/recommendations/transmit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: currentEventId,
        snapshot_horizon: currentHorizon,
        risk_tolerance: currentRisk
      })
    });
    const result = await res.json();

    statusBadge.className = "badge badge-approved";
    statusBadge.textContent = "Transmitted & Awaiting Approval";

    dispId.textContent = "ENDPOINT: /api/v1/smartsync/recommendations";
    dispBody.innerHTML = `
      <div class="manifest-certified">
        <p><strong>Status:</strong> ${result.transmission_status}</p>
        <p><strong>Backend Message:</strong> ${result.backend_response ? result.backend_response.message : 'Recommendations buffered.'}</p>
        <p><strong>Confirmed Assignments Proposed:</strong> ${result.recommendation_summary.recommended_assignments_count}</p>
        <p><strong>Forecast Pre-Positioning Proposals:</strong> ${result.recommendation_summary.proposals_count}</p>
        <p class="text-muted" style="margin-top: 0.5rem; font-size: 0.75rem;">
          Mandate Enforced: SmartSync does not mutate trips directly. The transit controller in the RailBus Backend must approve assignments via <code>POST /api/v1/smartsync/recommendations/{id}/approve</code>.
        </p>
      </div>
    `;
  } catch (err) {
    console.error("Transmission failed:", err);
    statusBadge.className = "badge badge-unmet";
    statusBadge.textContent = "Transmission Failed";
    dispBody.innerHTML = `<p style="color: #f87171;">Error: ${err.message}</p>`;
  }
}

// Execute Post-Arrival Audit
async function executePostArrivalAudit() {
  if (!currentEventId) return;
  try {
    const res = await fetch("/api/audit/post-arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: currentEventId })
    });
    const data = await res.json();
    const a1 = data.model_01_audit;

    document.getElementById("audit-m1-pred").textContent = `${a1.predicted_alighting} pax (${a1.served_by})`;
    document.getElementById("audit-m1-actual").textContent = `${a1.actual_alighting} pax`;
    document.getElementById("audit-m1-error").textContent = `${a1.absolute_error} pax (${a1.percentage_error}%)`;
    document.getElementById("audit-m1-interval").textContent = a1.within_80pct_interval ? "YES (Within 80% CI)" : "NO (Outside 80% CI)";
    document.getElementById("audit-m1-interval").style.color = a1.within_80pct_interval ? "var(--accent-emerald)" : "var(--accent-amber)";
  } catch (err) {
    console.error("Audit failed:", err);
  }
}
