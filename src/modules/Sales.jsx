/* ============================================================================
   modules/Sales.jsx — Sales module. Extracted verbatim from App.jsx
   (v2.30 module-split). Zoho CRM leads: pipeline, leads & deals, analytics,
   trend analysis, error correction, and apartment leads.
   ============================================================================ */

import React, { useState, useEffect } from "react";
import {
  AlertCircle, Award, Ban, Briefcase, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Download, Target, TrendingUp, Users,
} from "lucide-react";
import {
  BarChart, Bar, CartesianGrid, ComposedChart, LabelList, Line, PieChart,
  Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  useAuth, api, apartmentApi, norm, hashStr, momPct, rangeFilter, exportToCsv,
  fmtTime, inr, API_ORIGIN, authHeaders, pushLog, _memCache, _inflight,
  getCached, fetchAllPagesFast, dateInRange, prevRange, rangeLabel,
  useDateRange, wait,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT,
  SortHeader, MultiSelectFilter, DateRangePicker, DateRangeFilter,
  CHART_PALETTE, renderPieLabel, pieLabelLine, btnGhost, td,
  grid4, ftd, trStyle, axisTick, selectStyle, toastStyle,
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
  { id: "d1", customer: "Aarav Mehta", email: "aarav.m@example.com", phone: "9876500011", flatNo: "A-1203", existingRo: "Yes - Kent", referralCode: "PW-REF-8821", society: "Prestige Lakeside", plan: "Home Annual", value: 9600, stage: "demo", rawStatus: "Pre-Qualified", owner: "anis", updated: "2026-06-16T09:20:00Z", note: "Wants a weekend demo slot." },
  { id: "d2", customer: "Divya Nair", email: "divya.n@example.com", phone: "9876500022", flatNo: "T4-0908", existingRo: "No", referralCode: "", society: "Sobha Dream Acres", plan: "Plus Annual", value: 14400, stage: "proposal", rawStatus: "Qualified", owner: "anis", updated: "2026-06-15T14:00:00Z", note: "Comparing with a competitor." },
  { id: "d3", customer: "Rohit Khanna", email: "rohit.k@example.com", phone: "9876500033", flatNo: "B-506", existingRo: "Yes - Aquaguard", referralCode: "PW-REF-4410", society: "Brigade Gateway", plan: "Home Quarterly", value: 2800, stage: "won", rawStatus: "Won", owner: "anis", updated: "2026-06-14T11:10:00Z", note: "Installed; happy customer." },
  { id: "d4", customer: "Sana Kapoor", email: "sana.k@example.com", phone: "9876500044", flatNo: "C-1710", existingRo: "No", referralCode: "PW-REF-9033", society: "Mantri Espana", plan: "Home Annual", value: 9600, stage: "contacted", rawStatus: "Contacted", owner: "anis", updated: "2026-06-17T08:05:00Z", note: "Asked to call after 6pm." },
  { id: "d5", customer: "Imran Sheikh", email: "imran.s@example.com", phone: "9876500055", flatNo: "D-204", existingRo: "Yes - Pureit", referralCode: "", society: "Purva Highlands", plan: "Home Monthly", value: 999, stage: "new", rawStatus: "Not Contacted", owner: "anis", updated: "2026-06-17T07:40:00Z", note: "Inbound web lead." },
  { id: "d6", customer: "Lakshmi Rao", email: "lakshmi.r@example.com", phone: "9876500066", flatNo: "E-1102", existingRo: "Yes - Livpure", referralCode: "PW-REF-2255", society: "Salarpuria Sattva", plan: "Plus Annual", value: 14400, stage: "lost", rawStatus: "Junk Lead", owner: "anis", updated: "2026-06-12T16:30:00Z", note: "Went with in-house RO." },
  { id: "d7", customer: "Vivek Anand", email: "vivek.a@example.com", phone: "9876500077", flatNo: "F-808", existingRo: "No", referralCode: "PW-REF-7719", society: "Prestige Shantiniketan", plan: "Home Annual", value: 9600, stage: "demo", rawStatus: "Pre-Qualified", owner: "anis", updated: "2026-06-16T13:25:00Z", note: "Demo done, deciding." },
  { id: "d8", customer: "Neha Joshi", email: "neha.j@example.com", phone: "9876500088", flatNo: "G-311", existingRo: "No", referralCode: "PW-REF-6642", society: "Godrej Woodsman", plan: "Home Quarterly", value: 2800, stage: "won", rawStatus: "Won", owner: "anis", updated: "2026-06-13T10:00:00Z", note: "Referred by existing customer." },
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
   SALES MODULE (sample data) — Pipeline, Leads & Deals, Sales Analytics
   =========================================================================== */

export function SalesPipeline() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  useEffect(() => { api.logView(user.username, "Viewed Sales pipeline"); salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([])); }, []);
  if (!deals) return <Loading />;

  const open = deals.filter(d => !["won", "lost"].includes(d.stage));
  const won = deals.filter(d => d.stage === "won");
  const openValue = open.reduce((s, d) => s + d.value, 0);
  const wonValue = won.reduce((s, d) => s + d.value, 0);
  const winRate = (won.length + deals.filter(d => d.stage === "lost").length) > 0
    ? Math.round(won.length / (won.length + deals.filter(d => d.stage === "lost").length) * 100) : 0;

  const stats = [
    { label: "Open deals", value: open.length, icon: Briefcase, sub: inr(openValue) + " in pipeline", hero: true },
    { label: "Won this period", value: won.length, icon: CheckCircle2, sub: inr(wonValue) + " closed" },
    { label: "Win rate", value: winRate + "%", icon: TrendingUp, sub: "won / decided" },
    { label: "Total leads", value: deals.length, icon: Users, sub: "all stages" },
  ];


  return (
    <div className="fade-up">
      <div style={grid4}>
        {stats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      {/* Kanban columns */}
      <div className="scroll-thin" style={{ display: "flex", gap: 14, overflowX: "auto", marginTop: 18, paddingBottom: 8 }}>
        {SALES_STAGES.map(stage => {
          const items = deals.filter(d => d.stage === stage.id);
          const val = items.reduce((s, d) => s + d.value, 0);
          return (
            <div key={stage.id} style={{ flex: "0 0 240px", background: "var(--mint)", borderRadius: 14, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13, color: "var(--f)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: stage.color }} />{stage.label}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{items.length}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>{inr(val)}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {items.map(d => (
                  <div key={d.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--f)" }}>{d.customer}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 6px" }}>{d.society}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{inr(d.value)}</span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.plan.replace("Home ", "").replace("Plus ", "+")}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", padding: 10 }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export const LEAD_STATUS_COLOR = { new: "#0A9D6E", contacted: "#986315", demo: "#2A86D6", proposal: "#0B6F52", won: "#08805A", lost: "#DC4141" };
export function SalesLeads({ isAdmin }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // filters on rawStatus (Lead Status)
  const [range, setRange] = useState({ from: "", to: "" });  // date filter on created
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const PER_PAGE = 25;
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });

  const refresh = () => salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([]));
  useEffect(() => { api.logView(user.username, "Viewed Sales leads"); refresh(); }, []);
  useEffect(() => { setPage(1); }, [q, statusFilter, range]);
  if (!deals) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, newStage) => { await salesApi.updateStage(user.username, id, newStage); await refresh(); flash("Stage updated"); };
  const colorOf = (d) => LEAD_STATUS_COLOR[d.stage] || "#A9B3AC";

  // Date filter first — cards & dropdown counts reflect the selected window.
  const inR = rangeFilter(range);
  const dateScoped = deals.filter(d => inR(d.created));

  // Distinct Lead Status values + counts (over the date-scoped set).
  const statusCounts = {};
  dateScoped.forEach(d => { const s = d.rawStatus || "—"; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const statuses = Object.keys(statusCounts).sort((a, b) => statusCounts[b] - statusCounts[a]);
  const stageForStatus = (s) => (deals.find(d => d.rawStatus === s) || {}).stage;

  // Total leads within the date window.
  const totalLeads = dateScoped.length;

  const filtered = dateScoped.filter(d =>
    (d.customer + d.society + d.phone + (d.email || "") + (d.flatNo || "") + (d.referralCode || "")).toLowerCase().includes(q.toLowerCase())
    && (statusFilter === "all" || d.rawStatus === statusFilter));

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
      {/* Lead-status cards — click to filter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setStatusFilter("all")} title="All leads"
          style={{ textAlign: "left", cursor: "pointer", color: "#E2F3EE", border: "none", borderRadius: 12, padding: "11px 13px", background: "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)", outline: statusFilter === "all" ? "2px solid var(--lime)" : "2px solid transparent", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--lime)" }}>Total Leads</div>
          <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 23, color: "#fff", lineHeight: 1.1 }}>{totalLeads}</div>
          <div style={{ fontSize: 11, color: "#B5E2D4", fontWeight: 600 }}>in view</div>
        </button>
        {statuses.map(s => {
          const c = LEAD_STATUS_COLOR[stageForStatus(s)] || "#A9B3AC";
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(active ? "all" : s)} title="Filter by this status"
              style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid var(--border)", borderLeft: `3px solid ${c}`, borderRadius: 12, padding: "11px 13px", outline: active ? "2px solid var(--teal)" : "2px solid transparent", transition: ".15s" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
              <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 23, color: "var(--f)", lineHeight: 1.1 }}>{statusCounts[s]}</div>
            </button>
          );
        })}
      </div>

      <DateRangeFilter range={range} onChange={setRange} right={
        <span className="no-print" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}{filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </span>
      } />

      <Toolbar q={q} setQ={setQ} placeholder="Search name, society, phone, email…" count={filtered.length}
        right={<>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="all">All statuses ({dateScoped.length})</option>
            {statuses.map(s => <option key={s} value={s}>{s} ({statusCounts[s]})</option>)}
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Full Name", "Phone", "Flat No", "Lead Status", "Society Name", "Tenure", "Plan Value", "Deposit", "To Collect",
          <SortHeader key="cr" label="Created" k="created" sort={sort} onSort={toggleSort} />, ...(isAdmin ? ["Move to"] : [])]} maxHeight="calc(100vh - 400px)">
          {pageRows.map(d => (
            <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{d.customer}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.phone || "—"}</td>
              <td style={td}>{d.flatNo || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: colorOf(d), whiteSpace: "nowrap" }}>
                  {d.rawStatus || SALES_STAGES.find(s => s.id === d.stage)?.label}
                </span>
              </td>
              <td style={td}>{d.society || "—"}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.planTenure || "—"}</td>
              <td style={{ ...td, fontWeight: 600 }}>{d.value ? inr(d.value) : "—"}</td>
              <td style={td}>{d.deposit ? inr(d.deposit) : "—"}</td>
              <td style={{ ...td, fontWeight: 600, color: "var(--teal-d)" }}>{d.amountToCollect ? inr(d.amountToCollect) : "—"}</td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.created ? fmtTime(d.created) : "—"}</td>
              {isAdmin && <td style={td}>
                <select value={d.stage} onChange={e => move(d.id, e.target.value)} style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }}>
                  {SALES_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </td>}
            </tr>
          ))}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={6}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.value || 0), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.deposit || 0), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.amountToCollect || 0), 0))}</td>
              <td style={ftd}></td>
              {isAdmin && <td style={ftd}></td>}
            </tr>
          )}
        </Table>
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
      </Card>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
export function SalesAnalytics() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [apts, setApts] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [onlyWith, setOnlyWith] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => {
    api.logView(user.username, "Viewed Sales analytics");
    Promise.all([salesApi.getDeals(), apartmentApi.getAll()])
      .then(([d, a]) => { setDeals(d.filter(notHiddenLead)); setApts(a); })
      .catch(() => { setDeals([]); setApts([]); });
  }, []);
  if (!deals || !apts) return <Loading />;

  const inR = rangeFilter(range);
  const scopedDeals = deals.filter(d => inR(d.created));

  const leadsBySociety = {};
  scopedDeals.forEach(d => { const k = norm(d.society); (leadsBySociety[k] = leadsBySociety[k] || []).push(d); });
  const statuses = Array.from(new Set(scopedDeals.map(d => d.rawStatus || "—")));

  const seen = new Set(); const aptRows = [];
  apts.forEach(a => { const k = norm(a.name); if (a.name && !seen.has(k)) { seen.add(k); aptRows.push(a); } });

  let pivot = aptRows.map(a => {
    const leads = leadsBySociety[norm(a.name)] || [];
    const counts = {}; leads.forEach(d => { const s = d.rawStatus || "—"; counts[s] = (counts[s] || 0) + 1; });
    return { apt: a, leads, counts, total: leads.length };
  });
  const withLeadsCount = pivot.filter(p => p.total > 0).length;
  if (onlyWith) pivot = pivot.filter(p => p.total > 0);
  pivot.sort((a, b) => b.total - a.total);

  const pipelineValue = scopedDeals.filter(d => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0);
  const wonValue = scopedDeals.filter(d => d.stage === "won").reduce((s, d) => s + d.value, 0);
  const avg = Math.round(scopedDeals.reduce((s, d) => s + d.value, 0) / (scopedDeals.length || 1));
  const stats = [
    { label: "Pipeline value", value: inr(pipelineValue), icon: Briefcase, sub: "open deals", hero: true },
    { label: "Won value", value: inr(wonValue), icon: Award, sub: "closed deals" },
    { label: "Avg deal size", value: inr(avg), icon: TrendingUp, sub: "scoped deals" },
    { label: "Total deals", value: scopedDeals.length, icon: Users, sub: "in range" },
  ];

  const toggle = (k) => setExpanded(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const exportCsv = () => exportToCsv("prowater-apartment-pivot.csv",
    [{ label: "Apartment", get: p => p.apt.name }, ...statuses.map(s => ({ label: s, get: p => p.counts[s] || 0 })), { label: "Total", get: p => p.total }],
    pivot);


  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 16 }}>
        <DateRangeFilter range={range} onChange={setRange} right={
          <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--slate)", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyWith} onChange={e => setOnlyWith(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--teal)" }} />
            Only apartments with leads ({withLeadsCount})
          </label>
        } />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{pivot.length} apartment{pivot.length !== 1 ? "s" : ""} · {scopedDeals.length} leads · {statuses.length} statuses</span>
          <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
        </div>
        <Card pad={false} title="Leads by apartment × status" sub="Join key: apartment name = lead Society Name. Click a row with leads to expand.">
          <Table head={["Apartment", ...statuses, "Total"]} maxHeight="calc(100vh - 430px)">
            {pivot.map((p) => {
              const k = norm(p.apt.name);
              const open = expanded.has(k);
              return (
                <React.Fragment key={k}>
                  <tr style={{ ...trStyle, cursor: p.total > 0 ? "pointer" : "default", background: open ? "var(--mint)" : "transparent" }} onClick={() => p.total > 0 && toggle(k)}>
                    <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {p.total > 0 && <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: ".15s" }} />}
                        {p.apt.name}
                      </span>
                    </td>
                    {statuses.map(s => <td key={s} style={td}>{p.counts[s] || "—"}</td>)}
                    <td style={{ ...td, fontWeight: 700 }}>{p.total || "—"}</td>
                  </tr>
                  {open && p.total > 0 && (
                    <tr>
                      <td colSpan={statuses.length + 2} style={{ padding: "0 12px 12px" }}>
                        <div className="scroll-thin" style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                            <thead><tr>{["Customer", "Phone", "Lead Status", "Flat", "Plan Value", "Created"].map(h => <th key={h} style={{ position: "sticky", top: 0, background: "#E2F0EA", zIndex: 1, textAlign: "center", padding: "9px 12px", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#0A1A12", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                            <tbody>
                              {p.leads.map((d, i) => (
                                <tr key={d.id} style={{ background: i % 2 ? "#EEF7F3" : "#fff" }}>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{d.customer}</td>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, whiteSpace: "nowrap", textAlign: "center" }}>{d.phone || "—"}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, color: "#fff", background: LEAD_STATUS_COLOR[d.stage] || "#A9B3AC", whiteSpace: "nowrap" }}>{d.rawStatus || "—"}</span></td>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, textAlign: "center" }}>{d.flatNo || "—"}</td>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 600, textAlign: "center" }}>{d.value ? inr(d.value) : "—"}</td>
                                  <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", textAlign: "center" }}>{d.created ? fmtTime(d.created) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </Table>
          {pivot.length === 0 && <Empty msg="No apartments to show." />}
        </Card>
      </div>
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
  const scoped = apt === null ? deals : deals.filter(d => apt.includes(d.society));

  const dateOf = (d) => { const t = new Date(d.created || d.updated); return isNaN(t) ? null : t; };
  const prev = prevRange(sel.preset, range);
  const inRange = scoped.filter(d => dateInRange(dateOf(d), range));
  const inPrev = scoped.filter(d => dateInRange(dateOf(d), prev));

  // ── KPI cards (period vs the immediately-preceding period of equal length) ──
  const totalN = inRange.length, totalPrevN = inPrev.length;
  const wonN = inRange.filter(d => d.stage === "won").length, wonPrevN = inPrev.filter(d => d.stage === "won").length;
  const lostN = inRange.filter(d => d.stage === "lost").length, lostPrevN = inPrev.filter(d => d.stage === "lost").length;
  const convPct = totalN ? (wonN / totalN) * 100 : 0;
  const convPrevPct = totalPrevN ? (wonPrevN / totalPrevN) * 100 : 0;
  const convDeltaPts = (totalN && totalPrevN) ? Math.round((convPct - convPrevPct) * 10) / 10 : null;

  // ── Monthly cohort trend (last 8 calendar months, apartment-scoped but NOT ──
  // ── date-picker-scoped — a month-on-month view needs several months regardless ──
  // ── of the single period selected). Per-month hierarchy (v2.29.93): Interested
  // ── = the literal Zoho raw lead status "Interested" (mapped to the "demo" stage
  // ── bucket in mapZohoLead, but identified here by its own raw text, not the
  // ── stage bucket) — NOT Interested = every other lead that isn't Interested or
  // ── Converted (so Interested + Not Interested + Converted always sums to Total
  // ── Leads, i.e. the full stack height). ──
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
  const trend = Object.values(trendMap).sort((a, b) => (a.y - b.y) || (a.m - b.m)).slice(-8)
    .map(t => ({
      label: `${MONL[t.m]} '${String(t.y).slice(2)}`,
      leads: t.leads, won: t.won, interested: t.interested,
      notInterested: Math.max(0, t.leads - t.interested - t.won),
      conv: t.leads ? Math.round((t.won / t.leads) * 100) : 0,
    }));
  const lastIdx = trend.length - 1;
  const latestLabel = trend.length ? trend[lastIdx].label : "";

  // Custom Bar shapes — grouped (side-by-side, not stacked) bars per month:
  // Total Leads / Interested / Not Interested / Converted, each its own full
  // bar so every data label has clear room above it (a stacked layout was
  // squeezing labels into small segments). Total Leads carries the "latest
  // month" flash (brand-green fill + pulsing dot) since it's the lead bar in
  // each group; the other three keep constant colours so the legend holds.
  const plainBarShape = (color) => (props) => {
    const { x, y, width, height } = props;
    return <rect x={x} y={y} width={width} height={Math.max(height, 0)} rx={3} fill={color} />;
  };
  const totalBarShape = (props) => {
    const { x, y, width, height, index } = props;
    const isLatest = index === lastIdx;
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(height, 0)} rx={3} fill={isLatest ? "#0A9D6E" : "#A9B3AC"} />
        {isLatest && (
          <circle cx={x + width / 2} cy={y - 9} r={4} fill="#0A9D6E">
            <animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite" />
            <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    );
  };
  const interestedShape = plainBarShape("#2A86D6");
  const notInterestedShape = plainBarShape("#986315");
  const convertedShape = plainBarShape("#08805A");

  // ── Average time to convert — created→updated gap for WON leads, this period ──
  // vs the previous period. Same "last touched" proxy the idle-lead tracking
  // already uses for "when something happened" (no separate won-date field exists).
  const daysToConvert = (d) => { const c = new Date(d.created), u = new Date(d.updated); return (isNaN(c) || isNaN(u)) ? null : Math.max(0, (u - c) / 86400000); };
  const convTimes = inRange.filter(d => d.stage === "won").map(daysToConvert).filter(v => v != null);
  const convTimesPrev = inPrev.filter(d => d.stage === "won").map(daysToConvert).filter(v => v != null);
  const avgConvertDays = convTimes.length ? convTimes.reduce((s, v) => s + v, 0) / convTimes.length : null;
  const avgConvertDaysPrev = convTimesPrev.length ? convTimesPrev.reduce((s, v) => s + v, 0) / convTimesPrev.length : null;
  const fastestConvertDays = convTimes.length ? Math.min(...convTimes) : null;
  const slowestConvertDays = convTimes.length ? Math.max(...convTimes) : null;
  const convertDeltaDays = (avgConvertDays != null && avgConvertDaysPrev != null) ? Math.round((avgConvertDays - avgConvertDaysPrev) * 10) / 10 : null;

  // ── Conversion funnel — same Total Leads/Interested/Not Interested/Converted
  // hierarchy as the trend chart above (v2.29.96), THIS period, shown last per
  // spec. "Interested" = literal Zoho raw lead status text; "Not Interested" =
  // Total − Interested − Converted, so the 4 rows always sum correctly. ──
  const interestedN = inRange.filter(d => (d.rawStatus || "").toLowerCase() === "interested").length;
  const notInterestedN = Math.max(0, totalN - interestedN - wonN);
  const funnel = [
    { key: "all", label: "Total Leads", n: totalN },
    { key: "interested", label: "Interested", n: interestedN },
    { key: "notInterested", label: "Not Interested", n: notInterestedN },
    { key: "won", label: "Converted", n: wonN },
  ];

  const convCardColor = convPct < 5 ? "#DC4141" : convPct < 15 ? "#a86e00" : "#0A7D53";

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <DateRangePicker value={sel} onChange={setSel} />
        <MultiSelectFilter label="Apartment" options={aptOptions} value={apt} onChange={setApt} width={240} />
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{rangeLabel(range)} · {totalN} lead{totalN !== 1 ? "s" : ""} in view</span>
      </div>

      {/* KPI cards — Total/Converted/Lost use the shared Stat (real MoM % change);
          Conversion % is hand-rolled to match Stat's exact look but with a
          points (pts) delta instead of Stat's hardcoded "%" suffix, since a
          %-of-a-% change would misread as something it isn't. */}
      <div style={grid4}>
        <Stat label="Total leads" value={totalN} icon={Briefcase} hero sub={rangeLabel(range)} delta={momPct(totalN, totalPrevN)} />
        <Stat label="Converted (Won)" value={wonN} icon={CheckCircle2} sub={rangeLabel(range)} delta={momPct(wonN, wonPrevN)} />
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="eyebrow" style={{ color: "var(--muted)" }}>Conversion %</span>
            <Target size={18} color="var(--teal)" />
          </div>
          <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: convCardColor, margin: "8px 0 2px", lineHeight: 1 }}>{convPct.toFixed(1)}%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{rangeLabel(range)}</div>
            {convDeltaPts != null && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: convDeltaPts > 0 ? "#08805A" : convDeltaPts < 0 ? "#DC4141" : "#7D8A83", whiteSpace: "nowrap" }}>
                {convDeltaPts > 0 ? "▲" : convDeltaPts < 0 ? "▼" : "—"} {convDeltaPts > 0 ? "+" : ""}{convDeltaPts}pts
              </span>
            )}
          </div>
        </div>
        <Stat label="Lost" value={lostN} icon={Ban} sub={rangeLabel(range)} delta={momPct(lostN, lostPrevN)} />
      </div>

      {/* Monthly trend — 4 grouped (side-by-side) bars per month: Total Leads /
          Interested / Not Interested / Converted, each its own full bar so
          every data label has clear room above it, plus a Conversion % line
          on the secondary axis. Latest month's Total Leads bar flashes. */}
      <div style={{ marginTop: 18 }}>
        <Card title="Leads vs conversion % — month on month" sub={`Last ${trend.length} months · latest month (${latestLabel}) is highlighted and pulses`}>
          {trend.length > 1 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={trend} margin={{ left: -12, right: 6, top: 24 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
                  <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => v + "%"} />
                  <Tooltip content={<TT />} />
                  <Bar yAxisId="l" dataKey="leads" name="Total Leads" shape={totalBarShape} maxBarSize={22} isAnimationActive={false}>
                    <LabelList dataKey="leads" position="top" formatter={(v) => v || ""} style={{ fontSize: 11, fill: "var(--f)", fontWeight: 800 }} />
                  </Bar>
                  <Bar yAxisId="l" dataKey="interested" name="Interested" shape={interestedShape} maxBarSize={22} isAnimationActive={false}>
                    <LabelList dataKey="interested" position="top" formatter={(v) => v || ""} style={{ fontSize: 11, fill: "#2A86D6", fontWeight: 800 }} />
                  </Bar>
                  <Bar yAxisId="l" dataKey="notInterested" name="Not Interested" shape={notInterestedShape} maxBarSize={22} isAnimationActive={false}>
                    <LabelList dataKey="notInterested" position="top" formatter={(v) => v || ""} style={{ fontSize: 11, fill: "#986315", fontWeight: 800 }} />
                  </Bar>
                  <Bar yAxisId="l" dataKey="won" name="Converted" shape={convertedShape} maxBarSize={22} isAnimationActive={false}>
                    <LabelList dataKey="won" position="top" formatter={(v) => v || ""} style={{ fontSize: 11, fill: "#08805A", fontWeight: 800 }} />
                  </Bar>
                  <Line yAxisId="r" type="monotone" dataKey="conv" name="Conversion %" stroke="#7A5AF8" strokeWidth={2.5} dot={{ r: 3, fill: "#7A5AF8" }} isAnimationActive={false}>
                    <LabelList dataKey="conv" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10.5, fill: "#7A5AF8", fontWeight: 700 }} offset={12} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "4px 4px 0", fontSize: 11, color: "var(--muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#A9B3AC" }} /> total leads</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#2A86D6" }} /> interested</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#986315" }} /> not interested</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#08805A" }} /> converted</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 3, background: "#7A5AF8", borderRadius: 2 }} /> conversion %</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#0A9D6E", boxShadow: "0 0 0 3px rgba(10,157,110,.22)" }} /> flashing = latest month ({latestLabel})</span>
              </div>
            </>
          ) : <Empty msg="Not enough months of lead history yet to trend." />}
        </Card>
      </div>

      {/* Average time to convert — created→updated gap for WON leads, this period vs previous. */}
      <div style={{ marginTop: 18 }}>
        <Card title="Average time to convert" sub={`${rangeLabel(range)} · based on ${convTimes.length} converted lead${convTimes.length !== 1 ? "s" : ""} this period`}>
          {convTimes.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14 }} className="avgconv-grid">
              <style>{`@media(max-width:700px){.avgconv-grid{grid-template-columns:1fr!important}}`}</style>
              <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)", borderRadius: "var(--radius)", padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span className="eyebrow" style={{ color: "var(--lime)" }}>Average time to convert</span>
                  <Clock size={18} color="var(--lime)" />
                </div>
                <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: "#fff", margin: "8px 0 2px", lineHeight: 1 }}>{avgConvertDays.toFixed(1)} <span style={{ fontSize: 16, fontWeight: 600 }}>days</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, color: "#B5E2D4" }}>{rangeLabel(range)}</div>
                  {convertDeltaDays != null && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: convertDeltaDays < 0 ? "#0A9D6E" : convertDeltaDays > 0 ? "#F5BFBF" : "#B5E2D4", whiteSpace: "nowrap" }}>
                      {convertDeltaDays < 0 ? "▼" : convertDeltaDays > 0 ? "▲" : "—"} {convertDeltaDays > 0 ? "+" : ""}{convertDeltaDays}d vs previous period
                    </span>
                  )}
                </div>
              </div>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
                <span className="eyebrow" style={{ color: "var(--muted)" }}>Fastest</span>
                <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 24, color: "#0A7D53", marginTop: 8 }}>{fastestConvertDays.toFixed(1)}d</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>quickest close this period</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
                <span className="eyebrow" style={{ color: "var(--muted)" }}>Slowest</span>
                <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 24, color: "#DC4141", marginTop: 8 }}>{slowestConvertDays.toFixed(1)}d</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>longest close this period</div>
              </div>
            </div>
          ) : <Empty msg="No converted leads this period to measure conversion time." />}
        </Card>
      </div>

      {/* Conversion funnel — deliberately LAST, per spec: "at the bottom it should
          show how many got converted from the total leads." Same period scope
          as the KPI cards above (inRange), not all-time. Reverted to the
          horizontal-bar-list style (v2.29.93) — the trapezoid funnel shape was
          tried per an earlier ask, then the user asked to revert to this look.
          Rows use the same Total Leads/Interested/Not Interested/Converted
          hierarchy (and colours) as the trend chart above (v2.29.96), each
          shown with both its count and its % of Total Leads. */}
      <div style={{ marginTop: 18 }}>
        <Card title="Lead conversion funnel" sub={`${rangeLabel(range)} — the real picture, total leads down to conversions`}>
          <div style={{ display: "grid", gap: 8 }}>
            {funnel.map((f, i) => {
              const pct = totalN ? (f.n / totalN) * 100 : 0;
              const col = ["#A9B3AC", "#2A86D6", "#986315", "#08805A"][i];
              return (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 132, fontSize: 12.5, fontWeight: 700, color: "var(--f)", textAlign: "right", flexShrink: 0 }}>{f.label}</div>
                  <div style={{ flex: 1, background: "#F1F4F3", borderRadius: 8, height: 30, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: Math.max(pct, 1.5) + "%", height: "100%", background: col, borderRadius: 8 }} />
                    <div style={{ position: "absolute", top: 0, left: 10, height: 30, display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 800, color: pct > 14 ? "#fff" : "var(--f)" }}>{f.n}</div>
                  </div>
                  <div style={{ width: 50, fontSize: 12.5, fontWeight: 700, color: "var(--muted)", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "var(--mint)", fontSize: 12.5, color: "var(--slate)" }}>
            <Target size={15} color="var(--teal)" />
            <b style={{ color: "var(--f)" }}>{wonN}</b> of <b style={{ color: "var(--f)" }}>{totalN}</b> total leads converted {rangeLabel(range)} — a <b style={{ color: convCardColor }}>{convPct.toFixed(1)}%</b> close rate.
          </div>
        </Card>
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
  const [range, setRange] = useState({ from: "", to: "" });
  const [statusF, setStatusF] = useState("all");
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);
  const PER = 20;
  useEffect(() => { api.logView(user.username, "Viewed Apartment Leads"); apartmentApi.getAll().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { setPage(1); }, [range, statusF]);
  if (!rows) return <Loading />;

  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const inR = rangeFilter(range);
  const statuses = ["all", ...Array.from(new Set(rows.map(r => r.meetingStatus).filter(s => s && s !== "—")))];
  const filtered = rows.filter(r => inR(r.createdTime) && (statusF === "all" || r.meetingStatus === statusF));
  const sorted = [...filtered].sort((a, b) => { const ta = new Date(a.createdTime).getTime(), tb = new Date(b.createdTime).getTime(); const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb; return (va - vb) * (sort.dir === "asc" ? 1 : -1); });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PER;
  const pageRows = sorted.slice(start, start + PER);

  const exportCsv = () => exportToCsv("prowater-apartment-leads.csv", [
    { label: "Apartment Name", get: r => r.name }, { label: "Manager Number", get: r => r.managerNumber },
    { label: "Meeting Status", get: r => r.meetingStatus }, { label: "POC", get: r => r.poc },
    { label: "Address", get: r => r.address }, { label: "Pincode", get: r => r.pincode },
    { label: "Flats", get: r => r.flats || "" }, { label: "Created", get: r => r.createdTime },
  ], sorted);


  return (
    <div className="fade-up">
      <DateRangeFilter range={range} onChange={setRange} right={
        <span className="no-print" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{filtered.length} apartment{filtered.length !== 1 ? "s" : ""}</span>
      } />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Meeting status</span>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={selectStyle}>
          {statuses.map(s => <option key={s} value={s}>{s === "all" ? `All statuses (${rows.length})` : s}</option>)}
        </select>
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>
      <Card pad={false}>
        <Table head={["Apartment Name", "Manager Number", "Meeting Status", "POC", "Address", "Pincode", "Flats",
          <SortHeader key="cr" label="Created" k="created" sort={sort} onSort={toggleSort} />]} maxHeight="calc(100vh - 360px)">
          {pageRows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.name}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{r.managerNumber || "—"}</td>
              <td style={td}>{r.meetingStatus || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>{r.poc || "—"}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, maxWidth: 260 }}>{r.address || "—"}</td>
              <td style={td}>{r.pincode || "—"}</td>
              <td style={td}>{r.flats || "—"}</td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.createdTime ? fmtTime(r.createdTime) : "—"}</td>
            </tr>
          ))}
        </Table>
        {sorted.length === 0 && <Empty msg="No apartment leads found." />}
        {sorted.length > PER && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{start + 1}–{Math.min(start + PER, sorted.length)} of {sorted.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: cur <= 1 ? .5 : 1 }}><ChevronLeft size={15} /> Prev</button>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Page {cur} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={cur >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: cur >= totalPages ? .5 : 1 }}>Next <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
