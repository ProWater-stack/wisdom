# Wisdom 2.0 — ProWater Admin Dashboard · Technical Documentation

> **Purpose:** a single reference so any developer can understand what the tool is, how each
> module works, which APIs/logic/lookups it uses, and where data lives.
>
> **Maintenance (keep this current):** this file is updated **together with every code change**,
> the same way `APP_VERSION` / `VERSION_HISTORY` are bumped in `src/App.jsx`. When you change a
> module's behaviour, an API, a storage key, or a lookup — update the matching section here in the
> same commit. The living, dated change-log lives in `VERSION_HISTORY` inside `src/App.jsx`; this
> doc describes the *current* design.
>
> **Reflects:** `APP_VERSION` **2.29.84**.

---

## 1. Architecture & stack

- **Single-page React app.** Almost the entire app is one file: **`src/App.jsx`** (~12k lines).
  Entry: `src/main.jsx` → `src/index.css`. Small helpers in `src/lib/` (`apiUsageTracker.js`,
  `notifyAdmin.js`).
- **Build/deploy:** Vite (`npm run build`). Base path **`/Wisdom2.0/`** (see `vite.config.js`).
  Deployed to **GitHub Pages** by GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`;
  build-time env comes from repo **secrets** (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_EMAIL`,
  `VITE_API_ORIGIN`). Local `deploy` script uses `gh-pages -d dist`.
- **UI:** no component library. Inline styles + CSS variables (brand tokens defined in a `<style>`
  block near the top of `App.jsx`). Fonts: Playfair Display (headings) + DM Sans (body).
  Charts: **Recharts**. Icons: **lucide-react**.
- **State/routing:** React hooks only (no Redux). `useAuth()` context holds the logged-in `user`,
  the active `module` and `tab`. `MODULES` (registry) + `moduleTabs` (per-module sub-tabs) drive
  navigation; each tab renders a component.
- **Data:** live from the ProWater Cloud Run backend, Firebase, Zoho (through the backend) and AWS
  IoT; a few modules are local/seed. Every list fetch fails soft to seed/sample data so one dead
  endpoint never blanks the page (it raises a "Showing sample data" banner instead).

### Charts gotcha
Recharts bars must set `isAnimationActive={false}` or they render at 0 height in this app. All
charts use it.

---

## 2. Authentication, roles & access control

- **Login** (`api.login`): Firebase Auth REST —
  `POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=VITE_FIREBASE_API_KEY`
  with email+password. On success the **idToken** is stored in `sessionStorage.pw_idToken`
  (+ `pw_tokenExpiry`, ~55 min). `authHeaders()` attaches `Authorization: Bearer <idToken>` to every
  backend call. Auto-logout fires when the token expires.
- **Identity & roles:** the verified email is matched to an **Employee** record (`pw_users`) which
  supplies `role` + per-module `access`. If no employee row matches, a default admin identity is
  created. The session user is persisted in `sessionStorage.pw_user`.
- **Roles:** `admin`, `devops`, `supervisor`, … (free-form). **Per-module access levels:**
  `"none" | "view" | "admin"` (and `devops`). `allAccess(level)` grants a level on every module.
- **Per-section overrides (v2.28.4):** on top of module access, a user may carry
  `user.sections[moduleId][tabId] = "hidden" | "view" | "edit"`. Absent = **inherit** the module
  level (the default → every section shown), so pre-2.28.4 users are unaffected. `MODULE_SECTIONS`
  is the top-level catalog (mirrors `moduleTabs`); `sectionOverride(user, module, tab)` reads an
  override and `setSectionOverride(...)` writes one (used by `AccessEditor` / create / edit).
- **Gating pattern:** the shell computes `moduleAccess = user.access[module] || (role==="admin" ? "admin" : "view")`
  and `isModuleAdmin = moduleAccess === "admin" || "devops"`. It then derives per-CURRENT-tab
  `tabIsAdmin` / `tabAccess` from the section override (`view` forces read-only even on an admin
  module; `edit` grants editing even on a view module; no override inherits), filters the sidebar
  `nav` to drop `hidden` sections, and passes `isAdmin` / `accessLevel` to module components.
  Convention:
  - **Admin-level (admin *or* devops)** can edit; **view** users are read-only. Used by Auto GS
    inline fields, Overview "Total Flats", Sales/Ticketing edit actions, Release publishing, etc.
  - A few actions are **strictly `role === "admin"`** — e.g. editing a society's launch month in the
    Penetration Tracker.
  - Some actions stay open to everyone with access (e.g. Auto GS **Create ticket**).

---

## 3. Backends & external services

### 3.1 ProWater backend (Cloud Run) — `https://api-7ca73ntgua-el.a.run.app`
Bearer-authed with the login idToken. `API_ORIGIN` constant. Endpoints:

| Method | Path | Used by |
|---|---|---|
| GET | `/admin/get-all-customers` | Customer, Analytics (Zoho Contacts) |
| GET | `/admin/get-all-subscriptions` | Billing, Earned Revenue (Zoho Billing) |
| GET | `/admin/get-all-invoices` | Billing, Analytics (Zoho Billing) |
| GET | `/admin/get-all-creditnotes` | Credit notes / discounts — Analytics > Credits + All Customers (joined by Zoho customer id) |
| GET | `/admin/zoho/get-all-leads` | Sales, Analytics (Zoho CRM; `per_page=500`, server-cached) |
| GET | `/admin/zoho/get-all-apartments/data` | Sales apartment leads; Overview flat counts |
| GET | `/admin/get-app-logs` | Analytics · App Logs |
| GET | `/api/admin/all-referrals` | Referral (referrers + referees + credits) |
| GET | `/tickets/formattedforwisdom` | Ticketing (Zoho Desk, Wisdom-formatted) |
| GET/POST | `/api/gs-schedules` | Auto GS schedules (optional; local-first) |
| POST | `/documents/add?email=<user>` | **Task Planner attachments** (multipart, field `documents`) |
| POST | `/device-replacement/add` | **Device Replacement** save → Firebase |
| POST | `/admin/notify-failure` | Email alert on API failure (backend route may be pending) |

### 3.2 Firebase — project `backend-prowater`
- **Auth:** email/password (above).
- **Firestore** db **`prowaterdb`** (a *named* db, not `(default)`), REST API with the login idToken:
  - `logs` — mobile/web app events, read by **App Logs** (`:runQuery`).
  - `wisdom2.0_releases` — **shared App/Technician releases** (read/create/delete). New in 2.28.0.
  - `device_replacements` — read back by Device Replacement's list (best-effort; only populated if
    the `/device-replacement/add` backend writes swaps into this collection).
  - **Rules:** Firestore is auth-gated (unauthenticated → 403). Each collection needs a rule
    permitting the logged-in client, e.g. `match /wisdom2.0_releases/{d} { allow read, write: if request.auth != null; }`.
    Collections are **auto-created on first successful write**.
- **Cloud Storage** bucket **`backend-prowater.firebasestorage.app`** (the `.firebasestorage.app`
  form; the classic `.appspot.com` does *not* exist). Currently open (unauth uploads succeed).
  Task Planner attachments land under `wisdomeattachments/<email>/<ts>_<name>` and are downloaded via
  `…/o/<encoded path>?alt=media`.

### 3.3 Other
- **AWS IoT** — `…execute-api.ap-southeast-2.amazonaws.com/prod` (IoT Core). Two live GET routes: `/devices/status` (roster, polled 10s) and the bare `/devices/history?deviceId=…` (polled @8s for every roster device). That single history feed drives everything — liveness/last-seen, the RO-tank level + water quality, the Recent-readings ECG, junctionBox charts/heartbeats, and the 12-hour consumption table. *(v2.29.15: the separate `&days=1` / `&days=2` history polls were removed — they returned the same data as the bare feed.)*
- **Weather (IoT Core)** — Google Maps Platform **Weather API** (`history/hours:lookup`) via a Cloud Function proxy (`weather-proxy/`), read by the frontend at `WEATHER_PROXY_URL`. Key held server-side, 60-min cache. Falls back to a labelled sample when the URL is unset/unreachable.
- **Audit geo/IP** — `ipapi.co/json`, `api.ipify.org` (IP fallback), `api.bigdatacloud.net`
  reverse-geocode (used by the Logs Tracker to stamp location).
- **Google Fonts** — Playfair Display + DM Sans.

---

## 4. Data layer, caching & shared logic

- **API wrappers:** `customerApi`, `billingApi`, `salesApi`, `apartmentApi`, `ticketApi`, `api`
  (referrals/logs/session). All fail soft to seed data and call `markSample(source,on)` which drives
  the "Showing sample data" banner and records API failures.
- **Caching:** `getCached(key,…)` keeps a per-browser localStorage cache (`pw_cache_*`, ~1–3 h TTL)
  so reloads/re-logins don't re-hit Zoho. `fetchAllPagesFast()` pulls all pages with bounded
  concurrency + 429/backoff. This is a mitigation; the real fix is server-side caching (the leads
  endpoint already returns a `cached` flag). See `BACKEND_CACHE_SPEC.md`.
- **Society join (VLOOKUP):** subscriptions/invoices/tickets are joined to a **society** via the
  customer: `zohoCustomerId | zohoId | customerNumber → customer.society`. Unmatched → `"Unknown"`.
  Used across Billing, Analytics, Penetration Tracker, Top Societies.
- **Money split:** `depositForPlan(plan, total)` splits a paid invoice into a **refundable deposit**
  and a **recharge** (revenue). `recharge = total − deposit`. **MRR:** `monthlyOf(sub) = amount / termMonths(sub)`;
  `termMonths` parses the term from the plan name/code (e.g. `…_6M` → 6).
- **Dates:** `parseFlexDate()` parses many formats (ISO, `19-Jan-2026`, `19/01/2026`, epoch,
  `+0530`). Analytics uses month-index math (`year*12 + month`) for cohorts and MoM.

---

## 5. Storage keys

**`sessionStorage`** (cleared on browser close): `pw_user` (logged-in identity), `pw_idToken`,
`pw_tokenExpiry`.

**`localStorage`:**

| Key | Holds |
|---|---|
| `pw_users` | Employee records (users, roles, access) |
| `pw_rememberId` | Remembered login id |
| `pw_session` | IP / network / geo for audit (repopulated on token-restored reloads) |
| `pw_cache_*` | Per-dataset API response cache (TTL) |
| `pw_logs`, `pw_logs_epoch`, `pw_failures` | Logs Tracker audit trail / epoch reset / API-failure records |
| `pw_recent_modules` | Recent-module quick access on the home screen |
| `pw_photos` | Profile photos |
| `pw_tasks`, `pw_tasks_imported`, `pw_tasks_seeded` | Task Planner tasks + import/seed guards |
| `pw_plan_statuses`, `pw_plan_sprints`, `pw_plan_categories` | Task Planner admin-editable columns/sprints/categories |
| `pw_task_notifications`, `pw_task_notifs_seen` | Task status-change notifications (bell) |
| `pw_gs_date_overrides` | Auto GS per-society field overrides (flats, dates, address, next service) |
| `pw_flats_overrides` | Overview "Total Flats" admin overrides (per society) |
| `pw_launch_overrides` | Penetration Tracker admin launch-month overrides (per society, `YYYY-MM`) |
| `pw_device_replacements` | Local copy of recorded swaps (display + reload persistence) |
| `pw_releases` | Offline cache of App/Technician releases (source of truth is Firestore) |
| `pw_releases_seen_by` | Per-user "seen" release ids (drives the popup) |
| `pw_aop_targets` | AOP monthly targets |

Attachment **bytes** for the Task Planner also live in **IndexedDB** (`pw_planner` store) for the
local fallback path; only lightweight metadata is kept in `pw_tasks`.

---

## 6. Modules

Each module is registered in `MODULES` (id/label/icon/desc/color) and documented in-app in
`MODULE_DOCS`; sub-tabs are in `moduleTabs`. Below: purpose · how it works · APIs · key logic/lookups · storage.

### Sales (`sales`)
- **Purpose:** Zoho CRM leads — pipeline, table, analytics, error correction, apartment leads.
- **How:** loads leads via `GET /admin/zoho/get-all-leads` (`per_page=500`, total-paginate; endpoint
  is server-cached and returns a `cached` flag). Kanban pipeline by stage; full leads table with a
  status filter; **Apartment × lead-status pivot** (join key: apartment name = lead "Society Name");
  **Error Correction** flags leads marked installed but missing money fields.
- **Storage:** live API (+ per-browser cache).

### Customer (`customer`)
- **Purpose:** Zoho Billing customer accounts, plans, credits.
- **How:** `GET /admin/get-all-customers` (paginated, `per_page=300`). Searchable list; plan/billing
  editable per role; grand-total row. **Societies** sub-tab groups customers by society with
  count/active/device-mix (Own/Normal/Hot&Cold from the purifier-ID prefix), expandable per society.
  The Overview "Active Customers" figure and Top-Societies "Active" column come from this active-status logic.
- **All Customers (v2.29.4):** search by Purifier ID / phone / name / email; clicking a customer opens a
  full-page view with an always-visible **"at a glance" strip (v2.29.82)** — Status, Customer score, LTV,
  Open tickets, Last payment, Referral code, shown above the tab bar on every sub-screen, not just Profile
  — and six sub-screens — **Timeline (v2.29.82)** — every payment, ticket, referral and discount/credit-note
  event for this customer merged into one chronological feed (newest first), so the whole relationship can
  be read without switching tabs — **Profile** (a fields table incl. Referral code, **LTV** = sum of all
  paid invoices, Security Deposit, Discounts w/ balance, Support tickets and Complaints, where only concerning
  values are highlighted amber/red; three 0-5 **scores** — Customer / Technician / Device — with conditional
  colours; and a **Spares-used** table. The old AI-summary card was removed in v2.29.11 — it only stitched
  numbers into sentences), **Transactions** (invoice history), **Tickets** and **Ops** (a Purifier-ID lookup
  into the Ticketing feed, counted **month-wise** — `Jan'26 · N` — each month expandable to its Issue-Category
  breakdown; Ops reuses the `Issue Category ≠ Complaint` filter), and **Referral** (referrals made / converted /
  pending, referral code, and the referee list — joined to the referral API by any shared key). All deterministic.
  **Transactions (v2.29.66, reworked v2.29.71):** below the payments table (moved below it in v2.29.71 —
  was above), a "Current paid transaction — revenue recognition" card for the customer's most recent paid
  invoice (`txns.find(t => t.status === "paid" ...)`, `txns` is already newest-first). New
  `invoiceMonthlyBreakdown()` helper (generalizes Earned Revenue's per-invoice month-split math to show
  EVERY touched month, including the accrual slice before actual payment — Earned Revenue's own table
  never shows that, since it only surfaces an invoice's own paid-month slice). Verified exactly against
  the user's reference spreadsheet: due 7/26, paid 8/1, ₹350 recharge → tenure 31 days, Earned ₹68 (Jul) +
  ₹282 (Aug), Collected ₹0 (Jul) + ₹350 (Aug), Outstanding ₹350 (as of Jul-end) + ₹0 (once paid).
  **v2.29.71** compacted the card — it read too big. Now a **5-row icon summary** (Due date
  `CalendarDays`, Payment date `CalendarClock`, Recharge tenure `CalendarRange`, Earned revenue
  `TrendingUp`, Collected Revenue `Wallet`), Collected Revenue showing "Fully collected" or "₹X still
  outstanding" underneath instead of a separate Outstanding row. The full month-by-month workings
  (previously always shown) now live behind a **"Show/Hide calculation"** expand-collapse toggle, closed
  by default — rebuilt as fixed-width flex rows (a `DATE_W`/`AMT_W` pair of constants) instead of the
  shared full-bleed `<Table>`, which stretched to the card's full width with no column constraints and
  left large blank gaps around the short date/amount values.
  **v2.29.72:** Earned revenue rows in the calculation detail now show the actual **day-range** each
  amount covers (e.g. "22 Jun – 30 Jun", "01 Jul – 21 Jul") instead of a single date — makes clear
  exactly which days each month's slice counts. Also added a **GST breakup** card, shown *before* the
  revenue-recognition card, backing out Taxable value / CGST (2.5%) / SGST (2.5%) from the invoice's
  actual paid amount (`gstBreakup()` — assumes the standard flat 5% split; GST isn't an API field, this
  reverse-calculates it, modelled on a reference breakup sheet the user shared; independently-rounded
  components can be ±₹1 off the total, same as that reference sheet).

### Billing & Subscription (`billing`)
- **Purpose:** subscriptions, invoices, deposits, and **Billing Analytics**.
- **How:** `GET /admin/get-all-subscriptions` + `/admin/get-all-invoices`. Billing Analytics shows
  MRR/ARR, **MRR by plan** (active subs × `monthlyOf`), revenue by society, Week-over-Week &
  Month-over-Month (collected), renewals due, deposits/refunds. Deposit vs recharge split via
  `depositForPlan`.

### ERP & Inventory (`erp`) — *local/seed*
- Purifier asset register with book value; cost/depreciation totals. (Marked "soon".)

### FSM System (`fsm`) — *local/seed*
- Field service: technician tracking, AMC schedule, water quality. (Marked "soon".)

### IoT Core (`iot`)
- **Purpose:** live device telemetry — RO-tank level + water quality + pressure/flow/dispensed, and junctionBox pressure/flow.
- **How:** AWS IoT `…execute-api.ap-southeast-2.amazonaws.com/prod` — device **status** + **history**.
  Device monitor with status polling, recent heartbeats and fleet alerts. Two live GET routes:
  `/devices/status` (roster, 10s) and the bare `/devices/history?deviceId=…` (@8s for every roster
  device). That one history feed drives everything — roster-wide **liveness**, the tank level /
  water-quality / Recent-readings, and the 12-hour consumption table. *(v2.29.15: the separate
  `&days=1` / `&days=2` polls were removed — they returned the same data as the bare feed.)*
  The device detail **branches on the device schema**:
  - **RO-tank units** (`tankLevel` + `waterQuality` heartbeats) → a **Tank Level** illustration
    (four float switches 25/50/75/100% → live fill %) and a **Water Quality** panel showing pH /
    TDS / temperature as the **min–max range over the last day** vs their ideal bands, rated
    GOOD / AMBER / CHECK, with an overall summary and a **Recent readings** table. Fed by
    the bare `GET /devices/history?deviceId=…` (`{ items:[…] }`), polled every 8s. Ideal bands
    (pH 6.5–8.5, TDS 50–300 mg/L, temp 15–25 °C) are app-side constants, not in the feed.
  - **junctionBox units** (`payload.units[].channels`) → the existing water-pressure / unit-health /
    channels grid with per-device pressure/flow charts and 12-hour consumption.
  Known tank device `E05A1B9C2DD4` is always kept in the roster, polled and selected by default.
  The module top bar shows the **apartment name** (`Prabhavati`) as a centred pill so the site is clear (v2.29.14).
- **Weather + correlation (v2.29.17):** a **live-weather strip** at the top of the module (temp/humidity/condition at Prabhavati — Garvebhavi Palya, Bengaluru, coords hardcoded in `WEATHER_LOCATION`), and a **"Weather correlation"** card inside Trend analysis. Data comes from the **Google Weather API** (`history/hours:lookup`, past 24h) through a **Cloud Function proxy** (`weather-proxy/` folder — holds the key server-side, 60-min cache, demand-driven, ~10–24 calls/day); the newest history hour is the live reading (no `currentConditions` call). `weatherApi` (60-min client cache + tolerant mapper) reads the proxy at `WEATHER_PROXY_URL` — **now LIVE** (`https://asia-south1-backend-prowater.cloudfunctions.net/weather`, deployed v2.29.18); if that ever goes blank/unreachable the UI falls back to a clearly-labelled SAMPLE. The correlation card joins each reading to its nearest weather hour and shows **Pearson r** (`iotPearson`/`iotWeatherCorrelate`) for outdoor temp vs water temp / TDS / pH, plus a dual-axis outdoor-vs-water-temp chart. All in-app, no LLM.
- **Tank refill animation (v2.29.37):** the RO tank pings its level ~every 10 min; `iotTankRefilling(chrono)` flags the tank as **actively refilling** when the level steps UP across the recent ~65-min window (latest reading > earliest in window). While refilling, the tank graphic shows a **pump** in the base gap (spinning impeller), a **pipe** running from the pump up the side and over into the neck, and **blue water flowing in animated waves** through the tubes into the tank, with a **"Refilling"** tag on top. Purely visual (CSS), driven by real level history, threaded `IoTDevices → IoTTankPanel → IoTTank`; honours `prefers-reduced-motion`.
- **Warming vapour (v2.29.38, trigger widened v2.29.39):** `iotTempWarming(chrono)` flags the water as **warming** whenever the latest water temp (from the recent ~65-min window) is **above the ideal band (> 25 °C — the Warning/Hot zone)**, or when it's **trending up into that zone** (rising and ≥ 24 °C). *(v2.29.39 dropped the earlier "must be actively rising AND ≥ 26 °C" rule, which left a steady 26 °C tank showing no steam.)* While warming, **wisps of vapour rise off the water surface** inside the shell — positioned at `bottom:var(--level)` so they track the surface as it fills/drains — with an amber **"Warming"** tag. Same in-app, CSS-only pattern as the refill rig; honours `prefers-reduced-motion`.
- **UI (v2.29.2):** the tank is a transparent see-through graphic (lid/neck/shell) with the water block filling to the live level % and moving wave layers; the **Online** KPI shows a live green ECG heartbeat and **Offline** a red flatline; a deterministic **AI summary** strip at the top reads the fleet (counts, tank level, water-quality status, alerts — no LLM); the RO-tank **Recent readings** table is paginated 10/page. Water-quality ranges drop non-positive sensor dropouts.
- **Recent readings ECG (v2.29.12 → v2.29.13):** above the table, one **ECG-style wave per metric** (pH / TDS / Temperature / Tank) drawn over the device's history feed. v2.29.13 upgraded the wave rendering — a faint monitor grid, shaded ideal band with dashed guides, a soft gradient area-fill, crisp non-scaling segment-coloured strokes (green/amber/red per segment) with a subtle glow, a haloed leading dot, and ~72-point bucket-averaging for smoothness — and moved the wave cards from the dark "monitor" look to clean **white / off-white** cards (light border + soft shadow, value coloured by band, deeper line colours tuned for legibility on white).
- **Trend analysis (v2.29.16):** the section was rebuilt around a proper **interactive Recharts time-series** (`ComposedChart`) for the selected device — real time on X, the metric on Y, the **ideal band shaded** (`ReferenceArea` + dashed `ReferenceLine`s), each **out-of-range reading as a red dot**, and a hover tooltip (timestamp · value · in-/out-of-range · ideal). The focus metric is switched via tabs (with per-metric anomaly counts) or by clicking a mini-wave. An **"Anomalies only"** toggle isolates the out-of-range points in the chart (line hidden) and filters the readings table. Four deterministic **analytical tiles** sit on top — **Sensor health** (Good/Check from `iotSensorHealth`: reporting-gap, dropout rate, staleness), **Water quality** (Good/Warning/Critical from the window's worst band), **Alerts created** (out-of-range event count from `iotAnomalyScan`) and **Anomalies by metric** (per-metric counts) — plus an **Anomaly history** list (each event's date/time, worst value, High/Low). All in-app, no LLM. *Planned next step: correlate anomalies with a weather API.*
- **Pressure / flow / dispensed-litres (v2.29.43):** the RO-tank heartbeat (`waterQuality`) grew three fields — `pressure` (bar), `flowMLPM` (flow rate, L/min) and `totalDispensed` (lifetime dispensed litres, a monotonically-increasing counter). Wired in at full parity with pH/TDS/temp:
  - **RO Unit Sensors** card (separate from **Water Quality**, since pressure/flow describe the unit's plumbing, not potability) — `IoTWaterQualityCard` is now a generic component (`keys`/`title`/`subtitle`/`noun`/`extra` props) reused for both the potability card (`ph`/`tds`/`temp`) and this one (`pressure`/`flowMLPM`), so both share the same min–max range + GOOD/WARNING/CRITICAL band + AI-summary scaffolding. **Total dispensed** renders separately underneath (`IoTDispensedStat`) as a plain lifetime-total + this-window-delta stat — not banded, since a running counter has no "ideal range."
  - ~~Ideal bands are assumed residential-RO operating ranges... pressure green 0–4 bar / amber 4–6 / red outside; flow green 0–3 L/min / amber 3–6 / red outside.~~ **Superseded in v2.29.69 — see below; pressure/flow no longer band amber/red at all.** Both legitimately read **0 while idle** (no tap open) — unlike pH/TDS/temp, 0 is *not* treated as a sensor dropout for these two (`IOT_WQ_DROP_ZERO`).
  - Pressure & flow also got their own **gauges** (`IOT_GAUGE`), and joined **Trend analysis** as selectable metric tabs/charts — `iotTrendMetrics()` and `iotAnomalyScan()` were generalized to loop over the full metric registry instead of a hardcoded `ph/tds/temp/tank` list, so any future metric added there needs no other call-site changes. **Recent readings** table and CSV export gained Pressure / Flow / Dispensed columns.
  - Live-tested against the real device (`E05A1B9C2DD4`) via the local dev preview: it was reporting **655.34 bar**, flagged CRITICAL by the banding at the time — see v2.29.69 below, this turned out to be normal pump-cycling behaviour, not a fault.
- **Pressure/flow are pump-driven, not water-quality metrics (v2.29.69):** per the person who placed the sensors, NEITHER end of the pressure/flow range is a real anomaly — 0 while the pump is off (nothing to read) and whatever the line reads once the pump kicks on, at any magnitude (a 655 bar spike on pump-start is a normal artifact of this sensor placement, confirmed against the real device above). `iotWqClass` now always returns `"green"` for `pressure`/`flowMLPM` — they never rate WARNING/CRITICAL. This one change cascades to every dependent screen: the RO Unit Sensors card (badge + reassuring AI summary), its gauges (fully green track, no amber zone), the Recent-readings table (no red/amber highlight on these columns), and the Trend analysis "Anomalies by metric" tile (Pressure/Flow always 0). Water Quality (pH/TDS/Temp) is untouched. The card's "Ideal: X–Y" subtext for these two now reads "Pump off = 0, pump on = live reading — both normal" instead, since there's no enforced ceiling to imply anymore.
- **Loading state (v2.29.44):** fixed a load flash — the module used to drop its full-page spinner as soon as `/devices/status` (the roster) resolved, so the device list, tank graphic, gauges and Water Quality card briefly rendered with empty/zero data ("Awaiting sensor readings", 0% tank, `—` gauges) for a beat before the first `/devices/history` round-trip landed. A `historyLoaded` flag now gates the loading state on **both** requests completing at least once. Replaced the small generic spinner with a dedicated `IoTLoading` panel — bigger spinner, "Loading live device data…" copy, and an indeterminate progress bar — so the wait reads clearly as loading, not a blank/broken module.
- **Dispensed average (v2.29.45):** the **Total Dispensed** stat (under RO Unit Sensors) gained an **Average / day** figure next to Total dispensed and This window. `iotDispensedRange` now also tracks each reading's timestamp and divides the window delta by its actual span (the history feed is a downsampled ~1–2 day window, not exactly 1 day), instead of the window delta appearing twice under different labels. Shows `—` until the window has at least 30 minutes of span, so it can't flash a wildly inflated estimate right after the page loads.
- **Dispensed stat simplified (v2.29.46):** dropped **This window** from the Total Dispensed stat — showing the raw litres dispensed across whatever ~1–2 day span the history feed happened to have loaded read as an arbitrary, hard-to-explain number on its own. Now just two figures: **Total dispensed** (lifetime) and **Average dispensed** (per day, from `iotDispensedRange`'s `avgPerDay`).
- **Shared date-range filter (v2.29.47):** the Total Dispensed stat is now date-filterable with its own **Today / Yesterday / This Week / This Month / Last Month** chips, and that filter is **shared** with Trend analysis + Recent readings below (previously each owned a separate, page-local Today/Yesterday/Week filter) — `range` state moved up to `IoTDevices`, so picking a period in either place updates both. Two new options join the existing rolling-7-day "This Week": **This Month** and **Last Month**, real calendar months (`iotFilterByRange`, `IOT_RANGE_OPTIONS`, reusable `IoTRangeChips`). The Trend analysis history fetch widened from `&days=7` to `&days=62` (`hist7dByDevice` renamed `histRangeByDevice`) so "Last Month" has data to filter regardless of where in the current month "today" falls. Total dispensed now reads as the counter value as of the end of the selected period rather than always "right now"; the card shows "No dispensed-litres data for this period" instead of vanishing when a period has none (e.g. Last Month, before the device started reporting `pressure`/`flowMLPM`/`totalDispensed`).

### Referral (`referral`)
- **Purpose:** referrers, referees, credits, rewards momentum.
- **How:** `GET /api/admin/all-referrals` returns referrers with nested referees in one call
  (`toReferrers`/`toReferees`/`toCredits`/`toTrend`). KPIs: **active referrers** (`refs.length`),
  referees tracked, converted (`status==="paid"`), conversion rate, free months. Credit
  approvals/backtrack. Referrer fields include `society`, `joined` (used by the Overview
  "Active Referrers" tile).

### Ticketing (`ticketing`)
- **Purpose:** Zoho Desk support tickets.
- **How:** `GET /tickets/formattedforwisdom` (Bearer-authed) returns a FLAT object keyed by human labels
  ("Ticket ID", "Status", "Society Name", "Purifier ID", "Issue Category", "Phone", **"Technician Visit
  Date"/"…Slot"**, "Job Start/End Time", lat/long, etc.). Mapped by `mapWisdomTicket` (v2.28.6, tolerant of
  label case/spacing); `mapZohoDeskTicket` remains for the raw Zoho shape / sample fallback. This feed has
  no customer NAME (Customer column shows Ticket Owner), Priority, or Created time. List with status/priority
  filters + detail drawer. **Ops Tickets** sub-tab =
  Issue Category ≠ Complaint. The Overview "Ops Appointments" card counts tickets by "Technician Visit
  Date" for today…+3 days.

### Auto Scheduler (`autoscheduler`)
- **Auto GS - Society (`as_society`):** a 15-day general-service schedule per society. Columns:
  Apartments, Address, No of Flats, No of Towers, CRO Installed Date, CRO type, Last Backwash/Dozing
  dates, **Next service** (backwash + 15 days, or a manual override), Days left, Ticket ID.
  - **Editing:** every inline field is editable **only for admin/devops** (`accessLevel`), read-only
    for everyone else; the **"Add new society"** button is admin/devops-only. **"Create ticket"** is
    available to *all* access levels. Edits persist to `pw_gs_date_overrides` and best-effort
    `PATCH /api/gs-schedules`.
  - **Create ticket** → `POST /apartments/create-ticket` `{ apName, address, technicianPhoneNumber, subject:"Auto GS Schedule" }`;
    the returned Zoho ticket number shows as a chip.
- **IoT Alerts (`as_iot`):** device alerts → raise a ticket.
- Local-first: does **not** flag "Server Down".

### Analytics (`analytics`)
Cross-module reporting. Sub-tabs: **Overview**, Referral, Sales, Earned Revenue, **Reconciliation**, **DP
Transaction**, AOP (admin/devops), Apartment Performance, **Renewal & Churn Risk**, Billing, Revenue (Net
Revenue), **Penetration Tracker**, Credits, App Logs. (The old "Live Dashboard" tab was removed in 2.26.0.)

- **Renewal & Churn Risk (`ChurnRiskRadar`, `an_churn`, v2.29.82)** — flags customers at risk of churn by
  joining three already-live signals onto one customer-level table: **subscription renewing within 30
  days** (same `nextBilling`/days-out derivation Billing Analytics' "Renewals due" card already uses),
  an **overdue/failed invoice** (`i.status === "failed" || (i.balance > 0 && i.rawStatus?.toLowerCase()
  === "overdue")` — the exact condition Billing Overview/Subscription Reconciliation already use), and
  the customer record's own **`status === "dunning"`** (Zoho's raw payment-actively-failing state, also
  surfaced in Societies' retention insights). Each match adds to a score (dunning +3, overdue +2, renewal
  due +1 or +2 if within 7 days) that buckets into **High/Medium/Low**. Deterministic "Business insights"
  panel (same shape as Net Revenue/DP Transaction), 5 KPI cards, a level-filterable/searchable table, and
  CSV export. **Deliberately excludes an IoT "device gone quiet" signal** — there is no existing field
  joining a customer's `purifier_id` to a real IoT `deviceId` (the real IoT module only monitors two
  apartment-level RO/junction-box installations, not individual customer purifiers), so adding one here
  would have to be fabricated — flagged rather than built. Verified via temporary seed-data injection (a
  test customer with dunning status + an overdue invoice + a renewal due in 7 days) — correctly scored
  High with all three reasons listed, then the test data was removed.

- **Overview (`AnalyticsOverview`, `an_overview`)** — a filtered command dashboard. Loads customers,
  subscriptions, invoices, leads, **referrers**, tickets, apartments. Two filters scope the page:
  a **date-range picker** (This Month/Quarter/Year/Custom, compared vs the previous equal period) and
  a **Society multi-select**. Every chart honours both filters.
  - **KPI row:** Total Collection, Earned Revenue, Recharge collected, Deposit collected,
    **Active Customers** (cumulative sign-ups the Penetration-Tracker way, as of the period end, delta
    = MoM increase), **Active Referrers** (referrers from the referral API, matches the Referral page).
  - **Revenue Overview:** current vs previous period, bucketed by day/month, ₹ value labels on
    non-zero points.
  - **Revenue by Plan:** the **MRR-by-plan** chart (same as Billing analytics) — active subs ×
    `monthlyOf`, scoped to selected societies as of the period end.
  - **Penetration Tracker (embedded):** the cohort matrix, filter-aware (society filter + as-of date).
  - **Ops Appointments:** technician-visit counts for **D0…D3** (today, +1, +2, +3) from the ticket
    "Technician Visit Date" — **fixed to the real current date, ignores the page filters**.
  - **Forecast vs Actual:** linear fit over recent months, ₹ data labels.
  - **Week-over-Week:** collected over the last 8 weeks (Mon start), society-filtered, anchored to the
    period end.
  - **Top Performing Societies (table):** Apartment Name · Total Flats (apartments feed, joined by
    society name; **admin/devops-editable override** → `pw_flats_overrides`) · Onboarded Flats
    (customers in society) · Penetration % (`round(onboarded/flats×100)`) · Active Customers
    (active-status) · **Total Months** (calendar months from the society's **launch month** — earliest
    subscription sign-up or the admin launch override — to the current month, inclusive) ·
    Revenue (prev month) · Revenue (curr month) (recharge collected per calendar month). Plus a Total row.
- **Penetration Tracker (`PenetrationTracker`, `an_penetration`)** — cohort matrix of cumulative
  customers per society, aligned to each society's own **M1 = launch month** (month of its first
  subscription `created_at`, joined to society via `customer_id → zoho_customer_id`). Cells are
  cumulative counts; "grew" cells are highlighted. **Launch month is editable only for `role==="admin"`**
  in the standalone view (month picker → realigns M1…Mn; revert button restores the derived launch);
  overrides persist to `pw_launch_overrides` and are reflected everywhere the tracker renders
  (including the Overview's embedded, read-only copy). CSV export.
- **Apartment Performance / Earned Revenue / Net Revenue / Billing Analytics / AOP / Credits / App Logs**
  — billing-derived analytics (recharge reconciliation, day-weighted earned-revenue recognition, AOP
  targets vs recharge cash). **Credits** (rebuilt v2.29.6) shows **only** the live credit notes /
  discounts from `GET /admin/get-all-creditnotes` — total discount given, note count, customers
  discounted and avg/note, plus a per-customer table joined by Zoho customer id — with a Period
  (date-range) filter and a Society filter, search and CSV export (the old unused-credit KPIs / by-society
  and by-plan charts / holders table were removed). **App Logs** reads the Firestore `logs` collection
  (with a `GET /admin/get-app-logs` preference).
  - **Real `paid_date` (v2.29.48):** `GET /admin/get-all-invoices` started returning a genuine `paid_date` field on each invoice (confirmed live, e.g. `INV-000666`). `mapInvoice()` now maps it to `paidDate`; **Earned Revenue's Per-invoice recognition table** uses `paidDate || date` as the invoice's paid date (was: invoice/created date only, used as a proxy). Same day-based proration math, just a more accurate input date; falls back gracefully for older invoices that predate the field. Other "paid date" proxies elsewhere in the file (Net Revenue's `lastModified || date`, a few `status==="paid"` period-bucketing spots) haven't been switched over yet — tracked separately.
  - **Due Date column (v2.29.49):** Per-invoice recognition table + CSV export gained a **Due Date** column (from `invoice.dueDate` / `due_date`), placed between Plan and Paid on. The existing Paid on column was re-checked, not changed — it already reads the real `paidDate` from the API (v2.29.48 above).
  - **Earned/day removed (v2.29.50):** dropped the Earned/day column from the table and CSV (Earned/month, Month End Date, Days remaining, Earned revenue stay). The now-unused `earnedPerDay` field and the `inr2` currency-with-decimals helper (which only existed to format it) were removed too.
  - **Recognition formula changed (v2.29.51):** the numerator changed from `(month end − paid date + 1)` to `(validity end − validity start − 1)` — **validity start = the invoice's due date**, **validity end = the linked subscription's `nextBilling` date**. The denominator (days in the paid month) is unchanged and still computed from the paid date's calendar month, but its **Month End Date column was removed** from the table/CSV (no longer shown, though still used internally). "Days remaining" was renamed **"Validity days"** (now `validityEnd − validityStart − 1`, not `monthEnd − paidDate`), and a new **Next Billing** column sits beside Due Date so both anchor dates are visible. Falls back to `₹0` earned when the invoice's subscription can't be matched (no `nextBilling`) rather than guessing. **Scale warning:** for multi-month plans this pushes Earned revenue well above the recharge amount within a single month, since the numerator now spans most of the WHOLE paid term (e.g. ~365 days for annual) instead of just days-remaining-in-the-paid-month — confirmed intentional with the user; sample-data total went from ₹13,475/yr under the old formula to ₹2,30,262/yr under this one.
  - **Recognition rebuilt and verified against a real reference spreadsheet (v2.29.52):** two fixes. (1) **Next Billing / validity end is now COMPUTED**, not read from the subscription: `dueDate + 1 calendar month − 1 day` (e.g. due 2 Jul → validity end 1 Aug), replacing the raw subscription `nextBilling` field (which just preserved day-of-month — due 5 Aug → 5 Sept — and didn't follow a real calendar-month cycle). No longer depends on matching a subscription, so invoices that previously fell back to `₹0` now get a real figure. (2) **The formula itself changed** to a month-split model verified exactly against a real reference sheet (Sanjith/MJR: due 7/26, paid 8/1, ₹350 recharge → sheet shows ₹68 earned in Jul + ₹282 in Aug): `tenureDays = validityEnd − validityStart + 1` (inclusive — note: **+1**, not the −1 from v2.29.51 above, corrected after checking the reference), `daysInPaidMonth` = however many of those validity days fall inside the invoice's own paid calendar month, `earned = recharge × daysInPaidMonth ÷ tenureDays`. A tenure crossing a month boundary is now split, and the table (one row per invoice) shows only its **paid-month slice** — reproduced the reference exactly: `350 × 25 ÷ 31 = 282`. "Validity days" was replaced with two columns, **Tenure days** and **Days in paid month**, so both formula inputs are visible.
  - **Search, column trim, more sorting (v2.29.53):** removed the **Plan** column (still used internally for the deposit/term math, just not displayed); added a **search box** (customer or apartment) above the table via the shared `Toolbar` component — narrows only the displayed rows and the table's own "Total (N)" footer, while the KPI cards and trend chart above stay on the full period regardless of search (`sortedRows`/`totRow` vs. search-filtered `tableRows`/`visTotal`); and added click-to-sort on **Due Date** and **Next Billing** (same pattern as the existing Paid on sort — arrow indicator, ascending default).
  - **Reordered & renamed (v2.29.54):** column order changed from Due Date / Next Billing / Paid on to **Start Date / Paid on / End Date** (Due Date → Start Date, Next Billing → End Date) — display and CSV labels only, the underlying `dueDay`/`nextBillDay` fields and `"due"`/`"nextBilling"` sort keys are unchanged.
  - **"Days in paid month" fix (v2.29.55):** when the due date and paid date fall in the **same calendar month** and the payment landed AFTER the due date (a late payment), the overlap window that feeds `daysInPaidMonth` now starts from whichever is later — the due date or the actual paid date — instead of always the due date. Example: Arun K Sinha, due 8 Aug, paid 10 Aug, end 7 Sept — was 24 days / ₹271 (counted from the due date, including 2 days before he'd actually paid); now 22 days / ₹248 (counted from the paid date). Doesn't affect invoices paid *before* their due date (the common case, still anchored on due date), or invoices whose due date and paid date fall in different months (the paid date was never the binding boundary there — see the Sanjith reference in v2.29.52, unaffected).
  - **Spillover month (v2.29.56):** three new columns — **Next month**, **Days in next month**, **Earned revenue (next month)** — show the slice of an invoice's validity window that lands in the calendar month AFTER its paid month (e.g. paid August, end 7 Sept → 21 days in September). Same `recharge × days ÷ tenureDays` math, no late-payment clip (the clip only matters for the paid month, since by the following month the payment has already landed). Shows "—" when the tenure doesn't reach into another month. Verified: paid-month + next-month earned sums to exactly the recharge for every sample row not affected by the v2.29.55 late-payment clip. Table footer and CSV both include the next-month total.
  - **Very-late-payment bugfix (v2.29.73), found during a logic audit:** `daysInPaidMonth`/`daysInNextMonth` only ever checked the invoice's paid month and paid-month+1 for overlap with its validity window. If payment arrived more than ~1 month after the validity window had ALREADY lapsed (e.g. due 1 Jul, validity ends 31 Jul, not paid until 5 Aug), both overlaps came out to zero — the invoice showed **₹0 Earned Revenue despite the cash being collected in full**. Fixed: when `validityEnd < paidMonthStart`, the whole recharge is now recognised in the paid month instead (`daysInPaidMonth = tenureDays`) — there's no future service period left to spread it across once it's this late, so cash and revenue converge. Verified with a temporary seed invoice (due 1 Jul, paid 10 Aug, ₹1,000 recharge): Days in paid month 0→31, Earned revenue ₹0→₹1,000. This gap never affected `invoiceMonthlyBreakdown()` (the sibling formula on the All Customers > Transactions revenue-recognition card) — that one always walks the invoice's own due-to-validity-end months regardless of how late payment lands. Also added a click-to-sort control on the **Earned revenue** column (it was the table's default sort key on load but had no header button — once you sorted by a date column there was no way back to it without a refresh).
  - **Invoice # / Invoice ID columns (v2.29.80):** the per-invoice table (and its CSV export) now starts
    with **Invoice #** (the human-readable Zoho invoice number, e.g. `INV-000077`) and **Invoice ID**
    (the internal record id, e.g. `INV-2006`) — lets a row be traced back to the exact source invoice.
  - **Reference Number / Payment Mode columns (v2.29.83):** two more columns right after Invoice ID,
    fed by new `reference_number`/`payment_mode` fields `GET /admin/get-all-invoices` started returning.
    `mapInvoice()` now maps them (`i.referenceNumber`/`i.paymentMode`); shows "—" for any invoice that
    predates the fields (older cached rows, sample/seed data). **v2.29.84:** removed **Invoice ID**,
    **Payment Mode** and **Customer** from the visible table (16 columns now — Invoice #, Reference
    Number, Apartment, dates, amounts…) — all three stay in the CSV export unchanged, this was purely a
    display declutter, footer `colSpan` adjusted 9→6.

- **Reconciliation (`Reconciliation`, `an_reconciliation`, v2.29.57–58)** — a dedicated tab (between Earned
  Revenue and AOP) fixing a real bug where "collected revenue" elsewhere in the app was effectively
  bucketed by an invoice's **due date**, not by when the payment actually landed (e.g. due 28 Jul, paid
  3 Aug was showing as July revenue). Same filter pattern as Earned Revenue — a custom date-range picker
  (`useDateRange`/`DateRangePicker`, supports Today/…/Custom) and an Apartment (society) multi-select.
  Builds one "fact" per invoice with a due date: `periodEnd` = the due date's calendar month end;
  `onTime` = paid (by `paidDate || date`) on or before `periodEnd`; `late` = paid after `periodEnd`;
  `outstanding` = never paid (`status !== "paid"`).
  - **Due in period** — accrual view: invoices whose **due date** falls in the selected range.
  - **Collected in period** — cash-basis view: invoices whose **actual paid date** falls in the selected
    range, regardless of which period they were originally due in. This is the corrected figure — a late
    payment now shows up as revenue in the month it actually arrived, not the month it was due.
  - **Collected on time** — of the amount due in the period, how much was paid within its own due-month.
  - **Receivable** — amount due in the period that was **not** collected by that period's end (either
    paid later, in a different period, or never paid) — surfaces as red/amber rows in the table
    (Outstanding / Late) and its own KPI, instead of silently vanishing into "collected" for the wrong
    month.
  - A banner appears whenever some of the period's "Collected" total belongs to invoices due in a
    different period, explaining the mismatch inline.
  - Monthly **Due / Collected / Receivable** trend chart (`ComposedChart`, one bar per metric per
    calendar month spanning the selected range) makes the month-to-month shift visible.
  - Per-invoice table: Customer, Apartment, Total, Due date, Period end, Paid on, Status (On time /
    Late / Outstanding badge), Days late — with search (customer/apartment) and status filter chips,
    CSV export.
  - Verified against the exact reported example (due 28 Jul, paid 3 Aug): July shows ₹0 collected + the
    full amount as Receivable; August shows the full amount as Collected.
  - The file already had an **unused** `Reconciliation()` component (invoice↔subscription matching —
    flags active subscriptions with no paid invoice, orphan payments, etc. — never wired into any tab).
    It was renamed `SubscriptionReconciliation()` to free up the name; otherwise untouched dead code.
  - **AR roll-forward (v2.29.58):** a standard accounts-receivable ledger flow — **Opening Balance +
    Due Added − Collected = Closing Balance** — sitting above the trend chart. **Opening Balance** =
    every invoice due *before* the selected period that wasn't collected as of the period's start (the
    carried-forward backlog; previously the tab only analysed each period's own dues in isolation, with
    no concept of a running balance). **Collected** here deliberately **excludes advance receipts** —
    cash for invoices not yet due — reported as a separate memo line instead of netted in, since money
    for a not-yet-due invoice isn't part of AR yet. **Closing Balance** is cross-checked against an
    independent sum (every invoice due on/before period end, still uncollected) with a visible
    tie/mismatch indicator (`rollforwardTies`) — the two must always agree by construction; a mismatch
    would flag a bug, not a real accounting discrepancy. Verified: full-year view ties opening ₹0 → due
    ₹43,300 → collected ₹39,000 → closing ₹4,300; a Jul–Sep custom range correctly carries the ₹4,300
    backlog into Opening Balance. The four ledger cells match the **KPI cards' exact typography**
    (`eyebrow` label class, DM Sans 800-weight value) instead of the serif headline font used elsewhere.
  - **Plain-language rewrite (v2.29.59):** the section title changed from "AR roll-forward" to
    **"Outstanding balance, step by step"**, and the jargon labels became plain English — Opening/Closing
    Balance → **"Owed before this period"** / **"Still owed at period end"**; Due Added → **"Newly due
    this period"**; Collected → **"Actually paid this period"**. A one-line ₹-value equation now sits
    above the four cards (e.g. `₹4,300 already owed + ₹0 newly due − ₹0 actually paid = ₹4,300 still
    owed`), and each cell shows an **invoice count** under its figure (e.g. "2 unpaid invoices from
    earlier") so the calculation is visible at a glance, not just the result. The tie-out line simplified
    from "Ties to independent outstanding-balance check" to **"Verified — matches the total of all unpaid
    invoices"**, and the advance-receipts memo reworded in plain English.

- **DP Transaction (`DPTransactions`, `an_dptxn`, v2.29.60)** — a dedicated tab (between Reconciliation
  and AOP) reading a brand-new, unauthenticated feed: `GET
  https://api-7ca73ntgua-el.a.run.app/dp-transactions` (same origin as billing, but no auth header and no
  `/admin/` prefix). **Cursor-paginated**, not page-number based — the response is
  `{ status, count, transactions, has_more, next_cursor }`, so it gets its own fetch loop
  (`fetchAllDpTransactions`, module-level 5-min cache) rather than reusing `fetchAllPagesFast`. Capped at
  80 pages (~2000 rows); shows a truncation banner if the feed had more.
  - **Filters:** a **custom date-range picker** (same `useDateRange`/`DateRangePicker` as Earned
    Revenue/Reconciliation — Today/…/Custom) filtering on the feed's **`Paid_Date`** field (arrives as
    `"YYYY-MM-DD HH:MM:SS.ffffff"`; native `Date` parses it directly, no reformatting needed), and an
    **Apartment multi-select** sourced from the feed's own **`partner_name`** values (not the societies
    list used elsewhere).
  - **KPI cards:** **Deposit Collected** (`Σ deposit_amount`) and **Recharge Collected**
    (`Σ revenue_amount`), both null-safe (`Number(x) || 0`).
  - **Table shows raw rows, unmerged** — each collection event appears **twice** in the feed: a
    `COLLECTION_SUMMARY` row (`Deposit`/`Recharge_received`/`collection_total` populated,
    `deposit_amount`/`revenue_amount` null) and a `TRANSACTION` row (the reverse), tagged with a colour
    badge in a Type column. Columns (v2.29.70): Paid date, Apartment, Customer, Phone, Device, Type,
    Start Date, End Date, Validity, Litres, Plan, Deposit, Revenue (City removed from the table in
    v2.29.65, Transaction key/Transaction type removed in v2.29.70 — all three still in the CSV export).
  - **Search** covers `phone`, `current_device`, `partner_name`. CSV export includes a wider raw column
    set (adds Row type, Transaction amount, Device status).
  - Verified against the live feed (not sample data — this endpoint has no auth gate): August 2026 showed
    76 records, ₹4,000 Deposit Collected, ₹12,103 Recharge Collected; search-by-phone correctly narrowed
    to that customer's summary + transaction row pair.
  - **Payment Type filter (v2.29.61):** chips above the table, labelled with the raw `row_type` API value
    verbatim (`TRANSACTION`, `COLLECTION_SUMMARY`), each showing a live count, plus an **All** chip.
    Defaults to `TRANSACTION` only — the row carrying `deposit_amount`/`revenue_amount` (the KPI fields;
    its `COLLECTION_SUMMARY` twin has those null) — so the table no longer shows every collection event
    twice out of the box.
  - **Sort, Grand Total, and KPI comparison (v2.29.62):** the **Paid date** column header is now
    click-to-sort (arrow indicator, defaults descending — newest first). The table has a **Grand Total**
    footer row summing Deposit and Revenue for whatever's currently shown (respects date range, apartment,
    payment type, and search). Both KPI cards (Deposit Collected, Recharge Collected) now show a
    previous-period percentage delta (`momPct`, same ▲/▼ badge convention as every other KPI card in the
    app) — comparing against the immediately-preceding period of the same length as the selected date
    range (e.g. This Month → previous calendar month).
  - **Six more raw columns (v2.29.63):** **Transaction key**, **Transaction type** (`transaction_key`/
    `transaction_type`), **Start Date**/**End Date** (the feed's own `t.validity_start_date`/
    `t.validity_end_date` — a different field from the invoice Start/End Date used in Earned Revenue),
    **Validity**, and **Litres** — placed between Type and Plan, also added to the CSV export. Same
    complementary-null split as everything else in this feed: Transaction key/type/Start Date/End Date
    only populate on `TRANSACTION` rows; Validity/Litres only on the `COLLECTION_SUMMARY` twin — the
    other row type shows "—" for each.
  - **Layout fix (v2.29.64):** the Type badge and Transaction key cell were both wrapping their content
    across multiple lines, ballooning row height. Type badge now stays on one line. Transaction key
    shows a truncated form (`DPTX_` prefix stripped, first 8 hex chars + `…`) with the full raw key on
    hover — the underlying data (CSV export, `r.transaction_key`) is unchanged, this is display-only.
  - **Validity/Litres merge, City removed, pagination (v2.29.65):** Validity and Litres — which only
    ever populate on the `COLLECTION_SUMMARY` row — now also show on its `TRANSACTION` twin whenever
    the two rows share the exact same `Paid_Date` (down to the microsecond, which the same collection
    event always does). CSV export uses the same merged value. The **City** column was removed from
    the table (still in the CSV). The table is now **paginated** — 50 rows per page, Prev/Next controls,
    resets to page 1 on any filter or search change — while the Grand Total footer keeps summing the
    full filtered set, not just the visible page.
  - **Admin-only Upload JSON / Run API (v2.29.67):** an "Upload JSON" control at the top right,
    visible only when `user.role === "admin"`. Choosing a `.json` file validates it client-side
    (extension + that it actually parses) before anything is sent anywhere; once valid, the control
    becomes a **Run API** button that POSTs the file as `multipart/form-data` (field `file`) to
    `POST https://api-7ca73ntgua-el.a.run.app/dp-transactions/add`. The raw response — success or
    failure — is shown verbatim in a popup (`Modal`): pretty-printed JSON body, HTTP status in the
    subtitle, and on failure a plain-English message extracted from the body's `message`/`error`/
    `detail` field (falling back to `Request failed — HTTP <status>`, or a network-error message if
    the request never reached the server). A successful run clears the selected file and silently
    re-fetches the table (`fetchAllDpTransactions(true)`) so the newly-imported rows show up without
    a page reload.
  - **Transaction Type filter + DISCOUNT exclusion (v2.29.68):** a second chip filter, next to
    Payment Type, on the feed's own `transaction_type` field (`APP`, `PAYMENT_LINK`, etc.).
    **`DISCOUNT`-type rows are excluded from this entire view** — table, KPIs, CSV — not offered as a
    filter choice at all, since they're a non-cash discount adjustment rather than real recharge
    collected. Verified live that every `DISCOUNT` row has `revenue_amount`/`deposit_amount`/
    `transaction_amount` all zero, so this is purely about removing zero-value noise rows from the
    table — it doesn't change any KPI figure.
  - **Column cleanup, apartment KPIs, more sortable columns (v2.29.70):** removed the **Transaction key**
    and **Transaction type** columns from the table (mostly redundant with the Type badge; still in the
    CSV export). Added **"Performance by apartment"** — a row of KPI cards, one per apartment with any
    activity in the current filters (Recharge Collected, Deposit, transaction count), sorted
    highest-recharge first, so apartments can be compared at a glance instead of only the fleet-wide
    total. **Start Date** and **End Date** are now click-to-sort (same arrow-icon pattern as Paid date) —
    a single `{key, dir}` sort state now covers all three date columns (only one can be the active sort
    at a time), replacing the earlier Paid-date-only boolean.
  - **All apartments shown, Business insights, dynamic split (v2.29.81):** fixed a real bug where
    "Performance by apartment" silently dropped any apartment with zero transactions in the current
    filters (`.filter(a => a.count > 0)`) — so if the Apartment picker listed 6 apartments but only 4 had
    activity that period, only 4 cards showed, with no indication 2 were missing. Now **every apartment in
    the filter's option list gets a card** (idle ones read "No activity this period"), and the section
    header shows an explicit "N of M active" count. Added a deterministic **"Business insights"** panel
    (same What happened / What's ongoing / Result / Positive / Negative / recommended-actions shape as Net
    Revenue and Sales Insights — plain JS rules over the live filtered rows, no LLM) covering the
    collection trend vs the previous period, the recharge/deposit mix, the top apartment, and which
    apartments went idle. Both aggregate KPI cards (Deposit Collected, Recharge Collected) and each
    per-apartment card now also show a **live Deposit-vs-Recharge split percentage** — recomputed from
    whatever's actually in the current date/apartment/type filters (never a fixed ratio) — plus a new
    stacked-bar **"Deposit vs Recharge split"** card showing the same split for the whole filtered set.

### Task Planner (`planner`)
- **Purpose:** ClickUp-style Kanban for internal tasks (Scoping → … → Live).
- **How:** 7 status columns with drag-and-drop; List view + **Weekly** analytics view. Cards carry
  multiple assignees, category, sprint, notes, start/end dates, priority (P0–P3), attachments. Board
  columns/sprints/categories are admin-editable ("Modify Tasks"). Status changes raise persistent
  notifications (bell).
- **Attachments:** uploaded to the **backend** `POST /documents/add?email=<signed-in email>` as
  multipart form-data, field name **`documents`**; the response `path` is turned into a Firebase
  Storage `…?alt=media` download URL and the file shows a **CLOUD** badge. On failure it falls back to
  **IndexedDB** (LOCAL badge). The email comes from `sessionStorage.pw_user.email`. **Do not set
  `Content-Type`** on that upload — the browser adds the multipart boundary.
- **Storage:** `pw_tasks` (metadata) + IndexedDB (`pw_planner`) for local bytes.

### Employee (`employee`)
- Create/disable dashboard users; set role + per-module access **and per-section overrides** (the
  "Sections" expander in the create/edit-access grid — Default/Hidden/View/Edit per tab). Login
  matches email → this record. Storage: `pw_users` (now includes an optional `sections` map).

### Device Replacement (`devicereplace`)
- **Purpose:** record an old→new purifier swap via a short irreversible wizard (old device → new
  device → confirm). Records are final (no edit/undo).
- **How (write):** on confirm, the swap is transferred to Firebase via the **backend API**
  `POST /device-replacement/add` (Bearer-authed), body = `drPayload` (snake_case `actor`,
  `replaced_at`, `old_device{…}`, `new_device{…}`, `old_device_age_days`, `old_device_age_label`).
  Toast: *"Replacement saved to Firebase ✓"* on 200, else *"Saved locally — …"*.
- **How (display):** the record is cached in `localStorage` (`pw_device_replacements`) so it shows
  immediately and **survives reloads**; the list also makes a best-effort Firestore `:runQuery` on
  `device_replacements` for cross-device display and falls back to the local copy.
- **Ageing:** `deviceAgeing(install, uninstall)` → `{ days, label:"1y 2mo" }`.
- **Note:** cross-device display works only if the backend stores swaps in the `device_replacements`
  Firestore collection (or exposes a GET). Otherwise the list is per-browser.

### Logs Tracker (`logtracker`)
- **Purpose:** audit trail + API-failure monitor.
- **How:** every action calls `pushLog` (`pw_logs`), stamped with app version, actor, IP/ISP/geo
  (`pw_session` via `ipapi`/`ipify`/`bigdatacloud`). Clear-log + CSV export. **Failures** tab records
  API outages (`pw_failures`), shows a "Server Down" popup, and can email alerts
  (`POST /admin/notify-failure`). `LOGS_EPOCH`/`pw_logs_epoch` can wipe history once on next load.

### About (`about`)
- **Purpose:** version history + per-module docs + API-usage list, and the release publishers.
- **How:** renders `VERSION_HISTORY`, `MODULE_DOCS`, `API_USAGE`. **App Releases** / **Technician
  Releases** sub-tabs let admins publish release notes (see §7).

### ProWater AI — REMOVED (v2.29.79)
Built in v2.29.74, deployed live in v2.29.75, and extended to cover every module/sub-module plus a
Home-page baseline by v2.29.78 — then removed entirely in v2.29.79 at the user's request ("remove
the API and the ask ai feature i dont think so its working"). Removed: the floating chat widget
(`ProWaterAI` component + its Sparkles button), every `setAIContext`/`getAIContext` call across all
modules, the Home-page customer/invoice snapshot fetch that fed it, and the deployed Cloud Function
backend (`gcloud functions delete aiChat`, region `asia-south1`, project `backend-prowater`). The
function's source still lives in `functions-aiChat/` at the project root if this is ever revisited —
nothing else in the dashboard depended on it, so removal was a clean, isolated change.

---

## 7. Releases & the "what's new" popup

- **Shared storage (2.28.0+):** releases live in Firestore collection **`wisdom2.0_releases`**
  (`releasesApi`), so a release published by one admin reaches **every** login. `pw_releases` is an
  offline cache; a browser's previously local-only releases are auto-uploaded on first load.
- **Publish** (About → App/Technician Releases, admin only): writes a doc `{ id, kind:"app"|"technician",
  sprint, version, notes, publishedAt, scheduledAt, by }` via `POST …/documents/wisdom2.0_releases`.
  A future `scheduledAt` ("Announce from") holds the popup until due.
- **Popup** (`ReleasePopup`, shown once a user is logged in): pulls from Firestore on login and every
  3 minutes; shows every **due** release the user hasn't dismissed. "Seen" is tracked **per user**
  (`pw_releases_seen_by`), so a scheduled release still appears on the next login if missed.
- **Dependency:** Firestore rules must allow the logged-in client to read/write `wisdom2.0_releases`.

---

## 8. Conventions

- **Version bump:** on every shipped change, bump `APP_VERSION` + prepend a `VERSION_HISTORY` entry in
  `src/App.jsx` (also update `MODULE_DOCS` / `API_USAGE` if a module's behaviour or an endpoint
  changed). The version shows in the sidebar/home/login footers, the Logs Tracker banner, and About.
- **This doc:** update the relevant §6 module section (and §3/§5 if APIs/storage changed) in the same
  change. Keep the "Reflects APP_VERSION" line at the top current.

---

## 9. Deploy

1. Get the change into the `soroai/Wisdom2.0` repo's **`main`** branch (this working copy may be a
   standalone folder, not a git clone — copy `src/App.jsx` / this file into the repo, commit, push).
2. GitHub Actions (`deploy.yml`) builds with the repo secrets and publishes to GitHub Pages.
3. Verify the live app's version footer shows the new `APP_VERSION`.

---

## 10. Open dependencies / to-do

- **Firestore security rules** for the logged-in client on `wisdom2.0_releases` and (if used)
  `device_replacements` — without them, writes fail with "Missing or insufficient permissions" and the
  collections never appear. Rules example:
  `match /{coll}/{doc} { allow read, write: if request.auth != null; }` (or per-collection).
- **Server-side caching** of the Zoho list endpoints (customers/subscriptions/invoices) to stop
  org-wide rate-limits — see `BACKEND_CACHE_SPEC.md`.
- `POST /admin/notify-failure` backend route for API-failure emails.
- Device Replacement **cross-device list**: confirm the collection the `/device-replacement/add`
  backend writes to (or add a GET) and point the read-back at it.
- **ProWater AI was removed in v2.29.79** (see §6's "ProWater AI — REMOVED" entry) — no open items
  here anymore; the Cloud Function is undeployed and the frontend widget is gone.
