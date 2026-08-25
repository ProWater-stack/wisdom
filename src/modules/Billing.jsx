/* ===========================================================================
   modules/Billing.jsx — Billing & Subscription module.
   BillingOverview, Subscriptions, Invoices, DepositRefunds. The data layer
   (billingApi/mapSubscription/mapInvoice/mapSubmodule/depositForCustomer/
   termMonths/creditNoteApi) lives in shared/core.js — Customer.jsx needed it
   too, so it was hoisted there ahead of this module's own extraction.
   =========================================================================== */
import React, { useState, useEffect } from "react";
import {
  Check, CheckCircle2, ChevronRight, Download, Landmark, RefreshCw,
  RotateCcw, TrendingUp, Undo2, Wallet,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  useAuth, api, billingApi, customerApi, depositForCustomer, exportToCsv,
  fmtDate, inr, pushLog, PLAN_CATALOG,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, Modal, Field,
  Chip, Status, Person, Drawer, DefRow, CHART_PALETTE, renderPieLabel,
  pieLabelLine, btnGhost, btnPrimary, td, ftd, trStyle, grid4, axisTick,
  selectStyle, toastStyle, MultiSelectFilter, SortHeader,
} from "../shared/ui";

/* ===========================================================================
   BILLING & SUBSCRIPTION MODULE (Zoho Billing) — Overview, Subscriptions, Invoices
   =========================================================================== */
export function BillingOverview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.logView(user.username, "Viewed Billing overview");
    Promise.all([billingApi.getSubscriptions(), billingApi.getInvoices()])
      .then(([subs, invs]) => setData({ subs, invs }))
      .catch(e => setErr(e.message || "Could not load billing data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Billing Overview" subtitle="Synchronizing invoices, plans and renewals…" />;

  const { subs, invs } = data;
  const activeSubs = subs.filter(s => s.status === "active").length;
  const mrr = subs.filter(s => s.status === "active").reduce((sum, s) => {
    const u = String(s.interval || "").toLowerCase();
    const monthly = u.includes("year") || u.includes("annual") ? s.amount / 12
      : u.includes("quarter") ? s.amount / 3
      : u.includes("half") ? s.amount / 6
      : s.amount;
    return sum + monthly;
  }, 0);
  const outstanding = invs.reduce((sum, i) => sum + (i.balance || 0), 0);
  const overdue = invs.filter(i => i.status === "failed" || (i.balance > 0 && i.rawStatus?.toLowerCase() === "overdue")).length;
  const collected = invs.filter(i => i.status === "paid").reduce((sum, i) => sum + i.total, 0);

  const stats = [
    { label: "Active subscriptions", value: activeSubs, icon: RefreshCw, sub: `${subs.length} total`, hero: true },
    { label: "Est. MRR", value: inr(Math.round(mrr)), icon: TrendingUp, sub: "from active plans" },
    { label: "Outstanding", value: inr(outstanding), icon: Wallet, sub: `${overdue} overdue invoice${overdue !== 1 ? "s" : ""}` },
    { label: "Collected", value: inr(collected), icon: CheckCircle2, sub: "paid invoices" },
  ];

  const subByStatus = Object.values(subs.reduce((acc, s) => {
    acc[s.status] = acc[s.status] || { name: s.status, value: 0 };
    acc[s.status].value += 1; return acc;
  }, {}));
  const revByPlan = Object.values(subs.reduce((acc, s) => {
    const k = s.plan || "—";
    acc[k] = acc[k] || { plan: k, amount: 0 };
    if (s.status === "active") acc[k].amount += s.amount;
    return acc;
  }, {}));
  const PIE = CHART_PALETTE.slice(0, 6);

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: s.hero ? "linear-gradient(135deg, #0A9D6E 0%, #E8A93A 100%)" : "rgba(255, 255, 255, 0.85)",
            backdropFilter: s.hero ? "none" : "blur(20px)",
            WebkitBackdropFilter: s.hero ? "none" : "blur(20px)",
            border: s.hero ? "none" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: s.hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: s.hero ? "#B5E2D4" : "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.hero ? "rgba(255,255,255,0.2)" : "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color={s.hero ? "#ffffff" : "#08805A"} />
              </div>
            </div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 700, color: s.hero ? "#ffffff" : "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: s.hero ? "#E2F3EE" : "#86868B" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Subscriptions by Status</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Live, paused, cancelled & more</div>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={subByStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} isAnimationActive={false} label={renderPieLabel} labelLine={pieLabelLine}>
                {subByStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12.5, color: "#1D1D1F" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Active Revenue by Plan</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Recurring amount per plan</div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revByPlan} layout="vertical" margin={{ left: 30, right: 16 }}>
              <defs>
                <linearGradient id="bilPlanGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#0A9D6E" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plan" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(8,128,90,.06)" }} />
              <Bar dataKey="amount" name="recurring value" radius={[0, 6, 6, 0]} fill="url(#bilPlanGrad)" maxBarSize={40} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

export function Subscriptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState(null);

  useEffect(() => { api.logView(user.username, "Viewed Subscriptions"); billingApi.getSubscriptions().then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <Loading title="Loading Subscriptions" subtitle="Synchronizing active subscription plans…" />;

  const filtered = rows.filter(s =>
    (`${s.customerName} ${s.email} ${s.phone} ${s.id} ${s.plan} ${s.customerNumber}`).toLowerCase().includes(q.toLowerCase())
    && (status === "all" || s.status === status));

  const exportCsv = () => exportToCsv("prowater-subscriptions.csv", [
    { label: "Subscription", get: s => s.id },
    { label: "Customer", get: s => s.customerName },
    { label: "Customer #", get: s => s.customerNumber },
    { label: "Email", get: s => s.email },
    { label: "Phone", get: s => s.phone },
    { label: "Plan", get: s => s.plan },
    { label: "Amount", get: s => s.amount },
    { label: "Interval", get: s => s.interval },
    { label: "Status", get: s => s.rawStatus || s.status },
    { label: "Next billing", get: s => s.nextBilling },
  ], filtered);

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <Toolbar q={q} setQ={setQ} placeholder="Search subscription, customer, plan…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Trial / Future</option>
            <option value="paused">Past due / Paused</option>
            <option value="failed">Cancelled</option>
          </select>
          <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
        </>} />

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 300px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Subscription", "Customer", "Plan", "Amount", "Interval", "Status", "Next Billing", ""].map(h => (
                  <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", cursor: "pointer" }} onClick={() => setSel(s)}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#1D1D1F" }}>{s.id}</td>
                  <td style={{ padding: "14px 18px" }}><Person name={s.customerName || "—"} email={s.email} /></td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{s.plan || "—"}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805A" }}>{inr(s.amount)}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{s.interval || "—"}</td>
                  <td style={{ padding: "14px 18px" }}><Status s={s.status} /></td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{s.nextBilling ? fmtDate(s.nextBilling) : "—"}</td>
                  <td style={{ padding: "14px 18px", textAlign: "center" }}><ChevronRight size={16} color="#86868B" /></td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr style={{ background: "rgba(243,248,236,.5)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }} colSpan={3}>Total ({filtered.length})</td>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#08805A" }}>{inr(filtered.reduce((s, r) => s + (r.amount || 0), 0))}</td>
                  <td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty msg="No subscriptions match your filters." />}
      </div>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.customerName || sel.id} sub={sel.id}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <Status s={sel.status} />
          <span style={{ fontSize: 12, color: "#86868B" }}>Zoho: {sel.zohoId || "—"}</span>
        </div>
        <DefRow k="Customer number" v={sel.customerNumber || "—"} />
        <DefRow k="Email" v={sel.email || "—"} />
        <DefRow k="Phone" v={sel.phone || "—"} />
        <DefRow k="Plan" v={sel.plan || "—"} />
        <DefRow k="Plan code" v={sel.planCode || "—"} />
        <DefRow k="Amount" v={inr(sel.amount)} />
        <DefRow k="Interval" v={sel.interval || "—"} />
        <DefRow k="Raw status" v={sel.rawStatus || "—"} />
        <DefRow k="Activated" v={sel.activatedAt ? fmtDate(sel.activatedAt) : "—"} />
        <DefRow k="Next billing" v={sel.nextBilling ? fmtDate(sel.nextBilling) : "—"} />
      </Drawer>}
    </div>
  );
}

export function Invoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [custs, setCusts] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState(null);

  useEffect(() => {
    api.logView(user.username, "Viewed Invoices");
    Promise.all([billingApi.getInvoices(), customerApi.getCustomers().catch(() => [])])
      .then(([inv, cust]) => { setRows(inv); setCusts(cust); })
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <Loading title="Loading Invoices" subtitle="Synchronizing invoice records…" />;

  const custBy = {};
  custs.forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custBy[k] = c; }));
  const custOf = (i) => custBy[i.customerNumber] || custBy[i.zohoCustomerId] || custBy[i.zohoId] || null;
  const depositOf = (i) => depositForCustomer(custOf(i), i.plan, i.total, i.planCode);

  const filtered = rows.filter(i =>
    (`${i.number} ${i.customerName} ${i.email} ${i.customerNumber} ${i.plan}`).toLowerCase().includes(q.toLowerCase())
    && (status === "all" || i.status === status))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const exportCsv = () => exportToCsv("prowater-invoices.csv", [
    { label: "Invoice", get: i => i.number },
    { label: "Customer", get: i => i.customerName },
    { label: "Customer #", get: i => i.customerNumber },
    { label: "Email", get: i => i.email },
    { label: "Total", get: i => i.total },
    { label: "Security Deposit", get: i => depositOf(i) },
    { label: "Balance", get: i => i.balance },
    { label: "Status", get: i => i.rawStatus || i.status },
    { label: "Date", get: i => i.date },
    { label: "Due date", get: i => i.dueDate },
  ], filtered);

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <Toolbar q={q} setQ={setQ} placeholder="Search invoice #, customer, email…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Sent / Unpaid</option>
            <option value="failed">Overdue</option>
            <option value="disabled">Void</option>
          </select>
          <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
        </>} />

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 300px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Invoice", "Customer", "Total", "Security Deposit", "Balance", "Status", "Date", "Due", ""].map(h => (
                  <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", cursor: "pointer" }} onClick={() => setSel(i)}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#1D1D1F" }}><Chip>{i.number || i.id}</Chip></td>
                  <td style={{ padding: "14px 18px" }}><Person name={i.customerName || "—"} email={i.email} /></td>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#1D1D1F" }}>{inr(i.total)}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{depositOf(i) ? inr(depositOf(i)) : "—"}</td>
                  <td style={{ padding: "14px 18px" }}>{i.balance > 0 ? <strong style={{ color: "#DC4141" }}>{inr(i.balance)}</strong> : inr(0)}</td>
                  <td style={{ padding: "14px 18px" }}><Status s={i.status} /></td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{i.date ? fmtDate(i.date) : "—"}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{i.dueDate ? fmtDate(i.dueDate) : "—"}</td>
                  <td style={{ padding: "14px 18px", textAlign: "center" }}><ChevronRight size={16} color="#86868B" /></td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr style={{ background: "rgba(243,248,236,.5)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }} colSpan={2}>Total ({filtered.length})</td>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#08805A" }}>{inr(filtered.reduce((s, r) => s + (r.total || 0), 0))}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119" }}>{inr(filtered.reduce((s, r) => s + depositOf(r), 0))}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#DC4141" }}>{inr(filtered.reduce((s, r) => s + (r.balance || 0), 0))}</td>
                  <td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty msg="No invoices match your filters." />}
      </div>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.number || sel.id} sub={sel.customerName}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <Status s={sel.status} />
          <span style={{ fontSize: 12, color: "#86868B" }}>Zoho: {sel.zohoId || "—"}</span>
        </div>
        <DefRow k="Customer" v={sel.customerName || "—"} />
        <DefRow k="Customer number" v={sel.customerNumber || "—"} />
        <DefRow k="Email" v={sel.email || "—"} />
        <DefRow k="Plan" v={sel.plan || "—"} />
        <DefRow k="Total" v={inr(sel.total)} />
        <DefRow k="Security deposit" v={depositOf(sel) ? inr(depositOf(sel)) : "—"} />
        <DefRow k="Balance" v={inr(sel.balance)} />
        <DefRow k="Raw status" v={sel.rawStatus || "—"} />
        <DefRow k="Invoice date" v={sel.date ? fmtDate(sel.date) : "—"} />
        <DefRow k="Due date" v={sel.dueDate ? fmtDate(sel.dueDate) : "—"} />
      </Drawer>}
    </div>
  );
}

/* ---- Billing: Deposit & Refund management ---- */
export function DepositRefunds() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [custs, setCusts] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [refunds, setRefunds] = useState({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.logView(user.username, "Viewed Deposits & Refunds");
    Promise.all([billingApi.getSubscriptions(), customerApi.getCustomers().catch(() => [])])
      .then(([subs, cust]) => { setData(subs); setCusts(cust); })
      .catch(e => setErr(e.message || "Could not load subscriptions."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Deposit Refunds" subtitle="Synchronizing deposit refund records…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const custBy = {};
  custs.forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custBy[k] = c; }));
  const custOf = (s) => custBy[s.customerNumber] || custBy[s.zohoCustomerId] || custBy[s.zohoId] || null;

  const rows = data
    .map(s => {
      const dep = depositForCustomer(custOf(s), s.plan, s.amount, s.planCode);
      const state = refunds[s.id] || (s.status === "active" ? "held" : "eligible");
      return { s, dep, state };
    })
    .filter(r => r.dep > 0);

  const totalHeld = rows.filter(r => ["held", "eligible", "requested", "approved"].includes(r.state)).reduce((a, r) => a + r.dep, 0);
  const heldCount = rows.filter(r => r.state === "held").length;
  const pending = rows.filter(r => ["requested", "approved"].includes(r.state)).length;
  const refundedTotal = rows.filter(r => r.state === "refunded").reduce((a, r) => a + r.dep, 0);

  const stats = [
    { label: "Deposits held", value: inr(totalHeld), icon: Wallet, sub: `${heldCount} active`, hero: true },
    { label: "Refund requests", value: pending, icon: Undo2, sub: "awaiting action" },
    { label: "Refunded", value: inr(refundedTotal), icon: RotateCcw, sub: "returned to customers" },
    { label: "Avg deposit", value: inr(rows.length ? Math.round(rows.reduce((a, r) => a + r.dep, 0) / rows.length) : 0), icon: Landmark, sub: "per plan" },
  ];

  const advance = (r, next, verb) => {
    setRefunds(prev => ({ ...prev, [r.s.id]: next }));
    pushLog({ type: "deposit_refund", actor: user.username, module: "Billing", detail: `${verb}: ${inr(r.dep)} deposit for ${r.s.customerName || r.s.id}` });
    flash(`${verb} · ${r.s.customerName || r.s.id}`);
  };

  const stChip = (state) => {
    const map = { held: ["#08805A", "rgba(8,128,90,0.12)", "Held"], eligible: ["#986315", "rgba(152,99,21,0.12)", "Refund eligible"], requested: ["#986315", "rgba(152,99,21,0.12)", "Requested"], approved: ["#2A86D6", "rgba(42,134,214,0.12)", "Approved"], refunded: ["#08805A", "rgba(8,128,90,0.12)", "Refunded"] };
    const [c, bg, lbl] = map[state] || ["#86868B", "rgba(0,0,0,0.06)", state];
    return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const action = (r) => {
    if (["held", "eligible"].includes(r.state)) return <button onClick={() => advance(r, "requested", "Refund requested")} style={{ ...btnGhost, padding: "6px 12px" }}><Undo2 size={14} /> Request</button>;
    if (r.state === "requested") return <button onClick={() => advance(r, "approved", "Refund approved")} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 12px", fontSize: 12.5 }}><Check size={14} /> Approve</button>;
    if (r.state === "approved") return <button onClick={() => advance(r, "refunded", "Refund completed")} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 12px", fontSize: 12.5 }}><Check size={14} /> Mark refunded</button>;
    return <span style={{ fontSize: 12, color: "#86868B" }}>—</span>;
  };

  const ql = q.toLowerCase();
  const shown = rows.filter(r => !ql || `${r.s.customerName} ${r.s.email} ${r.s.id} ${r.s.plan}`.toLowerCase().includes(ql));

  const exportCsv = () => exportToCsv("prowater-deposits.csv", [
    { label: "Customer", get: r => r.s.customerName },
    { label: "Subscription", get: r => r.s.id },
    { label: "Plan", get: r => r.s.plan },
    { label: "Deposit", get: r => r.dep },
    { label: "Status", get: r => r.state },
  ], shown);

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 18 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: s.hero ? "linear-gradient(135deg, #0A9D6E 0%, #E8A93A 100%)" : "rgba(255, 255, 255, 0.85)",
            backdropFilter: s.hero ? "none" : "blur(20px)",
            WebkitBackdropFilter: s.hero ? "none" : "blur(20px)",
            border: s.hero ? "none" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: s.hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: s.hero ? "#B5E2D4" : "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.hero ? "rgba(255,255,255,0.2)" : "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color={s.hero ? "#ffffff" : "#08805A"} />
              </div>
            </div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 700, color: s.hero ? "#ffffff" : "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: s.hero ? "#E2F3EE" : "#86868B" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Deposits & Refunds</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Refundable security deposits held per plan. Request → approve → refund on cancellation.</div>
          </div>
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, plan or subscription…" count={shown.length}
            right={<button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>} />
          
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: 520 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer", "Subscription", "Plan", "Deposit", "Status", "Action"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", textAlign: h === "Customer" ? "left" : "center", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px" }}><Person name={r.s.customerName || "—"} email={r.s.email} /></td>
                    <td style={{ padding: "14px 18px", textAlign: "center" }}><Chip>{r.s.id}</Chip></td>
                    <td style={{ padding: "14px 18px", textAlign: "center", fontSize: 12.5, color: "#475569" }}>{r.s.plan || "—"}</td>
                    <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#08805A" }}>{inr(r.dep)}</td>
                    <td style={{ padding: "14px 18px", textAlign: "center" }}>{stChip(r.state)}</td>
                    <td style={{ padding: "14px 18px", textAlign: "center" }}>{action(r)}</td>
                  </tr>
                ))}
                {shown.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#0d2119", textAlign: "center" }} colSpan={3}>Total ({shown.length})</td>
                    <td style={{ padding: "14px 18px", fontWeight: 800, color: "#08805A", textAlign: "center" }}>{inr(shown.reduce((a, r) => a + r.dep, 0))}</td>
                    <td style={{ padding: "14px 18px" }}></td><td style={{ padding: "14px 18px" }}></td>
                  </tr>
                )}
                {shown.length === 0 && <tr><td colSpan={6} style={{ padding: 0 }}><Empty msg="No deposits found (plans at or below ₹1,500 carry no deposit)." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   Plans (v2.29.133) — the master plan catalog (PLAN_CATALOG, shared/core.js),
   given directly by the business: 64 real plans with their exact Device Type,
   Filter Type, Setup Fee, Price, Total, and billing cadence. Static local
   data, no API fetch — this IS the source of truth `depositForCustomer()` now
   reads from first (see shared/core.js). Read-only reference screen; edit the
   catalog in code, not here.
   =========================================================================== */
export function Plans() {
  const { user } = useAuth();
  useEffect(() => { api.logView(user.username, "Viewed Plans"); }, []);

  const [q, setQ] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(null); // null = all
  const [filterTypeFilter, setFilterTypeFilter] = useState(null); // null = all
  const [sort, setSort] = useState({ key: "total", dir: "desc" });
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "name" || k === "code" ? "asc" : "desc" });

  const all = Object.entries(PLAN_CATALOG).map(([code, p]) => ({ code, ...p }));
  const deviceTypeOptions = Array.from(new Set(all.map(p => p.deviceType))).sort();
  const filterTypeOptions = Array.from(new Set(all.map(p => p.filterType))).sort();

  const filtered = all.filter(p =>
    (`${p.name} ${p.code}`).toLowerCase().includes(q.toLowerCase())
    && (deviceTypeFilter === null || deviceTypeFilter.includes(p.deviceType))
    && (filterTypeFilter === null || filterTypeFilter.includes(p.filterType)));

  const dir = sort.dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    if (sort.key === "name" || sort.key === "code" || sort.key === "deviceType" || sort.key === "filterType") {
      return String(a[sort.key]).localeCompare(String(b[sort.key])) * dir;
    }
    return ((a[sort.key] || 0) - (b[sort.key] || 0)) * dir;
  });

  const stats = [
    { label: "Total Plans", value: all.length, sub: "in the catalog" },
    { label: "Normal Device", value: all.filter(p => p.deviceType === "Normal").length, sub: "plans" },
    { label: "Hot & Cold", value: all.filter(p => p.deviceType === "Hot & Cold").length, sub: "plans" },
    { label: "Setup Fee ₹0", value: all.filter(p => !p.setupFee).length, sub: "no deposit component" },
  ];

  const exportCsv = () => exportToCsv("prowater-plans.csv", [
    { label: "Plan Name", get: p => p.name }, { label: "Plan Code", get: p => p.code },
    { label: "Device Type", get: p => p.deviceType }, { label: "Filter Type", get: p => p.filterType },
    { label: "Setup Fee", get: p => p.setupFee }, { label: "Price", get: p => p.price },
    { label: "Total", get: p => p.total }, { label: "Bill Every", get: p => p.billEvery },
    { label: "Billing Interval", get: p => p.billingInterval },
  ], sorted);

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px rgba(0,0,0,.03)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>{s.label}</span>
            <div className="serif" style={{ fontSize: 28, fontWeight: 700, color: "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#86868B" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Search plan name or code…" count={sorted.length}
        right={<>
          <MultiSelectFilter label="Device Type" options={deviceTypeOptions} value={deviceTypeFilter} onChange={setDeviceTypeFilter} width={180} />
          <MultiSelectFilter label="Filter Type" options={filterTypeOptions} value={filterTypeFilter} onChange={setFilterTypeFilter} width={180} />
          <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
        </>} />

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 340px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 960 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {[
                  <SortHeader key="n" label="Plan Name" k="name" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="c" label="Plan Code" k="code" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="dt" label="Device Type" k="deviceType" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="ft" label="Filter Type" k="filterType" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="sf" label="Setup Fee" k="setupFee" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="pr" label="Price" k="price" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="tt" label="Total" k="total" sort={sort} onSort={toggleSort} />,
                  "Bill Every", "Billing Interval",
                ].map((h, idx) => (
                  <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.code} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{p.name}</td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: "#86868b", whiteSpace: "nowrap" }}>{p.code}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", color: p.deviceType === "Hot & Cold" ? "#986315" : p.deviceType === "Test" ? "#86868b" : "#08805a", background: p.deviceType === "Hot & Cold" ? "rgba(152,99,21,.12)" : p.deviceType === "Test" ? "rgba(134,134,139,.12)" : "rgba(8,128,90,.12)" }}>
                      {p.deviceType}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{p.filterType}</td>
                  <td style={{ padding: "14px 18px", color: p.setupFee ? "#0d2119" : "#94a3b8", fontWeight: p.setupFee ? 600 : 400 }}>{p.setupFee ? inr(p.setupFee) : "—"}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(p.price)}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(p.total)}</td>
                  <td style={{ padding: "14px 18px", color: "#475569", textAlign: "center" }}>{p.billEvery}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{p.billingInterval}</td>
                </tr>
              ))}
              {sorted.length > 0 && (
                <tr style={{ background: "rgba(243,248,236,.5)" }}>
                  <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119" }} colSpan={4}>Total ({sorted.length})</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(sorted.reduce((s, p) => s + (p.setupFee || 0), 0))}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(sorted.reduce((s, p) => s + (p.price || 0), 0))}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(sorted.reduce((s, p) => s + (p.total || 0), 0))}</td>
                  <td style={{ padding: "14px 18px" }}></td>
                  <td style={{ padding: "14px 18px" }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && <Empty msg="No plans match your filters." />}
      </div>
    </div>
  );
}
