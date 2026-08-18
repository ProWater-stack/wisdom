/* ============================================================================
   modules/Ticketing.jsx — Ticketing module. Extracted verbatim from App.jsx
   (v2.30 module-split). Zoho Desk support tickets: overview KPIs + a shared
   TicketList component reused for both the Tickets and Ops Tickets tabs.
   ============================================================================ */

import { useState, useEffect } from "react";
import {
  AlertCircle, BarChart3 as BarChartIcon, CheckCircle2, ChevronRight, Clock,
  Download, Droplets, Hourglass, MapPin, Ticket, TrendingUp, Wrench, X,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  useAuth, api, ticketApi, exportToCsv, fmtTime, fmtIST, jobDurationMin, fmtDuration,
  parsePartsUsed, istDateOf, tdsNum, zdStatusColor, zdPriorityColor, zdIsClosed,
  ZD_DEFAULT_STATUSES, ZD_PRIORITIES,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, DefRow, Drawer, TT,
  grid4, axisTick, td, trStyle, selectStyle, btnGhost,
  CHART_PALETTE, renderPieLabel, pieLabelLine, toastStyle,
} from "../shared/ui";

/* ===========================================================================
   TICKETING MODULE (sample data) — Overview + Tickets list with detail drawer
   =========================================================================== */
// Zoho Desk statuses/priorities are strings; colour them by keyword.
export const tkStatus = (label) => ({ label: label || "—", color: zdStatusColor(label) });
export const tkPriority = (label) => ({ label: label || "—", color: zdPriorityColor(label) });
export function TicketBadge({ value, kind }) {
  const meta = kind === "priority" ? tkPriority(value) : tkStatus(value);
  if (!value) return <span style={{ color: "var(--muted)" }}>—</span>;
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>;
}
export function TicketOverview() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState(null);
  useEffect(() => { api.logView(user.username, "Viewed Ticketing overview"); ticketApi.getTickets().then(setTickets).catch(() => setTickets([])); }, []);
  if (!tickets) return <Loading />;

  const openCount = tickets.filter(t => !zdIsClosed(t.status)).length;
  const urgent = tickets.filter(t => String(t.priority).toLowerCase() === "urgent" && !zdIsClosed(t.status)).length;
  const resolved = tickets.filter(t => zdIsClosed(t.status)).length;
  const resolveRate = tickets.length ? Math.round(resolved / tickets.length * 100) : 0;

  const stats = [
    { label: "Open tickets", value: openCount, icon: Ticket, sub: "needs attention", hero: true },
    { label: "Urgent open", value: urgent, icon: AlertCircle, sub: "high priority" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, sub: "resolved or closed" },
    { label: "Resolution rate", value: resolveRate + "%", icon: TrendingUp, sub: "of all tickets" },
  ];

  // Status distribution built from whatever statuses actually appear.
  const statusOrder = [...ZD_DEFAULT_STATUSES, ...tickets.map(t => t.status)].filter((v, i, a) => a.indexOf(v) === i);
  const byStatus = statusOrder.map(s => ({ name: s, value: tickets.filter(t => t.status === s).length })).filter(x => x.value > 0);
  const byCategory = Object.values(tickets.reduce((acc, t) => {
    const k = t.issueCategory || "—";
    acc[k] = acc[k] || { plan: k, amount: 0 };
    acc[k].amount += 1;
    return acc;
  }, {}));
  const PIE = CHART_PALETTE;


  return (
    <div className="fade-up">
      {ticketApi.usedSample && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#986315", background: "#FBF0E0", border: "1px solid #F6DEBC", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Showing sample data — the Zoho Desk endpoint is unreachable. Once connected, this reflects real tickets.
      </div>}
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Tickets by status" sub="Where things stand">
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} isAnimationActive={false} label={renderPieLabel} labelLine={pieLabelLine}>
                {byStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Tickets by issue type" sub="What customers contact about">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 30, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="amount" name="tickets" radius={[0, 6, 6, 0]} fill="#986315" maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
export function OpsKpis({ tickets }) {
  const durs = tickets.map(jobDurationMin).filter(v => v != null);
  const totalMin = durs.reduce((a, b) => a + b, 0);
  const avgMin = durs.length ? Math.round(totalMin / durs.length) : 0;
  const reductions = tickets.map(t => {
    const i = tdsNum(t.inputTds), o = tdsNum(t.outputTds);
    return (i != null && o != null && i > 0) ? Math.round((i - o) / i * 100) : null;
  }).filter(v => v != null);
  const avgRed = reductions.length ? Math.round(reductions.reduce((a, b) => a + b, 0) / reductions.length) : null;
  const stats = [
    { label: "Jobs (with timing)", value: durs.length, icon: Wrench, sub: `${tickets.length} tickets in view`, hero: true },
    { label: "Total job duration", value: fmtDuration(totalMin), icon: Clock, sub: "sum of start → end" },
    { label: "Avg job duration", value: fmtDuration(avgMin), icon: Hourglass, sub: "per job" },
    ...(avgRed != null ? [{ label: "Avg TDS reduction", value: avgRed + "%", icon: Droplets, sub: "input → output" }] : []),
  ];
  return <div style={{ ...grid4, marginBottom: 18 }}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>;
}
export function OpsSparesTable({ tickets }) {
  const withParts = tickets.filter(t => parsePartsUsed(t.partsUsed).length);
  const byIssue = {};      // issue -> { jobs, total, parts: {name:count} }
  const overall = {};      // part -> count
  for (const t of withParts) {
    const issue = t.issueCategory || "—";
    const parts = parsePartsUsed(t.partsUsed);
    const b = byIssue[issue] || (byIssue[issue] = { jobs: 0, total: 0, parts: {} });
    b.jobs++;
    for (const p of parts) { b.parts[p] = (b.parts[p] || 0) + 1; b.total++; overall[p] = (overall[p] || 0) + 1; }
  }
  const rows = Object.entries(byIssue).map(([issue, b]) => ({ issue, ...b })).sort((a, b) => b.total - a.total);
  const topSpares = (parts) => Object.entries(parts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} ×${c}`).join(", ");

  return (
    <Card title="Spares used by issue type" sub="Parts_Used correlated with Issue Category" style={{ marginTop: 18 }}>
      {rows.length === 0 ? <Empty msg="No spares (Parts_Used) recorded for the tickets in view." /> : <>
        <Table head={["Issue Type", "Jobs w/ spares", "Total spares", "Avg / job", "Top spares"]}>
          {rows.map(r => (
            <tr key={r.issue} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{r.issue}</td>
              <td style={td}>{r.jobs}</td>
              <td style={td}>{r.total}</td>
              <td style={td}>{(r.total / r.jobs).toFixed(1)}</td>
              <td style={{ ...td, textAlign: "left" }}>{topSpares(r.parts)}</td>
            </tr>
          ))}
        </Table>
      </>}
    </Card>
  );
}
export function OpsTdsTable({ tickets }) {
  const wq = tickets.filter(t => /water\s*quality/i.test(String(t.issueCategory || "")) && (tdsNum(t.inputTds) != null || tdsNum(t.outputTds) != null));
  const rows = wq.map(t => {
    const i = tdsNum(t.inputTds), o = tdsNum(t.outputTds);
    const red = (i != null && o != null && i > 0) ? Math.round((i - o) / i * 100) : null;
    return { id: t.id, ticketNo: t.ticketNo, society: t.society, purifierId: t.purifierId, i, o, red };
  });

  return (
    <Card title="Water Quality — Input vs Output TDS" sub={'Issue Category "Water Quality"'} style={{ marginTop: 18 }}>
      {rows.length === 0 ? <Empty msg="No Water Quality tickets with TDS readings in view." /> : <>
        <Table head={["Ticket", "Society", "Purifier ID", "Input TDS", "Output TDS", "Reduction"]}>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{r.ticketNo}</td>
              <td style={td}>{r.society}</td>
              <td style={td}>{r.purifierId}</td>
              <td style={td}>{r.i ?? "—"}</td>
              <td style={td}>{r.o ?? "—"}</td>
              <td style={td}>{r.red != null ? <span style={{ fontWeight: 700, color: r.red >= 60 ? "var(--teal)" : r.red >= 40 ? "#986315" : "#DC4141" }}>{r.red}%</span> : "—"}</td>
            </tr>
          ))}
        </Table>
      </>}
    </Card>
  );
}
export function TicketList({ isAdmin, preFilter, extraColumns = [], hideColumns = [], hidePriorityFilter = false, dateFilterField, topContent, bottomContent }) {
  const showCustomer = !hideColumns.includes("customer");
  const showSociety = !hideColumns.includes("society");
  const showPriority = !hideColumns.includes("priority");
  const showStatus = !hideColumns.includes("status");
  const { user } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateVal, setDateVal] = useState("");   // Ops date filter (by Job Start Time date, IST)
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");

  // preFilter scopes the whole view (e.g. Ops Tickets = Issue Category ≠ Complaint).
  const refresh = () => ticketApi.getTickets().then(list => setTickets(preFilter ? list.filter(preFilter) : list)).catch(() => setTickets([]));
  useEffect(() => { api.logView(user.username, "Viewed Tickets"); refresh(); }, []);
  if (!tickets) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, s) => { await ticketApi.updateStatus(user.username, id, s); await refresh(); setSel(p => p ? { ...p, status: s } : p); flash("Ticket updated"); };

  // Status options = Zoho Desk defaults ∪ whatever the data actually uses.
  const statusOptions = [...ZD_DEFAULT_STATUSES, ...tickets.map(t => t.status)].filter((v, i, a) => v && a.indexOf(v) === i);

  const filtered = tickets
    .filter(t => `${t.ticketNo} ${t.customer} ${t.subject} ${t.society} ${t.purifierId} ${t.issueCategory || ""}`.toLowerCase().includes(q.toLowerCase())
      && (status === "all" || t.status === status)
      && (priority === "all" || t.priority === priority)
      && (!dateFilterField || !dateVal || istDateOf(dateFilterField(t)) === dateVal))
    .sort((a, b) => new Date(b.updated) - new Date(a.updated));

  const exportCsv = () => exportToCsv("prowater-tickets.csv", [
    { label: "Ticket", get: t => t.id },
    ...(showCustomer ? [{ label: "Customer", get: t => t.customer }] : []),
    ...(showSociety ? [{ label: "Society", get: t => t.society }] : []),
    { label: "Purifier ID", get: t => t.purifierId },
    { label: "Issue Category", get: t => t.issueCategory || "" },
    ...extraColumns.map(c => ({ label: c.label, get: t => c.get(t) ?? "" })),
    ...(showPriority ? [{ label: "Priority", get: t => tkPriority(t.priority).label }] : []),
    { label: "Status", get: t => tkStatus(t.status).label },
    { label: "Created", get: t => t.created },
  ], filtered);


  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search ticket #, customer, society, purifier…" count={filtered.length}
        right={<>
          {dateFilterField && <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} title="Filter by ticket created date" style={selectStyle} />}
          {dateFilterField && dateVal && <button onClick={() => setDateVal("")} style={{ ...btnGhost, padding: "9px 12px" }} title="Clear date"><X size={14} /></button>}
          {!hidePriorityFilter && (
            <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
              <option value="all">All priorities</option>
              {ZD_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      {topContent && topContent(filtered)}
      <Card pad={false}>
        <Table head={["Ticket", ...(showCustomer ? ["Customer"] : []), ...(showSociety ? ["Society"] : []), "Purifier ID", "Issue Category", ...extraColumns.map(c => c.label), ...(showPriority ? ["Priority"] : []), ...(showStatus ? ["Status"] : []), "Created", ""]} maxHeight="calc(100vh - 300px)">
          {filtered.map(t => (
            <tr key={t.id} style={trStyle} onClick={() => setSel(t)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{t.ticketNo}</td>
              {showCustomer && <td style={td}>{t.customer}</td>}
              {showSociety && <td style={td}>{t.society}</td>}
              <td style={td}>{t.purifierId}</td>
              <td style={td}>{t.issueCategory || "—"}</td>
              {extraColumns.map((c, i) => <td key={i} style={{ ...td, fontSize: 12.5, whiteSpace: "nowrap" }}>{c.render ? c.render(t) : (c.get(t) ?? "—")}</td>)}
              {showPriority && <td style={td}><TicketBadge value={t.priority} kind="priority" /></td>}
              {showStatus && <td style={td}><TicketBadge value={t.status} kind="status" /></td>}
              <td style={{ ...td, fontSize: 12, color: "var(--muted)" }}>{fmtTime(t.created)}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No tickets match your filters." />}
      </Card>
      {bottomContent && bottomContent(filtered)}

      {sel && <Drawer onClose={() => setSel(null)} title={sel.subject} sub={sel.ticketNo}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <TicketBadge value={sel.priority} kind="priority" />
          <TicketBadge value={sel.status} kind="status" />
        </div>
        <DefRow k="Ticket ID" v={sel.zohoId || sel.id} />
        <DefRow k="Ticket Owner" v={sel.ticketOwner} />
        <DefRow k="Status" v={sel.status} />
        <DefRow k="Subject" v={sel.subject} />
        <DefRow k="Description" v={sel.description} />
        <DefRow k="Zoho Customer ID" v={sel.zohoCustomerId} />
        <DefRow k="Email ID" v={sel.emailId} />
        <DefRow k="Phone" v={sel.phone} />
        <DefRow k="Purifier ID" v={sel.purifierId} />
        <DefRow k="Issue Category" v={sel.issueCategory} />
        <DefRow k="Society Name" v={sel.society} />
        <DefRow k="Address" v={/^https?:\/\//.test(sel.address || "")
          ? <a href={sel.address} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)", wordBreak: "break-all" }}>{sel.address}</a>
          : sel.address} />
        <DefRow k="Job Start Time" v={fmtIST(sel.jobStartTime)} />
        <DefRow k="Job End Time" v={fmtIST(sel.jobEndTime)} />
        <DefRow k="Work Start Location" v={(sel.workStartLat != null && sel.workStartLat !== "" && sel.workStartLng != null && sel.workStartLng !== "")
          ? <a href={`https://www.google.com/maps?q=${sel.workStartLat},${sel.workStartLng}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: "1.5px solid var(--teal)", background: "var(--mint-2)", color: "var(--teal-d)", fontWeight: 600, fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>
              <MapPin size={14} /> Open in maps
            </a>
          : null} />
        <DefRow k="Work Start Address" v={sel.workStartAddress} />
        <DefRow k="reason for postpone" v={sel.reasonForPostpone} />
        <DefRow k="rescheduled_Date" v={sel.rescheduledDate} />
        <DefRow k="Parts_Used" v={sel.partsUsed} />
        {isAdmin && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>Update status</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {statusOptions.map(s => { const color = zdStatusColor(s); return (
                <button key={s} onClick={() => move(sel.id, s)} style={{
                  padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  border: `1.5px solid ${sel.status === s ? color : "var(--border)"}`,
                  background: sel.status === s ? color : "#fff",
                  color: sel.status === s ? "#fff" : "var(--slate)",
                }}>{s}</button>
              ); })}
            </div>
          </div>
        )}
      </Drawer>}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
