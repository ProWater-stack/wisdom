/**
 * Weather proxy — Google Cloud Function (2nd gen, HTTP).
 * Proxies the Google Maps Platform Weather API (history/hours:lookup), holds the
 * API key server-side, caches ~60 min per location, and returns a small
 * normalized shape the Wisdom2.0 dashboard consumes. No current-conditions call —
 * the newest history hour IS the live reading.
 *
 * Deploy (from this folder), pasting your restricted Weather-API key:
 *   gcloud functions deploy weather \
 *     --gen2 --runtime=nodejs20 --region=asia-south1 \
 *     --source=. --entry-point=weather \
 *     --trigger-http --allow-unauthenticated \
 *     --set-env-vars WEATHER_API_KEY=YOUR_RESTRICTED_KEY
 *
 * The printed URL (…cloudfunctions.net/weather or a run.app URL) is your route —
 * paste it into WEATHER_PROXY_URL in src/App.jsx.
 */

// Prabhavati — Garvebhavi Palya, Bengaluru 560068 (weather is regional, so the
// pincode-area coordinates are exact enough). Query ?lat=&lon= overrides these.
const DEFAULT = {
  name: "Prabhavati",
  address: "Ramayya Lyt, 28, 7th Main, 6th Cross, Garvebhavi Palya, Bengaluru, Karnataka 560068",
  lat: 12.8925,
  lon: 77.6320,
};
const TTL_MS = 60 * 60 * 1000; // 60-minute cache (hourly data — no point going faster)
const cache = new Map();        // "lat,lon" -> { at, data }

exports.weather = async (req, res) => {
  // CORS — the dashboard is a browser SPA on another origin.
  res.set("Access-Control-Allow-Origin", "*"); // tighten to your dashboard origin if you prefer
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  const lat = parseFloat(req.query.lat) || DEFAULT.lat;
  const lon = parseFloat(req.query.lon) || DEFAULT.lon;
  const ck = `${lat},${lon}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.set("X-Cache", "HIT");
    res.status(200).json({ ...hit.data, cachedAt: new Date(hit.at).toISOString() });
    return;
  }

  const key = process.env.WEATHER_API_KEY;
  if (!key) { res.status(500).json({ error: "WEATHER_API_KEY not set" }); return; }

  try {
    const url = "https://weather.googleapis.com/v1/history/hours:lookup"
      + `?key=${key}&location.latitude=${lat}&location.longitude=${lon}`
      + "&hours=24&unitsSystem=METRIC";
    const r = await fetch(url);
    if (!r.ok) throw new Error(`weather ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();

    // Tolerant mapping — Google returns { historyHours: [ … ] }.
    const hours = (j.historyHours || []).map((h) => ({
      t: (h.interval && (h.interval.startTime || h.interval.endTime)) || h.displayDateTime || null,
      tempC: h.temperature && typeof h.temperature.degrees === "number" ? h.temperature.degrees : null,
      humidity: typeof h.relativeHumidity === "number" ? h.relativeHumidity : null,
      feelsLikeC: h.feelsLikeTemperature && typeof h.feelsLikeTemperature.degrees === "number" ? h.feelsLikeTemperature.degrees : null,
      condition: (h.weatherCondition && ((h.weatherCondition.description && h.weatherCondition.description.text) || h.weatherCondition.type)) || null,
      iconUri: (h.weatherCondition && h.weatherCondition.iconBaseUri) || null,
    })).filter((x) => x.t);
    hours.sort((a, b) => new Date(a.t) - new Date(b.t)); // oldest -> newest

    const data = {
      location: { name: DEFAULT.name, address: DEFAULT.address, lat, lon },
      current: hours.length ? hours[hours.length - 1] : null, // newest hour = "live"
      history: hours,
      source: "google-weather-history",
    };
    cache.set(ck, { at: Date.now(), data });
    res.set("X-Cache", "MISS");
    res.status(200).json({ ...data, cachedAt: new Date().toISOString() });
  } catch (e) {
    // Serve stale on error if we have any, else surface the error.
    if (hit) {
      res.set("X-Cache", "STALE");
      res.status(200).json({ ...hit.data, cachedAt: new Date(hit.at).toISOString(), stale: true });
      return;
    }
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
