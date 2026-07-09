# ProWater Dashboard — Session Change Log / Rebuild Spec

**All changes are in a single file:** `src/App.jsx` (Vite + React, single-file app "Wisdom2.0").
**⚠️ The file was accidentally reverted to the original.** Re-apply everything below.

**Global facts**
- `API_ORIGIN = "https://api-7ca73ntgua-el.a.run.app"`. Auth: Firebase; token in `sessionStorage.pw_idToken`; `authHeaders()` adds `Authorization: Bearer <token>`.
- `LS` = localStorage helper (`LS.get(key, default)`, `LS.set(key, val)`), defined ~line 941 (AFTER the API objects). Icons from `lucide-react`; charts from `recharts`.
- Modules registered in `MODULES` array (id/label/icon(string)/desc/built/color); `MODULE_ICONS` maps icon string→component; tabs in `moduleTabs`; default tab in a ternary; rendered `{tab === "..." && <Comp/>}` inside `Shell`.
- **Versioning convention (user requirement):** bump `APP_VERSION` + prepend a `VERSION_HISTORY` entry on EVERY change. Final version reached: **v1.9.5**. Version shown in sidebar/home/login footers (`· v{APP_VERSION}`), Logs Tracker banner, About module.
- **TDZ gotcha:** any module-level code using `LS`/`pushLog` at init (failure tracker, persistent-cache helpers) MUST be placed AFTER `LS` and `pushLog` are defined (~after line 935). Function declarations hoist; `const`/`let` do not.

---

## 1. Auto Scheduler — CRO type + Backwash/Dozing columns
- `AUTO_GS_SEED` rows now carry: `installedDate, totalFlats, numTowers, croType ("Eco crystal"|"Alfa Enviro"), lastBackwash, lastDozing`. Real data: CBR Aakruti(108/2), SVS Ananda Nilayam(168/5), MJR Clique Hydra(300/5), Ashish JK(206/6), Prabhavathi Meghana Towers(80/1). Dozing values include "NA" and "Yet to install".
- `schedulerApi.getSchedules` mapper adds `croType`(cro_type/cro_250_lph_type), `lastBackwash`(last_backwash/lastService), `lastDozing`(last_dozing).
- `buildGsRow`: cycle driven by `lastBackwash` (valid date), fallbacks lastService/offset/installedDate. Carries croType/lastBackwash/lastDozing.
- `addSociety` payload + form state + meta + reset include the 3 new fields.
- Helpers in `AutoGSSociety`: `fmtServiceVal(v)` (NA / "Yet to install" / fmtDate); `dozingColor(v)` (amber #9a6a16 for yet-to-install, muted for NA, else normal) — text color, NOT cell bg (single row color).
- Table head reordered: `["Apartments","No of Flats","No of Towers","CRO Installed Date","CRO - 250 LPH Type","Last service Date For Backwash","Last service Date For Dozing","Next service","Days left","Ticket ID"]`.
- Add-society modal: "CRO Installed Date", "No of Flats", "No of Towers", CRO type `<select>` (Eco crystal/Alfa Enviro), Backwash + Dozing date inputs.
- **Ticket-ID column:** add `whiteSpace:"nowrap"` to the td AND the "Create ticket" button so it stays on one line.

## 2. Device Replacement MODULE (new, local-only, no API)
- Register: `MODULES += { id:"devicereplace", label:"Device Replacement", icon:"Repeat", desc:"Swap an old purifier for a new one", built:true, color:"#4f6f8f" }`. Import `Repeat` (lucide). `MODULE_ICONS += Repeat`. Default tab `dr_list`. `moduleTabs.devicereplace=[{id:"dr_list",label:"Replacements",icon:Repeat}]`. Render `<DeviceReplacement/>`.
- `DEVICE_TYPES=["Own Device","Normal","Hot & Cold"]`. `_drStore=[]` (in-memory). `deviceReplaceApi.list()/create()` (pushLog, no fetch). `deviceAgeing(install,uninstall)`→{days,label "1y 2mo"}.
- `DeviceReplacement`: **New Entry** btn → Step1 (old device: Name/Phone/Email/Plan/Purifier ID/Device Type dropdown/Installation Date/Uninstalled Date=today READONLY) → Submit → Step2 (new device same minus uninstall, + **Go back**) → Submit → Step3 **irreversible confirm** warning ("final, edits/undo not allowed") → **I agree** creates timestamped record (`replacedAt`) with old-device ageing. Table of records; click row → read-only Drawer. `DrRow` helper.

## 3. Leads API (already-fixed by their backend)
- `salesEndpoint` `per_page=500`. `getDeals`: total-based pagination + dedup by id. Route `/admin/zoho/get-all-leads` returns `{status,cached,total,leads:[...]}`. `mapZohoLead` maps full_name/mobile/company→society/lead_status etc.

## 4. About MODULE (new)
- Register `{ id:"about", label:"About", icon:"Info", ... }`. Import `Info`. Default tab `about_docs`. Render `<AboutModule/>`.
- `MODULE_DOCS` array (per module: summary, points[], source). `AboutModule`: version badge, **VERSION_HISTORY changelog rendered in a scrollable panel** (`className="scroll-thin"`, `maxHeight:360, overflowY:"auto"`), then searchable module-docs grid.
- `APP_VERSION`, `VERSION_DATE`, `VERSION_HISTORY` consts defined right after `allAccess`.

## 5. Logs Tracker — IP capture fix, version, clear
- `_session` PERSISTED to `pw_session` (`saveSession`); `_emptySession` const. `api.ensureSession()` repopulates `_session` if `ip==="—"` (for token-restored sessions); called in `App()` `useEffect(()=>{if(user)api.ensureSession()},[user])`. login sets `_session=net; saveSession()`; logout resets+saves.
- `pushLog` stamps `version: APP_VERSION`.
- `LOGS_EPOCH="2026-07-06"`: on load, if stored epoch differs, clear `pw_logs` once (start fresh).
- `api.clearLogs(actor)` + **Clear** button (window.confirm) in Logs toolbar.
- Logs table: added **Version** column (`v{r.version}`) after Module; version in CSV; banner "Dashboard build vX · released DATE".

## 6. Removed: Convert Done (later re-enabled), Defaulters, Finance
- `HIDDEN_LEAD_STATUSES = new Set()` (EMPTY — Convert Done SHOWN. It was `["convert done"]` mid-session, user later said show it). `notHiddenLead=(d)=>!HIDDEN_LEAD_STATUSES.has(norm(d.rawStatus))` applied in SalesPipeline/SalesLeads/SalesInsights/SalesErrorCorrection getDeals.
- **Billing: removed Defaulters** tab (`bill_defaulters`) + render (Defaulters fn left dead).
- **Finance module REMOVED entirely:** MODULES entry, moduleTabs.finance, default-tab ternary line, render routes (fin_reconcile/fin_aging/fin_collections/fin_balance), `doRefresh` → `if(module==="billing")`, `MODULE_SOURCES.finance`, About doc. Components (Reconciliation/ARAging/Collections/BalanceSheet) left as dead code.
- **DP Customers REMOVED:** fin_dp tab+render, `DPCustomers`+`dpApi`+`SEED_DP_ROWS`+`mapDpRow` deleted, `vite.config.js` `/admin/dp-customers` proxy removed, **`dp-backend/` folder deleted**.

## 7. Earned Revenue (Analytics tab, new) — DAY-BASED accrual
- Extract shared helpers to MODULE scope: `parseTermToken`, `termFromWord`, `monthsBetween`, `termMonths(src)`, `monthlyOf(s)` (remove local copies from BillingAnalytics).
- `depositForPlan(plan, amount)`: if /prabhavati/i → 3000 (>4000), 2000 (>2000), else 0; else `depositFor` (4000>4000 / 2000>2000 / 1500>1500 / 0).
- Tab `{id:"an_earned",label:"Earned Revenue",icon:Scale}`; render `<EarnedRevenue/>`.
- `EarnedRevenue`: fetch invoices+subs (NOT force). Per paid invoice: `deposit=depositForPlan(plan,total)`, `recharge=total-deposit`. Plan borrowed from sub (`planByCustomer` keyed customerNumber/zohoCustomerId/zohoId).
- **Day-based**: `termDays=months*30`, `perDay=recharge/termDays`, `payDay`, `termStart=payDay`, `termEnd=payDay+(termDays-1)d`. `daysInMonthFor(p,y,m)`=inclusive overlap days. `earnedIn(y,m)=Σ perDay*daysInMonthFor`. (1 month=30 days; 6mo=180d; pay on 20th earns 20–31 = 12 days.)
- Month selector (12 back…6 fwd, "projected" tag). KPI cards WITH MoM % (`momPct(cur,prev)` vs prev month): **Earned this month**; **Recharge collected** (sub `revenue portion · total {totalThis}`); **Deposit collected** = `totalThis - rechargeThis` (so recharge+deposit=total); **Contributing recharges**. (Removed old "Deferred" card.)
- Timeline `ComposedChart` earned bars + recharge line. Table cols: Customer, Plan, Paid on, Total paid, Deposit, Recharge, Term ("Xmo · Yd"), **Earned/month**, **Earned/day** (₹X.XX 2dp), **Days in {mon}**, **Earned in {mon}** — sticky totals row. CSV includes all.

## 8. Apartment Performance (Analytics tab, new)
- Tab `{id:"an_apartment",label:"Apartment Performance",icon:Boxes}`; render.
- Paid invoices joined to customers (society, purifier_id via zohoId/id keys); depositForPlan split. Toggle **By Apartment / By Purifier ID**; paged(12); search; deposit+recharge separate; totals row; 4 stat cards.
- **Month selector** (`ym`="all"|"YYYY-M") scopes `enriched`; scope in card title; MoM % delta on Recharge/Deposit/Total (selected vs prev month; all-time = current vs last).

## 9. Analytics → Referral rename + Sales section (`SalesInsights`)
- moduleTabs.analytics: first tab label "Analytics"→**"Referral"** (id stays "analytics"). Add `{id:"an_sales",label:"Sales",icon:Briefcase}` after it. Render `<SalesInsights/>`.
- `SalesInsights`: fetch leads. **Society dropdown** filter. **Lead-status numbers** (bar chart + table Status/Leads/%/Plan value + totals). **Total plan value by society** table (sortable desc, totals, click row → filters status section). 4 stat cards.

## 10. Sales → Error Correction (`SalesErrorCorrection`)
- moduleTabs.sales += `{id:"sales_errors",label:"Error Correction",icon:AlertCircle}`; render `<SalesErrorCorrection isAdmin/>`.
- Same table as Leads & Deals (Full Name,Phone,Flat No,Lead Status,Society,Tenure,Plan Value,Deposit,To Collect,Created,[Move to]) filtered to `rawStatus==="Installed"` AND (value||deposit||amountToCollect is 0/blank). Blank cells → red **"Missing"** badge. Search+export+admin move-to.

## 11. API FAILURE TRACKING + Server Down popup + Email
- `markSample(source,on,meta)`: on transition calls `recordApiFailure(source,meta)`/`recordApiRecovery(source)`. `MODULE_SOURCES` map (module→sources). **NOTE: DO NOT include `autoscheduler` (GS schedules is local-first, not an outage).**
- Placed AFTER LS+pushLog: `_failures` (localStorage `pw_failures`; close ongoing on load), `saveFailures`, `_failureListeners`, `useFailures()`, `recordApiFailure` (one open per source; pushLog "api_failure"; `notifyFailureEmail`), `recordApiRecovery` (compute downtimeMs), `FAILURE_ALERT_TO=["anis@drinkprime.in","harsh@soroai.com"]`, `notifyFailureEmail(rec)` POST `${API_ORIGIN}/admin/notify-failure` (NEEDS BACKEND ROUTE), `fmtDowntime(ms)`.
- catch blocks pass `{endpoint, reason:e.message}` to markSample (customers/subs/invoices/leads; NOT GS schedules).
- Logs Tracker: Failures tab `{id:"log_failures",label:"Failures",icon:AlertCircle}` + `Failures` component (table API/Endpoint/Failed at/Reason/live Downtime(ticks)/Status; 3 stat cards; email note).
- `ServerDownModal({sources,onClose})` (portal, live downtime ticks). Shown in Shell when `downSources=(MODULE_SOURCES[module]||[]).filter(s=>failingSources.includes(s))` non-empty. **Button = "Close Module"**, `onClose={onHome}` (no dismiss state).

## 12. API rate-limit hardening (v1.8.6) + persistent cache (v1.9.5) — CRITICAL
- `fetchAllPagesFast(urlFor, pickRows, {maxPages=60, concurrency=4})`: page1 → if `json.total` known, fetch pages 2..N in **concurrent batches of 4** (not all at once). `fetchPage`: retry on **429** (Retry-After / exp backoff 600*2^n cap 8s + jitter); on !ok read body msg into error (`${status}: ${msg}`), **no retry on 500**. Sequential fallback via has_more.
- **In-flight dedup:** `_custInflight/_subInflight/_invInflight/_salesInflight`. Each getX: if inflight return it; getX returns an IIFE promise; `finally{_xInflight=null}`.
- **Persistent caches:** `PERSIST_TTL={customers:30m,subscriptions:30m,invoices:30m,leads:15m}` (ms). `loadPersistedRows(key)`/`savePersistedRows(key,rows)` → `pw_cache_{key}` `{rows,at}`. `isRateLimit(msg)`=/429|rate limit|too many request|exceeded the maximum call/i. `_rateLimitedUntil` + `inRateLimitCooldown()` (60s cooldown). (Define these AFTER LS.)
- Each getX (customers/subs/invoices/leads): lazy-seed cache from persisted if null; `if(inRateLimitCooldown() && cache?.length) return cache`; TTL check uses PERSIST_TTL; on success `savePersistedRows`; **on failure: if cache exists → serve cache + markSample(false) (NOT sample)**, and `if(isRateLimit) _rateLimitedUntil=Date.now()+60000`; only if NO cache → sample + markSample(true).
- Prefetch on login (`App` useEffect on user): getCustomers/getSubscriptions/getInvoices/getDeals (cache-respecting). Removed `force=true` from analytics mounts.
- **ROOT CAUSE = BACKEND:** it re-queries Zoho per request (customers endpoint has NO server cache; leads returns a `cached` flag). Real fix = server-side cache on `/admin/get-all-customers`.

## 13. Employee email→username login match (v1.8.5)
- `login()` after Firebase verify: `emp = _users.find(u => norm(u.email)===norm(firebaseRes.email))`. If `emp.active===false` → throw "account disabled". Sign in AS emp `{...emp minus password, id:localId, email}`. No match → default admin `{username: email.split("@")[0], role:"admin", access:allAccess("admin")}`. (Firebase does password auth; Employee module supplies profile/role/access. Employee users stored in localStorage `pw_users` — needs backend for cross-device.)

## 14. Apartment Leads (Sales tab, new)
- `apartmentApi.getAll()` → fetch `${API_ORIGIN}/admin/zoho/get-all-apartments/data` (authHeaders), rows = apartments/data/leads/rows/first-array-prop. Endpoint LIVE (401 without token).
- Tab `{id:"sales_apartments",label:"Apartment Leads",icon:Boxes}`; render.
- `pickAptField(row,...cands)` case/space-insensitive picker. `mapApartment(r)` → name(apartment_name/name/society), managerName(manager_name/...), managerNumber(manager_number/manager_phone/...), meetingStatus(meeting_status/status), address, pincode(pincode/pin_code), flats(number_of_flats/no_of_flats/...), createdTime(created_time/created_at/...).
- `ApartmentLeads`: columns Apartment Name, Manager Name, Manager Number, Meeting Status, Address, Pincode, Flats, **Created (sortable SortHeader)**. Top filters: `DateRangeFilter` (created) + Meeting-status `<select>`. Paged(20), export. (No apartment search box.)

## 15. Sales Analytics → apartment × lead-status pivot
- `SalesAnalytics`: fetch deals + apartments. **Removed "Deals by stage" + "Won revenue by plan" charts.** Keep 4 stat cards (Pipeline value/Won value/Avg deal/Total deals).
- Pivot "**Leads by apartment × status**": rows=apartments (dedup by `norm(name)`), cols=distinct statuses+Total, cell=count where `norm(lead.society)===norm(apartment.name)` (`leadsBySociety` map). Expandable (`React.Fragment`, `expanded` Set, rotating chevron) → **contained scrollable card (maxHeight 320, zebra rows, sticky header)** listing individual leads (Customer/Phone/Lead Status pill/Flat/Plan Value/Created).
- Controls: `DateRangeFilter` (created, scopes leads via `scopedDeals=deals.filter(inR(d.created))`), "Only apartments with leads (N)" checkbox, count, **Export** (pivot CSV: Apartment, each status, Total). No search box.

## 16. Shared UI helper
- `Stat({label,value,icon,sub,hero,delta})` — extended with optional `delta` (number) → colored ▲/▼ +N% badge (green up / red down; light on hero). Used for MoM deltas on Earned Revenue, Apartment Performance, Billing Analytics ("Cash this month" via months6 prev).

## 17. Totals rows (sticky `ftd` style = {...td, position:sticky, bottom:0, background:var(--mint-2), fontWeight:700, borderTop:2px solid var(--border)})
Added grand-total rows to money tables: Customers (Plan Amount), Sales Leads (Plan Value/Deposit/To Collect), Subscriptions (Amount), Invoices (Total/Deposit/Balance), Reconciliation (Recharge/Deposit/Collected/Balance)+Expected, AR Aging receivables (Balance), Collections (Billed/Collected/Outstanding), Credits (Unused credits), Billing Analytics (Society/Long-term/Renewals), ERP Assets (Cost/Depreciation/Book value), Deposit Refunds (Deposit).

---

## VERSION_HISTORY (final, newest first) — recreate these entries
- **1.9.5** persistent localStorage caches (pw_cache_*, 15–30m TTL) survive reloads; serve cached data on Zoho rate-limit (500) instead of failing; 1-min shared cooldown.
- **1.9.4** Sales Analytics: removed 2 charts; pivot got created-date filter + Export; removed apartment search.
- **1.9.3** pivot expanded panel = scrollable zebra card, sticky header, count.
- **1.9.2** Sales Analytics apartment×lead-status pivot, expandable to individual leads (join apartment name = Society Name).
- **1.9.1** Apartment Leads purpose-built table (columns + created-date/meeting-status filters + sortable Created).
- **1.9.0** Apartment Leads tab (adaptive table) via /admin/zoho/get-all-apartments/data.
- **1.8.9** show Convert Done again (emptied HIDDEN_LEAD_STATUSES).
- **1.8.8** Auto Scheduler no longer flags Server Down (local-first).
- **1.8.7** Server Down popup button → "Close Module".
- **1.8.6** rate-limit hardening (bounded concurrency, 429 backoff, in-flight dedup).
- **1.8.5** login matches email → Employee-module user (username/role/access).
- **1.8.4** Sales Error Correction tab.
- **1.8.3** Analytics Sales section (lead-status numbers, society dropdown, plan value by society).
- **1.8.2** removed Finance module; About history scrollable.
- **1.8.1** Apartment Performance month selector.
- **1.8.0** API failure monitoring (Failures tab, Server Down popup, email alerts).
- **1.7.x** Earned Revenue: MoM % + deposit/recharge=total; day-based recognition; deposit-collected card.
- **1.6.0** parallel pagination + totals rows everywhere.
- **1.5.x** removed DP Customers + Finance rename; performance (prefetch, cache) prep.
- **1.4.0** Apartment Performance tab.
- **1.3.0** Earned Revenue tab.
- **1.2.0** Logs Tracker IP/version/clear fixes.
- **1.1.0** Device Replacement + About modules; Auto Scheduler columns; version footer; removed Convert Done card + Defaulters.
- **1.0.0** initial.

---
## Backend follow-ups (NOT frontend — for the backend dev)
1. **Cache `/admin/get-all-customers` server-side** (mirror the leads endpoint's caching) — this is the REAL rate-limit fix.
2. Add **`POST /admin/notify-failure`** route that emails anis@drinkprime.in & harsh@soroai.com (for the API-failure alerts).
3. (Optional) expose `/api/gs-schedules` for Auto Scheduler (currently local-first).
