/* ============================================================================
   modules/About.jsx — About module. Extracted verbatim from App.jsx
   (v2.30 module-split). Version badge, scrollable changelog, searchable
   module docs + live-API reference, and the shared Firestore-backed
   Releases API (App/Technician release notes + "what's new" popup).
   ============================================================================ */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock, Check, CheckCircle2, Info, Rocket, Trash2, X,
} from "lucide-react";
import {
  useAuth, api, LS, fmtDate, fmtTime, DR_FS_PROJECT, DR_FS_DB, _drToFsFields, _drScalar,
  APP_VERSION, VERSION_DATE, VERSION_HISTORY, MODULES,
} from "../shared/core";
import {
  Card, Table, Toolbar, Empty, MODULE_ICONS,
  inp, btnGhost, btnPrimary, iconBtn, toastStyle, overlay, td,
} from "../shared/ui";

/* ===========================================================================
   ABOUT — version badge + scrollable changelog + searchable module docs
   =========================================================================== */
export const MODULE_DOCS = [
  { id: "sales", label: "Sales", summary: "Zoho CRM leads: pipeline, leads & deals, analytics, error correction, apartment leads.", points: ["Live leads via /admin/zoho/get-all-leads (per_page 500)", "Kanban pipeline + full leads table with status filter", "Apartment × lead-status pivot", "Error Correction flags installed leads missing money fields"], source: "/admin/zoho/get-all-leads" },
  { id: "customer", label: "Customer", summary: "Zoho Billing customer accounts, plans and credits.", points: ["Paginated customer list with search", "Editable plan/billing per role", "Grand-total row on plan amount"], source: "/admin/get-all-customers" },
  { id: "billing", label: "Billing & Subscription", summary: "Subscriptions, invoices, deposits and analytics.", points: ["Subscriptions + invoices from Zoho Billing", "Earned Revenue & Apartment Performance analytics", "Deposits & refunds", "Plans catalog (live)"], source: "/admin/get-all-subscriptions · /admin/get-all-invoices · /admin/subs-module-get-all-plans" },
  { id: "erp", label: "ERP & Inventory", summary: "Purifier asset lifecycle, cost & depreciation.", points: ["Asset register with book value", "Cost / depreciation totals"], source: "local" },
  { id: "fsm", label: "FSM System", summary: "Field service: technician tracking, AMC, water quality.", points: ["Track technician location", "AMC / maintenance schedule"], source: "local" },
  { id: "iot", label: "IoT Core", summary: "Live device telemetry — pressure, flow, valve state.", points: ["Device monitor with status polling", "Valve + channel telemetry"], source: "AWS IoT API" },
  { id: "referral", label: "Referral", summary: "Referrers, referees, credits and the rewards tracker.", points: ["Referral momentum charts", "Credit approvals + backtrack"], source: "/api/admin/all-referrals" },
  { id: "ticketing", label: "Ticketing", summary: "Zoho Desk support tickets & resolution.", points: ["Live tickets via Zoho Desk (GET /tickets/formattedforwisdom)", "List with status/priority filters + detail drawer"], source: "Zoho Desk · /tickets/formattedforwisdom" },
  { id: "autoscheduler", label: "Auto Scheduler", summary: "15-day general-service scheduling with auto-raised tickets. Local-first.", points: ["CRO type, backwash & dozing tracking", "Auto ticket on day 14", "Does NOT flag Server Down (local-first)"], source: "local seed / optional /api/gs-schedules" },
  { id: "analytics", label: "Analytics", summary: "Cross-module reporting: referral, sales, billing, earned revenue, apartment performance.", points: ["Referral + Sales insights", "Earned Revenue (day-based accrual)", "Apartment Performance by society / purifier"], source: "aggregates" },
  { id: "planner", label: "Task Planner", summary: "ClickUp-style Kanban board for internal tasks across Scoping → Live.", points: ["7 status columns with drag-and-drop", "Cards carry assignee, email, notes, attachments, start/end dates & priority", "Board + List views, assignee filter & search"], source: "localStorage pw_tasks" },
  { id: "employee", label: "Employee", summary: "Add & manage dashboard users; login matches email → user for role/access.", points: ["Create / disable users", "Role & module access control"], source: "localStorage pw_users" },
  { id: "logtracker", label: "Logs Tracker", summary: "Audit trail with IP/geo, version stamp, and an API Failures monitor.", points: ["Every log stamped with app version", "Clear log + CSV export", "Failures tab + Server Down popup"], source: "localStorage pw_logs / pw_failures" },
  { id: "devicereplace", label: "Device Replacement", summary: "Record an old→new purifier swap via a 3-step irreversible wizard.", points: ["Captures old + new device details", "Computes old-device ageing", "Saved to Firebase via backend POST /device-replacement/add; cached locally so it shows + survives reloads", "Records are final (no edit/undo)"], source: "POST /device-replacement/add · localStorage pw_device_replacements" },
  { id: "about", label: "About", summary: "This page — version history and per-module documentation.", points: ["Full changelog", "Searchable module docs"], source: "in-app" },
];
export const API_USAGE = [
  { group: "ProWater backend · api-7ca73ntgua-el.a.run.app (Bearer auth)", items: [
    { m: "GET", path: "/admin/get-all-customers", use: "Customer accounts (Zoho Contacts) — Customer, Analytics" },
    { m: "GET", path: "/admin/get-all-subscriptions", use: "Subscriptions (Zoho Billing) — Billing" },
    { m: "GET", path: "/admin/get-all-invoices", use: "Invoices (Zoho Billing) — Billing, Analytics, Earned Revenue (customer/plan lookup)" },
    { m: "GET", path: "/admin/get-all-submodules", use: "Subscription term/payment records (Zoho Billing) — Earned Revenue's Start/End-date + Interval enrichment lookup, joined via invoice_id/invoice_number → transaction_id (v2.29.104-106)" },
    { m: "GET", path: "/admin/subs-module-get-all-plans", use: "Plan catalog (Zoho Billing) — Billing & Subscription · Plans (v2.29.287); falls back to the static PLAN_CATALOG sample data if unreachable" },
    { m: "GET", path: "/admin/get-all-creditnotes", use: "Credit notes / discounts (Zoho Billing) — Analytics · Credits, All Customers" },
    { m: "GET", path: "/admin/zoho/get-all-leads", use: "Zoho CRM leads — Sales, Analytics" },
    { m: "GET", path: "/admin/zoho/get-all-apartments/data", use: "Apartment leads — Sales" },
    { m: "GET", path: "/admin/get-app-logs", use: "Server app logs — Analytics · App Logs" },
    { m: "POST", path: "/documents/add?email=", use: "Task Planner attachments — upload files for the signed-in user" },
    { m: "POST", path: "/device-replacement/add", use: "Save a device-replacement swap → Firebase" },
    { m: "GET", path: "/api/admin/all-referrals", use: "Referrers + referees + credits — Referral" },
    { m: "GET", path: "/tickets/formattedforwisdom", use: "Zoho Desk tickets (list, Wisdom-formatted) — Ticketing" },
    { m: "GET/POST", path: "/api/gs-schedules", use: "Auto GS schedules (optional; local-first)" },
  ] },
  { group: "ProWater backend · same origin, but UNAUTHENTICATED feeds (no Bearer header)", items: [
    { m: "GET", path: "/dp-transactions", use: "Analytics · DP Transaction — row source (cursor-paginated)" },
    { m: "POST", path: "/dp-transactions/add", use: "DP Transaction's admin-only Upload JSON → Run API (multipart, field \"file\")" },
  ] },
  { group: "DrinkPrime · separate origin, unauthenticated, CORS-open", items: [
    { m: "GET", path: "api.drinkprime.in/payments/payments/payments/v1", use: "Customer · All Customers, DP-stack Transactions sub-page (?loader=true&page=1&pageSize=100&deviceCode={purifier_id}&installationID={dp_installation_id}, v2.29.134 — replaced the old v2/collections endpoint)" },
    { m: "GET", path: "api.drinkprime.in/sponsor/device/details/syncs", use: "Customer · All Customers, DP-stack Sync History sub-page (?pageSize=10&page=1&orderDir=desc&orderBy=id&deviceCode={purifier_id}, v2.29.127)" },
    { m: "POST", path: "api.drinkprime.in/sponsor/device/life/conn-check", use: "Customer · All Customers, DP device connectivity check (payload: botId, connectivity) (v2.29.254)" },
  ] },
  { group: "Google / Firebase", items: [
    { m: "POST", path: "identitytoolkit.googleapis.com/…:signInWithPassword", use: "Login — email/password auth" },
    { m: "POST", path: "firestore.googleapis.com/…:runQuery", use: "App Logs (logs) + Device Replacement read-back (device_replacements)" },
    { m: "POST/GET/DELETE", path: "firestore.googleapis.com/…/documents/wisdom2.0_releases", use: "App & Technician releases — shared so every login sees the popup (Firestore)" },
    { m: "GET", path: "firebasestorage.googleapis.com/v0/b/…/o/…?alt=media", use: "Download Task Planner attachments (backend-prowater.firebasestorage.app)" },
    { m: "GET", path: "fonts.googleapis.com", use: "Web fonts (Playfair Display + DM Sans)" },
  ] },
  { group: "External utility APIs", items: [
    { m: "GET", path: "ipapi.co/json", use: "Client IP + ISP + approx city (audit log)" },
    { m: "GET", path: "api.ipify.org", use: "Client IP fallback" },
    { m: "GET", path: "api.bigdatacloud.net/…/reverse-geocode-client", use: "GPS → city name (audit log)" },
    { m: "GET/POST", path: "…execute-api.ap-southeast-2.amazonaws.com/prod", use: "IoT device status + history (IoT Core)" },
    { m: "GET", path: "asia-south1-backend-prowater.cloudfunctions.net/weather", use: "Weather history proxy (Google Weather API, key server-side) — IoT Core weather correlation" },
  ] },
];
export const apiMethodBadge = (m) => { const c = m.includes("POST") ? ["#2A86D6", "#E5F0FA"] : ["#08805A", "#E2F3EE"]; return { fontSize: 11, fontWeight: 700, color: c[0], background: c[1], padding: "2px 8px", borderRadius: 7, fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }; };
/* ===========================================================================
   RELEASES — App & Technician release notes (free text). Admins publish; the
   publish stamps date+time. On login every user gets a "what's new" popup for
   releases they haven't seen. Stored in a SHARED Cloud Firestore collection
   (backend-prowater · prowaterdb · wisdom2.0_releases) so a published release
   reaches EVERY login; a localStorage copy (pw_releases) is the offline cache.
   The collection is created automatically the first time a release is written.
   =========================================================================== */
export const RELEASES_COLLECTION = "wisdom2.0_releases";
const RELEASES_FS_BASE = `https://firestore.googleapis.com/v1/projects/${DR_FS_PROJECT}/databases/${DR_FS_DB}/documents`;
const _relHeaders = () => { const t = sessionStorage.getItem("pw_idToken"); return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }; };
const saveReleases = (obj) => LS.set("pw_releases", obj);
export let _releasesCache = (() => { const r = LS.get("pw_releases", null); return (r && typeof r === "object") ? { app: r.app || [], technician: r.technician || [] } : { app: [], technician: [] }; })();
const getReleases = () => _releasesCache;   // synchronous read from cache (callers stay sync)
export function mapReleaseDoc(doc) {
  const f = doc.fields || {};
  return {
    _docId: (doc.name || "").split("/").pop(),
    id: _drScalar(f.id) || (doc.name || "").split("/").pop(),
    kind: _drScalar(f.kind) === "technician" ? "technician" : "app",
    sprint: _drScalar(f.sprint), version: _drScalar(f.version), notes: _drScalar(f.notes),
    publishedAt: _drScalar(f.publishedAt), scheduledAt: _drScalar(f.scheduledAt), by: _drScalar(f.by),
  };
}
export const _relByPubDesc = (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
export async function _relPush(rel) {
  const { _docId, ...body } = rel;   // never write our local-only _docId field
  const res = await fetch(`${RELEASES_FS_BASE}/${RELEASES_COLLECTION}`, {
    method: "POST", headers: _relHeaders(), body: JSON.stringify({ fields: _drToFsFields(body) }),
  });
  if (!res.ok) { let m = `Firestore ${res.status}`; try { const j = await res.json(); if (j?.error?.message) m = j.error.message; } catch { /* keep status */ } throw new Error(m); }
  return mapReleaseDoc(await res.json());
}
export const releasesApi = {
  local: () => _releasesCache,
  // Read all releases from Firestore, MERGE with any local-only ones (uploading them
  // best-effort so nothing is lost when this collection first goes live), refresh cache.
  fetch: async () => {
    try {
      const res = await fetch(`${RELEASES_FS_BASE}:runQuery`, {
        method: "POST", headers: _relHeaders(),
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: RELEASES_COLLECTION }], limit: 500 } }),
      });
      if (!res.ok) throw new Error(`Firestore ${res.status}`);
      const json = await res.json();
      const rows = (json || []).filter(r => r.document).map(r => mapReleaseDoc(r.document));
      const cloudIds = new Set(rows.map(r => r.id));
      const merged = { app: [], technician: [] };
      rows.forEach(r => merged[r.kind].push(r));
      ["app", "technician"].forEach(k => (_releasesCache[k] || []).forEach(r => {
        if (r.id && !cloudIds.has(r.id)) { merged[k].push(r); if (!r._docId) _relPush(r).catch(() => { }); }
      }));
      merged.app.sort(_relByPubDesc); merged.technician.sort(_relByPubDesc);
      _releasesCache = merged; saveReleases(merged);
      return merged;
    } catch (e) { console.warn("releases fetch failed:", e.message); return _releasesCache; }
  },
  // Publish one release: optimistic cache update, then persist to Firestore for everyone.
  add: async (rel) => {
    const k = rel.kind === "technician" ? "technician" : "app";
    _releasesCache = { ..._releasesCache, [k]: [rel, ...(_releasesCache[k] || [])] };
    saveReleases(_releasesCache);
    try {
      const doc = await _relPush(rel);
      _releasesCache = { ..._releasesCache, [k]: _releasesCache[k].map(r => r.id === rel.id ? { ...r, _docId: doc._docId } : r) };
      saveReleases(_releasesCache);
      return { saved: true };
    } catch (e) { return { saved: false, message: e.message }; }
  },
  // Delete a release everywhere.
  remove: async (rel) => {
    const k = rel.kind === "technician" ? "technician" : "app";
    _releasesCache = { ..._releasesCache, [k]: (_releasesCache[k] || []).filter(r => r.id !== rel.id) };
    saveReleases(_releasesCache);
    if (rel._docId) { try { await fetch(`${RELEASES_FS_BASE}/${RELEASES_COLLECTION}/${rel._docId}`, { method: "DELETE", headers: _relHeaders() }); } catch (e) { console.warn("release delete failed:", e.message); } }
  },
};
/* A release becomes "due" at its scheduled moment — `scheduledAt` is what drives
   the popup, while `publishedAt` only records when it was written. Releases from
   before scheduling existed have no scheduledAt and fall back to publishedAt,
   i.e. they were due the instant they were published. */
export const releaseDueAt = (r) => r.scheduledAt || r.publishedAt || null;
const isReleaseDue = (r, now = Date.now()) => {
  const at = releaseDueAt(r);
  return !at || new Date(at).getTime() <= now;
};
/* Seen state is per USER and tracked by release id — deliberately not a
   "seen everything up to T" timestamp. A release scheduled for next week is
   written *before* a user dismisses today's popup, so a timestamp would mark
   the future release as already seen and it would never show. Keying by user
   (not browser) also means a shared machine shows it to each person once.
   Shape: { [username]: [releaseId, …] }. */
export const RELEASES_SEEN_KEY = "pw_releases_seen_by";
function getSeenReleaseIds(username) {
  const all = LS.get(RELEASES_SEEN_KEY, {}) || {};
  if (all[username]) return new Set(all[username]);
  // First run for this user: honour the old per-browser "seen up to" stamp so
  // existing users aren't re-shown releases they already dismissed.
  const legacy = LS.get("pw_releases_seen", 0);
  if (!legacy) return new Set();
  const rel = getReleases();
  return new Set([...(rel.app || []), ...(rel.technician || [])]
    .filter(r => r.publishedAt && new Date(r.publishedAt).getTime() <= legacy)
    .map(r => r.id));
}
export function markReleasesSeen(username, ids) {
  const all = LS.get(RELEASES_SEEN_KEY, {}) || {};
  all[username] = [...new Set([...(all[username] || []), ...ids])];
  LS.set(RELEASES_SEEN_KEY, all);
}
export const toLocalInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export function ReleaseManager({ kind, isAdmin }) {
  const { user } = useAuth();
  const [data, setData] = useState(() => getReleases());
  const [sprint, setSprint] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [flash, setFlash] = useState("");
  const title = kind === "app" ? "App" : "Technician";
  useEffect(() => { api.logView(user.username, `Viewed ${title} Releases`); releasesApi.fetch().then(setData); }, []);
  const list = data[kind] || [];
  const toast = (m) => { setFlash(m); setTimeout(() => setFlash(""), 2400); };
  const publish = async () => {
    if (!sprint.trim() && !version.trim() && !notes.trim()) return toast("Fill at least one field");
    // Empty schedule = announce now. A past date is allowed and means the same.
    const when = scheduleAt ? new Date(scheduleAt) : new Date();
    if (isNaN(when.getTime())) return toast("Pick a valid schedule date & time");
    const rel = {
      id: crypto.randomUUID(), kind, sprint: sprint.trim(), version: version.trim(), notes: notes.trim(),
      publishedAt: new Date().toISOString(), scheduledAt: when.toISOString(), by: user.name,
    };
    setSprint(""); setVersion(""); setNotes(""); setScheduleAt("");
    const { saved, message } = await releasesApi.add(rel);
    setData(releasesApi.local());
    toast(!saved ? `Saved locally — ${message}` : when.getTime() > Date.now() ? `Scheduled for ${fmtTime(when.toISOString())} · everyone will see it` : "Release published — everyone will see it");
  };
  const remove = async (rel) => { await releasesApi.remove(rel); setData(releasesApi.local()); };
  const lbl = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6, display: "block" };


  return (
    <div className="fade-up">
      {isAdmin && (
        <Card title={`Publish a ${title} release`} sub="All fields are free text. Choose when the announcement popup goes live.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={lbl}>Sprint</label><input value={sprint} onChange={e => setSprint(e.target.value)} placeholder="e.g. Sprint 5" style={inp} /></div>
            <div><label style={lbl}>{title} release version</label><input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. v3.2.0" style={inp} /></div>
            <div>
              <label style={lbl}>Announce from</label>
              <input type="datetime-local" value={scheduleAt} min={toLocalInput(new Date())}
                onChange={e => setScheduleAt(e.target.value)} style={inp} />
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                Leave empty to announce immediately. From this moment, everyone sees the popup once on their next login — including anyone who doesn’t log in that day.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {scheduleAt && (
                <button onClick={() => setScheduleAt("")} style={{ ...btnGhost, marginTop: 26 }}>Clear schedule</button>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Notes — what was released</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What went out in this release…" style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} /></div>
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <button onClick={publish} style={{ ...btnPrimary, marginLeft: "auto" }}>
              {scheduleAt ? <><CalendarClock size={16} /> Schedule release</> : <><Check size={16} /> Publish release</>}
            </button>
          </div>
        </Card>
      )}
      <div style={{ marginTop: isAdmin ? 18 : 0 }}>
        <Card pad={false} title={`${title} Releases · ${list.length}`} sub="Newest first">
          {list.length === 0 ? <Empty msg="No releases yet." /> : (
            <div>
              {list.map(r => (
                <div key={r.id} style={{ display: "flex", gap: 12, padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
                  <span style={{ display: "inline-flex", width: 32, height: 32, borderRadius: 9, background: "var(--mint-2)", color: "var(--forest)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Rocket size={16} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {r.version && <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--f)" }}>{r.version}</span>}
                      {r.sprint && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--forest)", background: "var(--mint-2)", padding: "2px 9px", borderRadius: 999 }}>{r.sprint}</span>}
                      {!isReleaseDue(r) && (
                        <span title="The popup hasn’t started showing yet" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", color: "var(--amber)", background: "var(--amber-t)", border: "1px solid var(--amber-b)", padding: "2px 8px", borderRadius: 999 }}>
                          SCHEDULED · {fmtTime(r.scheduledAt)}
                        </span>
                      )}
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtTime(r.publishedAt)}{r.by ? ` · ${r.by}` : ""}</span>
                    </div>
                    {r.notes && <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.notes}</div>}
                  </div>
                  {isAdmin && <button onClick={() => remove(r)} title="Delete" style={{ ...iconBtn, padding: 6, background: "var(--mint)", flexShrink: 0 }}><Trash2 size={15} /></button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {flash && <div style={toastStyle}><CheckCircle2 size={16} /> {flash}</div>}
    </div>
  );
}
// "What's new" popup — every due release this user hasn't dismissed yet. Shows
// on login, and (via the tick below) the moment a scheduled release falls due
// for someone already signed in. A user who misses the scheduled day still gets
// it on their next login, because "due" is a floor, not a window.
export function ReleasePopup() {
  const { user } = useAuth();
  const [rels, setRels] = useState([]);
  useEffect(() => {
    let alive = true;
    const compute = () => {
      const all = getReleases();
      const seen = getSeenReleaseIds(user.username);
      const due = [...(all.app || []), ...(all.technician || [])]
        .filter(r => isReleaseDue(r) && !seen.has(r.id))
        .sort((a, b) => new Date(releaseDueAt(b)) - new Date(releaseDueAt(a)));
      // Only swap state when the set actually changes, so the tick can't spam re-renders.
      if (alive) setRels(prev => (prev.length === due.length && prev.every((p, i) => p.id === due[i].id)) ? prev : due);
    };
    // Pull the shared releases from Firestore, then show what's new for this user.
    const refresh = () => releasesApi.fetch().then(() => alive && compute());
    refresh();
    const tick = setInterval(compute, 30000);    // a scheduled release can fall due mid-session
    const pull = setInterval(refresh, 180000);   // pull newly-published releases every 3 min
    return () => { alive = false; clearInterval(tick); clearInterval(pull); };
  }, [user.username]);
  if (!rels.length) return null;
  const dismiss = () => { markReleasesSeen(user.username, rels.map(r => r.id)); setRels([]); };
  return createPortal(
    <div onClick={dismiss} style={{ ...overlay, alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1200 }}>
      <div onClick={e => e.stopPropagation()} className="pw-pop" style={{ width: "min(460px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 24, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 60px)", overflowY: "auto", fontFamily: "'DM Sans',system-ui,-apple-system,sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ display: "inline-flex", width: 36, height: 36, borderRadius: 10, background: "var(--mint-2)", color: "var(--forest)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Rocket size={18} /></span>
          <div><p className="eyebrow" style={{ margin: 0 }}>What's new</p><h2 style={{ fontSize: 19, margin: 0 }}>Latest releases</h2></div>
          <button onClick={dismiss} style={{ ...iconBtn, marginLeft: "auto" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {rels.slice(0, 6).map(r => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: r.kind === "app" ? "#2A86D6" : "#DC4141", background: r.kind === "app" ? "#E5F0FA" : "#FBE8E8", padding: "2px 8px", borderRadius: 999 }}>{r.kind === "app" ? "APP" : "TECHNICIAN"}</span>
                {r.version && <span style={{ fontWeight: 700, fontSize: 14, color: "var(--f)" }}>{r.version}</span>}
                {r.sprint && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--forest)" }}>{r.sprint}</span>}
              </div>
              {r.notes && <div style={{ fontSize: 12.5, color: "var(--slate)", marginTop: 5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.notes}</div>}
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{fmtTime(releaseDueAt(r))}</div>
            </div>
          ))}
        </div>
        <button onClick={dismiss} style={{ ...btnPrimary, width: "100%", marginTop: 16 }}>Got it</button>
      </div>
    </div>,
    document.body
  );
}
export function AboutModule() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  useEffect(() => { api.logView(user.username, "Viewed About"); }, []);
  const docs = MODULE_DOCS.filter(d => (d.label + " " + d.summary + " " + d.points.join(" ")).toLowerCase().includes(q.toLowerCase()));


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--forest)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
          <Info size={15} /> ProWater Dashboard v{APP_VERSION}
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Released {fmtDate(VERSION_DATE)} · {VERSION_HISTORY.length} versions</span>
      </div>
      <style>{`
        .about-doc{transition:transform .15s ease, box-shadow .15s ease}
        .about-doc:hover{transform:translateY(-3px);box-shadow:0 14px 30px -16px rgba(13,40,24,.35)}
        .cl-card{transition:transform .15s ease, box-shadow .15s ease}
        .cl-card:hover{transform:translateY(-3px)}
      `}</style>

      {/* Changelog — horizontal timeline strip, newest first (left → right) */}
      <Card title="Changelog" sub="Every version, newest first — scroll right for older builds">
        <div className="scroll-thin" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x proximity" }}>
          {VERSION_HISTORY.map((h, i) => {
            const latest = i === 0;
            return (
              // Fixed-height card: the version row is pinned and only the note
              // scrolls, so one long changelog entry can't stretch the whole strip.
              <div key={h.v} className="cl-card" style={{
                flex: "0 0 232px", height: 196, display: "flex", flexDirection: "column",
                scrollSnapAlign: "start", borderRadius: 14, padding: 14, position: "relative", overflow: "hidden",
                background: latest ? "linear-gradient(135deg, #1E9E4F 0%, #C4E538 100%)" : "#fff",
                color: latest ? "#E2F3EE" : "inherit", border: latest ? "none" : "1px solid var(--border)", boxShadow: "var(--shadow)"
              }}>
                {latest && <div style={{ position: "absolute", right: -18, top: -18, width: 80, height: 80, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.4),transparent 70%)" }} />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7, flexShrink: 0, position: "relative" }}>
                  <span style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 19, color: latest ? "#fff" : "var(--f)", lineHeight: 1 }}>v{h.v}</span>
                  {latest
                    ? <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--forest)", background: "var(--lime)", padding: "2px 8px", borderRadius: 999 }}>Current</span>
                    : <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>#{VERSION_HISTORY.length - i}</span>}
                </div>
                {/* minHeight:0 is load-bearing — without it this flex child refuses
                    to shrink below its content and the card grows instead of scrolling. */}
                <div className="scroll-thin" style={{
                  flex: 1, minHeight: 0, overflowY: "auto", position: "relative",
                  fontSize: 11.5, lineHeight: 1.5, color: latest ? "#B5E2D4" : "var(--slate)", paddingRight: 4,
                }}>{h.note}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Module documentation cards */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 17 }}>Modules</h3>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>What each module does & where its data comes from</span>
          <div style={{ marginLeft: "auto", minWidth: 220, flex: "0 1 300px" }}>
            <Toolbar q={q} setQ={setQ} placeholder="Search modules…" count={docs.length} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {docs.map(d => {
            const m = MODULES.find(x => x.id === d.id);
            const Icon = (m && MODULE_ICONS[m.icon]) || Info;
            const color = m?.color || "#1E9E4F";
            return (
              <div key={d.id} className="about-doc" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow)", overflow: "hidden" }}>
                <div style={{ height: 4, background: color }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: color + "1a", color, display: "grid", placeItems: "center" }}><Icon size={18} /></div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--f)" }}>{d.label}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--slate)", marginBottom: 8, lineHeight: 1.5 }}>{d.summary}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                    {d.points.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                  {d.source && <div style={{ marginTop: 10, fontSize: 10.5, color: color, background: color + "12", display: "inline-block", padding: "3px 8px", borderRadius: 7, fontFamily: "ui-monospace,monospace", wordBreak: "break-word" }}>{d.source}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {docs.length === 0 && <Empty msg="No modules match." />}
      </div>

      {/* APIs used */}
      <div style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: 17 }}>APIs used</h3>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Every external call this dashboard makes, by source.</div>
        <div style={{ display: "grid", gap: 14 }}>
          {API_USAGE.map(g => (
            <Card key={g.group} pad={false} title={g.group}>
              <Table head={["Method", "Endpoint", "Used for"]}>
                {g.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}><span style={apiMethodBadge(it.m)}>{it.m}</span></td>
                    <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 12, textAlign: "center", wordBreak: "break-all" }}>{it.path}</td>
                    <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{it.use}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
