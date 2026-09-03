# Wisdom 2.0 — ProWater Admin Dashboard · Technical Documentation

> **Purpose:** a single reference so any developer can understand what the tool is, how each
> module works, which APIs/logic/lookups it uses, and where data lives.
>
> **Maintenance (keep this current):** this file is updated **together with every code change**,
> the same way `APP_VERSION` / `VERSION_HISTORY` are bumped in `src/shared/core.js`. When you change
> a module's behaviour, an API, a storage key, or a lookup — update the matching section here in the
> same commit. The living, dated change-log lives in `VERSION_HISTORY` inside `src/shared/core.js`;
> this doc describes the *current* design.
>
> **Reflects:** `APP_VERSION` **2.29.326**.

---

## 1. Architecture & stack

- **Single-page React app, split by module (as of v2.29.112).** The app used to be one ~17k-line
  `src/App.jsx`; it's now 18 files so a developer can go straight to the file that owns a given
  module or section instead of scrolling one giant file:
  ```
  src/
    App.jsx                — ~1,300 lines: imports, MODULES/MODULE_GROUPS nav config, the root
                             App()/Shell()/Home()/ComingSoon()/ServerDownModal() layout, and the
                             tab-switch JSX that renders whichever module component is active. Pure
                             "wiring" — the map of the app, not its logic.
    shared/
      core.js               — non-JSX engine room: the LS wrapper, generic API-cache engine
                              (getCached/PERSIST_TTL/_memCache/_inflight), the Zoho paged-fetch
                              engine, every *Api data layer (customerApi/billingApi/ticketApi/
                              apartmentApi/creditNoteApi/appLogsApi/salesApi lives in modules/Sales
                              instead — see note below), date-range utilities, formatters, auth/
                              session state (Auth context/useAuth), and APP_VERSION/VERSION_HISTORY.
      ui.jsx                 — generic JSX UI primitives shared across modules: Table/Card/Modal/
                              Stat/Toolbar/Drawer/Field/Chip/Status/Person/Login/DateRangePicker/
                              MultiSelectFilter/etc + the shared inline style-object constants
                              (btnPrimary/btnGhost/td/grid4/axisTick/...).
    modules/
      Sales.jsx, Customer.jsx, Billing.jsx, ERP.jsx, FSM.jsx, IoT.jsx, Referral.jsx, Ticketing.jsx,
      AutoScheduler.jsx, Analytics.jsx, TaskPlanner.jsx, Employee.jsx, DeviceReplacement.jsx,
      LogsTracker.jsx, About.jsx — one file per module, containing that module's screens plus any
      helper/data-layer code used only by that module.
  ```
  **Note on data-layer placement:** a handful of `*Api` objects and their mappers/seed data live in
  `shared/core.js` rather than their "home" module's file, because an *earlier*-extracted module
  needed them too (extraction went safest-first, smallest modules before biggest, so a later
  module's data layer sometimes had to be hoisted early) — `apartmentApi`/`ticketApi` (needed by
  Sales/AutoScheduler before Ticketing's own turn) and `billingApi`/`creditNoteApi`/
  `depositForCustomer`/`mapSubscription`/`mapInvoice`/`mapSubmodule`/`termMonths` (needed by
  Customer.jsx before Billing.jsx's own turn) are the two cases; each hoist site has a comment
  explaining why. `salesApi`/`notHiddenLead` are the one exception in the other direction — they
  live in `modules/Sales.jsx` and Analytics.jsx imports them from there, since Sales was extracted
  first. When hunting for a data-layer function, check `shared/core.js` first, then the module file
  whose name matches the domain.
  Entry: `src/main.jsx` → `src/index.css`. Small helper in `src/lib/` (`apiUsageTracker.js`).
- **Build/deploy:** Vite (`npm run build`). Base path **`/Wisdom2.0/`** (see `vite.config.js`).
  Deployed to **GitHub Pages** by GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`;
  build-time env comes from repo **secrets** (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_EMAIL`,
  `VITE_API_ORIGIN`). Local `deploy` script uses `gh-pages -d dist`.
- **UI:** no component library. Inline styles + CSS variables (brand tokens defined in a `<style>`
  block near the top of `App.jsx`). v2.29.169 briefly redesigned the `Home` launcher's sidebar with
  **Tailwind CSS v4** utility classes instead; v2.29.175 reverted that whole redesign back to the
  original `App.jsx` (per explicit user request), so nothing in the app actually uses Tailwind
  classes today. The dependency and build wiring from that attempt are still present and unused —
  `tailwindcss`/`@tailwindcss/vite` in `package.json`, the `@tailwindcss/vite` plugin in
  `vite.config.js`, and the `@import "tailwindcss/theme.css"`/`utilities.css` lines in
  `src/index.css` — worth stripping out next time someone's in these files, but harmless to leave
  as-is meanwhile. Fonts: Playfair Display (headings) + DM Sans (body).
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
  (+ `pw_tokenExpiry`, 60 min, + `pw_refreshToken`). `authHeaders()` attaches
  `Authorization: Bearer <idToken>` to every backend call.
- **Session lifetime (reworked v2.29.100):** the Firebase ID token itself only lives ~1h, but an
  ACTIVE session no longer hard-stops there — `api.refreshIdToken()` silently renews it (via
  `POST securetoken.googleapis.com/v1/token`, `grant_type=refresh_token`, using the stored
  `pw_refreshToken`) a few minutes before it expires, as long as the user isn't already past the
  real idle window. This is folded into the same periodic (30s) check that drives idle/day-rollover
  logout (see §5/§11-adjacent session code in the App shell) — there is no longer a separate
  fixed-timeout effect that logs out purely because 60 minutes passed since login. **The only real
  logout triggers are:** 1h of true inactivity (any mouse/keyboard/scroll/touch resets the clock),
  the calendar day rolling over, or a renewal genuinely failing (offline, or the refresh token itself
  expired/revoked) AND the token then actually expiring — in that failure case a banner ("Trouble
  renewing your session…") shows first, so it isn't a surprise.
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
| GET | `/admin/get-all-subscriptions` | Billing, Earned Revenue (plan/term lookup) (Zoho Billing) |
| GET | `/admin/get-all-invoices` | Billing, Analytics, Earned Revenue (row source) (Zoho Billing) |
| GET | `/admin/get-all-submodules` | Earned Revenue's Start/End-date enrichment lookup (v2.29.104, by invoice_id → transaction_id) — response wraps rows in a top-level "subscriptions" key |
| GET | `/admin/get-all-creditnotes` | Credit notes / discounts — Analytics > Credits + All Customers (joined by Zoho customer id) |
| GET | `/admin/zoho/get-all-leads` | Sales, Analytics (Zoho CRM; `per_page=500`, server-cached) |
| GET | `/admin/zoho/get-all-apartments/data` | Sales apartment leads; Overview flat counts |
| GET | `/admin/get-app-logs` | Analytics · App Logs |
| GET | `/api/admin/all-referrals` | Referral (referrers + referees + credits) |
| GET | `/tickets/formattedforwisdom` | Ticketing (Zoho Desk, Wisdom-formatted) |
| GET/POST | `/api/gs-schedules` | Auto GS schedules (optional; local-first) |
| POST | `/documents/add?email=<user>` | **Task Planner attachments** (multipart, field `documents`) |
| POST | `/device-replacement/add` | **Device Replacement** save → Firebase |

Same origin, but **unauthenticated** (no Bearer header sent) — separate cursor-paginated feeds, see [[dp-transaction-tab]] / [[dp-customers-tab]]:

| Method | Path | Used by |
|---|---|---|
| GET | `/dp-transactions` | Analytics · DP Transaction (row source; `?cursor=` pagination) |
| POST | `/dp-transactions/add` | DP Transaction's admin-only Upload JSON → Run API (multipart, field `file`) |
| GET | `https://api.drinkprime.in/payments/payments/payments/v1` | Customer · All Customers, DP-stack Transactions sub-page (`?loader=true&page=1&pageSize=100&deviceCode={purifier_id}&installationID={dp_installation_id}`, v2.29.134 — replaced the old v2/collections endpoint; separate origin, CORS-open, direct browser fetch) |
| GET | `https://api.drinkprime.in/sponsor/device/details/syncs` | Customer · All Customers, DP-stack Sync History sub-page (`?pageSize=10&page=1&orderDir=desc&orderBy=id&deviceCode={purifier_id}`, v2.29.127 — separate origin, CORS-open, direct browser fetch) |

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
- **Default-excluded societies (`isRealSociety(name)`, v2.29.137):** the one canonical rule for what
  counts as a "real" society/apartment when a Society/Apartment filter is in its default (unset,
  `null`) state — excludes `"Apartment (Testing)"` and blank/unknown values (`""`, `"—"`, `"Unknown"`,
  `"— No society —"`, `"N/A"`/`"NA"`). Applied CRM-wide to every Society/Apartment `MultiSelectFilter`:
  Sales (Leads & Deals, Trend Analysis), Customer (Societies, All Customers, Customers), and Analytics
  (Overview, Sales Insights, Credits, Net Revenue, Earned Revenue, Reconciliation, DP Transactions) —
  12 sites total, all following the same pattern: `filter === null ? isRealSociety(x) : filter.includes(x)`.
  The excluded values stay selectable in each filter's dropdown; picking one explicitly overrides the
  default and shows it. First built for Customer > Societies alone (v2.29.130), generalized into this
  shared helper and applied everywhere else in v2.29.137.
- **Master Plan Catalog (`PLAN_CATALOG` + `planInfo(planCode)`, v2.29.133):** a 64-entry lookup, given
  directly by the business as an exhaustive real plan_code dump — every plan's **Device Type** (Normal /
  Hot & Cold / Test), **Filter Type** (UV / Mineral / Copper / Alkaline / Uncategorised / Test), and
  exact **Setup Fee / Price / Total / billing cadence** (`billEvery` + `billingInterval`; `total` is
  always `setupFee + price` in the source data, kept as its own field rather than re-derived). Keyed
  **only** by `plan_code` — `plan_name` is provably ambiguous (e.g. "PREMIUM" is Normal Device with
  Setup Fee ₹0 for `PREMIUM_1M_499` etc. but Hot & Cold with Setup Fee ₹4,000 for the `PREMIUM_*_SD`
  variants — same name, different code, different real device and deposit). `mapSubscription()` and
  `mapInvoice()` both carry `planDeviceType`/`planFilterType` (`mapInvoice` also gained `planCode`,
  which it didn't read at all before v2.29.132). A `plan_code` not in the table returns nulls/blanks —
  deliberately distinct from a plan the business has explicitly tagged "Uncategorised" in their own
  source spreadsheet, which is a real classification, not a gap. Superseded v2.29.132's
  `PLAN_CLASSIFICATION`; `classifyPlan(planCode)` is kept as a thin device/filter-only wrapper over
  `planInfo()` for its existing call sites (same signature/behaviour). Browsable at Billing &
  Subscription > **Plans** (read-only reference table, static local data — no API fetch).
- **Money split (rebuilt v2.29.108, re-prioritized v2.29.133):** `depositForCustomer(customer, plan,
  total, planCode)` splits a paid invoice into a **refundable deposit** and a **recharge** (revenue):
  `recharge = total − deposit`. Priority order, highest first: **(1)**
  `PLAN_CATALOG[planCode].setupFee` — exact real per-plan data, not a tier guess, so it wins whenever
  the plan_code is recognised, INCLUDING over the apartment/device-type table below. Confirmed against
  real discrepancies in the business's own two data sources: several MJR-prefixed plans (`MJR_6M_UV`
  etc.) carry Setup Fee ₹0 in the plan catalog even though MJR Clique Hydra's apartment-tier table
  below says Normal/Hot & Cold should be ₹1,500/₹3,000; Prabhavati's `ELT_PRABHAVATI_SD` plans carry
  Setup Fee ₹3,000 vs. the apartment table's ₹4,000 for Hot & Cold — the plan catalog is the more
  specific, more current source and wins. **(2)**
  `APARTMENT_DEVICE_DEPOSITS[normSociety(customer.society)]` — the REAL, fixed per-apartment/per-
  device-type deposit amounts (currently MJR Clique Hydra and Prabhavati Meghna Towers), used only when
  the plan_code isn't in the catalog (e.g. a very old invoice). **(3)** `depositForPlan(plan, total)` —
  the generic amount-tiered guess, last resort. At every level, a tier only applies when the paid
  amount actually **covers** it — a small recurring recharge invoice (deposit already collected
  earlier) correctly gets ₹0 deposit, not the full tier. Within the apartment table specifically, if
  the device type can't be read (blank purifier ID), it falls back to whichever of that apartment's own
  real tiers the amount covers, never the unrelated generic bands. All 13 real call sites (Analytics,
  Billing, Customer profile) now pass `planCode` as the 4th argument. **MRR:** `monthlyOf(sub) = amount
  / termMonths(sub)`; `termMonths` parses the term from the plan name/code (e.g. `…_6M` → 6) — not yet
  cross-checked against the catalog's own `billEvery`/`billingInterval`, tracked separately.
- **Dates:** `parseFlexDate()` parses many formats (ISO, `19-Jan-2026`, `19/01/2026`, epoch,
  `+0530`). Analytics uses month-index math (`year*12 + month`) for cohorts and MoM.
- **Shared UI Stacking (v2.29.305–308):** `MultiSelectFilter`'s dropdown list popup container has its `zIndex` raised from `40` to `100` (`src/shared/ui.jsx`). Additionally, the main shell layout container (`<main>`) has `zIndex: 50` set, and the sidebar rail `.pw-sidebar-rail` has `z-index: 100` on mobile viewports (`src/App.jsx`). This forces the main content stacking context to sit above the sidebar (which has sticky `z-index: 40`) on desktop, preventing absolute dropdowns from sliding underneath the sidebar, while preserving mobile drawer priority.
- **`MultiSelectFilter` dropdown clipping — actually fixed (v2.29.310):** the above z-index changes (v2.29.305–308) never actually fixed the reported bug ("half the dropdown going inside the sidebar") — confirmed live via `document.elementFromPoint`/`getComputedStyle` that it was never a z-index/paint-order issue. `<main>` sets `overflowY: "auto"` for its own scroll; per the CSS spec, `overflow-x` can't stay `visible` while `overflow-y` isn't, so the browser silently computes `overflow-x: auto` too — clipping the dropdown (a `position: absolute` descendant of `<main>`) at `<main>`'s own left edge whenever a filter's calculated panel position extends past it, regardless of any z-index. The panel is now rendered via `createPortal` to `document.body` — immune to any ancestor's overflow — positioned with `position: fixed` from the toggle button's own `getBoundingClientRect()` at open time, closing on scroll (a fixed-position portalled panel doesn't track the button as the page scrolls) and with the click-outside handler extended to also recognise clicks inside the portalled panel itself.
- **`Modal`/`Drawer` font fallback fixed (v2.29.314):** both are portalled to `document.body`, entirely outside `.pw-root` (the div carrying the app's real fonts — DM Sans body / Playfair Display headings, set in `App.jsx`) — so every popup in the app was silently rendering in the browser's default serif (Times) instead. Added explicit `fontFamily` (new shared `PW_BODY_FONT`/`PW_HEADING_FONT` constants matching `.pw-root`'s own stacks) directly on both components, fixing every Modal/Drawer app-wide at once.

---

## 5. Storage keys

**`sessionStorage`** (cleared on browser close): `pw_user` (logged-in identity), `pw_idToken`,
`pw_tokenExpiry`, `pw_refreshToken` (v2.29.100, silently renews the ID token), `pw_last_activity`,
`pw_session_day`, `pw_active_module`.

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
- **Purpose:** Zoho CRM leads — table, trend analysis, error correction, apartment leads.
- **How:** loads leads via `GET /admin/zoho/get-all-leads` (`per_page=500`, total-paginate; endpoint
  is server-cached and returns a `cached` flag). Full leads table with status/society filters;
  **Apartment × lead-status pivot** (join key: apartment name = lead "Society Name");
  **Error Correction** flags leads marked installed but missing money fields.
- **Storage:** live API (+ per-browser cache).
- **Leads & Deals / Apartment Leads always showed 0 results — fixed at the root (v2.29.119):** both
  screens' date-range filter (`DateRangeFilter` + `rangeFilter`/`dateInRange`) silently excluded every
  row, both at the default (no dates picked) state and with real dates picked. Root cause was in the
  shared `dateInRange()` helper: `DateRangeFilter`'s plain `<input type="date">` stores `from`/`to` as
  raw `"YYYY-MM-DD"` strings, but `dateInRange` compared them to a `Date` via `>=`/`<=` — a relational
  comparison against a string coerces it with `Number()`, which is `NaN` for a real date string (always
  false) and `0` for `""` (empty/default — also always false, since any real timestamp is `> 0`). Fixed
  in `shared/core.js`: `dateInRange()` now parses a string bound properly (floors "from" to start-of-day,
  ceils "to" to end-of-day so the picked end date is inclusive) and treats an empty/null bound as
  unbounded; `Date`-object bounds (from `resolveRange()`) are untouched. This is a shared helper, so the
  fix also resolved the same silent-zero bug on Analytics > App Logs (not separately reported, found and
  fixed in the same pass). Separately, `SEED_DEALS` (Sales' sample-data fallback) was missing a `created`
  field entirely — only `updated` was ever set — so sample leads still failed the date filter even with
  `dateInRange` fixed; each entry now carries a matching `created` timestamp.
- **Sales Analytics tab removed (v2.29.119)** per explicit request — the screen (`SalesAnalytics`), its
  nav entry, `MODULE_SECTIONS`/`TAB_SOURCES` entries, and its `App.jsx` tab-switch render were all
  deleted. (Analytics > Sales Insights, a separate cross-module report under the Analytics module,
  is unaffected.)
- **Pipeline tab removed (v2.29.129)** per explicit request — the screen (`SalesPipeline`, the Kanban
  board grouping leads by stage), its nav entry, `MODULE_SECTIONS`/`TAB_SOURCES` entries, and its
  `App.jsx` tab-switch render were all deleted; the now-unused `LEAD_STATUS_COLOR` export and a
  handful of icon/UI imports (`Stat`, `grid4`, `TrendingUp`, `Users` from lucide/shared-ui — nothing
  else in the file used them) were removed too. Sales' remaining tabs: Leads & Deals, Apartment Leads,
  Trend Analysis, Error Correction — **Leads & Deals is now the default tab** when opening the module.
- **Leads & Deals (`SalesLeads`) rebuilt in v2.29.124** per a fuller user-supplied mockup. **(1) KPI
  cards** simplified from one card per distinct raw Lead Status to exactly 3 — a dark "Total Leads"
  card, "Converted" (`stage === "won"`), and a grouped **"Not Interested"** bucket covering every
  non-won lead — replacing the old dynamic per-status grid, which grew noisy as more raw statuses
  appeared in the live data. The Not Interested card's caption lists whichever raw statuses actually
  make up that bucket in the current date window (e.g. "Includes RNR, Not Interested, Connect Later,
  Lost, Wrong No"), computed live from the filtered leads — never a hardcoded list. Cards are
  display-only now (no longer click-to-filter). **(2) The status filter dropdown** was simplified to
  match: All statuses / Converted / Not Interested (was one option per raw status), filtering on lead
  stage rather than exact raw-status text. **(3) Search/date-range/Export** restyled to the mockup
  (inset search icon, pill select, compact date-range pill) — same real state underneath; the shared
  `Toolbar`/`DateRangeFilter` wrapper components were swapped for bespoke styling since they're simple
  enough to safely reimplement (unlike the calendar-popover `DateRangePicker`/`MultiSelectFilter` kept
  as-is elsewhere in this app). **(4) Table** restyled (rounded card, tinted sticky header, two-tone
  pill status badges — green for Converted, red for everything else); the **Tenure** column was dropped
  from the on-screen table (not in the mockup — still included in the CSV export, unchanged). Move To
  column still `isAdmin`-gated as before.
  **v2.29.129, per follow-up:** split a dedicated **Interested** KPI card (blue, literal Zoho raw
  status "Interested") out of what used to be folded into the Not Interested bucket — Not Interested
  is now a catch-all for every non-won, non-Interested lead only (its caption's raw-status list and %
  shrink accordingly). The status filter dropdown gained a matching "Interested" option. Also added a
  **Society** filter (`MultiSelectFilter`, options from the full unscoped lead set, same convention as
  Trend Analysis's Apartment filter) alongside the existing search/status/date-range controls.
- **Trend Analysis (`sales_trend`, v2.29.92)** — a period-filterable read of the pipeline, sitting
  after Apartment Leads. Reuses the same lead/stage data the Sales module's own screens read,
  but scoped to a real date-range picker
  (`DateRangePicker` — Today/This Week/This Month/This Quarter/This Year/Yesterday/Previous Week/Previous
  Month/Previous Quarter/Previous Year/Custom) instead of just a society filter. Layout, top to bottom:
  **(1) KPI cards** — **Total Leads / Interested / Converted / Conversion Rate**, each with a
  period-over-period delta except Interested (see below). Total/Converted use a real % change
  (`momPct`); Conversion Rate shows a **percentage-points** delta instead (e.g. "+3pts", not a
  misleading %-of-a-% change) since the metric is already a percentage. Styled as a featured dark
  "Total Leads" card plus light glass cards, each with a circular icon badge and a coloured delta
  pill (**v2.29.121**, per a user-supplied Apple-style mockup, replacing the old shared `Stat`
  component). **Recomposed in v2.29.123** (per a fuller mockup covering the whole screen): the old
  **Lost Leads** card was dropped, replaced by a new **Interested** card — this period's
  Interested-status lead count, with a blue **"% share of Total Leads"** badge instead of a
  period-over-period delta (a composition stat, not a trend).
  **(2) A monthly leads-vs-conversion-% trend section** ("Leads vs. Conversion Breakdown", retitled
  from "…Rate" in v2.29.123), trailing 8 calendar months, independent of the period picker — a
  month-on-month view needs several months regardless of what single period is selected. Redesigned
  in **v2.29.120** (per a user-supplied HTML mockup) from a Recharts grouped-bar+line chart to a plain
  glass card: a KPI strip (N-month total leads, average/peak/latest-month conversion %) above one row
  per month, each with its own Interested/Not Interested/Converted proportional stacked bar and a
  conversion-% figure; the **latest month is picked out** in a highlighted card with a pulsing "Live"
  badge (a CSS `@keyframes` ping). Colours are the mockup's own Apple-system palette (blue #007AFF/
  orange #FF9500/green #34C759/purple #AF52DE for conversion %) — kept as given. All figures computed
  live from the trailing-8-month data; nothing hardcoded.
  **(3) Lead Conversion Funnel + Forecast & Trends, side by side** (2-col grid, collapsing to one
  column under 1024px — **v2.29.123**, replacing the funnel's previous full-width-alone layout). The
  funnel itself is unchanged content — same Total Leads/Interested/Not Interested/Converted hierarchy
  (redesigned to a glassmorphic card in **v2.29.122**, per a user-supplied mockup), a green-tinted
  "close rate" callout with a Target icon, computed live from `funnel`/`totalN`/`wonN`/`convPct`.
  **Forecast & Trends is new in v2.29.123** — a dual-axis Recharts `ComposedChart` (Lead Volume on the
  left axis, Conversion Rate % on the right), projecting the next 4 months as a **dashed** continuation
  of the solid actual-months line. The projection is a plain **flat average of the last up to 3 real
  months'** leads/conversion %, rolled forward month-by-month from the true latest real month present
  in the data — never the mockup's own hardcoded example figures — and is labelled honestly in a
  caption as an average, not dressed up as a real forecasting model. The **average-time-to-convert
  card** this tab previously carried (added alongside the v2.29.120 redesign) was **removed in
  v2.29.123** per follow-up request, along with its now-dead calc (`daysToConvert`/`convTimes`/
  `avgConvertDays`/`fastestConvertDays`/`slowestConvertDays`/`convertDeltaDays`).
  All of the above is deterministic — plain JS rules over the live filtered leads, no LLM. (The
  "Sales Director's read" business-insight panel this tab originally shipped with was removed in
  v2.29.95 — see below.)
- **modules/Sales.jsx integrity note (v2.29.123):** the file was found with lines 346–941 holding raw
  `<!DOCTYPE html>`…`</html>` markup in place of the entire `SalesTrendAnalysis` function — overwritten
  outside this app's own edit history (the file would not parse or build in that state). Rebuilt from
  scratch per the fuller mockup described above; verified via a Babel parse, an ESLint no-undef/
  no-redeclare sweep, and a clean `npm run build` before resuming feature work.
- **Iterated per direct feedback (v2.29.93)**, each change proposed via a confirm-first question before
  building: added an **Apartment/society multi-select filter** (cascades through KPIs, insights, chart,
  funnel). The monthly trend chart went through several shapes (dual lines with click-to-drill-down → dual
  bars) before landing on its current one: **three stacked bars per month — Interested / Not Interested /
  Converted, summing to Total Leads** — plus the Conversion % line back on the secondary axis, data labels
  on every segment, and a "Total N" label above each month's stack. "Interested" is the **literal Zoho raw
  lead status text** (`rawStatus.toLowerCase() === "interested"` — distinct from the "demo" stage bucket
  it maps into via `mapZohoLead`, identified here by its own raw text instead); "Not Interested" = Total −
  Interested − Converted, so the three segments always sum to the full stack height. A **Rep leaderboard**
  and an **Idle-leads follow-up table** were added, then removed again per a later ask. An **"Average time
  to convert"** card (hero stat + Fastest/Slowest, computed from each WON lead's created→updated gap, with
  a period-over-period delta in days) sits between the chart and the funnel. The funnel itself was briefly
  rebuilt as an actual tapering funnel (CSS clip-path trapezoids) then reverted back to the original
  horizontal-bar-list style per a follow-up — net unchanged from v2.29.92's shape.
- **Stacked bars → grouped bars (v2.29.94):** the stacked-bar layout was squeezing data labels into small
  segments (unreadable when a category's count was low). Switched to **grouped (side-by-side) bars** —
  Total Leads / Interested / Not Interested / Converted each render as their own full-height bar per
  month, so every label sits above its own bar with guaranteed room; the Conversion % line stays overlaid
  on the secondary axis. Total Leads is now its own explicit bar (previously an implicit stack-height
  total) — matches the literal 4-item hierarchy asked for. The "latest month" flash (brand-green fill +
  pulsing dot) moved from the topmost stacked segment onto the Total Leads bar.
- **"Sales Director's read" removed (v2.29.95)** per explicit request — the page now goes straight from the
  KPI cards to the monthly trend chart. The whole computation block that only fed that panel (open/idle
  lead tracking, the channel/society/rep grouping helpers, and the resulting insight strings) was removed
  too, since nothing else in the tab depended on it.
- **Funnel now shares the trend chart's hierarchy (v2.29.96)** — the conversion funnel's rows changed from
  Total leads → Contacted+ → Demo+ → Proposal+ → Converted (Won) (a stage-bucket breakdown) to the SAME
  Total Leads / Interested / Not Interested / Converted categories used in the chart above it, each still
  shown with its count and its % of Total Leads. The now-unused stage-bucket helpers (`STAGE_ORDER`/
  `rankOf`/`reached`) were removed along with the old breakdown.

### Customer (`customer`)
- **Purpose:** Zoho Billing customer accounts, plans, credits.
- **How:** `GET /admin/get-all-customers` (paginated, `per_page=500`) merged dynamically in the core data layer with missing active DrinkPrime devices from the transactions feed to form a unified Zoho + DP CRM directory (262 active customers total). Searchable list; plan/billing
  editable per role; grand-total row. **Societies** sub-tab groups customers by society with
  count/active/device-mix (Own/Normal/Hot&Cold from the purifier-ID prefix), expandable per society.
  The Overview "Active Customers" figure and Top-Societies "Active" column come from this active-status logic.
- **Customers list — real Device/Filter Type (v2.29.138):** the table, CSV export, and detail drawer now
  show the real business-given **Device Type** and **Filter Type** (`planInfo`/`PLAN_CATALOG`, v2.29.132/133)
  looked up via the customer's subscription `plan_code` (same join key as Plan Amount). Falls back to the
  purifier-ID-prefix guess (`deviceType()`) for Device Type only when no subscription/plan_code match exists
  — Filter Type has no such heuristic, so it shows "—" in that case. This is a *different, more accurate*
  Device Type value than the purifier-ID heuristic used everywhere else (Societies' device-mix, All
  Customers' badge, the KPI cards on this same page) — those are intentionally left on the heuristic for now.
  **v2.29.139:** added Device Type and Filter Type as their own `MultiSelectFilter`s in the toolbar
  (options built from the same `deviceTypeOf`/`filterTypeOf` values shown in the table, `null`/all by default).
- **Societies rebuilt (v2.29.130)** per explicit request. **(1) Per-metric expand:** each society row's
  numbers are individually clickable — Customers expands everyone in that society; Active/Own/Normal/
  Hot & Cold/**Churned** expand only that slice. Clicking the same number again collapses; clicking a
  *different* number while a society is already open dynamically switches the slice shown, no need to
  collapse first (state is a `Map<society, sliceKey>`, not a `Set`). **(2) New Churned column:** a
  customer counts as churned if either their device is Un-Installed (DP-stack `deviceStatus`) or their
  `status` is Inactive (either stack) — the exact same signals/normalisation (`normSt`, strip
  whitespace/hyphens/underscores, substring-match "uninstall") All Customers' row-highlighting already
  uses. Dunning does **not** count as churned — it's a payment-status warning, not device churn.
  **(3) Society and Device Type filters** (`MultiSelectFilter`) above the table. Device Type narrows
  the customer population *before* grouping — selecting "Own Device" only, for example, recomputes
  every society's numbers as if Normal/Hot & Cold customers didn't exist, and a society with none of
  the selected type(s) drops out of the table entirely. **(4) Default-hidden societies:** the Society
  filter's unset (`null`) state excludes **"— No society —"** and **"Apartment (Testing)"** — pick
  either explicitly from the dropdown to override the default and see it. The KPI cards (Societies /
  Customers / Avg per society / Largest society) now read off this same filtered, default-excluding
  population instead of the raw unfiltered universe, so they stay consistent with the table.
- **All Customers (v2.29.4):** search by Purifier ID / phone / name / email; the results table also carries
  a **Device Type** column (`DeviceTypeBadge`) and, in the toolbar, a **signup-date range** filter ("All
  Time" plus the same Today/…/Custom presets used elsewhere, filtering on each customer's `since` date) and
  **Society / Status** multi-select filters (`MultiSelectFilter`, v2.29.99 — same component/summary
  convention as the Customers page's Society filter). **v2.29.140:** Device Type now uses the real
  plan-catalog value (same `planInfo`/plan_code join as the Customers page, purifier-ID heuristic as
  fallback) and a new **Filter Type** column was added — both now have their own `MultiSelectFilter`s in
  the toolbar too, alongside Society/Status/Customer Stack. Clicking a customer opens a
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
- **Customer Stack filter + DP-stack Transactions (v2.29.113, field mapping fixed v2.29.114/.115,
  status row-highlighting + DP Customers tab removed v2.29.117):**
  All Customers gained a **Customer Stack** multi-select filter (alongside Society/Status) and a
  **Stack** column, both derived from a DP-origin customer's `customer_profile.is_dp_customer` (mapped
  in `customerApi.getCustomers()` as `isDpCustomer`; `false` -> "Zoho", `true` -> "DP", tolerant of a
  stringified `"true"`/`"1"` too). `dpInstallationId` is read from
  `customer_profile.dp_details.dp_installation_id` — confirmed via a real record: `dp_details` is a
  sub-object of `customer_profile` (sibling of `is_dp_customer`, not a sibling of it) carrying
  `{ dp_customer_id, dp_installation_id, device_code, partner_name, device_status, balance_litres,
  paid_liters, price, ... }`. A DP-stack customer has no real Zoho invoices, so opening one and
  clicking **Transactions** reads live from the DrinkPrime collections API instead of the Zoho-invoice
  table. **Swapped APIs again in v2.29.134** (per explicit request) from the old v2/collections
  endpoint to `GET https://api.drinkprime.in/payments/payments/payments/v1?loader=true&page=1
  &pageSize=100&deviceCode={purifier_id}&installationID={dpInstallationId}` — needs BOTH the Purifier
  ID and Installation ID, both already on hand from get-all-customers (confirmed CORS-open, direct
  browser fetch, no backend proxy). Response shape: `{ body: [{ amount, litres, status, timeStamp,
  paymentType, valStart, valEnd, txnId, mode, deviceId, paymentRef? }] }` — a flat array (the old
  endpoint's response was `{ body: { content: [...] } }`, differently nested). Rendered as Date
  (`fmtTime(timeStamp)`, real time-of-day, not just the date)/Transaction Key (`txnId`, e.g.
  `DPTX_71cfc2a029044e12a3be6e9ffa352a97`)/Amount/Litres/Valid Period (`valStart` → `valEnd`)/Payment
  Mode (`mode`)/Status. The LTV calc (v2.29.126) and the Total Paid summary card both sum `c.amount`
  now (were `c.totalPaid` on the old endpoint). **Known real-data quirk, caught via live testing:** a
  setup-fee row and its paired first-recharge row can share the exact same `txnId` — confirmed on two
  different real customers — so the table row's React key includes the row index alongside `txnId`,
  not `txnId` alone (which threw a duplicate-key warning otherwise).
- **Fixed Last Payment always blank for DP customers (v2.29.135)** — same root cause as v2.29.126's
  LTV bug: `lastPayment` was computed only from `txns.find(t => t.status === "paid")` (Zoho invoices),
  always empty for a DP-stack customer. Now, for DP customers, last payment = the most recent
  DrinkPrime transaction by `timeStamp` (via `reduce` over `dpTxns`, not assumed array order).
  Verified live against a real customer — correctly shows the real most-recent transaction date.
- **Fixed Start Date/End Date on the Zoho-stack "Payment & Invoice History" table (v2.29.136)** —
  both columns always showed the same value as the invoice's own Date column. This join already
  existed and was already reading from get-all-submodules by design, but keyed/read the RAW
  snake_case field names (`invoice_number`/`transaction_id`/`current_term_starts_at`/
  `current_term_ends_at`) directly — `submodules` here is already `mapSubmodule()`-mapped
  (`billingApi.getSubmodules()`), whose real field names are camelCase (`.number`/`.id`/`.termStart`/
  `.termEnd`), so none of the snake_case reads ever matched and the join silently fell through to the
  invoice's own single `date` for both columns every time. Now reads `.number`/`.id`/`.termStart`/
  `.termEnd` — the same join Analytics > Earned Revenue already uses correctly for this exact feed.
  Zoho-stack customers' Transactions sub-page (GST breakup,
  revenue-recognition card) is otherwise unchanged. Two iterations to get the field paths right — v1
  assumed both fields sat directly on `customer_profile`, v2.29.114 correctly found `is_dp_customer`
  there but still missed `dp_installation_id`'s real nesting one level deeper — both fixes verified
  against a real `customer_profile` block the user shared, via a live browser test that mocked
  `get-all-customers` with that exact shape and ran it through the real mapper end-to-end.
  **v2.29.117:** results table rows are colour-coded by status (checked in this order) — **Un-Installed**
  (`deviceStatus`, from `customer_profile.dp_details.device_status`, DP-stack only) → yellow;
  **Dunning** (`status`, Zoho's raw `subscription_status` pass-through) → red; **Inactive** (either
  stack's own "inactive"/"in-active" status) → orange; anything else → no tint. The standalone
  **DP Customers** tab (`DPCustomers`, `cust_dp`) was removed entirely — the Customer Stack filter
  covers browsing DP-origin customers now, so the separate tab (its own `GET /dp-customers` feed, KPI
  cards, and Upload JSON → Run API bulk import) was redundant; `fetchAllDpCustomers()`/its cache were
  removed from `shared/core.js` too as now-dead code.
- **Status filter defaults to a fixed set on load (v2.29.128):** `statusFilter` now initializes to
  `["Active", "In-Active", "active", "dunning"]` instead of "all" — per explicit request. These are
  the literal casing variants as given, not normalized: real `status` values are inconsistent across
  sources (Zoho's own raw pass-through vs. a DP device-status string sharing the same field), so this
  matches exactly those four literal strings rather than a case-insensitive rule. Still a real
  `MultiSelectFilter` selection — widen it back to "all" from the dropdown same as any other filter.
- **Sync History: dropped 4 columns, added a computed one (v2.29.128):** Flow Rate/Input TDS/Output
  TDS/Temperature removed from the table per follow-up; added **Balance Litres** = Total Litres −
  Consumed Litres, computed client-side per row (not a field the sync API itself returns).
- **Sync History sub-page for DP customers (v2.29.127):** a new tab alongside Timeline/Profile/
  Transactions/Tickets/Ops/Referral, shown only when `sel.isDpCustomer`. Reads
  `GET https://api.drinkprime.in/sponsor/device/details/syncs?pageSize=10&page=1&orderDir=desc
  &orderBy=id&deviceCode={purifier_id}` — the customer's own Purifier ID doubles as the DrinkPrime
  `deviceCode`, no new field needed; confirmed CORS-open like the other DrinkPrime endpoints already
  used here. Real response shape: `{ body: { total_elements, total_pages, results: [{ deviceCode,
  totalLitres, consumedLitres, paidUpto, status, inputTDS, outputTDS, temperature, coordinates,
  syncDate, networkId, flowRate }] } }`. Shows a 4-card summary (Total Syncs from `total_elements`,
  Latest Sync, Consumed Litres, Network — all from the newest row) above a 9-column table (Sync Time/
  Network/Consumed Litres/Total Litres/Flow Rate/Input TDS/Output TDS/Temperature/Paid Upto) and a
  "Showing latest 10 of N total syncs" caption — no pagination UI, exactly the one call specified.
  `status`'s meaning isn't documented anywhere available, so it's deliberately left out of the table
  rather than guessing a red/green interpretation. The fetch is **lazy** — only fires once the tab is
  opened, unlike the v2.29.126 DP-collections fetch (nothing on the "at a glance" strip depends on
  this data, so there's no reason to call a third-party API for every DP customer opened). Verified
  against the real API with a real device code (`CRL354E8A2`, 87 total syncs) via a live browser test.
- **Fixed DP-stack LTV always showing ₹0 (v2.29.126):** `totalPaid` — which feeds LTV in both the
  "at a glance" strip and the Profile tab, plus the Customer score — was computed only from Zoho
  invoices (`txns`). A DP-stack customer has no real Zoho invoices, so `txns` is always empty for
  them, and LTV was always ₹0 no matter how much they'd actually paid via DrinkPrime. For DP
  customers, `totalPaid` now sums their DrinkPrime collections' `totalPaid` (the same `dpTxns` feed
  the Transactions sub-screen already shows) instead of the Zoho invoice total. Also changed the
  DP-collections fetch (`useEffect` gated on `sel`/`sel.isDpCustomer`/`sel.dpInstallationId`) to fire
  as soon as a DP customer is opened on **any** subtab — it was previously gated to `subtab ===
  "transactions"`, so LTV stayed wrong until the user happened to click into Transactions first.
  Zoho-stack customers are unaffected — their `totalPaid`/LTV path is unchanged.
- **Fixed hover-zoom on data tables (v2.29.125):** the shared `Card` component (`shared/ui.jsx`) always
  applied a global `.pw-card` class that lifts + `scale(1.012)`s any card on hover (`App.jsx`) — a nice
  touch for small dashboard tiles, but a jarring jitter on a card that's mostly one big scrollable data
  table. Added a `hover` prop to `Card` (default `true`, unchanged everywhere else) and set it `false`
  on every `Card` wrapping a `<Table>` in this module — the main All Customers results table, plus
  Referrals, Zoho Invoices, DP-stack Transactions, and the Ticket-history month list in a customer's
  profile view. Those cards now render static on hover; no other screen's cards are affected.

### Billing & Subscription (`billing`)
- **Purpose:** subscriptions, invoices, deposits, and **Billing Analytics**.
- **How:** `GET /admin/get-all-subscriptions` + `/admin/get-all-invoices`. Billing Analytics shows
  MRR/ARR, **MRR by plan** (active subs × `monthlyOf`), revenue by society, Week-over-Week &
  Month-over-Month (collected), renewals due, deposits/refunds. Deposit vs recharge split via
  `depositForCustomer` (see §4).
- **Tabs: Subscriptions, Invoices, Deposits & Refunds, Plans.** (The **Overview** tab —
  `BillingOverview`: Active Subscriptions/Est. MRR/Outstanding/Collected KPI cards, plus
  Subscriptions-by-Status and Active-Revenue-by-Plan charts — was removed entirely at v2.29.316, per
  explicit user request. `bill_subs` was already this module's default tab before that change, so
  nothing else shifted.)
- **Invoices and Deposits & Refunds now also fetch customers (v2.29.108)** — previously invoices-only /
  subscriptions-only — purely so the real per-apartment/device deposit table can apply; both join by
  `customerNumber`/`zohoCustomerId`/`zohoId` the same way every other module does.
- **Deposits & Refunds > Manually Recorded Refunds (v2.29.313):** the page's main table was entirely
  auto-generated from live subscriptions (held/eligible/requested/approved/refunded) — there was no way
  to log a refund for a customer whose subscription record no longer exists (e.g. paid out after
  uninstallation), per explicit user report. Added a second table, "Manually Recorded Refunds", with its
  own **"Add Refund Entry"** button opening a popup (`Modal`) form: Customer Name, Mobile Number,
  Uninstallation Date, Refund Amount, Invoice Number, Transaction ID/Reference ID/Refund ID, and a Refund Mode dropdown
  (UPI / Bank Transfer / Cash). Entries persist to `localStorage` (`pw_manual_refunds`) — same
  module-level store/`LS.get`/`LS.set` convention as Device Replacement's `_drStore` — no backend API
  exists for this yet. CSV export and a per-row Remove button included. Submitting requires only a
  customer name and a valid refund amount; the rest are optional.
- **Original 'Deposits & Refunds' table removed (v2.29.315),** per explicit follow-up request — now that
  Manually Recorded Refunds (above) covers the real need, this page goes straight from the top KPI
  cards into that section. Also removed with it: the Request/Approve/Refund action-button chain (wrote
  to a session-only `refunds` state that never actually persisted across a reload). **Note:** the
  "Refund requests" and "Refunded" KPI cards at the top were the only thing those buttons ever fed —
  with them gone, those two cards now permanently read 0/₹0; "Deposits held"/"Avg deposit" are
  unaffected (driven by subscription data directly, not the removed buttons).
- **Plans tab (`Plans`, `bill_plans`, v2.29.133; live-wired v2.29.287/288)** — a reference table of the
  real plan catalog, now fetched from `GET /admin/subs-module-get-all-plans` (`billingApi.getPlans()`,
  same `getCached`/paginated pattern as subscriptions/invoices), falling back to `SEED_PLANS` (the
  original 64-plan `PLAN_CATALOG` dump, reshaped) when the live endpoint is unreachable. Columns match
  the live API's confirmed real fields, not the old static shape: Plan Name, Plan Code, **Deposit
  Amount** (`setup_fee`), **Recharge Amount** (`recurring_price`), **Total Amount** (setup_fee +
  recurring_price), **Tenure** (`interval` + `interval_unit`, e.g. "1 months"), and a **Link** column —
  a "Copy Link" button that copies the plan's real Zoho checkout URL. Device Type/Filter Type columns
  and their filters were removed — those fields don't exist on the real payload. KPI cards: Total
  Plans, Active Plans (`status === "active"`), Deposit Required, No Deposit. Search, every column
  sortable, CSV export, grand-total footer. `PLAN_CATALOG` itself (and everything else that reads it —
  `planInfo`/`classifyPlan`/`depositForCustomer`, Analytics.jsx, Customer.jsx) is UNCHANGED and still
  static — only this page's own view is live now, deliberately, so this can't silently move numbers
  anywhere else in the app. Registered in `TAB_SOURCES.bill_plans` as its own `plans` source.

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
    (pH 6.5–8.5, TDS 50–300 ppm, temp 15–25 °C) are app-side constants, not in the feed.
  - **junctionBox units** (`payload.units[].channels`) → the existing water-pressure / unit-health /
    channels grid with per-device pressure/flow charts and 12-hour consumption.
  Known tank device `E05A1B9C2DD4` is always kept in the roster, polled and selected by default.
  The module top bar shows the **apartment name** (`Prabhavati`) as a centred pill so the site is clear (v2.29.14).
- **Weather + correlation (v2.29.17):** a **live-weather strip** at the top of the module (temp/humidity/condition at Prabhavati — Garvebhavi Palya, Bengaluru, coords hardcoded in `WEATHER_LOCATION`), and a **"Weather correlation"** card inside Trend analysis. Data comes from the **Google Weather API** (`history/hours:lookup`, past 24h) through a **Cloud Function proxy** (`weather-proxy/` folder — holds the key server-side, 60-min cache, demand-driven, ~10–24 calls/day); the newest history hour is the live reading (no `currentConditions` call). `weatherApi` (60-min client cache + tolerant mapper) reads the proxy at `WEATHER_PROXY_URL` — **now LIVE** (`https://asia-south1-backend-prowater.cloudfunctions.net/weather`, deployed v2.29.18); if that ever goes blank/unreachable the UI falls back to a clearly-labelled SAMPLE. The correlation card joins each reading to its nearest weather hour and shows **Pearson r** (`iotPearson`/`iotWeatherCorrelate`) for outdoor temp vs water temp / TDS / pH, plus a dual-axis outdoor-vs-water-temp chart. All in-app, no LLM.
- **Tank refill animation (v2.29.37):** the RO tank pings its level ~every 10 min; `iotTankRefilling(chrono)` flags the tank as **actively refilling** when the level steps UP across the recent ~65-min window (latest reading > earliest in window). While refilling, the tank graphic shows a **pump** in the base gap (spinning impeller), a **pipe** running from the pump up the side and over into the neck, and **blue water flowing in animated waves** through the tubes into the tank, with a **"Refilling"** tag on top. Purely visual (CSS), driven by real level history, threaded `IoTDevices → IoTTankPanel → IoTTank`; honours `prefers-reduced-motion`.
- **Warming vapour (v2.29.38, trigger widened v2.29.39):** `iotTempWarming(chrono)` flags the water as **warming** whenever the latest water temp (from the recent ~65-min window) is **above the ideal band (> 25 °C — the Warning/Hot zone)**, or when it's **trending up into that zone** (rising and ≥ 24 °C). *(v2.29.39 dropped the earlier "must be actively rising AND ≥ 26 °C" rule, which left a steady 26 °C tank showing no steam.)* While warming, **wisps of vapour rise off the water surface** inside the shell — positioned at `bottom:var(--level)` so they track the surface as it fills/drains — with an amber **"Warming"** tag. Same in-app, CSS-only pattern as the refill rig; honours `prefers-reduced-motion`.
- **UI (v2.29.2):** the tank is a transparent see-through graphic (lid/neck/shell) with the water block filling to the live level % and moving wave layers; the **Online** KPI shows a live green ECG heartbeat and **Offline** a red flatline; the RO-tank **Recent readings** table is paginated 10/page. Water-quality ranges drop non-positive sensor dropouts. (A fleet-wide AI-summary strip at the top existed briefly but was removed in v2.29.27; the in-card AI summary that later lived inside the Water Quality/RO Unit Sensors cards was removed in v2.29.97 — see below.)
- **Recent readings ECG (v2.29.12 → v2.29.13):** above the table, one **ECG-style wave per metric** (pH / TDS / Temperature / Tank) drawn over the device's history feed. v2.29.13 upgraded the wave rendering — a faint monitor grid, shaded ideal band with dashed guides, a soft gradient area-fill, crisp non-scaling segment-coloured strokes (green/amber/red per segment) with a subtle glow, a haloed leading dot, and ~72-point bucket-averaging for smoothness — and moved the wave cards from the dark "monitor" look to clean **white / off-white** cards (light border + soft shadow, value coloured by band, deeper line colours tuned for legibility on white).
- **Trend analysis (v2.29.16):** the section was rebuilt around a proper **interactive Recharts time-series** (`ComposedChart`) for the selected device — real time on X, the metric on Y, the **ideal band shaded** (`ReferenceArea` + dashed `ReferenceLine`s), each **out-of-range reading as a red dot**, and a hover tooltip (timestamp · value · in-/out-of-range · ideal). The focus metric is switched via tabs (with per-metric anomaly counts) or by clicking a mini-wave. An **"Anomalies only"** toggle isolates the out-of-range points in the chart (line hidden) and filters the readings table. Four deterministic **analytical tiles** sit on top — **Sensor health** (Good/Check from `iotSensorHealth`: reporting-gap, dropout rate, staleness), **Water quality** (Good/Warning/Critical from the window's worst band), **Alerts created** (out-of-range event count from `iotAnomalyScan`) and **Anomalies by metric** (per-metric counts) — plus an **Anomaly history** list (each event's date/time, worst value, High/Low). All in-app, no LLM. *Planned next step: correlate anomalies with a weather API.*
- **Pressure / flow / dispensed-litres (v2.29.43):** the RO-tank heartbeat (`waterQuality`) grew three fields — `pressure` (bar), `flowMLPM` (flow rate, L/min) and `totalDispensed` (lifetime dispensed litres, a monotonically-increasing counter). Wired in at full parity with pH/TDS/temp:
  - **RO Unit Sensors** card (separate from **Water Quality**, since pressure/flow describe the unit's plumbing, not potability) — `IoTWaterQualityCard` is now a generic component (`keys`/`title`/`subtitle`/`noun`/`extra` props) reused for both the potability card (`ph`/`tds`/`temp`) and this one (`pressure`/`flowMLPM`), so both share the same min–max range + GOOD/WARNING/CRITICAL band scaffolding. **Total dispensed** renders separately underneath (`IoTDispensedStat`) as a plain lifetime-total + this-window-delta stat — not banded, since a running counter has no "ideal range."
  - ~~Ideal bands are assumed residential-RO operating ranges... pressure green 0–4 bar / amber 4–6 / red outside; flow green 0–3 L/min / amber 3–6 / red outside.~~ **Superseded in v2.29.69 — see below; pressure/flow no longer band amber/red at all.** Both legitimately read **0 while idle** (no tap open) — unlike pH/TDS/temp, 0 is *not* treated as a sensor dropout for these two (`IOT_WQ_DROP_ZERO`).
  - Pressure & flow also got their own **gauges** (`IOT_GAUGE`), and joined **Trend analysis** as selectable metric tabs/charts — `iotTrendMetrics()` and `iotAnomalyScan()` were generalized to loop over the full metric registry instead of a hardcoded `ph/tds/temp/tank` list, so any future metric added there needs no other call-site changes. **Recent readings** table and CSV export gained Pressure / Flow / Dispensed columns.
  - Live-tested against the real device (`E05A1B9C2DD4`) via the local dev preview: it was reporting **655.34 bar**, flagged CRITICAL by the banding at the time — see v2.29.69 below, this turned out to be normal pump-cycling behaviour, not a fault.
- **Pressure/flow are pump-driven, not water-quality metrics (v2.29.69):** per the person who placed the sensors, NEITHER end of the pressure/flow range is a real anomaly — 0 while the pump is off (nothing to read) and whatever the line reads once the pump kicks on, at any magnitude (a 655 bar spike on pump-start is a normal artifact of this sensor placement, confirmed against the real device above). `iotWqClass` now always returns `"green"` for `pressure`/`flowMLPM` — they never rate WARNING/CRITICAL. This one change cascades to every dependent screen: the RO Unit Sensors card badge, its gauges (fully green track, no amber zone), the Recent-readings table (no red/amber highlight on these columns), and the Trend analysis "Anomalies by metric" tile (Pressure/Flow always 0). Water Quality (pH/TDS/Temp) is untouched. The card's "Ideal: X–Y" subtext for these two now reads "Pump off = 0, pump on = live reading — both normal" instead, since there's no enforced ceiling to imply anymore.
- **Loading state (v2.29.44):** fixed a load flash — the module used to drop its full-page spinner as soon as `/devices/status` (the roster) resolved, so the device list, tank graphic, gauges and Water Quality card briefly rendered with empty/zero data ("Awaiting sensor readings", 0% tank, `—` gauges) for a beat before the first `/devices/history` round-trip landed. A `historyLoaded` flag now gates the loading state on **both** requests completing at least once. Replaced the small generic spinner with a dedicated `IoTLoading` panel — bigger spinner, "Loading live device data…" copy, and an indeterminate progress bar — so the wait reads clearly as loading, not a blank/broken module.
- **pH/TDS moving average (v2.29.118):** on the Water Quality card, pH and TDS now display a moving
  average of the 10 most recent valid readings ("avg of last N") instead of the window's min–max
  range — `iotWqRange()` computes `movingAvg`/`movingAvgN` from the 10 newest values (same
  dropout-zero filtering as min/max). The GOOD/WARNING/CRITICAL badge is unchanged — still evaluated
  off the full window's min/max, so a brief real spike still gets flagged even though the headline
  number is now smoothed. Temperature (same card) and Pressure/Flow rate (RO Unit Sensors card,
  same component) are untouched — still min–max.
- **Dispensed average (v2.29.45):** the **Total Dispensed** stat (under RO Unit Sensors) gained an **Average / day** figure next to Total dispensed and This window. `iotDispensedRange` now also tracks each reading's timestamp and divides the window delta by its actual span (the history feed is a downsampled ~1–2 day window, not exactly 1 day), instead of the window delta appearing twice under different labels. Shows `—` until the window has at least 30 minutes of span, so it can't flash a wildly inflated estimate right after the page loads.
- **Dispensed stat simplified (v2.29.46):** dropped **This window** from the Total Dispensed stat — showing the raw litres dispensed across whatever ~1–2 day span the history feed happened to have loaded read as an arbitrary, hard-to-explain number on its own. Now just two figures: **Total dispensed** (lifetime) and **Average dispensed** (per day, from `iotDispensedRange`'s `avgPerDay`).
- **Shared date-range filter (v2.29.47):** the Total Dispensed stat is now date-filterable with its own **Today / Yesterday / This Week / This Month / Last Month** chips, and that filter is **shared** with Trend analysis + Recent readings below (previously each owned a separate, page-local Today/Yesterday/Week filter) — `range` state moved up to `IoTDevices`, so picking a period in either place updates both. Two new options join the existing rolling-7-day "This Week": **This Month** and **Last Month**, real calendar months (`iotFilterByRange`, `IOT_RANGE_OPTIONS`, reusable `IoTRangeChips`). The Trend analysis history fetch widened from `&days=7` to `&days=62` (`hist7dByDevice` renamed `histRangeByDevice`) so "Last Month" has data to filter regardless of where in the current month "today" falls. Total dispensed now reads as the counter value as of the end of the selected period rather than always "right now"; the card shows "No dispensed-litres data for this period" instead of vanishing when a period has none (e.g. Last Month, before the device started reporting `pressure`/`flowMLPM`/`totalDispensed`).
- **Dispense Summary promoted to its own card (v2.29.87):** after a user-provided visual mockup, audited the RO-tank view feature-by-feature against it — the mockup's ideas for the gauges, trend chart, anomaly history, weather correlation and Recent-readings filters were all already present here in a more capable form (real ideal-band zones/ticks, segment-coloured charts, Contamination/Tank/Dead-device filtering), so those were deliberately left as-is rather than downgraded to the mockup's simplified static versions. The one real gap: **Total dispensed** was a small stat (`IoTDispensedStat`) tucked inside the RO Unit Sensors card, sharing its own chip row. It's now its own standalone, full-width **`IoTDispenseSummaryCard`** — a prominent hero-style card (big "Total dispensed" headline number + unit, "as of {period}" sub-line, and "Average dispensed" right-aligned) sitting between the tank/water-quality 3-column row and the RO Unit Sensors card. No new chips on this card — the shared `range` state is still controlled from Trend analysis / Recent readings just below, so nothing is lost. Scope decisions made explicit with the user before this change: the fleet KPI row (Total/Online/Offline/With faults) and the live fault-alert/toast system stay (mockup just didn't include a snippet for them); the **junctionBox** device view (a different device type entirely — pressure/channels/consumption) is untouched, since the mockup only depicts the RO-tank layout; the Water Quality card keeps showing its real pH/TDS/Temp ranges with RAG bands rather than being rebuilt down to the mockup's plain placeholder list.
- **Range chips restored to the Dispense Summary card (v2.29.88):** the user then shared a fuller version
  of the same mockup, confirming the rest of the RO-tank view already matches closely (a live screenshot
  they attached lined up with what's already shipping). One real correction it revealed: the mockup puts
  the **Today/Yesterday/This Week/This Month/Last Month** range chips directly on the "Dispense Summary"
  card (above the Total dispensed number) — v2.29.87 had dropped them from that card, assuming the copies
  on Trend analysis/Recent readings were enough. Added them back to `IoTDispenseSummaryCard` (now takes a
  `setRange` prop) — same shared `range` state as the other two locations, so changing the period from any
  of the three updates all of them.
- **Tank brand text — compared, then kept as ProWater (v2.29.89):** a direct side-by-side pixel comparison
  between a live screenshot and the mockup found exactly one visual difference — the tank graphic's
  moulded brand text reads "ProWater" (small droplet icon) where the mockup shows "SINTEX" over a tiny
  tracked "WATER TANK" caption. Briefly swapped `.pw-tank-brand` to match the mockup exactly, then reverted
  back to "ProWater" + the icon per a follow-up from the user — this dashboard keeps its own brand on the
  tank graphic rather than the mockup's placeholder tank-manufacturer name. Everything else on the tank
  (shell shape, cap, water fill, scale, float-switch list) was already a close match — no other changes.
- **Real product photography replaces the CSS-drawn tank (v2.29.90):** the user supplied actual photos of
  the physical ProWater tank at four fill states — Empty, 25%, 50%, 75% — saved to `Tank Photos/` at the
  project root. Copied into `public/tank/` as web-optimised JPEGs (`sips`, resized to 700px + quality 82 —
  ~90KB each, down from ~1.5MB source PNGs) and wired into `IoTTank` via a plain `pct → image` lookup
  (`IOT_TANK_PHOTOS`). This works with **zero interpolation logic** because the tank's real feed is 4
  physical float switches (`IOT_TANK_STEPS`), never a continuous analog reading — `iotTank()` only ever
  returns exactly 0/25/50/75/100, so the component just shows the one real photo matching the current
  switch state. The entire hand-drawn tank illustration (moulded shell, two animated wave layers, rising
  bubbles, a refill pump-and-pipe rig, warming vapour wisps, the 100/75/50/25/0 tick-mark scale) was removed
  along with all its now-dead CSS (`.pw-tank`, `.pw-tank-lid/-neck/-shell`, `.pw-water`, `.pw-wave*`,
  `.pw-bubble`, `.pw-band*`, `.pw-tank-brand`, `.pw-tank-base`, the refill-rig and vapour classes/keyframes)
  — the tick-mark scale in particular no longer has a meaningful pixel mapping onto a real photo, so it was
  dropped rather than guessed at. The "Refilling"/"Warming" status pills are kept, now overlaid directly on
  the photo as simple badges (no more animated pump/vapour graphics under them) — dropped a duplicate
  "Warming" pill that briefly showed twice (the panel header already renders one). Two follow-up fixes
  after the first look: **(1) enlarged the photo** — `.pw-tank-photo` grew from a 230px fixed width to a
  fluid `width:100%; max-width:340px`, and the panel's `minHeight` grew 300→380 to fit it without cramping.
  **(2) blended the photo's studio backdrop into the card** — the light-gray background was showing as a
  visible box against the app's white card. Fixed with `mix-blend-mode:multiply` on the `<img>` (multiplies
  near-white studio pixels against the white/near-white card background, which visually erases them) plus
  a soft radial `mask-image` fading the very edge — no real background removal/alpha-cutout was needed.
  **Known gap:** no real "tank full" (100%) photo was supplied yet — that state currently falls back to the
  75% photo (flagged with a `TODO` comment in `IOT_TANK_PHOTOS`) until one is provided.
- **Real background removal, replacing the blend/mask hack (v2.29.91):** the multiply+mask trick from
  v2.29.90 left a faint gray vignette visible at the photo's corners — the studio backdrop wasn't quite
  pure white, so `mix-blend-mode:multiply` alone couldn't fully erase it. Replaced with a real chroma-key
  pass (Pillow): sample the true background colour from all 4 corners of each source photo, make pixels
  close to it fully transparent with a soft distance-based ramp (for anti-aliased edges, not a hard cutout),
  tight-crop the transparent margins, then palette-quantize to control file size. Produces genuine
  alpha-transparent PNGs (~110–135KB each) that composite cleanly onto any card background — verified by
  test-compositing over bright green and mint backgrounds before shipping, confirming no halo/artifact.
  The CSS multiply/mask workaround is removed entirely (`.pw-tank-photo img` is back to a plain, unstyled
  `<img>`); `IOT_TANK_PHOTOS` now points at `.png` files instead of `.jpg`.
- **Device Monitor cleanup + TDS unit fix (v2.29.285–299), a run of explicit user requests:**
  - **TDS now reads ppm, not mg/L (v2.29.285)** — every TDS-related unit string across the module
    (the Water Quality gauge, trend-chart tooltip/axis, CSV export header, fleet "Avg TDS" badges,
    anomaly-detection messages) was corrected from `mg/L` to `ppm`, the correct convention for this
    app's domain. No numeric values changed, only the displayed unit text.
  - **RO Unit Sensors ("Hydraulics & Pressure") card removed (v2.29.286)** — the second
    `IoTWaterQualityCard` (keys `pressure`/`flowMLPM`) stacked below Water Quality & Potability on
    Device Monitor was removed entirely, per explicit request. The shared `IoTWaterQualityCard`
    component itself is untouched — still reused elsewhere.
  - **Fleet Macro Uptime Strip removed (v2.29.297)** — the row of 4 KPIs (Fleet Uptime, Avg Line
    Pressure, Active Monitored Fleet, Active Fault Alerts) that sat under the Live Weather card was
    removed entirely, along with its two now-dead local variables. The separate Total Devices/Online/
    Offline/With Faults KPI row further down is untouched.
  - **Cloudy weather animation redesigned (v2.29.295)** — `IoTWeatherCard`'s "cloudy" mode was a
    single flat cloud SVG bobbing in place; rebuilt as 4 independently-drifting cloud puffs at
    different depths/opacities (staggered negative animation-delays, `pwCloudDrift`) with a soft
    drop-shadow each and a warm pulsing sun-glow peeking through behind the deck — matching the level
    of detail the "rain" mode's 6 falling drops already had.
  - **Water Quality card's leftover empty space filled (v2.29.298–299)** — removing the Hydraulics
    card (above) left this card shorter than its row siblings (the grid uses `alignItems: "stretch"`),
    so it had visible blank space at the bottom. Filled via `IoTWaterQualityCard`'s existing `extra`
    slot (anchors to the bottom via `marginTop: "auto"`) with **Dispensed Today** — a fixed
    calendar-today figure, deliberately independent of the shared `range` toggle the Tank panel/Trend
    charts read — plus a small bouncing-droplet + expanding-ripple animation next to it
    (`pwDropBounce`/`pwDropRipple`, respecting `prefers-reduced-motion`). "Total dispensed" was tried
    here too but dropped — it's already shown in the Tank panel card right next to this one.
  - **Dead code removed:** `IoTDispenseSummaryCard` (the standalone hero card from v2.29.87/88,
    documented above) was never actually rendered on any page — confirmed zero call sites — and was
    removed, along with several other long-unused exports found in the same cleanup pass:
    `IOT_FLOW_COLORS`, `iotBandCell` (superseded by `iotBandText`), `iotVol`, and `iotRunAlerts` (the
    old alerts-list generator, superseded by `iotAnomalyEvents` — the Alerts page's actual data
    source; `IOT_ALERT_SEV`, which both used, is kept since `iotAnomalyEvents`'s rendering still
    reads it).

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
  filters + detail drawer. **Ops Tickets** sub-tab (v2.29.319/v2.29.320) =
  Issue Category ≠ Complaint AND Technician Visit Date is not null/empty AND Technician Visit Slot is not null/empty.
  Top KPI stat cards and the TDS table were removed in v2.29.320 per explicit user request; replaced the issue-type spares
  breakdown with a dedicated **Spares Used** summary table aggregating parts and consumption counts dynamically filtered by date.
  The Overview "Ops Appointments" card counts tickets by "Technician Visit Date" for today…+3 days.
  **Overview** (v2.29.321/v2.29.322/v2.29.323) — added a date filter (shared `DateRangePicker`/`useDateRange`, presets + custom
  From–To) that scopes the whole page — KPI cards, Tickets-by-Status donut, Tickets-by-Issue-Type bars — to
  tickets whose created date falls in the selected period. Added a full-width **"Daily Tickets Created"**
  chart below the KPI row: one bar per calendar day across the selected range with vertical emerald gradient fills,
  custom SVG data label badges above active days, an adaptive Rolling Moving Average trend curve rendered as a smooth
  spline with vibrant Indigo gradients (`#6366F1` to `#8B5CF6`) and soft area shading, an interactive 4-mode trend switcher
  (Smooth MA, Daily Curve, Linear, Hide Line), and real-time header metric chips (Peak volume, Daily average, Active days count).

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
Cross-module reporting. Sub-tabs: **Overview**, Referral, Earned Revenue, **Reconciliation**, **DP
Transaction**, AOP (admin/devops), Apartment Performance, **Renewal & Churn Risk**, Billing, Revenue (Net
Revenue), **Penetration Tracker**, Credits, App Logs. (The old "Live Dashboard" tab was removed in 2.26.0.
The **Sales Insights** tab, `an_sales` — a leads funnel read that duplicated ground the Sales module's own
Trend Analysis/Leads screens already covered — was removed in v2.29.141.)

- **Renewal & Churn Risk (`ChurnRiskRadar`, `an_churn`, v2.29.82)** — flags customers at risk of churn by
  joining three already-live signals onto one customer-level table: **subscription renewing within 30
  days** (same `nextBilling`/days-out derivation Billing Analytics' "Renewals due" card already uses),
  an **overdue/failed invoice** (`i.status === "failed" || (i.balance > 0 && i.rawStatus?.toLowerCase()
  === "overdue")` — the exact condition Billing Overview/Subscription Reconciliation already use), and
  the customer record's own **`status === "dunning"`** (Zoho's raw payment-actively-failing state). Each
  match adds to a score (dunning +3, overdue +2, renewal due +1 or +2 if within 7 days) that buckets into
  **High/Medium/Low**, 5 KPI cards, a level-filterable/searchable table, and CSV export. (Originally also
  had a "Business insights" panel — removed dashboard-wide in v2.29.97.) **Deliberately excludes an IoT
  "device gone quiet" signal** — there is no existing field
  joining a customer's `purifier_id` to a real IoT `deviceId` (the real IoT module only monitors two
  apartment-level RO/junction-box installations, not individual customer purifiers), so adding one here
  would have to be fabricated — flagged rather than built. Verified via temporary seed-data injection (a
  test customer with dunning status + an overdue invoice + a renewal due in 7 days) — correctly scored
  High with all three reasons listed, then the test data was removed.

- **Overview V2 (`AnalyticsOverview`, `an_overview_v2`)** — a unified, filtered command dashboard for Zoho Billing + DrinkPrime. Loads customers, subscriptions, invoices, leads, **referrers**, tickets, apartments, and DrinkPrime transaction logs. Two filters scope the page: a **date-range picker** (This Month/Quarter/Year/Custom, compared vs the previous equal period) and a **Society multi-select**. Every chart honours both filters.
  - **KPI row:** Displays 8 cards in a single scrollable row: Combined Total Collected, Combined Recharge, Combined Deposit, DP Total Collected, DP Recharge, Total Customers (Zoho + DP split reconciled to 262 active), and SaaS unit economics: **ARPU (Monthly Average Revenue Per User)** and **LTV (Projected Lifetime Value)** based on a 1.5% monthly churn rate.
  - **Revenue by Source:** Pie Chart with percentage data labels showing Zoho Recharge, Zoho Deposit, DP Recharge, and DP Deposit shares.
  - **Combined Monthly Collection:** stacked Zoho + DP collection trends bar chart (trailing 7 months).
  - **Plan Tier Distribution:** horizontal bar chart showing active subscriptions grouped by plan tier.
  - **Under-Penetrated Buildings:** active connection density progress tracker highlighting the top 5 apartments with the lowest active density.
  - **All Apartment Performance:** unified society metrics table detailing deposits and recharges for both Zoho and DrinkPrime (excluding empty rows). Clicking any apartment name opens a **Modal subpage** displaying the list of all Zoho & DrinkPrime customers who made a payment (split by recharges, deposits, and total collected) in that apartment during the selected date range.
  - **Refresh Security:** The top-bar Refresh button is authorized for **admin-only** access (`tabIsAdmin`).
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
  - **Search now includes mobile number (v2.29.102):** the search box only matched customer name or
    apartment/society — an invoice itself carries no phone field, so it's now joined in from the
    customer record the same way apartment/society already is (`custOf(i)`, keyed off
    `zohoCustomerId`/`zohoId`/`customerNumber`). Matching is digit-only on both sides, so
    "8839452234" finds a stored "918839452234" regardless of a country code or formatting.
  - **Row source briefly switched to `GET /admin/get-all-submodules` (v2.29.103), then REVERTED
    (v2.29.104), per follow-up feedback:** v2.29.103 rebuilt this table to source one row per
    `get-all-submodules` record (with a literal field mapping incl. the feed's own `transaction_id`
    shown as "Invoice ID" and `reference_number` shown as "Transaction ID") joined back to a customer via
    `subscription_id`. v2.29.104 reverted all of that — the table is back to one row per PAID
    `get-all-invoices` record, with Reference Number/Payment Mode/Apartment/Customer restored and the
    16-column layout from before v2.29.103.
  - **Start/End date enrichment lookup (v2.29.104):** `get-all-submodules` is still fetched, but now
    purely to supply real term dates. Each invoice's own `id` (`invoice_id`) is matched against a
    submodule record's `id` (mapped from that feed's `transaction_id`) — `modByTxnId[i.id]` in
    `EarnedRevenue()`. When a match exists, Start Date/End Date (and everything the earned-revenue
    formula derives from them — `tenureDays`/`daysInPaidMonth`/spillover) use the feed's real
    `current_term_starts_at`/`current_term_ends_at` instead of the old due-date-based approximation.
    When no match exists, it falls back to the original computation (due date as start, "due date + 1
    calendar month − 1 day" as end) exactly as before v2.29.103 — verified live with seed data: matched
    invoices show real multi-month/year tenures (e.g. one shows a 365-day tenure vs the ~30 days the old
    formula would have computed), the one unmatched invoice correctly falls back to the ~30-day
    due-date-based figure. `billingApi.getSubscriptions()` was restored to this screen's fetch (needed
    again for plan/term lookup).
  - **Real-API gotcha found via a live Postman call (v2.29.104):** the submodules fetch was silently
    extracting **zero rows** on the actual deployed endpoint — no console error, just a permanent
    "Showing sample data" — because the live response wraps rows in a top-level **`"subscriptions"`**
    key, not `"submodules"`/`"data"` as first assumed. Fixed the extraction to check `json.subscriptions`
    first. **Caveat:** the full real response shape beyond `subscription_id`/`current_term_starts_at`/
    `current_term_ends_at`/`amount`/`interval`/`status`/`plan_name`/`plan_code`/`first_name` (confirmed via
    a partial screenshot) hasn't been independently verified — in particular whether a `transaction_id`
    field genuinely exists on this feed for the invoice_id lookup to match against. If Start/End dates
    look wrong or never differ from the due-date fallback once pointed at the live endpoint, check the
    real field name for that link first.
  - **Interval column (v2.29.105):** added right before Earned/month — the billing cadence ("1 month" /
    "3 months" / "1 year") read from the SAME matched submodule record as Start/End date, off its own
    `interval`/`interval_unit` fields (`mapSubmodule()` → `intervalCount`/`intervalUnit`). Singular/plural
    handled directly ("1 month" not "1 months"). Reads "—" for any invoice with no submodule match, same
    fallback behavior as Start/End date.
  - **Lookup hardened with an invoice_number fallback (v2.29.106):** the invoice↔submodule match now
    tries `invoice_id` ↔ `transaction_id` first (the original key), then falls back to matching on
    `invoice_number` (both feeds carry it) if that doesn't find one — `modByTxnId`/`modByNumber` in
    `EarnedRevenue()`. Prompted by Interval still showing blank on the live site after the field mapping
    was confirmed correct against a real API record; the leading suspect is still the 3h `submodules`
    localStorage cache serving rows mapped before this field existed (fix: click in-app Refresh, not a
    browser reload), but this fallback also guards against `invoice_id` not literally equaling
    `transaction_id` in the live data — something that can't be confirmed without comparing a real
    invoice and its submodule match side by side.
  - **Recognition formula rebuilt to a Paid-Date-anchored tenure (v2.29.107), per a worked spreadsheet
    the user provided (verified to reproduce both their examples exactly — a 1-month recharge: paid 17
    Aug, end 14 Sep, ₹450 → tenure 29 days, 15 days in Aug, ₹233 earned; and a 6-month recharge: paid 31
    May, end 30 Nov, ₹594 → tenure 184 days, 1 day in May, ₹3 earned):**
    - **Tenure now runs from the actual PAID DATE through End Date** (`tenureDays = endDate − paidDate +
      1`) — previously it ran from Start Date/due date through End Date. Start Date is still shown as its
      own column but no longer feeds the earning math at all.
    - **This structurally removes the old late-payment-clip and already-lapsed-tenure special cases** —
      since tenure starts at the payment itself by definition, the paid month can never be "before" or
      "after" the tenure window; `daysInPaidMonth` is simply `min(endDate, monthEnd) − paidDate + 1`.
    - **Removed:** Next month, Days in next month, Earned revenue (next month) — the old one-month-ahead
      spillover view.
    - **Added, right after Earned revenue:** **Remaining Month** and **Remaining Days** (how much of the
      tenure is left from TODAY through End Date — 0 once the term has fully lapsed), and **Remaining
      Days Earned Total Revenue** / **Remaining Month Earned Total Revenue** (that remainder projected
      two ways: `recharge × remainingDays ÷ tenureDays` for an exact day-count proportion, and
      `earnedPerMonth × remainingMonths` for a coarser flat-monthly-rate estimate). `remainingMonths` is
      a count of calendar months from today's month through End Date's month, inclusive.
    - **Table is now 18 columns, in this exact order:** Invoice # / Reference Number / Apartment / Start
      Date / Paid on / End Date / Total paid / Deposit / Recharge / Interval / Earned/month / Tenure days
      / Days in paid month / Earned revenue / Remaining Month / Remaining Days / Remaining Days Earned
      Total Revenue / Remaining Month Earned Total Revenue. CSV export matches (Invoice ID/Customer/
      Apartment/Plan stay CSV-only, same as before). **(Days in paid month later dropped from BOTH the
      table and CSV in v2.29.111 — see below; 17 columns as of that version. Customer added back to the
      on-screen table in v2.29.131 — see below; 18 columns as of that version.)**
  - **Tenure-day off-by-one fix (v2.29.109):** the paid date and end date were compared as raw parsed
    timestamps, which can carry different times-of-day depending on the source string (a plain date vs. a
    full datetime) — whenever the end date's time-of-day was more than 12 hours later than the paid
    date's, `Math.round((end − paid) / 86400000)` rounded up and silently added a phantom day to Tenure
    days, which then propagated into Days in paid month, Earned revenue, and both Remaining
    Days/Months + their Earned Total Revenue columns. Fixed by normalizing every date feeding this calc
    (paid date, submodule term start/end, the due-date fallback, and today's date) to midnight with the
    existing `startOfDay()` helper before any day-count arithmetic runs. Verified with a standalone
    reproduction: a paid date at midnight against an end date 32 days later but carrying a same-day-plus-
    14-hours timestamp gave 33 tenure days before the fix, 32 (correct) after. Also removed the long
    explanatory `sub=` text under the "Per-invoice recognition" table header — the card now shows just its
    title.
  - **Remaining Month overstatement fix + column trim (v2.29.111):** `remainingMonths` was counting how
    many distinct calendar-month LABELS the span from today through End Date touched, not how many months
    of the term were actually left — a 1-month recharge with e.g. 16 real days remaining, if that stretch
    straddled a calendar-month boundary, counted as "2" months remaining and multiplied `earnedPerMonth ×
    2`, fabricating a second month of projected revenue that was never paid for (reported live: a ₹350
    1-month recharge showing ₹700 Remaining Month Earned Total Revenue). Fixed by capping `remainingMonths`
    at the recharge's own interval length (`Math.min(months, ...)`) — a 1-month recharge can never show
    more than 1 remaining month, a 6-month recharge never more than 6; long multi-month recharges, where
    the calendar-month count genuinely does track real months left, are unaffected. Verified with a
    standalone reproduction of the exact reported case: ₹700 → ₹350. Also removed the **Days in paid
    month** column from both the table and CSV per follow-up — it's the numerator half of the Earned
    revenue formula's internal working (`Earned revenue = Recharge × Days in paid month ÷ Tenure days`)
    and reads as noise without Tenure days' context alongside it; still computed internally, just no
    longer its own column, in both the on-screen table (now 17 columns) and the CSV export (which also
    carries the CSV-only Invoice ID/Reference Number's sibling fields/Customer/Plan from the earlier
    v2.29.84 trim).
  - **Customer column restored (v2.29.131):** added back to the on-screen table, between Reference
    Number and Apartment — the value (`r.customer`, from the invoice's `customerName`) was already
    computed and exported to CSV since the v2.29.84 trim, just not rendered on screen. 18 columns as
    of this version. Footer total row's `colSpan` bumped 6→7 to stay aligned with the extra column.
    (The same request also reported the deposit figures as wrong; the current `depositForCustomer()`
    logic was re-verified live and is unchanged from v2.29.108 — see "Apartment/device security
    deposits" — pending the user restating the specific correction, since no record of it exists in
    this session's history.)
  - **Deposit/Recharge lookup moved off PLAN_CATALOG onto the live plans API (v2.29.280–290), a run of
    explicit user requests, ending in a real production discrepancy:** `lookupPlanEntry()` was added as
    a LOCAL helper (deliberately not a change to the shared `depositForCustomer`/`planInfo`, which ~8
    other reports also call) that looks up an invoice's plan by code/name and, when found, sets Deposit
    = the plan's setup fee (only when the invoice's own total actually covers it — a genuine first/setup
    invoice; a smaller renewal invoice still correctly shows Deposit ₹0 rather than an impossible number
    bigger than what was paid) and Recharge = the remainder. A real case (two catalog entries both named
    "STANDARD", one with a deposit and one without) showed the backend can return a real-but-wrong
    `plan_code` for a given invoice — fixed by preferring, among every candidate sharing the code or
    name, whichever one's own Total exactly matches what was actually charged. v2.29.289 re-pointed this
    same lookup at `billingApi.getPlans()` (the live plan catalog API, same source Billing & Subscription
    > Plans now uses) instead of the static `PLAN_CATALOG`, falling back to `SEED_PLANS` if unreachable —
    `PLAN_CATALOG` is no longer imported in Analytics.jsx at all. v2.29.290 added an Interval-column
    fallback: when the submodule join (above) has no match for an invoice, Interval now falls back to
    the matched plan's own `billEvery`/`billingInterval` instead of a bare dash.
  - **Credit column (v2.29.292–294):** per explicit user domain knowledge, a blank Reference Number on
    an invoice means a credit note was applied to it in Zoho. Added a Credit column showing the real
    `creditnote_number` (e.g. "CN-00014") when it can be matched — first by trying an explicit
    invoice-number link on the credit note (`GET /admin/get-all-creditnotes`' `invoice_number`/
    `invoices_applied` fields), which live data confirmed always comes back empty, so it falls through
    to matching by customer (`zoho_customer_id`) + the note's actually-applied amount exactly equalling
    the invoice's total — the strongest available signal without a real invoice link. Shows generic
    "Yes" when a credit is implied but no specific note can be confidently matched, "(-)" otherwise.
  - **Mobile Number column + wider search, Remaining Month removed (v2.29.291):** added a visible Mobile
    Number column (the phone was already searchable, just never shown); search now also matches Invoice
    # and Reference Number, not just customer/apartment/mobile. Removed the **Remaining Month** column
    (Remaining Days / Remaining Days Earned Total Revenue / Remaining Month Earned Total Revenue are
    unchanged) — table is now 20 columns with Mobile Number + Credit added, Remaining Month removed.
  - **Credit column formatting and popup details (v2.29.303):** Fixed 'CN-00010' wrapping onto two lines in the table by applying `whiteSpace: "nowrap"` and whitespace stripping on the button trigger element. Rebuilt the credit note matching logic to split comma-separated strings inside the Zoho API `invoice_number` field into individual invoice numbers for index matching. Populated the `invoices_applied` array of objects (invoice #, date applied, amount applied) and exposed compatibility aliases (total, total_credits_used, description) for the React popup modal. In the popup, formatted the dates safely to prevent timezone/parsing errors.
  - **Match popup font styles (v2.29.304):** Matched the typography in the Credit Note Detail popup modal to align with the rest of the page. Applied the system sans-serif font family (`-apple-system, SF Pro Display, system-ui, sans-serif`) to the wrapper, corrected numeric font weights from 800 to 700, and updated colors (gold `#E8A93A` for active balance and `#1D1D1F` for headers/labels/invoices) to fit the Warm Sand theme palette.
  - **Live Month Flashing & Tooltip MoM changes (v2.29.306):** Re-engineered the rolling timeline array in `EarnedRevenue()` to fetch 13 months of raw data so we can compute the MoM percentage changes for both \"Earned\" and \"Recharge collected\" across all 12 displayed months. The active month (live month) in the composed chart is now styled to pulse dynamically (bar gradient opacity and line point expanding ring). Added a custom `EarnedRechargeTooltip` that displays these MoM percentage deltas alongside the absolute values with visual up/down arrows.
  - **Negative delta coloring (v2.29.309):** Colored negative Month-on-Month percentage changes in bright red (`#dc2626` / `#ff4d4d`) inside both the chart labels (utilizing SVG `<tspan>` tags) and the custom hover tooltip (`EarnedRechargeTooltip`) in the Earned vs Recharge Collected chart (`src/modules/Analytics.jsx`).

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
  - **Visual redesign (v2.29.85)**, built to match a mockup the user provided — same underlying data/logic
    throughout, purely presentational. The waterfall's four cells (Opening/New dues/Payments/Closing) are
    now connected by **+/−/= operator badges**, with a "Reconciled"/"Check needed" pill next to the title
    and the tie-out check moved into its own **Verification** panel (was a plain text line below the
    cells). A new **"Period overview"** card sits beside the waterfall — a 3-bar Due/Collected/Receivable
    snapshot for just the selected period (the pre-existing multi-month trend chart is untouched, further
    down the page). The invoices table gained per-customer **avatar-initial badges**, **dot-style status
    badges**, a combined search + status-tabs toolbar (pill-group, not individually-bordered chips), and
    real **pagination** (15/page, Previous/Next, "Showing X of Y") — previously every filtered row
    rendered at once in one scrolling list. The **Days late** column was dropped from the visible table
    (folded into the Late badge instead, e.g. "Late · 3d") to match the mockup's column set — it's
    unchanged in the CSV export.

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
  - **Visual redesign to match a provided mockup (v2.29.86):** purely presentational — no data/logic
    changed, same treatment as the v2.29.85 Reconciliation redesign (this codebase has no Tailwind, so the
    mockup was read as a layout/visual spec only and rebuilt with inline styles + the `:root` CSS vars).
    The KPI row now has **3 cards** (Total Collected, Recharge Collected, Deposit Collected — was 2, no
    "Total" card before) and moved **above** Business insights (was below). Business insights was rebuilt
    into a box-card layout — 3 top boxes (What happened / Collection mix / Top performer), a "Needs
    attention" box listing idle apartments, and a dashed "Recommended action" box — with a "Period
    performance" pill (up/down arrow + MoM %) in the card header. "Deposit vs Recharge split" became
    **"Collection composition"** — a thinner split bar plus two side-by-side amber/green detail boxes —
    now paired in a **2-column grid** with a rebuilt "Apartment performance": ranked cards with a numbered
    badge (green-filled for #1), a progress bar sized to that apartment's share of the top total, a
    txn-count + deposit/recharge footer line, and a distinct "No activity" pill for idle apartments
    (replaces the earlier generic `Stat`-component grid). In the Transactions table: Payment/Transaction
    Type filters switched from grouped bordered buttons to individually-bordered pill chips; the Type badge
    gained a leading status dot; Device became a small mono-font badge chip; Validity/Litres/Deposit/
    Revenue columns right-aligned; a "N records" badge was added beside the table title; and the
    admin-only Upload JSON button became a solid filled button (was ghost-style, matching Export) to
    visually separate it in the button hierarchy.
  - **"Business insights" panel removed (v2.29.97)** — the box-card panel described above (Period
    performance pill, What happened/Collection mix/Top performer, Needs attention, Recommended action) was
    removed dashboard-wide per explicit request; the tab now goes straight from the KPI row to Collection
    composition / Apartment performance. The computation feeding it (`dpMomPct`, `topApt`, `idleApts`,
    `dpPos`/`dpNeg`/`dpActs`, `dpHappened`/`dpOngoing`/`dpResult`) was removed too — nothing else in the
    tab depended on it.
  - **Apartment performance hover removal & dynamic card click filtering (v2.29.317):** Removed unwanted
    hover magnification on the "Apartment performance" container card by setting `hover={false}` on the `<Card>`.
    Made each individual apartment performance card interactive: clicking any card (e.g. `CRO_Ashish JK [ Thubarahalli ]`)
    dynamically sets `apt` to filter the entire DP Transactions view (raw feed table and top KPI cards) to that
    specific apartment. Clicking the selected card again or clicking the new "Reset apartment filter" pill clears the filter. Updated
    `aptStats` to calculate period totals across all apartments so cards retain their numbers and remain clickable
    when a single apartment is selected.
  - **Selected card styling refinement (v2.29.318):** Refined the selected state of the apartment cards per
    explicit user request. Removed the "Selected" text pill badge completely, and styled the active selected
    card with a warm amber/gold `#FFCB56` background, matching amber border, and high-contrast dark `#1D1D1F`
    typography and icons.

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
- **Password Vault** (`vault_creds` tab, v2.29.325; moved under Employee as its own section at
  v2.29.326, per explicit user request) — internal service/tool credentials (Zoho, AWS, hosting,
  vendor portals, WiFi, admin panels, etc: Service name, Username, Password, URL, Notes). **Strictly
  admin/devops-only**, using the exact same admin-only-tab shape as Referral's Backtrack / Analytics'
  AOP / Task Planner's Modify Tasks: the tab only spreads into `App.jsx`'s `employee` moduleTabs
  array when `isModuleAdmin` is true (no separate access level of its own — it inherits the Employee
  module's own admin/devops grant), and `MODULE_SECTIONS.employee` flags it `adminOnly: true` so the
  per-user Sections control shows it correctly marked ADMIN. `vaultApi` in `shared/core.js` — shared
  across every admin via a Cloud Firestore collection (`password_vault`, same `backend-prowater`/
  `prowaterdb` project as Device Replacement/Releases), reaching every admin login on any device;
  falls back to a localStorage cache (`pw_vault_cache`) when Firestore is unreachable, same
  offline-first optimistic-update pattern as `_drStore`/`_releasesCache`. **Passwords are stored as
  plain text** (masked in the UI behind a per-row show/hide toggle, with one-click copy for
  username/password) — convenience-level protection matching this app's general client-side-SPA
  security posture, **not** encryption at rest; the Firestore collection's own security rules are the
  real access boundary and must restrict reads/writes to admin accounts.

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
  API outages (`pw_failures`) and shows a "Server Down" popup. `LOGS_EPOCH`/`pw_logs_epoch` can wipe
  history once on next load.
- **Email-on-failure REMOVED (v2.29.110):** the failure tracker used to also best-effort POST to
  `/admin/notify-failure` on every new outage (and a sibling `notifyAdminEmail()` helper posted the same
  route on an external-API usage threshold) — that backend route was never actually built (the code's own
  comment said so: "needs a backend route... may not exist yet"), so it fired a 404 on every single
  failure event, forever, visible as constant noise in the backend's own Cloud Run logs. Removed
  entirely: `notifyFailureEmail()`/`notifyAdminEmail()` and their call sites, the now-fully-unused
  `src/lib/notifyAdmin.js` helper file, the "Alert recipients" stat + explanatory line on the Failures
  tab, and the API_USAGE/docs table rows referencing the route. Outage TRACKING itself (`pw_failures`,
  the Failures tab, the Server Down popup) is unaffected — only the dead email-attempt was removed.
- **Server-unavailable popup is gated per SUB-TAB, not per module (v2.29.98):** `MODULE_SOURCES` maps
  each top-level module to the heavy Zoho lists it depends on (`customers`/`subscriptions`/`invoices`/
  `leads`) — but Analytics alone has 12 sub-tabs with wildly different real dependencies (DP Transaction
  reads its own separate unauthenticated feed; App Logs reads Firestore; Credits reads its own
  credit-notes API), so gating the whole module on all four sources together used to lock a user out of
  every Analytics sub-tab whenever just one of the four went down — including sub-tabs that never touch
  that source. A new `TAB_SOURCES` map gives the real per-tab dependency list (read straight off each
  component's own fetch calls); the blocking-popup check now looks up the **active tab** first and only
  falls back to the module-level list for a tab not explicitly mapped. Billing & Subscription's sub-tabs
  were split the same way (Subscriptions → `subscriptions` only, Invoices → `invoices` only — previously
  both for every tab); Sales and Customer sub-tabs were already uniform (one shared source each) so
  nothing changed there. A dead endpoint now only blocks the specific section that actually needs it.
- **Server-unavailable popup is DISMISSIBLE, not a hard block (v2.29.101):** even scoped to the right
  section, the popup used to have only one way out — "Close Module", which left the whole module. It now
  has a **"Continue anyway"** button (`ServerDownModal`'s `onDismiss`) that just hides the popup and lets
  the user go straight into the section — same sample/cached data + inline "Showing sample data" banner
  as always — while "Close Module" (`onCloseModule`) stays as a second option. The dismissal is
  per-tab-visit state in `Shell` (`dismissedDown`), reset whenever the active tab changes, so switching
  tabs — or a genuinely new source going down — re-arms the popup rather than suppressing it forever.

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
  `src/shared/core.js` (also update `MODULE_DOCS` in `src/modules/About.jsx` / `API_USAGE` in
  `src/shared/core.js` if a module's behaviour or an endpoint changed). The version shows in the
  sidebar/home/login footers, the Logs Tracker banner, and About.
- **This doc:** update the relevant §6 module section (and §3/§5 if APIs/storage changed) in the same
  change. Keep the "Reflects APP_VERSION" line at the top current.
- **Word changelog (v2.29.300):** every `VERSION_HISTORY` entry above also gets a matching entry
  (same version, date, note) appended to `ProWater-CRM-Changelog.docx` at the project root — same
  change, both places, every time. That file starts at v2.29.280 (this session's work); anything
  earlier lives only in this doc.
- **Fast Refresh (v2.29.324):** Vite's dev-mode hot-swap can only update a module file "in place"
  (preserving component state) when EVERY export in that file is a React component — one plain
  constant/helper export among them is enough to force a full reload of that file and everything
  importing it, on every edit ("Could not Fast Refresh (\"X\" export is incompatible)" in the dev
  console). `shared/core.js` holds no components, so it's never subject to the rule. When a file's
  own non-component export starts surfacing that warning, move the export into `core.js` and
  re-import it — that was done for `CHART_PALETTE`, `ACCESS_LEVELS`, `DEVICE_TYPES`,
  `BENGALURU_CENTER`, `AUTO_GS_SEED`, `tkPriority`, `API_USAGE`, `HIDDEN_LEAD_STATUSES`,
  `PLAN_AVATAR_COLORS`, `TIERS`, `gstBreakup`, `IOT_ALERT_SEV`, `AOP_MON`, and the manual-refunds
  store (now `manualRefundsApi`) at v2.29.324. Most module files still mix in other plain exports of
  their own (seed data, API clients, formatters) that can trip the same warning on a future edit —
  that was a deliberately narrow pass, not a file-by-file guarantee.

---

## 9. Deploy

1. Get the change into the `soroai/Wisdom2.0` repo's **`main`** branch (this working copy may be a
   standalone folder, not a git clone — copy the changed `src/` files / this file into the repo,
   commit, push).
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
- Device Replacement **cross-device list**: confirm the collection the `/device-replacement/add`
  backend writes to (or add a GET) and point the read-back at it.
- **ProWater AI was removed in v2.29.79** (see §6's "ProWater AI — REMOVED" entry) — no open items
  here anymore; the Cloud Function is undeployed and the frontend widget is gone.
