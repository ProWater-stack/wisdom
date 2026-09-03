/* ===========================================================================
   modules/Customer.jsx — Customer module.
   CustomerSocieties (per-society roll-up), AllCustomers (full profile with
   tickets/spares/invoices sub-widgets), Customers (list), CustomerDrawer
   (edit drawer), and DPCustomers (raw DP registry feed tab).
   =========================================================================== */
import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Award, Ban, Bluetooth, Boxes,
  CalendarClock, CalendarDays, CalendarRange, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, Cpu, Download, Droplets, Gauge,
  GitBranch, Info, Landmark, MapPin, PauseCircle, PencilLine, PlayCircle, Receipt,
  RefreshCw, RotateCcw, Sun, Ticket, TrendingUp, Upload, UserRound, Wallet, Wrench, X, Wifi, WifiOff,
} from "lucide-react";
import {
  useAuth, api, customerApi, billingApi, creditNoteApi, ticketApi,
  depositForCustomer, CUSTOMER_FIELDS,
  API_ORIGIN, DATE_PRESETS, dateInRange, resolveRange, parseFlexDate,
  exportToCsv, fmtDate, fmtTime, fmtPhone, inr, deviceType, DEVICE_TYPE_STYLE, isRealSociety,
  parsePartsUsed, jobDurationMin, zdIsClosed, gstBreakup,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, Modal, Drawer,
  Field, Chip, Status, Person, SortHeader, DateRangePicker, MultiSelectFilter,
  DefRow, DeviceTypeBadge, ProWaterLogo,
  btnGhost, btnPrimary, td, ftd, trStyle, grid4, axisTick, selectStyle,
  toastStyle, iconBtn, inp,
} from "../shared/ui";
import imgWaterFilter from "../../Tank Photos/water-filter.png";

const cleanPhoneTo10Digits = (phone) => {
  if (!phone) return "—";
  const clean = String(phone).replace(/\D/g, "");
  return clean.length >= 10 ? clean.slice(-10) : clean;
};
import imgTool from "../../Tank Photos/tool.png";
import imgTechnology from "../../Tank Photos/technology.png";
import imgProtect from "../../Tank Photos/protect.png";
import imgAlkaline from "../../Tank Photos/alkaline.jpg";
import imgCopper from "../../Tank Photos/copper.png";
import imgMinerals from "../../Tank Photos/minerals.png";
import imgOptions from "../../Tank Photos/options.png";

/* ===========================================================================
   CUSTOMER MODULE (Zoho Billing) — list + editable detail with role gating
   accessLevel: "view" | "supervisor" | "admin" | "devops"
   =========================================================================== */
// Device type derived from the purifier ID prefix: HAC → Hot & Cold,
// OWN → Own Device, anything else → Normal Device. Empty ID = no device.

// Show a phone number without the +91 / 91 country code — just the local digits.

// Clickable table header that toggles ascending / descending sort on `k`.

/* ===========================================================================
   CUSTOMER MODULE — Societies: how many customers per society (+ active &
   device mix), sortable, searchable, with a grand-total footer.
   =========================================================================== */
export function CustomerSocieties() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [invs, setInvs] = useState([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "count", dir: "desc" });
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "society" ? "asc" : "desc" });
  // v2.29.130: society/device-type structural filters (MultiSelectFilter,
  // null = default view). societyFilter's default (null) excludes blanks and
  // the testing apartment via the shared isRealSociety() (v2.29.137) — pick
  // either explicitly in the filter to see it.
  const [societyFilter, setSocietyFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(null);
  const NONE = "— No society —";
  // Per-society expand state: society -> which metric's customers to show
  // ("all"|"active"|"own"|"normal"|"hotcold"|"churned"). Clicking the same
  // number again collapses; clicking a different number for an already-open
  // society switches the slice shown, dynamically, per the requested UX.
  const [expanded, setExpanded] = useState(() => new Map());
  const setExpandFilter = (society, key) => setExpanded(prev => {
    const n = new Map(prev);
    if (n.get(society) === key) n.delete(society); else n.set(society, key);
    return n;
  });
  useEffect(() => { api.logView(user.username, "Viewed Societies"); Promise.all([customerApi.getCustomers(), billingApi.getInvoices().catch(() => [])]).then(([c, i]) => { setRows(c); setInvs(i || []); }).catch(() => setRows([])); }, []);
  if (!rows) return <Loading title="Loading Societies" subtitle="Synchronizing apartment society records…" />;

  // Churned (v2.29.130) — either signal counts: device Un-Installed
  // (DP-stack `deviceStatus`) or status Inactive (either stack), same
  // normalisation/logic All Customers' row-highlighting already uses.
  const normSt = (s) => String(s || "").toLowerCase().replace(/[\s_-]+/g, "");
  const isChurned = (c) => {
    const dev = normSt(c.deviceStatus);
    const st = normSt(c.status);
    return dev.includes("uninstall") || st === "inactive" || dev === "inactive";
  };

  // Base population (v2.29.159): restricted to customers with a Purifier ID
  // assigned, same `withPur` gate Customer > All Customers uses — per
  // explicit request to reconcile the two screens' totals, which previously
  // diverged because this screen counted every get-all-customers record
  // (Purifier ID or not) while All Customers only ever counted the subset
  // that has one. A customer signed up but not yet linked to a purifier now
  // reads the same on both screens (absent from both, not just one).
  const withPur = rows.filter(c => c.purifier_id);

  // Status & Device Type filters narrow the population BEFORE grouping into societies
  const statusOptions = Array.from(new Set(withPur.map(c => c.status).filter(Boolean))).sort();
  const scopedRows = withPur.filter(c =>
    (statusFilter === null || statusFilter.includes(c.status)) &&
    (deviceTypeFilter === null || deviceTypeFilter.includes(deviceType(c.purifier_id)))
  );

  const groups = {};
  scopedRows.forEach(c => {
    const soc = (c.society && String(c.society).trim() && c.society !== "—") ? String(c.society).trim() : NONE;
    const g = groups[soc] || (groups[soc] = { society: soc, count: 0, active: 0, inactive: 0, dunning: 0, own: 0, normal: 0, hotcold: 0, churned: 0, customers: [] });
    g.customers.push(c);
    g.count++;
    const st = String(c.status || "").toLowerCase();
    if (st === "active") g.active++;
    else if (st === "inactive") g.inactive++;
    else if (st === "dunning") g.dunning++;
    const dt = deviceType(c.purifier_id);
    if (dt === "Own Device") g.own++;
    else if (dt === "Normal Device") g.normal++;
    else if (dt === "Hot & Cold") g.hotcold++;
    if (isChurned(c)) g.churned++;
  });
  const all = Object.values(groups);

  // Society filter (v2.29.159, restored to match All Customers/the CRM-wide
  // convention): explicit selection is used as-is; the default (unfiltered)
  // view excludes blank/unknown society AND "Apartment (Testing)" via the
  // shared isRealSociety() — pick either explicitly from the dropdown to
  // still see it. The dropdown's own option list stays unrestricted (every
  // group, including NONE/testing, remains pickable).
  const societyOptions = all.map(g => g.society).sort();
  const visible = all.filter(g => societyFilter === null ? isRealSociety(g.society) : societyFilter.includes(g.society));

  const hasActiveFilters = societyFilter !== null || statusFilter !== null || deviceTypeFilter !== null || q !== "";
  const handleResetFilters = () => {
    setSocietyFilter(null);
    setStatusFilter(null);
    setDeviceTypeFilter(null);
    setQ("");
  };

  // "Named" KPI stats (Societies count / Avg per society / Largest society)
  // stay isRealSociety-gated even if NONE/testing is explicitly selected —
  // same convention as All Customers' `resultSocieties`.
  const namedGroups = visible.filter(g => isRealSociety(g.society));
  const namedSocieties = namedGroups.length;
  const biggest = namedGroups.reduce((b, g) => g.count > (b?.count || 0) ? g : b, null);
  const totalCustomers = visible.reduce((s, g) => s + g.count, 0);

  const filtered = visible.filter(g => g.society.toLowerCase().includes(q.toLowerCase()));
  const dir = sort.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => sort.key === "society" ? a.society.localeCompare(b.society) * dir : (a[sort.key] - b[sort.key]) * dir);
  const tot = filtered.reduce((a, g) => ({ count: a.count + g.count, active: a.active + g.active, own: a.own + g.own, normal: a.normal + g.normal, hotcold: a.hotcold + g.hotcold, churned: a.churned + g.churned }), { count: 0, active: 0, own: 0, normal: 0, hotcold: 0, churned: 0 });

  const stats = [
    { label: "Societies", value: namedSocieties, icon: Boxes, sub: "with at least one customer", hero: true },
    { label: "Customers", value: totalCustomers.toLocaleString("en-IN"), icon: UserRound, sub: "across visible societies" },
    { label: "Avg / society", value: namedSocieties ? Math.round(namedGroups.reduce((s, g) => s + g.count, 0) / namedSocieties) : 0, icon: TrendingUp, sub: "customers per society" },
    { label: "Largest society", value: biggest ? biggest.count : 0, icon: Award, sub: biggest ? biggest.society : "—" },
  ];

  const exportCsv = () => {
    const flatCustomers = [];
    filtered.forEach(g => {
      g.customers.forEach(c => {
        flatCustomers.push(c);
      });
    });

    exportToCsv("prowater-society-customers.csv", [
      { label: "Customer Name", get: c => c.name || "—" },
      { label: "Phone", get: c => cleanPhoneTo10Digits(c.phone) },
      { label: "Purifier ID", get: c => c.purifier_id || "—" },
      { label: "Society", get: c => c.society || "— No society —" },
      { label: "Plan", get: c => c.plan || "—" },
      { label: "Status", get: c => c.status || "—" },
      { label: "Device Type", get: c => deviceType(c.purifier_id) || "—" },
    ], flatCustomers);
  };

  // Which slice of a society's customers to show in its expand panel.
  const sliceOf = (g, key) => {
    switch (key) {
      case "active": return g.customers.filter(c => normSt(c.status) === "active");
      case "own": return g.customers.filter(c => deviceType(c.purifier_id) === "Own Device");
      case "normal": return g.customers.filter(c => deviceType(c.purifier_id) === "Normal Device");
      case "hotcold": return g.customers.filter(c => deviceType(c.purifier_id) === "Hot & Cold");
      case "churned": return g.customers.filter(isChurned);
      default: return g.customers;
    }
  };
  const sliceLabel = { all: "All customers", active: "Active customers", own: "Own Device customers", normal: "Normal Device customers", hotcold: "Hot & Cold customers", churned: "Churned customers" };

  const numCell = (value, key, g, color) => (
    <td style={{ padding: "14px 18px" }}>
      <span onClick={(e) => { e.stopPropagation(); setExpandFilter(g.society, key); }}
        title={`Click to see ${sliceLabel[key].toLowerCase()}`}
        className="soc-num-link"
        style={{ fontWeight: key === "all" ? 700 : 600, color: color || "#475569", cursor: "pointer" }}>
        {value || (key === "all" ? 0 : "—")}
      </span>
    </td>
  );

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}
        .soc-num-link:hover{text-decoration:underline}`}</style>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {/* v2.29.274: hero cards no longer gradient — per explicit user request
            ("make all the hero cards in same color with white background like
            other normal cards, it becomes easy to check the percentages going
            up or down"), every KPI card across the CRM now renders like a
            normal white card so any percentage/delta text is always plain
            colored text on white, never needing a pill/backdrop workaround. */}
        {stats.map((s, i) => (
          <div key={i} style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color="#08805A" />
              </div>
            </div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 700, color: "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "#86868B" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Societies list & expand table ─────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <Toolbar q={q} setQ={setQ} placeholder="Search society…" count={filtered.length}
          right={<>
            <MultiSelectFilter label="Society" options={societyOptions} value={societyFilter} onChange={setSocietyFilter} width={200} />
            <MultiSelectFilter label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} width={180} />
            <MultiSelectFilter label="Device Type" options={["Own Device", "Normal Device", "Hot & Cold"]} value={deviceTypeFilter} onChange={setDeviceTypeFilter} width={180} />
            {hasActiveFilters && (
              <button onClick={handleResetFilters} title="Reset all filters and search"
                style={{ ...btnGhost, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 11px", borderRadius: 8, background: "rgba(220,65,65,0.08)" }}>
                <RotateCcw size={13} /> Reset Filters
              </button>
            )}
            <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
          </>} />
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 340px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {[
                    <SortHeader key="s" label="Society" k="society" sort={sort} onSort={toggleSort} />,
                    <SortHeader key="c" label="Customers" k="count" sort={sort} onSort={toggleSort} />,
                    <SortHeader key="a" label="Active" k="active" sort={sort} onSort={toggleSort} />,
                    "Own", "Normal", "Hot & Cold",
                    <SortHeader key="ch" label="Churned" k="churned" sort={sort} onSort={toggleSort} />,
                  ].map((h, idx) => (
                    <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => { const filterKey = expanded.get(g.society); const open = filterKey != null; const subCustomers = open ? sliceOf(g, filterKey) : []; return (
                  <React.Fragment key={i}>
                    <tr style={{ borderBottom: "1px solid rgba(0,0,0,.04)", background: open ? "rgba(8,128,90,0.06)" : undefined }}>
                      <td onClick={() => setExpandFilter(g.society, "all")} title="Click to see all customers" style={{ padding: "14px 18px", fontWeight: 600, color: g.society === NONE ? "#86868b" : "#0d2119", cursor: "pointer" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <ChevronRight size={15} style={{ color: "#08805A", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                          {g.society}
                        </span>
                      </td>
                      {numCell(g.count, "all", g, "#1D1D1F")}
                      {numCell(g.active, "active", g, "#08805A")}
                      {numCell(g.own, "own", g)}
                      {numCell(g.normal, "normal", g)}
                      {numCell(g.hotcold, "hotcold", g)}
                      {numCell(g.churned, "churned", g, g.churned ? "#DC4141" : "#475569")}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: "rgba(8,128,90,0.03)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                          <div style={{ overflowX: "auto", padding: "10px 18px 18px" }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", padding: "8px 2px 2px" }}>
                              {sliceLabel[filterKey]} ({subCustomers.length})
                            </div>
                            <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff", border: "1px solid rgba(0,0,0,.08)", borderRadius: 14, overflow: "hidden" }}>
                              <thead>
                                <tr style={{ background: "rgba(243,248,236,.92)" }}>
                                  {["Customer ID", "Name", "Purifier ID", "Device", "Phone", "Plan", "Status"].map(h => (
                                    <th key={h} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", padding: "10px 14px", whiteSpace: "nowrap", borderBottom: "1px solid rgba(0,0,0,.06)" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {subCustomers.map((c, ci) => {
                                  const st = String(c.status || "").toLowerCase();
                                  const rowBg = st === "inactive" ? "rgba(220,38,38,0.04)" : st === "dunning" ? "rgba(152,99,21,0.04)" : undefined;
                                  const stColor = st === "inactive" ? "#DC4141" : st === "dunning" ? "#986315" : st === "active" ? "#08805A" : "#86868B";
                                  const cell = { fontSize: 12.5, padding: "10px 14px", whiteSpace: "nowrap", textAlign: "center" };
                                  return (
                                  <tr key={ci} style={{ borderTop: ci ? "1px solid rgba(0,0,0,.04)" : "none", background: rowBg }}>
                                    <td style={{ ...cell, color: "#86868B" }}>{c.id || "—"}</td>
                                    <td style={{ ...cell, fontSize: 13, fontWeight: 600, color: "#1D1D1F" }}>{c.name || "—"}</td>
                                    <td style={cell}>{c.purifier_id || "—"}</td>
                                    <td style={cell}><DeviceTypeBadge purifierId={c.purifier_id} /></td>
                                    <td style={cell}>{fmtPhone(c.phone)}</td>
                                    <td style={cell}>{c.plan || "—"}</td>
                                    <td style={cell}>
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: stColor, background: st === "active" ? "rgba(8,128,90,0.12)" : st === "inactive" ? "rgba(220,38,38,0.12)" : "rgba(152,99,21,0.12)", textTransform: "capitalize" }}>
                                        {c.status || "—"}
                                      </span>
                                    </td>
                                  </tr>
                                  );
                                })}
                                {subCustomers.length === 0 && (
                                  <tr><td colSpan={7} style={{ padding: "16px 14px", textAlign: "center", fontSize: 12.5, color: "#86868B" }}>No {sliceLabel[filterKey].toLowerCase()} in this society.</td></tr>
                                )}
                                <tr style={{ background: "rgba(243,248,236,.6)", borderTop: "2px solid rgba(0,0,0,.06)" }}>
                                  <td colSpan={7} style={{ fontSize: 12, fontWeight: 700, color: "#0d2119", padding: "10px 14px", textAlign: "center" }}>
                                    Society total · {g.count} customer{g.count !== 1 ? "s" : ""} · {g.active} active{g.inactive ? ` · ${g.inactive} inactive` : ""}{g.dunning ? ` · ${g.dunning} dunning` : ""}{g.churned ? ` · ${g.churned} churned` : ""}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ); })}
                {filtered.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }}>Total ({filtered.length})</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }}>{tot.count}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#08805A" }}>{tot.active}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }}>{tot.own}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }}>{tot.normal}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }}>{tot.hotcold}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: tot.churned ? "#DC4141" : "#0d2119" }}>{tot.churned}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <Empty msg="No societies to show." />}
        </div>
      </div>
    </div>
  );
}

// All Customers — search a customer by Purifier ID, then open a FULL-PAGE
// customer view with two sub-screens (tabs): Profile and Transactions. Joins
// customers ↔ subscriptions ↔ invoices by any shared key (customer no. / zoho
// customer id / email). Installed date = the subscription start (activated) date.
// Group tickets into month buckets by created date, each carrying its tickets,
// oldest to newest. Undated tickets fall into an "Unknown" bucket at the end.
export function ticketMonthBuckets(tks) {
  const map = {};
  (tks || []).forEach(t => {
    const d = new Date(t.created);
    const key = isNaN(d.getTime()) ? "__unknown" : `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    (map[key] = map[key] || []).push(t);
  });
  const rows = Object.keys(map).filter(k => k !== "__unknown").sort().map(k => {
    const [y, m] = k.split("-").map(Number);
    return { key: k, label: `${new Date(y, m, 1).toLocaleDateString("en-US", { month: "short" })}'${String(y).slice(-2)}`, tickets: map[k] };
  });
  if (map.__unknown) rows.push({ key: "__unknown", label: "Unknown", tickets: map.__unknown });
  return rows;
}

// Break tickets down by the API "Issue Category" (issue type) field, most-common first.
export function ticketsByIssue(tks) {
  const m = {};
  (tks || []).forEach(t => { const k = String(t.issueCategory || "").trim() || "Uncategorised"; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }));
}

// Month-wise ticket count for a single customer; each month row expands to its
// Issue-Category (issue type) breakdown. Used by the Tickets + Ops sub-screens.
export function CustTicketMonths({ tickets, ops }) {
  const [open, setOpen] = useState({});
  const buckets = ticketMonthBuckets(tickets);
  const noun = ops ? "ops jobs" : "tickets";
  const toggle = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));
  return (
    <>
      <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Total {noun}</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{tickets.length}</div></div>
        <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Months with activity</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{buckets.length}</div></div>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Click a month to expand its issue-type (Issue Category) breakdown.</div>
      <Card pad={false} hover={false}>
        <Table head={["Month", ops ? "Ops jobs" : "Tickets"]} maxHeight="calc(100vh - 360px)">
          {buckets.map(b => {
            const isOpen = !!open[b.key];
            return (
              <React.Fragment key={b.key}>
                <tr onClick={() => toggle(b.key)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <ChevronRight size={14} color="var(--muted)" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                      <span style={{ fontWeight: 600, color: "var(--f)" }}>{b.label}</span>
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: "var(--f)", fontVariantNumeric: "tabular-nums" }}>{b.tickets.length}</td>
                </tr>
                {isOpen && ticketsByIssue(b.tickets).map(iss => (
                  <tr key={b.key + "|" + iss.label} style={{ borderBottom: "1px solid var(--border)", background: "var(--mint)" }}>
                    <td style={{ ...td, paddingLeft: 40, color: "var(--slate)" }}>{iss.label}</td>
                    <td style={{ ...td, color: "var(--slate)", fontVariantNumeric: "tabular-nums" }}>{iss.count}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
          {buckets.length > 0 && (
            <tr style={{ borderTop: "2px solid var(--border)", background: "var(--mint-2)" }}>
              <td style={{ ...td, fontWeight: 700 }}>Total</td>
              <td style={{ ...td, fontWeight: 800, color: "var(--forest)", fontVariantNumeric: "tabular-nums" }}>{tickets.length}</td>
            </tr>
          )}
        </Table>
        {tickets.length === 0 && <Empty msg={`No ${noun} found for this Purifier ID.`} />}
      </Card>
    </>
  );
}

// Spares (Parts_Used) used on a purifier's ops jobs, with a deterministic AI analysis.
export function CustSparesAnalysis({ tickets }) {
  const counts = {};
  let jobsWithParts = 0;
  (tickets || []).forEach(t => {
    const parts = parsePartsUsed(t.partsUsed);
    if (parts.length) jobsWithParts++;
    parts.forEach(p => { const k = String(p).trim(); if (k) counts[k] = (counts[k] || 0) + 1; });
  });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const total = rows.reduce((s, r) => s + r.count, 0);
  const top = rows[0];
  return (
    <Card pad={false} title="Spares used" sub={total ? `${total} part${total !== 1 ? "s" : ""} across ${jobsWithParts} ops job${jobsWithParts !== 1 ? "s" : ""}${top ? ` · most replaced: ${top.name} (${top.count}×)` : ""}` : "Parts replaced on this purifier's ops jobs"} style={{ marginTop: 16 }}>
      {rows.length === 0 ? <Empty msg="No spares recorded on this Purifier ID's ops jobs." /> : (
        <Table head={["Spare / part", "Times used"]}>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, textAlign: "center" }}>{r.name}</td>
              <td style={{ ...td, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.count}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--border)", background: "var(--mint-2)" }}>
            <td style={{ ...td, fontWeight: 700, textAlign: "center" }}>Total</td>
            <td style={{ ...td, fontWeight: 800, color: "var(--forest)", fontVariantNumeric: "tabular-nums" }}>{total}</td>
          </tr>
        </Table>
      )}
    </Card>
  );
}

// Per-invoice recognition breakdown for ONE invoice — due date, payment date,
// recharge tenure, and a month-by-month split of Earned revenue (accrual),
// Collected Revenue (cash-basis) and Outstanding revenue (receivable).
// Verified exactly against the user's reference sheet (Sanjith/MJR: due
// 7/26/2026, paid 8/1/2026, ₹350 recharge):
//   Recharge tenure: start 7/26/2026, end 8/25/2026, 31 days.
//   Earned revenue:     7/31/2026 → 68     ·  8/1/2026 → 282
//   Collected Revenue:  7/1/2026  → 0      ·  8/1/2026 → 350
//   Outstanding revenue:7/31/2026 → 350    ·  8/1/2026 → 0
// Same tenure/earned math as EarnedRevenue()'s per-invoice model, but shows
// EVERY month the validity window touches (including the accrual before
// actual payment, which EarnedRevenue's own table never surfaces — that
// table only shows an invoice's own paid-month slice). Collected/Outstanding
// stop being tracked once the invoice is actually paid (nothing left to
// resolve after that), while Earned keeps going into any spillover month.
export function invoiceMonthlyBreakdown(dueDate, paidDate, recharge) {
  const dd = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const pd = paidDate instanceof Date ? paidDate : new Date(paidDate);
  if (isNaN(dd.getTime()) || isNaN(pd.getTime()) || !(recharge > 0)) return null;
  const nb = new Date(dd.getFullYear(), dd.getMonth() + 1, dd.getDate() - 1); // validity end
  const tenureDays = Math.round((nb - dd) / 86400000) + 1;
  if (tenureDays <= 0) return null;

  const paidMonthStart = new Date(pd.getFullYear(), pd.getMonth(), 1);
  const dueMonthStart = new Date(dd.getFullYear(), dd.getMonth(), 1);
  const lastMonthStart = new Date(nb.getFullYear(), nb.getMonth(), 1);

  const earned = [], collected = [], outstanding = [];
  let cursor = new Date(dueMonthStart);
  while (cursor <= lastMonthStart) {
    const mStart = new Date(cursor);
    const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const isPaidMonth = cursor.getTime() === paidMonthStart.getTime();

    let overlapStart = dd > mStart ? dd : mStart;
    if (isPaidMonth && pd > overlapStart) overlapStart = pd; // late-payment clip, same as Earned Revenue
    const overlapEnd = nb < mEnd ? nb : mEnd;
    const days = overlapEnd >= overlapStart ? Math.round((overlapEnd - overlapStart) / 86400000) + 1 : 0;
    // Label the paid month's row with the actual payment date — but only when
    // that date genuinely falls within the days being counted. When payment
    // lands BEFORE the due date (an advance payment, in the same month as
    // the due date), the accrual for that month still starts at the due
    // date, so the payment date isn't part of it — fall back to the
    // month-end label used everywhere else, same as an unpaid month.
    const labelDate = (isPaidMonth && pd >= overlapStart && pd <= overlapEnd) ? pd : mEnd;
    // rangeStart/rangeEnd = the actual span of days counted for this month's
    // slice (e.g. 21 Jul – 31 Jul) — shown instead of a single date so it's
    // clear exactly which days each amount covers, not just when it's "as of".
    if (days > 0) earned.push({ date: labelDate, rangeStart: overlapStart, rangeEnd: overlapEnd, days, amount: (recharge * days) / tenureDays });

    if (cursor <= paidMonthStart) {
      if (isPaidMonth) { collected.push({ date: pd, amount: recharge }); outstanding.push({ date: pd, amount: 0 }); }
      else { collected.push({ date: mStart, amount: 0 }); outstanding.push({ date: mEnd, amount: recharge }); }
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  // Advance payment (paid before the due month even started) — the loop
  // above never reaches the paid month since it only walks forward from the
  // due month. Rare, but covers it: a single settled row at the paid date.
  if (collected.length === 0) { collected.push({ date: pd, amount: recharge }); outstanding.push({ date: pd, amount: 0 }); }

  return { tenureDays, validityStart: dd, validityEnd: nb, earned, collected, outstanding };
}

// Renders invoiceMonthlyBreakdown() as a small 3-column sheet (label · date ·
// value), styled after the reference spreadsheet the user shared — one
// underlined section header per group, one row per line item.
// Compact summary row for InvoiceBreakdownCard — an icon, a label (+ optional
// sub-line), and a right-aligned headline value. Keeps the always-visible
// part of the card small; the full month-by-month workings live behind the
// "Calculation" expand/collapse below.
export function InvoiceSummaryRow({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, background: "var(--mint)", color: "var(--teal-d)", flexShrink: 0 }}><Icon size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--f)" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--f)", whiteSpace: "nowrap", textAlign: "right" }}>{value}</div>
    </div>
  );
}

// GST is not a field the API returns anywhere on the invoice — this backs it
// out of the paid total assuming the standard flat 5% split (2.5% CGST +
// 2.5% SGST) confirmed against the user's own reference breakup sheet
// (₹409 total → ₹390 taxable + ₹10 CGST + ₹10 SGST). Independently-rounded
// components can be ±₹1 off the rounded total — same minor rounding gap
// present in that reference sheet itself, not something to chase away.
export function GstBreakupCard({ total }) {
  if (!(total > 0)) return null;
  const g = gstBreakup(total);
  const taxPct = Math.round((g.taxable / g.total) * 1000) / 10;
  const gstPct = Math.round((100 - taxPct) * 10) / 10;

  return (
    <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: 0 }}>GST Breakup</h3>
            <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Paid amount: {inr(Math.round(g.total))}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(8,128,90,0.12)", color: "#08805A" }}>5% GST Standard</span>
        </div>

        {/* Visual Ratio Bar */}
        <div style={{ margin: "14px 0 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "#86868B", marginBottom: 6 }}>
            <span>Taxable ({taxPct}%)</span>
            <span>Tax ({gstPct}%)</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.06)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${taxPct}%`, background: "#08805A", borderRadius: "999px 0 0 999px" }} />
            <div style={{ width: `${gstPct}%`, background: "#F59E0B", borderRadius: "0 999px 999px 0" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <InvoiceSummaryRow icon={Receipt} label="Taxable value" value={inr(Math.round(g.taxable))} />
          <InvoiceSummaryRow icon={Landmark} label="CGST (2.5%)" value={inr(Math.round(g.cgst))} />
          <InvoiceSummaryRow icon={MapPin} label="SGST (2.5%)" value={inr(Math.round(g.sgst))} />
          <InvoiceSummaryRow icon={Wallet} label="Total invoice value" value={inr(Math.round(g.total))} />
        </div>
      </div>
    </div>
  );
}

export function InvoiceBreakdownCard({ inv, recharge }) {
  const [open, setOpen] = useState(false); // "Calculation" detail — collapsed by default, this card is meant to read small
  const dd = inv.dueDate ? new Date(inv.dueDate) : null;
  const pd = new Date(inv.paidDate || inv.date);
  const b = (dd && !isNaN(dd.getTime())) ? invoiceMonthlyBreakdown(dd, pd, recharge) : null;
  if (!b) return null;
  const totalEarned = b.earned.reduce((s, r) => s + r.amount, 0);
  const totalCollected = b.collected.reduce((s, r) => s + r.amount, 0);
  const totalOutstanding = b.outstanding.reduce((s, r) => s + r.amount, 0);

  const DATE_W = 132, AMT_W = 84;
  const fmtDayMon = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const calcSection = (key, label) => (
    <div key={key} style={{ padding: "12px 18px 4px", fontSize: 10.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
  );
  const calcRow = (key, label, date, value, bold) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 18px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: bold ? 700 : 500, color: bold ? "var(--f)" : "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ width: DATE_W, flexShrink: 0, fontSize: 12, color: "var(--muted)", textAlign: "right", whiteSpace: "nowrap" }}>{date ? fmtDate(date) : "—"}</div>
      <div style={{ width: AMT_W, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "var(--f)", textAlign: "right" }}>{value}</div>
    </div>
  );
  const calcRowRange = (key, label, rangeStart, rangeEnd, value) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 18px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ width: DATE_W, flexShrink: 0, fontSize: 12, color: "var(--muted)", textAlign: "right", whiteSpace: "nowrap" }}>{rangeStart && rangeEnd ? `${fmtDayMon(rangeStart)} – ${fmtDayMon(rangeEnd)}` : "—"}</div>
      <div style={{ width: AMT_W, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "var(--f)", textAlign: "right" }}>{value}</div>
    </div>
  );
  return (
    <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: 0 }}>Current Paid Transaction</h3>
            <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Revenue recognition · Invoice {inv.number || inv.id}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(8,128,90,0.12)", color: "#08805A" }}>{b.tenureDays} Days Tenure</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <InvoiceSummaryRow icon={CalendarDays} label="Due date" value={fmtDate(dd)} />
          <InvoiceSummaryRow icon={CalendarClock} label="Payment date" value={fmtDate(pd)} />
          <InvoiceSummaryRow icon={CalendarRange} label="Recharge tenure" value={`${b.tenureDays} days`} sub={`${fmtDate(b.validityStart)} – ${fmtDate(b.validityEnd)}`} />
          <InvoiceSummaryRow icon={TrendingUp} label="Earned revenue" value={inr(Math.round(totalEarned))} />
          <InvoiceSummaryRow icon={Wallet} label="Collected Revenue" value={inr(Math.round(totalCollected))}
            sub={totalOutstanding > 0 ? `${inr(Math.round(totalOutstanding))} still outstanding` : "Fully collected"} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 18px", background: "rgba(8,128,90,0.08)", borderRadius: 12, border: "1px solid rgba(8,128,90,0.15)", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#08805A" }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {open ? "Hide calculation" : "Show calculation"}
        </button>
        {open && (
          <div style={{ marginTop: 10, background: "rgba(243,248,236,0.5)", borderRadius: 14, border: "1px solid rgba(8,128,90,0.12)", paddingBottom: 6, maxHeight: 280, overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 10, padding: "10px 18px 4px" }}>
              <div style={{ flex: 1 }} />
              <div style={{ width: DATE_W, flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "#86868B", textAlign: "right", textTransform: "uppercase" }}>Date</div>
              <div style={{ width: AMT_W, flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "#86868B", textAlign: "right", textTransform: "uppercase" }}>Amount</div>
            </div>
            {calcRow("due", "Due date", dd, inr(recharge), true)}
            {calcRow("paid", "Payment date", pd, inr(recharge), true)}
            {calcSection("s1", "Recharge tenure")}
            {calcRow("tstart", "Start date", b.validityStart, "")}
            {calcRow("tend", "End date", b.validityEnd, `${b.tenureDays} days`)}
            {calcSection("s2", "Earned revenue")}
            {b.earned.map((r, i) => calcRowRange(`e${i}`, "Earned revenue", r.rangeStart, r.rangeEnd, inr(Math.round(r.amount))))}
            {calcSection("s3", "Collected Revenue")}
            {b.collected.map((r, i) => calcRow(`c${i}`, "Collected Revenue", r.date, inr(Math.round(r.amount))))}
            {calcSection("s4", "Outstanding revenue")}
            {b.outstanding.map((r, i) => calcRow(`o${i}`, "Outstanding revenue", r.date, r.amount > 0 ? inr(Math.round(r.amount)) : "—"))}
          </div>
        )}
      </div>
    </div>
  );
}

function AllCustomersLoadingScreen() {
  return (
    <Loading
      title="Loading All Customers Directory"
      subtitle="Synchronizing DrinkPrime & Zoho Billing records…"
      showSkeleton={true}
    />
  );
}

export function AllCustomers() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [subtab, setSubtab] = useState("profile");   // profile | transactions | tickets | ops
  // Search-list filters (v2.29.99): Society/Status multi-select + a signup-date
  // range — "All Time" by default so the directory isn't silently narrowed on load.
  const [societyFilter, setSocietyFilter] = useState(null); // null = all
  const [statusFilter, setStatusFilter] = useState(null);  // null = all (unrestricted on load)
  const [stackFilter, setStackFilter] = useState(null);     // null = all; "Zoho" | "DP" (v2.29.113)
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(null); // null = all (v2.29.140)
  const [filterTypeFilter, setFilterTypeFilter] = useState(null); // null = all (v2.29.140)
  const [dateSel, setDateSel] = useState({ preset: "all", from: "", to: "" });
  const [connFilter, setConnFilter] = useState(null);
  // DP customers' Transactions sub-page (v2.29.113): reads the DrinkPrime
  // collections API directly (installationId = dp_installation_id), since a
  // DP-stack customer has no real Zoho invoices to show.
  const [dpTxns, setDpTxns] = useState(null); // null = not loaded yet, [] = loaded (empty or error)
  const [dpTxnsLoading, setDpTxnsLoading] = useState(false);
  const [dpTxnsErr, setDpTxnsErr] = useState(false);
  // DP customers' Sync History sub-page (v2.29.127): reads the DrinkPrime
  // device-sync API directly (deviceCode = this customer's Purifier ID —
  // already on hand from get-all-customers, no extra field needed). Latest
  // 10 syncs, newest first, exactly the one call the API needs.
  const [syncHistory, setSyncHistory] = useState(null); // null = not loaded yet, [] = loaded (empty or error)
  const [syncHistoryTotal, setSyncHistoryTotal] = useState(0);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);
  const [syncHistoryErr, setSyncHistoryErr] = useState(false);
  const [connCheck, setConnCheck] = useState(null);
  const [connChecking, setConnChecking] = useState(false);

  // ── DP Devices Conn: force-checked LIVE connectivity, all devices (v2.29.259) ──
  // The DP Devices Conn KPI card previously derived Connected/Disconnected purely
  // from each customer's cached `deviceStatus` field (whatever DrinkPrime last
  // reported into Zoho) — that can be stale by hours. `liveConn` holds a fresh,
  // per-device result from actually pinging the same conn-check API `runConnCheck`
  // above uses for one device, but run in bulk across every DP device (not just
  // whichever customer happens to be open): { [bid]: true|false|null } — true/false
  // is a real live answer, null means the check itself failed (network/API error),
  // in which case the KPI count below falls back to the cached deviceStatus for
  // that one device rather than silently miscounting it as offline.
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const [liveConn, setLiveConn] = useState({});
  const [liveConnChecking, setLiveConnChecking] = useState(false);
  const [liveConnProgress, setLiveConnProgress] = useState(null); // {done,total} while running
  // v2.29.278: persisted to localStorage (not just React state) — per explicit
  // user request ("If the page refreshed dont loose the last refresh
  // timestamp, Store it. Then based on the last refresh timestamp you do a
  // refresh after 30 mins"). Read back on mount so a real page reload knows
  // how much of the 30-minute window has already elapsed, instead of always
  // restarting the countdown from zero.
  const LAST_RUN_KEY = "pw_dp_conn_last_run";
  const [liveConnLastRun, _setLiveConnLastRun] = useState(() => {
    try { const v = localStorage.getItem(LAST_RUN_KEY); return v ? Number(v) : null; } catch { return null; }
  });
  const setLiveConnLastRun = (ts) => {
    _setLiveConnLastRun(ts);
    try { localStorage.setItem(LAST_RUN_KEY, String(ts)); } catch { /* private mode etc — state still updates */ }
  };
  // Lets the user stop/resume the 30-min auto-refresh loop (v2.29.263, explicit
  // request: "Add a stop refresh button in the DP Devices Conn KPI Card"). The
  // manual force-check button below works regardless of this — it only gates
  // the automatic recurring tick.
  //
  // v2.29.264 fix — the button flipped the React state correctly (which does
  // clear the setInterval), but two things still made it look broken: (1) a
  // bulk check already IN FLIGHT when Stop was clicked had no way to actually
  // halt — its already-dispatched fetches ran to completion and updated
  // liveConn/the KPI numbers a moment later, which reads as "it's still
  // refreshing"; fixed with a real AbortController the Stop button now fires,
  // so in-flight requests are killed immediately, not just future ones
  // prevented. (2) the on/off choice lived only in React state, so a plain
  // browser refresh (a full remount, not just a re-render) always came back
  // up with the default `true` and silently restarted auto-refresh even
  // after the user had explicitly stopped it — fixed by persisting the
  // choice to localStorage and reading it back on mount.
  const AUTO_REFRESH_KEY = "pw_dp_conn_autorefresh";
  const [autoRefreshOn, setAutoRefreshOn] = useState(() => {
    try { return localStorage.getItem(AUTO_REFRESH_KEY) !== "off"; } catch { return true; }
  });
  // A ref (not the `liveConnChecking` state) guards against overlapping runs —
  // the 30-min auto-tick below fires from a `setInterval` closure captured
  // once when `data` first loaded, so it can't be trusted to see the latest
  // React state; a ref is always current regardless of which render's
  // closure is calling it.
  const liveConnCheckingRef = useRef(false);
  // Holds the AbortController for whichever bulk check is currently in
  // flight (if any) — Stop calls .abort() on it for a real, immediate halt.
  const liveConnAbortRef = useRef(null);

  const runBulkConnCheck = async () => {
    if (liveConnCheckingRef.current) return; // don't stack overlapping runs (manual click during the 30-min auto tick)
    liveConnCheckingRef.current = true;
    const controller = new AbortController();
    liveConnAbortRef.current = controller;
    // v2.29.278: only WIFI-connectivity devices get force-checked — per
    // explicit user request ("Run a refresh only for wifi devices and skip
    // the BLE"). BLE (and GSM, which has no real connectivity to check at
    // all) fall back to whatever their cached deviceStatus already says, via
    // isDpOnline() below — they're just never included in this fetch loop.
    const list = (dataRef.current?.customers || []).filter(c => c.isDpCustomer && c.bid && String(c.connectivity || "").toUpperCase() === "WIFI");
    setLiveConnChecking(true);
    setLiveConnProgress({ done: 0, total: list.length });
    if (!list.length) {
      setLiveConnChecking(false);
      setLiveConnProgress(null);
      setLiveConnLastRun(Date.now());
      liveConnCheckingRef.current = false;
      return;
    }
    const CONCURRENCY = 6; // small pool — a real fleet can be hundreds of devices
    let cursor = 0, done = 0;
    const found = {};
    const worker = async () => {
      while (cursor < list.length) {
        if (controller.signal.aborted) return; // hard stop — don't start another device
        const c = list[cursor++];
        try {
          const r = await fetch("https://api.drinkprime.in/sponsor/device/life/conn-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ botId: c.bid, connectivity: c.connectivity || "WIFI" }),
            signal: controller.signal,
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const json = await r.json();
          // Same response convention already relied on by the single-device
          // "Ping Conn" check in the profile drawer below: {success:true} = online.
          found[c.bid] = json?.success === true;
        } catch (e) {
          if (controller.signal.aborted) return; // aborted mid-fetch — drop this result, don't mark it offline
          found[c.bid] = null; // unknown — KPI count falls back to cached deviceStatus
        }
        done++;
        setLiveConnProgress({ done, total: list.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
    if (!controller.signal.aborted) {
      setLiveConn(prev => ({ ...prev, ...found }));
      setLiveConnLastRun(Date.now());
    }
    setLiveConnChecking(false);
    setLiveConnProgress(null);
    liveConnCheckingRef.current = false;
    liveConnAbortRef.current = null;
  };

  const stopAutoRefresh = () => {
    setAutoRefreshOn(false);
    try { localStorage.setItem(AUTO_REFRESH_KEY, "off"); } catch { /* private mode etc — state still updates */ }
    if (liveConnAbortRef.current) liveConnAbortRef.current.abort(); // hard-kill anything in flight right now
    // Flip the UI immediately rather than waiting for the aborted fetches'
    // rejections to actually propagate back through runBulkConnCheck — the
    // whole point of "Stop" is that it reads as stopped the instant it's clicked.
    liveConnCheckingRef.current = false;
    setLiveConnChecking(false);
    setLiveConnProgress(null);
  };
  const resumeAutoRefresh = () => {
    setAutoRefreshOn(true);
    try { localStorage.setItem(AUTO_REFRESH_KEY, "on"); } catch { /* private mode etc — state still updates */ }
  };

  // Auto-run every 30 minutes — per explicit user request ("run a live
  // refresh every 30 mins to show me the live status"). Re-arms whenever the
  // Stop/Resume button flips `autoRefreshOn` back on; stopping it just clears
  // the pending timer — the manual refresh icon still force-checks on demand
  // either way. Reads the persisted on/off choice at mount time (the
  // `autoRefreshOn` initializer above), so a stopped state survives a real
  // browser refresh, not just a React re-render.
  //
  // v2.29.278: previously always called `runBulkConnCheck()` immediately on
  // mount, discarding however much of the 30-minute window had already
  // elapsed before this page load — per explicit user request ("based on the
  // last refresh timestamp you do a refresh after 30 mins"), this now reads
  // the persisted `liveConnLastRun` and only waits out whatever's actually
  // left of that window: a fresh page load 25 minutes after the last real
  // check schedules a check 5 minutes from now, not another full 30. No
  // persisted timestamp (or the 30 minutes already fully elapsed) still
  // means "check right now," same as before.
  useEffect(() => {
    if (!data || !autoRefreshOn) return;
    const THIRTY_MIN = 30 * 60 * 1000;
    const elapsed = liveConnLastRun ? Date.now() - liveConnLastRun : Infinity;
    const remaining = Math.max(0, THIRTY_MIN - elapsed);
    let intervalId;
    const timeoutId = setTimeout(() => {
      runBulkConnCheck();
      intervalId = setInterval(runBulkConnCheck, THIRTY_MIN);
    }, remaining);
    return () => { clearTimeout(timeoutId); if (intervalId) clearInterval(intervalId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, autoRefreshOn]);

  const runConnCheck = (botId, connectivity) => {
    if (!botId) return;
    setConnChecking(true);
    setConnCheck(null);
    fetch("https://api.drinkprime.in/sponsor/device/life/conn-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ botId, connectivity: connectivity || "WIFI" }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        return r.json();
      })
      .then(json => {
        setConnCheck(json);
      })
      .catch(err => {
        setConnCheck({ error: err.message || "Failed to check connection" });
      })
      .finally(() => {
        setConnChecking(false);
      });
  };

  useEffect(() => {
    if (sel && sel.isDpCustomer && sel.bid) {
      runConnCheck(sel.bid, sel.connectivity);
    } else {
      setConnCheck(null);
      setConnChecking(false);
    }
  }, [sel]);

  useEffect(() => {
    api.logView(user.username, "Viewed All Customers");
    Promise.all([
      customerApi.getCustomers().catch(() => []),
      billingApi.getSubscriptions().catch(() => []),
      billingApi.getInvoices().catch(() => []),
      ticketApi.getTickets().catch(() => []),
      api.getReferrers().catch(() => []),
      api.getReferees().catch(() => []),
      creditNoteApi.getCreditNotes().catch(() => []),
      billingApi.getSubmodules().catch(() => []),
    ]).then(([customers, subs, invs, tickets, referrers, referees, creditNotes, submodules]) => setData({ customers, subs, invs, tickets, referrers, referees, creditNotes, submodules }))
      .catch(() => setData({ customers: [], subs: [], invs: [], tickets: [], referrers: [], referees: [], creditNotes: [], submodules: [] }));
  }, []);
  useEffect(() => {
    // Fetches as soon as a DP customer is opened, regardless of which subtab
    // is active — not just when Transactions is clicked. The "at a glance"
    // LTV strip is visible on every subtab and (v2.29.126) is sourced from
    // this data for DP customers, so it needs to be loaded up front rather
    // than lazily on first Transactions visit.
    // v2.29.134: swapped to the payments/v1 endpoint per explicit request —
    // needs BOTH Purifier ID (deviceCode) and Installation ID, both already
    // on hand from get-all-customers. Response body is a flat array (not
    // {content:[...]} like the old v2 collections endpoint).
    if (!sel || !sel.isDpCustomer || !sel.dpInstallationId || !sel.purifier_id) { setDpTxns(null); return; }
    setDpTxns(null); setDpTxnsLoading(true); setDpTxnsErr(false);
    fetch(`https://api.drinkprime.in/payments/payments/payments/v1?loader=true&page=1&pageSize=100&deviceCode=${encodeURIComponent(sel.purifier_id)}&installationID=${encodeURIComponent(sel.dpInstallationId)}`)
      .then(r => { if (!r.ok) throw new Error(`Payments API ${r.status}`); return r.json(); })
      .then(json => setDpTxns(Array.isArray(json?.body) ? json.body : []))
      .catch(() => { setDpTxns([]); setDpTxnsErr(true); })
      .finally(() => setDpTxnsLoading(false));
  }, [sel]);
  useEffect(() => {
    // Lazy — only fetches once the Sync History subtab is actually opened
    // (unlike dpTxns above, nothing on the always-visible "at a glance" strip
    // depends on this, so there's no need to call a third-party API eagerly
    // for every DP customer opened).
    if (!sel || !sel.isDpCustomer || !sel.purifier_id || subtab !== "sync_history") return;
    setSyncHistory(null); setSyncHistoryLoading(true); setSyncHistoryErr(false);
    fetch(`https://api.drinkprime.in/sponsor/device/details/syncs?pageSize=10&page=1&orderDir=desc&orderBy=id&deviceCode=${encodeURIComponent(sel.purifier_id)}`)
      .then(r => { if (!r.ok) throw new Error(`Sync History API ${r.status}`); return r.json(); })
      .then(json => { setSyncHistory(Array.isArray(json?.body?.results) ? json.body.results : []); setSyncHistoryTotal(json?.body?.total_elements || 0); })
      .catch(() => { setSyncHistory([]); setSyncHistoryTotal(0); setSyncHistoryErr(true); })
      .finally(() => setSyncHistoryLoading(false));
  }, [sel, subtab]);
  if (!data) return <AllCustomersLoadingScreen />;
  const { customers, subs, invs, tickets, referrers, referees, creditNotes, submodules } = data;

  const keysOf = (c) => [c.id, c.zohoId, c.email].filter(Boolean).map(k => String(k).toLowerCase());
  const belongs = (rec, keys) => [rec.zohoCustomerId, rec.customerNumber, rec.zohoId, rec.email]
    .filter(Boolean).map(k => String(k).toLowerCase()).some(k => keys.includes(k));

  // Real Device Type / Filter Type, from the business-given plan catalog
  // (v2.29.132/133/138 — keyed by plan_code, NOT the purifier-ID prefix guess
  // `deviceType()` falls back to). Same join convention as Customer > Customers.
  const planMetaByKey = {};
  subs.forEach(s => [s.customerNumber, s.zohoCustomerId, s.email].forEach(k => {
    if (k && (s.planDeviceType || s.planFilterType)) {
      planMetaByKey[String(k).toLowerCase()] = { deviceType: s.planDeviceType, filterType: s.planFilterType };
    }
  }));
  const planMeta = (c) =>
    planMetaByKey[String(c.id).toLowerCase()] ??
    planMetaByKey[String(c.zohoId).toLowerCase()] ??
    planMetaByKey[String(c.email).toLowerCase()] ?? null;
  const normDt = (dt, purifierId = "") => {
    const pid = String(purifierId || "").trim().toUpperCase();
    if (pid.startsWith("OWND") || pid.startsWith("OWN")) return "Own Device";
    return dt === "Normal Device" ? "Normal" : dt || "";
  };
  const deviceTypeOf = (c) => normDt(planMeta(c)?.deviceType || deviceType(c.purifier_id), c.purifier_id);
  const filterTypeOf = (c) => planMeta(c)?.filterType || "";

  const ql = q.trim().toLowerCase();
  const withPur = customers.filter(c => c.purifier_id);
  // Search across Purifier ID, phone, name, email, Device Type and Filter Type.
  const matchesQ = (c) => [c.purifier_id, c.phone, c.name, c.email, deviceTypeOf(c), filterTypeOf(c)].some(f => String(f || "").toLowerCase().includes(ql));

  // Customer Stack (v2.29.113): is_dp_customer false → "Zoho", true → "DP".
  const stackOf = (c) => c.isDpCustomer ? "DP" : "Zoho";

  // Faceted filter options (v2.29.150, per explicit request — "if I filter
  // Row highlight (v2.29.261): Un-Installed (dp_details.device_status) now shares
  // the same red used for Dunning (Zoho subscription status, passed through as-is
  // by the mapper) — per explicit user request ("where the device status is
  // Un-Installed mark in red color for the entire row like how you have for
  // dunning"); was previously a separate yellow. Inactive (either stack's own
  // "inactive" status) stays its own orange.
  const normSt = (s) => String(s || "").toLowerCase().replace(/[\s_-]+/g, "");
  const rowTint = (c) => {
    const dev = normSt(c.deviceStatus);
    const st = normSt(c.status);
    if (dev.includes("uninstall") || st === "dunning") return { background: "var(--danger-t)" };
    if (st === "inactive" || dev === "inactive") return { background: "#FFF1E0" };
    return {};
  };

  // Faceted filter options: options list is computed dynamically per filter.
  // Society clause restored to the CRM-wide default-exclusion convention
  // (v2.29.137's isRealSociety — excludes blank/unknown society AND literal
  // "Apartment (Testing)" from the DEFAULT/unfiltered view only; explicitly
  // picking either from the dropdown still shows it) — a concurrent rewrite
  // of this screen had silently dropped it (found + restored v2.29.158).
  const facetPop = (exclude) => withPur.filter(c =>
    (exclude === "society" || (societyFilter === null ? isRealSociety(c.society) : societyFilter.includes(c.society))) &&
    (exclude === "status" || (statusFilter === null || statusFilter.includes(c.status))) &&
    (exclude === "stack" || (stackFilter === null || stackFilter.includes(stackOf(c)))) &&
    (exclude === "deviceType" || (deviceTypeFilter === null || deviceTypeFilter.includes(deviceTypeOf(c)))) &&
    (exclude === "filterType" || (filterTypeFilter === null || filterTypeFilter.includes(filterTypeOf(c)))) &&
    (exclude === "conn" || (connFilter === null ? true : (c.isDpCustomer && (connFilter === "connected" ? normSt(c.deviceStatus) === "active" : normSt(c.deviceStatus) !== "active")))) &&
    (!ql || matchesQ(c)));
  const societyOptions = Array.from(new Set(facetPop("society").map(c => c.society).filter(Boolean))).sort();
  const statusOptions = Array.from(new Set(facetPop("status").map(c => c.status).filter(Boolean))).sort();
  const stackOptions = Array.from(new Set(facetPop("stack").map(stackOf).filter(Boolean))).sort();
  const deviceTypeOptions = Array.from(new Set(facetPop("deviceType").map(deviceTypeOf).filter(Boolean))).sort();
  const filterTypeOptions = Array.from(new Set(facetPop("filterType").map(filterTypeOf).filter(Boolean))).sort();

  const filtered = withPur.filter(c =>
    (societyFilter === null ? isRealSociety(c.society) : societyFilter.includes(c.society)) &&
    (statusFilter === null || statusFilter.includes(c.status)) &&
    (stackFilter === null || stackFilter.includes(stackOf(c))) &&
    (deviceTypeFilter === null || deviceTypeFilter.includes(deviceTypeOf(c))) &&
    (filterTypeFilter === null || filterTypeFilter.includes(filterTypeOf(c))) &&
    (connFilter === null ? true : (c.isDpCustomer && (connFilter === "connected" ? normSt(c.deviceStatus) === "active" : normSt(c.deviceStatus) !== "active"))));

  const results = (ql ? filtered.filter(matchesQ) : filtered)
    .slice().sort((a, b) => String(a.purifier_id).localeCompare(String(b.purifier_id), undefined, { numeric: true }));

  // Reset filters helper
  const hasActiveFilters = societyFilter !== null || statusFilter !== null || stackFilter !== null || deviceTypeFilter !== null || filterTypeFilter !== null || connFilter !== null || q !== "";
  const handleResetFilters = () => {
    setSocietyFilter(null);
    setStatusFilter(null);
    setStackFilter(null);
    setDeviceTypeFilter(null);
    setFilterTypeFilter(null);
    setConnFilter(null);
    setQ("");
  };

  // Export — per explicit user request ("Also add a export option"). Exports
  // exactly the `results` population currently on screen (post search/filter),
  // matching every visible column plus phone/email for reference.
  const exportCsv = () => exportToCsv("prowater-all-customers.csv", [
    { label: "Purifier ID", get: c => c.purifier_id },
    { label: "Customer", get: c => c.name },
    { label: "Phone", get: c => fmtPhone(c.phone) },
    { label: "Email", get: c => c.email },
    { label: "Society", get: c => c.society },
    { label: "Plan", get: c => c.plan },
    { label: "Device Type", get: c => deviceTypeOf(c) },
    { label: "Stack", get: c => stackOf(c) },
    { label: "Status", get: c => c.status },
  ], results);

  // ── Dynamic KPI Card metrics computed off the active `results` population ──
  // Status logic for Active Customers: "Active", "In-active", "active", "dunning"
  const activeStatuses = ["active", "in-active", "dunning"];

  // ── Unique-customer identity (v2.29.257, keyed off the API's own ID as of
  // v2.29.262) ────────────────────────────────────────────────────────────
  // `results` is one row per purifier/device profile, not one row per
  // person — a real customer with 2 purifiers gets 2 rows. Roll those up to
  // a real per-customer count for the KPI card, per explicit user request
  // ("pull the records what i have in the get-all-customers API... that
  // also has an identifier in the API"). Key on `c.id` — which the mapper in
  // customerApi.getCustomers already resolves to `customer_number`, the ONE
  // identifier get-all-customers guarantees on every real record, Zoho or
  // DrinkPrime alike (confirmed against real examples of both the user
  // pasted: Zoho's "CUS-00010" and DP's "267907" — both `customer_number`,
  // while `zoho_customer_id` is an empty string on the DP one). This is more
  // reliable than the zohoId/email guess this used before v2.29.260's
  // removal of the old placeholder-email stub rows, since `id` is the
  // literal account identifier the API itself hands us, not a derived
  // guess. Falls back to email only in the unlikely case `id` itself is
  // blank (defensive — customer_number is present on every payload seen).
  const custKey = (c) => c.id ? `id:${String(c.id).toLowerCase()}` : c.email ? `e:${String(c.email).toLowerCase()}` : `p:${String(c.purifier_id || "").toLowerCase()}`;
  // Row-level duplicate flag (v2.29.267, explicit user request: "if there is
  // a duplicate row with the user in the table show with a warning sign").
  // Counts how many rows in the current view share the same custKey — any
  // count > 1 gets a warning badge on every one of those rows, whether it's
  // a genuine multi-device customer or an actual data duplicate; the badge's
  // job is just to make it visible so Business Ops can tell at a glance and
  // investigate, not to silently decide which case it is.
  const custKeyCounts = {};
  results.forEach(c => { const k = custKey(c); custKeyCounts[k] = (custKeyCounts[k] || 0) + 1; });
  const uniqueCustomerMap = new Map();
  results.forEach(c => {
    const k = custKey(c);
    const isActiveRow = activeStatuses.includes(String(c.status || "").toLowerCase());
    const prev = uniqueCustomerMap.get(k);
    if (!prev) uniqueCustomerMap.set(k, { isDp: c.isDpCustomer, isActive: isActiveRow });
    else { prev.isDp = prev.isDp || c.isDpCustomer; prev.isActive = prev.isActive || isActiveRow; }
  });
  const uniqueCustomers = Array.from(uniqueCustomerMap.values());
  const uniqueTotalCount = uniqueCustomers.length;
  const uniqueActiveCount = uniqueCustomers.filter(u => u.isActive).length;
  const uniqueInactiveCount = uniqueTotalCount - uniqueActiveCount;
  const uniqueDpCount = uniqueCustomers.filter(u => u.isDp).length;
  const uniqueZohoCount = uniqueTotalCount - uniqueDpCount;

  // Distinct societies in current view & DP / Zoho split
  const resultSocieties = Array.from(new Set(results.map(c => c.society).filter(isRealSociety)));
  const totalSocietiesCount = resultSocieties.length;
  // Named lists (not just counts) so the KPI card can actually show which
  // apartments are which — per explicit user request ("shows as 9 DP and 4
  // Zoho, so which are those 9... show the apartment names"). A society with
  // BOTH a DP and a Zoho customer in it appears in both lists (that overlap
  // is real — it's why dpSocCount+zohoSocCount can exceed totalSocietiesCount
  // — not a bug), sorted for a stable, readable tooltip/dropdown order.
  const dpSocietyNames = resultSocieties.filter(soc => results.some(c => c.society === soc && c.isDpCustomer)).sort();
  const zohoSocietyNames = resultSocieties.filter(soc => results.some(c => c.society === soc && !c.isDpCustomer)).sort();
  const dpSocCount = dpSocietyNames.length;
  const zohoSocCount = zohoSocietyNames.length;

  const ownCount = results.filter(c => deviceTypeOf(c) === "Own Device").length;
  const normalCount = results.filter(c => deviceTypeOf(c) === "Normal").length;
  const hotColdCount = results.filter(c => deviceTypeOf(c) === "Hot & Cold").length;

  // Prefers the live-checked result from runBulkConnCheck (a real API ping) for
  // any device that has one; only falls back to the cached deviceStatus field
  // for devices not yet checked (or whose check itself failed — liveConn holds
  // `null` for those, not a false "offline").
  const dpCustomers = results.filter(c => c.isDpCustomer);
  const isDpOnline = (c) => {
    const live = c.bid ? liveConn[c.bid] : undefined;
    return live === true || live === false ? live : normSt(c.deviceStatus) === "active";
  };
  const dpConnected = dpCustomers.filter(isDpOnline).length;
  const dpDisconnected = dpCustomers.length - dpConnected;

  // Connectivity-medium breakdown (v2.29.276, explicit user request: "if the
  // connectivity is BLE then show the count, WIFI then show the count...
  // and if its GSM show as No Connectivity icon"). `c.connectivity` comes
  // straight from the API's own dp_details.connectivity field (confirmed
  // real values: "WIFI", plus "BLE"/"GSM" per the user's own description) —
  // GSM devices have no WIFI/BLE transport to actually live-check, hence the
  // distinct "No Connectivity" treatment rather than lumping them in with
  // either real connectivity medium.
  const dpBleCount = dpCustomers.filter(c => String(c.connectivity || "").toUpperCase() === "BLE").length;
  const dpWifiCount = dpCustomers.filter(c => String(c.connectivity || "").toUpperCase() === "WIFI").length;
  const dpGsmCount = dpCustomers.filter(c => String(c.connectivity || "").toUpperCase() === "GSM").length;

  // ── Dynamic Filter Type counts computed off `results` ──
  const normFt = (ft) => {
    const s = String(ft || "").trim().toLowerCase();
    if (s.includes("uv")) return "UV";
    if (s.includes("alkal")) return "Alkaline";
    if (s.includes("copp")) return "Copper";
    if (s.includes("miner")) return "Mineral";
    return "Uncategorised";
  };
  const uvCount = results.filter(c => normFt(filterTypeOf(c)) === "UV").length;
  const alkalineCount = results.filter(c => normFt(filterTypeOf(c)) === "Alkaline").length;
  const copperCount = results.filter(c => normFt(filterTypeOf(c)) === "Copper").length;
  const mineralCount = results.filter(c => normFt(filterTypeOf(c)) === "Mineral").length;
  const uncategorisedCount = results.filter(c => normFt(filterTypeOf(c)) === "Uncategorised").length;

  const openCustomer = (c) => { setSel(c); setSubtab("profile"); };

  const stChip = (st) => {
    const paid = st === "paid";
    const bg = paid ? "var(--green-t)" : st === "failed" ? "var(--danger-t)" : "var(--amber-t)";
    const fg = paid ? "var(--green)" : st === "failed" ? "var(--danger)" : "var(--amber)";
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: bg, color: fg, textTransform: "capitalize" }}>{st}</span>;
  };

  // ── Full-page customer view (Profile + Transactions sub-screens) ───────────
  if (sel) {
    const keys = keysOf(sel);
    const custSubs = subs.filter(s => belongs(s, keys));
    const installed = custSubs.map(s => s.activatedAt || s.createdAt).filter(Boolean)
      .map(d => new Date(d)).filter(d => !isNaN(d.getTime())).sort((a, b) => a - b)[0] || null;
    const txns = invs.filter(i => belongs(i, keys)).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    // A DP-stack customer has no real Zoho invoices, so `txns` is always empty
    // for them — LTV (and everything derived from it below) was always ₹0 as
    // a result. For DP customers, total paid = sum of their DrinkPrime
    // payments (`dpTxns`, same feed the Transactions sub-screen already
    // shows) instead of the Zoho invoice total. `c.amount` per the
    // payments/v1 response shape (v2.29.134 — was `c.totalPaid` on the old
    // v2/collections endpoint).
    const totalPaid = sel.isDpCustomer
      ? (sel.total_paid || 0)
      : txns.filter(t => t.status === "paid").reduce((s, t) => s + (t.total || 0), 0);
    const planName = custSubs[0]?.plan || sel.plan;
    // Current paid transaction — the most recent paid invoice (txns is
    // already sorted newest-first) — feeds the revenue-recognition breakdown
    // card at the top of the Transactions sub-screen.
    const currentPaid = txns.find(t => t.status === "paid" && (t.total || 0) > 0 && t.dueDate);
    const currentPaidRecharge = currentPaid ? Math.max(0, (currentPaid.total || 0) - depositForCustomer(sel, currentPaid.plan || planName, currentPaid.total || 0, currentPaid.planCode)) : 0;
    // Ticket lookup by Purifier ID. Ops = the same filter the Ticketing > Ops tab uses (Issue Category ≠ Complaint).
    const purl = String(sel.purifier_id || "").trim().toLowerCase();
    const custTickets = purl ? tickets.filter(t => String(t.purifierId || "").trim().toLowerCase() === purl) : [];
    const opsTickets = custTickets.filter(t => String(t.issueCategory || "").trim().toLowerCase() !== "complaint");
    // Referral join: match this customer to a referrer record by any shared key.
    const custKeys = [sel.purifier_id, sel.id, sel.zohoId, sel.email, sel.phone, sel.referral_code].filter(Boolean).map(k => String(k).toLowerCase());
    const custRef = (referrers || []).find(r =>
      [r.purifierId, r.customerNumber, r.zohoId, r.email, r.phone, r.code].filter(Boolean).map(k => String(k).toLowerCase()).some(k => custKeys.includes(k)));
    const myReferees = custRef ? (referees || []).filter(e => e.referrerId === custRef.id) : [];
    const referralsDone = custRef?.totalReferred ?? myReferees.length;
    const refConverted = custRef?.converted ?? myReferees.filter(e => e.status === "paid").length;
    const refPending = custRef?.pending ?? Math.max(0, referralsDone - refConverted);
    const referralCode = sel.referral_code || custRef?.code || "—";
    // Credit notes (discounts) for this customer — joined by Zoho customer id.
    const custCreditNotes = (creditNotes || []).filter(cn => cn.zohoCustomerId && keys.includes(String(cn.zohoCustomerId).toLowerCase()))
      .slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const discountTotal = custCreditNotes.reduce((s, cn) => s + (cn.amount || 0), 0);
    const discountBalance = custCreditNotes.reduce((s, cn) => s + (cn.balance || 0), 0);
    const discountCount = custCreditNotes.length;
    const discountPct = totalPaid > 0 ? Math.round((discountTotal / totalPaid) * 100) : 0;
    // Refundable security deposit — the one-time tiered deposit on the largest paid invoice.
    const securityDeposit = txns.reduce((mx, t) => t.status === "paid" ? Math.max(mx, depositForCustomer(sel, planName, t.total, t.planCode)) : mx, 0);
    const paidCount = txns.filter(t => t.status === "paid").length;
    const complaintCount = custTickets.filter(t => String(t.issueCategory || "").trim().toLowerCase() === "complaint").length;
    // Spares used on this purifier's ops jobs (also drives the device score).
    const custSpares = {};
    let sparesJobs = 0;
    opsTickets.forEach(t => { const parts = parsePartsUsed(t.partsUsed); if (parts.length) sparesJobs++; parts.forEach(p => { const k = String(p).trim(); if (k) custSpares[k] = (custSpares[k] || 0) + 1; }); });
    const totalSpares = Object.values(custSpares).reduce((s, n) => s + n, 0);
    // ── Scores (0-5) ──────────────────────────────────────────────────────────
    const clamp5 = (v) => Math.max(0, Math.min(5, Math.round(v * 10) / 10));
    const tenureMonths = installed ? (Date.now() - new Date(installed).getTime()) / (30 * 86400000) : 0;
    // Customer: loyalty + value + engagement, dinged by complaints / heavy discounting.
    const customerScore = clamp5(
      (String(sel.status || "").toLowerCase() === "active" ? 1 : 0)
      + (totalPaid >= 10000 ? 1.4 : totalPaid >= 3000 ? 1.0 : totalPaid > 0 ? 0.5 : 0)
      + (referralsDone >= 3 ? 1.4 : referralsDone >= 1 ? 1.0 : 0)
      + (complaintCount === 0 ? 1.0 : complaintCount <= 1 ? 0.6 : complaintCount <= 2 ? 0.3 : 0)
      + (discountPct >= 30 ? 0 : 0.2)
      + (tenureMonths >= 6 ? 0.5 : 0.2));
    // Device health: complaints (real faults) are the primary driver. Spares + an
    // above-routine service rate are capped "wear" (max 2 pts) so a fault-free device
    // can't be pushed to 0 just by routine maintenance / high service volume.
    const svcPerMonth = tenureMonths >= 1 ? custTickets.length / tenureMonths : Math.min(6, custTickets.length);
    const deviceWear = Math.min(2, totalSpares * 0.12 + Math.max(0, svcPerMonth - 3) * 0.2);
    const deviceScore = clamp5(5 - Math.min(5, complaintCount * 1.3) - deviceWear);
    // Technician: quality of field service on this purifier (null when there are no ops jobs).
    let techScore = null;
    if (opsTickets.length > 0) {
      const withTiming = opsTickets.filter(t => jobDurationMin(t) != null).length;
      const tdsJobs = opsTickets.filter(t => Number(t.inputTds) > 0 && Number(t.outputTds) > 0);
      const goodTds = tdsJobs.filter(t => Number(t.outputTds) < Number(t.inputTds)).length;
      techScore = clamp5(3.2 + (withTiming / opsTickets.length) * 1.1 + (tdsJobs.length ? (goodTds / tdsJobs.length) * 0.7 : 0.4) - complaintCount * 0.25);
    }
    // Open (not closed/resolved) support tickets — same rule Ticketing itself uses.
    const openTicketsCount = custTickets.filter(t => !zdIsClosed(t.status)).length;
    // A DP-stack customer has no real Zoho invoices, so `txns` is always empty
    // for them — Last Payment was always blank as a result (same root cause
    // as v2.29.126's LTV bug). For DP customers, last payment = the most
    // recent DrinkPrime transaction by timeStamp (found via reduce, not
    // assumed array order, even though the live API happens to return them
    // newest-first already).
    const lastDpPayment = sel.isDpCustomer && dpTxns && dpTxns.length
      ? dpTxns.reduce((latest, c) => (!latest || new Date(c.timeStamp) > new Date(latest.timeStamp)) ? c : latest, null)
      : null;
    const lastPayment = sel.isDpCustomer
      ? (lastDpPayment ? { date: lastDpPayment.timeStamp } : null)
      : txns.find(t => t.status === "paid");
    // ── Customer 360 timeline — every payment, ticket, referral and discount
    // event for this customer, merged into one chronological feed so the whole
    // relationship can be scanned without clicking between tabs.
    const timelineEvents = [
      ...txns.map(t => ({ type: "payment", date: t.date, title: `Invoice ${t.number || t.id}`, sub: t.plan || "", amount: t.total, status: t.status })),
      ...custTickets.map(t => ({ type: "ticket", date: t.created, title: t.subject || t.ticketNo, sub: t.issueCategory || "", status: t.status })),
      ...myReferees.map(e => ({ type: "referral", date: e.date, title: `Referred ${e.name || "—"}`, sub: e.society || "", status: e.status })),
      ...custCreditNotes.map(cn => ({ type: "discount", date: cn.date, title: "Credit note issued", sub: "", amount: cn.amount })),
    ].map(e => ({ ...e, _ts: new Date(e.date).getTime() }))
      .filter(e => !isNaN(e._ts))
      .sort((a, b) => b._ts - a._ts);
    const timelineCfg = {
      payment: { icon: Wallet, color: "#1E9E4F", label: "Payment" },
      ticket: { icon: Ticket, color: "#986315", label: "Ticket" },
      referral: { icon: GitBranch, color: "#2A86D6", label: "Referral" },
      discount: { icon: Receipt, color: "#7D8A83", label: "Discount" },
    };
    // Field severity for at-a-glance scanning — only amber (warning) / red (critical) stand out.
    const statusActive = String(sel.status || "").toLowerCase() === "active";
    const sevColor = (sev) => sev === "red" ? "#DC4141" : sev === "amber" ? "#a86e00" : "var(--f)";
    // Render a field value, highlighted amber/red when concerning (plain otherwise).
    const cell = (text, sev) => <span style={{ color: sevColor(sev), fontWeight: sev ? 800 : undefined }}>{text}</span>;
    const tabBtn = (k, label, count) => (
      <button key={k} onClick={() => setSubtab(k)} style={{
        padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none",
        background: subtab === k ? "#08805A" : "rgba(0,0,0,0.05)",
        color: subtab === k ? "#ffffff" : "#86868B",
        borderRadius: 999, transition: "all .15s ease", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        {label}
        {count != null && count > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: subtab === k ? "rgba(255,255,255,0.25)" : "rgba(8,128,90,0.12)", color: subtab === k ? "#fff" : "#08805A" }}>{count}</span>
        )}
      </button>
    );

    // Score card with conditional colour formatting (green ≥4, amber ≥2.5, red < 2.5, grey = no data).
    const scoreCard = (label, score, Icon, hint) => {
      const na = score == null;
      const col = na ? "#86868B" : score >= 4 ? "#08805A" : score >= 2.5 ? "#986315" : "#DC4141";
      const bg = na ? "rgba(0,0,0,0.04)" : score >= 4 ? "rgba(8,128,90,0.12)" : score >= 2.5 ? "rgba(152,99,21,0.12)" : "rgba(220,65,65,0.12)";
      const word = na ? "No data" : score >= 4 ? "Good" : score >= 2.5 ? "Fair" : "Poor";
      return (
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: bg, color: col, flexShrink: 0 }}><Icon size={22} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>{label}</div>
            <div className="serif" style={{ fontWeight: 700, fontSize: 26, color: col, lineHeight: 1.1, margin: "2px 0" }}>{na ? "—" : score.toFixed(1)}<span style={{ fontSize: 14, color: "#86868B", fontWeight: 600 }}> / 5</span></div>
            <div style={{ fontSize: 11.5, color: col, fontWeight: 700 }}>{word}{hint ? <span style={{ color: "#86868B", fontWeight: 400 }}> · {hint}</span> : null}</div>
          </div>
        </div>
      );
    };

    return (
      <div className="fade-up ov-sans">
        <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

        {/* Back header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setSel(null)} style={{ ...btnGhost, padding: "8px 14px", borderRadius: 999, background: "rgba(0,0,0,0.04)", border: "none", color: "#1D1D1F", fontWeight: 600 }}><ChevronLeft size={16} /> All Customers</button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Purifier {sel.purifier_id}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F" }}>{sel.name || sel.purifier_id}</div>
          </div>
        </div>

        {/* At-a-glance strip — HIG glassmorphic cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 18 }}>
          {[
            { label: "Status", value: sel.status || "—", sev: statusActive ? null : "red", cap: true },
            { label: "Customer score", value: `${customerScore.toFixed(1)}/5` },
            { label: "LTV", value: inr(totalPaid), sev: totalPaid === 0 ? "red" : null },
            { label: "Open tickets", value: openTicketsCount, sev: openTicketsCount >= 3 ? "red" : openTicketsCount >= 1 ? "amber" : null },
            { label: "Last payment", value: lastPayment ? fmtDate(lastPayment.date) : "—" },
            { label: "Referral code", value: referralCode },
          ].map((g, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 4px 14px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#86868B" }}>{g.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: g.sev === "red" ? "#DC4141" : g.sev === "amber" ? "#986315" : "#1D1D1F", textTransform: g.cap ? "capitalize" : "none", marginTop: 2 }}>{g.value}</div>
            </div>
          ))}
        </div>

        {/* Sub-page Navigation Bar (Segmented Controls) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {tabBtn("timeline", "Timeline")}
          {tabBtn("profile", "Profile")}
          {tabBtn("transactions", "Transactions", sel.isDpCustomer ? (dpTxns || []).length : txns.length)}
          {tabBtn("tickets", "Tickets", custTickets.length)}
          {tabBtn("ops", "Ops", opsTickets.length)}
          {tabBtn("referral", "Referral", referralsDone)}
          {sel.isDpCustomer && tabBtn("sync_history", "Sync History", syncHistoryTotal)}
        </div>

        {/* ── Subtab 1: Timeline ─────────────────────────────────────────── */}
        {subtab === "timeline" && (
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Customer Activity Timeline</div>
              <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Complete chronological interaction history</div>
            </div>
            {timelineEvents.length === 0 && <Empty msg="No activity recorded for this customer yet." />}
            <div style={{ position: "relative", borderLeft: "2px solid rgba(8,128,90,0.15)", marginLeft: 16, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {timelineEvents.map((e, i) => {
                const cfg = timelineCfg[e.type];
                const Icon = cfg.icon;
                return (
                  <div key={i} style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: -27, top: 2, width: 12, height: 12, borderRadius: 999, background: cfg.color, border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(0,0,0,0.06)" }} />
                    <div style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F" }}>{e.title}</span>
                        <span style={{ fontSize: 12, color: "#86868B", whiteSpace: "nowrap" }}>{fmtDate(new Date(e.date))}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: `${cfg.color}15`, padding: "2px 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                        {e.sub && <span style={{ fontSize: 12, color: "#86868B" }}>{e.sub}</span>}
                        {e.amount != null && <span style={{ fontSize: 12, fontWeight: 700, color: "#08805A" }}>· {inr(e.amount)}</span>}
                        {e.status && <span style={{ fontSize: 11.5, color: "#86868B" }}>· {e.status}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Subtab 2: Profile ──────────────────────────────────────────── */}
        {subtab === "profile" && (
          <>
            <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22, marginBottom: 18 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Customer Profile & Attributes</div>
                <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Core parameters, account values, and installed device details</div>
              </div>
              {(() => {
                const leftCols = [
                  { k: "Purifier ID", v: sel.purifier_id },
                  { k: "Customer ID", v: sel.id },
                  sel.db_id ? { k: "Database ID", v: sel.db_id } : null,
                  { k: "Name", v: sel.name },
                  { k: "Email", v: sel.email },
                  { k: "Phone", v: sel.phone },
                  { k: "Referral code", v: referralCode },
                  { k: "Referrals made", v: referralsDone },
                  { k: "Support tickets", v: cell(custTickets.length, custTickets.length >= 8 ? "red" : custTickets.length >= 5 ? "amber" : null) },
                  sel.isDpCustomer && sel.bid ? {
                    k: "Bot ID",
                    v: (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span>{sel.bid}</span>
                        {sel.connectivity && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.06)", color: "#475569" }}>({sel.connectivity})</span>}
                        <button
                          onClick={() => runConnCheck(sel.bid, sel.connectivity)}
                          disabled={connChecking}
                          style={{
                            background: "rgba(8,128,90,0.1)",
                            color: "#08805A",
                            border: "1px solid rgba(8,128,90,0.2)",
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: connChecking ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          {connChecking ? "Checking..." : "Ping Conn"}
                        </button>
                      </div>
                    )
                  } : null,
                  sel.isDpCustomer && (connChecking || connCheck) ? {
                    k: "Live Conn Status",
                    v: (
                      connChecking ? (
                        <span style={{ color: "#86868B" }}>Checking connection...</span>
                      ) : connCheck.error ? (
                        <span style={{ 
                          fontSize: 11.5, 
                          fontWeight: 700, 
                          padding: "4px 10px", 
                          borderRadius: 999, 
                          background: "rgba(220,65,65,0.12)", 
                          color: "#DC4141",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5
                        }}>
                          <WifiOff size={13} /> Disconnected ({connCheck.error})
                        </span>
                      ) : connCheck.success === true ? (
                        <span style={{ 
                          fontSize: 11.5, 
                          fontWeight: 700, 
                          padding: "4px 10px", 
                          borderRadius: 999, 
                          background: "rgba(8,128,90,0.12)", 
                          color: "#08805A",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5
                        }}>
                          <Wifi size={13} /> {String(sel.connectivity || 'wifi').toLowerCase()} is connected
                        </span>
                      ) : (
                        <span style={{ 
                          fontSize: 11.5, 
                          fontWeight: 700, 
                          padding: "4px 10px", 
                          borderRadius: 999, 
                          background: "rgba(220,65,65,0.12)", 
                          color: "#DC4141",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5
                        }}>
                          <WifiOff size={13} /> Disconnected
                        </span>
                      )
                    )
                  } : null,
                ].filter(Boolean);

                const rightCols = [
                  { k: "Society", v: sel.society },
                  { k: "Plan", v: planName },
                  sel.plan_name ? { k: "Plan Name (API)", v: sel.plan_name } : null,
                  sel.partner_type ? { k: "Partner Type", v: sel.partner_type } : null,
                  { k: "Status", v: cell(<span style={{ textTransform: "capitalize" }}>{sel.status || "—"}</span>, statusActive ? null : "red") },
                  { k: "Installed date", v: installed ? fmtDate(installed) : "—" },
                  { k: "LTV (lifetime value)", v: cell(inr(totalPaid), totalPaid === 0 ? "red" : null) },
                  { k: "Security Deposit", v: inr(securityDeposit) },
                  { k: "Discounts (credit notes)", v: <>{cell(inr(discountTotal), discountPct >= 30 ? "red" : discountPct >= 20 ? "amber" : null)}{discountCount ? <span style={{ color: "#86868B", fontWeight: 400 }}> · {discountCount} note{discountCount !== 1 ? "s" : ""}{discountBalance > 0 ? ` · ${inr(discountBalance)} balance` : ""}</span> : null}</> },
                  { k: "Complaints", v: cell(complaintCount, complaintCount >= 2 ? "red" : complaintCount >= 1 ? "amber" : null) },
                  sel.wallet_id ? { k: "Wallet ID", v: sel.wallet_id } : null,
                ].filter(Boolean);

                const maxRows = Math.max(leftCols.length, rightCols.length);

                return (
                  <div className="profile-grid">
                    <style>{`
                      .profile-grid { display: grid; grid-template-columns: 1fr; gap: 0 40px; }
                      @media(min-width: 768px) { .profile-grid { grid-template-columns: 1fr 1fr; } }
                    `}</style>
                    {Array.from({ length: maxRows }).map((_, i) => (
                      <React.Fragment key={i}>
                        {leftCols[i] ? <DefRow k={leftCols[i].k} v={leftCols[i].v} /> : <DefRow k=" " v=" " />}
                        {rightCols[i] ? <DefRow k={rightCols[i].k} v={rightCols[i].v} /> : <DefRow k=" " v=" " />}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Score Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 18 }}>
              {scoreCard("Customer score", customerScore, Award)}
              {scoreCard("Technician score", techScore, Wrench, opsTickets.length ? `${opsTickets.length} ops job${opsTickets.length !== 1 ? "s" : ""}` : "no jobs")}
              {scoreCard("Device score", deviceScore, Cpu, `${complaintCount} complaint${complaintCount !== 1 ? "s" : ""} · ${totalSpares} spare${totalSpares !== 1 ? "s" : ""}`)}
            </div>

            <CustSparesAnalysis tickets={opsTickets} />
          </>
        )}

        {/* ── Subtab 3: Transactions ─────────────────────────────────────── */}
        {subtab === "transactions" && (
          sel.isDpCustomer ? (
            <>
              {/* Summary Strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Total Paid</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F", marginTop: 4 }}>{inr((dpTxns || []).reduce((s, c) => s + (c.amount || 0), 0))}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Collections Count</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 4 }}>{(dpTxns || []).length}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Installation ID</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", marginTop: 6 }}>{sel.dpInstallationId}</div>
                </div>
              </div>

              {/* Transactions Table Container */}
              <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(243,248,236,.4)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Payment &amp; Collections History</div>
                    <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>DrinkPrime installation collection history</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(8,128,90,0.12)", color: "#08805A" }}>
                    {(dpTxns || []).length} Collections
                  </span>
                </div>
                {dpTxnsLoading && <Loading title="Loading Collections History" subtitle="Synchronizing DrinkPrime payment records…" showSkeleton={false} />}
                {!dpTxnsLoading && (
                  <>
                    <Table head={["Date", "Transaction Key", "Amount", "Litres", "Valid Period", "Payment Mode", "Status"]} maxHeight="calc(100vh - 340px)">
                      {(dpTxns || []).map((c, ci) => {
                        const paid = String(c.status || "").toUpperCase();
                        const ok = paid === "SUCCESS" || paid === "COMPLETED";
                        // Index in the key, not just txnId — confirmed live that a
                        // setup-fee row and its paired first-recharge row can share
                        // the exact same txnId (real data, not a mock artifact).
                        return (
                          <tr key={`${c.txnId || "row"}-${ci}`} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                            <td style={td}>{c.timeStamp ? fmtTime(c.timeStamp) : "—"}</td>
                            <td style={td}>{c.txnId || "—"}</td>
                            <td style={{ ...td, fontWeight: 700, color: "#1D1D1F" }}>{inr(c.amount)}</td>
                            <td style={td}>{c.litres ?? "—"}</td>
                            <td style={td}>{fmtDate(c.valStart)} → {fmtDate(c.valEnd)}</td>
                            <td style={td}>{c.mode || c.paymentType || "—"}</td>
                            <td style={td}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: ok ? "rgba(8,128,90,0.12)" : "rgba(220,65,65,0.12)", color: ok ? "#08805A" : "#DC4141", textTransform: "capitalize" }}>{(paid || "—").toLowerCase()}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </Table>
                    {(!dpTxns || dpTxns.length === 0) && (
                      <Empty msg={dpTxnsErr ? "Could not load DrinkPrime collections for this installation." : "No DrinkPrime collections found for this installation."} />
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Summary Strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Total Lifetime Paid</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F", marginTop: 4 }}>{inr(totalPaid)}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Total Invoices</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 4 }}>{txns.length}</div>
                </div>
              </div>

              {/* Transactions Table Container */}
              <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", overflow: "hidden", marginBottom: 18 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(243,248,236,.4)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Payment &amp; Invoice History</div>
                    <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>All billed transactions and payment statuses</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(8,128,90,0.12)", color: "#08805A" }}>
                    {txns.length} Invoices
                  </span>
                </div>
                <Table head={["Date", "Invoice", "Amount", "Start Date", "End Date", "Status"]} maxHeight="calc(100vh - 340px)">
                  {(() => {
                    // Start/End Date come from get-all-submodules (v2.29.136,
                    // per explicit request) — current_term_starts_at/
                    // current_term_ends_at, joined by invoice_number
                    // (primary) or transaction_id (fallback), same two-key
                    // pattern Analytics > Earned Revenue already uses for
                    // this exact feed. NOTE: `submodules` here is already run
                    // through mapSubmodule() (billingApi.getSubmodules()), so
                    // its real field names are camelCase — .number (was
                    // invoice_number), .id (was transaction_id), .termStart/
                    // .termEnd (was current_term_starts_at/_ends_at) — NOT
                    // the raw snake_case names the API itself returns. The
                    // previous version of this join read the raw snake_case
                    // names directly, which never matched the mapped object
                    // and silently always fell through to the invoice's own
                    // single `date` for both Start AND End Date.
                    const submodulesByKey = (submodules || []).reduce((acc, s) => {
                      const invNum = String(s.number || "").trim().toLowerCase();
                      const txnId = String(s.id || "").trim().toLowerCase();
                      if (invNum) acc[invNum] = s;
                      if (txnId) acc[txnId] = s;
                      return acc;
                    }, {});

                    return txns.map(t => {
                      const invKey = String(t.number || "").trim().toLowerCase();
                      const txnKey = String(t.id || "").trim().toLowerCase();
                      const subMatch = submodulesByKey[invKey] || submodulesByKey[txnKey];

                      const startDate = subMatch?.termStart || t.date;
                      let endDate = subMatch?.termEnd || t.dueDate;

                      if (!endDate && startDate) {
                        const dt = new Date(startDate);
                        if (!isNaN(dt.getTime())) {
                          dt.setMonth(dt.getMonth() + 1);
                          dt.setDate(dt.getDate() - 1);
                          endDate = dt;
                        }
                      }
                      return (
                        <tr key={t.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                          <td style={td}>{fmtDate(t.date)}</td>
                          <td style={td}>{t.number || t.id}</td>
                          <td style={{ ...td, fontWeight: 700, color: "#1D1D1F" }}>{inr(t.total)}</td>
                          <td style={td}>{startDate ? fmtDate(startDate) : "—"}</td>
                          <td style={td}>{endDate ? fmtDate(endDate) : "—"}</td>
                          <td style={td}>{stChip(t.status)}</td>
                        </tr>
                      );
                    });
                  })()}
                </Table>
                {txns.length === 0 && <Empty msg="No transactions found for this customer." />}
              </div>

              {/* 2-Column Grid: GST Breakup + Revenue Recognition */}
              {(currentPaid || (currentPaid && currentPaidRecharge > 0)) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                  {currentPaid && <GstBreakupCard total={currentPaid.total} />}
                  {currentPaid && currentPaidRecharge > 0 && <InvoiceBreakdownCard inv={currentPaid} recharge={currentPaidRecharge} />}
                </div>
              )}
            </>
          )
        )}

        {/* ── Subtab 4 & 5: Tickets & Ops ────────────────────────────────── */}
        {subtab === "tickets" && <CustTicketMonths tickets={custTickets} />}
        {subtab === "ops" && <CustTicketMonths tickets={opsTickets} ops />}

        {/* ── Subtab 6: Referral ─────────────────────────────────────────── */}
        {subtab === "referral" && (
          <>
            {/* Hero KPI Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 18 }}>
              {/* v2.29.274: was a gradient hero card — converted to match its
                  siblings (plain white card), per explicit user request to
                  make all hero cards the same white style as normal cards. */}
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Referrals Made</div>
                <div className="serif" style={{ fontSize: 26, fontWeight: 700, color: "#08805A", marginTop: 4 }}>{referralsDone}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Converted</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#08805A", marginTop: 4 }}>{refConverted}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Pending</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#986315", marginTop: 4 }}>{refPending}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Free Months Earned</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#08805A", marginTop: 4 }}>{custRef?.freeMonthsEarned ?? 0}</div>
              </div>
            </div>

            {/* Referred Customer Table */}
            <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", overflow: "hidden" }}>
              <Table head={["Referred customer", "Society", "Status", "Referred on"]} maxHeight="calc(100vh - 340px)">
                {myReferees.map(e => (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td style={{ ...td, fontWeight: 600, color: "#1D1D1F" }}>{e.name || "—"}</td>
                    <td style={td}>{e.society || "—"}</td>
                    <td style={td}>{stChip(e.status)}</td>
                    <td style={td}>{e.date ? fmtDate(e.date) : "—"}</td>
                  </tr>
                ))}
              </Table>
              {myReferees.length === 0 && <Empty msg={referralsDone ? "Referral count recorded, but no referee details are available." : "This customer has not referred anyone yet."} />}
            </div>
          </>
        )}

        {/* ── Subtab 7: Sync History (DP customers only) ────────────────────
            v2.29.127 — device-sync log from DrinkPrime, keyed by this
            customer's Purifier ID (deviceCode). Latest 10 syncs, newest
            first, straight from the one API call this needs. */}
        {subtab === "sync_history" && sel.isDpCustomer && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Total Syncs</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F", marginTop: 4 }}>{syncHistoryTotal || (syncHistory || []).length}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Latest Sync</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#08805A", marginTop: 6 }}>{(syncHistory && syncHistory[0]) ? fmtTime(syncHistory[0].syncDate) : "—"}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Consumed Litres</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F", marginTop: 4 }}>{(syncHistory && syncHistory[0]) ? syncHistory[0].consumedLitres ?? "—" : "—"}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Network</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", marginTop: 6 }}>{(syncHistory && syncHistory[0]?.networkId) || "—"}</div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", overflow: "hidden" }}>
              {syncHistoryLoading && <Loading title="Loading Sync History" subtitle="Synchronizing IoT meter sync records…" showSkeleton={false} />}
              {!syncHistoryLoading && (
                <>
                  <Table head={["Sync Time", "Network", "Consumed Litres", "Total Litres", "Balance Litres", "Paid Upto"]} maxHeight="calc(100vh - 340px)">
                    {(syncHistory || []).map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ ...td, fontWeight: 600, color: "#1D1D1F", whiteSpace: "nowrap" }}>{fmtTime(s.syncDate)}</td>
                        <td style={td}>{s.networkId || "—"}</td>
                        <td style={td}>{s.consumedLitres ?? "—"}</td>
                        <td style={td}>{s.totalLitres ?? "—"}</td>
                        <td style={{ ...td, fontWeight: 600, color: "#08805A" }}>{(s.totalLitres != null && s.consumedLitres != null) ? (s.totalLitres - s.consumedLitres) : "—"}</td>
                        <td style={td}>{s.paidUpto ? fmtDate(s.paidUpto) : "—"}</td>
                      </tr>
                    ))}
                  </Table>
                  {(!syncHistory || syncHistory.length === 0) && (
                    <Empty msg={syncHistoryErr ? "Could not load sync history for this device." : "No sync history found for this device."} />
                  )}
                </>
              )}
            </div>
            {!syncHistoryLoading && syncHistory && syncHistory.length > 0 && (
              <div style={{ fontSize: 12, color: "#86868B", marginTop: 10, textAlign: "right" }}>
                Showing latest {syncHistory.length} of {syncHistoryTotal || syncHistory.length} total syncs.
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Search list ────────────────────────────────────────────────────────────

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>
      {/* Dynamic KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, marginBottom: 16 }}>
        {/* 1. Total Societies Card — DP/Zoho split moved beside the number
            (v2.29.263), using the wide hero card's right-side space instead
            of a small caption line underneath, per explicit user request
            ("show the split of it, on the right side of the KPI card there
            is much space"). */}
        {/* v2.29.274: converted from a gradient hero card to the same white
            style as its siblings (Active Customers, DP Devices Conn, Device
            Mix) — per explicit user request to make all hero cards the same
            white style as normal cards, so any percentage/status text is
            always plain colored text on white. */}
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Total Societies</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
              <Boxes size={17} color="#08805A" />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <div className="serif" style={{ fontWeight: 700, fontSize: 28, color: "#1D1D1F", lineHeight: 1.1 }}>
              {totalSocietiesCount.toLocaleString("en-IN")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Clicking either stat filters the table below by Customer Stack
                  (the existing filter, reused) so the exact apartments are
                  right there in the Society column; the tooltip also lists
                  them directly — per explicit user request ("shows as 9 DP
                  and 4 Zoho, so which are those 9... show the apartment
                  names"). A society with both a DP and a Zoho customer counts
                  toward both sides — that overlap is real data, not a bug. */}
              <div
                onClick={() => setStackFilter(f => (f && f.length === 1 && f[0] === "DP") ? null : ["DP"])}
                title={dpSocietyNames.length ? `DP societies (click to filter the table):\n${dpSocietyNames.join("\n")}` : "No DP societies in the current view"}
                style={{ textAlign: "center", cursor: dpSocietyNames.length ? "pointer" : "default" }}
              >
                <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: "#2A86D6", lineHeight: 1 }}>{dpSocCount}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#86868B", marginTop: 3 }}>DP</div>
              </div>
              <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.1)" }} />
              <div
                onClick={() => setStackFilter(f => (f && f.length === 1 && f[0] === "Zoho") ? null : ["Zoho"])}
                title={zohoSocietyNames.length ? `Zoho societies (click to filter the table):\n${zohoSocietyNames.join("\n")}` : "No Zoho societies in the current view"}
                style={{ textAlign: "center", cursor: zohoSocietyNames.length ? "pointer" : "default" }}
              >
                <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: "#08805A", lineHeight: 1 }}>{zohoSocCount}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#86868B", marginTop: 3 }}>Zoho</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Active Customers Card */}
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Active Customers</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
              <UserRound size={17} color="#08805A" />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 4px" }}>
            <span className="serif" style={{ fontWeight: 700, fontSize: 28, color: "#1D1D1F", lineHeight: 1.1 }}>{uniqueActiveCount.toLocaleString("en-IN")}</span>
            <span style={{ fontSize: 12, color: "#86868B" }}>of {uniqueTotalCount.toLocaleString("en-IN")} unique customers</span>
          </div>
          {/* Collapsed to one line (v2.29.268, explicit request: "show this in 1
              line itself (140 DP · 96 Zoho | 22 Inactive customers)") — was two
              separate lines before. */}
          <div style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ color: "#08805A", fontWeight: 600 }}>{uniqueDpCount.toLocaleString("en-IN")} DP · {uniqueZohoCount.toLocaleString("en-IN")} Zoho</span>
            <span style={{ color: "#C6C6CB" }}> | </span>
            <span style={{ color: "#DC4141", fontWeight: 600 }}>{uniqueInactiveCount.toLocaleString("en-IN")} Inactive customers</span>
          </div>
        </div>

        {/* 3. DP Devices Connection Card (only visible/calculated for DP stack) */}
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>DP Devices Conn</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => (autoRefreshOn ? stopAutoRefresh() : resumeAutoRefresh())}
                title={autoRefreshOn ? "Stop the 30-min auto-refresh (manual refresh still works)" : "Resume the 30-min auto-refresh"}
                style={{
                  width: 26, height: 26, borderRadius: 8, padding: 0,
                  background: autoRefreshOn ? "rgba(220,65,65,0.08)" : "rgba(8,128,90,0.08)",
                  border: autoRefreshOn ? "1px solid rgba(220,65,65,0.15)" : "1px solid rgba(8,128,90,0.15)",
                  display: "grid", placeItems: "center", cursor: "pointer",
                }}
              >
                {autoRefreshOn ? <PauseCircle size={13} color="#DC4141" /> : <PlayCircle size={13} color="#08805A" />}
              </button>
              <button
                onClick={runBulkConnCheck}
                disabled={liveConnChecking}
                title={
                  liveConnChecking
                    ? `Force-checking devices… ${liveConnProgress?.done ?? 0}/${liveConnProgress?.total ?? 0}`
                    : liveConnLastRun
                    ? `Force-check all DP devices now — last run ${new Date(liveConnLastRun).toLocaleTimeString("en-IN")}`
                    : "Force-check all DP devices now"
                }
                style={{
                  width: 26, height: 26, borderRadius: 8, padding: 0,
                  background: "rgba(8,128,90,0.08)", border: "1px solid rgba(8,128,90,0.15)",
                  display: "grid", placeItems: "center",
                  cursor: liveConnChecking ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={13} color="#08805A" style={liveConnChecking ? { animation: "pw-spin 0.9s linear infinite" } : undefined} />
              </button>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <Wifi size={17} color="#08805A" />
              </div>
            </div>
          </div>
          {/* v2.29.277: the BLE/WIFI/GSM connectivity-medium counts were on
              their own row in v2.29.276, which grew this card taller than its
              siblings (Total Societies/Active Customers/Device Mix all
              stretch to match the tallest card in the grid row, per explicit
              user feedback — "why did you expand the card, there was already
              space, adjust in that"). Folded them into this existing
              number+subtitle row instead, using the row's own already-unused
              trailing width — net card height is back to what it was before
              v2.29.276. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 4px", flexWrap: "wrap" }}>
            <span className="serif" style={{ fontWeight: 700, fontSize: 28, color: "#1D1D1F", lineHeight: 1.1 }}>{dpConnected}</span>
            <span style={{ fontSize: 12, color: "#86868B" }}>of {dpCustomers.length} online</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, marginLeft: "auto" }}>
              <span title={`${dpBleCount} device${dpBleCount === 1 ? "" : "s"} on BLE`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#2A86D6" }}>
                <Bluetooth size={11.5} color="#2A86D6" /> {dpBleCount}
              </span>
              <span title={`${dpWifiCount} device${dpWifiCount === 1 ? "" : "s"} on WIFI`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#08805A" }}>
                <Wifi size={11.5} color="#08805A" /> {dpWifiCount}
              </span>
              <span title={`${dpGsmCount} device${dpGsmCount === 1 ? "" : "s"} on GSM — no WIFI/BLE connectivity to live-check`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#86868B" }}>
                <Ban size={11.5} color="#86868B" /> {dpGsmCount}
              </span>
            </span>
          </div>
          {/* Collapsed to one line (v2.29.268, explicit request: "show this in
              1 line itself (122 | 18 | Not yet force-checked · auto-refresh
              stopped)") — the connected/disconnected chips and the status
              caption used to be two separate lines. The caption is the part
              most likely to overflow a narrow card, so it alone gets
              min-width:0 + ellipsis inside the flex row rather than the whole
              line wrapping. */}
          <div style={{ fontSize: 11.5, color: "#86868B", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span
              onClick={() => setConnFilter(f => f === "connected" ? null : "connected")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#08805A",
                fontWeight: 700,
                cursor: "pointer",
                background: connFilter === "connected" ? "rgba(8,128,90,0.12)" : "transparent",
                padding: "2px 6px",
                borderRadius: 6,
                border: connFilter === "connected" ? "1px solid rgba(8,128,90,0.3)" : "1px solid transparent",
                flex: "0 0 auto",
              }}
              title={`${dpConnected} connected — click to filter`}
            >
              <Wifi size={12.5} color="#08805A" /> {dpConnected}
            </span>
            <span style={{ color: "#C6C6CB", flex: "0 0 auto" }}>|</span>
            <span
              onClick={() => setConnFilter(f => f === "disconnected" ? null : "disconnected")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#DC4141",
                fontWeight: 700,
                cursor: "pointer",
                background: connFilter === "disconnected" ? "rgba(220,65,65,0.12)" : "transparent",
                padding: "2px 6px",
                borderRadius: 6,
                border: connFilter === "disconnected" ? "1px solid rgba(220,65,65,0.3)" : "1px solid transparent",
                flex: "0 0 auto",
              }}
              title={`${dpDisconnected} disconnected — click to filter`}
            >
              <WifiOff size={12.5} color="#DC4141" /> {dpDisconnected}
            </span>
            <span style={{ color: "#C6C6CB", flex: "0 0 auto" }}>|</span>
            <span style={{ fontSize: 10, color: "#B0B0B5", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {/* v2.29.275 replaced the vague "auto-refreshes every 30 min"
                  with the actual computed next-check clock time (last run +
                  30 min). v2.29.278 dropped the "auto-refresh stopped" suffix
                  entirely — per explicit user request ("remove the text
                  (auto-refresh stopped)") — the Stop/Resume button's own
                  icon already communicates that state, so the caption now
                  just quietly omits "next refresh" rather than announcing
                  the stop a second time. */}
              {liveConnChecking
                ? `Force-checking… ${liveConnProgress?.done ?? 0}/${liveConnProgress?.total ?? 0}`
                : liveConnLastRun
                ? `Live-checked ${new Date(liveConnLastRun).toLocaleTimeString("en-IN")}${autoRefreshOn ? ` · next refresh at ${new Date(liveConnLastRun + 30 * 60 * 1000).toLocaleTimeString("en-IN")}` : ""}`
                : "Not yet force-checked"}
            </span>
          </div>
        </div>

        {/* 4. Device Mix Card — consolidated (v2.29.258): Own/Normal/Hot & Cold used
            to be 3 separate cards; folded into one so Total Societies, Active
            Customers and DP Devices Conn get more breathing room in the row. */}
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Device Mix</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
              <Boxes size={17} color="#08805A" />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 4px" }}>
            <span className="serif" style={{ fontWeight: 700, fontSize: 28, color: "#1D1D1F", lineHeight: 1.1 }}>
              {(ownCount + normalCount + hotColdCount).toLocaleString("en-IN")}
            </span>
            <span style={{ fontSize: 12, color: "#86868B" }}>total devices</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            {[
              { label: "Own Device", value: ownCount, img: imgWaterFilter },
              { label: "Normal", value: normalCount, img: imgTool },
              { label: "Hot & Cold Device", value: hotColdCount, img: imgTechnology },
            ].map((s, i) => (
              <span key={i} title={`${s.value.toLocaleString("en-IN")} ${s.label}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                <img src={s.img} alt={s.label} style={{ width: 14, height: 14, objectFit: "contain" }} />
                {s.value.toLocaleString("en-IN")}
              </span>
            ))}
          </div>
        </div>
      </div>


      <Toolbar q={q} setQ={setQ} placeholder="Search by Purifier ID, phone, name or email…" count={results.length}
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <MultiSelectFilter label="Society" options={societyOptions} value={societyFilter} onChange={setSocietyFilter} />
            <MultiSelectFilter label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
            <MultiSelectFilter label="Customer Stack" options={stackOptions} value={stackFilter} onChange={setStackFilter} />
            <MultiSelectFilter label="Device Type" options={deviceTypeOptions} value={deviceTypeFilter} onChange={setDeviceTypeFilter} />
            <MultiSelectFilter label="Filter Type" options={filterTypeOptions} value={filterTypeFilter} onChange={setFilterTypeFilter} />
            {hasActiveFilters && (
              <button onClick={handleResetFilters} title="Reset all filters and search"
                style={{ ...btnGhost, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "5px 11px", borderRadius: 8, background: "rgba(220,65,65,0.08)" }}>
                <RotateCcw size={13} /> Reset Filters
              </button>
            )}
            <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
          </div>
        } />
      <Card pad={false} hover={false}>
        <Table head={["Purifier ID", "Customer", "Phone", "Society", "Plan", "Device Type", "Stack", "Status", ""]} maxHeight="calc(100vh - 260px)">
          {results.map(c => {
            const pm = planMeta(c);
            const dtStyle = pm?.deviceType && DEVICE_TYPE_STYLE[pm.deviceType === "Normal" ? "Normal Device" : pm.deviceType];
            const dupCount = custKeyCounts[custKey(c)];
            const isDup = dupCount > 1;
            return (
            <tr key={c.id} style={{ ...trStyle, ...rowTint(c) }} onClick={() => openCustomer(c)}>
              <td style={{ ...td, fontWeight: 700, color: "var(--brand)" }}>{c.purifier_id}</td>
              <td style={td}>
                {c.name || "—"}
                {isDup && (
                  <span
                    title={`This customer (ID: ${c.id || "—"}) appears in ${dupCount} rows in this table — check whether it's multiple devices on one account or a real data duplicate.`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: "linear-gradient(90deg, #FFE08A 0%, #FF7A00 100%)",
                      color: "#7A3E00", marginLeft: 7, verticalAlign: "middle", whiteSpace: "nowrap",
                    }}
                  >
                    <AlertTriangle size={10} /> Duplicate
                  </span>
                )}
              </td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtPhone(c.phone)}</td>
              <td style={td}>{c.society || "—"}</td>
              <td style={td}>{c.plan || "—"}</td>
              <td style={td}>
                {pm?.deviceType ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", color: (dtStyle || ["#475569", "#F1F5F9"])[0], background: (dtStyle || ["#475569", "#F1F5F9"])[1] }}>
                    {pm.deviceType}
                  </span>
                ) : <DeviceTypeBadge purifierId={c.purifier_id} />}
              </td>
              {/* whiteSpace:nowrap fixes "Zoho" mid-word-wrapping into "Zoh"/"o" —
                  the shared `td` style sets wordBreak:"break-word" (a deliberate
                  app-wide convention for long free-text cells), which breaks
                  ANY single "word" that doesn't fit the column, including a
                  short pill label like this one once the column got narrower
                  (e.g. after the Filter Type column was removed and widths
                  redistributed). Scoped to just this badge, not the shared td
                  style, since other cells still need break-word for long text. */}
              <td style={td}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
                  background: c.isDpCustomer ? "#E5F0FA" : "var(--mint)",
                  color: c.isDpCustomer ? "#2A86D6" : "var(--brand)",
                }}>{stackOf(c)}</span>
              </td>
              <td style={{ ...td, textTransform: "capitalize" }}>{c.status || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
            );
          })}
          {/* v2.29.279: Total Purifier Count footer row — per explicit user
              request ("also a total count at the bottom of the table as
              Total Purifier Count - and show the count here"). Counts every
              row currently in view (`results`, same population the search
              bar's own result count already reflects), not the full
              unfiltered dataset, so it stays accurate against whatever
              filters/search are active. */}
          {results.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={2}>Total Purifier Count</td>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={7}>{results.length.toLocaleString("en-IN")}</td>
            </tr>
          )}
        </Table>
        {results.length === 0 && <Empty msg={ql || societyFilter || statusFilter || stackFilter || deviceTypeFilter || filterTypeFilter || dateSel.preset !== "all" ? "No customer matches these filters." : "No customers with a Purifier ID."} />}
      </Card>
    </div>
  );
}

export function Customers({ accessLevel = "view" }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [subs, setSubs] = useState([]);
  const [q, setQ] = useState("");
  const [societyFilter, setSocietyFilter] = useState(null); // null = all; else the selected societies
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(null); // null = all; else selected Device Types (plan-catalog value, heuristic fallback)
  const [filterTypeFilter, setFilterTypeFilter] = useState(null); // null = all; else selected Filter Types
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" });

  // Customers + subscriptions (the latter gives us each plan's amount).
  const refresh = () => Promise.all([
    customerApi.getCustomers(),
    billingApi.getSubscriptions().catch(() => []),
  ]).then(([custs, s]) => { setRows(custs); setSubs(s); }).catch(() => setRows([]));
  useEffect(() => { api.logView(user.username, "Viewed Customers"); refresh(); }, []);
  if (!rows) return <Loading title="Loading Customers" subtitle="Synchronizing the customer directory…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const canEditAnything = ["supervisor", "admin", "devops"].includes(accessLevel);

  // Plan amount: join subscriptions by any shared key (customer no. / zoho id / email).
  const amtByKey = {};
  subs.forEach(s => [s.customerNumber, s.zohoCustomerId, s.email].forEach(k => {
    if (k && s.amount) amtByKey[String(k).toLowerCase()] = s.amount;
  }));
  const planAmount = (c) =>
    amtByKey[String(c.id).toLowerCase()] ??
    amtByKey[String(c.zohoId).toLowerCase()] ??
    amtByKey[String(c.email).toLowerCase()] ?? null;

  // Real Device Type / Filter Type, from the business-given plan catalog
  // (v2.29.132/133 — keyed by plan_code, NOT the purifier-ID prefix guess
  // `deviceType()` below still falls back to). Joined the same way as
  // `amtByKey` above, via each subscription's customer/zoho/email key.
  const planMetaByKey = {};
  subs.forEach(s => [s.customerNumber, s.zohoCustomerId, s.email].forEach(k => {
    if (k && (s.planDeviceType || s.planFilterType)) {
      planMetaByKey[String(k).toLowerCase()] = { deviceType: s.planDeviceType, filterType: s.planFilterType };
    }
  }));
  const planMeta = (c) =>
    planMetaByKey[String(c.id).toLowerCase()] ??
    planMetaByKey[String(c.zohoId).toLowerCase()] ??
    planMetaByKey[String(c.email).toLowerCase()] ?? null;
  // Device Type shown in the table/CSV/drawer: the real plan-catalog value
  // when the customer's subscription plan_code is recognised, else the old
  // purifier-ID-prefix guess — same precedence as depositForCustomer's
  // PLAN_CATALOG-first/heuristic-fallback rule.
  const deviceTypeOf = (c) => planMeta(c)?.deviceType || deviceType(c.purifier_id) || "";
  const filterTypeOf = (c) => planMeta(c)?.filterType || "";

  // Society / Device Type / Filter Type filter options — the latter two built
  // from deviceTypeOf/filterTypeOf so the dropdown only ever lists values that
  // can actually appear (plan-catalog values, or the heuristic fallback).
  const societies = Array.from(new Set(rows.map(c => c.society).filter(Boolean))).sort();
  const deviceTypeOptions = Array.from(new Set(rows.map(deviceTypeOf).filter(Boolean))).sort();
  const filterTypeOptions = Array.from(new Set(rows.map(filterTypeOf).filter(Boolean))).sort();

  // Active-customers KPI + month-on-month growth in new sign-ups (by `since`).
  const activeCount = rows.filter(c => c.status === "active").length;
  const inactiveCount = rows.length - activeCount;
  // Device-mix KPIs, derived from the purifier ID prefix (see deviceType()).
  const ownCount = rows.filter(c => deviceType(c.purifier_id) === "Own Device").length;
  const normalCount = rows.filter(c => deviceType(c.purifier_id) === "Normal Device").length;
  const hotColdCount = rows.filter(c => deviceType(c.purifier_id) === "Hot & Cold").length;
  const now = new Date();
  const inMonth = (dateStr, y, m) => { const d = new Date(dateStr); return !isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m; };
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const newThis = rows.filter(c => inMonth(c.since, now.getFullYear(), now.getMonth())).length;
  const newPrev = rows.filter(c => inMonth(c.since, prevMonth.getFullYear(), prevMonth.getMonth())).length;
  const hasSignupDates = newThis > 0 || newPrev > 0;
  const growthPct = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round((newThis - newPrev) / newPrev * 100);

  const filtered = rows.filter(c =>
    (societyFilter === null ? isRealSociety(c.society) : societyFilter.includes(c.society)) &&
    (deviceTypeFilter === null || deviceTypeFilter.includes(deviceTypeOf(c))) &&
    (filterTypeFilter === null || filterTypeFilter.includes(filterTypeOf(c))) &&
    (c.name + c.email + c.phone + c.id + c.society + (c.purifier_id || "") + deviceTypeOf(c) + filterTypeOf(c)).toLowerCase().includes(q.toLowerCase()));

  // Sortable by Customer ID (natural order) and Plan Amount (numeric).
  const sorted = [...filtered];
  if (sort.key) {
    const dir = sort.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) =>
      sort.key === "amount"
        ? ((planAmount(a) || 0) - (planAmount(b) || 0)) * dir
        : String(a.id).localeCompare(String(b.id), undefined, { numeric: true }) * dir);
  }

  const exportCsv = () => exportToCsv("prowater-customers.csv", [
    { label: "Customer ID", get: c => c.id },
    { label: "Purifier ID", get: c => c.purifier_id },
    { label: "Device Type", get: c => deviceTypeOf(c) },
    { label: "Filter Type", get: c => filterTypeOf(c) },
    { label: "Name", get: c => c.name },
    { label: "Email", get: c => c.email },
    { label: "Phone", get: c => cleanPhoneTo10Digits(c.phone) },
    { label: "Society", get: c => c.society },
    { label: "Plan", get: c => c.plan },
    { label: "Plan Amount", get: c => planAmount(c) ?? "" },
    { label: "Status", get: c => c.status },
  ], filtered);


  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#0d2119", background: "rgba(8,128,90,0.08)", border: "1px solid rgba(8,128,90,0.18)", padding: "12px 16px", borderRadius: 14, marginBottom: 16 }}>
        <AlertCircle size={16} color="#08805A" />
        {canEditAnything
          ? <span>You can edit customer accounts ({accessLevel}). Plan & billing changes are Admin-only. Every change is logged.</span>
          : <span>View-only access — you can browse customer accounts but not edit them.</span>}
      </div>

      {/* Active-customers KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {/* v2.29.274: converted from a gradient hero card to a plain white
            card — per explicit user request to make all hero cards the same
            white style as normal cards, so the growth percentage below is
            just plain colored text, no pill/backdrop needed anymore. */}
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Active Customers</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
              <UserRound size={17} color="#08805A" />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 4px" }}>
            <span className="serif" style={{ fontWeight: 700, fontSize: 28, color: "#1D1D1F", lineHeight: 1.1 }}>{activeCount.toLocaleString("en-IN")}</span>
            <span style={{ fontSize: 12, color: "#86868B" }}>of {rows.length.toLocaleString("en-IN")} total</span>
          </div>
          {hasSignupDates ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 4 }}>
              <span style={{
                fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3,
                color: growthPct >= 0 ? "#08805A" : "#DC2626",
              }}>
                {growthPct >= 0 ? "▲" : "▼"} {growthPct >= 0 ? "+" : ""}{growthPct}%
              </span>
              <span style={{ color: "#86868B" }}>new sign-ups vs last month</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "#86868B", marginTop: 4 }}>No dated sign-ups to compare month-on-month.</div>
          )}
        </div>

        {[
          { label: "Inactive Customers", value: inactiveCount.toLocaleString("en-IN"), icon: Ban, sub: `of ${rows.length.toLocaleString("en-IN")} total` },
          { label: "Own Device", value: ownCount.toLocaleString("en-IN"), img: imgWaterFilter, sub: "OWN- purifiers" },
          { label: "Normal Device", value: normalCount.toLocaleString("en-IN"), img: imgTool, sub: "standard units" },
          { label: "Hot & Cold Device", value: hotColdCount.toLocaleString("en-IN"), img: imgTechnology, sub: "HAC- purifiers" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                {s.img ? (
                  <img src={s.img} alt={s.label} style={{ width: 22, height: 22, objectFit: "contain" }} />
                ) : (
                  <s.icon size={17} color="#08805A" />
                )}
              </div>
            </div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 700, color: "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "#86868B" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Search customer, email, phone, ID…" count={filtered.length}
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <MultiSelectFilter label="Society" options={societies} value={societyFilter} onChange={setSocietyFilter} />
            <MultiSelectFilter label="Device Type" options={deviceTypeOptions} value={deviceTypeFilter} onChange={setDeviceTypeFilter} />
            <MultiSelectFilter label="Filter Type" options={filterTypeOptions} value={filterTypeFilter} onChange={setFilterTypeFilter} />
            <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
          </div>
        } />

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 340px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {[
                  <SortHeader key="id" label="Customer ID" k="id" sort={sort} onSort={toggleSort} />,
                  "Purifier ID", "Device Type", "Filter Type", "Name", "Phone", "Society",
                  <SortHeader key="amt" label="Plan Amount" k="amount" sort={sort} onSort={toggleSort} />,
                  "Status", ""
                ].map((h, idx) => (
                  <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const amt = planAmount(c);
                const pm = planMeta(c);
                const st = String(c.status || "").toLowerCase();
                const stColor = st === "inactive" ? "#DC4141" : st === "dunning" ? "#986315" : st === "active" ? "#08805A" : "#86868B";
                const stBg = st === "active" ? "rgba(8,128,90,0.12)" : st === "inactive" ? "rgba(220,38,38,0.12)" : "rgba(152,99,21,0.12)";
                // Real plan-catalog Device Type (v2.29.132/133) wins when the
                // customer's subscription plan_code is recognised; otherwise
                // fall back to the old purifier-ID-prefix badge.
                const dtStyle = pm?.deviceType && DEVICE_TYPE_STYLE[pm.deviceType === "Normal" ? "Normal Device" : pm.deviceType];
                return (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", cursor: "pointer" }} onClick={() => setSel(c)}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#1D1D1F" }}>{c.id}</td>
                  <td style={{ padding: "14px 18px" }}>{c.purifier_id ? <Chip>{c.purifier_id}</Chip> : <span style={{ color: "#86868B" }}>—</span>}</td>
                  <td style={{ padding: "14px 18px" }}>
                    {pm?.deviceType ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: (dtStyle || ["#475569", "#F1F5F9"])[0], background: (dtStyle || ["#475569", "#F1F5F9"])[1] }}>
                        {pm.deviceType}
                      </span>
                    ) : <DeviceTypeBadge purifierId={c.purifier_id} />}
                  </td>
                  <td style={{ padding: "14px 18px" }}>{pm?.filterType ? <Chip>{pm.filterType}</Chip> : <span style={{ color: "#86868B" }}>—</span>}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D1D1F" }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: "#86868B", wordBreak: "break-word" }}>{c.email}</div>
                  </td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{fmtPhone(c.phone)}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{c.society || "—"}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805A" }}>{amt != null ? inr(amt) : "—"}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: stColor, background: stBg, textTransform: "capitalize" }}>
                      {c.status || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "center" }}><ChevronRight size={16} color="#86868B" /></td>
                </tr>
                );
              })}
              {filtered.length > 0 && (
                <tr style={{ background: "rgba(243,248,236,.5)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }} colSpan={7}>Total ({filtered.length})</td>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#08805A" }}>{inr(filtered.reduce((s, c) => s + (planAmount(c) || 0), 0))}</td>
                  <td style={{ padding: "14px 18px" }}></td>
                  <td style={{ padding: "14px 18px" }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty msg="No customers match your search." />}
      </div>

      {sel && <CustomerDrawer customer={sel} amount={planAmount(sel)} planMeta={planMeta(sel)} accessLevel={accessLevel} actor={user.username}
        onClose={() => setSel(null)}
        onSaved={(updated) => { setSel(updated); refresh(); flash("Customer updated"); }} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

export function CustomerDrawer({ customer, amount, planMeta, accessLevel, actor, onClose, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(customer);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canEditField = (f) => f.roles.includes(accessLevel);
  const anyEditable = CUSTOMER_FIELDS.some(canEditField);

  const save = async () => {
    // Only send fields this role is allowed to edit and that actually changed.
    const changes = {};
    CUSTOMER_FIELDS.forEach(f => {
      if (canEditField(f) && form[f.key] !== customer[f.key]) changes[f.key] = form[f.key];
    });
    if (Object.keys(changes).length === 0) { setEdit(false); return; }
    setBusy(true);
    try { await customerApi.updateCustomer(actor, customer.id, changes); onSaved({ ...customer, ...changes }); setEdit(false); }
    finally { setBusy(false); }
  };

  return (
    <Drawer onClose={onClose} title={customer.name} sub={customer.id}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <Status s={customer.status} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Zoho: {customer.zohoId || "—"}</span>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>Since {customer.since}</span>
      </div>

      {!edit ? <>
        <DefRow k="Purifier ID" v={customer.purifier_id || "—"} />
        {customer.isDpCustomer && customer.bid && <DefRow k="Bot ID" v={customer.bid} />}
        {customer.db_id && <DefRow k="Database ID" v={customer.db_id} />}
        <DefRow k="Device Type" v={planMeta?.deviceType || deviceType(customer.purifier_id) || "—"} />
        <DefRow k="Filter Type" v={planMeta?.filterType || "—"} />
        <DefRow k="Email" v={customer.email} />
        <DefRow k="Phone" v={fmtPhone(customer.phone)} />
        <DefRow k="Address" v={customer.address} />
        <DefRow k="Plan" v={customer.plan} />
        {customer.plan_name && <DefRow k="Plan Name (API)" v={customer.plan_name} />}
        {customer.partner_type && <DefRow k="Partner Type" v={customer.partner_type} />}
        {customer.wallet_id && <DefRow k="Wallet ID" v={customer.wallet_id} />}
        <DefRow k="Plan amount" v={amount != null ? inr(amount) : "—"} />
        <DefRow k="Billing cycle" v={customer.billing} />
        <DefRow k="Society" v={customer.society} />
        {anyEditable && (
          <button onClick={() => { setForm(customer); setEdit(true); }} style={{ ...btnPrimary, width: "100%", marginTop: 18 }}>
            <PencilLine size={16} /> Edit account
          </button>
        )}
      </> : <>
        <div style={{ display: "grid", gap: 4 }}>
          {CUSTOMER_FIELDS.map(f => {
            const allowed = canEditField(f);
            return (
              <Field key={f.key} label={f.label + (allowed ? "" : " (admin only)")}>
                {f.type === "select"
                  ? <select disabled={!allowed} value={form[f.key]} onChange={e => set(f.key, e.target.value)} style={{ ...inp, opacity: allowed ? 1 : .55, cursor: allowed ? "pointer" : "not-allowed" }}>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  : <input disabled={!allowed} type={f.type} value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)} style={{ ...inp, opacity: allowed ? 1 : .55, cursor: allowed ? "text" : "not-allowed" }} />}
              </Field>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={save} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? .7 : 1 }}>{busy ? "Saving…" : "Save changes"}</button>
          <button onClick={() => setEdit(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>Changes are logged with your name and pushed to Zoho Billing via the backend.</p>
      </>}
    </Drawer>
  );
}

