/**
 * RailBus Intelligence Engine — Operator Command Center Application
 * Connects frontend dashboard with FastAPI 4-stage pipeline and OR-Tools optimizer.
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
const btnDeployTop = document.getElementById("btn-deploy-top");
const btnDeployAction = document.getElementById("btn-deploy-action");
const btnRunSim = document.getElementById("btn-run-sim");
const btnResetSim = document.getElementById("btn-reset-sim");

// Sliders
const simDelaySlider = document.getElementById("sim-delay-slider");
const simBookingSlider = document.getElementById("sim-booking-slider");
const simSurgeSlider = document.getElementById("sim-surge-slider");
const valDelayDelta = document.getElementById("val-delay-delta");
const valBookingMult = document.getElementById("val-booking-mult");
const valSurgeMult = document.getElementById("val-surge-mult");

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

  // Deploy Action
  btnDeployAction.addEventListener("click", executeDeployment);
  btnDeployTop.addEventListener("click", executeDeployment);

  // Simulation Sliders
  simDelaySlider.addEventListener("input", (e) => {
    valDelayDelta.textContent = `+${e.target.value} mins`;
  });
  simBookingSlider.addEventListener("input", (e) => {
    valBookingMult.textContent = `${e.target.value}x`;
  });
  simSurgeSlider.addEventListener("input", (e) => {
    valSurgeMult.textContent = `${e.target.value}x`;
  });

  btnRunSim.addEventListener("click", runSimulation);
  btnResetSim.addEventListener("click", () => {
    simDelaySlider.value = 0;
    simBookingSlider.value = 1.0;
    simSurgeSlider.value = 1.0;
    valDelayDelta.textContent = "+0 mins";
    valBookingMult.textContent = "1.0x (Normal)";
    valSurgeMult.textContent = "1.0x (Standard)";
    if (currentEventId) loadPipelineData(currentEventId, currentHorizon, currentRisk);
  });
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

    data.trains.forEach((t, idx) => {
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

// 2. Fetch Full Pipeline Data
async function loadPipelineData(eventId, horizon, risk) {
  try {
    const res = await fetch(`/api/pipeline/${eventId}?horizon=${horizon}&risk=${risk}`);
    const data = await res.json();
    cachedPipelineData = data;

    renderTrainHero(data.train_info);
    renderStage1Predict(data.stage_1_predict);
    renderStage2Plan(data.stage_2_plan);
    renderStage3Deploy(data.stage_3_deploy);
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

// Render Stage 1: The 4 Distinct Models
function renderStage1Predict(predict) {
  const m1 = predict.model_01_arrival_estimation;
  const m2 = predict.model_02_destination_distribution;
  const m3 = predict.model_03_transit_demand;
  const m4 = predict.model_04_railbus_adoption;

  // Model 01
  document.getElementById("m1-alighting-val").textContent = m1.expected_alighting_passengers;
  document.getElementById("m1-xgb-val").textContent = `${m1.expected_alighting_passengers} pax`;
  document.getElementById("m1-poisson-val").textContent = `${m1.poisson_baseline_benchmark} pax`;
  document.getElementById("m1-interval").textContent = `[${m1.lower_bound_p10} , ${m1.upper_bound_p90}] pax`;

  // Model 02
  const destList = document.getElementById("m2-destination-list");
  destList.innerHTML = "";
  const counts = m2.destination_passenger_counts;
  const shares = m2.destination_shares_pct;

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

  // Model 03
  document.getElementById("m3-transit-val").textContent = m3.total_onward_transit_demand;
  document.getElementById("m3-pct-val").textContent = `${m3.overall_transit_need_rate_pct}%`;
  document.getElementById("m3-local-val").textContent = `${m3.total_private_or_local_passengers} pax`;
  document.getElementById("m3-fill-transit").style.width = `${m3.overall_transit_need_rate_pct}%`;
  document.getElementById("m3-fill-private").style.width = `${100 - m3.overall_transit_need_rate_pct}%`;
  document.getElementById("m3-note").textContent = m3.interpretation;

  // Model 04
  document.getElementById("m4-adopted-val").textContent = m4.total_expected_railbus_passengers;
  document.getElementById("m4-rate-val").textContent = `${m4.overall_adoption_rate_pct}% of transit need`;
  document.getElementById("m4-confirmed-val").textContent = `${m4.total_confirmed_bookings} bookings`;
  document.getElementById("m4-range-val").textContent = `[${m4.total_confidence_range[0]} , ${m4.total_confidence_range[1]}] pax`;
}

// Render Stage 2: OR-Tools Transport Optimization Plan
function renderStage2Plan(plan) {
  const sum = plan.fleet_summary;

  document.getElementById("kpi-demand").textContent = `${sum.total_forecasted_demand} pax`;
  document.getElementById("kpi-capacity").textContent = `${sum.total_seats_allocated} seats`;
  document.getElementById("kpi-loadfactor").textContent = `${sum.overall_load_factor_pct}%`;
  document.getElementById("kpi-vehicles").textContent = `${sum.total_fleet_vehicles} buses`;
  document.getElementById("kpi-crew").textContent = `${sum.total_crew_assigned} crew`;
  document.getElementById("kpi-margin").textContent = `₹${sum.projected_net_margin_inr.toLocaleString()}`;
  document.getElementById("kpi-rev-cost").textContent = `Rev: ₹${sum.projected_ticket_revenue_inr.toLocaleString()} | Cost: ₹${sum.total_operating_cost_inr.toLocaleString()}`;

  // Route Grouping Banner
  const advContainer = document.getElementById("grouping-advisory-container");
  const advText = document.getElementById("grouping-advisory-text");
  if (plan.route_grouping_advisories && plan.route_grouping_advisories.length > 0) {
    const adv = plan.route_grouping_advisories[0];
    advText.innerHTML = `<strong>${adv.cluster_name}:</strong> Consolidate low-demand routes (<em>${adv.merged_routes.join(", ")}</em>) into <strong>${adv.recommended_vehicle}</strong>. Saves <strong>₹${adv.savings_inr}</strong> operational dispatch cost! Path: ${adv.description}.`;
    advContainer.style.display = "flex";
  } else {
    advText.textContent = "Point-to-point dedicated shuttles optimal for current passenger volume across all routes.";
  }

  // Table
  const tbody = document.getElementById("dispatch-table-body");
  tbody.innerHTML = "";

  plan.route_plans.forEach(rp => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${rp.destination_station}</strong></td>
      <td>${rp.planning_demand} pax <small class="text-secondary">(conf: ${rp.confirmed_bookings})</small></td>
      <td><span class="text-cyan font-bold">${rp.vehicles_summary}</span></td>
      <td>${rp.total_capacity_seats} seats</td>
      <td><strong>${rp.load_factor_pct}%</strong></td>
      <td><span class="time-badge">${rp.departure_time}</span></td>
      <td><span class="badge-bay">${rp.platform_bay}</span></td>
      <td><span class="badge-status ${rp.status_color}">${rp.status}</span></td>
      <td><small>${rp.operator_note}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Stage 3: Deployment Status
function renderStage3Deploy(deploy) {
  const badge = document.getElementById("deploy-status-badge");
  const dispId = document.getElementById("disp-manifest-id");
  const dispBody = document.getElementById("disp-manifest-body");
  const stepDeploy = document.getElementById("step-deploy");

  if (deploy.status === "DEPLOYED" && deploy.deployment_record) {
    const rec = deploy.deployment_record;
    badge.className = "badge badge-approved";
    badge.textContent = "Officially Deployed & Locked";
    stepDeploy.classList.add("active");

    dispId.textContent = `MANIFEST ID: ${rec.manifest_id}`;
    dispBody.innerHTML = `
      <div class="manifest-certified">
        <p><strong>Status:</strong> DISPATCH OFFICIALLY AUTHORIZED</p>
        <p><strong>Authorized Controller:</strong> ${rec.operator_name}</p>
        <p><strong>Timestamp:</strong> ${new Date(rec.deployment_timestamp).toLocaleString("en-IN")}</p>
        <p><strong>Directives:</strong> ${rec.notes || "Standard Operating Procedure"}</p>
        <table class="manifest-table">
          <thead><tr><th>Route</th><th>Vehicle</th><th>Bay</th><th>Departure</th></tr></thead>
          <tbody>
            ${rec.route_plans.map(r => `<tr><td>${r.destination_station}</td><td>${r.vehicles_summary}</td><td>${r.platform_bay}</td><td>${r.departure_time}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    badge.className = "badge badge-pending";
    badge.textContent = "Ready for Deployment";
    stepDeploy.classList.remove("active");
    dispId.textContent = "MANIFEST: NOT YET ISSUED";
    dispBody.innerHTML = `<p class="placeholder-text">Click "Confirm & Issue Dispatch Manifest" to lock in fleet schedules and generate the verified digital manifest.</p>`;
  }
}

// Execute Deployment Action
async function executeDeployment() {
  if (!currentEventId) return;
  const operatorName = document.getElementById("operator-name-input").value.trim() || "Chief Dispatcher";
  const notes = document.getElementById("operator-notes-input").value.trim();

  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: currentEventId,
        operator_name: operatorName,
        notes: notes
      })
    });
    const result = await res.json();
    if (result.status === "success") {
      await loadPipelineData(currentEventId, currentHorizon, currentRisk);
      alert(`Manifest ${result.manifest.manifest_id} officially authorized and dispatched!`);
    }
  } catch (err) {
    console.error("Failed to deploy manifest:", err);
    alert("Error deploying manifest: " + err.message);
  }
}

// Run Simulation Lab
async function runSimulation() {
  if (!currentEventId) return;
  const delayDelta = parseInt(simDelaySlider.value);
  const bookingMult = parseFloat(simBookingSlider.value);
  const surgeMult = parseFloat(simSurgeSlider.value);

  try {
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: currentEventId,
        delay_minutes_delta: delayDelta,
        booking_growth_multiplier: bookingMult,
        festival_surge_multiplier: surgeMult,
        risk_tolerance: currentRisk
      })
    });
    const data = await res.json();

    document.getElementById("sim-res-alight").textContent = `${data.stage_1_predict.model_01.expected_alighting_passengers} pax`;
    document.getElementById("sim-res-transit").textContent = `${data.stage_1_predict.model_03.total_onward_transit_demand} pax`;
    document.getElementById("sim-res-adoption").textContent = `${data.stage_1_predict.model_04.total_expected_railbus_passengers} pax`;
    document.getElementById("sim-res-fleet").textContent = `${data.stage_2_plan.fleet_summary.total_seats_allocated} seats`;
    document.getElementById("sim-res-lf").textContent = `${data.stage_2_plan.fleet_summary.overall_load_factor_pct}%`;
  } catch (err) {
    console.error("Simulation failed:", err);
  }
}
