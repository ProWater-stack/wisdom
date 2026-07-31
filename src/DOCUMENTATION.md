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
> **Reflects:** `APP_VERSION` **2.29.42**.

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
  full-page view with five sub-screens — **Profile** (a fields table incl. Referral code, **LTV** = sum of all
  paid invoices, Security Deposit, Discounts w/ balance, Support tickets and Complaints, where only concerning
  values are highlighted amber/red; three 0-5 **scores** — Customer / Technician / Device — with conditional
  colours; and a **Spares-used** table. The old AI-summary card was removed in v2.29.11 — it only stitched
  numbers into sentences), **Transactions** (invoice history), **Tickets** and **Ops** (a Purifier-ID lookup
  into the Ticketing feed, counted **month-wise** — `Jan'26 · N` — each month expandable to its Issue-Category
  breakdown; Ops reuses the `Issue Category ≠ Complaint` filter), and **Referral** (referrals made / converted /
  pending, referral code, and the referee list — joined to the referral API by any shared key). All deterministic.

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
- **Purpose:** live device telemetry — RO-tank level + water quality, and junctionBox pressure/flow.
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
Cross-module reporting. Sub-tabs: **Overview**, Referral, Sales, Earned Revenue, AOP (admin/devops),
Apartment Performance, Billing, Revenue (Net Revenue), **Penetration Tracker**, Credits, App Logs.
(The old "Live Dashboard" tab was removed in 2.26.0.)

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
