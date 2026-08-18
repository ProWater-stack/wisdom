/* ===========================================================================
   modules/Customer.jsx — Customer module.
   CustomerSocieties (per-society roll-up), AllCustomers (full profile with
   tickets/spares/invoices sub-widgets), Customers (list), CustomerDrawer
   (edit drawer), and DPCustomers (raw DP registry feed tab).
   =========================================================================== */
import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Award, Ban, Boxes,
  CalendarClock, CalendarDays, CalendarRange, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, Cpu, Download, Droplets, Gauge,
  GitBranch, Info, Landmark, MapPin, PencilLine, PlayCircle, Receipt,
  RefreshCw, Sun, Ticket, TrendingUp, Upload, UserRound, Wallet, Wrench, X,
} from "lucide-react";
import {
  useAuth, api, customerApi, billingApi, creditNoteApi, ticketApi,
  depositForCustomer, CUSTOMER_FIELDS,
  API_ORIGIN, DATE_PRESETS, dateInRange, resolveRange, parseFlexDate,
  exportToCsv, fmtDate, fmtPhone, inr, deviceType,
  parsePartsUsed, jobDurationMin, zdIsClosed,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, Modal, Drawer,
  Field, Chip, Status, Person, SortHeader, DateRangePicker, MultiSelectFilter,
  DefRow, DeviceTypeBadge,
  btnGhost, btnPrimary, td, ftd, trStyle, grid4, axisTick, selectStyle,
  toastStyle, iconBtn, inp,
} from "../shared/ui";

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
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (k) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  useEffect(() => { api.logView(user.username, "Viewed Societies"); Promise.all([customerApi.getCustomers(), billingApi.getInvoices().catch(() => [])]).then(([c, i]) => { setRows(c); setInvs(i || []); }).catch(() => setRows([])); }, []);
  if (!rows) return <Loading />;

  const NONE = "— No society —";
  const groups = {};
  rows.forEach(c => {
    const soc = (c.society && String(c.society).trim() && c.society !== "—") ? String(c.society).trim() : NONE;
    const g = groups[soc] || (groups[soc] = { society: soc, count: 0, active: 0, inactive: 0, dunning: 0, own: 0, normal: 0, hotcold: 0, customers: [] });
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
  });
  const all = Object.values(groups);
  const namedSocieties = all.filter(g => g.society !== NONE).length;
  const biggest = all.filter(g => g.society !== NONE).reduce((b, g) => g.count > (b?.count || 0) ? g : b, null);

  const filtered = all.filter(g => g.society.toLowerCase().includes(q.toLowerCase()));
  const dir = sort.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => sort.key === "society" ? a.society.localeCompare(b.society) * dir : (a[sort.key] - b[sort.key]) * dir);
  const tot = filtered.reduce((a, g) => ({ count: a.count + g.count, active: a.active + g.active, own: a.own + g.own, normal: a.normal + g.normal, hotcold: a.hotcold + g.hotcold }), { count: 0, active: 0, own: 0, normal: 0, hotcold: 0 });

  const stats = [
    { label: "Societies", value: namedSocieties, icon: Boxes, sub: "with at least one customer", hero: true },
    { label: "Customers", value: rows.length.toLocaleString("en-IN"), icon: UserRound, sub: "across all societies" },
    { label: "Avg / society", value: namedSocieties ? Math.round(rows.filter(c => c.society && c.society !== "—").length / namedSocieties) : 0, icon: TrendingUp, sub: "customers per society" },
    { label: "Largest society", value: biggest ? biggest.count : 0, icon: Award, sub: biggest ? biggest.society : "—" },
  ];

  const exportCsv = () => exportToCsv("prowater-societies.csv", [
    { label: "Society", get: g => g.society }, { label: "Customers", get: g => g.count }, { label: "Active", get: g => g.active },
    { label: "Own", get: g => g.own }, { label: "Normal", get: g => g.normal }, { label: "Hot & Cold", get: g => g.hotcold },
  ], filtered);


  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 16 }}>
        <Toolbar q={q} setQ={setQ} placeholder="Search society…" count={filtered.length}
          right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
        <Card pad={false}>
          <Table head={[
            <SortHeader key="s" label="Society" k="society" sort={sort} onSort={toggleSort} />,
            <SortHeader key="c" label="Customers" k="count" sort={sort} onSort={toggleSort} />,
            <SortHeader key="a" label="Active" k="active" sort={sort} onSort={toggleSort} />,
            "Own", "Normal", "Hot & Cold"]} maxHeight="calc(100vh - 340px)">
            {filtered.map((g, i) => { const open = expanded.has(g.society); return (
              <React.Fragment key={i}>
                <tr onClick={() => toggleExpand(g.society)} title="Click to see customers" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: open ? "var(--mint)" : undefined }}>
                  <td style={{ ...td, fontWeight: 600, color: g.society === NONE ? "var(--muted)" : "var(--f)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <ChevronRight size={15} style={{ color: "var(--muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                      {g.society}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{g.count}</td>
                  <td style={{ ...td, color: "var(--forest)", fontWeight: 600 }}>{g.active}</td>
                  <td style={td}>{g.own || "—"}</td>
                  <td style={td}>{g.normal || "—"}</td>
                  <td style={td}>{g.hotcold || "—"}</td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, background: "var(--mint)", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ overflowX: "auto", padding: "6px 14px 14px" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                          <thead>
                            <tr style={{ background: "var(--mint-2)" }}>
                              {["Customer ID", "Name", "Purifier ID", "Device", "Phone", "Plan", "Status"].map(h => (
                                <th key={h} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", padding: "8px 12px", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {g.customers.map((c, ci) => {
                              const st = String(c.status || "").toLowerCase();
                              const rowBg = st === "inactive" ? "#FBE8E8" : st === "dunning" ? "#FBF0E0" : undefined;
                              const stColor = st === "inactive" ? "#DC4141" : st === "dunning" ? "#986315" : st === "active" ? "#08805A" : "var(--muted)";
                              const cell = { fontSize: 12.5, padding: "8px 12px", whiteSpace: "nowrap", textAlign: "center" };
                              return (
                              <tr key={ci} style={{ borderTop: ci ? "1px solid #ECEEED" : "none", background: rowBg }}>
                                <td style={{ ...cell, color: "var(--slate)" }}>{c.id || "—"}</td>
                                <td style={{ ...cell, fontSize: 13, fontWeight: 600, color: "var(--f)" }}>{c.name || "—"}</td>
                                <td style={cell}>{c.purifier_id || "—"}</td>
                                <td style={cell}><DeviceTypeBadge purifierId={c.purifier_id} /></td>
                                <td style={cell}>{fmtPhone(c.phone)}</td>
                                <td style={cell}>{c.plan || "—"}</td>
                                <td style={cell}><span style={{ fontSize: 11.5, fontWeight: 700, color: stColor, textTransform: "capitalize" }}>{c.status || "—"}</span></td>
                              </tr>
                              );
                            })}
                            <tr style={{ background: "var(--mint-2)", borderTop: "2px solid var(--border)" }}>
                              <td colSpan={7} style={{ fontSize: 12, fontWeight: 700, color: "var(--f)", padding: "9px 12px", textAlign: "center" }}>
                                Subtotal · {g.count} customer{g.count !== 1 ? "s" : ""} · {g.active} active{g.inactive ? ` · ${g.inactive} inactive` : ""}{g.dunning ? ` · ${g.dunning} dunning` : ""}
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
              <tr>
                <td style={ftd}>Total ({filtered.length})</td>
                <td style={ftd}>{tot.count}</td>
                <td style={ftd}>{tot.active}</td>
                <td style={ftd}>{tot.own}</td>
                <td style={ftd}>{tot.normal}</td>
                <td style={ftd}>{tot.hotcold}</td>
              </tr>
            )}
          </Table>
          {filtered.length === 0 && <Empty msg="No societies to show." />}
        </Card>
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
      <Card pad={false}>
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
              <td style={{ ...td, textAlign: "left" }}>{r.name}</td>
              <td style={{ ...td, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.count}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--border)", background: "var(--mint-2)" }}>
            <td style={{ ...td, fontWeight: 700, textAlign: "left" }}>Total</td>
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
export function gstBreakup(total) {
  const t = Number(total) || 0;
  const taxable = t / 1.05;
  return { taxable, cgst: taxable * 0.025, sgst: taxable * 0.025, total: t };
}

export function GstBreakupCard({ total }) {
  if (!(total > 0)) return null;
  const g = gstBreakup(total);
  return (
    <Card pad={false} title="GST breakup" sub={`On the paid amount of ${inr(Math.round(g.total))}`} style={{ marginTop: 16 }}>
      <div style={{ paddingTop: 2 }}>
        <InvoiceSummaryRow icon={Receipt} label="Taxable value" value={inr(Math.round(g.taxable))} />
        <InvoiceSummaryRow icon={Landmark} label="CGST (2.5%)" value={inr(Math.round(g.cgst))} />
        <InvoiceSummaryRow icon={MapPin} label="SGST (2.5%)" value={inr(Math.round(g.sgst))} />
        <InvoiceSummaryRow icon={Wallet} label="Total invoice value" value={inr(Math.round(g.total))} />
      </div>
    </Card>
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

  // Fixed-width flex rows, NOT the shared full-bleed <Table> — that one
  // stretches to 100% of the (wide) card with no column constraints, which
  // left huge blank gaps either side of these short date/amount values.
  // Everything here stays compact regardless of the card's outer width.
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
  // Earned revenue rows show the actual day-range that amount covers (e.g.
  // "21 Jul – 31 Jul") instead of a single date — makes it clear exactly
  // which days each month's slice counts, not just "as of" when.
  const calcRowRange = (key, label, rangeStart, rangeEnd, value) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 18px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ width: DATE_W, flexShrink: 0, fontSize: 12, color: "var(--muted)", textAlign: "right", whiteSpace: "nowrap" }}>{rangeStart && rangeEnd ? `${fmtDayMon(rangeStart)} – ${fmtDayMon(rangeEnd)}` : "—"}</div>
      <div style={{ width: AMT_W, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "var(--f)", textAlign: "right" }}>{value}</div>
    </div>
  );
  return (
    <Card pad={false} title="Current paid transaction — revenue recognition" sub={`Invoice ${inv.number || inv.id}`} style={{ marginTop: 16 }}>
      <div style={{ paddingTop: 2 }}>
        <InvoiceSummaryRow icon={CalendarDays} label="Due date" value={fmtDate(dd)} />
        <InvoiceSummaryRow icon={CalendarClock} label="Payment date" value={fmtDate(pd)} />
        <InvoiceSummaryRow icon={CalendarRange} label="Recharge tenure" value={`${b.tenureDays} days`} sub={`${fmtDate(b.validityStart)} – ${fmtDate(b.validityEnd)}`} />
        <InvoiceSummaryRow icon={TrendingUp} label="Earned revenue" value={inr(Math.round(totalEarned))} />
        <InvoiceSummaryRow icon={Wallet} label="Collected Revenue" value={inr(Math.round(totalCollected))}
          sub={totalOutstanding > 0 ? `${inr(Math.round(totalOutstanding))} still outstanding` : "Fully collected"} />
      </div>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 18px", background: "var(--mint)", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--slate)" }}>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {open ? "Hide calculation" : "Show calculation"}
      </button>
      {open && (
        <div style={{ paddingBottom: 4 }}>
          <div style={{ display: "flex", gap: 10, padding: "10px 18px 4px" }}>
            <div style={{ flex: 1 }} />
            <div style={{ width: DATE_W, flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textAlign: "right", textTransform: "uppercase" }}>Date</div>
            <div style={{ width: AMT_W, flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textAlign: "right", textTransform: "uppercase" }}>Amount</div>
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
    </Card>
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
  const [statusFilter, setStatusFilter] = useState(null);   // null = all
  const [stackFilter, setStackFilter] = useState(null);     // null = all; "Zoho" | "DP" (v2.29.113)
  const [dateSel, setDateSel] = useState({ preset: "all", from: "", to: "" });
  // DP customers' Transactions sub-page (v2.29.113): reads the DrinkPrime
  // collections API directly (installationId = dp_installation_id), since a
  // DP-stack customer has no real Zoho invoices to show.
  const [dpTxns, setDpTxns] = useState(null); // null = not loaded yet, [] = loaded (empty or error)
  const [dpTxnsLoading, setDpTxnsLoading] = useState(false);
  const [dpTxnsErr, setDpTxnsErr] = useState(false);
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
    ]).then(([customers, subs, invs, tickets, referrers, referees, creditNotes]) => setData({ customers, subs, invs, tickets, referrers, referees, creditNotes }))
      .catch(() => setData({ customers: [], subs: [], invs: [], tickets: [], referrers: [], referees: [], creditNotes: [] }));
  }, []);
  useEffect(() => {
    if (!sel || !sel.isDpCustomer || !sel.dpInstallationId || subtab !== "transactions") return;
    setDpTxns(null); setDpTxnsLoading(true); setDpTxnsErr(false);
    fetch(`https://api.drinkprime.in/payments/payments/v2/collections?installationId=${encodeURIComponent(sel.dpInstallationId)}&page=0&size=10`)
      .then(r => { if (!r.ok) throw new Error(`Collections API ${r.status}`); return r.json(); })
      .then(json => setDpTxns(Array.isArray(json?.body?.content) ? json.body.content : []))
      .catch(() => { setDpTxns([]); setDpTxnsErr(true); })
      .finally(() => setDpTxnsLoading(false));
  }, [sel, subtab]);
  if (!data) return <Loading />;
  const { customers, subs, invs, tickets, referrers, referees, creditNotes } = data;

  const keysOf = (c) => [c.id, c.zohoId, c.email].filter(Boolean).map(k => String(k).toLowerCase());
  const belongs = (rec, keys) => [rec.zohoCustomerId, rec.customerNumber, rec.zohoId, rec.email]
    .filter(Boolean).map(k => String(k).toLowerCase()).some(k => keys.includes(k));

  const ql = q.trim().toLowerCase();
  const withPur = customers.filter(c => c.purifier_id);
  // Search across Purifier ID, phone, name and email.
  const matchesQ = (c) => [c.purifier_id, c.phone, c.name, c.email].some(f => String(f || "").toLowerCase().includes(ql));

  // Filter option lists — derived from the population being browsed (has a Purifier ID).
  const societyOptions = Array.from(new Set(withPur.map(c => c.society).filter(Boolean))).sort();
  const statusOptions = Array.from(new Set(withPur.map(c => c.status).filter(Boolean))).sort();
  // Customer Stack (v2.29.113): is_dp_customer false → "Zoho", true → "DP".
  const stackOf = (c) => c.isDpCustomer ? "DP" : "Zoho";
  const stackOptions = ["Zoho", "DP"];
  // Row highlight (v2.29.117): Un-Installed (dp_details.device_status) → yellow,
  // Dunning (Zoho subscription status, passed through as-is by the mapper) →
  // red, Inactive (either stack's own "inactive" status) → orange.
  const normSt = (s) => String(s || "").toLowerCase().replace(/[\s_-]+/g, "");
  const rowTint = (c) => {
    const dev = normSt(c.deviceStatus);
    const st = normSt(c.status);
    if (dev.includes("uninstall")) return { background: "#FFFBEA" };
    if (st === "dunning") return { background: "var(--danger-t)" };
    if (st === "inactive" || dev === "inactive") return { background: "#FFF1E0" };
    return {};
  };
  // Signup-date range — "All Time" (dateRange === null) means unfiltered.
  const dateRange = dateSel.preset === "all" ? null : resolveRange(dateSel.preset, dateSel);
  const matchesDate = (c) => { if (!dateRange) return true; const d = parseFlexDate(c.since); return !!d && dateInRange(d, dateRange); };

  const filtered = withPur.filter(c =>
    (societyFilter === null || societyFilter.includes(c.society)) &&
    (statusFilter === null || statusFilter.includes(c.status)) &&
    (stackFilter === null || stackFilter.includes(stackOf(c))) &&
    matchesDate(c));
  const results = (ql ? filtered.filter(matchesQ) : filtered)
    .slice().sort((a, b) => String(a.purifier_id).localeCompare(String(b.purifier_id), undefined, { numeric: true }));

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
    const totalPaid = txns.filter(t => t.status === "paid").reduce((s, t) => s + (t.total || 0), 0);
    const planName = custSubs[0]?.plan || sel.plan;
    // Current paid transaction — the most recent paid invoice (txns is
    // already sorted newest-first) — feeds the revenue-recognition breakdown
    // card at the top of the Transactions sub-screen.
    const currentPaid = txns.find(t => t.status === "paid" && (t.total || 0) > 0 && t.dueDate);
    const currentPaidRecharge = currentPaid ? Math.max(0, (currentPaid.total || 0) - depositForCustomer(sel, currentPaid.plan || planName, currentPaid.total || 0)) : 0;
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
    const securityDeposit = txns.reduce((mx, t) => t.status === "paid" ? Math.max(mx, depositForCustomer(sel, planName, t.total)) : mx, 0);
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
    const lastPayment = txns.find(t => t.status === "paid");
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
      payment: { icon: Wallet, color: "#0A9D6E", label: "Payment" },
      ticket: { icon: Ticket, color: "#986315", label: "Ticket" },
      referral: { icon: GitBranch, color: "#2A86D6", label: "Referral" },
      discount: { icon: Receipt, color: "#7D8A83", label: "Discount" },
    };
    // Field severity for at-a-glance scanning — only amber (warning) / red (critical) stand out.
    const statusActive = String(sel.status || "").toLowerCase() === "active";
    const sevColor = (sev) => sev === "red" ? "#DC4141" : sev === "amber" ? "#a86e00" : "var(--f)";
    // Render a field value, highlighted amber/red when concerning (plain otherwise).
    const cell = (text, sev) => <span style={{ color: sevColor(sev), fontWeight: sev ? 800 : undefined }}>{text}</span>;
    const tabBtn = (k, label) => (
      <button key={k} onClick={() => setSubtab(k)} style={{
        padding: "10px 16px", fontSize: 13.5, fontWeight: 700, background: "none",
        color: subtab === k ? "var(--brand)" : "var(--muted)",
        borderBottom: subtab === k ? "2px solid var(--brand)" : "2px solid transparent", marginBottom: -1,
      }}>{label}</button>
    );
    // Score card with conditional colour formatting (green ≥4, amber ≥2.5, red < 2.5, grey = no data).
    const scoreCard = (label, score, Icon, hint) => {
      const na = score == null;
      const col = na ? "#8b9a95" : score >= 4 ? "#08805A" : score >= 2.5 ? "#a86e00" : "#DC4141";
      const bg = na ? "#eef1ef" : score >= 4 ? "#E4F4EE" : score >= 2.5 ? "#FBF0E0" : "#FBE4E4";
      const word = na ? "No data" : score >= 4 ? "Good" : score >= 2.5 ? "Fair" : "Poor";
      return (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "grid", placeItems: "center", width: 50, height: 50, borderRadius: 14, background: bg, color: col, flexShrink: 0 }}><Icon size={23} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ color: "var(--muted)" }}>{label}</div>
            <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 28, color: col, lineHeight: 1.05, margin: "1px 0" }}>{na ? "—" : score.toFixed(1)}<span style={{ fontSize: 15, color: "var(--muted)", fontWeight: 600 }}> / 5</span></div>
            <div style={{ fontSize: 11.5, color: col, fontWeight: 700 }}>{word}{hint ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {hint}</span> : null}</div>
          </div>
        </div>
      );
    };

    return (
      <div className="fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setSel(null)} style={{ ...btnGhost, padding: "8px 12px" }}><ChevronLeft size={16} /> All Customers</button>
          <div>
            <div className="eyebrow">Purifier {sel.purifier_id}</div>
            <div style={{ fontSize: 21, fontWeight: 700, color: "var(--f)" }}>{sel.name || sel.purifier_id}</div>
          </div>
        </div>

        {/* At-a-glance strip — visible on every tab, so the key facts never require a click. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Status", value: sel.status || "—", sev: statusActive ? null : "red", cap: true },
            { label: "Customer score", value: `${customerScore.toFixed(1)}/5` },
            { label: "LTV", value: inr(totalPaid), sev: totalPaid === 0 ? "red" : null },
            { label: "Open tickets", value: openTicketsCount, sev: openTicketsCount >= 3 ? "red" : openTicketsCount >= 1 ? "amber" : null },
            { label: "Last payment", value: lastPayment ? fmtDate(lastPayment.date) : "—" },
            { label: "Referral code", value: referralCode },
          ].map((g, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 14px", minWidth: 112 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{g.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: g.sev === "red" ? "#DC4141" : g.sev === "amber" ? "#a86e00" : "var(--f)", textTransform: g.cap ? "capitalize" : "none" }}>{g.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
          {tabBtn("timeline", "Timeline")}
          {tabBtn("profile", "Profile")}
          {tabBtn("transactions", `Transactions${(sel.isDpCustomer ? (dpTxns || []).length : txns.length) ? ` (${sel.isDpCustomer ? (dpTxns || []).length : txns.length})` : ""}`)}
          {tabBtn("tickets", `Tickets${custTickets.length ? ` (${custTickets.length})` : ""}`)}
          {tabBtn("ops", `Ops${opsTickets.length ? ` (${opsTickets.length})` : ""}`)}
          {tabBtn("referral", `Referral${referralsDone ? ` (${referralsDone})` : ""}`)}
        </div>

        {subtab === "timeline" && (
          <Card pad={false}>
            {timelineEvents.length === 0 && <Empty msg="No activity recorded for this customer yet." />}
            {timelineEvents.map((e, i) => {
              const cfg = timelineCfg[e.type];
              const Icon = cfg.icon;
              return (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: i < timelineEvents.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: "#F6FAF8", color: cfg.color, flexShrink: 0 }}><Icon size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--f)" }}>{e.title}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(new Date(e.date))}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {cfg.label}{e.sub ? ` · ${e.sub}` : ""}{e.amount != null ? ` · ${inr(e.amount)}` : ""}{e.status ? ` · ${e.status}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
        {subtab === "profile" && (
          <>
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "0 40px" }}>
                <div>
                  <DefRow k="Purifier ID" v={sel.purifier_id} />
                  <DefRow k="Customer ID" v={sel.id} />
                  <DefRow k="Name" v={sel.name} />
                  <DefRow k="Email" v={sel.email} />
                  <DefRow k="Phone" v={sel.phone} />
                  <DefRow k="Referral code" v={referralCode} />
                  <DefRow k="Referrals made" v={referralsDone} />
                  <DefRow k="Support tickets" v={cell(custTickets.length, custTickets.length >= 8 ? "red" : custTickets.length >= 5 ? "amber" : null)} />
                </div>
                <div>
                  <DefRow k="Society" v={sel.society} />
                  <DefRow k="Plan" v={planName} />
                  <DefRow k="Status" v={cell(<span style={{ textTransform: "capitalize" }}>{sel.status || "—"}</span>, statusActive ? null : "red")} />
                  <DefRow k="Installed date" v={installed ? fmtDate(installed) : "—"} />
                  <DefRow k="LTV (lifetime value)" v={cell(inr(totalPaid), totalPaid === 0 ? "red" : null)} />
                  <DefRow k="Security Deposit" v={inr(securityDeposit)} />
                  <DefRow k="Discounts (credit notes)" v={<>{cell(inr(discountTotal), discountPct >= 30 ? "red" : discountPct >= 20 ? "amber" : null)}{discountCount ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {discountCount} note{discountCount !== 1 ? "s" : ""}{discountBalance > 0 ? ` · ${inr(discountBalance)} balance` : ""}</span> : null}</>} />
                  <DefRow k="Complaints" v={cell(complaintCount, complaintCount >= 2 ? "red" : complaintCount >= 1 ? "amber" : null)} />
                </div>
              </div>
            </Card>
            {/* scores — 0-5 with conditional colour formatting */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginTop: 14 }}>
              {scoreCard("Customer score", customerScore, Award)}
              {scoreCard("Technician score", techScore, Wrench, opsTickets.length ? `${opsTickets.length} ops job${opsTickets.length !== 1 ? "s" : ""}` : "no jobs")}
              {scoreCard("Device score", deviceScore, Cpu, `${complaintCount} complaint${complaintCount !== 1 ? "s" : ""} · ${totalSpares} spare${totalSpares !== 1 ? "s" : ""}`)}
            </div>
            <CustSparesAnalysis tickets={opsTickets} />
          </>
        )}
        {subtab === "transactions" && (
          sel.isDpCustomer ? (
            // DP-stack customer: no real Zoho invoices, so Transactions reads
            // the DrinkPrime collections API directly by dp_installation_id.
            <>
              <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
                <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Total paid</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{inr((dpTxns || []).reduce((s, c) => s + (c.totalPaid || 0), 0))}</div></div>
                <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Collections</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{(dpTxns || []).length}</div></div>
                <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Installation ID</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{sel.dpInstallationId}</div></div>
              </div>
              <Card pad={false}>
                {dpTxnsLoading && <Loading />}
                {!dpTxnsLoading && (
                  <>
                    <Table head={["Date", "Transaction Key", "Amount", "Litres", "Valid Period", "Payment Mode", "Status"]} maxHeight="calc(100vh - 340px)">
                      {(dpTxns || []).map(c => {
                        const tx = (c.transactions && c.transactions[0]) || {};
                        const paid = String(c.paymentUtilisedStatus || tx.status || "").toUpperCase();
                        const ok = paid === "COMPLETED" || paid === "SUCCESS";
                        return (
                          <tr key={c.collectionId} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={td}>{fmtDate(c.date)}</td>
                            <td style={td}>{tx.transactionKey || "—"}</td>
                            <td style={{ ...td, fontWeight: 700, color: "var(--f)" }}>{inr(c.totalPaid)}</td>
                            <td style={td}>{c.totalLitres ?? "—"}</td>
                            <td style={td}>{fmtDate(c.validFrom)} → {fmtDate(c.validTo)}</td>
                            <td style={td}>{tx.channel || tx.type || "—"}</td>
                            <td style={td}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: ok ? "var(--green-t)" : "var(--danger-t)", color: ok ? "var(--green)" : "var(--danger)", textTransform: "capitalize" }}>{(paid || "—").toLowerCase()}</span>
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
              </Card>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
                <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Total paid</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{inr(totalPaid)}</div></div>
                <div><div style={{ fontSize: 12, color: "var(--muted)" }}>Payments</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{txns.length}</div></div>
              </div>
              <Card pad={false}>
                <Table head={["Date", "Invoice", "Amount", "Plan", "Status"]} maxHeight="calc(100vh - 340px)">
                  {txns.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={td}>{fmtDate(t.date)}</td>
                      <td style={td}>{t.number || t.id}</td>
                      <td style={{ ...td, fontWeight: 700, color: "var(--f)" }}>{inr(t.total)}</td>
                      <td style={td}>{t.plan || "—"}</td>
                      <td style={td}>{stChip(t.status)}</td>
                    </tr>
                  ))}
                </Table>
                {txns.length === 0 && <Empty msg="No transactions found for this customer." />}
              </Card>
              {currentPaid && <GstBreakupCard total={currentPaid.total} />}
              {currentPaid && currentPaidRecharge > 0 && <InvoiceBreakdownCard inv={currentPaid} recharge={currentPaidRecharge} />}
            </>
          )
        )}
        {subtab === "tickets" && <CustTicketMonths tickets={custTickets} />}
        {subtab === "ops" && <CustTicketMonths tickets={opsTickets} ops />}
        {subtab === "referral" && (
          <>
            <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
              {[["Referrals made", referralsDone], ["Converted", refConverted], ["Pending", refPending], ["Free months earned", custRef?.freeMonthsEarned ?? 0], ["Referral code", referralCode]].map(([label, value]) => (
                <div key={label}><div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--f)" }}>{value}</div></div>
              ))}
            </div>
            <Card pad={false}>
              <Table head={["Referred customer", "Society", "Status", "Referred on"]} maxHeight="calc(100vh - 340px)">
                {myReferees.map(e => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{e.name || "—"}</td>
                    <td style={td}>{e.society || "—"}</td>
                    <td style={td}>{stChip(e.status)}</td>
                    <td style={td}>{e.date ? fmtDate(e.date) : "—"}</td>
                  </tr>
                ))}
              </Table>
              {myReferees.length === 0 && <Empty msg={referralsDone ? "Referral count recorded, but no referee details are available." : "This customer has not referred anyone yet."} />}
            </Card>
          </>
        )}
      </div>
    );
  }

  // ── Search list ────────────────────────────────────────────────────────────

  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search by Purifier ID, phone, name or email…" count={results.length}
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={dateSel.preset} onChange={e => setDateSel({ ...dateSel, preset: e.target.value })} style={selectStyle}>
              <option value="all">All Time</option>
              {DATE_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {dateSel.preset === "custom" && (
              <>
                <input type="date" value={dateSel.from} max={dateSel.to || undefined}
                  onChange={e => setDateSel({ ...dateSel, from: e.target.value })} style={selectStyle} />
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>to</span>
                <input type="date" value={dateSel.to} min={dateSel.from || undefined}
                  onChange={e => setDateSel({ ...dateSel, to: e.target.value })} style={selectStyle} />
              </>
            )}
            <MultiSelectFilter label="Society" options={societyOptions} value={societyFilter} onChange={setSocietyFilter} />
            <MultiSelectFilter label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
            <MultiSelectFilter label="Customer Stack" options={stackOptions} value={stackFilter} onChange={setStackFilter} />
          </div>
        } />
      <Card pad={false}>
        <Table head={["Purifier ID", "Customer", "Society", "Plan", "Device Type", "Stack", "Status", ""]} maxHeight="calc(100vh - 260px)">
          {results.map(c => (
            <tr key={c.id} style={{ ...trStyle, ...rowTint(c) }} onClick={() => openCustomer(c)}>
              <td style={{ ...td, fontWeight: 700, color: "var(--brand)" }}>{c.purifier_id}</td>
              <td style={td}>{c.name || "—"}</td>
              <td style={td}>{c.society || "—"}</td>
              <td style={td}>{c.plan || "—"}</td>
              <td style={td}><DeviceTypeBadge purifierId={c.purifier_id} /></td>
              <td style={td}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: c.isDpCustomer ? "#E5F0FA" : "var(--mint)",
                  color: c.isDpCustomer ? "#2A86D6" : "var(--brand)",
                }}>{stackOf(c)}</span>
              </td>
              <td style={{ ...td, textTransform: "capitalize" }}>{c.status || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
        </Table>
        {results.length === 0 && <Empty msg={ql || societyFilter || statusFilter || stackFilter || dateSel.preset !== "all" ? "No customer matches these filters." : "No customers with a Purifier ID."} />}
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
  if (!rows) return <Loading />;

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

  // Society filter options.
  const societies = Array.from(new Set(rows.map(c => c.society).filter(Boolean))).sort();

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
    (societyFilter === null || societyFilter.includes(c.society)) &&
    (c.name + c.email + c.phone + c.id + c.society + (c.purifier_id || "") + deviceType(c.purifier_id)).toLowerCase().includes(q.toLowerCase()));

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
    { label: "Device Type", get: c => deviceType(c.purifier_id) },
    { label: "Name", get: c => c.name },
    { label: "Email", get: c => c.email },
    { label: "Phone", get: c => c.phone },
    { label: "Society", get: c => c.society },
    { label: "Plan", get: c => c.plan },
    { label: "Plan Amount", get: c => planAmount(c) ?? "" },
    { label: "Status", get: c => c.status },
  ], filtered);


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} />
        {canEditAnything
          ? <span>You can edit customer accounts ({accessLevel}). Plan & billing changes are Admin-only. Every change is logged.</span>
          : <span>View-only access — you can browse customer accounts but not edit them.</span>}
      </div>
      {/* Active-customers KPI card with month-on-month sign-up growth */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)", color: "#E2F3EE", borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -20, top: -20, width: 90, height: 90, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.4),transparent 70%)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="eyebrow" style={{ color: "var(--lime)" }}>Active Customers</span>
            <UserRound size={18} color="var(--lime)" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "8px 0 2px" }}>
            <span style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: "#fff", lineHeight: 1 }}>{activeCount.toLocaleString("en-IN")}</span>
            <span style={{ fontSize: 12, color: "#B5E2D4" }}>of {rows.length.toLocaleString("en-IN")} total</span>
          </div>
          {hasSignupDates ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: growthPct >= 0 ? "#B5E2D4" : "#F5BFBF", display: "inline-flex", alignItems: "center", gap: 3 }}>
                {growthPct >= 0 ? "▲" : "▼"} {growthPct >= 0 ? "+" : ""}{growthPct}%
              </span>
              <span style={{ color: "#B5E2D4" }}>new sign-ups vs last month ({newThis} vs {newPrev})</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "#B5E2D4", marginTop: 4 }}>No dated sign-ups to compare month-on-month.</div>
          )}
        </div>
        <Stat label="Inactive Customers" value={inactiveCount.toLocaleString("en-IN")} icon={Ban} sub={`of ${rows.length.toLocaleString("en-IN")} total`} />
        <Stat label="Own Device" value={ownCount.toLocaleString("en-IN")} icon={Cpu} sub="OWN- purifiers" />
        <Stat label="Normal Device" value={normalCount.toLocaleString("en-IN")} icon={Droplets} sub="standard units" />
        <Stat label="Hot & Cold Device" value={hotColdCount.toLocaleString("en-IN")} icon={Sun} sub="HAC- purifiers" />
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Search customer, email, phone, ID…" count={filtered.length}
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <MultiSelectFilter label="Society" options={societies} value={societyFilter} onChange={setSocietyFilter} />
            <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
          </div>
        } />
      <Card pad={false}>
        <Table head={[
          <SortHeader key="id" label="Customer ID" k="id" sort={sort} onSort={toggleSort} />,
          "Purifier ID", "Device Type", "Name", "Phone", "Society",
          <SortHeader key="amt" label="Plan Amount" k="amount" sort={sort} onSort={toggleSort} />,
          "Status", ""]} maxHeight="calc(100vh - 340px)">
          {sorted.map(c => {
            const amt = planAmount(c);
            return (
            <tr key={c.id} style={trStyle} onClick={() => setSel(c)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{c.id}</td>
              <td style={td}>{c.purifier_id ? <Chip>{c.purifier_id}</Chip> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
              <td style={td}><DeviceTypeBadge purifierId={c.purifier_id} /></td>
              <td style={{ ...td, textAlign: "center" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", wordBreak: "break-word" }}>{c.email}</div>
              </td>
              <td style={td}>{fmtPhone(c.phone)}</td>
              <td style={td}>{c.society || "—"}</td>
              <td style={{ ...td, fontWeight: 600 }}>{amt != null ? inr(amt) : "—"}</td>
              <td style={td}><Status s={c.status} /></td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
            );
          })}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={6}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, c) => s + (planAmount(c) || 0), 0))}</td>
              <td style={ftd}></td><td style={ftd}></td>
            </tr>
          )}
        </Table>
        {filtered.length === 0 && <Empty msg="No customers match your search." />}
      </Card>

      {sel && <CustomerDrawer customer={sel} amount={planAmount(sel)} accessLevel={accessLevel} actor={user.username}
        onClose={() => setSel(null)}
        onSaved={(updated) => { setSel(updated); refresh(); flash("Customer updated"); }} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

export function CustomerDrawer({ customer, amount, accessLevel, actor, onClose, onSaved }) {
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
        <DefRow k="Device Type" v={deviceType(customer.purifier_id) || "—"} />
        <DefRow k="Email" v={customer.email} />
        <DefRow k="Phone" v={fmtPhone(customer.phone)} />
        <DefRow k="Address" v={customer.address} />
        <DefRow k="Plan" v={customer.plan} />
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

