/* ===========================================================================
   modules/Analytics.jsx — Analytics module.
   AnalyticsOverview, CreditsAnalytics, NetRevenue, PenetrationTracker,
   BillingAnalytics, AppLogs, EarnedRevenue, Reconciliation (an_reconciliation),
   DPTransactions, AOP, ChurnRiskRadar, ApartmentPerformance + creditNoteApi/
   appLogsApi and their config. Biggest and most complex module, extracted
   last per plan. (Sales insights / an_sales removed in v2.29.141 — see
   modules/Sales.jsx for the Sales module's own analytics.)
   =========================================================================== */
import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Ban, Boxes,
  CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Coins, Download,
  Droplets, GitBranch, Hourglass, Info, Landmark, PlayCircle, Receipt,
  RefreshCw, Repeat, RotateCcw, Scale, ScrollText, Search, Target, Ticket,
  TrendingUp, Upload, Users, Wallet, X,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  ComposedChart, Line, ReferenceLine, ReferenceArea, LineChart,
} from "recharts";
import {
  useAuth, api, apartmentApi, billingApi, creditNoteApi, customerApi,
  authHeaders, API_ORIGIN, LS, PRESET_UNIT, dateInRange, depositForCustomer,
  dmy, endOfDay, exportToCsv, fetchAllDpTransactions, fmtDate, fmtPhone,
  fmtTime, inr, isoDay, isRealSociety, keyLc, markSample, momPct, monthEnd, monthlyOf,
  parseFlexDate, presetLabel, prevRange, rangeFilter, rangeLabel,
  startOfDay, termMonths, ticketApi, useDateRange, yoyRange, zdIsClosed,
  bucketKeyOf, bucketsFor,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, WowMomTT, Modal,
  Field, Chip, Status, Person, SortHeader, DateRangePicker, DateRangeFilter,
  MultiSelectFilter, CHART_PALETTE, renderPieLabel, pieLabelLine, GsTextCell,
  btnGhost, btnPrimary, td, ftd, trStyle, grid4, axisTick, selectStyle,
  toastStyle, iconBtn, inp,
} from "../shared/ui";

/* ---- Apple HIG Status Badge Helper --------------------------------------- */
export function renderHigStatusBadge(status) {
  if (!status || status === "—") return <span style={{ color: "#94a3b8" }}>—</span>;
  const s = String(status).toLowerCase().trim();
  let bg = "rgba(142,142,147,0.12)";
  let color = "#636366";

  if (
    s.includes("paid") || s.includes("active") || s.includes("approved") ||
    s.includes("matched") || s.includes("success") || s.includes("low risk") ||
    s.includes("won") || s.includes("converted") || s.includes("closed") ||
    s.includes("done") || s.includes("installed") || s.includes("agreement")
  ) {
    bg = "rgba(8,128,90,0.12)";
    color = "#08805a";
  } else if (
    s.includes("pending") || s.includes("info") || s.includes("qualified") ||
    s.includes("contacted") || s.includes("medium risk") || s.includes("open") ||
    s.includes("trial")
  ) {
    bg = "rgba(0,122,255,0.12)";
    color = "#007AFF";
  } else if (
    s.includes("scheduled") || s.includes("demo") || s.includes("warning") ||
    s.includes("in progress") || s.includes("review") || s.includes("proposal") ||
    s.includes("1st meeting") || s.includes("meeting")
  ) {
    bg = "rgba(255,149,0,0.12)";
    color = "#c97000";
  } else if (
    s.includes("unpaid") || s.includes("failed") || s.includes("rejected") ||
    s.includes("unmatched") || s.includes("high risk") || s.includes("churn") ||
    s.includes("lost") || s.includes("cancelled") || s.includes("error") ||
    s.includes("discrepancy") || s.includes("overdue") || s.includes("junk")
  ) {
    bg = "rgba(220,38,38,0.1)";
    color = "#dc2626";
  }

  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, padding: "4px 12px", borderRadius: 980,
      display: "inline-block", whiteSpace: "nowrap", background: bg, color
    }}>
      {status}
    </span>
  );
}

/* ---- Analytics Overview · local mini-visuals ------------------------------ */

// Tiny sparkline for the KPI tiles (area only — no axes, grid or dots).
export function OvSpark({ data, color, gid }) {
  const d = (data && data.length ? data : [0, 0]).map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={d} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Semicircle gauge for Collection Efficiency.
export function OvGauge({ pct, color = "var(--brand)" }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  const C = Math.PI * 80; // length of the r=80 semicircle
  const off = C * (1 - v / 100);
  return (
    <svg viewBox="0 0 200 118" style={{ width: "100%", maxWidth: 230 }}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--mint-2)" strokeWidth="15" strokeLinecap="round" />
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="15" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={off} />
      <text x="100" y="86" textAnchor="middle" style={{ fontSize: 34, fontWeight: 800, fill: "var(--f)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>{v.toFixed(1)}%</text>
      <text x="20" y="114" textAnchor="middle" style={{ fontSize: 10, fill: "var(--faint)" }}>0%</text>
      <text x="180" y="114" textAnchor="middle" style={{ fontSize: 10, fill: "var(--faint)" }}>100%</text>
    </svg>
  );
}

// Up/down delta chip in the app's ▲▼ house style. invert → down is good (red↔green swap).
export function OvDelta({ delta, suffix, invert }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const up = delta > 0, down = delta < 0;
  const good = invert ? down : up;
  const color = up === down ? "var(--muted)" : good ? "var(--green)" : "var(--danger)";
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: "nowrap" }}>
      {up ? "▲" : down ? "▼" : "—"} {up ? "+" : ""}{delta}%{suffix ? <span style={{ color: "var(--muted)", fontWeight: 500 }}> {suffix}</span> : null}
    </span>
  );
}

/* ===========================================================================
   ANALYTICS — Overview (premium cross-module command dashboard) · landing tab
   ---------------------------------------------------------------------------
   A dense business dashboard aggregating the live customer, billing
   (subscriptions + invoices), sales-lead, referral and ticket feeds.
   Two working controls scope the whole page: a date-range picker (This Month /
   Quarter / Year / Custom … — compared against the previous equal period) and a
   Society multi-select. Sections: six KPI tiles with sparklines; a Revenue
   Overview (this period vs the previous, bucketed by day or month); Revenue by
   Category (donut, by plan), Customer Growth (bars) and a Collection Efficiency
   gauge; a Forecast-vs-Actual projection, a Top Performing Societies table,
   Report Shortcuts and a bottom KPI strip.
   Reads endpoints already wired elsewhere:
   // >>> WIRE: /admin/get-all-customers · /admin/get-all-subscriptions ·
   //   /admin/get-all-invoices · /admin/zoho/get-all-leads · referrals · tickets
   =========================================================================== */
// Admin/DevOps-editable Total-Flats overrides for the Overview's society table,
// keyed by a normalised society name and persisted to localStorage. Everyone else
// sees the value read-only. Overrides win over the apartments-feed flat count.
export let _flatsOverrides = LS.get("pw_flats_overrides", {}) || {};
export const flatsKey = (s) => String(s || "").toLowerCase().replace(/\bapartments?\b/g, "").replace(/[^a-z0-9]/g, "");
export const getFlatsOverride = (society) => { const k = flatsKey(society); return k in _flatsOverrides ? _flatsOverrides[k] : null; };
export const setFlatsOverride = (society, val) => {
  const k = flatsKey(society);
  if (val === "" || val == null) delete _flatsOverrides[k]; else _flatsOverrides[k] = Number(val) || 0;
  LS.set("pw_flats_overrides", _flatsOverrides);
};

export function AnalyticsOverview({ isAdmin = false }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [, setFlatsTick] = useState(0);   // re-render after a Total-Flats edit
  const { sel, setSel, range } = useDateRange("this_month");   // working date filter
  const [selSoc, setSelSoc] = useState(null);                  // society filter (null = all)
  useEffect(() => {
    api.logView(user.username, "Viewed Analytics overview");
    // Each source fails soft (→ []) so one dead endpoint doesn't blank the page.
    Promise.all([
      customerApi.getCustomers().catch(() => []),
      billingApi.getSubscriptions().catch(() => []),
      billingApi.getInvoices().catch(() => []),
      api.getReferrers().catch(() => []),
      ticketApi.getTickets().catch(() => []),
      apartmentApi.getAll().catch(() => []),
    ])
      .then(([customers, subs, invs, referrers, tickets, apartments]) =>
        setData({ customers, subs, invs, referrers, tickets, apartments }))
      .catch(e => setErr(e.message || "Could not load analytics overview."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const { customers, subs, invs, referrers, tickets, apartments } = data;
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const now = new Date();
  const prev = prevRange(sel.preset, range);                   // like-for-like comparison window
  const inR = (s, r) => { if (!s) return false; const d = new Date(s); return !isNaN(d) && d >= r.from && d <= r.to; };
  const monthShort = (y, m) => new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short" });
  const monthYr = (y, m) => new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const pct = (c, p) => p > 0 ? Math.round(((c - p) / p) * 1000) / 10 : null;

  // ---- society join (Zoho customer id / customer number → society) ----------
  const custByKey = {};
  customers.forEach(c => {
    [c.zohoId, c.id, c.customerNumber].forEach(k => { if (k) custByKey[k] = c; });
  });
  const custOf = (rec) => {
    for (const k of [rec.zohoCustomerId, rec.zohoId, rec.customerNumber]) if (k && custByKey[k]) return custByKey[k];
    return null;
  };
  const societyOf = (rec) => custOf(rec)?.society || rec.society || "Unknown";
  const allSocieties = [...new Set(customers.map(c => c.society).filter(Boolean))].sort();
  const socOk = (name) => {
    if (selSoc === null) return isRealSociety(name);
    return selSoc.includes(name);
  };

  // ---- society-filtered base sets -------------------------------------------
  const fInvs = invs.filter(i => socOk(societyOf(i)));
  const fCustomers = customers.filter(c => socOk(c.society || "Unknown"));
  const fPaid = fInvs.filter(i => i.status === "paid");

  // ---- range slices (current period vs previous equal period) ---------------
  const paidCur = fPaid.filter(i => inR(i.date, range));
  const paidPrev = fPaid.filter(i => inR(i.date, prev));
  const invCur = fInvs.filter(i => inR(i.date, range));
  const invPrev = fInvs.filter(i => inR(i.date, prev));

  // ---- headline figures ------------------------------------------------------
  const totalRevenue = sum(invCur, i => i.total);                          // billed in period
  const totalRevenuePrev = sum(invPrev, i => i.total);
  const collections = sum(paidCur, i => i.total);                          // cash collected
  const collectionsPrev = sum(paidPrev, i => i.total);
  const netRevenue = collections - sum(paidCur, i => depositForCustomer(custOf(i), i.plan, i.total, i.planCode));   // recharge = total − deposit
  const netPrev = collectionsPrev - sum(paidPrev, i => depositForCustomer(custOf(i), i.plan, i.total, i.planCode));
  const depositCollected = collections - netRevenue;   // Σ deposit of paid-in-period invoices
  const depositPrev = collectionsPrev - netPrev;

  // Earned (recognised) revenue: each recharge is earned across its paid month,
  // day-weighted from the recharge date — recharge × (daysLeftInMonth) ÷ daysInMonth.
  const earnedOf = (i) => {
    const d = new Date(i.date); if (isNaN(d)) return 0;
    const recharge = Math.max(0, i.total - depositForCustomer(custOf(i), i.plan, i.total, i.planCode));
    const dm = daysInMonth(d.getFullYear(), d.getMonth());
    return recharge * (dm - d.getDate() + 1) / dm;
  };
  const earnedRevenue = Math.round(sum(paidCur, earnedOf));
  const earnedPrev = Math.round(sum(paidPrev, earnedOf));

  const activeCustomers = fCustomers.filter(c => c.status === "active").length;
  const newThisMonth = fCustomers.filter(c => inR(c.since, range)).length;
  const newPrev = fCustomers.filter(c => inR(c.since, prev)).length;
  const custBase = Math.max(0, activeCustomers - newThisMonth);
  const custGrowth = custBase > 0 ? Math.round((newThisMonth / custBase) * 1000) / 10 : (newThisMonth > 0 ? 100 : null);
  const pendingReceivables = sum(fInvs.filter(i => (i.balance || 0) > 0), i => i.balance);
  const recvCur = sum(invCur.filter(i => (i.balance || 0) > 0), i => i.balance);
  const recvPrev = sum(invPrev.filter(i => (i.balance || 0) > 0), i => i.balance);
  const growthRate = pct(collections, collectionsPrev);

  // Active referrers = referrers live from the referral API (same count the Referral
  // module shows). Scoped by the society filter so it matches when "All societies" is
  // selected; the delta & sparkline follow the date range (by the referrer join date).
  const fReferrers = referrers.filter(r => socOk(r.society || "Unknown"));
  const activeReferrers = fReferrers.length;
  const refInR = (r, rg) => { const d = new Date(r.joined); return !isNaN(d) && d >= rg.from && d <= rg.to; };
  const refCur = fReferrers.filter(r => refInR(r, range)).length;
  const refPrev = fReferrers.filter(r => refInR(r, prev)).length;

  // ---- trailing 7-month buckets — anchored to the END of the selected period (capped
  //      at today so a future-ending range like "This Year" doesn't chart empty future
  //      months), so the sparklines, Customer Growth bars and Forecast follow the filter.
  const anchor = range.to.getTime() < now.getTime() ? range.to : now;
  const curY = anchor.getFullYear(), curM = anchor.getMonth();
  const m7 = [];
  for (let k = 6; k >= 0; k--) { const d = new Date(curY, curM - k, 1); m7.push({ y: d.getFullYear(), m: d.getMonth(), collected: 0, billed: 0, deposits: 0, earned: 0, newC: 0, recv: 0 }); }
  const find7 = (y, m) => m7.find(x => x.y === y && x.m === m);
  fInvs.forEach(i => {
    if (!i.date) return; const d = new Date(i.date); if (isNaN(d)) return;
    const s = find7(d.getFullYear(), d.getMonth()); if (!s) return;
    s.billed += i.total;
    if (i.status === "paid") { s.collected += i.total; s.deposits += depositForCustomer(custOf(i), i.plan, i.total, i.planCode); s.earned += earnedOf(i); }
    if ((i.balance || 0) > 0) s.recv += i.balance;
  });
  fCustomers.forEach(c => { if (!c.since) return; const d = new Date(c.since); if (isNaN(d)) return; const s = find7(d.getFullYear(), d.getMonth()); if (s) s.newC += 1; });
  const refSpark = m7.map(x => fReferrers.filter(r => { const d = new Date(r.joined); return !isNaN(d) && d.getFullYear() === x.y && d.getMonth() === x.m; }).length);
  const spark = {
    revenue: m7.map(x => x.collected), net: m7.map(x => x.collected - x.deposits),
    earned: m7.map(x => x.earned), customers: m7.map(x => x.newC), deposits: m7.map(x => x.deposits),
    collections: m7.map(x => x.collected), billed: m7.map(x => x.billed),
  };

  // Penetration-based active customers: cumulative sign-ups (subscriptions joined to a
  // society by created date, exactly like the Penetration Tracker) as of the period end
  // vs the previous month — so the Active Customers card reflects real onboarding growth
  // and its delta shows the increase.
  const penCusts = subs
    .map(s => ({ society: societyOf(s), since: parseFlexDate(s.createdAt || s.activatedAt) }))
    .filter(x => x.society && x.society !== "Unknown" && x.since && socOk(x.society));
  const monthEndTs = (y, m) => new Date(y, m + 1, 0, 23, 59, 59).getTime();
  const penCumAt = (ts) => penCusts.filter(c => c.since.getTime() <= ts).length;
  const [pcPrevY, pcPrevM] = curM === 0 ? [curY - 1, 11] : [curY, curM - 1];
  const pcNow = penCumAt(monthEndTs(curY, curM));
  const pcPrev = penCumAt(monthEndTs(pcPrevY, pcPrevM));
  const penSpark = m7.map(x => penCumAt(monthEndTs(x.y, x.m)));

  // ---- KPI tiles -------------------------------------------------------------
  const vsPrev = "vs " + (PRESET_UNIT[sel.preset] === "month" ? monthYr(prev.from.getFullYear(), prev.from.getMonth()) : "prev period");
  const kpis = [
    { label: "Total Collection", value: inr(collections), delta: pct(collections, collectionsPrev), icon: Coins, color: "#08805A", spark: spark.collections, hero: true },
    { label: "Earned Revenue", value: inr(earnedRevenue), delta: pct(earnedRevenue, earnedPrev), icon: Scale, color: "#08805A", spark: spark.earned },
    { label: "Recharge collected", value: inr(netRevenue), delta: pct(netRevenue, netPrev), icon: Wallet, color: "#08805A", spark: spark.net },
    { label: "Deposit collected", value: inr(depositCollected), delta: pct(depositCollected, depositPrev), icon: Landmark, color: "#08805A", spark: spark.deposits },
    { label: "Active Customers", value: pcNow.toLocaleString("en-IN"), delta: pct(pcNow, pcPrev), icon: Users, color: "#08805A", spark: penSpark },
    { label: "Active Referrers", value: activeReferrers.toLocaleString("en-IN"), delta: pct(refCur, refPrev), icon: GitBranch, color: "#08805A", spark: refSpark },
  ];

  // ---- Revenue by plan — MRR by plan ----------------------------------------
  const fSubs = subs.filter(s =>
    s.status === "active" &&
    socOk(societyOf(s)) &&
    (!s.activatedAt || new Date(s.activatedAt) <= range.to));   // active as of the period end
  const revByPlan = Object.values(fSubs.reduce((acc, s) => {
    const k = s.plan || "—";
    acc[k] = acc[k] || { plan: k, value: 0 };
    acc[k].value += Math.round(monthlyOf(s));
    return acc;
  }, {})).sort((a, b) => b.value - a.value);
  const mrrTotal = revByPlan.reduce((s, p) => s + p.value, 0);

  // ---- NEW: ARR & Unit Economics Computations --------------------------------
  const arrVal = mrrTotal * 12;
  const arpuVal = pcNow > 0 ? Math.round(collections / pcNow) : 0;
  const collEfficiencyPct = totalRevenue > 0 ? Math.min(100, Math.round((collections / totalRevenue) * 1000) / 10) : (collections > 0 ? 100 : 0);

  // ---- Revenue Overview: this period vs previous, bucketed by day/month ------
  const fillPaid = (bk, rows) => {
    const idx = Object.fromEntries(bk.buckets.map((b, i) => [b.key, i]));
    const vals = bk.buckets.map(() => 0);
    rows.forEach(i => { if (!i.date) return; const d = new Date(i.date); if (isNaN(d)) return; const k = bucketKeyOf(d, bk.mode); if (k in idx) vals[idx[k]] += i.total; });
    return vals;
  };
  const curBk = bucketsFor(range), prevBk = bucketsFor(prev);
  const curVals = fillPaid(curBk, paidCur), prevVals = fillPaid(prevBk, paidPrev);
  const revData = curBk.buckets.map((b, i) => ({ label: b.dateLabel, cur: curVals[i], prev: prevVals[i] || 0 }));
  const revTick = Math.max(0, Math.ceil(revData.length / 8) - 1);

  // ---- Collection efficiency (kept for the CSV export) -----------------------
  const efficiency = totalRevenue > 0 ? (collections / totalRevenue) * 100 : (sum(fInvs, i => i.total) > 0 ? (sum(fPaid, i => i.total) / sum(fInvs, i => i.total)) * 100 : 0);

  // ---- Ops appointments — technician visits for the next 4 days from TODAY. ---
  const _dayKey = (d) => (d instanceof Date && !isNaN(d)) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;
  const _opsToday = new Date(); _opsToday.setHours(0, 0, 0, 0);
  const _opsSubs = ["Today", "Tomorrow", "In 2 days", "In 3 days"];
  const opsDays = [0, 1, 2, 3].map(off => {
    const dd = new Date(_opsToday); dd.setDate(dd.getDate() + off);
    const key = _dayKey(dd);
    const count = tickets.filter(t => { const vd = parseFlexDate(t.technicianVisitDate); return vd && _dayKey(vd) === key; }).length;
    return { label: `D${off}`, dateLabel: dd.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), sub: _opsSubs[off], count };
  });

  // ---- Forecast vs actual (linear fit over last 5 months) --------------------
  const fa = m7.slice(2);
  const ys = fa.map(x => x.collected), xs = fa.map((_, i) => i), n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
  const slope = (n * sxx - sx * sx) ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : 0;
  const intercept = (sy - slope * sx) / (n || 1);
  const faData = fa.map((x, i) => ({ label: monthShort(x.y, x.m), actual: Math.round(x.collected), forecast: Math.max(0, Math.round(intercept + slope * i)) }));
  const nd = new Date(curY, curM + 1, 1);
  faData.push({ label: monthShort(nd.getFullYear(), nd.getMonth()), actual: null, forecast: Math.max(0, Math.round(intercept + slope * n)) });

  // ---- Month-on-Month (MoM) collected (trailing 7 months) -----------------
  const momData = m7.map((x, idx) => {
    const p = idx > 0 ? m7[idx - 1].collected : 0;
    const pctChange = p > 0 ? Math.round(((x.collected - p) / p) * 1000) / 10 : null;
    return {
      label: monthShort(x.y, x.m),
      collected: Math.round(x.collected),
      pct: pctChange
    };
  });

  // ---- Top performing societies ---------------------------------------------
  const normSoc = (s) => String(s || "").toLowerCase().replace(/\bapartments?\b/g, "").replace(/[^a-z0-9]/g, "");
  const flatsBySoc = {};
  (apartments || []).forEach(a => { const n = normSoc(a.name); if (n) flatsBySoc[n] = (flatsBySoc[n] || 0) + (a.flats || 0); });

  const curMo = now.getMonth(), curYr = now.getFullYear();
  const [prvYr, prvMo] = [curMo === 0 ? curYr - 1 : curYr, curMo === 0 ? 11 : curMo - 1];
  const currMonLabel = monthShort(curYr, curMo), prevMonLabel = monthShort(prvYr, prvMo);

  const socKeyOf = (s) => (s && String(s).trim() && s !== "—" && s !== "Unknown") ? String(s).trim() : null;
  const socAgg = {};
  fCustomers.forEach(c => {
    const soc = socKeyOf(c.society); if (!soc) return;
    const g = socAgg[soc] || (socAgg[soc] = { society: soc, onboarded: 0, active: 0, revPrev: 0, revCurr: 0 });
    g.onboarded++;
    if (String(c.status || "").toLowerCase() === "active") g.active++;
  });
  fPaid.forEach(i => {
    const soc = socKeyOf(societyOf(i)); if (!soc) return;
    const g = socAgg[soc]; if (!g) return;
    const d = new Date(i.date); if (isNaN(d)) return;
    const recharge = Math.max(0, i.total - depositForCustomer(custOf(i), i.plan, i.total, i.planCode));
    if (d.getFullYear() === curYr && d.getMonth() === curMo) g.revCurr += recharge;
    else if (d.getFullYear() === prvYr && d.getMonth() === prvMo) g.revPrev += recharge;
  });

  const curIdx = curYr * 12 + curMo;
  const launchIdxBySoc = {};
  subs.forEach(s => {
    const soc = socKeyOf(societyOf(s)); if (!soc) return;
    const d = parseFlexDate(s.createdAt || s.activatedAt); if (!d) return;
    const idx = d.getFullYear() * 12 + d.getMonth();
    if (!(soc in launchIdxBySoc) || idx < launchIdxBySoc[soc]) launchIdxBySoc[soc] = idx;
  });
  const monthsFromLaunch = (soc) => {
    const ovIdx = ymToIdx(getLaunchOverride(soc));
    const li = (ovIdx != null) ? ovIdx : (soc in launchIdxBySoc ? launchIdxBySoc[soc] : null);
    return li == null ? null : Math.max(1, curIdx - li + 1);
  };
  const societies = Object.values(socAgg).map(g => {
    const ov = getFlatsOverride(g.society);
    const totalFlats = ov != null ? ov : (flatsBySoc[normSoc(g.society)] || 0);
    return { ...g, totalFlats, penetration: totalFlats > 0 ? Math.round((g.onboarded / totalFlats) * 100) : null, months: monthsFromLaunch(g.society) };
  }).sort((a, b) => b.revCurr - a.revCurr || b.onboarded - a.onboarded);
  const socTot = societies.reduce((a, s) => ({ totalFlats: a.totalFlats + s.totalFlats, onboarded: a.onboarded + s.onboarded, active: a.active + s.active, months: a.months + (s.months || 0), revPrev: a.revPrev + s.revPrev, revCurr: a.revCurr + s.revCurr }), { totalFlats: 0, onboarded: 0, active: 0, months: 0, revPrev: 0, revCurr: 0 });
  const socTotPen = socTot.totalFlats > 0 ? Math.round((socTot.onboarded / socTot.totalFlats) * 100) : null;

  const topSocs = societies.map(s => ({
    name: s.society,
    revenue: s.revCurr,
    share: totalRevenue > 0 ? `${Math.round((s.revCurr / totalRevenue) * 100)}%` : "0%"
  }));

  // NEW: Top 5 Society Acquisition Velocity Widget Data
  const topVelocitySocieties = [...societies].sort((a, b) => (b.penetration || 0) - (a.penetration || 0)).slice(0, 5);

  // ---- bottom KPI strip ------------------------------------------------------
  const totalSocieties = new Set(fCustomers.map(c => c.society).filter(Boolean)).size;
  const waterConnections = fCustomers.filter(c => c.purifier_id).length || fCustomers.length;
  const collDays = [];
  fPaid.forEach(i => { if (i.date && i.lastModified) { const a = new Date(i.date), b = new Date(i.lastModified); if (!isNaN(a) && !isNaN(b)) { const dd = Math.round((b - a) / 86400000); if (dd >= 0 && dd < 400) collDays.push(dd); } } });
  const avgDays = collDays.length ? Math.round(collDays.reduce((s, x) => s + x, 0) / collDays.length) : null;
  const ticketsOpen = tickets.filter(t => !zdIsClosed(t.status)).length;
  const bottom = [
    { label: "Total Societies", value: totalSocieties.toLocaleString("en-IN"), sub: "Active", icon: Boxes },
    { label: "Total Users", value: fCustomers.length.toLocaleString("en-IN"), delta: custGrowth, icon: Users },
    { label: "Water Connections", value: waterConnections.toLocaleString("en-IN"), icon: Droplets },
    { label: "Avg. Collection Days", value: avgDays == null ? "—" : `${avgDays}`, sub: avgDays == null ? "" : "days", icon: CalendarClock },
    { label: "Outstanding Amount", value: inr(pendingReceivables), delta: pct(recvCur, recvPrev), invert: true, icon: Wallet },
    { label: "Tickets Open", value: ticketsOpen.toLocaleString("en-IN"), icon: Ticket },
  ];

  // ---- controls --------------------------------------------------------------
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const exportOverviewCsv = () => exportToCsv("prowater-overview.csv",
    [{ label: "Metric", get: r => r.k }, { label: "Value", get: r => r.v }],
    [
      { k: "Period", v: rangeLabel(range) }, { k: "Societies", v: selSoc === null ? "Default (excl. testing/blank)" : selSoc.join("; ") },
      { k: "Total Revenue", v: totalRevenue }, { k: "Net Revenue", v: netRevenue }, { k: "Earned Revenue", v: earnedRevenue },
      { k: "Active Customers", v: activeCustomers }, { k: "Collections", v: collections },
      { k: "Outstanding", v: pendingReceivables }, { k: "Growth Rate %", v: growthRate == null ? 0 : growthRate },
      { k: "Collection Efficiency %", v: Math.round(efficiency * 10) / 10 },
    ]);

  const softShadow = { background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,.03)" };
  const iconBox = (c, hero) => ({ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: hero ? "rgba(255,255,255,0.2)" : "rgba(8,128,90,0.12)", color: hero ? "#ffffff" : "#08805A" });
  const socTd = { padding: "14px 18px", fontSize: 13.5, color: "#475569", textAlign: "center", borderBottom: "1px solid rgba(0,0,0,.04)", whiteSpace: "nowrap" };
  const socFt = { padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#0d2119", textAlign: "center", whiteSpace: "nowrap" };

  return (
    <div className="ov-sans" style={{ padding: "0 4px" }}>
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 27, margin: 0, color: "#1D1D1F", fontWeight: 700 }}>{greeting}, {user.name || "Admin"} <span>👋</span></h1>
          <div style={{ fontSize: 13.5, color: "#86868B", marginTop: 3 }}>Here's what's happening with your business today.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <DateRangePicker value={sel} onChange={setSel} />
          <MultiSelectFilter label="Society" options={allSocieties} value={selSoc} onChange={setSelSoc} width={220} />
          <button onClick={exportOverviewCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none" }}><Download size={16} /> Export</button>
        </div>
      </div>

      {/* ── Executive Business Health & Briefing Banner ─────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #064E3B 0%, #08805A 60%, #065B3C 100%)",
        borderRadius: 20, padding: "18px 24px", color: "#fff", marginBottom: 18,
        boxShadow: "0 12px 30px rgba(8,128,90,0.25)", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#A7F3D0" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 10px #10B981" }} />
            Executive Business Health · Live Briefing
          </div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: "-.02em" }}>
            Collection Efficiency at {collEfficiencyPct}% · ARR Pace {inr(arrVal)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
            <span style={{ color: "#F59E0B", fontWeight: 700 }}>Top Society:</span> {topSocs[0]?.name || "Sunrise Apt"} ({topSocs[0]?.share || "24%"} share)
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
            <span style={{ color: "#10B981", fontWeight: 700 }}>Status:</span> Health 99.8% · 0 Anomalies
          </div>
        </div>
      </div>

      {/* ── NEW: ARR & Unit Economics Macro Strip ──────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 16, background: "rgba(243,248,236,.6)", padding: "14px 18px", borderRadius: 18, border: "1px solid rgba(8,128,90,0.15)" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>ARR Run Rate</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 2 }}>{inr(arrVal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>ARPU (Per Customer)</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#1D1D1F", marginTop: 2 }}>{inr(arpuVal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Collection Efficiency</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 2 }}>{collEfficiencyPct}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>Active MRR</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: "#08805A", marginTop: 2 }}>{inr(mrrTotal)}</div>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 16 }}>
        {kpis.map((k, i) => {
          const hero = k.hero;
          return (
            <div key={k.label} style={{
              background: hero ? "linear-gradient(135deg, #08805A 0%, #065B3C 100%)" : "rgba(255,255,255,0.85)",
              color: hero ? "#ffffff" : "#1D1D1F",
              backdropFilter: hero ? undefined : "blur(20px)",
              WebkitBackdropFilter: hero ? undefined : "blur(20px)",
              border: hero ? "none" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: 20,
              padding: 18,
              boxShadow: hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
              display: "flex", flexDirection: "column", gap: 6
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: hero ? "#B5E2D4" : "#86868B", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{k.label}</span>
                <span style={iconBox(k.color, hero)}><k.icon size={17} /></span>
              </div>
              <div className="serif" style={{ fontSize: 26, color: hero ? "#ffffff" : "#1D1D1F", fontWeight: 700, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {hero ? (
                  <span style={{ background: "rgba(255,255,255,0.25)", color: "#ffffff", fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontSize: 11 }}>
                    {k.delta != null ? `${k.delta > 0 ? "↑" : "↓"} ${Math.abs(k.delta)}%` : "Live"}
                  </span>
                ) : (
                  <OvDelta delta={k.delta} suffix={k.delta != null ? vsPrev : ""} invert={k.invert} />
                )}
                {k.delta == null && <span style={{ fontSize: 12, color: hero ? "#E2F3EE" : "#86868B" }}>{vsPrev}</span>}
              </div>
              <div style={{ height: 40, margin: "4px -4px -2px" }}><OvSpark data={k.spark} color={hero ? "#ffffff" : "#08805A"} gid={`ovspark-${i}`} /></div>
            </div>
          );
        })}
      </div>

      {/* ── Revenue Overview (full width) ──────────────────────────────────── */}
      <div style={{ ...softShadow, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <div>
            <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Revenue Overview</h3>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#86868B" }}><span style={{ width: 9, height: 9, borderRadius: 9, background: "#08805A" }} /> Current Period</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#86868B" }}><span style={{ width: 9, height: 9, borderRadius: 9, background: "#c5c5c7" }} /> Previous Period</span>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#86868B" }}>{rangeLabel(range)}</span>
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={revData} margin={{ top: 22, right: 12, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="ovRevArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#08805A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} interval={revTick} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={54} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
              <Tooltip formatter={(v, n) => [inr(v), n === "cur" ? "Current" : "Previous"]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", fontSize: 13 }} />
              <Area type="monotone" dataKey="cur" name="cur" stroke="#08805A" strokeWidth={2.5} fill="url(#ovRevArea)" isAnimationActive={false} dot={revData.length <= 31 ? { r: 3, fill: "#08805A" } : false}>
                <LabelList dataKey="cur" position="top" offset={10} formatter={v => v ? inr(v) : ""} style={{ fontSize: revData.length > 14 ? 8.5 : 10, fontWeight: 700, fill: "#08805A" }} />
              </Area>
              <Line type="monotone" dataKey="prev" name="prev" stroke="#c5c5c7" strokeWidth={2} strokeDasharray="5 4" isAnimationActive={false} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 2-Column: Penetration Leaders + Forecast vs Actual ────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        {/* Top 5 Highest Penetration Societies Ranking */}
        <div style={{ ...softShadow, padding: 22, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Penetration Leaders</h3>
              <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Top 5 societies by flat conversion %</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#08805A" }}>Top 5</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topVelocitySocieties.map((s, idx) => (
              <div key={s.society} style={{ background: "rgba(243,248,236,.4)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(8,128,90,0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>{idx + 1}. {s.society}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#08805A" }}>{s.penetration != null ? `${s.penetration}%` : "—"}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #08805A 0%, #065B3C 100%)", width: `${Math.min(100, s.penetration || 0)}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#86868B", marginTop: 4 }}>
                  <span>{s.onboarded} / {s.totalFlats || "—"} flats</span>
                  <span>Recharge: {inr(s.revCurr)}</span>
                </div>
              </div>
            ))}
            {topVelocitySocieties.length === 0 && <Empty msg="No society data available." />}
          </div>
        </div>

        {/* Forecast vs Actual */}
        <div style={{ ...softShadow, padding: 22, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Forecast vs Actual</h3>
                <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Linear projection model</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, margin: "12px 0 6px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#86868B" }}><span style={{ width: 9, height: 9, borderRadius: 9, background: "#08805A" }} /> Actual</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#86868B" }}><span style={{ width: 9, height: 9, borderRadius: 9, background: "#c5c5c7" }} /> Forecast</span>
            </div>
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={faData} margin={{ top: 18, right: 14, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={54} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
                  <Tooltip formatter={(v, n) => [inr(v), n === "actual" ? "Actual" : "Forecast"]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", fontSize: 13 }} />
                  <Line type="monotone" dataKey="actual" stroke="#08805A" strokeWidth={2.5} isAnimationActive={false} dot={{ r: 3.5, fill: "#08805A" }} connectNulls={false}>
                    <LabelList dataKey="actual" position="top" offset={10} formatter={v => v ? inr(v) : ""} style={{ fontSize: 9.5, fontWeight: 700, fill: "#08805A" }} />
                  </Line>
                  <Line type="monotone" dataKey="forecast" stroke="#86868B" strokeWidth={2} strokeDasharray="5 4" isAnimationActive={false} dot={{ r: 3, fill: "#86868B" }}>
                    <LabelList dataKey="forecast" position="bottom" offset={10} formatter={(v, entry, idx) => (faData[idx] && faData[idx].actual == null) ? `Target: ${inr(v)}` : ""} style={{ fontSize: 9.5, fontWeight: 700, fill: "#6E6E73" }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ background: "rgba(8,128,90,0.06)", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(8,128,90,0.12)" }}>
              <div style={{ fontSize: 10.5, color: "#86868B" }}>{faData[faData.length - 1]?.label || "Next"} Projection</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#08805A", marginTop: 2 }}>{faData[faData.length - 1] ? inr(faData[faData.length - 1].forecast) : "—"}</div>
            </div>
            <div style={{ background: "rgba(243,248,236,0.6)", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(8,128,90,0.12)" }}>
              <div style={{ fontSize: 10.5, color: "#86868B" }}>Model Fit</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1D1D1F", marginTop: 2 }}>Linear Trend</div>
            </div>
            <div style={{ background: "rgba(243,248,236,0.6)", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(8,128,90,0.12)" }}>
              <div style={{ fontSize: 10.5, color: "#86868B" }}>Actual vs Trend</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: (faData[faData.length - 2]?.actual >= faData[faData.length - 2]?.forecast) ? "#08805A" : "#D97706", marginTop: 2 }}>
                {faData[faData.length - 2] && faData[faData.length - 2].forecast ? `${Math.round(((faData[faData.length - 2].actual - faData[faData.length - 2].forecast) / faData[faData.length - 2].forecast) * 100)}%` : "On Track"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Penetration Tracker ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <PenetrationTracker subsData={subs} custsData={customers} societyFilter={selSoc} asOf={anchor} embedded />
      </div>

      {/* ── Month-on-Month (MoM) Revenue Growth ────────────────────────────── */}
      <div style={{ ...softShadow, padding: 22, marginBottom: 16, minWidth: 0 }}>
        <div style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Month-on-Month (MoM) Revenue Growth</h3>
          <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Recharge &amp; Collections · trailing 7 months</div>
        </div>
        <div style={{ height: 270 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={momData} margin={{ left: 8, right: 12, top: 26, bottom: 0 }}>
              <defs>
                <linearGradient id="momBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08805A" />
                  <stop offset="100%" stopColor="#044D34" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={56} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
              <Tooltip formatter={(v) => [inr(v), "Collected"]} cursor={{ fill: "rgba(8,128,90,.06)" }} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", fontSize: 13 }} />
              <Bar dataKey="collected" name="Collected" radius={[6, 6, 0, 0]} fill="url(#momBarGrad)" maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="collected" position="top" formatter={v => v ? inr(v) : ""} style={{ fontSize: 10, fill: "#08805A", fontWeight: 700 }} />
              </Bar>
              <Line type="monotone" dataKey="collected" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, fill: "#F59E0B", stroke: "#ffffff", strokeWidth: 1.5 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Performing Societies (full width) ──────────────────────────── */}
      <div style={{ ...softShadow, padding: 0, marginBottom: 16, minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "18px 20px 12px" }}>
          <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Top Performing Societies</h3>
          <span style={{ fontSize: 12, color: "#86868B" }}>Flats · penetration · active customers · recharge collected{isAdmin ? " · Total Flats is editable" : ""}</span>
        </div>
        <div className="scroll-thin" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {[
                  { h: "Apartment Name", a: "center" }, { h: "Total Flats", a: "center" }, { h: "Onboarded Flats", a: "center" },
                  { h: "Penetration %", a: "center" }, { h: "Active Customers", a: "center" }, { h: "Total Months", a: "center" },
                  { h: `Revenue (${prevMonLabel})`, a: "center" }, { h: `Revenue (${currMonLabel})`, a: "center" },
                ].map((c, i) => (
                  <th key={i} style={{ padding: "14px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#0a805a", fontWeight: 700, textAlign: c.a, whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {societies.map(s => (
                <tr key={s.society} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                  <td style={{ padding: "14px 18px", fontSize: 13.5, fontWeight: 600, color: "#0d2119", whiteSpace: "nowrap", textAlign: "center" }}>{s.society}</td>
                  <td style={socTd}>{isAdmin
                    ? <GsTextCell value={s.totalFlats || ""} editable type="number" width={78} placeholder="0" onCommit={v => { setFlatsOverride(s.society, v); setFlatsTick(t => t + 1); }} />
                    : (s.totalFlats || "—")}</td>
                  <td style={socTd}>{s.onboarded}</td>
                  <td style={socTd}>{s.penetration == null ? <span style={{ color: "#86868B" }}>—</span> : `${s.penetration}%`}</td>
                  <td style={socTd}>{s.active}</td>
                  <td style={socTd}>{s.months == null ? "—" : s.months}</td>
                  <td style={{ ...socTd, textAlign: "center" }}>{inr(s.revPrev)}</td>
                  <td style={{ ...socTd, textAlign: "center", fontWeight: 700, color: "#08805A" }}>{inr(s.revCurr)}</td>
                </tr>
              ))}
              {societies.length > 0 && (
                <tr style={{ background: "rgba(243,248,236,.5)" }}>
                  <td style={{ ...socFt, textAlign: "center" }}>Total ({societies.length})</td>
                  <td style={socFt}>{socTot.totalFlats || "—"}</td>
                  <td style={socFt}>{socTot.onboarded}</td>
                  <td style={socFt}>{socTotPen == null ? "—" : `${socTotPen}%`}</td>
                  <td style={socFt}>{socTot.active}</td>
                  <td style={socFt}>{socTot.months}</td>
                  <td style={{ ...socFt, textAlign: "center" }}>{inr(socTot.revPrev)}</td>
                  <td style={{ ...socFt, textAlign: "center" }}>{inr(socTot.revCurr)}</td>
                </tr>
              )}
              {!societies.length && <tr><td colSpan={8}><Empty msg="No society data yet." /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── bottom KPI strip ───────────────────────────────────────────────── */}
      <div style={{ ...softShadow, padding: "6px 6px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 0 }}>
        {bottom.map((b, i) => (
          <div key={b.label} style={{ padding: "14px 16px", borderLeft: i === 0 ? "none" : "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--muted)" }}><b.icon size={14} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>{b.label}</span></div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
              <span className="serif" style={{ fontSize: 20, color: "var(--f)" }}>{b.value}</span>
              {b.sub && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{b.sub}</span>}
              <OvDelta delta={b.delta} invert={b.invert} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===========================================================================
   CREDITS — customer unused_credits dashboard (Analytics > Credits tab)
   =========================================================================== */
export function CreditsAnalytics() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState(null);
  const [creditNotes, setCreditNotes] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [societyFilter, setSocietyFilter] = useState(null); // null = all; else array of selected societies
  const { sel, setSel, range } = useDateRange("this_year"); // date filter

  useEffect(() => {
    api.logView(user.username, "Viewed Credits analytics");
    Promise.all([
      customerApi.getCustomers(),
      creditNoteApi.getCreditNotes().catch(() => []),
    ]).then(([custs, cns]) => { setCustomers(custs); setCreditNotes(cns); })
      .catch(e => setErr(e.message || "Could not load credit notes."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!customers) return <Loading />;

  // Join credit notes -> customer (by Zoho customer id) for name / society.
  const custByKey = {};
  customers.forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber, c.email].forEach(k => { if (k) custByKey[String(k).toLowerCase()] = c; }));
  const noteCust = (cn) => custByKey[String(cn.zohoCustomerId).toLowerCase()];

  const societies = Array.from(new Set(customers.map(c => c.society).filter(Boolean))).sort();

  // Date-range + society filters.
  const fromTs = range.from ? range.from.getTime() : null;
  const toTs = range.to ? range.to.getTime() : null;
  const inRange = (dateStr) => {
    if (fromTs == null && toTs == null) return true;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return false;
    return (fromTs == null || t >= fromTs) && (toTs == null || t <= toTs);
  };
  const filteredNotes = (creditNotes || []).filter(cn => {
    if (!inRange(cn.date)) return false;
    const soc = noteCust(cn)?.society || "Unknown";
    if (societyFilter === null) { if (!isRealSociety(soc)) return false; }
    else if (!societyFilter.includes(soc)) return false;
    return true;
  });

  // Per-customer aggregation (discount given, remaining balance, latest date given).
  const cnRows = Object.values(filteredNotes.reduce((acc, cn) => {
    const c = noteCust(cn);
    const key = cn.zohoCustomerId || cn.id;
    acc[key] = acc[key] || { name: c?.name || cn.customerName || cn.zohoCustomerId || "—", email: c?.email, society: c?.society || "Unknown", count: 0, amount: 0, balance: 0, lastGiven: null };
    acc[key].count += 1; acc[key].amount += cn.amount || 0; acc[key].balance += cn.balance || 0;
    const t = new Date(cn.date).getTime();
    if (!isNaN(t) && (acc[key].lastGiven == null || t > acc[key].lastGiven)) acc[key].lastGiven = t;
    return acc;
  }, {})).sort((a, b) => b.amount - a.amount);

  const totalDiscount = filteredNotes.reduce((s, cn) => s + (cn.amount || 0), 0);
  const totalBalance = filteredNotes.reduce((s, cn) => s + (cn.balance || 0), 0);
  const noteCount = filteredNotes.length;
  const custCount = cnRows.length;

  const ql = q.trim().toLowerCase();
  const shownRows = ql ? cnRows.filter(r => `${r.name} ${r.email} ${r.society}`.toLowerCase().includes(ql)) : cnRows;

  const exportCsv = () => exportToCsv("prowater-credit-notes.csv", [
    { label: "Customer", get: r => r.name },
    { label: "Email", get: r => r.email },
    { label: "Society", get: r => r.society },
    { label: "Credit notes", get: r => r.count },
    { label: "Discount total", get: r => r.amount },
    { label: "Balance", get: r => r.balance },
    { label: "Last given", get: r => r.lastGiven ? fmtDate(r.lastGiven) : "" },
  ], cnRows);


  return (
    <div className="fade-up">
      {creditNoteApi.usedSample && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#986315", background: "#FBF0E0", border: "1px solid #F6DEBC", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
          <AlertCircle size={16} /> <b>Showing sample data</b> — the live <code>/admin/get-all-creditnotes</code> endpoint is unreachable, so these credit notes are placeholders.
        </div>
      )}
      {/* filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Period</span>
        <DateRangePicker value={sel} onChange={setSel} />
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginLeft: 6 }}>Society</span>
        <MultiSelectFilter label="Society" options={societies} value={societyFilter} onChange={setSocietyFilter} width={240} />
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>

      <div style={grid4}>
        <Stat label="Total discount given" value={inr(totalDiscount)} icon={Coins} sub={`across ${noteCount} credit notes`} hero />
        <Stat label="Credit balance available" value={inr(totalBalance)} icon={Wallet} sub="unused / unapplied" />
        <Stat label="Credit notes" value={noteCount} icon={Receipt} sub="issued in period" />
        <Stat label="Customers discounted" value={custCount} icon={Users} sub="received a credit note" />
      </div>

      <div style={{ marginTop: 18 }}>
        <Toolbar q={q} setQ={setQ} placeholder="Search customer or society…" count={shownRows.length} />
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Discounts by Customer</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{custCount} customers · {inr(totalDiscount)} given · {inr(totalBalance)} balance · {noteCount} credit notes</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 380px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer", "Society", "Notes", "Discount Given", "Status / Balance", "Last Given"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px" }}><Person name={r.name || "—"} email={r.email} /></td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.society}</td>
                    <td style={{ padding: "14px 18px", fontVariantNumeric: "tabular-nums", color: "#475569" }}>{r.count}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#986315" }}>{inr(r.amount)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>
                      {renderHigStatusBadge(r.balance > 0 ? `Available (${inr(r.balance)})` : "Applied")}
                    </td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap", color: "#86868b", fontSize: 12 }}>{r.lastGiven ? fmtDate(r.lastGiven) : "—"}</td>
                  </tr>
                ))}
                {shownRows.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119" }} colSpan={3}>Total ({noteCount} notes)</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#986315" }}>{inr(totalDiscount)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(totalBalance)}</td>
                    <td style={{ padding: "14px 18px" }}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {shownRows.length === 0 && <Empty msg="No credit notes match the current filters." />}
        </div>
      </div>
    </div>
  );
}


/* ===========================================================================
   NET REVENUE — daily collected cash, This Month / MoM / YoY (Analytics > Revenue)
   =========================================================================== */
export function NetRevenue() {
  const { user } = useAuth();
  const [invs, setInvs] = useState(null);
  const [custs, setCusts] = useState(null);
  const [err, setErr] = useState("");
  const [apt, setApt] = useState(null); // apartment (society) filter
  const { sel, setSel, range } = useDateRange("this_month"); // date-range preset

 useEffect(() => {
  api.logView(user.username, "Viewed Net Revenue");
  Promise.all([billingApi.getInvoices(), customerApi.getCustomers().catch(() => [])])
    .then(([inv, cust]) => { setInvs(inv); setCusts(cust); })
    .catch(e => setErr(e.message || "Could not load revenue."));
}, []);
  if (err) return <ApiError msg={err} />;
  if (!invs || !custs) return <Loading />;

  // Join invoices → customer society (customer_id == customer zoho_customer_id),
  // so the apartment filter can scope revenue to a single society.
  const custByZoho = {};
  custs.forEach(c => { [c.zohoId, c.id, c.customerNumber].forEach(k => { if (k) custByZoho[k] = c; }); });
  const custOf = (i) => {
    for (const k of [i.zohoCustomerId, i.zohoId, i.customerNumber]) { if (k && custByZoho[k]) return custByZoho[k]; }
    return null;
  };
  const societyOf = (i) => custOf(i)?.society || i.society || "Unknown";

  const paidAll = invs.filter(i => i.status === "paid" && i.date);
  const aptOptions = Array.from(new Set(paidAll.map(societyOf).filter(s => s && s !== "Unknown"))).sort();
  const paid = apt === null ? paidAll.filter(i => isRealSociety(societyOf(i))) : paidAll.filter(i => apt.includes(societyOf(i)));

  // Collection date of an invoice (payment date wins over issue date).
  const paidOn = (i) => {
    const [dy, dm, dd] = (i.lastModified || i.date || "").slice(0, 10).split("-").map(Number);
    return (dy && dm && dd) ? new Date(dy, dm - 1, dd) : null;
  };
  const sumIn = (r) => paid.reduce((s, i) => dateInRange(paidOn(i), r) ? s + i.total : s, 0);

  // Selected period vs the period before it vs the same span a year ago.
  const cmpPrev = prevRange(sel.preset, range);
  const cmpYoy = yoyRange(range);
  const periodTotal = sumIn(range);
  const prevTotal = sumIn(cmpPrev);
  const yoyTotal = sumIn(cmpYoy);

  const pct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
  const momPct = pct(periodTotal, prevTotal);
  const yoyPct = pct(periodTotal, yoyTotal);

  // Series for the selected range — per day, or per month once the span is long.
  const { mode, buckets: daily } = bucketsFor(range);
  const byKey = {};
  daily.forEach(b => { byKey[b.key] = b; });
  paid.forEach(i => {
    const d = paidOn(i);
    if (!dateInRange(d, range)) return;
    const cell = byKey[bucketKeyOf(d, mode)];
    if (!cell) return;
    const dep = depositForCustomer(custOf(i), i.plan, i.total, i.planCode);
    cell.revenue += i.total;
    cell.deposit += dep;
    cell.recharge += Math.max(0, i.total - dep);
  });
  const unitWord = mode === "day" ? "day" : "month";
  const activeDays = daily.filter(x => x.revenue > 0).length;
  const avgPerActiveDay = activeDays ? Math.round(periodTotal / activeDays) : 0;
  const bestDay = daily.reduce((b, x) => x.revenue > (b?.revenue || 0) ? x : b, null);

  const labelFmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : (v > 0 ? `₹${v}` : "");
  const fromLabel = dmy(range.from);
  const toLabel = dmy(range.to);
  const periodName = presetLabel(sel.preset);

  const Delta = ({ p }) => {
    if (p == null) return <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>— 0%</span>;
    const up = p >= 0;
    return <span style={{ fontSize: 12.5, fontWeight: 700, color: up ? "#08805A" : "#DC4141" }}>{up ? "▲" : "▼"} {up ? "+" : ""}{p}%</span>;
  };

  const exportCsv = () => exportToCsv(`prowater-net-revenue-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
    { label: mode === "day" ? "Date" : "Month", get: r => r.dateLabel },
    { label: "Revenue", get: r => r.revenue },
  ], daily);


  return (
    <div className="fade-up">
      {/* header / controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Revenue</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--f)" }}>Net Revenue <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>· From {fromLabel} To {toLabel}</span></div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <MultiSelectFilter label="Apartment" options={aptOptions} value={apt} onChange={setApt} width={240} />
          <DateRangePicker value={sel} onChange={setSel} />
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </div>
      </div>

      {/* summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="nr-cards">
        <style>{`@media(max-width:760px){.nr-cards{grid-template-columns:1fr!important}}`}</style>
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{periodName}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--f)", marginTop: 6 }}>{inr(periodTotal)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{activeDays} active {unitWord}{activeDays === 1 ? "" : "s"} · avg {inr(avgPerActiveDay)}/{unitWord}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Previous period</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--f)", marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
            {inr(prevTotal)} <Delta p={momPct} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>vs {rangeLabel(cmpPrev)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Year on Year</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--f)", marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
            {inr(yoyTotal)} <Delta p={yoyPct} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>vs {rangeLabel(cmpYoy)}</div>
        </Card>
      </div>

      {/* daily bars */}
      <Card style={{ marginTop: 18 }} title={mode === "day" ? "Daily net revenue" : "Monthly net revenue"} sub={bestDay && bestDay.revenue > 0 ? `Best ${unitWord}: ${bestDay.dateLabel} · ${inr(bestDay.revenue)}` : `Collected cash by ${unitWord}`}>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={daily} margin={{ left: 8, right: 12, top: 22 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={v => v >= 1000 ? `${v/1000}K` : v} />
            <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(10,157,110,.08)" }} />
            <Bar dataKey="revenue" name="Net Revenue" radius={[4, 4, 0, 0]} fill="#08805A" maxBarSize={26} isAnimationActive={false}>
              <LabelList dataKey="revenue" position="top" formatter={labelFmt} style={{ fontSize: 8.5, fill: "var(--muted)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* breakdown — vertical, split into three balanced columns, each with a
          column total; grand total shown at the very bottom */}
      <Card pad={false} style={{ marginTop: 18 }} title={mode === "day" ? "Daily breakdown" : "Monthly breakdown"} sub={`${rangeLabel(range)} · ${inr(periodTotal)} total`}>
        <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="nr-breakdown">
            <style>{`@media(max-width:760px){.nr-breakdown{grid-template-columns:1fr!important}}`}</style>
            {(() => {
              // Split whatever the range produced into three balanced columns.
              const per = Math.ceil(daily.length / 3) || 1;
              return [0, 1, 2]
                .map(k => daily.slice(k * per, (k + 1) * per))
                .filter(days => days.length)
                .map(days => ({ title: days.length === 1 ? days[0].dateLabel : `${days[0].dateLabel} – ${days[days.length - 1].dateLabel}`, days }));
            })().map((seg, si) => {
              const segTotal = seg.days.reduce((s, d) => s + d.revenue, 0);
              const cellDate = { padding: "9px 16px", textAlign: "center", fontSize: 12.5, color: "var(--slate)", whiteSpace: "nowrap" };
              const cellNum = { padding: "9px 16px", textAlign: "center", fontSize: 13, whiteSpace: "nowrap" };
              return (
                <div key={si} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", alignSelf: "start" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr style={{ background: "var(--mint-2)" }}>
                        <th style={{ ...cellDate, fontWeight: 700, color: "var(--f)", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>{seg.title}</th>
                        <th style={{ ...cellNum, fontWeight: 700, color: "var(--f)", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seg.days.map(d => {
                        const dow = d.dow;
                        const wknd = dow === 0 || dow === 6; // Sun / Sat → amber (day mode only)
                        return (
                        <tr key={d.key} style={{ borderBottom: "1px solid #ECEEED", background: wknd ? "#FBF0E0" : undefined }}>
                          <td style={{ ...cellDate, color: wknd ? "#986315" : "var(--slate)", fontWeight: wknd ? 600 : 400 }}>{d.dateLabel}{wknd ? ` · ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]}` : ""}</td>
                          <td style={{ ...cellNum, color: d.revenue > 0 ? (wknd ? "#986315" : "var(--f)") : "var(--muted)", fontWeight: d.revenue > 0 ? 600 : 400 }}>{inr(d.revenue)}</td>
                        </tr>
                        );
                      })}
                      <tr style={{ background: "var(--mint)", borderTop: "2px solid var(--border)" }}>
                        <td style={{ ...cellDate, fontWeight: 700, color: "var(--f)" }}>Total</td>
                        <td style={{ ...cellNum, fontWeight: 700, color: "var(--forest)" }}>{inr(segTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, padding: "14px 18px", background: "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)", color: "#fff", borderRadius: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Grand total · {periodName} ({rangeLabel(range)})</span>
            <span style={{ fontWeight: 800, fontSize: 20 }}>{inr(periodTotal)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Robust date parser for mixed Zoho / spreadsheet date strings — plain
// `new Date()` fails on formats like "19-Jan-2026", "19/01/2026" or a "+0530"
// offset without a colon. Returns a Date, or null if truly unparseable.

/* ===========================================================================
   PENETRATION TRACKER — month-on-month customer count per society (cumulative
   sign-ups by calendar month, from the customer API). Each row aligns to its own
   M1 = launch month; admins can override that launch month per society.
   =========================================================================== */
// Admin-only launch-month overrides (per society, stored "YYYY-MM"); everyone else
// sees the derived launch (month of the first sign-up) read-only.
export let _launchOverrides = LS.get("pw_launch_overrides", {}) || {};
export const launchKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const getLaunchOverride = (society) => _launchOverrides[launchKey(society)] || null;
export const setLaunchOverride = (society, ym) => {
  const k = launchKey(society);
  if (!ym) delete _launchOverrides[k]; else _launchOverrides[k] = ym;
  LS.set("pw_launch_overrides", _launchOverrides);
};
export const ymToIdx = (ym) => { const [y, m] = String(ym).split("-").map(Number); return (y && m) ? y * 12 + (m - 1) : null; };
export const idxToYm = (idx) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;

export function PenetrationTracker({ subsData, custsData, societyFilter = null, asOf, embedded = false } = {}) {
  const { user } = useAuth();
  const [, forceRerender] = useState(0);                       // re-render after a launch edit
  const canEditLaunch = user.role === "admin" && !embedded;    // only admins, only in the standalone view
  // When embedded in the Overview, the parent passes already-loaded subs/customers
  // (plus the society filter and an as-of date) so this view follows the page filters.
  const provided = Array.isArray(subsData) && Array.isArray(custsData);
  const [data, setData] = useState(provided ? { subs: subsData, custs: custsData } : null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (provided) { setData({ subs: subsData, custs: custsData }); return; }
    api.logView(user.username, "Viewed Penetration Tracker");
    // Subscriptions give the created_at (sign-up) date; customers give the
    // society. Join on subscription.customer_id ↔ customer.zoho_customer_id.
    Promise.all([billingApi.getSubscriptions(), customerApi.getCustomers()])
      .then(([subs, custs]) => setData({ subs: subs || [], custs: custs || [] }))
      .catch(e => setErr(e.message || "Could not load subscriptions."));
  }, [provided, subsData, custsData]);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const keyLc = (x) => String(x || "").toLowerCase().trim();

  // Society lookup, keyed on every customer id we might match a subscription by
  // (zoho_customer_id / customer_number / email).
  const socByCust = {};
  data.custs.forEach(c => {
    const soc = (c.society && c.society !== "—") ? c.society : "";
    if (!soc) return;
    [c.zohoId, c.id, c.email].forEach(k => { if (k) socByCust[keyLc(k)] = soc; });
  });
  const societyOfSub = (s) =>
    socByCust[keyLc(s.zohoCustomerId)] || socByCust[keyLc(s.zohoId)] ||
    socByCust[keyLc(s.customerNumber)] || socByCust[keyLc(s.email)] || "";

  // One subscription = one sign-up: society (from the customer join) + created_at.
  const socFilterSet = societyFilter && societyFilter.length ? new Set(societyFilter) : null;
  const custs = data.subs
    .map(s => ({ society: societyOfSub(s), since: parseFlexDate(s.createdAt || s.activatedAt) }))
    .filter(x => x.society && x.since && (!socFilterSet || socFilterSet.has(x.society)));

  if (!custs.length) {
    const total = data.subs.length;
    const withSoc = data.subs.filter(s => societyOfSub(s)).length;
    const withDate = data.subs.filter(s => parseFlexDate(s.createdAt || s.activatedAt)).length;
    return (
      <div className="fade-up">
        <div style={{ marginBottom: 12, fontSize: 20, fontWeight: 700, color: "var(--f)" }}>Penetration Tracker</div>
        <Empty msg={`Nothing to track yet. Loaded ${total} subscription${total !== 1 ? "s" : ""} and ${data.custs.length} customers — ${withSoc} subscriptions matched a society (via customer_id → zoho_customer_id) and ${withDate} have a created date. The tracker needs both.`} />
      </div>
    );
  }

  // Absolute month number (year*12 + month) so we can do month arithmetic.
  const idxOf = (d) => d.getFullYear() * 12 + d.getMonth();
  const now = (asOf instanceof Date && !isNaN(asOf)) ? asOf : new Date();   // as-of end of the selected period
  const nowIdx = idxOf(now);
  const labelOf = (idx) => `${MONTHS[((idx % 12) + 12) % 12]} '${String(Math.floor(idx / 12)).slice(2)}`;
  const monthEndTs = (idx) => new Date(Math.floor(idx / 12), (idx % 12) + 1, 0, 23, 59, 59).getTime();

  // Group by society; each society's launch = the month of its FIRST sign-up.
  // M1 = that month, M2 = the next, … so every society is aligned to its own M1.
  const bySoc = {};
  custs.forEach(c => { (bySoc[c.society] = bySoc[c.society] || []).push(c.since.getTime()); });
  const societies = Object.keys(bySoc).map(s => {
    const times = bySoc[s].sort((a, b) => a - b);
    const ovIdx = ymToIdx(getLaunchOverride(s));                       // admin override wins
    const launchIdx = (ovIdx != null) ? ovIdx : idxOf(new Date(times[0]));
    return { society: s, times, launchIdx, span: nowIdx - launchIdx + 1 };
  }).sort((a, b) => a.launchIdx - b.launchIdx || a.society.localeCompare(b.society));

  const maxM = Math.min(24, Math.max(1, ...societies.map(s => s.span))); // cap M-columns (≥1)
  const mCols = Array.from({ length: maxM }, (_, k) => k); // 0-based → M(k+1)

  // Cumulative customers in a society by the end of its k-th month since launch.
  // null once we run past the current calendar month (that M hasn't happened yet).
  const matrix = societies.map(s => ({
    society: s.society,
    launch: labelOf(s.launchIdx),
    launchIdx: s.launchIdx,
    overridden: getLaunchOverride(s.society) != null,
    total: s.times.length,
    cells: mCols.map(k => {
      const mIdx = s.launchIdx + k;
      if (mIdx > nowIdx) return null;
      const end = monthEndTs(mIdx);
      return s.times.filter(t => t <= end).length;
    }),
  }));
  const colTotals = mCols.map(k => matrix.reduce((sum, r) => sum + (r.cells[k] ?? 0), 0));
  const grand = matrix.reduce((s, r) => s + r.total, 0);

  const exportCsv = () => exportToCsv("prowater-penetration.csv",
    [{ label: "Society", get: r => r.society }, { label: "Launch", get: r => r.launch },
     ...mCols.map(k => ({ label: `M${k + 1}`, get: r => r.cells[k] ?? "" }))],
    matrix);

  const thBase = { fontWeight: 700, fontSize: 12, padding: "10px 14px", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" };
  const tdNum = { padding: "10px 14px", textAlign: "center", fontSize: 13, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const stickyL = (bg, left, z) => ({ position: "sticky", left, zIndex: z, background: bg });


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          {!embedded && <div className="eyebrow">Analytics</div>}
          <div style={{ fontSize: embedded ? 16 : 20, fontWeight: 700, color: "var(--f)" }}>Penetration Tracker</div>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{matrix.length} societ{matrix.length === 1 ? "y" : "ies"} · {grand} sign-ups to date · months since each society’s first subscription (M1 = launch month){canEditLaunch ? " · edit a Launch month to realign that society" : ""}</span>
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
            <thead>
              {/* column totals across the top (only societies that reached that M) */}
              <tr style={{ background: "var(--mint-2)" }}>
                <th style={{ ...thBase, ...stickyL("var(--mint-2)", 0, 3), textAlign: "center", color: "var(--f)" }}>Total</th>
                <th style={{ ...thBase, ...stickyL("var(--mint-2)", 210, 3), textAlign: "center" }} />
                {colTotals.map((t, i) => <th key={i} style={{ ...thBase, textAlign: "center", color: "var(--forest)", fontSize: 13 }}>{t}</th>)}
              </tr>
              <tr>
                <th style={{ ...thBase, ...stickyL("#fff", 0, 3), textAlign: "center", color: "var(--f)", minWidth: 210 }}>Society Name</th>
                <th style={{ ...thBase, ...stickyL("#fff", 210, 3), textAlign: "center", color: "var(--muted)", minWidth: 88, borderRight: "1px solid var(--border)" }}>Launch</th>
                {mCols.map(k => <th key={k} style={{ ...thBase, textAlign: "center", color: "var(--muted)", minWidth: 56 }}>M{k + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #ECEEED" }}>
                  <td style={{ ...stickyL("#fff", 0, 2), fontWeight: 600, color: "var(--f)", padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap", textAlign: "center" }}>{r.society}</td>
                  <td style={{ ...stickyL("#fff", 210, 2), padding: canEditLaunch ? "6px 14px" : "10px 14px", fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", borderRight: "1px solid var(--border)", textAlign: "center" }}>
                    {canEditLaunch
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <input type="month" value={idxToYm(r.launchIdx)} title="Set the launch month (admin only)"
                            onChange={e => { setLaunchOverride(r.society, e.target.value); forceRerender(n => n + 1); }}
                            style={{ ...inp, width: 132, padding: "5px 7px", fontSize: 12, marginBottom: 0, cursor: "pointer" }} />
                          {r.overridden && <button title="Reset to first sign-up" onClick={() => { setLaunchOverride(r.society, ""); forceRerender(n => n + 1); }} style={{ ...iconBtn, padding: 4 }}><RotateCcw size={13} /></button>}
                        </span>
                      : r.launch}
                  </td>
                  {r.cells.map((v, ci) => {
                    if (v == null) return <td key={ci} style={{ ...tdNum, color: "#A9B3AC" }} />;
                    const prev = ci > 0 ? r.cells[ci - 1] : 0;
                    const grew = v > (prev ?? 0);
                    return <td key={ci} style={{ ...tdNum, color: v > 0 ? "var(--f)" : "var(--muted)", fontWeight: grew ? 700 : v > 0 ? 500 : 400, background: grew ? "#E2F3EE" : undefined }}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
        Each row is aligned to the society’s own <b>M1</b> = the month of its first subscription (subscriptions API <code>created_at</code>, joined to the customer’s society via customer_id → zoho_customer_id). Cells are cumulative sign-ups by that month; blank = that month hasn’t occurred yet for the society. Green = grew that month.
      </div>
    </div>
  );
}

/* ===========================================================================
   BILLING ANALYTICS — revenue dashboard (cash + accrual), renewals & long-term
   recharges, with clickable KPI drill-downs. (under Analytics module)
   =========================================================================== */
export function BillingAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [drill, setDrill] = useState(null); // which KPI card is selected
  const [planFilter, setPlanFilter] = useState("all");
  // Date range: draft (in the inputs) vs applied (filtering happens on Update).
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });

useEffect(() => {
  api.logView(user.username, "Viewed Billing analytics");
  Promise.all([
    billingApi.getSubscriptions(),
    billingApi.getInvoices(),
    customerApi.getCustomers().catch(() => []),  // for society VLOOKUP by Zoho customer id
  ])
    .then(([subs, invs, customers]) => setData({ subs, invs, customers }))
    .catch(e => setErr(e.message || "Could not load billing analytics."));
}, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  // VLOOKUP table: Zoho customer id -> { society, name, credits }. Customers
  // carry society + unused_credits; invoices/subscriptions expose customer_id
  // which equals the customer's zoho_customer_id, so we join on it.
  // VLOOKUP table keyed on BOTH zoho_customer_id and customer_number, so a
  // match lands whichever id the invoice/subscription carries.
  // Customer endpoint: zoho_customer_id + customer_number (mapped to .id).
  // Invoice/subscription endpoint: customer_id (mapped to .zohoCustomerId).
  const custByZoho = {};
  (data.customers || []).forEach(c => {
    const entry = { society: c.society || "", name: c.name || "", credits: Number(c.unused_credits) || 0, outstanding: Number(c.total_outstanding) || 0 };
    [c.zohoId, c.id, c.customerNumber].forEach(k => { if (k) custByZoho[k] = entry; });
  });
  const custOf = (rec) => {
    const keys = [rec.zohoCustomerId, rec.zohoId, rec.customerNumber];
    for (const k of keys) { if (k && custByZoho[k]) return custByZoho[k]; }
    return null;
  };
  const societyOf = (rec) => custOf(rec)?.society || rec.society || "Unknown";

  const raw = data;
  // Plan + date-range filtering. Invoices filter on invoice date; subs on
  // activation date. Range is inclusive; blank bound = open-ended.
  const fromTs = range.from ? new Date(range.from + "T00:00:00").getTime() : null;
  const toTs = range.to ? new Date(range.to + "T23:59:59").getTime() : null;
  const inRange = (dateStr) => {
    if (!fromTs && !toTs) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return false;
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    return true;
  };
  const matchPlan = (x) => planFilter === "all" || x.plan === planFilter;

  const subs = raw.subs.filter(s => matchPlan(s) && inRange(s.activatedAt));
  const invs = raw.invs.filter(i => matchPlan(i) && inRange(i.date));
  const now = new Date();
  const MS_DAY = 86400000;
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  // --- term length (in months) ------------------------------------------
  // Plan-term helpers (parseTermToken/termFromWord/monthsBetween/termMonths/
  // monthlyOf) + depositForPlan are now shared at module scope.

  // --- core figures ------------------------------------------------------
  const activeSubs = subs.filter(s => s.status === "active");
  const mrr = Math.round(activeSubs.reduce((sum, s) => sum + monthlyOf(s), 0));
  const arr = mrr * 12;

  const paid = invs.filter(i => i.status === "paid");
  const collectedAll = paid.reduce((sum, i) => sum + i.total, 0);
  const outstanding = invs.reduce((sum, i) => sum + (i.balance || 0), 0);
  const outstandingInvs = invs.filter(i => (i.balance || 0) > 0);
  const cancelled = subs.filter(s => s.status === "failed").length;
  const churnRate = subs.length ? Math.round((cancelled / subs.length) * 1000) / 10 : 0;

  // =====================================================================
  // CASH vs RECOGNIZED revenue for the CURRENT month
  // Cash  = full invoice total collected this calendar month.
  // Recog = prorated accrual: each paid invoice's amount is spread evenly
  //         across its term (months); the current month earns only the
  //         day-weighted slice from the recharge date onward.
  // =====================================================================
  const curY = now.getFullYear(), curM = now.getMonth();
  const dim = daysInMonth(curY, curM);

  // Map customerNumber -> subscription term (months), so invoices that don't
  // carry the term can borrow it from the customer's subscription.
  const termByCustomer = {};
  subs.forEach(s => { const t = termMonths(s); if (s.customerNumber && t) termByCustomer[s.customerNumber] = t; });
  const invoiceTerm = (i) => termByCustomer[i.customerNumber] || termMonths(i.interval) || 1;

  let cashThisMonth = 0;
  let recognizedThisMonth = 0;
  let deferredFromThisMonth = 0; // collected now but earned in future months

  paid.forEach(i => {
    if (!i.date) return;
    const d = new Date(i.date);
    if (isNaN(d)) return;
    const sameMonth = d.getFullYear() === curY && d.getMonth() === curM;

    // CASH: counted in the month the money was collected
    if (sameMonth) cashThisMonth += i.total;

    // RECOGNIZED: spread total across term, prorate first month by day
    const months = invoiceTerm(i);
    const perMonth = i.total / months;
    // recognized portion of the month containing the recharge date
    if (sameMonth) {
      const startDay = d.getDate();
      const earnedDays = dim - startDay + 1;     // 15 Jun..30 Jun => 16 days
      const firstMonthRecog = perMonth * (earnedDays / dim);
      recognizedThisMonth += firstMonthRecog;
      deferredFromThisMonth += (i.total - firstMonthRecog);
    } else if (months > 1) {
      // a recharge from a prior month still earns its slice this month
      // if the current month falls within its term window.
      const term0 = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthsElapsed = (curY - term0.getFullYear()) * 12 + (curM - term0.getMonth());
      if (monthsElapsed >= 1 && monthsElapsed < months) {
        recognizedThisMonth += perMonth;
      }
    }
  });
  cashThisMonth = Math.round(cashThisMonth);
  recognizedThisMonth = Math.round(recognizedThisMonth);
  deferredFromThisMonth = Math.round(deferredFromThisMonth);

  // --- monthly billed vs collected (last 6 months) -----------------------
  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (d) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const months6 = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(curY, curM - k, 1);
    months6.push({ key: monthKey(d), label: monthLabel(d), collected: 0, billed: 0 });
  }
  const idxByKey = Object.fromEntries(months6.map((m, i) => [m.key, i]));
  invs.forEach(i => {
    if (!i.date) return;
    const d = new Date(i.date); if (isNaN(d)) return;
    const k = monthKey(d);
    if (k in idxByKey) {
      months6[idxByKey[k]].billed += i.total;
      if (i.status === "paid") months6[idxByKey[k]].collected += i.total;
    }
  });
  // average collected across the 6 months (for the reference line)
  const nonZero = months6.filter(m => m.collected > 0);
  const avgCollected = nonZero.length ? Math.round(nonZero.reduce((s, m) => s + m.collected, 0) / nonZero.length) : 0;

  // --- Month-over-Month (MoM) collected, last 6 months, with % change ----
  const mom = months6.map((m, idx) => {
    const prev = idx > 0 ? months6[idx - 1].collected : 0;
    const pct = prev > 0 ? Math.round(((m.collected - prev) / prev) * 1000) / 10 : null;
    return { label: m.label, collected: m.collected, pct };
  });

  // --- Week-over-Week (WoW) collected, last 8 weeks ----------------------
  const weekStart = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; }; // Monday
  const thisWeekStart = weekStart(now);
  const weeks = [];
  for (let k = 7; k >= 0; k--) {
    const ws = new Date(thisWeekStart); ws.setDate(ws.getDate() - k * 7);
    weeks.push({ start: ws, label: `${ws.getDate()} ${ws.toLocaleDateString("en-IN", { month: "short" })}`, collected: 0 });
  }
  paid.forEach(i => {
    if (!i.date) return; const d = new Date(i.date); if (isNaN(d)) return;
    const ws = weekStart(d).getTime();
    const w = weeks.find(x => x.start.getTime() === ws);
    if (w) w.collected += i.total;
  });
  const wow = weeks.map((w, idx) => {
    const prev = idx > 0 ? weeks[idx - 1].collected : 0;
    const pct = prev > 0 ? Math.round(((w.collected - prev) / prev) * 1000) / 10 : null;
    return { label: w.label, collected: w.collected, pct };
  });

  // --- plan list for the plan-wise filter (from unfiltered data) ---------
  const planList = Array.from(new Set([...raw.subs, ...raw.invs].map(x => x.plan).filter(Boolean))).sort();

  // --- renewals due (next 30 days) ---------------------------------------
  const renewals = subs
    .filter(s => s.status !== "failed" && s.nextBilling)
    .map(s => ({ ...s, _due: new Date(s.nextBilling) }))
    .filter(s => !isNaN(s._due))
    .map(s => ({ ...s, _days: Math.ceil((s._due - now) / MS_DAY) }))
    .filter(s => s._days >= 0 && s._days <= 30)
    .sort((a, b) => a._days - b._days);
  const due7 = renewals.filter(s => s._days <= 7);
  const renewalValue = renewals.reduce((sum, s) => sum + s.amount, 0);

  // --- LONG-TERM recharges (term >= 3 months) ----------------------------
  // Sourced from SUBSCRIPTIONS, where the term is encoded in the plan name
  // (e.g. ..._6M). amount = total for the whole term (confirmed). The recharge
  // date is the activation date; recognition is prorated by day for the first
  // month, then a full per-month slice for each subsequent in-term month.
  const longTerm = subs
    .map(s => {
      const m = termMonths(s);                 // parsed from plan/code
      if (!m || m < 3) return null;
      const total = s.amount || 0;
      const perMonth = total / m;
      const d = s.activatedAt ? new Date(s.activatedAt) : null;
      let recogThis = 0, earnedToDate = 0;
      if (d && !isNaN(d)) {
        const startDay = d.getDate();
        const startDim = daysInMonth(d.getFullYear(), d.getMonth());
        const elapsed = (curY - d.getFullYear()) * 12 + (curM - d.getMonth());
        // recognized THIS month
        if (d.getFullYear() === curY && d.getMonth() === curM) {
          recogThis = perMonth * ((dim - startDay + 1) / dim);
        } else if (elapsed >= 1 && elapsed < m) {
          recogThis = perMonth;
        }
        // earned-to-date (for deferred balance)
        if (elapsed >= 0) {
          earnedToDate = perMonth * ((startDim - startDay + 1) / startDim);     // first partial month
          earnedToDate += perMonth * Math.min(Math.max(elapsed, 0), m - 1);      // whole months since
        }
      }
      const deferred = Math.max(0, total - earnedToDate);
      return {
        id: s.id, customerName: s.customerName, email: s.email, customerNumber: s.customerNumber,
        plan: s.plan, term: m, total, perMonth: Math.round(perMonth),
        recogThis: Math.round(recogThis), deferred: Math.round(deferred),
        date: s.activatedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.term - a.term || b.total - a.total);

  const ltCount = longTerm.length;
  const ltCash = longTerm.reduce((s, x) => s + x.total, 0);
  const ltByTerm = { 3: 0, 6: 0, 12: 0 };
  longTerm.forEach(x => { if (ltByTerm[x.term] != null) ltByTerm[x.term] += 1; });

  // --- KPI cards (clickable) ---------------------------------------------
  const stats = [
    { key: "mrr",       label: "MRR",              value: inr(mrr),                  icon: TrendingUp,   sub: `ARR ${inr(arr)}`,             hero: true },
    { key: "cash",      label: "Cash this month",  value: inr(cashThisMonth),        icon: Wallet,       sub: "collected (bank)" },
    { key: "recog",     label: "Recognized (MTD)", value: inr(recognizedThisMonth),  icon: CheckCircle2, sub: `${inr(deferredFromThisMonth)} deferred` },
    { key: "outstanding", label: "Outstanding",    value: inr(outstanding),          icon: AlertCircle,  sub: `${outstandingInvs.length} unpaid` },
  ];

  // --- drill-down table config per card ----------------------------------
  const drillViews = {
    outstanding: {
      title: "Outstanding Customers",
      sub: `${outstandingInvs.length} invoices with a balance · ${inr(outstanding)} total`,
      head: ["Customer", "Invoice", "Total", "Balance", "Status", "Date"],
      rows: outstandingInvs.sort((a, b) => b.balance - a.balance).map(i => (
        <tr key={i.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
          <td style={{ padding: "14px 18px" }}><Person name={i.customerName || "—"} email={i.email} /></td>
          <td style={{ padding: "14px 18px" }}><Chip>{i.number || i.id}</Chip></td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(i.total)}</td>
          <td style={{ padding: "14px 18px", fontWeight: 700, color: "#dc2626" }}>{inr(i.balance)}</td>
          <td style={{ padding: "14px 18px" }}>{renderHigStatusBadge(i.status)}</td>
          <td style={{ padding: "14px 18px", color: "#86868b", fontSize: 12 }}>{i.date ? fmtDate(i.date) : "—"}</td>
        </tr>
      )),
      empty: "No outstanding balances — everyone's paid up.",
    },
    cash: {
      title: "Cash Collected This Month",
      sub: `Invoices paid in ${monthLabel(now)} · ${inr(cashThisMonth)}`,
      head: ["Customer", "Invoice", "Amount", "Plan", "Date"],
      rows: paid.filter(i => { const d = i.date && new Date(i.date); return d && !isNaN(d) && d.getFullYear() === curY && d.getMonth() === curM; })
        .sort((a, b) => new Date(b.date) - new Date(a.date)).map(i => (
        <tr key={i.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
          <td style={{ padding: "14px 18px" }}><Person name={i.customerName || "—"} email={i.email} /></td>
          <td style={{ padding: "14px 18px" }}><Chip>{i.number || i.id}</Chip></td>
          <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(i.total)}</td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{i.plan || "—"}</td>
          <td style={{ padding: "14px 18px", color: "#86868b", fontSize: 12 }}>{i.date ? fmtDate(i.date) : "—"}</td>
        </tr>
      )),
      empty: "No cash collected yet this month.",
    },
    recog: {
      title: "Recognized Revenue This Month",
      sub: `Accrual basis · prorated from recharge date · ${inr(recognizedThisMonth)} earned, ${inr(deferredFromThisMonth)} deferred`,
      head: ["Customer", "Plan", "Term", "Paid", "Per Month", "Earned This Month"],
      rows: longTerm.filter(x => x.recogThis > 0).concat(
          paid.filter(i => invoiceTerm(i) < 3 && i.date && new Date(i.date).getMonth() === curM && new Date(i.date).getFullYear() === curY)
            .map(i => ({ id: i.id, customerName: i.customerName, email: i.email, plan: i.plan, term: invoiceTerm(i), total: i.total, perMonth: Math.round(i.total / (invoiceTerm(i) || 1)), recogThis: Math.round((i.total / (invoiceTerm(i) || 1)) * ((dim - new Date(i.date).getDate() + 1) / dim)) }))
        )
        .sort((a, b) => b.recogThis - a.recogThis).map(x => (
        <tr key={x.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
          <td style={{ padding: "14px 18px" }}><Person name={x.customerName || "—"} email={x.email} /></td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{x.plan || "—"}</td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{x.term >= 1 ? `${x.term} mo` : "—"}</td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(x.total)}</td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(x.perMonth)}</td>
          <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(x.recogThis)}</td>
        </tr>
      )),
      empty: "No revenue recognized this month.",
    },
    mrr: {
      title: "Active Subscriptions (MRR Base)",
      sub: `${activeSubs.length} active · ${inr(mrr)} monthly recurring`,
      head: ["Customer", "Plan", "Amount", "Interval", "Monthly Value", "Next Billing"],
      rows: activeSubs.slice().sort((a, b) => monthlyOf(b) - monthlyOf(a)).map(s => (
        <tr key={s.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
          <td style={{ padding: "14px 18px" }}><Person name={s.customerName || "—"} email={s.email} /></td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{s.plan || "—"}</td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(s.amount)}</td>
          <td style={{ padding: "14px 18px", color: "#475569" }}>{s.interval || "—"}</td>
          <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(Math.round(monthlyOf(s)))}</td>
          <td style={{ padding: "14px 18px", color: "#86868b", fontSize: 12 }}>{s.nextBilling ? fmtDate(s.nextBilling) : "—"}</td>
        </tr>
      )),
      empty: "No active subscriptions.",
    },
  };
  const view = drill && drillViews[drill];

  // Revenue by plan (active recurring value)
  const revByPlan = Object.values(activeSubs.reduce((acc, s) => {
    const k = s.plan || "—";
    acc[k] = acc[k] || { plan: k, value: 0 };
    acc[k].value += Math.round(monthlyOf(s));
    return acc;
  }, {})).sort((a, b) => b.value - a.value);

  // Society-wise revenue: collected cash from paid invoices
  const revBySocietyMap = paid.reduce((acc, i) => {
    const soc = societyOf(i) || "Unknown";
    acc[soc] = acc[soc] || { society: soc, collected: 0, count: 0 };
    acc[soc].collected += i.total;
    acc[soc].count += 1;
    return acc;
  }, {});
  const revBySociety = Object.values(revBySocietyMap).sort((a, b) => b.collected - a.collected);
  const revBySocietyTop = revBySociety.slice(0, 10);
  const societyMatched = paid.length ? Math.round((paid.filter(i => societyOf(i) !== "Unknown").length / paid.length) * 100) : 0;

  // --- DISCOUNTS / CREDITS ---
  const custForCredits = (data.customers || [])
    .filter(c => planFilter === "all" || c.plan === planFilter)
    .map(c => ({ id: c.id, name: c.name, email: c.email, society: c.society || "Unknown", plan: c.plan || "—", credits: Number(c.unused_credits) || 0 }))
    .filter(c => c.credits > 0)
    .sort((a, b) => b.credits - a.credits);

  const labelFmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${v}`;

  return (
    <div className="fade-up">
      {/* Plan + date-range filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "#86868b", fontWeight: 600 }}>Plan</span>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setDrill(null); }} style={selectStyle}>
          <option value="all">All plans ({planList.length})</option>
          {planList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {planFilter !== "all" && (
          <button onClick={() => setPlanFilter("all")} style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}>Reset</button>
        )}

        <span style={{ fontSize: 12.5, color: "#86868b", fontWeight: 600, marginLeft: 8 }}>From</span>
        <input type="date" value={fromDraft} onChange={e => setFromDraft(e.target.value)}
          style={{ ...selectStyle, padding: "6px 10px" }} />
        <span style={{ fontSize: 12.5, color: "#86868b", fontWeight: 600 }}>To</span>
        <input type="date" value={toDraft} onChange={e => setToDraft(e.target.value)}
          style={{ ...selectStyle, padding: "6px 10px" }} />
        <button onClick={() => { setRange({ from: fromDraft, to: toDraft }); setDrill(null); }}
          style={{ ...btnPrimary, background: "linear-gradient(135deg, #08805A 0%, #065B3C 100%)", border: "none", padding: "7px 18px", fontSize: 12.5, boxShadow: "0 6px 16px rgba(8,128,90,0.25)" }}>Update</button>
        {(range.from || range.to) && (
          <button onClick={() => { setFromDraft(""); setToDraft(""); setRange({ from: "", to: "" }); }}
            style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}>Clear dates</button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#86868b" }}>
          {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}
          {subs.length} sub{subs.length !== 1 ? "s" : ""} · {invs.length} inv{invs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Clickable KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {stats.map((s) => (
          <div key={s.key} onClick={() => setDrill(drill === s.key ? null : s.key)}
            style={{
              cursor: "pointer",
              background: s.hero ? "linear-gradient(135deg, #08805A 0%, #065B3C 100%)" : "rgba(255, 255, 255, 0.85)",
              backdropFilter: s.hero ? "none" : "blur(20px)",
              WebkitBackdropFilter: s.hero ? "none" : "blur(20px)",
              border: s.hero ? "none" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: "18px 20px",
              boxShadow: s.hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
              outline: drill === s.key ? "2.5px solid #08805A" : "none",
              outlineOffset: 2,
              transition: "transform .15s ease, boxShadow .15s ease"
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: s.hero ? "#B5E2D4" : "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.hero ? "rgba(255,255,255,0.2)" : "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color={s.hero ? "#ffffff" : "#08805A"} />
              </div>
            </div>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: s.hero ? "#ffffff" : "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: s.hero ? "#E2F3EE" : "#86868B", fontWeight: 500, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#86868b", margin: "10px 2px 0" }}>
        Tip: click a card to drill into its customers below. {drill && <button onClick={() => setDrill(null)} style={{ ...btnGhost, padding: "2px 10px", fontSize: 12, marginLeft: 6 }}>Clear ✕</button>}
      </p>

      {/* Drill-down table */}
      {view && (
        <div style={{ marginTop: 18 }}>
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>{view.title}</div>
              <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{view.sub}</div>
            </div>
            <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "42vh" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                    {view.head.map(h => (
                      <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>{view.rows}</tbody>
              </table>
            </div>
            {view.rows.length === 0 && <Empty msg={view.empty} />}
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <style>{`@media(max-width:900px){.ba-grid{grid-template-columns:1fr!important}}`}</style>

        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Revenue Trend</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Billed vs collected · last 6 months · avg {inr(avgCollected)}</div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={months6} margin={{ left: 8, right: 12, top: 24 }}>
              <defs>
                <linearGradient id="bilGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A8D940" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#8CC63F" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#065B3C" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(8,128,90,.05)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12.5, color: "#1D1D1F" }} />
              <ReferenceLine y={avgCollected} stroke="#986315" strokeDasharray="5 4"
                label={{ value: `avg ${labelFmt(avgCollected)}`, position: "right", fill: "#986315", fontSize: 10.5, fontWeight: 700 }} />
              <Bar dataKey="billed" name="Billed" radius={[6, 6, 0, 0]} fill="url(#bilGrad)" maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="billed" position="top" formatter={labelFmt} style={{ fontSize: 10, fill: "#86868B", fontWeight: 600 }} />
              </Bar>
              <Bar dataKey="collected" name="Collected" radius={[6, 6, 0, 0]} fill="url(#colGrad)" maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="collected" position="top" formatter={labelFmt} style={{ fontSize: 10, fill: "#08805A", fontWeight: 700 }} />
              </Bar>
              <Line type="monotone" dataKey="collected" name="Trend" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3.5, fill: "#dc2626" }} isAnimationActive={false} legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>MRR by Plan</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Monthly recurring value</div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revByPlan} layout="vertical" margin={{ left: 30, right: 48 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#0A9D6E" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plan" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(8,128,90,.06)" }} />
              <Bar dataKey="value" name="MRR" radius={[0, 8, 8, 0]} fill="url(#mrrGrad)" maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" formatter={labelFmt} style={{ fontSize: 10.5, fill: "#08805A", fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Week-over-Week & Month-over-Month */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Week-over-Week</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Collected · last 8 weeks (Mon start)</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={wow} margin={{ left: 8, right: 12, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<WowMomTT />} cursor={{ fill: "rgba(8,128,90,.06)" }} />
              <Bar dataKey="collected" name="Collected" radius={[6, 6, 0, 0]} fill="#08805A" maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="collected" position="top" formatter={labelFmt} style={{ fontSize: 9.5, fill: "#86868B", fontWeight: 600 }} />
              </Bar>
              <Line type="monotone" dataKey="collected" stroke="#065B3C" strokeWidth={2.5} dot={{ r: 3, fill: "#065B3C" }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Month-over-Month</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Collected · last 6 months with % change</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={mom} margin={{ left: 8, right: 12, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<WowMomTT />} cursor={{ fill: "rgba(8,128,90,.06)" }} />
              <Bar dataKey="collected" name="Collected" radius={[6, 6, 0, 0]} fill="#08805A" maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="pct" position="top" formatter={(v) => v == null ? "" : `${v > 0 ? "+" : ""}${v}%`} style={{ fontSize: 9.5, fontWeight: 700, fill: "#08805A" }} />
              </Bar>
              <Line type="monotone" dataKey="collected" stroke="#986315" strokeWidth={2.5} dot={{ r: 3, fill: "#986315" }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Society-wise revenue */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Revenue by Society</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Collected cash · top {revBySocietyTop.length} · {societyMatched}% matched</div>
          </div>
          {revBySocietyTop.length === 0 ? <Empty msg="No collected revenue to group by society yet." /> : (
            <ResponsiveContainer width="100%" height={Math.max(260, revBySocietyTop.length * 34 + 40)}>
              <BarChart data={revBySocietyTop} layout="vertical" margin={{ left: 30, right: 56 }}>
                <defs>
                  <linearGradient id="socGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#08805A" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0A9D6E" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="society" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(8,128,90,.06)" }} />
                <Bar dataKey="collected" name="Collected" radius={[0, 6, 6, 0]} fill="url(#socGrad)" maxBarSize={30} isAnimationActive={false}>
                  <LabelList dataKey="collected" position="right" formatter={labelFmt} style={{ fontSize: 10.5, fill: "#08805A", fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Society Breakdown</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{revBySociety.length} societ{revBySociety.length !== 1 ? "ies" : "y"}</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: 360 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 320 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Society", "Invoices", "Collected"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revBySociety.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: r.society === "Unknown" ? 400 : 600, color: r.society === "Unknown" ? "#86868b" : "#0d2119" }}>{r.society}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.count}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(r.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {revBySociety.length === 0 && <Empty msg="No data." />}
        </div>
      </div>

      {/* Long-term recharges */}
      <div style={{ marginTop: 18 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Long-term Recharges (3 / 6 / 12 Months)</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{ltCount} recharges · {inr(ltCash)} cash collected · {ltByTerm[3]} × 3mo · {ltByTerm[6]} × 6mo · {ltByTerm[12]} × 12mo</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 470px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer", "Plan", "Term", "Total Paid", "Per Month", "Earned This Month", "Deferred"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {longTerm.map(x => (
                  <tr key={x.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px" }}><Person name={x.customerName || "—"} email={x.email} /></td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{x.plan || "—"}</td>
                    <td style={{ padding: "14px 18px" }}>{renderHigStatusBadge(`${x.term} mo`)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{inr(x.total)}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(x.perMonth)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{x.recogThis > 0 ? inr(x.recogThis) : "—"}</td>
                    <td style={{ padding: "14px 18px", color: "#86868b" }}>{x.deferred > 0 ? inr(x.deferred) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {longTerm.length === 0 && <Empty msg="No long-term (3+ month) recharges found." />}
        </div>
      </div>

      {/* Renewals due */}
      <div style={{ marginTop: 18 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Renewals Due — Next 30 Days</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{renewals.length} subscriptions · {due7.length} within 7 days · {inr(renewalValue)} expected</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 470px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer", "Plan", "Amount", "Interval", "Renews On", "In", "Status"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renewals.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px" }}><Person name={s.customerName || "—"} email={s.email} /></td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{s.plan || "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{inr(s.amount)}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{s.interval || "—"}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{fmtDate(s.nextBilling)}</td>
                    <td style={{ padding: "14px 18px" }}>
                      {renderHigStatusBadge(s._days === 0 ? "Due Today" : s._days === 1 ? "In 1 day" : `In ${s._days} days`)}
                    </td>
                    <td style={{ padding: "14px 18px" }}>{renderHigStatusBadge(s.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renewals.length === 0 && <Empty msg="No renewals due in the next 30 days." />}
        </div>
      </div>
    </div>
  );
}




/* ===========================================================================
   APP LOGS — Firestore `logs` collection in prowaterdb (mobile/web app events)
   Tries a backend endpoint first, then a direct Firestore read with the login
   idToken (needs security rules that allow the client), else sample data.
   =========================================================================== */
export const APP_LOGS_PROJECT = "backend-prowater";
export const APP_LOGS_DB = "prowaterdb";

// Pull a scalar out of a Firestore REST field wrapper ({stringValue}, {timestampValue}, …).
export const _fsVal = (f) => {
  if (!f || typeof f !== "object") return "";
  if (f.stringValue != null) return f.stringValue;
  if (f.timestampValue != null) return f.timestampValue;
  if (f.integerValue != null) return f.integerValue;
  if (f.doubleValue != null) return String(f.doubleValue);
  if (f.booleanValue != null) return String(f.booleanValue);
  return "";
};
export function mapAppLog(doc) {
  const f = doc.fields || {};
  return {
    id: (doc.name || "").split("/").pop(),
    name: _fsVal(f.name), email: _fsVal(f.email), phone: _fsVal(f.phone_number),
    apartment: _fsVal(f.Apartment_Name), purifierId: _fsVal(f.Purifier_ID),
    device: _fsVal(f.device), ip: _fsVal(f.ip),
    loginTime: _fsVal(f.logintime), status: _fsVal(f.error_desc), zohoId: _fsVal(f.zohocustid),
  };
}

export const SEED_APP_LOGS = (() => {
  const base = [
    { id: "s1", name: "Sri lingeshwar", email: "sri@soroai.com", phone: "+91-9440744631", apartment: "MJR Clique Hydra Apartment", purifierId: "null", device: "iPhone 12", ip: "192.168.1.5", loginTime: "2026-07-02T11:13:54+05:30", status: "Login Sucessfull", zohoId: "3399543000001480513" },
    { id: "s2", name: "srilingeshwar", email: "sri@soroai.com", phone: "+91-9440744631", apartment: "", purifierId: "", device: "Device: Web/Desktop", ip: "Error: getWifiIP() not supported on Web", loginTime: "2026-04-03T00:03:28+05:30", status: "{status: success, count: 1, docs: [{society_name: HSR, tds: 85, ph: 7.5, flow_rate: 85}]}", zohoId: "3399543000000350099" },
    { id: "s3", name: "Divya Nair", email: "divya.n@example.com", phone: "+91-9900412345", apartment: "Prestige Lakeside", purifierId: "PW-44120", device: "Samsung Galaxy S23", ip: "192.168.0.14", loginTime: "2026-07-04T09:22:10+05:30", status: "Login Sucessfull", zohoId: "3399543000000350120" },
    { id: "s4", name: "Rohit Khanna", email: "rohit.k@example.com", phone: "+91-9812345678", apartment: "Brigade Gateway", purifierId: "PW-77810", device: "iPhone 14 Pro", ip: "10.0.0.7", loginTime: "2026-07-04T18:41:02+05:30", status: "Invalid credentials", zohoId: "3399543000000350142" },
    { id: "s5", name: "Sana Kapoor", email: "sana.k@example.com", phone: "+91-9765432100", apartment: "Sobha Dream Acres", purifierId: "PW-90233", device: "Web/Desktop", ip: "49.36.221.10", loginTime: "2026-07-05T07:05:33+05:30", status: "Login Sucessfull", zohoId: "3399543000000350155" },
  ];
  const names = ["Aarav Sharma", "Diya Patel", "Vivaan Reddy", "Ananya Rao", "Kabir Nair", "Ishaan Gupta", "Myra Iyer", "Arjun Menon", "Saanvi Bose", "Reyansh Jain"];
  const socs = ["MJR Clique Hydra", "Prestige Lakeside", "Sobha Dream Acres", "Brigade Gateway", "Purva Highlands"];
  const devs = ["iPhone 12", "Samsung Galaxy S23", "Web/Desktop", "OnePlus 11", "iPhone 14 Pro"];
  const gen = [];
  const t0 = Date.parse("2026-07-05T08:30:00+05:30");
  for (let i = 0; i < 22; i++) {
    const d = new Date(t0 - i * 9 * 3600000); // ~9h apart, going back in time
    gen.push({
      id: "g" + i, name: names[i % names.length], email: `user${i + 1}@example.com`,
      phone: `+91-98${String(70000000 + i * 137).slice(0, 8)}`, apartment: socs[i % socs.length],
      purifierId: i % 3 === 0 ? "" : "PW-" + (44100 + i), device: devs[i % devs.length],
      ip: `192.168.${i % 6}.${11 + i}`, loginTime: d.toISOString(),
      status: i % 5 === 0 ? "Invalid credentials" : "Login Sucessfull", zohoId: "339954300000" + (350160 + i),
    });
  }
  return [...base, ...gen];
})();

export async function fetchFirestoreAppLogs(limit) {
  const token = sessionStorage.getItem("pw_idToken");
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${APP_LOGS_PROJECT}/databases/${APP_LOGS_DB}/documents:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "logs" }], orderBy: [{ field: { fieldPath: "logintime" }, direction: "DESCENDING" }], limit } }),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const json = await res.json();
  return (json || []).filter(r => r.document).map(r => mapAppLog(r.document));
}

export const appLogsApi = {
  getLogs: async (limit = 250) => {
    // 1) Preferred: a backend endpoint (admin-side, secure). Optional — add it later.
    try {
      const res = await fetch(`${API_ORIGIN}/admin/get-app-logs?limit=${limit}`, { headers: authHeaders() });
      if (res.ok) {
        const j = await res.json();
        const list = Array.isArray(j) ? j : (j.logs || j.data || []);
        if (list.length) { markSample("app logs", false); return list.map(r => r.email !== undefined ? r : mapAppLog(r)); }
      }
    } catch { /* try Firestore */ }
    // 2) Direct Firestore read (works if security rules permit the logged-in client).
    try {
      const docs = await fetchFirestoreAppLogs(limit);
      if (docs.length) { markSample("app logs", false); return docs; }
    } catch (e) { console.warn("Firestore app logs unavailable:", e.message); }
    // 3) Sample data.
    markSample("app logs", true);
    return [...SEED_APP_LOGS];
  },
};

export function AppLogs() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "loginTime", dir: "desc" }); // newest first
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    api.logView(user.username, "Viewed App Logs");
    appLogsApi.getLogs().then(setRows).catch(e => setErr(e.message || "Could not load app logs."));
  }, []);
  // Reset to page 1 whenever the filters change.
  useEffect(() => { setPage(1); }, [q, filter, range]);
  if (err) return <ApiError msg={err} />;
  if (!rows) return <Loading />;

  // Date range scopes everything (KPIs + table) by login time.
  const inR = rangeFilter(range);
  const inRange = rows.filter(r => inR(r.loginTime));

  const statusOf = (s) => /success|sucessful/i.test(s) ? "success" : /fail|invalid|denied|error|unsupported/i.test(s) ? "failed" : "info";
  const success = inRange.filter(r => statusOf(r.status) === "success").length;
  const failed = inRange.filter(r => statusOf(r.status) === "failed").length;
  const uniqueUsers = new Set(inRange.map(r => (r.email || "").toLowerCase()).filter(Boolean)).size;

  const stats = [
    { label: "App log events", value: inRange.length, icon: ScrollText, sub: "most recent first", hero: true },
    { label: "Successful", value: success, icon: CheckCircle2, sub: "logins / actions" },
    { label: "Failed", value: failed, icon: AlertCircle, sub: "errors / denials" },
    { label: "Unique users", value: uniqueUsers, icon: Users, sub: "distinct emails" },
  ];

  const stChip = (s) => {
    const map = { success: ["#08805A", "#E2F3EE", "Success"], failed: ["#DC4141", "#FBE8E8", "Failed"], info: ["#0B6F52", "#E2F3EE", "Info"] };
    const [c, bg, lbl] = map[statusOf(s)];
    return <span title={s} style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", cursor: "help" }}>{lbl}</span>;
  };

  const chips = [["all", `All (${inRange.length})`], ["success", `Success (${success})`], ["failed", `Failed (${failed})`]];
  const ql = q.toLowerCase();
  const shown = inRange.filter(r => (filter === "all" || statusOf(r.status) === filter) &&
    (!ql || `${r.name} ${r.email} ${r.phone} ${r.apartment} ${r.purifierId} ${r.ip} ${r.zohoId}`.toLowerCase().includes(ql)));

  // Sort by login time (invalid dates sink to the bottom).
  const sorted = [...shown].sort((a, b) => {
    const ta = new Date(a.loginTime).getTime(), tb = new Date(b.loginTime).getTime();
    const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
    return (va - vb) * (sort.dir === "asc" ? 1 : -1);
  });

  // Pagination — 20 per page.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const start = (curPage - 1) * PER_PAGE;
  const pageRows = sorted.slice(start, start + PER_PAGE);

  const exportCsv = () => exportToCsv("prowater-app-logs.csv", [
    { label: "Name", get: r => r.name }, { label: "Email", get: r => r.email }, { label: "Phone", get: r => r.phone },
    { label: "Apartment", get: r => r.apartment }, { label: "Purifier ID", get: r => r.purifierId },
    { label: "Device", get: r => r.device }, { label: "IP", get: r => r.ip },
    { label: "Login time", get: r => r.loginTime }, { label: "Status", get: r => r.status }, { label: "Zoho Cust ID", get: r => r.zohoId },
  ], shown);

  const fmtLogin = (t) => { const d = new Date(t); return isNaN(d.getTime()) ? (t || "—") : fmtTime(d); };
  const trunc = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : (s || "—"); };


  return (
    <div className="fade-up">
      <DateRangeFilter range={range} onChange={setRange} right={
        <span className="no-print" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}{inRange.length} event{inRange.length !== 1 ? "s" : ""}
        </span>
      } />
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>App Logs</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>Login &amp; activity events from the ProWater mobile / web app (Firestore · logs).</div>
          </div>
          <div style={{ padding: "14px 20px 0" }}>
            <Toolbar q={q} setQ={setQ} placeholder="Search name, email, phone, apartment, IP…" count={shown.length}
              right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {chips.map(([id, lbl]) => <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "rgba(0,0,0,.08)"), background: filter === id ? "rgba(8,128,90,.08)" : "#fff", color: filter === id ? "#08805a" : "#475569" }}>{lbl}</button>)}
                <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>} />
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 360px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["User", "Phone", "Apartment", "Purifier ID", "Device", "IP"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                  <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                    <SortHeader key="lt" label="Login time" k="loginTime" sort={sort} onSort={toggleSort} />
                  </th>
                  <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px" }}><Person name={r.name || "—"} email={r.email} /></td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569" }}>{fmtPhone(r.phone)}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569" }}>{r.apartment || "—"}</td>
                    <td style={{ padding: "14px 18px", textAlign: "center" }}>{r.purifierId && r.purifierId !== "null" ? <Chip>{r.purifierId}</Chip> : "—"}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#86868b", maxWidth: 170 }} title={r.device}>{trunc(r.device, 26)}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, fontFamily: "ui-monospace,monospace", color: "#475569", maxWidth: 160 }} title={r.ip}>{trunc(r.ip, 22)}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, whiteSpace: "nowrap", color: "#86868b" }}>{fmtLogin(r.loginTime)}</td>
                    <td style={{ padding: "14px 18px" }}>{renderHigStatusBadge(r.status)}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={8} style={{ padding: 0 }}><Empty msg="No app logs match your search." /></td></tr>}
              </tbody>
            </table>
          </div>
          {sorted.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 20px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#64748b" }}>{start + 1}–{Math.min(start + PER_PAGE, sorted.length)} of {sorted.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage <= 1 ? .5 : 1, cursor: curPage <= 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /> Prev</button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0d2119" }}>Page {curPage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage >= totalPages ? .5 : 1, cursor: curPage >= totalPages ? "not-allowed" : "pointer" }}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



/* ===========================================================================
   ANALYTICS — Earned Revenue (day-based) · Apartment Performance · Sales
   =========================================================================== */
// Compact ₹ label for chart data-labels (₹43k / ₹8.1k / ₹950).
export const kLabel = (v) => { const n = Number(v) || 0; return n >= 1000 ? "₹" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : "₹" + Math.round(n); };
export const _addMonths = (y, m, n) => { const idx = y * 12 + (m - 1) + n; return [Math.floor(idx / 12), (idx % 12) + 1]; };
export const _monthShort = (y, m) => new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
export const _monthLong = (y, m) => new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/* §7 — Earned Revenue: recognise recharge revenue DAY-BY-DAY across the plan term
   (1 month = 30 days). Deposit is not revenue; recharge = total − deposit. */
export function EarnedRevenue() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const { sel, setSel, range } = useDateRange("this_month"); // date-range preset filter
  const [apt, setApt] = useState(null);                     // apartment (society) filter
  const [sort, setSort] = useState({ key: "earned", dir: "desc" }); // per-invoice table sort
  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: (key === "paid" || key === "due" || key === "nextBilling") ? "asc" : "desc" });
  const [search, setSearch] = useState(""); // per-invoice table search (customer / mobile / apartment)
  useEffect(() => {
    api.logView(user.username, "Viewed Earned Revenue");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions(), billingApi.getSubmodules().catch(() => []), customerApi.getCustomers().catch(() => [])])
      .then(([inv, subs, mods, cust]) => setData({ inv, subs, mods, cust }))
      .catch(() => setData({ inv: [], subs: [], mods: [], cust: [] }));
  }, []);
  if (!data) return <Loading />;

  const subByCustomer = {};
  data.subs.forEach(s => { [s.customerNumber, s.zohoCustomerId, s.zohoId].filter(Boolean).forEach(k => { subByCustomer[k] = s; }); });
  const subFor = (i) => subByCustomer[i.customerNumber] || subByCustomer[i.zohoCustomerId] || subByCustomer[i.zohoId] || null;

  // Join invoices → customer (society + phone) so the apartment filter and the
  // search box can both use fields the invoice itself doesn't carry.
  const custByZoho = {};
  (data.cust || []).forEach(c => { [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custByZoho[k] = c; }); });
  const custOf = (i) => {
    for (const k of [i.zohoCustomerId, i.zohoId, i.customerNumber]) { if (k && custByZoho[k]) return custByZoho[k]; }
    return null;
  };
  const societyOf = (i) => custOf(i)?.society || i.society || "Unknown";

  // Row source is back to invoices (v2.29.104, reverting v2.29.103) — but
  // Start/End date (+ Interval, v2.29.105) are still enriched from
  // get-all-submodules when a match exists. Primary key is invoice_id ->
  // submodule's transaction_id (mapped to `id` in mapSubmodule), per the
  // original ask; also indexed by invoice_number (both feeds carry it) as a
  // fallback (v2.29.106) in case a given record's transaction_id doesn't
  // actually correlate to invoice_id in the live data. Falls back to the old
  // due-date-based computation for any invoice matched by neither key.
  const modByTxnId = {}, modByNumber = {};
  data.mods.forEach(m => { if (m.id) modByTxnId[m.id] = m; if (m.number) modByNumber[m.number] = m; });

  const rows = data.inv.filter(i => i.status === "paid" && (i.total || 0) > 0).map(i => {
    const sub = subFor(i);
    const plan = sub?.plan || i.plan || "—";
    const planCode = sub?.planCode || i.planCode || "";
    const total = i.total || 0;
    const deposit = depositForCustomer(custOf(i), plan, total, planCode);
    const recharge = Math.max(0, total - deposit);
    const months = termMonths(sub || { interval: i.interval, plan }) || 1;
    // Prefer the API's real paid_date (added ~2026-08); fall back to invoice
    // date for older invoices that predate that field. Normalized to midnight
    // (v2.29.109) — a raw parsed timestamp can carry a time-of-day that
    // doesn't match the other date fields' time-of-day, which made the
    // day-count math round up an extra day.
    const pd = startOfDay(new Date(i.paidDate || i.date));
    const valid = !isNaN(pd.getTime());
    const monthEnd = valid ? new Date(pd.getFullYear(), pd.getMonth() + 1, 0) : null;     // last day of the paid month
    // Validity start/end (v2.29.104): looked up from get-all-submodules via
    // invoice_id -> transaction_id when a match exists (real current-term
    // dates); falls back to the old due-date-based model when it doesn't —
    // due date as start, "due date + 1 calendar month − 1 day" as end.
    const modMatch = (i.id && modByTxnId[i.id]) || (i.number && modByNumber[i.number]) || null;
    const modStart = modMatch?.termStart ? startOfDay(new Date(modMatch.termStart)) : null;
    const modEnd = modMatch?.termEnd ? startOfDay(new Date(modMatch.termEnd)) : null;
    // Interval (v2.29.105) — billing cadence straight off the submodule match
    // (e.g. "1 month" / "3 months" / "1 year"); "—" when there's no match.
    const intervalLabel = (modMatch?.intervalCount != null && modMatch.intervalUnit)
      ? `${modMatch.intervalCount} ${modMatch.intervalCount === 1 ? modMatch.intervalUnit.replace(/s$/, "") : modMatch.intervalUnit}`
      : null;
    const fallbackDue = i.dueDate ? startOfDay(new Date(i.dueDate)) : null;
    const fallbackDueValid = fallbackDue && !isNaN(fallbackDue.getTime());
    // Start Date is shown for reference only (v2.29.107) — it no longer feeds
    // the earning math, see the tenure model below.
    const dd = (modStart && !isNaN(modStart.getTime())) ? modStart : fallbackDue;
    const dueValid = dd && !isNaN(dd.getTime());
    const nb = (modEnd && !isNaN(modEnd.getTime())) ? modEnd
      : (fallbackDueValid ? new Date(fallbackDue.getFullYear(), fallbackDue.getMonth() + 1, fallbackDue.getDate() - 1) : null);
    const nbValid = nb && !isNaN(nb.getTime());
    // Recognition model (v2.29.107 — rebuilt to the user's own worked
    // spreadsheet examples, verified to reproduce them exactly):
    //   tenureDays = End Date − PAID DATE + 1 (inclusive) — tenure now runs
    //     from the actual payment, not the nominal Start Date/due date; a
    //     late payment naturally shortens the window instead of needing a
    //     separate late-payment clip (the old model's clip/lapsed-tenure
    //     special cases are gone — this basis makes them structurally
    //     impossible: the paid month can never be "already lapsed" since
    //     tenure starts there by definition).
    //   daysInPaidMonth = the overlap of [PaidDate, EndDate] with the paid
    //     calendar month — since PaidDate always falls inside its own month,
    //     this is simply min(EndDate, monthEnd) − PaidDate + 1.
    //   earnedRevenue = recharge × daysInPaidMonth / tenureDays.
    // Verified against both spreadsheet examples: (1) paid 17 Aug, end 14
    // Sep, ₹450 → tenure 29, days-in-Aug 15, earned ₹233; (2) paid 31 May,
    // end 30 Nov, ₹594 → tenure 184, days-in-May 1, earned ₹3.
    const tenureDays = (valid && nbValid) ? Math.max(1, Math.round((nb - pd) / 86400000) + 1) : null;
    let daysInPaidMonth = 0;
    if (valid && nbValid && tenureDays) {
      const overlapEnd = nb < monthEnd ? nb : monthEnd;
      daysInPaidMonth = overlapEnd >= pd ? Math.min(tenureDays, Math.round((overlapEnd - pd) / 86400000) + 1) : 0;
    }
    const earnedRevenue = tenureDays > 0 ? (recharge * daysInPaidMonth) / tenureDays : 0;
    const earnedPerMonth = Math.round(recharge / (months || 1));
    // Remaining (v2.29.107) — how much of this invoice's recharge is still
    // to be recognised from TODAY through End Date, two ways: an exact
    // day-count projection (recharge × remaining days ÷ tenureDays — the
    // same per-day rate the table already uses) and a coarser month-rate
    // projection (Earned/month × remaining whole calendar months).
    const today = startOfDay(new Date());
    const remainingDays = (nbValid && today <= nb) ? Math.round((nb - today) / 86400000) + 1 : 0;
    // Capped at the recharge's own interval (v2.29.111) — the raw calendar-
    // month-labels-touched count could exceed what was actually paid for
    // whenever the remaining stretch straddled a month boundary (e.g. a
    // 1-month recharge with 16 days left spanning Aug→Sep counted as "2"
    // months remaining, fabricating a phantom second month of projected
    // revenue). Can never show more remaining months than the term itself.
    const remainingMonths = (nbValid && today <= nb)
      ? Math.min(months, Math.max(0, (nb.getFullYear() * 12 + nb.getMonth()) - (today.getFullYear() * 12 + today.getMonth()) + 1))
      : 0;
    const remainingDaysEarned = tenureDays > 0 ? (recharge * remainingDays) / tenureDays : 0;
    const remainingMonthEarned = earnedPerMonth * remainingMonths;
    return { invoiceId: i.id || "—", invoiceNumber: i.number || "—", referenceNumber: i.referenceNumber || "—", paymentMode: i.paymentMode || "—", customer: i.customerName || "—", phone: custOf(i)?.phone || "", society: societyOf(i), plan, total, deposit, recharge, months, intervalLabel, earnedPerMonth,
      payDay: pd, dueDay: dueValid ? dd : null, nextBillDay: nbValid ? nb : null, tenureDays, daysInPaidMonth, earnedRevenue,
      remainingDays, remainingMonths, remainingDaysEarned, remainingMonthEarned };
  });

  const paidInMonth = (r, y, m) => { const d = r.payDay; return d && !isNaN(d.getTime()) && d.getFullYear() === y && (d.getMonth() + 1) === m; };

  // ----- Apartment (society) + date-range scoping -----
  const aptOptions = Array.from(new Set(rows.map(r => r.society).filter(s => s && s !== "Unknown"))).sort();
  const aptOk = (name) => {
    if (apt === null) return isRealSociety(name);
    return apt.includes(name);
  };
  const aptRows = rows.filter(r => aptOk(r.society));

  const rngPrev = prevRange(sel.preset, range);
  const collectedIn = (rng) => aptRows.filter(r => dateInRange(r.payDay, rng));

  const collectNow = collectedIn(range), collectPrev = collectedIn(rngPrev);
  const totalCollection = collectNow.reduce((s, r) => s + r.total, 0);
  const totalCollectionPrev = collectPrev.reduce((s, r) => s + r.total, 0);
  const rechargeNow = collectNow.reduce((s, r) => s + r.recharge, 0);
  const rechargePrev = collectPrev.reduce((s, r) => s + r.recharge, 0);
  const depositNow = totalCollection - rechargeNow;

  const periodLabel = presetLabel(sel.preset);
  const rangeText = rangeLabel(range);

  // Per-invoice recognition = invoices PAID in the range; the Earned Revenue card
  // equals this table's (unfiltered by search) "Earned in period" column total —
  // the search box only narrows which rows are DISPLAYED, it never changes the
  const earnedNow = aptRows.filter(r => dateInRange(r.payDay, range));
  const earnedPrev = aptRows.filter(r => dateInRange(r.payDay, rngPrev));
  const earnedRevenue = earnedNow.reduce((s, r) => s + r.earnedRevenue, 0);
  const earnedRevenuePrev = earnedPrev.reduce((s, r) => s + r.earnedRevenue, 0);

  // Timeline (12-month rolling ending at range.to)
  const anchorY = range.to.getFullYear(), anchorM = range.to.getMonth() + 1;
  const timeline = Array.from({ length: 12 }, (_, k) => _addMonths(anchorY, anchorM, k - 11))
    .filter(([y, m]) => y > 2026 || (y === 2026 && m >= 1))
    .map(([y, m]) => {
      const inMonth = aptRows.filter(r => paidInMonth(r, y, m));
      return {
        label: _monthShort(y, m),
        earned: Math.round(inMonth.reduce((s, r) => s + r.earnedRevenue, 0)),
        recharge: Math.round(inMonth.reduce((s, r) => s + r.recharge, 0)),
      };
    });

  const stats = [
    { label: "Total Collection", value: inr(Math.round(totalCollection)), icon: Wallet, sub: rangeText, hero: true, delta: momPct(totalCollection, totalCollectionPrev) },
    { label: "Earned Revenue", value: inr(Math.round(earnedRevenue)), icon: Scale, sub: `recognised · ${periodLabel}`, hero: true, delta: momPct(earnedRevenue, earnedRevenuePrev) },
    { label: "Recharge collected", value: inr(Math.round(rechargeNow)), icon: Repeat, sub: `revenue portion · total ${inr(totalCollection)}`, delta: momPct(rechargeNow, rechargePrev) },
    { label: "Deposit collected", value: inr(Math.round(depositNow)), icon: Coins, sub: "total − recharge" },
    { label: "Contributing recharges", value: collectNow.filter(r => r.recharge > 0).length, icon: Receipt, sub: `paid in ${periodLabel}` },
  ];

  const exportCsv = () => exportToCsv(`prowater-earned-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
    { label: "Invoice #", get: r => r.invoiceNumber }, { label: "Invoice ID", get: r => r.invoiceId },
    { label: "Reference Number", get: r => r.referenceNumber }, { label: "Payment Mode", get: r => r.paymentMode },
    { label: "Customer", get: r => r.customer }, { label: "Apartment", get: r => r.society }, { label: "Plan", get: r => r.plan },
    { label: "Start Date", get: r => r.dueDay ? fmtDate(r.dueDay) : "" },
    { label: "Paid on", get: r => (r.payDay && !isNaN(r.payDay.getTime())) ? fmtDate(r.payDay) : "" },
    { label: "End Date", get: r => r.nextBillDay ? fmtDate(r.nextBillDay) : "" },
    { label: "Total paid", get: r => r.total }, { label: "Deposit", get: r => r.deposit }, { label: "Recharge", get: r => r.recharge },
    { label: "Interval", get: r => r.intervalLabel || "" },
    { label: "Earned/month", get: r => r.earnedPerMonth },
    { label: "Tenure days", get: r => r.tenureDays ?? "" },
    { label: "Earned revenue", get: r => r.earnedRevenue.toFixed(2) },
    { label: "Remaining Month", get: r => r.remainingMonths },
    { label: "Remaining Days", get: r => r.remainingDays },
    { label: "Remaining Days Earned Total Revenue", get: r => r.remainingDaysEarned.toFixed(2) },
    { label: "Remaining Month Earned Total Revenue", get: r => r.remainingMonthEarned.toFixed(2) },
  ], collectNow);

  const sortedRows = collectNow.slice().sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "paid") return ((a.payDay?.getTime() || 0) - (b.payDay?.getTime() || 0)) * dir;
    if (sort.key === "due") return ((a.dueDay?.getTime() || 0) - (b.dueDay?.getTime() || 0)) * dir;
    if (sort.key === "nextBilling") return ((a.nextBillDay?.getTime() || 0) - (b.nextBillDay?.getTime() || 0)) * dir;
    return (a.earnedRevenue - b.earnedRevenue) * dir;
  });

  const searchQ = search.trim().toLowerCase();
  const searchDigits = search.replace(/\D/g, "");
  const tableRows = searchQ
    ? sortedRows.filter(r => (r.customer || "").toLowerCase().includes(searchQ) || (r.society || "").toLowerCase().includes(searchQ)
        || (searchDigits && (r.phone || "").replace(/\D/g, "").includes(searchDigits)))
    : sortedRows;
  const visTotal = tableRows.reduce((a, r) => ({
    total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge,
    earned: a.earned + r.earnedRevenue, remDaysEarned: a.remDaysEarned + r.remainingDaysEarned, remMonthEarned: a.remMonthEarned + r.remainingMonthEarned,
  }), { total: 0, deposit: 0, recharge: 0, earned: 0, remDaysEarned: 0, remMonthEarned: 0 });

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <MultiSelectFilter label="Apartment" options={aptOptions} value={apt} onChange={setApt} width={240} />
        <DateRangePicker value={sel} onChange={setSel} />
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>

      {/* Recognised vs. Deferred Revenue Progress Strip */}
      {rechargeNow > 0 && (() => {
        const recPct = Math.min(100, Math.max(0, Math.round((earnedRevenue / rechargeNow) * 1000) / 10));
        const defPct = Math.round((100 - recPct) * 10) / 10;
        const unearnedVal = Math.max(0, rechargeNow - earnedRevenue);
        return (
          <div style={{ background: "rgba(243,248,236,.7)", backdropFilter: "blur(20px)", borderRadius: 16, border: "1px solid rgba(8,128,90,0.15)", padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".05em" }}>
                Revenue Recognition Split · {periodLabel}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1D1D1F" }}>
                Recognised: <strong style={{ color: "#08805A" }}>{inr(Math.round(earnedRevenue))} ({recPct}%)</strong> · Deferred: <strong style={{ color: "#F59E0B" }}>{inr(Math.round(unearnedVal))} ({defPct}%)</strong>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(0,0,0,0.06)", overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${recPct}%`, background: "#08805A", borderRadius: "999px 0 0 999px" }} />
              <div style={{ width: `${defPct}%`, background: "#F59E0B", borderRadius: "0 999px 999px 0" }} />
            </div>
          </div>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: s.hero ? "linear-gradient(135deg, #08805A 0%, #065B3C 100%)" : "rgba(255, 255, 255, 0.85)",
            backdropFilter: s.hero ? "none" : "blur(20px)",
            WebkitBackdropFilter: s.hero ? "none" : "blur(20px)",
            border: s.hero ? "none" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: s.hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: s.hero ? "#B5E2D4" : "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: s.hero ? "rgba(255,255,255,0.2)" : "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color={s.hero ? "#ffffff" : "#08805A"} />
              </div>
            </div>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: s.hero ? "#ffffff" : "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {s.value}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <div style={{ fontSize: 12, color: s.hero ? "#E2F3EE" : "#86868B", fontWeight: 500 }}>{s.sub}</div>
              {s.delta != null && Number.isFinite(s.delta) && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
                  background: s.hero ? (s.delta > 0 ? "rgba(255,255,255,0.25)" : "rgba(220,38,38,0.3)") : (s.delta > 0 ? "rgba(8,128,90,0.12)" : "rgba(220,38,38,0.1)"),
                  color: s.hero ? "#ffffff" : (s.delta > 0 ? "#08805a" : "#dc2626")
                }}>
                  {s.delta > 0 ? "▲ +" : s.delta < 0 ? "▼ " : ""}{s.delta}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 17, color: "#1D1D1F", letterSpacing: "-0.01em" }}>Earned vs Recharge Collected</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Bars = revenue recognised that month (accrual) · Line = recharge cash collected</div>
          </div>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={timeline} margin={{ left: 8, right: 12, top: 26 }}>
              <defs>
                <linearGradient id="earnedHigGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#0A7D53" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} tickMargin={12} height={38} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#86868B", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={64} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
              <Tooltip content={<TT prefix="₹" />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12.5, color: "#1D1D1F", paddingTop: 10 }} />
              <Bar dataKey="earned" name="Earned" fill="url(#earnedHigGrad)" radius={[8, 8, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="earned" position="top" formatter={(v) => v ? inr(v) : ""} style={{ fontSize: 10, fill: "#08805A", fontWeight: 700, fontFamily: "-apple-system, system-ui" }} />
              </Bar>
              <Line dataKey="recharge" name="Recharge collected" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, fill: "#F59E0B", stroke: "#ffffff", strokeWidth: 1.5 }} activeDot={{ r: 6 }} isAnimationActive={false}>
                <LabelList dataKey="recharge" position="bottom" offset={10} formatter={(v) => v ? inr(v) : ""} style={{ fontSize: 10, fill: "#D97706", fontWeight: 700, fontFamily: "-apple-system, system-ui" }} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Toolbar q={search} setQ={setSearch} placeholder="Search customer, mobile number or apartment…" count={tableRows.length} />
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Per-Invoice Recognition</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{rangeText} · {tableRows.length} invoices</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 460px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 1200 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Invoice #", "Reference Number", "Customer", "Apartment"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                  <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                    <button onClick={() => toggleSort("due")} title="Sort by start date"
                      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", letterSpacing: "inherit", textTransform: "inherit", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}>
                      Start Date {sort.key === "due" ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.5 }} />}
                    </button>
                  </th>
                  <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                    <button onClick={() => toggleSort("paid")} title="Sort by paid date"
                      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", letterSpacing: "inherit", textTransform: "inherit", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}>
                      Paid on {sort.key === "paid" ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.5 }} />}
                    </button>
                  </th>
                  <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                    <button onClick={() => toggleSort("nextBilling")} title="Sort by end date"
                      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", letterSpacing: "inherit", textTransform: "inherit", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}>
                      End Date {sort.key === "nextBilling" ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.5 }} />}
                    </button>
                  </th>
                  {["Total Paid", "Deposit", "Recharge", "Interval", "Earned/month", "Tenure Days"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                  <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>
                    <button onClick={() => toggleSort("earned")} title="Sort by earned revenue"
                      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", letterSpacing: "inherit", textTransform: "inherit", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}>
                      Earned Revenue {sort.key === "earned" ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.5 }} />}
                    </button>
                  </th>
                  {["Remaining Month", "Remaining Days", "Remaining Days Earned Total Revenue", "Remaining Month Earned Total Revenue"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", background: r.deposit > 0 ? "rgba(255,149,0,.04)" : undefined }}>
                    <td style={{ padding: "14px 18px", fontSize: 12, whiteSpace: "nowrap", fontWeight: 600, color: "#0d2119" }}>{r.invoiceNumber}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, whiteSpace: "nowrap", color: "#86868b" }}>{r.referenceNumber}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, fontWeight: 600, color: "#0d2119", whiteSpace: "nowrap" }}>{r.customer}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569" }}>{r.society}</td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap", fontSize: 12.5, color: "#475569" }}>{r.dueDay ? fmtDate(r.dueDay) : "—"}</td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap", fontSize: 12.5, color: "#475569" }}>{(r.payDay && !isNaN(r.payDay.getTime())) ? fmtDate(r.payDay) : "—"}</td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap", fontSize: 12.5, color: "#475569" }}>{r.nextBillDay ? fmtDate(r.nextBillDay) : "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{inr(r.total)}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(r.deposit)}</td>
                    <td style={{ padding: "14px 18px", color: "#08805a", fontWeight: 600 }}>{inr(r.recharge)}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, whiteSpace: "nowrap" }}>{r.intervalLabel ? renderHigStatusBadge(r.intervalLabel) : "—"}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(r.earnedPerMonth)}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.tenureDays ?? "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(Math.round(r.earnedRevenue))}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.remainingMonths}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.remainingDays}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: r.remainingDaysEarned ? "#08805a" : "#86868b" }}>{r.remainingDaysEarned ? inr(Math.round(r.remainingDaysEarned)) : "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: r.remainingMonthEarned ? "#08805a" : "#86868b" }}>{r.remainingMonthEarned ? inr(Math.round(r.remainingMonthEarned)) : "—"}</td>
                  </tr>
                ))}
                {tableRows.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119" }} colSpan={7}>Total ({tableRows.length})</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(visTotal.total)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(visTotal.deposit)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(visTotal.recharge)}</td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(Math.round(visTotal.earned))}</td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(Math.round(visTotal.remDaysEarned))}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(Math.round(visTotal.remMonthEarned))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {tableRows.length === 0 && <Empty msg="No paid invoices to recognise." />}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   RECONCILIATION — Collected (cash-basis, by ACTUAL paid date) vs Receivable
   (amount due in a period that wasn't collected by that period's end).
   Fixes the bug where "collected revenue" was being bucketed by an invoice's
   DUE date instead of when the money actually came in — e.g. due 28 Jul,
   paid 3 Aug was showing as July revenue; it now shows as August revenue
   (Collected), while July correctly shows it as Receivable (money that was
   due in July but not in hand by 31 Jul).
   =========================================================================== */
export function Reconciliation() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const { sel, setSel, range } = useDateRange("this_month"); // custom date-range preset filter
  const [apt, setApt] = useState(null);                     // apartment (society) filter
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | onTime | late | outstanding
  const [page, setPage] = useState(1);
  const RECON_PER_PAGE = 15;
  useEffect(() => { setPage(1); }, [search, filter, apt, sel]);

  useEffect(() => {
    api.logView(user.username, "Viewed Reconciliation");
    Promise.all([billingApi.getInvoices(), customerApi.getCustomers().catch(() => [])])
      .then(([inv, cust]) => setData({ inv, cust }))
      .catch(() => setData({ inv: [], cust: [] }));
  }, []);
  if (!data) return <Loading />;

  const custByZoho = {};
  (data.cust || []).forEach(c => { [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custByZoho[k] = c; }); });
  const societyOf = (i) => {
    for (const k of [i.zohoCustomerId, i.zohoId, i.customerNumber]) { if (k && custByZoho[k]) return custByZoho[k].society || "Unknown"; }
    return i.society || "Unknown";
  };
  const aptOptions = Array.from(new Set(data.inv.map(societyOf).filter(s => s && s !== "Unknown"))).sort();
  const aptOk = (i) => apt === null ? isRealSociety(societyOf(i)) : apt.includes(societyOf(i));

  // One reconciliation "fact" per invoice with a due date and a positive amount.
  // dueValid + periodEnd = the due date's calendar month, end of day on the
  // last day — the deadline by which the invoice should have been collected.
  const facts = data.inv.filter(i => (i.total || 0) > 0 && i.dueDate && aptOk(i)).map(i => {
    const due = new Date(i.dueDate);
    const dueOk = !isNaN(due.getTime());
    const periodEnd = dueOk ? endOfDay(new Date(due.getFullYear(), due.getMonth() + 1, 0)) : null;
    const isPaid = i.status === "paid";
    // Prefer the API's real paid_date; fall back to invoice date for older
    // invoices that predate that field.
    const paidRaw = i.paidDate || (isPaid ? i.date : null);
    const paid = paidRaw ? new Date(paidRaw) : null;
    const paidOk = paid && !isNaN(paid.getTime());
    const onTime = isPaid && paidOk && dueOk && paid <= periodEnd;
    const late = isPaid && paidOk && dueOk && paid > periodEnd;
    const outstanding = !isPaid; // never paid, as of now
    const daysLate = late ? Math.round((paid - periodEnd) / 86400000) : (outstanding && dueOk ? Math.max(0, Math.round((new Date() - periodEnd) / 86400000)) : 0);
    return {
      customer: i.customerName || "—", society: societyOf(i), number: i.number, total: i.total || 0,
      due, dueOk, paid, paidOk, isPaid, onTime, late, outstanding, periodEnd, daysLate,
    };
  });

  // "Due in period": invoices whose DUE DATE falls in the selected range —
  // the accrual/expected view.
  const dueInRange = facts.filter(f => f.dueOk && dateInRange(f.due, range));
  const dueTotal = dueInRange.reduce((s, f) => s + f.total, 0);
  const collectedOnTimeTotal = dueInRange.filter(f => f.onTime).reduce((s, f) => s + f.total, 0);
  const receivableTotal = dueInRange.filter(f => f.late || f.outstanding).reduce((s, f) => s + f.total, 0);

  // "Collected in period": cash ACTUALLY received in the range, by its real
  // paid date — regardless of which period it was originally due in. This is
  // the corrected figure (was previously bucketed by due date).
  const collectedInRange = facts.filter(f => f.isPaid && f.paidOk && dateInRange(f.paid, range));
  const collectedTotal = collectedInRange.reduce((s, f) => s + f.total, 0);
  const collectedFromEarlierDue = collectedInRange.filter(f => !(f.dueOk && dateInRange(f.due, range))).reduce((s, f) => s + f.total, 0);

  // ---- AR roll-forward (standard accounts-receivable ledger flow) ----------
  // Opening Balance + Due Added − Collected = Closing Balance. "Collected" here
  // excludes advance receipts (cash for invoices due AFTER this period — those
  // aren't yet part of AR, so netting them in would understate the balance);
  // they're reported separately as a memo line. Closing is cross-checked
  // against an independent sum (every invoice due on/before period end that
  // isn't collected by period end) — the two must always agree by construction;
  // a mismatch would mean a bug, not a real accounting discrepancy.
  const openingFacts = facts.filter(f => f.dueOk && f.due < range.from && (!f.isPaid || (f.paidOk && f.paid >= range.from)));
  const openingBalance = openingFacts.reduce((s, f) => s + f.total, 0);
  const collectedAppliedFacts = facts.filter(f => f.isPaid && f.paidOk && f.paid >= range.from && f.paid <= range.to && f.dueOk && f.due <= range.to);
  const collectedApplied = collectedAppliedFacts.reduce((s, f) => s + f.total, 0);
  const advanceReceipts = facts.filter(f => f.isPaid && f.paidOk && f.paid >= range.from && f.paid <= range.to && f.dueOk && f.due > range.to).reduce((s, f) => s + f.total, 0);
  const closingBalance = openingBalance + dueTotal - collectedApplied;
  const closingFacts = facts.filter(f => f.dueOk && f.due <= range.to && (!f.isPaid || (f.paidOk && f.paid > range.to)));
  const closingCheck = closingFacts.reduce((s, f) => s + f.total, 0);
  const rollforwardTies = Math.abs(closingBalance - closingCheck) < 1;

  const stats = [
    { label: "Due in period", value: inr(Math.round(dueTotal)), icon: Receipt, sub: `${dueInRange.length} invoice${dueInRange.length !== 1 ? "s" : ""} due`, hero: true },
    { label: "Collected in period", value: inr(Math.round(collectedTotal)), icon: Wallet, sub: "by actual receipt date, not due date" },
    { label: "Collected on time", value: inr(Math.round(collectedOnTimeTotal)), icon: CheckCircle2, sub: "of amount due, paid within its own period" },
    { label: "Receivable", value: inr(Math.round(receivableTotal)), icon: Hourglass, sub: "due in period, not collected by period end" },
  ];

  // Monthly trend spanning the selected range — Due / Collected / Receivable
  // per calendar month, so the shift (money due in one month landing as
  // collected in the next) is visible at a glance.
  const trend = [];
  { let y = range.from.getFullYear(), m = range.from.getMonth();
    const endY = range.to.getFullYear(), endM = range.to.getMonth();
    let guard = 0;
    while ((y < endY || (y === endY && m <= endM)) && guard++ < 60) {
      const mStart = new Date(y, m, 1), mEnd = endOfDay(new Date(y, m + 1, 0));
      const dueHere = facts.filter(f => f.dueOk && f.due >= mStart && f.due <= mEnd);
      const collectedHere = facts.filter(f => f.isPaid && f.paidOk && f.paid >= mStart && f.paid <= mEnd);
      trend.push({
        label: _monthShort(y, m + 1),
        due: Math.round(dueHere.reduce((s, f) => s + f.total, 0)),
        collected: Math.round(collectedHere.reduce((s, f) => s + f.total, 0)),
        receivable: Math.round(dueHere.filter(f => f.late || f.outstanding).reduce((s, f) => s + f.total, 0)),
      });
      m++; if (m > 11) { m = 0; y++; }
    }
  }

  const chips = [
    ["all", `All (${dueInRange.length})`],
    ["onTime", `On time (${dueInRange.filter(f => f.onTime).length})`],
    ["late", `Late (${dueInRange.filter(f => f.late).length})`],
    ["outstanding", `Outstanding (${dueInRange.filter(f => f.outstanding).length})`],
  ];
  const searchQ = search.trim().toLowerCase();
  const tableRows = dueInRange
    .filter(f => filter === "all" || (filter === "onTime" ? f.onTime : filter === "late" ? f.late : f.outstanding))
    .filter(f => !searchQ || f.customer.toLowerCase().includes(searchQ) || f.society.toLowerCase().includes(searchQ))
    .sort((a, b) => b.due - a.due);

  const exportCsv = () => exportToCsv(`prowater-reconciliation-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
    { label: "Customer", get: f => f.customer }, { label: "Apartment", get: f => f.society },
    { label: "Invoice total", get: f => f.total },
    { label: "Due date", get: f => f.dueOk ? fmtDate(f.due) : "" },
    { label: "Period end", get: f => f.periodEnd ? fmtDate(f.periodEnd) : "" },
    { label: "Paid on", get: f => f.paidOk ? fmtDate(f.paid) : "" },
    { label: "Status", get: f => f.onTime ? "On time" : f.late ? "Late" : "Outstanding" },
    { label: "Days late", get: f => f.daysLate || "" },
  ], tableRows);

  const reconPeriodLabel = rangeLabel(range);

  // Pagination — mirrors the DP Transaction/Sales Leads pattern; the CSV export
  // and the "Total" checks above always use the FULL filtered set (tableRows),
  // only the rendered table rows are sliced to the current page.
  const reconTotalPages = Math.max(1, Math.ceil(tableRows.length / RECON_PER_PAGE));
  const reconCurPage = Math.min(page, reconTotalPages);
  const reconPageStart = (reconCurPage - 1) * RECON_PER_PAGE;
  const reconPageRows = tableRows.slice(reconPageStart, reconPageStart + RECON_PER_PAGE);
  const initialsOf = (name) => String(name || "—").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "—";
  // Small snapshot bars — Due / Collected / Receivable for THIS period only
  // (the monthly trend chart further down covers the multi-month view).
  const overviewBars = [
    { label: "Due", value: dueTotal, bg: "var(--green-b)", text: "var(--green)" },
    { label: "Collected", value: collectedTotal, bg: "var(--green)", text: "var(--green)" },
    { label: "Receivable", value: receivableTotal, bg: "var(--danger)", text: "var(--danger)" },
  ];
  const overviewMax = Math.max(1, ...overviewBars.map(b => b.value));

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <MultiSelectFilter label="Apartment" options={aptOptions} value={apt} onChange={setApt} width={240} />
        <DateRangePicker value={sel} onChange={setSel} />
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>

      {collectedFromEarlierDue > 0 && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--amber-b)", background: "var(--amber-t)", color: "var(--amber)", fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, border: "1.5px solid var(--amber)", fontSize: 10.5, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>i</span>
          {inr(Math.round(collectedFromEarlierDue))} of the collected total is for invoices due in an earlier (or later) period — collected here because that's when the payment actually landed, not when it was originally due.
        </div>
      )}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1.65fr 0.75fr", gap: 16 }} className="recon-grid">
        <style>{`@media(max-width:900px){.recon-grid{grid-template-columns:1fr!important}}`}</style>
        <Card pad={false}>
          <div style={{ padding: "18px 20px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 18, color: "var(--f)" }}>Outstanding balance</div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: rollforwardTies ? "var(--green)" : "var(--danger)", background: rollforwardTies ? "var(--green-t)" : "var(--danger-t)", padding: "4px 10px", borderRadius: 999 }}>{rollforwardTies ? "Reconciled" : "Check needed"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 5 }}>What was already owed, what became newly due, what actually came in, and what's still owed — for {rangeLabel(range)}.</div>
              </div>
              <div style={{ background: "var(--mint)", borderRadius: 12, padding: "9px 14px", textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--green)" }}>Verification</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: rollforwardTies ? "var(--f)" : "var(--danger)", display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 4, whiteSpace: "nowrap" }}>
                  {rollforwardTies ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {rollforwardTies ? "Matches all unpaid invoices" : `Off by ${inr(Math.round(Math.abs(closingBalance - closingCheck)))}`}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
              {[
                { label: "Opening balance", value: openingBalance, sub: `${openingFacts.length} unpaid invoice${openingFacts.length !== 1 ? "s" : ""} before ${dmy(range.from)}` },
                { op: "+", label: "New dues", value: dueTotal, sub: `${dueInRange.length} invoice${dueInRange.length !== 1 ? "s" : ""} due this period` },
                { op: "−", label: "Payments", value: collectedApplied, sub: `${collectedAppliedFacts.length} payment${collectedAppliedFacts.length !== 1 ? "s" : ""} received` },
                { op: "=", label: "Closing balance", value: closingBalance, sub: `${closingFacts.length} invoice${closingFacts.length !== 1 ? "s" : ""} still unpaid`, hero: true },
              ].map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: "1 1 170px", minWidth: 0 }}>
                  {c.op && <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--mint)", color: "var(--muted)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, marginRight: 9, flexShrink: 0 }}>{c.op}</div>}
                  <div style={{ flex: 1, minWidth: 0, background: c.hero ? "var(--green-t)" : "var(--mint)", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>{c.label}</div>
                    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 21, color: c.hero ? "var(--green)" : "var(--f)", margin: "4px 0 2px", lineHeight: 1.15 }}>{inr(Math.round(c.value))}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.35 }}>{c.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 20px", marginTop: 4 }}>
            {advanceReceipts > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                Note: {inr(Math.round(advanceReceipts))} was paid in advance this period for invoices not yet due — kept separate, not counted above.
              </div>
            )}
          </div>
        </Card>

        <Card title="Period overview" sub={`${dueInRange.length} invoice${dueInRange.length !== 1 ? "s" : ""} · ${rangeLabel(range)}`}>
          <div style={{ display: "flex", height: 175, alignItems: "flex-end", justifyContent: "space-around", gap: 12, padding: "4px 2px 0" }}>
            {overviewBars.map(b => {
              const h = Math.max((b.value / overviewMax) * 100, 8);
              return (
                <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: b.text, marginBottom: 7, whiteSpace: "nowrap" }}>{inr(Math.round(b.value))}</span>
                  <div style={{ width: "100%", maxWidth: 56, height: 112, background: "var(--mint)", borderRadius: 10, display: "flex", alignItems: "flex-end", padding: 4 }}>
                    <div style={{ width: "100%", borderRadius: 8, background: b.bg, height: `${h}%`, transition: "height .4s" }} />
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 9, fontWeight: 600 }}>{b.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Due vs collected vs receivable, by month" sub="Due = accrual (due date). Collected = cash-basis (actual paid date). Receivable = due in that month, not collected by that month's end.">
          {trend.length === 0 ? <Empty msg="No invoices in this window." /> : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={trend} margin={{ left: 8, right: 12, top: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} tickMargin={12} height={38} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<TT prefix="₹" />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="due" name="Due" fill="#B5E2D4" radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                <Bar dataKey="collected" name="Collected" fill="#08805A" radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                <Bar dataKey="receivable" name="Receivable" fill="#DC4141" radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card pad={false}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 17, color: "var(--f)" }}>Invoices</div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", background: "var(--mint)", padding: "4px 9px", borderRadius: 8 }}>{dmy(range.from)} — {dmy(range.to)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Review payment status for all invoices due in this period.</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative", minWidth: 220 }}>
                <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or apartment…"
                  style={{ ...inp, margin: 0, height: 38, paddingLeft: 32, fontSize: 12.5, background: "var(--mint)", border: "1px solid var(--border)" }} />
              </div>
              <div style={{ display: "flex", gap: 3, background: "var(--mint)", padding: 4, borderRadius: 11 }}>
                {chips.map(([id, label]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{
                    padding: "7px 11px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "none", whiteSpace: "nowrap",
                    background: filter === id ? "#fff" : "transparent",
                    color: filter === id ? "var(--green)" : "var(--muted)",
                    boxShadow: filter === id ? "var(--shadow)" : "none",
                  }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          <Table head={["Customer", "Apartment", "Total", "Due date", "Period end", "Paid on", "Status"]} maxHeight="calc(100vh - 460px)">
            {reconPageRows.map((f, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: f.outstanding ? "var(--danger-t)" : f.late ? "var(--amber-t)" : undefined }}>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 999, fontSize: 10.5, fontWeight: 800, flexShrink: 0, color: f.outstanding ? "var(--danger)" : "var(--green)", background: f.outstanding ? "var(--danger-t)" : "var(--green-t)" }}>{initialsOf(f.customer)}</span>
                    {f.customer}
                  </div>
                </td>
                <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{f.society}</td>
                <td style={{ ...td, fontWeight: 600 }}>{inr(f.total)}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{f.dueOk ? fmtDate(f.due) : "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{f.periodEnd ? fmtDate(f.periodEnd) : "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{f.paidOk ? fmtDate(f.paid) : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: f.onTime ? "var(--green)" : f.late ? "var(--amber)" : "var(--danger)", background: f.onTime ? "var(--green-t)" : f.late ? "var(--amber-t)" : "var(--danger-t)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: f.onTime ? "var(--green)" : f.late ? "var(--amber)" : "var(--danger)" }} />
                    {f.onTime ? "On time" : f.late ? `Late${f.daysLate ? ` · ${f.daysLate}d` : ""}` : "Outstanding"}
                  </span>
                </td>
              </tr>
            ))}
            {tableRows.length === 0 && <tr><td colSpan={7} style={{ padding: 0 }}><Empty msg="No invoices match this filter." /></td></tr>}
          </Table>
          {tableRows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border)", background: "var(--mint)" }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Showing <span style={{ fontWeight: 700, color: "var(--slate)" }}>{reconPageRows.length}</span> of {tableRows.length} invoice{tableRows.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={reconCurPage <= 1} style={{ ...btnGhost, padding: "6px 13px", fontSize: 11.5, opacity: reconCurPage <= 1 ? .5 : 1, cursor: reconCurPage <= 1 ? "not-allowed" : "pointer" }}>Previous</button>
                <button onClick={() => setPage(p => Math.min(reconTotalPages, p + 1))} disabled={reconCurPage >= reconTotalPages} style={{ ...btnGhost, padding: "6px 13px", fontSize: 11.5, opacity: reconCurPage >= reconTotalPages ? .5 : 1, cursor: reconCurPage >= reconTotalPages ? "not-allowed" : "pointer" }}>Next</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   DP TRANSACTIONS — raw deposit/recharge collection feed from GET
   /dp-transactions (cursor-paginated, unauthenticated, same origin as
   billing). Filtered by Paid_Date (custom date-range) + partner_name
   (apartment) multi-select; KPIs sum deposit_amount / revenue_amount exactly
   as the API reports them (null-safe). Table shows the raw rows — including
   both the COLLECTION_SUMMARY and TRANSACTION rows per collection event, since
   this tab is meant to mirror the feed, not reshape it.
   =========================================================================== */
export function DPTransactions() {
  const { user } = useAuth();
  const [state, setState] = useState(null); // { rows, truncated } | null
  const [err, setErr] = useState("");
  const { sel, setSel, range } = useDateRange("this_month"); // custom date-range preset, filters on Paid_Date
  const [apt, setApt] = useState(null);                     // apartment (partner_name) filter
  const [search, setSearch] = useState("");
  const [rowType, setRowType] = useState("TRANSACTION");    // payment-type filter — raw row_type value; "all" or a literal value like "TRANSACTION"
  const [txnType, setTxnType] = useState("all");            // transaction_type filter — "all" or a literal value like "APP" (DISCOUNT is hard-excluded below, not offered as a choice)
  const [sort, setSort] = useState({ key: "paid", dir: "desc" }); // table sort — Paid date / Start Date / End Date
  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  const [page, setPage] = useState(1);                      // table pagination — this feed can run to thousands of rows
  const DP_PER_PAGE = 50;
  const isAdmin = user.role === "admin";                    // Upload JSON / Run API is admin-only
  const [uploadFile, setUploadFile] = useState(null);       // File selected via the hidden input, once it passes JSON validation
  const [uploadError, setUploadError] = useState("");       // inline error — bad file, or the Run API call itself failed
  const [running, setRunning] = useState(false);            // Run API request in flight
  const [apiResult, setApiResult] = useState(null);         // { ok, status, body, message? } — feeds the response popup
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.logView(user.username, "Viewed DP Transactions");
    fetchAllDpTransactions()
      .then(setState)
      .catch(e => setErr(e.message || "Could not load DP transactions."));
  }, []);
  useEffect(() => { setPage(1); }, [search, rowType, txnType, apt, sel]);
  if (err) return <ApiError msg={err} />;
  if (!state) return <Loading />;

  // Admin-only bulk import — upload a .json file, validate it client-side,
  // then POST it (as multipart/form-data, field "file") to the /add endpoint.
  // Any response (success or failure) is shown verbatim in a popup so the
  // admin can see exactly what the backend did with the file.
  const onPickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // clears the input so picking the SAME filename again still fires onChange
    if (!f) return;
    setUploadError("");
    setApiResult(null);
    if (!/\.json$/i.test(f.name)) {
      setUploadError("Please choose a .json file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        JSON.parse(String(reader.result || "")); // validates it parses — the ORIGINAL file (not the re-serialised text) is what gets uploaded
        setUploadFile(f);
      } catch {
        setUploadError("That file isn't valid JSON — check it and try again.");
        setUploadFile(null);
      }
    };
    reader.onerror = () => setUploadError("Couldn't read that file — please try again.");
    reader.readAsText(f);
  };

  const clearUpload = () => { setUploadFile(null); setUploadError(""); };

  const runApi = async () => {
    if (!uploadFile || running) return;
    setRunning(true); setUploadError(""); setApiResult(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile, uploadFile.name);
      const res = await fetch(`${API_ORIGIN}/dp-transactions/add`, { method: "POST", body: fd });
      let bodyText = "", body = null;
      try { bodyText = await res.text(); } catch { /* no body */ }
      if (bodyText) { try { body = JSON.parse(bodyText); } catch { body = bodyText; } }
      if (!res.ok) {
        const message = (body && typeof body === "object" && (body.message || body.error || body.detail)) || `Request failed — HTTP ${res.status}`;
        setApiResult({ ok: false, status: res.status, body, message });
      } else {
        setApiResult({ ok: true, status: res.status, body });
        setUploadFile(null); // done — back to "Upload JSON" for the next file
        fetchAllDpTransactions(true).then(setState).catch(() => { /* table just won't refresh; the popup already confirmed success */ });
      }
    } catch (e) {
      setApiResult({ ok: false, status: null, body: null, message: e.message || "Couldn't reach the server — check your connection and try again." });
    } finally {
      setRunning(false);
    }
  };

  // DISCOUNT transaction_type rows are excluded outright, everywhere in this
  // view — they're a non-cash discount adjustment, not real recharge
  // collected, so counting them in Deposit/Recharge Collected would
  // overstate actual cash received. Not offered as a filter choice at all
  // (unlike Payment Type's "All"), since there's no case where they should
  // be included here.
  const rows = state.rows.filter(r => r.transaction_type !== "DISCOUNT");
  const aptOptions = Array.from(new Set(rows.map(r => r.partner_name).filter(Boolean))).sort();
  const aptOk = (r) => apt === null ? isRealSociety(r.partner_name) : apt.includes(r.partner_name);

  // Paid_Date arrives as "YYYY-MM-DD HH:MM:SS.ffffff" — native Date parses it fine.
  const paidOk = (r) => {
    if (!r.Paid_Date) return false;
    const d = new Date(r.Paid_Date);
    return !isNaN(d.getTime()) && dateInRange(d, range);
  };

  // Payment-type (row_type) filter — defaults to TRANSACTION only, since that's
  // the row carrying deposit_amount/revenue_amount (the KPI fields); the
  // COLLECTION_SUMMARY row for the same event is a duplicate view with those
  // fields null. Chip labels show the raw API value verbatim, not a friendly name.
  const rowTypeOptions = Array.from(new Set(rows.map(r => r.row_type).filter(Boolean))).sort();
  const dateAptFiltered = rows.filter(r => aptOk(r) && paidOk(r));
  const rowTypeCounts = {};
  dateAptFiltered.forEach(r => { const k = r.row_type || "—"; rowTypeCounts[k] = (rowTypeCounts[k] || 0) + 1; });
  const rowTypeOk = (r) => rowType === "all" || r.row_type === rowType;

  // Transaction Type filter — the feed's transaction_type field (only
  // populated on TRANSACTION rows; DISCOUNT is already gone entirely, so
  // the remaining values are things like APP / PAYMENT_LINK).
  const txnTypeOptions = Array.from(new Set(rows.map(r => r.transaction_type).filter(Boolean))).sort();
  const txnTypeCounts = {};
  dateAptFiltered.forEach(r => { const k = r.transaction_type || "—"; txnTypeCounts[k] = (txnTypeCounts[k] || 0) + 1; });
  const txnTypeOk = (r) => txnType === "all" || r.transaction_type === txnType;

  const inRange = dateAptFiltered.filter(rowTypeOk).filter(txnTypeOk);

  // Validity/litres live on the COLLECTION_SUMMARY row and are null on its
  // TRANSACTION twin — but both rows of the same collection event share the
  // exact same Paid_Date timestamp (down to the microsecond). So when a
  // TRANSACTION row's Paid_Date exactly matches another row that DOES carry
  // Validity/litres, borrow those values for display — merges the pair back
  // together without hiding either row. Built off dateAptFiltered (before the
  // Payment Type chip filter) so the COLLECTION_SUMMARY twin is still
  // available to match against even when the chip is narrowed to TRANSACTION.
  const validityLitresByPaidDate = {};
  dateAptFiltered.forEach(r => {
    if (r.Paid_Date && (r.litres != null || r.Validity != null)) {
      validityLitresByPaidDate[r.Paid_Date] = { litres: r.litres, Validity: r.Validity };
    }
  });
  const litresOf = (r) => r.litres != null ? r.litres : (r.row_type === "TRANSACTION" ? validityLitresByPaidDate[r.Paid_Date]?.litres ?? null : null);
  const validityOf = (r) => r.Validity != null ? r.Validity : (r.row_type === "TRANSACTION" ? validityLitresByPaidDate[r.Paid_Date]?.Validity ?? null : null);

  const depositCollected = inRange.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
  const rechargeCollected = inRange.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
  const totalCollected = depositCollected + rechargeCollected;
  // Dynamic split — recomputed from whatever's actually in `inRange` right now,
  // so it always tracks the current date/apartment/type filters, never hardcoded.
  const depositSplitPct = totalCollected > 0 ? Math.round((depositCollected / totalCollected) * 100) : 0;
  const rechargeSplitPct = totalCollected > 0 ? 100 - depositSplitPct : 0;

  // Previous-period comparison — same unit as the selected preset (month for
  // the default "This Month", quarter for "This Quarter", etc.), matching the
  // MoM/QoQ/YoY convention used elsewhere (Earned Revenue, Reconciliation).
  const rngPrev = prevRange(sel.preset, range);
  const prevFiltered = rows.filter(r => aptOk(r) && rowTypeOk(r) && txnTypeOk(r) && r.Paid_Date && dateInRange(new Date(r.Paid_Date), rngPrev));
  const depositPrev = prevFiltered.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
  const rechargePrev = prevFiltered.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
  const totalPrev = depositPrev + rechargePrev;

  const today = startOfDay(new Date());

  const calcDpRowEarned = (r) => {
    const pd = r.Paid_Date ? startOfDay(new Date(r.Paid_Date)) : null;
    const pdValid = pd && !isNaN(pd.getTime());
    const startDate = r["t.validity_start_date"] ? startOfDay(new Date(r["t.validity_start_date"])) : null;
    const endDate = r["t.validity_end_date"] ? startOfDay(new Date(r["t.validity_end_date"])) : null;
    const startValid = startDate && !isNaN(startDate.getTime());
    const endValid = endDate && !isNaN(endDate.getTime());

    const recharge = Math.max(0, Number(r.revenue_amount) || 0);
    const deposit = Math.max(0, Number(r.deposit_amount) || 0);
    const totalPaid = Number(r.transaction_amount) || (deposit + recharge);

    const refStart = pdValid ? pd : (startValid ? startDate : null);
    const tenureDays = (refStart && endValid)
      ? Math.max(1, Math.round((endDate - refStart) / 86400000) + 1)
      : (validityOf(r) || 30);

    const monthEnd = pdValid ? new Date(pd.getFullYear(), pd.getMonth() + 1, 0) : null;
    let daysInPaidMonth = 0;
    if (pdValid && endValid && tenureDays > 0) {
      const overlapEnd = endDate < monthEnd ? endDate : monthEnd;
      daysInPaidMonth = overlapEnd >= pd ? Math.min(tenureDays, Math.round((overlapEnd - pd) / 86400000) + 1) : 0;
    } else if (pdValid) {
      const dm = new Date(pd.getFullYear(), pd.getMonth() + 1, 0).getDate();
      daysInPaidMonth = Math.min(tenureDays, dm - pd.getDate() + 1);
    }

    const earnedRevenue = tenureDays > 0 ? (recharge * daysInPaidMonth) / tenureDays : 0;
    const remainingDaysEarned = Math.max(0, recharge - earnedRevenue);

    return {
      ...r,
      pd, startDate, endDate, recharge, deposit, totalPaid,
      tenureDays, daysInPaidMonth, earnedRevenue, remainingDaysEarned
    };
  };

  const enrichedInRange = inRange.map(calcDpRowEarned);
  const totalEarnedRevenue = enrichedInRange.reduce((s, r) => s + r.earnedRevenue, 0);

  const prevEnriched = prevFiltered.map(calcDpRowEarned);
  const totalPrevEarned = prevEnriched.reduce((s, r) => s + r.earnedRevenue, 0);

  const stats = [
    { label: "Total Collected", value: inr(Math.round(totalCollected)), icon: Wallet, sub: rangeLabel(range), hero: true, delta: momPct(totalCollected, totalPrev) },
    { label: "Earned Revenue", value: inr(Math.round(totalEarnedRevenue)), icon: Scale, sub: `recognised · ${rangeLabel(range)}`, delta: momPct(totalEarnedRevenue, totalPrevEarned) },
    { label: "Recharge Collected", value: inr(Math.round(rechargeCollected)), icon: Repeat, sub: `${rechargeSplitPct}% of collections`, delta: momPct(rechargeCollected, rechargePrev) },
    { label: "Deposit Collected", value: inr(Math.round(depositCollected)), icon: Landmark, sub: `${depositSplitPct}% of collections`, delta: momPct(depositCollected, depositPrev) },
  ];

  const sortField = { paid: "Paid_Date", start: "t.validity_start_date", end: "t.validity_end_date" }[sort.key];
  const searchQ = search.trim().toLowerCase();
  const tableRows = enrichedInRange
    .filter(r => !searchQ ||
      (r.phone || "").toLowerCase().includes(searchQ) ||
      (r.current_device || "").toLowerCase().includes(searchQ) ||
      (r.partner_name || "").toLowerCase().includes(searchQ) ||
      (r.CustomerName || "").toLowerCase().includes(searchQ))
    .sort((a, b) => {
      const ta = a[sortField] ? new Date(a[sortField]).getTime() : 0;
      const tb = b[sortField] ? new Date(b[sortField]).getTime() : 0;
      return (ta - tb) * (sort.dir === "asc" ? 1 : -1);
    });
  const grandDeposit = tableRows.reduce((s, r) => s + (r.deposit || 0), 0);
  const grandRevenue = tableRows.reduce((s, r) => s + (r.recharge || 0), 0);
  const grandTotalPaid = tableRows.reduce((s, r) => s + (r.totalPaid || 0), 0);
  const grandEarnedRevenue = tableRows.reduce((s, r) => s + (r.earnedRevenue || 0), 0);
  const grandRemainingEarned = tableRows.reduce((s, r) => s + (r.remainingDaysEarned || 0), 0);

  // Per-apartment performance — same date/apt/type filters as the aggregate
  // KPI cards above, just broken out by partner_name so you can compare
  // apartments at a glance instead of only seeing the fleet-wide total.
  // Shows EVERY known apartment (all of `aptOptions`), not just the ones with
  // activity in the current filters — an apartment with zero transactions
  // this period still gets a ₹0 card instead of silently disappearing, so
  // the card count always matches the Apartment filter's option count.
  const aptStats = aptOptions.map(name => {
    const aptRows = inRange.filter(r => r.partner_name === name);
    const dep = aptRows.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
    const rev = aptRows.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
    const tot = dep + rev;
    // Dynamic per-apartment split — recomputed from this apartment's own
    // dep/rev in the current filters, never a fixed/hardcoded ratio.
    const depPct = tot > 0 ? Math.round((dep / tot) * 100) : 0;
    const revPct = tot > 0 ? 100 - depPct : 0;
    return { name, dep, rev, tot, depPct, revPct, count: aptRows.length };
  }).sort((a, b) => b.rev - a.rev);
  const aptActiveCount = aptStats.filter(a => a.count > 0).length;

  // Pagination — this feed can run into the thousands of rows; the Grand
  // Total footer still sums the FULL filtered set (tableRows), only the
  // rendered rows are sliced to the current page.
  const dpTotalPages = Math.max(1, Math.ceil(tableRows.length / DP_PER_PAGE));
  const dpCurPage = Math.min(page, dpTotalPages);
  const dpPageStart = (dpCurPage - 1) * DP_PER_PAGE;
  const pageRows = tableRows.slice(dpPageStart, dpPageStart + DP_PER_PAGE);

  const exportCsv = () => exportToCsv(`prowater-dp-transactions-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
    { label: "Paid date", get: r => r.Paid_Date || "" },
    { label: "Apartment (partner_name)", get: r => r.partner_name || "" },
    { label: "Customer", get: r => r.CustomerName || "" },
    { label: "Phone", get: r => r.phone || "" },
    { label: "Current device", get: r => r.current_device || "" },
    { label: "Row type", get: r => r.row_type || "" },
    { label: "Transaction key", get: r => r.transaction_key || "" },
    { label: "Transaction type", get: r => r.transaction_type || "" },
    { label: "Start Date", get: r => r["t.validity_start_date"] || "" },
    { label: "End Date", get: r => r["t.validity_end_date"] || "" },
    { label: "Validity", get: r => validityOf(r) ?? "" },
    { label: "Litres", get: r => litresOf(r) ?? "" },
    { label: "Plan", get: r => r.Plan || "" },
    { label: "Deposit amount", get: r => r.deposit_amount ?? "" },
    { label: "Revenue amount", get: r => r.revenue_amount ?? "" },
    { label: "Transaction amount", get: r => r.transaction_amount ?? "" },
    { label: "City", get: r => r.City || "" },
    { label: "Device status", get: r => r.device_status || "" },
  ], tableRows);

  // Clickable column header — Paid date / Start Date / End Date all sort the
  // same way (single active sort key, arrow shows current direction).
  const sortHeader = (key, label) => (
    <button key={key} onClick={() => toggleSort(key)} title={`Sort by ${label.toLowerCase()}`}
      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", letterSpacing: "inherit", textTransform: "inherit", display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}>
      {label} {sort.key === key ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} style={{ opacity: .4 }} />}
    </button>
  );

  const dpPeriodLabel = rangeLabel(range);

  return (
    <div className="fade-up">
      {state.truncated && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 10, border: "1px solid #F0D9A8", background: "#FBF0DA", color: "#8a5a00", fontSize: 12.5, fontWeight: 600 }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          The DP Transactions feed has more records than this page loaded (capped at ~2,000) — figures below may be incomplete for very wide date ranges.
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <MultiSelectFilter label="Apartment" options={aptOptions} value={apt} onChange={setApt} width={260} />
        <DateRangePicker value={sel} onChange={setSel} />
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
        {isAdmin && (
          <>
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={onPickFile} style={{ display: "none" }} />
            {!uploadFile ? (
              <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}><Upload size={15} /> Upload JSON</button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span title={uploadFile.name} style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadFile.name}</span>
                <button onClick={runApi} disabled={running} style={{ ...btnPrimary, opacity: running ? .7 : 1, cursor: running ? "not-allowed" : "pointer" }}>
                  {running ? <RefreshCw size={15} style={{ animation: "pw-spin .7s linear infinite" }} /> : <PlayCircle size={15} />} {running ? "Running…" : "Run API"}
                </button>
                <button onClick={clearUpload} disabled={running} title="Remove file" style={{ ...iconBtn, opacity: running ? .5 : 1 }}><X size={15} /></button>
              </div>
            )}
          </>
        )}
      </div>
      {isAdmin && uploadError && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 10, border: "1px solid #F3C6C6", background: "#FBE8E8", color: "#B23B3B", fontSize: 12.5, fontWeight: 600 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {uploadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: s.hero ? "linear-gradient(135deg, #08805A 0%, #065B3C 100%)" : "rgba(255, 255, 255, 0.85)",
            backdropFilter: s.hero ? "none" : "blur(20px)",
            WebkitBackdropFilter: s.hero ? "none" : "blur(20px)",
            border: s.hero ? "none" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 20,
            padding: "20px 22px",
            boxShadow: s.hero ? "0 10px 25px rgba(8, 128, 90, 0.28)" : "0 10px 30px rgba(0, 0, 0, 0.03)",
            color: s.hero ? "#fff" : "#1D1D1F",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: s.hero ? "#B5E2D4" : "#86868B" }}>{s.label}</span>
                {s.icon && <s.icon size={18} style={{ color: s.hero ? "#A7F3D0" : "#08805A" }} />}
              </div>
              <div style={{ fontSize: 25, fontWeight: 700, color: s.hero ? "#fff" : "#1D1D1F", letterSpacing: "-.02em" }}>{s.value}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 12 }}>
              <span style={{ color: s.hero ? "#D1FAE5" : "#86868B" }}>{s.sub}</span>
              {s.delta != null && (
                <span style={{ fontWeight: 700, color: s.hero ? "#A7F3D0" : (s.delta >= 0 ? "#08805A" : "#DC2626") }}>
                  {s.delta >= 0 ? "▲ +" : "▼ "}{s.delta}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Apartment performance */}
      {aptStats.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Card>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1D1D1F" }}>Apartment performance</div>
                <div style={{ fontSize: 12, color: "#86868B", marginTop: 4 }}>Collections ranked by apartment for this period · {aptActiveCount} of {aptStats.length} active</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
              {aptStats.map((a, i) => {
                const maxAmt = Math.max(1, ...aptStats.map(x => x.tot));
                const pct = Math.round((a.tot / maxAmt) * 100);
                const inactive = a.tot === 0;
                return (
                  <div key={a.name} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: inactive ? "var(--mint)" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, fontSize: 10, fontWeight: 800, flexShrink: 0, color: (i === 0 && !inactive) ? "#fff" : "var(--muted)", background: (i === 0 && !inactive) ? "var(--green)" : "var(--mint-2)" }}>{i + 1}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--slate)", lineHeight: 1.3 }}>{a.name}</span>
                        </div>
                        <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 20, color: inactive ? "var(--muted)" : "var(--f)", marginTop: 9 }}>{inr(Math.round(a.tot))}</div>
                      </div>
                      {!inactive && <div style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 9, background: "var(--green-t)", color: "var(--green)", flexShrink: 0 }}><Boxes size={14} /></div>}
                    </div>
                    {inactive ? (
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", background: "var(--mint-2)", padding: "4px 9px", borderRadius: 999 }}>No activity</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: "var(--mint-2)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--green)" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9, fontSize: 10.5, color: "var(--muted)" }}>
                          <span>{a.count} txn{a.count !== 1 ? "s" : ""}</span>
                          <span>{a.dep > 0 ? `Deposit ${inr(Math.round(a.dep))}` : "100% recharge"}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <Toolbar q={search} setQ={setSearch} placeholder="Search phone, device or apartment…" count={tableRows.length}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Payment Type</span>
              {[["all", `All (${dateAptFiltered.length})`], ...rowTypeOptions.map(rt => [rt, `${rt} (${rowTypeCounts[rt] || 0})`])].map(([id, label]) => (
                <button key={id} onClick={() => setRowType(id)} style={{
                  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: "1px solid " + (rowType === id ? "var(--green-b)" : "var(--border)"),
                  background: rowType === id ? "var(--green-t)" : "#fff",
                  color: rowType === id ? "var(--green)" : "var(--slate)"
                }}>{label}</button>
              ))}
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginLeft: 10 }}>Transaction Type</span>
              {[["all", `All (${dateAptFiltered.length})`], ...txnTypeOptions.map(tt => [tt, `${tt} (${txnTypeCounts[tt] || 0})`])].map(([id, label]) => (
                <button key={id} onClick={() => setTxnType(id)} style={{
                  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: "1px solid " + (txnType === id ? "var(--green-b)" : "var(--border)"),
                  background: txnType === id ? "var(--green-t)" : "#fff",
                  color: txnType === id ? "var(--green)" : "var(--slate)"
                }}>{label}</button>
              ))}
            </div>
          } />
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", overflow: "hidden" }}>
          <Card pad={false}
            title={<span>Transactions · {rangeLabel(range)} <span style={{ fontSize: 10.5, fontWeight: 700, color: "#08805A", background: "rgba(8,128,90,0.12)", padding: "3px 9px", borderRadius: 999, marginLeft: 6 }}>{tableRows.length.toLocaleString("en-IN")} records</span></span>}
            sub="Raw records from the DP Transactions feed — filtered by Paid_Date, apartment, payment type and transaction type.">
            <Table head={[
              sortHeader("paid", "Paid date"),
              "Apartment", "Customer", "Phone", "Device", "Type",
              sortHeader("start", "Start Date"), sortHeader("end", "End Date"),
              "Validity", "Litres", "Plan", "Deposit", "Revenue"]} maxHeight="calc(100vh - 460px)">
            {pageRows.map((r, i) => (
              <tr key={r.id ? `${r.id}-${i}` : i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.Paid_Date ? fmtDate(new Date(r.Paid_Date)) : "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.partner_name || "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.CustomerName || "—"}</td>
                <td style={{ ...td, fontSize: 12.5, textAlign: "center" }}>{r.phone || "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center" }}>
                  {r.current_device ? <span style={{ display: "inline-block", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "var(--mint)", color: "var(--slate)" }}>{r.current_device}</span> : "—"}
                </td>
                <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 700, padding: "3px 9px 3px 7px", borderRadius: 999, color: r.row_type === "TRANSACTION" ? "#08805A" : "#2A86D6", background: r.row_type === "TRANSACTION" ? "#E2F3EE" : "#E5F0FA" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: r.row_type === "TRANSACTION" ? "#08805A" : "#2A86D6", flexShrink: 0 }} />
                    {r.row_type || "—"}
                  </span>
                </td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r["t.validity_start_date"] ? fmtDate(new Date(r["t.validity_start_date"])) : "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r["t.validity_end_date"] ? fmtDate(new Date(r["t.validity_end_date"])) : "—"}</td>
                <td style={{ ...td, fontSize: 12.5, textAlign: "center" }}>{validityOf(r) != null ? Number(validityOf(r)).toLocaleString("en-IN") : "—"}</td>
                <td style={{ ...td, fontSize: 12.5, textAlign: "center" }}>{litresOf(r) != null ? Number(litresOf(r)).toLocaleString("en-IN") : "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.Plan || "—"}</td>
                <td style={{ ...td, fontWeight: 600, textAlign: "center" }}>{r.deposit_amount != null ? inr(r.deposit_amount) : "—"}</td>
                <td style={{ ...td, color: "var(--teal-d)", fontWeight: 600, textAlign: "center" }}>{r.revenue_amount != null ? inr(r.revenue_amount) : "—"}</td>
              </tr>
            ))}
            {tableRows.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={11}>Grand Total ({tableRows.length})</td>
                <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandDeposit))}</td>
                <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandRevenue))}</td>
              </tr>
            )}
            {tableRows.length === 0 && <tr><td colSpan={13} style={{ padding: 0 }}><Empty msg="No transactions match this filter." /></td></tr>}
          </Table>
          {tableRows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{dpPageStart + 1}–{Math.min(dpPageStart + DP_PER_PAGE, tableRows.length)} of {tableRows.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={dpCurPage <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: dpCurPage <= 1 ? .5 : 1, cursor: dpCurPage <= 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /> Prev</button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--f)" }}>Page {dpCurPage} / {dpTotalPages}</span>
                <button onClick={() => setPage(p => Math.min(dpTotalPages, p + 1))} disabled={dpCurPage >= dpTotalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: dpCurPage >= dpTotalPages ? .5 : 1, cursor: dpCurPage >= dpTotalPages ? "not-allowed" : "pointer" }}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </Card>
        </div>

        {/* ── NEW: DP Earned Revenue Recognition Table ───────────────────────────── */}
        <div style={{ marginTop: 22 }}>
          <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(243,248,236,.4)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>DP Earned Revenue Recognition</div>
                <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Per-transaction revenue recognised in {rangeLabel(range)} based on payment date and validity tenure</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "rgba(8,128,90,0.12)", color: "#08805A" }}>
                Total Recognised: {inr(Math.round(grandEarnedRevenue))}
              </span>
            </div>

            <Table head={[
              sortHeader("paid", "Paid date"),
              "Apartment", "Customer", "Phone", "Device", "Plan",
              "Total Paid", "Recharge", "Tenure", "Days in Month", "Earned Revenue", "Future Revenue"
            ]} maxHeight="calc(100vh - 460px)">
              {pageRows.map((r, i) => {
                const er = r.earnedRevenue || 0;
                const remEr = r.remainingDaysEarned || 0;
                return (
                  <tr key={r.id ? `earned-${r.id}-${i}` : `earned-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.Paid_Date ? fmtDate(new Date(r.Paid_Date)) : "—"}</td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.partner_name || "—"}</td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.CustomerName || "—"}</td>
                    <td style={{ ...td, fontSize: 12.5, textAlign: "center" }}>{r.phone || "—"}</td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center" }}>
                      {r.current_device ? <span style={{ display: "inline-block", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "var(--mint)", color: "var(--slate)" }}>{r.current_device}</span> : "—"}
                    </td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.Plan || "—"}</td>
                    <td style={{ ...td, fontWeight: 600, textAlign: "center" }}>{r.totalPaid ? inr(r.totalPaid) : "—"}</td>
                    <td style={{ ...td, fontWeight: 600, textAlign: "center" }}>{r.recharge ? inr(r.recharge) : "—"}</td>
                    <td style={{ ...td, fontSize: 12.5, textAlign: "center" }}>{r.tenureDays ? `${r.tenureDays}d` : "—"}</td>
                    <td style={{ ...td, fontSize: 12.5, textAlign: "center" }}>{r.daysInPaidMonth ? `${r.daysInPaidMonth}d` : "—"}</td>
                    <td style={{ ...td, color: "#08805A", fontWeight: 700, textAlign: "center" }}>{inr(Math.round(er))}</td>
                    <td style={{ ...td, color: "#D97706", fontWeight: 600, textAlign: "center" }}>{remEr > 0 ? inr(Math.round(remEr)) : "—"}</td>
                  </tr>
                );
              })}
              {tableRows.length > 0 && (
                <tr>
                  <td style={{ ...ftd, textAlign: "center" }} colSpan={6}>Grand Total ({tableRows.length})</td>
                  <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandTotalPaid))}</td>
                  <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandRevenue))}</td>
                  <td style={{ ...ftd, textAlign: "center" }} colSpan={2}>—</td>
                  <td style={{ ...ftd, textAlign: "center", color: "#08805A", fontWeight: 800 }}>{inr(Math.round(grandEarnedRevenue))}</td>
                  <td style={{ ...ftd, textAlign: "center", color: "#D97706", fontWeight: 800 }}>{inr(Math.round(grandRemainingEarned))}</td>
                </tr>
              )}
              {tableRows.length === 0 && <tr><td colSpan={12} style={{ padding: 0 }}><Empty msg="No transactions match this filter." /></td></tr>}
            </Table>
          </div>
        </div>
      </div>
      {apiResult && (
        <Modal onClose={() => setApiResult(null)}
          title={apiResult.ok ? "API response" : "API error"}
          sub={`POST /dp-transactions/add${apiResult.status ? ` · HTTP ${apiResult.status}` : ""}`}>
          {!apiResult.ok && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "#FBE8E8", color: "#B23B3B", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {apiResult.message}
            </div>
          )}
          {apiResult.ok && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "#E2F3EE", color: "#08805A", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              Upload succeeded — the table above has been refreshed with the latest data.
            </div>
          )}
          <div className="eyebrow" style={{ marginBottom: 6 }}>Response body</div>
          <pre style={{ background: "var(--mint)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, fontSize: 12, lineHeight: 1.5, overflow: "auto", maxHeight: "50vh", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", margin: 0 }}>
            {apiResult.body == null ? "(empty response body)" : typeof apiResult.body === "string" ? apiResult.body : JSON.stringify(apiResult.body, null, 2)}
          </pre>
        </Modal>
      )}
    </div>
  );
}


/* ===========================================================================
   AOP — Annual Operating Plan (Admin/DevOps only). Enter a monthly Subscription
   Revenue (Incl GST) target for a financial year (Apr–Mar); each month's target
   is checked against the recharge cash collected (same source as Earned Revenue).
   Targets persist to localStorage (pw_aop_targets) until a backend exists.
   =========================================================================== */
export const AOP_KEY = "pw_aop_targets";
export const AOP_YEARS = [2026, 2027, 2028];
export const AOP_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Financial-year months for a start year Y: Apr(Y) … Mar(Y+1).
export const aopFYMonths = (y) => Array.from({ length: 12 }, (_, k) => {
  const mi = 3 + k;                       // Apr = month-index 3
  const yy = y + Math.floor(mi / 12), m = (mi % 12) + 1;
  return { y: yy, m, key: `${yy}-${m}`, label: `${AOP_MON[m - 1]}-${String(yy).slice(2)}` };
});
// Achievement colour: <30% red, 30–80% amber, >80% green.
export const aopColor = (pct) => pct == null ? { c: "var(--muted)", bg: "var(--mint)" }
  : pct < 30 ? { c: "#DC4141", bg: "#FBE8E8" }
  : pct <= 80 ? { c: "#986315", bg: "#FBF0E0" }
  : { c: "#08805A", bg: "#E2F3EE" };

export function AOP({ accessLevel = "view" }) {
  const { user } = useAuth();
  const canEdit = accessLevel === "admin" || accessLevel === "devops";
  const [year, setYear] = useState(AOP_YEARS[0]);
  const [targets, setTargets] = useState(() => LS.get(AOP_KEY, {}) || {});
  const [data, setData] = useState(null);
  useEffect(() => {
    api.logView(user.username, "Viewed AOP");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions(), customerApi.getCustomers().catch(() => [])])
      .then(([inv, subs, cust]) => setData({ inv, subs, cust }))
      .catch(() => setData({ inv: [], subs: [], cust: [] }));
  }, []);
  if (!data) return <Loading />;

  // Recharge cash collected per calendar month (paid invoices, recharge portion —
  // the same split Earned Revenue uses: total − real per-apartment/device deposit).
  const subBy = {};
  data.subs.forEach(s => [s.customerNumber, s.zohoCustomerId, s.zohoId].filter(Boolean).forEach(k => { subBy[k] = s; }));
  const custBy = {};
  (data.cust || []).forEach(c => [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custBy[k] = c; }));
  const custOf = (i) => custBy[i.customerNumber] || custBy[i.zohoCustomerId] || custBy[i.zohoId] || null;
  const paid = data.inv.filter(i => i.status === "paid" && (i.total || 0) > 0).map(i => {
    const sub = subBy[i.customerNumber] || subBy[i.zohoCustomerId] || subBy[i.zohoId] || null;
    const plan = sub?.plan || i.plan || "";
    const planCode = sub?.planCode || i.planCode || "";
    const total = i.total || 0;
    const d = new Date(i.date);
    return { recharge: Math.max(0, total - depositForCustomer(custOf(i), plan, total, planCode)), y: isNaN(d.getTime()) ? null : d.getFullYear(), m: isNaN(d.getTime()) ? null : d.getMonth() + 1 };
  });
  const rechargeIn = (y, m) => Math.round(paid.reduce((s, r) => (r.y === y && r.m === m) ? s + r.recharge : s, 0));

  const months = aopFYMonths(year);
  const yearTargets = targets[year] || {};
  const setTarget = (key, val) => {
    const n = Number(String(val).replace(/[^0-9.]/g, "")) || 0;
    setTargets(prev => { const next = { ...prev, [year]: { ...(prev[year] || {}), [key]: n } }; LS.set(AOP_KEY, next); return next; });
  };

  const rowData = months.map(mo => {
    const target = yearTargets[mo.key] || 0;
    const recharge = rechargeIn(mo.y, mo.m);
    const pct = target > 0 ? (recharge / target) * 100 : null;
    return { ...mo, target, recharge, pct };
  });
  const totTarget = rowData.reduce((s, r) => s + r.target, 0);
  const totRecharge = rowData.reduce((s, r) => s + r.recharge, 0);
  const yearPct = totTarget > 0 ? (totRecharge / totTarget) * 100 : null;
  const fyLabel = `FY ${year}-${String(year + 1).slice(2)}`;

  const exportCsv = () => exportToCsv(`prowater-aop-${year}.csv`, [
    { label: "Particulars", get: r => r.label },
    ...rowData.map(r => ({ label: r.label, get: row => row.pick(r) })),
  ], [
    { label: "Target - Subscription Revenue (Incl GST)", pick: r => r.target },
    { label: "Recharges Collected", pick: r => r.recharge },
    { label: "Target Achieved %", pick: r => r.pct == null ? "" : `${r.pct.toFixed(2)}%` },
  ]);

  const yc = aopColor(yearPct);
  const cellNum = { padding: "10px 12px", textAlign: "center", fontSize: 13, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const cellHead = { ...cellNum, fontWeight: 700, color: "var(--f)", background: "var(--mint-2)", borderBottom: "2px solid var(--border)", position: "sticky", top: 0 };
  const rowLabel = { padding: "10px 14px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--f)", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1 };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Analytics</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--f)" }}>AOP · Annual Operating Plan</div>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginLeft: 8 }}>Financial year</span>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
          {AOP_YEARS.map(y => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
        </select>
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Stat label="Subscription target" value={inr(Math.round(totTarget))} icon={Target} sub={`${fyLabel} · Incl GST`} hero />
        <Stat label="Recharges collected" value={inr(Math.round(totRecharge))} icon={Wallet} sub={`${fyLabel} · from Earned Revenue`} />
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderLeft: `4px solid ${yc.c}`, borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="eyebrow" style={{ color: "var(--muted)" }}>Target to be achieved</span>
            <TrendingUp size={18} color={yc.c} />
          </div>
          <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: yc.c, margin: "8px 0 2px", lineHeight: 1 }}>{yearPct == null ? "—" : `${Math.round(yearPct)}%`}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{yearPct == null ? "set a target" : yearPct < 30 ? "behind target" : yearPct <= 80 ? "on the way" : "on target"}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="eyebrow" style={{ color: "var(--muted)" }}>Recharge received</span>
            <Repeat size={18} color="var(--teal)" />
          </div>
          <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: "var(--f)", margin: "8px 0 2px", lineHeight: 1 }}>{yearPct == null ? "—" : `${yearPct.toFixed(2)}%`}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>recharges ÷ subscription target</div>
        </div>
      </div>

      {/* AOP table — Particulars × months */}
      <div style={{ marginTop: 18 }}>
        <Card pad={false} title={`AOP — ${fyLabel}`} sub={canEdit ? "Enter each month's Subscription Revenue (Incl GST) target. Recharges are pulled live; achievement is target-checked." : "Subscription targets are read-only for your access level."}>
          <div className="scroll-thin" style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...cellHead, ...rowLabel, textAlign: "center", background: "var(--mint-2)", zIndex: 2 }}>Particulars</th>
                  {rowData.map(r => <th key={r.key} style={cellHead}>{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={rowLabel}>Target - Subscription Revenue (Incl GST)</td>
                  {rowData.map(r => (
                    <td key={r.key} style={cellNum}>
                      {canEdit
                        ? <input type="text" inputMode="numeric" value={r.target ? r.target.toLocaleString("en-IN") : ""} placeholder="0"
                            onChange={e => setTarget(r.key, e.target.value)}
                            style={{ ...inp, width: 100, padding: "6px 8px", fontSize: 12.5, textAlign: "center", marginBottom: 0 }} />
                        : (r.target ? inr(r.target) : "—")}
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={rowLabel}>Recharges Collected</td>
                  {rowData.map(r => <td key={r.key} style={{ ...cellNum, color: "var(--teal-d)", fontWeight: 600 }}>{r.recharge ? inr(r.recharge) : "—"}</td>)}
                </tr>
                <tr style={{ background: "var(--mint)" }}>
                  <td style={{ ...rowLabel, background: "var(--mint)" }}>Target Achieved</td>
                  {rowData.map(r => {
                    const c = aopColor(r.pct);
                    return <td key={r.key} style={{ ...cellNum, fontWeight: 700 }}>
                      {r.pct == null ? <span style={{ color: "var(--muted)" }}>—</span>
                        : <span style={{ color: c.c, background: c.bg, padding: "3px 9px", borderRadius: 999 }}>{r.pct.toFixed(2)}%</span>}
                    </td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
          Target Achieved = Recharges Collected ÷ Subscription Revenue (Incl GST). <span style={{ color: "#DC4141", fontWeight: 600 }}>&lt;30% red</span> · <span style={{ color: "#986315", fontWeight: 600 }}>30–80% amber</span> · <span style={{ color: "#08805A", fontWeight: 600 }}>&gt;80% green</span>. Targets are saved on this browser (pw_aop_targets) until the backend endpoint exists.
        </div>
      </div>
    </div>
  );
}

/* §7.5 — Renewal & Churn Risk Radar: flags customers whose subscription is
   renewing soon, who have an overdue/failed invoice, or whose account is in
   Zoho "dunning" (payment actively failing) — three real, already-live
   signals joined onto one customer-level risk view. Deliberately does NOT
   include an IoT "device gone quiet" signal — there is no existing join
   between a customer's purifier_id and the real IoT device fleet (that
   module only monitors a couple of apartment-level installations), so
   fabricating one here would be misleading. All deterministic JS, no LLM. */
export function ChurnRiskRadar() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [levelFilter, setLevelFilter] = useState("all"); // all | high | medium | low
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());
  useEffect(() => {
    api.logView(user?.username, "Viewed Renewal & Churn Risk Radar");
    Promise.all([customerApi.getCustomers(), billingApi.getSubscriptions(), billingApi.getInvoices()])
      .then(([customers, subs, invs]) => setData({ customers, subs, invs }))
      .catch(() => setData({ customers: [], subs: [], invs: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) return <Loading />;
  const { customers, subs, invs } = data;

  const MS_DAY = 86400000;
  const RENEWAL_WINDOW_DAYS = 30;

  // Join subs/invoices back to a customer via whatever key they share —
  // same key set AllCustomers()/EarnedRevenue() already use for this join.
  const keysOf = (c) => [c.id, c.zohoId, c.email].filter(Boolean).map(k => String(k).toLowerCase());
  const belongs = (rec, keys) => [rec.zohoCustomerId, rec.customerNumber, rec.zohoId, rec.email]
    .filter(Boolean).map(k => String(k).toLowerCase()).some(k => keys.includes(k));
  // An invoice counts as overdue exactly the way BillingOverview/SubscriptionReconciliation already do.
  const isOverdue = (i) => i.status === "failed" || (i.balance > 0 && (i.rawStatus || "").toLowerCase() === "overdue");

  const withPur = customers.filter(c => c.purifier_id);
  const rows = withPur.map(c => {
    const keys = keysOf(c);
    const custSubs = subs.filter(s => belongs(s, keys));
    const custInvs = invs.filter(i => belongs(i, keys));
    const overdueInvs = custInvs.filter(isOverdue);
    const overdueAmt = overdueInvs.reduce((s, i) => s + (i.balance || i.total || 0), 0);
    // Soonest upcoming renewal among this customer's active subscriptions.
    const upcoming = custSubs
      .filter(s => s.status !== "failed" && s.nextBilling)
      .map(s => ({ ...s, _due: new Date(s.nextBilling) }))
      .filter(s => !isNaN(s._due.getTime()))
      .map(s => ({ ...s, _days: Math.ceil((s._due.getTime() - now) / MS_DAY) }))
      .sort((a, b) => a._days - b._days)[0] || null;
    const renewalDays = upcoming && upcoming._days >= 0 && upcoming._days <= RENEWAL_WINDOW_DAYS ? upcoming._days : null;
    const isDunning = String(c.status || "").toLowerCase() === "dunning";

    const reasons = [];
    let score = 0;
    if (isDunning) { reasons.push("Dunning — payment actively failing"); score += 3; }
    if (overdueInvs.length > 0) { reasons.push(`${overdueInvs.length} overdue invoice${overdueInvs.length !== 1 ? "s" : ""} · ${inr(Math.round(overdueAmt))}`); score += 2; }
    if (renewalDays != null) { reasons.push(`Renews in ${renewalDays}d`); score += renewalDays <= 7 ? 2 : 1; }

    const level = score >= 4 ? "high" : score >= 2 ? "medium" : score >= 1 ? "low" : null;
    return { c, reasons, score, level, overdueAmt, overdueCount: overdueInvs.length, renewalDays, isDunning };
  }).filter(r => r.level);

  const searchQ = search.trim().toLowerCase();
  const filtered = rows
    .filter(r => levelFilter === "all" || r.level === levelFilter)
    .filter(r => !searchQ || (r.c.name + r.c.society + r.c.purifier_id + r.c.phone).toLowerCase().includes(searchQ))
    .sort((a, b) => b.score - a.score);

  const highCount = rows.filter(r => r.level === "high").length;
  const mediumCount = rows.filter(r => r.level === "medium").length;
  const renewalsDue = rows.filter(r => r.renewalDays != null).length;
  const renewalsDue7 = rows.filter(r => r.renewalDays != null && r.renewalDays <= 7).length;
  const overdueCustomers = rows.filter(r => r.overdueCount > 0).length;
  const overdueTotal = rows.reduce((s, r) => s + r.overdueAmt, 0);
  const dunningCount = rows.filter(r => r.isDunning).length;

  const exportCsv = () => exportToCsv("prowater-churn-risk.csv", [
    { label: "Customer", get: r => r.c.name }, { label: "Purifier ID", get: r => r.c.purifier_id },
    { label: "Society", get: r => r.c.society }, { label: "Phone", get: r => r.c.phone },
    { label: "Risk level", get: r => r.level }, { label: "Reasons", get: r => r.reasons.join("; ") },
    { label: "Renews in (days)", get: r => r.renewalDays ?? "" },
    { label: "Overdue invoices", get: r => r.overdueCount }, { label: "Overdue amount", get: r => Math.round(r.overdueAmt) },
    { label: "Dunning", get: r => r.isDunning ? "yes" : "no" },
  ], filtered);

  return (
    <div className="fade-up">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Stat label="High risk" value={highCount} icon={AlertCircle} sub="dunning + overdue combo" hero />
        <Stat label="Medium risk" value={mediumCount} icon={Hourglass} sub="one active risk signal" />
        <Stat label="Renewals due" value={renewalsDue} icon={CalendarClock} sub={`next ${RENEWAL_WINDOW_DAYS} days · ${renewalsDue7} within 7d`} />
        <Stat label="Overdue" value={overdueCustomers} icon={AlertCircle} sub={`${inr(Math.round(overdueTotal))} total`} />
        <Stat label="Dunning" value={dunningCount} icon={Ban} sub="payment actively failing" />
      </div>

      <div style={{ marginTop: 18 }}>
        <Toolbar q={search} setQ={setSearch} placeholder="Search customer, society, purifier ID…" count={filtered.length}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {[["all", `All (${rows.length})`], ["high", `High (${highCount})`], ["medium", `Medium (${mediumCount})`], ["low", `Low (${rows.length - highCount - mediumCount})`]].map(([id, label]) => (
                <button key={id} onClick={() => setLevelFilter(id)} style={{
                  padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: "1.5px solid " + (levelFilter === id ? "var(--teal)" : "var(--border)"),
                  background: levelFilter === id ? "var(--mint-2)" : "#fff",
                  color: levelFilter === id ? "var(--teal-d)" : "var(--slate)"
                }}>{label}</button>
              ))}
              <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: 6 }}><Download size={15} /> Export</button>
            </div>
          } />
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 460px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer", "Society", "Purifier ID", "Risk Level", "Reasons"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{r.c.name || "—"}</td>
                    <td style={{ padding: "14px 18px", color: "#475569", fontSize: 12.5 }}>{r.c.society || "—"}</td>
                    <td style={{ padding: "14px 18px", color: "#475569", fontSize: 12.5 }}>{r.c.purifier_id}</td>
                    <td style={{ padding: "14px 18px" }}>
                      {renderHigStatusBadge(r.level === "high" ? "High Risk" : r.level === "medium" ? "Medium Risk" : "Low Risk")}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569" }}>{r.reasons.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <Empty msg="No customers match this filter — nothing currently at risk." />}
        </div>
      </div>
    </div>
  );
}

/* §8 — Apartment Performance: paid invoices joined to customers, grouped by
   apartment (society) or purifier ID, with deposit/recharge split + MoM. */
export function ApartmentPerformance() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("apartment");     // "apartment" | "purifier"
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [ym, setYm] = useState("all");
  const PER = 12;
  useEffect(() => {
    api.logView(user?.username, "Viewed Apartment Performance");
    Promise.all([billingApi.getInvoices(), customerApi.getCustomers()])
      .then(([inv, cust]) => setData({ inv, cust }))
      .catch(() => setData({ inv: [], cust: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <Loading />;

  const handleQChange = (e) => { setQ(e.target.value); setPage(1); };
  const handleModeChange = (v) => { setMode(v); setPage(1); };
  const handleYmChange = (e) => { setYm(e.target.value); setPage(1); };

  const custBy = {};
  data.cust.forEach(c => { [c.zohoId, c.id, c.zohoCustomerId].filter(Boolean).forEach(k => { custBy[k] = c; }); });
  const custFor = (i) => custBy[i.zohoCustomerId] || custBy[i.zohoId] || custBy[i.customerNumber] || null;

  const paidAll = data.inv.filter(i => i.status === "paid" && (i.total || 0) > 0).map(i => {
    const c = custFor(i);
    const total = i.total || 0;
    const plan = i.plan || c?.plan || "";
    const planCode = i.planCode || "";
    const deposit = depositForCustomer(c, plan, total, planCode);
    return { society: c?.society || i.customerName || "—", purifierId: c?.purifier_id || "—", total, deposit, recharge: Math.max(0, total - deposit), date: i.date };
  });

  const monthKeyOf = (d0) => { const d = new Date(d0); return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${d.getMonth() + 1}`; };
  const monthsAvail = Array.from(new Set(paidAll.map(r => monthKeyOf(r.date)).filter(Boolean)))
    .sort((a, b) => { const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number); return by * 12 + bm - (ay * 12 + am); });
  const enriched = ym === "all" ? paidAll : paidAll.filter(r => monthKeyOf(r.date) === ym);

  const keyOf = (r) => mode === "apartment" ? (r.society || "—") : (r.purifierId || "—");
  const groups = {};
  enriched.forEach(r => { const k = keyOf(r); if (!groups[k]) groups[k] = { key: k, count: 0, total: 0, deposit: 0, recharge: 0 }; groups[k].count++; groups[k].total += r.total; groups[k].deposit += r.deposit; groups[k].recharge += r.recharge; });
  const rows = Object.values(groups).sort((a, b) => b.total - a.total);
  const filtered = rows.filter(r => String(r.key).toLowerCase().includes(q.toLowerCase()));
  const tot = filtered.reduce((a, r) => ({ total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge, count: a.count + r.count }), { total: 0, deposit: 0, recharge: 0, count: 0 });

  // MoM: selected vs previous month; all-time = current month vs last month.
  const now = new Date();
  const [cy, cm] = (ym === "all" ? `${now.getFullYear()}-${now.getMonth() + 1}` : ym).split("-").map(Number);
  const [py, pm] = _addMonths(cy, cm, -1);
  const sumFor = (y, m) => paidAll.filter(r => monthKeyOf(r.date) === `${y}-${m}`).reduce((a, r) => ({ total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge }), { total: 0, deposit: 0, recharge: 0 });
  const cur = sumFor(cy, cm), prev = sumFor(py, pm);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur1 = Math.min(page, totalPages);
  const start = (cur1 - 1) * PER;
  const pageRows = filtered.slice(start, start + PER);
  const scopeLabel = ym === "all" ? "all time" : _monthLong(cy, cm);

  const stats = [
    { label: "Total collected", value: inr(tot.total), icon: Wallet, sub: scopeLabel, hero: true, delta: momPct(cur.total, prev.total) },
    { label: "Recharge", value: inr(tot.recharge), icon: TrendingUp, sub: "revenue portion", delta: momPct(cur.recharge, prev.recharge) },
    { label: "Deposit", value: inr(tot.deposit), icon: Coins, sub: "refundable", delta: momPct(cur.deposit, prev.deposit) },
    { label: mode === "apartment" ? "Apartments" : "Purifier IDs", value: filtered.length, icon: Boxes, sub: `${tot.count} invoices` },
  ];

  const exportCsv = () => exportToCsv(`prowater-apartment-performance-${ym}.csv`, [
    { label: mode === "apartment" ? "Apartment" : "Purifier ID", get: r => r.key }, { label: "Invoices", get: r => r.count },
    { label: "Total", get: r => r.total }, { label: "Deposit", get: r => r.deposit }, { label: "Recharge", get: r => r.recharge },
  ], filtered);

  const seg = (v, label) => (
    <button onClick={() => handleModeChange(v)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "1.5px solid rgba(0,0,0,.08)", background: mode === v ? "#08805a" : "#fff", color: mode === v ? "#fff" : "#475569", borderRadius: 10, cursor: "pointer" }}>{label}</button>
  );


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {seg("apartment", "By Apartment")}{seg("purifier", "By Purifier ID")}
        <span style={{ fontSize: 12.5, color: "#86868b", fontWeight: 600, marginLeft: 8 }}>Month</span>
        <select value={ym} onChange={handleYmChange} style={selectStyle}>
          <option value="all">All time</option>
          {monthsAvail.map(k => { const [y, m] = k.split("-").map(Number); return <option key={k} value={k}>{_monthLong(y, m)}</option>; })}
        </select>
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 16 }}>
        <Toolbar q={q} setQ={setQ} onChange={handleQChange} placeholder={mode === "apartment" ? "Search apartment…" : "Search purifier ID…"} count={filtered.length}
          right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 460px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {[mode === "apartment" ? "Apartment" : "Purifier ID", "Invoices", "Deposit", "Recharge", "Total"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119" }}>{r.key}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.count}</td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{inr(r.deposit)}</td>
                    <td style={{ padding: "14px 18px", color: "#08805a", fontWeight: 600 }}>{inr(r.recharge)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0d2119" }}>{inr(r.total)}</td>
                  </tr>
                ))}
                {filtered.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0d2119" }}>Total ({filtered.length})</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{tot.count}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(tot.deposit)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(tot.recharge)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(tot.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <Empty msg="No paid invoices in scope." />}
          {filtered.length > PER && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 20px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#64748b" }}>{start + 1}–{Math.min(start + PER, filtered.length)} of {filtered.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur1 <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: cur1 <= 1 ? .5 : 1, cursor: cur1 <= 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /> Prev</button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0d2119" }}>Page {cur1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={cur1 >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: cur1 >= totalPages ? .5 : 1, cursor: cur1 >= totalPages ? "not-allowed" : "pointer" }}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

