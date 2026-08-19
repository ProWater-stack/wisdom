/* ============================================================================
   shared/core.js — non-JSX engine room: localStorage wrapper, the generic
   API-cache/rate-limit layer, the Zoho paged-fetch engine, customer data
   layer, date-range utilities, formatters, auth/session state, and the
   logs+failures tracking infra. Extracted verbatim from App.jsx (v2.30 split).
   ============================================================================ */

import { useState, useEffect, useContext, createContext } from "react";
import { ApiUsageTracker, makeCache } from "../lib/apiUsageTracker";

// ---- Moved from App.jsx: allAccess/seedUsers/pushLog/resolveRange all need these ----
export const MODULES = [
  { id: "sales",     label: "Sales",                  icon: "Briefcase",  desc: "Leads, pipeline & deals",          built: true,  color: "#0A9D6E" },
  { id: "customer",  label: "Customer",               icon: "UserRound",  desc: "Accounts & plan management",       built: true,  color: "#0B6F52" },
  { id: "billing",   label: "Billing & Subscription", icon: "Receipt",    desc: "Invoices, plans & renewals",       built: true,  color: "#0B6F52" },
  { id: "erp",       label: "ERP & Inventory",        icon: "Boxes",      desc: "Stock, purifiers & supply",        built: true,  soon: true, color: "#986315" },
  { id: "fsm",       label: "FSM System",             icon: "Wrench",     desc: "Field service & installations",    built: true,  soon: true, color: "#DC4141" },
  { id: "iot",       label: "IoT Core",               icon: "Cpu",        desc: "Device telemetry & connectivity",  built: true,  color: "#2A86D6" },
  { id: "referral",  label: "Referral",               icon: "GitBranch",  desc: "Referrers, referees & rewards",    built: true,  color: "#0A9D6E" },
  { id: "ticketing", label: "Ticketing",              icon: "Ticket",     desc: "Support tickets & resolution",     built: true,  color: "#986315" },
  { id: "autoscheduler", label: "Auto Scheduler",     icon: "CalendarClock", desc: "Recurring service scheduling & IoT alerts", built: true, color: "#0B6F52" },
  { id: "analytics", label: "Analytics",              icon: "BarChart3",  desc: "Cross-module reporting",           built: true,  color: "#2A86D6" },
  { id: "planner",   label: "Task Planner",           icon: "LayoutGrid", desc: "Kanban board, tasks & projects",   built: true,  color: "#2A86D6" },
  { id: "employee",  label: "Employee",               icon: "UserCog",    desc: "Add & manage dashboard users",     built: true,  color: "#2A86D6" },
  { id: "devicereplace", label: "Device Replacement", icon: "Repeat",     desc: "Swap an old purifier for a new one", built: true, color: "#2A86D6" },
  { id: "logtracker",label: "Logs Tracker",           icon: "ScrollText", desc: "Audit trail across all modules",   built: true,  color: "#DC4141" },
  { id: "about",     label: "About",                  icon: "Info",       desc: "Version history & module docs",    built: true,  color: "#0A9D6E" },
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
      (page) => `${API_ORIGIN}/admin/get-all-customers?page=${page}&per_page=300`,
      (json) => Array.isArray(json.customers) ? json.customers : (Array.isArray(json.data) ? json.data : []),
    );
    return allRaw.map(c => {
      const p = c.customer_profile || c;
      return {
        id:      p.customer_number  || p.zoho_customer_id || "",
        name:    p.name             || "",
        email:   p.email            || "",
        phone:   p.phone            || "",
        address: p.billing_address?.full_address_string || "",
        society: p.society          || "",
        plan:    p.plan             || "",
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
        // Customer Stack (v2.29.113, fixed v2.29.114/.115): is_dp_customer false
        // → "Zoho", true → "DP" — lives on customer_profile itself (confirmed via
        // a real record). dp_installation_id, however, is nested one level
        // deeper, inside customer_profile.dp_details.dp_installation_id (NOT a
        // sibling of is_dp_customer as first assumed) — confirmed via a real
        // customer_profile.dp_details block: { dp_customer_id, dp_installation_id,
        // device_code, partner_name, device_status, balance_litres, ... }. Checked
        // at both `c`/`p` and their respective `dp_details` for resilience.
        // Tolerant of boolean true or a stringified "true"/"1" for is_dp_customer
        // (won't mis-coerce a stringified "false", unlike plain `!!`).
        isDpCustomer:      [true, "true", "True", 1, "1"].includes(c.is_dp_customer ?? p.is_dp_customer),
        dpInstallationId:  String(p.dp_details?.dp_installation_id ?? c.dp_details?.dp_installation_id ?? c.dp_installation_id ?? p.dp_installation_id ?? "") || "",
        // Device install status ("Active" / "In-Active" / "Un-Installed") for
        // DP-stack customers — same dp_details block as dp_installation_id.
        // Row-highlighted in All Customers (v2.29.117): Un-Installed → yellow.
        deviceStatus:      p.dp_details?.device_status ?? c.dp_details?.device_status ?? "",
        // Sign-up / created date — used for month-on-month growth.
        since: p.created_time || p.created_at || p.signup_date || p.customer_created_time || p.since || "",
      };
    });
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
export let _otpStore = {};          // { username: { otp, expires } } — simulated OTP codes
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
export const PERSIST_TTL = { customers: 3 * 60 * 60 * 1000, subscriptions: 3 * 60 * 60 * 1000, invoices: 3 * 60 * 60 * 1000, submodules: 3 * 60 * 60 * 1000, leads: 60 * 60 * 1000 };
export const _memCache = {};    // { key: { rows, at } } — session mirror of the persisted cache
export const _inflight = {};    // { key: Promise } — in-flight dedup (_custInflight/_subInflight/…)
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
  bill_overview: ["subscriptions", "invoices"], bill_subs: ["subscriptions"],
  bill_invoices: ["invoices"], bill_deposits: ["subscriptions"],
  // Analytics — wildly different data needs per tab; this is the module where the
  // blanket gate was most visibly wrong (12 sub-tabs sharing one 4-source lock).
  an_overview: ["customers", "subscriptions", "invoices", "leads"],
  analytics: [],           // Referral analytics — reads the referral API, untracked here
  an_sales: ["leads"],
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
  if (id.startsWith("OWN")) return "Own Device";
  return "Normal Device";
};
export const DEVICE_TYPE_STYLE = {
  "Hot & Cold":    ["#986315", "#FBF0E0"],
  "Own Device":    ["#0B6F52", "#E2F3EE"],
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


export const APP_VERSION = "2.29.136";
export const VERSION_DATE = "2026-08-19";
export const VERSION_HISTORY = [
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

  // Forgot-password OTP flow (SIMULATED — real email needs a backend mail service).
  // >>> WIRE: replace with POST /api/auth/request-otp that emails a real code.
  requestOtp: async (username) => {
    await wait(300);
    const key = String(username || "").trim().toLowerCase();
    const u = _users.find(x => x.username.toLowerCase() === key);
    if (!u) throw new Error("No account found with that ID.");
    const otp = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
    _otpStore[key] = { otp, expires: Date.now() + 5 * 60 * 1000 };
    pushLog({ type: "otp_requested", actor: u.username, detail: `Password reset OTP requested (${u.username}${EMAIL_DOMAIN})` });
    return otp; // returned only because we simulate on-screen; a real backend would NOT return it
  },
  // >>> WIRE: replace with POST /api/auth/verify-otp + reset.
  resetPasswordWithOtp: async (username, otp, newPw) => {
    await wait(300);
    const key = username.toLowerCase();
    const rec = _otpStore[key];
    if (!rec) throw new Error("Request a new code.");
    if (Date.now() > rec.expires) { delete _otpStore[key]; throw new Error("That code has expired. Request a new one."); }
    if (rec.otp !== String(otp).trim()) throw new Error("Incorrect code. Try again.");
    _users = _users.map(u => u.username.toLowerCase() === key ? { ...u, password: newPw } : u);
    saveUsers();
    delete _otpStore[key];
    pushLog({ type: "password_reset", actor: username, detail: "Password reset via email OTP" });
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
  return "#0A9D6E";
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
// Google Maps link for a ticket — prefers precise Work Start lat/long, else the
// text Work Start Address as a search query. Empty string when neither exists.
export function ticketMapsUrl(t) {
  const lat = t.workStartLat, lng = t.workStartLng;
  if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (t.workStartAddress) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.workStartAddress)}`;
  return "";
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
  return {
    id: String(g("creditnote_id", "creditnoteId", "id", "creditnote_number", "number") ?? ""),
    number: String(g("creditnote_number", "number", "creditnote_id", "id") ?? "—"),
    zohoCustomerId: String(g("zoho_customer_id", "customer_id", "zohoCustomerId", "customerId", "customer_number", "customerNumber") ?? ""),
    customerName: String(g("customer_name", "customerName", "customer") ?? ""),
    amount: num(g("total", "creditnote_total", "creditnote_amount", "amount", "credit_amount", "price")),
    // Remaining (unapplied) credit balance; if the feed omits it, assume the full amount is available.
    balance: (() => { const b = g("balance", "credit_balance", "creditnote_balance", "amount_due"); return b != null && b !== "" ? num(b) : num(g("total", "creditnote_total", "creditnote_amount", "amount", "credit_amount", "price")); })(),
    date: String(g("date", "created_time", "created_at", "createdTime", "creditnote_date", "created") ?? ""),
    status: String(g("status", "creditnote_status") ?? ""),
    reason: String(g("reason", "notes", "description", "remarks", "subject") ?? ""),
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
export const BILL_CACHE_MS = 5 * 60 * 1000;

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
  forceRefresh: async () => {
    _memCache.subscriptions = null; _memCache.invoices = null; _memCache.submodules = null;
    _inflight.subscriptions = null; _inflight.invoices = null; _inflight.submodules = null;
    await Promise.all([billingApi.getSubscriptions(true), billingApi.getInvoices(true), billingApi.getSubmodules(true)]);
  },
};
