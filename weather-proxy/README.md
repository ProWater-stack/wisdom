# Weather proxy (Cloud Function)

Tiny HTTP proxy for the **Google Maps Platform Weather API** (`history/hours:lookup`).
It holds the API key server-side, caches ~60 min, and returns a normalized shape the
Wisdom2.0 dashboard consumes. No `currentConditions` call — the **newest history hour is
the live reading**.

## One-time setup
1. In Google Cloud (`backend-prowater`): **enable the "Weather API"** and create an API key
   **restricted to the Weather API** (Application restriction: IP addresses of this function's
   egress if you have a static one, otherwise None — the key never leaves the server).
2. Deploy from this folder:

   ```bash
   gcloud functions deploy weather \
     --gen2 --runtime=nodejs20 --region=asia-south1 \
     --source=. --entry-point=weather \
     --trigger-http --allow-unauthenticated \
     --set-env-vars WEATHER_API_KEY=YOUR_RESTRICTED_KEY
   ```

3. Copy the printed **URL** (e.g. `https://asia-south1-backend-prowater.cloudfunctions.net/weather`)
   and paste it into `WEATHER_PROXY_URL` in `src/App.jsx`. Done — the dashboard lights up.

## Contract
`GET /weather?lat=&lon=` (lat/lon optional; defaults to Prabhavati / Garvebhavi Palya) →

```json
{
  "location": { "name": "Prabhavati", "address": "…", "lat": 12.8925, "lon": 77.632 },
  "current":  { "t": "ISO", "tempC": 31.2, "humidity": 62, "feelsLikeC": 34.1, "condition": "Partly cloudy", "iconUri": "…" },
  "history":  [ { "t": "ISO-hour", "tempC": 30.1, "humidity": 64, "condition": "…" }, … up to 24 ],
  "cachedAt": "ISO",
  "source":   "google-weather-history"
}
```

## Notes
- **Cost:** ~10–24 calls/day for one location (60-min cache + demand-driven) — comfortably in the
  free tier. Cost scales with number of locations, not users.
- **CORS:** set to `*`; tighten `Access-Control-Allow-Origin` to your dashboard origin if you like.
- If the dashboard shows a **"sample weather"** tag, `WEATHER_PROXY_URL` is still blank or the
  function is unreachable — the UI falls back to a clearly-labelled sample so nothing breaks.
