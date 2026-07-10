# Backend spec — server-side cache for Zoho list endpoints

**Owner:** backend dev (Cloud Run service at `api-7ca73ntgua-el.a.run.app`)
**Priority:** high — this is the permanent fix for the recurring Zoho rate-limit outages.

## Problem

The dashboard periodically dies with:

```
500 Internal Server Error
{ "status":"error",
  "message":"Zoho contacts page 1 failed: {\"code\":45,\"message\":\"The API call for this organization has exceeded the maximum call rate limit of 1,000\"}" }
```

Cause: `/admin/get-all-customers` (and `/admin/get-all-subscriptions`, `/admin/get-all-invoices`) **call Zoho on every single request** with no server-side cache. Every browser load, reload, incognito window, and each analytics screen re-pulls the full customer/subscription/invoice lists from Zoho. Zoho's limit is **per organization (1,000 calls)** and shared across the backend, cron jobs, and all users — so it gets exhausted fast.

The frontend now caches per-browser (localStorage, 1–3h), which cuts repeat calls **for a returning browser** — but a new user / new device / cleared cache still triggers a full cold pull. Only a **server-side cache** fixes it for everyone.

> The **leads** endpoint (`/admin/zoho/get-all-leads`) already does this — it returns a `cached` flag. **Mirror that behaviour** on customers, subscriptions, and invoices.

## Goal

Zoho is queried **at most once per TTL per dataset**, regardless of how many users/requests hit the backend. Everything else is served from the cache. The frontend never gets a 500 because of a Zoho rate-limit.

## Endpoints to cache

| Endpoint | Zoho source | Suggested TTL |
|---|---|---|
| `/admin/get-all-customers` | Zoho Contacts | **10 min** |
| `/admin/get-all-subscriptions` | Zoho Subscriptions | **10 min** |
| `/admin/get-all-invoices` | Zoho Invoices | **10 min** |
| `/admin/zoho/get-all-leads` | Zoho CRM Leads | already cached — keep |

(TTLs are a starting point — these datasets don't change minute-to-minute; 10 min is plenty fresh for a dashboard and cuts Zoho calls by ~99%.)

## Design

**Cache the full dataset once; serve the frontend's pages from cache.** Don't cache per `page` — fetch *all* pages from Zoho a single time into one array, cache that array, and slice it for the incoming `page`/`per_page`. That way one cache-fill = the only Zoho traffic, no matter how many pages the frontend asks for.

Per dataset, store: `{ rows: [...], fetchedAt: <epoch ms> }`.

On a request:
1. If a fresh entry exists (`now - fetchedAt < TTL`) → serve it, `cached: true`.
2. Else refill from Zoho (all pages), store, serve, `cached: false`.
3. **On Zoho failure (429 / code 45 / any error): serve the last cached copy even if stale** (`cached: true, stale: true`). **Never return 500 for a rate-limit** if any cached copy exists.

### Four things that must be included

1. **Single-flight (mutex) per dataset.** If 10 requests arrive during a cache miss, only **one** hits Zoho; the other 9 await the same in-flight refill. Prevents a thundering herd every time the TTL expires. (A simple per-key promise map or a mutex.)
2. **Stale-on-error.** As above — a Zoho rate-limit must return the last good data, not a 500.
3. **`cached` flag + `fetched_at`** in every response (like the leads endpoint).
4. **Force-refresh escape hatch** for the dashboard's Refresh button: honor `?refresh=true` (or header `X-Refresh: 1`) to bypass and refill the cache. Keep this rate-limited server-side (e.g. ignore a forced refill if one happened < 30s ago) so the button can't be spammed into a Zoho storm.

### Zoho call hygiene (during a refill)

- Cap concurrency to Zoho (e.g. 2–3 pages in flight), small delay between calls.
- On Zoho 429 / code 45: exponential backoff + jitter, a few retries, then give up and keep the old cache.

### Where to store the cache

Cloud Run scales to **multiple instances** and cold-starts, so a plain in-process variable is only shared within one warm instance.
- **Simplest that actually works cross-instance:** Firestore (one doc per dataset) or Memorystore/Redis.
- **Acceptable interim:** in-memory + set Cloud Run **min instances = 1** (cache survives as long as that instance is warm; still far better than today).

## Response shape (keep the current shape, just add fields)

```jsonc
{
  "customers": [ /* the page slice */ ],
  "pagination": { "has_more": true },
  "cached": true,            // NEW — was this served from cache?
  "stale": false,            // NEW — true if served old data because Zoho failed
  "fetched_at": 1720598400000 // NEW — when the cache was last filled
}
```

The frontend already tolerates extra fields — no frontend change required.

## Acceptance criteria

- Hitting `/admin/get-all-customers` 50× in a minute results in **≤ 1** Zoho pull (visible in Zoho API usage), not 50.
- With Zoho rate-limited, the endpoint returns **200 + last cached data** (`stale: true`), never a 500.
- `?refresh=true` forces exactly one fresh Zoho pull (and is itself throttled).
- Response includes `cached` / `fetched_at`.

## Sketch (pseudocode)

```js
const TTL = 10 * 60 * 1000;
const cache = {};          // { customers: {rows, fetchedAt}, ... }  (use Firestore/Redis in prod)
const inflight = {};       // single-flight

async function getDataset(key, fetchAllFromZoho, force) {
  const c = cache[key];
  const fresh = c && Date.now() - c.fetchedAt < TTL;
  if (fresh && !force) return { ...c, cached: true, stale: false };
  if (inflight[key]) return inflight[key];          // single-flight

  inflight[key] = (async () => {
    try {
      const rows = await fetchAllFromZoho();        // all pages, concurrency-capped + backoff
      cache[key] = { rows, fetchedAt: Date.now() };
      return { rows, fetchedAt: cache[key].fetchedAt, cached: false, stale: false };
    } catch (err) {
      if (c) return { ...c, cached: true, stale: true };   // serve stale, don't 500
      throw err;                                    // only 500 if we've truly never cached
    } finally { inflight[key] = null; }
  })();
  return inflight[key];
}
```

---
_Written for the ProWater/Wisdom2.0 dashboard. The dashboard frontend (`src/App.jsx`) already caches per-browser and backs off on rate-limits; this server-side cache is the org-wide fix._
