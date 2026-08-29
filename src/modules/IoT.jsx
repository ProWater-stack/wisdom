/* ===========================================================================
   modules/IoT.jsx — IoT Core module.
   IoTDevices (RO-tank + junction-box device list, telemetry, channels,
   history) and IoTAlertsPage, plus the full iot()/IOT_ helper cluster:
   weatherApi + Google-Weather correlation/narrative, tank/water-quality
   classification, anomaly scan/alert generation, and the small IoTTank/
   IoTWave/IoTEcg/IoTMetricGauge/IoTTankReadings sub-widgets — kept together
   since almost every helper here feeds only these screens.
   =========================================================================== */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, CalendarRange, CheckCircle2, Cpu,
  Download, Droplets, FlaskConical, Gauge, ShieldCheck, Thermometer, Waves,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line, LineChart,
  LabelList, ReferenceLine, ReferenceArea, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import {
  useAuth, api, authHeaders, exportToCsv,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, DefRow,
  axisTick, selectStyle, td, toastStyle,
} from "../shared/ui";
import junctionBoxImg from "../../Tank Photos/Junction Box.png";

/* ===========================================================================
   IOT CORE — live device monitoring (AWS API). Device list + pressure / flow /
   valve telemetry, channels, history. Polls status (10s) and history (15s).
   =========================================================================== */
export const IOT_API_BASE = "https://xb2sxpw2k0.execute-api.ap-southeast-2.amazonaws.com/prod";

/* ---- Weather (Prabhavati) + sensor↔weather correlation --------------------
   Live weather + past-24h history for the apartment, via the Cloud Function
   proxy (weather-proxy/). Paste the deployed URL into WEATHER_PROXY_URL and the
   dashboard goes live; until then it shows a clearly-labelled SAMPLE so the UI
   is visible. The newest history hour is the "live" reading (no separate current
   call). Location is hardcoded — weather is regional so pincode-area coords are
   exact enough. */
export const WEATHER_LOCATION = {
  name: "Prabhavati",
  area: "Garvebhavi Palya, Bengaluru",
  address: "Ramayya Lyt, 28, 7th Main, 6th Cross, Garvebhavi Palya, Bengaluru, Karnataka 560068",
  lat: 12.8925,
  lon: 77.6320,
};
// >>> Paste the deployed Cloud Function URL here to go live (see weather-proxy/README.md):
export const WEATHER_PROXY_URL = "https://asia-south1-backend-prowater.cloudfunctions.net/weather";
export const _wxNum = (v) => { const n = Number(v); return isNaN(n) ? null : n; };
// 24 hourly points on a Bengaluru-ish diurnal curve — used only when the proxy
// URL is blank/unreachable, and always flagged sample:true in the UI.
export function _wxSampleData() {
  const now = Date.now(), H = [];
  for (let i = 23; i >= 0; i--) {
    const t = now - i * 3600000, hr = new Date(t).getHours();
    const phase = Math.sin(((hr - 9) / 24) * 2 * Math.PI);
    H.push({ t, tempC: Math.round((28 + 2 * phase) * 10) / 10, humidity: Math.round(63 + 5 * phase), condition: i < 3 ? "Light rain" : (hr > 6 && hr < 18 ? "Partly cloudy" : "Clear") });
  }
  return { location: WEATHER_LOCATION, history: H, current: H[H.length - 1], cachedAt: new Date(now).toISOString(), sample: true };
}
// Accumulate the 24h the proxy returns into a rolling multi-day store (localStorage),
// deduped by hour and capped to 8 days. This makes Yesterday / This-Week correlation
// possible WITHOUT any extra API calls — we just keep the hours we already fetched.
export const _WX_LS = "pw_weather_hist";
export const _wxHour = (ms) => Math.floor(ms / 3600000) * 3600000;
export function _wxMerge(fresh) {
  let store = {};
  try { store = JSON.parse(localStorage.getItem(_WX_LS) || "{}") || {}; } catch { store = {}; }
  (fresh || []).forEach((h) => { if (h.t != null && !isNaN(h.t)) { const k = _wxHour(h.t); store[k] = { t: k, tempC: h.tempC, humidity: h.humidity, condition: h.condition }; } });
  const cutoff = Date.now() - 8 * 86400000;
  const merged = Object.values(store).filter((h) => h.t >= cutoff).sort((a, b) => a.t - b.t);
  try { const obj = {}; merged.forEach((h) => { obj[h.t] = h; }); localStorage.setItem(_WX_LS, JSON.stringify(obj)); } catch { /* quota — skip persist */ }
  return merged;
}
export let _wxCache = null, _wxAt = 0, _wxInflight = null;
export const weatherApi = {
  get: async (force) => {
    const now = Date.now();
    if (!force && _wxCache && now - _wxAt < 60 * 60 * 1000) return _wxCache;
    if (_wxInflight) return _wxInflight;
    if (!WEATHER_PROXY_URL) { _wxCache = _wxSampleData(); _wxAt = now; return _wxCache; }
    _wxInflight = (async () => {
      try {
        const r = await fetch(`${WEATHER_PROXY_URL}?lat=${WEATHER_LOCATION.lat}&lon=${WEATHER_LOCATION.lon}`);
        if (!r.ok) throw new Error("weather " + r.status);
        const j = await r.json();
        const hist = (j.history || []).map((h) => ({ t: new Date(h.t).getTime(), tempC: _wxNum(h.tempC), humidity: _wxNum(h.humidity), condition: h.condition || null }))
          .filter((h) => !isNaN(h.t)).sort((a, b) => a.t - b.t);
        const merged = _wxMerge(hist); // rolling multi-day store (no extra API calls)
        const data = { location: j.location || WEATHER_LOCATION, history: merged.length ? merged : hist, current: hist.length ? hist[hist.length - 1] : (merged.length ? merged[merged.length - 1] : null), cachedAt: j.cachedAt || null, sample: false };
        _wxCache = data; _wxAt = now; return data;
      } catch { _wxCache = _wxSampleData(); _wxAt = now; return _wxCache; }
      finally { _wxInflight = null; }
    })();
    return _wxInflight;
  },
};
// Pearson correlation of two equal-length numeric arrays (null if <3 points or flat).
export function iotPearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const x = xs[i], y = ys[i]; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const cov = sxy - (sx * sy) / n, vx = sxx - (sx * sx) / n, vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}
// Join each reading to its nearest weather hour, then correlate outdoor temp vs
// water temp / TDS / pH. Returns the r's + a paired series for the overlay chart.
export function iotWeatherCorrelate(chrono, weatherHours) {
  if (!weatherHours || weatherHours.length < 3 || !chrono || chrono.length < 3) return null;
  const wh = [...weatherHours].sort((a, b) => a.t - b.t);
  const minW = wh[0].t - 3600000, maxW = wh[wh.length - 1].t + 3600000; // only correlate where weather exists
  const nearest = (ms) => { let best = wh[0], bd = Infinity; for (const w of wh) { const d = Math.abs(w.t - ms); if (d < bd) { bd = d; best = w; } } return best; };
  const oor = (b) => b === "amber" || b === "red";
  const rows = [];
  for (const it of chrono) {
    const ms = new Date(it.timestamp).getTime(); if (isNaN(ms) || ms < minW || ms > maxW) continue;
    const w = nearest(ms); if (!w || w.tempC == null) continue;
    rows.push({ t: ms, out: w.tempC, wtemp: iotWqNum(it.waterQuality?.temp), tds: iotWqNum(it.waterQuality?.tds), ph: iotWqNum(it.waterQuality?.ph), tank: iotTank(it.tankLevel).pct });
  }
  if (rows.length < 3) return null;
  const pick = (k) => { const xs = [], ys = []; rows.forEach((r) => { if (r.out != null && r[k] != null && r[k] > 0) { xs.push(r.out); ys.push(r[k]); } }); return { xs, ys }; };
  const t = pick("wtemp"), d = pick("tds"), p = pick("ph");
  return {
    n: rows.length,
    rTemp: iotPearson(t.xs, t.ys), rTds: iotPearson(d.xs, d.ys), rPh: iotPearson(p.xs, p.ys),
    joined: rows.map((r) => ({
      t: r.t, out: r.out, wtemp: r.wtemp, tds: r.tds, ph: r.ph, tank: r.tank,
      oorTemp: r.wtemp != null && oor(iotWqClass("temp", r.wtemp)),
      oorTds: r.tds != null && oor(iotWqClass("tds", r.tds)),
      oorPh: r.ph != null && oor(iotWqClass("ph", r.ph)),
      oorTank: r.tank != null && iotTankBand(r.tank) !== "green",
      // Likely a perceptible TASTE issue = a combination of any: hard/flat TDS,
      // off-neutral pH, or warm water. Flashed on the graph.
      taste: (r.tds != null && (r.tds > 300 || r.tds < 50)) || (r.ph != null && (r.ph < 6.5 || r.ph > 8.5)) || (r.wtemp != null && r.wtemp > 30),
    })),
  };
}
// Plain-English read of the correlation for a business/data/user audience —
// "the weather did X, so the water did Y". Deterministic, no LLM.
export function iotWeatherNarrative(wxCorr, weather, chrono) {
  if (!wxCorr) return null;
  const temps = (weather?.history || []).map((h) => h.tempC).filter((v) => v != null);
  const oMin = temps.length ? Math.min(...temps) : null, oMax = temps.length ? Math.max(...temps) : null;
  const conds = {}; (weather?.history || []).forEach((h) => { if (h.condition) conds[h.condition] = (conds[h.condition] || 0) + 1; });
  const domCond = Object.keys(conds).sort((a, b) => conds[b] - conds[a])[0] || null;
  const strength = (r) => { if (r == null) return { lvl: "none", dir: null }; const a = Math.abs(r); return { lvl: a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.2 ? "weak" : "none", dir: r > 0 ? "up" : "down" }; };
  const sTemp = strength(wxCorr.rTemp), sTds = strength(wxCorr.rTds), sPh = strength(wxCorr.rPh);
  const items = [
    { emoji: "🌡️", label: "Water temperature", lvl: sTemp.lvl, text:
      sTemp.lvl === "strong" ? "Closely followed the outside air — as it warmed or cooled outdoors, the tank water did the same. Expected: the tank sits in ambient heat."
      : sTemp.lvl === "moderate" ? "Partly followed the outside air — some of the tank's warming/cooling is coming from the weather."
      : "Barely moved with the outside air over this window." },
    { emoji: "💧", label: "TDS", lvl: sTds.lvl, text:
      sTds.lvl === "none" ? "Stayed independent of the weather — its changes come from the source water / RO, not outdoors."
      : (sTds.dir === "down" ? "Drifted the opposite way to temperature" : "Rose and fell with temperature") + ` (${sTds.lvl} link). Part real — heat concentrates minerals through evaporation — and part sensor physics — TDS readings shift with water temperature. Worth watching, not alarming.` },
    { emoji: "⚗️", label: "pH", lvl: sPh.lvl, text:
      (sPh.lvl === "none" || sPh.lvl === "weak") ? "Essentially unaffected by the weather — pH changes point to the water chemistry or the RO, not outdoor conditions."
      : `Shifted with the weather more than usual (${sPh.lvl} link) — worth a check.` },
  ];
  const wx = oMin != null ? `${domCond ? domCond + ", " : ""}${Math.round(oMin)}–${Math.round(oMax)} °C outdoors` : "the outdoor weather";
  const headline = sTemp.lvl === "strong" || sTemp.lvl === "moderate"
    ? `Over the last ~24 h (${wx}), the tank's water temperature moved with the weather; TDS ${sTds.lvl === "none" ? "stayed steady" : "drifted (" + sTds.lvl + ")"}, and pH was ${(sPh.lvl === "none" || sPh.lvl === "weak") ? "unaffected" : "affected"}.`
    : `Over the last ~24 h (${wx}), the weather had little measurable effect on the water metrics.`;
  const footer = `Based on ${wxCorr.n} readings over ~24 h — indicative, not conclusive, and correlation isn't proof of cause. It firms up as more days accumulate.`;
  // ---- What residents would notice, and impact on the in-flat purifiers.
  // Sensors are on the building's CENTRAL RO — its output feeds each flat's own
  // point-of-use purifier, so central water quality sets the load on those.
  const med = (arr) => { const a = arr.filter((v) => v != null && !isNaN(v) && v > 0).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
  const tdsMed = med(chrono.map((it) => iotWqNum(it.waterQuality?.tds)));
  const phMed = med(chrono.map((it) => iotWqNum(it.waterQuality?.ph)));
  const tempMed = med(chrono.map((it) => iotWqNum(it.waterQuality?.temp)));
  let customer = null;
  if (tdsMed != null) {
    const base = tdsMed < 50 ? "may taste a little flat (low in minerals)" : tdsMed <= 150 ? "should taste clean and neutral" : tdsMed <= 300 ? "will taste fine — a touch more mineral, still good" : "may taste noticeably mineral or hard";
    const extra = [];
    if (phMed != null && phMed < 6.5) extra.push("a mild sour edge (slightly acidic)");
    if (phMed != null && phMed > 8.5) extra.push("a faint soapy/bitter edge (slightly alkaline)");
    if (tempMed != null && tempMed > 28) extra.push("water feels warm at the tap");
    else if (tempMed != null && tempMed > 25) extra.push("water may feel a bit lukewarm");
    const taste = `Residents' tap water ${base}${extra.length ? ", with " + extra.join(" and ") : ""}. (Central RO now ~${Math.round(tdsMed)} mg/L TDS, pH ${phMed != null ? phMed.toFixed(1) : "—"}, ~${tempMed != null ? Math.round(tempMed) : "—"} °C.)`;
    const highLoad = (tdsMed > 300) || (tempMed != null && tempMed > 28);
    const midLoad = (tdsMed > 150) || (tempMed != null && tempMed > 25);
    const purifiers = highLoad
      ? "The in-flat purifiers are getting harder / warmer water from the central RO, so their membranes and filters work harder — expect faster wear and more frequent servicing."
      : midLoad
        ? "The in-flat purifiers receive moderately mineralised water — a normal load; keep servicing on the usual schedule."
        : "The central RO already delivers soft, clean water, so the in-flat purifiers see a light load and their filters/membranes should last longer.";
    customer = { taste, purifiers };
  }
  return { headline, items, footer, customer };
}
export const iotTimeAgo = (ts) => { if (!ts) return "Unknown"; const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; return `${Math.floor(s / 3600)}h ago`; };
// Liveness window in seconds. junctionBox units heartbeat fast (120s); RO-tank
// units report roughly every 20 minutes, so they get a much wider window.
export const IOT_TANK_ONLINE_SECS = 25 * 60; // 25 min (tolerates a missed ~20-min report)
export const iotOnline = (ts, win = 120) => !!ts && (Date.now() - new Date(ts).getTime()) / 1000 < win;
export const iotClock = (ts) => ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
export const iotStamp = (ts) => ts ? new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
export const iotVol = (v) => (v == null || v === "") ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
// Rounded litres with unit for tables — 152.48 → "152 L".
export const iotVolL = (v) => (v == null || v === "") ? "—" : `${Math.round(Number(v)).toLocaleString("en-IN")} L`;

/* ---- 12-hour consumption buckets (IST) from a /devices/history?days=2 payload.
   Litres consumed = SUM of positive increases in the cumulative totalVolumeLitres
   meter (survives the occasional meter reset/dip, which last−first would mis-count).
   Blocks are IST calendar half-days: 00:00–12:00 and 12:00–24:00. ---- */
export const IST_OFFSET_MS = 5.5 * 3600000;
export const IOT_MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const istBlockOf = (ms) => {
  const d = new Date(ms + IST_OFFSET_MS); // shift into IST, then read UTC fields
  const half = d.getUTCHours() < 12 ? 0 : 1;
  return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${half}`,
    y: d.getUTCFullYear(), mo: d.getUTCMonth(), day: d.getUTCDate(), half,
    label: `${String(d.getUTCDate()).padStart(2, "0")} ${IOT_MON3[d.getUTCMonth()]} · ${half ? "12:00–24:00" : "00:00–12:00"}` };
};
export function iotBuckets12h(payload) {
  const items = Array.isArray(payload) ? payload : (payload?.items || []);
  const recs = items
    .map(it => ({ t: new Date(it.timestamp).getTime(), chs: it.payload?.units?.[0]?.channels || [] }))
    .filter(r => !isNaN(r.t))
    .sort((a, b) => a.t - b.t);
  if (recs.length < 2) return null;
  const chanIds = Array.from(new Set(recs.flatMap(r => r.chs.map(c => c.channelId)))).sort();
  const volOf = (r, id) => { const c = r.chs.find(x => x.channelId === id); return c == null ? null : Number(c.totalVolumeLitres); };
  const blocks = {};
  for (let i = 1; i < recs.length; i++) {
    const b = istBlockOf(recs[i].t);
    const bk = blocks[b.key] || (blocks[b.key] = { b, byChan: Object.fromEntries(chanIds.map(id => [id, 0])) });
    chanIds.forEach(id => {
      const prev = volOf(recs[i - 1], id), cur = volOf(recs[i], id);
      if (prev != null && cur != null) bk.byChan[id] += Math.max(0, cur - prev); // clamp resets
    });
  }
  const rows = Object.values(blocks).sort((a, b) =>
    (a.b.y - b.b.y) || (a.b.mo - b.b.mo) || (a.b.day - b.b.day) || (a.b.half - b.b.half));
  const totals = Object.fromEntries(chanIds.map(id => [id, rows.reduce((s, r) => s + r.byChan[id], 0)]));
  const grand = chanIds.reduce((s, id) => s + totals[id], 0);
  const spanH = (recs[recs.length - 1].t - recs[0].t) / 3600000;
  const days = spanH / 24;
  const dailyAvg = Object.fromEntries(chanIds.map(id => [id, days > 0 ? totals[id] / days : 0]));
  return { chanIds, rows, totals, grand, spanH, days, dailyAvg, from: recs[0].t, to: recs[recs.length - 1].t };
}
// Newest heartbeat wins: /devices/status serves a cached (often day-old) snapshot,
// so liveness + last-seen are driven off the freshest /devices/history record.
export const iotMergeLatest = (statusDev, historyList) => {
  const latest = Array.isArray(historyList) ? historyList[0] : null; // history is newest-first
  return latest ? { ...statusDev, ...latest } : statusDev;
};

/* ---- Tank level + water quality (RO-tank heartbeat schema) -----------------
   Tank devices report four discrete float switches (level25/50/75/100 = probe
   wet?) plus a waterQuality block { ph, tds, temp }. junctionBox devices don't
   carry these (they report payload.units[].channels instead), so the detail
   view branches on iotIsTank(). Data source: /devices/history?deviceId=…&days=1
   which returns { items:[ { tankLevel, waterQuality, timestamp, … } ] }. */
export const iotIsTank = (d) => !!(d && (d.tankLevel || d.waterQuality || d.deviceType === "RO Tank" || IOT_KNOWN_TANK_DEVICES.includes(d.deviceId)));
// Device-aware liveness: RO-tank units report ~every 20 min, so they use the wider window.
export const iotOnlineFor = (d) => iotOnline(d?.timestamp, iotIsTank(d) ? IOT_TANK_ONLINE_SECS : 120);
// Known RO-tank devices to always keep in the roster + poll history for, even
// if the current /devices/status snapshot happens not to list them.
export const IOT_KNOWN_TANK_DEVICES = ["E05A1B9C2DD4"];
export const IOT_TANK_STEPS = [
  { key: "level100", pct: 100, label: "Full",     tag: "100%" },
  { key: "level75",  pct: 75,  label: "3/4 full", tag: "75%"  },
  { key: "level50",  pct: 50,  label: "1/2 full", tag: "50%"  },
  { key: "level25",  pct: 25,  label: "1/4 full", tag: "25%"  },
];
export const iotSwitchOn = (v) => Number(v) > 0;
// Fill % = the highest float switch currently wet. Sensors returned low→high.
export function iotTank(tankLevel) {
  const t = tankLevel || {};
  const step = IOT_TANK_STEPS.find((s) => iotSwitchOn(t[s.key]));
  const sensors = [...IOT_TANK_STEPS].reverse().map((s) => ({ tag: s.tag, on: iotSwitchOn(t[s.key]) }));
  return { pct: step ? step.pct : 0, label: step ? step.label : "Empty", sensors, has: !!tankLevel };
}
// Ideal operating bands — not in the feed; standard potable-water ranges.
// Pressure/flow are shown for CONTEXT only, not as a pass/fail band (see the
// "confirmed not an anomaly" note on iotWqClass below) — [0,4]/[0,3] here are
// just the typical reading while the pump runs, not an enforced ceiling.
export const IOT_WQ_IDEAL = { ph: [6.5, 8.5], tds: [50, 300], temp: [15, 25], pressure: [0, 4], flowMLPM: [0, 3] };
export const IOT_WQ_META = {
  ph:       { label: "pH Level",    unit: "",     icon: FlaskConical, dp: 1 },
  tds:      { label: "TDS",         unit: "mg/L", icon: Droplets,     dp: 0 },
  temp:     { label: "Temperature", unit: "°C",   icon: Thermometer,  dp: 1 },
  pressure: { label: "Pressure",    unit: "bar",  icon: Gauge,        dp: 2 },
  flowMLPM: { label: "Flow rate",   unit: "L/min",icon: Waves,        dp: 2 },
};
// waterQuality values arrive as { value, unit } (value is sometimes a string).
export const iotWqNum = (m) => { if (m == null) return null; const n = Number(typeof m === "object" ? m.value : m); return isNaN(n) ? null : n; };
// min / max / latest for ph, tds, temp, pressure, flowMLPM across a window of
// heartbeats (newest-first). Non-positive pH/TDS/temp readings are dropped as
// sensor dropouts (never ~0 for real water); pressure/flow keep a legitimate 0
// (idle) but still drop negatives (sensor glitch).
export const IOT_WQ_DROP_ZERO = { ph: true, tds: true, temp: true, pressure: false, flowMLPM: false };
export function iotWqRange(items) {
  const out = {};
  Object.keys(IOT_WQ_META).forEach((k) => {
    const dropZero = IOT_WQ_DROP_ZERO[k];
    const vals = (items || []).map((it) => iotWqNum(it?.waterQuality?.[k])).filter((v) => v != null && (dropZero ? v > 0 : v >= 0));
    // Moving average of the 10 most recent readings (v2.29.118) — items arrive
    // newest-first, so vals[0] is latest and the first 10 entries are the window.
    // Only ph/tds actually display this (see IoTWaterQualityCard); computed for
    // every metric here since it's cheap and harmless for the others.
    const last10 = vals.slice(0, 10);
    const movingAvg = last10.length ? last10.reduce((s, v) => s + v, 0) / last10.length : null;
    out[k] = vals.length ? { min: Math.min(...vals), max: Math.max(...vals), latest: vals[0], n: vals.length, movingAvg, movingAvgN: last10.length } : null;
  });
  return out;
}
// Shared date-range filter — same options power the Trend analysis / Recent
// readings chips AND the Total Dispensed stat, so picking a period in one
// place is meaningful everywhere dates are sliced. "week" stays a rolling
// last-7-days window (pre-existing Trend analysis semantics), while "month" /
// "lastMonth" are real calendar months. Needs `items` with real ISO
// `timestamp` fields (newest- or oldest-first, order doesn't matter here).
export const IOT_RANGE_OPTIONS = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]];
export function iotFilterByRange(items, range) {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startToday = startOfToday.getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  return (items || []).filter((it) => {
    const t = new Date(it.timestamp).getTime();
    if (isNaN(t)) return false;
    if (range === "today") return t >= startToday;
    if (range === "yesterday") return t >= startToday - 86400000 && t < startToday;
    if (range === "month") return t >= startOfMonth;
    if (range === "lastMonth") return t >= startOfLastMonth && t < startOfMonth;
    return t >= startToday - 6 * 86400000; // "week" (default) = rolling last 7 days
  });
}
// totalDispensed is a lifetime, monotonically-increasing counter (not a banded
// quality metric) — the latest reading is the all-time total; the window delta
// is latest − oldest in the given (newest-first) window, clamped ≥0 in case a
// device reset the counter. avgPerDay normalises that delta by the window's
// actual time span (the feed is a downsampled ~1–2 day window, not exactly a
// day), so "this window" and "average/day" read as different, useful numbers
// instead of near-duplicates. Needs ≥30 min of span to avoid a wild
// division-by-a-sliver-of-time estimate right after the page loads.
export function iotDispensedRange(items) {
  const rows = (items || [])
    .map((it) => ({ v: iotWqNum(it?.waterQuality?.totalDispensed), t: new Date(it.timestamp).getTime() }))
    .filter((r) => r.v != null && r.v >= 0 && !isNaN(r.t));
  if (!rows.length) return null;
  const latest = rows[0], oldest = rows[rows.length - 1]; // newest-first
  const windowDelta = Math.max(0, latest.v - oldest.v);
  const spanMs = Math.max(0, latest.t - oldest.t);
  const avgPerDay = spanMs >= 30 * 60000 ? windowDelta / (spanMs / 86400000) : null;
  return { total: latest.v, windowDelta, avgPerDay };
}
// Precise 3-tier water-quality classification (ProWater thresholds).
//   pH       green 6.5–8.5 · amber 6.0–6.4 / 8.6–9.0 · red <6.0 / >9.0
//   TDS      green 50–300  · amber 301–500          · red <50 / >500   (mg/L)
//   Temp     green 15–25   · amber 10–14.9 / 25.1–32 · red <10 / >32    (°C)
//
// Pressure/flow are pump-driven, not water-quality metrics: 0 while the pump
// is off (no tap open — the sensor simply has nothing to read), and whatever
// the line reads once the pump kicks on, at any magnitude. Confirmed with
// the person who placed these sensors: NEITHER end of that range is a real
// anomaly — a 655 bar spike or a 0 reading are both just pump-cycling
// artifacts of how this sensor is placed, not a fault. So unlike pH/TDS/
// temp, pressure/flow never rate amber/red here — they're informational
// only. If a real vendor spec for safe operating limits ever shows up,
// reinstate a banded check for these two; don't just copy the old
// >4/>3-bar-or-L/min thresholds back in, they were an assumption, not a spec.
export function iotWqClass(k, v) {
  if (v == null) return "na";
  if (k === "ph")       return (v < 6.0 || v > 9.0) ? "red" : (v < 6.5 || v > 8.5) ? "amber" : "green";
  if (k === "tds")      return (v < 50 || v > 500)  ? "red" : (v > 300)            ? "amber" : "green";
  if (k === "temp")     return (v < 10 || v > 32)   ? "red" : (v < 15 || v > 25)   ? "amber" : "green";
  if (k === "pressure" || k === "flowMLPM") return "green";
  return "na";
}
// Worst band touched by a min–max range (endpoints suffice for contiguous bands).
export function iotWqBand(range, k) {
  if (!range) return "na";
  const a = iotWqClass(k, range.min), b = iotWqClass(k, range.max);
  return (a === "red" || b === "red") ? "red" : (a === "amber" || b === "amber") ? "amber" : "green";
}
export const IOT_CARD = { background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
// RAG badge palette for water-quality status.
export const IOT_RAG = {
  green: { color: "#11883e", bg: "#dff5d8", label: "GOOD" },
  amber: { color: "#a86e00", bg: "#ffedbd", label: "WARNING" },
  red:   { color: "#b91c1c", bg: "#fee2e2", label: "CRITICAL" },
  na:    { color: "#8b9a95", bg: "#eef1ee", label: "—" },
};
// Transparent Sintex-style water storage tank (needs pseudo-elements + keyframes,
// so it lives in a stylesheet rather than inline styles). Classes are pw- prefixed to
// avoid collisions. Structure: a dark screw lid + moulded neck sit above a see-through
// shell; the blue water block fills the shell from the bottom to --level with two moving
// wave layers on the surface. The scale and the shell are the same height and top-aligned,
// so 0-100% line up. Also holds the live/dead ECG styles for the Online/Offline KPIs.
// Refill detection: the RO tank pings its level every ~10 min. Within the recent
// window (~65 min of pings) if the level stepped UP — latest reading higher than
// the earliest in the window — the tank is actively refilling, which drives the
// pump + pipe + flowing-water animation on the tank graphic.
export function iotTankRefilling(chrono) {
  if (!Array.isArray(chrono) || chrono.length < 2) return false;
  const anchor = new Date(chrono[chrono.length - 1].timestamp).getTime();
  if (!anchor) return false;
  const win = chrono.filter((it) => { const t = new Date(it.timestamp).getTime(); return t && anchor - t <= 65 * 60 * 1000; });
  if (win.length < 2) return false;
  const pcts = win.map((it) => iotTank(it.tankLevel).pct).filter((p) => p != null);
  if (pcts.length < 2) return false;
  return pcts[pcts.length - 1] > pcts[0];
}

// Warming detection: warm water steams. The tank shows rising vapour whenever the
// latest water temp is above the ideal band (> 25 °C — the Warning/Hot zone), OR
// when it's trending up into that zone (rising and already >= 24 °C). Read from the
// most recent temp in the ~65-min window so a stale hot reading doesn't linger.
export function iotTempWarming(chrono) {
  if (!Array.isArray(chrono) || !chrono.length) return false;
  const anchor = new Date(chrono[chrono.length - 1].timestamp).getTime();
  if (!anchor) return false;
  const win = chrono.filter((it) => { const t = new Date(it.timestamp).getTime(); return t && anchor - t <= 65 * 60 * 1000; });
  const temps = win.map((it) => iotWqNum(it.waterQuality?.temp)).filter((v) => v != null);
  if (!temps.length) return false;
  const first = temps[0], last = temps[temps.length - 1];
  return last > 25 || (last > first + 0.2 && last >= 24);
}

export const IOT_TANK_CSS = `
.pw-tank-layout{display:grid;grid-template-columns:minmax(180px,1fr) 140px;align-items:center;min-height:250px;gap:6px;margin-top:2px}
.pw-tank-visual{position:relative;display:flex;align-items:center;justify-content:center;gap:14px;padding:4px}
.pw-tank-scale{display:flex;flex-direction:column;justify-content:space-between;height:170px;font-size:10px;font-weight:700;color:var(--muted);text-align:right}
.pw-tank{position:relative;width:130px;display:flex;flex-direction:column;align-items:center}
.pw-tank-lid{width:70px;height:10px;background:linear-gradient(90deg,#1e293b,#334155,#1e293b);border-radius:5px 5px 0 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.pw-tank-neck{width:50px;height:6px;background:#334155}
.pw-tank-shell{position:relative;width:125px;height:165px;border-radius:16px 16px 20px 20px;border:3px solid rgba(2,132,199,.4);background:rgba(240,249,255,.6);backdrop-filter:blur(4px);overflow:hidden;box-shadow:inset 0 0 15px rgba(2,132,199,.1),0 8px 24px rgba(0,0,0,.06)}
.pw-water{position:absolute;bottom:0;left:0;right:0;height:var(--level,100%);background:linear-gradient(180deg,rgba(56,189,248,.75) 0%,rgba(2,132,199,.9) 100%);transition:height .8s ease-in-out;overflow:hidden}
.pw-wave{position:absolute;top:-10px;left:0;width:200%;height:18px}
.pw-wave.wave-a{background:radial-gradient(circle at 50% 0,transparent 60%,rgba(255,255,255,.5) 61%);background-size:40px 20px;animation:pwWaveMove 3s linear infinite;opacity:.7}
.pw-wave.wave-b{top:-8px;background:radial-gradient(circle at 50% 0,transparent 60%,rgba(56,189,248,.8) 61%);background-size:32px 16px;animation:pwWaveMoveReverse 4s linear infinite;opacity:.9}
@keyframes pwWaveMove{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes pwWaveMoveReverse{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}
.pw-bubble{position:absolute;bottom:-10px;background:rgba(255,255,255,.6);border-radius:50%;animation:pwBubbleRise linear infinite}
@keyframes pwBubbleRise{0%{transform:translateY(0) scale(.8);opacity:.8}100%{transform:translateY(-170px) scale(1.2);opacity:0}}
.pw-tank-shine{position:absolute;top:0;left:10px;width:10px;height:100%;background:linear-gradient(90deg,rgba(255,255,255,.4),transparent);pointer-events:none;z-index:5}
.pw-band{position:absolute;left:0;right:0;height:2px;background:rgba(2,132,199,.2);pointer-events:none;z-index:4}
.pw-band.band-1{top:25%}
.pw-band.band-2{top:50%}
.pw-band.band-3{top:75%}
.pw-tank-brand{margin-top:6px;font-size:11px;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:4px}
.pw-tank-base{width:90px;height:8px;background:linear-gradient(90deg,#1e293b,#475569,#1e293b);border-radius:0 0 4px 4px;margin-top:2px}
.pw-tank-photo{position:relative;width:100%;max-width:220px;flex:none}
.pw-tank-photo img{width:100%;height:auto;display:block}
.iot-ecg{position:absolute;inset:0;overflow:hidden;pointer-events:none;display:flex;align-items:center;-webkit-mask-image:linear-gradient(90deg,transparent 0,transparent 46%,#000 60%,#000 84%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,transparent 46%,#000 60%,#000 84%,transparent 100%)}
.iot-ecg-track{display:flex;width:200%;height:52px;animation:iotEcgScroll 3s linear infinite}
.iot-ecg.dead .iot-ecg-track{animation-duration:6.5s}
.iot-ecg-seg{width:50%;height:100%;flex:none}
.iot-ecg.alive .iot-ecg-seg{filter:drop-shadow(0 0 5px rgba(30, 158, 79,.5))}
.iot-ecg.dead .iot-ecg-seg{filter:drop-shadow(0 0 4px rgba(220,65,65,.38));opacity:.8}
@keyframes iotEcgScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.pw-refill-tag{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:8;display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.02em;color:#0a6f8f;background:#e2f4fb;border:1px solid #b9e3f2;box-shadow:0 3px 8px rgba(10,111,143,.16)}
.pw-refill-tag::before{content:"";width:7px;height:7px;border-radius:50%;background:#0a9dd4;animation:pwRefillBlink 1s ease-in-out infinite}
@keyframes pwRefillBlink{0%,100%{opacity:.35;transform:scale(.82)}50%{opacity:1;transform:scale(1)}}
.pw-warm-tag{position:absolute;right:10px;top:10px;z-index:8;display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.02em;color:#a8480a;background:#fdeede;border:1px solid #f4cfa4;box-shadow:0 3px 8px rgba(168,72,10,.16)}
.pw-warm-tag::before{content:"";width:7px;height:7px;border-radius:50%;background:#e8791a;animation:pwRefillBlink 1.1s ease-in-out infinite}
@media(max-width:1400px){.pw-tank-layout{grid-template-columns:1fr!important;justify-items:center}}
@media(max-width:1150px){.iot-monitor-grid{grid-template-columns:1fr!important}}
@media(prefers-reduced-motion:reduce){.iot-ecg-track{animation:none!important}.pw-refill-tag::before,.pw-warm-tag::before{animation:none!important}}
`;
export const ValveBadge = ({ state }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#fff", background: state === "OPEN" ? "#08805A" : "#DC4141" }}>{state ?? "—"}</span>
);


export const IOT_FLOW_COLORS = ["#0B6F52", "#1E9E4F", "#2A86D6", "#986315", "#2A86D6", "#DC4141"];

export function IoTWave({ kind, color, opacity = 0.5 }) {
  if (kind === "bars") {
    const hs = [5, 7, 6, 9, 7, 11, 8, 13, 7, 10, 6, 12, 9, 15, 8, 11, 7, 14, 10, 17, 11, 13];
    return (
      <div aria-hidden style={{ position: "absolute", right: 14, bottom: 14, display: "flex", alignItems: "flex-end", gap: 2, opacity, pointerEvents: "none", height: 44 }}>
        {hs.map((v, i) => <span key={i} style={{ width: 3, height: v * 2.2, borderRadius: 2, background: color }} />)}
      </div>
    );
  }
  const d = kind === "ecg"
    ? "M0 70 H66 l6 0 l6 -9 l6 9 l10 0 l5 10 l6 -48 l6 62 l5 -25 l8 0 l8 -13 l8 13 H240"
    : "M0 64 Q24 64 40 46 Q58 26 82 50 Q106 74 130 58 Q152 42 176 58 Q206 82 240 62";
  return (
    <svg aria-hidden viewBox="0 0 240 120" preserveAspectRatio="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "72%", opacity, pointerEvents: "none" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const IOT_TANK_PHOTOS = {
  0: `${import.meta.env.BASE_URL}tank/empty.png`,
  25: `${import.meta.env.BASE_URL}tank/25.png`,
  50: `${import.meta.env.BASE_URL}tank/50.png`,
  75: `${import.meta.env.BASE_URL}tank/75.png`,
  100: `${import.meta.env.BASE_URL}tank/75.png`,
};

export function IoTTank({ pct = 0, refilling = false, warming = false }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="pw-tank-visual" aria-hidden="true">
      <div className="pw-tank-scale">
        <span>100%</span>
        <span>75%</span>
        <span>50%</span>
        <span>25%</span>
        <span>0%</span>
      </div>
      <div className="pw-tank" style={{ "--level": `${p}%` }}>
        <div className="pw-tank-lid"></div>
        <div className="pw-tank-neck"></div>
        <div className="pw-tank-shell">
          <div className="pw-water">
            <div className="pw-wave wave-a"></div>
            <div className="pw-wave wave-b"></div>
            <span className="pw-bubble" style={{ left: "22%", width: 6, height: 6, animationDuration: "3.4s", animationDelay: "0s" }}></span>
            <span className="pw-bubble" style={{ left: "40%", width: 4, height: 4, animationDuration: "2.8s", animationDelay: "1.1s" }}></span>
            <span className="pw-bubble" style={{ left: "55%", width: 7, height: 7, animationDuration: "4.2s", animationDelay: "0.6s" }}></span>
            <span className="pw-bubble" style={{ left: "68%", width: 5, height: 5, animationDuration: "3.1s", animationDelay: "1.8s" }}></span>
            <span className="pw-bubble" style={{ left: "33%", width: 3, height: 3, animationDuration: "2.4s", animationDelay: "2.2s" }}></span>
            <span className="pw-bubble" style={{ left: "62%", width: 4, height: 4, animationDuration: "3.7s", animationDelay: "0.3s" }}></span>
          </div>
          <div className="pw-tank-shine"></div>
          <div className="pw-band band-1"></div>
          <div className="pw-band band-2"></div>
          <div className="pw-band band-3"></div>
        </div>
        <div className="pw-tank-brand">
          <Droplets size={14} color="#12b981" style={{ opacity: 0.8 }} /> ProWater
        </div>
        <div className="pw-tank-base"></div>
      </div>
    </div>
  );
}

export function IoTTankPanel({ device, tank, refilling = false, warming = false, dispensed, range, setRange }) {
  const meta = [device.roUnitId, device.deviceType].filter(Boolean).join(" · ") || "RO Tank sensor";
  const fw = device.firmwareVersion || device.FIRMWARE_VERSION || "1.0.9";
  const periodLabel = IOT_RANGE_LABEL[range] || "this period";
  const pct = Math.max(0, Math.min(100, tank.pct ?? 0));

  return (
    <div style={{
      ...IOT_CARD,
      position: "relative",
      overflow: "hidden",
      padding: "16px 20px",
      maxWidth: 620,
      width: "100%",
      background: "radial-gradient(circle at 52% 35%, rgba(185, 233, 219, 0.27), transparent 45%), linear-gradient(rgb(255, 255, 255), rgb(248, 252, 250))"
    }}>
      {warming && !refilling && <span className="pw-warm-tag" style={{ top: 16, right: 18 }}>Warming</span>}
      {refilling && <span className="pw-refill-tag" style={{ top: 16, right: 18 }}>Refilling</span>}
      <h2 className="serif" style={{ fontSize: 18, fontWeight: 750, color: "var(--f)", lineHeight: 1.1 }}>{device.deviceId}</h2>
      <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>{meta} · Firmware {fw}</div>

      <div className="pw-tank-layout" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 140px", alignItems: "center", minHeight: 250, gap: 6, marginTop: 2 }}>
        <IoTTank pct={pct} refilling={refilling} warming={warming} />

        <div style={{ alignSelf: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--f)" }}>Tank Level</div>
          <div className="serif" style={{ marginTop: 5, fontSize: 48, fontWeight: 780, letterSpacing: "-0.05em", color: "var(--f)", lineHeight: 1 }}>{pct}%</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>({tank.label || (pct >= 100 ? "Full" : pct >= 50 ? "Half Full" : "Low")})</div>
          <div style={{ display: "grid", gap: 9, marginTop: 22 }}>
            {tank.sensors.map((s) => (
              <div key={s.tag} style={{ display: "grid", gridTemplateColumns: "9px 42px auto", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 650 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.on ? "rgb(5, 169, 122)" : "#b9c3bf" }}></span>
                <span style={{ color: "var(--f)", fontWeight: 700 }}>{s.tag}</span>
                <span style={{ color: s.on ? "rgb(0, 125, 89)" : "var(--muted)", fontWeight: 700 }}>{s.on ? "ON" : "OFF"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {pct <= 25 && (
        <div style={{ marginTop: 10, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "#FBE4E4", border: "1px solid #F1B7B7", color: "#DC4141", fontWeight: 800, fontSize: 12.5 }}>
          <AlertCircle size={15} /> SWITCH ON the pump to refill.
        </div>
      )}

      {/* Clubbed Total & Average Dispensed Summary Strip */}
      <div style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
          <IoTRangeChips range={range} setRange={setRange} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          {/* Left Aligned: Total Dispensed */}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Total dispensed</div>
            {!dispensed ? (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>No data for {periodLabel}.</div>
            ) : (
              <>
                <div className="serif" style={{ fontSize: 28, fontWeight: 800, color: "var(--f)", marginTop: 3, lineHeight: 1 }}>
                  {dispensed.total.toFixed(2)} <span style={{ fontSize: 15, fontWeight: 700, color: "var(--muted)" }}>L</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>as of {periodLabel}</div>
              </>
            )}
          </div>

          {/* Right Aligned: Average Dispensed */}
          {dispensed && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Average dispensed</div>
              <div className="serif" style={{ fontSize: 24, fontWeight: 800, color: "var(--f)", marginTop: 3, lineHeight: 1 }}>
                {dispensed.avgPerDay == null ? "—" : `${dispensed.avgPerDay.toFixed(2)} L/day`}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{periodLabel}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Junction Box Product Panel — displays Junction Box photo + unit info + line pressure & relays
export function IoTJunctionBoxPanel({ device, channels }) {
  const fw = device.firmwareVersion || device.FIRMWARE_VERSION || "1.0.10";
  const meta = [device.roUnitId, device.deviceType].filter(Boolean).join(" · ") || "RO Junction Box Unit";
  const isOnline = iotOnlineFor(device);
  return (
    <div style={{ ...IOT_CARD, position: "relative", overflow: "hidden", padding: "16px 20px", width: "100%", maxWidth: 520,
      background: "radial-gradient(circle at 50% 35%, rgba(42,134,214,.08), transparent 50%), linear-gradient(180deg,#fff,#f8fcfa)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 className="serif" style={{ fontSize: 18, fontWeight: 750, color: "var(--f)", margin: 0 }}>{device.deviceId}</h2>
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>{meta} · Firmware {fw}</div>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: isOnline ? "rgba(8,128,90,0.12)" : "rgba(220,38,38,0.12)", color: isOnline ? "#08805A" : "#DC4141" }}>
          ● {isOnline ? "Online" : "Offline"}
        </span>
      </div>

      {/* Product Image: Junction Box Blended Seamlessly */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "12px 0", minHeight: 190 }}>
        <img src={junctionBoxImg} alt="Junction Box" style={{ maxHeight: 180, width: "auto", objectFit: "contain", mixBlendMode: "multiply", opacity: 0.92, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.06))" }} />
      </div>

      {/* Junction Box Key Stats */}
      <div style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.07)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "rgba(8,128,90,0.06)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#86868B" }}>Input Line Pressure</div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 800, color: "#1D1D1F", marginTop: 2 }}>{device.payload?.inputPressure ?? 0} bar</div>
        </div>
        <div style={{ background: "rgba(42,134,214,0.06)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#86868B" }}>Last Heartbeat</div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 800, color: "#0284C7", marginTop: 2 }}>{iotTimeAgo(device.timestamp)}</div>
        </div>
      </div>
    </div>
  );
}

// Water Quality panel — a live min–max range vs the ideal band per metric, each
// with a Green/Amber/Red badge.
// Reused for both the potability card (pH/TDS/temp) and the RO-unit sensors
// card (pressure/flow) via the `keys`/`title`/`noun` props — same generic
// range/band scaffolding (IOT_WQ_META/IDEAL + iotWqClass), different metric set.
export function IoTWaterQualityCard({ range, keys = ["ph", "tds", "temp"], title = "Water Quality", subtitle = "Live sensor readings", noun = "Water quality", extra, style = {} }) {
  const fmt = (v, dp) => (v == null ? "—" : Number(v).toFixed(dp));
  const rows = keys.map((k) => {
    const band = iotWqBand(range[k], k);
    return { k, meta: IOT_WQ_META[k], r: range[k], ideal: IOT_WQ_IDEAL[k], band, rag: IOT_RAG[band] || IOT_RAG.na };
  });
  return (
    <div style={{ ...IOT_CARD, padding: "18px 20px", display: "flex", flexDirection: "column", ...style }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 720 }}>{title}</h3>
        <div style={{ fontSize: 12, color: "#8b9a95", marginTop: 3 }}>{subtitle}</div>
      </div>
      <div style={{ marginTop: 6 }}>
        {rows.map(({ k, meta, r, ideal, rag }, i) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "8px 30px minmax(70px,1fr) auto auto", gap: 11, alignItems: "center", minHeight: 60, borderTop: i ? "1px solid #edf1ef" : "none" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: rag.color }} />
            <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, color: "#007d59" }}><meta.icon size={19} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--f)" }}>{meta.label}</div>
              <div style={{ fontSize: 10.5, color: "#8b9a95", marginTop: 3 }}>
                {(k === "pressure" || k === "flowMLPM") ? "Pump off = 0, pump on = live reading — both normal"
                  : (k === "ph" || k === "tds") ? `Ideal: ${ideal[0]} – ${ideal[1]}${meta.unit ? ` ${meta.unit}` : ""} · avg of last ${r?.movingAvgN || 0}`
                  : `Ideal: ${ideal[0]} – ${ideal[1]}${meta.unit ? ` ${meta.unit}` : ""}`}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 13.5, fontWeight: 750, color: "var(--f)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {(k === "ph" || k === "tds")
                ? (r?.movingAvg != null ? fmt(r.movingAvg, meta.dp) : "—")
                : (r ? `${fmt(r.min, meta.dp)} – ${fmt(r.max, meta.dp)}` : "—")}
              {r && meta.unit ? ` ${meta.unit}` : ""}
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, fontSize: 10, fontWeight: 750, textTransform: "uppercase", color: rag.color, background: rag.bg }}>● {rag.label}</span>
          </div>
        ))}
      </div>
      {extra && <div style={{ marginTop: "auto", paddingTop: 13 }}>{extra}</div>}
    </div>
  );
}

// Reusable date-range chip row — Today / Yesterday / This Week / This Month /
// Last Month — shared by the Total Dispensed stat and Trend analysis / Recent
// readings (IOT_RANGE_OPTIONS + iotFilterByRange), so "period" means the same
// thing everywhere in the IoT module.
export function IoTRangeChips({ range, setRange }) {
  return (
    <>
      {IOT_RANGE_OPTIONS.map(([k, label]) => {
        const active = range === k;
        return (
          <button key={k} onClick={() => setRange(k)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid " + (active ? "var(--brand)" : "var(--border)"), background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--slate)" }}>{label}</button>
        );
      })}
    </>
  );
}
export const IOT_RANGE_LABEL = { today: "today", yesterday: "yesterday", week: "this week", month: "this month", lastMonth: "last month" };
// Dispense Summary — a standalone, prominent full-width hero card (visual
// redesign to match a user-provided mockup, v2.29.87): Total dispensed as a
// big headline number on the left, Average dispensed/day on the right, both
// scoped to the shared date-range filter (IOT_RANGE_OPTIONS/range, owned by
// the parent IoTDevices, same state Trend analysis / Recent readings read).
// The fuller mockup (v2.29.88) explicitly puts the range chips ON this card
// (above "Total dispensed"), so they live here too now — same shared state,
// just a second place to change it (Trend analysis/Recent readings keep
// their own copies, unchanged; picking a period in any one updates all).
// totalDispensed is a lifetime counter (not a banded quality metric), so
// this stays a plain running-total display, never RAG-coloured. Was
// previously a small inline block tucked inside the RO Unit Sensors card
// (`IoTDispensedStat`) — promoted to its own card per the mockup.
export function IoTDispenseSummaryCard({ dispensed, range, setRange }) {
  const periodLabel = IOT_RANGE_LABEL[range] || "this period";
  return (
    <div style={{ ...IOT_CARD, padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <IoTRangeChips range={range} setRange={setRange} />
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Total dispensed</div>
        {!dispensed ? (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>No dispensed-litres data for {periodLabel}.</div>
        ) : (
          <>
            <div className="serif" style={{ fontSize: 36, fontWeight: 800, color: "var(--f)", marginTop: 6, lineHeight: 1 }}>
              {dispensed.total.toFixed(2)} <span style={{ fontSize: 17, fontWeight: 700, color: "var(--muted)" }}>L</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>as of {periodLabel}</div>
          </>
        )}
      </div>
      {dispensed && (
        <div style={{ textAlign: "right", marginTop: 38 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Average dispensed</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--f)", marginTop: 6 }}>{dispensed.avgPerDay == null ? "—" : `${dispensed.avgPerDay.toFixed(2)} L/day`}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{periodLabel}</div>
        </div>
      )}
    </div>
  );
}

// Recent RO-tank readings — timestamp × (tank % · pH · TDS · temp), newest first.
// Cell styling for an out-of-range reading — green = normal, amber/red highlighted.
export const iotBandCell = (band) => band === "red" ? { color: "#DC4141", background: "#FBE8E8", fontWeight: 800 }
  : band === "amber" ? { color: "#a86e00", background: "#FBF0E0", fontWeight: 700 }
  : { color: "var(--f)" };
// Value-only emphasis (no cell fill): out-of-range values go bold, coloured and
// +1px so the eye catches them without a full amber/red block. (base td = 13.5px)
export const iotBandText = (band) => band === "red" ? { color: "#DC4141", fontWeight: 800, fontSize: 14.5 }
  : band === "amber" ? { color: "#a86e00", fontWeight: 800, fontSize: 14.5 }
  : {};
// Contamination severity for a reading, per the water-quality business rules
// (pH + TDS): Critical = pH <6.0 or >9.0 (BR-PH-01); High = TDS >500 (out of
// safe) or pH outside the 6.5–8.5 ideal band; Medium = TDS <50 (low/dilution,
// BR-TDS-02). Returns null when the reading is within safe limits.
export const IOT_CONTAM_SEV = { critical: { c: "#DC4141", bg: "#FBE8E8", label: "Critical" }, high: { c: "#a86e00", bg: "#FBF0E0", label: "High" }, medium: { c: "#2A86D6", bg: "#E5F0FA", label: "Medium" } };
export const iotContamSev = (ph, tds) => {
  if (ph != null && (ph < 6.0 || ph > 9.0)) return "critical";
  if (tds != null && tds > 500) return "high";
  if (ph != null && (ph < 6.5 || ph > 8.5)) return "high";
  if (tds != null && tds < 50) return "medium";
  return null;
};
// Tank-level severity (refill urgency): ≤25% High, ≤50% Medium, else safe.
export const iotTankSev = (pct) => pct == null ? null : pct <= 25 ? "high" : pct <= 50 ? "medium" : null;
export const iotSevRank = { critical: 3, high: 2, medium: 1 };
export const iotWorstSev = (a, b) => (iotSevRank[a] || 0) >= (iotSevRank[b] || 0) ? (a || b || null) : (b || a || null);
// Tank level band: low tanks (≤25%) are critical (needs refill), ≤50% borderline.
export const iotTankBand = (pct) => pct <= 25 ? "red" : pct <= 50 ? "amber" : "green";
export const IOT_WAVE_COL = { green: "#12a150", amber: "#d1830a", red: "#e0453f", na: "#8aa398" };
// ---- Trend analytics for the RO-tank readings (deterministic, no LLM). --------
// Metric registry shared by the chart, the anomaly scan and the readings table.
export function iotTrendMetrics() {
  return [
    { k: "ph",       label: "pH",          unit: "",      dp: 1, ideal: IOT_WQ_IDEAL.ph,       get: (it) => iotWqNum(it.waterQuality?.ph),       cls: (v) => iotWqClass("ph", v) },
    { k: "tds",      label: "TDS",         unit: "mg/L",  dp: 0, ideal: IOT_WQ_IDEAL.tds,      get: (it) => iotWqNum(it.waterQuality?.tds),      cls: (v) => iotWqClass("tds", v) },
    { k: "temp",     label: "Temperature", unit: "°C",    dp: 1, ideal: IOT_WQ_IDEAL.temp,     get: (it) => iotWqNum(it.waterQuality?.temp),     cls: (v) => iotWqClass("temp", v) },
    { k: "tank",     label: "Tank level",  unit: "%",     dp: 0, ideal: [50, 100],              get: (it) => iotTank(it.tankLevel).pct,           cls: (v) => iotTankBand(v) },
    { k: "pressure", label: "Pressure",    unit: "bar",   dp: 2, ideal: IOT_WQ_IDEAL.pressure, get: (it) => iotWqNum(it.waterQuality?.pressure), cls: (v) => iotWqClass("pressure", v) },
    { k: "flowMLPM", label: "Flow rate",   unit: "L/min", dp: 2, ideal: IOT_WQ_IDEAL.flowMLPM, get: (it) => iotWqNum(it.waterQuality?.flowMLPM), cls: (v) => iotWqClass("flowMLPM", v) },
  ];
}
// Scan chronological readings for out-of-range EVENTS (maximal runs) per metric.
// Each event ~ one "alert"; extreme = worst value in the run, dir = High / Low.
export function iotAnomalyScan(chrono) {
  const metrics = iotTrendMetrics();
  const events = []; const perMetric = Object.fromEntries(metrics.map((m) => [m.k, 0]));
  metrics.forEach((m) => {
    let run = null;
    chrono.forEach((it) => {
      const v = m.get(it);
      const band = v == null ? "na" : m.cls(v);
      const out = band === "amber" || band === "red";
      if (out) {
        perMetric[m.k]++;
        const dir = m.k === "tank" ? "Low" : (v < m.ideal[0] ? "Low" : v > m.ideal[1] ? "High" : "—");
        if (!run) run = { metric: m.k, label: m.label, unit: m.unit, dp: m.dp, startTs: it.timestamp, endTs: it.timestamp, extreme: v, sev: band, dir, n: 1 };
        else { run.endTs = it.timestamp; run.n++; if (band === "red") run.sev = "red"; if ((run.dir === "High" && v > run.extreme) || (run.dir === "Low" && v < run.extreme)) run.extreme = v; }
      } else if (run) { events.push(run); run = null; }
    });
    if (run) events.push(run);
  });
  events.sort((a, b) => new Date(b.startTs) - new Date(a.startTs));
  return { events, perMetric };
}
// Sensor-health heuristic: reporting continuity + dropout rate + staleness.
export function iotSensorHealth(chrono) {
  if (!chrono.length) return { verdict: "na", note: "No data yet." };
  const ts = chrono.map((it) => new Date(it.timestamp).getTime()).sort((a, b) => a - b);
  let maxGap = 0; for (let i = 1; i < ts.length; i++) maxGap = Math.max(maxGap, ts[i] - ts[i - 1]);
  const gapMin = maxGap / 60000;
  const dropouts = chrono.filter((it) => { const p = iotWqNum(it.waterQuality?.ph), t = iotWqNum(it.waterQuality?.tds), tp = iotWqNum(it.waterQuality?.temp); return (p == null || p <= 0) || (t == null || t <= 0) || (tp == null || tp <= 0); }).length;
  const dropRate = dropouts / chrono.length;
  const lastMin = (Date.now() - ts[ts.length - 1]) / 60000;
  const stale = lastMin > IOT_TANK_ONLINE_SECS / 60;
  const verdict = (stale || gapMin > 90 || dropRate > 0.15) ? "check" : "good";
  const note = verdict === "good"
    ? `Reporting steadily · ${chrono.length} readings, ${dropouts} dropouts`
    : stale ? `No reading for ${Math.round(lastMin)} min` : gapMin > 90 ? `${Math.round(gapMin)} min gap in the feed` : `${dropouts} sensor dropouts (${Math.round(dropRate * 100)}%)`;
  return { verdict, gapMin, dropouts, dropRate, lastMin, stale, n: chrono.length, note };
}
// Scale/meter gauge for a single metric — a real pH scale / TDS meter / temp
// cold-normal-hot range / tank 0-100% bar, with a big current-value number.
// Also the clickable metric selector for the trend chart (active = selected).
export const IOT_ZONE_COL = { red: "#f4bcb9", amber: "#f3d9a4", green: "#bfe6d6", cold: "#bcd8f2" };
export const IOT_GAUGE = {
  ph:   { min: 0,  max: 14,  dp: 1, band: (v) => iotWqClass("ph", v),   zones: [[0, 6, "red"], [6, 6.5, "amber"], [6.5, 8.5, "green"], [8.5, 9, "amber"], [9, 14, "red"]], ticks: [0, 7, 14] },
  tds:  { min: 0,  max: 600, dp: 0, band: (v) => iotWqClass("tds", v),  zones: [[0, 50, "red"], [50, 300, "green"], [300, 500, "amber"], [500, 600, "red"]], ticks: [0, 150, 300, 450, 600] },
  temp: { min: 5,  max: 40,  dp: 1, band: (v) => iotWqClass("temp", v), zones: [[5, 10, "cold"], [10, 15, "amber"], [15, 25, "green"], [25, 32, "amber"], [32, 40, "red"]], ticks: [5, 15, 25, 32], zoneLabels: [["Cold", 7.5], ["Normal", 20], ["Hot", 36]] },
  tank: { min: 0,  max: 100, dp: 0, band: (v) => iotTankBand(v),        zones: [[0, 25, "red"], [25, 50, "amber"], [50, 100, "green"]], ticks: [0, 25, 50, 75, 100], fill: true },
  // Fully green track — no amber zone. Pressure/flow are pump-driven, not a
  // pass/fail quality metric; see iotWqClass for why neither end is a real anomaly.
  pressure: { min: 0, max: 6, dp: 2, band: (v) => iotWqClass("pressure", v), zones: [[0, 6, "green"]], ticks: [0, 2, 4, 6] },
  flowMLPM: { min: 0, max: 6, dp: 2, band: (v) => iotWqClass("flowMLPM", v), zones: [[0, 6, "green"]], ticks: [0, 1.5, 3, 4.5, 6] },
};
export function IoTMetricGauge({ metricKey, label, unit, value, active, onClick }) {
  const g = IOT_GAUGE[metricKey];
  const band = value == null ? "na" : g.band(value);
  const numCol = band === "red" ? "#DC4141" : band === "amber" ? "#a86e00" : band === "green" ? "#0A7D53" : "#6b8577";
  const span = (g.max - g.min) || 1;
  const pct = value == null ? null : Math.max(0, Math.min(100, ((value - g.min) / span) * 100));
  return (
    <div onClick={onClick} title={onClick ? `Show ${label} trend` : undefined} style={{ background: "#fff", border: "1px solid " + (active ? "var(--brand)" : "var(--border)"), boxShadow: active ? "0 0 0 2px rgba(30, 158, 79,.18), 0 6px 16px rgba(16,40,28,.08)" : "0 1px 2px rgba(16,40,28,.04), 0 6px 16px rgba(16,40,28,.06)", borderRadius: 14, padding: "12px 14px", cursor: onClick ? "pointer" : "default", transition: "box-shadow .15s ease, border-color .15s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: active ? "var(--forest)" : "#6b8577" }}>{label}</span>
        <span style={{ fontSize: 30, fontWeight: 800, color: numCol, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value == null ? "—" : value.toFixed(g.dp)}<span style={{ fontSize: 12.5, color: "#8aa398", fontWeight: 600 }}>{unit ? " " + unit : ""}</span></span>
      </div>
      <div style={{ position: "relative", marginTop: 12 }}>
        <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(16,40,28,.06)" }}>
          {g.zones.map((z, i) => <div key={i} style={{ width: ((z[1] - z[0]) / span * 100) + "%", background: g.fill ? "#eef2f0" : IOT_ZONE_COL[z[2]] }} />)}
        </div>
        {g.fill && pct != null && <div style={{ position: "absolute", top: 0, left: 0, height: 10, width: pct + "%", background: "linear-gradient(90deg,#7fc4f5,#2A86D6)", borderRadius: 6 }} />}
        {pct != null && <div style={{ position: "absolute", top: -3, left: `${pct}%`, transform: "translateX(-50%)", width: 3, height: 16, background: "#0b1a12", borderRadius: 2, boxShadow: "0 0 0 2px #fff" }} />}
        <div style={{ position: "relative", height: 13, marginTop: 5 }}>
          {g.ticks.map((tk, i) => { const lp = ((tk - g.min) / span) * 100; return <span key={i} style={{ position: "absolute", left: lp + "%", transform: "translateX(-50%)", fontSize: 9, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{tk}</span>; })}
        </div>
        {g.zoneLabels && (
          <div style={{ position: "relative", height: 12 }}>
            {g.zoneLabels.map(([txt, at], i) => { const lp = ((at - g.min) / span) * 100; return <span key={i} style={{ position: "absolute", left: lp + "%", transform: "translateX(-50%)", fontSize: 8.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{txt}</span>; })}
          </div>
        )}
      </div>
    </div>
  );
}
export function IoTTankReadings({ items, weather, range, setRange }) {
  const all = items || [];
  const PER = 10;
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState("desc");
  const [metric, setMetric] = useState("ph");
  const [wxShow, setWxShow] = useState({ wtemp: true, tds: true, ph: true, tank: true }); // which sensor lines show on the weather-correlation chart (outdoor temp is always on)
  const [anomOnly, setAnomOnly] = useState(false);
  const [showAllHist, setShowAllHist] = useState(false);
  const [catF, setCatF] = useState("all"); // all | contamination | tank | dead (anomaly category)
  const [sevF, setSevF] = useState("all"); // all | critical | high | medium (severity)

  // Slice the (up-to-62-day) window before anything else, so the chart, tiles,
  // anomaly scan, table and correlation all reflect the chosen range. `range` is
  // now owned by the parent (IoTDevices) so the same period also drives the
  // Total Dispensed stat above — see iotFilterByRange / IOT_RANGE_OPTIONS.
  const ranged = useMemo(() => iotFilterByRange(all, range), [all, range]);
  const chrono = useMemo(() => [...ranged].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)), [ranged]);
  const latestReading = chrono.length ? chrono[chrono.length - 1] : null;
  const metrics = iotTrendMetrics();
  const gaugeVal = Object.fromEntries(metrics.map((m) => [m.k, latestReading ? m.get(latestReading) : null]));
  const M = metrics.find((m) => m.k === metric) || metrics[0];
  const scan = useMemo(() => iotAnomalyScan(chrono), [chrono]);
  const health = useMemo(() => iotSensorHealth(chrono), [chrono]);
  const wqRange = useMemo(() => iotWqRange(chrono), [chrono]);
  const wqWorst = ["ph", "tds", "temp"].reduce((w, k) => { const c = iotWqBand(wqRange[k], k); return c === "red" ? "red" : (c === "amber" && w !== "red") ? "amber" : w; }, chrono.length ? "green" : "na");

  const bandsOf = (it) => Object.fromEntries(metrics.map((m) => { const v = m.get(it); return [m.k, v == null ? "na" : m.cls(v)]; }));
  const isOut = (b) => b === "amber" || b === "red";
  const anyOut = (it) => Object.values(bandsOf(it)).some(isOut);

  const series = useMemo(() => chrono.map((it) => { const v = M.get(it); if (v == null) return null; const band = M.cls(v); return { t: new Date(it.timestamp).getTime(), v, out: band === "amber" || band === "red", sev: band }; }).filter(Boolean), [chrono, metric]);
  const chartData = anomOnly ? series.filter((d) => d.out) : series;
  const yLo = Math.min(M.ideal[0], ...(series.length ? series.map((d) => d.v) : [M.ideal[0]]));
  const yHi = Math.max(M.ideal[1], ...(series.length ? series.map((d) => d.v) : [M.ideal[1]]));
  const yPad = ((yHi - yLo) || 1) * 0.12;
  const anomEvents = scan.events;
  const anomReadings = Object.values(scan.perMetric).reduce((s, v) => s + v, 0);

  const hm = (ms) => { const d = new Date(ms); let h = d.getHours(); const ap = h < 12 ? "AM" : "PM"; h = h % 12 || 12; return h + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap; };
  const renderDot = (p) => { const { cx, cy, payload, index } = p; if (cx == null || cy == null || !payload) return null; const out = payload.out; return <circle key={index} cx={cx} cy={cy} r={out ? 4 : 2} fill={out ? "#e0453f" : "#1E9E4F"} stroke="#fff" strokeWidth={out ? 1.4 : 0.8} />; };
  const TT = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const status = d.sev === "green" ? "In range" : d.sev === "amber" ? "Borderline" : "Out of range";
    const col = IOT_WAVE_COL[d.sev] || "#12a150";
    return (
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 11px", boxShadow: "0 8px 22px rgba(16,40,28,.14)", fontSize: 12 }}>
        <div style={{ color: "var(--muted)", marginBottom: 3 }}>{iotStamp(d.t)}</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: col, fontVariantNumeric: "tabular-nums" }}>{d.v.toFixed(M.dp)}<span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{M.unit ? " " + M.unit : ""}</span></div>
        <div style={{ color: col, fontWeight: 700, marginTop: 2 }}>● {status}</div>
        <div style={{ color: "var(--muted)", marginTop: 2 }}>Ideal {M.ideal[0]}–{M.ideal[1]}{M.unit ? " " + M.unit : ""}</div>
      </div>
    );
  };

  const VC = { good: ["#0A7D53"], warning: ["#a86e00"], critical: ["#DC4141"], check: ["#a86e00"], na: ["#6b8577"] };
  const tile = (label, value, sub, vk) => (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        {vk && <span style={{ width: 9, height: 9, borderRadius: 999, background: (VC[vk] || VC.na)[0], flex: "0 0 auto" }} />}
        <span style={{ fontSize: 18, fontWeight: 800, color: (VC[vk] || ["var(--f)"])[0], fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
  const wqVerdict = wqWorst === "green" ? "Good" : wqWorst === "amber" ? "Warning" : wqWorst === "red" ? "Critical" : "—";
  const wqVk = wqWorst === "green" ? "good" : wqWorst === "amber" ? "warning" : wqWorst === "red" ? "critical" : "na";

  const contamSevOf = (it) => iotContamSev(iotWqNum(it.waterQuality?.ph), iotWqNum(it.waterQuality?.tds));
  const tankSevOf = (it) => iotTankSev(iotTank(it.tankLevel).pct);
  const rowSevOf = (it) => iotWorstSev(contamSevOf(it), tankSevOf(it));
  const lastSeenTs = all.length ? Math.max(...all.map((it) => new Date(it.timestamp).getTime()).filter((t) => !isNaN(t))) : NaN;
  const deviceDead = !isNaN(lastSeenTs) && (Date.now() - lastSeenTs) > 24 * 3600000;
  const catCounts = { contamination: 0, tank: 0, dead: deviceDead ? 1 : 0 };
  const sevCounts = { critical: 0, high: 0, medium: 0 };
  chrono.forEach((it) => { if (contamSevOf(it)) catCounts.contamination++; if (tankSevOf(it)) catCounts.tank++; const s = rowSevOf(it); if (s) sevCounts[s]++; });
  const passCat = (it) => catF === "all" ? true : catF === "contamination" ? contamSevOf(it) != null : catF === "tank" ? tankSevOf(it) != null : deviceDead;
  const passSev = (it) => sevF === "all" ? true : rowSevOf(it) === sevF;
  const sorted = [...chrono].filter((it) => (anomOnly ? anyOut(it) : true) && passCat(it) && passSev(it)).sort((a, b) => { const dd = new Date(b.timestamp) - new Date(a.timestamp); return sortDir === "desc" ? dd : -dd; });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER));
  const cur = Math.min(page, totalPages);
  const rows = sorted.slice((cur - 1) * PER, cur * PER);
  const exportReadings = () => exportToCsv(`prowater-iot-readings-${range}.csv`, [
    { label: "Time", get: (it) => iotStamp(it.timestamp) },
    { label: "Tank %", get: (it) => iotTank(it.tankLevel).pct },
    { label: "pH", get: (it) => { const v = iotWqNum(it.waterQuality?.ph); return v == null ? "" : v.toFixed(1); } },
    { label: "TDS (mg/L)", get: (it) => { const v = iotWqNum(it.waterQuality?.tds); return v == null ? "" : Math.round(v); } },
    { label: "Temp (°C)", get: (it) => { const v = iotWqNum(it.waterQuality?.temp); return v == null ? "" : v.toFixed(1); } },
    { label: "Pressure (bar)", get: (it) => { const v = iotWqNum(it.waterQuality?.pressure); return v == null ? "" : v.toFixed(2); } },
    { label: "Flow rate (L/min)", get: (it) => { const v = iotWqNum(it.waterQuality?.flowMLPM); return v == null ? "" : v.toFixed(2); } },
    { label: "Total dispensed (L)", get: (it) => { const v = iotWqNum(it.waterQuality?.totalDispensed); return v == null ? "" : v.toFixed(2); } },
  ], sorted);
  const btn = (disabled) => ({ fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: 9, border: "1px solid " + (disabled ? "var(--border)" : "var(--brand)"), background: disabled ? "#fff" : "var(--brand)", color: disabled ? "var(--faint)" : "#fff", cursor: disabled ? "not-allowed" : "pointer" });
  const syncHead = (
    <span onClick={() => { setSortDir((d) => d === "desc" ? "asc" : "desc"); setPage(1); }} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, userSelect: "none" }} title="Sort by time">
      Sync History {sortDir === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
    </span>
  );
  const sevDot = (sev) => <span style={{ width: 8, height: 8, borderRadius: 999, background: IOT_WAVE_COL[sev] || IOT_WAVE_COL.amber, display: "inline-block", flex: "0 0 auto" }} />;
  const histShown = showAllHist ? anomEvents : anomEvents.slice(0, 6);

  // ---- weather correlation (outdoor temp vs the sensors) --------------------
  const wxCorr = useMemo(() => iotWeatherCorrelate(chrono, weather?.history), [chrono, weather]);
  const wxStory = useMemo(() => (wxCorr ? iotWeatherNarrative(wxCorr, weather, chrono) : null), [wxCorr, weather, chrono]);
  const WXLVL = { strong: "#0A7D53", moderate: "#a86e00", weak: "#6b8577", none: "#8aa398" };
  const WX_SERIES = [
    { key: "wtemp", oorKey: "oorTemp", label: "Water temp", unit: "°C", color: "#1E9E4F", dp: 1 },
    { key: "tds", oorKey: "oorTds", label: "TDS", unit: "mg/L", color: "#2A86D6", dp: 0 },
    { key: "ph", oorKey: "oorPh", label: "pH", unit: "", color: "#7A5AF8", dp: 1 },
    { key: "tank", oorKey: "oorTank", label: "Tank", unit: "%", color: "#986315", dp: 0 },
  ];
  const wxDot = (s) => (p) => { const { cx, cy, payload, index } = p; if (cx == null || cy == null || !payload) return null; const bad = payload[s.oorKey]; return <circle key={index} cx={cx} cy={cy} r={bad ? 3.6 : 0} fill={bad ? "#e0453f" : s.color} stroke="#fff" strokeWidth={bad ? 1.2 : 0} />; };
  const bigTT = (props) => {
    const { active, payload } = props; if (!active || !payload || !payload.length) return null; const d = payload[0].payload;
    const row = (label, val, unit, bad, col) => val == null ? null : <div key={label} style={{ color: bad ? "#e0453f" : col, fontWeight: 700 }}>{label} {val.toFixed((unit === "mg/L" || unit === "%") ? 0 : 1)}{unit ? " " + unit : ""}{bad ? " · out of range" : ""}</div>;
    return (<div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 11px", fontSize: 12, boxShadow: "0 8px 22px rgba(16,40,28,.14)" }}><div style={{ color: "var(--muted)", marginBottom: 3 }}>{iotStamp(d.t)}</div>{row("Outdoor", d.out, "°C", false, "#d1830a")}{row("Water temp", d.wtemp, "°C", d.oorTemp, "#1E9E4F")}{row("TDS", d.tds, "mg/L", d.oorTds, "#2A86D6")}{row("pH", d.ph, "", d.oorPh, "#7A5AF8")}{row("Tank", d.tank, "%", d.oorTank, "#986315")}</div>);
  };
  // Flashing red ring at timestamps where taste is likely affected (temp+TDS+pH).
  const tasteDot = (p) => { const { cx, cy, payload, index } = p; if (cx == null || cy == null || !payload || !payload.taste) return null; return (<g key={index}><circle cx={cx} cy={cy} r={5} fill="none" stroke="#e0453f" strokeWidth={2}><animate attributeName="r" values="5;9;5" dur="1.1s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite" /></circle><circle cx={cx} cy={cy} r={2.6} fill="#e0453f"><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite" /></circle></g>); };
  const RCOL = { strong: "#0A7D53", mod: "#a86e00", weak: "#6b8577", none: "#6b8577", na: "#8aa398" };
  const rLabel = (r) => r == null ? "—" : (r >= 0 ? "+" : "") + r.toFixed(2);
  const rStrength = (r) => { if (r == null) return { t: "insufficient data", c: "na" }; const a = Math.abs(r), dir = r > 0 ? "positive" : "inverse"; if (a >= 0.7) return { t: `strong ${dir}`, c: "strong" }; if (a >= 0.4) return { t: `moderate ${dir}`, c: "mod" }; if (a >= 0.2) return { t: `weak ${dir}`, c: "weak" }; return { t: "little / no link", c: "none" }; };
  const WxTT = ({ active, payload }) => { if (!active || !payload || !payload.length) return null; const d = payload[0].payload; return (<div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 10px", fontSize: 12, boxShadow: "0 8px 22px rgba(16,40,28,.14)" }}><div style={{ color: "var(--muted)", marginBottom: 2 }}>{iotStamp(d.t)}</div><div style={{ color: "#d1830a", fontWeight: 700 }}>Outdoor {d.out != null ? d.out.toFixed(1) : "—"} °C</div><div style={{ color: "#1E9E4F", fontWeight: 700 }}>Water {d.wtemp != null ? d.wtemp.toFixed(1) : "—"} °C</div></div>); };

  return (
    <div style={{ ...IOT_CARD, marginTop: 16, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 4px" }}>
        <h3 style={{ fontSize: 16 }}>Trend analysis</h3>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Time-series per metric — out-of-range readings are flagged in red. Toggle <b>Anomalies</b> to isolate them.</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "2px 18px 0" }}>
        <CalendarRange size={14} color="var(--muted)" />
        <IoTRangeChips range={range} setRange={(k) => { setRange(k); setPage(1); }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, padding: "10px 18px 4px" }}>
        {tile("Sensor health", health.verdict === "good" ? "Good" : health.verdict === "check" ? "Check" : "—", health.note, health.verdict === "good" ? "good" : health.verdict === "check" ? "check" : "na")}
        {tile("Water quality", wqVerdict, chrono.length ? `${anomReadings} of ${chrono.length} readings out of range` : "No data yet.", wqVk)}
        {tile("Total alerts", String(anomEvents.length), anomEvents.length ? "out-of-range events in this window" : "no anomaly events", anomEvents.length ? "critical" : "good")}
        {tile("Anomalies by metric", String(anomReadings), `pH ${scan.perMetric.ph} · TDS ${scan.perMetric.tds} · Temp ${scan.perMetric.temp} · Tank ${scan.perMetric.tank} · Pressure ${scan.perMetric.pressure} · Flow ${scan.perMetric.flowMLPM}`, anomReadings ? "warning" : "good")}
      </div>

      {all.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, padding: "12px 18px 6px" }}>
          <IoTMetricGauge metricKey="ph" label="pH" unit="" value={gaugeVal.ph} active={metric === "ph"} onClick={() => setMetric("ph")} />
          <IoTMetricGauge metricKey="tds" label="TDS" unit="mg/L" value={gaugeVal.tds} active={metric === "tds"} onClick={() => setMetric("tds")} />
          <IoTMetricGauge metricKey="temp" label="Temp" unit="°C" value={gaugeVal.temp} active={metric === "temp"} onClick={() => setMetric("temp")} />
          <IoTMetricGauge metricKey="tank" label="Tank" unit="%" value={gaugeVal.tank} active={metric === "tank"} onClick={() => setMetric("tank")} />
          <IoTMetricGauge metricKey="pressure" label="Pressure" unit="bar" value={gaugeVal.pressure} active={metric === "pressure"} onClick={() => setMetric("pressure")} />
          <IoTMetricGauge metricKey="flowMLPM" label="Flow" unit="L/min" value={gaugeVal.flowMLPM} active={metric === "flowMLPM"} onClick={() => setMetric("flowMLPM")} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "6px 18px 12px" }}>
        {metrics.map((m) => { const active = metric === m.k; const oc = scan.perMetric[m.k]; return (
          <button key={m.k} onClick={() => setMetric(m.k)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid " + (active ? "var(--brand)" : "var(--border)"), background: active ? "var(--brand)" : "#fff", color: active ? "#fff" : "var(--slate)" }}>{m.label}{oc ? ` · ${oc}` : ""}</button>
        ); })}
        <div style={{ flex: 1, minWidth: 8 }} />
        <button onClick={() => { setAnomOnly((v) => !v); setPage(1); }} disabled={anomReadings === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, padding: "6px 13px", borderRadius: 999, cursor: anomReadings === 0 ? "not-allowed" : "pointer", border: "1px solid " + (anomOnly ? "#DC4141" : "var(--border)"), background: anomOnly ? "#DC4141" : "#fff", color: anomOnly ? "#fff" : (anomReadings === 0 ? "var(--faint)" : "#DC4141") }}>
          <AlertCircle size={14} /> Anomalies only{anomReadings ? ` (${anomReadings})` : ""}
        </button>
      </div>

      <div style={{ padding: "0 12px 6px" }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#1f6b47" strokeOpacity={0.08} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={hm} tick={{ fontSize: 11, fill: "#6b8577" }} minTickGap={64} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis domain={[yLo - yPad, yHi + yPad]} tickFormatter={(v) => M.dp ? v.toFixed(M.dp) : Math.round(v)} tick={{ fontSize: 11, fill: "#6b8577" }} width={40} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <ReferenceArea y1={M.ideal[0]} y2={M.ideal[1]} fill="#12a150" fillOpacity={0.08} ifOverflow="extendDomain" />
              <ReferenceLine y={M.ideal[0]} stroke="#12a150" strokeOpacity={0.4} strokeDasharray="4 4" />
              <ReferenceLine y={M.ideal[1]} stroke="#12a150" strokeOpacity={0.4} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="v" stroke={anomOnly ? "transparent" : "#1E9E4F"} strokeWidth={anomOnly ? 0 : 2} dot={renderDot} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <Empty msg={all.length ? (anomOnly ? "No out-of-range readings for " + M.label + " in this window." : "No " + M.label + " readings yet.") : "No readings yet."} />
        )}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "4px 8px 0", fontSize: 11, color: "var(--muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#1E9E4F", borderRadius: 2 }} /> {M.label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#e0453f" }} /> out of range</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 10, background: "#12a150", opacity: 0.18, borderRadius: 2 }} /> ideal band ({M.ideal[0]}–{M.ideal[1]}{M.unit ? " " + M.unit : ""})</span>
        </div>
      </div>

      {/* weather correlation — does outside temperature move the water metrics? */}
      {weather && (
        <div style={{ padding: "12px 18px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--f)" }}>Weather correlation</div>
            {weather.sample && <span style={{ fontSize: 10, fontWeight: 800, color: "#a86e00", background: "#FBF0DA", border: "1px solid #F0D9A8", borderRadius: 999, padding: "1px 8px" }}>SAMPLE</span>}
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>outdoor temp at {weather.location?.name || "site"} vs the water sensors</span>
            <span className="iot-flow-dot" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(209,131,10,0.12)", color: "#d1830a", marginLeft: "auto" }}>
              ☀️ Prabhavati Thermal Sync
            </span>
          </div>
          {wxCorr ? (
            <>
              {wxStory && (
                <div style={{ background: "#F6FAF8", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>What this means</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--f)", lineHeight: 1.5, marginBottom: 8 }}>{wxStory.headline}</div>
                  <div style={{ display: "grid", gap: 7 }}>
                    {wxStory.items.map((it, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 15, lineHeight: 1.3, flex: "0 0 auto" }}>{it.emoji}</span>
                        <div style={{ fontSize: 12.5, color: "var(--slate)", lineHeight: 1.45 }}><b style={{ color: WXLVL[it.lvl] || "var(--f)" }}>{it.label}:</b> {it.text}</div>
                      </div>
                    ))}
                  </div>
                  {wxStory.customer && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>For residents &amp; in-flat purifiers</div>
                      <div style={{ fontSize: 12.5, color: "var(--slate)", lineHeight: 1.45, marginBottom: 4 }}><span style={{ fontSize: 14 }}>🚰</span> <b style={{ color: "var(--f)" }}>Taste:</b> {wxStory.customer.taste}</div>
                      <div style={{ fontSize: 12.5, color: "var(--slate)", lineHeight: 1.45 }}><span style={{ fontSize: 14 }}>🏠</span> <b style={{ color: "var(--f)" }}>In-flat purifiers:</b> {wxStory.customer.purifiers}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5, fontStyle: "italic" }}>Sensors sit on the building's central RO — before water reaches each flat's own purifier.</div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>{wxStory.footer}</div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 10 }}>
                {[{ k: "rTemp", label: "Outdoor °C ↔ Water temp", expect: "strong link expected" }, { k: "rTds", label: "Outdoor °C ↔ TDS", expect: "mild link plausible" }, { k: "rPh", label: "Outdoor °C ↔ pH", expect: "weak link expected" }].map(({ k, label, expect }) => {
                  const r = wxCorr[k], s = rStrength(r), col = RCOL[s.c] || RCOL.na;
                  const absR = Math.min(1, Math.abs(r || 0));
                  return (
                    <div key={k} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: col, fontVariantNumeric: "tabular-nums" }}>{rLabel(r)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{s.t}</span>
                      </div>
                      <div style={{ height: 4, width: "100%", background: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                        <div style={{ width: `${Math.max(5, absR * 100)}%`, height: "100%", background: col, borderRadius: 999, transition: "width 0.8s ease-in-out" }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>r · {expect}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Show</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#d1830a", display: "inline-flex", alignItems: "center", gap: 5 }} title="Outdoor temperature is always shown"><span style={{ width: 12, height: 3, background: "#d1830a", borderRadius: 2 }} />Outdoor temp</span>
                {WX_SERIES.map((s) => { const on = wxShow[s.key]; return (
                  <button key={s.key} onClick={() => setWxShow((p) => ({ ...p, [s.key]: !p[s.key] }))} style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, cursor: "pointer", border: "1px solid " + (on ? s.color : "var(--border)"), background: on ? s.color : "#fff", color: on ? "#fff" : "var(--muted)", transition: "all .2s ease" }}>{s.label}</button>
                ); })}
              </div>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 10px 4px" }}>
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={wxCorr.joined} margin={{ top: 8, right: 10, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#1f6b47" strokeOpacity={0.08} vertical={false} />
                    <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={hm} tick={{ fontSize: 11, fill: "#6b8577" }} minTickGap={64} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis yAxisId="out" orientation="left" domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#d1830a" }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => Math.round(v) + "°C"} />
                    <YAxis yAxisId="wtemp" hide domain={["auto", "auto"]} />
                    <YAxis yAxisId="tds" hide domain={["auto", "auto"]} />
                    <YAxis yAxisId="ph" hide domain={["auto", "auto"]} />
                    <YAxis yAxisId="tank" hide domain={["auto", "auto"]} />
                    <Tooltip content={bigTT} />
                    <Line yAxisId="out" type="monotone" dataKey="out" stroke="#d1830a" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={1200} animationEasing="ease-in-out" connectNulls />
                    {WX_SERIES.filter((s) => wxShow[s.key]).map((s) => <Line key={s.key} yAxisId={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.8} dot={wxDot(s)} activeDot={{ r: 4 }} isAnimationActive={true} animationDuration={1200} animationEasing="ease-in-out" connectNulls />)}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "6px 4px 0", fontSize: 11, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#d1830a", borderRadius: 2 }} /> outdoor temp</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#1E9E4F", borderRadius: 2 }} /> water temp</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#2A86D6", borderRadius: 2 }} /> TDS</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#7A5AF8", borderRadius: 2 }} /> pH</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#986315", borderRadius: 2 }} /> tank</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#e0453f" }} /> out of range</span>
                <span>· {wxCorr.n} paired readings · lines auto-scaled to fit — hover for real values{weather.sample ? " · sample weather" : ""}</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--muted)", background: "#F6FAF8", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>Not enough overlapping weather + sensor data yet to correlate.</div>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 20px 8px" }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F" }}>Recent Readings</span>
        <div style={{ flex: 1, minWidth: 8 }} />
        <CalendarRange size={15} color="#86868B" />
        <IoTRangeChips range={range} setRange={(k) => { setRange(k); setPage(1); }} />
        <button onClick={exportReadings} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(8,128,90,0.2)", background: "#08805A", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(8,128,90,0.2)" }}><Download size={14} /> Export CSV</button>
      </div>
      {deviceDead && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 20px 8px", padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#DC4141", fontSize: 12.5, fontWeight: 700 }}>
          <AlertCircle size={15} /> Dead device — no ping for {Math.round((Date.now() - lastSeenTs) / 3600000)}h. The readings below are the last known.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "4px 20px 14px" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em" }}>Anomaly</span>
        {[["all", "All"], ["contamination", "Contamination"], ["tank", "Tank"], ["dead", "Dead device"]].map(([k, label]) => {
          const active = catF === k; const cnt = k === "all" ? null : catCounts[k]; const dim = k !== "all" && !cnt;
          return (
            <button key={k} disabled={dim} onClick={() => { setCatF(k); setPage(1); }} style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, cursor: dim ? "not-allowed" : "pointer", border: "1px solid " + (active ? "#08805A" : "rgba(0,0,0,0.08)"), background: active ? "#08805A" : "#fff", color: active ? "#fff" : (dim ? "#c5c5c7" : "#1D1D1F") }}>{label}{cnt != null ? ` (${cnt})` : ""}</button>
          );
        })}
        <span style={{ width: 1, height: 22, background: "rgba(0,0,0,0.08)", margin: "0 4px" }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em" }}>Severity</span>
        {[["all", "All"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"]].map(([k, label]) => {
          const active = sevF === k; const cnt = k === "all" ? null : sevCounts[k]; const dim = k !== "all" && !cnt;
          const on = active && k !== "all" ? IOT_CONTAM_SEV[k]?.c : null;
          return (
            <button key={k} disabled={dim} onClick={() => { setSevF(k); setPage(1); }} style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, cursor: dim ? "not-allowed" : "pointer", border: "1px solid " + (active ? (on || "#08805A") : "rgba(0,0,0,0.08)"), background: active ? (on || "#08805A") : "#fff", color: active ? "#fff" : (dim ? "#c5c5c7" : "#1D1D1F") }}>{label}{cnt != null ? ` (${cnt})` : ""}</button>
          );
        })}
      </div>
      <div className="scroll-thin" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
              {[syncHead, "Tank", "pH", "TDS (mg/L)", "Temp (°C)", "Pressure (bar)", "Flow (L/min)", "Dispensed (L)"].map((h, idx) => (
                <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", textAlign: idx === 0 ? "left" : "right", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((it, i) => {
              const t = iotTank(it.tankLevel);
              const ph = iotWqNum(it.waterQuality?.ph), tds = iotWqNum(it.waterQuality?.tds), tp = iotWqNum(it.waterQuality?.temp);
              const pr = iotWqNum(it.waterQuality?.pressure), fl = iotWqNum(it.waterQuality?.flowMLPM), disp = iotWqNum(it.waterQuality?.totalDispensed);
              const cellTd = { padding: "12px 18px", fontVariantNumeric: "tabular-nums", textAlign: "center" };
              return (
                <tr key={(cur - 1) * PER + i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", transition: ".12s" }}>
                  <td style={{ padding: "12px 18px", fontFamily: "-apple-system,SF Mono,monospace", fontSize: 12, color: "#86868B", whiteSpace: "nowrap", textAlign: "center" }}>{iotStamp(it.timestamp)}</td>
                  <td style={{ ...cellTd, fontWeight: 700, ...iotBandText(iotTankBand(t.pct)) }}>{t.pct}%</td>
                  <td style={{ ...cellTd, ...iotBandText(iotWqClass("ph", ph)) }}>{ph == null ? "—" : ph.toFixed(1)}</td>
                  <td style={{ ...cellTd, ...iotBandText(iotWqClass("tds", tds)) }}>{tds == null ? "—" : Math.round(tds)}</td>
                  <td style={{ ...cellTd, ...iotBandText(iotWqClass("temp", tp)) }}>{tp == null ? "—" : tp.toFixed(1)}</td>
                  <td style={{ ...cellTd, ...iotBandText(iotWqClass("pressure", pr)) }}>{pr == null ? "—" : pr.toFixed(2)}</td>
                  <td style={{ ...cellTd, ...iotBandText(iotWqClass("flowMLPM", fl)) }}>{fl == null ? "—" : fl.toFixed(2)}</td>
                  <td style={{ ...cellTd, color: "#1D1D1F", fontWeight: 600 }}>{disp == null ? "—" : disp.toFixed(2)}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={8} style={{ padding: 0 }}><Empty msg={all.length ? "No readings match this filter." : "No readings yet."} /></td></tr>}
          </tbody>
        </table>
      </div>
      {sorted.length > PER && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "#86868B" }}>Showing {(cur - 1) * PER + 1}–{Math.min(cur * PER, sorted.length)} of {sorted.length}{anomOnly ? " anomalies" : ""} · {sortDir === "desc" ? "newest first" : "oldest first"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setPage(() => Math.max(1, cur - 1))} disabled={cur <= 1} style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 14px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: cur <= 1 ? "#c5c5c7" : "#1D1D1F", cursor: cur <= 1 ? "not-allowed" : "pointer" }}>Prev</button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{cur} / {totalPages}</span>
            <button onClick={() => setPage(() => Math.min(totalPages, cur + 1))} disabled={cur >= totalPages} style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: 9, border: "1px solid #08805A", background: cur >= totalPages ? "#fff" : "#08805A", color: cur >= totalPages ? "#c5c5c7" : "#fff", cursor: cur >= totalPages ? "not-allowed" : "pointer" }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Live / dead ECG trace for the Online / Offline KPI cards. Two identical segments
// scroll left seamlessly (see IOT_TANK_CSS). alive → green heartbeat, dead → red flatline.
export const IOT_ECG_ALIVE = "M0 30 H20 l3 0 l3 -2 l3 4 l4 -22 l4 34 l4 -15 l3 2 l3 0 H66 l3 0 l3 -2 l3 4 l4 -22 l4 34 l4 -15 l3 2 l3 0 H120";
export const IOT_ECG_DEAD = "M0 30 H120";
export function IoTEcg({ alive }) {
  const color = alive ? "#1E9E4F" : "#DC4141";
  const d = alive ? IOT_ECG_ALIVE : IOT_ECG_DEAD;
  const seg = (
    <svg className="iot-ecg-seg" viewBox="0 0 120 46" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={alive ? 2.2 : 2.4} strokeLinecap="round" strokeLinejoin="round" opacity={alive ? 0.9 : 0.72} />
    </svg>
  );
  return <div aria-hidden className={`iot-ecg ${alive ? "alive" : "dead"}`}><div className="iot-ecg-track">{seg}{seg}</div></div>;
}

export function iotWxEmoji(cond) { const c = (cond || "").toLowerCase(); if (/(thunder|storm)/.test(c)) return "⛈️"; if (/(rain|drizzle|shower)/.test(c)) return "🌧️"; if (/(snow|sleet|hail)/.test(c)) return "🌨️"; if (/(haze|mist|fog|smoke)/.test(c)) return "🌫️"; if (/(partly|few|scattered|mostly)/.test(c)) return "⛅"; if (/(cloud|overcast)/.test(c)) return "☁️"; if (/(clear|sun|fair)/.test(c)) return "☀️"; return "🌡️"; }
// Live-weather strip for the apartment (newest history hour = the live reading).
export function IoTWeatherCard({ weather }) {
  if (!weather) return null;
  const cur = weather.current, loc = weather.location || WEATHER_LOCATION;
  const asOf = cur?.t ? new Date(cur.t) : (weather.cachedAt ? new Date(weather.cachedAt) : null);
  const hm = asOf ? (((asOf.getHours() % 12) || 12) + ":" + String(asOf.getMinutes()).padStart(2, "0") + " " + (asOf.getHours() < 12 ? "AM" : "PM")) : "—";

  const cond = String(cur?.condition || "").toLowerCase();

  // Categorize weather condition
  let mode = "sunny";
  if (cond.includes("rain") || cond.includes("drizzle") || cond.includes("shower")) mode = "rain";
  else if (cond.includes("thunder") || cond.includes("storm") || cond.includes("lightning")) mode = "thunderstorm";
  else if (cond.includes("cloud") || cond.includes("overcast") || cond.includes("fog") || cond.includes("mist")) mode = "cloudy";
  else if (cond.includes("sun") || cond.includes("clear")) mode = "sunny";


  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      position: "relative", overflow: "hidden",
      background: "rgba(255, 255, 255, 0.85)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: "14px 20px",
      boxShadow: "0 8px 25px rgba(0,0,0,0.03)", marginBottom: 16
    }}>
      <style>{`
        @keyframes pwRainFall {
          0% { transform: translateY(-12px) scale(0.6); opacity: 0; }
          35% { opacity: 0.95; transform: translateY(6px) scale(1); }
          80% { opacity: 0.8; }
          100% { transform: translateY(28px) scale(0.7); opacity: 0; }
        }
        @keyframes pwSunPulse {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.18); opacity: 0.8; }
        }
        @keyframes pwCloudDrift {
          0% { transform: translateX(30px); opacity: 0.2; }
          50% { opacity: 0.5; }
          100% { transform: translateX(-30px); opacity: 0.1; }
        }
      `}</style>

      {/* Foreground Left Content */}
      <div style={{ fontSize: 32, lineHeight: 1, position: "relative", zIndex: 1 }}>{iotWxEmoji(cur?.condition)}</div>
      <div style={{ minWidth: 140, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#86868B" }}>Live weather · {loc.name}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F" }}>{loc.area || ""}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "#1D1D1F", fontVariantNumeric: "tabular-nums" }}>{cur?.tempC != null ? Math.round(cur.tempC) : "—"}</span>
        <span style={{ fontSize: 14, color: "#86868B", fontWeight: 700 }}>°C</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 13, fontWeight: 700, position: "relative", zIndex: 1 }}>
        <Droplets size={15} color="#08805A" /> {cur?.humidity != null ? cur.humidity + "%" : "—"}
      </div>
      <div style={{ fontSize: 13, color: "#1D1D1F", fontWeight: 600, position: "relative", zIndex: 1 }}>{cur?.condition || "—"}</div>

      {/* 🌧️ MIDDLE EMPTY SPACE: Authentic Animated SVG Water Drops Fading Leftward */}
      <div style={{
        flex: 1, height: 44, position: "relative", overflow: "hidden", minWidth: 140,
        maskImage: "linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)"
      }}>
        {mode === "rain" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
            {[
              { left: "10%", delay: "0.1s", size: 12 },
              { left: "26%", delay: "0.45s", size: 15 },
              { left: "42%", delay: "0.2s", size: 13 },
              { left: "58%", delay: "0.65s", size: 16 },
              { left: "74%", delay: "0.35s", size: 12 },
              { left: "88%", delay: "0.5s", size: 14 }
            ].map((drop, idx) => (
              <div key={idx} style={{
                position: "absolute", left: drop.left, top: -2,
                animation: "pwRainFall 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite",
                animationDelay: drop.delay
              }}>
                <svg width={drop.size} height={drop.size * 1.3} viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 3 14 3 21C3 25.9706 7.02944 30 12 30C16.9706 30 21 25.9706 21 21C21 14 12 2 12 2Z" fill={`url(#rainDropGrad_${idx})`} />
                  <defs>
                    <linearGradient id={`rainDropGrad_${idx}`} x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#38BDF8" stopOpacity="0.95" />
                      <stop offset="1" stopColor="#0284C7" stopOpacity="0.85" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            ))}
          </div>
        )}

        {mode === "sunny" && (
          <div style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(251,191,36,0.7) 0%, rgba(245,158,11,0.2) 70%, transparent 100%)",
              animation: "pwSunPulse 3s ease-in-out infinite",
              boxShadow: "0 0 20px rgba(245,158,11,0.5)"
            }} />
          </div>
        )}

        {mode === "cloudy" && (
          <div style={{ position: "absolute", inset: 0, animation: "pwCloudDrift 8s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ width: 85, height: 28, borderRadius: 16, background: "rgba(148,163,184,0.4)" }} />
          </div>
        )}

        {mode === "thunderstorm" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
            {[
              { left: "20%", delay: "0.1s", h: 20 },
              { left: "50%", delay: "0.3s", h: 26 },
              { left: "80%", delay: "0.5s", h: 18 }
            ].map((drop, idx) => (
              <div key={idx} style={{
                position: "absolute", left: drop.left, top: 2,
                width: 2.5, height: drop.h,
                background: "#7C3AED", borderRadius: 999,
                boxShadow: "0 0 6px #7C3AED",
                animation: "pwRainFall 0.65s linear infinite",
                animationDelay: drop.delay
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Foreground Right Content */}
      <div style={{ fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>as of {hm}</div>
      {weather.sample && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#986315", background: "rgba(152,99,21,0.12)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>SAMPLE · connect feed</span>}
    </div>
  );
}
// ── IoT Alerts rules engine (deterministic; thresholds per the water-quality
// business-rules guide). Runs over each device's history + liveness and returns
// a de-duplicated alert per (device, rule) with an occurrence count. ──────────
export const IOT_ALERT_SEV = { critical: { c: "#DC4141", bg: "#FBE8E8", label: "Critical" }, high: { c: "#a86e00", bg: "#FBF0E0", label: "High" }, medium: { c: "#2A86D6", bg: "#E5F0FA", label: "Medium" } };
export function iotRunAlerts(devices, histByDevice) {
  const alerts = [];
  const now = Date.now();
  (devices || []).forEach((d) => {
    const chrono = [...((histByDevice && histByDevice[d.deviceId]) || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastTs = chrono.length ? new Date(chrono[chrono.length - 1].timestamp).getTime() : (d.timestamp ? new Date(d.timestamp).getTime() : null);
    // Dead device — no ping for > 24h.
    if (lastTs == null) alerts.push({ deviceId: d.deviceId, rule: "DEAD", name: "Dead device", sev: "critical", ts: null, value: "never reported", detail: "No telemetry ever received from this device.", action: "Verify install, power and connectivity.", cause: "Never provisioned, or offline since install.", count: 1 });
    else { const ageH = (now - lastTs) / 3600000; if (ageH > 24) alerts.push({ deviceId: d.deviceId, rule: "DEAD", name: "Dead device", sev: "critical", ts: lastTs, value: `${Math.round(ageH)}h since last ping`, detail: "No telemetry received for over 24 hours.", action: "Dispatch a technician — check power, SIM/connectivity and the sensor unit.", cause: "Power loss, network/SIM drop, or a failed sensor board.", count: 1 }); }
    if (!iotIsTank(d)) return;
    const agg = {};
    const flag = (rule, name, sev, ts, value, detail, action, cause) => { const cur = agg[rule]; if (!cur) agg[rule] = { rule, name, sev, ts, value, detail, action, cause, count: 1 }; else { cur.count++; if (ts >= cur.ts) { cur.ts = ts; cur.value = value; } } };
    let prev = null; const tdsWin = [];
    chrono.forEach((it) => {
      const ts = new Date(it.timestamp).getTime();
      const ph = iotWqNum(it.waterQuality?.ph), tds = iotWqNum(it.waterQuality?.tds), tp = iotWqNum(it.waterQuality?.temp), tank = iotTank(it.tankLevel).pct;
      if (ph != null) {
        if (ph < 6.0 || ph > 9.0) flag("PH_CRIT", "Critical pH out of bounds", "critical", ts, `pH ${ph.toFixed(1)}`, "pH beyond the safe 6.0–9.0 band (BR-PH-01).", "Emergency: divert flow, inspect chemical dosing.", "Dosing failure or acid/alkali intrusion.");
        else if (ph < 6.5 || ph > 8.5) flag("PH_OOR", "pH out of range", "high", ts, `pH ${ph.toFixed(1)}`, "pH outside the ideal 6.5–8.5 band.", "Check dosing and source water.", "Dosing drift or a source-water shift.");
      }
      if (tds != null) {
        if (tds > 600) flag("TDS_SPIKE", "High TDS contamination spike", "high", ts, `${Math.round(tds)} mg/L`, "TDS above 600 mg/L (BR-TDS-01).", "Divert to waste; check RO membrane / filtration.", "RO membrane breakdown, scaling, or contamination.");
        else if (tds > 500) flag("TDS_OOR", "TDS out of safe range", "high", ts, `${Math.round(tds)} mg/L`, "TDS above the 500 mg/L safe limit.", "Check filtration / RO membrane.", "Membrane wear or high mineral load.");
        if (tds < 30) flag("TDS_DROP", "Sudden TDS drop (dilution)", "medium", ts, `${Math.round(tds)} mg/L`, "TDS below 30 mg/L (BR-TDS-02).", "Schedule calibration; check for line breaks.", "Over-purification, dilution, or a disconnected sensor.");
      }
      if (tp != null && (tp < 10 || tp > 32)) flag("TEMP_OOR", "Temperature out of range", "high", ts, `${tp.toFixed(1)} °C`, "Water temperature beyond 10–32 °C.", "Inspect heat source / ambient exposure.", "Heat-exchanger fault, solar heating, or cold influx.");
      if (prev) {
        const gapMin = (ts - prev.ts) / 60000;
        if (gapMin > 0 && gapMin <= 15) {
          if (ph != null && prev.ph != null && Math.abs(ph - prev.ph) > 0.8) flag("PH_DRIFT", "pH rapid drift", "high", ts, `Δ${(ph - prev.ph).toFixed(1)} in ${Math.round(gapMin)}m`, "pH moved > 0.8 within minutes (BR-PH-02).", "Flag chemical-dosing failure; inspect feed pumps.", "Dosing-pump failure.");
          if (ph != null && prev.ph != null && tds != null && prev.tds != null && (ph - prev.ph) < -0.5 && (tds - prev.tds) > 150) flag("COR_ACID", "Acid / industrial intrusion", "critical", ts, `pH ↓${(prev.ph - ph).toFixed(1)}, TDS ↑${Math.round(tds - prev.tds)}`, "pH crashed while TDS surged — the classic contaminant signature (BR-COR-01).", "Auto-shutdown intake; emergency site inspection.", "Acid or industrial contaminant intrusion.");
          if (tank != null && prev.tank != null && (prev.tank - tank) >= 25 && gapMin <= 60) flag("TANK_DROP", "Tank level dropped drastically", "high", ts, `${prev.tank}%→${tank}% in ${Math.round(gapMin)}m`, "Tank fell ≥ 25% in a short span.", "Check for a leak/burst or stuck valve; verify the pump.", "Leak/burst, valve failure, or abnormal draw.");
        }
      }
      tdsWin.push(tds); if (tdsWin.length > 24) tdsWin.shift();
      prev = { ts, ph, tds, tp, tank };
    });
    const vals = tdsWin.filter((v) => v != null);
    if (vals.length >= 20) { const m = vals.reduce((s, v) => s + v, 0) / vals.length; const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length); if (sd < 0.5) flag("FLATLINE", "Sensor frozen / flatline", "medium", lastTs, "σ ≈ 0", "TDS hasn't varied across many samples (BR-SYS-01).", "Raise a 'sensor frozen' ticket; watchdog reboot.", "Frozen ADC or a stuck sensor probe."); }
    Object.values(agg).forEach((a) => alerts.push({ deviceId: d.deviceId, ...a }));
  });
  const sevRank = { critical: 0, high: 1, medium: 2 };
  alerts.sort((a, b) => (sevRank[a.sev] - sevRank[b.sev]) || ((b.ts || 0) - (a.ts || 0)));
  return alerts;
}
// Per-occurrence anomaly EVENTS (one per triggering reading + dead/flatline),
// each with a STABLE key so re-detecting the same event across polls doesn't
// duplicate it in the persisted log.
export function iotAnomalyEvents(devices, histByDevice) {
  const events = [], now = Date.now();
  const mk = (deviceId, rule, name, sev, ts, value, detail, action, cause) => ({ key: deviceId + "|" + rule + "|" + (ts || 0), deviceId, rule, name, sev, ts, value, detail, action, cause });
  (devices || []).forEach((d) => {
    const chrono = [...((histByDevice && histByDevice[d.deviceId]) || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastTs = chrono.length ? new Date(chrono[chrono.length - 1].timestamp).getTime() : (d.timestamp ? new Date(d.timestamp).getTime() : null);
    // Only flag DEAD on a real, stale last-seen — never on a null timestamp
    // (that just means history hasn't loaded yet; avoids false positives that
    // would otherwise be persisted permanently into the log).
    if (lastTs != null) { const ageH = (now - lastTs) / 3600000; if (ageH > 24) events.push(mk(d.deviceId, "DEAD", "Dead device", "critical", lastTs, `${Math.round(ageH)}h since last ping`, "No telemetry received for over 24 hours.", "Dispatch a technician — check power, SIM/connectivity and the sensor unit.", "Power loss, network/SIM drop, or a failed sensor board.")); }
    if (!iotIsTank(d)) return;
    let prev = null; const tdsWin = [];
    chrono.forEach((it) => {
      const ts = new Date(it.timestamp).getTime();
      const ph = iotWqNum(it.waterQuality?.ph), tds = iotWqNum(it.waterQuality?.tds), tp = iotWqNum(it.waterQuality?.temp), tank = iotTank(it.tankLevel).pct;
      if (ph != null) { if (ph < 6.0 || ph > 9.0) events.push(mk(d.deviceId, "PH_CRIT", "Critical pH out of bounds", "critical", ts, `pH ${ph.toFixed(1)}`, "pH beyond the safe 6.0–9.0 band (BR-PH-01).", "Emergency: divert flow, inspect chemical dosing.", "Dosing failure or acid/alkali intrusion.")); else if (ph < 6.5 || ph > 8.5) events.push(mk(d.deviceId, "PH_OOR", "pH out of range", "high", ts, `pH ${ph.toFixed(1)}`, "pH outside the ideal 6.5–8.5 band.", "Check dosing and source water.", "Dosing drift or a source-water shift.")); }
      if (tds != null) { if (tds > 600) events.push(mk(d.deviceId, "TDS_SPIKE", "High TDS contamination spike", "high", ts, `${Math.round(tds)} mg/L`, "TDS above 600 mg/L (BR-TDS-01).", "Divert to waste; check RO membrane / filtration.", "RO membrane breakdown, scaling, or contamination.")); else if (tds > 500) events.push(mk(d.deviceId, "TDS_OOR", "TDS out of safe range", "high", ts, `${Math.round(tds)} mg/L`, "TDS above the 500 mg/L safe limit.", "Check filtration / RO membrane.", "Membrane wear or high mineral load.")); if (tds < 30) events.push(mk(d.deviceId, "TDS_DROP", "Sudden TDS drop (dilution)", "medium", ts, `${Math.round(tds)} mg/L`, "TDS below 30 mg/L (BR-TDS-02).", "Schedule calibration; check for line breaks.", "Over-purification, dilution, or a disconnected sensor.")); }
      if (tp != null && (tp < 10 || tp > 32)) events.push(mk(d.deviceId, "TEMP_OOR", "Temperature out of range", "high", ts, `${tp.toFixed(1)} °C`, "Water temperature beyond 10–32 °C.", "Inspect heat source / ambient exposure.", "Heat-exchanger fault, solar heating, or cold influx."));
      if (prev) { const gapMin = (ts - prev.ts) / 60000; if (gapMin > 0 && gapMin <= 15) {
        if (ph != null && prev.ph != null && Math.abs(ph - prev.ph) > 0.8) events.push(mk(d.deviceId, "PH_DRIFT", "pH rapid drift", "high", ts, `Δ${(ph - prev.ph).toFixed(1)} in ${Math.round(gapMin)}m`, "pH moved > 0.8 within minutes (BR-PH-02).", "Flag chemical-dosing failure; inspect feed pumps.", "Dosing-pump failure."));
        if (ph != null && prev.ph != null && tds != null && prev.tds != null && (ph - prev.ph) < -0.5 && (tds - prev.tds) > 150) events.push(mk(d.deviceId, "COR_ACID", "Acid / industrial intrusion", "critical", ts, `pH ↓${(prev.ph - ph).toFixed(1)}, TDS ↑${Math.round(tds - prev.tds)}`, "pH crashed while TDS surged — the classic contaminant signature (BR-COR-01).", "Auto-shutdown intake; emergency site inspection.", "Acid or industrial contaminant intrusion."));
        if (tank != null && prev.tank != null && (prev.tank - tank) >= 25 && gapMin <= 60) events.push(mk(d.deviceId, "TANK_DROP", "Tank level dropped drastically", "high", ts, `${prev.tank}%→${tank}% in ${Math.round(gapMin)}m`, "Tank fell ≥ 25% in a short span.", "Check for a leak/burst or stuck valve; verify the pump.", "Leak/burst, valve failure, or abnormal draw."));
      } }
      tdsWin.push(tds); if (tdsWin.length > 24) tdsWin.shift();
      prev = { ts, ph, tds, tp, tank };
    });
    const vals = tdsWin.filter((v) => v != null);
    if (vals.length >= 20) { const m = vals.reduce((s, v) => s + v, 0) / vals.length; const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length); if (sd < 0.5) events.push(mk(d.deviceId, "FLATLINE", "Sensor frozen / flatline", "medium", lastTs, "σ ≈ 0", "TDS hasn't varied across many samples (BR-SYS-01).", "Raise a 'sensor frozen' ticket; watchdog reboot.", "Frozen ADC or a stuck sensor probe.")); }
  });
  return events;
}
// Persistent local anomaly log (localStorage) — upsert by stable key, so alerts
// survive after the live data window slides past them. Capped to 2000 / 45 days.
// (Later this can be POSTed to Firebase; for now it's the local capture table.)
export const IOT_ALERT_LOG_LS = "pw_iot_alert_log";
export function iotLogAlerts(events) {
  let store = {};
  try { const o = JSON.parse(localStorage.getItem(IOT_ALERT_LOG_LS) || "{}"); if (o && typeof o === "object") store = o; } catch { store = {}; }
  const nowIso = new Date().toISOString();
  (events || []).forEach((e) => { if (!e.key) return; if (store[e.key]) store[e.key].lastLoggedAt = nowIso; else store[e.key] = { ...e, firstLoggedAt: nowIso, lastLoggedAt: nowIso }; });
  let arr = Object.values(store);
  const cutoff = Date.now() - 45 * 86400000;
  arr = arr.filter((a) => a.ts == null || a.ts >= cutoff).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (arr.length > 2000) arr = arr.slice(0, 2000);
  const next = {}; arr.forEach((a) => { next[a.key] = a; });
  try { localStorage.setItem(IOT_ALERT_LOG_LS, JSON.stringify(next)); } catch { /* quota */ }
  return arr;
}
export function iotClearAlertLog() { try { localStorage.removeItem(IOT_ALERT_LOG_LS); } catch { /* ignore */ } }
export function IoTAlertsPage() {
  const { user } = useAuth();
  const [roster, setRoster] = useState([]);
  const [hist, setHist] = useState({});
  const [sevF, setSevF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [showSignals, setShowSignals] = useState(false);

  const ALERTS_PER_PAGE = 6;

  useEffect(() => {
    api.logView(user.username, "Viewed IoT Alerts");
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${IOT_API_BASE}/devices/status`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const ids = Array.from(new Set([...list.map((d) => d.deviceId), ...IOT_KNOWN_TANK_DEVICES]));
        if (alive) setRoster(list.length ? list : ids.map((id) => ({ deviceId: id, deviceType: "RO Tank" })));
        const results = await Promise.all(ids.map(async (id) => { try { const r = await fetch(`${IOT_API_BASE}/devices/history?deviceId=${id}`); const j = await r.json(); return [id, Array.isArray(j) ? j : (j?.items ?? [])]; } catch { return [id, []]; } }));
        if (alive) setHist((prev) => { const n = { ...prev }; results.forEach(([id, arr]) => { if (arr && arr.length) n[id] = arr; }); return n; });
      } catch { /* keep prior */ }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const devices = useMemo(() => { const ids = Array.from(new Set([...roster.map((d) => d.deviceId), ...IOT_KNOWN_TANK_DEVICES])); return ids.map((id) => iotMergeLatest(roster.find((d) => d.deviceId === id) || { deviceId: id, deviceType: "RO Tank" }, hist[id])); }, [roster, hist]);
  const [alerts, setAlerts] = useState(() => iotLogAlerts([]));
  useEffect(() => { setAlerts(iotLogAlerts(iotAnomalyEvents(devices, hist))); }, [devices, hist]);
  const clearLog = () => { iotClearAlertLog(); setAlerts([]); };

  const bySev = { critical: 0, high: 0, medium: 0 };
  alerts.forEach((a) => { bySev[a.sev] = (bySev[a.sev] || 0) + 1; });
  const deadN = alerts.filter((a) => a.rule === "DEAD").length;
  const contamN = alerts.filter((a) => ["PH_CRIT", "TDS_SPIKE", "COR_ACID", "TDS_OOR", "PH_OOR"].includes(a.rule)).length;

  const byType = {};
  alerts.forEach((a) => { byType[a.name] = (byType[a.name] || 0) + 1; });
  const typeRows = Object.entries(byType).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  const TYPES = [["all", "All Types"], ...typeRows.map((t) => [t.name, t.name])];

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      const matchSev = sevF === "all" || a.sev === sevF;
      const matchType = typeF === "all" || a.name === typeF;
      const matchQuery = !searchQ || (a.deviceId || "").toLowerCase().includes(searchQ.toLowerCase()) || (a.name || "").toLowerCase().includes(searchQ.toLowerCase()) || (a.detail || "").toLowerCase().includes(searchQ.toLowerCase());
      return matchSev && matchType && matchQuery;
    });
  }, [alerts, sevF, typeF, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ALERTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAlerts = filtered.slice((currentPage - 1) * ALERTS_PER_PAGE, currentPage * ALERTS_PER_PAGE);

  const kpis = [
    { l: "Open alerts", v: String(alerts.length), c: alerts.length ? "#DC4141" : "#08805A" },
    { l: "Critical", v: String(bySev.critical), c: bySev.critical ? "#DC4141" : "#666" },
    { l: "Dead devices", v: String(deadN), c: deadN ? "#DC4141" : "#08805A" },
    { l: "Contamination", v: String(contamN), c: contamN ? "#F59E0B" : "#08805A" },
  ];

  return (
    <div className="fade-up ov-sans" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Top 4 KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ ...IOT_CARD, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginTop: 2 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{ ...IOT_CARD, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 280 }}>
          <input
            type="text"
            placeholder="Search alerts or device ID..."
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
            style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", fontSize: 12, outline: "none", width: 200 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "critical", "high", "medium"].map((sev) => {
              const active = sevF === sev;
              const label = sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1);
              return (
                <button
                  key={sev}
                  onClick={() => { setSevF(sev); setPage(1); }}
                  style={{
                    fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${active ? "#08805A" : "rgba(0,0,0,0.1)"}`,
                    background: active ? "#08805A" : "#fff", color: active ? "#fff" : "#475569"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }} style={{ ...selectStyle, padding: "4px 8px", fontSize: 11.5 }}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {alerts.length > 0 && (
          <button onClick={clearLog} style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", color: "#DC4141", cursor: "pointer" }}>
            Clear log
          </button>
        )}
      </div>

      {/* Paginated Compact Alert Cards */}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {paginatedAlerts.map((a, i) => {
          const s = IOT_ALERT_SEV[a.sev] || IOT_ALERT_SEV.medium;
          const isExp = expandedId === `${a.deviceId}_${i}`;
          return (
            <div key={i} style={{ ...IOT_CARD, padding: "10px 14px", borderLeft: `4px solid ${s.c}`, transition: ".15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }} onClick={() => setExpandedId(isExp ? null : `${a.deviceId}_${i}`)}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, color: s.c, background: s.bg, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 750, color: "#1D1D1F" }}>{a.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{a.value}</span>
                <span style={{ fontSize: 11.5, color: "#86868B", marginLeft: "auto" }}>{a.deviceId}</span>
                <span style={{ fontSize: 11.5, color: "#86868B" }}>{a.ts ? iotStamp(a.ts) : "—"}</span>
                <span style={{ fontSize: 11, color: "#08805A", fontWeight: 700 }}>{isExp ? "▲ Less" : "▼ Details"}</span>
              </div>
              {isExp && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#475569" }}>
                  <div>{a.detail}</div>
                  <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
                    <div><b style={{ color: "#08805A" }}>Action:</b> {a.action}</div>
                    <div style={{ color: "#86868B" }}><b>Likely cause:</b> {a.cause}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ ...IOT_CARD, padding: 20, textAlign: "center", color: "#08805A", fontWeight: 600 }}>
            ✓ No anomaly alerts match this filter.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "#86868B" }}>Showing {paginatedAlerts.length} of {filtered.length} alerts</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", cursor: currentPage <= 1 ? "default" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1, fontSize: 12 }}>
              ← Prev
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1D1D1F" }}>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", cursor: currentPage >= totalPages ? "default" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1, fontSize: 12 }}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Understanding Signals Footer */}
      <div style={{ ...IOT_CARD, padding: "10px 14px", background: "#F6FAF8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setShowSignals(!showSignals)}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Understanding Anomaly Signals</span>
          <span style={{ fontSize: 11, color: "#08805A", fontWeight: 700 }}>{showSignals ? "▲ Hide" : "▼ Show Help Guide"}</span>
        </div>
        {showSignals && (
          <div style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.55, display: "grid", gap: 4, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <div>• <b>TDS drifts with temperature</b> (~2%/°C) — a warm-afternoon TDS rise can be thermal, not contamination.</div>
            <div>• <b>Acid intrusion signature:</b> pH crashing while TDS surges together is treated as Critical.</div>
            <div>• <b>Low-TDS water has no buffer:</b> pH volatility on low-TDS lines is often benign.</div>
            <div>• A <b>flatline</b> (zero variance) usually means a frozen sensor, worth a reboot/recalibration.</div>
          </div>
        )}
      </div>
    </div>
  );
}
// Full-panel loading state for the IoT module — shown until BOTH the device
// roster AND the first device-history round-trip have landed. Without waiting
// for history too, the module used to flash the device list with an empty
// tank/gauges/"Awaiting sensor readings" state for a beat before real numbers
// arrived. Self-contained (spinner + indeterminate progress bar), no external
// gif asset.
export function IoTLoading() {
  return (
    <Loading
      title="Loading Live Device Telemetry"
      subtitle="Connecting to IoT Core and synchronizing device sensor history…"
      showSkeleton={true}
    />
  );
}



function IoTDiurnalDemandChart({ avgTds = 28, avgPh = 7.4, style = {} }) {
  const hourlyData = [
    { hour: "00:00", draw: 2, period: "night" },
    { hour: "02:00", draw: 1, period: "night" },
    { hour: "04:00", draw: 4, period: "night" },
    { hour: "06:00", draw: 28, period: "morning" },
    { hour: "08:00", draw: 48, period: "morning" },
    { hour: "10:00", draw: 18, period: "morning" },
    { hour: "12:00", draw: 22, period: "afternoon" },
    { hour: "14:00", draw: 16, period: "afternoon" },
    { hour: "16:00", draw: 24, period: "afternoon" },
    { hour: "18:00", draw: 38, period: "evening" },
    { hour: "20:00", draw: 42, period: "evening" },
    { hour: "22:00", draw: 12, period: "evening" },
  ];

  const PERIOD_COLORS = {
    night: { bg: "linear-gradient(180deg, #6366F1, #4338CA)", text: "#4338CA" },
    morning: { bg: "linear-gradient(135deg, #1E9E4F, #C4E538)", text: "#08805A" },
    afternoon: { bg: "linear-gradient(180deg, #F59E0B, #D97706)", text: "#D97706" },
    evening: { bg: "linear-gradient(180deg, #38BDF8, #0284C7)", text: "#0284C7" },
  };

  const total24h = hourlyData.reduce((s, h) => s + h.draw * 2, 0);

  return (
    <div style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 20, padding: 22, boxShadow: "0 10px 30px rgba(0,0,0,.03)", ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Demand Analytics</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1D1D1F", margin: "2px 0 0" }}>24-Hour Diurnal Demand Pattern &amp; Water Quality</h3>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: "#4338CA", background: "rgba(99,102,241,0.12)", padding: "4px 9px", borderRadius: 999 }}>Night: 00:00 – 05:59</span>
          <span style={{ color: "#08805A", background: "rgba(8,128,90,0.12)", padding: "4px 9px", borderRadius: 999 }}>Morning: 06:00 – 11:59</span>
          <span style={{ color: "#D97706", background: "rgba(245,158,11,0.14)", padding: "4px 9px", borderRadius: 999 }}>Afternoon: 12:00 – 17:59</span>
          <span style={{ color: "#0284C7", background: "rgba(2,132,199,0.12)", padding: "4px 9px", borderRadius: 999 }}>Evening: 18:00 – 23:59</span>
          <span style={{ color: "#08805A", background: "rgba(8,128,90,0.12)", padding: "4px 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}>🧪 Avg TDS: <strong style={{ color: "#08805A" }}>{avgTds} mg/L</strong></span>
          <span style={{ color: "#0284C7", background: "rgba(2,132,199,0.12)", padding: "4px 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}>💧 Avg pH: <strong style={{ color: "#0284C7" }}>{avgPh}</strong></span>
        </div>
      </div>

      <div style={{ height: 150, display: "flex", alignItems: "flex-end", gap: 10, padding: "10px 0 0" }}>
        {hourlyData.map((h, i) => {
          const heightPct = Math.round((h.draw / 50) * 100);
          const pCol = PERIOD_COLORS[h.period] || PERIOD_COLORS.morning;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: pCol.text, marginBottom: 4 }}>{h.draw}L</span>
              <div style={{ width: "100%", height: `${heightPct}%`, background: pCol.bg, borderRadius: "6px 6px 0 0", transition: "height .4s ease" }} />
              <span style={{ fontSize: 10, color: "#86868B", marginTop: 6, fontWeight: 600 }}>{h.hour}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#86868B", flexWrap: "wrap", gap: 8 }}>
        <span>24h Total Draw: <strong style={{ color: "#1D1D1F" }}>{total24h} Liters</strong></span>
        <span>Peak Flow: <strong style={{ color: "#08805A" }}>48 L/h (08:00 AM)</strong></span>
        <span>Avg TDS: <strong style={{ color: "#08805A" }}>{avgTds} mg/L</strong> (Optimal Pure)</span>
        <span>Avg pH: <strong style={{ color: "#0284C7" }}>{avgPh} pH</strong> (Balanced Neutral)</span>
      </div>
    </div>
  );
}



export function IoTDevices() {
  const { user } = useAuth();
  const [roster, setRoster] = useState([]);            // from /devices/status (device roster + fallback metadata)
  const [historyByDevice, setHistoryByDevice] = useState({}); // deviceId -> [heartbeats] (newest-first, live)
  const [weather, setWeather] = useState(null); // Prabhavati live weather + 24h history (for the correlation)
  const [histRangeByDevice, setHistRangeByDevice] = useState({}); // selected device -> ~62-day window (Trend analysis + Total Dispensed)
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false); // first /devices/history round-trip done (any outcome)
  const [err, setErr] = useState("");
  const [hbPage, setHbPage] = useState(1); // Recent heartbeats pagination (20 rows/page)
  // Shared date-range filter — Today / Yesterday / This Week / This Month / Last
  // Month — drives BOTH the Total Dispensed stat (RO Unit Sensors card, above)
  // and Trend analysis / Recent readings (below), via iotFilterByRange.
  const [range, setRange] = useState("today");

  // Reset to the first page whenever a different device is selected.
  useEffect(() => { setHbPage(1); }, [selected]);

  // Demand-driven weather: fetch once when the module opens, then refresh every
  // 30 min (the proxy caches 60 min, so this only hits Google ~hourly at most).
  useEffect(() => {
    let alive = true;
    weatherApi.get().then((w) => { if (alive) setWeather(w); });
    const t = setInterval(() => weatherApi.get(true).then((w) => { if (alive) setWeather(w); }), 30 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // NOTE: the per-device `&days=1` / `&days=2` history polls were removed — they
  // returned the SAME data as the bare /devices/history?deviceId= feed below, so
  // the tank level, water quality, Recent readings and 12-hour consumption all
  // read from `historyByDevice` (the bare feed) directly.

  // Selected device — pull a ~62-day history window for Trend analysis AND the
  // Total Dispensed stat (the Today/Yesterday/Week/Month/Last-Month filter
  // slices it — 62 days safely covers "Last Month" no matter where in the
  // current month "today" falls). Slow-changing, so poll every 5 min.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${IOT_API_BASE}/devices/history?deviceId=${selected}&days=62`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data?.items ?? []);
        if (alive && arr.length) setHistRangeByDevice((p) => ({ ...p, [selected]: arr }));
      } catch { /* keep prior; Trend falls back to the live window */ }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [selected]);

  // Poll device roster every 10s (which devices exist + fallback metadata).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${IOT_API_BASE}/devices/status`);
        const data = await res.json();
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setRoster(list); setErr("");
        // Prefer a known RO-tank device on first load so the tank + water-quality view shows.
        const known = IOT_KNOWN_TANK_DEVICES[0];
        setSelected(prev => prev || known || (list[0]?.deviceId ?? null));
      } catch { if (alive) setErr("Could not reach the IoT device API."); }
      finally { if (alive) setLoading(false); }
    };
    api.logView(user.username, "Viewed IoT devices");
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Poll /history for EVERY device in the roster every 8s. This is the source of
  // truth for liveness — /status ships a stale (often day-old) timestamp, so live
  // devices were showing Offline. The endpoint returns { items:[…] } (newest-first,
  // downsampled) — unwrap it, else the heartbeat table / live consumption / charts
  // / tank + water-quality / 12-hour consumption all go blank (they all read off
  // this one feed now that the redundant &days=1 / &days=2 polls were removed).
  // Poll history for the roster PLUS any always-on known tank devices (which the
  // /status snapshot may omit), so their tank + water-quality readings load.
  const deviceIdsKey = Array.from(new Set([...roster.map(d => d.deviceId), ...IOT_KNOWN_TANK_DEVICES])).join(",");
  useEffect(() => {
    if (!deviceIdsKey) return;
    const ids = deviceIdsKey.split(",");
    let alive = true;
    const load = async () => {
      const results = await Promise.all(ids.map(async (id) => {
        try {
          const res = await fetch(`${IOT_API_BASE}/devices/history?deviceId=${id}`);
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data?.items ?? null);
          return [id, items];
        } catch { return [id, null]; }
      }));
      if (!alive) return;
      setHistoryByDevice(prev => {
        const next = { ...prev };
        for (const [id, data] of results) if (data) next[id] = data;
        return next;
      });
      setHistoryLoaded(true); // flip once the first round-trip lands, success or not — don't spin forever
    };
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [deviceIdsKey]);

  // Seed known RO-tank devices the /status snapshot may not list, so they're
  // always selectable; the history poll above fills in their live readings.
  const rosterIds = new Set(roster.map(d => d.deviceId));
  const fullRoster = [
    ...roster,
    ...IOT_KNOWN_TANK_DEVICES.filter(id => !rosterIds.has(id)).map(id => ({ deviceId: id, deviceType: "RO Tank" })),
  ];
  // Merge the freshest heartbeat over each roster device → live timestamp/pressure/channels.
  const devices = fullRoster.map(d => iotMergeLatest(d, historyByDevice[d.deviceId]));
  const device = devices.find(d => d.deviceId === selected);
  const channels = device?.payload?.units?.[0]?.channels ?? [];

  // ---- RO-tank level + water quality (from the days=1 window, falling back to the live poll).
  const isTank = iotIsTank(device);
  const wqItems = historyByDevice[selected] ?? [];
  const tank = iotTank(device?.tankLevel ?? wqItems[0]?.tankLevel);
  const wqRange = useMemo(() => iotWqRange(wqItems), [wqItems]);
  // Total Dispensed is scoped to the shared date-range filter (falls back to the
  // short live window if the ~62-day fetch hasn't landed yet).
  const dispensedItems = useMemo(() => iotFilterByRange(histRangeByDevice[selected] ?? wqItems, range), [histRangeByDevice, selected, wqItems, range]);
  const dispensed = useMemo(() => iotDispensedRange(dispensedItems), [dispensedItems]);

  const history = historyByDevice[selected] ?? []; // newest-first
  const chrono = useMemo(() => [...history].reverse(), [history]); // oldest-first, for time-series charts
  const tankRefilling = useMemo(() => isTank && iotTankRefilling(chrono), [isTank, chrono]);
  const tankWarming = useMemo(() => isTank && iotTempWarming(chrono), [isTank, chrono]);
  // Recent heartbeats pagination — 20 rows per page.
  const HB_PER_PAGE = 10;
  const hbTotalPages = Math.max(1, Math.ceil(history.length / HB_PER_PAGE));
  const hbPageClamped = Math.min(hbPage, hbTotalPages);
  const hbRows = history.slice((hbPageClamped - 1) * HB_PER_PAGE, hbPageClamped * HB_PER_PAGE);
  // Channel ids present anywhere in this device's history (handles 2- vs 4-channel units).
  const chanIds = Array.from(new Set(
    chrono.flatMap(h => (h.payload?.units?.[0]?.channels ?? []).map(c => c.channelId))
  )).sort();
  const chartData = chrono.map(item => {
    const chs = item.payload?.units?.[0]?.channels ?? [];
    const row = { time: iotClock(item.timestamp), pressure: parseFloat(item.payload?.inputPressure ?? 0) };
    chanIds.forEach(id => { row["flow_" + id] = parseFloat(chs.find(c => c.channelId === id)?.flowRateLpm ?? 0); });
    return row;
  });

  const online = devices.filter(d => iotOnlineFor(d)).length;
  const faulty = devices.filter(d => (d.payload?.units?.[0]?.channels ?? []).some(c => c.fault)).length;

  // ---- Fault & alert center: aggregate offline devices + channel faults across the fleet.
  const alerts = [];
  devices.forEach(d => {
    if (!iotOnlineFor(d)) {
      alerts.push({ key: `off:${d.deviceId}`, sev: "critical", device: d.deviceId, title: "Device offline", detail: `No heartbeat · last seen ${iotTimeAgo(d.timestamp)}` });
    }
    (d.payload?.units?.[0]?.channels ?? []).forEach(c => {
      if (c.fault) alerts.push({ key: `flt:${d.deviceId}:${c.channelId}:${c.fault}`, sev: "warning", device: d.deviceId, title: "Channel fault", detail: `${c.channelId} — ${c.fault}` });
    });
  });
  alerts.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === "critical" ? -1 : 1));

  // Toast when a NEW alert appears mid-session (skip the initial set on first load).
  const alertKeys = alerts.map(a => a.key).join("|");
  const prevAlertKeysRef = useRef(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const prev = prevAlertKeysRef.current;
    if (prev !== null) {
      const prevSet = new Set(prev ? prev.split("|") : []);
      const fresh = (alertKeys ? alertKeys.split("|") : []).filter(k => k && !prevSet.has(k));
      if (fresh.length) { setToast(`⚠ ${fresh.length} new alert${fresh.length > 1 ? "s" : ""} detected`); const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }
    }
    prevAlertKeysRef.current = alertKeys;
  }, [alertKeys]);

  // 12-hour consumption breakdown over the last 2 days (IST) for the selected device.
  const buckets2d = useMemo(() => iotBuckets12h(historyByDevice[selected]), [historyByDevice, selected]);

  // ---- KPI status cards with mockup-matched decorative waveforms
  const kpiCards = [
    { label: "Total devices", value: devices.length, sub: "monitored", icon: Cpu, hero: true, wave: "ecg", wc: "#7FE3BE", wo: 0.5 },
    { label: "Online", value: online, sub: "recently reporting", icon: CheckCircle2, wave: "bars", wc: "#08805A", wo: 0.6 },
    { label: "Offline", value: devices.length - online, sub: "no recent ping", icon: AlertCircle, offline: true, wave: "ripple", wc: "#DC4141", wo: 0.3 },
    { label: "With faults", value: faulty, sub: "channel fault active", icon: ShieldCheck, faulty: true, wave: "ripple", wc: "#986315", wo: 0.42 },
  ];

  if (loading || !historyLoaded) return <IoTLoading />;

  const softShadow = { background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.03)" };

  // Recent-heartbeats page list (1 2 … 50 style).
  const pager = (() => {
    const total = hbTotalPages, cur = hbPageClamped, out = [];
    if (total <= 7) { for (let p = 1; p <= total; p++) out.push(p); return out; }
    out.push(1);
    if (cur > 3) out.push("…l");
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) out.push(p);
    if (cur < total - 2) out.push("…r");
    out.push(total);
    return out;
  })();

  // Fleet health macro metrics
  const fleetUptime = devices.length ? Math.round((online / devices.length) * 1000) / 10 : 100;
  const avgPressure = devices.length ? (devices.reduce((s, d) => s + parseFloat(d.payload?.inputPressure || 0), 0) / devices.length).toFixed(1) : "0.0";

  const exportTelemetryCsv = () => {
    if (!history || !history.length) return;
    exportToCsv(`telemetry-${selected || "device"}.csv`, [
      { label: "Timestamp", get: h => iotStamp(h.timestamp) },
      { label: "Pressure (bar)", get: h => h.payload?.inputPressure ?? "" },
      ...chanIds.map(id => ({
        label: `${id} Volume (L)`,
        get: h => (h.payload?.units?.[0]?.channels ?? []).find(c => c.channelId === id)?.totalVolumeLitres ?? ""
      })),
      { label: "Faults", get: h => (h.payload?.units?.[0]?.channels ?? []).map(c => c.fault).filter(Boolean).join("; ") }
    ], history);
  };

  return (
    <div className="fade-up ov-sans">
      <style>{`
        .ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}
        @media(max-width:900px){.iot-grid{grid-template-columns:1fr!important}.iot-tankwq{grid-template-columns:1fr!important}}
        @keyframes iotFlowPulse{0%,100%{opacity:.35}50%{opacity:1}}
        .iot-flow-dot{animation:iotFlowPulse 1.1s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.iot-flow-dot{animation:none}}
        ${IOT_TANK_CSS}
      `}</style>

      {/* Fleet Macro Health & Weather Banner */}
      <IoTWeatherCard weather={weather} />

      {/* Fleet Macro Uptime Strip (Point 1) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 16, background: "rgba(243,248,236,.6)", padding: "14px 18px", borderRadius: 18, border: "1px solid rgba(8,128,90,0.15)" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Fleet Uptime</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 2 }}>{fleetUptime}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Avg Line Pressure</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F", marginTop: 2 }}>{avgPressure} <span style={{ fontSize: 13, color: "#86868B" }}>bar</span></div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Active Monitored Fleet</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 2 }}>{online}/{devices.length} <span style={{ fontSize: 12, color: "#86868B" }}>online</span></div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Active Fault Alerts</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: faulty > 0 ? "#986315" : "#08805A", marginTop: 2 }}>{faulty}</div>
        </div>
      </div>

      {err && <ApiError msg={err} />}
      {toast && <div style={{ ...toastStyle, background: "#DC4141" }}><AlertCircle size={16} /> {toast}</div>}

      {/* ── status KPI cards ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {kpiCards.map((k) => {
          const hero = k.hero, off = k.offline, flt = k.faulty;
          // v2.29.274: hero no longer gets its own gradient/color branch — per
          // explicit user request to make all hero cards the same white style
          // as normal cards, it just falls through to the same values the
          // plain (non-off, non-faulty) case already used.
          const bg = off ? "rgba(220, 38, 38, 0.05)" : flt ? "rgba(152, 99, 21, 0.05)" : "rgba(255, 255, 255, 0.85)";
          const bd = off ? "1px solid rgba(220, 38, 38, 0.18)" : flt ? "1px solid rgba(152, 99, 21, 0.18)" : "1px solid rgba(0,0,0,0.08)";
          const labelC = off ? "#DC4141" : flt ? "#986315" : "#86868B";
          const valueC = off ? "#DC4141" : flt ? "#986315" : "#1D1D1F";
          const subC = off ? "#DC4141" : flt ? "#986315" : "#86868B";
          const iconC = off ? "#DC4141" : flt ? "#986315" : "#08805A";
          const iconBg = off ? "rgba(220,38,38,.12)" : flt ? "rgba(152,99,21,.12)" : "rgba(8,128,90,.12)";
          const shadow = "0 10px 30px rgba(0, 0, 0, 0.03)";
          return (
            <div key={k.label} style={{ position: "relative", overflow: "hidden", background: bg, border: bd, borderRadius: 18, boxShadow: shadow, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", padding: 18, minHeight: 120, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: labelC }}>{k.label}</span>
                <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: iconBg, color: iconC }}><k.icon size={17} /></span>
              </div>
              <div className="serif" style={{ fontSize: 30, color: valueC, fontWeight: 700, margin: "9px 0 2px", lineHeight: 1, position: "relative", zIndex: 1 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: subC, position: "relative", zIndex: 1 }}>{k.sub}</div>
              {k.label === "Online" ? <IoTEcg alive={online > 0} /> : k.label === "Offline" ? <IoTEcg alive={false} /> : <IoTWave kind={k.wave} color={k.wc} opacity={k.wo} />}
            </div>
          );
        })}
      </div>

      {/* ── status KPI cards ───────────────────────────────────────────────── */}

      {/* ── device list + detail ───────────────────────────────────────────── */}
      {(() => {
        const deviceListCard = (
          <div style={{ ...softShadow, overflow: "hidden", alignSelf: "start" }}>
            <div style={{ padding: "18px 20px 10px" }}><h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Devices ({devices.length})</h3></div>
            <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {devices.map(d => {
                const on = iotOnlineFor(d), isSel = selected === d.deviceId;
                return (
                  <button key={d.deviceId} onClick={() => setSelected(d.deviceId)} style={{
                    textAlign: "left", padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                    border: `${isSel ? 2 : 1}px solid ${isSel ? "#08805A" : "rgba(0,0,0,0.08)"}`,
                    background: isSel ? "rgba(8,128,90,0.08)" : "#fff", transition: ".15s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.01em" }}>{d.deviceId}</span>
                      <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: on ? "#08805A" : "#DC4141", background: on ? "rgba(8,128,90,0.12)" : "rgba(220,38,38,0.12)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? "#08805A" : "#DC4141" }} />{on ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#86868B" }}>{[d.roUnitId, d.deviceType].filter(Boolean).join(" · ") || (iotIsTank(d) ? "RO Tank sensor" : "Device")} · FW {d.firmwareVersion || d.FIRMWARE_VERSION || "—"}</div>
                    <div style={{ fontSize: 11.5, color: "#86868B", marginTop: 2 }}>Last seen: {iotTimeAgo(d.timestamp)}</div>
                    <div style={{ fontSize: 11.5, color: "#08805A", fontWeight: 700, marginTop: 2 }}>{iotIsTank(d) ? `Tank ${iotTank(d.tankLevel).pct}% full` : `${d.payload?.inputPressure ?? 0} bar pressure`}</div>
                  </button>
                );
              })}
              {devices.length === 0 && <Empty msg="No devices found." />}
            </div>
          </div>
        );

        return (
          <div className="iot-monitor-grid" style={{ display: "grid", gridTemplateColumns: "230px minmax(340px, 520px) minmax(280px, 1fr)", gap: 16, alignItems: "stretch" }}>
            {deviceListCard}

            {isTank ? (
              <IoTTankPanel device={device} tank={tank} refilling={tankRefilling} warming={tankWarming} dispensed={dispensed} range={range} setRange={setRange} />
            ) : (
              <IoTJunctionBoxPanel device={device} channels={channels} />
            )}

            <div style={{ ...IOT_CARD, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              {isTank ? (
                <>
                  <IoTWaterQualityCard range={wqRange} title="Water Quality & Potability" subtitle="Live tank sensors" style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }} />
                  <div style={{ margin: "14px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }} />
                  <IoTWaterQualityCard range={wqRange} keys={["pressure", "flowMLPM"]} title="Hydraulics & Pressure" subtitle="Line pressure & dispense flow rate" style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }} />
                </>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 720, color: "#1D1D1F", margin: 0 }}>Channels & Valve Actuators</h3>
                    <span style={{ fontSize: 10.5, color: "#08805A", fontWeight: 700, background: "rgba(8,128,90,0.12)", padding: "2px 7px", borderRadius: 999 }}>{channels.length} Pipe Lines</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8b9a95", marginBottom: 12 }}>Active pipe valves & flow meters</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {channels.map((ch) => (
                      <div key={ch.channelId} style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: ch.fault ? "rgba(152,99,21,0.06)" : "rgba(8,128,90,0.06)", padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>{ch.channelId}</span>
                          <ValveBadge state={ch.valveState} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#475569", marginTop: 4 }}>
                          <span>Flow:</span>
                          <strong style={{ color: "#1D1D1F" }}>{ch.flowRateLpm} L/min</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                          <span>Volume:</span>
                          <strong style={{ color: "#1D1D1F" }}>{ch.totalVolumeLitres} L</strong>
                        </div>
                        {ch.fault && <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, color: "#986315", background: "rgba(152,99,21,0.12)", borderRadius: 6, padding: "3px 7px" }}>⚠ {ch.fault}</div>}
                      </div>
                    ))}
                    {channels.length === 0 && <Empty msg="No active channels reported." />}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── recent RO-tank readings (full width) ───────────────────────────── */}
      {device && isTank && <IoTTankReadings items={histRangeByDevice[selected] ?? wqItems} weather={weather} range={range} setRange={setRange} />}

      {/* ── consumption · last 2 days (12-hour blocks) ────────────────────────── */}
      {device && !isTank && (
        <div style={{ ...softShadow, marginTop: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 12px" }}>
            <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Consumption — Last 2 Days (12-hour blocks)</h3>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>{buckets2d
              ? `Litres drawn per channel in each 12-hour IST block · ${iotStamp(buckets2d.from)} → ${iotStamp(buckets2d.to)}`
              : "Water drawn per channel, split into morning (00:00–12:00) and evening (12:00–24:00) blocks."}</div>
          </div>
          {!buckets2d ? <div style={{ padding: "0 20px 20px" }}><Empty msg="Not enough 2-day history yet to break down consumption." /></div> : (() => {
            const { chanIds: cids, rows, totals, grand, dailyAvg, days } = buckets2d;
            const numTd = { padding: "14px 18px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "center" };
            const strong = { fontWeight: 700, color: "#1D1D1F" };
            return (
              <div className="scroll-thin" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                      {["12-hour block (IST)", ...cids, "Total"].map((h, idx) => (
                        <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", textAlign: idx === 0 ? "left" : "right", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const rowTot = cids.reduce((s, id) => s + r.byChan[id], 0);
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                          <td style={{ padding: "14px 18px", whiteSpace: "nowrap", textAlign: "center", color: "#1D1D1F" }}>{r.b.label}</td>
                          {cids.map(id => <td key={id} style={numTd}>{iotVolL(r.byChan[id])}</td>)}
                          <td style={{ ...numTd, ...strong }}>{iotVolL(rowTot)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid rgba(0,0,0,.08)", background: "rgba(243,248,236,.6)" }}>
                      <td style={{ padding: "14px 18px", ...strong, textAlign: "center" }}>Total · last 2 days</td>
                      {cids.map(id => <td key={id} style={{ ...numTd, ...strong }}>{iotVolL(totals[id])}</td>)}
                      <td style={{ ...numTd, ...strong, color: "#08805A" }}>{iotVolL(grand)}</td>
                    </tr>
                    <tr style={{ background: "rgba(243,248,236,.4)" }}>
                      <td style={{ padding: "14px 18px", fontWeight: 600, color: "#475569", textAlign: "center" }}>Average per day <span style={{ color: "#86868B", fontWeight: 400 }}>· over {days.toFixed(2)} days</span></td>
                      {cids.map(id => <td key={id} style={{ ...numTd, fontWeight: 600, color: "#475569" }}>{iotVolL(dailyAvg[id])}</td>)}
                      <td style={{ ...numTd, fontWeight: 700, color: "#08805A" }}>{iotVolL(cids.reduce((s, id) => s + dailyAvg[id], 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Point 4: Recent Heartbeats with Export CSV button & Anomaly Indicators ─ */}
      {device && !isTank && (
        <div style={{ ...softShadow, marginTop: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Recent Heartbeats</h3>
              <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Total volume (litres) per channel · one row per heartbeat · refreshes every 8s.</div>
            </div>
            <button onClick={exportTelemetryCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, background: "#08805A", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              <Download size={14} /> Export Telemetry CSV
            </button>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Device Heartbeat", ...chanIds.map(id => `${id} · Total Vol`), "Fault / Anomaly"].map((h, idx) => (
                    <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", textAlign: idx === 0 ? "left" : idx === chanIds.length + 1 ? "left" : "right", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hbRows.map((item, i) => {
                  const chs = item.payload?.units?.[0]?.channels ?? [];
                  const byId = Object.fromEntries(chs.map(c => [c.channelId, c]));
                  const fault = chs.map(c => c.fault).filter(Boolean).join(", ");
                  const press = parseFloat(item.payload?.inputPressure ?? 0);
                  const isHighP = press > 4.5;
                  const isLowP = press > 0 && press < 1.0;
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", background: (fault || isHighP || isLowP) ? "rgba(152,99,21,0.06)" : "transparent" }}>
                      <td style={{ padding: "14px 18px", fontFamily: "-apple-system,SF Mono,monospace", fontSize: 12, color: "#86868B", whiteSpace: "nowrap" }}>{iotStamp(item.timestamp)}</td>
                      {chanIds.map(id => {
                        const c = byId[id];
                        return <td key={id} style={{ padding: "14px 18px", textAlign: "center", fontVariantNumeric: "tabular-nums", color: c?.fault ? "#986315" : "#1D1D1F" }}>{iotVolL(c?.totalVolumeLitres)}</td>;
                      })}
                      <td style={{ padding: "14px 18px", color: "#986315", fontWeight: 600 }}>
                        {fault ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(152,99,21,0.12)", color: "#986315" }}>⚠ {fault}</span> :
                         isHighP ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(220,38,38,0.12)", color: "#DC4141" }}>⚠ High Press ({press} bar)</span> :
                         isLowP ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(152,99,21,0.12)", color: "#986315" }}>⚠ Low Press ({press} bar)</span> : "—"}
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && <tr><td colSpan={chanIds.length + 2} style={{ padding: 0 }}><Empty msg="No heartbeats yet." /></td></tr>}
              </tbody>
            </table>
          </div>
          {history.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderTop: "1px solid rgba(0,0,0,.06)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#86868B" }}>
                Showing {(hbPageClamped - 1) * HB_PER_PAGE + 1}–{Math.min(hbPageClamped * HB_PER_PAGE, history.length)} of {history.length}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setHbPage(p => Math.max(1, p - 1))} disabled={hbPageClamped <= 1}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: hbPageClamped <= 1 ? "#c5c5c7" : "#1D1D1F", cursor: hbPageClamped <= 1 ? "not-allowed" : "pointer" }}>Prev</button>
                {pager.map((p, idx) => typeof p === "number" ? (
                  <button key={idx} onClick={() => setHbPage(p)} style={{ fontSize: 12.5, fontWeight: 700, minWidth: 32, padding: "6px 8px", borderRadius: 9, border: "1px solid " + (p === hbPageClamped ? "#08805A" : "rgba(0,0,0,0.12)"), background: p === hbPageClamped ? "#08805A" : "#fff", color: p === hbPageClamped ? "#fff" : "#1D1D1F", cursor: "pointer" }}>{p}</button>
                ) : <span key={idx} style={{ fontSize: 12.5, color: "#86868B", padding: "0 2px" }}>…</span>)}
                <button onClick={() => setHbPage(p => Math.min(hbTotalPages, p + 1))} disabled={hbPageClamped >= hbTotalPages}
                  style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: 9, border: "1px solid #08805A", background: hbPageClamped >= hbTotalPages ? "#fff" : "#08805A", color: hbPageClamped >= hbTotalPages ? "#c5c5c7" : "#fff", cursor: hbPageClamped >= hbTotalPages ? "not-allowed" : "pointer" }}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
