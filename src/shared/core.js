/* ============================================================================
   shared/core.js — non-JSX engine room: localStorage wrapper, the generic
   API-cache/rate-limit layer, the Zoho paged-fetch engine, customer data
   layer, date-range utilities, formatters, auth/session state, and the
   logs+failures tracking infra. Extracted verbatim from App.jsx (v2.30 split).
   ============================================================================ */

import { useState, useEffect, useContext, createContext } from "react";
import { ApiUsageTracker, makeCache } from "../lib/apiUsageTracker";

// Intercept fetch calls to track API response times, latency, and hit spikes
if (typeof window !== "undefined" && !window.__fetchPatched) {
  window.__fetchPatched = true;
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const start = Date.now();
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
    
    const isApi = url && (
      url.includes("api-7ca73ntgua-el.a.run.app") || 
      url.includes("identitytoolkit.googleapis.com") || 
      url.includes("drinkprime") ||
      url.includes("localhost")
    );
    
    if (!isApi) return origFetch.apply(this, args);
    
    let path = url;
    try {
      const u = new URL(url);
      path = u.pathname;
    } catch {}
    
    try {
      const response = await origFetch.apply(this, args);
      const duration = Date.now() - start;
      recordApiLoad(path, duration, response.status, "success");
      return response;
    } catch (err) {
      const duration = Date.now() - start;
      recordApiLoad(path, duration, 500, "error");
      throw err;
    }
  };
}

function recordApiLoad(path, duration, status, type) {
  try {
    const raw = localStorage.getItem("pw_api_load_logs");
    const logs = raw ? JSON.parse(raw) : [];
    logs.push({
      path,
      duration,
      status,
      type,
      at: Date.now()
    });
    if (logs.length > 1000) logs.shift();
    localStorage.setItem("pw_api_load_logs", JSON.stringify(logs));
  } catch {}
}

// ---- Moved from App.jsx: allAccess/seedUsers/pushLog/resolveRange all need these ----
export const MODULES = [
  { id: "sales",     label: "Sales",                  icon: "Briefcase",  desc: "Leads, pipeline & deals",          built: true,  color: "#1E9E4F" },
  { id: "customer",  label: "Customer",               icon: "UserRound",  desc: "Accounts & plan management",       built: true,  color: "#0B6F52" },
  { id: "billing",   label: "Billing & Subscription", icon: "Receipt",    desc: "Invoices, plans & renewals",       built: true,  color: "#0B6F52" },
  { id: "erp",       label: "ERP & Inventory",        icon: "Boxes",      desc: "Stock, purifiers & supply",        built: true,  soon: true, color: "#986315" },
  { id: "fsm",       label: "FSM System",             icon: "Wrench",     desc: "Field service & installations",    built: true,  soon: true, color: "#DC4141" },
  { id: "iot",       label: "IoT Core",               icon: "Cpu",        desc: "Device telemetry & connectivity",  built: true,  color: "#2A86D6" },
  { id: "referral",  label: "Referral",               icon: "GitBranch",  desc: "Referrers, referees & rewards",    built: true,  color: "#1E9E4F" },
  { id: "ticketing", label: "Ticketing",              icon: "Ticket",     desc: "Support tickets & resolution",     built: true,  color: "#986315" },
  { id: "autoscheduler", label: "Auto Scheduler",     icon: "CalendarClock", desc: "Recurring service scheduling & IoT alerts", built: true, color: "#0B6F52" },
  { id: "analytics", label: "Analytics",              icon: "BarChart3",  desc: "Cross-module reporting",           built: true,  color: "#2A86D6" },
  { id: "planner",   label: "Task Planner",           icon: "LayoutGrid", desc: "Kanban board, tasks & projects",   built: true,  color: "#2A86D6" },
  { id: "employee",  label: "Employee",               icon: "UserCog",    desc: "Add & manage dashboard users",     built: true,  color: "#2A86D6" },
  { id: "devicereplace", label: "Device Replacement", icon: "Repeat",     desc: "Swap an old purifier for a new one", built: true, color: "#2A86D6" },
  { id: "logtracker",label: "Logs Tracker",           icon: "ScrollText", desc: "Audit trail across all modules",   built: true,  color: "#DC4141" },
  { id: "about",     label: "About",                  icon: "Info",       desc: "Version history & module docs",    built: true,  color: "#1E9E4F" },
];

// Default access for an admin: admin on everything.
export const allAccess = (level) => Object.fromEntries(MODULES.map(m => [m.id, level]));

export const PLANS = ["Home Monthly", "Home Quarterly", "Home Annual", "Plus Annual"];
export const BILLING_CYCLES = ["Monthly", "Quarterly", "Half-yearly", "Annual"];
export const CUSTOMER_FIELDS = [
  { key: "email",   label: "Email",         type: "email", roles: ["supervisor", "admin", "devops"] },
  { key: "phone",   label: "Phone",         type: "tel",   roles: ["supervisor", "admin", "devops"] },
  { key: "address", label: "Address",       type: "text",  roles: ["supervisor", "admin", "devops"] },
  { key: "plan",    label: "Plan",          type: "select", options: PLANS,          roles: ["admin", "devops"] },
  { key: "billing", label: "Billing cycle", type: "select", options: BILLING_CYCLES, roles: ["admin", "devops"] },
];
export const SEED_CUSTOMERS = [
  { id: "CUS-00045", name: "Anis Emmanual", email: "anis@drinkprime.in", phone: "918839452234", address: "MJR Clique Hydra Apartment, Hyderabad", society: "MJR Clique Hydra", plan: "Plus Annual", billing: "Annual", status: "active", zohoId: "ZB-45", purifier_id: "HAC-00045", unused_credits: 1150, since: "2026-07-01" },
  { id: "CUS-00084", name: "harshpvt", email: "harshlokhande486@gmail.com", phone: "917821907069", address: "Ashish JK, Pune", society: "Ashish JK", plan: "Home Quarterly", billing: "Quarterly", status: "active", zohoId: "ZB-84", purifier_id: "OWN-00084", unused_credits: 0, since: "2026-07-02" },
  { id: "CUS-00092", name: "Ravi Kumar", email: "ravi.k@example.com", phone: "", address: "Prestige Lakeside, Bengaluru", society: "Prestige Lakeside", plan: "Plus Half-Yearly", billing: "Half-Yearly", status: "active", zohoId: "ZB-92", purifier_id: "PW-00092", unused_credits: 600, since: "2026-06-10" },
  { id: "CUS-00101", name: "Sneha Patil", email: "sneha.p@example.com", phone: "", address: "Sobha Dream Acres, Bengaluru", society: "Sobha Dream Acres", plan: "Home Quarterly", billing: "Quarterly", status: "active", zohoId: "ZB-101", purifier_id: "PW-00101", unused_credits: 300, since: "2026-06-18" },
  { id: "CUS-00110", name: "Imran Shaikh", email: "imran.s@example.com", phone: "", address: "MJR Clique Hydra, Hyderabad", society: "MJR Clique Hydra", plan: "Home Monthly", billing: "Monthly", status: "active", zohoId: "ZB-110", purifier_id: "", unused_credits: 99, since: "2026-07-03" },
  { id: "CUS-00077", name: "Deepa Nair", email: "deepa.n@example.com", phone: "", address: "Prestige Lakeside, Bengaluru", society: "Prestige Lakeside", plan: "Plus Annual", billing: "Annual", status: "active", zohoId: "ZB-77", purifier_id: "PW-00077", unused_credits: 1200, since: "2026-03-12" },
];
export let _customers = [...SEED_CUSTOMERS];
export let _custCache = null, _custCacheAt = 0;
export const _sampleSources = new Set();
export const _sampleListeners = new Set();
export function markSample(source, on, meta) {
  const had = _sampleSources.has(source);
  if (on) _sampleSources.add(source); else _sampleSources.delete(source);
  if (had !== on) {
    _sampleListeners.forEach(fn => fn());
    // On transition, open/close the matching API-failure record (§11).
    if (on) recordApiFailure(source, meta); else recordApiRecovery(source);
  }
}
export function useSampleData() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    _sampleListeners.add(fn);
    return () => _sampleListeners.delete(fn);
  }, []);
  return Array.from(_sampleSources);
}
export function authHeaders() {
  const token = sessionStorage.getItem("pw_idToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}
export const customerApi = {
  getCustomers: async (force = false) => getCached("customers", "customers", "/admin/get-all-customers", async () => {
    const allRaw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-customers?page=${page}&per_page=500`,
      (json) => Array.isArray(json.customers) ? json.customers : (Array.isArray(json.data) ? json.data : []),
    );
    const zohoCustomers = allRaw.map(c => {
      const p = c.customer_profile || c;
      return {
        id:      p.customer_number  || p.zoho_customer_id || p.dp_details?.id || c.dp_details?.id || p.id || c.id || "",
        name:    p.name             || "",
        email:   p.email            || "",
        phone:   p.phone            || "",
        address: p.billing_address?.full_address_string || "",
        society: p.society          || "",
        plan:    p.plan             || p.plan_name || c.plan_name || p.dp_details?.plan_name || c.dp_details?.plan_name || "",
        billing: "",
        status:
          p.subscription_status === "live"           ? "active"
          : p.subscription_status === "non_renewing" ? "active"
          : p.subscription_status === "past_due"     ? "paused"
          : p.subscription_status === "none"         ? "inactive"
          : p.subscription_status                    || "inactive",
        zohoId:            p.zoho_customer_id  || "",
        referral_code:     p.referral_code     || "",
        purifier_id:       p.purifier_id       || "",
        total_outstanding: p.total_outstanding || 0,
        unused_credits:    p.unused_credits    || 0,
        isDpCustomer:      [true, "true", "True", 1, "1"].includes(c.is_dp_customer ?? p.is_dp_customer) || String(p.purifier_id || "").startsWith("CRO") || String(p.purifier_id || "").startsWith("DPMB"),
        dpInstallationId:  String(p.dp_details?.dp_installation_id ?? c.dp_details?.dp_installation_id ?? c.dp_installation_id ?? p.dp_installation_id ?? "") || "",
        deviceStatus:      p.dp_details?.device_status ?? c.dp_details?.device_status ?? "",
        since: p.created_time || p.created_at || p.signup_date || p.customer_created_time || p.since || "",
        bid:               p.dp_details?.bid          || c.dp_details?.bid          || p.bid               || c.bid               || "",
        partner_type:      p.dp_details?.partner_type || c.dp_details?.partner_type || p.partner_type      || c.partner_type      || "",
        plan_name:         p.dp_details?.plan_name    || c.dp_details?.plan_name    || p.plan_name         || c.plan_name         || "",
        wallet_id:         p.dp_details?.wallet_id    || c.dp_details?.wallet_id    || p.wallet_id         || c.wallet_id         || "",
        total_paid:        p.dp_details?.total_paid   || c.dp_details?.total_paid   || p.total_paid        || c.total_paid        || 0,
        db_id:             p.dp_details?.id           || c.dp_details?.id           || p.id                || c.id                || "",
        connectivity:      p.dp_details?.connectivity || c.dp_details?.connectivity || p.connectivity      || c.connectivity      || "",
      };
    });

    // v2.29.260: no longer cross-references the separate DP-transactions feed to
    // fabricate placeholder rows for devices missing from get-all-customers. Per
    // explicit user request ("pull the records what i have in the get-all-customers
    // API, not anything extra... whether it is a zoho record or DrinkPrime record
    // that also has an identifier in the API") — get-all-customers already returns
    // real, fully-populated DrinkPrime customer records (customer_profile.is_dp_
    // customer:true, with a real name/email/phone/plan and a nested dp_details
    // block), which the mapping above already reads correctly. The synthesized
    // "DrinkPrime Customer (<device code>)" stub rows this used to add (hardcoded
    // name/email/plan/status, real data only for society) were confusing exactly
    // because they looked like real customer profiles but weren't — they existed
    // only because a device had transaction history in a DIFFERENT DrinkPrime
    // endpoint with no matching row here at all. Removed entirely: every row shown
    // now comes straight from get-all-customers, nothing fabricated.
    return zohoCustomers;
  }, [..._customers], force),

  // >>> WIRE: PUT /api/customers/:id to persist changes to Zoho Billing.
  updateCustomer: async (actor, id, changes) => {
    await wait(200);
    _customers = _customers.map(c => c.id === id ? { ...c, ...changes } : c);
    if (_memCache.customers?.rows) _memCache.customers.rows = _memCache.customers.rows.map(c => c.id === id ? { ...c, ...changes } : c);
    const fields = Object.keys(changes).join(", ");
    pushLog({ type: "customer_updated", actor, module: "Customer", detail: `Updated ${id} (${fields})` });
  },

  // Force a fresh pull, bypassing the 3-hour cache.
  forceRefresh: async () => { _memCache.customers = null; _inflight.customers = null; await customerApi.getCustomers(true); },
};
export const DATE_PRESETS = [
  { key: "today",         label: "Today" },
  { key: "this_week",     label: "This Week" },
  { key: "this_month",    label: "This Month" },
  { key: "this_quarter",  label: "This Quarter" },
  { key: "this_year",     label: "This Year" },
  { key: "yesterday",     label: "Yesterday" },
  { key: "prev_week",     label: "Previous Week" },
  { key: "prev_month",    label: "Previous Month" },
  { key: "prev_quarter",  label: "Previous Quarter" },
  { key: "prev_year",     label: "Previous Year" },
  { key: "custom",        label: "Custom" },
];
export const presetLabel = (k) => (DATE_PRESETS.find(p => p.key === k) || {}).label || "Custom";
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
export const addDays    = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d) => addDays(startOfDay(d), -((startOfDay(d).getDay() + 6) % 7)); // week starts Monday
export const monthEnd   = (y, m) => endOfDay(new Date(y, m + 1, 0));
export const spanDays   = (r) => Math.round((startOfDay(r.to) - startOfDay(r.from)) / 86400000) + 1;
export const PRESET_UNIT = {
  this_month: "month", prev_month: "month",
  this_quarter: "quarter", prev_quarter: "quarter",
  this_year: "year", prev_year: "year",
};
export function resolveRange(preset, custom, ref = new Date()) {
  const today = startOfDay(ref);
  const y = today.getFullYear(), m = today.getMonth();
  const q = Math.floor(m / 3) * 3;
  switch (preset) {
    case "today":        return { from: today, to: endOfDay(today) };
    case "yesterday":    { const d = addDays(today, -1); return { from: d, to: endOfDay(d) }; }
    case "this_week":    { const s = startOfWeek(today); return { from: s, to: endOfDay(addDays(s, 6)) }; }
    case "prev_week":    { const s = addDays(startOfWeek(today), -7); return { from: s, to: endOfDay(addDays(s, 6)) }; }
    case "this_month":   return { from: new Date(y, m, 1), to: monthEnd(y, m) };
    case "prev_month":   return { from: new Date(y, m - 1, 1), to: monthEnd(y, m - 1) };
    case "this_quarter": return { from: new Date(y, q, 1), to: monthEnd(y, q + 2) };
    case "prev_quarter": return { from: new Date(y, q - 3, 1), to: monthEnd(y, q - 1) };
    case "this_year":    return { from: new Date(y, 0, 1), to: monthEnd(y, 11) };
    case "prev_year":    return { from: new Date(y - 1, 0, 1), to: monthEnd(y - 1, 11) };
    case "custom": {
      const f = parseFlexDate(custom?.from), t = parseFlexDate(custom?.to);
      // Incomplete/backwards custom input falls back to the current month.
      if (!f || !t) return { from: new Date(y, m, 1), to: monthEnd(y, m) };
      return f <= t ? { from: startOfDay(f), to: endOfDay(t) } : { from: startOfDay(t), to: endOfDay(f) };
    }
    default: return { from: new Date(y, m, 1), to: monthEnd(y, m) };
  }
}
export function prevRange(preset, r) {
  const unit = PRESET_UNIT[preset];
  const fy = r.from.getFullYear(), fm = r.from.getMonth();
  if (unit === "month")   return { from: new Date(fy, fm - 1, 1), to: monthEnd(fy, fm - 1) };
  if (unit === "quarter") return { from: new Date(fy, fm - 3, 1), to: monthEnd(fy, fm - 1) };
  if (unit === "year")    return { from: new Date(fy - 1, 0, 1), to: monthEnd(fy - 1, 11) };
  const n = spanDays(r);
  const to = addDays(startOfDay(r.from), -1);
  return { from: addDays(to, -(n - 1)), to: endOfDay(to) };
}
export const yoyRange = (r) => ({
  from: new Date(r.from.getFullYear() - 1, r.from.getMonth(), r.from.getDate()),
  to:   endOfDay(new Date(r.to.getFullYear() - 1, r.to.getMonth(), r.to.getDate())),
});
// Tolerant of both real Date bounds (from resolveRange()) and raw "YYYY-MM-DD"
// strings (from DateRangeFilter's plain <input type="date">) — fixed v2.29.119:
// comparing a Date to a date-string via >=/<= coerces the string with Number(),
// which is NaN for a real date string and 0 for "" (empty/unbounded), so every
// comparison against r.to silently failed and every DateRangeFilter-driven
// screen (Sales > Leads & Deals/Apartment Leads, Analytics > App Logs/Billing's
// custom range) always showed 0 rows, at the default state AND with real dates
// picked. Falsy from/to (empty string, null, undefined) now means "no bound on
// that side" instead of "impossible".
export const dateInRange = (d, r) => {
  if (!d) return false;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return false;
  // A raw "YYYY-MM-DD" string bound (DateRangeFilter's <input type="date">) has
  // no time-of-day — floor it to the start of that day, and ceil the "to" side
  // to the end of that day, so the picked end date is inclusive of everything
  // on it. Already-Date bounds (from resolveRange()) are trusted as-is.
  const from = !r?.from ? null : r.from instanceof Date ? r.from : startOfDay(new Date(r.from));
  const to = !r?.to ? null : r.to instanceof Date ? r.to : endOfDay(new Date(r.to));
  if (from && dt < from) return false;
  if (to && dt > to) return false;
  return true;
};
export const dmy = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
export const rangeLabel = (r) => `${dmy(r.from)} – ${dmy(r.to)}`;
export const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const RANGE_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function bucketsFor(r) {
  const n = spanDays(r);
  if (n <= 62) {
    const out = [];
    for (let d = startOfDay(r.from); d <= r.to; d = addDays(d, 1)) {
      out.push({ mode: "day", date: new Date(d), key: isoDay(d),
        label: String(d.getDate()).padStart(2, "0"),
        dateLabel: `${String(d.getDate()).padStart(2, "0")} ${RANGE_MONTHS[d.getMonth()]}`,
        dow: d.getDay(), revenue: 0, deposit: 0, recharge: 0 });
    }
    return { mode: "day", buckets: out };
  }
  const out = [];
  let d = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
  while (d <= r.to) {
    out.push({ mode: "month", date: new Date(d), key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${RANGE_MONTHS[d.getMonth()]}`,
      dateLabel: `${RANGE_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      dow: null, revenue: 0, deposit: 0, recharge: 0 });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return { mode: "month", buckets: out };
}
export const bucketKeyOf = (d, mode) => mode === "day" ? isoDay(d) : `${d.getFullYear()}-${d.getMonth()}`;
export function useDateRange(initial = "this_month") {
  const [sel, setSel] = useState({ preset: initial, from: "", to: "" });
  const range = resolveRange(sel.preset, sel);
  return { sel, setSel, range };
}
export const pluralise = (label) => {
  const w = label.toLowerCase();
  if (w.endsWith("s")) return w;
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
};
export async function fetchAllPaged(path, listKeys) {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const res = await fetch(`${API_ORIGIN}${path}?page=${page}&per_page=300`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    const json = await res.json();
    let batch = [];
    for (const k of listKeys) { if (Array.isArray(json[k])) { batch = json[k]; break; } }
    if (!batch.length && Array.isArray(json)) batch = json; // bare array response
    all.push(...batch);
    hasMore = json.pagination?.has_more === true;
    page++;
    if (page > 50) break; // safety cap
  }
  return all;
}
export const ZOHO_MAX_CONCURRENT = 2;   // never more than 2 Zoho requests in flight at once
export const ZOHO_MIN_GAP_MS = 150;     // and space their starts ~150ms apart
export let _zohoActive = 0;
export let _zohoNextAt = 0;
export const _zohoQueue = [];
export function _zohoAcquire() {
  return new Promise(resolve => {
    const attempt = () => {
      if (_zohoActive < ZOHO_MAX_CONCURRENT) {
        _zohoActive++;
        const now = Date.now();
        const wait = Math.max(0, _zohoNextAt - now);
        _zohoNextAt = Math.max(now, _zohoNextAt) + ZOHO_MIN_GAP_MS;
        setTimeout(resolve, wait);
      } else {
        _zohoQueue.push(attempt);
      }
    };
    attempt();
  });
}
export function _zohoRelease() {
  _zohoActive = Math.max(0, _zohoActive - 1);
  const next = _zohoQueue.shift();
  if (next) next();
}
export async function fetchPage(url) {
  for (let attempt = 0; ; attempt++) {
    await _zohoAcquire();
    let res;
    try { res = await fetch(url, { headers: authHeaders() }); }
    finally { _zohoRelease(); }
    if (res.status === 429) {
      if (attempt >= 5) throw new Error(`429: too many requests`);
      const ra = Number(res.headers.get("Retry-After"));
      const backoff = ra ? ra * 1000 : Math.min(8000, 600 * 2 ** attempt) + Math.floor(Math.random() * 300);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }
    if (!res.ok) {
      let msg = "";
      try { const j = await res.json(); msg = j.message || j.error || j.detail || JSON.stringify(j); }
      catch { try { msg = await res.text(); } catch { /* ignore */ } }
      throw new Error(`${res.status}: ${String(msg).slice(0, 200)}`);   // no retry on 500 etc.
    }
    return res.json();
  }
}
export async function fetchAllPagesFast(urlFor, pickRows, { maxPages = 60, concurrency = 2 } = {}) {
  const first = await fetchPage(urlFor(1));
  const rows = pickRows(first) || [];
  const total = Number(first.total ?? first.pagination?.total ?? first.info?.count);
  const perPage = rows.length || 1;
  if (Number.isFinite(total) && total > rows.length) {
    const pages = Math.min(maxPages, Math.ceil(total / perPage));
    for (let p = 2; p <= pages; p += concurrency) {
      const batch = [];
      for (let i = p; i < p + concurrency && i <= pages; i++) batch.push(fetchPage(urlFor(i)).then(pickRows));
      const results = await Promise.all(batch);
      results.forEach(r => rows.push(...(r || [])));
    }
    return rows;
  }
  // Sequential fallback via has_more / more_records when total isn't provided.
  let hasMore = first.pagination?.has_more === true || first.info?.more_records === true;
  let page = 2;
  while (hasMore && page <= maxPages) {
    const json = await fetchPage(urlFor(page));
    rows.push(...(pickRows(json) || []));
    hasMore = json.pagination?.has_more === true || json.info?.more_records === true;
    page++;
  }
  return rows;
}
export let _dpCache = null, _dpCacheAt = 0;
export const DP_CACHE_MS = 5 * 60 * 1000;
export async function fetchAllDpTransactions(force = false) {
  if (!force && _dpCache && (Date.now() - _dpCacheAt) < DP_CACHE_MS) return _dpCache;
  const all = [];
  let cursor = null, truncated = false;
  for (let page = 0; page < 80; page++) {
    const url = `${API_ORIGIN}/dp-transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    all.push(...(Array.isArray(json.transactions) ? json.transactions : []));
    if (!json.has_more || json.next_cursor == null) { cursor = null; break; }
    cursor = json.next_cursor;
    if (page === 79) truncated = true;
  }
  const result = { rows: all, truncated };
  _dpCache = result; _dpCacheAt = Date.now();
  return result;
}
export const seedUsers = [
  { id: "s1ROXksmBYS6nAmo8h3rPssirHY2", name: "Anis", username: "anis", email: "harshlokhande486@gmail.com", role: "admin", active: true, created: "2025-09-01T09:00:00Z", access: allAccess("admin") },
];
export const EXISTING_CREDIT = 2; // existing customer → 2 months free
export const NEW_CREDIT = 1;      // new customer → 1 month free
export const freeLabel = (n) => `${n} FREE`; // e.g. "2 FREE" = 2 months free
export function exportToCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => esc(c.label)).join(",");
  const body = rows.map(r => columns.map(c => esc(c.get(r))).join(",")).join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
export const EMAIL_DOMAIN = "@prowater.in"; // fixed login domain
export const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  },
};
export let _users = LS.get("pw_users", null) || [...seedUsers];
export const LOGS_EPOCH = "2026-07-06";
if (LS.get("pw_logs_epoch", null) !== LOGS_EPOCH) { LS.set("pw_logs", []); LS.set("pw_logs_epoch", LOGS_EPOCH); }
export let _logs = LS.get("pw_logs", null) || [];           // persisted; never auto-cleared
export let _photos = LS.get("pw_photos", null) || {};       // { username: dataURL }
export let _creditOverrides = {};   // session-only (would be backend-backed in prod)
export let _manualCredits = [];     // session-only
export let _undoStack = [];         // session-only (Backtrack)
export const _emptySession = { ip: "—", network: "—", city: "", country: "", lat: null, lon: null, source: "", accuracy: null };
export let _session = LS.get("pw_session", null) || { ..._emptySession };
export let _currentModule = "—"; // set when a user enters a module; recorded on every log
export const setCurrentModule = (v) => { _currentModule = v; };
export const saveUsers = () => LS.set("pw_users", _users);
export const saveLogs = () => LS.set("pw_logs", _logs);
export const savePhotos = () => LS.set("pw_photos", _photos);
export const saveSession = () => LS.set("pw_session", _session);
export function pushLog(entry) {
  const { ip, network, city, country, lat, lon, source, accuracy, module, ...rest } = entry;
  _logs = [{
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    version: APP_VERSION,
    module: module || _currentModule || "—",
    ip: ip || _session.ip || "—",
    network: network || _session.network || "—",
    city: city || _session.city || "",
    country: country || _session.country || "",
    lat: lat ?? _session.lat ?? null,
    lon: lon ?? _session.lon ?? null,
    source: source || _session.source || "",
    accuracy: accuracy ?? _session.accuracy ?? null,
    ...rest,
  }, ..._logs];
  saveLogs(); // persist every log so history is kept from day 1
}
export const PERSIST_TTL = { customers: 3 * 60 * 60 * 1000, subscriptions: 3 * 60 * 60 * 1000, invoices: 3 * 60 * 60 * 1000, submodules: 3 * 60 * 60 * 1000, leads: 60 * 60 * 1000, plans: 24 * 60 * 60 * 1000 /* plan catalog rarely changes */ };
export const _memCache = {};    // { key: { rows, at } } — session mirror of the persisted cache
export const _inflight = {};    // { key: Promise } — in-flight dedup (_custInflight/_subInflight/…)
// Invalidate old customer cache once to merge DrinkPrime stub records
if (typeof window !== "undefined" && !sessionStorage.getItem("pw_cache_cleared_dp_merge")) {
  localStorage.removeItem("pw_cache_customers");
  sessionStorage.setItem("pw_cache_cleared_dp_merge", "true");
}

export function loadPersistedRows(key) {
  const o = LS.get("pw_cache_" + key, null);
  return o && Array.isArray(o.rows) ? o : null;
}
export function savePersistedRows(key, rows) {
  // Strip any heavy _raw payload defensively so the cache stays small enough for
  // localStorage — a silent quota failure here means every reload refetches Zoho.
  const slim = rows.map(r => (r && r._raw !== undefined) ? (({ _raw, ...rest }) => rest)(r) : r);
  const ok = LS.set("pw_cache_" + key, { rows: slim, at: Date.now() });
  if (!ok) console.warn(`[cache] pw_cache_${key} too big to persist — will refetch on reload`);
  return ok;
}
export const isRateLimit = (msg) => /429|rate limit|too many request|exceeded the maximum call|"code"\s*:\s*45\b/i.test(String(msg || ""));
export let _rateLimitedUntil = 0;                                   // shared cooldown across all sources
export const inRateLimitCooldown = () => Date.now() < _rateLimitedUntil;
export async function getCached(key, source, endpoint, doFetch, fallback, force = false) {
  if (_inflight[key]) return _inflight[key];
  if (!_memCache[key]) { const p = loadPersistedRows(key); if (p) _memCache[key] = p; }
  const cached = _memCache[key];
  const ttl = PERSIST_TTL[key] || 5 * 60 * 1000;
  // During a rate-limit cooldown, serve cached rows immediately if we have them.
  if (!force && inRateLimitCooldown() && cached?.rows?.length) return cached.rows;
  // Fresh enough → serve without hitting the network.
  if (!force && cached && (Date.now() - cached.at) < ttl && cached.rows?.length) return cached.rows;

  const promise = (async () => {
    try {
      const rows = await doFetch();
      if (!rows.length) throw new Error("empty");
      _memCache[key] = { rows, at: Date.now() };
      savePersistedRows(key, rows);
      markSample(source, false);
      return rows;
    } catch (e) {
      if (isRateLimit(e.message)) _rateLimitedUntil = Date.now() + 5 * 60 * 1000; // back off 5 min on a Zoho rate-limit
      if (cached?.rows?.length) { markSample(source, false); return cached.rows; }  // serve stale, don't flag sample
      markSample(source, true, { endpoint, reason: e.message });
      return fallback;
    } finally { _inflight[key] = null; }
  })();
  _inflight[key] = promise;
  return promise;
}
export const MODULE_SOURCES = {
  customer: ["customers"],
  billing: ["subscriptions", "invoices"],
  sales: ["leads"],
  analytics: ["customers", "subscriptions", "invoices", "leads"],
};
export const TAB_SOURCES = {
  // Sales — every sub-tab reads the leads feed only.
  sales_leads: ["leads"], sales_apartments: ["leads"],
  sales_trend: ["leads"], sales_errors: ["leads"],
  // Customer — every sub-tab reads the customers feed only.
  cust_list: ["customers"], cust_all: ["customers"], cust_societies: ["customers"],
  // Billing & Subscription — differs per tab.
  bill_subs: ["subscriptions"],
  bill_invoices: ["invoices"], bill_deposits: ["subscriptions"], bill_plans: ["plans"],
  // Analytics — wildly different data needs per tab; this is the module where the
  // blanket gate was most visibly wrong (12 sub-tabs sharing one 4-source lock).
  an_overview: ["customers", "subscriptions", "invoices"],
  analytics: [],           // Referral analytics — reads the referral API, untracked here
  // submodules (v2.29.104) is a soft enrichment source for Start/End date
  // only — it has a .catch(()=>[]) in the fetch and a due-date-based
  // fallback in the row math, so it deliberately isn't in this gate.
  an_earned: ["invoices", "subscriptions", "customers"],
  an_reconciliation: ["invoices", "customers"],
  an_dptxn: [],            // DP Transaction — its own unauthenticated feed, untracked here
  an_aop: ["invoices", "subscriptions"],
  an_apartment: ["invoices", "customers"],
  an_churn: ["customers", "subscriptions", "invoices"],
  an_billing: ["subscriptions", "invoices"],
  an_revenue: ["invoices", "customers"],
  an_penetration: ["subscriptions", "customers"],
  an_credits: ["customers"], // credit notes themselves come from a separate, untracked API
  an_applogs: [],          // Firestore-backed, untracked here
};
export let _failures = LS.get("pw_failures", null) || [];
// Close any failure left open by a previous session (we can't track across reloads).
_failures = _failures.map(f => f.endedAt ? f : { ...f, endedAt: f.startedAt, downtimeMs: 0 });
export const saveFailures = () => LS.set("pw_failures", _failures);
export const _failureListeners = new Set();
export const _notifyFailureListeners = () => _failureListeners.forEach(fn => fn());
export function useFailures() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    _failureListeners.add(fn);
    return () => _failureListeners.delete(fn);
  }, []);
  return _failures;
}
export const failingSourcesNow = () => _failures.filter(f => !f.endedAt).map(f => f.source);
export function recordApiFailure(source, meta) {
  if (_failures.some(f => f.source === source && !f.endedAt)) return; // one open per source
  const rec = { id: crypto.randomUUID(), source, endpoint: meta?.endpoint || "", reason: meta?.reason || "", startedAt: new Date().toISOString(), endedAt: null, downtimeMs: null };
  _failures = [rec, ..._failures];
  saveFailures();
  pushLog({ type: "api_failure", actor: "system", module: "Logs Tracker", detail: `${source} unreachable — ${rec.reason || rec.endpoint || "error"}` });
  _notifyFailureListeners();
}
export function recordApiRecovery(source) {
  const rec = _failures.find(f => f.source === source && !f.endedAt);
  if (!rec) return;
  rec.endedAt = new Date().toISOString();
  rec.downtimeMs = new Date(rec.endedAt).getTime() - new Date(rec.startedAt).getTime();
  saveFailures();
  pushLog({ type: "api_recovery", actor: "system", module: "Logs Tracker", detail: `${source} recovered after ${fmtDowntime(rec.downtimeMs)}` });
  _notifyFailureListeners();
}
export function fmtDowntime(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60), min = m % 60;
  return `${h}h ${min}m`;
}
export const API_USAGE_LIMITS = {
  "ipapi.co": 1000,       // confirmed: ipapi.co free tier = 1000/day
  "ipify.org": 100000,    // fallback provider, no hard published daily cap
  "bigdatacloud": 10000,  // verify with whoever owns that account
};
export const apiTracker = new ApiUsageTracker({
  limits: API_USAGE_LIMITS,
  onThreshold: (threshold, status) => {
    pushLog({ type: "api_usage_threshold", actor: "system", module: "Logs Tracker", detail: `${status.api} at ${threshold}% of daily limit (${status.count}/${status.limit})` });
  },
});
export const ipCache = makeCache("pw_ip_cache", 6 * 60 * 60 * 1000); // 6h — survives logout
export async function getIpNetwork() {
  // 1) Serve from the persistent cache first (fixes the 1,000/day exhaustion).
  const cached = ipCache.get();
  if (cached) return cached;

  // 2) ipapi.co, but only if today's tracked quota allows it.
  if (apiTracker.canCall("ipapi.co")) {
    try {
      apiTracker.record("ipapi.co");
      const r = await fetch("https://ipapi.co/json/");
      const j = await r.json();
      if (!j.error) {
        const result = {
          ip: j.ip || "—",
          network: j.org || j.asn || "—",
          city: [j.city, j.region].filter(Boolean).join(", "),
          country: j.country_name || "",
          lat: j.latitude ?? null,
          lon: j.longitude ?? null,
        };
        ipCache.set(result);
        return result;
      }
    } catch { /* fall through to fallback chain below */ }
  } else {
    console.warn("ipapi.co daily quota reached — using fallback provider instead");
  }

  // 3) Fallback: ipify (IP only) — separately tracked, own separate quota.
  try {
    if (apiTracker.canCall("ipify.org")) {
      apiTracker.record("ipify.org");
      const r2 = await fetch("https://api.ipify.org?format=json");
      const j2 = await r2.json();
      const result = { ip: j2.ip || "—", network: "—", city: "", country: "", lat: null, lon: null };
      ipCache.set(result);
      return result;
    }
  } catch { /* ignore */ }

  return { ip: "—", network: "—", city: "", country: "", lat: null, lon: null };
}
export function getGpsCoords(timeout = 6000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 5 * 60 * 1000 }
    );
  });
}
export async function reverseGeocode(lat, lon) {
  if (!apiTracker.canCall("bigdatacloud")) return null; // quota guard, same pattern as ipapi.co
  try {
    apiTracker.record("bigdatacloud");
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const j = await r.json();
    const city = [j.city || j.locality, j.principalSubdivision].filter(Boolean).join(", ");
    return { city, country: j.countryName || "" };
  } catch { return null; }
}
export async function getClientNetwork() {
  const [ipData, coords] = await Promise.all([getIpNetwork(), getGpsCoords()]);
  if (coords && coords.latitude != null) {
    const geo = await reverseGeocode(coords.latitude, coords.longitude);
    return {
      ...ipData,
      lat: coords.latitude,
      lon: coords.longitude,
      city: (geo && geo.city) || ipData.city,
      country: (geo && geo.country) || ipData.country,
      accuracy: coords.accuracy != null ? Math.round(coords.accuracy) : null,
      source: "gps",
    };
  }
  return { ...ipData, source: "ip", accuracy: null };
}
export const IS_LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
export const API_ORIGIN = "https://api-7ca73ntgua-el.a.run.app";
export const API_BASE = IS_LOCAL ? "" : API_ORIGIN;
export const wait = (ms) => new Promise(r => setTimeout(r, ms));
export const Auth = createContext(null);
export const useAuth = () => useContext(Auth);
export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const sessionDayStr = () => new Date().toDateString();
export const clearSessionStorage = () => {
  ["pw_user", "pw_idToken", "pw_refreshToken", "pw_tokenExpiry", "pw_last_activity", "pw_session_day", "pw_active_module"].forEach(k => sessionStorage.removeItem(k));
};
export const THEMES = ["light"];
export const getStoredTheme = () => { try { const t = localStorage.getItem("pw_theme"); return THEMES.includes(t) ? t : "light"; } catch { return "light"; } };
export const applyTheme = (t) => { try { const v = THEMES.includes(t) ? t : "light"; document.documentElement.setAttribute("data-theme", v); localStorage.setItem("pw_theme", v); } catch { /* ignore */ } };
export const inr = (n) => "₹" + (n || 0).toLocaleString("en-IN");
export const momPct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
export const fmtDate = d => { if (d == null || d === "") return "—"; const x = new Date(d); return isNaN(x.getTime()) ? "—" : x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
export const fmtTime = d => { if (d == null || d === "") return "—"; const x = new Date(d); return isNaN(x.getTime()) ? "—" : x.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
export const deviceType = (purifierId) => {
  const id = String(purifierId || "").trim().toUpperCase();
  if (!id) return "";
  if (id.startsWith("HAC")) return "Hot & Cold";
  if (id.startsWith("OWN") || id.startsWith("OWND")) return "Own Device";
  return "Normal";
};
export const DEVICE_TYPE_STYLE = {
  "Hot & Cold":    ["#986315", "#FBF0E0"],
  "Own Device":    ["#0B6F52", "#E2F3EE"],
  "Normal":        ["#08805A", "#E2F3EE"],
  "Normal Device": ["#08805A", "#E2F3EE"],
};
export const fmtPhone = (p) => {
  const digits = String(p || "").replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  return local || "—";
};

// ---------------------------------------------------------------------------
// The three helpers below (keyLc, rangeFilter, and ui.jsx's DateRangeFilter)
// were accidentally deleted along with a large dead-code cluster during the
// v2.30 module-split refactor (they sat physically adjacent to 4 confirmed-
// dead Billing components in the original file, but unlike those, they had
// real live call sites elsewhere). They are reconstructed here from their
// exact call-site usage across the file (confirmed via `eslint --rule
// no-undef` catching every broken reference) rather than recovered from the
// original source, which was not recoverable (this project has no git
// history). Behavior has been cross-checked against every live call site.
// ---------------------------------------------------------------------------
//
// (A module-level `refresh` helper used to live here — pre-existing, broken
// dead code confirmed to reference an undefined `setRows` at module scope,
// with one real call site: Referrers' "Refresh" button, which had always
// been non-functional. Fixed at the call site instead — Referrers now has
// its own proper local `refresh` — so this stub was removed entirely rather
// than kept around broken.)

// Lowercase string key, for case-insensitive Map/object lookups (e.g. matching
// a Zoho customer id regardless of casing differences between two feeds).
export const keyLc = (k) => String(k || "").toLowerCase();

// Returns a (dateValue) => boolean predicate scoped to `range` — used as
// `const inR = rangeFilter(range); rows.filter(r => inR(r.someDateField))`.
export function rangeFilter(range) {
  return (val) => dateInRange(val ? new Date(val) : null, range);
}


export const APP_VERSION = "2.29.316";
export const VERSION_DATE = "2026-08-31";
export const VERSION_HISTORY = [
  { v: "2.29.316", note: "Billing & Subscription: Removed the 'Overview' Tab (`BillingOverview`) Entirely, per explicit user request. Deleted the component (`src/modules/Billing.jsx` — KPI cards for Active Subscriptions/Est. MRR/Outstanding/Collected, plus Subscriptions-by-Status and Active-Revenue-by-Plan charts), its nav entry and `App.jsx` tab-switch render, its `TAB_SOURCES.bill_overview` entry (`src/shared/core.js`), and its copy in Employee.jsx's `MODULE_SECTIONS.billing` (the per-user section-access catalog, so it can no longer be granted/shown for any employee). Billing & Subscription now opens straight to Subscriptions (already the module's default tab before this change — `bill_subs`, unaffected). Also removed a batch of now-fully-unused imports this left behind in `Billing.jsx` (`RefreshCw`, `TrendingUp`, the whole `recharts` import block, `Card`/`Table`/`Stat`/`TT`/`CHART_PALETTE`/`renderPieLabel`/`pieLabelLine`/`ftd`/`trStyle`/`grid4`/`axisTick` from `shared/ui`) — each individually confirmed via grep to have zero remaining usages in the file. Verified via a clean `npm run build`." },
  { v: "2.29.315", note: "Billing & Subscription > Deposits & Refunds (`src/modules/Billing.jsx`): Removed the Original Auto-Generated 'Deposits & Refunds' Table, per explicit user request — now that manual refund entries (v2.29.313) cover the actual need, this page leads straight from the top KPI stat cards into the 'Manually Recorded Refunds' section. Removed with it: the search/export toolbar and CSV export that only fed that table, and the Request/Approve/Refund action-button chain (`advance()`/`stChip()`/`action()`) — those wrote to a SESSION-ONLY `refunds` state that never persisted anyway (lost on every reload), so removing them loses no durable data. Worth knowing: the 'Refund requests' and 'Refunded' KPI cards at the top (kept, unchanged code) were the ONLY thing those removed buttons ever fed — with them gone, those two cards will now permanently read 0/₹0 (a subscription's deposit state simplifies to a straight 'held'/'eligible' read off its own live status, since nothing writes any other state to it anymore); 'Deposits held' and 'Avg deposit' are unaffected, since they're driven by the subscription data itself, not the removed action buttons. Flagging this rather than silently leaving two dead-looking KPI numbers — worth a follow-up if those two cards should be redesigned or removed too. Verified via a clean `npm run build`." },
  { v: "2.29.314", note: "Shared UI > `Modal`/`Drawer` (`src/shared/ui.jsx`): fixed every popup in the app rendering in the browser's default serif font (Times) instead of matching the CRM's real fonts, per explicit user report on the new 'Add Refund Entry' popup ('match the font style of the crm in the popup'). Root cause, confirmed live via `getComputedStyle`: `Modal`/`Drawer` are portalled straight to `document.body` (`createPortal`), entirely outside `.pw-root` — the div that actually carries the app's fonts (`'DM Sans'` for body text, `'Playfair Display'` for headings, set in `App.jsx`) — so every popup silently fell back to Times with no font-family of its own. Added explicit `fontFamily` (new shared `PW_BODY_FONT`/`PW_HEADING_FONT` constants, matching `.pw-root`'s own stacks exactly) directly on both components' wrapper divs and `<h2>` title, so this is fixed everywhere at once rather than just the one popup that surfaced it. Verified live via `getComputedStyle`: the Add Refund Entry popup's title now resolves to `\"Playfair Display\", Georgia, \"Times New Roman\", serif` and its labels to `\"DM Sans\", system-ui, ...` — matching the rest of the CRM exactly." },
  { v: "2.29.313", note: "Billing & Subscription > Deposits & Refunds (`src/modules/Billing.jsx`): Added an 'Add Refund Entry' Button + Popup Form, per explicit user request ('how do I add any refunds, there is no option for adding'). Root cause: this page's whole table was entirely auto-generated from live subscriptions (held/eligible/requested/approved/refunded) — there was no way to log a refund for a customer whose subscription record is already gone (e.g. a refund paid out after the device was uninstalled). Added a new 'Manually Recorded Refunds' section below the existing table, with its own 'Add Refund Entry' button opening a popup (`Modal`) with the fields requested: Customer Name, Mobile Number, Uninstallation Date, Refund Amount, Invoice Number (added per a same-session follow-up request), Transaction ID/Reference ID/Refund ID, and a Refund Mode dropdown (UPI / Bank Transfer / Cash), plus a Submit button. Entries persist to `localStorage` (`pw_manual_refunds`, same module-level `_store`/`LS.get`/`LS.set` convention as Device Replacement's `_drStore` — no backend API exists for this yet) and show in a new table (with CSV export and a per-row Remove button for correcting mistakes). Submitting requires a customer name and a valid (>0) refund amount; the other fields (including Invoice Number) are optional since not every refund has all of them on hand yet. Logged via `pushLog` on submit, same as every other write action on this page. Verified via a clean `npm run build` and a live check." },
  { v: "2.29.312", note: "Analytics > Overview V2, Revenue by Source card (`src/modules/Analytics.jsx`): follow-up to v2.29.311, per explicit user feedback ('still showing like earlier') — the ask was never about a stat's own label/value wrapping onto two lines (that part was already correct after v2.29.311), it was both stats — Zoho share and DP share — appearing as two separate stacked rows at all, when the request was for a single line total. Combined them into one flex row ('Zoho share: 0%   DP share: 100%'), matching the same inline 'label: value' pattern the Recharge/Deposit legend directly above it already uses. Verified via a clean `npm run build` and a live check." },
  { v: "2.29.311", note: "Analytics > Overview V2, Revenue by Source card (`src/modules/Analytics.jsx`): fixed 'Zoho share'/'DP share' each wrapping its label and percentage onto two separate lines, per explicit user report. Same recurring pattern as other fixes this session — the row is a flex container with `justifyContent: \"space-between\"` but no `whiteSpace: \"nowrap\"`, so at the card's narrower widths the label/value pair could still each break onto their own line. Added `whiteSpace: \"nowrap\"`, `alignItems: \"center\"` and a `gap` to both the Zoho share and DP share rows. Verified via a clean `npm run build` and a live check: both rows now render as a single line each ('Zoho share 0%', 'DP share 100%')." },
  { v: "2.29.310", note: "Shared UI > MultiSelectFilter (`src/shared/ui.jsx`): actually fixed the dropdown clipping into the sidebar, per explicit user report ('half of the dropdown is going inside the sidebar', reproduced live on Analytics > Earned Revenue's 'All apartments' filter). Three prior attempts (v2.29.305, .307, .308) all raised z-index values (`MultiSelectFilter`'s panel 40→100, `<main>` 1→50, mobile `.pw-sidebar-rail` 45→100) — confirmed live via `document.elementFromPoint` and direct DOM inspection that NONE of that ever addressed the actual bug, because it was never a z-index/paint-order issue: `<main>` sets `overflowY: \"auto\"` for its own page scroll, and per the CSS spec, an element can't have `overflow-x: visible` while `overflow-y` is anything else — the browser silently computes `overflow-x` as `auto` too (confirmed via `getComputedStyle`: `overflowX: \"auto\"` even though only `overflowY` was ever set). Since the dropdown was `position: absolute` inside `<main>`, and the toggle button it anchors to sits close to `<main>`'s own left edge, the panel's calculated position extended past that edge — and `<main>`'s now-clipping overflow simply never painted that portion of the dropdown AT ALL, regardless of z-index, revealing the sidebar underneath (a separate, unclipped box) in that exact screen region. Verified this precisely: setting `main.style.overflow = 'visible'` in a live console test made the dropdown render perfectly, confirming clipping (not stacking) as the root cause. Real fix: the dropdown panel is now rendered via `createPortal` to `document.body`, removing it from `<main>`'s (or any ancestor's) overflow clipping entirely — positioned with `position: fixed` using viewport coordinates computed from the toggle button's own `getBoundingClientRect()` at open time (`pos` state), with the panel closing on scroll (a `position:fixed` portalled element doesn't track the button's position as the page scrolls, so it would otherwise visually detach from it) and the existing click-outside handler extended to also check the portalled panel's own ref. Verified via a clean `npm run build` and a live re-test of the exact reproduced case: the 'All apartments' dropdown on Analytics > Earned Revenue now renders fully, with no part clipped behind the sidebar." },
  { v: "2.29.309", note: "Analytics > Earned Revenue: Styled negative Month-on-Month percentage changes in bright red color (`#dc2626` / `#ff4d4d`) inside both the chart labels (using SVG `<tspan>` tags) and the custom hover tooltip (`EarnedRechargeTooltip`) in the Earned vs Recharge Collected chart (`src/modules/Analytics.jsx`). Verified via clean build." },
  { v: "2.29.308", note: "Shared UI: Raised `<main>` shell layout container `zIndex` from 1 to 50, and mobile `.pw-sidebar-rail` `z-index` from 45 to 100 (`src/App.jsx`). This ensures that on desktop, the main content area stacks on top of the sticky sidebar (`z-index: 40`), allowing absolute-positioned dropdowns to render over the navigation panel. Also updated the Earned vs Recharge Collected composed chart (`src/modules/Analytics.jsx`) to display MoM percentage change values directly on the chart labels (`LabelList`) next to the revenue numbers (e.g. `₹250k (+12%)`), making the comparisons permanently visible. Verified via clean npm run build." },
  { v: "2.29.307", note: "Shared UI: Resolved layout stacking order by setting `zIndex: 1` on the `<main>` shell layout container (`src/App.jsx`) and `.pw-sidebar-rail { position: relative; z-index: 45 }` inside the mobile media query. This forces the `<main>` container to establish a stacking context that is stacked above the sidebar rail (which has stack level auto/0 due to backdrop-filter) on desktop views, solving the dropdown clipping/underlapping issue completely. On mobile viewports, the sidebar rail correctly retains stacking priority with a z-index of 45. Verified via clean build." },
  { v: "2.29.306", note: "Analytics > Earned Revenue: Rebuilt the Earned vs Recharge Collected composed chart (`src/modules/Analytics.jsx`) to highlight the current live calendar month. (1) The live month's bar now pulses using a custom SVG `<animate>` gradient (`#liveEarnedGrad`), and its line point pulses with an expanding, fading indicator ring. (2) Re-engineered the timeline array generation to capture a 13-month rolling dataset to compute MoM percentage change metrics for both Earned and Recharge values across all 12 visible timeline months. (3) Custom-built a rich `EarnedRechargeTooltip` that displays these MoM percentage deltas with up/down semantic arrows alongside the absolute revenue values. Verified via clean npm run build." },
  { v: "2.29.305", note: "Shared UI: Fixed dropdown clipping/layering bug by raising `zIndex` from 40 to 100 on the open dropdown popup in the `MultiSelectFilter` component (`src/shared/ui.jsx`). This ensures that multi-select filter dropdown menus (such as the Apartment selection on the Analytics dashboard) render on top of the sticky sidebar (z-index 40) and sticky topbar (z-index 20) instead of sliding behind or getting clipped. Verified via clean npm run build." },
  { v: "2.29.304", note: "Analytics > Earned Revenue: Matched the typography in the Credit Note Detail popup modal (`src/modules/Analytics.jsx`) to align with the rest of the page. Set parent font family to system sans-serif (`-apple-system, SF Pro Display, system-ui, sans-serif`), updated numeric font weights from 800 to 700, aligned color keys with the Warm Sand theme palette (using gold `#E8A93A` for active balance and `#1D1D1F` for headers/labels/invoices), and verified via clean build." },
  { v: "2.29.303", note: "Analytics > Earned Revenue, Credit column: Fixed 'CN-00010' wrapping onto two lines in the table by applying `whiteSpace: \"nowrap\"` and whitespace stripping (`src/modules/Analytics.jsx`). Also made the credit note number fully dynamic and clickable: modified `mapCreditNote` (`src/shared/core.js`) to split comma-separated invoice numbers to correctly match individual invoices, mapped the `invoices_applied` array of objects (invoice #, date applied, amount applied), and exposed compatibility aliases (total, total_credits_used, description) for the React popup modal. In the popup, formatted the issue and applied dates safely to prevent any parsing/timezone errors. Verified via a clean `npm run build` and a live check." },
  { v: "2.29.302", note: "Removed all remaining Freshdesk references from the codebase (`src/modules/TaskPlanner.jsx`): the Ticketing module migrated to Zoho Desk at v2.1.8 and the Freshdesk integration no longer exists. Removed the 'Freshdesk' entry from the CATEGORIES_COLORS array, removed the two Freshdesk-specific task entries ('Pass the Purifier ID and Apartment name to be added' and 'GS service Job'), and reworded the v2.1.8 migration task description to drop the stale 'from Freshdesk' phrasing. Verified via a clean `npm run build` and confirmed zero Freshdesk references remain in the active src/ tree (only historical VERSION_HISTORY entries in core.js still mention it, which is correct)." },
 { v: "2.29.301", note: "New standing convention, per explicit user request: every shipped change now ALSO gets logged in a Word document, `ProWater-CRM-Changelog.docx` (project root), alongside the existing `VERSION_HISTORY`/DOCUMENTATION.md entry — same version, date, and note in both places, every time. Created the file now, seeded with this session's real entries (v2.29.280–300, the Billing > Plans live-API work, Earned Revenue's Credit/Mobile Number/plan-lookup changes, and the IoT Core Device Monitor cleanup run) as a working example of the format; anything before v2.29.280 lives only in DOCUMENTATION.md. Documented the convention itself in DOCUMENTATION.md §8 (Conventions) so any future session reading this doc picks it up automatically. Also gave the user a portable 'continuation prompt' (module list + the verify/version-bump/blast-radius/Word-log conventions) to paste into a new chat or session so this project's standing rules carry over cleanly." },
  { v: "2.29.300", note: "Documentation + dead-code cleanup, per explicit user request ('update the documentation and remove the unwanted which is currently not in use'). (1) DOCUMENTATION.md: rewrote the Billing & Subscription > Plans section (was still describing the old static-PLAN_CATALOG/Device-Type-Filter-Type shape from v2.29.133; now describes the live `subs-module-get-all-plans` API, the real Deposit/Recharge/Total/Tenure/Link columns, and the SEED_PLANS fallback) and added two new narrative entries to IoT Core (the v2.29.285–299 Device Monitor cleanup run: ppm fix, Hydraulics-card removal, Fleet Uptime strip removal, cloudy-animation redesign, Dispensed Today) and Analytics > Earned Revenue (the v2.29.280–294 run: live-plans-API deposit/recharge lookup, Credit column, Mobile Number column, Remaining Month removal) — matching the file's existing append-only historical-narrative style throughout, nothing rewritten or deleted. (2) Removed 9 confirmed-dead exports, each individually verified via a whole-repo grep to have ZERO real usages anywhere outside their own definition line before removal: `IoTDispenseSummaryCard` (a full standalone card component from v2.29.87/88 that was never actually rendered on any page — superseded in practice by the inline Dispensed Today stat added this session), `IOT_FLOW_COLORS`, `iotBandCell` (superseded by `iotBandText`), `iotVol`, `iotRunAlerts` (the old alerts-list generator, superseded by `iotAnomalyEvents` — kept `IOT_ALERT_SEV`, which both used and `iotAnomalyEvents`'s rendering still needs) from `src/modules/IoT.jsx`; `OvGauge`, `kLabel` from `src/modules/Analytics.jsx`; `BILL_CACHE_MS`, `ticketMapsUrl` from `src/shared/core.js`. No behavior change anywhere — verified via a clean `npm run build` after every removal." },
  { v: "2.29.299", note: "IoT Core > Device Monitor, Water Quality & Potability card (`src/modules/IoT.jsx`): two follow-up changes to the v2.29.298 Dispensed Today/Total Dispensed addition, both per explicit user feedback. (1) Removed 'Total dispensed' from this card — the user pointed out it's already shown in the Tank panel card right next to this one, so showing it twice was pure duplication; 'Dispensed today' is kept as the only figure here. (2) Added a small animation next to the number, per explicit request ('show some animations also Today') — a bouncing `Droplets` icon (already imported) with an expanding ripple ring behind it (`pwDropBounce`/`pwDropRipple` keyframes, both respecting `prefers-reduced-motion`), matching the water-themed animation motif already used elsewhere in this module (rain drops, drifting clouds). Verified via a clean `npm run build` and a live check." },
  { v: "2.29.298", note: "IoT Core > Device Monitor, Water Quality & Potability card (`src/modules/IoT.jsx`): Filled the Empty Space at the Bottom with 'Dispensed Today' / 'Total Dispensed' — per explicit user report/request. Confirmed root cause: this card sits in a 3-column grid with `alignItems: \"stretch\"`, so it matches the tallest column (the Tank panel); it used to have a second stacked card (Hydraulics & Pressure) filling that height, but that was removed at v2.29.286, leaving the shorter remaining content pinned to the top with visible empty space below. Used `IoTWaterQualityCard`'s existing (already-built, previously-unused-here) `extra` slot, which anchors its content to the bottom via `marginTop: \"auto\"` — exactly the mechanism needed, no layout changes required. Added a new `todayDispensed` computation, deliberately INDEPENDENT of the shared `range` toggle the Tank panel/Trend charts read (so it always means literally today, not whatever period the rest of the page happens to be showing) — reuses the existing `iotFilterByRange(items, \"today\")` + `iotDispensedRange()` helpers already in the file. Shows 'Dispensed Today' (that fixed window's delta) alongside 'Total Dispensed' (the same lifetime counter already shown in the Tank panel, reused as-is). Styled to match the existing Tank panel's Total/Average dispensed convention exactly (serif numbers, uppercase muted labels). Verified via a clean `npm run build` and a live check: the card's empty space is now filled with 'Dispensed Today 8.02 L' / 'Total Dispensed 8471.37 L', anchored to the bottom exactly where the gap was." },
  { v: "2.29.297", note: "IoT Core > Device Monitor (`src/modules/IoT.jsx`): Removed the 'Fleet Macro Uptime Strip' entirely, per explicit user request — the row of 4 KPIs (Fleet Uptime, Avg Line Pressure, Active Monitored Fleet, Active Fault Alerts) that sat directly under the Live Weather card. This was a distinct block from the 'Total Devices/Online/Offline/With Faults' KPI cards further down (untouched, still shown). Also removed the two now-dead local variables (`fleetUptime`, `avgPressure`) that only fed this strip — `online`/`devices`/`faulty` are still used by the remaining KPI cards, so those stayed. Verified via a clean `npm run build` and a live check: the page now goes straight from the Live Weather card to the Total Devices/Online/Offline/With Faults row." },
  { v: "2.29.296", note: "IoT Core > Device Monitor (`src/modules/IoT.jsx`) — RESTORED two confirmed fixes that had silently regressed. While verifying the v2.29.295 cloudy-weather-animation change, live-checking the same page also showed TDS reading 'mg/L' again (should be 'ppm', fixed at v2.29.285) and the 'Hydraulics & Pressure' KPI card back on Device Monitor (should have been removed, v2.29.286). Root cause, confirmed via `git show HEAD:src/modules/IoT.jsx`: HEAD (the last commit, at v2.29.284) already contained the OLD 'mg/L'/Hydraulics-card content — meaning the working-tree file had been reset back to that commit at some point after v2.29.286 shipped (e.g. a `git checkout`/`git reset` on this one file), silently discarding those two uncommitted fixes, while `core.js`'s changelog/version kept moving forward as if they were still in place. Neither this session's own edits nor the cloudy-animation change caused this — it was already reverted before this turn's edit landed on top of it. Re-applied both exactly as before: all 16 TDS-related 'mg/L' strings → 'ppm' again, and the second `IoTWaterQualityCard` (Pressure/Flow rate) + its divider removed again. Spot-checked `Billing.jsx`/`Analytics.jsx` for the same failure mode (Plans page's Device Type removal, Earned Revenue's Remaining Month removal/Credit column) — both intact, only `IoT.jsx` was affected. Verified via a clean `npm run build`." },
  { v: "2.29.295", note: "IoT Core > Device Monitor, Live Weather card (`IoTWeatherCard`, `src/modules/IoT.jsx`) — per explicit user request to make the 'cloudy' weather animation as lively as the 'rain' one (the user referred to this as 'Analytics.jsx', but there's no weather code there — this `IoTWeatherCard` component is the only weather animation in the codebase, so acted on it there). The old 'cloudy' mode was a single flat cloud SVG just bobbing up and down in place (`pwCloudFloat`) — much plainer than rain's 6 independently-falling, staggered, gradient-filled drops. Rebuilt it with the same 'several independent staggered elements' idea: 4 cloud puffs at different sizes/depths/opacities/left positions, each drifting on its own diagonal loop (`pwCloudDrift`, replacing `pwCloudFloat`) with a negative animation-delay per cloud so they're already mid-drift and out of sync with each other, plus a soft drop-shadow per cloud for depth and a warm pulsing sun-glow peeking through behind the deck (most real 'cloudy' conditions are actually 'partly cloudy', so a hint of warmth reads truer than flat grey). Verified via a clean `npm run build`; live-checked against the sample weather fallback (the live weather proxy could plausibly be reachable but wasn't tested against real conditions) — the cloudy scene now visibly drifts with clear depth/parallax between the four puffs, instead of one flat shape bobbing in place." },
  { v: "2.29.294", note: "Analytics > Earned Revenue, Credit column: Added a Customer + Exact Amount Fallback Match (`src/shared/core.js`, `src/modules/Analytics.jsx`): the user confirmed via a live screenshot that v2.29.293's invoice_number/invoices_applied join never actually matches anything real (blank-reference rows still showed generic 'Yes', not a real note number) — the live feed's invoice links come back empty on every credit note, not just the one sample record checked before. Per explicit user decision (asked directly, since guessing the wrong join here would misattribute a credit note to the wrong invoice): among a customer's OWN credit notes (matched by `zoho_customer_id`), the specific note is now found by whichever one's actually-applied amount (`total_credits_used`, newly captured in `mapCreditNote()`, falling back to the note's own total) exactly equals the invoice's own total — the strongest available signal without a real invoice link, and safer than a customer's most-recent-note guess (which could easily be wrong if that customer has several notes). Still tries the v2.29.293 invoice-link join FIRST (harmless — starts working for free if the feed is ever fixed upstream), falling through to this new match, and only showing generic 'Yes' if neither finds a confident match. Verified via a standalone script covering 5 cases (two different customers each with an exact-amount match, a no-match case for a customer that DOES have notes, and an unknown-customer case) — all resolved correctly — plus a clean `npm run build`." },
  { v: "2.29.293", note: "Analytics > Earned Revenue, Credit column: Now Shows the Real creditnote_number Instead of a Bare 'Yes' (`src/shared/core.js`, `src/modules/Analytics.jsx`): per explicit user request, with a real sample credit-note record supplied. Added `billingApi.getPlans()`'s sibling here — wired `creditNoteApi.getCreditNotes()` (GET /admin/get-all-creditnotes, already existed for Analytics > Credits) into Earned Revenue's own data fetch, and extended `mapCreditNote()` to also capture `invoice_number` and `invoices_applied` (the fields that link a credit note to the invoice(s) it settled — read defensively, since the confirmed real sample's `invoices_applied` shape wasn't populated in the one example given). Built an invoice-number → credit-note index and, when an invoice's blank Reference Number implies a credit was applied, look up the specific note and show its real `creditnote_number` (e.g. 'CN-00014') instead of a generic 'Yes'. Falls back to plain 'Yes' when a credit is implied but no specific note can be matched by invoice number — the exact real sample record supplied had both `invoice_number` and `invoices_applied` empty even on a fully-used note, so an unresolved match is an expected, real case, not a bug, and showing a wrong/guessed note number would be worse than the honest 'Yes'. Verified `mapCreditNote()` against the user's exact real sample record via a standalone script (correctly extracts 'CN-00014'), plus a second script confirming the invoice-number join resolves correctly when a note DOES carry a real invoice link, and a clean `npm run build`." },
  { v: "2.29.292", note: "Analytics > Earned Revenue, Per-Invoice Recognition table (`src/modules/Analytics.jsx`): added a 'Credit' column, right after Reference Number, per explicit user domain knowledge — a blank Reference Number on an invoice means a credit was applied to it in Zoho (settled by a credit note rather than a payment reference), not a data gap. Shows 'Yes' (bold, green) when `creditApplied` (computed from the RAW invoice `referenceNumber` being empty — not the display field, which already defaults to '—' and would have made every row look credited) or '(-)' otherwise, exactly as specified. Added to the CSV export and bumped the footer 'Total' row's `colSpan` 9→10 to stay aligned under the now-10 leading columns. Verified via a clean `npm run build` (header/row/footer cell counts all confirmed to match)." },
  { v: "2.29.291", note: "Analytics > Earned Revenue, Per-Invoice Recognition table (`src/modules/Analytics.jsx`), three explicit user requests together: (1) Removed the 'Remaining Month' column entirely (header, row cell, footer placeholder cell, CSV export) — 'Remaining Days', 'Remaining Days Earned Total Revenue' and 'Remaining Month Earned Total Revenue' are unchanged and still shown; the underlying `remainingMonths` value is kept internally since `remainingMonthEarned` (a column that stays) is computed from it. (2) Added a new 'Mobile Number' column, right after Customer, using the same `r.phone`/`fmtPhone()` already computed for this row (it was already being searched — see next point — but was never actually shown as its own column); also added to the CSV export. Bumped the footer 'Total' row's `colSpan` 8→9 to stay aligned under the now-9 leading columns. (3) The search box already matched customer/apartment/mobile number silently — now also matches Reference Number and Invoice #, and the placeholder text was updated to say so, so all 5 searchable fields are actually discoverable. Verified via a clean `npm run build` (18 header cells now match 18 row cells exactly, footer colSpan+cells verified to sum to 18 too)." },
  { v: "2.29.290", note: "Analytics > Earned Revenue: Interval Column Now Falls Back to the Matched Plan's Own Tenure Instead of a Bare Dash (`src/modules/Analytics.jsx`): per explicit user report — a real invoice on plan_code `prowater_mineral_monthly` showed Interval '—' even though that exact plan correctly shows Tenure '1 months' on Billing & Subscription > Plans (v2.29.288). Root cause: `intervalLabel` was sourced ONLY from the get-all-submodules join (`modMatch`), which simply doesn't have a matching record for every invoice — until now there was no fallback at all when it didn't, just a dash. `planEntry` (the same live-plans match v2.29.289 already computes for Deposit/Recharge, from the identical `subs-module-get-all-plans` endpoint the Plans page uses) carries its own `billEvery`/`billingInterval`, sourced from that API's `interval`/`interval_unit` fields — so when the submodule match is missing, the Interval column now falls back to the matched plan's own tenure (e.g. '1 month') instead of showing nothing. The submodule-based value still takes priority whenever it IS present (unchanged, no regression there). Verified via a standalone script covering the exact reported case (no submodule match, plan billEvery=1) plus 3/12-month variants, a submodule-match-present case (confirms it still wins), and a neither-present case (still correctly a dash) — all resolved exactly as expected — plus a clean `npm run build`." },
  { v: "2.29.289", note: "Analytics > Earned Revenue: Deposit/Recharge Lookup Now Reads the Live Plans API Instead of Static PLAN_CATALOG (`src/modules/Analytics.jsx`): per explicit user request to source this from `GET /admin/subs-module-get-all-plans` (the same endpoint Billing & Subscription > Plans now uses, v2.29.287/288) and map Deposit ← `setup_fee`, Recharge ← `recurring_price`. Added `billingApi.getPlans()` to this page's existing `Promise.all([...])` fetch (falls back to `SEED_PLANS` if unreachable, same as the Plans page), and swapped `lookupPlanEntry()`'s data source from `Object.entries(PLAN_CATALOG)` to the fetched live plan list — the candidate-gathering/total-disambiguation logic itself (v2.29.283, for when two plans share the same display name) is unchanged, just pointed at live data now. Deliberately kept the v2.29.280 safety invariant: Deposit is only set to the plan's setup_fee when the invoice's own real total actually covers it (a genuine first/setup invoice); a renewal invoice whose total is smaller than the setup fee still correctly shows Deposit ₹0 / the whole amount as Recharge, rather than an impossible deposit exceeding what was actually paid. `PLAN_CATALOG` is no longer imported/used anywhere in Analytics.jsx. Verified via a standalone script covering 5 cases against a realistic live-shaped plan list (a straightforward setup-invoice match, the known same-name-disambiguation case, a no-regression zero-deposit case, a renewal-invoice safety case, and a fully unmatched plan) — all resolved exactly as expected — plus a clean `npm run build`." },
  { v: "2.29.288", note: "Billing & Subscription > Plans: Rebuilt the Table Around the Real API's Confirmed Field Shape (`src/shared/core.js`, `src/modules/Billing.jsx`): per explicit user request, with a real sample record supplied (plan_code/plan_id/name/product_name/status/setup_fee/recurring_price/interval/interval_unit/url/created_time_formatted/updated_time_formatted). (1) Removed Device Type and Filter Type entirely — those fields don't exist on the real payload; v2.29.287's field-name guessing for them was replaced with the confirmed real names. (2) Renamed/redefined the remaining columns per the exact spec given: Setup Fee → 'Deposit Amount' (setup_fee), Price → 'Recharge Amount' (recurring_price), Total kept as 'Total Amount' (now simply setup_fee + recurring_price, no longer trusting a total/total_price field that doesn't exist), 'Bill Every'+'Billing Interval' merged into a single 'Tenure' column (e.g. '1 months'). (3) Added a new 'Link' column — a 'Copy Link' button (Copy/Check icons, briefly shows 'Copied' on the clicked row for 1.5s) that copies the plan's real Zoho checkout `url` via `navigator.clipboard`; renders '—' for rows with no url (the SEED_PLANS sample fallback, since PLAN_CATALOG never had checkout links). (4) The two Device Type/Filter Type KPI cards ('Normal Device'/'Hot & Cold') would have silently shown 0 once that field stopped existing, so they were replaced with 'Active Plans' (status === \"active\") and 'Deposit Required' (setupFee > 0) — SEED_PLANS now defaults status:\"active\" so this reads correctly against the sample-data fallback too. (5) Removed the now-dead Device Type/Filter Type MultiSelectFilter toolbar controls and their unused import. Verified `mapPlan()` against the user's exact real sample record via a standalone script: correctly resolves to Deposit ₹1,500 / Recharge ₹250 / Total ₹1,750 / Tenure '1 months' / the real checkout URL — and via a clean `npm run build` + a live check on the sample-data fallback (still showing correctly, since the live API is unreachable from this sandbox)." },
  { v: "2.29.287", note: "Billing & Subscription > Plans: Now Backed by a Live API, `GET /admin/subs-module-get-all-plans` (`src/shared/core.js`, `src/modules/Billing.jsx`): per explicit user request to wire this endpoint into the Plans section. Since v2.29.133 this page was 100% static — a hardcoded `PLAN_CATALOG` constant, 'no API fetch' by design. Added `billingApi.getPlans()` following the exact same `getCached`/`fetchAllPagesFast` pattern as `getSubscriptions`/`getInvoices`/`getSubmodules` (paginated, rate-limit backoff, 24h persisted cache — a plan catalog rarely changes), plus a defensive `mapPlan()` that tries several likely field-name aliases per field (this endpoint has never been called from this frontend before, so its exact live shape isn't confirmed yet). Deliberately scoped to ONLY this one page: `PLAN_CATALOG` itself, and every other reader of it — `planInfo()`, `classifyPlan()`, `depositForCustomer()`, Analytics.jsx's Earned Revenue lookup, Customer.jsx's Device/Filter Type join — all keep reading the static constant completely unchanged, so this can't silently move numbers anywhere else in the app the same way editing `PLAN_CATALOG` directly would have. `PLAN_CATALOG`'s existing 64 plans are kept as `SEED_PLANS`, the exact sample-data fallback used when the live fetch fails or is unreachable — so a dead API leaves this page looking exactly as it did before this change, not blank. Also registered the new `plans` source in `TAB_SOURCES.bill_plans` so the 'server unavailable' banner now correctly reflects this page's real dependency (previously it inherited the whole module's subscriptions/invoices sources, which this page never actually used), and documented the new endpoint in About.jsx's API registry. Verified via a clean `npm run build`; live-checked against the sample-data fallback (the live API is unreachable from this sandbox) — the Plans table renders unchanged from before this change." },
  { v: "2.29.286", note: "IoT Core > Device Monitor: Removed the 'Hydraulics & Pressure' KPI Card (Pressure + Flow Rate) (`src/modules/IoT.jsx`): per explicit user request to remove the Pressure and Flow KPI cards. The Device Monitor's right-hand column previously stacked two `IoTWaterQualityCard` cards for a tank device — 'Water Quality & Potability' (pH/TDS/Temperature) and, below a divider, 'Hydraulics & Pressure' (Pressure/Flow rate). Removed the second card and its divider entirely, leaving just the Water Quality & Potability card. `IoTWaterQualityCard` is a shared, generic component (default keys `[\"ph\",\"tds\",\"temp\"]`) reused elsewhere, so only this one call site was deleted — nothing else that renders pressure/flow was touched (the Trend analysis gauges and Recent Readings table still show Pressure/Flow rate, since the user's request was scoped to this specific KPI card, not those sections). Verified via a clean `npm run build`." },
  { v: "2.29.285", note: "IoT Core: Corrected TDS Unit Label from 'mg/L' to 'ppm' Throughout the Module (`src/modules/IoT.jsx`): per explicit user report that TDS should always display as ppm, not mg/L. TDS (Total Dissolved Solids) is conventionally reported in ppm in this app's domain (drinking-water RO systems), so every occurrence of the 'mg/L' unit string tied to TDS was replaced with 'ppm' — the `IOT_WQ_META.tds.unit` constant (drives the Device Monitor metric gauge and Water Quality card), the per-device Water Quality table column header, the trend-chart tooltip row and axis label, the CSV export column header, the fleet-wide 'Avg TDS' badges, and every anomaly-detection message string (TDS_SPIKE / TDS_OOR / TDS_DROP) that quoted the threshold or reading. No numeric values, thresholds, or logic changed — this was purely the unit label (the underlying figures were already being reported in ppm terms; only the displayed unit text was wrong). Also updated the matching reference in `src/DOCUMENTATION.md`. Verified via a clean `npm run build` and a live check of Device Monitor: the Water Quality card's TDS reading now reads '44 ppm' instead of '44 mg/L'." },
  { v: "2.29.284", note: "Analytics > Earned Revenue: Fixed 'MJR Clique Hydra Apartment' Wrapping onto 3 Lines in the Apartment Column (`src/modules/Analytics.jsx`): per explicit user report. Same recurring pattern as every other instance this session — this table's cells are plain inline styles (not the shared `td` object with its deliberate `wordBreak:\"break-word\"`), so the Apartment cell simply had no `whiteSpace:\"nowrap\"` at all, and normal text wrapping broke a long society name across three lines. Added `whiteSpace:\"nowrap\"` to that one cell — the table already sits inside an `overflowX:\"auto\"` scroll wrapper (`minWidth:1200`), so this is safe the same way it was for every other table fixed this session: any row that's still too wide just scrolls horizontally instead of any cell wrapping mid-name. Verified via a clean `npm run build` and a live check: 'MJR Clique Hydra' now renders on a single line for both sample rows that have it." },
  { v: "2.29.283", note: "Analytics > Earned Revenue: Deposit/Recharge Lookup Now Uses the Invoice's Own Total to Disambiguate Between Same-Named Plan Variants (`src/modules/Analytics.jsx`): root-caused the Kavitha Dhinesh case fully — it was never a matching bug. `PLAN_CATALOG` has TWO real, legitimate entries both named 'STANDARD': `STANDARD_1M_399` (Setup Fee ₹0, Total ₹399 — a genuine zero-deposit variant) and `STANDARD_1M_399_SD` (Setup Fee ₹2,000, Total ₹2,399). Our own backend API returns plan_code `STANDARD_1M_399` for this invoice/subscription, which IS a real catalog key — so the old exact-code-match-first logic correctly found A valid entry, just the WRONG one, since the invoice's real Zoho line item is actually `STANDARD_1M_399_SD` (a backend/Zoho-sync data question outside this frontend's control, not fixable here). The fix: `lookupPlanEntry()` now gathers every catalog entry sharing the given code OR the given plan name as candidates, then prefers whichever candidate's own Total exactly equals the invoice's real total — the one signal that unambiguously identifies which specific variant was actually billed, regardless of which one the plan_code field happened to point at. Only falls back to the plain exact-code (or first name) match when no candidate's Total lines up with the real amount (e.g. a partial payment). Verified with a standalone script run against the actual live `PLAN_CATALOG` data (not a mock or hand-trace): confirmed Kavitha's exact case (code `STANDARD_1M_399`, total ₹2,399) now resolves to `STANDARD_1M_399_SD` (Setup Fee ₹2,000/Price ₹399, matching what was asked), confirmed a genuine no-deposit customer with the same code but total ₹399 still correctly resolves to the zero-deposit entry (no regression), confirmed an unrelated plan (PREMIUM_12M) and a totally unknown plan both still resolve correctly, and confirmed a real invoice whose total matches no candidate at all still safely falls back to the code match. Also verified via a clean `npm run build` and a live check on the sample-data fallback — same values as before, no regression." },
  { v: "2.29.282", note: "Analytics > Earned Revenue: Plan Code Now Shown Directly in the Table, Not Just on Hover (`src/modules/Analytics.jsx`): per explicit user request ('add the plan code also instead of plan'). The v2.29.281 Plan column only showed the plan NAME as visible text, with the plan CODE tucked into a hover-only tooltip — added a second line under the plan name showing `r.planCode` directly (small monospace muted text, '(blank)' when empty), so the exact string `lookupPlanEntry()` searches PLAN_CATALOG for is visible at a glance without hovering. Verified via a clean `npm run build` and a live check on the sample-data fallback: rows now show both lines (e.g. 'ADV_PLUS_12M' / 'ADV_PLUS_1199_12M'), and a row with no real plan code (Imran Shaikh's 'Home Monthly') correctly shows '(blank)' underneath — directly confirming, for that row, the lookup has nothing to match against by code at all." },
  { v: "2.29.281", note: "Analytics > Earned Revenue: Added a Diagnostic 'Plan' Column to Per-Invoice Recognition (`src/modules/Analytics.jsx`): per explicit user report that a real invoice (Kavitha Dhinesh, ₹2,399, Sai Poorna Premier) still showed Deposit ₹0/Recharge ₹2,399 after v2.29.280's plan-catalog lookup fix — meaning `lookupPlanEntry()` is failing to match that specific row's plan against `PLAN_CATALOG`, but there was no way to see WHY since the table never showed the plan name/code being looked up at all. Added a 'Plan' column between Apartment and Start Date, showing `r.plan` with a `title` tooltip naming the exact `planCode` and whether it matched; an unmatched plan renders with a dashed amber underline instead of plain text, so it's visible at a glance which rows fell back to the old `depositForCustomer()` estimate instead of a real catalog hit. Also added `planCode`/`planMatched` to each row object and to the CSV export (new 'Plan Code'/'Matched in Plan Catalog' columns), and fixed the footer 'Total' row's `colSpan` (7→8) to still align correctly under the new column. Verified via a clean `npm run build` and a live check on the sample-data fallback: the new column correctly renders 'ADV_PLUS_12M' as plain matched text for two rows while 'Home Monthly'/'ADV_HALF_6M'/'ADV_QTR_3M' render with the dashed-underline unmatched treatment, and the Total row's colSpan=8 aligns exactly under the 8 leading columns. This doesn't yet explain the real Kavitha Dhinesh row — the live API is unreachable from this sandbox — but it turns the mystery into something checkable: hover that row's Plan cell to see the exact code/name being searched for." },
  { v: "2.29.280", note: "Analytics > Earned Revenue: Deposit/Recharge Now Looked Up from the Plan Catalog by Name or Code, Scoped Only to This Report (`src/modules/Analytics.jsx`): per explicit user request, confirmed against a real invoice — INV-000706, ₹2,399 total, plan 'ProWater Advance'/`pro_advance`, was showing Deposit ₹0 / Recharge ₹2,399 because its plan_code never matched the shared `depositForCustomer()`'s exact-code-only lookup; the catalog's actual entry for that plan is Setup Fee ₹2,000 / Price ₹399 (2,000+399=2,399, confirming the match), so it should read Deposit ₹2,000 / Recharge ₹399. A first attempt at this fix (reverted immediately after the user flagged it broke something) changed the SHARED `planInfo()`/`depositForCustomer()` in `shared/core.js` to add a name-fallback — which silently changed numbers in the ~8 OTHER reports across this file that also call those functions (Overview, Reconciliation, etc.), none of which were part of this request. This version instead adds a LOCAL `lookupPlanEntry()` helper inside `EarnedRevenue()` only — same code-then-name matching logic, but with zero blast radius outside this one report. Also fixed a correctness bug in the reverted attempt: it would have set deposit=setupFee unconditionally for any matched plan regardless of the invoice's actual total, which breaks for a recurring recharge-only invoice (deposit already collected earlier) whose total can be far below the plan's setup fee — showing a deposit bigger than the total paid is nonsensical. Now only splits into Setup Fee + remainder when the invoice's real total actually covers the fee (a first/setup invoice); otherwise the whole total stays Recharge, same as before — deposit+recharge always sums back to the exact real invoice total, by construction, for every row. Verified via a clean `npm run build` and a live check against the sample-data fallback (the live API is unreachable from this environment, so the exact real invoice INV-000706 could not be directly re-checked): confirmed the invariant holds exactly across all 5 sample rows (e.g. ₹3,000 deposit + ₹11,400 recharge = ₹14,400 total), and hand-traced the logic against the user's own numbers — total ₹2,399 ≥ catalog Setup Fee ₹2,000 → deposit ₹2,000, recharge 2,399−2,000 = ₹399, matching exactly what was asked." },
  { v: "2.29.279", note: "Customer > All Customers: Added a 'Total Purifier Count' Footer Row and a CSV Export Button (`src/modules/Customer.jsx`): per two explicit user requests ('also a total count at the bottom of the table as Total Purifier Count - and show the count here' and 'Also add a export option'). Added a footer `<tr>` below the last data row reading 'Total Purifier Count · {results.length}' (using the shared `ftd` footer-row style already used elsewhere in this file) — counts the currently-filtered/searched population, so it stays accurate against whatever's actually on screen, not the full unfiltered dataset. Added a green 'Export' button (matching the identical button already used in this file's other export flows) to the toolbar, wired to a new `exportCsv()` that writes 'prowater-all-customers.csv' with Purifier ID/Customer/Phone/Email/Society/Plan/Device Type/Stack/Status columns, sourced from the same `results` population as the footer count and the on-screen table. Verified via a clean `npm run build` and a live check: the footer row reads 'Total Purifier Count · 5', matching the toolbar's own '5 results' count exactly, and clicking Export ran to completion with no new console errors (the sandboxed preview blocks the actual file save, so the downloaded CSV's contents couldn't be inspected directly here, but the click-through was error-free)." },
  { v: "2.29.278", note: "Customer > All Customers: DP Devices Conn — Last-Check Timestamp Now Persists Across Page Reloads, Auto-Refresh Honors the Remaining Window, WIFI-Only Force-Check, 'Auto-Refresh Stopped' Text Removed (`src/modules/Customer.jsx`): per four explicit user requests in one message. (1) 'remove the text (auto-refresh stopped)' — dropped that suffix from the caption entirely; the Stop/Resume button's own icon already communicates the state, so the caption now just omits 'next refresh' when stopped instead of announcing it a second time. (2) 'If the page refreshed dont loose the last refresh timestamp, Store it' — `liveConnLastRun` is now persisted to `localStorage` (`pw_dp_conn_last_run`) on every update and read back in its own `useState` initializer, so a real browser reload no longer resets it to null. (3) 'based on the last refresh timestamp you do a refresh after 30 mins' — the auto-refresh effect no longer unconditionally force-checks on every mount; it now computes `elapsed = Date.now() - liveConnLastRun` and schedules a one-time `setTimeout` for whatever's actually left of the 30-minute window (0 if never checked or already elapsed) before starting the recurring 30-min interval — a page reload 25 minutes after the last real check now waits 5 minutes for the next one instead of re-checking immediately. (4) 'Run a refresh only for wifi devices and skip the BLE' — `runBulkConnCheck`'s device list now filters to `connectivity === \"WIFI\"` only; BLE and GSM devices are never included in the fetch loop and simply keep falling back to their cached `deviceStatus` via the existing `isDpOnline()` logic. Verified via a clean `npm run build` and a live check: cleared persisted state, loaded fresh (ran immediately, correctly), confirmed 'Live-checked 4:30:08 pm · next refresh at 5:00:08 pm' (exactly +30 min) with no 'stopped' text visible; performed a REAL `window.location.reload()` and confirmed the timestamp and next-refresh time were byte-identical afterward — proving the timer resumed counting down rather than restarting." },
  { v: "2.29.277", note: "Customer > All Customers: DP Devices Conn Card No Longer Taller Than Its Siblings (`src/modules/Customer.jsx`): per explicit user feedback ('why did you expand the card, there was already space, adjust in that and whatever extra space you took, remove that'). v2.29.276 added the BLE/WIFI/GSM connectivity-medium breakdown as its OWN new row below the existing connected/disconnected row, growing this card taller than Total Societies/Active Customers/Device Mix — since all four sit in one CSS Grid row with the default `align-items:stretch`, that growth stretched every sibling card too, leaving visible empty space in the three that didn't actually need it. Fixed by folding the three connectivity chips into the existing 'X of Y online' row instead (right-aligned via `marginLeft:auto` in that row's own already-slack width), removing the extra row entirely — net card height is back to exactly what it was before v2.29.276. Verified via a clean `npm run build` and a live measurement: all four KPI cards in the row now report the identical height (169.8px), confirmed via `getBoundingClientRect()`, with the BLE/WIFI/GSM icons still visible on the 'of 0 online' line." },
  { v: "2.29.276", note: "Customer > All Customers: Added Phone Column to the Table, DP Devices Conn Now Shows a Connectivity-Medium Breakdown (`src/modules/Customer.jsx`): per two explicit user requests ('in the table add phone number' and, for the DP Devices Conn card, 'if the connectivity is BLE then show the count, WIFI then show the count... show the Bluetooth icon and the count, Wifi icon and the count in the same card, and if its GSM show as No Connectivity icon'). (1) Added a 'Phone' column (via the existing `fmtPhone` formatter, already used elsewhere in this file) between Customer and Society in the All Customers table. (2) Added a second row to the DP Devices Conn card, below the existing online/offline row: three small icon+count chips reading `c.connectivity` (the API's own `dp_details.connectivity` field, case-insensitive) — a `Bluetooth` icon for BLE count, a `Wifi` icon for WIFI count, and a `Ban` ('no connectivity') icon for GSM count, since GSM devices have no WIFI/BLE transport for the live conn-check to actually reach — folding them into either real medium would misrepresent them as monitorable when they aren't. Verified via a clean `npm run build` and a live check: the table header now reads 'Purifier ID / Customer / Phone / Society / Plan / Device Type / Stack / Status' with real formatted phone numbers rendering (e.g. '8839452234'), and the DP Devices Conn card shows the new BLE/WIFI/GSM row beneath the existing connected/disconnected row (all zero in this sample data, which has no DP-stack customers)." },
  { v: "2.29.275", note: "Customer > All Customers: DP Devices Conn Caption Shows the Actual Next-Refresh Clock Time (`src/modules/Customer.jsx`): per explicit user request ('instead of auto refresh stopped since you know that the next refresh is after 30 minutes, so based on the last timestamp when it was checked show as next refresh on'). The caption's auto-refresh-on state previously read a vague, static 'auto-refreshes every 30 min'; now computes and shows the actual clock time of the next scheduled check — `new Date(liveConnLastRun + 30*60*1000)` — e.g. 'Live-checked 4:18:48 pm · next refresh at 4:48:48 pm'. Left the stopped state's caption as a plain 'auto-refresh stopped' (not a computed time), since there genuinely is no next refresh scheduled once the user has stopped it — showing a hypothetical time there would be misleading. Verified via a clean `npm run build` and a live check: confirmed the on-state renders 'next refresh at 4:48:48 pm' — exactly last-check-time + 30 minutes — and clicking Stop correctly reverts the same caption to 'auto-refresh stopped'." },
  { v: "2.29.274", note: "CRM-Wide: Every Hero KPI Card Now Renders as a Plain White Card, Not a Gradient (`src/shared/ui.jsx`, `src/modules/Customer.jsx`, `src/modules/Analytics.jsx`, `src/modules/Sales.jsx`, `src/modules/IoT.jsx`, `src/modules/Billing.jsx`, `src/modules/TaskPlanner.jsx`, `src/modules/Ticketing.jsx`): per explicit user request ('Actually make all the hero cards in same color with white background like other normal cards, it becomes easy to check the percentages going up or down'), superseding v2.29.273's pill-badge patch a few minutes earlier. Root problem with the pill approach: every attempt to keep a legible delta badge ON TOP of the green-to-lime gradient (lightened text, then a white pill) kept surfacing new contrast bugs one card at a time, because no single treatment reliably survives a badge landing at an arbitrary point along a gradient that spans dark green to bright lime — the real fix was removing the gradient, not finding a better badge color. Converted every hero-flagged KPI card app-wide to the exact same white/frosted card styling its non-hero siblings already used (background, border, icon color, label/value/sub text color), so every delta/percentage badge is now just plain green/red text on white — inherently legible, no pill or backdrop trick needed anywhere. Specifically: the shared `Stat` component (used by AutoScheduler/ERP/FSM/LogsTracker/Referral and Analytics' Overview module); Customer.jsx's `CustomerSocieties` KPI grid, the Referrals-Made mini card, All Customers' Total Societies card, and the (currently unrouted/dead) `Customers()` component's Active Customers card; Analytics.jsx's Overview KPI row (simplified back to always using the existing `OvDelta` component, dropping the now-unneeded hero-only IIFE), the Combined Revenue KPI strip, the clickable drill-down KPI cards, the Apartment Performance-style stats card, and DP Transaction's Total Collected card (the card from the original bug report, now on its third and final treatment); Sales.jsx's `kpiCard` helper and its `kpiDelta` 'vivid' pill mode (now unused — no call site still requests it), plus the hand-rolled Total Leads/Total Apartment Leads cards; IoT.jsx's status KPI cards; and the generic hero-card pattern duplicated identically across Billing.jsx (×2), TaskPlanner.jsx, and Ticketing.jsx (×2). Left untouched, correctly: unconditional gradient banners/buttons that aren't KPI-with-delta cards (Analytics' Executive Briefing banner, its Grand-total footer bar, an Update button, About.jsx's changelog 'Current' version card which already used a solid non-translucent badge) — none of those have the percentage-legibility problem this request was about. Caught and fixed two self-inflicted JSX syntax errors while doing this pass (a stray comment placed as a sibling before a `.map()`'s returned element instead of inside it, which `vite build` failed on immediately — fixed both before considering any of this shipped). Verified via a clean `npm run build` and a live walkthrough across five modules: Analytics' DP Transaction and Apartment Performance (the two cards from the original bug reports) now show '▼ -6%'/'▲ +54%' as plain red/green text on white; Customer > Societies' KPI row is now uniformly white; Sales' Leads & Deals and Apartment Leads hero cards match their siblings; IoT's Device Monitor status cards are all white — no gradient hero card remains anywhere reachable in the app." },
  { v: "2.29.273", note: "Contrast Fixes for Hero-Card Percentage Badges Across Customer, Analytics and Sales (`src/modules/Customer.jsx`, `src/modules/Analytics.jsx`, `src/modules/Sales.jsx`): per explicit user request to audit the whole CRM for the same 'green KPI card, unreadable percentage' bug already fixed twice in Analytics' DP Transaction card (v2.29.270/271). A targeted audit found the identical anti-pattern duplicated in several OTHER hand-rolled hero cards that never got that fix: Customer.jsx's 'Active Customers' card (`Customers()` component) used the exact same pale `#F5BFBF`/`#B5E2D4` text with no backdrop; Analytics.jsx's Combined Revenue KPI strip collapsed hero deltas to plain white text with NO backdrop at all, losing the up/down color distinction entirely; Analytics.jsx's Overview KPI row and Sales.jsx's `kpiDelta`/static 'Active' pills used a 15-25%-opacity white pill with white text — translucent enough to wash out against the gradient's bright lime end. Fixed each with the same solid-white-pill-behind-plain-color-text treatment already proven on the DP Transaction card. Superseded minutes later by v2.29.274's broader fix (removing the gradient from hero cards entirely), which is the version that actually shipped this contrast fix to users — kept as its own changelog entry since it's a distinct, real diagnostic step in the audit trail, not a no-op." },
  { v: "2.29.272", note: "Analytics > DP Transaction: Fixed Mid-Word Wrapping Across Every Column in Both Data Tables (`src/modules/Analytics.jsx`): per explicit user report ('In Phone and Device columns, values shows like this 8127910 / 369, PUC4C / E1A72, why not in 1 row') followed by two explicit follow-ups asking to extend the same fix to the Plan column, then to every remaining column in both tables. Same root cause as the earlier Stack-column ('Zoho' -> 'Zoh'/'o') and App Logs table fixes: the shared `td` style sets `wordBreak:\"break-word\"` (a deliberate convention so long free-text cells like addresses wrap instead of overflowing), which also breaks short fixed-format values — a phone number, device code, or plan name — mid-string once a 13-14-column table's cells get narrow. Added `whiteSpace:\"nowrap\"` to every remaining `<td>` in both the 'Transactions' table (Apartment, Customer, Validity, Litres, Deposit, Revenue — Phone/Device/Plan already fixed) and the 'DP Earned Revenue Recognition' table (Apartment, Customer, Total Paid, Recharge, Tenure, Days in Month, Earned Revenue, Future Revenue — Phone/Device/Plan/dates already fixed), so all 14 columns in each table are now nowrap. Confirmed safe to do broadly (not just a targeted per-cell fix) because the shared `Table` component (`src/shared/ui.jsx`) already wraps its `<table>` in an `overflowX:\"auto\"` scrollable container and its own header cells are already nowrap — unlike the fixed-width/percentage-column App Logs table, this table has no fixed layout, so once nowrap forces a row wider than the visible area, the existing horizontal scroll (not ellipsis-truncation) is the correct, already-designed-for fallback. Verified via a clean `npm run build` and a live check: every visible cell (long apartment names like 'CRO_SVS Ananda Nilayam [ Ramamurthy Nagar ]' included) now renders on one line, and both table wrappers' `scrollWidth` now correctly exceeds `clientWidth` (1682px vs 862px, 1891px vs 864px) confirming the horizontal-scroll fallback engaged as designed rather than any cell wrapping." },
  { v: "2.29.271", note: "Analytics > DP Transaction: Total Collected's Trend Badge Now Actually Legible, Not Just Technically Red (`src/modules/Analytics.jsx`): per explicit user follow-up with a screenshot of v2.29.270's fix ('how i am supposed to ready, not at all visible neither able to identify'). v2.29.270 correctly flipped the color to red on a decrease, but landed on a pale pink (`#F5BFBF`) that had the same root problem as the original bug — a text color chosen without checking it against the actual background: the hero card's gradient runs from a darker green (top-left) to a bright lime (bottom-right, exactly where this badge sits), and no single semi-transparent text color reads reliably against both ends of that gradient. Replaced the color-only approach with a small solid white pill (`rgba(255,255,255,0.94)` background, `padding:\"2px 8px\"`, `borderRadius:999`) behind the delta text, using the same plain dark green (`#08805A`)/red (`#DC2626`) the non-hero cards already use as text color — a white backdrop guarantees contrast regardless of where on the gradient it sits, instead of hunting for another translucent color that might wash out. Non-hero cards (Earned Revenue/Recharge Collected/Deposit Collected) are unchanged — they're already on white card backgrounds where plain colored text was never the problem. Verified via a clean `npm run build` and a live check: `getComputedStyle` on the '▼ -6%' badge now reports `color: rgb(220, 38, 38)` on `background: rgba(255, 255, 255, 0.94)`, and a screenshot confirms the badge reads as a clear white pill with dark red text and icon, not blended into the green gradient." },
  { v: "2.29.270", note: "Analytics > DP Transaction: Fixed Total Collected's Trend Badge Showing Green on a Decrease (`src/modules/Analytics.jsx`): per explicit user report ('If its down by -6% it should show in red but shows in green'). Root cause, found via a targeted code trace: the KPI row's trend-color expression (`s.hero ? \"#A7F3D0\" : (s.delta >= 0 ? \"#08805A\" : \"#DC2626\")`) branched on `s.hero` FIRST and hardcoded a fixed light-green for every hero card, never checking the delta's sign at all when hero — 'Total Collected' is the only card in this KPI row flagged `hero:true`, so it always rendered green regardless of whether collections actually rose or fell, even though the arrow right next to it (`s.delta >= 0 ? \"▲ +\" : \"▼ \"`) was already correctly sign-based, producing the contradictory '▼ -6%' in green the user saw. This inline KPI card duplicates its own markup instead of reusing the shared `Stat` component (`src/shared/ui.jsx`), which already handles this correctly (`up ? \"#1E9E4F\" : down ? \"#F5BFBF\" : \"#B5E2D4\"` for hero cards) — every OTHER screen using `<Stat>` was unaffected; this was a one-off duplication bug specific to this hand-rolled card. Fixed by branching on the sign first: `s.delta >= 0 ? (s.hero ? \"#A7F3D0\" : \"#08805A\") : (s.hero ? \"#F5BFBF\" : \"#DC2626\")` — a hero-card decrease now gets the same light red/pink (`#F5BFBF`) the shared `Stat` component already uses, while the three non-hero cards in the same row (Earned Revenue/Recharge Collected/Deposit Collected) were already correct and are untouched. Verified via a clean `npm run build` and a live check against the exact reported scenario: navigated to Analytics > DP Transaction, confirmed 'TOTAL COLLECTED ₹38,873 ... ▼ -6%' renders, and `getComputedStyle` on that badge returned `rgb(245, 191, 191)` (`#F5BFBF`) — the intended red tone, not the old green." },
  { v: "2.29.269", note: "Customer > All Customers: Fixed 'Zoho' Wrapping Mid-Word to 'Zoh'/'o' in the Stack Column (`src/modules/Customer.jsx`): per explicit user report ('why in column stack zoho is showing as zoh / o'). Root cause: the shared `td` style (`src/shared/ui.jsx`) sets `wordBreak:\"break-word\"` — a deliberate app-wide convention so long free-text cells (addresses, emails) wrap instead of overflowing — but that same rule breaks ANY single 'word' that doesn't fit the column width, including a short pill badge like the Stack column's 'Zoho'/'DP' label, once the column got narrow enough (plausibly after the Filter Type column was removed in v2.29.261 and the table's columns redistributed width). Fixed by adding `whiteSpace:\"nowrap\"` directly to the Stack badge `<span>` — `nowrap` on the span overrides the inherited `word-break` for that element specifically, without touching the shared `td` style other cells still rely on. Also added the same `whiteSpace:\"nowrap\"` to the neighboring Device Type badge (identical pill pattern, same latent risk for longer labels at narrow widths, not yet reported but the same fix applies). Verified via a clean `npm run build` and a live check: `getComputedStyle` on the rendered 'Zoho' badge confirms `whiteSpace:\"nowrap\"` is applied and the badge's `offsetHeight` (19px) matches a single text line, not two." },
  { v: "2.29.268", note: "Customer > All Customers: Active Customers and DP Devices Conn Cards Collapsed to One Line Each (`src/modules/Customer.jsx`): per explicit user request ('in Active Customer KPI Card show this in 1 line itself (140 DP · 96 Zoho | 22 Inactive customers)' and 'in DP devices Conn also show this in 1 line (122 | 18 | Not yet force-checked · auto-refresh stopped)'). Active Customers' separate 'X DP · Y Zoho' and 'Z Inactive customers' lines merged into one row joined by a light-gray ' | ' divider, with `whiteSpace:nowrap` + ellipsis overflow on the line as a safety net for very large numbers. DP Devices Conn's connected/disconnected chip row and its status-caption line below it merged the same way — Wifi/WifiOff chips stay individually clickable (still toggle `connFilter`), each `flex:0 0 auto` so they never shrink, while the caption text alone gets `minWidth:0` + ellipsis so it's the part that truncates first if the combined line runs out of room (the caption is the longest, most variable-length piece — 'Live-checked 3:42:10 pm · auto-refreshes every 30 min' vs a bare 'Not yet force-checked'). Verified via a clean `npm run build` and a live check: page text confirms both cards now render as single lines — 'ACTIVE CUSTOMERS ... 0 DP · 5 Zoho | 0 Inactive customers' and 'DP DEVICES CONN ... 0 | 0 | Not yet force-checked · auto-refresh stopped' — each on one text line exactly matching the requested format." },
  { v: "2.29.267", note: "Customer > All Customers: Duplicate-Row Warning Badge, Gradient Left-to-Right (`src/modules/Customer.jsx`): per explicit user request ('if there is a duplicate row with the user in the table show with a warning sign with a gradient effect from left to right'). Counts how many rows in the current view share the same `custKey` (the v2.29.262 identity key — `customer_number`, the API's own identifier) into `custKeyCounts`; any row whose key appears more than once now renders a small 'Duplicate' pill next to the customer's name — an `AlertTriangle` icon on a `linear-gradient(90deg, #FFE08A 0%, #FF7A00 100%)` amber-to-orange background running left to right, with a `title` tooltip naming the customer ID and how many rows it appears in. Deliberately flags EVERY case where the same identity appears more than once — a genuine multi-device customer and an actual backend data duplicate look identical from the table's point of view, so the badge's job is to make either one visible at a glance rather than silently guessing which it is; Business Ops can then open the row to judge for themselves. Verified with a real duplicate, not just code review: temporarily duplicated one sample customer's row (same `id`, a second `purifier_id`) in `SEED_CUSTOMERS`, rebuilt, and confirmed live — both rows rendered the gradient badge correctly, while the Active Customers KPI card's unique count correctly still read '5' (the row-level duplicate flag and the customer-level dedup count agree, as they should since both key off the same `custKey`) — then reverted the test data immediately afterward." },
  { v: "2.29.266", note: "Customer > All Customers: Reverted v2.29.265's Total Societies Name List (`src/modules/Customer.jsx`): per explicit user request ('bump to previous version, dont show the names in the KPI card'). Removed the small 'DP: ...' / 'Zoho: ...' apartment-name text block added below the DP/Zoho split — the card is back to just the split numbers, matching v2.29.264. The click-to-filter behavior on the DP/Zoho numbers (sets the existing Customer Stack filter) and their hover tooltip listing the same names — both also from v2.29.264 — were untouched by v2.29.265 and remain in place; only the always-visible in-card text list is gone. Verified via a clean `npm run build` and a live check: the card renders '4 / 0 DP / 4 Zoho' with no name text beneath it." },
  { v: "2.29.265", note: "Customer > All Customers: Total Societies Card Now Shows the Actual Apartment Names Directly, Not Just on Hover (`src/modules/Customer.jsx`): per explicit user clarification that v2.29.264's hover-tooltip/click-to-filter treatment wasn't what they meant ('so which are those 9... show the apartment names... in the KPI card itself show it in smaller fonts'). Added a small text block below the DP/Zoho split row, separated by a subtle divider: a 'DP: ' line listing `dpSocietyNames.join(', ')` (only rendered when non-empty) and a 'Zoho: ' line listing `zohoSocietyNames.join(', ')` (same), both at 9.5px — small enough to fit a card this compact while staying legible, per the explicit 'smaller fonts' ask. The names are always visible now, no hover or click required; the click-to-filter behavior on the DP/Zoho numbers from v2.29.264 stays as a bonus shortcut into the table, not a replacement for seeing the names outright. Verified via a clean `npm run build` and a live check: the card visibly reads 'Zoho: Ashish JK, MJR Clique Hydra, Prestige Lakeside, Sobha Dream Acres' directly beneath the split (0 DP societies in this sample data, so the DP line correctly doesn't render at all rather than showing an empty label)." },
  { v: "2.29.264", note: "Customer > All Customers: Stop Button Now Actually Hard-Stops (In-Flight Requests Killed + Survives a Page Refresh), Total Societies DP/Zoho Split Shows the Real Apartment Names (`src/modules/Customer.jsx`): per explicit user report ('Stop button is not working. It is still refreshing the count... As soon as i click on Stop it should stop the refresh hard. And also on page refresh the API should not auto refresh') and follow-up ('shows as 9 DP and 4 Zoho, so which are those 9 which are under DP and which are under zoho, show the apartment names'). Root-caused the Stop bug as two separate gaps, not one: (1) the button correctly flipped React state (which does clear the setInterval), but a bulk check already IN FLIGHT when Stop was clicked had no way to actually halt — its already-dispatched fetches ran to completion and updated the KPI numbers a moment later, reading as \"it's still refreshing.\" Fixed with a real `AbortController` per bulk-check run, stored in a ref (`liveConnAbortRef`) and threaded into every `fetch`'s `signal`; the Stop button now calls `.abort()`, each worker checks `controller.signal.aborted` before starting its next device and bails immediately, and the button also force-flips `liveConnChecking`/`liveConnProgress` to their stopped state synchronously rather than waiting for the aborted fetches' rejections to unwind. (2) the on/off choice lived only in React component state, so ANY full page reload (not just a re-render) always came back up with the hardcoded default `true` and silently restarted auto-refresh even after the user had explicitly stopped it — fixed by persisting the choice to `localStorage` (`pw_dp_conn_autorefresh`) and reading it back in the `autoRefreshOn` state's own initializer, so a stopped state now survives a real browser refresh. Separately, the Total Societies card's DP/Zoho split previously showed only counts; changed `resultSocieties`'s derivation to keep the actual sorted society-name arrays (`dpSocietyNames`/`zohoSocietyNames`), added a `title` tooltip on each stat listing the real apartment names on hover, and made each stat clickable — it now sets the existing `stackFilter` (the same Customer Stack filter already in the toolbar) so clicking 'DP' or 'Zoho' immediately filters the table below to exactly those apartments' customers, full detail included. (A society with both a DP and a Zoho customer legitimately appears in both lists — that overlap explains why the two counts can sum past the total, and isn't a bug.) Verified via a clean `npm run build` and a live check: clicking Stop persisted `\"off\"` to localStorage (confirmed by reading the key directly) and updated the button/caption instantly; a real `window.location.reload()` afterward came back up still showing 'Resume the 30-min auto-refresh' and 'auto-refresh stopped' — not a soft React re-render skip, an actual full page load; hovering the Zoho stat showed a tooltip listing the real sample-data society names ('Ashish JK, MJR Clique Hydra, Prestige Lakeside, Sobha Dream Acres'), and clicking it visibly applied the Customer Stack filter (a 'Reset Filters' chip appeared) and re-filtered the table." },
  { v: "2.29.263", note: "Customer > All Customers: Stop/Resume Button for DP Devices Conn's Auto-Refresh, Total Societies Card Now Shows Its DP/Zoho Split Beside the Number (`src/modules/Customer.jsx`): per explicit user requests ('Add a stop refresh button in the DP Devices Conn KPI Card' and 'In Total Societies KPI Card show the split of it, on the right side of the KPI card there is much space'). (1) Added a small `PauseCircle`/`PlayCircle` toggle button next to the existing force-refresh icon: a new `autoRefreshOn` state (default true) gates the v2.29.259 30-minute auto-refresh `useEffect` — turning it off clears the interval, turning it back on immediately re-checks and re-arms the schedule. The manual force-refresh icon next to it still works regardless of this toggle's state. The card's caption line now reflects it too ('auto-refresh stopped' vs 'auto-refreshes every 30 min'). (2) Total Societies is a wide hero gradient card that only ever showed a small 'X DP · Y Zoho' caption line below the big number, leaving the right two-thirds of the card empty — restructured to a horizontal split instead: the total count stays on the left, and the DP/Zoho breakdown now renders as two stacked mini-stats (number + label) with a vertical divider, filling the card's right-side space. Verified via a clean `npm run build` and a live check: clicking the new stop button flips its icon/color and its title from 'Stop the 30-min auto-refresh' to 'Resume the 30-min auto-refresh', and the caption updates to 'auto-refresh stopped' in real time; Total Societies renders '4' on the left with '0 DP' / '4 Zoho' as a two-column split on the right, confirmed via screenshot." },
  { v: "2.29.262", note: "Customer > All Customers: Unique-Customer Count Now Keyed Off the API's Own customer_number, Not a Zoho/Email Guess (`src/modules/Customer.jsx`): per explicit user follow-up re-emphasizing the get-all-customers-only rule alongside 'show the unique count please, otherwise Business Operations team will have a lot of issues.' The v2.29.257 dedup (`custKey()`) prioritized `zohoId`, falling back to `email` with a special-case carve-out for the old synthesized stub rows' shared placeholder email — that carve-out is now dead weight since v2.29.260 removed stub-row synthesis entirely, and zohoId/email was always a proxy for what the API already hands us directly: `customer_number`. Confirmed against both real examples the user pasted — Zoho's `customer_number:\"CUS-00010\"` and DrinkPrime's `customer_number:\"267907\"` (note DP's `zoho_customer_id` is an empty string, making zohoId a weak primary key for DP records specifically) — `customer_number` is the one identifier the API guarantees on every real record regardless of type, and the existing mapper in `customerApi.getCustomers` already surfaces it as `c.id`. Simplified `custKey()` to key on `c.id` directly, falling back to email only in the defensive case `id` itself is somehow blank. Verified via a clean `npm run build` and a live check against the sample-data fallback (live API unreachable in this environment): Active Customers card still reads '5 of 5 unique customers / 0 DP · 5 Zoho / 0 Inactive customers', internally consistent, no regression from the simplification." },
  { v: "2.29.261", note: "Customer > All Customers: Removed Filter Type Column, Un-Installed Rows Now Red Like Dunning (`src/modules/Customer.jsx`): per explicit user request ('remove filter type column from the table... where the device status is Un-Installed mark in red color for the entire row like how you have for dunning'). (1) Dropped the 'Filter Type' `<th>`/`<td>` from the All Customers table (head array + its row cell) — table now reads Purifier ID / Customer / Society / Plan / Device Type / Stack / Status. The 'Filter Type' faceted filter dropdown above the table was left in place (still functionally filters `results` by the same underlying field) since only the column display was asked to go, not the ability to filter by it. (2) `rowTint()`'s Un-Installed branch (`dev.includes(\"uninstall\")`) previously painted the row a separate pale yellow (`#FFFBEA`); merged it into the same `var(--danger-t)` red already used for Dunning rows, so a row is now red whenever EITHER condition is true — Inactive rows keep their own distinct orange, unchanged. Verified via a clean `npm run build` and a live check: the table header and every row now render without a Filter Type column, confirmed via the rendered header text. The sample-data fallback (live API unreachable in this environment) has no Un-Installed rows in its fixture, so the red-tint logic itself was verified by code inspection matching the exact same branch structure as the already-proven Dunning case, not by a live visual — worth a quick look once real DP data with an Un-Installed device is on screen." },
  { v: "2.29.260", note: "Customer > All Customers: Stopped Fabricating Placeholder 'DrinkPrime Customer' Rows — Directory Now Shows ONLY What get-all-customers Actually Returns (`src/shared/core.js`): per explicit user report of a confusing row ('DPMB03D87B | DrinkPrime Customer (DPMB03D87B) | ... | active' — 'i have the customer name, plan everything then why is it showing like this?') and the explicit follow-up instruction ('pull the records what i have in the get-all-customers API, not anything extra... whether it is a zoho record or DrinkPrime record that also has an identifier in the API'). Root cause: `customerApi.getCustomers()` did TWO things — (1) map every real row from `/admin/get-all-customers` (this already correctly handles a genuine DrinkPrime customer_profile, confirmed against a real example the user pasted: `is_dp_customer:true` with a full `dp_details` block — name/email/phone/plan/purifier_id/bid/connectivity all come through correctly), then (2) separately fetch a DIFFERENT endpoint (`fetchAllDpTransactions`, the raw DrinkPrime payments/collections feed) and fabricate a fake customer row for any device that appeared THERE but had no matching `purifier_id` anywhere in step 1's list — hardcoding name ('DrinkPrime Customer (<device code>)'), email ('support@drinkprime.in', identical for every such stub), plan ('DrinkPrime Purifier'), and status ('active'), with only the society field being real (borrowed from the transaction's `partner_name`). That's exactly what the user's example row was — a device with transaction history but no actual profile in get-all-customers, so the two hardcoded/generic fields (name, plan) looked like real data but weren't. Removed that entire synthesis block (~50 lines) — `getCustomers()` now returns exactly the mapped `get-all-customers` rows and nothing else, whether they're a Zoho record (`is_dp_customer:false`) or a genuine DrinkPrime record (`is_dp_customer:true`, with a real `dp_details` block) — both already carry a real identifier (`customer_number`) and real profile data in that single API, no cross-referencing needed. `fetchAllDpTransactions` itself is untouched and stays exported/in use elsewhere (Analytics' own DP Transaction tab reads it directly for its own purposes) — only its use inside `getCustomers` for stub-fabrication is gone. Verified via a clean `npm run build` and a live check: All Customers still renders correctly end-to-end on the sample-data fallback path (this environment's live API is unreachable, so the specific fabricated-row removal itself couldn't be exercised against real data — only confirmed the mapping-only code path builds clean and the rest of the screen has zero regression)." },
  { v: "2.29.259", note: "Customer > All Customers: DP Devices Conn Card Now Force-Checks Live Connectivity for Every DP Device, with a Manual Refresh Icon and a 30-Minute Auto-Refresh (`src/modules/Customer.jsx`): per explicit user request ('run a force check of the device connection API for all devices so that i can get a correct device online and offline count... give a refresh icon inside the KPI card... run a live refresh every 30 mins'). The card previously derived Connected/Disconnected purely from each customer's cached `deviceStatus` field (whatever DrinkPrime last reported into Zoho, which can be stale by hours) — the only real live check in the file, `runConnCheck`, only ever pinged one device at a time from inside an opened customer's profile drawer. Added `runBulkConnCheck()`: iterates every DP-stack customer with a `bid` across the FULL loaded dataset (not just the current search/filter view, so a force-check covers all devices regardless of what's on screen), hitting the same `POST /sponsor/device/life/conn-check` endpoint through a small 6-way concurrency pool (a real fleet can be hundreds of devices — unbounded parallel fetches would hammer the API), and using the exact same response convention the single-device 'Ping Conn' check already relies on (`{success:true}` = online). Results land in a `liveConn` map keyed by `bid` (`true`/`false`/`null` — `null` means the check itself failed, e.g. network error, and that one device falls back to its cached `deviceStatus` rather than being silently miscounted offline); `dpConnected`/`dpDisconnected` now read this map first via a new `isDpOnline()` helper. Runs automatically once the page's data finishes loading, then every 30 minutes via `setInterval` (cleared on unmount) — used a ref (`liveConnCheckingRef`), not the `liveConnChecking` React state, to guard against overlapping runs, since the interval's closure is captured once when data first loads and can't be trusted to see fresh state on later ticks. Added a small `RefreshCw` icon button (reusing the already-defined global `pw-spin` keyframe for its spinning state while checking) next to the card's Wifi icon, plus a caption line under the Connected/Disconnected chips showing either live progress ('Force-checking…12/40'), the last-run time ('Live-checked 3:42:10 pm · auto-refreshes every 30 min'), or 'Not yet force-checked'. Verified via a clean `npm run build` and a live check: the refresh button and caption render correctly, clicking it re-runs the check and updates the last-run timestamp (confirmed via `button.title` before/after), and no new console errors or React hook warnings were introduced; the sample dataset has zero DP customers so the actual bulk-fetch/concurrency path itself couldn't be exercised live in this environment, only the state wiring, button, and auto-run-on-load path — worth a spot-check against a real DP fleet once the live API is reachable." },
  { v: "2.29.258", note: "Customer > All Customers: Own/Normal/Hot & Cold Device Cards Consolidated into One 'Device Mix' Card (`src/modules/Customer.jsx`): per explicit user request ('rather than showing 3 different card each for Own, Normal, Hot & Cold Device - show in 1 KPI card itself and show the split numbers with the icons... then i will get the spacing for Total Societies, Active Customers & DP devices conn'). The KPI row previously rendered 6 cards off a `repeat(auto-fit,minmax(190px,1fr))` grid — Total Societies, Active Customers, DP Devices Conn, then 3 near-identical device-type cards each with just a label/icon/number. Replaced the 3-card `.map()` with a single 'Device Mix' card matching the DP Devices Conn card's established pattern (big total number + small icon-and-count chips below, same as the Wifi/WifiOff connected-count chips added in v2.29.256): headline number is the sum of all three device types ('{n} total devices'), with three inline chips below it — each device type's own existing KPI image (imgWaterFilter/imgTool/imgTechnology) at 14px next to its count, with a title tooltip naming the type. Net effect: the row now renders 4 cards instead of 6, so with the same `auto-fit,minmax(190px,1fr)` grid the first three cards (Total Societies, Active Customers, DP Devices Conn) get noticeably more width instead of being squeezed as tightly as before. Verified via a clean `npm run build` and a live check: the row shows exactly 4 wider cards, and the Device Mix card's '5 total devices' with '1/3/1' chips correctly sums to the sample data's 5 device-typed customers." },
  { v: "2.29.257", note: "Customer > All Customers: Active Customers Card Now Shows a True Unique-Customer Count, with DP/Zoho Split and an Inactive Count (`src/modules/Customer.jsx`): per explicit user follow-up after being told the card was counting rows, not people ('Show a unique count of DP and Zoho - total number than you show there - but also show the split. Inactive also you show the count'). Added a `custKey()` identity function that rolls up the row-per-purifier `results` population into real per-customer entries: prefers `zohoId` (unique per real Zoho customer), falls back to `email` — EXCEPT the synthesized DP-only 'stub' customers (created in `customerApi.getCustomers` when a DrinkPrime device has no matching Zoho profile) which all share one hardcoded placeholder email ('support@drinkprime.in') that would have wrongly merged unrelated stub devices into a single fake 'customer' — those fall back to each stub's own unique `id` (which embeds the device code) instead. Each unique customer's `isActive`/`isDp` flags are OR'd across all of that person's rows, so someone with one active and one inactive device correctly counts as an active customer, and someone with any DP-stack device correctly counts toward the DP split. The Active Customers card now reads '{uniqueActiveCount} of {uniqueTotalCount} unique customers', plus two new lines: a green '{uniqueDpCount} DP · {uniqueZohoCount} Zoho' split of the total, and a red '{uniqueInactiveCount} Inactive customers' count — both computed from the same deduplicated population, replacing the old `activeCount`/`results.length` row-based numbers (removed the now-dead `activeCount` row-count variable). Verified via a clean `npm run build` and a live check against the 5-row sample dataset (5 distinct people, no duplicates in this fixture): card reads '5 of 5 unique customers / 0 DP · 5 Zoho / 0 Inactive customers', internally consistent (0+5=5 total, 5 active+0 inactive=5 total)." },
  { v: "2.29.256", note: "Customer > All Customers: DP Devices Conn Card Now Shows Wifi Icons Instead of Text Labels (`src/modules/Customer.jsx`): per explicit user request ('rather than showing Connected and Disconnected, show the wifi symbol and then show the count'). Replaced the '{n} Connected · {m} Disconnected' text pair with a `Wifi` icon (green) next to the connected count and a `WifiOff` icon (red) next to the disconnected count — both icons were already imported and used elsewhere in this file for the connectivity-check UI. Kept the existing click-to-filter behavior and active/highlighted-chip styling (background/border toggle on click) unchanged, only swapped the label text for an icon; the full counts moved into each chip's `title` tooltip. Verified via a clean `npm run build` and a live check: both chips render with their icon inline before the count, and clicking either still toggles the `connFilter` state correctly." },
  { v: "2.29.255", note: "Analytics: Fixed App Logs Table Horizontal Overflow (`src/modules/Analytics.jsx`): per explicit user report ('Table alignment is very bad') pointing at the Analytics module's App Logs table. Measured first rather than guessing: the table wrap's `scrollWidth` (938px) exceeded its `clientWidth` (864px) by 74px even though the `<th>` header cells' `width` percentages summed exactly to 864px — proving the overflow came from body-cell CONTENT, not header sizing. Two compounding causes: (1) generous 14px/18px cell padding was eating too much of already-narrow percentage columns (Purifier ID 10%, Status 8%), so a sample row's Purifier ID chip ('PW-90233') wrapped mid-word onto two lines; (2) several `<td>`s used `whiteSpace:\"nowrap\"` (Phone, Device, IP, Login time, and the Status pill from the shared `renderHigStatusBadge` helper) with no `overflow:hidden`/`textOverflow:\"ellipsis\"` — in `table-layout:fixed`, a fixed column WIDTH doesn't clip nowrap CONTENT that's wider than it; the content just visually pokes past the cell edge, which was inflating the wrap's real `scrollWidth`. Also found one sample row's `status` field holds a raw stringified API-response dump (`{status: success, count: 1, docs: [...]}`, ~90 characters) — a data-quality artifact from an unreachable endpoint's fallback, not something any column width could accommodate. Fixed by: reducing all header/body cell padding from `14px 18px` to `12px 10px`; rebalancing the eight column-width percentages (User 18→16%, Phone 12→10%, Apartment 18→15%, Purifier ID 10→12%, IP 10→11%, Login time 12→13%, Status 8→11%, Device unchanged at 12%); adding `overflow:hidden;textOverflow:\"ellipsis\"` to every nowrap cell (Phone, Apartment, Device, IP, Login time, Purifier ID's chip cell, and a new `overflow:hidden` wrapper around the Status badge); and truncating the Status cell's text to 20 characters via the table's existing local `trunc()` helper before handing it to `renderHigStatusBadge` (with the full untruncated value kept in a `title` tooltip), so the pathological long-status row degrades gracefully instead of blowing out the table. Verified via a clean `npm run build` and a live check: the table wrap's `scrollWidth` now exactly equals its `clientWidth` (864px, zero overflow, confirmed by a `scrollLeft` probe finding nothing to scroll), and a screenshot confirms the Purifier ID chip and every other cell now render on a single line with ellipsis truncation instead of wrapping or spilling past the table edge." },
  { v: "2.29.254", note: "Layout: corrected collapsed sidebar grid template column widths from 52px to 68px (compensating for the 16px left margin of the rail), aligning all icons and active indicator states perfectly inside the rail background." },
  { v: "2.29.253", note: "Customers: cleaned up CSV exports to strip country codes or spreadsheet-escape characters from phone numbers, rendering exactly a 10-digit number." },
  { v: "2.29.252", note: "Customers: updated the societies section CSV export to flatten and include detailed customer-level rows (Customer Name, Phone, Purifier ID, Society, Plan, Status, Device Type) instead of only society aggregates." },
  { v: "2.29.251", note: "Login: adjusted background image vertical positioning to center 20%, pulling the building render down to make the rooftop ProWater tank and Central RO System branding visible." },
  { v: "2.29.250", note: "Login: added the high-fidelity building rendering as a blended double-exposure background image with smooth radial-gradient edge fading." },
  { v: "2.29.249", note: "Layout: removed the system clock 'Time' badge from the topbar across all module shells, and restored the absolute centering of the IoT apartment badge." },
  { v: "2.29.248", note: "Layout: relocated the IoT topbar apartment badge inline next to the section title, resolving overlap issues with the topbar action buttons on narrower viewports." },
  { v: "2.29.247", note: "Layout: capitalized greeting words (e.g. Good Morning) and capitalized the first letter of user profiles (e.g. Devops), appending waving hand emoji to the greeting headers." },
  { v: "2.29.246", note: "Analytics: updated the apartment customer details modal to display split columns for Deposit, Recharge, and Total Paid, along with summary headers and a grand total footer row." },
  { v: "2.29.245", note: "Analytics: changed the recharged customer details subpage to render as a full-size center modal containing a tabular structure instead of a side drawer." },
  { v: "2.29.244", note: "Analytics: added a detailed customer recharge drawer subpage to the All Apartment Performance table, allowing users to view a list of all customers who made a recharge in the clicked apartment during the selected period." },
  { v: "2.29.243", note: "Login: resolved missing CSS styles for the running character and doorway structure, allowing the submission animations to render correctly." },
  { v: "2.29.242", note: "Login: added a new high-fidelity doorway entrance and running character animation for the Sign In submit button, complete with toggle transitions and spring easing." },
  { v: "2.29.241", note: "Analytics: unified Zoho Billing and DrinkPrime databases, automated stub customer creation for unregistered DP active devices (262 active total), aligned active customer metrics between Analytics and Customer modules, normalized society names case-insensitively, restricted topbar Refresh button to admin-only access, polished UI (removed duplicate sidebar toggles, renamed Overview_V2 tab to Overview V2)." },
  { v: "2.29.240", note: "Sidebar Height Matched to the Module Grid Again — Without the Clipping Bug This Time, Footer Moved Back Into the Sidebar as Two Lines (`src/App.jsx`): per explicit user request pointing at a screenshot ('the sidebar is not matching the card size') plus a specific two-line format for the footer. This is the same visual goal as v2.29.235, which had been reverted in v2.29.236 after it caused the nav list to clip/overlap the version pill. Root-caused why that attempt broke: it capped the inner sidebar at a fixed `min(96vh,860px)`, and a full admin's 16-item nav list needed slightly more than that. This time, split `.pw-sidebar-v3` into an outer `.pw-sidebar-rail` (a plain grid item, no explicit height, carries the background/border/radius/shadow and theme variables) and kept the inner `.pw-sidebar-v3` at `height:100%` of the outer — not a fixed px cap — so it always sizes to exactly whatever the grid-stretch computes (`max(sidebar's own nav content, main's content)`), never less than the nav list actually needs. Also removed `.premium-home{min-height:100vh}` (added `align-content:start`) so the grid row's height is driven by real content instead of an artificial full-viewport floor. Verified via `getBoundingClientRect`/`scrollHeight` at the exact 1280×1080 size that broke v2.29.235: `nav.scrollHeight` now exactly equals `nav.clientHeight` (679px both — zero internal overflow, all 16 items visible) and the sidebar rail's bottom sits within ~32px of the module grid's bottom (that gap being the content wrapper's own bottom padding, not a bug). Also moved the footer copyright/build line back into a `.pw-sidebar-footer` beneath the user-card in both Home and Shell, this time as two stacked lines ('© {year} ProWater Internal Systems' / 'Wisdom 2.0 · Build {APP_VERSION}') instead of one, removing the page-level `<footer>` again. Verified via a clean `npm run build` and a live check in both Home and the Billing module." },
  { v: "2.29.239", note: "Module Card min-height Nudged to 15px (`src/App.jsx`): per explicit user follow-up ('change to 15') to v2.29.238's card-height reduction. Same non-binding floor as before — natural content height (~63px) still dominates, so this is a no-op visually but keeps the value at exactly what the user asked for. Verified via a clean `npm run build`." },
  { v: "2.29.238", note: "Module Card Height Reduced (`src/App.jsx`): per explicit user request, first 'change the height to 13' then corrected mid-turn to 'change the height to 14', pointing at the Home module-grid cards. `.premium-module`'s `padding` (13px vertical) was already 13 — the property actually holding the card taller than its content needed was `min-height:86px`, a floor above what the icon+padding (~37px icon + 13px×2 padding ≈ 63px) naturally require. Changed `min-height` to `14px`: since `min-height` is a floor, not a cap, this doesn't clip anything — content still renders at its natural height, just without the extra ~22px the old 86px floor was forcing on every card. Verified via a clean `npm run build` and a live check: cards are visibly shorter with icon and both lines of text intact, and noticeably more of the module grid fits in the same view." },
  { v: "2.29.237", note: "Topbar Header Card Height Reduced (`src/App.jsx`): per explicit user request ('reduce the card height... change the height to 8'), reduced `.pw-top-header`'s vertical padding from 20px to 8px (horizontal padding left at 34px). A scoped, single-property change only — the module grid, sidebar, and every other size untouched, unlike the broader compacting pass in v2.29.234 that had to be reverted in v2.29.236. Verified via a clean `npm run build` and a live check: the header card is visibly shorter while the greeting, session badge, avatar, and Logout button still sit comfortably inside it." },
  { v: "2.29.236", note: "Reverted to the 2.29.232 UI State, Per Explicit User Request (`src/App.jsx`): the user flagged a screenshot of the sidebar's nav list visibly clipped/overlapping the version pill and asked to revert rather than iterate further. Since v2.29.233–235's work was still uncommitted (this project is a git repo — `git log` showed the last commit, `ee088db`, stopped at v2.29.230, with 231–235 all sitting as unstaged working-tree changes), a plain `git restore` would have landed at 230, one version short of what was asked; instead manually reversed each v2.29.233/234/235 edit by hand, in the specific area it touched, confirmed by a `grep` for every marker string those versions introduced (`pw-sidebar-rail`, `pw-sidebar-footer`, `align-content:start`, `min(96vh`) returning zero matches afterward: (1) v2.29.233's split of the sidebar into an outer `.pw-sidebar-rail` + inner `.pw-sidebar-v3` — merged back into the single `.pw-sidebar-v3` element (280px, `height:96vh`, its own background/border/shadow/radius, `data-theme` back on the one `<aside>`) in both Home and Shell. (2) v2.29.234's compacting — module-card `min-height`/padding/icon/chevron/name/desc sizes, grid gap, group margins, section/content padding, `.pw-top-header` padding and greeting size, `.pw-session-badge`/icon, `.pw-avatar-btn`, `.pw-logout-btn` — all restored to their v2.29.232 values; the role-tag icon bumped back from 11px to 10px; the sidebar-footer copyright line removed and the original page-level `<footer>` (below `<main>`, using `var(--muted)`/11px) put back in Home. (3) v2.29.235's `.premium-home{min-height:100vh}` removal and `.pw-sidebar-v3` height cap — both undone, restoring the original `min-height:100vh` (no `align-content`) and flat `height:96vh`. Kept everything through v2.29.232 untouched — the 'Jungle Pop' palette, the pasted topbar-header-card redesign (gradient-text greeting, icon-circle session badge, solid-gradient logout button), and the `.pw-root button{background:none}` specificity fix all remain in place, since the user's own follow-up message pinned the target at exactly 2.29.232 rather than further back. Verified via a clean `npm run build` and a live check at the same 1280×1080 size used to debug v2.29.235: the sidebar nav list, version pill, and user-card no longer overlap, and Shell's module topbar matches the same restored sizing." },
  { v: "2.29.235", note: "Fixed the Large Empty Gap Below the Home Grid on Tall Screens (`src/App.jsx`): per user screenshot showing a large blank void between the module grid's bottom and the sidebar/page's actual bottom on their screen. Reproduced it by resizing the preview to 1280×1080 (the v2.29.233 sidebar-height fix had only been tested at 720px tall, where it happened not to show) — at 1080px, the module grid's real content stood at 815px while the sidebar/page ran to 1082px, a ~267px dead zone. Root-caused it to TWO compounding issues, not the module-card sizing the gap made it look like: (1) `.premium-home{min-height:100vh}` was forcing the grid's single row — and therefore both the sidebar and main-content grid items via `align-items:stretch` — to fill at least a full viewport regardless of how short the actual content was; removed it (added `align-content:start` alongside) and let `#root`'s own `min-height:100vh` background serve as the fallback so a short page still isn't left with a jarring gap down to the browser's white beneath it. (2) `.pw-sidebar-v3` (the inner sticky nav box) still had v2.29.233's `height:96vh` reference woven through it, which independently forced the row's 'natural' height to ~96% of viewport even with fix (1) in place; capped it at `min(96vh,860px)` instead — enough to fit a full admin's 16-item nav list without needing `.pw-nav-container`'s internal scroll in the common case, while no longer scaling up arbitrarily on tall monitors. Verified via a clean `npm run build` and a live check at the exact 1280×1080 size that reproduced the bug: the sidebar and module grid now end within about 46px of each other (down from 267px), and re-checked that the original narrow-viewport zero-scroll behavior from v2.29.234 still holds unchanged." },
  { v: "2.29.234", note: "Slimmer Header + Module Cards to Cut Scrolling, Footer Moved Into the Sidebar (`src/App.jsx`): per explicit user request ('reduce the size of the card height wise and make it little slimmer because that will prevent the screen from scrolling down. In one screen entire page is loading') plus two small pasted-HTML tweaks and moving the page footer into the sidebar. Measured first: at a 720px viewport the page needed 436px of scroll (`document.body.clientHeight` 1156 vs viewport 720). Shrinking just the header card (as literally asked) couldn't close a gap that size on its own, so also tightened the module grid, which is the dominant contributor — `.premium-module` `min-height:86px→64px`, `padding:13px 15px→10px 13px`, `border-radius:16px→14px`; icon `37px→32px`, chevron `25px→22px`, name `14px→13.5px`, desc `11.5px→11px`; grid `gap:14px→10px`; `.premium-group` margin `16px→9px`; category-title padding/margin trimmed to match; `.premium-section` padding `22px 24px→16px 20px`; `.premium-content` padding `18px 32px 26px→12px 28px 16px`. Also slimmed `.pw-top-header` (padding `20px 34px→13px 28px`, greeting `30px→22px`) and its companion pieces proportionally so they don't look oversized next to the now-shorter header: `.pw-session-badge`/`.pw-session-icon`, `.pw-avatar-btn` (`50px→40px`), and `.pw-logout-btn` all reduced roughly 20%. Net result: scroll need dropped from 436px to ~112px on the same test viewport — real screens taller than 720px (most laptops) should now need little to no scroll for a typical module count. Also: bumped the sidebar user-card's role-tag icon from 10px to 11px per the user's pasted markup (a trivial, explicitly-optional tweak — the `.pw-role` capitalization they also pasted was already produced by the existing `text-transform:capitalize` CSS, so no change was needed there), and moved the page-level `<footer>` copyright/build line ('© {year} ProWater Internal Systems · Wisdom 2.0 · Build {APP_VERSION}') into a new small `.pw-sidebar-footer` caption below the user-card in both Home's and Shell's sidebars, replacing its old spot below `<main>` on the page itself. Verified via a clean `npm run build` and a live check in both Home and the Sales module: the module grid now shows through the 'TECH' row in the same initial view that previously stopped at 'IoT & Communications', and the copyright line renders inside the dark sidebar under the user-card." },
  { v: "2.29.233", note: "Sidebar Now Stretches to Match the Content Column's Full Height (`src/App.jsx`): per explicit user feedback with screenshot ('the module cards size will match at the bottom... currently it is upside down, i want it to be at the same level'). Measured the actual gap first rather than guessing: at a 720px-tall viewport with all 15 modules visible, the module grid's bottom sat ~373px below where the sidebar's dark background stopped — far more than any padding trim could close, since `.pw-sidebar-v3` had a hardcoded `height:96vh` (a fixed fraction of the viewport, regardless of how much taller the actual content column was). Root fix: split the sidebar into two elements — an outer `<aside className=\"pw-sidebar-rail\">` that's a plain grid item with no fixed height (so it stretches to the grid row's real height via the grid's default `align-items:stretch`, matching whatever the module grid column actually renders at) now carrying the dark card's background/border/radius/shadow and the `[data-theme]` CSS-variable definitions, and an inner `.pw-sidebar-v3` div that keeps the old `position:sticky;top:2vh;height:96vh` sizing (so the nav content — logo, menu, user-card — still stays pinned to the viewport while scrolling) but is now transparent, letting the outer rail's background show through underneath and beyond it. First attempt only stretched the outer element without moving the visual styling to it, which left the (still 96vh-capped) inner div as the only visible dark surface — caught this via `getComputedStyle`/`getBoundingClientRect` measurements before considering it done, not by trusting a screenshot alone, since a `position:sticky`+`backdrop-filter:blur()` combination at a large scroll offset produced a screenshot-capture-only compositing glitch (a stray full-width dark rectangle) in this environment that `elementFromPoint` checks proved wasn't real DOM/CSS state. Verified via a clean `npm run build` and a live check: at full scroll, the sidebar rail's bottom now lands within ~12px of the module grid's bottom (accounted for by the content wrapper's own bottom padding) — down from a 373px gap — and the collapsed icon-rail toggle plus Shell's module view both still render correctly." },
  { v: "2.29.232", note: "Header Card Trimmed to a Single Greeting Line (`src/App.jsx`): per explicit user request ('remove this: Welcome back. Here's what's happening today. then the card size will be reduced'), removed the `.pw-subtitle` line (and the now-unused CSS rule) added under Home's greeting in v2.29.231, and reduced `.pw-top-header`'s vertical padding from 26px to 20px so the card sizes down to fit its now single-line content instead of leaving oversized empty padding around it. Verified via a clean `npm run build` and a live check: the header card is visibly shorter with just 'Good evening, devops' on one line." },
  { v: "2.29.231", note: "Topbar Header Card Redesign + Fixed a Silent Button-Background Regression (`src/App.jsx`): implemented the user's pasted HTML/CSS redesign of the topbar header row. (1) Home's `.pw-top-header` is now its own floating card (white-to-mint gradient, 26px radius, soft green-tinted border/shadow) instead of a bare flex row on the page background; the greeting split into a base + gradient-text name (`<span>` clipped to the green→lime gradient) plus a new `.pw-subtitle` line ('Welcome back. Here's what's happening today.'). (2) `.pw-session-badge` rebuilt around a `.pw-session-icon` gradient circle plus a stacked `<small>label</small><strong>value</strong>` pair, applied to Home's single session pill and both of Shell's (labelled 'Time' for the clock and 'Session' for elapsed, keeping their existing semantic distinction). (3) `.pw-avatar-btn` grew from a 32px rounded-square to a 50px circle on a green→`#7ED321` gradient with a bigger shadow; `.pw-camera-dot` grew from 15px to 19px with a solid lime fill and dark-green icon instead of its own separate gradient. (4) `.pw-logout-btn` changed from transparent-until-hover to a solid green gradient pill at rest, turning solid red with a lift and shadow on hover, `scale(.97)` on click. (5) While verifying this in the browser, found that NONE of these backgrounds were actually rendering — `getComputedStyle` showed `background: none` on `.pw-avatar`, `.pw-action-btn`, `.pw-avatar-btn`, `.pw-logout-btn`, and `.pw-sidebar-toggle-btn` despite the CSS being correct on paper. Root cause: the global reset `.pw-root button{background:none}` has specificity (0,1,1) — a class plus an element — which beats any single-class button rule like `.pw-avatar-btn{background:...}` at (0,1,0) regardless of source order, silently zeroing it; only multi-class selectors like `.pw-item.active` (0,2,0) survived it. This affected five existing button styles, not just the two touched by this redesign — likely broken since whenever that reset rule was introduced, well before this session noticed via a screenshot showing an invisible Logout button and a plain unstyled 'D' avatar. Fixed by scoping all five as `.pw-root .the-class` (0,2,0), and left a comment on the reset rule itself so the next new button-with-a-background doesn't lose the same fight. Also caught and fixed one more repeat of this session's recurring bug: an explanatory comment I wrote inside the TOKENS template literal used backtick-wrapped inline-code spans, which are real backticks that closed the literal early and broke the build — caught by the build failing outright (not silently) this time, and fixed by writing the comment in plain text. Verified via a clean `npm run build` and a live check in a fresh tab (to rule out stale console history): the new header card, gradient name text, icon-circle session badges, larger avatar, and solid green-to-red Logout button all render correctly, and a `getComputedStyle` sweep confirmed all five previously-invisible button backgrounds are now applying." },
  { v: "2.29.230", note: "\"Jungle Pop\" Accent Palette Applied App-Wide (`src/App.jsx`, `src/shared/ui.jsx`, all modules using the brand accent, `src/shared/core.js`): per the user's pick from a pasted palette-comparison screenshot ('I want to use the Jungle Pop Color throughout the CRM' — 'Bold greens with a bright lime pop — energetic, fresh, and attention-grabbing'). Replaced the prior green-to-gold accent gradient (`#0A9D6E → #E8A93A`, plus its `rgba(10,157,110,*)`/`rgba(232,169,58,*)` glow variants) with a bolder green-to-lime gradient (`#1E9E4F → #C4E538`, `rgba(30,158,79,*)` glows) across every file that carries the decorative brand accent: `--brand`/`--grad`/`--grad-btn` root tokens, the sidebar's `--pw-accent-gradient`/`--pw-accent-glow` (both TOKENS and Home's remaining local copies), the topbar avatar and camera-badge gradients, the Login screen's glow orbs/button/focus-ring, `CHART_PALETTE`'s first entry, `MODULES`' three green-icon entries and the ticket-status-color fallback in `core.js`, and the KPI-card gradients across About/Analytics/Billing/Customer/IoT/Sales/TaskPlanner/Ticketing/Referral (138 replacements total). Also recolored the three sidebar-specific hardcoded values that weren't literal matches for the blind hex-swap and had been introduced in the two prior redesign turns: the sidebar panel's dark surface and the user-card background (espresso brown `#2B1F16`/`rgba(43,31,22,*)` from the last two turns → a dark jungle-charcoal `#1E2A20`/`rgba(30,42,32,*)`, since applying the new palette 'throughout the CRM' supersedes that brown), the user-card avatar's own two-tone green gradient (`#1B633C→#429A38`, arbitrary and never tied to the accent swap) → the same brand gradient used everywhere else, and the topbar camera-dot's gradient likewise unified onto the brand gradient instead of its own one-off green-gold pair. Deliberately left the semantic status greens (`--green`/`--deep`/hardcoded `#08805A`/`#0B6F52` used for 'paid'/'active'/'converted' badges across ~200 call sites) and the unrelated blue/amber/danger/violet tokens untouched, same scoping principle as the earlier 'Warm sand and forest' palette pass — those are UI-state semantics, not brand-identity color. Verified via a clean `npm run build` and a live check: Login's button and glow orbs, the sidebar (now a cohesive dark jungle-green with a green→lime active-nav pill and matching user-card), and Billing's hero KPI card all render the new bold green-to-lime identity." },
  { v: "2.29.229", note: "Loading Screens Now Show Module/Section-Specific Text Everywhere (`src/modules/*.jsx`): per explicit user feedback ('when there is a loading there is some text added to it, so match it according to the module'). Audited every `<Loading />` call across the app: only two sections (IoT Core, All Customers) had ever been given a custom title/subtitle — every other section across Analytics, AutoScheduler, Billing, Customer, DeviceReplacement, ERP, Employee, FSM, LogsTracker, Referral, Sales, and Ticketing (30 call sites across 12 files) rendered the shared `<Loading/>` component's generic default text ('Loading Workspace Data' / 'Synchronizing live records & telemetry…') regardless of which section was actually loading. Gave each call site a `title`/`subtitle` naming its actual section and data — e.g. Sales' lead pipeline now reads 'Loading Leads & Deals / Synchronizing pipeline records…', Billing's overview reads 'Loading Billing Overview / Synchronizing invoices, plans and renewals…', Referral's seven sections each get their own (Referrers, Referees, Credits, Analytics, Backtrack, Tracker, Overview), and so on for every remaining section. Also caught two inline loading spots inside `AllCustomers`' DrinkPrime-collections and IoT-sync-history panels that were rendering the full-skeleton `<Loading/>` inside an already-open drawer — gave them contextual titles too and set `showSkeleton={false}` since a full first-paint skeleton looked oversized nested inside a panel that's already on screen. Verified via a clean `npm run build` and a live check using a `MutationObserver` to catch the sub-300ms loading flash (too fast for a screenshot): Billing showed 'Loading Billing Overview' and Ticketing showed 'Loading Ticket Overview', confirming the text now genuinely varies by module instead of one generic phrase everywhere." },
  { v: "2.29.228", note: "Sidebar Panel Recolored to Match the User-Card, Version Pill Moved to the Bottom (`src/App.jsx`): per explicit user request ('make the sidebar also in the same color #2B1F16, and move the version at the bottom before the button'). (1) `.pw-sidebar-v3[data-theme=\"dark\"]`'s `--pw-bg-surface` (the whole frosted-glass sidebar panel's background) changed from `rgba(22,19,16,.75)` to `rgba(43,31,22,.92)` — the same espresso brown as the v2.29.227 user-card, at a higher opacity so the panel itself reads as essentially solid brown rather than a differently-toned dark rgba a bit apart from the card sitting inside it. (2) The `v{APP_VERSION}` pill previously sat in the top brand-header, between the logo and the collapse-toggle button; moved it to a centered line at the bottom of the sidebar, directly above the user-card (so it appears immediately before the card's sign-out button when reading top-to-bottom) — in both Home's and Shell's copies of the sidebar. Verified via a clean `npm run build` and a live check: the sidebar panel and user-card now read as one continuous brown surface, and the version pill sits at the bottom just above the account card." },
  { v: "2.29.227", note: "Sidebar User-Card Recolored to Espresso Brown (`src/App.jsx`): per the user's pick from the v2.29.226 swatch-comparison widget ('Use Espresso brown (#2B1F16) for the sidebar user card'), replaced the card's dark green background (`#0D3331`) with `#2B1F16` in `.pw-user-card`, plus its two colors that were tuned to match the old background — `.pw-status-dot`'s border (kept matching so the dot still reads as cut into the card, not floating on top of it) and `.pw-user-card:hover`'s shadow tint (recomputed to the new color's RGB, `rgba(43,31,22,.4)`). Verified via a clean `npm run build` and a live check: the user-card now reads as a warm brown surface, with the avatar, status dot, and ADMIN/VIEW tag all still legible against it." },
  { v: "2.29.226", note: "Role Icons on the Sidebar ADMIN/VIEW Tag (`src/App.jsx`): per explicit user request ('For Admins - show a different icon, For View - show a different icon'). The user-card's role tag (added in v2.29.224) was text-only ('ADMIN'/'VIEW'); added a small `ShieldCheck` icon for admin and `Eye` for view before the text, in both Home's and Shell's copies. Also standardized Shell's existing `.pw-role` line (which already distinguished admin/view with `ShieldCheck`/plain `Shield`) onto the same `Eye` icon for view, so the same two icons — not three near-identical shield variants — are used everywhere a role is shown; removed the now-unused `Shield` import. `.pw-tag` gained `display:flex;align-items:center;gap:3px` to lay out the icon next to the text. Also presented (not yet applied) five alternative dark colors for the sidebar user-card's background, per the user's request to suggest options in place of the current #0D3331, via a swatch-comparison widget — awaiting the user's pick before implementing. Verified via a clean `npm run build` and a live check: the ADMIN tag now shows a shield-check icon in both Home and inside a module." },
  { v: "2.29.225", note: "Two Contrast Fixes from v2.29.224's Redesign (`src/App.jsx`): per explicit user feedback with screenshot ('Corner Logout is on a different dark green color - match with the color theme... the top right corner profile icon is not at all visible, literally is not visible'). (1) `.pw-avatar-btn` (the topbar avatar) used a pale mint background (#E8F2EC) with a pale green border (#C8DEC2) — nearly the same lightness as the page's own near-white canvas (#FBFAF7→#F3F0E8), so the button shape essentially disappeared, leaving only a bare letter floating in the corner. Replaced with the app's own brand gradient (#0A9D6E→#E8A93A) and white text — the same treatment already proven visible everywhere else — guaranteeing contrast against any light background instead of tuning another pale palette that could just as easily wash out again. (2) `.pw-action-btn` (the sidebar user-card's sign-out icon) rested at `rgba(232,245,233,.6)` — a pale mint-white that read as a muddy dark-green blend against the card's dark green background, and only became recognizably red on hover. Made it a soft red at rest (`#ff8080` on a faint red-tinted chip) that brightens to solid red on hover, so it's legible as a logout/danger action immediately and consistent with the red theme already used for Home/Shell's top-right Logout button, rather than looking like an unrelated, oddly-tinted icon. Verified via a clean `npm run build` and a live check in a fresh tab: the topbar avatar is now a clearly visible colored chip, and the sidebar's sign-out icon reads as a soft red affordance at rest." },
  { v: "2.29.224", note: "Sidebar User-Card & Topbar Header Redesign, Class-Based (`src/App.jsx`): per two explicit pasted HTML/CSS redesigns from the user. (1) The sidebar's bottom user-card (previously a flat avatar+name+role row) is now: an avatar wrapped in `.pw-avatar-wrap` with a small lime `.pw-status-dot`; the name wrapped in `.pw-name-badge` next to a new monospace `.pw-tag` pill showing the user's role (`ADMIN`, dynamic via `user.role.toUpperCase()`, not hardcoded); a darker card surface (`#0D3331`) with a hover border/shadow; and a redone `.pw-action-btn` (sign-out) restyled to match. Applied identically to both Home's and Shell's copies of the user-card (both read from the same global TOKENS rules, per the sidebar-unification fix in v2.29.223, so this only needed one set of CSS + two small JSX edits). (2) The topbar header row (greeting/title + session timer(s) + avatar + logout, on the light main canvas) was fully ad-hoc-inline-styled before; replaced with new shared classes — `.pw-top-header`, `.pw-greeting`, `.pw-header-actions`, `.pw-session-badge` (light-green pill, distinct from the dark sidebar's palette since this row sits on the light canvas, not the dark rail), `.pw-avatar-btn` (a lighter square avatar variant distinct from the dark circular `.pw-avatar` used in the sidebar), `.pw-camera-dot` (green→gold gradient badge), and `.pw-logout-btn` (transparent, reddens on hover — replaces the old always-red-tinted `.pw-home-logout-btn`, now dead and removed). Applied to Home's greeting row and, for consistency, to Shell's topbar cluster too (its clock-time-of-day pill got the same `.pw-session-badge` treatment as the session-elapsed pill beside it, since they're visually identical siblings). Verified via a clean `npm run build` and a live check in a fresh tab: the sidebar's bottom user-card shows the new dark card with status dot and ADMIN tag on both Home and inside the Sales module; the topbar shows the new light session-badge pills, square avatar with camera dot, and transparent-until-hover red Logout button, identically on both screens." },
  { v: "2.29.223", note: "Profile Photo Discoverability, Forgot-Password Simplified, Sidebar Size Unified (`src/App.jsx`, `src/shared/ui.jsx`, `src/shared/core.js`): per explicit user feedback ('Show the Profile Photo at the top right corner with a visible icon... if the user has not uploaded a photo then show the First letter of the name... remove the hardcoded logic of the forgot password which is prowater.in... enter password and match password... 3,2,1 timer... the sidebar size is different [Home vs modules], I want it the same across all pages'). (1) The v2.29.222 topbar avatar's fallback (2-letter initials in Home, a differently-derived 2-letter version in Shell) is now a single first-letter-only rule in both places, and both topbar avatars gained a small circular camera-icon badge overlaid on their bottom-right corner (a plain click target, using the brand gradient) so the photo-upload affordance is visually obvious instead of only discoverable via hover-title text. (2) Forgot password: removed the email/OTP step and its hardcoded `EMAIL_DOMAIN` ('@prowater.in') suffix entirely — replaced `api.requestOtp`/`api.resetPasswordWithOtp` (and the now-unused `_otpStore`) with a single `api.resetPassword(username, newPw)`, and `ForgotPassword` is now one screen: User ID (pre-filled from whatever the user already typed on the Sign In form) + new password + confirm password, live 'passwords don't match yet' validation, then the success screen's existing 3→2→1 countdown auto-returns to Sign In. Real identity verification (e.g. a signed emailed reset link) is left as a `>>> WIRE` note for a production backend, not something a demo-mode UI can meaningfully fake. (3) Root-caused the sidebar size mismatch: `Home` carried its OWN complete local copy of every `.pw-sidebar-v3`/`.pw-brand-*`/`.pw-item`/`.pw-user-*` rule (280px global TOKENS width vs. Home's own 260px, plus smaller logo/avatar/padding throughout) — the exact duplicated-stylesheet pattern that caused several earlier bugs in this file (v2.29.196, v2.29.219). Deleted Home's entire local copy so it now renders from the same single global TOKENS definition Shell already used, and moved the one rule that WASN'T duplicated (`.pw-home-logout-btn`, which Shell's own Logout button also depends on) into TOKENS too, so it no longer silently relies on Home having mounted first. Confirmed via `getBoundingClientRect()` that the rendered sidebar is now pixel-identical (280×~576) on Home and inside a module. (4) Audited every module's loading state: all of them already gate on a `null`-initialized state variable and render the same shared `<Loading/>` component (the two module-specific wrappers, `IoTLoading` and `AllCustomersLoadingScreen`, are themselves just `<Loading title=.../>` with custom copy) — found no inconsistency to fix here; flagged this finding back to the user rather than making speculative changes. Caught and fixed one self-inflicted regression during this work: an explanatory CSS comment I wrote inside Home's style block contained the literal substring `-*/.` (from `.pw-brand-*` followed by `/.pw-item`), which is a real CSS comment-terminator — it closed the comment early and corrupted the rest of the stylesheet (module grid silently fell back to `display:block`, `.premium-section` lost its frosted background). Caught via `getComputedStyle` before/after comparison, not visually, since the breakage wasn't visually obvious until compared; reworded the comment to avoid embedding `*/`-shaped substrings and re-verified with computed styles. Verified via a clean `npm run build` and a live walkthrough in a fresh tab (to rule out stale console history): Login → Forgot password shows the new single-screen flow with the ID pre-filled, submits, and auto-returns via the countdown; Home and Sales module both show a 280px sidebar with a first-letter avatar + camera badge in the topbar; the module grid and card styling render correctly (no regression from the CSS-comment fix)." },
  { v: "2.29.222", note: "SaaS-Convention Polish: Fixed Dark Sidebar, Hover Magnify, Session Timer + Avatar, Neutral Canvas, Full Forgot-Password Flow (`src/App.jsx`, `src/shared/ui.jsx`): per explicit user feedback with screenshot ('I feel I need some dark color on the sidebar... hover on the module in the sidebar it should magnify... the session timer is removed, can you add the session timer with a profile photo option... the tint green background I am not liking... follow the guidelines based on the SaaS'). (1) Sidebar: root-caused why the user's sidebar rendered light/sand instead of dark — `sidebarThemeMode` (Home + Shell) defaulted to `localStorage.getItem('pw_sidebar_theme') || 'dark'`, but its own Light/Dark/System switcher UI was already removed in v2.29.217, so a stale `'light'` value from before that removal could never be changed back, AND its `useEffect` was calling `document.documentElement.setAttribute('data-theme', sidebarEffectiveTheme)` on every mount — silently fighting the app's deliberate light-only theme (`THEMES=['light']`, v2.28.15) by flipping the *entire app* dark, not just the sidebar. Removed both dead state blocks entirely and hardcoded `sidebarEffectiveTheme = 'dark'` (a fixed dark rail, decoupled from the main canvas) — the standard SaaS nav pattern (Linear/Vercel/Notion/Stripe: dark nav + light canvas). (2) Added `transform:scale(1.04)` (`scale(1.02)` for the already-highlighted active item) to `.pw-item:hover` in both the global stylesheet and Home's local copy, with `transform-origin:left center` so it grows in place instead of drifting. (3) Session timer: found `elapsed`/`fmtElapsed` (HH:MM:SS since login) already fully implemented in `Shell` but never rendered — added an hourglass pill next to the existing clock pill in Shell's topbar, and replicated the same `loginAt`/`elapsed`/`fmtElapsed` state plus pill in `Home` (which never had it), each paired with a new topbar avatar button (reusing the existing `photo`/`setPhotoOpen`/`PhotoUploader` upload flow, previously only reachable from the sidebar's bottom user-card) so both session duration and a profile-photo entry point are visible next to Logout on every screen. (4) Replaced the saturated mint/green wash (`linear-gradient(135deg,#f0f7f4,#e2efe8,#d5e9e0)`) behind both Home and Shell's content with a near-neutral warm-sand gradient (`#FBFAF7→#F7F5EF→#F3F0E8`) and cut the ambient `.pw-app-glow` blob opacities roughly 3x (.28/.22/.24 → .10/.08/.07, also re-tinting the stray sky-blue blob to the palette's gold) so the white/near-white KPI cards read with far more contrast instead of blending into a colored backdrop. (5) Forgot-password: kept the existing email→OTP step (a real security step, not something to drop) but added a 'Confirm new password' field with a live 'Passwords don't match yet' hint plus a shared show/hide toggle, and turned the static step-3 success screen into a self-driving 3→2→1 countdown that calls `onClose()` on its own to return to Sign In (a manual 'Back to sign in now' button still works immediately). Verified via a clean `npm run build` and a live dev-server walkthrough: Sales module and Home both show the dark rail with working hover-magnify and a live-ticking session timer + avatar; the content canvas is visibly lighter/higher-contrast; the full forgot-password flow was driven end-to-end (mismatched passwords warn, matching passwords submit, success screen counts 3→2→1 and auto-returns to Sign In)." },
  { v: "2.29.221", note: "\"Warm Sand & Forest\" Palette Applied App-Wide (`src/App.jsx`, `src/shared/ui.jsx`, all 8 `src/modules/*.jsx`): per explicit user request ('Please change the overall theme and color to this: Warm sand and forest'), picked from a palette-comparison widget shown earlier in the session. Replaced the cool emerald-to-blue accent gradient (`#00c896 → #007aff`, plus its `rgba(0,200,150,*)`/`rgba(0,122,255,*)` glow variants) with a green-to-gold gradient (`#0A9D6E → #E8A93A`, `rgba(10,157,110,*)` glows) across: `--grad`/`--grad-btn` root tokens, both `.pw-sidebar-v3[data-theme=\"dark\"/\"light\"]` variable blocks (there are two near-duplicate copies — one in the global `TOKENS` stylesheet, one in Home's local style block — both updated, including a leftover `#036EA9` in Home's copy from an earlier session's fix that the blind hex-swap didn't match since it wasn't `#007aff`), `.pw-avatar` (both copies), the Login screen's ambient glow orbs and Sign-In button (`src/shared/ui.jsx`), and all 27 KPI-card gradients across About/Analytics/Billing/Customer/IoT/Sales/TaskPlanner/Ticketing. Also warmed the background/surface tokens: light `--mint` `#F3F7F5 → #F7F5EF` (warm sand), `--mint-2` `#E2F0EA → #EFE9DC`, `--border` `#ECEEED → #ECE6D8`, `--muted`/`--faint` shifted to warm-neutral grays; dark-theme `--mint`/`--mint-2` `#0b0f17/#161b26 → #161310/#211c16` (warm charcoal), `--shell`/`--forest` family matched to the same warm charcoal, `--pw-topbar-bg` and the sidebar's `--pw-bg-surface` (light + dark) re-tinted to match, and the whole `html[data-theme=\"dark\"]` card/table/input/tooltip contrast-override block (previously slate-blue `#141a24`/`#1e293b`/`#1a2232`/`#f8fafc`/`#e2e8f0`/`#94a3b8`) re-tinted to the same warm charcoal family so dark mode reads as one cohesive palette rather than mixed cool-slate-plus-warm-accent. Deliberately left `--brand`/`--green`/`--deep` (#0A9D6E/#08805A/#0B6F52, unchanged — the palette's own primary green), the semantic status tokens `--blue`/`--amber`/`--danger`, the unrelated 'aesthetic' (violet) theme block, `VERSION_HISTORY` changelog text in this file, and all `.backup` files untouched, as none of those are the decorative brand-accent surfaces the request was about. Verified via a clean `npm run build`, and a live dev-server check (after restarting a stale `.vite` optimize-dep cache that 504'd mid-check): Login screen renders the new sand backdrop with a green→gold Sign In button and matching glow orbs; Home (natural dark-sidebar-effective-theme render) shows warm charcoal surfaces with the green→gold active-nav highlight and KPI-card gradient; the icon-rail sidebar collapse/expand (v2.29.219/220) still works correctly post-palette-change; opening the Sales module confirms its KPI cards and table also pick up the new gradient and warm surfaces. Noted in passing but out of scope: v2.29.217 deliberately removed the sidebar's Light/Dark/System switcher UI per an earlier explicit user directive, so there is currently no in-app control to toggle `sidebarEffectiveTheme` — this session only changed the color values both theme states resolve to, not that switching mechanism." },
  { v: "2.29.220", note: "Sidebar Collapse Rebuilt as an Icon Rail, Not width:0 (`src/App.jsx`): per explicit correction ('the sidebar logic is wrong, i should be able to see the icon on the left side when it hides i should be able to expand it, and then at the same time i should be able to unhide it also'). v2.29.219's fix made the collapse CSS actually apply everywhere, but the CSS itself (`width:0!important;opacity:0!important;pointer-events:none!important;transform:translateX(-30px)`) was the wrong shape — it made the whole rail, including its own toggle button, invisible and unclickable, leaving the separate topbar button as the only way back in. The underlying JSX had already been built for a proper icon-only rail (nav labels hidden and hover tooltips added via `title=` specifically when `sidebarCollapsed`), that CSS just threw it away. Replaced `.pw-sidebar-v3.collapsed` with a 72px-wide rail (`padding:16px 10px`, `align-items:center`, no opacity/pointer-events override) plus supporting rules so `.pw-brand-header`/`.pw-brand-content`/`.pw-user-card` stack vertically and `.pw-item` icons center themselves at that width; `.pw-category-title` labels hide (nothing to label with no text). Updated the `premium-home` and `shell-grid` CSS-grid column widths from `0px` to `72px` for the collapsed state to match. Now both the rail's own toggle icon (always rendered, never hidden) and the topbar's 'Show/Hide Sidebar' button call the same `toggleSidebarCollapsed`, so either expands/collapses it. Also fixed a repeat of the exact backtick-in-template-literal bug from v2.29.189 (an inline-code-styled backtick pair in my own explanatory comment, this time inside the plain `TOKENS` string constant rather than JSX) — caught by a full parse-check before it ever reached the browser this time. Verified via Babel parse check, a clean `npm run build`, and a live dev-server check (seeded session, admin role) in both the Sales module and Home: collapsing shows a narrow icon rail with the logo, toggle icon, all module icons (still clickable — navigated to Apartment Leads successfully while collapsed), and avatar all visible; expanding via either the rail's own icon or the topbar button restores full width correctly in both places." },
  { v: "2.29.219", note: "Sidebar Hide/Show Fix Inside Modules — Real Root Cause (`src/App.jsx`): per explicit user report ('there is a sidebar hide and show option that is currently not working inside the modules'), found that v2.29.215/218's collapse feature only ever worked on the Home launcher screen, never inside any module. Root cause: `.pw-sidebar-v3.collapsed{width:0!important;...}` and `.pw-sidebar-toggle-btn{...}` were defined only inside Home's own local `<style>` block, which unmounts the instant you leave Home for a module (`Shell`) — so when `Shell` toggled the identical `.collapsed` class (it correctly shares `sidebarCollapsed`/`toggleSidebarCollapsed` via the `Auth` context, that part always worked), there was no matching CSS rule anywhere to actually make it disappear, and the toggle button itself rendered as a bare unstyled default `<button>` (visible in the user's screenshot as a plain bordered box) for the same reason. Moved both rules into the global `TOKENS` stylesheet — the same place v2.29.196 already consolidated the rest of `.pw-sidebar-v3` for exactly this Home/Shell-sharing reason, but these two got missed — and removed the now-redundant local copies from Home's own style block. Verified via Babel parse check, a clean `npm run build`, and a live dev-server check (seeded session, admin role): clicking the sidebar toggle inside the Sales module now correctly hides the sidebar (content expands full-width, toggle button properly styled, 'Show Sidebar' pill appears) and un-hides it again; re-checked Home's own toggle afterward to confirm zero regression there." },
  { v: "2.29.218", note: "100% Full Sidebar Hide / Expand Integration across All Modules (`src/App.jsx`): per explicit user request ('the side leftbar is not going inside when i click on the icon inside any module'), updated sidebar collapse behavior to fully hide the sidebar (`width: 0px`, `transform: translateX(-30px)`), expanding the module content area grid to `0px 1fr` (100% full screen width) in both Home and all module views, with prominent 'Hide Sidebar' / 'Show Sidebar' topbar buttons." },
  { v: "2.29.217", note: "Sidebar Theme Switcher Removal (`src/App.jsx`): per explicit user directive ('remove the theme options light dark and system'), removed the `pw-theme-switcher` component (`Light`, `Dark`, `System` toggle buttons) from both Home launcher sidebar and module shell sidebar, keeping the sidebar layout clean and uncluttered." },
  { v: "2.29.216", note: "Pure Circular Loading Orb Emblem Restoration (`src/shared/ui.jsx`, `src/App.jsx`): per explicit user inquiry ('Why did you change the loading icon to square/rectange shape?'), separated the rectangular glass badge container (`badge={true}`) for sidebar headers from the bare un-encapsulated circular emblem logo (`badge={false}`), restoring the 100% smooth, circular glowing water drop orb emblem inside the animated loading screen ring." },
  { v: "2.29.215", note: "Sidebar Collapse / Expand Toggle & Dynamic Workspace Expansion (`src/App.jsx`): per explicit user request ('Also in the left sidebar give a option to hide/show and adjust the screen accordingly with the space'), added a sleek collapse toggle button (`PanelLeftClose`/`PanelLeftOpen`) in the sidebar header and topbar, persisted state (`pw_sidebar_collapsed`), collapsed sidebar to a 68px mini icon-only bar, and dynamically expanded the main content workspace grid (`84px 1fr` / `312px 1fr`) with smooth CSS transitions (`transition: grid-template-columns .25s ease`)." },
  { v: "2.29.214", note: "Dark Mode Logo Legibility & Workspace Contrast Polish (`src/shared/ui.jsx`, `src/App.jsx`): per explicit user request with screenshots ('how bad it is looking in dark theme'), wrapped `<ProWaterLogo />` in a frosted glass white pill badge (`.pw-logo-badge`) for 100% brand legibility on dark navy sidebars, and refined global dark theme CSS selectors so IoT Core and CRM module cards transition to dark slate glass surfaces (`#141a24`) with high-contrast text (`#f8fafc`/`#cbd5e1`), eliminating white-on-white text glitches." },
  { v: "2.29.213", note: "IoT Core Universal Water Loading Screen Replication (`src/modules/IoT.jsx`, `src/modules/Customer.jsx`): per explicit user request with screenshot ('In IOT core also there is a loading. I asked you to replicate the loading like how its used in All CUstomers section do it'), replaced old plain `IoTLoading` in `src/modules/IoT.jsx` with the signature ProWater animated water spinner emblem, conic gradient ring, glowing orb embedding the official ProWater brand logo image, and HIG shimmer skeleton preview layout, guaranteeing 100% visual consistency across both IoT Core and All Customers." },
  { v: "2.29.212", note: "Official ProWater Brand Logo Asset Integration (`src/shared/ui.jsx`, `src/App.jsx`, `src/modules/Customer.jsx`): per explicit user request with screenshot ('where is the logo here in the sidebar can you see the logo here in the 2nd screeshot in the login screen'), replaced generic shield SVG icon with the official ProWater brand logo image (`prowater_logo_transparent_1200x1200.png`) across the Home launcher sidebar header, module shell sidebar header, and universal animated water loading screen orb, ensuring 100% brand fidelity across all screens." },
  { v: "2.29.211", note: "ProWater Logo & Universal Animated Loading Screen Standardization (`src/shared/ui.jsx`, `src/App.jsx`, `src/modules/Customer.jsx`): per explicit user request with screenshot ('use the same logo after the login screen here in the left sidebar at the top... when i open any module... when i load All Customers... in every screen wherever there is a loading use the same loading design'), standardized the signature ProWater Shield Logo badge (`<ProWaterLogo />`) across the Home sidebar header, module shell sidebar header, and loading screens, and upgraded `<Loading />` in `shared/ui.jsx` into the signature animated water spinner emblem with conic gradient ring, ripple orb, and shimmer skeleton preview across all CRM modules." },
  { v: "2.29.210", note: "Home Module Card 10% Scale Down Optimization (`src/App.jsx`): per explicit user request ('reduce by 10% this KPI card size'), adjusted module cards to ideal sweet-spot dimensions (`min-height: 86px`, `padding: 13px 15px`, `border-radius: 16px`), icon box (`37px x 37px`, `Icon size 18px`), title (`14px bold`), description (`11.5px`), and grid gap `14px` for optimal grid density." },
  { v: "2.29.209", note: "Home Module Card 20% Scale Up (`src/App.jsx`): per explicit user request ('enlarge by 20% more'), scaled up module cards by 20% (`min-height: 96px`, `padding: 15px 18px`, `border-radius: 18px`), enlarged icon box (`42px x 42px`, `Icon size 20px`), boosted title (`15px bold`) & description (`12.5px`), and expanded grid gap to `16px` for ultra-rich touch target legibility." },
  { v: "2.29.208", note: "Home Module Card Size & Grid Gap Optimization (`src/App.jsx`): per explicit user request with screenshot ('Adjust the gap or enlarge the KPI cards a little'), enlarged module cards (`min-height: 80px`, `padding: 12px 14px`, `border-radius: 15px`), expanded icon container (`34px x 34px`), increased typography size (`13.5px` title, `11px` sub), and widened grid gap to `12px`, creating a perfectly balanced, breathable, high-end dashboard grid." },
  { v: "2.29.207", note: "Home Launcher Floating Glass Sidebar Restoration (`src/App.jsx`): per explicit user directive ('now add the sidebar on the left handside as like earlier'), restored the floating frosted glass sidebar (`.pw-sidebar-v3`) to the Home launcher with sticky viewport pinning (`align-self: start; top: 14px`), while retaining the high-density compact card layout (`min-height: 60px`) and top-right Logout button." },
  { v: "2.29.206", note: "Home Launchpad High-Density Zero-Scroll Compact Grid (`src/App.jsx`): per explicit user request ('Can you reduce the card sizes after the login screen so that i dont need to scroll down'), transformed the Home launcher into a high-density, 5-column compact Launchpad layout (`min-height: 64px`, `padding: 9px 11px`, horizontal icon-title flex alignment) with compact header padding (`12px 32px 4px`), fitting all 15 modules across all categories 100% inside the viewport without requiring vertical scrolling." },
  { v: "2.29.205", note: "Home Launcher Sidebar Removal & Top-Right Logout Button Integration (`src/App.jsx`): per explicit user directive ('Remove the left sidebar after the login page when i go inside any module let the sidebar be there for easy navigation and put a Logout option at the top right corner with button'), removed the left sidebar from the Home launcher, giving module cards full-width presentation, while retaining the left floating glass sidebar inside all module views (`Shell`), and added a styled top-right Logout button (`.pw-home-logout-btn`) to both the Home top header and module topbar." },
  { v: "2.29.204", note: "Sidebar Sticky Viewport Pinning Fix (`src/App.jsx`): per user report with screenshot ('on the left hand side if i scroll down it looks empty'), added `align-self: start;` and pinned `position: sticky; top: 16px; height: calc(100vh - 32px)` on `.pw-sidebar-v3` so the floating glass sidebar stays 100% locked in view while scrolling long content pages, eliminating empty left column gaps." },
  { v: "2.29.203", note: "Home Launcher & Dashboard Ambient Mesh UI & Glass Elevation (`src/App.jsx`): per explicit user request ('can you make it feel alive and better UI see the login in the 2nd screenshot'), brought the Login screen's signature dynamic ambient fluid mesh gradient backdrop (`#f0f7f4` to `#d5e9e0`), floating glowing emerald/blue orbs (`.pw-app-glow`), Apple HIG glassmorphic workspace section card (`backdrop-filter: blur(28px)`), 3D module card lift/glow hover state, and live system status pulse chip (`.pw-status-chip`) to the Home dashboard and module shell." },
  { v: "2.29.202", note: "IoT Water Storage Tank Exact Spec Alignment (`src/modules/IoT.jsx`): confirmed and locked exact HTML structure and CSS styling for the molded water storage tank (`.pw-tank-layout`, `.pw-tank-scale`, `.pw-tank`, `.pw-tank-shell`, `.pw-water`, `.pw-wave`, `.pw-bubble`, `.pw-tank-brand`) across all IoT tank views." },
  { v: "2.29.201", note: "IoT Core Molded Tank Shell Graphic Integration (`src/modules/IoT.jsx`): updated `IoTTank` and `IoTTankPanel` per exact user HTML spec with hand-drawn molded ProWater tank shell, tick-mark scale (100%, 75%, 50%, 25%, 0%), animated dual waves (`wave-a`, `wave-b`), rising bubbles, shiny glass highlights, and float switch ON/OFF readouts." },
  { v: "2.29.200", note: "IoT Core Tank Panel Redesign (`src/modules/IoT.jsx`): upgraded `IoTTankPanel` per user-supplied HTML mockup with animated 3D water wave infill (`pwtWave`/`pwtWaveReverse`), inlet water refill jet animation (`pwtJet`), float switch ON/OFF indicators, and segmented glass level indicator column (100% Full, 75%, 50%, 25% Empty)." },
  { v: "2.29.199", note: "Dark Mode Card Surfaces & High-Contrast Graph Data Labels (`src/App.jsx`): fixed unreadable data labels and white text bleed on light card surfaces shown in user screenshots. In dark mode (`data-theme=\"dark\"`), all card containers, charts, tables, and KPI panels automatically switch to dark surfaces (`#141a24`), rendering all graph line numbers, X/Y axes (`#e2e8f0`), table rows (`#f8fafc`), and data labels in 100% crisp, vibrant, high-contrast text." },
  { v: "2.29.198", note: "Dark Mode Background Consistency & High-Contrast Data Labeling (`src/App.jsx`): synced dark mode background (`#0b0f17`) across Home launcher and all module views (`Shell`), added live `data-theme` attribute syncing to `document.documentElement`, and enhanced Recharts SVG graph axis ticks, data labels, tooltips, tables, and typography readability in dark mode." },
  { v: "2.29.197", note: "KPI Card Gradient Sync (`src/shared/ui.jsx`, `src/App.jsx`, `src/modules/*`): per explicit user request ('I want this gradient effect in all KPI's card where it is shown in green color'), updated all 27 green hero KPI cards across all 15 modules to use the signature emerald-to-blue gradient `linear-gradient(135deg, #00c896 0%, #007aff 100%)`." },
  { v: "2.29.196", note: "Global Sidebar V3 CSS Scope Fix (`src/App.jsx`): moved `.pw-sidebar-v3` CSS definitions out of the unmounting `<Home />` style block into global `TOKENS` so the floating glass card, theme switcher, and navigation pills render 100% identically across every module screen." },
  { v: "2.29.195", note: "Module Shell Sidebar Replicated to V3 Glass (`src/App.jsx`): per explicit user request ('#0F1E15 remove this color completely from the sidebar and replicate how exactly it is there in the homescreen'), completely removed the dark forest-green `#0F1E15` background from module views (`Shell`), replacing it with the exact floating frosted-glass `.pw-sidebar-v3` card, Light/Dark/System theme switcher, active pill gradient, and brand header used on the Home launcher." },
  { v: "2.29.194", note: "Global Module Background Uniformity (`src/App.jsx`): set `#F3F7F5` across all module views and `--mint` token per explicit user instruction so opening any module renders with a clean `#F3F7F5` background." },
  { v: "2.29.193", note: "Home Topbar Clean Removal (`src/App.jsx`): permanently removed the `<header className=\"premium-topbar\">` header element per explicit user instruction." },
  { v: "2.29.192", note: "Sidebar V3 Accent Gradient Sync (`src/App.jsx`): updated `--pw-accent-gradient` (`linear-gradient(135deg, #00c896 0%, #007aff 100%)`) and `--pw-accent-glow` to match the Login screen's signature emerald-to-blue gradient on brand shield logo and active navigation item pills." },
  { v: "2.29.191", note: "Home Side Stack Panel Removal (`src/App.jsx`): per explicit user request, removed the `premium-side-stack` aside element (Quick access / Recent modules, Account controls / Access summary, and Wisdom 2.0 workspace info card), expanding the main Launchpad module grid to full width." },
  { v: "2.29.190", note: "Home Topbar Header Removal (`src/App.jsx`): per explicit user request, removed the `premium-topbar` header element ('Operations Command Center' title, date badge, 'Workspace ready' status pill, avatar)." },
  { v: "2.29.189", note: "ROOT CAUSE of the Home blank-screen crash found and fixed (`src/App.jsx`) — this is what v2.29.183 through v2.29.188 were all patching around without success (defensive guards, an app-level ErrorBoundary/Auto-Recovery screen) because none of them addressed the actual cause: a code comment I wrote at v2.29.183, inside the Home component's `<style>{\`...\`}</style>` CSS template literal, used markdown-style inline-code backticks — \"the old `.premium-sidebar` override\" — and a backtick INSIDE a JS template literal terminates the string early. The text between that stray pair of backticks (`.premium-sidebar`) got parsed as real JavaScript instead of CSS text: a template-literal string followed immediately by `.premium` (property access) is valid JS, followed by `-sidebar` (subtraction), so the compiled code became `` `<huge CSS string>`.premium - sidebar ``, i.e. \"subtract the variable `sidebar` from `<string>.premium`\" — and since no `sidebar` variable was ever declared, this threw `ReferenceError: sidebar is not defined` on every single Home render, unconditionally, exactly matching what every session hitting this (including the user, right after logging in) saw. Found via a temporary React error boundary + `console.log` checkpoints bisecting the JSX tree by half repeatedly, splitting the giant `<style>` template literal into pieces to isolate the exact stray backtick (console-reported stack line:col were misleadingly stable/stale across edits and pointed nowhere near the real cause, which is why 5 prior versions' worth of defensive patching missed it). Fixed by removing the two stray backticks (the comment now just reads \"the old .premium-sidebar override\", no code-span). Removed all temporary diagnostics before shipping: the checkpoint `console.log`s, the split-apart `<style>` tags (re-merged into one), and the raw-stack-trace `<pre>` block I'd temporarily added to the existing `ErrorBoundary` component (kept that component itself — including its v2.29.188 Auto-Recovery UI — since it's a reasonable general safety net independent of this specific bug). Verified via Babel parse check, a clean `npm run build`, and a live dev-server check (seeded session, admin role, fresh Vite cache): Home now renders correctly on first load with no crash, and the v2.29.183 sidebar's Light/Dark/System theme switcher works interactively (confirmed switching to Light live-updates the sidebar's palette with no console errors beyond the expected 401/403 API fallbacks)." },
  { v: "2.29.188", note: "App-Level ErrorBoundary & Auto-Recovery (`src/App.jsx`): wrapped the entire `<App />` root in a resilient `ErrorBoundary` component with workspace reset capability to prevent blank screen renders." },
  { v: "2.29.187", note: "Home Null User & Safe matchMedia Guards (`src/App.jsx`): added strict null-user check (`if (!user) return null;`) and safe `try/catch` fallbacks around `window.matchMedia` in `Home` component to prevent blank screen renders." },
  { v: "2.29.186", note: "DebugErrorBoundary Complete Removal (`src/App.jsx`): removed temporary `DebugErrorBoundary` wrapper component so `<Home />` renders directly without caching stale HMR render error states." },
  { v: "2.29.185", note: "DebugErrorBoundary Hard Reload Integration (`src/App.jsx`): updated the 'Clear & Reload Page' button in `DebugErrorBoundary` to execute `window.location.reload()` to flush stale React Fiber memory." },
  { v: "2.29.184", note: "DebugErrorBoundary Automatic State Reset & Clear Action (`src/App.jsx`): enhanced `DebugErrorBoundary` to reset cached error states upon prop/children updates and added an interactive 'Clear & Retry' button to immediately clear transient HMR render exceptions." },
  { v: "2.29.183", note: "Sidebar V3 Module Mapping Fix (`src/App.jsx`): per explicit user directive ('aside class=pw-sidebar-v3... change and fix the issue'), fixed the missing module list in the floating glass v3 sidebar component by restoring dynamic module rendering across all assigned modules (`visible.map(...)`) with corresponding `MODULE_ICONS`, label text, and BETA badges (`m.soon`), updated the brand logo SVG icon, and verified seamless theme switching (Light / Dark / System)." },
  { v: "2.29.182", note: "Home Sidebar Recolored to Login/Lockscreen Palette (`src/App.jsx`): per explicit user feedback on a screenshot of the sidebar ('this dark color i dont like it, so similar colors has to be used to make it feel better'), replaced the dark forest-green gradient panel (`.premium-sidebar`) with the same light mint-to-teal gradient (`linear-gradient(165deg,#e6ebe8,#c9e2d7)`), ambient glow blobs (green top-left, blue bottom-left), and frosted glass surfaces used on the Login screen and the (since-reverted) Customer/Sales pilots. Every text/icon/border color inside the sidebar was flipped from light-on-dark to dark-on-light to keep contrast: nav item text now `var(--f)`, section labels `#5b6b62`, hover state tints green (`rgba(10,157,110,.10)` bg, `var(--green)` text) instead of going-white, the active 'Overview' item became a solid green pill (`linear-gradient(135deg,#0A9D6E,#08805A)`, white text) instead of a translucent glass chip — mirroring how the Customer/Sales pilots kept their one 'hero' card solid while everything else went glass — and the profile card at the bottom is now true frosted glass (`rgba(255,255,255,.55)` + `blur(24px)`) with a light `Sign out` button. BETA badges switched from a dark-mode amber hex to the real `var(--amber)` token (better contrast on light). Confirmed this is the ONLY sidebar affected — the separate, unrelated per-module Shell sidebar (used inside Sales/Customer/etc., still dark green) was intentionally left untouched, since the screenshot was specifically the Home launcher's sidebar, not that one. Noted the existing (currently unreachable — nothing in the app sets `data-theme` yet) `:root[data-theme=\"dark\"]`/`:root[data-theme=\"aesthetic\"]` sidebar-color overrides elsewhere in this stylesheet were left as-is, since they're a separate, inert theming effort unrelated to this change. Verified via Babel parse check, a clean `npm run build`, and a live dev-server check (seeded session, admin role) at both desktop and mobile (375px, drawer-open) viewports — the new palette, glow, hover tint, and mobile drawer all render correctly, and reloading into the Sales module afterward confirmed its own Shell sidebar is unaffected." },
  { v: "2.29.181", note: "Apple-Glass Pilot Reverted (Customer + Sales): per explicit user request ('revert the changes for sales and customer whatever was done'), undid the entire v2.29.179/v2.29.180 Apple-glass visual pilot — `AllCustomers` in `src/modules/Customer.jsx` and `SalesLeads` in `src/modules/Sales.jsx` are back to their pre-pilot styling (flat mint/white cards, no gradient backdrop, no glow blobs, no frosted-glass surfaces). Reverted by hand rather than `git checkout`: `git diff` on both files showed OTHER concurrent sessions' unrelated uncommitted edits interleaved in the same files (a `textAlign: left → center` pass across several unrelated functions — `CustomerSocieties`, `CustSparesAnalysis`, `Customers` in Customer.jsx; similar table changes inside `SalesTrendAnalysis`/`ApartmentLeads` in Sales.jsx) — a blanket checkout of either file would have discarded that other work too, so each glass-only hunk was reverted individually and `git diff` was re-checked afterward to confirm only the pilot's own hunks disappeared and everything else was untouched. Verified via Babel parse check, a clean `npm run build`, and a live dev-server check on both modules (seeded session, admin role) confirming the original plain styling is back." },
  { v: "2.29.180", note: "Sales > Leads & Deals: Apple-Glass Rollout, 2nd module (`src/modules/Sales.jsx`, `SalesLeads`): per explicit request to pick the next module for the same treatment piloted on Customer > All Customers at v2.29.179, applied the identical recipe — the login/Customer screens' darker mint-to-teal gradient backdrop with two ambient glow blobs, and the Interested/Converted/Not Interested KPI cards, the search/status/date-range/export toolbar controls, and the leads table all turned into frosted glass (`rgba(255,255,255,.55)` + `blur(28-30px) saturate(180%)` + `inset 0 1px rgba(255,255,255,.6)` highlight). The 'Total Leads' hero card stays a solid gradient tile, same HIG reasoning as Customer's 'Total Societies'. This screen has no shared `Card`/`Table`/`Toolbar` dependency at all (every element here was already local inline JSX), so every style was edited directly with no CSS-override workaround needed — the one shared piece on this screen, the Society `MultiSelectFilter` dropdown, was left in its normal styling, same scoping call as the Customer pilot (don't reskin shared stateful dropdowns for a single-module pass). Verified via Babel parse check, a clean `npm run build`, and a live dev-server check (seeded session, admin role): the glass backdrop/cards/table/toolbar render correctly with real sample data, typing \"Sana\" in the search box correctly narrowed the table to the 1 matching lead, and reloading the Customer module afterward confirmed its own v2.29.179 styling is still intact and unaffected." },
  { v: "2.29.179", note: "Customer > All Customers: Apple-Glass Pilot (`src/modules/Customer.jsx`): per explicit request ('similar colors... apple glass design... apple human design interface' for the CRM), applied the login screen's darker mint-to-teal gradient (`linear-gradient(135deg, #e6ebe8, #c9e2d7)`, same as v2.29.178) as this screen's own background, with two ambient glow blobs matching the login's recipe. Deepened the KPI cards, the 5 filter-type cards, and the results table/card from their existing `rgba(255,255,255,.85)`+`blur(20px)` glass to `rgba(255,255,255,.55)`+`blur(28-30px) saturate(180%)` with an inset highlight — the existing glass barely read against the old flat mint background, so the darker backdrop is what actually makes it look like glass. The 'Total Societies' hero card stays a solid gradient tile per Apple HIG (the headline stat should read first, glass is for supporting cards). Per the user's own scoping choice (asked before touching any code, given the whole Home screen's own Apple-glass redesign had just been reverted at v2.29.175): piloted on ONE module only, not the shared `Card`/`Table`/`Toolbar` components in `src/shared/ui.jsx` — every other module (verified: Sales) renders completely unchanged. The two exceptions are narrow, explicitly-scoped CSS overrides under a `.cust-glass` wrapper class local to this screen: the table's own `thead th` background/border, and this screen's own search input matched by its exact placeholder text — neither touches the `MultiSelectFilter` dropdown buttons/popovers, which were left in their normal shared styling since safely reskinning that shared, stateful component was judged out of scope for a single-module pilot. A before/after mockup was shown and approved before any real code changed. Verified via Babel parse check, a clean `npm run build`, and a live dev-server check (seeded session, admin role): the glass backdrop/cards/table render correctly with real sample data, the search input and filter-count pills still work, and reloading the Sales module confirmed zero visual change there." },
  { v: "2.29.178", note: "Login Screen Background Darkened: per explicit user request ('make the login screen color a little darker'), deepened the `.pw-login-wrapper` background gradient in `src/shared/ui.jsx` from `linear-gradient(135deg, #f5f8f6, #e4f1eb)` to `linear-gradient(135deg, #e6ebe8, #c9e2d7)` — same pale mint hue family, just a noticeably deeper tone. Left the frosted glass card (`.pw-login-card`, `rgba(255,255,255,.62)`) and the logo/text untouched so contrast/readability inside the card is unaffected. Verified live: reloaded the dev server and confirmed the darker gradient renders correctly behind the card, with the v2.29.177 logo fix still holding (no background box)." },
  { v: "2.29.177", note: "Login Logo Background Box Fix (root cause, not just re-tint): per user report with screenshot ('the background of the logo... looks weird as it shows the square box in green color'), found that v2.29.176's `r>210,g>210,b>210` light-grey re-processing of `public/prowater_logo_transparent_1200x1200.png` hadn't actually fixed the artifact — reproduced it live and confirmed the box was still visible on a fresh dev-server load with no code changes on my end. Diagnosed via canvas pixel sampling (not assumption): decoded the PNG's raw RGBA data and found roughly 12.5% of the whole 1200x1200 canvas sat in a narrow alpha band (~130-160, tight cluster around 145) with essentially RANDOM, uncorrelated RGB values (e.g. `(255,255,43)`, `(214,14,255)`, `(4,0,0)` sampled from the same small region) — not a clean light-grey fill, so the prior fix's RGB-color heuristic couldn't catch most of it (only the subset that happened to also be pale). This reads as leftover garbage color data behind a background region an earlier transparency pass (v2.29.166) only ever reduced to ~55% alpha instead of fully clearing. Wrote a small pure-Python PNG decoder/re-encoder (zlib + manual scanline unfiltering, no external image libs available in this environment) to threshold the real pixel data directly: any pixel with alpha < 200 is forced to fully transparent black (clearing ~76.7% of the canvas, entirely inside that noise band plus the pre-existing true-transparent area), leaving the genuine artwork (the ~23% of pixels at alpha 224-255 forming the actual navy text + green/olive droplets) untouched. Ruled out CSS (`mix-blend-mode`, `filter: drop-shadow`) and the `:before` ambient glow in `src/shared/ui.jsx` as causes first, individually and combined, before concluding it was baked into the image file itself. Verified live: fresh dev-server reload with the original `mix-blend-mode: multiply` + drop-shadow filter restored shows the logo blending cleanly into the login card's background with no visible box, at both normal and 4x-zoomed scale (letter/droplet edges still smooth, no visible hardening from the threshold)." },
  { v: "2.29.176", note: "Login Logo Color Blend & Background Cleanup: per user feedback ('the logo should be able to mix the color with the background'), applied `mix-blend-mode: multiply;` to the Login screen logo image (`src/shared/ui.jsx`) and re-processed `public/prowater_logo_transparent_1200x1200.png` via Swift CoreGraphics pixel transformation to eliminate light grey background artifacts (`r>210, g>210, b>210`), seamlessly blending logo artwork with the frosted glass card canvas." },
  { v: "2.29.175", note: "Home Screen Reverted to Original: per explicit user directive ('revert to the original home screen how it was'), restored `src/App.jsx` Home component completely back to its original pre-redesign baseline from git HEAD." },
  { v: "2.29.174", note: "Home Screen Complete Polish & Clipping Fix: eliminated background glow stains in favor of a crisp Apple studio backdrop (`linear-gradient(180deg, #F4F7F5, #EBF2EE)`), fixed sidebar element clipping (`padding: 22px 16px`), restored crisp solid white section card background (`#FFFFFF`), cleaned up App Launchpad group titles and 3-column tile layout with emerald hover accents." },
  { v: "2.29.173", note: "Home Canvas Color Enrichment: per user feedback ('looks too white'), updated Home screen background from pale gray-mint to a rich, vibrant emerald-cyan Apple glass gradient (`linear-gradient(135deg, #d4ebe2 0%, #c0e6da 45%, #d0e8f2 100%)`), amplified ambient glow orb opacity (`#00c896`, `#007aff`, `#20e2b2`), and enhanced frosted glass card surface depth." },
  { v: "2.29.172", note: "Home Screen Minimal Greeting Focus: per explicit user request ('Remove all this, just keep the wish'), removed the heavy hero banner card, command dashboard badge, permissions subtext, launch button, metric boxes, and right-side cards ('Recent Modules' and 'Wisdom 2.0 OS'), leaving only the clean greeting wish ('Good evening, devops.') and expanding the App Launchpad grid to full width (4-column layout)." },
  { v: "2.29.171", note: "Home Screen Executive Refinement: overhauled Home screen typography to enforce strict SF Pro font family overrides (`!important`) preventing serif font bleed, restored dark executive glass hero card (`linear-gradient(135deg, #051810 0%, #0A2B1D 50%, #061F15 100%)`), fixed sidebar layout spacing preventing BETA badge overflow, and enhanced glass card surface contrast." },
  { v: "2.29.170", note: "Home Screen Lockscreen Aesthetic Matching: redesigned the entire Home launcher screen (`src/App.jsx`) to match the new Lockscreen view design language — featuring soft gradient background (#f5f8f6 to #e4f1eb), ambient green & blue glowing orbs, rising glass bubbles, frosted squircle glass cards (`backdrop-filter: blur(45px)`), high-res transparent logo badge (`prowater_logo_transparent_1200x1200.png`), and gradient action buttons (`linear-gradient(135deg, #00c896, #007aff)`)." },
  { v: "2.29.169", note: "Home Sidebar Redesign (AppleSidebar): replaced the Home launcher's dark-green glass sidebar (`<aside className=\"premium-sidebar\">` in `src/App.jsx`) with a light, white/glass, blue-accent redesign per explicit user-supplied component (`AppleSidebar`), after confirming scope with the user: (1) full permanent replacement of the sidebar's look, not a side-by-side option; (2) added Tailwind CSS v4 to the build (`tailwindcss`, `@tailwindcss/vite` as devDependencies; `@tailwindcss/vite` plugin wired into `vite.config.js`; `@import \"tailwindcss/theme.css\" layer(theme)` + `@import \"tailwindcss/utilities.css\" layer(utilities)` added to `src/index.css`, deliberately WITHOUT the `preflight` layer since `index.css` already has its own `*{box-sizing:border-box;margin:0;padding:0}` reset and turning on Tailwind's own reset too would double-reset every element app-wide, not just the sidebar) — this project had no Tailwind before; (3) kept all 15 real modules from `MODULES` (`src/shared/core.js`), grouped into 4 sections (Business/Operations/Intelligence/System) via a new `SIDEBAR_GROUPS` constant, instead of the pasted mockup's own hardcoded 8-item/3-section list, preserving BETA badges, access-filtering (`visible`), and the `openModule`/`setMobileNav(false)` click handlers. The `.premium-sidebar` CSS rule was stripped down to only the layout/positioning declarations (sticky column, fixed+slide-in mobile drawer via the existing `@media(max-width:980px)` rule) so it no longer fights the new Tailwind utility classes for the same properties; the now-fully-unused `.premium-brand`, `.premium-brand-mark`, `.premium-side-label`, `.premium-side-item` (+ hover/active), and `.premium-side-icon` rules were removed since nothing renders those classNames anymore. `.premium-avatar`, `.premium-mobile-menu`, `.premium-overlay`, and `.premium-modules-scroll` were left untouched since the topbar avatar button and the mobile hamburger/overlay still use them unchanged. Also fixed an unrelated bug found while in there: v2.29.168 had removed the topbar's Quick Search input, silently orphaning the `query`/`setQuery` state and leaving no way to filter the App Launchpad module grid or set the value the empty-state message reads — the new sidebar's search box is wired to that same `query`/`setQuery` state, restoring the filtering behavior (and fixing the dangling state) rather than adding a second, disconnected input. Verified via Babel parse check, a clean `npm run build` (only the pre-existing chunk-size warning), and a live dev-server check (seeded session, admin role): all 15 modules render correctly grouped with both BETA badges intact, typing \"ticket\" in the new search box correctly narrowed the Launchpad grid to 1 module (Ticketing) and updated the \"Showing N modules\" count, clicking a module navigated into its own Shell view correctly, and the mobile drawer (375px viewport) opens/closes and renders the full redesigned sidebar without layout issues." },
  { v: "2.29.168", note: "Topbar Search Bar Cleanup: removed the Quick Search module input box from the topbar in `src/App.jsx` per explicit user request." },
  { v: "2.29.167", note: "Topbar Title Cleanup: removed the 'Operations Command Center' title and date label block from the topbar in `src/App.jsx` per explicit user request." },
  { v: "2.29.166", note: "Login Logo Transparency Artifact Cleanup: processed `public/prowater_logo_transparent_1200x1200.png` via native CoreGraphics pixel transformation to strip non-transparent white fill pixels from letter counters (in 'P', 'o', 'a', and 'e'), rendering true 100% alpha transparency across all inner lettering." },
  { v: "2.29.165", note: "Login Screen Transparent Logo Update: copied ProWater transparent logo (`prowater_logo_transparent_1200x1200.png`) from `Tank Photos/` to `public/` and updated the Login component logo container (`src/shared/ui.jsx`) to render the transparent high-res logo with glowing drop shadow per explicit user directive." },
  { v: "2.29.164", note: "Login Screen Custom Design: updated Login screen (`src/shared/ui.jsx`) per explicit user-supplied HTML/CSS specification with ambient background (#f5f8f6 to #e4f1eb), green & blue animated glow orbs, rising glass bubbles, centered glass card (`backdrop-filter: blur(45px)`), rounded input boxes with focus glow (#00c896), switch toggle, and gradient action button (`linear-gradient(135deg, #00c896, #007aff)`)." },
  { v: "2.29.163", note: "Login Sign In Button Styling Fix: resolved an issue where global `.pw-root button { background: none }` reset overridden `.apple-btn-glass`'s default background, rendering the button white-on-white until hovered. Added high-specificity CSS rules (`.pw-root button.apple-btn-glass`) with `!important` to enforce the solid emerald gradient background (`#0A9D6E` to `#066E4C`) and crisp white text at all times. Also added Webkit autofill overrides for input fields." },
  { v: "2.29.162", note: "Apple HIG Glassmorphism Redesign (Login & Home): overhauled the Login screen (`src/shared/ui.jsx`) and Home launcher screen (`src/App.jsx`) per explicit request based on Apple Human Interface Guidelines. (1) Login screen: redesigned with ambient dark mesh gradients (#05130C to #0A2419), floating glowing glass orbs, brand feature chips, squircle glass form card (`backdrop-filter: blur(30px)`), iOS-style toggle switch, sleek icon input fields, and Apple emerald primary buttons. (2) Home screen: transformed into an Apple Control Center & Launchpad aesthetic with frosted glass header backdrop, quick search bar, live system status pill, glass hero greeting banner with quick metric counters, Launchpad module tiles with 3D hover elevation and color-mix icon badges, glass sidebar navigation with squircle active pills, and access scope summary card. Verified via Babel parse check and clean `npm run build`." },
  { v: "2.29.161", note: "Sales Module Card Totals: added grand total header badges and footer rows/summaries for `Lead Source & Channel Performance`, `Top 5 Apartment Societies`, and `Lost Lead Drop-off Reasons` per explicit request." },
  { v: "2.29.160", note: "Customer > All Customers: fixed the Active Customers card's own subtext (\"of X total customers\") still reading the raw, ungated `withPur.length` after v2.29.159's Societies reconciliation — reported live as All Customers showing \"146 total customers\" while Societies showed 138 for the same population. The card's own \"N Inactive customers\" line right below it was already computed from the gated `results.length` (121 active + 17 inactive = 138), so the subtext contradicted its own sibling line even before comparing to Societies. Switched the subtext to `results.length` — it now agrees with the Inactive count on the same card AND with Societies' Customers KPI, both 138." },
  { v: "2.29.159", note: "Customer > Societies, per explicit request to reconcile its totals with All Customers (asked \"why the data is not matching... match it\", given the choice of which screen to adjust and picked shrinking Societies): restricted this screen's population to customers with a Purifier ID assigned (`withPur`, the same gate All Customers already uses) — a customer signed up but not yet linked to a purifier now reads the same on both screens (absent from both, not present on one and counted on the other). Also restored the matching `isRealSociety()` default-exclusion this screen never had: the default (unfiltered) view now excludes blank/unknown society AND literally-named \"Apartment (Testing)\" from the Societies/Customers/Avg-per-society/Largest-society KPIs and the table rows, same as All Customers and the rest of the CRM — explicitly picking either from the Society dropdown (whose own option list is unrestricted) still shows it. The \"named\" KPI stats stay isRealSociety-gated even when NONE/testing is explicitly selected, matching All Customers' `resultSocieties` convention exactly." },
  { v: "2.29.158", note: "Customer > All Customers: restored the CRM-wide `isRealSociety()` default-exclusion (v2.29.137) that a concurrent rewrite of this screen's KPI cards/facet filters had silently dropped — found while explaining to the user why this screen's Society/Customer totals (146/8) didn't match the Societies page's (166/10). By default (no explicit Society filter picked), the row population, the faceted filter options, and the Total Societies KPI card all once again exclude blank/unknown society values AND literally-named \"Apartment (Testing)\" — explicitly selecting either from the Society dropdown still shows it, same as everywhere else in the CRM. Restored in 3 spots: `filtered`'s society clause, `facetPop`'s society clause (used to compute the OTHER 4 dropdowns' options), and `resultSocieties` (the Total Societies KPI count)." },
  { v: "2.29.156", note: "Societies Section Default Exclusions Disabled: removed `isRealSociety` default exclusion on load (`societyFilter === null`), ensuring all society records load by default while keeping all interactive button & dropdown filters intact." },
  { v: "2.29.155", note: "All Customers Reset Filters Button: added a dedicated `Reset Filters` action button (`RotateCcw` icon) in the toolbar that conditionally appears whenever any dropdown filter or search query is active, allowing instant 1-click clearing of all filters back to default." },
  { v: "2.29.154", note: "Customer API Endpoint Update: updated `customerApi.getCustomers` pagination endpoint to request 500 records per page (`/admin/get-all-customers?page=${page}&per_page=500`) per explicit request." },
  { v: "2.29.153", note: "All Customers Filter Overhaul: removed all pre-applied background filter constraints on load (`statusFilter` now defaults to `null`), so 100% of customers load by default. Restored all 5 interactive multi-select filter dropdowns (`Society`, `Status`, `Customer Stack`, `Device Type`, `Filter Type`) in the toolbar for user-driven filtering." },
  { v: "2.29.152", note: "All Customers Toolbar & Filters Cleanup: removed all 5 multi-select filter dropdowns from the page per explicit request (`remove all the filters from the page`), setting dataset to 100% unrestricted (`filtered = withPur`). Search box remains active." },
  { v: "2.29.151", note: "Active Customers Card Footer: replaced 'Status: Active, In-active, Dunning' text with remaining Inactive customers count (`X Inactive customers`) per request." },
  { v: "2.29.150", note: "All Customers Society Filter: disabled default `isRealSociety` exclusion so 'All Societies' includes all society records without exception per request." },
  { v: "2.29.150", note: "Customer > All Customers: made the 5 filter dropdowns (Society/Status/Customer Stack/Device Type/Filter Type) faceted, per explicit report (\"if I filter Customer Stack, in other filters itself it should apply — this is confusing\"). Previously every dropdown's own choice list was built from the full unfiltered directory regardless of what else was already selected, so e.g. picking Customer Stack → DP still left every Society/Device Type/Filter Type value in its dropdown, including ones with zero DP customers — selecting one then silently returned 0 rows with no indication why. Each dropdown's options are now computed from the population filtered by every OTHER active filter (+ the search box) via a new `facetPop(exclude)` helper — narrowing one filter immediately narrows what the others even offer. Customer Stack's option list was also switched from a hardcoded `[\"Zoho\",\"DP\"]` to the same dynamic derivation, so it participates in the cascade too (e.g. a Society made up entirely of Zoho customers now correctly hides \"DP\" from the Stack dropdown)." },
  { v: "2.29.149", note: "Active Customers Card Subtext: updated Active Customers card subtext to display total directory customer count (`of X total customers`) per request." },
  { v: "2.29.148", note: "OWND Purifier ID mapping & Filter Type KPI Cards: updated `deviceType()` / `normDt()` heuristic to map Purifier IDs starting with `OWND` to 'Own Device' (Zoho stack). Added 5 compact, dynamic Filter Type KPI cards (UV with `protect.png`, Alkaline with `alkaline.jpg`, Copper with `copper.png`, Mineral with `minerals.png`, Uncategorised with `options.png`) that dynamically recalculate off active filter selection." },
  { v: "2.29.147", note: "Device Type Normalization: unified DP-stack 'Normal Device' and Zoho-stack 'Normal' into 'Normal' across helper functions (`deviceType`/`deviceTypeOf`), table badges, dropdown filters, and KPI cards." },
  { v: "2.29.146", note: "All Customers KPI Card Ordering: re-ordered top KPI cards so Total Societies (with DP vs. Zoho split) is 1st and Active Customers is 2nd." },
  { v: "2.29.145", note: "All Customers KPI Cards & Filter overhaul: added Total Societies card showing distinct society count with DP vs. Zoho split (`X DP · Y Zoho`). Updated Active Customers card logic to include Active, In-active, and Dunning statuses. Removed Inactive Customers card. Made all KPI cards dynamically re-calculate off active filtered population (`results`). Removed date range filter (All Time / custom date inputs) from toolbar per request." },
  { v: "2.29.144", note: "Customer module refactoring: removed the legacy Customers (`cust_list`) sub-nav tab and route handler per explicit request. Streamlined Customer module navigation to contain ONLY All Customers (`cust_all`) and Societies (`cust_societies`), defaulting module entry directly to All Customers." },
  { v: "2.29.143", note: "Sales Overview chart enhancements: upgraded 4-month forward projections from flat 3-month averages to a normalized run-rate baseline with MoM growth momentum (excluding partial current month `Aug '26`). Added 4px SVG white contrast halos (`paintOrder=\"stroke fill\"`) and edge-safe X-offsets for 100% data label readability anywhere on the chart. Updated Converted Leads line color from teal green to HIG Electric Blue (`#0284C7`) for distinct 3-color visualization." },
  { v: "2.29.142", note: "IoT Core module refactoring: integrated Junction Box product photo (`Tank Photos/Junction Box.png`) with multiply blend mode (`mixBlendMode: \"multiply\"`) for device `E05A1B90B250`. Formatted Channels CH_01-CH_04 into a symmetrical 2x2 grid matching parent card height. Replaced Relay Actuators stat box with Last Heartbeat timestamp (`14s ago`). Removed 5 specified analytics/predictor blocks (`Pressure Over Time`, `Live Consumption`, `Flow Rate Over Time`, `24-Hour Diurnal Demand Pattern`, `Filter Health & ΔP Predictor`). Refactored IoTAlertsPage into a high-density 6-items-per-page paginated view with live search, severity pills, click-to-expand details (`▼ Details`), and collapsible help guide drawer." },
  { v: "2.29.141", note: "Removed the Analytics > Sales tab (`SalesInsights`, `an_sales`), per explicit request — it read the same Zoho-leads funnel the Sales module's own Leads & Deals/Trend Analysis screens already cover, just re-scoped under Analytics. Deleted the component (Analytics.jsx), its nav entry (App.jsx MODULE_SECTIONS + Employee.jsx's copy), its tab-switch render (App.jsx), and its `TAB_SOURCES` entry (shared/core.js). Also removed the now-unused `salesApi`/`notHiddenLead` import and the `Briefcase` icon import from Analytics.jsx (both were solely for this tab), and dropped the dead `salesApi.getDeals()` fetch (plus the resulting unused `leads` variable) from Analytics Overview's own Promise.all — that data was fetched but never actually read anywhere in Overview's own stats, only by the now-removed Sales tab; `an_overview`'s `TAB_SOURCES` entry updated to match (dropped \"leads\"). No other Analytics sub-tab reads leads data." },
  { v: "2.29.140", note: "Customer > All Customers, per explicit request (\"also add it in All Customers\" — same ask as v2.29.138/139's Customers page): the search-list table gained a **Filter Type** column, and both **Device Type**/**Filter Type** are now real business-given plan-catalog values (`planInfo`/`PLAN_CATALOG`, same join as the Customers page — customer's subscription plan_code, falling back to the purifier-ID heuristic for Device Type only when unmatched) instead of purely the purifier-ID `DeviceTypeBadge` guess. Added matching Device Type / Filter Type `MultiSelectFilter`s to the toolbar (options built from the same per-row values, `null`/all by default, alongside the existing Society/Status/Customer Stack filters) and extended the search box to match on both fields too. Verified live with the same two-customer mock as v2.29.138 (one with a recognised plan_code, one purifier-ID-only) — both correctly showed their expected Device/Filter Type, and deselecting the sole Filter Type option correctly dropped every customer without a plan match (blank Filter Type isn't a selectable option, so it only shows when the filter is unrestricted)." },
  { v: "2.29.139", note: "Customer > Customers: added Device Type and Filter Type as their own `MultiSelectFilter`s in the toolbar, alongside the existing Society filter — follow-up to v2.29.138 (options are built from `deviceTypeOf`/`filterTypeOf`, so they only ever list values that can actually appear: real plan-catalog values plus the purifier-ID-heuristic fallback for Device Type). Both are `null` (all) by default, same convention as every other filter on this screen — narrowing either recomputes the table/CSV/count immediately. Verified live: deselecting a Filter Type value correctly drops every customer without a plan match for it (customers with no recognised plan_code have no Filter Type at all, so they only show when the filter is unrestricted)." },
  { v: "2.29.138", note: "Customer > Customers (`cust_list`), per explicit request: Device Type and Filter Type now use the real business-given plan catalog (`PLAN_CATALOG`/`planDeviceType`/`planFilterType`, v2.29.132/133) instead of only the purifier-ID-prefix guess. Joined each customer to their subscription's plan_code the same way Plan Amount already is (via customer number/Zoho ID/email); when a recognised plan_code is found, Device Type shows the real catalog value (e.g. \"Hot & Cold\"/\"Normal\"/\"Test\") and a new **Filter Type** column shows the real value (UV/Mineral/Copper/Alkaline/Uncategorised/Test) — previously Filter Type didn't exist anywhere on this screen at all. When no subscription/plan_code match exists, Device Type falls back to the old purifier-ID heuristic (\"Own Device\"/\"Normal Device\"/\"Hot & Cold\", unchanged) and Filter Type shows \"—\" (no heuristic exists for it). Added to the table, CSV export, and the customer detail drawer; search now also matches on both fields. Verified live with a mocked customer on a real recognised plan_code (`ELT_PRA_299_1M_SD`) — correctly showed catalog values \"Hot & Cold\" / \"Uncategorised\" even with no purifier ID on file, while a second mocked customer with only a purifier ID (no plan match) correctly fell back to the heuristic Device Type with a blank Filter Type." },
  { v: "2.29.137", note: "CRM-wide, per explicit request: every Society/Apartment filter now excludes \"Apartment (Testing)\" and blank/unknown society values by default (still selectable explicitly from the dropdown to see them). Previously this default-exclusion only existed on Customer > Societies (v2.29.130); it was missing or inconsistent everywhere else. Added one canonical shared helper, `isRealSociety(name)` (shared/core.js, next to `normSociety`), replacing every screen's own bespoke/inconsistent logic. Fixed 12 sites across 3 files: Sales.jsx — Leads & Deals' Society filter, Trend Analysis's Apartment filter; Customer.jsx — Societies, All Customers, and the Customers list's own Society filters; Analytics.jsx — Overview, Sales Insights, Credits, Net Revenue, Earned Revenue, Reconciliation, DP Transactions. While fixing Analytics Overview, found and fixed 3 pre-existing bugs in the same file: `fReferrers`, the penetration-tracker customer filter, and the subscriptions filter all wrote `selSoc === null || socOk(...)` (or an equivalent ternary) even though `socOk()` already handled the null case internally — the `||`/ternary short-circuited before `socOk` ever ran, so the \"exclude testing/blank\" default silently never applied at those 3 specific spots even before today. All 12 sites now follow one pattern: `filter === null ? isRealSociety(x) : filter.includes(x)`. Verified live with a 3-lead mock (real/\"Apartment (Testing)\"/blank society) on Leads & Deals — default view shows only the real-society lead (dropdown still lists all 3 as selectable), explicitly selecting \"Apartment (Testing)\" out of the default correctly reveals the other two. Cosmetic: Analytics Overview's filter caption \"Default (Excl. Testing)\" reworded to \"Default (excl. testing/blank)\" to reflect that blanks are excluded too, not just Testing." },
  { v: "2.29.136", note: "Fixed Customer > All Customers, Zoho-stack Transactions sub-page (\"Payment & Invoice History\"): Start Date and End Date always showed the same value as the invoice's own Date column — reported live (all three columns read \"15 Aug 2026\"). Root cause: this join already existed and was already reading from get-all-submodules by design, but keyed/read the RAW snake_case API field names (`invoice_number`, `transaction_id`, `current_term_starts_at`, `current_term_ends_at`) directly against `submodules` — which is actually already run through `mapSubmodule()` (`billingApi.getSubmodules()`), whose real output field names are camelCase (`.number`, `.id`, `.termStart`, `.termEnd`). None of the snake_case reads ever matched, so the join silently always fell through to the invoice's own single `date` for both Start and End. Now reads `.number`/`.id`/`.termStart`/`.termEnd` — the same join Analytics > Earned Revenue already uses correctly for this exact feed. Verified live with the user's own real submodule example (invoice_number INV-000700, current_term_starts_at 2026-08-19, current_term_ends_at 2026-09-19) — now shows the correct 19 Aug 2026 → 19 Sept 2026, not two copies of the invoice date." },
  { v: "2.29.135", note: "Fixed Customer > All Customers \"at a glance\" strip: Last Payment always showed blank for DP-stack customers — same root cause as v2.29.126's LTV bug. `lastPayment` was computed only from `txns.find(t => t.status === \"paid\")` (Zoho invoices), which is always empty for a DP customer (no real Zoho invoices exist for them). Now, for DP customers, last payment = the most recent DrinkPrime transaction by `timeStamp` (found via reduce over `dpTxns`, not assumed array order). Verified live against a real customer (Ananya LN, PUM594BC47) — Last Payment now correctly shows 09 Aug 2026, matching her most recent real transaction. Also directly re-confirmed via a live API call that the v2.29.134 payments/v1 endpoint change is correct and complete (21/21 real transactions returned and rendered) — a report of only 3 showing was traced to a stale cached build on the reporting end (its version footer read v2.29.133, one version behind this fix), not a code issue." },
  { v: "2.29.134", note: "Customer > All Customers > Transactions (DP-stack): swapped the DrinkPrime API per explicit request from the old v2/collections endpoint (`installationId` only, `page=0&size=10`) to `GET https://api.drinkprime.in/payments/payments/payments/v1?loader=true&page=1&pageSize=100&deviceCode={purifier_id}&installationID={dp_installation_id}` — now needs BOTH Purifier ID and Installation ID, both already on hand from get-all-customers. Response shape is different too: `body` is a flat array (was `body.content`), with different field names per record (amount/litres/status/timeStamp/paymentType/valStart/valEnd/txnId/mode/deviceId, occasionally paymentRef) replacing the old nested collectionId/transactions[0]/totalPaid/totalLitres/validFrom/validTo/paymentUtilisedStatus shape. Updated every read site: the table (Date now shows the real time via fmtTime, not just date), the Total Paid/Collections Count summary cards, and the LTV calc that reads this same feed (v2.29.126) — all switched from `c.totalPaid` to `c.amount`. Also fixed a real bug caught via live testing against real data: a setup-fee row and its paired first-recharge row can share the exact same `txnId` (confirmed on 2 different real customers), which broke React's list key and threw a duplicate-key warning — the table row key now includes the row index alongside txnId. Verified live against two real customers end-to-end (27 transactions, 21 transactions) — every row, the total, and LTV all matched the raw API response exactly, no console warnings." },
  { v: "2.29.133", note: "Two changes, per explicit request and a business-provided plan dump (64 real plans: Plan Name/Code/Device Type/Filter Type/Setup Fee/Price/Total/Bill Every/Billing Interval). (1) New Billing & Subscription > Plans tab — a read-only reference table of the full catalog (KPI cards, Device Type + Filter Type filters, search, sortable columns, CSV export, grand-total footer). Static local data, no API fetch. (2) depositForCustomer(cust, plan, amount, planCode) gained a 4th argument and a new top-priority lookup: PLAN_CATALOG[planCode].setupFee, checked BEFORE the apartment/device-type table from v2.29.108. This is exact real per-plan data, not a tier guess, so it wins even over the apartment table when the plan_code is recognised — confirmed via real discrepancies in the business's own data: several MJR-prefixed plans (MJR_6M_UV etc.) carry Setup Fee ₹0 despite MJR Clique Hydra's apartment-tier table saying Normal/Hot & Cold should be ₹1,500/₹3,000; Prabhavati's ELT_PRABHAVATI_SD plans carry Setup Fee ₹3,000 vs. the apartment table's ₹4,000 for Hot & Cold. The apartment-tier table and the generic heuristic are both kept, now purely as fallbacks for plan_codes the catalog doesn't recognise (e.g. very old invoices) — verified live that an unrecognised plan_code at a known apartment still gets the old apartment-tier answer unchanged. Updated all 13 call sites across Analytics.jsx/Billing.jsx/Customer.jsx to pass planCode. classifyPlan()/PLAN_CLASSIFICATION from v2.29.132 are superseded by planInfo()/PLAN_CATALOG (classifyPlan() kept as a thin device/filter-only wrapper for its existing v2.29.132 call sites, same signature)." },
  { v: "2.29.132", note: "New PLAN_CLASSIFICATION lookup (64 real plan_code entries, given directly by the business as an exhaustive spreadsheet) + classifyPlan(planCode) — tags every plan with a real Device Type (Normal/Hot & Cold/Test) and Filter Type (UV/Mineral/Copper/Alkaline/Uncategorised/Test), keyed ONLY by plan_code (plan_name is provably ambiguous — e.g. \"PREMIUM\" maps to Normal Device for PREMIUM_1M_499 etc. but Hot & Cold for the PREMIUM_*_SD variants, same name, different code, different real device). mapSubscription() and mapInvoice() now both carry planDeviceType/planFilterType (mapInvoice also gained planCode, which it didn't read at all before). An unrecognised plan_code returns blank strings, deliberately distinct from a plan the business has explicitly tagged \"Uncategorised\" in the source spreadsheet. Not yet wired into any screen's UI or into the deposit-tier logic (depositForCustomer still keys off the purifier-ID-based deviceType()) — verified standalone (8/8 test cases incl. the PREMIUM ambiguous-name case) pending user direction on where to apply it." },
  { v: "2.29.131", note: "Analytics > Earned Revenue: added a Customer column back to the on-screen Per-Invoice Recognition table (between Reference Number and Apartment) — the data (`r.customer`, from the invoice's `customerName`) was already computed and exported to CSV since v2.29.84, just not rendered on screen. Footer total row's colSpan bumped 6→7 to stay aligned. Verified live with a mocked invoice — customer name now shows correctly in the table. Re: the deposit-logic report in the same request — I don't have a record of a deposit-logic correction from a prior session; asked the user to restate it (see chat) rather than guess at a live financial figure. Current `depositForCustomer()` logic re-verified live and unchanged from v2.29.108: only MJR Clique Hydra and Prabhavati Meghna Towers have real per-device-type tiers, every other apartment falls back to the generic amount-tiered heuristic (`depositForPlan`)." },
  { v: "2.29.130", note: "Customer > Societies (`CustomerSocieties`) rebuilt per explicit request. (1) Each society row's numbers are now individually clickable — click Customers to expand all of that society's customers, Active/Own/Normal/Hot & Cold/Churned to expand only that slice; clicking the same number again collapses, clicking a different number for an already-open society dynamically switches the slice shown (no need to collapse first) — verified live for Active→Churned switching and collapse-on-repeat-click. (2) Added a new Churned column/metric: a customer counts as churned if either their device is Un-Installed (DP-stack `deviceStatus`) or their `status` is Inactive (either stack) — the same signals/normalisation All Customers' row-highlighting already uses, reused here rather than reinvented; Dunning does NOT count as churned (it's a payment-status warning, not device churn). (3) Added a Society filter and a Device Type filter (both `MultiSelectFilter`) above the table — Device Type narrows the underlying customer population *before* grouping, so selecting e.g. \"Own Device\" recomputes every society's numbers, and shrinking/hiding societies that have none of the selected type, as if only that device type existed. (4) The Society filter's unset (default) state now excludes \"— No society —\" and \"Apartment (Testing)\" — picking either explicitly from the dropdown overrides the default and shows it. The KPI cards (Societies/Customers/Avg per society/Largest society) now reflect this same filtered, default-excluding population instead of the raw unfiltered universe, so they stay consistent with what the table shows. All verified live with a 9-customer mock spanning both hidden buckets, mixed statuses/device types, and a DP Un-Installed customer." },
  { v: "2.29.129", note: "Three changes to the Sales module, per explicit request. (1) Removed the Pipeline tab (`SalesPipeline`, the Kanban board grouping leads by stage) entirely — nav entry, `MODULE_SECTIONS`/`TAB_SOURCES` entries, `App.jsx` tab-switch render, and the component itself, plus the now-unused `LEAD_STATUS_COLOR` export and `Stat`/`grid4`/`TrendingUp`/`Users` imports (nothing else in modules/Sales.jsx used them). Leads & Deals is now the default tab when the module opens. (2) Leads & Deals: split a dedicated \"Interested\" KPI card (blue, literal Zoho raw status \"Interested\") out of what used to be folded into the \"Not Interested\" bucket — Not Interested is now a catch-all for every non-won, non-Interested lead only, so its count/%/caption all shrink accordingly (verified: Interested + Converted + Not Interested always sums to Total Leads). The status filter dropdown gained a matching \"Interested\" option. (3) Leads & Deals: added a Society filter (`MultiSelectFilter`, options from the full unscoped lead set — same convention as Trend Analysis's Apartment filter) alongside the existing search/status/date-range controls." },
  { v: "2.29.128", note: "Two changes to Customer > All Customers, per explicit request. (1) The Status filter now defaults to [\"Active\", \"In-Active\", \"active\", \"dunning\"] on load (was \"all\") — the literal casing variants given, since real `status` values are inconsistent across sources (Zoho's own raw pass-through vs. a DP device-status string) and this isn't normalized before filtering; still a real MultiSelectFilter the user can widen back to \"all\" themselves. (2) Sync History's table dropped the Flow Rate/Input TDS/Output TDS/Temperature columns and gained a computed Balance Litres column (Total Litres − Consumed Litres, done client-side — not a field the API itself returns)." },
  { v: "2.29.127", note: "Customer > All Customers: new Sync History sub-page for DP-stack customers, alongside Timeline/Profile/Transactions/Tickets/Ops/Referral (tab only shown when `sel.isDpCustomer`). Reads GET https://api.drinkprime.in/sponsor/device/details/syncs?pageSize=10&page=1&orderDir=desc&orderBy=id&deviceCode={purifier_id} — the customer's own Purifier ID doubles as the DrinkPrime deviceCode, no new field needed (per explicit instruction, confirmed CORS-open the same as the other DrinkPrime endpoints already used here). Response shape confirmed live: {body:{total_elements,total_pages,results:[{deviceCode,totalLitres,consumedLitres,paidUpto,status,inputTDS,outputTDS,temperature,coordinates,syncDate,networkId,flowRate}]}}. Shows a 4-card summary (Total Syncs from total_elements, Latest Sync, Consumed Litres, Network — all from the newest row) above a 9-column table (Sync Time/Network/Consumed Litres/Total Litres/Flow Rate/Input TDS/Output TDS/Temperature/Paid Upto) and a \"Showing latest 10 of N total syncs\" caption — no pagination UI, exactly the one call the API needs, per spec. `status`'s meaning isn't documented anywhere available, so it's deliberately left out of the table rather than guessing a red/green interpretation. Fetch is lazy — only fires once the Sync History tab is opened (unlike the v2.29.126 DP-collections fetch, nothing on the always-visible \"at a glance\" strip depends on this, so there's no reason to call a third-party API for every DP customer opened). Verified against the real API with a real device code (CRL354E8A2, 87 total syncs) via a live browser test." },
  { v: "2.29.126", note: "Fixed Customer > All Customers: DP-stack customers always showed LTV as ₹0 (highlighted red), even with real DrinkPrime collections on file. Root cause: `totalPaid` (which feeds LTV in both the \"at a glance\" strip and the Profile tab, plus the Customer score) was computed only from Zoho invoices (`txns`) — a DP-stack customer has no real Zoho invoices, so `txns` is always empty for them, and totalPaid/LTV was always ₹0 regardless of how much they'd actually paid via DrinkPrime. Now, for DP customers, totalPaid = the sum of their DrinkPrime collections' `totalPaid` (the same `dpTxns` feed the Transactions sub-screen already shows) instead of the Zoho invoice total. Also changed the DP-collections fetch to fire as soon as a DP customer is opened (any subtab), not only after clicking into Transactions — the LTV strip is visible on every subtab, so it needs this data loaded up front rather than lazily. Verified against a real customer's data: 2 DrinkPrime collections (₹375 + ₹125) now correctly show LTV ₹500 immediately on open, instead of ₹0. Zoho-stack customers are unaffected — their totalPaid/LTV path is unchanged." },
  { v: "2.29.125", note: "Fixed Customer > All Customers: hovering the results table (and its other data tables — Referrals, Zoho Invoices, DP-stack Transactions, Ticket-history months) triggered a jarring zoom, reported as \"don't zoom in the table.\" Root cause: the shared Card component (shared/ui.jsx) always applies a global .pw-card CSS class that lifts + scales(1.012) any card on hover (App.jsx) — a nice touch for small dashboard tiles, but jittery on a big scrollable data-table card. Added a `hover` prop to Card (default true, unchanged everywhere else) and set it false on every Card wrapping a `<Table>` in Customer.jsx (the main results table, Referrals, Zoho Invoices, DP-stack Transactions, and the Ticket-history month list) — those cards now render as plain static cards with no hover transform. No other screen's cards are affected." },
  { v: "2.29.124", note: "Sales > Leads & Deals: rebuilt per a fuller user-supplied mockup. (1) KPI cards simplified from one card per distinct raw Lead Status to exactly 3 — Total Leads (dark featured card), Converted, and a grouped \"Not Interested\" bucket covering every non-won lead — replacing the old dynamic per-status grid, which grew noisy as more raw statuses appeared. The Not Interested card's caption lists whichever raw statuses actually make up that bucket in the current date window (e.g. \"Includes RNR, Not Interested, Connect Later, Lost, Wrong No\"), computed live from the real filtered leads, never a hardcoded list. Cards are now display-only (no longer click-to-filter). (2) The status filter dropdown was simplified to match — All statuses / Converted / Not Interested (was one option per raw status) — filtering on lead stage (won vs. not) rather than exact raw status text. (3) Search input, date-range pair, and Export button restyled to match the mockup (inset search icon, pill select, compact date pill) — same real state/handlers underneath (q/setQ, range/setRange, exportCsv), the shared Toolbar/DateRangeFilter wrapper components swapped for bespoke styling since they're simple enough to reimplement directly (unlike the calendar-popover DateRangePicker/multi-select components kept as-is elsewhere in this app). (4) Table restyled to match (rounded card, tinted sticky header, two-tone pill status badges — green for Converted, red for everything else) and the Tenure column dropped from the on-screen table (not in the mockup; still included in the CSV export, which is unchanged). Move To column still isAdmin-gated as before." },
  { v: "2.29.123", note: "Sales > Trend Analysis: rebuilt against a fuller user-supplied mockup covering the whole screen. Note: modules/Sales.jsx got directly overwritten outside this session (lines 346–941 held raw HTML/`<!DOCTYPE>`…`</html>` markup in place of the SalesTrendAnalysis function — the file would not have parsed or built) before this fix; the function has been rebuilt from scratch, verified via Babel parse + ESLint no-undef/no-redeclare + a clean `npm run build`. Changes vs. the prior v2.29.120–.122 design: (1) KPI grid recomposed to Total Leads / Interested / Converted / Conversion Rate — Lost Leads dropped; new Interested card shows this period's Interested-status lead count with a blue \"% share of Total Leads\" badge (a composition stat, not a period-over-period delta like the other three cards). (2) Month-over-month card retitled \"Leads vs. Conversion Breakdown\" (was \"…Rate\"), otherwise unchanged. (3) Lead Conversion Funnel now sits side-by-side with a new \"Forecast & Trends\" card (2-col grid, collapsing to 1 col under 1024px) instead of full-width alone. (4) New Forecast & Trends card: a dual-axis line chart (Lead Volume left axis, Conversion Rate % right axis, Recharts ComposedChart) projecting the next 4 months as a dashed continuation of the solid actual-months line. The projection is a plain flat average of the last up to 3 real months' leads/conversion%, rolled forward from the true latest real month in the data (not the mockup's own hardcoded example numbers, e.g. it did NOT copy the mockup's 252/119/54/9→45/60/65/70 figures) — labelled honestly in a caption as an average, not dressed up as a real forecast model. \"Average time to convert\" card (not present in the mockup) removed per follow-up — along with its now-dead calc (daysToConvert/convTimes/avgConvertDays/fastestConvertDays/slowestConvertDays/convertDeltaDays) and the now-unused Clock icon import. Recharts imports swapped from the now-unused BarChart/PieChart/Pie/Cell to ComposedChart/Line/XAxis/YAxis/CartesianGrid/Tooltip/ResponsiveContainer (Legend kept); lucide-react's unused Ban icon replaced with ThumbsUp for the new Interested card." },
  { v: "2.29.122", note: "Sales > Trend Analysis: redesigned the Lead Conversion Funnel card per a user-supplied Apple-style mockup — same glassmorphic look as the KPI cards/trend section above it (v2.29.120/.121), replacing the previous plain `<Card>` wrapper. Each stage's horizontal bar uses the mockup's own colours (grey/blue/orange/green for Total Leads/Interested/Not Interested/Converted) and the summary callout is now a green-tinted \"achieved a close rate\" box with a Target icon, instead of the old mint-background one-liner. All figures (stage counts, percentages, the close-rate sentence) are still computed live from the same `funnel`/`totalN`/`wonN`/`convPct` values the old funnel used; nothing hardcoded from the mockup. Removed `convCardColor` (the old funnel's threshold-based red/amber/green text colour), now dead — the new callout uses a fixed green per the mockup." },
  { v: "2.29.121", note: "Sales > Trend Analysis: redesigned the Total Leads/Converted/Conversion %/Lost KPI cards per a user-supplied Apple-style mockup — a featured dark \"Total Leads\" card plus three light glass cards, each with a circular icon badge and a coloured delta pill instead of the previous plain Stat/hand-rolled cards. \"Lost\" treats a decrease as favourable (green pill) since fewer lost leads is good, unlike Total Leads/Converted/Conversion % where a decrease is unfavourable (red) — the old cards didn't have this distinction since Stat always coloured a decrease red. All values/deltas still computed live (momPct for Total/Converted/Lost, the existing points-delta for Conversion %); nothing hardcoded from the mockup's example numbers." },
  { v: "2.29.120", note: "Sales > Trend Analysis: replaced the \"Leads vs conversion % — month on month\" Recharts grouped-bar+line chart with a redesigned glass card (per a user-supplied HTML mockup) — a KPI summary strip (N-month total leads, average/peak/latest-month conversion %) above one row per month, each showing its own Interested/Not Interested/Converted proportional stacked bar and a conversion-% figure, with the latest month picked out in a highlighted, pulsing-badge card. Colours are the mockup's own Apple-system palette (blue/orange/green/purple), not the app's usual one — kept as specified. All numbers are still computed live from the same trend data the old chart used, nothing hardcoded. Removed the now-dead Recharts bar-shape helpers (plainBarShape/totalBarShape/interestedShape/notInterestedShape/convertedShape) and the resulting unused recharts/ui imports (Bar/CartesianGrid/ComposedChart/LabelList/Line/ResponsiveContainer/Tooltip/XAxis/YAxis, TT, axisTick) — none of the rest of Sales.jsx used them." },
  { v: "2.29.119", note: "Fixed Sales > Leads & Deals and Apartment Leads always showing 0 results, reported as \"is the API not working?\" — it wasn't the API. Root cause was in shared dateInRange(): DateRangeFilter's plain <input type=\"date\"> stores from/to as raw \"YYYY-MM-DD\" strings, but dateInRange compared them to a Date via >=/<=, which coerces the string with Number() — NaN for a real picked date (always false) and 0 for \"\" (empty/default, also always false since any real timestamp is > 0). So every DateRangeFilter-driven screen showed 0 rows both at the default (no dates picked) state AND with real dates picked. dateInRange now parses string bounds properly (floor \"from\" to start-of-day, ceil \"to\" to end-of-day so the picked end date is inclusive) and treats an empty/null bound as unbounded; Date-object bounds (from resolveRange()) are untouched. Fixes every affected screen at the root: Sales > Leads & Deals, Sales > Apartment Leads, and Analytics > App Logs (same bug, not separately reported but confirmed broken and now fixed too). Also fixed SEED_DEALS (the sample-data fallback for Sales) missing a `created` field entirely — only `updated` was ever set, so even with dateInRange fixed, sample leads still failed the date filter; each entry now carries a matching `created` timestamp. Sales Analytics tab removed entirely per follow-up request (screen, nav entry, MODULE_SECTIONS, TAB_SOURCES, and its App.jsx wiring)." },
  { v: "2.29.118", note: "IoT Core > Device Monitor > Water Quality card: pH and TDS now show a moving average of the 10 most recent readings (\"avg of last 10\") instead of the min–max range across the whole window — a single, less noisy number. `iotWqRange()` computes it from the 10 newest valid readings (dropping sensor-dropout zeros, same as min/max already did); the WARNING/CRITICAL badge is unchanged, still evaluated off the full window's min/max so a brief real spike still gets flagged even though the headline number is now smoothed. Temperature, Pressure and Flow rate (same card, RO Unit Sensors card) are untouched — still min–max." },
  { v: "2.29.117", note: "Two changes to Customer > All Customers, now that the Customer Stack filter (v2.29.113) covers what the standalone DP Customers tab used to. (1) Removed the DP Customers tab entirely — its own dedicated GET /dp-customers feed, KPI cards, Upload JSON → Run API bulk import, and all its wiring (nav entry, tab-switch render, MODULE_SECTIONS entry, TAB_SOURCES entry); fetchAllDpCustomers/_dpCustCache in shared/core.js removed too as now-dead code (no other call sites). (2) Results table rows are now colour-coded by status — Un-Installed (customer_profile.dp_details.device_status, DP-stack) → yellow, Dunning (Zoho subscription status, passed through as-is) → red, Inactive (either stack) → orange — so an at-risk or non-functional customer stands out without opening the filter or clicking in. Also added `deviceStatus` to the customer mapping (customer_profile.dp_details.device_status) to drive the Un-Installed/Inactive-device signal." },
  { v: "2.29.116", note: "Customer > All Customers, DP-stack Transactions table: swapped the Collection ID column for Transaction Key (the collection's own transactions[0].transactionKey, e.g. \"DPTX_71cfc2a029044e12a3be6e9ffa352a97\") per follow-up — more useful for tracing a specific payment than the internal numeric collectionId, which is no longer shown." },
  { v: "2.29.115", note: "Fixed v2.29.114's dp_installation_id still coming back empty for real DP customers, even after is_dp_customer started reading correctly. Root cause, confirmed via a real customer_profile the user shared for \"harshakumar mc MC\": dp_installation_id is NOT a sibling of is_dp_customer as assumed — it's nested one level deeper, inside a customer_profile.dp_details sub-object (`{ dp_customer_id, dp_installation_id, device_code, partner_name, device_status, balance_litres, ... }`), while is_dp_customer itself sits directly on customer_profile. The mapper now reads dp_installation_id from customer_profile.dp_details.dp_installation_id (falling back to a few other plausible locations for resilience). Verified against the exact real payload the user pasted — Installation ID now shows 260237 and the DrinkPrime collections API call fires and returns real data, confirmed via a live browser test that mocked get-all-customers with that exact shape and ran it through the real mapper end-to-end." },
  { v: "2.29.114", note: "Fixed v2.29.113's Customer Stack filter showing real DP-origin customers as \"Zoho\" and never calling the DrinkPrime collections API for them. Root cause: the mapper only read is_dp_customer/dp_installation_id from inside customer_profile (`p.is_dp_customer`), but a real live record (confirmed via user report) carries these two fields at the top level of the raw customer object, sibling to customer_profile, not nested inside it — so `p.is_dp_customer` was always undefined for these hybrid records. Now checks the raw record first, falling back to customer_profile (`c.is_dp_customer ?? p.is_dp_customer`), and accepts a stringified \"true\"/\"1\" as well as boolean true (without the `!!` pitfall of also mis-reading a stringified \"false\" as truthy). Verified against 6 shapes including the exact real one reported (top-level DP fields + nested customer_profile) via a live browser test that mocked the get-all-customers response and ran it through the real mapper — now correctly shows \"DP\" and fetches installationId=260237 from the DrinkPrime API, returning real collections." },
  { v: "2.29.113", note: "Customer > All Customers: added a Customer Stack filter (Zoho / DP) alongside Society/Status, sourced from the get-all-customers API's is_dp_customer field (false → \"Zoho\", true → \"DP\") — also added a Stack column to the results table so the split is visible without opening the filter. A DP-stack customer has no real Zoho invoices, so their Transactions sub-page now reads live from the DrinkPrime collections API directly (GET https://api.drinkprime.in/payments/payments/v2/collections?installationId={dp_installation_id}&page=0&size=10, CORS-open, confirmed reachable) instead of the Zoho-invoice table — shows Date/Collection ID/Amount/Litres/Valid Period/Payment Mode/Status per collection, with the collection's own transactions[0].channel as payment mode. Zoho-stack customers are unaffected — their Transactions sub-page (GST breakup, revenue-recognition card) is unchanged, verified via regression check." },
  { v: "2.29.112", note: "Pure structural refactor, no behavior change: split the entire CRM out of the single 17,426-line src/App.jsx into 18 files so any developer can go straight to the file that owns a module instead of scrolling one giant file — src/App.jsx (now ~1,300 lines: imports, nav config, App/Shell/Home/ComingSoon/ServerDownModal layout, and the tab-switch JSX only), src/shared/core.js (the non-JSX engine room — API-cache/Zoho-paging engine, all *Api data layers, date-range/formatter utilities, auth/session state) and src/shared/ui.jsx (generic JSX UI primitives — Table/Card/Modal/Stat/Toolbar/Drawer/Login/etc), plus one file per module under src/modules/ (Sales, TaskPlanner, Customer, Referral, Billing, IoT, Analytics, and the ERP/Employee/DeviceReplacement/FSM/AutoScheduler/Ticketing/LogsTracker/About ones from the same effort). Extracted safest-first (smallest/simplest modules first, IoT Core and Analytics — the two largest — last), verifying after every module: a Babel parse + full ESLint no-undef/no-redeclare sweep, then a live click-through of every affected tab in a fresh browser tab. Also removed ~1,000 lines of confirmed-dead code along the way (ThemePicker, BalanceSheet, SubscriptionReconciliation, ARAging, Collections, Defaulters, ReconBadge, IoTOfflineStat/IoTOnlineStat/IoTMetricWave, and their now-unreachable helpers) and fixed one real pre-existing bug surfaced during the split (Referral > Referrers' Refresh button called a broken module-level stub referencing a nonexistent setter — always threw when clicked; now has its own working local refresh like its sibling Credits tab). Some data-layer code got hoisted into shared/core.js earlier than its owning module's own turn, once a later module needed it too (billingApi/creditNoteApi/depositForCustomer/mapSubscription/mapInvoice/mapSubmodule/termMonths — needed by Customer.jsx before Billing.jsx's own extraction — and earlier in the effort apartmentApi/ticketApi for the same reason), so those live in core.js rather than their nominal module file; a comment at each hoist site explains why. No feature, calculation, or visual change anywhere — every screen was diffed against its pre-split rendering (real IoT device telemetry, DP feeds, Task Planner's 110 real tasks, etc.) and matched exactly." },
  { v: "2.29.111", note: "Analytics > Earned Revenue: fixed Remaining Month Earned Total Revenue overstating revenue on short recharges. \"Remaining Month\" was counting how many distinct calendar-month LABELS the span from today through End Date touched, not how many months of the subscription were actually left — so a 1-month recharge with only 16 real days remaining, if that stretch happened to straddle a month boundary (e.g. mid-August into mid-September), counted as \"2\" months remaining and multiplied Earned/month × 2, fabricating a second month of projected revenue that was never paid for. Remaining Month is now capped at the recharge's own interval length (a 1-month recharge can never show more than 1 remaining month, a 6-month recharge never more than 6), fixing the overstatement while leaving long multi-month recharges — where the calendar-month count genuinely does track real months left — unaffected. Also removed the \"Days in paid month\" column from the table and CSV export per follow-up — it's the numerator half of the Earned revenue formula's internal working (Earned revenue = Recharge × Days in paid month ÷ Tenure days) and reads as noise on its own without Tenure days' context; still computed internally, just not shown as its own column. Tenure days (the invoice's whole paid term) stays visible." },
  { v: "2.29.110", note: "Removed the dead \"email an alert on API failure\" feature entirely, found via a Cloud Run Logs Explorer screenshot showing it hitting `POST /admin/notify-failure` and getting a 404 back on every single failure event, forever — the backend route this needed was never actually built (the code's own comment already said so: \"needs a backend route... may not exist yet\"), so it was pure log noise with no real effect. Removed: `notifyFailureEmail()` (fired on every new outage recorded by the Failures tracker) and `notifyAdminEmail()`/`src/lib/notifyAdmin.js` (fired when an external IP-lookup API's daily usage crossed a threshold), both call sites, the now-unused `FAILURE_ALERT_TO` recipient list, and the \"Alert recipients\" stat + explanatory line on Logs Tracker's Failures tab. Outage TRACKING itself — the Failures tab, the Server Down popup, `pw_failures` — is untouched, only the email-attempt is gone. Also refreshed the About module's live-API table: added the previously-missing `/admin/get-all-creditnotes`, `/dp-transactions` + `/dp-transactions/add`, `/dp-customers` + `/dp-customers/add`, and the weather history Cloud Function proxy (all genuinely in use, just never listed there); corrected the `/admin/get-all-submodules` description (was still describing its old, since-reverted role as Earned Revenue's row source instead of its current Start/End-date + Interval lookup role); and split the unauthenticated DP Transaction/DP Customers feeds into their own group instead of listing them alongside the Bearer-authed endpoints." },
  { v: "2.29.109", note: "Analytics > Earned Revenue: fixed Tenure days (and everything derived from it — Days in paid month, Earned revenue, Remaining Days/Months, the two Remaining Earned Total Revenue columns) counting one day too many on real API data. The paid date and end date were compared as raw parsed timestamps, which can carry different times-of-day depending on what the underlying string looked like (a plain date vs. a full datetime) — whenever the end date's time-of-day was more than 12 hours later than the paid date's, the day-count math rounded up and silently added a phantom day. All the date values feeding this calculation (paid date, submodule term start/end, the due-date fallback, and today's date for the Remaining columns) are now normalized to midnight with the existing `startOfDay()` helper before any arithmetic runs, so only whole calendar days are ever compared. Verified with a standalone reproduction: a paid date at midnight against an end date carrying a same-day-plus-14-hours timestamp gave 33 tenure days before this fix and the correct 32 after. Also removed the long explanatory sub-text under the \"Per-invoice recognition\" table header per request — the card now just shows its title. Customer module: added a new **DP Customers** tab reading the same kind of unauthenticated, cursor-paginated feed as DP Transaction (`GET /dp-customers`) — search across name/phone/device code/apartment/email, Apartment and Device Status filters with counts, KPI cards (DP Customers/Active devices/Paid litres/Balance litres), a sortable table (Installed On/Name/Balance Litres), CSV export, and the same admin-only Upload JSON → Run API bulk-import flow as DP Transaction (posts to `/dp-customers/add`)." },
  { v: "2.29.108", note: "Fixed the security deposit / recharge split to use each apartment's REAL policy amounts, given directly by the business, instead of the old generic amount-tiered guess (>₹4,000→₹4,000 deposit / >₹2,000→₹2,000 / >₹1,500→₹1,500) that applied everywhere. Two apartments' real numbers so far: MJR Clique Hydra (Own Device ₹1,500, Normal Device ₹1,500, Hot & Cold ₹3,000) and Prabhavati Meghna Towers (₹1,500 / ₹2,000 / ₹4,000) — more to be added as the business provides them; any apartment not yet listed keeps the old generic behavior unchanged. New `depositForCustomer(customer, plan, amount)` replaces `depositFor`/`depositForPlan` at every live call site that touches a deposit or recharge figure: Analytics Overview, Net Revenue, Earned Revenue, AOP, Apartment Performance, All Customers' profile (current-transaction card + lifetime security deposit), and Billing's Invoices + Deposits & Refunds (both gained a customer fetch/join they didn't have before, purely to read society + device type). Two confirmed-dead, unwired components (BalanceSheet, SubscriptionReconciliation) were left on the old generic logic since nothing renders them. CAUGHT AND FIXED THE SAME DAY, before this ever reached a released version: the first pass deducted the apartment's fixed deposit from EVERY invoice for a known apartment+device, including small recurring monthly recharges that never had a deposit in them at all (wrongly took ₹1,500 off a ₹450 payment) — deposit is only ever collected ONCE, so it's now only applied when the paid amount actually covers that tier; a smaller payment correctly recognises ₹0 deposit (the full amount is recharge). Also: when a customer's device type can't be read reliably (no/blank purifier ID on the record), a known apartment no longer falls through to the unrelated generic bands (which could return a number that isn't even one of the apartment's real tiers, e.g. ₹2,000 on a ₹3,350 MJR payment) — it now picks the largest of THAT apartment's own real tiers the amount actually covers, so ₹3,350 at MJR still resolves to the real ₹3,000 Hot & Cold deposit / ₹350 recharge either way." },
  { v: "2.29.107", note: "Analytics > Earned Revenue: rebuilt the per-invoice recognition formula to match the user's own worked spreadsheet examples exactly (verified to reproduce both: a 1-month recharge — paid 17 Aug, end 14 Sep, ₹450 → tenure 29 days, 15 days in Aug, ₹233 earned; and a 6-month recharge — paid 31 May, end 30 Nov, ₹594 → tenure 184 days, 1 day in May, ₹3 earned). Tenure now runs from the actual PAID DATE through End Date (was: from due date/Start Date through End Date) — this also structurally removes the old late-payment-clip and already-lapsed-tenure special cases, since the paid month can no longer be \"before\" the tenure starts by definition. Removed the Next month / Days in next month / Earned revenue (next month) columns entirely (the old one-month-ahead spillover view). Added four new columns after Earned revenue: Remaining Month and Remaining Days (how much of the tenure is left from today through End Date), and Remaining Days Earned Total Revenue / Remaining Month Earned Total Revenue (that remainder projected two ways — an exact day-count proportion, and the flat Earned/month rate × whole calendar months left). Table is now 18 columns, in the exact order specified: Invoice # / Reference Number / Apartment / Start Date / Paid on / End Date / Total paid / Deposit / Recharge / Interval / Earned/month / Tenure days / Days in paid month / Earned revenue / Remaining Month / Remaining Days / Remaining Days Earned Total Revenue / Remaining Month Earned Total Revenue." },
  { v: "2.29.106", note: "Analytics > Earned Revenue: hardened the invoice ↔ submodule lookup (used for Start/End date + Interval) with a fallback join on invoice_number, since both `get-all-invoices` and `get-all-submodules` carry it — the original invoice_id ↔ transaction_id key (from the explicit ask) stays the primary match, this only kicks in when that doesn't find one. Prompted by the Interval column showing blank on the live site even after the field mapping was confirmed correct against a real API record — the most likely cause is still the 3h submodules cache serving rows mapped before this field existed (fix: click in-app Refresh), but this fallback also guards against the possibility that invoice_id doesn't literally equal transaction_id in the live data, which can't be confirmed without seeing both a real invoice and its submodule match side by side." },
  { v: "2.29.105", note: "Analytics > Earned Revenue: added an Interval column (billing cadence — \"1 month\" / \"3 months\" / \"1 year\", etc.), placed right before Earned/month. Sourced from get-all-submodules' own `interval`/`interval_unit` fields via the same invoice_id → transaction_id lookup already used for Start/End date (v2.29.104) — reads \"—\" for any invoice with no matching submodule record, same as Start/End date's fallback." },
  { v: "2.29.104", note: "Analytics > Earned Revenue: reverted v2.29.103's switch to get-all-submodules as the row source, per follow-up feedback — the table is back to one row per PAID `get-all-invoices` record (Reference Number/Payment Mode/Apartment/Customer restored, 16 on-screen columns as before v2.29.103). get-all-submodules is still fetched, but now purely as a Start/End-date enrichment lookup: each invoice's own `id` (invoice_id) is matched against a submodule record's `id` (mapped from that feed's transaction_id); when a match exists, Start/End date use the feed's real current_term_starts_at/current_term_ends_at instead of the old due-date-based computation, and the earned-revenue math (tenureDays/daysInPaidMonth/spillover) runs on those real dates too; when no match exists, it falls back to the original due-date + \"1 calendar month − 1 day\" computation exactly as before. Also fixed a real bug found via a live Postman call: the submodules fetch was extracting zero rows because the live response wraps them in a top-level \"subscriptions\" key, not \"submodules\"/\"data\" as first assumed — silently and always falling back to sample data with no console error. Subscriptions API fetch restored to this screen (needed again for plan/term lookup, same as pre-v2.29.103)." },
  { v: "2.29.103", note: "Analytics > Earned Revenue: the per-invoice table's row source switched from `GET /admin/get-all-invoices` to the new `GET /admin/get-all-submodules` feed, per explicit request. New fields: Invoice # (invoice_number), Start date (current_term_starts_at), Paid date (paid_date), End date (current_term_ends_at), Total Paid (amount), Transaction ID (reference_number), Paid Using (account_name), Invoice ID (transaction_id, shown last) — table columns reordered to this exact sequence. The submodule feed carries no customer/apartment/plan of its own, so each row is joined back to a customer by looking up its subscription_id against the (still-fetched) invoices list — which now also maps a subscriptionId field — giving the Apartment filter, the plan (for the Deposit/Recharge split), and the customer-name/mobile search all a working link again. The earned-revenue formula itself is unchanged, but its inputs are now the feed's own real current_term_starts_at/ends_at rather than a start date read off the invoice's due date and an end date computed as \"+1 calendar month − 1 day\" — the new fields ARE the real term boundaries, so no more approximation needed. The Subscriptions API fetch was dropped from this screen entirely (no longer needed — plan/interval now come from the matched invoice)." },
  { v: "2.29.102", note: "Analytics > Earned Revenue: the per-invoice table's search box only matched customer name or apartment — added mobile number, joined from the customer record the same way the apartment/society already is (an invoice itself carries no phone field). Phone matching is digit-only on both sides, so searching \"8839452234\" finds a stored \"918839452234\" regardless of a country code or formatting. Placeholder updated to \"Search customer, mobile number or apartment…\"." },
  { v: "2.29.101", note: "The \"Server unavailable\" popup (see v2.29.98's per-tab TAB_SOURCES gating) still fully blocked entry into a section during an API outage — the only escape was \"Close Module\", which left the whole module. It's now DISMISSIBLE: a \"Continue anyway\" button lets the user go straight into the section and browse it (with sample/cached data + its own inline \"Showing sample data\" banner, same as always), while \"Close Module\" stays as a secondary option for anyone who'd rather leave. Copy updated to match (\"You can still go in — live numbers are paused...\", was \"Live numbers are paused\" phrased as if blocked). Dismissing only hides it for the current tab — switching tabs, or a genuinely new source going down, re-arms the popup so a fresh outage still gets surfaced." },
  { v: "2.29.100", note: "Fixed a real auto-logout bug: every session was hard-capped at exactly 60 minutes after login, REGARDLESS of activity — the Firebase ID token's ~1h life was enforced as a fixed setTimeout from login, with no renewal, so someone actively working got logged out on the hour just the same as someone idle. Firebase's sign-in response includes a refreshToken that was previously discarded; it's now kept (`pw_refreshToken`) and used by a new `api.refreshIdToken()` to silently renew the ID token a few minutes before it expires, as long as the session isn't already past the real 1h idle window — folded into the same periodic check that already drove idle/day-rollover logout, replacing the old separate fixed-timeout effect entirely. The only real logout triggers now are genuine 1h inactivity and the calendar day rolling over, same as the feature was originally intended to work. The old \"Your session expires in 5 minutes\" banner — which used to fire on a fixed schedule regardless of whether anything was actually wrong — now only appears if a silent renewal attempt genuinely fails (offline, or the refresh token itself has expired), reworded to reflect that (\"Trouble renewing your session — check your connection\"), and a real logout only follows if the original token then actually expires without a successful renewal." },
  { v: "2.29.99", note: "Customer > All Customers: the search-list view gained real filters — a signup-date range (\"All Time\" plus the same Today/…/Custom presets as everywhere else, filtering on each customer's `since` date), and Society / Status multi-select filters (same `MultiSelectFilter` component and \"All X (N)\"/\"Excluding…\" summary convention already used on the Customers page). Also added a **Device Type** column (`DeviceTypeBadge`, derived from the Purifier ID prefix) to the results table, matching how Customers already shows it. The empty-state message now distinguishes \"no customer matches these filters\" from \"no customers with a Purifier ID\" depending on whether any filter is active. All client-side over the already-loaded customer list — no new API calls." },
  { v: "2.29.98", note: "Fixed the \"Server unavailable\" popup blocking the WRONG sub-tabs. It used to gate an entire module on `MODULE_SOURCES` — e.g. Analytics was gated on ALL of customers/subscriptions/invoices/leads together, so if even one of those four Zoho endpoints was down, every Analytics sub-tab got the blocking popup, including ones that don't touch that data at all (DP Transaction reads its own separate, unauthenticated feed; App Logs reads Firestore; Credits reads its own credit-notes API). Added a new `TAB_SOURCES` map — the actual dependency list per sub-tab, read from each component's own fetch calls (e.g. `an_sales`/Sales Insights → leads only; `an_dptxn`/DP Transaction → none of the 4; `an_overview`/Overview → all 4, since it genuinely reads all of them) — and the blocking-popup gate now checks the ACTIVE TAB's sources first, falling back to the old module-level list only for tabs not explicitly mapped. Also split Billing & Subscription's sub-tabs the same way (Subscriptions → subscriptions only, Invoices → invoices only, was both for every tab) — Sales and Customer sub-tabs were already uniform (single shared source each) so no change there. A dead API doesn't lock a user out of a whole module anymore — only the specific section that actually needs it shows the popup; every other section stays fully usable (with the existing \"Showing sample data\" banner, same as before)." },
  { v: "2.29.97", note: "Removed every deterministic \"AI Summary\" / \"Business insights\" / narrative-insight panel dashboard-wide, per explicit request (\"all the summary and AI summary and overview... remove it off\") — none of these were ever an LLM call (see the AI summaries are deterministic note history), just plain JS reading the same live figures already shown elsewhere on each page, so nothing analytical is lost, only the restated-in-prose layer. Removed: Analytics > Overview's \"AI Summary\" card; Analytics > AOP's \"AI Summary\" card; Analytics > Sales Insights' \"Business insights\" panel; Analytics > Revenue (Net Revenue)'s \"Business insights\" panel; Analytics > Renewal & Churn Risk's \"Business insights\" panel; Analytics > DP Transaction's box-card \"Business insights\" panel (Period performance pill + What happened/Collection mix/Top performer + Needs attention + Recommended action); Customer > Societies' \"Customer retention insights\" panel; the in-card \"AI summary\" verdict box inside IoT Core > Device Monitor's Water Quality and RO Unit Sensors cards (both share `IoTWaterQualityCard`); and Ticketing > Ops Tickets' \"AI Insights\" callout under the Spares-used and Water-Quality TDS tables. Each removal deleted the panel's JSX plus the computation block that only fed it (verified via a full-function grep pass to confirm no cross-use in KPI cards/charts/tables before deleting) — no dead code left behind. Explicitly kept, since they're factual stat displays rather than narrative summaries: IoT's \"Dispense Summary\" hero card and CustomerDrawer's \"Aging summary\" card." },
  { v: "2.29.96", note: "Sales > Trend Analysis: the lead conversion funnel now uses the SAME Total Leads / Interested / Not Interested / Converted hierarchy as the monthly trend chart above it (was Total leads → Contacted+ → Demo+ → Proposal+ → Converted (Won), a different stage-bucket breakdown) — each row still shows both its count and its % of Total Leads, same bar-list visual. `interestedN`/`notInterestedN` computed the identical way as the chart (literal Zoho raw lead status \"Interested\", Not Interested = Total − Interested − Converted). Removed the now-dead `STAGE_ORDER`/`rankOf`/`reached` helpers that only the old funnel breakdown used." },
  { v: "2.29.95", note: "Sales > Trend Analysis: removed the \"Sales Director's read\" panel (What happened/What's ongoing/Result + Positive/Where it's going wrong + recommended actions) per explicit request — the page now goes straight from the KPI cards to the monthly trend chart. Removed the whole computation block that only fed it (openLeads/idleDays/idleLeads, the groupConv/bestOf/worstOf channel-society-rep grouping helpers, and the pos/neg/acts/happenedLine/ongoingLine/resultLine strings) since nothing else in the tab depended on them — no dead code left behind." },
  { v: "2.29.94", note: "Sales > Trend Analysis: the v2.29.93 stacked-bar version of the monthly trend chart was squeezing data labels into small segments (unreadable when a category's count was low). Per confirmed feedback, switched from stacked to GROUPED (side-by-side) bars — Total Leads / Interested / Not Interested / Converted each now render as their own full-height bar per month (not stacked inside one), so every label sits above its own bar with guaranteed room, plus the Conversion % line stays overlaid on the secondary axis. Total Leads is now its own explicit bar (previously implicit as the stack's total height) — matches the literal 4-item hierarchy requested (Total Leads, Interested, Not Interested, Converted). The \"latest month\" flash moved from the topmost stacked segment onto the Total Leads bar (brand-green fill + pulsing dot), since that's the lead bar in each month's group." },
  { v: "2.29.93", note: "Sales > Trend Analysis: iterated on the v2.29.92 tab per direct feedback on a first look. (1) Added an Apartment/society multi-select filter (`MultiSelectFilter`, same component used elsewhere), cascading through the KPI cards, insights, chart and funnel. (2) Added a Rep leaderboard + an Idle-leads follow-up table, then REMOVED both again per a later ask — kept simple. (3) The monthly trend chart went from bar+line → dual lines with click-to-drill-down (a stage-breakdown panel per clicked month) → back to bars, and finally to its current shape: three STACKED bars per month (Interested / Not Interested / Converted, summing to Total Leads) plus a Conversion % line on the secondary axis, with data labels on every segment and a \"Total N\" label above each month's stack. \"Interested\" is the literal Zoho raw lead status text (`rawStatus.toLowerCase() === \"interested\"`, already mapped to the \"demo\" stage bucket in `mapZohoLead` — but identified here by its own raw text, not the stage bucket); \"Not Interested\" = Total − Interested − Converted, so the three segments always sum to the full stack height. The latest month's Converted (topmost) segment still pulses via the same SVG `<animate>` technique used elsewhere. (4) Added an \"Average time to convert\" card (hero stat + Fastest/Slowest) between the chart and the funnel — computed from each WON lead's created→updated gap (same \"last touched\" proxy idle-lead tracking already uses), with a period-over-period delta in days. (5) The lead-conversion funnel was briefly rebuilt as an actual tapering funnel (stacked CSS-clip-path trapezoids) per an ask to \"show like an actual funnel\", then reverted back to the original horizontal-bar-list style per a follow-up — net no change there from v2.29.92's shape. All changes were proposed via AskUserQuestion and confirmed before implementing, per the user's explicit \"show me options, I'll confirm\" instruction for this tab." },
  { v: "2.29.92", note: "Sales: new \"Trend Analysis\" tab (`sales_trend`, between Sales Analytics and Error Correction) — built as a Sales-Director-style read of the pipeline, using the same lead/stage data as Analytics > Sales Insights but scoped to a real date-range picker (Today/This Week/This Month/…/Custom via the shared DateRangePicker) instead of just a society filter. Layout, per an explicit spec: (1) KPI cards up top — Total leads / Converted (Won) / Conversion % / Lost — each with a period-over-period delta badge (Total/Converted/Lost use real MoM-style % change via the shared `momPct`; Conversion % shows a percentage-POINTS delta instead, since a %-change-of-a-% would misread — e.g. 12%→15% is \"+3pts\", not the confusing \"+25%\" momPct would compute). (2) A \"Sales Director's read\" panel — the same deterministic What-happened/What's-ongoing/Result + Positive/\"Where it's going wrong\"/recommended-actions shape used elsewhere in this app (see Analytics > Sales Insights, Net Revenue, DP Transaction), but every comparison now uses `prevRange(sel.preset, range)` so it's correct for whichever period is selected (This Week vs its previous week, This Month vs its previous month, etc.) rather than being hardcoded to calendar months; idle-lead tracking (>14 days untouched) stays a \"right now\" operational signal, not period-scoped, matching how idle leads are conceptually always current. (3) A monthly leads-vs-conversion-% trend chart (bar = leads, line = conversion %, trailing 8 calendar months, independent of the period picker since a month-on-month view needs several months regardless) — the LATEST month visibly flashes: its bar renders in the brand green with a small pulsing dot above it, and its conversion-% line point pulses with an expanding ring, both using the same SVG `<animate>` technique already proven in IoT's weather-correlation \"likely taste issue\" marker. (4) The lead-conversion funnel (Total leads → Contacted+ → Demo+ → Proposal+ → Converted, with drop-off % at each step) is placed LAST per explicit instruction — the same funnel visual already used in Sales Insights, scoped to the selected period. All deterministic, no LLM." },
  { v: "2.29.91", note: "IoT Core > Device Monitor: fixed the tank photo's visible corner artifact from v2.29.90's mix-blend-mode/mask hack — that CSS trick left a faint gray vignette at the edges because the studio backdrop wasn't quite pure white, so multiply alone couldn't fully erase it. Replaced it with REAL background removal: ran the 4 source photos through a proper chroma-key pass (Pillow — sample the true background colour from all 4 corners, turn pixels close to it fully transparent with a soft distance-based ramp for anti-aliased edges, tight-crop the transparent margins, then palette-quantize to keep file size down) producing genuine alpha-transparent PNGs (~110-135KB each) that composite cleanly onto any card background with zero visible seam — verified by compositing test copies over bright green and mint backgrounds before shipping. The CSS multiply/mask workaround is removed entirely; `.pw-tank-photo img` is back to a plain `<img>`. `IOT_TANK_PHOTOS` now points at `.png` instead of `.jpg`." },
  { v: "2.29.90", note: "IoT Core > Device Monitor: the RO-tank graphic is now built from real ProWater product photography instead of a CSS-drawn illustration — the user supplied actual photos of the physical tank at Empty/25%/50%/75% fill (`Tank Photos/` at the project root, copied into `public/tank/` as web-optimised JPEGs, ~90KB each down from ~1.5MB PNGs). This works cleanly because the tank's real feed is 4 physical float switches, never a continuous sensor reading — `iotTank()` only ever returns exactly 0/25/50/75/100, so there's no interpolation needed: `IoTTank` now just picks the one real photo matching the live switch state, no blending logic. The old hand-drawn tank (moulded shell, animated waves/bubbles, refill pump rig, warming vapour wisps, tick-mark scale) is removed along with all its now-unused CSS — the \"Refilling\"/\"Warming\" status pills are kept as simple badges overlaid on the photo (dropped a duplicate \"Warming\" pill that briefly showed twice — the panel header already has one). Two follow-up polish fixes from the first look: (1) enlarged the photo (`.pw-tank-photo` max-width 230px → 340px, panel `minHeight` 300 → 380) — it read too small next to the readout column; (2) the photo's light-gray studio backdrop showed as a visible box against the card's white background — fixed with `mix-blend-mode:multiply` (turns near-white studio pixels effectively transparent against the white/near-white card) plus a soft radial `mask-image` fading the very edge, so the tank now sits directly on the card with no visible seam. KNOWN GAP: no real \"tank full\" (100%) photo was supplied — falls back to the 75% photo for that state until one is provided (flagged with a code comment + TODO)." },
  { v: "2.29.89", note: "IoT Core > Device Monitor: a side-by-side pixel comparison against the mockup's tank graphic found exactly one visual difference — the tank's moulded brand text reads \"ProWater\" (with a droplet icon) where the mockup shows \"SINTEX\" over a small tracked \"WATER TANK\" caption, no icon. Tried swapping it to match the mockup exactly, then reverted straight back to \"ProWater\" + the icon per the user's follow-up — this dashboard's own brand stays on the tank graphic, not the mockup's placeholder tank-manufacturer name. Everything else on the tank (shell shape, cap, water fill, scale, float-switch list) was already a close match to the mockup, confirmed by direct comparison — no other changes." },
  { v: "2.29.88", note: "IoT Core > Device Monitor: the user shared a fuller version of the mockup from v2.29.87, confirming the rest of the RO-tank view (KPI row, device list, tank panel, Water Quality, Trend analysis, anomaly history, weather correlation, Recent readings) already matches its design closely, including a real live screenshot that lined up with what's already shipping. One concrete correction from the fuller code: the mockup puts the Today/Yesterday/This Week/This Month/Last Month range chips ON the \"Dispense Summary\" card itself (above the Total dispensed number) — the v2.29.87 version had dropped them from that card on the assumption Trend analysis/Recent readings' copies were enough. Added them back to `IoTDispenseSummaryCard` (same shared `range`/`setRange` state as everywhere else in the module — picking a period on any of the three copies updates all of them)." },
  { v: "2.29.87", note: "IoT Core > Device Monitor: after a user-provided mockup (tank-focused, no Tailwind in this codebase so read as a visual spec), audited the RO-tank view against it feature-by-feature — found the current implementation already covers, and in most cases exceeds, everything the mockup shows (the real gauges with ideal-band zones/ticks, the segment-coloured trend chart with anomaly scanning, the Contamination/Tank/Dead-device filtered Recent-readings table, and the weather-correlation \"What this means\" narrative are all more capable than the mockup's simplified static versions of the same ideas) — so those were deliberately left alone rather than downgraded. The one genuine gap: \"Total dispensed\" was a small stat tucked inside the RO Unit Sensors card; promoted it into its own standalone, full-width \"Dispense Summary\" hero card (big total-litres headline + average-per-day on the right), matching the mockup's prominence for this figure. Per explicit scope decisions: the fleet KPI row (Total/Online/Offline/With faults) and the live fault-alert/toast system stay, since the mockup simply didn't include a snippet for them; the junctionBox device view (pressure/channels/consumption — a completely different device type the mockup doesn't address) is untouched; the Water Quality card keeps its existing real pH/TDS/Temp data with RAG bands + AI summary, which already satisfies \"real data in this card\" better than rebuilding it down to the mockup's plain placeholder." },
  { v: "2.29.86", note: "Analytics > DP Transaction: visual redesign to match a provided mockup, same underlying data/logic throughout (no figures changed) — same treatment as the v2.29.85 Reconciliation redesign, this codebase has no Tailwind so the mockup was read as a layout/visual spec only and reimplemented with inline styles + the existing `:root` CSS vars. The KPI row (now 3 cards — Total/Recharge/Deposit Collected, was 2) moved above Business insights. Business insights was rebuilt into a box-card layout: 3 top boxes (What happened / Collection mix / Top performer) + a Needs attention box for idle apartments + a dashed Recommended action box, with a \"Period performance\" pill (up/down arrow + MoM %) in the header. \"Deposit vs Recharge split\" became \"Collection composition\" — a thinner split bar plus two side-by-side amber/green detail boxes — now paired in a 2-column grid with a rebuilt \"Apartment performance\" section: ranked cards with a numbered badge (green-filled for #1), a progress bar sized to each apartment's share of the top total, a txn-count + deposit/recharge footer, and a distinct \"No activity\" pill for idle apartments (was a plain `Stat`-component grid before). The Transactions table's Payment/Transaction Type filters switched from grouped bordered buttons to individually-bordered pill chips; the Type column got a leading status dot; Device became a small mono badge chip; Validity/Litres/Deposit/Revenue columns right-aligned; a \"N records\" badge was added next to the table title; and the admin-only Upload JSON button became a solid filled button (was ghost-style, same as Export) to visually separate it from Export." },
  { v: "2.29.85", note: "Analytics > Reconciliation: visual redesign to match a provided mockup, same underlying data/logic throughout (no numbers changed). The \"Outstanding balance\" waterfall now shows Opening/New dues/Payments/Closing as connected blocks with +/−/= operator badges, a \"Reconciled\"/\"Check needed\" pill, and a dedicated Verification panel (was plain text before). Added a new \"Period overview\" card — a 3-bar Due/Collected/Receivable snapshot for just the selected period — alongside it (the existing multi-month trend chart stays, unchanged, further down). The invoices table gained avatar-initial badges per customer, dot-style status badges, a combined search+status-tabs toolbar (pill-group style), and real pagination (15/page, Previous/Next, \"Showing X of Y\") — it previously rendered every row in one scrolling list. Dropped the \"Days late\" column from the table (folded into the Late badge instead, e.g. \"Late · 3d\") to match the mockup's column set; still in the CSV export." },
  { v: "2.29.84", note: "Analytics > Earned Revenue: removed Invoice ID, Payment Mode and Customer from the per-invoice table's visible columns (now 16 wide — Invoice #, Reference Number, Apartment, dates, amounts…) — footer colSpan adjusted 9→6 to match. All three stay in the CSV export unchanged, so nothing exported is lost, just decluttered on screen." },
  { v: "2.29.83", note: "Analytics > Earned Revenue: added Reference Number and Payment Mode as two more columns in the per-invoice recognition table (right after Invoice ID) and its CSV export — both are now returned by GET /admin/get-all-invoices. `mapInvoice()` maps the new `reference_number`/`payment_mode` fields; shows \"—\" for older cached invoices or sample data that predate them." },
  { v: "2.29.82", note: "Two new features. (1) Analytics > Renewal & Churn Risk (new tab, `an_churn`): flags customers whose subscription renews within 30 days, who have an overdue/failed invoice, or whose account is in Zoho \"dunning\" — reuses the exact renewal-due and overdue-detection logic already live in Billing Analytics/Billing Overview, joined onto one customer-level risk table with a High/Medium/Low score, KPI cards, a deterministic Business insights panel, and CSV export. Deliberately does NOT add an IoT \"device gone quiet\" signal — there's no existing join between a customer's purifier_id and the real IoT device fleet, so faking one would be misleading. (2) Customer > All Customers > per-customer view gained an always-visible \"at a glance\" strip (Status, Customer score, LTV, Open tickets, Last payment, Referral code — visible on every sub-tab, not just Profile) and a new \"Timeline\" tab merging payments, tickets, referrals and discount/credit-note events into one chronological feed, so a customer's whole relationship can be read without clicking between the Transactions/Tickets/Ops/Referral tabs individually." },
  { v: "2.29.81", note: "Analytics > DP Transaction: three changes. (1) Fixed the \"Performance by apartment\" KPI cards showing only 4 of the 6 apartments in the Apartment filter — it was silently dropping any apartment with zero transactions in the current filters; now shows all 6 (idle ones read \"No activity this period\"), with a \"N of M active\" count in the section header. (2) Added a deterministic \"Business insights\" panel (What happened / What's ongoing / Result / Positive / Negative / recommended actions — same pattern as Net Revenue and Sales Insights, no LLM involved) covering the collection trend vs previous period, the recharge/deposit mix, the top apartment, and which apartments went idle. (3) Both the aggregate Deposit/Recharge KPI cards and each per-apartment card now show a live Deposit-vs-Recharge split percentage (plus a new stacked-bar \"Deposit vs Recharge split\" card) — recomputed from whatever's actually in the current date/apartment/type filters, never a fixed ratio." },
  { v: "2.29.80", note: "Analytics > Earned Revenue: added Invoice # and Invoice ID as the first two columns of the per-invoice recognition table (and to its CSV export) — makes it possible to trace any recognised-revenue row back to the exact invoice it came from." },
  { v: "2.29.79", note: "Removed ProWater AI entirely — the floating chat assistant, its Sparkles button, and every setAIContext/getAIContext call across every module were pulled out (this reverses v2.29.74 through v2.29.78). The Home page's lightweight customer/invoice snapshot fetch (added in v2.29.78 solely to feed the assistant) was removed too. The deployed Cloud Function backend (asia-south1-backend-prowater.cloudfunctions.net/aiChat) was also undeployed via `gcloud functions delete`. The source for the Cloud Function still lives in `functions-aiChat/` at the project root if this is ever revisited — nothing about the rest of the dashboard depended on it." },
  { v: "2.29.78", note: "ProWater AI: fixed a real gap where asking a basic global question (\"what is the active customer count\", \"total revenue collected\") from the Home/Overview landing page — before opening any specific module this session — got \"I don't have access to that\" even though the figures are simple lookups. Home() now fetches a lightweight customer + invoice snapshot on load (both endpoints are already request-cached, so this adds no real load) and publishes it as a baseline — total/active/inactive customers, total revenue collected, and module count. Any module's own richer context still overrides this the moment it's visited, so this only fills the gap before the user has navigated anywhere. Verified live: asked \"what is the active customer count and total revenue collected\" straight from the Home page and got back the correct figures (6 active customers, ₹39,000 collected) instead of the old \"I don't have that data\" fallback." },
  { v: "2.29.77", note: "ProWater AI: extended live-data context to every remaining module and sub-module in the app — Sales (Pipeline, Leads & Deals, Apartment Leads, Sales Analytics, Error Correction), Referral (Overview, Referrers, Referees, Credits, Tracker, Backtrack), Customer (All Customers, Societies), Billing & Subscription (Overview, Subscriptions, Invoices, Deposits & Refunds), FSM (Track Technician, AMC/Maintenance, Water Quality), ERP (Asset Lifecycle), Auto Scheduler (Auto GS - Society, IoT Alerts), Ticketing (Overview, Tickets, Ops Tickets), IoT Core (Alerts), Analytics (Referral, Sales, AOP, Revenue, Penetration Tracker, Credits, App Logs), Task Planner (Board, Weekly View, Modify Tasks), Employee (Users), Device Replacement, Logs Tracker (All Logs, Failures, API Usage), and About. Every screen in the tool now publishes a small KPI summary the assistant can read — up from 8 modules in v2.29.76 to effectively all of them. Illustrative/sample-data screens (Track Technician's demo fleet, FSM Water Quality's synthetic TDS readings, ERP Asset Lifecycle's synthetic depreciation, Auto Scheduler's IoT Alerts) publish an explicit note saying so, so the assistant doesn't present placeholder numbers as real. Verified live: asked ProWater AI \"how many open alerts and devices watched right now\" from the IoT Alerts screen and got back the exact on-screen figures (5 open alerts — 4 High, 1 Medium — and 2 devices watched)." },
  { v: "2.29.76", note: "ProWater AI: extended live-data context from 3 modules to 8 — added Analytics Overview (total collection, net/earned revenue, deposits, active customers, MRR, societies, pending receivables, open tickets), Customers (total/active/inactive, device-mix, new-this-month, society count), Billing Analytics (MRR, ARR, cash vs recognised this month, outstanding, churn rate, credits), IoT Core Device Monitor (device/online/offline/faulty counts, active alerts, selected device's tank level and total dispensed), and Apartment Performance (collected/recharge/deposit totals, group count, scope). Fixes a real gap: asking \"what is the revenue\" or \"how many active customers\" from the Overview page previously got \"I don't have that data\" even though those exact figures are shown right there on screen — now answered correctly (verified live: correctly read back ₹0 revenue / 5 active customers / ₹3,299 MRR from the actual Overview page's own numbers). Still 12 of ~20 modules unwired — same one-line context pattern extends coverage further." },
  { v: "2.29.75", note: "ProWater AI is now LIVE — the Cloud Function proxy is deployed at https://asia-south1-backend-prowater.cloudfunctions.net/aiChat and verified answering real questions, including live-data-aware ones (tested against a simulated Earned Revenue screen context, correctly read the figures back). Also fixed a real deploy-time bug: `gemini-2.0-flash` (the model this shipped with in v2.29.74) had been deprecated/removed by Google since — the function now calls `gemini-flash-latest` instead, an alias Google keeps pointed at their current flash-tier model, specifically so this doesn't silently break again next time a dated model name is retired." },
  { v: "2.29.74", note: "New: ProWater AI — a floating assistant (Sparkles icon, bottom-right) available on every screen once logged in. Answers questions via a Gemini (Generative Language API) call routed through a new Cloud Function proxy (`functions-aiChat/`, project root) — same shape as the existing weather-proxy/ Cloud Function (plain Google Cloud Function, 2nd gen, deployed via `gcloud functions deploy`, no Firebase CLI). The API key is a deploy-time flag (`--set-env-vars GEMINI_API_KEY=...`), never a line of code anywhere. Live-data awareness: modules publish a small KPI summary of what's currently on screen; wired into Earned Revenue, DP Transaction, and Reconciliation so far (more modules can adopt the same pattern later). Fallback handling: on any failure (network error, timeout, HTTP error, or the backend explicitly saying it couldn't answer), the widget shows an apologetic message and logs the question to `localStorage` (`pw_ai_unanswered`, capped at 200 entries) for later review, rather than pretending to answer. `AI_ENDPOINT` currently points at a URL that isn't deployed yet — update it once the Cloud Function is live." },
  { v: "2.29.73", note: "Analytics > Earned Revenue: fixed a real correctness bug found during a logic audit. Per-invoice recognition only ever checked the invoice's PAID month and paid-month+1 for overlap with its validity window — so an invoice paid more than ~1 month after its own validity window had already lapsed (e.g. due 1 Jul, validity ends 31 Jul, not paid until 5 Aug) found ZERO overlap in both checks, and showed ₹0 Earned Revenue despite the cash being collected in full. Fixed: when the validity window ends before the paid month even starts, the WHOLE recharge is now recognised in the paid month instead (nothing left to spread forward once payment is that late — cash and revenue converge). Verified with a temporary seed invoice (due 1 Jul, paid 10 Aug, ₹1,000 recharge): now correctly shows Days in paid month = 31, Earned revenue = ₹1,000 (was 0/₹0 before the fix). This gap never affected the sibling `invoiceMonthlyBreakdown()` formula used on the All Customers card — that one always walks the invoice's own due-to-validity-end months regardless of how late payment lands. Also added a click-to-sort control on the Earned revenue column — it was the table's default sort key on load but had no header button, so once you sorted by any date column there was no way back to it without a refresh." },
  { v: "2.29.72", note: "Customer > All Customers > Transactions: two additions. (1) In the \"Current paid transaction\" card's calculation detail, Earned revenue rows now show the actual day-range each amount covers (e.g. \"22 Jun – 30 Jun\", \"01 Jul – 21 Jul\") instead of a single date — makes it clear exactly which days each month's slice counts, not just when it was recognised. (2) Added a \"GST breakup\" card, shown BEFORE the revenue-recognition card, backing out Taxable value / CGST (2.5%) / SGST (2.5%) from the invoice's actual paid amount (assumes the standard flat 5% split — GST isn't a field the API returns, this reverse-calculates it; independently-rounded components can be ±₹1 off the total, same minor rounding gap present in the reference sheet this was modelled on)." },
  { v: "2.29.71", note: "Customer > All Customers > Transactions: reworked the \"Current paid transaction — revenue recognition\" card — it was reading too big. Now a compact 5-row summary (Due date, Payment date, Recharge tenure, Earned revenue, Collected Revenue), each with its own icon, Collected Revenue showing \"Fully collected\" or \"₹X still outstanding\" underneath. The full month-by-month workings (previously always shown) now live behind a \"Show/Hide calculation\" expand-collapse toggle, closed by default — and that expanded detail was rebuilt as fixed-width flex rows instead of the shared full-bleed `<Table>`, which was stretching to the card's full width with no column constraints and leaving large blank gaps around the short date/amount values. Also moved the card BELOW the payments table (was above it) — transactions history first, revenue-recognition detail second." },
  { v: "2.29.70", note: "Analytics > DP Transaction: three changes. (1) Removed the Transaction key and Transaction type columns from the table (still visible nowhere else — they were mostly redundant with the Type badge and added width without much reading value). (2) Added \"Performance by apartment\" — a row of KPI cards, one per apartment with any activity in the current filters, showing Recharge Collected + Deposit + transaction count, sorted highest-recharge first, so apartments can be compared at a glance instead of only seeing the fleet-wide total. (3) Start Date and End Date columns are now click-to-sort (same arrow-icon pattern as Paid date) — sort is now a single `{key, dir}` state shared across all three date columns instead of a Paid-date-only boolean." },
  { v: "2.29.69", note: "IoT Core > Device Monitor: Pressure and Flow rate no longer rate WARNING/CRITICAL at any reading. These two are pump-driven, not water-quality metrics — 0 while the pump is off (nothing to read), and whatever the line reads once the pump kicks on, at any magnitude; confirmed with the person who placed the sensors that neither end is a real anomaly (a 655 bar spike is a normal artifact of how this sensor reads on pump start, same as the 0 while idle). `iotWqClass` now always returns \"green\" for `pressure`/`flowMLPM` — this single change cascades correctly to every screen that reads it: the RO Unit Sensors card (badge + AI summary, now reassuring instead of alarming), its gauges (fully green track, no amber zone), the Recent-readings table (no more red/amber highlighting on these two columns), and the Trend analysis \"Anomalies by metric\" tile (Pressure/Flow now always count 0). Water Quality (pH/TDS/Temp) is untouched — those remain real anomaly-eligible metrics. Also reworded the card's \"Ideal: 0–4 bar\" subtext to \"Pump off = 0, pump on = live reading — both normal\" for these two, since there's no longer an enforced ceiling to imply." },
  { v: "2.29.68", note: "Analytics > DP Transaction: added a Transaction Type filter (chips on the feed's own `transaction_type` field — APP / PAYMENT_LINK / etc — next to Payment Type). DISCOUNT-type rows are now excluded from this view entirely (table, KPIs, CSV) — they're a non-cash discount adjustment, not real recharge collected (confirmed live: every DISCOUNT row has `revenue_amount`/`deposit_amount`/`transaction_amount` all zero, so this doesn't change any KPI figure, just removes zero-value noise rows from the table)." },
  { v: "2.29.67", note: "Analytics > DP Transaction: added an admin-only \"Upload JSON\" control at the top right. Choosing a .json file validates it client-side (extension + that it actually parses); once valid, the control becomes a \"Run API\" button that POSTs the file as multipart/form-data (field `file`) to `POST /dp-transactions/add`. The raw response — success or failure — is shown verbatim in a popup (pretty-printed JSON body, HTTP status, and a plain-English error message extracted from `message`/`error`/`detail` on failure). A successful run also silently refreshes the table with the newly-imported data. Non-admins never see the control at all (`user.role === \"admin\"`, same convention as Credits)." },
  { v: "2.29.66", note: "Customer > All Customers > Transactions: added a \"Current paid transaction — revenue recognition\" breakdown card above the payments table, for the customer's most recent paid invoice. Shows Due date and Payment date, the Recharge tenure (start/end/days), then a month-by-month split of Earned revenue (accrual), Collected Revenue (cash-basis) and Outstanding revenue (receivable) — verified exactly against the user's reference spreadsheet (Sanjith/MJR: due 7/26, paid 8/1, ₹350 recharge → tenure 31 days, ₹68 earned in Jul + ₹282 in Aug, ₹0 collected in Jul + ₹350 in Aug, ₹350 outstanding as of Jul-end + ₹0 once paid). New `invoiceMonthlyBreakdown()` helper generalizes Earned Revenue's per-invoice month-split math to show EVERY touched month (including the accrual before actual payment, which Earned Revenue's own table never surfaces — that table only shows an invoice's paid-month slice)." },
  { v: "2.29.65", note: "Analytics > DP Transaction: three changes. (1) Validity and Litres now MERGE onto the TRANSACTION row when its Paid_Date exactly matches its COLLECTION_SUMMARY twin (same collection event, same timestamp down to the microsecond) — previously those two fields only ever showed on the COLLECTION_SUMMARY row and were blank on the default-shown TRANSACTION row. CSV export uses the same merged value. (2) Removed the City column from the table (still exported in the CSV). (3) Added pagination — 50 rows per page, Prev/Next controls, resets to page 1 on any filter/search change; the Grand Total footer still sums the FULL filtered set, not just the visible page." },
  { v: "2.29.64", note: "Analytics > DP Transaction: fixed two layout bugs from the v2.29.63 column additions. The Type badge (row_type pill) was wrapping \"TRANSACTION\"/\"COLLECTION_SUMMARY\" across three lines inside itself, ballooning row height — now stays on one line. The Transaction key column was showing the full 36+ character raw key (e.g. `DPTX_36b1c5a1fabf498eabbc58aa59c1adab`), also wrapping across multiple lines — now shows a short truncated form (`36b1c5a1…`, `DPTX_` prefix stripped) with the full key available on hover. Both cells are back to single-line row height, matching the rest of the table." },
  { v: "2.29.63", note: "Analytics > DP Transaction: added six raw feed columns to the table — Transaction key and Transaction type (`transaction_key`/`transaction_type`), Start Date and End Date (the feed's own `t.validity_start_date`/`t.validity_end_date`, distinct from the invoice Start/End Date used in Earned Revenue), Validity, and Litres — placed between Type and Plan, also added to the CSV export. Like every other field in this feed, these are split across the two row types: Transaction key/type/Start Date/End Date only populate on TRANSACTION rows, Validity/Litres only on the COLLECTION_SUMMARY twin — shown as \"—\" on whichever row doesn't carry them, same complementary-null pattern as Deposit/Revenue." },
  { v: "2.29.62", note: "Analytics > DP Transaction: added click-to-sort on the Paid date column (arrow indicator, defaults descending — newest first); a Grand Total footer row summing Deposit and Revenue for whatever's currently shown (respects the date range, apartment, payment-type and search filters); and a previous-period percentage delta on both KPI cards (Deposit Collected, Recharge Collected), comparing against the immediately-preceding period of the same length as the selected range — same ▲/▼ badge convention used on every other KPI card in the app." },
  { v: "2.29.61", note: "Analytics > DP Transaction: added a Payment Type filter — chips labelled with the raw `row_type` API value verbatim (\"TRANSACTION\", \"COLLECTION_SUMMARY\"), each showing a live count, plus an \"All\" option. Defaults to TRANSACTION only (the row carrying `deposit_amount`/`revenue_amount`, the KPI fields — its COLLECTION_SUMMARY twin has those null), so the table no longer shows every collection event twice out of the box." },
  { v: "2.29.60", note: "Analytics: new \"DP Transaction\" tab (between Reconciliation and AOP), reading `GET https://api-7ca73ntgua-el.a.run.app/dp-transactions` — an unauthenticated, cursor-paginated feed (`{ transactions, has_more, next_cursor }`, not page-number based, so it gets its own fetch loop, `fetchAllDpTransactions`, capped at 80 pages / ~2000 rows with a truncation notice). Filters: a custom date-range picker on `Paid_Date` (native `Date` parses its `\"YYYY-MM-DD HH:MM:SS.ffffff\"` format directly), and an Apartment multi-select sourced from the feed's own `partner_name` values (not a separate societies list). KPI cards: Deposit Collected (`Σ deposit_amount`) and Recharge Collected (`Σ revenue_amount`), both null-safe. Table shows raw rows unmerged — each collection event appears as both a COLLECTION_SUMMARY row (has `Deposit`/`Recharge_received`/`collection_total`, `deposit_amount`/`revenue_amount` null) and a TRANSACTION row (the reverse), tagged with a Type badge. Search covers `phone`, `current_device`, `partner_name`. CSV export." },
  { v: "2.29.59", note: "Analytics > Reconciliation: rewrote the AR roll-forward in plain language — \"AR roll-forward\" → \"Outstanding balance, step by step\"; \"Opening/Closing Balance\", \"Due Added\", \"Collected\" → \"Owed before this period\", \"Newly due this period\", \"Actually paid this period\", \"Still owed at period end\". Added a one-line ₹-value equation above the cards (already owed + newly due − actually paid = still owed) and an invoice count under each figure (e.g. \"2 unpaid invoices from earlier\") so the calculation is visible at a glance, not just the result. Simplified the tie-out line (\"Ties to independent outstanding-balance check\" → \"Verified — matches the total of all unpaid invoices\") and the advance-receipts memo." },
  { v: "2.29.58", note: "Analytics > Reconciliation: added a standard accounts-receivable roll-forward — Opening Balance + Due Added − Collected = Closing Balance. Opening Balance = every invoice due before the selected period that wasn't collected as of the period's start (carried-forward backlog, previously missing entirely — the tab only analysed each period's own dues in isolation). \"Collected\" here excludes advance receipts (cash for invoices not yet due — reported as a separate memo line, not netted, since they aren't part of AR yet). Closing Balance is cross-checked against an independent sum (every invoice due on/before period end, still uncollected) with a visible tie/mismatch indicator — the two must always agree by construction. The four ledger cells match the KPI cards' exact typography (`eyebrow` label class, DM Sans 800-weight value) instead of the serif headline font used elsewhere." },
  { v: "2.29.57", note: "Analytics: new \"Reconciliation\" tab (between Earned Revenue and AOP), with a custom date-range picker and an Apartment (society) multi-select filter, same pattern as Earned Revenue. Fixes a real bug: \"collected revenue\" elsewhere in the app was effectively bucketed by an invoice's DUE date, not when the payment actually landed — e.g. due 28 Jul, paid 3 Aug was showing as July revenue. This tab separates the two views: Due in period (accrual, by due date), Collected in period (cash-basis, by actual paid_date — the corrected figure), Collected on time (of what was due, paid within its own due-month), and Receivable (due in a period but not collected by that period's end — whether it was paid late in a LATER period, or never paid at all). A monthly Due/Collected/Receivable trend chart and a per-invoice table (search + On time/Late/Outstanding filter chips, Days Late) back it up. Verified against the exact reported example (due 28 Jul, paid 3 Aug): shows ₹0 collected + full Receivable in July, correctly shows the full amount as Collected in August. The old unused `Reconciliation()` component (invoice↔subscription matching, never wired into any tab) was renamed `SubscriptionReconciliation()` to free up the name — it's dead code, kept as-is otherwise." },
  { v: "2.29.56", note: "Analytics > Earned Revenue > Per-invoice recognition: added the SPILLOVER month split. When an invoice's validity window (End Date) reaches into the calendar month after the paid month (e.g. paid in August, end 7 Sept), three new columns show that slice: Next month, Days in next month, and Earned revenue (next month) — same `recharge × days / tenureDays` math, no late-payment clip (payment has already landed by then). \"—\" when the tenure doesn't cross into another month. Table footer and CSV both include the next-month total." },
  { v: "2.29.55", note: "Analytics > Earned Revenue > Per-invoice recognition: fixed \"Days in paid month\" counting days before the invoice was actually paid, when the due date and paid date fall in the same calendar month. Example: Arun K Sinha, due 8 Aug, paid 10 Aug, end 7 Sept — previously counted from the due date (8 Aug → 31 Aug = 24 days, ₹271 earned), now counts from whichever is later, the due date or the actual paid date (10 Aug → 31 Aug = 22 days, ₹248 earned). Only affects invoices paid a few days into their own due-date month; the reference-sheet example (due/paid in different months) is unaffected since the paid date never became the binding boundary there." },
  { v: "2.29.54", note: "Analytics > Earned Revenue > Per-invoice recognition: reordered and renamed columns — was Due Date, Next Billing, Paid on; now Start Date, Paid on, End Date (Due Date → Start Date, Next Billing → End Date). Underlying fields/sort keys (`dueDay`/\"due\", `nextBillDay`/\"nextBilling\") are unchanged — display only. CSV export column labels updated to match." },
  { v: "2.29.53", note: "Analytics > Earned Revenue > Per-invoice recognition: removed the Plan column (still used internally for the deposit/term math, just not shown); added a search box (customer or apartment) above the table via the shared Toolbar component — narrows only the displayed rows + the table's own \"Total (N)\" footer, the KPI cards and trend chart above stay on the full period regardless of search; and added click-to-sort on Due Date and Next Billing (matching the existing Paid on sort — arrow indicator, ascending default)." },
  { v: "2.29.52", note: "Analytics > Earned Revenue > Per-invoice recognition, verified against a real reference spreadsheet (Sanjith/MJR: due 7/26, paid 8/1, ₹350 recharge → ₹68 earned in Jul + ₹282 in Aug). Two fixes: (1) \"Next Billing\" (validity end) is now COMPUTED from the invoice's due date — `dueDate + 1 calendar month − 1 day` (e.g. due 2 Jul → validity end 1 Aug) — instead of read from the linked subscription's raw `nextBilling` field, which just preserved day-of-month (due 5 Aug → 5 Sept) and didn't follow a real calendar-month cycle. Side effect: no longer depends on matching a subscription, so invoices that previously fell back to ₹0 earned now get a real figure. (2) Recognition formula rebuilt to match the reference exactly: `tenureDays = validityEnd − validityStart + 1` (inclusive), `daysInPaidMonth` = however many of those validity days fall within the invoice's own PAID calendar month, `earned = recharge × daysInPaidMonth / tenureDays`. Replaces the single lump-sum-per-invoice model; a tenure crossing a month boundary is now correctly split so only its paid-month slice shows here (68÷282 verified exactly: 350×25/31=282). \"Validity days\"/\"Month End Date\" columns replaced with \"Tenure days\" and \"Days in paid month\" so both inputs to the new formula are visible." },
  { v: "2.29.51", note: "Analytics > Earned Revenue > Per-invoice recognition: changed the recognition formula's numerator from (month end − paid date + 1) to (validity end − validity start − 1) — validity start = the invoice's due date, validity end = the linked subscription's next billing date (`sub.nextBilling`). Denominator (days in the paid month) is unchanged. Renamed \"Days remaining\" to \"Validity days\" (now validityEnd−validityStart−1); added a \"Next Billing\" column next to Due Date so both anchor dates are visible; removed \"Month End Date\" from the table/CSV (the denominator's month-end is still computed internally, just no longer shown). Falls back to ₹0 earned when the invoice's subscription can't be matched (no `nextBilling`). NOTE: for multi-month plans this can push Earned revenue well above the recharge amount within a single month, since the numerator now spans most of the WHOLE paid term (e.g. ~365 days for annual) rather than just days-remaining-in-the-paid-month — confirmed intentional with the user." },
  { v: "2.29.50", note: "Analytics > Earned Revenue > Per-invoice recognition: removed the Earned/day column from the table and CSV export (Earned/month, Month End Date, Days remaining and Earned revenue stay). Also dropped the now-unused `earnedPerDay` field and the `inr2` helper that only existed to format it — no other display used them." },
  { v: "2.29.49", note: "Analytics > Earned Revenue > Per-invoice recognition: added a Due Date column (from the invoice's due_date, between Plan and Paid on) to both the table and the CSV export. Also re-verified the existing \"Paid on\" column: it already reads `i.paidDate || i.date` (the real API paid_date, added v2.29.48), so no change was needed there — confirming it, not duplicating it." },
  { v: "2.29.48", note: "Analytics > Earned Revenue > Per-invoice recognition: the billing API now returns a real `paid_date` on invoices (confirmed live, e.g. INV-000666). `mapInvoice()` maps it to `paidDate`, and the recognition table now uses `i.paidDate || i.date` as the invoice's paid date (falling back to invoice date for older invoices that predate the field) instead of always using the invoice/created date as a proxy for when it was actually paid. Recognition math (day-based proration across the paid month) is unchanged — only which date feeds it." },
  { v: "2.29.47", note: "IoT Core > Device Monitor: the Total Dispensed stat (RO Unit Sensors card) is now date-filterable — Today / Yesterday / This Week / This Month / Last Month chips sit right on the card, and Total dispensed / Average dispensed recompute for whichever period is selected. This filter is now SHARED with Trend analysis + Recent readings below (both used to own a separate, page-local Today/Yesterday/Week filter) — lifted `range` state up to IoTDevices so picking a period in one place updates both (`IOT_RANGE_OPTIONS`, `iotFilterByRange`, `IoTRangeChips`). Two new options — This Month and Last Month (real calendar months) — join the existing rolling-7-day \"This Week\". To support them, the Trend analysis history fetch widened from `&days=7` to `&days=62` (renamed `hist7dByDevice` → `histRangeByDevice`), which safely covers a full previous calendar month regardless of where in the current month \"today\" falls. Total dispensed now reads as the counter value as of the end of the selected period (not always \"right now\"); the card shows \"No dispensed-litres data for this period\" instead of disappearing when a period has none." },
  { v: "2.29.46", note: "IoT Core > Device Monitor > RO Unit Sensors: simplified the Total Dispensed stat down to two figures — Total dispensed and Average dispensed (per day) — dropping \"This window\" (the raw litres in whatever ~1–2 day span the history feed happens to have loaded, which read as confusing/arbitrary on its own)." },
  { v: "2.29.45", note: "IoT Core > Device Monitor > RO Unit Sensors: the Total Dispensed stat gained an \"Average / day\" figure alongside Total dispensed and This window — `iotDispensedRange` now normalises the window delta by its actual time span (the history feed is a downsampled ~1–2 day window, not exactly 1 day) instead of just showing the raw window delta twice over. Shows \"—\" until there's at least 30 min of span to average over, so it doesn't flash a wild estimate right after load." },
  { v: "2.29.44", note: "IoT Core > Device Monitor: fixed a load flash — the module used to drop its full-page spinner as soon as the device ROSTER arrived, so the device list, tank graphic, gauges and Water Quality card briefly rendered with empty/zero data (\"Awaiting sensor readings\", 0% tank, — gauges) before the first device-HISTORY round-trip landed a beat later. A new `historyLoaded` flag keeps the loading state up until both requests have completed at least once. Also replaced the generic small spinner with a dedicated `IoTLoading` panel — bigger spinner, \"Loading live device data…\" copy, and an indeterminate progress bar — so it's clearly a loading state, not a blank module." },
  { v: "2.29.43", note: "IoT Core > Device Monitor: the RO-tank feed's heartbeat now includes pressure, flow rate and a lifetime dispensed-litres counter (waterQuality.pressure/flowMLPM/totalDispensed) — wired in at full parity with pH/TDS/temp. A new \"RO Unit Sensors\" card (separate from Water Quality, since pressure/flow aren't a potability reading) shows pressure & flow as a live min–max range with GOOD/WARNING/CRITICAL bands — assumed operating ranges (pressure 0–4 bar green / 4–6 amber / outside red, flow 0–3 L/min green / 3–6 amber / outside red; both legitimately read 0 while idle, unlike pH/TDS/temp), plus a \"Total dispensed\" stat (lifetime total + delta over the selected window — a running counter, not banded). Pressure & flow also gained their own gauges and Trend-analysis tabs/charts/anomaly-event scanning (iotTrendMetrics, iotAnomalyScan generalized to loop over the full metric registry instead of hardcoded ph/tds/temp/tank), and the Recent-readings table + CSV export gained Pressure/Flow/Dispensed columns. IoTWaterQualityCard is now reused for both cards via `keys`/`title`/`noun` props instead of being hardcoded to ph/tds/temp. (Live-tested against the real device: E05A1B9C2DD4 is currently reporting 655.34 bar pressure, correctly flagged CRITICAL — looks like a sensor fault worth checking on the unit.)" },
  { v: "2.29.41", note: "IoT Core > Tank Level: moved the 'Warming' tag out to the top-right corner of the whole Tank panel (aligned with the device-ID header row), using the empty header space there — was previously anchored to the tank graphic beside the lid. Now rendered by IoTTankPanel, not IoTTank." },
  { v: "2.29.40", note: "IoT Core > Tank Level: moved the 'Warming' tag from centered-above-the-lid to the top-right corner of the tank graphic, using the empty space beside the lid so it no longer sits over the lid." },
  { v: "2.29.39", note: "IoT Core > Tank Level: the warming vapour now triggers on warm water directly, not only on a rising trend. Previously it needed BOTH temp climbing AND >= 26 °C, so a steady 26 °C (Warning band) showed no steam. Now iotTempWarming flags warming whenever the latest water temp is above the ideal band (> 25 °C — the Warning/Hot zone), or when it's trending up into that zone — so an elevated tank temp visibly steams." },
  { v: "2.29.38", note: "IoT Core > Tank Level: added a warming vapour animation inside the tank. When the water temp is above the ideal band (or trending up into it), iotTempWarming flags it and wisps of steam rise off the water surface (positioned at the live level, so they track the surface as it fills/drains), with an amber 'Warming' tag. Purely visual (CSS), driven by real temp history; threaded IoTDevices → IoTTankPanel → IoTTank alongside the refill rig; respects prefers-reduced-motion." },
  { v: "2.29.37", note: "IoT Core > Tank Level: added a live refill animation. The RO tank pings its level every ~10 min; when the level steps UP across the recent window (~65 min), the tank is detected as actively refilling (iotTankRefilling). While refilling, a pump appears in the base gap with a spinning impeller, a pipe runs from the pump up the side and over into the tank neck, and blue water flows in animated waves through the tubes into the tank, with a 'Refilling' tag on top. Purely visual, driven by real level history; respects prefers-reduced-motion." },
  { v: "2.29.36", note: "IoT Core > Recent readings table tweaks: (1) added a CSV Export button (exports the currently-filtered readings — time, tank %, pH, TDS, temp). (2) Duplicated the Today / Yesterday / This-Week range chips into the Recent-readings header (same `range` state as the top-of-panel control, so either set works). (3) Removed the Contamination severity column from the table (the Anomaly/Severity filter chips still classify contamination — the column itself is gone for a cleaner table)." },
  { v: "2.29.35", note: "IoT Core > Weather correlation chart got show/hide toggles — a 'Show' row of chips (Water temp · TDS · pH · Tank, each coloured to its line) lets you turn any sensor line on/off on the combined chart; Outdoor temperature stays on by default as the shared reference. Controlled by `wxShow` state; the WX_SERIES lines are filtered by it." },
  { v: "2.29.34", note: "IoT Core > Recent readings filter expanded from Contamination-only into a two-part filter: an Anomaly category (All · Contamination · Tank · Dead device) plus a Severity level (All · Critical · High · Medium), each chip showing a live count. Contamination uses the pH/TDS rules; Tank uses a new `iotTankSev` (≤25% High / ≤50% Medium refill urgency); Dead device flags when the selected device's last reading is >24h old (also shows a red banner above the table, and filters the table to its last-known readings). Severity filters on the worst of contamination/tank per row (`iotWorstSev`)." },
  { v: "2.29.33", note: "IoT Core > Trend analysis > Recent readings table now classifies each row's CONTAMINATION severity per the water-quality business rules (pH + TDS): Critical = pH <6.0 or >9.0 (BR-PH-01); High = TDS >500 (out of safe) or pH outside the 6.5–8.5 ideal; Medium = TDS <50 (low/dilution, BR-TDS-02). A new \"Contamination\" column shows a colour-coded severity badge per reading (critical rows get a light-red row tint), and a new Contamination filter (All · Contaminated · Critical · High · Medium, each with a live count) narrows the table to the chosen severity. `iotContamSev(ph, tds)` is the shared classifier." },
  { v: "2.29.32", note: "IoT Core > Trend analysis > Weather correlation chart now also plots the TANK level (%) alongside outdoor temp, water temp, TDS and pH — its own auto-scaled line (amber), out-of-range points flagged red, tank value added to the hover tooltip and the legend. `iotWeatherCorrelate.joined` now carries tank + oorTank per reading." },
  { v: "2.29.31", note: "IoT Core > Alerts now PERSISTS anomalies to a local log (localStorage `pw_iot_alert_log`) instead of only showing live ones — so alerts no longer disappear when the ~1-day telemetry window slides past them. Each detection cycle emits per-occurrence anomaly events with a stable key (deviceId|rule|timestamp) and upserts them into the store (capped 2000 events / 45 days); the page renders from the stored log (with exact timestamps), plus a live '{n} logged' count and a Clear-log button. Fixed a false-positive: 'Dead device' no longer fires (and gets permanently logged) while a device's history is still loading — it only triggers on a real last-seen older than 24h. (Next: POST the log to Firebase for cross-device history.)" },
  { v: "2.29.30", note: "IoT Core — new \"Alerts\" tab: a deterministic anomaly rules-engine over the fleet (per the water-quality business-rules guide). Detects: Dead device (no ping >24h), Critical pH out-of-bounds (<6/>9), pH out of ideal (6.5–8.5), pH rapid drift (|Δ|>0.8 in minutes), High TDS contamination spike (>600) / out-of-safe (>500), sudden TDS drop/dilution (<30), Acid/industrial intrusion (inverse-ion: pH↓>0.5 while TDS↑>150 in ≤10m — Critical), Temperature out of range (<10/>32), Tank level drastic drop (≥25% in a short span), and Sensor frozen/flatline (σ≈0). Each alert carries a severity (Critical/High/Medium), the reading value, occurrence count, likely cause and a proactive action. Page has KPI tiles (open/critical/high/dead/contamination/watched), an Anomalies-by-type chart, severity + type filters, and an \"Understanding the signals\" insight card (temp-vs-TDS drift, acid-intrusion signature, low-TDS buffering, flatline). Reuses the /devices/status + bare /devices/history feeds; no extra endpoints. Deterministic, no LLM." },
  { v: "2.29.29", note: "Task Planner: added a \"Timeline\" view (4th toggle alongside Board / List / Weekly) that lists tasks by the day they were ADDED (createdAt), newest first — grouped under Today / Yesterday / date headers with a per-day \"N tasks added\" count, and each entry showing the time, title, status + priority pills, category, assignees and who added it. Click any entry to open/edit the task. Lets you see the flow of what's being added to the board over time." },
  { v: "2.29.28", note: "(1) Customer > Societies now opens with a \"Customer retention insights\" panel — the same 5-layer read (What happened / ongoing / Result / Positive vs Negative / recommended ACTIONS) on active vs churned customers, avg LTV (from paid invoices), dunning (payment-failing) customers, outstanding dues, and at-risk societies (highest inactive+dunning %). Actions: recover dunning, win back inactive (worst society first), service+renewal drive on the at-risk society, chase outstanding. (2) Apartment/Society filters on the analytics pages (Sales, Revenue, Earned Revenue) are now MULTI-SELECT (reusing MultiSelectFilter) instead of single dropdowns — pick any combination of societies; all KPIs/charts/tables scope to the selection." },
  { v: "2.29.27", note: "(1) Analytics > Revenue (Net Revenue) gained the same \"Business insights\" panel — What happened (collections in the period vs previous + YoY), What's ongoing (recharge vs deposit split + outstanding receivables), Result (recurring recharge as % of collections — the durable revenue), Positive vs Negative (trend up/down, top/lagging society, deposit-heavy mix) and recommended ACTIONS (chase outstanding, recover dipped collections, grow recurring recharge, push a lagging society). Deterministic over the live invoices/customers. (2) Removed the \"Fleet health & insights\" section from IoT Device Monitor (added in 2.29.26) per request — the Device Monitor is back to its live-monitoring layout." },
  { v: "2.29.26", note: "IoT Core > Device Monitor gained a \"Fleet health & insights\" analytics section at the top (for the IoT head). Fleet KPIs (devices, online, water-quality index = % of readings in range, devices needing attention); a 5-layer insight read (What happened / ongoing / Result / Positive vs Negative / recommended ACTIONS — dispatch offline devices, service the weakest device, inspect membranes when the WQ index dips); an anomaly-spike timeseries (out-of-range readings per day across the fleet, to catch spikes); and a best-to-worst devices table (status · water quality · anomalies · 0-5 health). Reuses the roster + per-device history already polled (no extra calls). Society-level rollup is noted as pending a device→society mapping (the feed identifies devices only). Deterministic, no LLM." },
  { v: "2.29.25", note: "Analytics > Sales Insights now opens with a \"Business insights\" panel that reads the leads like a story, not just data — structured as: What happened (this month's leads/conversions vs last month), What's ongoing (open + idle-over-14-days leads), Result (overall close rate), Positive vs Negative (auto-flagged best/worst channel · society · rep, and trend direction), and \"Turn − into +\" recommended ACTIONS tied to each negative (assign idle leads, pause a weak channel, demo-drive a low society, coach a lagging rep). Exposed lead `source` in the mapper to power channel insights. All deterministic rules over the live Zoho lead data — the funnel + trend sit below it." },
  { v: "2.29.24", note: "Analytics > Sales Insights now opens with the REAL picture (per Sales-head feedback) — a Lead conversion funnel that starts from TOTAL leads, not from conversions. Headline KPIs: Total leads · Converted (Won) · Conversion % (colour-coded red/amber/green) · Lost; a top-to-bottom funnel (Total → Contacted+ → Demo+ → Proposal+ → Converted) with drop-off % at each step; and a Leads-vs-conversion-% trend over time (monthly cohort, bar = leads, line = conversion %). Society filter scopes it all. Deterministic, from the live Zoho lead stages. (Next: full sales KPI suite — by campaign / salesperson / society — and the IoT KPI suite.)" },
  { v: "2.29.23", note: "IoT Core weather correlation now works across the Today / Yesterday / This-Week filter — WITHOUT any extra API calls. The Google Weather endpoint only returns the last 24 h per call, so weatherApi now accumulates each fetched hour into a rolling multi-day store in localStorage (pw_weather_hist, deduped by hour, capped 8 days) and returns the merged history. The range filter's correlation then reads whatever period is selected (it builds up as the dashboard runs — partial Yesterday immediately from the last-24h overlap, full Yesterday after a day, This-Week over a week). Same call cadence as before." },
  { v: "2.29.22", note: "IoT Core > Trend analysis & metric cards. (1) The combined weather chart now shows the OUTSIDE TEMPERATURE on a real labelled Y-axis (°C) as the readable reference, with water temp / TDS / pH overlaid on their own auto-scaled axes — easier to read than the fully-hidden axes. (2) A flashing red dot now pulses on the chart at any timestamp where a taste issue is likely (a combination of hard/flat TDS, off-neutral pH, or warm water). (3) The four metric cards (pH · TDS · Temperature · Tank) were rebuilt into real gauges with a much larger current-value number: pH shows a 0–14 acid→neutral→alkaline scale, TDS a 0–600 mg/L meter with safe/watch/unsafe zones, Temperature a Cold/Normal/Hot coloured range, and Tank a 0–100% level bar with a fill — each with a marker at the live value. (4) Removed the fleet-wide \"Active alerts\" card from the Device Monitor. All deterministic, no LLM." },
  { v: "2.29.21", note: "IoT Core > Trend analysis refinements. (1) The three paired weather charts collapsed back into ONE combined chart — outdoor temp + water temp + TDS + pH on one time axis (each auto-scaled on its own hidden axis so the different units stay readable; hover for real values), with out-of-range points as red dots on every series. (2) Added a Today / Yesterday / This Week range filter that slices the window everything reads from; the selected device now pulls a 7-day history (…&days=7) to feed it. (3) Renamed the \"Alerts created\" tile to \"Total alerts\". (4) Recent-readings table no longer fills the whole cell amber/red — the out-of-range value itself goes bold, coloured and +1px so it pops without a heavy block. (5) \"What this means\" gained a For-residents-&-in-flat-purifiers read: expected tap-water taste (from central-RO TDS/pH/temp) and the load/servicing impact on each flat's own purifier, noting the sensors sit on the central RO. All deterministic, no LLM." },
  { v: "2.29.20", note: "IoT Core > Weather correlation — the single outdoor-vs-water-temp chart became THREE compact paired charts (outdoor temp vs Water temp, vs TDS, vs pH), each on its own dual axis so the different scales stay readable, mapping 1:1 to the three r-cards above. Each sensor line now flags out-of-range readings as red dots (amber/red band → red), matching the trend chart. Outdoor temp is the shared orange reference line on every chart." },
  { v: "2.29.19", note: "IoT Core weather readability. (1) Chart time axes (Trend analysis + Weather correlation) and the live-weather card now show 12-hour times with AM/PM instead of 24-hour. (2) The Weather correlation card gained a plain-English \"What this means\" annotation — a deterministic read for a business/data/user audience that states the outdoor conditions (dominant condition + temp range) and, in one line each, how water temperature, TDS and pH responded (with the honest caveat that it's correlation over a short ~24h window, not proof of cause). Water-temp shows the expected strong positive link to outdoor temp." },
  { v: "2.29.18", note: "IoT Core weather went LIVE — the Cloud Function proxy (weather-proxy/) was deployed to backend-prowater and WEATHER_PROXY_URL is now set, so the live-weather strip and the sensor↔weather correlation run on real Google Weather API data for Prabhavati (Garvebhavi Palya, Bengaluru) instead of the sample. Verified end-to-end: proxy returns 200 with real conditions + 24h history, CORS open to the browser, 60-min cache HIT." },
  { v: "2.29.17", note: "IoT Core > Device Monitor — weather + sensor↔weather correlation (Prabhavati). (1) A live-weather strip at the top of the module shows the current conditions at the apartment (Garvebhavi Palya, Bengaluru) — temp, humidity, condition — sourced from the Google Weather API's newest history hour (no separate current-conditions call). (2) A \"Weather correlation\" card inside Trend analysis joins each reading to its nearest weather hour and reports Pearson r for outdoor temp vs water temp / TDS / pH (with a plain-English strength read and what's physically expected), plus a dual-axis chart overlaying outdoor vs water temperature. (3) Data flows through a Cloud Function proxy (new weather-proxy/ folder) that holds the key server-side and caches 60 min — demand-driven, ~10–24 calls/day for one site. Until WEATHER_PROXY_URL is set, the UI shows a clearly-labelled SAMPLE so nothing is mistaken for real. Location is hardcoded (weather is regional). All correlation math is in-app, no LLM." },
  { v: "2.29.16", note: "IoT Core > Device Monitor — rebuilt \"Recent readings\" into a Trend analysis panel per feedback. (1) A proper interactive time-series chart (Recharts) per device: real time on the X-axis, the metric on Y, the ideal band shaded, and every out-of-range reading drawn as a red dot, with a hover tooltip (time · value · in-range/out-of-range · ideal). Switch the focused metric via tabs or by clicking a mini-wave — pH / TDS / Temperature / Tank. (2) An \"Anomalies only\" filter that isolates the out-of-range points in the chart AND filters the readings table to just those rows. (3) Analytical tiles that read the window deterministically: Sensor health (Good/Check from reporting continuity, dropouts, staleness), Water quality (Good/Warning/Critical), Alerts created (out-of-range event count) and Anomalies-by-metric (per-metric counts). (4) An Anomaly history list — each out-of-range event with its date/time, worst value and High/Low direction. All in-app, no LLM. Next step (noted, not built): correlate anomalies with a weather API." },
  { v: "2.29.15", note: "IoT Core > Device Monitor — consolidated the history API. The per-device `&days=1` and `&days=2` history polls were removed: they returned the SAME data as the bare `/devices/history?deviceId=…` feed, so the tank level, water quality, Recent-readings ECG and the 12-hour consumption table now all read off that single feed. The module now calls just two endpoints — `/devices/status` (roster) and `/devices/history?deviceId=…` (bare). (Supersedes the v2.29.14 change, which had instead dropped the bare call.)" },
  { v: "2.29.14", note: "IoT Core > Device Monitor. (1) Added the apartment name — \"Prabhavati\" — as a centred pill in the module top bar (with a location pin), so it's clear which site the monitored devices belong to (hidden on narrow screens to avoid overlap). (2) Dropped the dummy `/devices/history?deviceId=…` (no-days) API call: the roster-wide liveness poll now hits the real day window `/devices/history?deviceId=…&days=1`, so device online/offline state, the heartbeat table, live consumption and the charts all run off real data instead of the placeholder feed. The two live endpoints are now /devices/status and /devices/history?…&days=1 / &days=2." },
  { v: "2.29.13", note: "IoT Core > Device Monitor \"Recent readings\" ECG waves — visual upgrade per feedback. (1) Redrew each metric's wave as a high-quality trend: a faint monitor grid, the ideal band shaded with dashed guide lines, a soft gradient area-fill under the line, crisp segment-coloured strokes (green/amber/red per segment, non-scaling for sharp edges at any width) with a subtle glow, and a haloed leading dot at the latest reading; the day's readings are bucket-averaged to ~72 points so the line stays smooth. (2) Switched the wave cards from the dark \"monitor\" look to clean white / off-white cards (light border + soft shadow) to match the rest of the dashboard, with the metric value coloured by its current band and deeper line colours tuned for legibility on white. (3) Removed the explanatory subtitle line under the \"Recent readings\" heading." },
  { v: "2.29.12", note: "IoT Core > Device Monitor \"Recent readings\": added (1) an ECG-style wave monitor — one dark glowing wave per metric (pH / TDS / Temperature / Tank) over the day's readings, with the ideal band shaded and out-of-range points dotted amber/red; and (2) quick anomaly filter chips (All · Any anomaly · pH · TDS · Temp · Tank) that each show a live out-of-range count and instantly filter the table to just those readings, so anomalies are one click away. Sorting, 10-per-page pagination and the per-cell out-of-range colour highlighting are unchanged." },
  { v: "2.29.11", note: "Customer Profile — dropped the \"AI summary\" card (it only stitched numbers into long sentences) per feedback. The profile fields table now surfaces Support tickets and Complaints as fields, and every value is highlighted only when it is a concern — amber (warning) or red (critical) — while healthy values stay plain: Status (red if not active), LTV (red if 0), Discounts (amber ≥20% of LTV / red ≥30%), Support tickets (amber ≥5 / red ≥8), Complaints (amber ≥1 / red ≥2). The Customer/Technician/Device score cards stay. The Spares-used card lost its \"AI analysis\" paragraph too — now just a readable spare→count table with a one-line factual sub." },
  { v: "2.29.10", note: "Fix: Customer Profile Device score could read 0.0 (\"Poor\") for a device with ZERO complaints — routine maintenance was over-penalised (every spare −0.35 and every ticket −0.10, so 12 spares + 20 service jobs drove it negative → clamped to 0). Reworked so complaints (real faults) are the primary driver (−1.3 each) while spares + above-routine service rate are capped \"wear\" (max −2 pts); a fault-free device now scores at least 3.0. Also fixed the contradictory AI line \"Device shows wear — 0 complaints\": with no complaints it now reads \"No faults logged, but heavy servicing (N spares, M jobs) — worth keeping an eye on.\"" },
  { v: "2.29.9", note: "Customer > All Customers Profile — 360° scoring + de-duplication (per feedback). Added three 0–5 scores with conditional colour formatting (green ≥4 / amber ≥2.5 / red < 2.5 / grey = no data): Customer score (loyalty + value + engagement, dinged by complaints & heavy discounting), Technician score (field-service quality — job timing + TDS reduction, null when there are no ops jobs) and Device score (health — dinged by complaints & spares). The Spares-used analysis moved onto the Profile page (from the Ops tab). The AI summary was reworked to interpretation only — it no longer restates the field values (LTV / deposit / discounts / referrals); it now reads the scores in plain English (\"strong customer\", \"device looks healthy\") with severity-coloured Focus areas highlighting the negatives." },
  { v: "2.29.8", note: "Credit notes + customer-360 additions. Analytics > Credits now maps each note's remaining balance and date: a \"Credit balance available\" KPI plus Balance and Last-given columns in the per-customer table. Customer > All Customers: Profile adds a Security Deposit row (the tiered refundable deposit via depositForPlan) and shows the unused credit balance next to discounts; the AI summary card is now amber-themed with its Focus-area items colour-coded by severity (red critical / amber warning / green healthy) to highlight the negatives, and it folds in the security deposit and remaining credit balance. New Ops sub-screen analysis: \"Spares used\" aggregates Parts_Used across the purifier's ops jobs into a spare→count table with a deterministic AI read (most-replaced part, parts-per-visit, and heuristics — e.g. frequent RO-membrane changes flag high input TDS). All deterministic, no LLM." },
  { v: "2.29.7", note: "IoT Core > Device Monitor: the RO-tank \"Recent readings\" table renamed its first column Heartbeat → \"Sync History\" with a click-to-sort toggle (newest↔oldest, newest-first by default), centre-aligned values, and out-of-range highlighting — each Tank / pH / TDS / Temperature cell turns amber (borderline) or red (critical) using the same water-quality thresholds (tank: ≤25% red, ≤50% amber). Analytics > Credits: the Society filter is now a searchable multi-select (choose several societies at once; all selected by default, uncheck to exclude) instead of a single dropdown." },
  { v: "2.29.6", note: "Analytics > Credits rebuilt around the live credit-notes API. Removed the old unused-credit KPIs, the Credits-by-society / Credits-by-plan bar charts and the Customers-holding-credits table. The section now shows only the discounts from GET /admin/get-all-creditnotes — total discount given, note count, customers discounted and avg/note, plus a per-customer table (joined by Zoho customer id) — with a Period (date-range preset) filter and a Society filter, a searchable table and CSV export." },
  { v: "2.29.5", note: "Credit notes (discounts) + tank refill alert. (1) New creditNoteApi wired to GET /admin/get-all-creditnotes (Bearer-authed, tolerant mapper, 60s cache, sample fallback). (2) Analytics > Credits gains a \"Credit notes (discounts)\" section — total discount given, note count, customers discounted, avg/note, and a per-customer table (joined to customers by Zoho customer id). (3) Customer > All Customers: Profile shows a Discounts (credit notes) row (amount + count), and the AI summary now accumulates discounts — how many credit notes, total amount and % of LTV — plus a \"heavy discounting\" focus flag when discounts exceed 20% of LTV. (4) IoT Core: RO-tank detail shows a red \"SWITCH ON the pump to refill.\" banner when the tank level is at or below 25%." },
  { v: "2.29.4", note: "Customer > All Customers overhaul. (1) Search now matches Purifier ID, phone, name AND email (was Purifier ID only). (2) The full-page customer view gains three sub-screens beyond Profile/Transactions: Tickets and Ops (a Purifier-ID lookup into the Ticketing feed, counted month-wise as Jan'26 · N; each month row expands/collapses to its Issue-Category / issue-type breakdown — Ops reuses the Ticketing > Ops filter, Issue Category ≠ Complaint), and Referral (how many referrals the customer made, converted/pending, referral code, and the referee list — joined to the referral API by any shared key). (3) Profile adds LTV (lifetime value = sum of all paid invoices), the referral code, referrals-made, and an AI summary card: bullet insights across transactions/tickets/ops/referrals plus rule-based \"Focus areas\" (what to prioritise for this customer). Deterministic, no LLM. (4) IoT Core tank: added rising water bubbles inside the transparent tank (respects prefers-reduced-motion)." },
  { v: "2.29.3", note: "IoT Core > Device Monitor refinements. (1) Water-quality now uses precise 3-tier thresholds — pH green 6.5–8.5 / amber 6.0–6.4·8.6–9.0 / red <6·>9; TDS green 50–300 / amber 301–500 / red <50·>500; temp green 15–25 / amber 10–14.9·25.1–32 / red <10·>32 — with GOOD/WARNING/CRITICAL badges. (2) The AI summary moved INTO the Water Quality card (removed from the page top): an overall verdict plus a plain-English note per metric. (3) RO-tank liveness now uses a 25-minute window (these units report ~every 20 min) so a healthy tank no longer shows Offline; junctionBox units keep the 120s window. (4) The transparent tank graphic is smaller, and the Online/Offline KPI ECGs are now glass-masked (fade in/out, clear of the number) instead of a hard line through the text. (5) Device-list cards fixed (full IDs + clean status pill, no cramming) and the tank/water-quality columns rebalanced to remove empty gaps." },
  { v: "2.29.2", note: "IoT Core > Device Monitor polish. (1) The RO-tank graphic is now a transparent see-through Sintex-style storage tank — dark screw lid + moulded neck, blue water filling to the live level % with two continuously-moving wave layers, moulding bands and a side highlight (respects prefers-reduced-motion). (2) The Online KPI card now animates a live green ECG heartbeat when any device is online; the Offline KPI card shows a red flatline (\"dead\") ECG. (3) New AI summary strip at the top — a deterministic, in-app read of the fleet: device counts, the selected tank level, water-quality status and active alerts (no LLM call). (4) The RO-tank Recent readings table is paginated at 10 rows per page with Prev/Next and a page indicator. Water-quality ranges now ignore non-positive sensor dropouts so a stray 0 doesn't skew the min." },
  { v: "2.29.1", note: "IoT Core > Device Monitor: reworked the RO-tank view to the ProWater design spec. The tank is now a single realistic semi-transparent plastic storage tank (CSS-built: moulded ribs, neck + cap, edge highlights) whose water block height tracks the level % with a continuously animated two-layer wave surface (respects prefers-reduced-motion); the 100/75/50/25/0 scale sits alongside it. The RO-tank detail now uses an aligned 3-column layout — Devices · Tank Level (with the device name/firmware in the card header) · Water Quality — and the Water Quality panel uses Green/Amber/Red RAG badges with an overall status callout. KPI label reads \"Total devices\". Same data + telemetry APIs as 2.29.0." },
  { v: "2.29.0", note: "IoT Core > Device Monitor: RO-tank devices now show a Tank Level + Water Quality view driven by /devices/history?deviceId=…&days=1. The device-detail branches on device schema: RO-tank units (tankLevel + waterQuality heartbeats) get a water-tank illustration with the four float-switch states (25/50/75/100%) and a live fill %, plus a Water Quality panel showing pH / TDS / Temperature as the min–max range over the last day against their ideal bands, each rated GOOD / AMBER / CHECK, with an overall \"Water quality is excellent\" summary; a Recent readings table lists tank % · pH · TDS · temp per heartbeat. junctionBox units keep the existing pressure/flow/channels/consumption view (those channel-only sections are hidden for tank units, which the feed doesn't report). Known tank device E05A1B9C2DD4 is always kept in the roster + polled and selected by default. Device list + detail header are now schema-aware (firmware from firmwareVersion or FIRMWARE_VERSION; tank % vs bar pressure)." },
  { v: "2.28.22", note: "Customer > All Customers: clicking a Purifier ID now opens a FULL-PAGE customer view (was a side drawer) with two sub-screen tabs — Profile (customer details + Installed date from the subscription start + Total paid) and Transactions (a full-width payment table: Date · Invoice · Amount · Plan · Status, newest-first, with Total paid / Payments summary). A back arrow returns to the search list." },
  { v: "2.28.21", note: "Customer module: new \"All Customers\" section (tab between Customers and Societies). Search a customer by Purifier ID; the results table lists Purifier ID · Customer · Society · Plan · Status. Clicking a row opens a detail drawer with the customer's info, the Installed date (taken from the subscription start / activated date), Total paid, and the full transaction history — every invoice/payment newest-first with amount, date, invoice number and paid/pending status. Customers ↔ subscriptions ↔ invoices are joined by any shared key (customer number / zoho customer id / email)." },
  { v: "2.28.20", note: "Ticketing: mapped the feed's \"Ticket Created Time\" into the ticket's created field (so the Created column + date filter use the real created timestamp). Ops Tickets: the date filter now scopes by Ticket Created Time (was Job Start Time). Tickets tab: added the same page filters as Ops — a Ticket-Created-date filter plus the status filter, and hid the (data-less) priority filter — so both ticket views filter the same way." },
  { v: "2.28.19", note: "Home sidebar: hid the vertical scrollbar on the module list (scrollbar-width:none + ::-webkit-scrollbar display:none) — the list still scrolls and the profile stays pinned, just without the visible bar." },
  { v: "2.28.18", note: "Removed the last live GET /tickets call — the Auto GS create-ticket flow had a fallback that fetched the whole GET /tickets list to resolve a human-readable ticket number; that fallback is deleted (it now uses the create response's number, else the returned id). Tickets themselves already read from GET /tickets/formattedforwisdom. Also updated the stale ticketing comment + console log to the correct endpoint and dropped the /tickets path from the WIRE stub notes. (Historical VERSION_HISTORY entries that mention the old /tickets are left as-is — they record past behaviour.)" },
  { v: "2.28.17", note: "Analytics > AOP: added an \"AI Summary\" card at the top summarising the annual operating plan — the FY subscription target, recharges collected and % achieved (with an on-track/behind read), the amount remaining to hit target, the strongest and weakest months, and how many months with targets have reached 100%. Follows the selected financial year. Computed deterministically from the plan (not an LLM call), matching the Overview AI Summary style." },
  { v: "2.28.16", note: "Analytics > Overview: added an \"AI Summary\" card at the top that auto-summarises the whole dashboard in plain English — total collection (with recharge/deposit/earned split and vs-prev delta), active customer base + new sign-ups, MRR and top plan, outstanding + collection efficiency + avg collection days, the top-performing society, and active referrers / open tickets / next-month forecast. It follows the page's date-range and society filters. The summary is computed deterministically from the same figures shown below (not an LLM call)." },
  { v: "2.28.15", note: "Fixed the invisible topbar avatar — the global `.pw-root button{background:none}` reset was overriding `.premium-avatar`, so its initials rendered white-on-transparent (invisible on the white topbar); gave it an explicit gradient background. Also prototyped Dark + Aesthetic themes with a top-right picker, but DISABLED them (THEMES = [\"light\"]) after review: dark mode left module tables unreadable (their hardcoded light colours don't invert) and the violet aesthetic wasn't wanted. The theme CSS is left dormant pending a decision on a proper themeable refactor." },
  { v: "2.28.14", note: "Home polish: the module group headers are now larger with a green left-to-right fading gradient pill background (light + dark variants) instead of the small underlined label. Fixed a stray horizontal scrollbar that appeared at the bottom of the sidebar module list — pinned overflow-x:hidden (setting only overflow-y:auto had made overflow-x compute to auto)." },
  { v: "2.28.13", note: "Home redesign pass. (1) Modules are now grouped under section headers in the Workspace directory: Marketing/Growth (Sales, Customer, Referral), Ops/Logistics/ERP (ERP & Inventory, FSM System), Analytics, IoT & Communications (IoT Core, Auto Scheduler), Customer Support (Ticketing, Device Replacement, Billing & Subscription), Tech (Task Planner, Employee, Logs Tracker, About). (2) Replaced the hero banner card with a plain \"Good <time>, <name>.\" greeting at the top. (3) Fixed the sidebar profile/photo button being hidden below a long module list — the module list now scrolls internally so the profile stays pinned and visible, and the avatar got a camera badge. (4) Added a light/dark theme toggle (persisted, in the sidebar profile row). Dark mode is a FIRST PASS scoped to the Home page (CSS-variable + class overrides); module interiors still use light-only hardcoded colours and need a follow-up pass." },
  { v: "2.28.12", note: "Home: removed the four workspace stat cards (Modules enabled / Production modules / Elevated access / Current version) entirely — the right sidebar now goes straight to Quick access. Shortened the hero banner further (less padding, smaller heading) and added a 20px gap below it so the hero and the \"Choose where to work\" card no longer touch." },
  { v: "2.28.11", note: "Home layout tidy-up. The hero banner is ~half its previous height — removed its \"Open <module>\" and \"Browse all modules\" buttons and cut padding/heading size. The four workspace stats (Modules enabled / Production modules / Elevated access / Current version) moved out of the full-width strip under the hero into the right-hand sidebar, stacked vertically above Quick access. Removed the \"Search modules\" box from the Workspace directory (the module grid shows all assigned modules)." },
  { v: "2.28.10", note: "Home hero slimmed down: removed the \"Workspace access\" panel (modules count / production-ready / elevated / current build) from the hero banner, and made the banner itself shorter — it's now a single full-width column with reduced padding (34→24px), smaller heading (max 52→38px) and tighter spacing, so it takes much less vertical space above the module grid. The same figures still appear in the KPI strip and the Access summary card below, so nothing was lost." },
  { v: "2.28.9", note: "Home: made the module cards more compact — reduced tile min-height (178→138px), padding (17→13px), icon (42→34px) and internal spacing, with slightly smaller title/description type, so more cards fit on screen without scrolling. Mobile tile height and the decorative corner accent were scaled down to match. Purely visual; grid stays 3-up on desktop." },
  { v: "2.28.8", note: "Session + navigation fixes. (1) Hard refresh now keeps you on the SAME page instead of bouncing to Home — the open module (pw_active_module) and each module's sub-tab (pw_tab_<module>) are persisted to sessionStorage and restored on reload (a stale tab falls back to the first visible section). (2) Auto-logout hardened: logs out after 1 hour of inactivity (any mouse/keyboard/scroll/touch resets the idle clock) AND when the calendar day rolls over — enforced both on load and on a 30s timer; the Firebase token cap was raised 55m→60m so idle timeout isn't pre-empted. NOTE: because the Firebase ID token lives ~1h, an active session is still capped at ~1h until token-refresh is added. (3) Ops Tickets: removed the Work Start Address column (added in 2.28.7)." },
  { v: "2.28.7", note: "Ticketing > Ops Tickets overhaul. Table: removed the Status column and added Work Start Address as a clickable Google Maps link (opens the job's Work Start lat/long, falling back to the address text). Filters: added a job-date filter (scopes by Job Start Time date, IST) and kept the status filter; removed the priority filter. New KPI cards (scoped by the date filter): Jobs with timing, Total job duration and Avg job duration (both computed from Job Start→End Time), plus Avg TDS reduction when TDS is present. New analytics: a \"Spares used by issue type\" table correlating Parts_Used with Issue Category, and a \"Water Quality — Input vs Output TDS\" table — each with computed AI Insights (top spare, strongest part↔issue pattern, spare intensity; avg TDS reduction, high-output-TDS and low-reduction flags, best performer). Insights are calculated in-app (deterministic), not an LLM call. The regular Tickets tab is unchanged. Also added mapped fields Input/Output TDS + Central RO/Junction Box issue, and guarded date formatters. NOTE: the short ticket number still needs its exact label from the feed — currently shows the long Ticket ID." },
  { v: "2.28.6", note: "Ticketing: fixed both Tickets and Ops Tickets showing every row blank (\"—\", status \"Open\", \"Invalid Date\"). The GET /tickets/formattedforwisdom feed returns a FLAT object keyed by human labels (\"Ticket ID\", \"Status\", \"Society Name\", \"Purifier ID\", \"Issue Category\", \"Phone\", \"Job Start Time\", \"Technician Visit Date\", …), which the old Zoho-Desk mapper didn't understand. Added mapWisdomTicket (tolerant of label case/spacing) + a shape detector so this feed maps correctly; the table + drawer now populate. Guarded fmtDate/fmtTime to show \"—\" for missing/invalid dates instead of \"Invalid Date\". NOTE: this feed carries no customer NAME (Customer column shows the Ticket Owner), and no Priority or Created-time field (those columns show \"—\"); if the backend adds them the tolerant lookup will pick them up." },
  { v: "2.28.5", note: "Section access (2.28.4) UX fix: the \"Sections\" control now shows for every multi-section module up front — even while the module is still set to None — so it's discoverable when creating a user (previously it only appeared after granting the module, which read as the feature being missing). Expanding an ungranted module shows an amber \"grant this module for these rules to take effect\" note. No change to how overrides are stored or enforced." },
  { v: "2.28.4", note: "Access control now goes one level deeper — per SECTION (tab) inside each module, on top of the existing per-module View/Supervisor/Admin/DevOps. In the Create-user and Edit-access screens every granted multi-section module gets a \"Sections\" expander where each section can be set to Default (inherit the module level — the default, so every section stays shown), Hidden (removed from that user's sidebar), View (read-only even if the module is Admin) or Edit (editable even if the module is only View). Stored per user at user.sections[moduleId][tabId]; absent = inherit, so all existing users are unchanged and keep full access. The sidebar hides Hidden sections, the header shows the section's effective View/Admin badge, and content components receive the section's effective edit rights. If every section of a module is hidden the module shows a \"No sections enabled\" notice instead of a blank page." },
  { v: "2.28.3", note: "Ticketing: live tickets now come from the backend GET /tickets/formattedforwisdom (was GET /tickets) — the endpoint returns rows already shaped for Wisdom. Still Bearer-authed with the login idToken like every other API; the raw-vs-mapped detection and sample-data fallback are unchanged." },
  { v: "2.28.2", note: "Added a developer tech-doc at src/DOCUMENTATION.md — architecture, auth/roles, backends & Firebase, data/caching/lookups, every storage key, and a per-module reference (how it works · APIs · logic · lookups · storage), releases, conventions, deploy and open dependencies. It's kept in sync with code changes like VERSION_HISTORY (stamped with the current APP_VERSION). Also synced the in-app About docs: Device Replacement now correctly reads \"saved via backend POST /device-replacement/add + localStorage\" (was still describing the reverted direct-Firestore write), and the API Usage list re-adds POST /device-replacement/add and trims the stale Firestore save line." },
  { v: "2.28.1", note: "Device Replacement: confirmed swaps are transferred to Firebase via the BACKEND API (POST /device-replacement/add) again — reverting the v2.21.0 direct-Firestore write, since the backend endpoint is the intended path to move the data to Firebase. The frontend now also keeps a localStorage copy (pw_device_replacements) so a saved swap shows immediately and survives reloads regardless of Firestore rules; the read-back list still makes a best-effort Firestore query on device_replacements for cross-device display and falls back to the local copy. Toast confirms the DB save or reports the server message." },
  { v: "2.28.0", note: "App & Technician Releases are now SHARED across all users. Instead of localStorage (which only reached the browser that published), releases are stored in a Cloud Firestore collection (backend-prowater · prowaterdb · wisdom2.0_releases). Publishing writes the release to Firestore; the \"what's new\" login popup pulls from Firestore on login and every 3 minutes, so a release published by an admin pops up for everyone who logs in (scheduled releases still honour their Announce-from time). A localStorage copy remains as an offline cache, and any releases previously saved only in a browser are uploaded to the shared collection on first load so nothing is lost. Needs Firestore rules allowing the logged-in client to read/write wisdom2.0_releases (the collection is auto-created on first publish). \"Seen\" tracking stays per-user/per-browser." },
  { v: "2.27.1", note: "Analytics > Overview > Top Performing Societies: the Total Months column now counts the number of calendar months from the society's LAUNCH month to the current month (inclusive), using the same launch the Penetration Tracker uses — the earliest subscription sign-up, or the admin's launch override — instead of the customer's first sign-up date. So an admin editing a society's launch month in the Penetration Tracker also updates its Total Months here." },
  { v: "2.27.0", note: "Penetration Tracker: the Launch month is now editable per society — but only for admins (user.role === admin) in the standalone Analytics view; everyone else (and the Overview's embedded tracker) sees it read-only. An admin picks a launch month (YYYY-MM) which realigns that society's M1..Mn cohort columns; a revert button restores the derived launch (month of the first sign-up). Overrides persist to localStorage (pw_launch_overrides) and are reflected everywhere the tracker renders." },
  { v: "2.26.0", note: "Analytics: removed the Live Dashboard section entirely (tab + WIP placeholder). Overview: the Active Customers KPI now counts cumulative sign-ups the Penetration Tracker way (subscriptions joined to a society by created date, as of the period end) with a delta showing the month-on-month increase, and follows the society/date filters. Replaced the Collection Efficiency gauge with an \"Ops Appointments\" card showing technician-visit counts for D0–D3 (today, +1, +2, +3 days) from the ticket \"Technician Visit Date\" field — these are fixed to the real current date and deliberately do NOT change with the page's date/society filter. (Collection Efficiency is still computed for the CSV export.)" },
  { v: "2.25.1", note: "Analytics > Overview: the referral KPI now shows \"Active Referrers\" (referrers live from the referral API) instead of \"Active Referees\" (converted referees), so it matches the Referral module's headline count — previously it read 0 (no converted referees yet) while Referral showed 1 active referrer. Scoped by the society filter (so it matches the Referral page when \"All societies\" is selected) with the delta & sparkline following the date range by the referrer join date." },
  { v: "2.25.0", note: "Analytics > Overview: every chart now honours the date-range + society filters. Revenue by Plan (MRR) is scoped to active subscriptions in the selected societies as of the period end; the Penetration Tracker is now embedded filter-aware (society filter narrows the societies, the period end sets the as-of month) instead of loading all-time data ignoring the filters. Replaced the Growth Rate KPI with an \"Active Referees\" tile (converted referees; society-scoped value, date-scoped delta & sparkline). Forecast vs Actual gained ₹ data labels on both the actual and forecast lines. Removed the Report Shortcuts card and added the Week-over-Week collected chart (last 8 weeks, Mon start) from Billing analytics — society-filtered and anchored to the selected period's end. Layout regrouped to Efficiency + Forecast, then a full-width Week-over-Week." },
  { v: "2.24.0", note: "Analytics > Overview + Auto GS access tweaks. (1) Top Performing Societies: the Total Flats value is now inline-editable for Admin & DevOps (persists to localStorage pw_flats_overrides and overrides the apartments-feed count, feeding Penetration %); everyone else sees it read-only. (2) Revenue by Plan now shows the same chart as Billing analytics — MRR by plan (monthly recurring value of active subscriptions), scoped by the society filter — instead of the recharge horizontal bars. (3) Customer Growth was replaced by the Penetration Tracker cohort view embedded in the Overview. (4) Auto GS - Society: the \"Add new society\" button is now Admin/DevOps-only (all inline field edits were already gated to admin/devops); view-access users still get the Create-ticket action and a \"View only\" indicator." },
  { v: "2.23.0", note: "Analytics > Overview chart & table upgrades. Revenue Overview now shows ₹ value labels on every non-zero point of the current-period line (previously hidden whenever the range had >14 buckets, e.g. any daily/‘This Month’ view). Revenue by Plan changed from a donut to a full-width horizontal bar chart with ₹ value labels at each bar end (biggest plan first, top 12). Customer Growth bars gained value labels above each bar. Top Performing Societies was rebuilt to the requested columns: Apartment Name, Total Flats (from the apartments feed, joined by society name), Onboarded Flats (customers in the society), Penetration % (onboarded ÷ total flats, rounded to 0), Active Customers (active-status customers in the society), Total Months (calendar months since the society's first sign-up), and Revenue for the previous & current calendar month (recharge collected = paid total − deposit), with a Total row. The Overview now also loads the apartments endpoint for flat counts." },
  { v: "2.22.0", note: "Card hover feedback: hovering any card now gives a clear cue — a subtle zoom (scale) plus a brand-green highlighted border/ring and a lift — so it's obvious which card the pointer is on. Applied app-wide via the shared Card component; the home module cards additionally highlight in their own module colour on hover and zoom a little more." },
  { v: "2.21.0", note: "Device Replacement + Task Planner attachment fixes. Device Replacement now persists each confirmed swap straight to Cloud Firestore (project backend-prowater · db prowaterdb · collection device_replacements) using the login idToken, and reads the list back from Firestore on load — so saved swaps survive reloads and show on every device (previously the record lived only in memory and vanished on refresh; the old /device-replacement/add backend POST is replaced by the direct Firestore write). If a write is refused by Firestore rules the record still shows for the session and the toast says \"Saved locally\". Task Planner attachments now upload through the backend: each file is POSTed to /documents/add?email=<signed-in user> as multipart form-data (field `documents`), the same API verified in Postman — previously the code tried a never-configured Firebase Storage path and silently fell back to local IndexedDB. The email is taken from the signed-in session (the address entered on the sign-in page), the returned Storage path is turned into a download URL, files carry the CLOUD badge, and any failure still falls back to local so the task saves." },
  { v: "2.20.0", note: "Analytics > Overview: reworked the KPI row to Total Collection, Earned Revenue, Recharge collected, Deposit collected, Active Customers and Growth Rate (Total Collection = Recharge + Deposit). Growth Rate now measures customer growth (new customers in the period ÷ existing base). The Customer Growth and Forecast-vs-Actual charts (and the KPI sparklines) now follow the date filter — their trailing window anchors to the selected period's end (capped at today), and Customer Growth's headline shows new customers in the period. Revenue Overview gained ₹ value labels on the current-period points (shown for ≤14 buckets). \"Revenue by Category\" renamed to \"Revenue by Plan\" (it was already grouped by plan). Collection Efficiency unchanged (cash collected ÷ billed in the period)." },
  { v: "2.19.2", note: "IoT Core > Device Monitor: the status-card and Water-pressure card background waveforms now match the mockup exactly — an ECG heart-monitor pulse line on the dark Devices & Water-pressure cards, equalizer bars on Online, and a smooth ripple wave on Offline & With-faults (new IoTWave component; replaced the generic area sparkline)." },
  { v: "2.19.1", note: "IoT Core > Device Monitor: restored the \"Consumption — last 2 days (12-hour blocks)\" table (dropped in the 2.19.0 redesign), now full-width and restyled to match the new premium look, placed between the charts row and Recent heartbeats." },
  { v: "2.19.0", note: "IoT Core > Device Monitor: redesigned to the premium dashboard look. Status KPI cards (Devices/Online/Offline/With faults) gained live activity sparklines; Active alerts became a cleaner list with severity pills, time-ago and a row chevron. The selected-device detail now leads with the device name + a Last-heartbeat card, a dark Water-pressure hero and a Unit-health card, then the Channels (pipes) grid. Live consumption, Pressure-over-time and Flow-rate-over-time now sit in one full-width three-column row, and Recent heartbeats spans full width with numbered pagination (1 2 … N). Headings use the app sans (DM Sans). Same live device/heartbeat data (/devices/status + /devices/history); the standalone 12-hour consumption table was dropped from this view." },
  { v: "2.18.0", note: "Analytics > Overview: removed the AI Insights panel (no real AI analysis) — Revenue Overview now spans full width — and removed the Quick Actions card. The top date-range picker and the Filters control are now functional: the date picker (This Month / Quarter / Year / Custom …) re-scopes every KPI, chart and table to the selected period and compares against the previous equal period, and Filters is a Society multi-select that scopes the whole dashboard. The Pending Receivables KPI is replaced by Earned Revenue (recognised recharge, day-weighted from the recharge date); outstanding still shows in the bottom strip. Dead bell/theme header icons removed." },
  { v: "2.17.1", note: "Analytics > Overview: switched the dashboard's headings and big-number type from the global Playfair serif to the app sans (DM Sans) for a cleaner, more consistent look across the KPI tiles, section titles, gauge and stat strip." },
  { v: "2.17.0", note: "Analytics > Overview: rebuilt into a dense command dashboard — greeting header with period/export controls; a six-tile KPI row (Total Revenue, Net Revenue, Active Customers, Collections, Pending Receivables, Growth Rate) each with a sparkline and month-on-month delta; a Revenue Overview chart comparing this period vs the previous period by day; a derived AI Insights panel; Revenue by Category (donut, grouped by plan), Customer Growth (6-month bars), a Collection Efficiency gauge and Quick Actions; and a Forecast-vs-Actual (linear projection) chart, a Top Performing Societies table (revenue/growth/efficiency/status), Report Shortcuts and a bottom KPI strip (societies, users, water connections, avg collection days, outstanding, open tickets). All figures aggregate the live customer/billing/sales/referral/ticket feeds; brand-token styling and non-animated charts throughout." },
  { v: "2.16.0", note: "Analytics: new premium Overview tab — now the module's landing page (ahead of Live Dashboard). Aggregates the live customer, billing (subscriptions + invoices), sales-lead and referral feeds into one command view: a gradient summary banner (MRR/ARR, cash MTD, customer base), an eight-tile KPI grid with month-on-month deltas (active customers, new-this-month, cash this month, total collected, outstanding, open leads, win rate, referral conversions), a trailing-6-month collected-revenue trend and a sales-pipeline snapshot by stage. First pass (premium layout + KPI section); revenue/growth & customer deep-dives, advanced filters and table redesigns follow next. Existing analytics tabs and data flows are unchanged." },
  { v: "2.15.0", note: "Premium post-login dashboard rebuild: replaced the basic module launcher with a refined operations command center featuring a responsive navigation rail, personalised hero, workspace/access metrics, searchable module directory, recent-module quick access, profile controls, polished responsive states and a cohesive premium visual system. Existing permissions, module routing and data flows remain unchanged." },
  { v: "2.14.3", note: "Ticketing > Ops Tickets: the table (and CSV) drop the Customer, Society and Priority columns (via a new hideColumns prop on the shared list; the main Tickets table keeps them). In the ticket drawer, Work Start Latitude/Longitude are combined into a single \"Open in maps\" button linking to Google Maps (q=lat,lng), shown only when both coordinates exist; Parts_Used, reason for postpone, rescheduled_Date and Society Name remain in the drawer." },
  { v: "2.14.2", note: "Ticketing: Job Start Time and Job End Time (UTC ISO timestamps from the API) now render in IST — e.g. \"22 Jul 2026, 01:34 pm\" — in the Ops Tickets table columns and the ticket detail drawer. Technician Visit Date (date-only) and Slot (a label) are shown as-is." },
  { v: "2.14.1", note: "Ticketing > Ops Tickets: the table (and its CSV) now shows four more API custom fields — Technician Visit Date, Technician Visit Slot, Job Start Time, Job End Time. These columns are Ops-only via a new extraColumns prop on the shared ticket list; the regular Tickets table is unchanged." },
  { v: "2.14.0", note: "Ticketing: the Tickets table drops the \"Type\" column and its Issue Type column now comes from the API's \"Issue Category\" custom field (also drives the Overview \"by issue type\" chart). The ticket drawer now shows the full detail set — Ticket ID, Ticket Owner, Status, Subject, Description, Zoho Customer ID, Email ID, Phone, Purifier ID, Issue Category, Society Name, Address (as a link when it's a URL), Job Start/End Time, Work Start Lat/Long/Address, reason for postpone, rescheduled_Date, Parts_Used. New \"Ops Tickets\" tab reuses the same list filtered to Issue Category ≠ Complaint." },
  { v: "2.13.3", note: "Auto GS - Society create-ticket: confirmed working end-to-end against the live backend — the endpoint now reads the payload's subject field, so raised tickets get subject \"Auto GS Schedule\" while apName still feeds the Society Name field. No payload change from 2.13.2; comment updated to reflect the backend fix." },
  { v: "2.13.2", note: "Auto GS - Society create-ticket: apName is back to the real apartment name (from the Apartments column) and address back to the society's own address; subject is still sent as \"Auto GS Schedule\" (applies once the backend reads the subject field). Reverts the v2.13.1 apName workaround." },
  { v: "2.13.0", note: "Auto GS - Society: every schedule column is now inline-editable for Admin-level access (admin/devops) and read-only for everyone else — No of Flats, No of Towers, CRO Installed Date, CRO - 250 LPH Type, Last service Backwash/Dozing dates, Address, and Next service. Next service takes a manual override that wins over the computed backwash+15-days (lets Admin reschedule a visit); editing the backwash date still recomputes it when no manual override is set. Text/number fields commit on blur; dates and the CRO-type dropdown commit on change. All edits persist to the local override store and are sent on the best-effort PATCH." },
  { v: "2.12.5", note: "Auto GS - Society: added an Address column to the table — inline-editable (text, commits on blur) for Admin/DevOps, read-only otherwise — and an Address field in the Add-new-society form; edits persist to the same local override store as the service dates. The Create-ticket call now sends that society's address (falling back to \"Testing\" if blank so the endpoint's non-blank check passes). Ticket subject is now the fixed \"Auto GS Schedule\" (apartment name removed)." },
  { v: "2.12.4", note: "Auto GS - Society: the raised ticket now shows the human-readable Zoho ticket number (e.g. #156) instead of the long internal id (244734000001189001) — the create response's ticketNumber is preferred, and if only the internal id comes back it's looked up via GET /tickets. Also sends a subject \"Auto GS - <apartment>\" so tickets read that way instead of \"AP Ticket - …\" (the endpoint must honour the subject field; the prefix is otherwise set server-side)." },
  { v: "2.12.3", note: "Auto GS - Society: Create-ticket now sends address hardcoded as \"Testing\" (the endpoint rejects a blank address with 400), keeping apName = society and technicianPhoneNumber = 9876543210." },
  { v: "2.12.2", note: "Auto GS - Society: corrected the Create-ticket endpoint to POST /apartments/create-ticket (no /api prefix — the /api one 404s) with the body { apName, address, technicianPhoneNumber } (apName = society, address blank, phone hardcoded 9876543210). Still Bearer-authed; spinner-until-ticket-id and error toast unchanged." },
  { v: "2.12.1", note: "Auto GS - Society: the \"Create ticket\" button now calls the real backend POST /api/apartments/create-ticket (Bearer-authed with the login idToken, like every other API) instead of the local stub. While the request is in flight the button shows a spinning loader (\"Creating…\"); once the backend returns a ticket id it replaces the button with the ticket-id chip in the table. Response id is read flexibly (ticketId / ticket_id / ticketNumber / id / data.*), and errors surface as a toast." },
  { v: "2.12.0", note: "Employee > Users: existing users can now have their per-module access edited (previously only settable at creation). A new \"Edit module access\" action (shield icon) opens the same access grid used to create users; it appears only for Admin & DevOps actors, and the modal + save are guarded to those roles. Saving updates the user's access and re-derives their overall role from the strongest level granted (api.updateAccess, logged as user_access_updated). The access grid was extracted into a shared AccessEditor used by both create and edit." },
  { v: "2.11.2", note: "Analytics > Earned Revenue: the Per-invoice recognition table's \"Paid on\" column header is now click-to-sort (ascending/descending by paid date, with an arrow indicator); default sort stays by earned revenue, descending." },
  { v: "2.11.1", note: "Analytics > Earned Revenue: reworked the Per-invoice recognition table to the AOP/Excel model. Removed the Term column. Earned revenue = ((month end − paid date + 1) × recharge) ÷ days in the paid month, with the month end taken dynamically (30/31/28/29). New columns: Month End Date, Days remaining (month end − paid date), Earned revenue; Earned/day fixed to recharge ÷ days-in-month. The Earned Revenue card and CSV follow the new figure. The Earned-vs-recharge trend now starts at Jan 2026 (never earlier) and its Earned bars use the same recognition model." },
  { v: "2.11.0", note: "Analytics: new AOP (Annual Operating Plan) section, visible only to Admin & DevOps. Pick a financial year (2026 / 2027 / 2028 → Apr–Mar), then enter/modify each month's \"Target - Subscription Revenue (Incl GST)\" (persisted to localStorage pw_aop_targets). Each month's target is checked against the recharge cash collected (same total−deposit split as Earned Revenue), with a per-month Target Achieved % colour-coded <30% red / 30–80% amber / >80% green. Summary cards: Subscription target, Recharges collected, Target to be achieved (colour-coded % for the year) and Recharge received (recharges ÷ target, 2 decimals). CSV export of the whole plan." },
  { v: "2.10.1", note: "IoT Core tables (12-hour consumption + Recent heartbeats): litre values now show as rounded integers with the unit inline (152.48 → \"152 L\") instead of 2-decimal numbers, and the redundant \"(L)\" was dropped from those column headers. Headers and cells are centre-aligned (the 12h table's value columns were right-aligned)." },
  { v: "2.10.0", note: "IoT Core regression fix: /devices/history now returns { items:[…] } instead of a bare array, so the live poll's Array.isArray check yielded null and the Recent heartbeats table, Live consumption and the pressure/flow charts all went blank — now unwraps .items. The live window is longer (downsampled ~2 days), so the Live-consumption label shows hours when the span is long. Analytics > Earned Revenue: the \"Earned this month\" card is renamed \"Total Collection\" (it always showed cash collected), and a new \"Earned Revenue\" card sits next to it showing the recognised revenue for the period (the \"Earned in period\" column total). Filters gained an Apartment (society) dropdown and the standard date-range picker (Today / This Week / … / Custom) replacing the month dropdown; cards, per-invoice table and CSV are now range- and apartment-scoped, while the 12-month trend chart stays as trailing context anchored on the range's end month." },
  { v: "2.9.0", note: "IoT Core: new \"Consumption — last 2 days (12-hour blocks)\" table on the device detail. Fetches /devices/history?deviceId=…&days=2 for the selected device and splits litres drawn per channel into IST calendar half-day blocks (00:00–12:00 / 12:00–24:00), with a Total-per-block column, a 2-day totals row, and an average-per-day row (total ÷ actual data-span in days, so it self-adjusts when a full 2 days is present). Litres consumed = sum of positive increases in the cumulative totalVolumeLitres meter, which survives the occasional meter-reset dip that a simple last−first would mis-count. Times shown in IST." },
  { v: "2.8.2", note: "Auto GS - Society: the \"Last service Date For Backwash\" and \"Last service Date For Dozing\" columns are now editable inline — but ONLY for Admin & DevOps access (moduleAccess === admin/devops). All other access levels see the dates as read-only text, exactly as before. Editing a backwash date immediately recomputes Next service / Days left (the cycle is anchored on it). Edits persist to localStorage (pw_gs_date_overrides) and are applied over the seed/endpoint data so they survive reloads; a WIRE stub for PATCH /api/gs-schedules/:society is in place for when the backend endpoint exists." },
  { v: "2.8.1", note: "About > Changelog: cards are now a fixed 232×196 instead of stretching to fit their text — one long entry was making the whole strip ~780px tall. The version number + build badge row is pinned and only the note scrolls inside each card." },
  { v: "2.8.0", note: "Releases can be scheduled: the publish form gained an \"Announce from\" date & time (empty = announce now), the button reads \"Schedule release\" when a future time is set, and pending releases carry a SCHEDULED badge in the list until they fall due. The what's-new popup now shows every release that is due and unseen — so a user who doesn't log in on the scheduled day still gets it on their next login — and it appears mid-session (30s tick) if a release falls due while someone is already signed in. \"Seen\" is now tracked per USER and by release id (pw_releases_seen_by) rather than one per-browser timestamp: the old stamp would have marked a future-scheduled release as already seen, and a shared machine only ever showed the popup to the first person. The old stamp is migrated on first run so existing users aren't re-shown old releases. NOTE: releases still live in localStorage (pw_releases), so a published release is only visible in the browser it was published from — shared storage (e.g. the Firestore the App Logs module already uses) is still required for this to reach other users." },
  { v: "2.7.1", note: "Charts: pie/donut charts were running Recharts' default ~1.5s enter animation — every <Bar>/<Line> in the app already had isAnimationActive={false} but no <Pie> ever did, so pies appeared to \"load slowly\". All 5 pies are now static, along with 7 more Bars/Areas that were also still animating (33/33 chart primitives now static). Donut slices gained labels showing the absolute value and share (e.g. \"8 · 40%\") drawn outside the ring with leader lines; pie containers grew 250→290 / 260→300px to fit them." },
  { v: "2.7.0", note: "Rebrand: the whole dashboard moves to the ProWater palette (brand green #0A9D6E, green #08805A, deep green #0B6F52, mint #EEF7F3, ink #0A1A12, muted #7D8A83, faint #A9B3AC, hairline #ECEEED, surface #FFFFFF, amber, red #DC4141, blue #2A86D6). 568 hardcoded hexes across App.jsx were mapped onto those tokens — no off-palette hue remains except the WhatsApp brand marks. The :root block is now the single source of truth: the 11 brand hexes plus documented derivations (status tints ≈12% over surface, tint borders ≈30%, a stepped ink shell). Module accents and chart categoricals collapse to the palette via a shared CHART_PALETTE (7 max distinct hues). Amber ships as #986315 — the specified #E0921F at the same hue and saturation but darkened, because the original failed WCAG AA as text (2.25:1 on its own tint) and amber is used as text in 27 places. The shell stays dark — the palette's ink #0A1A12 (stepped #16261D / #06100B); deep green #0B6F52 was trialled as the shell and rejected as too light, and remains a content accent. The brand-green active nav pill is kept (5.18:1 on ink). Legacy --forest/--teal/--lime names are kept as aliases." },
  { v: "2.6.0", note: "Analytics > Revenue: the month dropdown is replaced by a standard date-range picker — Today / This Week / This Month / This Quarter / This Year / Yesterday / Previous Week / Previous Month / Previous Quarter / Previous Year / Custom (From–To). Cards now compare the selected period against the previous equal period (calendar-aware for month/quarter/year) and against the same span a year earlier; the chart and breakdown follow the range, switching from per-day to per-month buckets once the span passes ~2 months. Shared DateRangePicker + resolveRange/prevRange helpers added for roll-out to the remaining Analytics reports. Customers: the society dropdown is now a searchable multi-select (all selected by default, uncheck to exclude)." },
  { v: "2.5.2", note: "IoT Core: the Online KPI card now has a slow rain-drop animation drifting down it (when at least one device is online). Confirmed the Offline KPI stays a plain card with no red/ripple effect when the offline count is 0." },
  { v: "2.5.1", note: "IoT Core: (1) Fault & alert center — a fleet-wide panel listing offline devices + channel faults (critical/warning, click to inspect), an \"all systems nominal\" bar when clear, and a toast when a new alert appears mid-session. (2) Live consumption — diffs the cumulative totalVolumeLitres across the live history window to show water drawn per channel + total, with a pulsing \"Flowing/Idle\" indicator and current L/min." },
  { v: "2.5.0", note: "IoT Core: the Offline KPI card now uses a water-ripple effect — deep red sweeps in from the right and fades to amber as it dissipates (KPI only). Device rows dropped the red breathing fill for a status-coloured border: green when online, red when offline (thicker when selected)." },
  { v: "2.4.9", note: "IoT Core: the device-detail header (device ID + RO/firmware line) now uses the app's DM Sans UI font instead of the Playfair serif — the serif looked out of place on the alphanumeric device IDs." },
  { v: "2.4.8", note: "IoT Core: softened the offline breathing red to a faded, desaturated palette (#FBE8E8 ↔ #F5BFBF) with a gentler glow and slightly slower 3.6s loop — less alarming, easier on the eye." },
  { v: "2.4.7", note: "IoT Core: the Offline KPI card and any offline device rows now pulse with a \"breathing\" effect — light red on the exhale, deep red on the inhale (3s ease loop, respects prefers-reduced-motion). Selected device is still marked with a teal outline." },
  { v: "2.4.6", note: "IoT Core Recent heartbeats: page size reduced to 10 rows, and the timestamp column header renamed \"Sync history\"." },
  { v: "2.4.5", note: "IoT Core Recent heartbeats: paginated at 20 rows per page with a Prev / Next CTA and a \"1 / N\" page indicator (page resets to 1 on device switch)." },
  { v: "2.4.4", note: "IoT Core Recent heartbeats: removed the 360px scroll cap so the full heartbeat log renders, and centre-aligned every value (channel totals were right-aligned)." },
  { v: "2.4.3", note: "IoT Core Recent heartbeats table: the Time column now shows full date + time (was time-only, which was confusing across days), and the Pressure column was dropped (it's constant 0 for these devices)." },
  { v: "2.4.2", note: "IoT Core revamp + offline fix: online/last-seen now come from the newest /devices/history heartbeat instead of the stale /devices/status snapshot (status was serving a day-old timestamp so live devices showed Offline). The dashboard now polls history for every device in the roster and merges the freshest reading. Recent heartbeats table rebuilt as a timestamp × channel matrix showing totalVolumeLitres per channelId (columns built dynamically per device, so it works for 4-channel and 2-channel units), and the flow-rate chart now draws a line per channel." },
  { v: "2.4.1", note: "Task Planner: imported the technician-app / Zoho Desk-sync meeting action items (22 tasks, duplicates skipped) auto-categorised (Technician App, Ticketing, Customer App, Backend & APIs, Messaging, IoT, Zoho FSM, Ops & Finance, Review & QA)." },
  { v: "2.4.0", note: "Admin \"Modify Tasks\" panel (Task Planner, admin-only) to add/remove Statuses, Sprints & Categories — no longer capped at Sprint 1–4. About module gains App Releases & Technician Releases sections (free-text Sprint / version / notes; Publish stamps date+time), and every user gets a \"what's new\" release popup on login for releases they haven't seen." },
  { v: "2.3.7", note: "Societies view: frozen table header, centre-aligned cells, a subtotal row under each expanded society, and status-coloured customer rows (inactive = red, dunning = amber)." },
  { v: "2.3.6", note: "Customer module → Societies: each society row is now expandable — click it to see that society's customers (ID, name, purifier ID, device, phone, plan, status)." },
  { v: "2.3.5", note: "Customer module: new Societies tab — customer count per society (with active count + Own/Normal/Hot&Cold device mix), sortable, searchable, CSV export, grand-total footer." },
  { v: "2.3.4", note: "Synced this build with all v2.1.5–2.3.3 changes (Task Planner, Penetration Tracker, Revenue vertical breakdown, Customer KPI cards, Zoho Desk ticketing, sprint-board import, P0–P3 priorities + Sprint field, etc.) while keeping this build's API Usage tab (Logs Tracker) and admin-email lib." },
  { v: "2.3.3", note: "Task Planner: Category and Sprint in the task editor are now editable comboboxes — pick from the list or type a custom value." },
  { v: "2.3.2", note: "Task Planner: imported the product sprint board (~49 tasks, duplicates skipped by title) each filed under its sheet Category (Customer App, PW Website, Zoho CRM/ERP/Billing/Inventory/FSM, Freshdesk, Bug Fixes, Form, Wisdom, IoT, Technician App). Priority switched to the P0–P3 scale and a Sprint field/dropdown added (editor, card, list, filters). Added member Pranshu. Fixed the editor font — inputs now use the dashboard's DM Sans instead of the browser-default monospace." },
  { v: "2.3.1", note: "Penetration Tracker now builds from the subscriptions API: each subscription's created_at is the sign-up date, joined to the customer's society via customer_id → zoho_customer_id. Cohort M1..Mn per society as before. Added `createdAt` to the subscription mapping." },
  { v: "2.3.0", note: "Penetration Tracker: robust sign-up date parsing — `since`/created_time values that plain new Date() can't read (e.g. 19-Jan-2026, 19/01/2026, epoch, +0530 offsets) are now parsed, so societies build correctly from the customer API's society + since fields." },
  { v: "2.2.9", note: "Penetration Tracker: fixed the empty view on live data — Zoho customer records usually lack `society`, so it now enriches society by matching each customer to a lead by phone/email (leads carry the society), falling back to the billing address. The empty state now reports how many customers resolved a society vs a sign-up date so gaps are visible." },
  { v: "2.2.8", note: "Penetration Tracker reworked to a cohort matrix: each society is aligned to its own M1 = the month of its first sign-up (derived from the customer API created_time), so columns are M1..Mn months-since-launch (like the source sheet). Added a derived Launch column, blanks for months a society hasn't reached, and per-M column totals." },
  { v: "2.2.7", note: "Analytics: new Penetration Tracker — a month-on-month matrix of cumulative customers per society (built from the customer API by sign-up date), with a totals row across the top, a frozen Society Name column, month-grew highlighting and CSV export. Launch-date-relative M1..Mn alignment is left for later." },
  { v: "2.2.6", note: "Customer module: added KPI cards for Active Customers, Inactive Customers, and the device mix (Own / Normal / Hot & Cold, derived from the purifier ID prefix)." },
  { v: "2.2.5", note: "Task Planner: removed the \"Summarise via AI\" option from the task Notes (reverted to a plain notes field)." },
  { v: "2.2.4", note: "Analytics > Revenue: weekend rows (Sat/Sun) in the daily breakdown are highlighted amber. Task Planner: module now opens on the Weekly View by default; the \"Scoping\" status column was removed (old Scoping tasks map to New); the Email field was dropped from the task editor." },
  { v: "2.2.3", note: "Analytics > Revenue: daily breakdown dropped the Deposit/Recharge rows (revenue only) and switched from one wide horizontal table to three vertical day-columns — Days 1–10, 11–20, 21–31 — each with its own column total, plus a grand total at the bottom. CSV export simplified to Date + Revenue." },
  { v: "2.2.2", note: "Task Planner: added a 2nd task batch (WhatsApp/Meta/Twilio integration + Zoho rate-limit & end-to-end automation follow-ups) under a new \"Messaging\" category. Seeding now works in append-once batches (tracked in pw_tasks_imported) so new batches land on existing boards without duplicating older tasks." },
  { v: "2.2.1", note: "Task Planner attachments can now be stored in Firebase Cloud Storage (shared across devices) via the Storage REST API using the existing login idToken — enabled by setting VITE_FIREBASE_STORAGE_BUCKET; falls back to local IndexedDB when unset or on upload failure. Each attachment shows a CLOUD/LOCAL badge; only a lightweight URL/metadata is kept in localStorage." },
  { v: "2.2.0", note: "Task Planner fixes: attachment files now live in IndexedDB (large quota) with only metadata in localStorage — this fixes edits silently failing to save and the \"can't add more than one attachment\" bug, both caused by base64 files overflowing the ~5 MB localStorage limit. Per-file cap raised to 15 MB; legacy inline attachments auto-migrate to IndexedDB. The task editor now shows Created and Last edited timestamps." },
  { v: "2.1.9", note: "Task Planner: Weekly View is now a business-facing analytics dashboard (delivery-status donut, scope-size chart, completion KPIs) where each scope expands to its tasks on click. Start date auto-fills when a task moves to Picked Up and end date auto-fills when it goes Live. Board columns are now fixed-height with a pinned header and their own scrollbar, so the status header stays visible while scrolling the cards." },
  { v: "2.1.8", note: "Ticketing migrated from Freshdesk to Zoho Desk — all Freshdesk API code removed; the module now reads live tickets from the backend GET /tickets (authenticated with the same login idToken as the other Zoho APIs), with string-based Zoho Desk statuses/priorities. Task Planner: \"The Group\" now resolves to exactly Anis, Sujan, Harsh, Sri & Arjun (group tasks show for any of them when filtering); every task has a Category; added a Weekly View (business requirements grouped by category with completion bars); and status changes now raise persistent notifications (bell + unread badge) waiting at next login." },
  { v: "2.1.7", note: "Task Planner: cards now support MULTIPLE assignees (avatar stack on cards, multi-select chips in the editor) and a new \"The Group\" member for team-wide tasks. Seeded the board with the agreed 33-item next-steps backlog (imported once into a fresh board) — each task carries its owner(s) and a description." },
  { v: "2.1.6", note: "New Task Planner module — a ClickUp-style Kanban board with 7 columns (Scoping, New, Picked Up, In-Progress, Testing & QA, Staging, Live) and drag-and-drop between them. Cards carry assignee (Anis, Sujan, Harsh, Sri, Arjun, Arun, IQ Labs, Zoho Vendor), email, notes, attachments (stored locally), start/end dates and priority. Includes a List view, assignee/priority filters, search and per-status counts. Tasks persist to localStorage (pw_tasks)." },
  { v: "2.1.5", note: "Net Revenue (Analytics > Revenue): daily breakdown table now splits into three rows — Deposit, Recharge and Net Revenue — and gains an Apartment filter at the top (invoices joined to the customer's society by customer_id) that scopes the cards, chart and table. Earned Revenue: rows in the Per-invoice recognition table are tinted light yellow whenever a deposit was collected on the account." },
  { v: "2.1.4", note: "Live Dashboard paused as a \"Work in progress\" card — it no longer calls any API when opened (Analytics again lands on Referral). About module gains an \"APIs used\" section listing every backend / Firebase / external endpoint the app calls." },
  { v: "2.1.3", note: "Live Dashboard revenue join reworked per real data: apartment name is fuzzy-matched to the customers API `society` (e.g. \"MJR Clique Hydra\" ⊂ \"MJR Clique Hydra Apartment\"), then the customer's subscription `amount` is summed (bucketed by activation month). Uses customers + subscriptions instead of the lead name/email guess." },
  { v: "2.1.2", note: "Live Dashboard revenue now comes from the subscriptions API `amount` (not invoices), matched to an apartment by the subscription's customer_email → customer_name → phone against the leads' society; bucketed by activation month. Drops the invoices+customers fetches (fewer API calls)." },
  { v: "2.1.1", note: "Live Dashboard: added \"Only apartments with leads\" toggle (on by default); revenue join now falls back to matching a paying customer to a lead by phone/email to inherit the society, since Zoho Billing customers often have no society field (was leaving revenue blank)." },
  { v: "2.1.0", note: "Analytics: new Live Dashboard (combines apartments + leads + billing → Apartment, flats, Installed, Penetration %, Target left, recharge Revenue for last two months) and is now the Analytics landing tab. Earned Revenue table now filters to the selected month only; the Earned-vs-recharge chart shows ₹ value labels on bars + line." },
  { v: "2.0.5", note: "Rate-limit hardening 2: removed the eager on-login prefetch of all 4 datasets (now fetched on-demand per module); detect Zoho code-45 (\"exceeded maximum call rate limit of 1,000\") returned as 500 and back off 5 min while serving cache; cache windows extended to 3h (leads 1h); paginator read-ahead reduced to 2 so a rate-limit stops paging immediately." },
  { v: "2.0.4", note: "Rate-limit fix: dropped the heavy _raw payload from leads/apartments so the localStorage cache no longer silently overflows quota (which was forcing a full Zoho refetch on every reload); LS.set now reports write failures; added a GLOBAL request gate (max 2 concurrent Zoho requests, ~150ms apart) so a cold load can't burst into a 429; extended cache TTL to 60m (leads 30m)." },
  { v: "2.0.3", note: "Device Replacement popup redesigned into a shorter 2-step window (Old device details → New device details) with clearer labels/placeholders (Name, Phone “10-digit”, Email ID, Device Type “Select…”, auto uninstall date) and a live old-device ageing line; the irreversible confirm is now a compact separate popup. Device Type is required." },
  { v: "2.0.2", note: "Device Replacement now persists each confirmed swap to the DB via POST /device-replacement/add (old_device/new_device payload); phone is now a required field to match the backend; a toast confirms DB save or reports the server message." },
  { v: "2.0.1", note: "All data tables now fully centre-aligned — flipped every per-cell left/right override (names, addresses, POC, totals rows, chevron & detail columns) to centre; form labels & the Net-Revenue day-matrix keep their intentional alignment." },
  { v: "2.0.0", note: "Apartment Leads: removed the Manager Name column and added a POC column (order: Apartment Name, Manager Number, Meeting Status, POC, Address, Pincode, Flats, Created)." },
  { v: "1.9.9", note: "Display numbers (KPIs/stats) switched from Playfair serif to DM Sans to match the body text; Playfair kept for headings only." },
  { v: "1.9.8", note: "Design polish: real typography (Playfair Display headings + DM Sans body, dropped the Arial override), focus-glow inputs, custom select chevrons, hover-highlighted table rows, tactile button press, deeper blurred modal backdrops with a pop-in animation." },
  { v: "1.9.7", note: "Sales Analytics defaults to “Only apartments with leads” checked; Auto Scheduler rows all use the same white background (no red/amber row tinting)." },
  { v: "1.9.6", note: "UI polish: About changelog is now a horizontal timeline strip with module docs below; Device Replacement “New Entry” opens a stepped modal popup instead of taking over the screen." },
  { v: "1.9.5", note: "Persistent localStorage caches (pw_cache_*, 15–30m TTL) survive reloads; serve cached data on Zoho rate-limit (500) instead of failing; 1-min shared cooldown." },
  { v: "1.9.4", note: "Sales Analytics: removed 2 charts; pivot got created-date filter + Export; removed apartment search." },
  { v: "1.9.3", note: "Pivot expanded panel = scrollable zebra card, sticky header, count." },
  { v: "1.9.2", note: "Sales Analytics apartment × lead-status pivot, expandable to individual leads (join apartment name = Society Name)." },
  { v: "1.9.1", note: "Apartment Leads purpose-built table (columns + created-date/meeting-status filters + sortable Created)." },
  { v: "1.9.0", note: "Apartment Leads tab (adaptive table) via /admin/zoho/get-all-apartments/data." },
  { v: "1.8.9", note: "Show Convert Done again (emptied HIDDEN_LEAD_STATUSES)." },
  { v: "1.8.8", note: "Auto Scheduler no longer flags Server Down (local-first)." },
  { v: "1.8.7", note: "Server Down popup button → \"Close Module\"." },
  { v: "1.8.6", note: "Rate-limit hardening (bounded concurrency, 429 backoff, in-flight dedup)." },
  { v: "1.8.5", note: "Login matches email → Employee-module user (username/role/access)." },
  { v: "1.8.4", note: "Sales Error Correction tab." },
  { v: "1.8.3", note: "Analytics Sales section (lead-status numbers, society dropdown, plan value by society)." },
  { v: "1.8.2", note: "Removed Finance module; About history scrollable." },
  { v: "1.8.1", note: "Apartment Performance month selector." },
  { v: "1.8.0", note: "API failure monitoring (Failures tab, Server Down popup, email alerts)." },
  { v: "1.7.0", note: "Earned Revenue: MoM % + deposit/recharge = total; day-based recognition; deposit-collected card." },
  { v: "1.6.0", note: "Parallel pagination + totals rows everywhere." },
  { v: "1.5.0", note: "Removed DP Customers + Finance rename; performance (prefetch, cache) prep." },
  { v: "1.4.0", note: "Apartment Performance tab." },
  { v: "1.3.0", note: "Earned Revenue tab." },
  { v: "1.2.0", note: "Logs Tracker IP/version/clear fixes." },
  { v: "1.1.0", note: "Device Replacement + About modules; Auto Scheduler columns; version footer; removed Convert Done card + Defaulters." },
  { v: "1.0.0", note: "Initial." },
];

export function parseFlexDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  const s = String(v).trim();
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000);   // epoch seconds
  if (/^\d{13}$/.test(s)) return new Date(Number(s));          // epoch millis
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  d = new Date(s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2")); // "…+0530" → "…+05:30"
  if (!isNaN(d.getTime())) return d;
  const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  let m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ,]*\s*(\d{2,4})$/); // 19-Jan-2026 / 19 Jan 26
  if (m) { const mo = MON.indexOf(m[2].slice(0, 3).toLowerCase()); if (mo >= 0) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, mo, +m[1]); } }
  m = s.match(/^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})$/); // 2026-01-19 or 19/01/2026 (day-first)
  if (m) { let a = +m[1], b = +m[2], c = +m[3]; if (a > 31) return new Date(a, b - 1, c); let y = c < 100 ? c + 2000 : c; return new Date(y, b - 1, a); }
  return null;
}

// ---- Referral-domain + universal auth/session/logging api object ----
// (used far beyond Referral — api.logView is called from every module,
// api.login/logout/refreshIdToken drive auth, api.getPhoto/createUser/etc
// serve Employee, api.getLogs/clearLogs serve Logs Tracker.)
export let _apiCacheAt = 0;
export const CACHE_MS = 30 * 1000;

export async function fetchAllReferrals(force = false) {
  const now = Date.now();
  if (!force && _apiCache && (now - _apiCacheAt) < CACHE_MS) return _apiCache;
  const res = await fetch(`${API_BASE}/api/admin/all-referrals`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  if (!json || json.success !== true || !Array.isArray(json.data)) throw new Error("Unexpected API response");
  _apiCache = json;
  _apiCacheAt = now;
  return json;
}
export function parseApiDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
export function toReferrers(json) {
  return json.data.map((row, i) => {
    const r = row.referrer || {};
    return {
      id: row.referral_lead_id || `ref-${i}`,
      name: r.customer_name || "—",
      email: r.customer_email || "—",
      phone: r.customer_phone || "—",
      code: r.customer_key || r.customer_number || "—",
      society: r.society_name || "",
      customerNumber: r.customer_number || "",
      purifierId: r.purifier_id || "",
      zohoId: r.zoho_customer_id || "",
      joined: row.created_at || "",
      totalReferred: row.total_referrals ?? (row.referees?.length || 0),
      converted: row.total_converted ?? 0,
      pending: row.total_pending ?? 0,
      freeMonthsEarned: row.referrer_free_months ?? 0,
      status: "active",
    };
  });
}
export function toReferees(json) {
  const out = [];
  json.data.forEach((row, i) => {
    const referrerId = row.referral_lead_id || `ref-${i}`;
    (row.referees || []).forEach((e, j) => {
      out.push({
        id: `${referrerId}-${j}`,
        referrerId,
        name: e.name || "—",
        email: e.email || "—",
        phone: e.phone || "—",
        flat: e.flat_number || "",
        society: e.society_name || "",
        status: e.status === "converted" ? "paid" : (e.status || "pending"),
        rawStatus: e.status || "",
        refereeFreeMonths: e.referee_free_months ?? 0,
        referrerGetsFreeMonths: e.referrer_gets_free_months ?? 0,
        date: e.referral_timestamp || "",
        convertedAt: e.converted_at || "",
        invoice: e.flat_number ? `Flat ${e.flat_number}` : "—",
        plan: e.society_name || "—",
        amount: 0,
        reward: e.referrer_gets_free_months ?? 0,
      });
    });
  });
  return out;
}
export function toCredits(json) {
  const out = [];
  json.data.forEach((row, i) => {
    const referrerId = row.referral_lead_id || `ref-${i}`;
    (row.referees || []).forEach((e, j) => {
      const months = e.referrer_gets_free_months ?? 0;
      out.push({
        id: `${referrerId}-${j}`,
        referrerId,
        refereeName: e.name || "—",
        invoice: e.flat_number ? `Flat ${e.flat_number}` : "—",
        type: months >= 2 ? "existing" : "new",
        credits: months || (e.status === "converted" ? EXISTING_CREDIT : NEW_CREDIT),
        status: e.status === "converted" ? "approved" : "pending",
        date: e.referral_timestamp || "",
      });
    });
  });
  return out;
}
export function toTrend(json) {
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const buckets = {};
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}`;
  const ensure = (d) => {
    const k = key(d);
    buckets[k] = buckets[k] || { y: d.getFullYear(), m: d.getMonth(), referrals: 0, conversions: 0, rewards: 0 };
    return buckets[k];
  };
  json.data.forEach(row => {
    // Count referrals & conversions per referee (by their dates).
    let latestConv = null;
    (row.referees || []).forEach(e => {
      const made = parseApiDate(e.referral_timestamp);
      const conv = parseApiDate(e.converted_at);
      if (made) ensure(made).referrals += 1;
      if (conv) {
        ensure(conv).conversions += 1;
        if (!latestConv || conv > latestConv) latestConv = conv;
      }
    });
    // Attribute this referrer's TOTAL free months (source of truth) to the month
    // of their most recent conversion, so the chart total matches the KPI card.
    const months = row.referrer_free_months ?? 0;
    if (months > 0) {
      const when = latestConv || parseApiDate(row.updated_at) || parseApiDate(row.created_at);
      if (when) ensure(when).rewards += months;
    }
  });
  const arr = Object.values(buckets).sort((a, b) => (a.y - b.y) || (a.m - b.m));
  if (arr.length === 0) {
    const now = new Date();
    return [{ month: MON[now.getMonth()], year: now.getFullYear(), label: `${MON[now.getMonth()]} ${now.getFullYear()}`, referrals: 0, conversions: 0, rewards: 0 }];
  }
  return arr.map(b => ({ month: MON[b.m], year: b.y, label: `${MON[b.m]} ${b.y}`, referrals: b.referrals, conversions: b.conversions, rewards: b.rewards }));
}
export const api = {
  // >>> WIRE: replace with Firebase Auth / your auth endpoint
login: async (username, password) => {
  const net = await getClientNetwork();
  const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
  const email = username.includes("@") ? username : `${username}@prowater.in`;

  let firebaseRes;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }) }
    );
    firebaseRes = await res.json();
  } catch {
    throw new Error("Network error. Check your connection.");
  }

  if (firebaseRes.error) {
    _session = net;
    pushLog({ type: "login_failed", actor: username, detail: "Invalid credentials" });
    _session = { ..._emptySession }; saveSession();
    throw new Error("Invalid username or password.");
  }

  // Firebase verified ✅ — Firebase does the password auth; the Employee module
  // supplies profile/role/access. Match the verified email → an Employee user (§13).
  const emp = _users.find(u => norm(u.email) === norm(firebaseRes.email));
  if (emp && emp.active === false) {
    _session = net;
    pushLog({ type: "login_failed", actor: emp.username, detail: "Account disabled" });
    _session = { ..._emptySession }; saveSession();
    throw new Error("Your account has been disabled. Contact an admin.");
  }

  _session = net; saveSession();
  sessionStorage.setItem("pw_idToken", firebaseRes.idToken);
  // Firebase ID tokens live ~1h; refreshToken (v2.29.100) lets an ACTIVE session
  // silently renew past that, so someone actually using the app isn't force-
  // logged-out just because 60 minutes of wall-clock time passed since login.
  // Idle (1h) and next-day auto-logout are still enforced in the App shell
  // (see SESSION_* / refreshIdToken below) — those are the only real logout paths now.
  if (firebaseRes.refreshToken) sessionStorage.setItem("pw_refreshToken", firebaseRes.refreshToken);
  sessionStorage.setItem("pw_tokenExpiry", Date.now() + 60 * 60 * 1000);
  sessionStorage.setItem("pw_last_activity", String(Date.now()));
  sessionStorage.setItem("pw_session_day", new Date().toDateString());

  if (emp) {
    pushLog({ type: "login_success", actor: emp.username, detail: `Signed in as ${emp.role} (${emp.username})` });
    const { password, ...rest } = emp;                    // never carry the password into the session
    return { ...rest, id: firebaseRes.localId, email: firebaseRes.email };
  }

  // No Employee record → default admin identity (username derived from the email).
  pushLog({ type: "login_success", actor: firebaseRes.email, detail: "Admin signed in via Firebase" });
  return {
    id: firebaseRes.localId,
    name: firebaseRes.email.split("@")[0],
    username: email.split("@")[0],
    email: firebaseRes.email,
    role: "admin",
    active: true,
    access: allAccess("admin"),
  };
},
logout: async (username) => {
  sessionStorage.removeItem("pw_idToken");
  sessionStorage.removeItem("pw_tokenExpiry");
  sessionStorage.removeItem("pw_refreshToken");
  pushLog({ type: "logout", actor: username, detail: "Signed out" });
  _session = { ..._emptySession }; saveSession();
},
// Silently renew the Firebase ID token via its refresh token (v2.29.100) —
// called by the App shell shortly before the current token's ~1h life is up,
// so an active session keeps going instead of hard-stopping at the 60min mark.
// Returns true on success (idToken/tokenExpiry updated in place), false if
// there's no refresh token or the network/Firebase call fails.
refreshIdToken: async () => {
  const refreshToken = sessionStorage.getItem("pw_refreshToken");
  if (!refreshToken) return false;
  const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    const j = await res.json();
    if (!res.ok || !j.id_token) return false;
    sessionStorage.setItem("pw_idToken", j.id_token);
    sessionStorage.setItem("pw_refreshToken", j.refresh_token || refreshToken);
    sessionStorage.setItem("pw_tokenExpiry", String(Date.now() + (Number(j.expires_in) || 3600) * 1000));
    return true;
  } catch { return false; }
},
// Repopulate _session (IP/network/geo) for token-restored reloads whose session
// was lost — so their logs record a real IP instead of "—" (§5).
ensureSession: async () => {
  if (_session && _session.ip && _session.ip !== "—") return;
  try { const net = await getClientNetwork(); _session = net; saveSession(); } catch { /* ignore */ }
},
// Clear the audit log (admin action, from the Logs toolbar).
clearLogs: (actor) => {
  _logs = [];
  saveLogs();
  pushLog({ type: "logs_cleared", actor, module: "Logs Tracker", detail: "Cleared all logs" });
},
  // Real data from the ProWater admin API (referrers + nested referees).
  getReferrers: async () => { const j = await fetchAllReferrals(); return toReferrers(j); },
  getReferees: async () => { const j = await fetchAllReferrals(); return toReferees(j); },
  getTrend: async () => { const j = await fetchAllReferrals(); return toTrend(j); },
  forceRefresh: async () => { await fetchAllReferrals(true); }, // bypass cache
  getCredits: async () => {
    const j = await fetchAllReferrals();
    const base = toCredits(j);
    // Apply admin actions made in this session (approve/reject), plus any manual additions.
    const merged = base.map(c => _creditOverrides[c.id] ? { ...c, status: _creditOverrides[c.id] } : c);
    return [..._manualCredits, ...merged];
  },
  addManualCredit: async (actor, data) => {
    await wait(320);
    const c = { id: "manual-" + crypto.randomUUID(), status: "approved", date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), manual: true, ...data };
    _manualCredits = [c, ..._manualCredits];
    // >>> WIRE: POST this manual credit to your backend / Zoho here
    pushLog({ type: "credit_manual", actor, detail: `Added ${data.credits} free month(s) for ${data.refereeName} (${data.invoice || "no invoice"})` });
    _undoStack = [{ id: crypto.randomUUID(), ts: new Date().toISOString(), actor, kind: "add_manual",
      label: `Added manual credit · ${data.refereeName} (${data.credits} free months)`,
      restore: () => { _manualCredits = _manualCredits.filter(x => x.id !== c.id); } }, ..._undoStack];
    return c;
  },
  approveCredit: async (actor, creditId) => {
    await wait(200);
    const prev = _creditOverrides[creditId] ?? null; // remember prior state
    _creditOverrides[creditId] = "approved";
    // >>> WIRE: POST approval to your backend so the free months are granted in Zoho
    pushLog({ type: "credit_approved", actor, detail: `Approved free months (credit ${creditId})` });
    _undoStack = [{ id: crypto.randomUUID(), ts: new Date().toISOString(), actor, kind: "approve",
      label: `Approved credit ${creditId}`,
      restore: () => { if (prev === null) delete _creditOverrides[creditId]; else _creditOverrides[creditId] = prev; } }, ..._undoStack];
  },
  rejectCredit: async (actor, creditId) => {
    await wait(200);
    const prev = _creditOverrides[creditId] ?? null;
    _creditOverrides[creditId] = "rejected";
    // >>> WIRE: POST rejection to your backend
    pushLog({ type: "credit_rejected", actor, detail: `Rejected free months (credit ${creditId})` });
    _undoStack = [{ id: crypto.randomUUID(), ts: new Date().toISOString(), actor, kind: "reject",
      label: `Rejected credit ${creditId}`,
      restore: () => { if (prev === null) delete _creditOverrides[creditId]; else _creditOverrides[creditId] = prev; } }, ..._undoStack];
  },

  // Backtrack — list reversible actions and revert them.
  getUndoable: async () => { await wait(120); return _undoStack.map(({ id, ts, actor, kind, label }) => ({ id, ts, actor, kind, label })); },
  revertAction: async (actor, undoId) => {
    await wait(200);
    const entry = _undoStack.find(u => u.id === undoId);
    if (!entry) return;
    entry.restore();                                  // undo the change
    _undoStack = _undoStack.filter(u => u.id !== undoId); // remove from stack
    // >>> WIRE: POST the reversal to your backend so it's reflected in Zoho too
    pushLog({ type: "reverted", actor, detail: `Reverted: ${entry.label}` });
  },

  // user management (admin)
  getUsers: async () => { await wait(200); return _users.map(u => ({ ...u, password: undefined, photo: _photos[u.username] || null })); },
  createUser: async (actor, data) => {
    await wait(350);
    if (_users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) throw new Error("A user with that username already exists.");
    const u = { id: crypto.randomUUID(), active: true, created: new Date().toISOString(), ...data };
    _users = [..._users, u];
    saveUsers();
    pushLog({ type: "user_created", actor, detail: `Created ${data.role} ${data.username}` });
    return { ...u, password: undefined };
  },
  resetPassword: async (actor, userId, newPw) => {
    await wait(300);
    _users = _users.map(u => u.id === userId ? { ...u, password: newPw } : u);
    saveUsers();
    const t = _users.find(u => u.id === userId);
    pushLog({ type: "password_reset", actor, detail: `Reset password for ${t?.username}` });
  },
  toggleUser: async (actor, userId) => {
    await wait(250);
    _users = _users.map(u => u.id === userId ? { ...u, active: !u.active } : u);
    saveUsers();
    const t = _users.find(u => u.id === userId);
    pushLog({ type: "user_toggled", actor, detail: `${t?.active ? "Enabled" : "Disabled"} ${t?.username}` });
    return t?.active;
  },
  deleteUser: async (actor, userId) => {
    await wait(250);
    const t = _users.find(u => u.id === userId);
    _users = _users.filter(u => u.id !== userId);
    saveUsers();
    pushLog({ type: "user_deleted", actor, detail: `Removed ${t?.username}` });
  },
  // Update a user's per-module access (and optional per-section overrides). The
  // overall role tracks the strongest level granted anywhere (same rule as
  // createUser). `sections` maps moduleId → { tabId: "hidden"|"view"|"edit" };
  // pass undefined to leave a user's existing section overrides untouched.
  updateAccess: async (actor, userId, access, sections) => {
    await wait(300);
    const vals = Object.values(access);
    const role = vals.includes("devops") ? "devops"
      : vals.includes("admin") ? "admin"
      : vals.includes("supervisor") ? "supervisor" : "viewer";
    _users = _users.map(u => u.id === userId
      ? { ...u, access, role, ...(sections !== undefined ? { sections } : {}) }
      : u);
    saveUsers();
    const t = _users.find(u => u.id === userId);
    pushLog({ type: "user_access_updated", actor, module: "Employee", detail: `Updated module access for ${t?.username}` });
    return t ? { ...t, password: undefined } : null;
  },

  // Profile photo (stored as a data URL in browser storage).
  getPhoto: (username) => _photos[username] || null,
  savePhoto: async (username, dataUrl) => {
    await wait(150);
    _photos = { ..._photos, [username]: dataUrl };
    savePhotos();
    pushLog({ type: "photo_updated", actor: username, detail: "Updated profile photo" });
  },

  // Forgot-password reset (SIMULATED). Per explicit user request, this no
  // longer routes through an email/OTP step tied to the hardcoded
  // `EMAIL_DOMAIN` (@prowater.in) — the user only sees a User ID + new
  // password + confirm-password screen.
  // >>> WIRE: replace with a real POST /api/auth/reset-password — a production
  // build should still verify identity server-side (e.g. a signed reset link
  // emailed to the account) before accepting a new password.
  resetPassword: async (username, newPw) => {
    await wait(300);
    const key = String(username || "").trim().toLowerCase();
    const u = _users.find(x => x.username.toLowerCase() === key);
    if (!u) throw new Error("No account found with that ID.");
    _users = _users.map(x => x.username.toLowerCase() === key ? { ...x, password: newPw } : x);
    saveUsers();
    pushLog({ type: "password_reset", actor: u.username, detail: "Password reset" });
  },

  getLogs: async () => { await wait(150); return [..._logs]; },
  // List of active usernames for the login dropdown.
  getUsernames: async () => { await wait(120); return _users.filter(u => u.active).map(u => u.username); },
  // Page views are intentionally NOT logged — only real activity (logins, logouts, user/password changes).
  logView: (_actor, _detail) => {},
};

// Fix: these two were missed on the first core.js pass (off-by-one on
// _apiCache; `norm` is declared inside the Sales block but used by the api
// object's login-email matching too, plus Sales and Task Planner).
export let _apiCache = null;
export const norm = (s) => String(s ?? "").trim().toLowerCase();

/* ---- Apartment leads (Zoho) — /admin/zoho/get-all-apartments/data (§14) ---- */
// Case/space-insensitive field picker for apartment rows.
export function pickAptField(row, ...cands) {
  if (!row) return "";
  const keys = Object.keys(row);
  for (const c of cands) {
    const target = String(c).toLowerCase().replace(/[_\s-]/g, "");
    const k = keys.find(key => key.toLowerCase().replace(/[_\s-]/g, "") === target);
    if (k != null && row[k] != null && row[k] !== "") return row[k];
  }
  return "";
}
export function mapApartment(r) {
  return {
    name:          pickAptField(r, "apartment_name", "name", "society", "society_name") || "—",
    managerNumber: pickAptField(r, "manager_number", "manager_phone", "phone", "mobile", "contact_number") || "—",
    meetingStatus: pickAptField(r, "meeting_status", "status") || "—",
    poc:           pickAptField(r, "poc", "poc_name", "point_of_contact", "contact_person", "spoc", "contact_name", "manager_name", "manager") || "—",
    address:       pickAptField(r, "address", "location", "full_address") || "",
    pincode:       pickAptField(r, "pincode", "pin_code", "zip", "postal_code") || "",
    flats:         Number(pickAptField(r, "number_of_flats", "no_of_flats", "flats", "total_flats")) || 0,
    createdTime:   pickAptField(r, "created_time", "created_at", "createdon", "created") || "",
  };
}
export const apartmentApi = {
  getAll: async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/admin/zoho/get-all-apartments/data`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Apartments ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json
        : (json.apartments || json.data || json.leads || json.rows
          || (Object.values(json).find(v => Array.isArray(v)) || []));
      return rows.map(mapApartment);
    } catch (e) {
      console.warn("Apartments endpoint unavailable:", e.message);
      return [];
    }
  },
  // Create a Zoho service ticket for a society's Auto-GS visit. Bearer-authed
  // (login idToken) like every other backend call. Returns the new ticket id.
  // NOTE: real route is /apartments/create-ticket (no /api prefix).
  createTicket: async (actor, payload) => {
    const res = await fetch(`${API_ORIGIN}/apartments/create-ticket`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const e = await res.json(); msg = e.message || e.error || msg; } catch { /* keep status */ }
      throw new Error(msg);
    }
    const json = await res.json().catch(() => ({}));
    const d = json.data || json;
    // Prefer the human-readable Zoho ticket number (e.g. "156") over the long
    // internal id (e.g. "244734000001189001").
    const num = d.ticketNumber || d.ticket_number || d.number || d.ticketNo;
    const longId = d.id || d.ticketId || d.ticket_id || (typeof json === "string" ? json : null);
    // (The old GET /tickets fallback lookup for the human-readable number was
    // removed — the create response's number is used, else the returned id.)
    const id = num || longId;
    if (actor) pushLog({ type: "ticket_created", actor, module: "Auto Scheduler", detail: `Created GS ticket ${id || "(no id returned)"} for ${payload.apName}` });
    return id;
  },
};

/* ---- Ticketing module — Zoho Desk integration ----
   Live tickets come from the ProWater backend GET /tickets/formattedforwisdom (Zoho Desk),
   authenticated with the same Firebase idToken as every other Zoho API
   (authHeaders() carries the Bearer token from login). Zoho Desk statuses and
   priorities are free-form STRINGS, so the UI colours them by keyword and
   derives the actual filter options from whatever the data returns. */

// Zoho Desk default statuses (the account may define more; the UI unions these
// with whatever appears in the fetched tickets).
export const ZD_DEFAULT_STATUSES = ["Open", "In Progress", "On Hold", "Escalated", "Closed"];
// Colour a status string by family keyword so the list stays readable.
export const zdStatusColor = (label) => {
  const s = String(label || "").toLowerCase();
  if (/cancel/.test(s)) return "#7D8A83";
  if (/clos/.test(s)) return "#7D8A83";
  if (/resolv|complet|done/.test(s)) return "#08805A";
  if (/hold|pending|wait/.test(s)) return "#986315";
  if (/escalat/.test(s)) return "#DC4141";
  if (/progress|assign/.test(s)) return "#2A86D6";
  if (/install/.test(s)) return "#2A86D6";
  if (/open|new/.test(s)) return "#986315";
  return "#1E9E4F";
};
export const zdIsClosed = (label) => /clos|resolv|complet|cancel|done/i.test(String(label || ""));

export const ZD_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const zdPriorityColor = (label) => ({ low: "#7D8A83", medium: "#986315", high: "#986315", urgent: "#DC4141" }[String(label || "").toLowerCase()] || "#7D8A83");
// Auto-generated tickets pass a numeric priority (1–4); coerce to a Zoho label.
export const zdPriorityLabel = (p) => typeof p === "number" ? (["", "Low", "Medium", "High", "Urgent"][p] || "Medium") : (p || "Medium");

// Map a raw Zoho Desk ticket → the shape the UI uses. Defensive: handles Zoho
// Desk field names, snake_case backend variants, and nested contact / custom
// fields, so it survives whatever exact shape the backend forwards.
// Format a UTC ISO timestamp in IST (UTC+5:30), e.g. "22 Jul 2026, 01:34 pm".
// Non-dates pass through unchanged; null/empty → "—".
export const fmtIST = (v) => {
  if (v == null || v === "") return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const ist = new Date(d.getTime() + 5.5 * 3600000); // shift to IST, then read UTC fields
  const pad = (n) => String(n).padStart(2, "0");
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let h = ist.getUTCHours(); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12;
  return `${pad(ist.getUTCDate())} ${MON[ist.getUTCMonth()]} ${ist.getUTCFullYear()}, ${pad(h)}:${pad(ist.getUTCMinutes())} ${ap}`;
};

export function mapZohoDeskTicket(t) {
  const cf = t.cf || t.customFields || t.custom_fields || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (t[k] != null && t[k] !== "") return t[k];
      if (cf[k] != null && cf[k] !== "") return cf[k];
    }
    return null;
  };
  const contact = t.contact || {};
  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    || contact.name || pick("contactName", "customer_name", "cf_customer_name") || t.email || "—";
  const num = t.ticketNumber ?? t.ticket_number ?? t.number ?? t.id;
  // Human-readable custom fields from this backend (e.g. "Issue Category", "Society Name").
  const cfh = t.customFields || {};
  const hv = (k) => (cfh[k] != null && cfh[k] !== "") ? cfh[k] : null; // custom-field value or null
  return {
    id: String(t.id ?? num ?? crypto.randomUUID()),
    zohoId: String(t.id ?? ""),
    ticketNo: num != null ? `#${num}` : "—",
    ticketNumber: num != null ? String(num) : "",
    purifierId: hv("Purifier ID") ?? pick("cf_purifier_id", "purifierId", "purifier_id") ?? "—",
    society: hv("Society Name") ?? pick("cf_society_name766799", "cf_society_name", "society", "society_name") ?? "—",
    customer: contactName,
    issueCategory: hv("Issue Category"),                 // ← drives the table's Issue Type column + Ops filter
    status: String(t.status ?? t.statusType ?? "Open"),
    priority: t.priority ? String(t.priority) : "",
    subject: t.subject || `Ticket ${num}`,
    created: t.createdTime || t.created_time || t.created_at || t.createdAt || "",
    updated: t.modifiedTime || t.modified_time || t.updated_at || t.updatedAt || t.createdTime || "",
    note: t.description || t.description_text || "",
    // Full ticket-detail fields (shown in the drawer).
    ticketOwner: t.assigneeId ?? null,
    description: t.description ?? null,
    zohoCustomerId: hv("Zoho Customer ID"),
    emailId: t.email ?? hv("Email ID") ?? null,
    phone: t.phone ?? hv("Phone") ?? null,
    address: hv("Address"),
    jobStartTime: hv("Job Start Time"),
    jobEndTime: hv("Job End Time"),
    technicianVisitDate: hv("Technician Visit Date"),
    technicianVisitSlot: hv("Technician Visit Slot"),
    workStartLat: hv("Work Start Latitude"),
    workStartLng: hv("Work Start Longitude"),
    workStartAddress: hv("Work Start Address"),
    reasonForPostpone: hv("reason for postpone"),
    rescheduledDate: hv("rescheduled_Date"),
    partsUsed: hv("Parts_Used"),
  };
}

// Map a row from GET /tickets/formattedforwisdom → the shape the UI uses. This
// feed is a FLAT object keyed by human labels ("Ticket ID", "Status", "Society
// Name", …), not the raw Zoho Desk shape. Lookup is tolerant of case/spacing so
// minor label drift on the backend won't blank the table again.
export function mapWisdomTicket(t) {
  const norm = {};
  for (const k of Object.keys(t || {})) norm[k.toLowerCase().replace(/[\s_]+/g, "")] = t[k];
  const g = (...labels) => {
    for (const l of labels) {
      const nk = String(l).toLowerCase().replace(/[\s_]+/g, "");
      if (norm[nk] != null && norm[nk] !== "") return norm[nk];
    }
    return null;
  };
  const id = g("Ticket ID", "TicketID", "id") ?? "";
  const num = g("Ticket Number", "TicketNumber", "ticketNo") ?? id;
  const created = g("Ticket Created Time", "Created Time", "Created", "Created_Time", "createdTime", "created_at", "created");
  return {
    id: String(id || num || crypto.randomUUID()),
    zohoId: String(id || ""),
    ticketNo: num ? `#${num}` : "—",
    ticketNumber: num ? String(num) : "",
    purifierId: g("Purifier ID") ?? "—",
    society: g("Society Name") ?? "—",
    // The feed carries no customer NAME — only a Ticket Owner (the agent) + Phone.
    customer: g("Ticket Owner") ?? g("Phone") ?? "—",
    issueCategory: g("Issue Category"),
    status: String(g("Status") ?? "Open"),
    priority: g("Priority") ? String(g("Priority")) : "",
    subject: g("Subject") || (num ? `Ticket ${num}` : "Ticket"),
    created: created || "",
    updated: g("Modified Time", "Modified", "updated_at") || created || "",
    note: g("Description") || "",
    // Full ticket-detail fields (shown in the drawer).
    ticketOwner: g("Ticket Owner"),
    description: g("Description"),
    zohoCustomerId: g("Zoho Customer ID"),
    emailId: g("Email ID"),
    phone: g("Phone"),
    address: g("Address"),
    jobStartTime: g("Job Start Time"),
    jobEndTime: g("Job End Time"),
    technicianVisitDate: g("Technician Visit Date"),
    technicianVisitSlot: g("Technician Visit Slot"),
    workStartLat: g("Work Start Latitude"),
    workStartLng: g("Work Start Longitude"),
    workStartAddress: g("Work Start Address"),
    reasonForPostpone: g("reason for postpone"),
    rescheduledDate: g("rescheduled_Date"),
    partsUsed: g("Parts_Used"),
    inputTds: g("Input Tds", "Input TDS", "InputTds"),
    outputTds: g("Output Tds", "Output TDS", "OutputTds"),
    centralRoIssue: g("Central RO Issue"),
    junctionBoxIssue: g("Junction Box Issue"),
  };
}

/* ---- Ops Tickets helpers (job duration, spares, maps) --------------------- */
// Parse the Parts_Used field (a JSON-string array like "[\"Sediment Filter\"]",
// or a plain comma-separated string) into a clean array of spare names.
export function parsePartsUsed(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s || s === "[]" || s.toLowerCase() === "null") return [];
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(x => String(x).trim()).filter(Boolean); } catch { /* not JSON */ }
  return s.replace(/^\[|\]$/g, "").split(",").map(x => x.replace(/^["'\s]+|["'\s]+$/g, "")).filter(Boolean);
}
// Job duration in whole minutes from Job Start/End Time, or null if unusable.
export function jobDurationMin(t) {
  if (!t.jobStartTime || !t.jobEndTime) return null;
  const a = new Date(t.jobStartTime).getTime(), b = new Date(t.jobEndTime).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}
// Minutes → "2h 05m" / "45m".
export function fmtDuration(min) {
  if (min == null || isNaN(min)) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
// The IST calendar date ("YYYY-MM-DD") of an ISO timestamp — used to scope the
// Ops date filter by the day a job actually started (in IST, matching fmtIST).
export function istDateOf(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}
export const tdsNum = (v) => { const n = Number(String(v ?? "").replace(/[^\d.\-]/g, "")); return isNaN(n) ? null : n; };

// Detect the flat /formattedforwisdom shape (labels with spaces/caps).
export const isWisdomTicketShape = (r) => !!r && typeof r === "object" &&
  ("Ticket ID" in r || "Issue Category" in r || "Society Name" in r || "Purifier ID" in r);

// Small offline fallback (Zoho Desk shape) so dev renders without the API.
export const SEED_TICKETS = [
  { id: 299, ticketNumber: 299, status: "Open", priority: "Urgent", subject: "No water output", email: "uondu@example.com", phone: "+91 98450 11111", contact: { firstName: "uondu" }, createdTime: "2026-06-13T07:34:55Z", modifiedTime: "2026-06-17T08:10:00Z", description: "Purifier not dispensing since morning.", customFields: { "Issue Category": "Complaint", "Society Name": "MJR Clique Hydra", "Purifier ID": "TEST89789", "Address": "https://maps.app.goo.gl/example299", "Zoho Customer ID": "3399543001", "Job Start Time": null, "Parts_Used": null } },
  { id: 301, ticketNumber: 301, status: "On Hold", priority: "High", subject: "Wrong plan charged", email: "divya.nair@example.com", phone: "+91 98450 22222", contact: { firstName: "Divya", lastName: "Nair" }, createdTime: "2026-06-16T15:30:00Z", modifiedTime: "2026-06-17T09:00:00Z", description: "Billed for Plus but on Home plan.", customFields: { "Issue Category": "Billing", "Society Name": "Prestige Lakeside", "Purifier ID": "PW-44120", "Address": "https://maps.app.goo.gl/example301" } },
  { id: 305, ticketNumber: 305, status: "In Progress", priority: "Medium", subject: "Auto GS Schedule", contact: { lastName: "Brigade Gateway" }, createdTime: "2026-06-16T11:00:00Z", modifiedTime: "2026-06-16T12:30:00Z", description: null, customFields: { "Issue Category": "GS Service", "Society Name": "Brigade Gateway", "Purifier ID": "PW-77810", "Address": "https://maps.app.goo.gl/example305", "reason for postpone": null, "rescheduled_Date": null } },
  { id: 308, ticketNumber: 308, status: "Closed", priority: "Low", subject: "Filter replacement reminder", email: "sana.kapoor@example.com", contact: { firstName: "Sana", lastName: "Kapoor" }, createdTime: "2026-06-14T10:00:00Z", modifiedTime: "2026-06-15T14:20:00Z", description: "Filter dispatched.", customFields: { "Issue Category": "Maintenance", "Society Name": "Sobha Dream Acres", "Purifier ID": "PW-90233", "Address": "Whitefield, Bengaluru", "Parts_Used": "RO membrane" } },
  { id: 312, ticketNumber: 312, status: "Open", priority: "Medium", subject: "Auto GS Schedule", contact: { lastName: "CBR Aakruti" }, createdTime: "2026-06-18T09:00:00Z", modifiedTime: "2026-06-18T09:00:00Z", description: null, customFields: { "Issue Category": "Installation", "Society Name": "CBR Aakruti", "Purifier ID": null, "Address": "https://maps.app.goo.gl/example312" } },
];
export let _tickets = SEED_TICKETS.map(mapZohoDeskTicket);
export let _tkCache = null, _tkCacheAt = 0;
export let _tkUsedSample = false;
export const ticketApi = {
  get usedSample() { return _tkUsedSample; },
  // Live tickets from Zoho Desk via the backend; falls back to sample data.
  getTickets: async (force = false) => {
    const now = Date.now();
    if (!force && _tkCache && (now - _tkCacheAt) < 30000) return _tkCache;
    try {
      const res = await fetch(`${API_ORIGIN}/tickets/formattedforwisdom`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Tickets API ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data || json.tickets || json.rows || []);
      if (!rows.length) throw new Error("empty");
      // Route each row to the right mapper: already-UI-shaped → as-is; the flat
      // /formattedforwisdom feed → mapWisdomTicket; raw Zoho Desk → mapZohoDeskTicket.
      const mapped = rows.map(r =>
        (r.ticketNo && typeof r.status === "string" && r.society) ? r
          : isWisdomTicketShape(r) ? mapWisdomTicket(r)
          : mapZohoDeskTicket(r));
      _tkCache = mapped; _tkCacheAt = now; _tkUsedSample = false;
      return mapped;
    } catch (e) {
      console.warn("Zoho Desk /tickets/formattedforwisdom unavailable, using sample data:", e.message);
      _tkUsedSample = true;
      return [..._tickets];
    }
  },
  // Optimistic local status change. >>> WIRE: a Zoho Desk write endpoint
  // (status update) once the backend exposes one.
  updateStatus: async (actor, id, status) => {
    await wait(120);
    const s = String(status);
    _tickets = _tickets.map(t => t.id === id ? { ...t, status: s, updated: new Date().toISOString() } : t);
    if (_tkCache) _tkCache = _tkCache.map(t => t.id === id ? { ...t, status: s, updated: new Date().toISOString() } : t);
    pushLog({ type: "ticket_status_changed", actor, module: "Ticketing", detail: `${id} → ${s}` });
  },
  // Local ticket creation used by Auto Scheduler (society GS + IoT alerts).
  // >>> WIRE: a Zoho Desk create endpoint once the backend exposes one.
  createTicket: async (actor, info) => {
    await wait(150);
    const id = `LOCAL-${Date.now()}`;
    const mapped = {
      id, ticketNo: `#${id}`, purifierId: info.purifierId || "—",
      society: info.society || "—", customer: info.customer || info.society || "—",
      issueType: info.issueType || "—", fieldAppIssueType: "—",
      type: info.type || "Service Request", status: "Open",
      priority: zdPriorityLabel(info.priority),
      subject: info.subject || info.issueType || "New ticket",
      created: new Date().toISOString(), updated: new Date().toISOString(),
      note: info.description || info.subject || "",
    };
    _tickets = [mapped, ..._tickets];
    if (_tkCache) _tkCache = [mapped, ..._tkCache];
    pushLog({ type: "ticket_created", actor, module: "Auto Scheduler", detail: `Created ticket ${id} — ${info.society || info.subject}` });
    return id;
  },
};

// Small deterministic hash so derived demo values (TDS, test dates) stay
// stable — shared by FSM's WaterQuality, ERP's AssetLifecycle, and Auto
// Scheduler's IoTAlerts (all deriving representative values from customer
// data until live telemetry/water-test feeds are connected).
export const hashStr = (s) => { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };

/* ---- Firebase project/db constants ---- Firestore project/db identifiers,
   shared by Device Replacement (writes swaps to `device_replacements`) and
   About's Releases API (reads/writes `wisdom2.0_releases`) — same Firebase
   project, different collections. */
export const DR_FS_PROJECT = "backend-prowater", DR_FS_DB = "prowaterdb", DR_COLLECTION = "device_replacements";
export const DR_FS_BASE = `https://firestore.googleapis.com/v1/projects/${DR_FS_PROJECT}/databases/${DR_FS_DB}/documents`;

/* ---- Firestore REST typed-field conversion ---- shared by Device
   Replacement (device_replacements collection) and About's Releases API
   (wisdom2.0_releases collection) — both read/write Firestore's REST typed
   value format ({ stringValue }, { integerValue }, etc). */
export function _drToFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "object") return { mapValue: { fields: _drToFsFields(v) } };
  return { stringValue: String(v) };
}
export function _drToFsFields(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) out[k] = _drToFsValue(obj[k]);
  return out;
}
export const _drScalar = (f) => {
  if (!f || typeof f !== "object") return "";
  if (f.stringValue != null) return f.stringValue;
  if (f.timestampValue != null) return f.timestampValue;
  if (f.integerValue != null) return f.integerValue;
  if (f.doubleValue != null) return String(f.doubleValue);
  if (f.booleanValue != null) return f.booleanValue;
  return "";
};

/* ===========================================================================
   Billing/subscription data layer — hoisted here from App.jsx (was going to
   land in modules/Billing.jsx, but Customer.jsx needs billingApi/
   depositForCustomer/creditNoteApi too, so it lives in core.js like
   apartmentApi/ticketApi before it). Credit notes, subscription/invoice/
   submodule mappers, deposit-tier logic, termMonths, and billingApi itself.
   =========================================================================== */
/* ---- Credit notes (Zoho discounts / refunds) — GET /admin/get-all-creditnotes.
   Joined to customers by Zoho customer id. Tolerant mapper + sample fallback. ---- */
export function mapCreditNote(r) {
  const g = (...keys) => { for (const k of keys) { const v = r?.[k]; if (v != null && v !== "") return v; } return undefined; };
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  // Which invoice(s) this credit note was applied to (v2.29.293) — Earned
  // Revenue's Credit column needs the real creditnote_number, not just a
  // Yes/No flag, so it can show e.g. "CN-00014" on the invoice it settled.
  // A confirmed real sample record carries a (sometimes blank) top-level
  // `invoice_number` (comma-separated when multiple invoices apply), plus an `invoices_applied`
  // array of objects. Split the comma-separated invoice numbers to match individually.
  const invoiceNumberRaw = String(g("invoice_number", "invoiceNumber") ?? "");
  const invoiceNumbers = invoiceNumberRaw ? invoiceNumberRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
  const appliedRaw = Array.isArray(r?.invoices_applied) ? r.invoices_applied : (Array.isArray(r?.invoicesApplied) ? r.invoicesApplied : []);
  
  const invoicesApplied = [
    ...invoiceNumbers,
    ...appliedRaw.map(a => typeof a === "string" ? a : (a?.invoice_number || a?.invoiceNumber || a?.number || ""))
  ].map(s => String(s).trim()).filter((v, i, self) => v && self.indexOf(v) === i);

  // Formatted array of objects for display in popup
  const invoices_applied = appliedRaw.map(inv => {
    return {
      invoice_id: String(inv?.invoice_id || inv?.invoiceId || ""),
      invoice_number: String(inv?.invoice_number || inv?.invoiceNumber || inv?.number || (typeof inv === 'string' ? inv : "")).trim(),
      amount_applied: num(inv?.amount_applied || inv?.amountApplied || inv?.amount || 0),
      date: String(inv?.date || inv?.appliedDate || "")
    };
  }).filter(inv => inv.invoice_number);

  // Fallback: If invoices_applied is empty but we have comma-separated invoiceNumbers, create placeholders
  if (invoices_applied.length === 0 && invoiceNumbers.length > 0) {
    invoiceNumbers.forEach(numStr => {
      invoices_applied.push({
        invoice_id: "",
        invoice_number: numStr,
        amount_applied: 0,
        date: ""
      });
    });
  }

  // How much of this note was actually applied/consumed (v2.29.294) — used
  // as the amount-matching fallback below when invoiceNumber/invoicesApplied
  // come back empty in the live feed.
  const totalCreditsUsed = num(g("total_credits_used", "totalCreditsUsed") ?? g("total", "creditnote_total", "creditnote_amount", "amount", "credit_amount", "price"));
  return {
    id: String(g("creditnote_id", "creditnoteId", "id", "creditnote_number", "number") ?? ""),
    number: String(g("creditnote_number", "number", "creditnote_id", "id") ?? "—").replace(/\s+/g, "").trim(),
    zohoCustomerId: String(g("zoho_customer_id", "customer_id", "zohoCustomerId", "customerId", "customer_number", "customerNumber") ?? ""),
    customerName: String(g("customer_name", "customerName", "customer") ?? ""),
    amount: num(g("total", "creditnote_total", "creditnote_amount", "amount", "credit_amount", "price")),
    total: num(g("total", "creditnote_total", "creditnote_amount", "amount", "credit_amount", "price")), // For popup total compatibility
    // Remaining (unapplied) credit balance; if the feed omits it, assume the full amount is available.
    balance: (() => { const b = g("balance", "credit_balance", "creditnote_balance", "amount_due"); return b != null && b !== "" ? num(b) : num(g("total", "creditnote_total", "creditnote_amount", "amount", "credit_amount", "price")); })(),
    date: String(g("date", "created_time", "created_at", "createdTime", "creditnote_date", "created") ?? ""),
    status: String(g("status", "creditnote_status") ?? ""),
    reason: String(g("reason", "notes", "description", "remarks", "subject") ?? ""),
    description: String(g("description", "reason", "notes", "remarks", "subject") ?? ""), // For popup description compatibility
    invoiceNumber: invoiceNumberRaw,
    invoicesApplied,
    invoices_applied,
    totalCreditsUsed,
    total_credits_used: totalCreditsUsed // For popup total_credits_used compatibility
  };
}
export const SEED_CREDITNOTES = [
  { creditnote_number: "CN-1001", zoho_customer_id: "ZB-45", customer_name: "Anis Emmanual", total: 500, balance: 200, date: "2026-06-10", status: "open", reason: "Service delay compensation" },
  { creditnote_number: "CN-1002", zoho_customer_id: "ZB-45", customer_name: "Anis Emmanual", total: 300, balance: 300, date: "2026-07-05", status: "open", reason: "Referral reward" },
  { creditnote_number: "CN-1003", zoho_customer_id: "ZB-92", customer_name: "Ravi Kumar", total: 250, balance: 0, date: "2026-06-20", status: "closed", reason: "Billing adjustment" },
  { creditnote_number: "CN-1004", zoho_customer_id: "ZB-77", customer_name: "Deepa Nair", total: 750, balance: 500, date: "2026-05-18", status: "open", reason: "Goodwill credit" },
  { creditnote_number: "CN-1005", zoho_customer_id: "ZB-45", customer_name: "Anis Emmanual", total: 200, balance: 200, date: "2026-07-12", status: "open", reason: "Late installation credit" },
];
export let _creditNotes = SEED_CREDITNOTES.map(mapCreditNote);
let _cnCache = null, _cnCacheAt = 0, _cnUsedSample = false;
export const creditNoteApi = {
  get usedSample() { return _cnUsedSample; },
  getCreditNotes: async (force = false) => {
    const now = Date.now();
    if (!force && _cnCache && (now - _cnCacheAt) < 60000) return _cnCache;
    try {
      const res = await fetch(`${API_ORIGIN}/admin/get-all-creditnotes`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Credit notes API ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data || json.creditnotes || json.credit_notes || json.creditNotes || json.rows || []);
      if (!rows.length) throw new Error("empty");
      const mapped = rows.map(mapCreditNote);
      _cnCache = mapped; _cnCacheAt = now; _cnUsedSample = false;
      return mapped;
    } catch (e) {
      console.warn("get-all-creditnotes unavailable, using sample data:", e.message);
      _cnUsedSample = true;
      return [..._creditNotes];
    }
  },
};

/* ---- Customer module — real data from Zoho via backend API ---- */

// Fallback seed data — used only if the API is unreachable


// ── Sample-data tracker ────────────────────────────────────────────────────
// When a live endpoint is unreachable the APIs fall back to seed data. We flag
// which sources are on sample data so the UI can warn that numbers aren't live.
// ───────────────────────────────────────────────────────────────────────────




/* ===========================================================================
   BILLING & SUBSCRIPTION MODULE — real data from Zoho Billing via backend
   Endpoints (admin, Bearer-token auth — same as customers):
     GET /admin/get-all-subscriptions?page=&per_page=
     GET /admin/get-all-invoices?page=&per_page=
   Both are paginated like get-all-customers ({ ..., pagination: { has_more } }).
   The mappers are defensive: Zoho field names vary by org, so we check several
   likely keys and fall back gracefully. Tweak the picks if your payload differs.
   =========================================================================== */

// Normalise a Zoho subscription status → our status chip vocabulary.
export function mapSubStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["live", "active"].includes(v)) return "active";
  if (["non_renewing", "non-renewing"].includes(v)) return "active";
  if (["trial", "future"].includes(v)) return "pending";
  if (["past_due", "unpaid", "dunning"].includes(v)) return "paused";
  if (["paused", "on_hold"].includes(v)) return "paused";
  if (["cancelled", "canceled", "expired"].includes(v)) return "failed";
  return v || "inactive";
}

// Normalise a Zoho invoice status → our status chip vocabulary.
export function mapInvoiceStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["paid"].includes(v)) return "paid";
  if (["sent", "viewed", "open", "unpaid"].includes(v)) return "pending";
  if (["partially_paid", "partially paid"].includes(v)) return "pending";
  if (["overdue"].includes(v)) return "failed";
  if (["draft"].includes(v)) return "pending";
  if (["void", "voided", "cancelled", "canceled"].includes(v)) return "disabled";
  return v || "pending";
}

export const SEED_SUBSCRIPTIONS = [
  { id: "SUB-1001", customerName: "Upendiran S", customerNumber: "3399543000001633014", email: "upendiran.s@gmail.com", phone: "", plan: "ADV_PRABHAVATI_SD_6M", planCode: "ADV_PRA_299_6M_SD", amount: 594, interval: "months", status: "active", nextBilling: "2026-12-20", activatedAt: "2026-06-20", zohoId: "" },
  { id: "SUB-1002", customerName: "Anis Emmanual", customerNumber: "CUS-00045", email: "anis@drinkprime.in", phone: "918839452234", plan: "ADV_PLUS_12M", planCode: "ADV_PLUS_1199_12M", amount: 14400, interval: "months", status: "active", nextBilling: "2027-06-01", activatedAt: "2026-06-15", zohoId: "ZB-45" },
  { id: "SUB-1003", customerName: "Ravi Kumar", customerNumber: "CUS-00092", email: "ravi.k@example.com", phone: "", plan: "ADV_HALF_6M", planCode: "ADV_HALF_599_6M", amount: 3600, interval: "months", status: "active", nextBilling: "2026-12-10", activatedAt: "2026-06-10", zohoId: "ZB-92" },
  { id: "SUB-1004", customerName: "Sneha Patil", customerNumber: "CUS-00101", email: "sneha.p@example.com", phone: "", plan: "ADV_QTR_3M", planCode: "ADV_QTR_399_3M", amount: 1200, interval: "months", status: "active", nextBilling: "2026-09-18", activatedAt: "2026-06-18", zohoId: "ZB-101" },
  { id: "SUB-1005", customerName: "harshpvt", customerNumber: "CUS-00084", email: "harshlokhande486@gmail.com", phone: "917821907069", plan: "Home Monthly", planCode: "HOME_199_1M", amount: 199, interval: "months", status: "paused", nextBilling: "2026-07-05", activatedAt: "2026-06-05", zohoId: "ZB-84" },
  { id: "SUB-1006", customerName: "Deepa Nair", customerNumber: "CUS-00077", email: "deepa.n@example.com", phone: "", plan: "ADV_PLUS_12M", planCode: "ADV_PLUS_1199_12M", amount: 12000, interval: "months", status: "active", nextBilling: "2027-03-12", activatedAt: "2026-03-12", zohoId: "ZB-77" },
];
export const SEED_INVOICES = [
  { id: "INV-2001", number: "INV-000045", customerName: "Anis Emmanual", customerNumber: "CUS-00045", email: "anis@drinkprime.in", total: 14400, balance: 0, status: "paid", date: "2026-06-15", dueDate: "2026-06-22", plan: "Plus Annual", interval: "Annual", zohoId: "ZB-45" },
  { id: "INV-2002", number: "INV-000084", customerName: "harshpvt", customerNumber: "CUS-00084", email: "harshlokhande486@gmail.com", total: 2800, balance: 2800, status: "overdue", date: "2026-06-05", dueDate: "2026-06-12", plan: "Home Quarterly", interval: "Quarterly", zohoId: "ZB-84" },
  { id: "INV-2003", number: "INV-000092", customerName: "Ravi Kumar", customerNumber: "CUS-00092", email: "ravi.k@example.com", total: 7200, balance: 0, status: "paid", date: "2026-06-10", dueDate: "2026-06-17", plan: "Plus Half-Yearly", interval: "Half-Yearly", zohoId: "ZB-92" },
  { id: "INV-2004", number: "INV-000101", customerName: "Sneha Patil", customerNumber: "CUS-00101", email: "sneha.p@example.com", total: 4200, balance: 0, status: "paid", date: "2026-06-18", dueDate: "2026-06-25", plan: "Home Quarterly", interval: "Quarterly", zohoId: "ZB-101" },
  { id: "INV-2005", number: "INV-000110", customerName: "Imran Shaikh", customerNumber: "CUS-00110", email: "imran.s@example.com", total: 1200, balance: 0, status: "paid", date: "2026-06-20", dueDate: "2026-06-27", plan: "Home Monthly", interval: "Monthly", zohoId: "ZB-110" },
  { id: "INV-2006", number: "INV-000077", customerName: "Deepa Nair", customerNumber: "CUS-00077", email: "deepa.n@example.com", total: 12000, balance: 0, status: "paid", date: "2026-03-12", dueDate: "2026-03-19", plan: "Plus Annual", interval: "Annual", zohoId: "ZB-77" },
  { id: "INV-2007", number: "INV-000064", customerName: "Mohan Das", customerNumber: "CUS-00064", email: "mohan.d@example.com", total: 1500, balance: 1500, status: "sent", date: "2026-06-08", dueDate: "2026-06-15", plan: "Home Monthly", interval: "Monthly", zohoId: "ZB-64" },
];
// Sample rows for /admin/get-all-submodules (v2.29.103, re-scoped v2.29.104
// to just a Start/End-date enrichment lookup for Earned Revenue). Joined to
// SEED_INVOICES by `id` === the invoice's own `id` (invoice_id) — i.e. this
// feed's `transaction_id` (mapped to `id` below) equals the invoice_id it
// belongs to, per the explicit lookup the user described.
// NOTE: seed/fallback rows must already be in mapSubmodule()'s OUTPUT shape
// (camelCase) — getCached() serves the fallback array as-is on a live-fetch
// failure, it does not run it back through the mapper (same convention as
// SEED_INVOICES/SEED_SUBSCRIPTIONS above, which are pre-mapped too).
export const SEED_SUBMODULES = [
  { id: "INV-2001", number: "INV-000045", termStart: "2026-06-22", termEnd: "2026-07-21", paidDate: "2026-06-15", total: 14400, transactionRef: "TXN-45001", accountName: "HDFC Bank ****1234", intervalCount: 1, intervalUnit: "months" },
  { id: "INV-2002", number: "INV-000084", termStart: "2026-06-12", termEnd: "2026-09-11", paidDate: "2026-06-05", total: 2800, transactionRef: "TXN-84001", accountName: "UPI ****9012", intervalCount: 3, intervalUnit: "months" },
  { id: "INV-2003", number: "INV-000092", termStart: "2026-06-17", termEnd: "2026-12-16", paidDate: "2026-06-10", total: 7200, transactionRef: "TXN-92001", accountName: "ICICI Bank ****5678", intervalCount: 6, intervalUnit: "months" },
  { id: "INV-2004", number: "INV-000101", termStart: "2026-06-25", termEnd: "2026-09-24", paidDate: "2026-06-18", total: 4200, transactionRef: "TXN-101001", accountName: "UPI ****3456", intervalCount: 3, intervalUnit: "months" },
  { id: "INV-2006", number: "INV-000077", termStart: "2026-03-19", termEnd: "2027-03-18", paidDate: "2026-03-12", total: 12000, transactionRef: "TXN-77001", accountName: "HDFC Bank ****7890", intervalCount: 1, intervalUnit: "years" },
];

// Master Plan Catalog (v2.29.133), given directly by the business as an
// exhaustive real plan_code dump — 64 real plans with their Device Type,
// Filter Type, and exact Setup Fee / Price / Total / billing cadence.
// Supersedes v2.29.132's PLAN_CLASSIFICATION (device/filter only); kept the
// same keying rule — plan_code ONLY, never plan_name, since name is provably
// ambiguous (e.g. "PREMIUM" is Normal Device on PREMIUM_1M_499 but Hot & Cold
// on the PREMIUM_*_SD variants — same name, different code, different real
// device AND a different real Setup Fee: ₹0 vs ₹4,000). A plan_code not in
// this table means a genuinely new/unseen plan — classifyPlan()/planInfo()
// return blanks for it, deliberately distinct from a plan the business has
// explicitly tagged "Uncategorised" (a real value several rows below carry
// on purpose, e.g. pro_essential). `total` is always `setupFee + price` in
// the source data — kept as its own field rather than re-derived, so a
// future edit to one doesn't silently desync from a hand-verified total.
export const PLAN_CATALOG = {
  prowater_uv_monthly:           { name: "ProWater UV",              deviceType: "Normal",     filterType: "UV",            setupFee: 1500, price: 250,  total: 1750, billEvery: 1,  billingInterval: "months" },
  prowater_mineral_monthly:      { name: "ProWater Mineral",         deviceType: "Normal",     filterType: "Mineral",       setupFee: 1500, price: 350,  total: 1850, billEvery: 1,  billingInterval: "months" },
  prowater_mineral_hot_monthly:  { name: "ProWater Mineral Hot",     deviceType: "Hot & Cold", filterType: "Mineral",       setupFee: 3000, price: 350,  total: 3350, billEvery: 1,  billingInterval: "months" },
  prowater_copper_monthly:       { name: "ProWater Copper",          deviceType: "Normal",     filterType: "Copper",        setupFee: 1500, price: 450,  total: 1950, billEvery: 1,  billingInterval: "months" },
  prowater_copper_hot_monthly:   { name: "ProWater Copper Hot",      deviceType: "Hot & Cold", filterType: "Copper",        setupFee: 3000, price: 450,  total: 3450, billEvery: 1,  billingInterval: "months" },
  prowater_alkaline_monthly:     { name: "ProWater Alkaline",        deviceType: "Normal",     filterType: "Alkaline",      setupFee: 1500, price: 500,  total: 2000, billEvery: 1,  billingInterval: "months" },
  prowater_alkaline_hot_monthly: { name: "ProWater Alkaline Hot",    deviceType: "Hot & Cold", filterType: "Alkaline",      setupFee: 3000, price: 500,  total: 3500, billEvery: 1,  billingInterval: "months" },
  Feb18Plan:                     { name: "Test Plan (Dev)",          deviceType: "Test",       filterType: "Test",          setupFee: 0,    price: 0,    total: 0,    billEvery: 1,  billingInterval: "weeks" },
  pro_essential:                 { name: "ProWater Essential",       deviceType: "Normal",     filterType: "Uncategorised", setupFee: 1500, price: 299,  total: 1799, billEvery: 1,  billingInterval: "months" },
  pro_advance:                   { name: "ProWater Advance",         deviceType: "Normal",     filterType: "Uncategorised", setupFee: 2000, price: 399,  total: 2399, billEvery: 1,  billingInterval: "months" },
  pro_elite:                     { name: "ProWater Elite",           deviceType: "Hot & Cold", filterType: "Uncategorised", setupFee: 4000, price: 499,  total: 4499, billEvery: 1,  billingInterval: "months" },
  ro_uv_ajk:                     { name: "RO+UV (AJK)",              deviceType: "Normal",     filterType: "UV",            setupFee: 1500, price: 299,  total: 1799, billEvery: 1,  billingInterval: "months" },
  ro_uv_ajk_6:                   { name: "RO+UV (AJK_6)",            deviceType: "Normal",     filterType: "UV",            setupFee: 1500, price: 1494, total: 2994, billEvery: 6,  billingInterval: "months" },
  ro_uv_mineral_ajk:             { name: "RO+UV+Mineral (AJK)",      deviceType: "Normal",     filterType: "Mineral",       setupFee: 2000, price: 349,  total: 2349, billEvery: 1,  billingInterval: "months" },
  ro_uv_min_ajk_6:               { name: "RO+UV+Mineral (AJK_6)",    deviceType: "Normal",     filterType: "Mineral",       setupFee: 2000, price: 1794, total: 3794, billEvery: 6,  billingInterval: "months" },
  ro_uv_min_ajk_h:               { name: "RO+UV+Mineral (AJK_H)",    deviceType: "Hot & Cold", filterType: "Mineral",       setupFee: 4000, price: 399,  total: 4399, billEvery: 1,  billingInterval: "months" },
  ro_uv_min_ajk_h_6:             { name: "RO+UV+Mineral (AJK_H_6)",  deviceType: "Hot & Cold", filterType: "Mineral",       setupFee: 4000, price: 2094, total: 6094, billEvery: 6,  billingInterval: "months" },
  ro_uv_cop_ajk:                 { name: "RO+UV+Copper (AJK)",       deviceType: "Normal",     filterType: "Copper",        setupFee: 2000, price: 449,  total: 2449, billEvery: 1,  billingInterval: "months" },
  ro_uv_cop_ajk_h_6:             { name: "RO+UV+Copper (AJK_H_6)",   deviceType: "Hot & Cold", filterType: "Copper",        setupFee: 4000, price: 2694, total: 6694, billEvery: 6,  billingInterval: "months" },
  ro_uv_cop_ajk_6:               { name: "RO+UV+Copper (AJK_6)",     deviceType: "Normal",     filterType: "Copper",        setupFee: 2000, price: 2394, total: 4394, billEvery: 6,  billingInterval: "months" },
  ro_uv_alk_ajk:                 { name: "RO+UV+Alkaline (AJK)",     deviceType: "Normal",     filterType: "Alkaline",      setupFee: 2000, price: 499,  total: 2499, billEvery: 1,  billingInterval: "months" },
  ro_uv_alk_ajk_6:               { name: "RO+UV+Alkaline (AJK)",     deviceType: "Normal",     filterType: "Alkaline",      setupFee: 2000, price: 2694, total: 4694, billEvery: 6,  billingInterval: "months" },
  ro_uv_alk_ajk_h_6:             { name: "RO+UV+Alkaline (AJK_H)",   deviceType: "Hot & Cold", filterType: "Alkaline",      setupFee: 4000, price: 549,  total: 4549, billEvery: 1,  billingInterval: "months" },
  ro_uv_ajk_h_6:                 { name: "RO+UV+Alkaline (AJK_H_6)", deviceType: "Hot & Cold", filterType: "Alkaline",      setupFee: 4000, price: 2994, total: 6994, billEvery: 6,  billingInterval: "months" },
  ro_uv_cop_h:                   { name: "RO+UV+Copper (AJK_H)",     deviceType: "Hot & Cold", filterType: "Copper",        setupFee: 4000, price: 499,  total: 4499, billEvery: 1,  billingInterval: "months" },
  ro_uv_ajk_p:                   { name: "RO+UV (AJK) - P",          deviceType: "Normal",     filterType: "UV",            setupFee: 0,    price: 299,  total: 299,  billEvery: 1,  billingInterval: "months" },
  MJR_3M:                        { name: "MJR_3M_UV",                deviceType: "Normal",     filterType: "UV",            setupFee: 0,    price: 750,  total: 750,  billEvery: 3,  billingInterval: "months" },
  MJR_6M:                        { name: "MJR_6M_UV",                deviceType: "Normal",     filterType: "UV",            setupFee: 0,    price: 1500, total: 1500, billEvery: 6,  billingInterval: "months" },
  MJR_12M:                       { name: "MJR_12M_UV",               deviceType: "Normal",     filterType: "UV",            setupFee: 0,    price: 3000, total: 3000, billEvery: 12, billingInterval: "months" },
  MJR_3M_NORMAL:                 { name: "MJR_3M_NOR_MIN",           deviceType: "Normal",     filterType: "Mineral",       setupFee: 0,    price: 1023, total: 1023, billEvery: 3,  billingInterval: "months" },
  MJR_6M_NORMAL:                 { name: "MJR_6M_NOR_MIN",           deviceType: "Normal",     filterType: "Mineral",       setupFee: 0,    price: 1998, total: 1998, billEvery: 6,  billingInterval: "months" },
  MJR_12M_NORMAL:                { name: "MJR_12M_NOR_MIN",          deviceType: "Normal",     filterType: "Mineral",       setupFee: 0,    price: 3780, total: 3780, billEvery: 12, billingInterval: "months" },
  MJR_3M_NOR_CU:                 { name: "MJR_3M_NOR_CU",            deviceType: "Normal",     filterType: "Copper",        setupFee: 0,    price: 1317, total: 1317, billEvery: 3,  billingInterval: "months" },
  MJR_6M_NOR_CU:                 { name: "MJR_6M_NOR_CU",            deviceType: "Normal",     filterType: "Copper",        setupFee: 0,    price: 2568, total: 2568, billEvery: 6,  billingInterval: "months" },
  MJR_12M_NOR_CU:                { name: "MJR_12M_NOR_CU",           deviceType: "Normal",     filterType: "Copper",        setupFee: 0,    price: 4860, total: 4860, billEvery: 12, billingInterval: "months" },
  BASIC_1M_299:                  { name: "BASIC",                    deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 299,  total: 299,  billEvery: 1,  billingInterval: "months" },
  BASIC_3M_299:                  { name: "BASIC",                    deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 897,  total: 897,  billEvery: 3,  billingInterval: "months" },
  BASIC_6M_299:                  { name: "BASIC",                    deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 1794, total: 1794, billEvery: 6,  billingInterval: "months" },
  BASIC_12M_299:                 { name: "BASIC",                    deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 3588, total: 3588, billEvery: 12, billingInterval: "months" },
  STANDARD_1M_399:               { name: "STANDARD",                 deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 399,  total: 399,  billEvery: 1,  billingInterval: "months" },
  STANDARD_3M_399:               { name: "STANDARD",                 deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 1138, total: 1138, billEvery: 3,  billingInterval: "months" },
  STANDARD_6M_399:               { name: "STANDARD",                 deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 2160, total: 2160, billEvery: 6,  billingInterval: "months" },
  STANDARD_12M_399:              { name: "STANDARD",                 deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 3877, total: 3877, billEvery: 12, billingInterval: "months" },
  PREMIUM_1M_499:                { name: "PREMIUM",                  deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 499,  total: 499,  billEvery: 1,  billingInterval: "months" },
  PREMIUM_3M_499:                { name: "PREMIUM",                  deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 1424, total: 1424, billEvery: 3,  billingInterval: "months" },
  PREMIUM_6M_499:                { name: "PREMIUM",                  deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 2702, total: 2702, billEvery: 6,  billingInterval: "months" },
  PREMIUM_12M_499:               { name: "PREMIUM",                  deviceType: "Normal",     filterType: "Uncategorised", setupFee: 0,    price: 4849, total: 4849, billEvery: 12, billingInterval: "months" },
  MJR_UV_1M_250:                 { name: "MJR_UV_MONTHLY",           deviceType: "Normal",     filterType: "UV",            setupFee: 0,    price: 250,  total: 250,  billEvery: 1,  billingInterval: "months" },
  MJR_MIN_1M_350:                { name: "MJR_MIN_MONTHLY",          deviceType: "Normal",     filterType: "Mineral",       setupFee: 0,    price: 350,  total: 350,  billEvery: 1,  billingInterval: "months" },
  MJR_COP_1M_450:                { name: "MJR_COP_MONTHLY",          deviceType: "Normal",     filterType: "Copper",        setupFee: 0,    price: 450,  total: 450,  billEvery: 1,  billingInterval: "months" },
  MJR_ALK_1M_500:                { name: "MJR_ALK_MONTHLY",          deviceType: "Normal",     filterType: "Alkaline",      setupFee: 0,    price: 500,  total: 500,  billEvery: 1,  billingInterval: "months" },
  test1:                         { name: "Test Plan - Dev 2",        deviceType: "Test",       filterType: "Test",          setupFee: 0,    price: 1,    total: 1,    billEvery: 1,  billingInterval: "months" },
  ESS_PRA_299_1M_SD:             { name: "ESS_PRABHAVATI_SD",        deviceType: "Normal",     filterType: "Uncategorised", setupFee: 1500, price: 299,  total: 1799, billEvery: 1,  billingInterval: "months" },
  ADV_PRA_299_1M_SD:             { name: "ADV_PRABHAVATI_SD",        deviceType: "Normal",     filterType: "Uncategorised", setupFee: 2000, price: 399,  total: 2399, billEvery: 1,  billingInterval: "months" },
  ELT_PRA_299_1M_SD:             { name: "ELT_PRABHAVATI_SD",        deviceType: "Hot & Cold", filterType: "Uncategorised", setupFee: 3000, price: 499,  total: 3499, billEvery: 1,  billingInterval: "months" },
  ESS_PRA_299_6M_SD:             { name: "ESS_PRABHAVATI_SD_6M",     deviceType: "Normal",     filterType: "Uncategorised", setupFee: 1500, price: 1704, total: 3204, billEvery: 6,  billingInterval: "months" },
  ADV_PRA_299_6M_SD:             { name: "ADV_PRABHAVATI_SD_6M",     deviceType: "Normal",     filterType: "Uncategorised", setupFee: 2000, price: 594,  total: 2594, billEvery: 6,  billingInterval: "months" },
  ELT_PRA_299_6M_SD:             { name: "ELT_PRABHAVATI_SD_6M",     deviceType: "Hot & Cold", filterType: "Uncategorised", setupFee: 3000, price: 1194, total: 4194, billEvery: 6,  billingInterval: "months" },
  BASIC_1M_299_SD:               { name: "BASIC",                    deviceType: "Normal",     filterType: "Uncategorised", setupFee: 1500, price: 299,  total: 1799, billEvery: 1,  billingInterval: "months" },
  BASIC_12M_299_SD:              { name: "BASIC",                    deviceType: "Normal",     filterType: "Uncategorised", setupFee: 1500, price: 3588, total: 5088, billEvery: 12, billingInterval: "months" },
  STANDARD_1M_399_SD:            { name: "STANDARD",                 deviceType: "Normal",     filterType: "Uncategorised", setupFee: 2000, price: 399,  total: 2399, billEvery: 1,  billingInterval: "months" },
  STANDARD_12M_399_SD:           { name: "STANDARD",                 deviceType: "Normal",     filterType: "Uncategorised", setupFee: 2000, price: 3877, total: 5877, billEvery: 12, billingInterval: "months" },
  PREMIUM_1M_499_SD:             { name: "PREMIUM",                  deviceType: "Hot & Cold", filterType: "Uncategorised", setupFee: 4000, price: 499,  total: 4499, billEvery: 1,  billingInterval: "months" },
  PREMIUM_12M_499_SD:            { name: "PREMIUM",                  deviceType: "Hot & Cold", filterType: "Uncategorised", setupFee: 4000, price: 4849, total: 8849, billEvery: 12, billingInterval: "months" },
};
// Looks up a plan_code against PLAN_CATALOG. Returns nulls/blanks for a
// plan_code this table has never seen — deliberately distinct from a real
// "Uncategorised" business classification (a value several rows above carry
// on purpose).
export function planInfo(planCode) {
  return PLAN_CATALOG[String(planCode || "").trim()] || null;
}
// Device Type / Filter Type only (kept for the mapSubscription/mapInvoice
// call sites added in v2.29.132 — same signature/behaviour, now backed by
// the richer PLAN_CATALOG).
export function classifyPlan(planCode) {
  const p = planInfo(planCode);
  return p ? { deviceType: p.deviceType, filterType: p.filterType } : { deviceType: "", filterType: "" };
}
// Billing > Plans' sample-data fallback (v2.29.287) — the exact same rows the
// page always showed before it had a live API, just reshaped into a list. Used
// only when the live fetch below fails/is empty, so a dead API never blanks
// the page — it silently looks like it did before this change. `status:
// "active"` is a default (PLAN_CATALOG has no such field) so the Plans page's
// "Active Plans" KPI card reads correctly against sample data too — every
// static catalog entry represents a currently-offered plan.
export const SEED_PLANS = Object.entries(PLAN_CATALOG).map(([code, p]) => ({ code, status: "active", ...p }));
// Maps one raw plan record from GET /admin/subs-module-get-all-plans into the
// shape Billing > Plans renders. Field names below are the CONFIRMED real
// response shape (v2.29.288, from an actual sample record: plan_code,
// plan_id, name, product_name, status, setup_fee, recurring_price, interval,
// interval_unit, url, created_time_formatted, updated_time_formatted) — the
// deviceType/filterType/aliased-field guessing from v2.29.287 (before this
// endpoint had ever been called) is gone; those fields don't exist on the
// real payload and are no longer shown on this page (removed per explicit
// request). A couple of harmless fallback aliases are kept in case a future
// response varies (e.g. a nested `plan` wrapper), same convention as
// mapSubscription/mapInvoice below.
export function mapPlan(raw) {
  const p = raw.plan_profile || raw.plan || raw;
  const setupFee = Number(p.setup_fee ?? p.setupFee ?? 0) || 0;
  const price = Number(p.recurring_price ?? p.price ?? 0) || 0;
  return {
    code:            p.plan_code || p.code || p.plan_id || "",
    planId:          p.plan_id || "",
    name:            p.name || p.plan_name || "",
    productName:     p.product_name || "",
    status:          p.status || "",
    setupFee,
    price,
    total:           setupFee + price,
    billEvery:       Number(p.interval ?? p.bill_every ?? 1) || 1,
    billingInterval: p.interval_unit || p.billing_interval || "months",
    url:             p.url || "",
    createdAt:       p.created_time_formatted || "",
    updatedAt:       p.updated_time_formatted || "",
  };
}

export function mapSubscription(s) {
  const p = s.subscription_profile || s.subscription || s;
  return {
    id:             p.subscription_number || p.subscription_id || p.zoho_subscription_id || p.id || "",
    customerName:   p.customer_name || p.name || p.display_name || "",
    customerNumber: p.customer_number || p.customer_id || "",
    email:          p.email || p.customer_email || "",
    phone:          p.phone || p.customer_phone || "",
    plan:           p.plan_name || p.plan?.name || p.plan || "",
    planCode:       p.plan_code || p.plan?.plan_code || "",
    // Device Type / Filter Type (v2.29.132) — tagged from the plan_code via
    // the real business lookup, not the purifier ID; see PLAN_CLASSIFICATION.
    planDeviceType: classifyPlan(p.plan_code || p.plan?.plan_code).deviceType,
    planFilterType: classifyPlan(p.plan_code || p.plan?.plan_code).filterType,
    amount:         Number(p.amount ?? p.recurring_amount ?? p.sub_total ?? 0) || 0,
    interval:       p.interval_unit || p.billing_interval || p.interval || "",
    intervalCount:  Number(p.interval) || null,   // Zoho: numeric term count (e.g. 6) paired with interval_unit
    intervalUnit:   p.interval_unit || "",
    status:         mapSubStatus(p.status || p.subscription_status),
    rawStatus:      p.status || p.subscription_status || "",
    nextBilling:    p.next_billing_at || p.next_billing_date || p.current_term_ends_at || "",
    activatedAt:    p.activated_at || p.created_at || p.created_time || "",
    createdAt:      p.created_at || p.created_time || p.activated_at || "", // when the subscription was created
    zohoId:         p.customer_id || p.zoho_customer_id || p.zoho_subscription_id || "",
    // Join key to customers: invoices/subscriptions expose customer_id, which
    // equals the customer endpoint's zoho_customer_id.
    zohoCustomerId: p.customer_id || p.zoho_customer_id || "",
  };
}

export function mapInvoice(iv) {
  const p = iv.invoice_profile || iv.invoice || iv;
  return {
    id:             p.invoice_id || p.invoice_number || p.zoho_invoice_id || p.id || "",
    number:         p.invoice_number || p.number || p.invoice_id || "",
    customerName:   p.customer_name || p.name || "",
    customerNumber: p.customer_number || p.customer_id || "",
    email:          p.email || p.customer_email || "",
    total:          Number(p.total ?? p.amount ?? p.invoice_total ?? 0) || 0,
    balance:        Number(p.balance ?? p.amount_due ?? 0) || 0,
    status:         mapInvoiceStatus(p.status || p.invoice_status),
    rawStatus:      p.status || p.invoice_status || "",
    date:           p.invoice_date || p.date || p.created_at || p.created_time || "",
    paidDate:       p.paid_date || p.paidDate || "",   // real payment date (added to the API ~2026-08); "" for unpaid/older invoices
    lastModified:   p.last_modified_time || p.modified_time || "",   // 👈 ADD THIS LINE
    dueDate:        p.due_date || p.due_at || "",
    plan:           p.plan_name || p.plan || "",
    planCode:       p.plan_code || p.plan?.plan_code || "",
    // Device Type / Filter Type (v2.29.132) — same plan_code lookup as
    // mapSubscription(); see PLAN_CLASSIFICATION.
    planDeviceType: classifyPlan(p.plan_code || p.plan?.plan_code).deviceType,
    planFilterType: classifyPlan(p.plan_code || p.plan?.plan_code).filterType,
    interval:       p.interval_unit || p.billing_interval || p.interval || p.plan_interval || "",
    zohoId:         p.customer_id || p.zoho_customer_id || p.zoho_invoice_id || "",
    zohoCustomerId: p.customer_id || p.zoho_customer_id || "",
    referenceNumber: p.reference_number || p.referenceNumber || "",
    paymentMode:    p.payment_mode || p.paymentMode || "",
  };
}

// GET /admin/get-all-submodules — used ONLY as a Start/End-date enrichment
// lookup for Earned Revenue (v2.29.104; briefly this screen's whole row
// source in v2.29.103, reverted per follow-up feedback). EarnedRevenue()
// joins each row to an invoice by `id` (this feed's transaction_id) matching
// the invoice's own `id` (invoice_id) — see the lookup in EarnedRevenue().
export function mapSubmodule(sm) {
  const p = sm.submodule_profile || sm.submodule || sm;
  return {
    id:             p.transaction_id || p.id || "",               // join key -> invoice's own `id` (invoice_id)
    number:         p.invoice_number || p.number || "",
    termStart:      p.current_term_starts_at || p.termStartsAt || "",  // used as Earned Revenue's Start Date
    termEnd:        p.current_term_ends_at || p.termEndsAt || "",      // used as Earned Revenue's End Date
    paidDate:       p.paid_date || p.paidDate || "",
    total:          Number(p.amount ?? p.total ?? 0) || 0,
    transactionRef: p.reference_number || p.referenceNumber || "",
    accountName:    p.account_name || p.accountName || "",
    // Billing cadence — shown as Earned Revenue's "Interval" column (v2.29.105).
    intervalCount:  p.interval ?? p.interval_count ?? p.intervalCount ?? null,
    intervalUnit:   p.interval_unit || p.intervalUnit || "",
  };
}

// Refundable security deposit, tiered by amount. A plain recharge (≤ ₹1500)
// has no deposit → 0. One rule used everywhere (invoices, reconciliation,
// balance sheet): >4000 → 4000, >2000 → 2000, >1500 → 1500, else 0.
export function depositFor(amount) {
  const a = Number(amount) || 0;
  if (a > 4000) return 4000;
  if (a > 2000) return 2000;
  if (a > 1500) return 1500;
  return 0;
}

// Deposit split that also handles the Prabhavati plans (lower deposit tiers).
export function depositForPlan(plan, amount) {
  const a = Number(amount) || 0;
  if (/prabhav/i.test(String(plan || ""))) {
    if (a > 4000) return 3000;
    if (a > 2000) return 2000;
    return 0;
  }
  return depositFor(a);
}

// Real per-apartment, per-device-type security deposit amounts (v2.29.108),
// given directly by the business — these are FIXED policy values, not tiered
// by how much was paid, unlike depositFor()/depositForPlan() above. E.g. MJR
// Clique Hydra + Hot & Cold always deducts ₹3,000 deposit, so a ₹3,350
// payment recognises exactly ₹350 recharge, regardless of the generic tiers.
// Keyed by a normalised society name -> device type (see deviceType(),
// "Own Device"/"Normal Device"/"Hot & Cold") -> ₹ deposit.
// NOT YET COVERED apartments keep falling back to depositForPlan()'s generic
// amount-tiered heuristic below — add more societies here as their real
// numbers are provided; don't guess at ones not listed.
export const APARTMENT_DEVICE_DEPOSITS = {
  "mjr clique hydra": { "Own Device": 1500, "Normal Device": 1500, "Hot & Cold": 3000 },
  "prabhavati meghna towers": { "Own Device": 1500, "Normal Device": 2000, "Hot & Cold": 4000 },
};
// Normalises a society name for matching against APARTMENT_DEVICE_DEPOSITS —
// strips a "CRO_" prefix and "[...]" suffix (the DP-transaction feed's own
// naming convention, e.g. "CRO_CBR Aakruti [ Hoodi ]"), drops the noise word
// "apartment(s)", collapses whitespace, and lowercases.
export const normSociety = (s) => String(s || "")
  .replace(/^CRO_/i, "")
  .replace(/\[[^\]]*\]/g, "")
  .replace(/\bapartments?\b/gi, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();
// Whether a raw society/apartment name counts as "real" for a filter's
// DEFAULT (unset) state — CRM-wide (v2.29.137, per explicit request): every
// Society/Apartment filter should exclude the known non-real "Apartment
// (Testing)" entry and blank/unknown society values by default. Catches the
// several different blank-placeholder strings different screens already
// substitute in place of a truly empty value (Unknown / — No society — / —),
// not just an actual empty string. Explicitly selecting one of these from a
// filter dropdown still overrides this and shows it — this only governs the
// unset/"all" default, exactly like every other default-exclusion filter in
// this app (e.g. Customer > Societies' own society filter, v2.29.130).
const BLANK_SOCIETY_LABELS = new Set(["", "—", "unknown", "— no society —", "n/a", "na"]);
export const isRealSociety = (name) => {
  const s = String(name ?? "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (BLANK_SOCIETY_LABELS.has(low)) return false;
  if (low === "apartment (testing)") return false;
  return true;
};
// The one function every deposit calculation should call from now on
// (v2.29.108, corrected same day after a real bug report; v2.29.133 added a
// `planCode` 4th argument — pass it whenever the invoice/subscription has
// one, it's now the FIRST thing checked). `cust` is the customer record (for
// `.society`/`.purifier_id`) — pass null/undefined when unavailable, it just
// falls back cleanly.
//
// Priority order, highest first:
//  1. PLAN_CATALOG[planCode].setupFee — exact real per-plan Setup Fee, given
//     directly by the business (v2.29.133). This is exact data, not a tier
//     guess, so it wins whenever the plan_code is recognised — INCLUDING over
//     the apartment/device-type table below. Confirmed against real
//     discrepancies: several MJR-prefixed plans (MJR_3M_UV etc.) carry
//     Setup Fee ₹0 in this catalog even though MJR Clique Hydra's own
//     apartment-tier table (below) says Normal/Hot & Cold should be
//     ₹1,500/₹3,000 — the plan catalog is the more specific, more current
//     source and takes precedence for any plan_code it recognises.
//  2. APARTMENT_DEVICE_DEPOSITS[society] — real per-apartment/device-type
//     tiers, for plan_codes NOT in the catalog (e.g. very old invoices).
//  3. depositForPlan() — the generic amount-tiered guess, last resort.
//
// A FIXED deposit can't just be deducted from every invoice for a known
// plan/apartment — a customer's recurring MONTHLY RECHARGE invoices are pure
// recharge, no deposit component (the deposit was only collected once, on an
// earlier invoice); deducting ₹1,500 from a ₹450 monthly recharge is wrong.
// So: only apply a tier when the amount actually COVERS it (same rule at
// every priority level, including the plan catalog's own Setup Fee).
export function depositForCustomer(cust, plan, amount, planCode) {
  const a = Number(amount) || 0;
  const p = planInfo(planCode);
  if (p) {
    const fee = p.setupFee || 0;
    return (fee > 0 && a >= fee) ? fee : 0;
  }
  const table = APARTMENT_DEVICE_DEPOSITS[normSociety(cust?.society)];
  if (table) {
    const dt = deviceType(cust?.purifier_id);
    const dtTier = dt && table[dt] != null ? table[dt] : null;
    if (dtTier != null && a >= dtTier) return dtTier;
    const tiers = [...new Set(Object.values(table))].sort((x, y) => y - x);
    for (const t of tiers) if (a >= t) return t;
    return 0; // below every real tier for this apartment — a pure recharge invoice
  }
  return depositForPlan(plan, amount);
}

/* ---- Shared date-range filter (Analytics reports) -------------------------
   One preset list + one resolver for every report, so "This Quarter" means the
   same thing everywhere. resolveRange() returns inclusive day boundaries.
   prevRange() is calendar-aware for month/quarter/year presets (This Month vs
   the previous *calendar* month, not "the 31 days before the 1st") and falls
   back to an equal-length shift for day/week/custom spans. ---- */


// Calendar units each preset snaps to — drives prevRange()'s comparison.


// The period immediately before `r` — the like-for-like comparison basis.

// The same span, one year earlier.


/* Buckets for a range: one per day for spans up to ~2 months, one per month
   beyond that — so This Year charts 12 bars instead of 365. */

/* State + resolved range for a report. `sel` is what the picker edits; `range`
   is what the report should actually filter on. */

/* Preset dropdown (Today / This Week / … / Custom). Note: distinct from the
   older From/To `DateRangeFilter` bar that several reports still use. */

/* ---- Multi-select filter (Society, …) -------------------------------------
   `value` is the array of selected options, or null for "everything" — so the
   filter needs no knowledge of the option list until the user narrows it, and
   unchecking a single box excludes just that one. ---- */
// "Society" → "societies", "Plan" → "plans". Pass `plural` to override.


/* ---- Plan-term helpers (shared by Billing Analytics, Earned Revenue, Apartment
   Performance). Real plans encode the term in the name/code, e.g.
   ADV_PRABHAVATI_SD_6M / ADV_PRA_299_6M_SD -> 6 months. ---- */
export const parseTermToken = (str) => {
  const m = String(str || "").toUpperCase().match(/(\d+)\s*M(?![A-Z])/); // 6M, 12 M, 3M
  if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 36) return n; }
  const y = String(str || "").toUpperCase().match(/(\d+)\s*Y/);          // 1Y
  if (y) return parseInt(y[1], 10) * 12;
  return null;
};
export const termFromWord = (interval) => {
  const u = String(interval || "").toLowerCase();
  if (u.includes("year") || u.includes("annual")) return 12;
  if (u.includes("half")) return 6;
  if (u.includes("quarter")) return 3;
  if (u.includes("month")) return null; // "months" is just the unit, not the term
  if (u.includes("week")) return 0.25;
  return null;
};
export const monthsBetween = (a, b) => {
  if (!a || !b) return null;
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  const m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  return m >= 1 && m <= 36 ? m : null;
};
export const termMonths = (src) => {
  if (src && typeof src === "object") {
    if (src.intervalCount && src.intervalCount >= 1) {
      const unit = String(src.intervalUnit || src.interval || "months").toLowerCase();
      const mult = unit.includes("year") ? 12 : unit.includes("week") ? 0.25 : 1;
      const t = src.intervalCount * mult;
      if (t >= 1 && t <= 36) return t;
    }
    return parseTermToken(src.plan) || parseTermToken(src.planCode)
      || monthsBetween(src.activatedAt, src.nextBilling)
      || termFromWord(src.interval) || 1;
  }
  return termFromWord(src) || 1;
};
export const monthlyOf = (s) => (s.amount || 0) / (termMonths(s) || 1);

// Generic paginated fetch for the admin billing endpoints.

/* ============================================================================
   RATE-LIMIT-HARDENED PARALLEL PAGINATION (v1.8.6)
   Fetch page 1, and if the response carries a `total`, fetch pages 2..N in
   BOUNDED concurrent batches (default 4) — fast without hammering Zoho into a
   429. Each page retries on 429 (Retry-After / exponential backoff); a 500 is
   NOT retried (it's a hard Zoho error). Falls back to sequential has_more paging
   when no total is known.
   ============================================================================ */
// ── GLOBAL Zoho request gate ────────────────────────────────────────────────
// Every paginated Zoho fetch funnels through fetchPage. This gate caps how many
// run CONCURRENTLY across ALL endpoints (customers+subs+invoices+leads together)
// and enforces a minimum gap between request starts, so even a cold load can't
// burst into Zoho's per-second/per-minute rate limit.



let _subCache = null, _subCacheAt = 0;
let _invCache = null, _invCacheAt = 0;
export const billingApi = {
  getSubscriptions: async (force = false) => getCached("subscriptions", "subscriptions", "/admin/get-all-subscriptions", async () => {
    const raw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-subscriptions?page=${page}&per_page=300`,
      (json) => json.subscriptions || json.data || (Array.isArray(json) ? json : []),
    );
    return raw.map(r => r.customerName ? r : mapSubscription(r));
  }, [...SEED_SUBSCRIPTIONS], force),
  getInvoices: async (force = false) => getCached("invoices", "invoices", "/admin/get-all-invoices", async () => {
    const raw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-invoices?page=${page}&per_page=300`,
      (json) => json.invoices || json.data || (Array.isArray(json) ? json : []),
    );
    return raw.map(r => r.number ? r : mapInvoice(r));
  }, [...SEED_INVOICES], force),
  // Earned Revenue's row source (v2.29.103) — see mapSubmodule above.
  getSubmodules: async (force = false) => getCached("submodules", "submodules", "/admin/get-all-submodules", async () => {
    const raw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-submodules?page=${page}&per_page=300`,
      // The live response wraps rows in "subscriptions" (confirmed via a real
      // Postman call, 2026-08-17) — NOT "submodules"/"data" as first assumed;
      // that mismatch silently extracted 0 rows every time, which getCached's
      // "if (!rows.length) throw" treated as a failure and quietly fell back
      // to sample data — no console error, just a wrong wrapper key.
      (json) => json.subscriptions || json.submodules || json.data || (Array.isArray(json) ? json : []),
    );
    return raw.map(r => r.termStart ? r : mapSubmodule(r));
  }, [...SEED_SUBMODULES], force),
  // Billing & Subscription > Plans (v2.29.287) — was static PLAN_CATALOG-only
  // ("no API fetch", v2.29.133); now backed by the real plan catalog endpoint,
  // per explicit request, with PLAN_CATALOG's own rows kept as the sample-data
  // fallback so a dead/unreachable API looks exactly like it did before this
  // change. Deliberately scoped to ONLY this billingApi entry + the Plans page
  // — PLAN_CATALOG itself, planInfo()/classifyPlan()/depositForCustomer() and
  // every other call site (Analytics.jsx, Customer.jsx) keep reading the
  // static constant unchanged, so this can't silently move numbers anywhere
  // else the way editing PLAN_CATALOG itself would have.
  getPlans: async (force = false) => getCached("plans", "plans", "/admin/subs-module-get-all-plans", async () => {
    const raw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/subs-module-get-all-plans?page=${page}&per_page=300`,
      (json) => json.plans || json.data || (Array.isArray(json) ? json : []),
    );
    return raw.map(r => r.code ? r : mapPlan(r));
  }, SEED_PLANS, force),
  forceRefresh: async () => {
    _memCache.subscriptions = null; _memCache.invoices = null; _memCache.submodules = null; _memCache.plans = null;
    _inflight.subscriptions = null; _inflight.invoices = null; _inflight.submodules = null; _inflight.plans = null;
    await Promise.all([billingApi.getSubscriptions(true), billingApi.getInvoices(true), billingApi.getSubmodules(true), billingApi.getPlans(true)]);
  },
};
