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
  fmtDate, inr, pushLog,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, Modal, Field,
  Chip, Status, Person, Drawer, DefRow, CHART_PALETTE, renderPieLabel,
  pieLabelLine, btnGhost, btnPrimary, td, ftd, trStyle, grid4, axisTick,
  selectStyle, toastStyle,
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
  if (!data) return <Loading />;

  const { subs, invs } = data;
  const activeSubs = subs.filter(s => s.status === "active").length;
  const mrr = subs.filter(s => s.status === "active").reduce((sum, s) => {
    const u = String(s.interval || "").toLowerCase();
    const monthly = u.includes("year") || u.includes("annual") ? s.amount / 12
      : u.includes("quarter") ? s.amount / 3
      : u.includes("half") ? s.amount / 6
      : s.amount; // monthly / weekly treated as-is
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
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Subscriptions by status" sub="Live, paused, cancelled & more">
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={subByStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} isAnimationActive={false} label={renderPieLabel} labelLine={pieLabelLine}>
                {subByStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Active revenue by plan" sub="Recurring amount per plan">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revByPlan} layout="vertical" margin={{ left: 30, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="amount" name="recurring value" radius={[0, 6, 6, 0]} fill="#0B6F52" maxBarSize={40} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
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
  if (!rows) return <Loading />;

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
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search subscription, customer, plan…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Trial / Future</option>
            <option value="paused">Past due / Paused</option>
            <option value="failed">Cancelled</option>
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Subscription", "Customer", "Plan", "Amount", "Interval", "Status", "Next billing", ""]} maxHeight="calc(100vh - 300px)">
          {filtered.map(s => (
            <tr key={s.id} style={trStyle} onClick={() => setSel(s)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{s.id}</td>
              <td style={td}><Person name={s.customerName || "—"} email={s.email} /></td>
              <td style={td}>{s.plan || "—"}</td>
              <td style={td}>{inr(s.amount)}</td>
              <td style={td}>{s.interval || "—"}</td>
              <td style={td}><Status s={s.status} /></td>
              <td style={td}>{s.nextBilling ? fmtDate(s.nextBilling) : "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={3}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.amount || 0), 0))}</td>
              <td style={ftd}></td><td style={ftd}></td><td style={ftd}></td><td style={ftd}></td>
            </tr>
          )}
        </Table>
        {filtered.length === 0 && <Empty msg="No subscriptions match your filters." />}
      </Card>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.customerName || sel.id} sub={sel.id}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <Status s={sel.status} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Zoho: {sel.zohoId || "—"}</span>
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
  if (!rows) return <Loading />;

  // Join invoice -> customer (society + device type) so the real per-apartment
  // deposit table can apply — see depositForCustomer().
  const custBy = {};
  custs.forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custBy[k] = c; }));
  const custOf = (i) => custBy[i.customerNumber] || custBy[i.zohoCustomerId] || custBy[i.zohoId] || null;
  const depositOf = (i) => depositForCustomer(custOf(i), i.plan, i.total);

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
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search invoice #, customer, email…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Sent / Unpaid</option>
            <option value="failed">Overdue</option>
            <option value="disabled">Void</option>
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Invoice", "Customer", "Total", "Security Deposit", "Balance", "Status", "Date", "Due", ""]} maxHeight="calc(100vh - 300px)">
          {filtered.map(i => (
            <tr key={i.id} style={trStyle} onClick={() => setSel(i)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}><Chip>{i.number || i.id}</Chip></td>
              <td style={td}><Person name={i.customerName || "—"} email={i.email} /></td>
              <td style={td}>{inr(i.total)}</td>
              <td style={td}>{depositOf(i) ? inr(depositOf(i)) : "—"}</td>
              <td style={td}>{i.balance > 0 ? <strong style={{ color: "#DC4141" }}>{inr(i.balance)}</strong> : inr(0)}</td>
              <td style={td}><Status s={i.status} /></td>
              <td style={td}>{i.date ? fmtDate(i.date) : "—"}</td>
              <td style={td}>{i.dueDate ? fmtDate(i.dueDate) : "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={2}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.total || 0), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + depositOf(r), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.balance || 0), 0))}</td>
              <td style={ftd}></td><td style={ftd}></td><td style={ftd}></td><td style={ftd}></td>
            </tr>
          )}
        </Table>
        {filtered.length === 0 && <Empty msg="No invoices match your filters." />}
      </Card>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.number || sel.id} sub={sel.customerName}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <Status s={sel.status} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Zoho: {sel.zohoId || "—"}</span>
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
  const [refunds, setRefunds] = useState({}); // subId -> requested | approved | refunded
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.logView(user.username, "Viewed Deposits & Refunds");
    Promise.all([billingApi.getSubscriptions(), customerApi.getCustomers().catch(() => [])])
      .then(([subs, cust]) => { setData(subs); setCusts(cust); })
      .catch(e => setErr(e.message || "Could not load subscriptions."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };

  // Join subscription -> customer (society + device type) so the real
  // per-apartment deposit table can apply — see depositForCustomer().
  const custBy = {};
  custs.forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custBy[k] = c; }));
  const custOf = (s) => custBy[s.customerNumber] || custBy[s.zohoCustomerId] || custBy[s.zohoId] || null;

  const rows = data
    .map(s => {
      const dep = depositForCustomer(custOf(s), s.plan, s.amount);
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
    const map = { held: ["#0B6F52", "#E2F3EE", "Held"], eligible: ["#986315", "#FBF0E0", "Refund eligible"], requested: ["#986315", "#FBF0E0", "Requested"], approved: ["#2A86D6", "#E5F0FA", "Approved"], refunded: ["#08805A", "#E2F3EE", "Refunded"] };
    const [c, bg, lbl] = map[state] || ["#7D8A83", "#ECEEED", state];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const action = (r) => {
    if (["held", "eligible"].includes(r.state)) return <button onClick={() => advance(r, "requested", "Refund requested")} style={{ ...btnGhost, padding: "6px 12px" }}><Undo2 size={14} /> Request</button>;
    if (r.state === "requested") return <button onClick={() => advance(r, "approved", "Refund approved")} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12.5 }}><Check size={14} /> Approve</button>;
    if (r.state === "approved") return <button onClick={() => advance(r, "refunded", "Refund completed")} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12.5 }}><Check size={14} /> Mark refunded</button>;
    return <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>;
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
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Deposits & Refunds" sub="Refundable security deposits held per plan. Request → approve → refund on cancellation.">
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, plan or subscription…" count={shown.length}
            right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
          <Table head={["Customer", "Subscription", "Plan", "Deposit", "Status", "Action"]} maxHeight={520}>
            {shown.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}><Person name={r.s.customerName || "—"} email={r.s.email} /></td>
                <td style={{ ...td, textAlign: "center" }}><Chip>{r.s.id}</Chip></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{r.s.plan || "—"}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{inr(r.dep)}</td>
                <td style={{ ...td, textAlign: "center" }}>{stChip(r.state)}</td>
                <td style={{ ...td, textAlign: "center" }}>{action(r)}</td>
              </tr>
            ))}
            {shown.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={3}>Total ({shown.length})</td>
                <td style={ftd}>{inr(shown.reduce((a, r) => a + r.dep, 0))}</td>
                <td style={ftd}></td><td style={ftd}></td>
              </tr>
            )}
            {shown.length === 0 && <tr><td colSpan={6} style={{ padding: 0 }}><Empty msg="No deposits found (plans at or below ₹1,500 carry no deposit)." /></td></tr>}
          </Table>
        </Card>
      </div>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
