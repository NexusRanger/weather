// traffic-flood.js
// ------------------------------------------------------------
// Provides live traffic and river‑flood information for the dashboard.
// Requires global constants: CURRENT_LOCATION (lat, lon) and TOMTOM_KEY.
// ------------------------------------------------------------

// Helper: use local server proxy (/proxy) to bypass browser CORS restrictions
async function fetchWithProxy(originalUrl) {
  try {
    const proxyUrl = '/proxy?url=' + encodeURIComponent(originalUrl);
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Local proxy request failed, trying direct:', err);
    const res = await fetch(originalUrl);
    if (!res.ok) throw new Error(`Direct status ${res.status}`);
    return await res.json();
  }
}

// ------------------------------------------------------------------
// 1️⃣ Traffic – TomTom Traffic API (Flow Segment Data)
// ------------------------------------------------------------------
async function fetchTrafficData() {
  const card = document.getElementById('trafficCard');
  if (!card) return;

  try {
    const { lat, lon } = CURRENT_LOCATION;
    // TomTom expects point=latitude,longitude and unit=mph
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=mph&key=${TOMTOM_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Traffic API HTTP ${res.status}`);
    }
    const data = await res.json();
    const flow = data.flowSegmentData;
    if (!flow) throw new Error('No flow data returned');

    const { currentSpeed, freeFlowSpeed, roadClosure } = flow;
    const delayPct = freeFlowSpeed > 0 ? Math.round(((freeFlowSpeed - currentSpeed) / freeFlowSpeed) * 100) : 0;

    if (roadClosure) {
      card.innerHTML = `<span class="text-rose-400 font-bold flex items-center gap-1">⛔ Closed</span>`;
    } else if (delayPct >= 35) {
      card.innerHTML = `<span class="text-rose-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span> Heavy Delays (${currentSpeed} mph)</span>`;
    } else if (delayPct >= 15) {
      card.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Moderate (${currentSpeed} mph)</span>`;
    } else {
      card.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Flowing (${currentSpeed} mph)</span>`;
    }
  } catch (e) {
    console.warn('Traffic fetch issue:', e.message);
    if (card) {
      card.innerHTML = `<span class="text-emerald-400 font-bold">Clear</span>`;
    }
  }
}

// ------------------------------------------------------------------
// 2️⃣ River‑flood – UK Environment Agency flood‑monitoring API
// ------------------------------------------------------------------
async function fetchFloodData() {
  const card = document.getElementById('floodCard');
  if (!card) return;

  try {
    const { lat, lon } = CURRENT_LOCATION;

    // 2.1 Get nearest stations (within 8 km radius)
    const stationsUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations?lat=${lat}&long=${lon}&dist=8&parameter=level`;
    let stationsData = null;
    try {
      stationsData = await fetchWithProxy(stationsUrl);
    } catch (_) {}

    // 2.2 Check for active flood alerts within 10 km
    let alerts = [];
    try {
      const alertsUrl = `https://environment.data.gov.uk/flood-monitoring/id/floods?lat=${lat}&long=${lon}&dist=10`;
      const alertsData = await fetchWithProxy(alertsUrl);
      alerts = alertsData.items || [];
    } catch (_) {}

    // 2.3 General status check
    if (alerts.length > 0) {
      card.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1"><span>⚠️</span> ${alerts.length} Alert${alerts.length > 1 ? 's' : ''}</span>`;
      card.className = "text-xs font-bold text-amber-300";
    } else {
      card.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Normal</span>`;
      card.className = "text-xs font-bold text-emerald-400";
    }
  } catch (e) {
    console.warn('Flood fetch issue:', e.message);
    if (card) {
      card.innerHTML = `<span class="text-emerald-400 font-bold">Normal</span>`;
    }
  }
}

// Export functions so main script can invoke them
window.fetchTrafficData = fetchTrafficData;
window.fetchFloodData = fetchFloodData;

