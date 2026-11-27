/**
 * analytics.js — Isolated, fail-silent telemetry for Ambient Weather Dashboard.
 * Never throws or blocks dashboard rendering; writes only via locked-down Supabase RPCs.
 */
(function () {
  'use strict';

  try {
    var SUPABASE_URL = 'https://kfxvxehzbtdiflwjcpmo.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_uLs2WDllT95YH15WEzjqFw_O9_nkT8v';
    var VISITOR_KEY = 'ambient_visitor_id';
    var OWNER_KEY = 'ambient_analytics_owner';
    var GEO_CACHE_KEY = 'ambient_analytics_geo_v1';

    function safeStorageGet(store, key) {
      try {
        return store.getItem(key);
      } catch (_) {
        return null;
      }
    }

    function safeStorageSet(store, key, val) {
      try {
        store.setItem(key, val);
        return true;
      } catch (_) {
        return false;
      }
    }

    function safeStorageRemove(store, key) {
      try {
        store.removeItem(key);
      } catch (_) {}
    }

    function generateUuid() {
      try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
          var buf = new Uint8Array(16);
          crypto.getRandomValues(buf);
          buf[6] = (buf[6] & 0x0f) | 0x40;
          buf[8] = (buf[8] & 0x3f) | 0x80;
          var hex = '';
          for (var i = 0; i < buf.length; i++) {
            hex += (buf[i] + 0x100).toString(16).slice(1);
          }
          return (
            hex.slice(0, 8) + '-' +
            hex.slice(8, 12) + '-' +
            hex.slice(12, 16) + '-' +
            hex.slice(16, 20) + '-' +
            hex.slice(20)
          );
        }
      } catch (_) {}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function showToast(message, accentColor) {
      function mount() {
        try {
          if (!document.body) return;
          var existing = document.getElementById('ambient-owner-toast');
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
          var el = document.createElement('div');
          el.id = 'ambient-owner-toast';
          el.textContent = message;
          el.style.cssText =
            'position:fixed;right:16px;bottom:16px;z-index:2147483647;' +
            'background:rgba(15,23,42,0.95);color:#f1f5f9;' +
            'border:1px solid ' + (accentColor || 'rgba(56,189,248,0.45)') + ';' +
            'padding:10px 14px;border-radius:12px;font:500 12px/1.4 "Plus Jakarta Sans",system-ui,sans-serif;' +
            'box-shadow:0 10px 25px rgba(0,0,0,0.6);pointer-events:none;' +
            'opacity:0;transition:opacity 200ms ease;';
          document.body.appendChild(el);
          setTimeout(function () {
            el.style.opacity = '1';
          }, 20);
          setTimeout(function () {
            el.style.opacity = '0';
            setTimeout(function () {
              if (el.parentNode) el.parentNode.removeChild(el);
            }, 250);
          }, 3500);
        } catch (_) {}
      }
      if (document.body) {
        mount();
      } else {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
      }
    }

    // Handle ?owner=1 / ?owner=0 URL parameter early
    (function handleOwnerParam() {
      try {
        var params = new URLSearchParams(window.location.search || '');
        if (!params.has('owner')) return;
        var val = (params.get('owner') || '').toLowerCase().trim();
        if (val === '1' || val === 'true') {
          safeStorageSet(window.localStorage, OWNER_KEY, 'true');
          showToast('Owner device tagged — excluded from public stats', 'rgba(52,211,153,0.5)');
        } else if (val === '0' || val === 'false') {
          safeStorageRemove(window.localStorage, OWNER_KEY);
          showToast('Owner tag removed from this browser', 'rgba(251,191,36,0.5)');
        }
        params.delete('owner');
        var nextQuery = params.toString();
        var nextUrl =
          window.location.pathname +
          (nextQuery ? '?' + nextQuery : '') +
          (window.location.hash || '');
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(window.history.state, '', nextUrl);
        }
      } catch (_) {}
    })();

    function isOwnerDevice() {
      return (
        safeStorageGet(window.localStorage, OWNER_KEY) === 'true' ||
        safeStorageGet(window.localStorage, 'ambient_admin_unlocked') === 'true'
      );
    }

    function readAppVersion() {
      try {
        if (typeof APP_VERSION !== 'undefined' && APP_VERSION) return String(APP_VERSION);
        if (window.APP_VERSION) return String(window.APP_VERSION);
      } catch (_) {}
      return null;
    }

    function detectEnv(appVersion) {
      try {
        var proto = (window.location && window.location.protocol) || '';
        var host = ((window.location && window.location.hostname) || '').toLowerCase();
        var path = ((window.location && window.location.pathname) || '').toLowerCase();
        if (
          proto === 'file:' ||
          !host ||
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          /^192\.168\./.test(host) ||
          /^10\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        ) {
          return 'local';
        }
        if (path.indexOf('dev.html') !== -1 || (appVersion && /-dev$/i.test(appVersion))) {
          return 'dev';
        }
        return 'live';
      } catch (_) {
        return 'live';
      }
    }

    function detectDeviceInfo() {
      var uaRaw = (navigator.userAgent || '');
      var ua = uaRaw.toLowerCase();
      var search = ((window.location && window.location.search) || '').toLowerCase();
      var isCastReceiver = ua.indexOf('crkey') !== -1 || search.indexOf('cast_receiver=true') !== -1;

      var isTvUa = (
        ua.indexOf('shield') !== -1 ||
        ua.indexOf('android tv') !== -1 ||
        ua.indexOf('googletv') !== -1 ||
        ua.indexOf('smarttv') !== -1 ||
        ua.indexOf('smart-tv') !== -1 ||
        ua.indexOf('tv bro') !== -1 ||
        ua.indexOf('aft') !== -1 ||
        ua.indexOf('nexus player') !== -1 ||
        ua.indexOf('mibox') !== -1 ||
        ua.indexOf('bravia') !== -1 ||
        ua.indexOf('apple tv') !== -1 ||
        ua.indexOf('webos') !== -1 ||
        ua.indexOf('tizen') !== -1 ||
        (ua.indexOf('android') !== -1 && (ua.indexOf('tv') !== -1 || ua.indexOf('large screen') !== -1)) ||
        search.indexOf('tv=true') !== -1 ||
        search.indexOf('tv=1') !== -1 ||
        search.indexOf('shield=true') !== -1
      );

      var touchPoints = Number(navigator.maxTouchPoints || 0);
      var minScreen = Math.min(window.screen ? window.screen.width : 0, window.screen ? window.screen.height : 0);
      var isIpad = ua.indexOf('ipad') !== -1 || (ua.indexOf('macintosh') !== -1 && touchPoints > 1);
      var isTablet = isIpad || (ua.indexOf('android') !== -1 && ua.indexOf('mobile') === -1 && minScreen >= 600) || ua.indexOf('tablet') !== -1;
      var isMobile = !isTablet && (
        ua.indexOf('iphone') !== -1 ||
        ua.indexOf('ipod') !== -1 ||
        (ua.indexOf('android') !== -1 && ua.indexOf('mobile') !== -1) ||
        ua.indexOf('windows phone') !== -1 ||
        ua.indexOf('mobile') !== -1
      );

      var deviceType = 'desktop';
      if (isCastReceiver) deviceType = 'cast_receiver';
      else if (isTvUa) deviceType = 'tv';
      else if (isTablet) deviceType = 'tablet';
      else if (isMobile) deviceType = 'mobile';

      var deviceOs = 'Other';
      if (isCastReceiver && ua.indexOf('android') === -1) deviceOs = 'CastOS';
      else if (ua.indexOf('iphone') !== -1 || ua.indexOf('ipod') !== -1) deviceOs = 'iOS';
      else if (isIpad) deviceOs = 'iPadOS';
      else if (isTvUa && ua.indexOf('android') !== -1) deviceOs = 'Android TV';
      else if (ua.indexOf('tizen') !== -1) deviceOs = 'Tizen';
      else if (ua.indexOf('webos') !== -1) deviceOs = 'webOS';
      else if (ua.indexOf('android') !== -1) deviceOs = 'Android';
      else if (ua.indexOf('cros') !== -1) deviceOs = 'ChromeOS';
      else if (ua.indexOf('windows') !== -1) deviceOs = 'Windows';
      else if (ua.indexOf('mac os x') !== -1 || ua.indexOf('macintosh') !== -1) deviceOs = 'macOS';
      else if (ua.indexOf('linux') !== -1) deviceOs = 'Linux';

      var deviceBrowser = 'Other';
      if (isCastReceiver) deviceBrowser = 'Cast Receiver';
      else if (ua.indexOf('tv bro') !== -1) deviceBrowser = 'TV Bro';
      else if (ua.indexOf('samsungbrowser') !== -1) deviceBrowser = 'Samsung Internet';
      else if (ua.indexOf('edg/') !== -1 || ua.indexOf('edgios') !== -1 || ua.indexOf('edga') !== -1) deviceBrowser = 'Edge';
      else if (ua.indexOf('opr/') !== -1 || ua.indexOf('opera') !== -1) deviceBrowser = 'Opera';
      else if (ua.indexOf('firefox') !== -1 || ua.indexOf('fxios') !== -1) deviceBrowser = 'Firefox';
      else if (ua.indexOf('chrome') !== -1 || ua.indexOf('crios') !== -1) deviceBrowser = 'Chrome';
      else if (ua.indexOf('safari') !== -1) deviceBrowser = 'Safari';

      var deviceModel = 'Desktop';
      if (isCastReceiver) deviceModel = 'Chromecast / Google TV';
      else if (ua.indexOf('shield') !== -1 || search.indexOf('shield=true') !== -1) deviceModel = 'Nvidia Shield';
      else if (ua.indexOf('aft') !== -1) deviceModel = 'Amazon Fire TV';
      else if (ua.indexOf('tizen') !== -1) deviceModel = 'Samsung Smart TV';
      else if (ua.indexOf('webos') !== -1) deviceModel = 'LG webOS TV';
      else if (ua.indexOf('bravia') !== -1) deviceModel = 'Sony Bravia / Android TV';
      else if (ua.indexOf('apple tv') !== -1) deviceModel = 'Apple TV';
      else if (ua.indexOf('mibox') !== -1) deviceModel = 'Xiaomi Mi Box';
      else if (ua.indexOf('nexus player') !== -1) deviceModel = 'Nexus Player';
      else if (isTvUa) deviceModel = 'Android TV / Smart TV';
      else if (ua.indexOf('iphone') !== -1) deviceModel = 'iPhone';
      else if (isIpad) deviceModel = 'iPad';
      else if (deviceType === 'tablet' && ua.indexOf('android') !== -1) deviceModel = 'Android Tablet';
      else if (deviceType === 'mobile' && ua.indexOf('android') !== -1) deviceModel = 'Android Phone';
      else if (deviceType === 'tablet') deviceModel = 'Tablet';
      else if (deviceType === 'mobile') deviceModel = 'Mobile Phone';
      else if (deviceOs === 'ChromeOS') deviceModel = 'Chromebook';
      else if (deviceOs === 'Windows') deviceModel = 'Windows PC';
      else if (deviceOs === 'macOS') deviceModel = 'Mac';
      else if (deviceOs === 'Linux') deviceModel = 'Linux Desktop';

      var isPwa = false;
      try {
        isPwa = (
          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator.standalone === true
        );
      } catch (_) {}

      var isTvLayout = false;
      try {
        isTvLayout = document.documentElement.classList.contains('is-tv-layout');
      } catch (_) {}

      var screenRes = null;
      try {
        if (window.screen && window.screen.width && window.screen.height) {
          screenRes = window.screen.width + 'x' + window.screen.height;
        }
      } catch (_) {}

      return {
        deviceType: deviceType,
        deviceOs: deviceOs,
        deviceBrowser: deviceBrowser,
        deviceModel: deviceModel,
        isPwa: isPwa,
        isTvLayout: isTvLayout,
        screenRes: screenRes,
        isCastReceiver: isCastReceiver
      };
    }

    function getOutwardPostcode(pc) {
      if (!pc || typeof pc !== 'string') return null;
      var trimmed = pc.trim().toUpperCase();
      if (!trimmed || trimmed === 'UNDEFINED' || trimmed === 'NULL') return null;
      var spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) return trimmed.slice(0, spaceIdx).slice(0, 10);
      var ukMatch = trimmed.match(/^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{2}$/i);
      if (ukMatch) return ukMatch[1].toUpperCase();
      return trimmed.slice(0, 10);
    }

    function round2(n) {
      var num = Number(n);
      if (!isFinite(num)) return null;
      return Math.round(num * 100) / 100;
    }

    function readLocation() {
      try {
        var loc = null;
        if (typeof CURRENT_LOCATION !== 'undefined' && CURRENT_LOCATION) {
          loc = CURRENT_LOCATION;
        } else {
          var raw = safeStorageGet(window.localStorage, 'ambient_weather_loc') ||
                    safeStorageGet(window.sessionStorage, 'ambient_weather_loc');
          if (raw) loc = JSON.parse(raw);
        }
        if (!loc || typeof loc !== 'object') {
          return { name: null, postcode: null, lat: null, lon: null, locked: false };
        }
        if (loc.locked === true) {
          return { name: 'Private (Locked)', postcode: null, lat: null, lon: null, locked: true };
        }
        var rawName = loc.geoName || loc.name || '';
        var cleanName = typeof rawName === 'string' ? rawName.trim().slice(0, 120) : '';
        return {
          name: cleanName || 'Unknown',
          postcode: getOutwardPostcode(loc.postcode),
          lat: round2(loc.lat),
          lon: round2(loc.lon),
          locked: false
        };
      } catch (_) {
        return { name: null, postcode: null, lat: null, lon: null, locked: false };
      }
    }

    function getCleanReferrer() {
      try {
        if (!document.referrer) return null;
        var u = new URL(document.referrer);
        if (window.location && u.hostname === window.location.hostname) return null;
        return u.hostname ? u.hostname.slice(0, 120) : null;
      } catch (_) {
        return null;
      }
    }

    function getTimezone() {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch (_) {
        return null;
      }
    }

    var visitorId = safeStorageGet(window.localStorage, VISITOR_KEY);
    if (!visitorId || visitorId.length < 8) {
      visitorId = generateUuid();
      safeStorageSet(window.localStorage, VISITOR_KEY, visitorId);
    }
    var sessionId = generateUuid();

    var visitLogged = false;
    var visitInFlight = false;
    var pendingUpdates = [];
    var geoCache = null;

    try {
      var rawGeo = safeStorageGet(window.sessionStorage, GEO_CACHE_KEY);
      if (rawGeo) geoCache = JSON.parse(rawGeo);
    } catch (_) {
      geoCache = null;
    }

    function callRpc(fnName, body, useKeepalive) {
      try {
        if (typeof fetch !== 'function') return Promise.resolve();
        var opts = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
          },
          body: JSON.stringify(body)
        };
        if (useKeepalive) opts.keepalive = true;
        return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fnName, opts).catch(function () {});
      } catch (_) {
        return Promise.resolve();
      }
    }

    function flushPendingUpdates() {
      if (!visitLogged || !pendingUpdates.length) return;
      var items = pendingUpdates.splice(0, pendingUpdates.length);
      for (var i = 0; i < items.length; i++) {
        callRpc('update_analytics_session', items[i].payload, items[i].keepalive);
      }
    }

    function sendUpdate(fields, useKeepalive) {
      var payload = Object.assign(
        {
          p_session_id: sessionId,
          p_visitor_id: visitorId,
          p_is_owner: isOwnerDevice()
        },
        fields || {}
      );
      if (!visitLogged) {
        if (pendingUpdates.length < 25) {
          pendingUpdates.push({ payload: payload, keepalive: Boolean(useKeepalive) });
        }
        return;
      }
      callRpc('update_analytics_session', payload, Boolean(useKeepalive));
    }

    function fetchWithTimeout(url, timeoutMs) {
      return new Promise(function (resolve, reject) {
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () {
          if (controller) try { controller.abort(); } catch (_) {}
          reject(new Error('timeout'));
        }, timeoutMs);
        var opts = controller ? { signal: controller.signal } : {};
        fetch(url, opts)
          .then(function (res) {
            clearTimeout(timer);
            if (!res.ok) throw new Error('http_' + res.status);
            return res.json();
          })
          .then(resolve)
          .catch(function (err) {
            clearTimeout(timer);
            reject(err);
          });
      });
    }

    function fetchApproxGeoOnce() {
      if (geoCache && (geoCache.country || geoCache.country_code)) return;
      fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json', 2500)
        .then(function (d) {
          if (!d || (!d.country && !d.country_code)) throw new Error('empty');
          return {
            country: d.country ? String(d.country).slice(0, 80) : null,
            country_code: d.country_code ? String(d.country_code).toUpperCase().slice(0, 10) : null,
            region: d.region ? String(d.region).slice(0, 80) : null,
            city: d.city ? String(d.city).slice(0, 80) : null
          };
        })
        .catch(function () {
          return fetchWithTimeout('https://ipwho.is/', 2500).then(function (d) {
            if (!d || d.success === false || (!d.country && !d.country_code)) return null;
            return {
              country: d.country ? String(d.country).slice(0, 80) : null,
              country_code: d.country_code ? String(d.country_code).toUpperCase().slice(0, 10) : null,
              region: d.region ? String(d.region).slice(0, 80) : null,
              city: d.city ? String(d.city).slice(0, 80) : null
            };
          });
        })
        .then(function (geo) {
          if (!geo) return;
          geoCache = geo;
          safeStorageSet(window.sessionStorage, GEO_CACHE_KEY, JSON.stringify(geo));
          if (visitLogged) {
            sendUpdate({
              p_geo_country: geo.country,
              p_geo_country_code: geo.country_code,
              p_geo_region: geo.region,
              p_geo_city: geo.city
            });
          }
        })
        .catch(function () {});
    }

    // Active visible duration tracker
    var accumulatedMs = 0;
    var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    var lastReportedDuration = 0;

    function getActiveDurationSec() {
      var extra = visibleSince !== null ? Math.max(0, Date.now() - visibleSince) : 0;
      return Math.min(86400, Math.round((accumulatedMs + extra) / 1000));
    }

    var lastLocationKey = '';
    function locKey(loc) {
      if (!loc) return '';
      return [loc.name || '', loc.lat || '', loc.lon || '', loc.locked ? '1' : '0'].join('|');
    }

    function sendInitialVisit() {
      if (visitLogged || visitInFlight) return;
      visitInFlight = true;

      var appVersion = readAppVersion();
      var env = detectEnv(appVersion);
      var dev = detectDeviceInfo();
      var loc = readLocation();
      lastLocationKey = locKey(loc);

      var payload = {
        p_session_id: sessionId,
        p_visitor_id: visitorId,
        p_env: env,
        p_app_version: appVersion,
        p_is_owner: isOwnerDevice(),
        p_device_type: dev.deviceType,
        p_device_os: dev.deviceOs,
        p_device_browser: dev.deviceBrowser,
        p_device_model: dev.deviceModel,
        p_is_pwa: dev.isPwa,
        p_is_tv_layout: dev.isTvLayout,
        p_screen_res: dev.screenRes,
        p_referrer: getCleanReferrer(),
        p_timezone: getTimezone(),
        p_language: navigator.language ? String(navigator.language).slice(0, 30) : null,
        p_geo_country: geoCache ? geoCache.country : null,
        p_geo_country_code: geoCache ? geoCache.country_code : null,
        p_geo_region: geoCache ? geoCache.region : null,
        p_geo_city: geoCache ? geoCache.city : null,
        p_loc_name: loc.name,
        p_loc_postcode: loc.postcode,
        p_loc_lat: loc.lat,
        p_loc_lon: loc.lon,
        p_loc_locked: loc.locked,
        p_used_cast: dev.isCastReceiver,
        p_cast_mode: dev.isCastReceiver ? 'receiver' : null
      };

      callRpc('log_analytics_visit', payload, false).then(function () {
        visitInFlight = false;
        visitLogged = true;
        flushPendingUpdates();
      });
    }

    function setupObservers() {
      // 1. Modal Engagement Observer (MutationObserver on modal class attribute)
      var MODAL_FEATURES = {
        radarModal: 'radar',
        trafficModal: 'traffic',
        riverModal: 'river',
        wondersModal: 'wonders',
        historyMapModal: 'world_map',
        locationModal: 'location_picker',
        shareModal: 'share',
        castOptionsModal: 'cast_options',
        feedbackModal: 'feedback',
        creditsModal: 'credits'
      };
      var modalStates = {};
      var modalLastSent = {};

      if (typeof MutationObserver !== 'undefined') {
        Object.keys(MODAL_FEATURES).forEach(function (modalId) {
          var el = document.getElementById(modalId);
          if (!el) return;
          modalStates[modalId] = el.classList.contains('hidden');
          modalLastSent[modalId] = 0;

          var obs = new MutationObserver(function () {
            var isHidden = el.classList.contains('hidden');
            var wasHidden = modalStates[modalId];
            modalStates[modalId] = isHidden;
            if (wasHidden && !isHidden) {
              var now = Date.now();
              if (now - modalLastSent[modalId] < 2000) return;
              modalLastSent[modalId] = now;
              var feature = MODAL_FEATURES[modalId];
              sendUpdate({
                p_feature: feature,
                p_event_type: 'modal_open',
                p_event_target: feature
              });
            }
          });
          obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        });

        // 2. Google Cast Connection Observer
        var castConnectedReported = false;
        function checkCastConnectedState() {
          var castBtn = document.getElementById('castBtn');
          var castDot = document.getElementById('castActiveDot');
          var connected = Boolean(
            (castBtn && castBtn.classList.contains('cast-active-glowing')) ||
            (castDot && !castDot.classList.contains('hidden'))
          );
          if (connected && !castConnectedReported) {
            castConnectedReported = true;
            sendUpdate({
              p_used_cast: true,
              p_cast_mode: 'sender',
              p_event_type: 'cast_connected',
              p_event_target: 'google_cast'
            });
          } else if (!connected && castConnectedReported) {
            castConnectedReported = false;
          }
        }

        ['castBtn', 'castActiveDot'].forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          var obs = new MutationObserver(checkCastConnectedState);
          obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        checkCastConnectedState();
      }

      // 3. Cast Button Click Listener
      var lastCastClickAt = 0;
      document.addEventListener(
        'click',
        function (e) {
          try {
            var target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            var btn = target.closest('#castBtn, #modalCastBtn');
            if (!btn) return;
            var now = Date.now();
            if (now - lastCastClickAt < 1500) return;
            lastCastClickAt = now;
            sendUpdate({
              p_event_type: 'cast_click',
              p_event_target: btn.id || 'castBtn'
            });
          } catch (_) {}
        },
        { capture: true, passive: true }
      );

      // 4. Location Change Poll (passive, zero changes to dashboard JS)
      setInterval(function () {
        if (!visitLogged) return;
        var loc = readLocation();
        var nextKey = locKey(loc);
        if (!nextKey || nextKey === lastLocationKey) return;
        lastLocationKey = nextKey;
        sendUpdate({
          p_loc_name: loc.name,
          p_loc_postcode: loc.postcode,
          p_loc_lat: loc.lat,
          p_loc_lon: loc.lon,
          p_loc_locked: loc.locked,
          p_event_type: 'location_select',
          p_event_target: loc.name
        });
      }, 4000);

      // 5. Visibility-aware duration heartbeats (60s) + keepalive flush on hide/unload
      setInterval(function () {
        if (document.visibilityState !== 'visible' || !visitLogged) return;
        var sec = getActiveDurationSec();
        if (sec > lastReportedDuration && sec <= 86400) {
          lastReportedDuration = sec;
          sendUpdate({ p_duration_sec: sec });
        }
      }, 60000);

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          if (visibleSince !== null) {
            accumulatedMs += Math.max(0, Date.now() - visibleSince);
            visibleSince = null;
          }
          var sec = getActiveDurationSec();
          if (sec > lastReportedDuration || sec > 0) {
            lastReportedDuration = Math.max(lastReportedDuration, sec);
            sendUpdate({ p_duration_sec: sec }, true);
          }
        } else if (document.visibilityState === 'visible') {
          if (visibleSince === null) visibleSince = Date.now();
        }
      });

      window.addEventListener('pagehide', function () {
        var sec = getActiveDurationSec();
        if (sec > 0 || visitLogged) {
          lastReportedDuration = Math.max(lastReportedDuration, sec);
          sendUpdate({ p_duration_sec: sec }, true);
        }
      });
    }

    function boot() {
      fetchApproxGeoOnce();
      setupObservers();
      setTimeout(sendInitialVisit, 1200);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  } catch (_) {}
})();
