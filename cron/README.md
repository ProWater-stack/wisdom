# Auto GS Scheduler — cron job

Raises a Freshdesk **General Service** ticket on **day 14** of each society's
**15-day** cycle, so a technician visits on day 15. Idempotent (one ticket per
society per cycle, tolerant of missed runs).

> This is **backend** code — it belongs in your Google Cloud project, not the
> React app. Move this `cron/` folder into your backend repo.

## 1. What you must provide

| Env var | Example | Notes |
|---|---|---|
| `FRESHDESK_DOMAIN` | `prowater.freshdesk.com` | your Freshdesk subdomain |
| `FRESHDESK_API_KEY` | `xxxxxxxx` | Freshdesk API key (kept server-side only) |
| `FRESHDESK_REQUESTER_EMAIL` | `ops@prowater.in` | requester on society tickets (must be a real contact/mailbox) |

## 2. Where the schedule lives (data store)

The job reads/writes a store of one record per society. Firestore is wired in by
default (collection **`gs_schedules`**); swap `getSchedules()` / `saveTicket()`
in `auto-gs-scheduler.js` if you use Cloud SQL or another DB.

Seed one doc per society:

```json
// gs_schedules/CBR_Akruti
{ "society": "CBR Akruti", "lastService": "2026-06-21" }
```

Societies: CBR Akruti, SVS Ananda, MJR Hydra, Ashish JK, Prabhavati, Sai Poorna Premier.

**`lastService` is the source of truth.** After a visit is completed, update
`lastService` to the visit date — that resets the 15-day cycle so the next
ticket is raised 14 days later. (Do this from the technician/FSM flow, or when
the ticket is marked Resolved.)

## 3. Deploy (Cloud Function + Cloud Scheduler)

```bash
# from the cron/ folder
gcloud functions deploy autoGsScheduler \
  --gen2 --runtime=nodejs20 --region=asia-south1 \
  --trigger-http --entry-point=autoGsScheduler \
  --set-env-vars=FRESHDESK_DOMAIN=prowater.freshdesk.com,FRESHDESK_REQUESTER_EMAIL=ops@prowater.in \
  --set-secrets=FRESHDESK_API_KEY=freshdesk-api-key:latest \
  --no-allow-unauthenticated

# daily at 08:00 IST, calling the function with an OIDC token
gcloud scheduler jobs create http auto-gs-daily \
  --location=asia-south1 --schedule="0 8 * * *" --time-zone="Asia/Kolkata" \
  --uri="$(gcloud functions describe autoGsScheduler --gen2 --region=asia-south1 --format='value(serviceConfig.uri)')" \
  --oidc-service-account-email=YOUR_SCHEDULER_SA@YOUR_PROJECT.iam.gserviceaccount.com
```

Put the API key in Secret Manager (`freshdesk-api-key`) — never in plain env or
the frontend.

## 4. Backend endpoint the app now expects

The **Auto Scheduler → Auto GS - Society** screen already reads and writes via
`/api/gs-schedules` (with a graceful fallback to local data until it's live).
Expose these two routes against the same `gs_schedules` store this cron uses:

**`GET /api/gs-schedules`** → array of societies:
```json
[
  { "society": "CBR Akruti", "installedDate": "2026-01-15", "totalFlats": 240,
    "numTowers": 4, "lastService": "2026-06-21", "cycleTicketId": 5012 }
]
```
(The app also accepts snake_case: `installed_date`, `total_flats`, `num_towers`,
`last_service`, `ticket_id`.)

**`POST /api/gs-schedules`** ← body from the "Add new society" form:
```json
{ "society": "Brigade Gateway", "installedDate": "2026-07-04",
  "totalFlats": 280, "numTowers": 5, "lastService": "2026-07-04" }
```
Create the doc, then this cron picks it up automatically on the next run.

Once both are live, the screen shows real `lastService` dates and the real
`cycleTicketId`s this cron creates — no further frontend change needed.

## Test locally

```bash
npm install
FRESHDESK_DOMAIN=... FRESHDESK_API_KEY=... node auto-gs-scheduler.js
```

Prints a per-society result array (`created` / `skip:*` / `error`) without a
scheduler. Use a Firestore emulator or a test project to avoid touching prod.
