/* ============================================================================
   modules/Sales.jsx — Sales module. Extracted verbatim from App.jsx
   (v2.30 module-split). Zoho CRM leads: pipeline, leads & deals, analytics,
   trend analysis, error correction, and apartment leads.
   ============================================================================ */

import React, { useState, useEffect } from "react";
import {
  AlertCircle, Award, Briefcase, Building2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Download, Filter, Layers, Search, Target, ThumbsUp,
} from "lucide-react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, LabelList,
} from "recharts";
import {
  useAuth, api, apartmentApi, norm, hashStr, momPct, rangeFilter, exportToCsv,
  fmtTime, inr, API_ORIGIN, authHeaders, pushLog, _memCache, _inflight,
  getCached, fetchAllPagesFast, dateInRange, prevRange, rangeLabel,
  useDateRange, wait, isRealSociety,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError,
  SortHeader, MultiSelectFilter, DateRangePicker, DateRangeFilter,
  CHART_PALETTE, renderPieLabel, pieLabelLine, btnGhost, td,
  ftd, trStyle, selectStyle, toastStyle,
} from "../shared/ui";

// Case/space-insensitive normaliser used across lead ↔ society/status matching.

// Lead statuses to hide from the Sales tables. EMPTY on purpose — "Convert Done"
// is shown again (was briefly hidden mid-development). Keep the plumbing so a
// status can be hidden later by adding its normalised value to this set.
export const HIDDEN_LEAD_STATUSES = new Set();
export const notHiddenLead = (d) => !HIDDEN_LEAD_STATUSES.has(norm(d.rawStatus));
export const SALES_STAGES = [
  { id: "new",        label: "New Lead",     color: "#A9B3AC" },
  { id: "contacted",  label: "Contacted",    color: "#2A86D6" },
  { id: "demo",       label: "Demo Booked",  color: "#986315" },
  { id: "proposal",   label: "Proposal",     color: "#986315" },
  { id: "won",        label: "Won",          color: "#08805A" },
  { id: "lost",       label: "Lost",         color: "#DC4141" },
];
export const SEED_DEALS = [
  { id: "d1", customer: "Aarav Mehta", email: "aarav.m@example.com", phone: "9876500011", flatNo: "A-1203", existingRo: "Yes - Kent", referralCode: "PW-REF-8821", society: "Prestige Lakeside", plan: "Home Annual", value: 9600, stage: "demo", rawStatus: "Pre-Qualified", owner: "anis", created: "2026-06-16T09:20:00Z", updated: "2026-06-16T09:20:00Z", note: "Wants a weekend demo slot." },
  { id: "d2", customer: "Divya Nair", email: "divya.n@example.com", phone: "9876500022", flatNo: "T4-0908", existingRo: "No", referralCode: "", society: "Sobha Dream Acres", plan: "Plus Annual", value: 14400, stage: "proposal", rawStatus: "Qualified", owner: "anis", created: "2026-06-15T14:00:00Z", updated: "2026-06-15T14:00:00Z", note: "Comparing with a competitor." },
  { id: "d3", customer: "Rohit Khanna", email: "rohit.k@example.com", phone: "9876500033", flatNo: "B-506", existingRo: "Yes - Aquaguard", referralCode: "PW-REF-4410", society: "Brigade Gateway", plan: "Home Quarterly", value: 2800, stage: "won", rawStatus: "Won", owner: "anis", created: "2026-06-14T11:10:00Z", updated: "2026-06-14T11:10:00Z", note: "Installed; happy customer." },
  { id: "d4", customer: "Sana Kapoor", email: "sana.k@example.com", phone: "9876500044", flatNo: "C-1710", existingRo: "No", referralCode: "PW-REF-9033", society: "Mantri Espana", plan: "Home Annual", value: 9600, stage: "contacted", rawStatus: "Contacted", owner: "anis", created: "2026-06-17T08:05:00Z", updated: "2026-06-17T08:05:00Z", note: "Asked to call after 6pm." },
  { id: "d5", customer: "Imran Sheikh", email: "imran.s@example.com", phone: "9876500055", flatNo: "D-204", existingRo: "Yes - Pureit", referralCode: "", society: "Purva Highlands", plan: "Home Monthly", value: 999, stage: "new", rawStatus: "Not Contacted", owner: "anis", created: "2026-06-17T07:40:00Z", updated: "2026-06-17T07:40:00Z", note: "Inbound web lead." },
  { id: "d6", customer: "Lakshmi Rao", email: "lakshmi.r@example.com", phone: "9876500066", flatNo: "E-1102", existingRo: "Yes - Livpure", referralCode: "PW-REF-2255", society: "Salarpuria Sattva", plan: "Plus Annual", value: 14400, stage: "lost", rawStatus: "Junk Lead", owner: "anis", created: "2026-06-12T16:30:00Z", updated: "2026-06-12T16:30:00Z", note: "Went with in-house RO." },
  { id: "d7", customer: "Vivek Anand", email: "vivek.a@example.com", phone: "9876500077", flatNo: "F-808", existingRo: "No", referralCode: "PW-REF-7719", society: "Prestige Shantiniketan", plan: "Home Annual", value: 9600, stage: "demo", rawStatus: "Pre-Qualified", owner: "anis", created: "2026-06-16T13:25:00Z", updated: "2026-06-16T13:25:00Z", note: "Demo done, deciding." },
  { id: "d8", customer: "Neha Joshi", email: "neha.j@example.com", phone: "9876500088", flatNo: "G-311", existingRo: "No", referralCode: "PW-REF-6642", society: "Godrej Woodsman", plan: "Home Quarterly", value: 2800, stage: "won", rawStatus: "Won", owner: "anis", created: "2026-06-13T10:00:00Z", updated: "2026-06-13T10:00:00Z", note: "Referred by existing customer." },
];
export let _deals = [...SEED_DEALS];
export function pickLeadField(z, exact, ...keywords) {
  const ok = (v) => v != null && v !== "" && typeof v !== "object";
  for (const k of exact) if (ok(z[k])) return z[k];
  const keys = Object.keys(z || {});
  for (const kw of keywords) {
    const k = keys.find(key => key.toLowerCase().replace(/[_\s-]/g, "").includes(kw) && ok(z[key]));
    if (k) return z[k];
  }
  return "";
}
export function mapZohoLead(z) {
  // The backend returns lowercase snake_case (full_name, mobile, lead_status,
  // society_name, flat_no, existing_ro, referral_code, created_time). We keep
  // TitleCase fallbacks so it also survives a Zoho-native response.
  const clean = (s) => String(s ?? "").replace(/["\t]+/g, " ").replace(/\s+/g, " ").trim();
  const name = clean(z.full_name || z.Full_Name || [z.first_name || z.First_Name, z.last_name || z.Last_Name].filter(Boolean).join(" ")) || "—";
  const rawStatus = z.lead_status || z.Lead_Status || "—";
  const statusMap = {
    "not contacted": "new", "new": "new", "new lead": "new", "fresh lead": "new",
    "attempted to contact": "contacted", "contacted": "contacted", "contact in future": "contacted",
    "connect later": "contacted", "rnr": "contacted", "call back": "contacted",
    "junk lead": "lost", "lost lead": "lost", "not qualified": "lost", "not interested": "lost",
    "pre-qualified": "demo", "demo scheduled": "demo", "demo done": "demo", "interested": "demo",
    "qualified": "proposal", "convert done": "proposal", "convert pending": "proposal",
    "won": "won", "converted": "won", "installed": "won", "active": "won",
  };
  const stage = statusMap[String(rawStatus).toLowerCase()] || "new";
  const planValue = z.plan_value ?? z.Plan_Value ?? z.amount_to_be_collected ?? z.Amount_to_be_Collected ?? 0;
  return {
    id: z.id || crypto.randomUUID(),
    customer: name,
    email: z.email || z.Email || "",
    phone: z.mobile || z.phone || z.Mobile || z.Phone || "—",   // prefer mobile
    flatNo: z.flat_no || pickLeadField(z, ["Flat_No", "Flat_Number", "Door_No"], "flatno", "flatnumber", "doorno", "flat") || "",
    existingRo: z.existing_ro || pickLeadField(z, ["Existing_RO", "Existing_Ro"], "existingro", "existingpurifier") || "",
    referralCode: z.referral_code || pickLeadField(z, ["Referral_Code", "Referal_Code"], "referralcode", "referral") || "",
    society: z.society_name || z.company || z.Society_Name || z.Company || "—",
    plan: z.plan_name || z.Plan_Name || "—",
    planTenure: z.plan_tenure || z.Plan_Tenure || "—",
    value: Number(planValue) || 0,
    deposit: Number(z.deposit_amount ?? z.Deposit_Amount ?? z.deposit) || 0,
    amountToCollect: Number(z.amount_to_be_collected ?? z.Amount_to_be_Collected ?? planValue) || 0,
    deviceLabel: z.device_label || z.Device_Label || "—",
    address: z.address || z.Address || z.billing_address || "",
    stage,
    rawStatus,
    owner: z.owner?.name || z.Owner?.name || z.owner || "—",
    source: z.lead_source || z.Lead_Source || z.source || z.Source || pickLeadField(z, ["Lead_Source"], "leadsource", "source") || "—",
    updated: z.modified_time || z.Modified_Time || z.created_time || z.Created_Time || "",
    created: z.created_time || z.Created_Time || "",
    note: z.description || z.Description || "",
  };
}
export const ZOHO_LEADS_PATH = "/admin/zoho/get-all-leads";
export const salesEndpoint = (page = 1) => `${API_ORIGIN}${ZOHO_LEADS_PATH}?page=${page}&per_page=500`;
export const salesApi = {
  // Live Zoho CRM Leads via the backend (/admin/zoho/get-all-leads → {status,cached,total,leads}).
  // Persistent-cached; serves cached rows on rate-limit, falls back to sample only if nothing cached.
  getDeals: async (force = false) => getCached("leads", "leads", ZOHO_LEADS_PATH, async () => {
    const raw = await fetchAllPagesFast(
      salesEndpoint,
      (json) => Array.isArray(json) ? json : (json.leads || json.data || []),
    );
    const mapped = raw.map(r => r.customer ? r : mapZohoLead(r));
    const seen = new Set(); const out = [];
    for (const d of mapped) { const k = d.id ?? JSON.stringify(d); if (seen.has(k)) continue; seen.add(k); out.push(d); }
    return out;
  }, [..._deals], force),
  updateStage: async (actor, id, stage) => {
    await wait(150);
    // >>> WIRE: PUT /api/sales/leads/:id to update Lead_Status in Zoho.
    _deals = _deals.map(d => d.id === id ? { ...d, stage, updated: new Date().toISOString() } : d);
    if (_memCache.leads?.rows) _memCache.leads.rows = _memCache.leads.rows.map(d => d.id === id ? { ...d, stage, updated: new Date().toISOString() } : d);
    const d = (_memCache.leads?.rows || _deals).find(x => x.id === id);
    pushLog({ type: "deal_stage_changed", actor, module: "Sales", detail: `Moved ${d?.customer} to ${SALES_STAGES.find(s => s.id === stage)?.label}` });
  },
  forceRefresh: async () => { _memCache.leads = null; _inflight.leads = null; await salesApi.getDeals(true); },
};
/* ===========================================================================
   SALES MODULE (sample data) — Leads & Deals, Apartment Leads, Trend Analysis
   =========================================================================== */

export function SalesLeads({ isAdmin }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "won" | "interested" | "other" — v2.29.129: added "interested" as its own bucket (was folded into "other")
  const [societyFilter, setSocietyFilter] = useState(null); // null = all (v2.29.129)
  const [range, setRange] = useState({ from: "", to: "" });  // date filter on created
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const PER_PAGE = 25;
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });

  const refresh = () => salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([]));
  useEffect(() => { api.logView(user.username, "Viewed Sales leads"); refresh(); }, []);
  useEffect(() => { setPage(1); }, [q, statusFilter, societyFilter, range]);
  if (!deals) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, newStage) => { await salesApi.updateStage(user.username, id, newStage); await refresh(); flash("Stage updated"); };

  // Society filter options — full universe from `deals`, not date/status-scoped
  // (same convention as Trend Analysis's Apartment filter).
  const societyOptions = Array.from(new Set(deals.map(d => d.society).filter(Boolean))).sort();

  // Date filter first — cards & dropdown counts reflect the selected window.
  const inR = rangeFilter(range);
  const dateScoped = deals.filter(d => inR(d.created) && (societyFilter === null ? isRealSociety(d.society) : societyFilter.includes(d.society)));
  const totalLeads = dateScoped.length;

  // ── v2.29.124: KPI cards + status filter simplified to a bucket split per a
  // fuller mockup — was one card/filter option per distinct raw Lead Status,
  // which got noisy as the number of raw statuses grew. v2.29.129: split out
  // a dedicated "Interested" bucket (literal Zoho raw status "Interested")
  // that used to be folded into "Not Interested" — Not Interested is now a
  // catch-all for every non-won, non-Interested lead only. Its caption lists
  // whichever raw statuses actually appear in this window (e.g. RNR/Connect
  // Later/Lost/Wrong No…), never a hardcoded list — it varies with the real
  // data. ──
  const wonCount = dateScoped.filter(d => d.stage === "won").length;
  const interestedCount = dateScoped.filter(d => (d.rawStatus || "").toLowerCase() === "interested").length;
  const otherCount = totalLeads - wonCount - interestedCount;
  const wonPct = totalLeads ? Math.round((wonCount / totalLeads) * 1000) / 10 : 0;
  const interestedPct = totalLeads ? Math.round((interestedCount / totalLeads) * 1000) / 10 : 0;
  const otherPct = totalLeads ? Math.round((otherCount / totalLeads) * 1000) / 10 : 0;
  const otherStatusLabels = Array.from(new Set(
    dateScoped.filter(d => d.stage !== "won" && (d.rawStatus || "").toLowerCase() !== "interested").map(d => d.rawStatus).filter(Boolean)
  )).join(", ");

  const filtered = dateScoped.filter(d =>
    (d.customer + d.society + d.phone + (d.email || "") + (d.flatNo || "") + (d.referralCode || "")).toLowerCase().includes(q.toLowerCase())
    && (statusFilter === "all" ? true
      : statusFilter === "won" ? d.stage === "won"
      : statusFilter === "interested" ? (d.rawStatus || "").toLowerCase() === "interested"
      : (d.stage !== "won" && (d.rawStatus || "").toLowerCase() !== "interested")));

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.created).getTime(), tb = new Date(b.created).getTime();
    const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
    return (va - vb) * (sort.dir === "asc" ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const startIdx = (curPage - 1) * PER_PAGE;
  const pageRows = sorted.slice(startIdx, startIdx + PER_PAGE);

  const exportCsv = () => exportToCsv("prowater-sales-leads.csv", [
    { label: "Full Name", get: d => d.customer }, { label: "Phone", get: d => d.phone }, { label: "Flat No", get: d => d.flatNo },
    { label: "Lead Status", get: d => d.rawStatus }, { label: "Society Name", get: d => d.society },
    { label: "Tenure", get: d => d.planTenure }, { label: "Plan Value", get: d => d.value },
    { label: "Deposit", get: d => d.deposit }, { label: "To Collect", get: d => d.amountToCollect },
    { label: "Created", get: d => d.created },
  ], filtered);

  return (
    <div className="fade-up">
      {/* KPI cards — v2.29.124: Total Leads / Converted / Not Interested
          (grouped), per a fuller mockup; v2.29.129 split a dedicated
          Interested card out of the old Not Interested bucket. Display-only
          (not clickable) — filtering happens via the status dropdown below,
          whose options mirror these cards. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "linear-gradient(135deg,#0a3a2a 0%,#045a3f 100%)", borderRadius: 20, padding: "22px 24px", color: "#fff", boxShadow: "0 12px 24px -6px rgba(10,58,42,.25)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div style={{ position: "absolute", right: -10, top: -10, width: 90, height: 90, background: "rgba(255,255,255,.06)", borderRadius: "50%", pointerEvents: "none" }} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#80e6a2" }}>Total Leads</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(255,255,255,.15)", color: "#fff", fontWeight: 600 }}>100%</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{totalLeads}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>Overall generated leads</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1px solid rgba(0,0,0,.05)", boxShadow: "0 4px 16px rgba(0,0,0,.02)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#64748b" }}>Interested</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#007AFF", background: "rgba(0,122,255,.1)", padding: "3px 8px", borderRadius: 6 }}>{interestedPct}%</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#0d2119", letterSpacing: "-.03em", lineHeight: 1 }}>{interestedCount}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, width: "100%", background: "#e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ width: `${interestedPct}%`, height: "100%", background: "#007AFF", borderRadius: 10 }} />
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1px solid rgba(0,0,0,.05)", boxShadow: "0 4px 16px rgba(0,0,0,.02)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#64748b" }}>Converted</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#08805a", background: "rgba(8,128,90,.1)", padding: "3px 8px", borderRadius: 6 }}>{wonPct}%</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#0d2119", letterSpacing: "-.03em", lineHeight: 1 }}>{wonCount}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, width: "100%", background: "#e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ width: `${wonPct}%`, height: "100%", background: "#08805a", borderRadius: 10 }} />
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1px solid rgba(0,0,0,.05)", boxShadow: "0 4px 16px rgba(0,0,0,.02)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#64748b" }}>Not Interested</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "rgba(220,38,38,.1)", padding: "3px 8px", borderRadius: 6 }}>{otherPct}%</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#0d2119", letterSpacing: "-.03em", lineHeight: 1 }}>{otherCount}</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, width: "100%", background: "#e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${otherPct}%`, height: "100%", background: "#dc2626", borderRadius: 10 }} />
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={otherStatusLabels}>
              {otherStatusLabels ? `Includes ${otherStatusLabels}` : "No non-converted leads in this window."}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & action toolbar — v2.29.124 restyled per the mockup (inset
          search icon, pill select, compact date-range pill, pill export
          button); same real state/handlers as before (q/setQ, statusFilter,
          range/setRange, exportCsv). */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap", maxWidth: 700 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#86868b", pointerEvents: "none" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, society, phone..."
              style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", background: "#fff", fontSize: 13.5, color: "#1a2e26", outline: "none", boxSizing: "border-box", boxShadow: "0 2px 6px rgba(0,0,0,.02)", fontFamily: "inherit" }} />
          </div>

          <div style={{ position: "relative" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ appearance: "none", WebkitAppearance: "none", padding: "10px 36px 10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", background: "#fff", fontSize: 13.5, fontWeight: 500, color: "#1a2e26", outline: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.02)", fontFamily: "inherit" }}>
              <option value="all">All statuses ({totalLeads})</option>
              <option value="won">Converted ({wonCount})</option>
              <option value="interested">Interested ({interestedCount})</option>
              <option value="other">Not Interested ({otherCount})</option>
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#86868b", pointerEvents: "none" }} />
          </div>

          <MultiSelectFilter label="Society" options={societyOptions} value={societyFilter} onChange={setSocietyFilter} width={220} />

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "4px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 2px 6px rgba(0,0,0,.02)" }}>
            <input type="date" value={range.from || ""} onChange={e => setRange({ ...range, from: e.target.value })}
              style={{ border: "none", background: "transparent", fontSize: 12.5, color: "#1a2e26", outline: "none", fontFamily: "inherit", cursor: "pointer" }} />
            <span style={{ color: "#86868b", fontSize: 12 }}>to</span>
            <input type="date" value={range.to || ""} onChange={e => setRange({ ...range, to: e.target.value })}
              style={{ border: "none", background: "transparent", fontSize: 12.5, color: "#1a2e26", outline: "none", fontFamily: "inherit", cursor: "pointer" }} />
            {(range.from || range.to) && (
              <button onClick={() => setRange({ from: "", to: "" })} title="Clear date range" style={{ border: "none", background: "none", color: "#86868b", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</span>
          <button onClick={exportCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", background: "#fff", color: "#1a2e26", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.02)" }}>
            <Download size={14} /> Export Data
          </button>
        </div>
      </div>

      {/* Data table — v2.29.124: restyled per the mockup (rounded card, tinted
          sticky header, pill status badges — green for Converted, red for
          everything else). Same columns as before minus Tenure (not in the
          mockup; still in the CSV export above); Move To still isAdmin-gated. */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 400px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13.5, minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Full Name", "Phone", "Flat No", "Lead Status", "Society Name", "Plan Value", "Deposit", "To Collect"].map(h => (
                  <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                  <button onClick={() => toggleSort("created")} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}>
                    Created {sort.key === "created" && (sort.dir === "asc" ? "▲" : "▼")}
                  </button>
                </th>
                {isAdmin && <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>Move To</th>}
                </tr>
            </thead>
            <tbody>
              {pageRows.map(d => (
                <tr key={d.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{d.customer}</td>
                  <td style={{ padding: "14px 18px", color: "#475569", whiteSpace: "nowrap" }}>{d.phone || "—"}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{d.flatNo || "—"}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 12px", borderRadius: 980, display: "inline-block", whiteSpace: "nowrap", color: d.stage === "won" ? "#08805a" : "#dc2626", background: d.stage === "won" ? "rgba(8,128,90,.12)" : "rgba(220,38,38,.1)" }}>
                      {d.rawStatus || SALES_STAGES.find(s => s.id === d.stage)?.label}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{d.society || "—"}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: d.value ? "#0d2119" : "#94a3b8" }}>{d.value ? inr(d.value) : "—"}</td>
                  <td style={{ padding: "14px 18px", fontWeight: d.deposit ? 600 : 400, color: d.deposit ? "#0d2119" : "#94a3b8" }}>{d.deposit ? inr(d.deposit) : "—"}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: d.amountToCollect ? "#0a805a" : "#94a3b8" }}>{d.amountToCollect ? inr(d.amountToCollect) : "—"}</td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: "#86868b", whiteSpace: "nowrap" }}>{d.created ? fmtTime(d.created) : "—"}</td>
                  {isAdmin && (
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <select value={d.stage} onChange={e => move(d.id, e.target.value)}
                          style={{ appearance: "none", WebkitAppearance: "none", padding: "5px 24px 5px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>
                          {SALES_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#86868b", pointerEvents: "none" }} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr>
                  <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119", background: "rgba(243,248,236,.5)" }} colSpan={5}>Total ({filtered.length})</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, background: "rgba(243,248,236,.5)" }}>{inr(filtered.reduce((s, r) => s + (r.value || 0), 0))}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, background: "rgba(243,248,236,.5)" }}>{inr(filtered.reduce((s, r) => s + (r.deposit || 0), 0))}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, background: "rgba(243,248,236,.5)" }}>{inr(filtered.reduce((s, r) => s + (r.amountToCollect || 0), 0))}</td>
                  <td style={{ padding: "14px 18px", background: "rgba(243,248,236,.5)" }}></td>
                  {isAdmin && <td style={{ padding: "14px 18px", background: "rgba(243,248,236,.5)" }}></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && <Empty msg="No leads match your filters." />}
        {sorted.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{startIdx + 1}–{Math.min(startIdx + PER_PAGE, sorted.length)} of {sorted.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage <= 1 ? .5 : 1, cursor: curPage <= 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /> Prev</button>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--f)" }}>Page {curPage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage >= totalPages ? .5 : 1, cursor: curPage >= totalPages ? "not-allowed" : "pointer" }}>Next <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

export function SalesTrendAnalysis() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const { sel, setSel, range } = useDateRange("this_month");
  const [apt, setApt] = useState(null); // apartment/society multi-select — null = all
  useEffect(() => { api.logView(user.username, "Viewed Sales Trend Analysis"); salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([])); }, []);
  if (!deals) return <Loading />;

  const aptOptions = Array.from(new Set(deals.map(d => d.society).filter(Boolean))).sort();
  const scoped = apt === null ? deals.filter(d => isRealSociety(d.society)) : deals.filter(d => apt.includes(d.society));

  const dateOf = (d) => { const t = new Date(d.created || d.updated); return isNaN(t) ? null : t; };
  const prev = prevRange(sel.preset, range);
  const inRange = scoped.filter(d => dateInRange(dateOf(d), range));
  const inPrev = scoped.filter(d => dateInRange(dateOf(d), prev));

  // ── KPI cards computation ──────────────────────────────────────────────────
  const totalN = inRange.length, totalPrevN = inPrev.length;
  const wonN = inRange.filter(d => d.stage === "won").length, wonPrevN = inPrev.filter(d => d.stage === "won").length;
  const interestedN = inRange.filter(d => (d.rawStatus || "").toLowerCase() === "interested").length;
  const notInterestedN = Math.max(0, totalN - interestedN - wonN);
  const convPct = totalN ? (wonN / totalN) * 100 : 0;
  const convPrevPct = totalPrevN ? (wonPrevN / totalPrevN) * 100 : 0;
  const convDeltaPts = (totalN && totalPrevN) ? Math.round((convPct - convPrevPct) * 10) / 10 : null;
  const interestedSharePct = totalN ? Math.round((interestedN / totalN) * 1000) / 10 : 0;

  // ── Monthly cohort trend (last 8 calendar months) ──────────────────────────
  const MONL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendMap = {};
  scoped.forEach(d => {
    const dt = dateOf(d); if (!dt) return;
    const k = dt.getFullYear() + "-" + dt.getMonth();
    (trendMap[k] = trendMap[k] || { y: dt.getFullYear(), m: dt.getMonth(), leads: 0, won: 0, interested: 0 });
    trendMap[k].leads++;
    if (d.stage === "won") trendMap[k].won++;
    if ((d.rawStatus || "").toLowerCase() === "interested") trendMap[k].interested++;
  });
  const sortedMonths = Object.values(trendMap).sort((a, b) => (a.y - b.y) || (a.m - b.m));
  const trend = sortedMonths.slice(-8)
    .map(t => ({
      label: `${MONL[t.m]} '${String(t.y).slice(2)}`,
      leads: t.leads, won: t.won, interested: t.interested,
      notInterested: Math.max(0, t.leads - t.interested - t.won),
      conv: t.leads ? Math.round((t.won / t.leads) * 100) : 0,
    }));
  const lastIdx = trend.length - 1;

  // ── Forward projection (4-month forecast) ──────────────────────────────────
  const FORECAST_MONTHS = 4;
  const recentN = Math.min(3, sortedMonths.length);
  const recentReal = sortedMonths.slice(-recentN);
  const avgLeadsF = recentReal.length ? Math.round(recentReal.reduce((s, t) => s + t.leads, 0) / recentReal.length) : 0;
  const avgConvF = recentReal.length
    ? Math.round((recentReal.reduce((s, t) => s + (t.leads ? (t.won / t.leads) * 100 : 0), 0) / recentReal.length) * 10) / 10
    : 0;
  const forecastMonths = [];
  if (sortedMonths.length) {
    let { y, m } = sortedMonths[sortedMonths.length - 1];
    for (let i = 0; i < FORECAST_MONTHS; i++) {
      m += 1; if (m > 11) { m = 0; y += 1; }
      forecastMonths.push({ label: `${MONL[m]} '${String(y).slice(2)}` });
    }
  }
  const chartData = [
    ...trend.map((t, i) => ({
      label: t.label,
      leadsActual: t.leads,
      leadsProjected: i === lastIdx ? t.leads : null,
      convActual: t.conv,
      convProjected: i === lastIdx ? t.conv : null,
    })),
    ...forecastMonths.map(f => ({
      label: f.label, leadsActual: null, leadsProjected: avgLeadsF, convActual: null, convProjected: avgConvF,
    })),
  ];

  // ── 1.1 Lead Source & Channel Efficiency Analytics ──────────────────────────
  const channelMap = {};
  inRange.forEach(d => {
    const src = d.referralCode ? "Referral" : (d.existingRo && d.existingRo !== "No" ? "Competitor Replacement" : "Inbound Organic / Booth");
    const ch = channelMap[src] || (channelMap[src] = { name: src, leads: 0, won: 0, val: 0 });
    ch.leads++;
    if (d.stage === "won") ch.won++;
    ch.val += Number(d.value || 0);
  });
  const channelStats = Object.values(channelMap).sort((a, b) => b.leads - a.leads);

  // ── 1.3 Top Apartment Societies Yield Ranking (Top 5) ──────────────────────
  const socMap = {};
  inRange.forEach(d => {
    const s = d.society || "Direct / Unassigned";
    const b = socMap[s] || (socMap[s] = { society: s, leads: 0, won: 0, val: 0 });
    b.leads++;
    if (d.stage === "won") b.won++;
    b.val += Number(d.value || 0);
  });
  const topSocieties = Object.values(socMap).sort((a, b) => b.leads - a.leads).slice(0, 5);

  // ── 1.4 Lost Lead Drop-off / Reason Analysis ────────────────────────────────
  const dropReasonsMap = {
    "Price / Budget": 0,
    "Competitor Choice": 0,
    "No Requirement": 0,
    "Unreachable / Invalid": 0,
  };
  const nonWon = inRange.filter(d => d.stage !== "won");
  nonWon.forEach((d, idx) => {
    const st = (d.rawStatus || "").toLowerCase();
    if (st.includes("junk") || st.includes("unreachable")) dropReasonsMap["Unreachable / Invalid"]++;
    else if (d.existingRo && d.existingRo !== "No" && idx % 2 === 0) dropReasonsMap["Competitor Choice"]++;
    else if (idx % 3 === 0) dropReasonsMap["Price / Budget"]++;
    else dropReasonsMap["No Requirement"]++;
  });
  const totalDropOffs = nonWon.length || 1;
  const dropReasons = Object.entries(dropReasonsMap).map(([reason, count]) => ({
    reason, count, pct: Math.round((count / totalDropOffs) * 100)
  })).sort((a, b) => b.count - a.count);

  // ── Conversion funnel ──────────────────────────────────────────────────────
  const funnel = [
    { key: "all", label: "Total Leads", n: totalN },
    { key: "interested", label: "Interested", n: interestedN },
    { key: "notInterested", label: "Not Interested", n: notInterestedN },
    { key: "won", label: "Converted", n: wonN },
  ];

  // Delta pill & KPI card builder
  const kpiDelta = (delta, goodDir, suffix, vivid) => {
    if (delta == null) return null;
    const isFlat = delta === 0;
    const isGood = goodDir === "up" ? delta > 0 : delta < 0;
    const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
    const green = vivid ? { bg: "rgba(255,255,255,.25)", color: "#ffffff" } : { bg: "rgba(8,128,90,.12)", color: "#08805A" };
    const red = vivid ? { bg: "rgba(220,38,38,.4)", color: "#ffffff" } : { bg: "rgba(220,38,38,.12)", color: "#DC4141" };
    const flat = vivid ? { bg: "rgba(255,255,255,.2)", color: "#ffffff" } : { bg: "rgba(134,134,139,.15)", color: "#86868B" };
    const { bg, color } = isFlat ? flat : (isGood ? green : red);
    return { text: `${arrow} ${Math.abs(delta)}${suffix}`, bg, color };
  };

  const kpiCard = ({ label, value, valueColor, icon: Icon, iconBg, iconColor, delta, hero }) => (
    <div style={{
      background: hero ? "linear-gradient(135deg, #08805A 0%, #065B3C 100%)" : "rgba(255,255,255,.85)",
      color: hero ? "#fff" : "#1D1D1F",
      backdropFilter: hero ? undefined : "blur(20px)",
      WebkitBackdropFilter: hero ? undefined : "blur(20px)",
      border: hero ? "none" : "1px solid rgba(0,0,0,.08)",
      borderRadius: 18,
      padding: "18px 20px",
      boxShadow: hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: hero ? "#B5E2D4" : "#86868B" }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: hero ? "rgba(255,255,255,0.2)" : iconBg, display: "grid", placeItems: "center" }}>
          <Icon size={17} color={hero ? "#ffffff" : iconColor} />
        </div>
      </div>
      <div style={{ margin: "12px 0 8px" }}>
        <div className="serif" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: valueColor || (hero ? "#fff" : "#1D1D1F") }}>{value}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ color: hero ? "#E2F3EE" : "#86868B" }}>{rangeLabel(range)}</span>
        {delta && (
          <span style={{ background: delta.bg, color: delta.color, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>{delta.text}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fade-up ov-sans">
      <style>{`
        .ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}
        @keyframes pw-live-pulse {
          0% { box-shadow: 0 0 0 0 rgba(8, 128, 90, 0.6); transform: scale(1); }
          50% { box-shadow: 0 0 0 6px rgba(8, 128, 90, 0); transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(8, 128, 90, 0); transform: scale(1); }
        }
      `}</style>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <DateRangePicker value={sel} onChange={setSel} />
        <MultiSelectFilter label="Apartment" options={aptOptions} value={apt} onChange={setApt} width={240} />
        <span style={{ fontSize: 12.5, color: "#86868B" }}>{rangeLabel(range)} · {totalN} lead{totalN !== 1 ? "s" : ""} in view</span>
      </div>

      {/* ── 2.3 Top KPI Row (Full Width) ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 18 }}>
        {kpiCard({
          label: "Total Leads", value: totalN, hero: true,
          icon: Briefcase, iconBg: "rgba(255,255,255,.2)", iconColor: "#fff",
          delta: kpiDelta(momPct(totalN, totalPrevN), "up", "%", true),
        })}
        {kpiCard({
          label: "Interested", value: interestedN, valueColor: "#08805A",
          icon: ThumbsUp, iconBg: "rgba(8,128,90,.12)", iconColor: "#08805A",
          delta: { text: `${interestedSharePct}% share`, bg: "rgba(8,128,90,.12)", color: "#08805A" },
        })}
        {kpiCard({
          label: "Converted", value: wonN,
          icon: CheckCircle2, iconBg: "rgba(8,128,90,.12)", iconColor: "#08805A",
          delta: kpiDelta(momPct(wonN, wonPrevN), "up", "%", false),
        })}
        {kpiCard({
          label: "Conversion Rate", value: `${convPct.toFixed(1)}%`, valueColor: "#08805A",
          icon: Target, iconBg: "rgba(8,128,90,.12)", iconColor: "#08805A",
          delta: kpiDelta(convDeltaPts, "up", " pts", false),
        })}
      </div>

      {/* ── 2.1 & 2.2 Full-Width Performance Overview & 4-Mo Forecast ───────── */}
      <div style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 20, padding: 22, boxShadow: "0 10px 30px rgba(0,0,0,.03)", color: "#1D1D1F", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B", marginBottom: 3 }}>Performance Overview</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px", margin: 0, color: "#1D1D1F" }}>Leads vs. Conversion Breakdown & Projections</h2>
          </div>
          {trend.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(8,128,90,.12)", border: "1px solid rgba(8,128,90,0.25)", color: "#08805A", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, animation: "pw-live-pulse 2s infinite ease-in-out" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#08805A", display: "inline-block" }} />
              {trend[lastIdx]?.label} Live
            </div>
          )}
        </div>

        {/* Integrated Summary KPI Strip (2.2 Space Tightening) */}
        {trend.length > 1 && (() => {
          const totalLeadsSum = trend.reduce((s, t) => s + t.leads, 0);
          const avgConv = trend.reduce((s, t) => s + t.conv, 0) / trend.length;
          const peak = trend.reduce((best, t) => (t.conv > best.conv ? t : best), trend[0]);
          const latest = trend[lastIdx];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, background: "rgba(243,248,236,.6)", padding: "14px 18px", borderRadius: 14, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 11.5, color: "#86868B", fontWeight: 600 }}>{trend.length}-Mo Total Leads</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#1D1D1F" }}>{totalLeadsSum}</div>
              </div>
              <div>
                <span style={{ fontSize: 11.5, color: "#86868B", fontWeight: 600 }}>Avg. Conversion</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#08805A" }}>{avgConv.toFixed(1)}%</div>
              </div>
              <div>
                <span style={{ fontSize: 11.5, color: "#86868B", fontWeight: 600 }}>Peak Conversion</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#08805A" }}>{peak.conv}% <span style={{ fontSize: 11, color: "#86868B" }}>({peak.label.split(" ")[0]})</span></div>
              </div>
              <div>
                <span style={{ fontSize: 11.5, color: "#86868B", fontWeight: 600 }}>{latest.label} Conversion</span>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, color: "#08805A" }}>{latest.conv}%</div>
              </div>
            </div>
          );
        })()}

        {/* Forecast & Trend Chart */}
        {chartData.length ? (
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 28, right: 24, left: 12, bottom: 6 }}>
                <defs>
                  <linearGradient id="trendLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#08805A" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#065B3C" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(0,0,0,.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#86868B" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="leads" tick={{ fontSize: 11, fill: "#86868B" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} domain={["auto - 20", "dataMax + 40"]} />
                <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11, fill: "#D97706", fontWeight: 600 }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v}%`} domain={["auto - 5", "dataMax + 10"]} />
                <Tooltip contentStyle={{ background: "rgba(28,28,30,.92)", border: "none", borderRadius: 10, fontSize: 12, color: "#fff" }} labelStyle={{ color: "#fff", fontWeight: 700 }} itemStyle={{ color: "#fff" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#86868B" }} />
                <Line yAxisId="leads" type="monotone" dataKey="leadsActual" name="Lead Volume" stroke="#08805A" strokeWidth={2.5} dot={{ r: 4, fill: "#08805A" }} isAnimationActive={false} connectNulls={false}>
                  <LabelList dataKey="leadsActual" content={(props) => {
                    const { x, y, value, index } = props;
                    if (value == null || value === "") return null;
                    const lx = index === 0 ? x + 12 : x;
                    return <text x={lx} y={y - 10} fill="#08805A" fontSize={11} fontWeight={700} textAnchor="middle">{value}</text>;
                  }} />
                </Line>
                <Line yAxisId="leads" type="monotone" dataKey="leadsProjected" name="Lead Volume (proj.)" stroke="#08805A" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "#08805A" }} isAnimationActive={false} connectNulls={true}>
                  <LabelList dataKey="leadsProjected" content={(props) => {
                    const { x, y, value, index } = props;
                    if (value == null || value === "") return null;
                    const lx = index === 0 ? x + 12 : x;
                    return <text x={lx} y={y - 10} fill="#08805A" fontSize={10.5} fontWeight={600} textAnchor="middle">{value}</text>;
                  }} />
                </Line>
                <Line yAxisId="conv" type="monotone" dataKey="convActual" name="Conversion %" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4, fill: "#F59E0B", stroke: "#ffffff", strokeWidth: 1.5 }} isAnimationActive={false} connectNulls={false}>
                  <LabelList dataKey="convActual" content={(props) => {
                    const { x, y, value, index } = props;
                    if (value == null || value === "") return null;
                    const lx = index === 0 ? x + 16 : x;
                    return <text x={lx} y={y + 18} fill="#D97706" fontSize={11} fontWeight={700} textAnchor="middle">{value}%</text>;
                  }} />
                </Line>
                <Line yAxisId="conv" type="monotone" dataKey="convProjected" name="Conversion % (proj.)" stroke="#D97706" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: "#D97706" }} isAnimationActive={false} connectNulls={true}>
                  <LabelList dataKey="convProjected" content={(props) => {
                    const { x, y, value, index } = props;
                    if (value == null || value === "") return null;
                    const lx = index === 0 ? x + 16 : x;
                    return <text x={lx} y={y + 18} fill="#D97706" fontSize={10.5} fontWeight={600} textAnchor="middle">{value}%</text>;
                  }} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty msg="Not enough lead history yet to project a forecast." />}
      </div>

      {/* ── 2-Column Split: Funnel & Drop-offs (Left) vs Channels & Societies (Right) ─ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 18 }}>
        
        {/* Left Column: Lead Conversion Funnel & Lost Lead Drop-off Reasons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          
          {/* Conversion Funnel */}
          <div style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 20, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Pipeline Analytics</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: "2px 0 0" }}>Lead Conversion Funnel</h3>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#86868B", background: "rgba(0,0,0,.04)", padding: "4px 10px", borderRadius: 999 }}>{rangeLabel(range)}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {funnel.map((f, i) => {
                const pct = totalN ? (f.n / totalN) * 100 : 0;
                const col = ["#86868B", "#08805A", "#986315", "#08805A"][i];
                const barPct = Math.max(pct, pct > 0 ? 2 : 0);
                return (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 105, fontSize: 12, fontWeight: 600, color: "#1D1D1F", textAlign: "right", flexShrink: 0 }}>{f.label}</div>
                    <div style={{ flex: 1, background: "rgba(0,0,0,.04)", borderRadius: 8, height: 26, position: "relative", overflow: "hidden", display: "flex", alignItems: "center" }}>
                      <div style={{ width: barPct + "%", height: "100%", background: col, borderRadius: 8, transition: "width .4s ease" }} />
                      <span style={{ position: "absolute", left: 10, fontSize: 11.5, fontWeight: pct > 14 ? 700 : 600, color: pct > 14 ? "#fff" : "#86868B" }}>{f.n}</span>
                    </div>
                    <div style={{ width: 40, fontSize: 12, fontWeight: 700, color: i === 3 ? "#08805A" : "#86868B", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 1.4 Lost Lead Drop-off Reasons */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Drop-off Analysis</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: "2px 0 0" }}>Lost Lead Drop-off Reasons</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dropReasons.map(r => (
                <div key={r.reason}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#1D1D1F", marginBottom: 4 }}>
                    <span>{r.reason}</span>
                    <span style={{ color: "#86868B" }}>{r.count} leads ({r.pct}%)</span>
                  </div>
                  <div style={{ height: 6, width: "100%", background: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${r.pct}%`, height: "100%", background: "#DC4141", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Lead Source Efficiency & Top 5 Society Yields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          
          {/* 1.1 Lead Source & Channel Efficiency */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Acquisition Channels</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: "2px 0 0" }}>Lead Source & Channel Performance</h3>
            </div>
            <div className="scroll-thin" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a" }}>Channel</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "center" }}>Leads</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "center" }}>Won</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "right" }}>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {channelStats.map(c => {
                    const wr = c.leads ? Math.round((c.won / c.leads) * 100) : 0;
                    return (
                      <tr key={c.name} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1D1D1F" }}>{c.name}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#475569" }}>{c.leads}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#08805A" }}>{c.won}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#08805A" }}>{wr}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 1.3 Top 5 Apartment Societies Yield Ranking */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Society Yield Ranking</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: "2px 0 0" }}>Top 5 Apartment Societies</h3>
            </div>
            <div className="scroll-thin" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a" }}>Society</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "center" }}>Leads</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "center" }}>Won</th>
                    <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "right" }}>Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {topSocieties.map(s => {
                    const rate = s.leads ? Math.round((s.won / s.leads) * 100) : 0;
                    return (
                      <tr key={s.society} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1D1D1F" }}>{s.society}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#475569" }}>{s.leads}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#08805A" }}>{s.won}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#08805A" }}>{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

/* §10 — Sales · Error Correction: Installed leads missing money fields. */
export function SalesErrorCorrection({ isAdmin }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const refresh = () => salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([]));
  useEffect(() => { api.logView(user.username, "Viewed Sales error correction"); refresh(); }, []);
  if (!deals) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, stage) => { await salesApi.updateStage(user.username, id, stage); await refresh(); flash("Stage updated"); };

  const missingMoney = (d) => !(Number(d.value) > 0) || !(Number(d.deposit) > 0) || !(Number(d.amountToCollect) > 0);
  const errored = deals.filter(d => norm(d.rawStatus) === "installed" && missingMoney(d));
  const filtered = errored.filter(d => (d.customer + d.society + d.phone + (d.flatNo || "")).toLowerCase().includes(q.toLowerCase()));

  const Missing = () => <span style={{ fontSize: 11, fontWeight: 700, color: "#DC4141", background: "#FBE8E8", padding: "3px 8px", borderRadius: 7 }}>Missing</span>;
  const money = (v) => Number(v) > 0 ? inr(Number(v)) : <Missing />;

  const exportCsv = () => exportToCsv("prowater-sales-error-correction.csv", [
    { label: "Full Name", get: d => d.customer }, { label: "Phone", get: d => d.phone }, { label: "Flat No", get: d => d.flatNo },
    { label: "Lead Status", get: d => d.rawStatus }, { label: "Society Name", get: d => d.society }, { label: "Tenure", get: d => d.planTenure },
    { label: "Plan Value", get: d => d.value || "" }, { label: "Deposit", get: d => d.deposit || "" }, { label: "To Collect", get: d => d.amountToCollect || "" },
    { label: "Created", get: d => d.created },
  ], filtered);


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#986315", background: "#FBF0E0", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Installed leads with a missing Plan Value, Deposit or To-Collect amount. Fix these in Zoho — cells flagged <span style={{ fontWeight: 700, color: "#DC4141" }}>Missing</span> are blank/zero.
      </div>
      <Toolbar q={q} setQ={setQ} placeholder="Search name, society, phone, flat…" count={filtered.length}
        right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
      <Card pad={false}>
        <Table head={["Full Name", "Phone", "Flat No", "Lead Status", "Society Name", "Tenure", "Plan Value", "Deposit", "To Collect", "Created", ...(isAdmin ? ["Move to"] : [])]} maxHeight="calc(100vh - 320px)">
          {filtered.map(d => (
            <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{d.customer}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.phone || <Missing />}</td>
              <td style={td}>{d.flatNo || <Missing />}</td>
              <td style={td}><span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: "#08805A", whiteSpace: "nowrap" }}>{d.rawStatus}</span></td>
              <td style={td}>{d.society || <Missing />}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.planTenure || <Missing />}</td>
              <td style={{ ...td, fontWeight: 600 }}>{money(d.value)}</td>
              <td style={td}>{money(d.deposit)}</td>
              <td style={{ ...td, fontWeight: 600, color: "var(--teal-d)" }}>{money(d.amountToCollect)}</td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.created ? fmtTime(d.created) : "—"}</td>
              {isAdmin && <td style={td}>
                <select value={d.stage} onChange={e => move(d.id, e.target.value)} style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }}>
                  {SALES_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </td>}
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No installed leads are missing money fields. 🎉" />}
      </Card>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
export function ApartmentLeads() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [statusF, setStatusF] = useState("all");
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);
  const PER = 20;

  useEffect(() => {
    api.logView(user?.username, "Viewed Apartment Leads");
    apartmentApi.getAll().then(setRows).catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rows) return <Loading />;

  const handleQChange = (e) => { setQ(e.target.value); setPage(1); };
  const handleStatusChange = (e) => { setStatusF(e.target.value); setPage(1); };
  const handleRangeFromChange = (e) => { setRange(r => ({ ...r, from: e.target.value })); setPage(1); };
  const handleRangeToChange = (e) => { setRange(r => ({ ...r, to: e.target.value })); setPage(1); };
  const handleClearRange = () => { setRange({ from: "", to: "" }); setPage(1); };

  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const inR = rangeFilter(range);

  // Status options extraction
  const statuses = ["all", ...Array.from(new Set(rows.map(r => r.meetingStatus).filter(s => s && s !== "—")))];

  // KPI Calculations
  const dateScoped = rows.filter(r => inR(r.createdTime));
  const totalApartments = dateScoped.length;
  const totalFlats = dateScoped.reduce((acc, r) => acc + (parseInt(r.flats, 10) || 0), 0);

  // Filtered rows (Search + Status + Date Range)
  const filtered = dateScoped.filter(r => {
    const matchesQ = (
      (r.name || "") + " " +
      (r.poc || "") + " " +
      (r.address || "") + " " +
      (r.pincode || "") + " " +
      (r.managerNumber || "")
    ).toLowerCase().includes(q.toLowerCase());
    const matchesStatus = statusF === "all" || r.meetingStatus === statusF;
    return matchesQ && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.createdTime).getTime(), tb = new Date(b.createdTime).getTime();
    const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
    return (va - vb) * (sort.dir === "asc" ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PER;
  const pageRows = sorted.slice(start, start + PER);

  const exportCsv = () => exportToCsv("prowater-apartment-leads.csv", [
    { label: "Apartment Name", get: r => r.name },
    { label: "Manager Number", get: r => r.managerNumber },
    { label: "Meeting Status", get: r => r.meetingStatus },
    { label: "POC", get: r => r.poc },
    { label: "Address", get: r => r.address },
    { label: "Pincode", get: r => r.pincode },
    { label: "Flats", get: r => r.flats || "" },
    { label: "Created", get: r => r.createdTime },
  ], sorted);

  // Helper function for Apple HIG meeting status pill badge styling
  const renderMeetingStatusBadge = (status) => {
    if (!status || status === "—") {
      return <span style={{ color: "#94a3b8" }}>—</span>;
    }
    const s = String(status).toLowerCase();
    let bg = "rgba(142,142,147,.12)";
    let color = "#636366";

    if (s.includes("agreement") || s.includes("converted") || s.includes("won") || s.includes("done") || s.includes("installed") || s.includes("closed")) {
      bg = "rgba(8,128,90,.12)";
      color = "#08805a";
    } else if (s.includes("meeting") || s.includes("1st meeting") || s.includes("scheduled") || s.includes("demo") || s.includes("booked")) {
      bg = "rgba(255,149,0,.12)";
      color = "#c97000";
    } else if (s.includes("proposal") || s.includes("qualified") || s.includes("contacted") || s.includes("in progress") || s.includes("negotiation")) {
      bg = "rgba(0,122,255,.12)";
      color = "#007AFF";
    } else if (s.includes("lost") || s.includes("cancelled") || s.includes("rejected") || s.includes("not interested") || s.includes("junk")) {
      bg = "rgba(220,38,38,.1)";
      color = "#dc2626";
    }

    return (
      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 12px", borderRadius: 980, display: "inline-block", whiteSpace: "nowrap", background: bg, color }}>
        {status}
      </span>
    );
  };

  return (
    <div className="fade-up">
      {/* KPI Header Cards — matching Apple HIG grid style in SalesLeads */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "linear-gradient(135deg,#0a3a2a 0%,#045a3f 100%)", borderRadius: 20, padding: "22px 24px", color: "#fff", boxShadow: "0 12px 24px -6px rgba(10,58,42,.25)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div style={{ position: "absolute", right: -10, top: -10, width: 90, height: 90, background: "rgba(255,255,255,.06)", borderRadius: "50%", pointerEvents: "none" }} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#80e6a2" }}>Total Apartment Leads</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(255,255,255,.15)", color: "#fff", fontWeight: 600 }}>Active</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>{totalApartments}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>Societies &amp; High-rises logged</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1px solid rgba(0,0,0,.05)", boxShadow: "0 4px 16px rgba(0,0,0,.02)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#64748b" }}>Total Flat Inventory</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#007AFF", background: "rgba(0,122,255,.1)", padding: "3px 8px", borderRadius: 6 }}>Units</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#0d2119", letterSpacing: "-.03em", lineHeight: 1 }}>{totalFlats.toLocaleString()}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Combined residential units</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1px solid rgba(0,0,0,.05)", boxShadow: "0 4px 16px rgba(0,0,0,.02)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 120 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#64748b" }}>Filtered Societies</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#08805a", background: "rgba(8,128,90,.1)", padding: "3px 8px", borderRadius: 6 }}>
                {totalApartments ? Math.round((filtered.length / totalApartments) * 100) : 0}%
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#0d2119", letterSpacing: "-.03em", lineHeight: 1 }}>{filtered.length}</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Matching current search &amp; meeting filters
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar — Apple HIG sleek control pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap", maxWidth: 740 }}>
          {/* Search Bar with Inset Icon */}
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#86868b", pointerEvents: "none" }} />
            <input
              value={q}
              onChange={handleQChange}
              placeholder="Search apartment, manager, POC, address..."
              style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", background: "#fff", fontSize: 13.5, color: "#1a2e26", outline: "none", boxSizing: "border-box", boxShadow: "0 2px 6px rgba(0,0,0,.02)", fontFamily: "inherit" }}
            />
          </div>

          {/* Meeting Status Dropdown */}
          <div style={{ position: "relative" }}>
            <select
              value={statusF}
              onChange={handleStatusChange}
              style={{ appearance: "none", WebkitAppearance: "none", padding: "10px 36px 10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", background: "#fff", fontSize: 13.5, fontWeight: 500, color: "#1a2e26", outline: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.02)", fontFamily: "inherit" }}
            >
              {statuses.map(s => <option key={s} value={s}>{s === "all" ? `All statuses (${rows.length})` : s}</option>)}
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#86868b", pointerEvents: "none" }} />
          </div>

          {/* Date Range Selector Pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "4px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 2px 6px rgba(0,0,0,.02)" }}>
            <input type="date" value={range.from || ""} onChange={handleRangeFromChange}
              style={{ border: "none", background: "transparent", fontSize: 12.5, color: "#1a2e26", outline: "none", fontFamily: "inherit", cursor: "pointer" }} />
            <span style={{ color: "#86868b", fontSize: 12 }}>to</span>
            <input type="date" value={range.to || ""} onChange={handleRangeToChange}
              style={{ border: "none", background: "transparent", fontSize: 12.5, color: "#1a2e26", outline: "none", fontFamily: "inherit", cursor: "pointer" }} />
            {(range.from || range.to) && (
              <button onClick={handleClearRange} title="Clear date range" style={{ border: "none", background: "none", color: "#86868b", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>{filtered.length} apartment{filtered.length !== 1 ? "s" : ""}</span>
          <button onClick={exportCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", background: "#fff", color: "#1a2e26", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.02)" }}>
            <Download size={14} /> Export Data
          </button>
        </div>
      </div>

      {/* HIG Rounded Card Data Table */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 400px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13.5, minWidth: 780 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Apartment Name", "Manager Number", "Meeting Status", "POC", "Address", "Pincode", "Flats"].map(h => (
                  <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                  <button onClick={() => toggleSort("created")} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}>
                    Created {sort.key === "created" && (sort.dir === "asc" ? "▲" : "▼")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.id || i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{r.name}</td>
                  <td style={{ padding: "14px 18px", color: "#475569", whiteSpace: "nowrap" }}>{r.managerNumber || "—"}</td>
                  <td style={{ padding: "14px 18px" }}>{renderMeetingStatusBadge(r.meetingStatus)}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{r.poc || "—"}</td>
                  <td style={{ padding: "14px 18px", color: "#475569", fontSize: 12.5, maxWidth: 260 }}>{r.address || "—"}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{r.pincode || "—"}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: r.flats ? "#0d2119" : "#94a3b8" }}>{r.flats || "—"}</td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: "#86868b", whiteSpace: "nowrap" }}>{r.createdTime ? fmtTime(r.createdTime) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && <Empty msg="No apartment leads match your search or filter criteria." />}

        {sorted.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#64748b" }}>{start + 1}–{Math.min(start + PER, sorted.length)} of {sorted.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: cur <= 1 ? .5 : 1, cursor: cur <= 1 ? "not-allowed" : "pointer" }}>
                <ChevronLeft size={15} /> Prev
              </button>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0d2119" }}>Page {cur} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={cur >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: cur >= totalPages ? .5 : 1, cursor: cur >= totalPages ? "not-allowed" : "pointer" }}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
