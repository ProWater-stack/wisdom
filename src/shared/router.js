/* ============================================================================
   shared/router.js — Pretty, flat URL routing (v2.29.379).

   Per explicit user request: navigating the app should move the real browser
   URL, not just internal state ("when i go to any module the url remain the
   same... make it as https://prowater-stack.github.io/wisdom/allcustomers"),
   and opening a record should append its id ("if i open any purifier ID in
   the all customers then it should take the default purifier id and show it
   in the url... /wisdom/allcustomers/BLE58C3D25").

   Design: every screen in the app is a (module, tab) pair (see MODULE_TABS
   below — the exact same catalog Shell's sidebar renders from in App.jsx).
   Each tab gets ONE flat URL segment, derived from its own label
   ("All Customers" -> "allcustomers", "Societies" -> "societies") rather than
   a nested /module/tab path, per the user's own examples. A record detail
   view (e.g. a selected customer) is an OPTIONAL further segment appended by
   the page component itself (see AllCustomers in modules/Customer.jsx for the
   reference implementation) — this file only resolves module+tab; a page
   that wants record-level deep-linking calls `syncPath`/`parseLocation`
   itself with its own detail id, same pattern reusable by any other module.

   No react-router dependency — the app already manages module/tab as plain
   React state (App.jsx's `activeModule`, Shell's own `tab`), so this file
   just keeps `window.history` in sync with that state (via `syncPath`) and
   lets components resolve the CURRENT url back into state on mount/popstate
   (via `parseLocation`). Two callers matter: App.jsx (module-level: Home vs.
   a given module) and Shell inside App.jsx (tab-level, within one module).

   GitHub Pages is a static host with no server-side routing, so a hard
   reload or a shared link straight to e.g. /wisdom/allcustomers/BLE58C3D25
   would 404 without help — `public/404.html` + the matching decode snippet
   in `index.html`'s <head> (the well-known rafgraph/spa-github-pages
   pattern) handle that; this file doesn't need to know about it.
   ============================================================================ */

export const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Every module's sub-tabs (id + label + optional adminOnly gate), used ONLY
// to build the slug maps below. This intentionally mirrors — but does NOT
// replace or import from — two other hand-kept catalogs that already existed
// for their own purposes: App.jsx's Shell component has its own `moduleTabs`
// (same ids/labels, plus the lucide icon per tab the sidebar nav renders),
// and Employee.jsx's `MODULE_SECTIONS` (same ids/labels, used for the
// per-user section-access UI) — that file's own comment already flags the
// same manual-mirroring risk. Kept separate deliberately, to add routing
// without risking a regression in either of those two working, unrelated
// features; if a tab is ever added/renamed, keep this list in sync with
// Shell's `moduleTabs` by hand, same as MODULE_SECTIONS already requires.
export const MODULE_TABS = {
  referral: [
    { id: "overview", label: "Overview" },
    { id: "referrers", label: "Referrers" },
    { id: "referees", label: "Referees" },
    { id: "credits", label: "Credits" },
    { id: "tracker", label: "Tracker" },
    { id: "analytics", label: "Analytics" },
    { id: "backtrack", label: "Backtrack", adminOnly: true },
  ],
  sales: [
    { id: "sales_leads", label: "Leads & Deals" },
    { id: "sales_apartments", label: "Apartment Leads" },
    { id: "sales_trend", label: "Trend Analysis" },
    { id: "sales_errors", label: "Error Correction" },
  ],
  planner: [
    { id: "plan_board", label: "Task Board" },
    { id: "plan_weekly", label: "Weekly View" },
    { id: "plan_admin", label: "Modify Tasks", adminOnly: true },
  ],
  analytics: [
    { id: "an_overview_v2", label: "Overview V2" },
    { id: "analytics", label: "Referral" },
    { id: "an_earned", label: "Earned Revenue" },
    { id: "an_reconciliation", label: "Reconciliation" },
    { id: "an_dptxn", label: "DP Transaction" },
    { id: "an_aop", label: "AOP", adminOnly: true },
    { id: "an_apartment", label: "Apartment Performance" },
    { id: "an_churn", label: "Renewal & Churn Risk" },
    { id: "an_billing", label: "Billing" },
    { id: "an_revenue", label: "Revenue" },
    { id: "an_penetration", label: "Penetration Tracker" },
    { id: "an_credits", label: "Credits" },
    { id: "an_applogs", label: "App Logs" },
  ],
  employee: [
    { id: "emp_users", label: "Users" },
    { id: "vault_creds", label: "Password Vault", adminOnly: true },
  ],
  ticketing: [
    { id: "tk_overview", label: "Overview" },
    { id: "tk_tickets", label: "Tickets" },
    { id: "tk_ops", label: "Ops Tickets" },
  ],
  customer: [
    { id: "cust_all", label: "All Customers" },
    { id: "cust_societies", label: "Societies" },
  ],
  billing: [
    { id: "bill_subs", label: "Subscriptions" },
    { id: "bill_invoices", label: "Invoices" },
    { id: "bill_deposits", label: "Deposits & Refunds" },
    { id: "bill_plans", label: "Plans" },
  ],
  fsm: [
    { id: "fsm_track", label: "Track Technician" },
    { id: "fsm_amc", label: "AMC / Maintenance" },
    { id: "fsm_quality", label: "Water Quality" },
  ],
  erp: [{ id: "erp_assets", label: "Asset Lifecycle" }],
  autoscheduler: [
    { id: "as_society", label: "Auto GS - Society" },
    { id: "as_iot", label: "IoT Alerts" },
  ],
  iot: [
    { id: "iot_devices", label: "Device Monitor" },
    { id: "iot_alerts", label: "Alerts" },
  ],
  devicereplace: [{ id: "dr_list", label: "Replacements" }],
  about: [
    { id: "about_docs", label: "About" },
    { id: "about_app_rel", label: "App Releases" },
    { id: "about_tech_rel", label: "Technician Releases" },
    { id: "about_system_load", label: "System Load" },
  ],
  logtracker: [
    { id: "log_all", label: "All Logs" },
    { id: "log_failures", label: "Failures" },
    { id: "log_api", label: "API Usage" },
  ],
};

// slug <-> {module, tab}, built once at module-load time. Base slug is the
// tab's own label, slugified, so most URLs read as one flat word ("All
// Customers" -> "allcustomers") per the user's own examples. A label CAN
// collide across two different modules (e.g. Referral's and Ticketing's tabs
// are both plainly "Overview") — the first module encountered (in the object
// key order above) keeps the bare slug; a later collision is disambiguated by
// prefixing its own module id (Ticketing's Overview becomes
// "ticketingoverview"). This is deterministic and stable across builds since
// MODULE_TABS's own order never changes at runtime.
const _slugToTab = new Map();
const _tabToSlug = new Map();
for (const [moduleId, tabs] of Object.entries(MODULE_TABS)) {
  for (const t of tabs) {
    let slug = slugify(t.label);
    if (_slugToTab.has(slug)) slug = slugify(moduleId + t.label);
    _slugToTab.set(slug, { module: moduleId, tab: t.id });
    _tabToSlug.set(`${moduleId}:${t.id}`, slug);
  }
}

export const slugForTab = (moduleId, tabId) => _tabToSlug.get(`${moduleId}:${tabId}`) || null;
export const tabForSlug = (slug) => _slugToTab.get(slug) || null;

// The app's own base path, e.g. "/wisdom/" in both dev and the built GitHub
// Pages site (Vite injects this from vite.config.js's `base`).
const APP_BASE = import.meta.env.BASE_URL;

const stripBase = (pathname) => {
  let p = pathname.startsWith(APP_BASE) ? pathname.slice(APP_BASE.length) : pathname;
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
};

// Builds the path for a given module+tab (+ optional detail segment, e.g. a
// customer's purifier ID) — always rooted at APP_BASE. Falls back to just
// APP_BASE (the Home screen) when no slug is known for that module/tab pair,
// or when module/tab themselves are null (Home has no tab at all).
export function pathFor(moduleId, tabId, detail) {
  const slug = moduleId && tabId ? slugForTab(moduleId, tabId) : null;
  let path = APP_BASE + (slug || "");
  if (slug && detail) path += "/" + encodeURIComponent(detail);
  return path;
}

// Reads the CURRENT browser URL and resolves it to { module, tab, detail } —
// any part not present/recognized comes back null, so callers fall back to
// their own defaults (sessionStorage's last-open module/tab, a default tab,
// etc.) exactly as before this router existed.
export function parseLocation() {
  const rest = stripBase(window.location.pathname);
  if (!rest) return { module: null, tab: null, detail: null };
  const [slug, detailRaw] = rest.split("/");
  const hit = tabForSlug(slug);
  if (!hit) return { module: null, tab: null, detail: null };
  return { module: hit.module, tab: hit.tab, detail: detailRaw ? decodeURIComponent(detailRaw) : null };
}

// Pushes/replaces the browser URL to match a module+tab(+detail) — a no-op
// if the URL already matches, so an effect that calls this on every render
// doesn't spam history with duplicate/no-change entries.
export function syncPath(moduleId, tabId, detail, { replace = false } = {}) {
  const path = pathFor(moduleId, tabId, detail);
  if (window.location.pathname === path) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", path);
}
