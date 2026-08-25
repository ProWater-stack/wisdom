/* ===========================================================================
   modules/Referral.jsx — Referral module.
   Overview, Referrers, Referees, Credits, AddManualCredit, Analytics (this
   module's own tab — exported as `Analytics` here, aliased to
   `ReferralAnalyticsTab` on import into App.jsx to avoid any confusion with
   the separate Analytics module), Backtrack, and Tracker (phone lookup +
   reward-tier progress, uses the TIERS/tierFor/nextTier/waLink/pitchFor
   reward-tier cluster below it).
   =========================================================================== */
import React, { useState, useEffect } from "react";
import {
  AlertCircle, ArrowUpRight, Award, Ban, Check, CheckCircle2, ChevronRight,
  Coins, Download, Eye, GitBranch, Hourglass, Medal, MessageCircle, Phone,
  Plus, RefreshCw, RotateCcw, Search, TrendingUp, Trophy, Undo2, Users,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  useAuth, api, parseApiDate, exportToCsv, fmtDate, fmtTime, freeLabel,
  EXISTING_CREDIT, NEW_CREDIT,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, Modal, Field,
  Chip, Status, Person, Drawer, DefRow, CHART_PALETTE, renderPieLabel,
  pieLabelLine, btnGhost, btnPrimary, td, trStyle, grid4, axisTick,
  selectStyle, toastStyle, inp,
} from "../shared/ui";

/* ===========================================================================
   Overview
   =========================================================================== */
export function Overview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.logView(user.username, "Viewed Overview");
    Promise.all([api.getReferrers(), api.getReferees(), api.getTrend()])
      .then(([refs, rees, tr]) => setData({ refs, rees, tr }))
      .catch(e => setErr(e.message || "Could not load data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Referral Overview" subtitle="Synchronizing referral program data…" />;

  const totalRefs = data.refs.length;
  const totalReees = data.rees.length;
  const converted = data.rees.filter(r => r.status === "paid").length;
  const freeMonths = data.refs.reduce((s, r) => s + (r.freeMonthsEarned || 0), 0);
  const convRate = totalReees ? Math.round((converted / totalReees) * 100) : 0;

  const stats = [
    { label: "Active referrers", value: totalRefs, icon: Users, sub: "live from API" },
    { label: "Referees tracked", value: totalReees, icon: GitBranch, sub: `${converted} converted` },
    { label: "Conversion rate", value: convRate + "%", icon: TrendingUp, sub: "converted referees" },
    { label: "Free months granted", value: freeMonths + " mo", icon: Wallet, sub: "to referrers", hero: true },
  ];


  return (
    <div className="fade-up">
      <div style={grid4}>
        {stats.map(s => <Stat key={s.label} {...s} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginTop: 18 }} className="ov-grid">
        <style>{`@media(max-width:820px){.ov-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Referral momentum" sub="Referrals vs. conversions, last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.tr} margin={{ left: -18, right: 6, top: 8 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E9E4F" stopOpacity={.35} /><stop offset="100%" stopColor="#1E9E4F" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E9E4F" stopOpacity={.5} /><stop offset="100%" stopColor="#1E9E4F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" vertical={false} />
              <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="referrals" stroke="#1E9E4F" strokeWidth={2.5} fill="url(#g1)" isAnimationActive={false} />
              <Area type="monotone" dataKey="conversions" stroke="#1E9E4F" strokeWidth={2.5} fill="url(#g2)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top referrers" sub="By free months earned">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...data.refs].sort((a, b) => b.freeMonthsEarned - a.freeMonthsEarned).slice(0, 5).map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 22, fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, color: i === 0 ? "var(--lime-d)" : "var(--muted)", fontSize: 18 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.converted}/{r.totalReferred} converted</div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--f)", fontSize: 13.5, whiteSpace: "nowrap" }}>{r.freeMonthsEarned}M / {r.freeMonthsEarned * 30} days</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   Referrers
   =========================================================================== */
export function Referrers() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [referees, setReferees] = useState([]);

  const refresh = (force) => api.getReferrers().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    api.logView(user.username, "Viewed Referrers");
    refresh();
    api.getReferees().then(setReferees);
  }, []);
  if (!rows) return <Loading title="Loading Referrers" subtitle="Synchronizing referrer records…" />;

  const filtered = rows.filter(r => (r.name + r.email + r.code).toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => exportToCsv("prowater-referrers.csv", [
    { label: "Name", get: r => r.name },
    { label: "Email", get: r => r.email },
    { label: "Phone", get: r => r.phone },
    { label: "Customer key", get: r => r.code },
    { label: "Society", get: r => r.society },
    { label: "Referred", get: r => r.totalReferred },
    { label: "Converted", get: r => r.converted },
    { label: "Pending", get: r => r.pending },
    { label: "Free months", get: r => r.freeMonthsEarned },
    { label: "Status", get: r => r.status },
  ], filtered);


  return (
    <div className="fade-up">
      <div>

      </div>
      <Toolbar q={q} setQ={setQ} placeholder="Search referrers, code, email…" count={filtered.length}
  right={<>
    <button onClick={() => refresh(true)} style={btnGhost}><RefreshCw size={15} /> Refresh</button>
    <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
  </>}
/>
      <Card pad={false}>
        <Table head={["Referrer", "Customer key", "Referred", "Converted", "Free months", "Status", ""]}>
          {filtered.map(r => (
            <tr key={r.id} style={trStyle} onClick={() => setSel(r)}>
              <td style={td}><Person name={r.name} email={r.email} /></td>
              <td style={td}><Chip>{r.code}</Chip></td>
              <td style={td}>{r.totalReferred}</td>
              <td style={td}><strong style={{ color: "var(--f)" }}>{r.converted}</strong></td>
              <td style={td}>{r.freeMonthsEarned}M / {r.freeMonthsEarned * 30} days</td>
              <td style={td}><Status s={r.status} /></td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
        </Table>
      </Card>



      {sel && <Drawer onClose={() => setSel(null)} title={sel.name} sub={sel.code}>
        <DefRow k="Email" v={sel.email} />
        <DefRow k="Phone" v={sel.phone} />
        <DefRow k="Customer number" v={sel.customerNumber || "—"} />
        <DefRow k="Society" v={sel.society || "—"} />
        <DefRow k="Purifier ID" v={sel.purifierId || "—"} />
        <DefRow k="Joined" v={sel.joined || "—"} />
        <DefRow k="Total referred" v={sel.totalReferred} />
        <DefRow k="Converted" v={sel.converted} />
        <DefRow k="Pending" v={sel.pending} />
        <DefRow k="Free months earned" v={sel.freeMonthsEarned + " months"} />
        <DefRow k="Status" v={<Status s={sel.status} />} />
        <h3 style={{ fontSize: 15, margin: "22px 0 8px" }}>Referees</h3>
        {referees.filter(e => e.referrerId === sel.id).map(e => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{e.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.plan}</div></div>
            <Status s={e.status} />
          </div>
        ))}
        {referees.filter(e => e.referrerId === sel.id).length === 0 && <Empty msg="No referees yet." />}
      </Drawer>}
    </div>
  );
}




/* ===========================================================================
   Referees
   =========================================================================== */
export function Referees() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [refs, setRefs] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Referees");
    api.getReferees().then(setRows).catch(() => setRows([]));
    api.getReferrers().then(setRefs);
  }, []);
  if (!rows) return <Loading title="Loading Referees" subtitle="Synchronizing referee records…" />;

  const nameOf = id => refs.find(r => r.id === id)?.name || "—";
  const filtered = rows.filter(r =>
    (r.name + r.email + r.phone + r.society).toLowerCase().includes(q.toLowerCase()) &&
    (status === "all" || r.status === status))
    .sort((a, b) => {
      const da = parseApiDate(a.convertedAt) || parseApiDate(a.date) || 0;
      const db = parseApiDate(b.convertedAt) || parseApiDate(b.date) || 0;
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0); // newest first
    });

  const exportCsv = () => exportToCsv("prowater-referees.csv", [
    { label: "Referee", get: e => e.name },
    { label: "Email", get: e => e.email },
    { label: "Referred by", get: e => nameOf(e.referrerId) },
    { label: "Phone", get: e => e.phone },
    { label: "Flat", get: e => e.flat },
    { label: "Society", get: e => e.society },
    { label: "Free months", get: e => e.refereeFreeMonths },
    { label: "Status", get: e => e.status === "paid" ? "converted" : e.status },
    { label: "Date", get: e => e.date },
  ], filtered);


  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search referees, phone, society…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="paid">Converted</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Referee", "Referred by", "Phone", "Flat", "Society", "Free months", "Status", "Date"]}>
          {filtered.map(e => (
            <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}><Person name={e.name} email={e.email} /></td>
              <td style={td}>{nameOf(e.referrerId)}</td>
              <td style={td}>{e.phone}</td>
              <td style={td}>{e.flat || "—"}</td>
              <td style={td}>{e.society || "—"}</td>
              <td style={td}>{e.refereeFreeMonths ? e.refereeFreeMonths + " mo" : "—"}</td>
              <td style={td}><Status s={e.status === "paid" ? "converted" : e.status} /></td>
              <td style={td}>{e.date || "—"}</td>
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No referees match your filters." />}
      </Card>
    </div>
  );
}

/* ===========================================================================
   Credits  (admins approve/reject; viewers read-only)
   =========================================================================== */
export function Credits() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [rows, setRows] = useState(null);
  const [refs, setRefs] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => api.getCredits().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); api.getReferrers().then(setRefs); }, []);
  if (!rows) return <Loading title="Loading Referral Credits" subtitle="Synchronizing the credit ledger…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const nameOf = id => refs.find(r => r.id === id)?.name || "—";

  const act = async (id, kind) => {
    setBusyId(id);
    try {
      if (kind === "approve") { await api.approveCredit(user.username, id); flash("Credit approved"); }
      else { await api.rejectCredit(user.username, id); flash("Credit rejected"); }
      await refresh();
    } finally { setBusyId(null); }
  };

  const filtered = rows.filter(c =>
    (nameOf(c.referrerId) + c.refereeName + c.invoice).toLowerCase().includes(q.toLowerCase()) &&
    (status === "all" || c.status === status))
    .sort((a, b) => {
      const da = parseApiDate(a.date) || 0, db = parseApiDate(b.date) || 0;
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });

  const pending = rows.filter(c => c.status === "pending").length;
  const approvedMonths = rows.filter(c => c.status === "approved").reduce((s, c) => s + c.credits, 0);
  const pendingMonths = rows.filter(c => c.status === "pending").reduce((s, c) => s + c.credits, 0);


  return (
    <div className="fade-up">
      <div style={grid4}>
        <Stat label="Pending review" value={pending} icon={Hourglass} sub={`${pendingMonths} free months awaiting`} hero />
        <Stat label="Approved" value={`${approvedMonths} months`} icon={CheckCircle2} sub="free months pushed to Zoho" />
        <Stat label="Existing customer" value={freeLabel(EXISTING_CREDIT)} icon={Coins} sub="2 months free per referral" />
        <Stat label="New customer" value={freeLabel(NEW_CREDIT)} icon={Coins} sub="1 month free per referral" />
        {isAdmin && (
          <button onClick={() => setAdding(true)} style={{
            border: "2px dashed var(--teal)", borderRadius: "var(--radius)", background: "var(--mint-2)",
            padding: 18, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
            gap: 8, cursor: "pointer", textAlign: "left", color: "var(--teal)", minHeight: 110
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 11, background: "var(--grad-btn)", color: "#fff" }}><Plus size={20} /></span>
            <span style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 18, color: "var(--f)" }}>Add manual credit</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Grant free months for a special case</span>
          </button>
        )}
      </div>

      <div style={{ height: 18 }} />
      <Toolbar q={q} setQ={setQ} placeholder="Search referrer, referee, invoice…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={() => exportToCsv("prowater-credits.csv", [
            { label: "Referrer", get: c => nameOf(c.referrerId) },
            { label: "Referee", get: c => c.refereeName },
            { label: "Invoice", get: c => c.invoice },
            { label: "Type", get: c => c.type },
            { label: "Free months", get: c => c.credits },
            { label: "Status", get: c => c.status },
            { label: "Date", get: c => c.date },
          ], filtered)} style={btnGhost}><Download size={15} /> Export</button>
        </>} />

      {!isAdmin && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)", background: "var(--mint-2)", padding: "9px 14px", borderRadius: 11, marginBottom: 14 }}>
        <Eye size={15} /> View-only access — only admins can approve or reject credits.
      </div>}

      <Card pad={false}>
        <Table head={["Referrer", "Referee", "Invoice", "Type", "Free months", "Status", "Date", ...(isAdmin ? ["Action"] : [])]} maxHeight="calc(100vh - 320px)">
          {filtered.map(c => (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}><strong style={{ color: "var(--f)" }}>{nameOf(c.referrerId)}</strong></td>
              <td style={td}>{c.refereeName}</td>
              <td style={td}><Chip>{c.invoice}</Chip></td>
              <td style={td}>
                <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "capitalize", color: c.type === "new" ? "var(--teal)" : "var(--slate)" }}>{c.type}</span>
              </td>
              <td style={td}><strong style={{ color: "var(--f)" }}>{freeLabel(c.credits)}</strong></td>
              <td style={td}><Status s={c.status} /></td>
              <td style={td}>{fmtDate(c.date)}</td>
              {isAdmin && <td style={{ ...td, whiteSpace: "nowrap" }}>
                {c.status === "pending" ? (
                  <span style={{ display: "inline-flex", gap: 8 }}>
                    <button onClick={() => act(c.id, "approve")} disabled={busyId === c.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, background: "var(--grad-btn)", color: "#fff", fontWeight: 600, fontSize: 12.5, opacity: busyId === c.id ? .6 : 1 }}>
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => act(c.id, "reject")} disabled={busyId === c.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "#fff", color: "#DC4141", fontWeight: 600, fontSize: 12.5, opacity: busyId === c.id ? .6 : 1 }}>
                      <Ban size={14} /> Reject
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>—</span>
                )}
              </td>}
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No credits match your filters." />}
      </Card>
      {adding && <AddManualCredit refs={refs} actor={user.username}
        onClose={() => setAdding(false)}
        onDone={() => { refresh(); flash("Manual credit added"); }} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

export function AddManualCredit({ refs, actor, onClose, onDone }) {
  const [form, setForm] = useState({ referrerId: "", refereeName: "", invoice: "", type: "existing", credits: EXISTING_CREDIT });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickType = t => setForm(f => ({ ...f, type: t, credits: t === "existing" ? EXISTING_CREDIT : NEW_CREDIT }));

  const submit = async () => {
    if (!form.referrerId || !form.refereeName || !form.credits) { setErr("Pick a referrer, enter a referee, and a credit amount."); return; }
    setErr(""); setBusy(true);
    try { await api.addManualCredit(actor, { ...form, credits: Number(form.credits) }); onDone(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title="Add manual credits" sub="Created as approved">
      <Field label="Referrer">
        <select value={form.referrerId} onChange={e => set("referrerId", e.target.value)} style={{ ...inp, cursor: "pointer", appearance: "auto" }}>
          <option value="" disabled>Select a referrer</option>
          {refs.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
        </select>
      </Field>
      <Field label="Referee name"><input style={inp} value={form.refereeName} onChange={e => set("refereeName", e.target.value)} placeholder="e.g. Rohan Sharma" /></Field>
      <Field label="Invoice (optional)"><input style={inp} value={form.invoice} onChange={e => set("invoice", e.target.value)} placeholder="e.g. ZB-10123" /></Field>
      <Field label="Customer type">
        <div style={{ display: "flex", gap: 10 }}>
          {[["existing", `Existing · ${freeLabel(EXISTING_CREDIT)}`], ["new", `New · ${freeLabel(NEW_CREDIT)}`]].map(([t, lbl]) => (
            <button key={t} onClick={() => pickType(t)} style={{
              flex: 1, padding: "11px", borderRadius: 11, border: `1.5px solid ${form.type === t ? "var(--teal)" : "var(--border)"}`,
              background: form.type === t ? "var(--mint-2)" : "#fff", color: form.type === t ? "var(--teal)" : "var(--slate)",
              fontWeight: 600, fontSize: 13, textTransform: "capitalize"
            }}>{lbl}</button>
          ))}
        </div>
      </Field>
      <Field label="Free months"><input type="number" min="0" style={inp} value={form.credits} onChange={e => set("credits", e.target.value)} /></Field>
      {err && <div style={{ color: "#DC4141", fontSize: 13, display: "flex", gap: 6, alignItems: "center", margin: "2px 0 10px" }}><AlertCircle size={15} />{err}</div>}
      <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Adding…" : "Add free months"}</button>
    </Modal>
  );
}
/* ===========================================================================
   Analytics
   =========================================================================== */
export function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(0);
  const [phone, setPhone] = useState("");      // phone search box
  const [scope, setScope] = useState(null);     // matched referrer (null = all)
  useEffect(() => {
    api.logView(user.username, "Viewed Analytics");
    Promise.all([api.getReferrers(), api.getReferees(), api.getTrend()])
      .then(([refs, rees, tr]) => { setData({ refs, rees, tr }); setToIdx(tr.length - 1); })
      .catch(e => setErr(e.message || "Could not load data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Referral Analytics" subtitle="Synchronizing referral performance data…" />;

  const searchPhone = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) { setScope(null); return; }
    const found = data.refs.find(r => (r.phone || "").replace(/\D/g, "").includes(digits));
    setScope(found || "none");
  };

  // Scope data to the matched referrer (or all referrers if no search).
  const scopedRefs = scope && scope !== "none" ? [scope] : data.refs;
  const scopedReferees = scope && scope !== "none"
    ? data.rees.filter(e => e.referrerId === scope.id)
    : data.rees;

  // Date-range slicer applied to the trend chart.
  const lo = Math.min(fromIdx, toIdx), hi = Math.max(fromIdx, toIdx);
  const trendInRange = data.tr.slice(lo, hi + 1);

  const statusBreak = [
    { name: "Converted", value: scopedReferees.filter(r => r.status === "paid").length },
    { name: "Pending", value: scopedReferees.filter(r => r.status === "pending").length },
  ].filter(x => x.value > 0);
  const PIE = CHART_PALETTE.slice(0, 3);

  // Free months granted per referrer (top contributors).
  const bySociety = Object.values(scopedRefs.reduce((acc, r) => {
    const key = r.society || "Other";
    acc[key] = acc[key] || { plan: key, amount: 0 };
    acc[key].amount += (r.freeMonthsEarned || 0);
    return acc;
  }, {}));

  const totalFreeMonths = scopedRefs.reduce((s, r) => s + (r.freeMonthsEarned || 0), 0);
  const totalConverted = scopedReferees.filter(r => r.status === "paid").length;
  const totalReferees = scopedReferees.length;
  const rangeRewards = trendInRange.reduce((s, r) => s + r.rewards, 0);


  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPhone()}
              placeholder="Filter analytics by phone number…" style={{ ...inp, paddingLeft: 36, margin: 0 }} />
          </div>
          <button onClick={searchPhone} style={btnPrimary}><Search size={16} /> Search</button>
          {scope && scope !== "none" && <button onClick={() => { setPhone(""); setScope(null); }} style={btnGhost}>Clear</button>}
        </div>
        {scope === "none" && <div style={{ marginTop: 10, fontSize: 13, color: "#DC4141", display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} /> No referrer found with that phone number.</div>}
        {scope && scope !== "none" && <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--forest)", fontWeight: 600 }}>Showing analytics for {scope.name} · {scope.phone}</div>}
      </Card>

      <div style={grid4}>
        <Stat label="Free months granted" value={totalFreeMonths} icon={Award} sub="total months to referrers" hero />
        <Stat label="Converted referees" value={totalConverted} icon={TrendingUp} sub={`out of ${totalReferees} referred`} />
        <Stat label="Conversion rate" value={(totalReferees ? Math.round(totalConverted / totalReferees * 100) : 0) + "%"} icon={ArrowUpRight} sub={`${totalConverted} of ${totalReferees} referees converted`} />
        <Stat label="Active referrers" value={data.refs.length} icon={Users} sub="live from API" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>

        <Card title="Free months trend" sub={`Free months granted · ${data.tr[lo]?.label} – ${data.tr[hi]?.label}`} style={{ gridColumn: "1/-1" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>Date range</span>
            <select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))} style={selectStyle}>
              {data.tr.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
            <span style={{ color: "var(--muted)" }}>→</span>
            <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))} style={selectStyle}>
              {data.tr.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>
              Free months in range: <strong style={{ color: "var(--f)" }}>{rangeRewards}</strong>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendInRange} margin={{ left: -8, right: 6, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} allowDecimals={false} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="rewards" name="free months" radius={[6, 6, 0, 0]} fill="#1E9E4F" maxBarSize={90} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Referee status mix" sub="Converted vs pending">
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={statusBreak} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} isAnimationActive={false} label={renderPieLabel} labelLine={pieLabelLine}>
                {statusBreak.map((e, i) => <Cell key={i} fill={PIE[i]} />)}
              </Pie>
              <Tooltip content={<TT />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Free months by society" sub="Where referrers are earning">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bySociety} layout="vertical" margin={{ left: 40, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="amount" name="free months" radius={[0, 6, 6, 0]} fill="#1E9E4F" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   Backtrack — undo / revert recent admin actions (admin only)
   =========================================================================== */
export function Backtrack() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => api.getUndoable().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); }, []);
  if (!rows) return <Loading title="Loading Backtrack" subtitle="Synchronizing reverted referral actions…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const revert = async (id) => {
    if (!confirm("Revert this action? This restores the previous state.")) return;
    setBusyId(id);
    try { await api.revertAction(user.username, id); await refresh(); flash("Action reverted"); }
    finally { setBusyId(null); }
  };

  const kindChip = (kind) => {
    const map = { approve: ["#08805A", "#E2F3EE"], reject: ["#DC4141", "#FBE8E8"], add_manual: ["#0B6F52", "#E2F3EE"] };
    const [c, bg] = map[kind] || ["#7D8A83", "#ECEEED"];
    return <span style={{ fontSize: 11, fontWeight: 600, color: c, background: bg, padding: "3px 8px", borderRadius: 7, textTransform: "capitalize" }}>{kind.replace("_", " ")}</span>;
  };


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--slate)", background: "var(--mint-2)", padding: "11px 16px", borderRadius: 12, marginBottom: 16 }}>
        <Undo2 size={16} /> Recent reversible actions. Reverting restores the previous state and logs the change. Newest actions appear first.
      </div>

      <Card pad={false}>
        <Table head={["Time", "Action", "Type", "By", ""]} maxHeight="calc(100vh - 260px)">
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12.5, verticalAlign: "top" }}>{fmtTime(r.ts)}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{r.label}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{kindChip(r.kind)}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{r.actor}</td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top" }}>
                <button onClick={() => revert(r.id)} disabled={busyId === r.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1.5px solid var(--border)", background: "#fff", color: "var(--teal)", fontWeight: 600, fontSize: 12.5, opacity: busyId === r.id ? .6 : 1 }}>
                  <RotateCcw size={14} /> Revert
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && <Empty msg="No actions to revert yet. Approve, reject, or add a manual credit and it will appear here." />}
      </Card>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
/* ===========================================================================
   Tracker — search a referrer by phone, show their tier + progress (animated)
   Tiers are based on CONVERTED referrals.
   =========================================================================== */
export const TIERS = [
  { key: "none", label: "No tier yet", min: 0, color: "#A9B3AC", bg: "#ECEEED" },
  { key: "bronze", label: "Bronze Tier", min: 1, color: "#986315", bg: "#FBF0E0" },
  { key: "silver", label: "Silver Tier", min: 2, color: "#7D8A83", bg: "#ECEEED" },
  { key: "gold", label: "Gold Tier", min: 6, color: "#986315", bg: "#FBF0E0" },
];
export function tierFor(converted) {
  let t = TIERS[0];
  for (const tier of TIERS) if (converted >= tier.min) t = tier;
  return t;
}
export function nextTier(converted) {
  return TIERS.find(t => t.min > converted) || null;
}

// Build a WhatsApp click-to-chat link with a pre-filled pitch.
export function waLink(phone, text) {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
export function pitchFor(r) {
  const next = nextTier(r.converted || 0);
  const need = next ? next.min - (r.converted || 0) : 0;
  if (next && need > 0) {
    return `Hi ${r.name}, thanks for being a ProWater customer! You're just ${need} successful referral${need !== 1 ? "s" : ""} away from ${next.label} and more free months. Refer friends with your code ${r.code} and earn rewards. 💧`;
  }
  return `Hi ${r.name}, thanks for being a top ProWater referrer! Keep referring friends with your code ${r.code} to keep earning free months. 💧`;
}
export function Tracker() {
  const { user } = useAuth();
  const [refs, setRefs] = useState(null);
  const [phone, setPhone] = useState("");
  const [match, setMatch] = useState(undefined); // undefined=no search yet, null=not found
  const [anim, setAnim] = useState(0);            // animated progress 0..1
  const [tierFilter, setTierFilter] = useState("all"); // call-list tier filter
  const [maxNeeded, setMaxNeeded] = useState("all");    // how many referrals needed

  useEffect(() => { api.logView(user.username, "Viewed Tracker"); api.getReferrers().then(setRefs).catch(() => setRefs([])); }, []);

  const search = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) { setMatch(undefined); return; }
    const found = (refs || []).find(r => (r.phone || "").replace(/\D/g, "").includes(digits));
    setMatch(found || null);
    setAnim(0);
  };

  const converted = match?.converted || 0;
  const tier = tierFor(converted);
  const next = nextTier(converted);
  const goldTarget = 6;
  const toGold = Math.max(0, goldTarget - converted);
  const targetPct = next ? Math.min(1, converted / next.min) : 1;

  // Animate the progress bar whenever a match is found.
  useEffect(() => {
    if (!match) return;
    let raf, start;
    const dur = 900;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setAnim(eased * targetPct);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [match, targetPct]);

  if (!refs) return <Loading title="Loading Referral Tracker" subtitle="Synchronizing the referral funnel…" />;


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--slate)", background: "var(--mint-2)", padding: "11px 16px", borderRadius: 12, marginBottom: 16 }}>
        <Trophy size={16} /> Search a customer by phone number to see their referral tier and how close they are to the next reward — handy for pitching referrals.
      </div>

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Enter phone number (e.g. 918839452234)" style={{ ...inp, paddingLeft: 36, margin: 0 }} />
          </div>
          <button onClick={search} style={btnPrimary}><Search size={16} /> Search</button>
        </div>
      </Card>

      {match === null && (
        <Card style={{ marginTop: 18 }}>
          <Empty msg="No referrer found with that phone number. Try the full number or a partial match." />
        </Card>
      )}

      {match && (
        <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--f)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>{match.name}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{match.phone} · {match.society || "—"}</div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: tier.bg, color: tier.color, fontWeight: 700, fontSize: 15 }}>
                <Medal size={18} /> {tier.label}
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 7 }}>
                <span>{converted} converted referral{converted !== 1 ? "s" : ""}</span>
                {next ? <span>Next: {next.label} at {next.min}</span> : <span style={{ color: tier.color, fontWeight: 700 }}>Top tier reached</span>}
              </div>
              <div style={{ height: 16, borderRadius: 999, background: "var(--mint-2)", overflow: "hidden", position: "relative" }}>
                <div style={{ height: "100%", width: `${anim * 100}%`, background: "linear-gradient(90deg, var(--lime), var(--lime-d))", borderRadius: 999, boxShadow: "0 0 12px rgba(168,217,64,.5)" }} />
              </div>
              {toGold > 0
                ? <div style={{ marginTop: 12, fontSize: 14, color: "var(--f)", fontWeight: 600 }}>
                    <span style={{ color: "var(--lime-d)" }}>{toGold} more</span> converted referral{toGold !== 1 ? "s" : ""} to reach <strong>Gold Tier</strong>.
                  </div>
                : <div style={{ marginTop: 12, fontSize: 14, color: "var(--lime-d)", fontWeight: 700 }}>Gold Tier achieved — top referrer!</div>}
            </div>
          </Card>

          <Card title="Tier ladder" sub="Based on converted referrals">
            <div style={{ display: "grid", gap: 10 }}>
              {TIERS.filter(t => t.key !== "none").map(t => {
                const reached = converted >= t.min;
                return (
                  <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: reached ? t.bg : "#EEF7F3", border: `1px solid ${reached ? t.color + "44" : "var(--border)"}`, opacity: reached ? 1 : .7 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, background: reached ? t.color : "var(--border)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {reached ? <Check size={18} /> : <Medal size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--f)" }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.min}+ converted referral{t.min !== 1 ? "s" : ""}</div>
                    </div>
                    {reached && <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>Reached</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ---- Call list: customers closest to the next tier (for inside sales) ---- */}
      <Card style={{ marginTop: 18 }} title="Call list" sub="Customers closest to their next tier — pitch these first">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={selectStyle}>
            <option value="all">All current tiers</option>
            <option value="none">No tier yet (0 converted)</option>
            <option value="bronze">Bronze (1+)</option>
            <option value="silver">Silver (2+)</option>
            <option value="gold">Gold (6+)</option>
          </select>
          <select value={maxNeeded} onChange={e => setMaxNeeded(e.target.value)} style={selectStyle}>
            <option value="all">Any distance to next tier</option>
            <option value="1">1 referral away</option>
            <option value="2">≤ 2 referrals away</option>
            <option value="3">≤ 3 referrals away</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>Tap WhatsApp to pitch</span>
        </div>

        {(() => {
          const list = refs
            .map(r => {
              const conv = r.converted || 0;
              const nt = nextTier(conv);
              const need = nt ? nt.min - conv : 0;
              return { ...r, conv, currentTier: tierFor(conv), nt, need };
            })
            .filter(r => tierFilter === "all" || r.currentTier.key === tierFilter)
            .filter(r => maxNeeded === "all" || (r.nt && r.need <= Number(maxNeeded)))
            .sort((a, b) => {
              // Closest to next tier first; those at top tier go last.
              if (!a.nt && !b.nt) return 0;
              if (!a.nt) return 1;
              if (!b.nt) return -1;
              return a.need - b.need || b.conv - a.conv;
            });

          if (list.length === 0) return <Empty msg="No customers match these filters." />;

          return (
            <div style={{ display: "grid", gap: 10 }}>
              {list.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "#fff", flexWrap: "wrap" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: r.currentTier.bg, color: r.currentTier.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Medal size={17} />
                  </div>
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--f)" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.phone} · {r.currentTier.label}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--slate)", flex: "0 0 auto" }}>
                    {r.nt
                      ? <span><strong style={{ color: "var(--lime-d)" }}>{r.need}</strong> to {r.nt.label}</span>
                      : <span style={{ color: r.currentTier.color, fontWeight: 700 }}>Top tier</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                    <a href={waLink(r.phone, pitchFor(r))} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: "#25D366", color: "#fff", fontWeight: 600, fontSize: 12.5, textDecoration: "none" }}>
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                    <a href={`tel:${(r.phone || "").replace(/\D/g, "")}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1.5px solid var(--border)", color: "var(--teal)", fontWeight: 600, fontSize: 12.5, textDecoration: "none" }}>
                      <Phone size={14} /> Call
                    </a>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
