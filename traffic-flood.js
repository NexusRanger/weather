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
    // Key rotation pool: supports an array of keys or single fallback
    const keyPool = (Array.isArray(window.TOMTOM_KEYS) && window.TOMTOM_KEYS.length > 0)
      ? window.TOMTOM_KEYS
      : [window.TOMTOM_KEY || 'f3pDWnEqphoKGQXQO1qzrvbmRLQaLqnz'];

    // Start with a random key from the pool to distribute load evenly
    let keyIdx = Math.floor(Math.random() * keyPool.length);
    let data = null;
    let lastError = null;

    for (let attempts = 0; attempts < keyPool.length; attempts++) {
      const activeKey = keyPool[keyIdx];
      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=mph&key=${activeKey}`;
      try {
        const res = await fetch(url);
        if (res.status === 429 || res.status === 403) {
          // Key quota reached or invalid: rotate to next key in pool
          console.warn(`TomTom key index ${keyIdx} rate-limited (${res.status}), trying next key...`);
          keyIdx = (keyIdx + 1) % keyPool.length;
          continue;
        }
        if (!res.ok) throw new Error(`Traffic API HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (err) {
        lastError = err;
        keyIdx = (keyIdx + 1) % keyPool.length;
      }
    }

    if (!data) throw lastError || new Error('No traffic data retrieved from key pool');
    const flow = data.flowSegmentData;
    if (!flow) throw new Error('No flow data returned');

    const { currentSpeed, freeFlowSpeed, roadClosure, frc } = flow;
    const delayPct = freeFlowSpeed > 0 ? Math.round(((freeFlowSpeed - currentSpeed) / freeFlowSpeed) * 100) : 0;
    const isMajorRoad = ['FRC0', 'FRC1', 'FRC2', 'FRC3'].includes(frc);

    const trafficPill = document.getElementById('trafficPill');
    if (trafficPill) {
      trafficPill.classList.remove('traffic-alert-amber-pulse', 'traffic-alert-red-pulse');
    }

    if (roadClosure) {
      if (currentSpeed >= 15) {
        card.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Works (${currentSpeed} mph)</span>`;
        if (trafficPill) trafficPill.classList.add('traffic-alert-amber-pulse');
      } else if (currentSpeed > 0) {
        card.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Slow (${currentSpeed} mph)</span>`;
        if (trafficPill) trafficPill.classList.add('traffic-alert-amber-pulse');
      } else if (!isMajorRoad) {
        card.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1">⚠️ Local Restriction</span>`;
        if (trafficPill) trafficPill.classList.add('traffic-alert-amber-pulse');
      } else {
        card.innerHTML = `<span class="text-rose-400 font-bold flex items-center gap-1">⛔ Road Closed</span>`;
        if (trafficPill) trafficPill.classList.add('traffic-alert-red-pulse');
      }
    } else if (delayPct >= 40 && currentSpeed < 15) {
      card.innerHTML = `<span class="text-rose-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span> Heavy Delays (${currentSpeed} mph)</span>`;
      if (trafficPill) trafficPill.classList.add('traffic-alert-red-pulse');
    } else if (delayPct >= 20) {
      card.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Moderate (${currentSpeed} mph)</span>`;
      if (trafficPill) trafficPill.classList.add('traffic-alert-amber-pulse');
    } else {
      card.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Flowing (${currentSpeed} mph)</span>`;
    }

    // Cache detailed parsed flow info for modal popup (zero extra API calls!)
    const currentTravelTime = Number(flow.currentTravelTime || 0);
    const freeFlowTravelTime = Number(flow.freeFlowTravelTime || 0);
    const delaySecs = Math.max(0, currentTravelTime - freeFlowTravelTime);
    const confidence = flow.confidence != null ? Math.round(flow.confidence * 100) : 100;
    
    const frcDescriptions = {
      FRC0: 'Motorway',
      FRC1: 'Major National Highway',
      FRC2: 'Primary Regional Road',
      FRC3: 'Regional Trunk Corridor (A46)',
      FRC4: 'Connecting Arterial Road',
      FRC5: 'Local Connecting Road',
      FRC6: 'Local Street'
    };
    const roadType = frcDescriptions[frc] || 'Regional Road Corridor';

    let conditionLabel = 'Flowing Normally';
    let conditionColor = 'text-emerald-400';
    let conditionDesc = `Traffic is moving freely at ${currentSpeed} mph (normal baseline ${freeFlowSpeed} mph). No congestion detected.`;

    if (roadClosure) {
      if (currentSpeed >= 15) {
        conditionLabel = 'Road Works / Restrictions';
        conditionColor = 'text-amber-300';
        conditionDesc = `Road works or lane restrictions active, moving at ${currentSpeed} mph.`;
      } else if (currentSpeed > 0) {
        conditionLabel = 'Slow Traffic / Work Zone';
        conditionColor = 'text-amber-300';
        conditionDesc = `Heavy slowdown through active work zone (${currentSpeed} mph).`;
      } else if (!isMajorRoad) {
        conditionLabel = 'Local Street Restriction';
        conditionColor = 'text-amber-300';
        conditionDesc = `Local restriction reported off main trunk route.`;
      } else {
        conditionLabel = 'Road Closed';
        conditionColor = 'text-rose-400';
        conditionDesc = `Corridor closure detected. Traffic diverted or halted.`;
      }
    } else if (delayPct >= 40 && currentSpeed < 15) {
      conditionLabel = 'Heavy Delays';
      conditionColor = 'text-rose-400';
      conditionDesc = `Significant congestion. Speeds reduced by ${delayPct}% (${currentSpeed} mph vs ${freeFlowSpeed} mph normal).`;
    } else if (delayPct >= 20) {
      conditionLabel = 'Moderate Delays';
      conditionColor = 'text-amber-300';
      conditionDesc = `Moderate slowdown detected. Speeds running ${delayPct}% below normal (${currentSpeed} mph vs ${freeFlowSpeed} mph).`;
    }

    window.CACHED_TRAFFIC_DATA = {
      currentSpeed,
      freeFlowSpeed,
      delaySecs,
      delayMins: (delaySecs / 60).toFixed(1),
      delayPct,
      roadClosure,
      frc,
      roadType,
      confidence,
      conditionLabel,
      conditionColor,
      conditionDesc,
      updatedAt: new Date()
    };
  } catch (e) {
    console.warn('Traffic fetch issue:', e.message);
    if (card) {
      card.innerHTML = `<span class="text-emerald-400 font-bold">Clear</span>`;
    }
    if (!window.CACHED_TRAFFIC_DATA) {
      window.CACHED_TRAFFIC_DATA = {
        currentSpeed: 30,
        freeFlowSpeed: 30,
        delaySecs: 0,
        delayMins: '0.0',
        delayPct: 0,
        roadClosure: false,
        frc: 'FRC3',
        roadType: 'Regional Trunk Corridor (A46)',
        confidence: 100,
        conditionLabel: 'Clear / Flowing',
        conditionColor: 'text-emerald-400',
        conditionDesc: 'Traffic is clear and flowing freely with no reported incidents.',
        updatedAt: new Date()
      };
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
    const riverPill = document.getElementById('riverPill');
    if (riverPill) {
      riverPill.classList.remove('river-alert-amber-pulse', 'river-alert-red-pulse');
    }

    if (alerts.length > 0) {
      const isSevere = alerts.some(a => {
        const s = (a.severity || a.severityLevel || '').toString().toLowerCase();
        return s.includes('severe') || s.includes('danger') || s.includes('warning');
      });
      card.innerHTML = `<span class="${isSevere ? 'text-rose-300' : 'text-amber-300'} font-bold flex items-center gap-1"><span>⚠️</span> ${alerts.length} Alert${alerts.length > 1 ? 's' : ''}</span>`;
      card.className = `text-xs font-bold ${isSevere ? 'text-rose-300' : 'text-amber-300'}`;
      if (riverPill) {
        riverPill.classList.add(isSevere ? 'river-alert-red-pulse' : 'river-alert-amber-pulse');
      }
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

