/* ===========================================================================
   modules/Billing.jsx — Billing & Subscription module.
   BillingOverview, Subscriptions, Invoices, DepositRefunds. The data layer
   (billingApi/mapSubscription/mapInvoice/mapSubmodule/depositForCustomer/
   termMonths/creditNoteApi) lives in shared/core.js — Customer.jsx needed it
   too, so it was hoisted there ahead of this module's own extraction.
   =========================================================================== */
import React, { useState, useEffect } from "react";
import {
  Check, CheckCircle2, ChevronRight, Copy, Download, Landmark, Plus,
  RotateCcw, Trash2, Undo2, Wallet,
} from "lucide-react";
import {
  useAuth, api, billingApi, customerApi, depositForCustomer, exportToCsv,
  fmtDate, inr, pushLog, SEED_PLANS, manualRefundsApi,
} from "../shared/core";
import {
  Toolbar, Loading, Empty, ApiError, Modal, Field,
  Chip, Status, Person, Drawer, DefRow,
  btnGhost, btnPrimary, inp, td,
  selectStyle, toastStyle, SortHeader,
} from "../shared/ui";

/* ===========================================================================
   BILLING & SUBSCRIPTION MODULE (Zoho Billing) — Subscriptions, Invoices,
   Deposits & Refunds, Plans. (The Overview tab/`BillingOverview` — KPI cards
   + Subscriptions-by-Status/Active-Revenue-by-Plan charts — was removed at
   v2.29.316, per explicit user request; nothing else in this file read it.)
   =========================================================================== */
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
// Manually recorded refunds (v2.29.313) — per explicit user request: this
// page's main table only ever shows deposits derived from LIVE subscriptions
// (held/eligible/requested/approved/refunded, entirely auto-generated —
// there was no way to log a refund that isn't tied to a still-existing
// subscription record, e.g. one paid out after a customer's device was
// already uninstalled and their subscription record is gone). This is a
// separate, manually-entered log, local to this browser (no backend API for
// it) — same persisted-list convention as Device Replacement's `_drStore`.
// The store itself (localStorage key + list/add/remove) now lives in
// shared/core.js as `manualRefundsApi` (v2.29.324, Fast Refresh fix) — it
// used to be a mutable `export let` reassigned right here, but an ES module
// import binding can't be reassigned from the importing file, so it moved to
// setter functions instead.

export function DepositRefunds() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [custs, setCusts] = useState([]);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [manualRefunds, setManualRefunds] = useState(() => manualRefundsApi.list());
  const [showAddRefund, setShowAddRefund] = useState(false);
  const emptyRefundForm = { name: "", phone: "", uninstallDate: "", amount: "", invoiceNumber: "", refId: "", mode: "UPI" };
  const [refundForm, setRefundForm] = useState(emptyRefundForm);
  const setRF = (k, v) => setRefundForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.logView(user.username, "Viewed Deposits & Refunds");
    Promise.all([billingApi.getSubscriptions(), customerApi.getCustomers().catch(() => [])])
      .then(([subs, cust]) => { setData(subs); setCusts(cust); })
      .catch(e => setErr(e.message || "Could not load subscriptions."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Deposit Refunds" subtitle="Synchronizing deposit refund records…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const submitManualRefund = () => {
    const name = refundForm.name.trim();
    const amount = Number(refundForm.amount);
    if (!name || !amount || amount <= 0) { flash("Enter a customer name and a valid refund amount."); return; }
    const entry = {
      id: crypto.randomUUID(),
      name, phone: refundForm.phone.trim(), uninstallDate: refundForm.uninstallDate,
      amount, invoiceNumber: refundForm.invoiceNumber.trim(), refId: refundForm.refId.trim(), mode: refundForm.mode,
      recordedBy: user.username, recordedAt: new Date().toISOString(),
    };
    setManualRefunds(manualRefundsApi.add(entry));
    pushLog({ type: "manual_refund_entry", actor: user.username, module: "Billing", detail: `Recorded manual refund: ${inr(entry.amount)} to ${entry.name}` });
    flash(`Refund entry added · ${entry.name}`);
    setRefundForm(emptyRefundForm);
    setShowAddRefund(false);
  };
  const removeManualRefund = (id, name) => {
    setManualRefunds(manualRefundsApi.remove(id));
    flash(`Refund entry removed · ${name}`);
  };

  const custBy = {};
  custs.forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custBy[k] = c; }));
  const custOf = (s) => custBy[s.customerNumber] || custBy[s.zohoCustomerId] || custBy[s.zohoId] || null;

  const rows = data
    .map(s => {
      const dep = depositForCustomer(custOf(s), s.plan, s.amount, s.planCode);
      // v2.29.315: no longer overridable by a session-only refunds map — the
      // Request/Approve/Refund action buttons that used to write to it lived
      // only in the table removed at v2.29.315, so this always just reflects
      // the subscription's own live status now.
      const state = s.status === "active" ? "held" : "eligible";
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

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 18 }}>
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

      {/* Manually Recorded Refunds (v2.29.313; the auto-generated subscription
          table this page used to lead with was removed at v2.29.315, per
          explicit user request) — a manually-entered log, since there's no
          way to derive a refund for a customer whose subscription record is
          already gone (e.g. paid out after uninstallation). */}
      <div style={{ marginTop: 18 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Manually Recorded Refunds</div>
              <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Refunds paid out on uninstallation, logged directly here — not tied to a live subscription record.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {manualRefunds.length > 0 && (
                <button onClick={() => exportToCsv("prowater-manual-refunds.csv", [
                  { label: "Customer Name", get: r => r.name }, { label: "Mobile Number", get: r => r.phone },
                  { label: "Uninstallation Date", get: r => r.uninstallDate }, { label: "Refund Amount", get: r => r.amount },
                  { label: "Invoice Number", get: r => r.invoiceNumber },
                  { label: "Transaction/Reference ID", get: r => r.refId }, { label: "Refund Mode", get: r => r.mode },
                  { label: "Recorded By", get: r => r.recordedBy }, { label: "Recorded At", get: r => r.recordedAt },
                ], manualRefunds)} style={{ ...btnGhost, padding: "8px 14px" }}><Download size={15} /> Export</button>
              )}
              <button onClick={() => setShowAddRefund(true)} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "8px 16px" }}><Plus size={15} /> Add Refund Entry</button>
            </div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer Name", "Mobile Number", "Uninstallation Date", "Refund Amount", "Invoice #", "Transaction / Reference ID", "Refund Mode", "Recorded", ""].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manualRefunds.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>{r.phone || "—"}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>{r.uninstallDate ? fmtDate(r.uninstallDate) : "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805A", whiteSpace: "nowrap" }}>{inr(r.amount)}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{r.invoiceNumber || "—"}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{r.refId || "—"}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>{r.mode}</td>
                    <td style={{ padding: "14px 18px", fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap" }}>{fmtDate(r.recordedAt)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <button onClick={() => removeManualRefund(r.id, r.name)} title="Remove this entry" style={{ ...btnGhost, padding: "5px 9px", color: "#DC4141", borderColor: "rgba(220,65,65,0.25)" }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
                {manualRefunds.length === 0 && <tr><td colSpan={9} style={{ padding: 0 }}><Empty msg="No manual refund entries yet — click 'Add Refund Entry' to log one." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddRefund && (
        <Modal title="Add Refund Entry" sub="Deposits & Refunds" onClose={() => setShowAddRefund(false)}>
          <Field label="Customer Name">
            <input value={refundForm.name} onChange={e => setRF("name", e.target.value)} placeholder="Full name" style={inp} />
          </Field>
          <Field label="Mobile Number">
            <input value={refundForm.phone} onChange={e => setRF("phone", e.target.value)} placeholder="10-digit number" style={inp} />
          </Field>
          <Field label="Uninstallation Date">
            <input type="date" value={refundForm.uninstallDate} onChange={e => setRF("uninstallDate", e.target.value)} style={inp} />
          </Field>
          <Field label="Refund Amount">
            <input type="number" min="0" value={refundForm.amount} onChange={e => setRF("amount", e.target.value)} placeholder="₹" style={inp} />
          </Field>
          <Field label="Invoice Number">
            <input value={refundForm.invoiceNumber} onChange={e => setRF("invoiceNumber", e.target.value)} placeholder="e.g. INV-000706" style={inp} />
          </Field>
          <Field label="Transaction ID / Reference ID / Refund ID">
            <input value={refundForm.refId} onChange={e => setRF("refId", e.target.value)} placeholder="e.g. UPI-2026-XXXX" style={inp} />
          </Field>
          <Field label="Refund Mode">
            <select value={refundForm.mode} onChange={e => setRF("mode", e.target.value)} style={{ ...selectStyle, width: "100%" }}>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
            </select>
          </Field>
          <button onClick={submitManualRefund} style={{ ...btnPrimary, width: "100%", marginTop: 8, background: "#08805A", color: "#fff", border: "none" }}>Submit</button>
        </Modal>
      )}

      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   Plans (v2.29.133; live-wired v2.29.287) — now fetched from the real plan
   catalog API (`billingApi.getPlans()`, GET /admin/subs-module-get-all-plans,
   shared/core.js), falling back to `SEED_PLANS` (the same 64-plan business
   dump this page always showed, before it had a live API) if that fetch
   fails or is unreachable. Note: `depositForCustomer()`/`planInfo()` and every
   other call site (Analytics.jsx, Customer.jsx) still read the STATIC
   `PLAN_CATALOG` constant, unchanged — only this page's own view is live now,
   deliberately, so this can't silently move numbers anywhere else in the app.
   =========================================================================== */
export function Plans() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.logView(user.username, "Viewed Plans");
    billingApi.getPlans().then(setRows).catch(() => setRows([...SEED_PLANS]));
  }, []);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "total", dir: "desc" });
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "name" || k === "code" ? "asc" : "desc" });
  // Copy Link feedback (v2.29.288) — briefly shows "Copied" on the clicked row only.
  const [copiedCode, setCopiedCode] = useState("");
  const copyLink = async (p) => {
    try { await navigator.clipboard.writeText(p.url); } catch { /* clipboard unavailable — silently ignore */ }
    setCopiedCode(p.code);
    setTimeout(() => setCopiedCode(c => (c === p.code ? "" : c)), 1500);
  };

  if (!rows) return <Loading title="Loading Plans" subtitle="Fetching the plan catalog…" />;

  const all = rows;

  const filtered = all.filter(p => (`${p.name} ${p.code}`).toLowerCase().includes(q.toLowerCase()));

  const dir = sort.dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    if (sort.key === "name" || sort.key === "code") return String(a[sort.key]).localeCompare(String(b[sort.key])) * dir;
    return ((a[sort.key] || 0) - (b[sort.key] || 0)) * dir;
  });

  // KPI cards (v2.29.288) — rebuilt off the real API's own fields (status,
  // setup_fee) now that Device Type/Filter Type (never part of the live
  // response) are gone from this page entirely.
  const stats = [
    { label: "Total Plans", value: all.length, sub: "in the catalog" },
    { label: "Active Plans", value: all.filter(p => p.status === "active").length, sub: "currently sellable" },
    { label: "Deposit Required", value: all.filter(p => p.setupFee > 0).length, sub: "plans with a deposit" },
    { label: "No Deposit", value: all.filter(p => !p.setupFee).length, sub: "zero setup fee" },
  ];

  const tenureOf = (p) => `${p.billEvery} ${p.billingInterval}`;

  const exportCsv = () => exportToCsv("prowater-plans.csv", [
    { label: "Plan Name", get: p => p.name }, { label: "Plan Code", get: p => p.code },
    { label: "Deposit Amount", get: p => p.setupFee }, { label: "Recharge Amount", get: p => p.price },
    { label: "Total Amount", get: p => p.total }, { label: "Tenure", get: p => tenureOf(p) },
    { label: "Link", get: p => p.url },
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
          <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
        </>} />

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 340px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 780 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {[
                  <SortHeader key="n" label="Plan Name" k="name" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="c" label="Plan Code" k="code" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="sf" label="Deposit Amount" k="setupFee" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="pr" label="Recharge Amount" k="price" sort={sort} onSort={toggleSort} />,
                  <SortHeader key="tt" label="Total Amount" k="total" sort={sort} onSort={toggleSort} />,
                  "Tenure", "Link",
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
                  <td style={{ padding: "14px 18px", color: p.setupFee ? "#0d2119" : "#94a3b8", fontWeight: p.setupFee ? 600 : 400 }}>{p.setupFee ? inr(p.setupFee) : "—"}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(p.price)}</td>
                  <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(p.total)}</td>
                  <td style={{ padding: "14px 18px", color: "#475569", whiteSpace: "nowrap" }}>{tenureOf(p)}</td>
                  <td style={{ padding: "14px 18px" }}>
                    {p.url ? (
                      <button onClick={() => copyLink(p)} title={p.url} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 8, border: "1px solid " + (copiedCode === p.code ? "#08805a" : "rgba(0,0,0,.1)"), background: copiedCode === p.code ? "rgba(8,128,90,.1)" : "#fff", color: copiedCode === p.code ? "#08805a" : "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {copiedCode === p.code ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Link</>}
                      </button>
                    ) : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                </tr>
              ))}
              {sorted.length > 0 && (
                <tr style={{ background: "rgba(243,248,236,.5)" }}>
                  <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119" }} colSpan={2}>Total ({sorted.length})</td>
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
