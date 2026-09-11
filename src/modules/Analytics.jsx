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
  Droplets, ExternalLink, GitBranch, Hourglass, Info, Landmark, PlayCircle, Receipt,
  RefreshCw, Repeat, RotateCcw, Scale, ScrollText, Search, Target, Ticket,
  TrendingUp, Upload, Users, Wallet, X, Cpu, Clock, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  ComposedChart, Line, ReferenceLine, ReferenceArea, LineChart,
} from "recharts";
import {
  useAuth, api, apartmentApi, billingApi, creditNoteApi, customerApi,
  authHeaders, API_ORIGIN, LS, PRESET_UNIT, dateInRange, depositForCustomer, SEED_PLANS,
  dmy, endOfDay, exportToCsv, fetchAllDpTransactions, fmtDate, fmtPhone,
  fmtTime, inr, isoDay, isRealSociety, canonicalSociety, canonicalStatus, keyLc, markSample, momPct, monthEnd, monthlyOf,
  parseFlexDate, presetLabel, prevRange, rangeFilter, rangeLabel,
  startOfDay, termMonths, ticketApi, useDateRange, yoyRange, zdIsClosed,
  bucketKeyOf, bucketsFor, CHART_PALETTE, AOP_MON, titleCaseName,
  planInfo, PLAN_CATALOG,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, TT, WowMomTT, Modal, Drawer,
  Field, Chip, Status, Person, SortHeader, DateRangePicker, DateRangeFilter,
  MultiSelectFilter, renderPieLabel, pieLabelLine, GsTextCell,
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
    bg = "rgba(196, 229, 56,0.12)";
    color = "#C4E538";
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

export const cleanAptName = (n) => {
  if (!n) return "";
  let s = canonicalSociety(n);
  s = s.replace(/^cro[_\s]+/i, ""); // strip leading "CRO_" or "CRO "
  s = s.replace(/\s*\[[^\]]+\]/g, ""); // strip trailing brackets like "[ Thubarahalli ]"
  return canonicalSociety(s.trim());
};

export function AnalyticsOverview({ isAdmin = false, combined = false }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [, setFlatsTick] = useState(0);   // re-render after a Total-Flats edit
  const { sel, setSel, range } = useDateRange("this_month");   // working date filter
  const [selSoc, setSelSoc] = useState(null);                  // society filter (null = all)
  // Customer Stack filter (v2.29.387, per explicit user request: "add in
  // the filters as Stack for DP and Zoho") — null = both; else an array
  // containing "DP" and/or "Zoho", same convention as Customer.jsx's own
  // `stackFilter`/Customer Stack `MultiSelectFilter`.
  const [selStack, setSelStack] = useState(null);
  const [selSource, setSelSource] = useState(null);            // revenue source filter (null = all)
  const [selectedAptDetails, setSelectedAptDetails] = useState(null);
  const [showNewCustPopup, setShowNewCustPopup] = useState(false);
  const [kpiModal, setKpiModal] = useState(null);              // universal KPI / chart drilldown modal
  const [modalQ, setModalQ] = useState("");
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const hasActiveFilters = (sel && sel.preset !== "this_month") || selSoc !== null || selStack !== null || selSource !== null;
  const handleResetFilters = () => {
    setSel({ preset: "this_month" });
    setSelSoc(null);
    setSelStack(null);
    setSelSource(null);
    flash("All filters reset to default");
  };
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
      combined ? fetchAllDpTransactions().catch(() => []) : Promise.resolve({ rows: [] }),
    ])
      .then(([customers, subs, invs, referrers, tickets, apartments, dpResult]) =>
        setData({ customers, subs, invs, referrers, tickets, apartments, dpRows: dpResult?.rows || [] }))
      .catch(e => setErr(e.message || "Could not load analytics overview."));
  }, [combined]);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Analytics Overview" subtitle="Synchronizing cross-module performance data…" />;

  const { customers, subs, invs, referrers, tickets, apartments, dpRows } = data;
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const now = new Date();
  // MTD-aware previous-period window (v2.29.389) — boss ask: "This Month"
  // was comparing month-to-date collections (there's no future data yet, so
  // the "current month" total is really just MTD) against the FULL previous
  // month — e.g. on 10 Sep that's "1–10 Sep" vs all of "1–31 Aug", which
  // unfairly makes the current month look worse purely because it's being
  // measured against more days than it has actually had a chance to collect
  // in. When "This Month" is the selected preset, cap the previous month's
  // comparison window at the same day-of-month as today, so every KPI
  // card's delta on this page is a true MTD-vs-MTD comparison (1–10 Sep vs
  // 1–10 Aug) instead of MTD-vs-full-month. Every other preset (Previous
  // Month, This Quarter, custom ranges, etc.) is untouched — `prev` is
  // exactly `prevRange(sel.preset, range)`, same as before this change.
  const prevFull = prevRange(sel.preset, range);
  const prev = sel.preset !== "this_month" ? prevFull : {
    from: prevFull.from,
    to: new Date(prevFull.from.getFullYear(), prevFull.from.getMonth(),
      Math.min(now.getDate(), new Date(prevFull.from.getFullYear(), prevFull.from.getMonth() + 1, 0).getDate()),
      23, 59, 59, 999),
  };                                                            // like-for-like comparison window
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
  const societyOf = (rec) => canonicalSociety(custOf(rec)?.society || rec.society || "Unknown");
  const allSocieties = [...new Set(customers.map(c => canonicalSociety(c.society)).filter(Boolean))].sort();
  const socOk = (name) => {
    if (selSoc === null) return isRealSociety(name);
    return selSoc.includes(name);
  };
  // Customer Stack filter (v2.29.387) — gates the two underlying data
  // populations (`fInvs`/`fSubs` for Zoho, `dpTxns` for DP) so every figure
  // built on top of them (KPI strip, Revenue by Source, Combined Monthly
  // Collection, Plan Tier Distribution, etc.) is automatically scoped with
  // no further plumbing, same pattern as the Society fix at v2.29.386.
  const stackOk = (s) => selStack === null || selStack.includes(s);

  // ---- society + stack-filtered base sets -----------------------------------
  // Invoices are a Zoho-only concept (DP has no invoices — see `dpTxns`
  // below), so the whole population is gated by `stackOk("Zoho")` at once.
  const fInvs = stackOk("Zoho") ? invs.filter(i => socOk(societyOf(i))) : [];
  const fCustomers = customers.filter(c => c.purifier_id && socOk(c.society || "Unknown") && stackOk(c.isDpCustomer ? "DP" : "Zoho"));
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

  const activeCustomers = fCustomers.filter(c => !c.isDpCustomer && String(c.status || "").toLowerCase() === "active").length;

  // All signups aligned with Penetration Tracker (subscriptions createdAt/activatedAt + customer since dates)
  const allSignupMap = new Map();

  // 1. Subscriptions (Zoho subscription sign-ups — identical to Penetration Tracker)
  (subs || []).forEach(s => {
    const soc = societyOf(s);
    const d = parseFlexDate(s.createdAt || s.activatedAt);
    if (soc && soc !== "Unknown" && d && socOk(soc)) {
      const c = custOf(s);
      const name = s.customerName || s.customer_name || s.name || c?.name || "Zoho Customer";
      const phone = c?.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : (s.phone ? String(s.phone).replace(/\D/g, "").slice(-10) : "—");
      const purifierId = c?.purifier_id || s.purifierId || s.purifier_id || "—";
      const key = `sub_${s.id || s.zohoCustomerId || s.customerNumber || Math.random()}_${d.getTime()}`;
      allSignupMap.set(key, { name, phone, purifierId, society: soc, since: d, isDp: false });
    }
  });

  // 2. Customers (handles customer profile creation dates and DrinkPrime customers)
  (customers || []).forEach(c => {
    const soc = canonicalSociety(c.society || "Unknown");
    const d = parseFlexDate(c.since);
    if (soc && soc !== "Unknown" && d && socOk(soc)) {
      const name = c.name || (c.isDpCustomer ? "DrinkPrime Customer" : "Zoho Customer");
      const phone = c.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : "—";
      const purifierId = c.purifier_id || "—";
      const key = c.isDpCustomer ? `dp_${c.id || c.purifier_id || Math.random()}` : `cust_${c.zohoId || c.id || Math.random()}`;
      if (!allSignupMap.has(key)) {
        allSignupMap.set(key, { name, phone, purifierId, society: soc, since: d, isDp: !!c.isDpCustomer });
      }
    }
  });

  const allSignups = Array.from(allSignupMap.values());

  const zohoNewCur = allSignups.filter(x => !x.isDp && x.since >= range.from && x.since <= range.to).length;
  const zohoNewPrev = allSignups.filter(x => !x.isDp && x.since >= prev.from && x.since <= prev.to).length;
  const dpNewCur = allSignups.filter(x => x.isDp && x.since >= range.from && x.since <= range.to).length;
  const dpNewPrev = allSignups.filter(x => x.isDp && x.since >= prev.from && x.since <= prev.to).length;
  const newThisMonth = zohoNewCur + dpNewCur;
  const newPrev = zohoNewPrev + dpNewPrev;

  // Group new customer additions in current period by apartment for hover breakdown
  const newCustsByApt = {};
  allSignups
    .filter(x => x.since >= range.from && x.since <= range.to)
    .forEach(x => {
      const soc = cleanAptName(x.society);
      if (!soc || !isRealSociety(soc)) return;
      if (!newCustsByApt[soc]) {
        newCustsByApt[soc] = { name: soc, total: 0, zoho: 0, dp: 0 };
      }
      newCustsByApt[soc].total += 1;
      if (x.isDp) newCustsByApt[soc].dp += 1;
      else newCustsByApt[soc].zoho += 1;
    });
  const newCustsAptBreakdown = Object.values(newCustsByApt)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
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
  // `payers` tracks each month's distinct PAYING customers (not rendered
  // directly — only used to derive `.arpu` below), so ARPU can be trended
  // per month on Forecast vs Actual / MoM Revenue Growth, per explicit user
  // request ("add Average ARPU in the KPI card and add it in analytics
  // Total revenue versus expected revenue, MoM Growth Trend" — on Overview
  // V2, not the Billing tab, per an explicit follow-up correction).
  for (let k = 6; k >= 0; k--) { const d = new Date(curY, curM - k, 1); m7.push({ y: d.getFullYear(), m: d.getMonth(), collected: 0, billed: 0, deposits: 0, earned: 0, newC: 0, recv: 0, payers: new Set() }); }
  const find7 = (y, m) => m7.find(x => x.y === y && x.m === m);
  fInvs.forEach(i => {
    if (!i.date) return; const d = new Date(i.date); if (isNaN(d)) return;
    const s = find7(d.getFullYear(), d.getMonth()); if (!s) return;
    s.billed += i.total;
    if (i.status === "paid") {
      s.collected += i.total; s.deposits += depositForCustomer(custOf(i), i.plan, i.total, i.planCode); s.earned += earnedOf(i);
      s.payers.add(i.customerNumber || i.zohoCustomerId || i.zohoId || i.email || i.id);
    }
    if ((i.balance || 0) > 0) s.recv += i.balance;
  });
  // Per-month ARPU = that month's collected cash ÷ that month's distinct
  // paying customers.
  m7.forEach(x => { x.arpu = x.payers.size ? Math.round(x.collected / x.payers.size) : 0; });
  fCustomers.forEach(c => { if (!c.since) return; const d = new Date(c.since); if (isNaN(d)) return; const s = find7(d.getFullYear(), d.getMonth()); if (s) s.newC += 1; });
  const refSpark = m7.map(x => fReferrers.filter(r => { const d = new Date(r.joined); return !isNaN(d) && d.getFullYear() === x.y && d.getMonth() === x.m; }).length);
  const spark = {
    revenue: m7.map(x => x.collected), net: m7.map(x => x.collected - x.deposits),
    earned: m7.map(x => x.earned), customers: m7.map(x => x.newC), deposits: m7.map(x => x.deposits),
    collections: m7.map(x => x.collected), billed: m7.map(x => x.billed), arpu: m7.map(x => x.arpu),
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
  // "This Month" now compares MTD-vs-MTD (see `prev` above) — the label spells
  // that out as "vs 10 Aug" (the as-of date the previous month is capped at),
  // rather than the old "vs Aug" (which read as a full-month comparison and
  // is no longer what's being computed).
  const vsPrev = "vs " + (
    sel.preset === "this_month" ? `${now.getDate()} ${monthShort(prev.from.getFullYear(), prev.from.getMonth())}`
    : PRESET_UNIT[sel.preset] === "month" ? monthYr(prev.from.getFullYear(), prev.from.getMonth())
    : "prev period"
  );
  // Average ARPU (v2.29.382) — collections this period ÷ active customers as
  // of the period end, per explicit user request ("add Average ARPU in the
  // KPI card... on Overview V2, not Billing"). Same formula the pre-existing
  // "ARPU (Per Customer)" figure in the ARR & Unit Economics strip below
  // already uses (`arpuVal`, computed later in this function) — duplicated
  // here rather than reordering that code, since `collections`/`pcNow` are
  // both already available at this point in the function.
  const arpuNow = pcNow > 0 ? Math.round(collections / pcNow) : 0;
  const arpuPrev = pcPrev > 0 ? Math.round(collectionsPrev / pcPrev) : 0;
  const kpis = [
    { label: "Total Collection", value: inr(collections), delta: pct(collections, collectionsPrev), icon: Coins, color: "#08805A", spark: spark.collections, hero: true },
    { label: "Average ARPU", value: inr(arpuNow), delta: pct(arpuNow, arpuPrev), icon: Target, color: "#08805A", spark: spark.arpu },
    { label: "Earned Revenue", value: inr(earnedRevenue), delta: pct(earnedRevenue, earnedPrev), icon: Scale, color: "#08805A", spark: spark.earned },
    { label: "Recharge collected", value: inr(netRevenue), delta: pct(netRevenue, netPrev), icon: Wallet, color: "#08805A", spark: spark.net },
    { label: "Deposit collected", value: inr(depositCollected), delta: pct(depositCollected, depositPrev), icon: Landmark, color: "#08805A", spark: spark.deposits },
    { label: "Active Customers", value: pcNow.toLocaleString("en-IN"), delta: pct(pcNow, pcPrev), icon: Users, color: "#08805A", spark: penSpark },
    { label: "Active Referrers", value: activeReferrers.toLocaleString("en-IN"), delta: pct(refCur, refPrev), icon: GitBranch, color: "#08805A", spark: refSpark },
  ];

  // ---- Revenue by plan — MRR by plan ----------------------------------------
  // Subscriptions are a Zoho-only concept, same as invoices above.
  const fSubs = !stackOk("Zoho") ? [] : subs.filter(s =>
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
  const faData = fa.map((x, i) => ({ label: monthShort(x.y, x.m), actual: Math.round(x.collected), forecast: Math.max(0, Math.round(intercept + slope * i)), arpu: x.arpu }));
  const nd = new Date(curY, curM + 1, 1);
  faData.push({ label: monthShort(nd.getFullYear(), nd.getMonth()), actual: null, forecast: Math.max(0, Math.round(intercept + slope * n)), arpu: null });

  // ---- Month-on-Month (MoM) collected (trailing 7 months) -----------------
  const momData = m7.map((x, idx) => {
    const p = idx > 0 ? m7[idx - 1].collected : 0;
    const pctChange = p > 0 ? Math.round(((x.collected - p) / p) * 1000) / 10 : null;
    return {
      label: monthShort(x.y, x.m),
      y: x.y,
      m: x.m,
      collected: Math.round(x.collected),
      pct: pctChange,
      arpu: x.arpu
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

  // ──────────────────────────────────────────────────────────────────────────
  // DP + COMBINED ANALYTICS — computed from dpRows (TRANSACTION rows only)
  // ──────────────────────────────────────────────────────────────────────────
  // `socOk(cleanAptName(r.partner_name))` (v2.29.386, real bug fix per
  // explicit user report — "make the KPI cards dynamic... based on
  // selection it should change" — the Society filter at the top of this
  // page was silently doing nothing to any DP-derived figure): every OTHER
  // society-scoped set on this page (`fInvs`/`fCustomers`/`fSubs`) already
  // applies `socOk`, but `dpTxns` never did, so picking a society only ever
  // narrowed the Zoho half of Total Collection/Combined Recharge/Combined
  // Deposit/Revenue by Source/Combined Monthly Collection while every DP
  // figure (DP Recharge/DP Deposit/DP Total Collected, and DP's share of
  // Combined Recharge/Deposit/Total Collection) kept showing every society's
  // DP revenue regardless of the filter. `cleanAptName` already normalizes
  // DP's raw `partner_name` into the same canonical-society space `socOk`
  // expects (it calls `canonicalSociety` internally, same as `societyOf`
  // does for Zoho records) — reused rather than reinvented.
  // DP transactions are a DP-only concept, gated by `stackOk("DP")`
  // (v2.29.387) the same way `fInvs`/`fSubs` above are gated to Zoho.
  const dpTxns = !stackOk("DP") ? [] : (dpRows || []).filter(r => r.row_type === "TRANSACTION" && socOk(cleanAptName(r.partner_name)));

  // Date-slice helper for DP rows (uses Paid_Date)
  const dpInR = (r, rg) => {
    if (!r.Paid_Date) return false;
    const d = new Date(r.Paid_Date);
    return !isNaN(d) && d >= rg.from && d <= rg.to;
  };

  const dpCur = dpTxns.filter(r => dpInR(r, range));
  const dpPrv = dpTxns.filter(r => dpInR(r, prev));

  // Totals for current period
  const dpRechargeCur  = dpCur.reduce((s, r) => s + (Number(r.revenue_amount)  || 0), 0);
  const dpDepositCur   = dpCur.reduce((s, r) => s + (Number(r.deposit_amount)   || 0), 0);
  const dpTotalCur     = dpRechargeCur + dpDepositCur;

  const dpRechargePrv  = dpPrv.reduce((s, r) => s + (Number(r.revenue_amount)  || 0), 0);
  const dpDepositPrv   = dpPrv.reduce((s, r) => s + (Number(r.deposit_amount)   || 0), 0);
  const dpTotalPrv     = dpRechargePrv + dpDepositPrv;

  // Combined (Zoho Billing + DP) revenue for current period
  const combinedRevCur  = collections + dpTotalCur;
  const combinedRevPrv  = collectionsPrev + dpTotalPrv;
  const combinedRechargeCur = netRevenue + dpRechargeCur;
  const combinedDepositCur  = depositCollected + dpDepositCur;

  // Unique DP devices / active customers
  const dpActiveCustomers = fCustomers.filter(c => c.isDpCustomer && String(c.status || "").toLowerCase() === "active" && !String(c.deviceStatus || "").toLowerCase().includes("uninstall")).length;
  const dpUniqueDevices = fCustomers.filter(c => c.isDpCustomer && ["active", "in-active", "dunning"].includes(String(c.status || "").toLowerCase())).length;
  const dpUniqueApts    = new Set(dpTxns.map(r => r.partner_name).filter(Boolean)).size;

  // Combined SaaS metrics
  const totalActiveCustomers = activeCustomers + dpActiveCustomers;
  const totalCombinedCustomers = totalActiveCustomers;
  const arpu = totalCombinedCustomers > 0 ? (combinedRechargeCur / totalCombinedCustomers) : 0;
  const ltv = arpu / 0.015; // 1.5% monthly churn rate

  // DP Apartment-level breakdown (current period)
  const dpAptAgg = {};
  dpCur.forEach(r => {
    const apt = r.partner_name || "Unknown";
    if (!dpAptAgg[apt]) dpAptAgg[apt] = { apt, recharge: 0, deposit: 0, txns: 0, devices: new Set() };
    dpAptAgg[apt].recharge += Number(r.revenue_amount) || 0;
    dpAptAgg[apt].deposit  += Number(r.deposit_amount)  || 0;
    dpAptAgg[apt].txns     += 1;
    if (r.current_device) dpAptAgg[apt].devices.add(r.current_device);
  });
  const dpAptRows = Object.values(dpAptAgg)
    .map(a => ({ ...a, total: a.recharge + a.deposit, devices: a.devices.size }))
    .sort((a, b) => b.total - a.total);

  // Combined Zoho + DP Apartment-level breakdown (current period)
  const combinedAptAgg = {};
  societies.forEach(s => {
    const name = cleanAptName(s.society);
    if (name) {
      combinedAptAgg[name] = {
        name,
        zohoRecharge: 0,
        zohoDeposit: 0,
        dpRecharge: 0,
        dpDeposit: 0,
        totalCollected: 0,
        devices: 0,
        deviceSet: new Set()
      };
    }
  });

  paidCur.forEach(i => {
    const rawSoc = societyOf(i); if (!rawSoc) return;
    const soc = cleanAptName(rawSoc);
    if (!combinedAptAgg[soc]) {
      combinedAptAgg[soc] = {
        name: soc,
        zohoRecharge: 0,
        zohoDeposit: 0,
        dpRecharge: 0,
        dpDeposit: 0,
        totalCollected: 0,
        devices: 0,
        deviceSet: new Set()
      };
    }
    const depVal = depositForCustomer(custOf(i), i.plan, i.total, i.planCode);
    const rechVal = Math.max(0, i.total - depVal);
    combinedAptAgg[soc].zohoRecharge += rechVal;
    combinedAptAgg[soc].zohoDeposit += depVal;
    combinedAptAgg[soc].totalCollected += i.total;
  });

  dpCur.forEach(r => {
    const rawName = r.partner_name || "Unknown";
    const name = cleanAptName(rawName);
    if (!combinedAptAgg[name]) {
      combinedAptAgg[name] = {
        name,
        zohoRecharge: 0,
        zohoDeposit: 0,
        dpRecharge: 0,
        dpDeposit: 0,
        totalCollected: 0,
        devices: 0,
        deviceSet: new Set()
      };
    }
    const rechVal = Number(r.revenue_amount) || 0;
    const depVal = Number(r.deposit_amount) || 0;
    combinedAptAgg[name].dpRecharge += rechVal;
    combinedAptAgg[name].dpDeposit += depVal;
    combinedAptAgg[name].totalCollected += (rechVal + depVal);
    if (r.current_device) {
      combinedAptAgg[name].deviceSet.add(r.current_device);
    }
  });

  // Device-status normalizer (mirrors Customer.jsx's own `normSt`): strips
  // spaces/underscores/hyphens before lowercasing, so "Un-Installed" and
  // "Uninstalled" collapse to the same value instead of being treated as
  // two different device_status strings.
  const normDevSt = (s) => String(s || "").toLowerCase().replace(/[\s_-]+/g, "");

  // Calculate actual unique device sizes and customer counts.
  // Churned/Replaced columns (added v2.29.363, simplified v2.29.366) were removed at
  // v2.29.368 — per explicit user finding, get-all-customers has no timestamp for when
  // device_status last changed, so both this table's counts and a same-day popup
  // breakdown were showing "currently Un-Installed/Replaced, ever" rather than anything
  // scoped to the selected date range, which read as misleading in a date-filtered table.
  Object.values(combinedAptAgg).forEach(apt => {
    apt.devices = apt.deviceSet ? apt.deviceSet.size : 0;

    // Total Customer: only customers whose status is (canonical) "Active".
    const aptCustSet = new Set();
    fCustomers.forEach(c => {
      if (cleanAptName(c.society).toLowerCase() === apt.name.toLowerCase() && canonicalStatus(c.status) === "Active") {
        aptCustSet.add(c.id || c.zohoId || c.purifier_id || c.email || c.name);
      }
    });
    apt.totalCustomers = aptCustSet.size;
  });

  const allAptRows = Object.values(combinedAptAgg)
    .filter(r => r.totalCollected > 0)
    .sort((a, b) => b.totalCollected - a.totalCollected);

  // Plan Distribution calculation by plan amount (Zoho subscriptions + DP active purifiers).
  // Zoho half was reading straight off the raw, unfiltered `subs` array — never
  // scoped to the Society filter at all — while the DP half a few lines below
  // (`dpActiveCusts`, from `fCustomers`) already was, so picking a society only
  // ever partially filtered this chart. Fixed per explicit user report ("when
  // i am applying filter of society... it is not applying the filter in Plan
  // Tier Distribution") by applying the same `socOk(societyOf(s))` check every
  // other society-scoped set in this component already uses (see `fInvs`/
  // `fSubs` above).
  const planCounts = {};
  subs.filter(s => socOk(societyOf(s))).forEach(s => {
    if (["live", "active", "in_trial"].includes(String(s.status || "").toLowerCase())) {
      let amt = Number(s.amount) || 0;
      if (!amt && s.planCode) {
        const p = planInfo(s.planCode);
        if (p?.price) amt = p.price;
        else if (p?.total) amt = p.total;
      }
      if (!amt && s.plan) {
        const p = Object.values(PLAN_CATALOG).find(x => x.name && x.name.toLowerCase() === String(s.plan).toLowerCase());
        if (p?.price) amt = p.price;
        else if (p?.total) amt = p.total;
      }
      if (!amt) {
        const m = String(s.planCode || s.plan || "").match(/_(\d{3,4})(?:_|$)/) || String(s.planCode || s.plan || "").match(/\b(\d{3,4})\b/);
        if (m) amt = Number(m[1]);
      }
      const label = amt > 0 ? inr(amt) : "Custom / Other";
      planCounts[label] = (planCounts[label] || 0) + 1;
    }
  });

  // DP recharge-amount lookup (v2.29.416) — per explicit user instruction:
  // the DP customer record's own `plan_name`/`plan` text rarely carries a
  // parseable amount (that's why over half of DP customers were falling
  // into the generic "DrinkPrime Purifier" bucket below instead of a real
  // ₹-tier), but the dp-transactions feed's COLLECTION_SUMMARY rows DO carry
  // a real recharge amount per device (`Recharge_received`), keyed by
  // `current_device` — the same device identifier as a customer's own
  // `device_code` (added to the customer mapper in shared/core.js for this
  // exact join). Multiple collection events can exist for one device (a
  // recharge history), so this keeps the most-recent one by `Paid_Date` as
  // the device's CURRENT plan tier.
  const dpDeviceRecharge = {};
  (dpRows || []).forEach(r => {
    if (r.row_type !== "COLLECTION_SUMMARY" || !r.current_device) return;
    const amt = Number(r.Recharge_received) || 0;
    if (!(amt > 0)) return;
    const paidAt = parseFlexDate(r.Paid_Date)?.getTime() || 0;
    const existing = dpDeviceRecharge[r.current_device];
    if (!existing || paidAt >= existing.paidAt) dpDeviceRecharge[r.current_device] = { amt, paidAt };
  });

  const dpActiveCusts = fCustomers.filter(c => c.isDpCustomer && ["active", "in-active", "dunning"].includes(String(c.status || "").toLowerCase()));
  if (dpActiveCusts.length > 0) {
    dpActiveCusts.forEach(c => {
      // Real recharge amount first (device_code -> current_device join);
      // falls back to the old plan_name/plan regex guess, then finally the
      // generic bucket, only when neither source resolves a real amount.
      let amt = dpDeviceRecharge[c.device_code]?.amt || dpDeviceRecharge[c.purifier_id]?.amt || 0;
      if (!amt) {
        const m = String(c.plan_name || c.plan || "").match(/\b(\d{3,4})\b/) || String(c.plan_name || c.plan || "").match(/_(\d{3,4})/);
        if (m) amt = Number(m[1]);
      }
      const label = amt > 0 ? inr(amt) : "DrinkPrime Purifier";
      planCounts[label] = (planCounts[label] || 0) + 1;
    });
  } else if (dpUniqueDevices > 0) {
    planCounts["DrinkPrime Purifier"] = dpUniqueDevices;
  }

  const planCountsTotal = Object.values(planCounts).reduce((s, v) => s + v, 0);
  // `pct` (v2.29.386, per explicit user request: "show percentage" instead
  // of raw counts) — of `planCountsTotal`, which is already scoped to the
  // page's current Society/date filters (both `fSubs`/`fCustomers`, which
  // feed `planCounts` above, already respect them), so the percentages
  // themselves are dynamic without any extra plumbing.
  const planDistributionData = Object.entries(planCounts).map(([name, value]) => ({
    name,
    value,
    pct: planCountsTotal > 0 ? Math.round((value / planCountsTotal) * 1000) / 10 : 0,
  })).sort((a, b) => b.value - a.value);

  // Under-penetrated apartments calculation (Connection Density)
  const penetrationRisk = [];
  Object.values(combinedAptAgg).forEach(apt => {
    const zSoc = societies.find(s => cleanAptName(s.society).toLowerCase() === apt.name.toLowerCase());
    const flats = zSoc ? (zSoc.totalFlats || 0) : 0;
    const activeDp = apt.devices || 0;
    const activeZoho = zSoc ? (zSoc.active || 0) : 0;
    const totalActive = activeZoho + activeDp;
    const pctVal = flats > 0 ? Math.round((totalActive / flats) * 100) : 0;
    
    if (flats > 0) {
      penetrationRisk.push({
        name: apt.name,
        flats,
        active: totalActive,
        pct: pctVal
      });
    }
  });
  const underPenetratedApts = penetrationRisk
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  // Revenue by Source donut (for current period). Colors (v2.29.388, per
  // explicit user-provided redesign) — cyan for Zoho Recharge, green for
  // Zoho Deposit, two mint/teal tones for the DP side — real slices/values
  // unchanged, only the palette and chart chrome (center total, card
  // legend) were redesigned.
  const revBySource = [
    { name: "Zoho Deposit",  value: Math.round(depositCollected), fill: "#0A6E46", pctColor: "#0A6E46" },
    { name: "Zoho Recharge", value: Math.round(netRevenue),      fill: "#76C043", pctColor: "#5B9530" },
    { name: "DP Recharge",   value: Math.round(dpRechargeCur),   fill: "#B4D998", pctColor: "#0A6E46" },
    { name: "DP Deposit",    value: Math.round(dpDepositCur),    fill: "#DDE5D4", pctColor: "#697D61" },
  ].filter(x => x.value > 0);
  const revBySourceTotal = revBySource.reduce((s, x) => s + x.value, 0);

  // 7-month stacked chart: Zoho collected + DP collected per month
  const dpM7 = m7.map(x => {
    const dpCol = dpTxns.filter(r => {
      if (!r.Paid_Date) return false;
      const d = new Date(r.Paid_Date);
      return !isNaN(d) && d.getFullYear() === x.y && d.getMonth() === x.m;
    }).reduce((s, r) => s + (Number(r.revenue_amount) || 0) + (Number(r.deposit_amount) || 0), 0);
    return { label: monthShort(x.y, x.m), y: x.y, m: x.m, zoho: Math.round(x.collected), dp: Math.round(dpCol), total: Math.round(x.collected + dpCol) };
  });

  // DP MoM trend
  const dpMoM = dpM7.map((x, i) => ({
    ...x,
    dpPct: i > 0 && dpM7[i - 1].dp > 0
      ? Math.round(((x.dp - dpM7[i - 1].dp) / dpM7[i - 1].dp) * 100) : null
  }));

  // ---- controls --------------------------------------------------------------
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const displayName = titleCaseName(user.name || "Admin");
  const exportOverviewCsv = () => exportToCsv("prowater-overview.csv",
    [{ label: "Metric", get: r => r.k }, { label: "Value", get: r => r.v }],
    [
      { k: "Period", v: rangeLabel(range) }, { k: "Societies", v: selSoc === null ? "Default (excl. testing/blank)" : selSoc.join("; ") },
      { k: "Total Revenue", v: totalRevenue }, { k: "Net Revenue", v: netRevenue }, { k: "Earned Revenue", v: earnedRevenue },
      { k: "Active Customers", v: activeCustomers }, { k: "Collections", v: collections },
      { k: "Outstanding", v: pendingReceivables }, { k: "Growth Rate %", v: growthRate == null ? 0 : growthRate },
      { k: "Collection Efficiency %", v: Math.round(efficiency * 10) / 10 },
    ]);

  // ── Unified Customer Map & Payment Provider for Universal Drilldowns ─
  const custByPurifierId = {};
  customers.forEach(c => { if (c.purifier_id) custByPurifierId[c.purifier_id] = c; });

  const getUnifiedPayments = () => {
    // Filter Zoho payments
    const zohoList = paidCur.map(i => {
      const depVal = depositForCustomer(custOf(i), i.plan, i.total, i.planCode) || 0;
      const rechVal = Math.max(0, i.total - depVal);
      const c = custOf(i);
      return {
        id: `zoho-${i.id || i.number || Math.random()}`,
        name: i.customerName || c?.name || "Zoho Customer",
        phone: c?.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : "—",
        purifierId: c?.purifier_id || i.purifier_id || "—",
        society: societyOf(i),
        plan: i.plan || c?.plan || "—",
        deviceStatus: c?.deviceStatus || "",
        stack: "Zoho",
        recharge: rechVal,
        deposit: depVal,
        total: i.total,
        paidDate: i.paidDate || i.date ? fmtDate(new Date(i.paidDate || i.date)) : "—",
      };
    }).filter(p => p.total > 0);

    // Filter DrinkPrime payments
    const dpList = dpCur.map((r, idx) => {
      const rechVal = Number(r.revenue_amount) || 0;
      const depVal = Number(r.deposit_amount) || 0;
      const apt = cleanAptName(r.partner_name || "Unknown");
      const cRec = custByPurifierId[r.current_device];
      return {
        id: `dp-${r.id || idx}`,
        name: r.CustomerName || cRec?.name || "DrinkPrime Customer",
        phone: cRec?.phone ? String(cRec.phone).replace(/\D/g, "").slice(-10) : (r.phone ? String(r.phone).replace(/\D/g, "").slice(-10) : "—"),
        purifierId: r.current_device || "—",
        society: apt,
        plan: r.plan_name || cRec?.plan || "DrinkPrime",
        deviceStatus: cRec?.deviceStatus || "",
        stack: "DrinkPrime",
        recharge: rechVal,
        deposit: depVal,
        total: rechVal + depVal,
        paidDate: r.Paid_Date ? fmtDate(new Date(r.Paid_Date)) : "—",
      };
    }).filter(p => p.total > 0);

    return [...zohoList, ...dpList].sort((a, b) => b.total - a.total);
  };

  // ── Render Universal KPI & Chart Drilldown Modal ──────────────────────
  const renderKpiDrilldownModal = () => {
    if (!kpiModal) return null;
    const { type, filter, aptFilter, tierName, title, sub } = kpiModal;
    const mq = modalQ.toLowerCase().trim();

    // 1. Payments drilldown
    if (type === "payments") {
      let list = getUnifiedPayments();
      if (filter === "recharge") list = list.filter(x => x.recharge > 0);
      else if (filter === "deposit") list = list.filter(x => x.deposit > 0);
      else if (filter === "zoho_all") list = list.filter(x => x.stack === "Zoho");
      else if (filter === "zoho_recharge") list = list.filter(x => x.stack === "Zoho" && x.recharge > 0);
      else if (filter === "zoho_deposit") list = list.filter(x => x.stack === "Zoho" && x.deposit > 0);
      else if (filter === "dp_all") list = list.filter(x => x.stack === "DrinkPrime");
      else if (filter === "dp_recharge") list = list.filter(x => x.stack === "DrinkPrime" && x.recharge > 0);
      else if (filter === "dp_deposit") list = list.filter(x => x.stack === "DrinkPrime" && x.deposit > 0);

      if (aptFilter) {
        list = list.filter(x => cleanAptName(x.society).toLowerCase() === cleanAptName(aptFilter).toLowerCase());
      }

      const filtered = mq
        ? list.filter(x => `${x.name} ${x.purifierId} ${x.society} ${x.phone} ${x.stack} ${x.plan}`.toLowerCase().includes(mq))
        : list;

      const totRech = filtered.reduce((s, x) => s + x.recharge, 0);
      const totDep = filtered.reduce((s, x) => s + x.deposit, 0);
      const totAll = filtered.reduce((s, x) => s + x.total, 0);

      const exportCsv = () => exportToCsv("prowater-payments-drilldown.csv", [
        { label: "Customer Name", get: x => x.name },
        { label: "Phone", get: x => x.phone },
        { label: "Purifier ID", get: x => x.purifierId },
        { label: "Society", get: x => x.society },
        { label: "Stack", get: x => x.stack },
        { label: "Device Status", get: x => x.deviceStatus },
        { label: "Paid Date", get: x => x.paidDate },
        { label: "Deposit", get: x => x.deposit },
        { label: "Recharge", get: x => x.recharge },
        { label: "Total", get: x => x.total },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={modalWindowStyle}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>KPI Drill-Down · {rangeLabel(range)}</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{title}</h2>
                {sub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{sub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalCloseBtnStyle}>
                <X size={18} color="#475569" />
              </button>
            </div>

            {/* Toolbar & Search */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search customer, purifier ID, society…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12.5, color: "#475569" }}>
                  {/* Transaction count — per explicit user request ("show the
                      count also") — alongside the existing ₹ totals. */}
                  <strong style={{ color: "#1D1D1F" }}>{filtered.length.toLocaleString("en-IN")}</strong> transaction{filtered.length === 1 ? "" : "s"} · Deposit: <strong style={{ color: "#475569" }}>{inr(Math.round(totDep))}</strong> · Recharge: <strong style={{ color: "#08805A" }}>{inr(Math.round(totRech))}</strong> · Total: <strong style={{ color: "#1D1D1F", fontSize: 14 }}>{inr(Math.round(totAll))}</strong>
                </div>
                <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={modalTh}>Customer Name</th>
                      <th style={modalTh}>Phone</th>
                      <th style={modalTh}>Purifier ID</th>
                      <th style={modalTh}>Society</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Stack</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Device Status</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Paid Date</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Deposit</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Recharge</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={item.id || idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", fontWeight: 650, color: "#1D1D1F" }}>{item.name}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B", fontFamily: "monospace" }}>{item.phone}</td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#08805A", fontWeight: 600 }}>{item.purifierId}</td>
                        <td style={{ padding: "11px 14px", color: "#1D1D1F" }}>{item.society}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: item.stack === "Zoho" ? "rgba(30,158,79,0.1)" : "rgba(42,134,214,0.1)", color: item.stack === "Zoho" ? "#1E9E4F" : "#2A86D6" }}>
                            {item.stack}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          {item.deviceStatus ? (
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: normDevSt(item.deviceStatus) === "uninstalled" ? "#DC4141" : "#475569", background: normDevSt(item.deviceStatus) === "uninstalled" ? "rgba(220,65,65,0.1)" : "rgba(71,85,105,0.08)" }}>
                              {item.deviceStatus}
                            </span>
                          ) : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "center", color: "#64748B" }}>{item.paidDate}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", color: item.deposit > 0 ? "#475569" : "#94a3b8" }}>{item.deposit > 0 ? inr(Math.round(item.deposit)) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", color: item.recharge > 0 ? "#08805A" : "#94a3b8", fontWeight: item.recharge > 0 ? 600 : 400 }}>{item.recharge > 0 ? inr(Math.round(item.recharge)) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: "#1D1D1F" }}>{inr(Math.round(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 40 }}><Empty msg="No matching transactions found." /></div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. Active Customers drilldown
    if (type === "active_customers") {
      let custs = fCustomers.filter(c => canonicalStatus(c.status) === "Active");
      if (aptFilter) {
        custs = custs.filter(c => cleanAptName(c.society).toLowerCase() === cleanAptName(aptFilter).toLowerCase());
      }
      const filtered = mq
        ? custs.filter(c => `${c.name} ${c.purifier_id} ${c.society} ${c.phone} ${c.plan} ${c.isDpCustomer ? "DrinkPrime DP" : "Zoho"}`.toLowerCase().includes(mq))
        : custs;

      const zohoActive = filtered.filter(c => !c.isDpCustomer).length;
      const dpActive = filtered.filter(c => c.isDpCustomer).length;
      const socCount = new Set(filtered.map(c => cleanAptName(c.society)).filter(Boolean)).size;

      const exportCsv = () => exportToCsv("prowater-active-customers.csv", [
        { label: "Customer Name", get: c => c.name },
        { label: "Phone", get: c => c.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : "—" },
        { label: "Purifier ID", get: c => c.purifier_id },
        { label: "Society", get: c => c.society },
        { label: "Plan", get: c => c.plan || c.plan_name || "—" },
        { label: "Stack", get: c => c.isDpCustomer ? "DrinkPrime" : "Zoho" },
        { label: "Status", get: c => c.status },
        { label: "Since", get: c => c.since ? fmtDate(new Date(c.since)) : "—" },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={modalWindowStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>Customer Directory · Active Accounts</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{title}</h2>
                {sub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{sub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalCloseBtnStyle}>
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search customer, purifier ID, society, phone…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12.5, color: "#475569" }}>
                  Total: <strong style={{ color: "#08805A" }}>{filtered.length}</strong> (Zoho: <strong>{zohoActive}</strong> · DP: <strong>{dpActive}</strong>) · Societies: <strong>{socCount}</strong>
                </div>
                <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={modalTh}>Customer Name</th>
                      <th style={modalTh}>Phone</th>
                      <th style={modalTh}>Purifier ID</th>
                      <th style={modalTh}>Society</th>
                      <th style={modalTh}>Plan</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Stack</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Device Status</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Since Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => (
                      <tr key={c.id || idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", fontWeight: 650, color: "#1D1D1F" }}>{c.name || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B", fontFamily: "monospace" }}>{c.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : "—"}</td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#08805A", fontWeight: 600 }}>{c.purifier_id || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#1D1D1F" }}>{c.society || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#475569" }}>{c.plan || c.plan_name || "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: c.isDpCustomer ? "rgba(42,134,214,0.1)" : "rgba(30,158,79,0.1)", color: c.isDpCustomer ? "#2A86D6" : "#1E9E4F" }}>
                            {c.isDpCustomer ? "DrinkPrime" : "Zoho"}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: "#08805A", background: "rgba(8,128,90,0.1)" }}>
                            Active
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "center", color: "#64748B" }}>{c.since ? fmtDate(new Date(c.since)) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 40 }}><Empty msg="No active customers match your search." /></div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 3. New CX drilldown
    if (type === "new_cx") {
      const signupsInPeriod = allSignups.filter(x => x.since >= range.from && x.since <= range.to);
      const filtered = mq
        ? signupsInPeriod.filter(x => `${x.name || ""} ${x.society} ${x.phone || ""} ${x.purifierId || ""} ${x.isDp ? "DrinkPrime DP" : "Zoho"}`.toLowerCase().includes(mq))
        : signupsInPeriod;

      const exportCsv = () => exportToCsv("prowater-new-cx.csv", [
        { label: "Customer Name", get: x => x.name || "—" },
        { label: "Society Name", get: x => x.society },
        { label: "Phone", get: x => x.phone || "—" },
        { label: "Purifier ID", get: x => x.purifierId || "—" },
        { label: "Stack", get: x => x.isDp ? "DrinkPrime" : "Zoho" },
        { label: "Onboarded Date", get: x => fmtDate(x.since) },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={modalWindowStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>Penetration & Growth · {rangeLabel(range)}</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{title}</h2>
                {sub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{sub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalCloseBtnStyle}>
                <X size={18} color="#475569" />
              </button>
            </div>

            {/* Society summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
              {newCustsAptBreakdown.slice(0, 6).map(apt => (
                <div key={apt.name} style={{ background: "rgba(243,248,236,0.6)", padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(8,128,90,0.12)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1D1D1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={apt.name}>{apt.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#08805A" }}>+{apt.total}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 3 }}>Zoho: {apt.zoho} · DP: {apt.dp}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search customer, society, phone, purifier ID, stack…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12.5, color: "#475569" }}>
                  Total New Additions: <strong style={{ color: "#08805A" }}>{filtered.length}</strong> (Zoho: <strong>{filtered.filter(x => !x.isDp).length}</strong> · DP: <strong>{filtered.filter(x => x.isDp).length}</strong>)
                </div>
                <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={modalTh}>#</th>
                      <th style={modalTh}>Customer Name</th>
                      <th style={modalTh}>Society Name</th>
                      <th style={modalTh}>Phone</th>
                      <th style={modalTh}>Purifier ID</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Stack</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Onboarding Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", color: "#86868B", fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 700, color: "#1D1D1F" }}>{item.name || "—"}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 600, color: "#08805A" }}>{item.society}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B", fontFamily: "monospace" }}>{item.phone || "—"}</td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#475569" }}>{item.purifierId || "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: item.isDp ? "rgba(42,134,214,0.1)" : "rgba(30,158,79,0.1)", color: item.isDp ? "#2A86D6" : "#1E9E4F" }}>
                            {item.isDp ? "DrinkPrime" : "Zoho"}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "center", color: "#08805A", fontWeight: 600 }}>{fmtDate(item.since)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 40 }}><Empty msg="No new customer additions in this period." /></div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 4. Plan Tier drilldown
    if (type === "plan_tier") {
      const tierSubs = [];
      subs.filter(s => socOk(societyOf(s))).forEach(s => {
        if (["live", "active", "in_trial"].includes(String(s.status || "").toLowerCase())) {
          let amt = Number(s.amount) || 0;
          if (!amt && s.planCode) {
            const p = planInfo(s.planCode);
            if (p?.price) amt = p.price;
            else if (p?.total) amt = p.total;
          }
          if (!amt && s.plan) {
            const p = Object.values(PLAN_CATALOG).find(x => x.name && x.name.toLowerCase() === String(s.plan).toLowerCase());
            if (p?.price) amt = p.price;
            else if (p?.total) amt = p.total;
          }
          if (!amt) {
            const m = String(s.planCode || s.plan || "").match(/_(\d{3,4})(?:_|$)/) || String(s.planCode || s.plan || "").match(/\b(\d{3,4})\b/);
            if (m) amt = Number(m[1]);
          }
          const label = amt > 0 ? inr(amt) : "Custom / Other";
          if (label === tierName) {
            const c = custOf(s);
            tierSubs.push({
              name: s.customerName || c?.name || "Zoho Customer",
              phone: c?.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : "—",
              purifierId: c?.purifier_id || s.purifierId || "—",
              society: societyOf(s),
              plan: s.plan || s.planName || "—",
              amount: amt,
              stack: "Zoho",
              status: canonicalStatus(s.status || c?.status) || "Active",
            });
          }
        }
      });

      dpActiveCusts.forEach(c => {
        let amt = 0;
        const m = String(c.plan_name || c.plan || "").match(/\b(\d{3,4})\b/) || String(c.plan_name || c.plan || "").match(/_(\d{3,4})/);
        if (m) amt = Number(m[1]);
        const label = amt > 0 ? inr(amt) : "DrinkPrime Purifier";
        if (label === tierName) {
          tierSubs.push({
            name: c.name || "DrinkPrime Customer",
            phone: c.phone ? String(c.phone).replace(/\D/g, "").slice(-10) : "—",
            purifierId: c.purifier_id || "—",
            society: cleanAptName(c.society || "Unknown"),
            plan: c.plan_name || c.plan || "DrinkPrime Plan",
            amount: amt,
            stack: "DrinkPrime",
            status: canonicalStatus(c.status) || "Active",
          });
        }
      });

      const filtered = mq
        ? tierSubs.filter(x => `${x.name} ${x.phone} ${x.purifierId} ${x.society} ${x.plan} ${x.stack} ${x.status}`.toLowerCase().includes(mq))
        : tierSubs;

      const exportCsv = () => exportToCsv(`prowater-plan-tier-${String(tierName || "").replace(/[^\w-]/g, "_")}.csv`, [
        { label: "Customer Name", get: x => x.name },
        { label: "Phone", get: x => x.phone },
        { label: "Purifier ID", get: x => x.purifierId },
        { label: "Society", get: x => x.society },
        { label: "Plan Name", get: x => x.plan },
        { label: "Plan Amount", get: x => inr(x.amount) },
        { label: "Stack", get: x => x.stack },
        { label: "Status", get: x => x.status },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={modalWindowStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>Plan Tier Distribution · Active Subscriptions</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{title}</h2>
                {sub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{sub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalCloseBtnStyle}>
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search customer, phone, purifier ID, society, plan…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12.5, color: "#475569" }}>
                  Active on this Tier: <strong style={{ color: "#2A86D6" }}>{filtered.length}</strong> (Zoho: <strong>{filtered.filter(x => x.stack === "Zoho").length}</strong> · DP: <strong>{filtered.filter(x => x.stack === "DrinkPrime").length}</strong>)
                </div>
                <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={modalTh}>Customer Name</th>
                      <th style={modalTh}>Phone</th>
                      <th style={modalTh}>Purifier ID</th>
                      <th style={modalTh}>Society</th>
                      <th style={modalTh}>Plan Name</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Stack</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Amount</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", fontWeight: 650, color: "#1D1D1F" }}>{item.name}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B", fontFamily: "monospace" }}>{item.phone}</td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#08805A", fontWeight: 600 }}>{item.purifierId}</td>
                        <td style={{ padding: "11px 14px", color: "#1D1D1F" }}>{item.society}</td>
                        <td style={{ padding: "11px 14px", color: "#475569" }}>{item.plan}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: item.stack === "Zoho" ? "rgba(30,158,79,0.1)" : "rgba(42,134,214,0.1)", color: item.stack === "Zoho" ? "#1E9E4F" : "#2A86D6" }}>
                            {item.stack}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: "#2A86D6" }}>{item.amount > 0 ? inr(item.amount) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: "#08805A", background: "rgba(8,128,90,0.1)" }}>
                            {item.status || "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "rgba(243,248,236,.85)", borderTop: "2px solid rgba(8,128,90,0.18)" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 800, color: "#1D1D1F" }}>Total Count</td>
                      <td style={{ padding: "12px 14px", color: "#64748B" }}>—</td>
                      <td style={{ padding: "12px 14px", color: "#64748B" }}>—</td>
                      <td style={{ padding: "12px 14px", color: "#475569", fontWeight: 600 }}>{new Set(filtered.map(x => x.society)).size} societies</td>
                      <td style={{ padding: "12px 14px", color: "#64748B" }}>—</td>
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, fontSize: 11.5 }}>
                        Zoho: {filtered.filter(x => x.stack === "Zoho").length} · DP: {filtered.filter(x => x.stack === "DrinkPrime").length}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#2A86D6", fontSize: 13.5 }}>
                        {inr(filtered.reduce((s, x) => s + (x.amount || 0), 0))}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "#08805A", fontSize: 14 }}>
                        {filtered.length} Subscriptions
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div style={{ padding: 40 }}><Empty msg="No subscriptions match this tier." /></div>
              )}
            </div>

            {/* Total Count Sticky Summary Strip at Bottom */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 12,
              padding: "12px 18px",
              background: "rgba(243,248,236,0.9)",
              border: "1px solid rgba(8,128,90,0.18)",
              borderRadius: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#64748B" }}>Total Count:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#08805A" }}>{filtered.length} Subscriptions</span>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600, background: "rgba(0,0,0,0.05)", padding: "3px 8px", borderRadius: 6 }}>
                  Zoho: <strong>{filtered.filter(x => x.stack === "Zoho").length}</strong> · DrinkPrime: <strong>{filtered.filter(x => x.stack === "DrinkPrime").length}</strong>
                </span>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  Societies: <strong>{new Set(filtered.map(x => x.society)).size}</strong>
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                Total Monthly Value: <strong style={{ color: "#2A86D6", fontSize: 15, fontWeight: 800 }}>{inr(filtered.reduce((s, x) => s + (x.amount || 0), 0))}</strong>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 5. ARPU drilldown
    if (type === "arpu") {
      const aptArpuList = allAptRows.map(r => {
        const totalRech = r.zohoRecharge + r.dpRecharge;
        const aptArpu = r.totalCustomers > 0 ? Math.round(totalRech / r.totalCustomers) : 0;
        return {
          name: r.name,
          totalCustomers: r.totalCustomers,
          recharge: totalRech,
          arpu: aptArpu,
          totalCollected: r.totalCollected
        };
      }).sort((a, b) => b.arpu - a.arpu);

      const filtered = mq
        ? aptArpuList.filter(x => x.name.toLowerCase().includes(mq))
        : aptArpuList;

      const exportCsv = () => exportToCsv("prowater-arpu-breakdown.csv", [
        { label: "Apartment", get: x => x.name },
        { label: "Active Customers", get: x => x.totalCustomers },
        { label: "Recharge Collected", get: x => x.recharge },
        { label: "Average ARPU", get: x => x.arpu },
        { label: "Total Collected", get: x => x.totalCollected },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalOverlayStyle}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={modalWindowStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>Unit Economics & ARPU Ranking · {rangeLabel(range)}</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{title}</h2>
                {sub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{sub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={modalCloseBtnStyle}>
                <X size={18} color="#475569" />
              </button>
            </div>

            {/* Macro Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "rgba(42,134,214,0.08)", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(42,134,214,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#2A86D6", textTransform: "uppercase" }}>Combined ARPU</div>
                <div className="serif" style={{ fontSize: 24, fontWeight: 800, color: "#1D1D1F", marginTop: 4 }}>{inr(Math.round(arpu))}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Combined recharge ({inr(Math.round(combinedRechargeCur))}) ÷ {totalActiveCustomers} Active CX</div>
              </div>
              <div style={{ background: "rgba(8,128,90,0.08)", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(8,128,90,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#08805A", textTransform: "uppercase" }}>Zoho ARPU</div>
                <div className="serif" style={{ fontSize: 24, fontWeight: 800, color: "#1D1D1F", marginTop: 4 }}>{activeCustomers > 0 ? inr(Math.round(netRevenue / activeCustomers)) : "—"}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Zoho recharge ({inr(Math.round(netRevenue))}) ÷ {activeCustomers} Zoho CX</div>
              </div>
              <div style={{ background: "rgba(30,158,79,0.08)", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(30,158,79,0.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1E9E4F", textTransform: "uppercase" }}>DrinkPrime ARPU</div>
                <div className="serif" style={{ fontSize: 24, fontWeight: 800, color: "#1D1D1F", marginTop: 4 }}>{dpActiveCustomers > 0 ? inr(Math.round(dpRechargeCur / dpActiveCustomers)) : "—"}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>DP recharge ({inr(Math.round(dpRechargeCur))}) ÷ {dpActiveCustomers} DP CX</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search apartment…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              {/* Apartment count — per explicit user request ("show the count
                  also") — this drilldown had none before. */}
              <div style={{ fontSize: 12.5, color: "#475569" }}>
                <strong style={{ color: "#1D1D1F" }}>{filtered.length.toLocaleString("en-IN")}</strong> apartment{filtered.length === 1 ? "" : "s"}
              </div>
              <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                <Download size={13} /> Export CSV
              </button>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={modalTh}>Apartment Name</th>
                      <th style={{ ...modalTh, textAlign: "center" }}>Active Customers</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Recharge Collected</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Average ARPU</th>
                      <th style={{ ...modalTh, textAlign: "right" }}>Total Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", fontWeight: 650, color: "#1D1D1F" }}>{item.name}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 700, color: "#1D1D1F" }}>{item.totalCustomers}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", color: "#08805A", fontWeight: 600 }}>{inr(item.recharge)}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 800, color: "#2A86D6", fontSize: 13.5 }}>{inr(item.arpu)}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", color: "#1D1D1F", fontWeight: 700 }}>{inr(item.totalCollected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 40 }}><Empty msg="No apartments found." /></div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const modalOverlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(10,26,18,0.5)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1000,
  };
  const modalWindowStyle = {
    width: "min(1100px, 95%)",
    background: "#fff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
    maxHeight: "calc(100vh - 40px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
  const modalCloseBtnStyle = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.05)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    border: "none",
    transition: "background 0.2s",
  };
  const modalTh = {
    padding: "12px 14px",
    color: "#08805A",
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: ".04em",
    textTransform: "uppercase",
  };

  // ── Render Modal for Recharged Customers in Clicked Apartment ──────
  const renderAptDetailsModal = () => {
    if (!selectedAptDetails) return null;
    const aptName = selectedAptDetails;

    // Filter Zoho payments
    const zohoList = paidCur
      .filter(i => cleanAptName(societyOf(i)) === aptName)
      .map(i => {
        const sub = subs.find(s => s.customerNumber === i.customerNumber || s.zohoCustomerId === i.zohoCustomerId || s.zohoId === i.zohoId);
        const months = termMonths(sub || { intervalCount: i.intervalCount, intervalUnit: i.intervalUnit, interval: i.interval, plan: i.plan }) || 1;
        const paidDate = i.paidDate || i.date;
        const startDate = i.dueDate ? new Date(i.dueDate) : (paidDate ? new Date(paidDate) : null);
        const endDate = startDate ? new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate() - 1) : null;
        const depVal = depositForCustomer(custOf(i), i.plan, i.total, i.planCode) || 0;
        const rechVal = Math.max(0, i.total - depVal);
        return {
          id: i.id || i.number || Math.random(),
          name: i.customerName || custOf(i)?.name || "Unknown Zoho Customer",
          purifierId: custOf(i)?.purifier_id || i.purifier_id || "—",
          deviceStatus: custOf(i)?.deviceStatus || "",
          stack: "Zoho",
          recharge: rechVal,
          deposit: depVal,
          total: i.total,
          paidDate: paidDate ? fmtDate(new Date(paidDate)) : "—",
          startDate: startDate ? fmtDate(startDate) : "—",
          endDate: endDate ? fmtDate(endDate) : "—"
        };
      })
      .filter(p => p.total > 0);

    // DrinkPrime payment records don't carry device_status themselves — join
    // back to the customer record via current_device === purifier_id (the
    // same key DP customers' purifier_id is built from) to get it.
    const custByPurifierId = {};
    customers.forEach(c => { if (c.purifier_id) custByPurifierId[c.purifier_id] = c; });

    // Filter DrinkPrime payments
    const dpList = dpCur
      .filter(r => cleanAptName(r.partner_name || "Unknown") === aptName)
      .map((r, idx) => {
        const rechVal = Number(r.revenue_amount) || 0;
        const depVal = Number(r.deposit_amount) || 0;
        const startDate = r["t.validity_start_date"] ? new Date(r["t.validity_start_date"]) : null;
        const endDate = r["t.validity_end_date"] ? new Date(r["t.validity_end_date"]) : null;
        return {
          id: r.id || `dp-${idx}`,
          name: r.CustomerName || "Unknown DP Customer",
          purifierId: r.current_device || "—",
          deviceStatus: custByPurifierId[r.current_device]?.deviceStatus || "",
          stack: "DrinkPrime",
          recharge: rechVal,
          deposit: depVal,
          total: rechVal + depVal,
          paidDate: r.Paid_Date ? fmtDate(new Date(r.Paid_Date)) : "—",
          startDate: startDate ? fmtDate(startDate) : "—",
          endDate: endDate ? fmtDate(endDate) : "—"
        };
      })
      .filter(p => p.total > 0);

    const mergedList = [...zohoList, ...dpList].sort((a, b) => b.total - a.total);
    const totalRechargeAmt = mergedList.reduce((s, x) => s + x.recharge, 0);
    const totalDepositAmt = mergedList.reduce((s, x) => s + x.deposit, 0);

    const totalCollectedAmt = mergedList.reduce((s, x) => s + x.total, 0);

    return (
      <div 
        onClick={() => setSelectedAptDetails(null)} 
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10,26,18,0.5)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          zIndex: 1000
        }}
      >
        <div 
          onClick={e => e.stopPropagation()} 
          className="pw-pop" 
          style={{
            width: "min(1100px, 95%)",
            background: "#fff",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            maxHeight: "calc(100vh - 40px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>Apartment Customer Payments · {rangeLabel(range)}</p>
              <h2 style={{ fontSize: 22, margin: "4px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{aptName}</h2>
            </div>
            <button 
              onClick={() => setSelectedAptDetails(null)} 
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.05)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                border: "none",
                transition: "background 0.2s"
              }}
            >
              <X size={18} color="#475569" />
            </button>
          </div>

          {/* Metrics summary */}
          <div style={{ padding: "14px 20px", borderRadius: 12, background: "rgba(8,128,90,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#08805A" }}>{mergedList.length} Paying Customers</span>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#475569" }}>
                Recharge: <strong style={{ color: "#08805A", fontSize: 14 }}>{inr(Math.round(totalRechargeAmt))}</strong>
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                Deposit: <strong style={{ color: "#475569", fontSize: 14 }}>{inr(Math.round(totalDepositAmt))}</strong>
              </div>
              <div style={{ borderLeft: "1px solid rgba(0,0,0,0.12)", height: 16 }} />
              <div style={{ fontSize: 13, color: "#1D1D1F", fontWeight: 600 }}>
                Total Collected: <strong style={{ color: "#1D1D1F", fontSize: 16, fontWeight: 800 }}>{inr(Math.round(totalCollectedAmt))}</strong>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
            {mergedList.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700 }}>Customer Name</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700 }}>Purifier ID</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "center" }}>Device Status</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "center" }}>Paid Date</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "center" }}>Start Date</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "center" }}>End Date</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "center" }}>Stack</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "right" }}>Deposit</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "right" }}>Recharge</th>
                    <th style={{ padding: "12px 16px", color: "#08805A", fontWeight: 700, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedList.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 650, color: "#1D1D1F" }}>{item.name}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#475569" }}>{item.purifierId}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {(() => {
                          const norm = normDevSt(item.deviceStatus);
                          if (!norm) return <span style={{ color: "#94a3b8" }}>—</span>;
                          const [c, bg] = norm === "uninstalled" ? ["#DC4141", "rgba(220,65,65,0.1)"]
                            : norm === "replaced" ? ["#986315", "rgba(152,99,21,0.1)"]
                            : ["#475569", "rgba(71,85,105,0.08)"];
                          return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color: c, background: bg, whiteSpace: "nowrap" }}>{item.deviceStatus}</span>;
                        })()}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: "#475569" }}>{item.paidDate}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: "#475569" }}>{item.startDate}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: "#475569" }}>{item.endDate}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: item.stack === "Zoho" ? "rgba(30,158,79,0.1)" : "rgba(42,134,214,0.1)", color: item.stack === "Zoho" ? "#1E9E4F" : "#2A86D6" }}>
                          {item.stack}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: item.deposit > 0 ? "#475569" : "#94a3b8" }}>{item.deposit > 0 ? inr(Math.round(item.deposit)) : "—"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: item.recharge > 0 ? "#08805A" : "#94a3b8", fontWeight: item.recharge > 0 ? 600 : 400 }}>{item.recharge > 0 ? inr(Math.round(item.recharge)) : "—"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#1D1D1F" }}>{inr(Math.round(item.total))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "rgba(243,248,236,.6)", borderTop: "2px solid rgba(8,128,90,.15)", position: "sticky", bottom: 0, fontWeight: 700 }}>
                    <td colSpan={7} style={{ padding: "12px 16px", color: "#1D1D1F" }}>Grand Total ({mergedList.length})</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>{totalDepositAmt > 0 ? inr(Math.round(totalDepositAmt)) : "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#08805A" }}>{totalRechargeAmt > 0 ? inr(Math.round(totalRechargeAmt)) : "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#1D1D1F", fontWeight: 800 }}>{inr(Math.round(totalCollectedAmt))}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 40 }}><Empty msg="No customer payments found." /></div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const softShadow = { background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,.03)" };
  // v2.29.274: `hero` no longer changes icon styling — per explicit user
  // request to make all hero cards the same white style as normal cards.
  const iconBox = () => ({ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", color: "#08805A" });
  const socTd = { padding: "14px 18px", fontSize: 13.5, color: "#475569", textAlign: "center", borderBottom: "1px solid rgba(0,0,0,.04)", whiteSpace: "nowrap" };
  const socFt = { padding: "14px 18px", fontSize: 13, fontWeight: 700, color: "#0d2119", textAlign: "center", whiteSpace: "nowrap" };

  return (
    <div className="ov-sans" style={{ padding: "0 4px" }}>
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 27, margin: 0, color: "#1D1D1F", fontWeight: 700 }}>{greeting}, {displayName} 👋</h1>
          <div style={{ fontSize: 13.5, color: "#86868B", marginTop: 3 }}>Here's what's happening with your business today.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <DateRangePicker value={sel} onChange={setSel} />
          <MultiSelectFilter label="Society" options={allSocieties} value={selSoc} onChange={setSelSoc} width={220} />
          {/* Customer Stack filter (v2.29.387, per explicit user request:
              "add in the filters as Stack for DP and Zoho") — only shown on
              the combined (Overview V2) page, since the legacy plain
              Overview never loads any DP data at all for this to scope. */}
          {combined && <MultiSelectFilter label="Customer Stack" options={["DP", "Zoho"]} value={selStack} onChange={setSelStack} width={190} />}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              title="Reset all filters to default"
              style={{
                ...btnGhost,
                color: "#DC4141",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12.5,
                padding: "7px 12px",
                borderRadius: 10,
                background: "rgba(220,65,65,0.08)",
                border: "1px solid rgba(220,65,65,0.2)",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          )}
          <button onClick={exportOverviewCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none" }}><Download size={16} /> Export</button>
        </div>
      </div>

      {combined && (
        <>
          {/* ══════════════════════════════════════════════════════════════════════
              COMBINED ANALYTICS — Zoho Billing + DP System unified view
              ════════════════════════════════════════════════════════════════════ */}

          {/* ── Section divider ──────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0 16px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 999,
              background: "linear-gradient(90deg,rgba(30,158,79,.12) 0%,rgba(196,229,56,.08) 100%)",
              border: "1px solid rgba(30,158,79,.2)", fontSize: 11, fontWeight: 800,
              letterSpacing: ".08em", textTransform: "uppercase", color: "#08805A"
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1E9E4F" }} />
              Combined Zoho + DP Analytics
            </div>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
          </div>

          {/* ── Combined Revenue KPI strip ───────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              // Trimmed to 6 cards (v2.29.389, per explicit user request — "i
              // dont need 2 rows of KPI cards"): Total Collection, Total
              // Recharges, Total Deposit, Average ARPU, Active Customers, New
              // CX. The Zoho-only/DP-only breakdown cards (Zoho Collection/
              // Recharge/Deposit, DP Total Collected/Recharge/Deposit) that
              // used to sit between Combined Deposit and Average ARPU are
              // removed from this row — their figures are still computed
              // above and still drive the "Combined"/hero card's own click-
              // through modal, just no longer surfaced as separate tiles.
              { label: "Total Collection",         value: inr(Math.round(combinedRevCur)),      delta: pct(combinedRevCur, combinedRevPrv),                  prevValue: inr(Math.round(combinedRevPrv)),                  color: "#08805A", hero: true, modalType: "payments", modalFilter: "all", modalTitle: "Total Collection Transactions", modalSub: `All Zoho & DrinkPrime paid transactions in ${rangeLabel(range)}` },
              { label: "Total Recharges",          value: inr(Math.round(combinedRechargeCur)), delta: pct(combinedRechargeCur, netPrev + dpRechargePrv),   prevValue: inr(Math.round(netPrev + dpRechargePrv)),         color: "#08805A", modalType: "payments", modalFilter: "recharge", modalTitle: "Total Recharge Transactions", modalSub: `All Zoho & DrinkPrime recharge payments in ${rangeLabel(range)}` },
              { label: "Total Deposit",            value: inr(Math.round(combinedDepositCur)),  delta: pct(combinedDepositCur, depositPrev + dpDepositPrv), prevValue: inr(Math.round(depositPrev + dpDepositPrv)),      color: "#5B21B6", modalType: "payments", modalFilter: "deposit", modalTitle: "Total Deposit Transactions", modalSub: `All Zoho & DrinkPrime deposit payments in ${rangeLabel(range)}` },
              // Average ARPU (v2.29.382, moved here v2.29.383 per explicit
              // user request). `arpu` (combined recharge ÷ total active
              // customers, Zoho + DP) was already computed below for the LTV
              // estimate but never actually surfaced until v2.29.382.
              { label: "Average ARPU",             value: inr(Math.round(arpu)),                 sub: `Combined recharge ÷ ${totalActiveCustomers.toLocaleString("en-IN")} active`, color: "#2A86D6", modalType: "arpu", modalTitle: "Average ARPU & Unit Economics", modalSub: `Average Revenue Per User and apartment breakdown in ${rangeLabel(range)}` },
              { label: "Active Customers",         value: totalActiveCustomers.toLocaleString("en-IN"), sub: `Zoho: ${activeCustomers.toLocaleString("en-IN")} · DP: ${dpActiveCustomers.toLocaleString("en-IN")}`, color: "#2A86D6", modalType: "active_customers", modalTitle: "Active Customers Directory", modalSub: `All active customer subscriptions across Zoho & DrinkPrime` },
              { label: "New CX",                   value: newThisMonth.toLocaleString("en-IN"), delta: pct(newThisMonth, newPrev), prevValue: newPrev.toLocaleString("en-IN"), sub: `Zoho: ${zohoNewCur.toLocaleString("en-IN")} · DP: ${dpNewCur.toLocaleString("en-IN")}`, color: "#08805A", isNewCustCard: true, modalType: "new_cx", modalTitle: "New Customer Additions", modalSub: `All customer signups and onboarding in ${rangeLabel(range)}` },
            ].map((k, i) => (
              // v2.29.274: `hero` no longer renders a gradient card — per
              // explicit user request to make all hero cards the same white
              // style as normal cards, so the delta below is just plain
              // colored text on white, no pill/backdrop needed.
              <div
                key={k.label}
                onClick={() => setKpiModal({ type: k.modalType, filter: k.modalFilter, title: k.modalTitle, sub: k.modalSub })}
                onMouseEnter={k.isNewCustCard ? () => setShowNewCustPopup(true) : undefined}
                onMouseLeave={k.isNewCustCard ? () => setShowNewCustPopup(false) : undefined}
                style={{
                  background: "rgba(255,255,255,0.88)",
                  border: k.isNewCustCard && showNewCustPopup ? "1px solid rgba(8,128,90,0.4)" : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 18,
                  padding: "16px 18px",
                  boxShadow: k.isNewCustCard && showNewCustPopup ? "0 8px 24px rgba(8,128,90,.12)" : "0 6px 20px rgba(0,0,0,.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  minWidth: 0,
                  position: "relative",
                  cursor: "pointer",
                  transition: "border 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease"
                }}
                title={`Click to view ${k.label} breakdown & transactions`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, minHeight: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#86868B", lineHeight: 1.25, flex: 1 }} title={k.label}>{k.label}</div>
                  <span style={{ fontSize: 9.5, color: k.color || "#08805A", fontWeight: 700, background: `${k.color || "#08805A"}12`, padding: "2px 5px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }} title={k.isNewCustCard ? "Hover for breakdown or click to view details" : `Click to view ${k.label} details`}>
                    <ExternalLink size={10} />
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1D1D1F", lineHeight: 1.15, letterSpacing: "-.02em" }}>{k.value}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {k.delta != null && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: k.delta >= 0 ? "#08805A" : "#DC4141" }}>
                      {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}% {vsPrev}
                      {/* Real previous-period number alongside the % — per explicit
                          user request ("show the real numbers also in the bracket"),
                          so the delta is checkable at a glance, not just a bare %. */}
                      {k.prevValue != null && <span style={{ color: "#86868B", fontWeight: 600 }}> ({k.prevValue})</span>}
                    </span>
                  )}
                  {k.sub && (
                    <span style={{ fontSize: 11, color: "#86868B" }}>
                      {k.delta != null ? `(${k.sub})` : k.sub}
                    </span>
                  )}
                </div>

                {/* Hover Popover for New CX */}
                {k.isNewCustCard && showNewCustPopup && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setShowNewCustPopup(true)}
                    onMouseLeave={() => setShowNewCustPopup(false)}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      minWidth: 280,
                      maxWidth: 340,
                      background: "#ffffff",
                      borderRadius: 16,
                      boxShadow: "0 16px 36px rgba(0,0,0,0.16), 0 0 0 1px rgba(8,128,90,0.2)",
                      padding: "14px 16px",
                      zIndex: 100,
                      pointerEvents: "auto"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1D1D1F" }}>
                        New CX by Society
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#08805A" }}>
                        Total: +{newThisMonth}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#86868B", marginBottom: 10 }}>
                      {rangeLabel(range)} · Apartment Breakdown
                    </div>

                    <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {newCustsAptBreakdown.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#86868B", textAlign: "center", padding: "10px 0" }}>
                          No new customer additions in this period.
                        </div>
                      ) : (
                        newCustsAptBreakdown.map(apt => (
                          <div
                            key={apt.name}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "7px 10px",
                              borderRadius: 10,
                              background: "rgba(243,248,236,0.6)",
                              border: "1px solid rgba(8,128,90,0.08)"
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#1D1D1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={apt.name}>
                                {apt.name}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 1 }}>
                                Zoho: {apt.zoho} · DP: {apt.dp}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#08805A",
                              background: "rgba(8,128,90,0.12)",
                              padding: "2px 7px",
                              borderRadius: 6,
                              flexShrink: 0
                            }}>
                              +{apt.total}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Revenue by Source (donut) + 7-month Stacked Bar ─────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16, marginBottom: 16 }}>

            {/* Revenue by Source donut */}
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(0, 0, 0, 0.07)", borderRadius: 20, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", padding: 22, minWidth: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ fontSize: 16, color: "#1D1D1F", fontWeight: 700, margin: "0px 0px 4px", letterSpacing: "-0.01em" }}>Revenue by Source</h3>
                  <div style={{ fontSize: 12, color: "#86868B" }}>Zoho Billing vs DP System · {rangeLabel(range)}</div>
                </div>
                {selSource ? (
                  <button
                    onClick={() => setSelSource(null)}
                    style={{
                      ...btnGhost,
                      padding: "4px 8px",
                      fontSize: 11,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 6,
                      borderColor: "rgba(10, 110, 70, .3)",
                      color: "#0A6E46",
                      background: "rgba(10, 110, 70, .06)",
                      cursor: "pointer"
                    }}
                  >
                    Clear filter <X size={10} />
                  </button>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#0A6E46", background: "rgba(10, 110, 70, 0.08)", padding: "3px 9px", borderRadius: 9999 }}>
                    Click slice to filter
                  </span>
                )}
              </div>
              {revBySource.length > 0 ? (
                <>
                  <div style={{ height: 190, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revBySource}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="50%"
                          outerRadius="74%"
                          paddingAngle={3}
                          isAnimationActive={false}
                          style={{ cursor: "pointer" }}
                          onClick={(d) => {
                            if (d && d.name) {
                              setSelSource(selSource === d.name ? null : d.name);
                            }
                          }}
                        >
                          {revBySource.map((e, i) => (
                            <Cell
                              key={i}
                              fill={e.fill}
                              opacity={selSource === null || selSource === e.name ? 1 : 0.28}
                              stroke={selSource === e.name ? "#1d1d1f" : "none"}
                              strokeWidth={selSource === e.name ? 2.5 : 0}
                              style={{ outline: "none", cursor: "pointer" }}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => inr(Math.round(v))} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", fontSize: 13 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Hole Total */}
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", color: "#86868B" }}>TOTAL REV</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1D1D1F" }}>{inr(revBySourceTotal)}</div>
                    </div>
                  </div>

                  {/* Legend Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 10 }}>
                    {revBySource.map(s => {
                      const isActive = selSource === s.name;
                      const pct = revBySourceTotal > 0 ? Math.round((s.value / revBySourceTotal) * 100) : 0;
                      return (
                        <div
                          key={s.name}
                          onClick={() => setSelSource(isActive ? null : s.name)}
                          style={{
                            cursor: "pointer",
                            padding: "10px 12px",
                            borderRadius: 14,
                            background: isActive ? "rgba(10, 110, 70, 0.06)" : "#FAFBF9",
                            border: isActive ? "1px solid #0A6E46" : "1px solid rgba(0, 0, 0, 0.05)",
                            transition: "all 0.15s ease"
                          }}
                          title={`Click to filter table by ${s.name}`}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#555558", fontWeight: 500 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.fill, flexShrink: 0 }} />
                              {s.name}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: s.pctColor || s.fill }}>{pct}%</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#1D1D1F", marginTop: 2, paddingLeft: 13 }}>{inr(s.value)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Comparison Strip */}
                  <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(10, 110, 70, 0.05)", border: "1px solid rgba(10, 110, 70, 0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, flexWrap: "wrap", gap: 8 }}>
                    <div
                      onClick={() => setKpiModal({ type: "payments", filter: "zoho_all", title: "Zoho Collection Transactions", sub: `All Zoho paid invoices in ${rangeLabel(range)}` })}
                      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                      title="Click to view Zoho payments"
                    >
                      <span style={{ color: "#555558" }}>Zoho share:</span>
                      <span style={{ fontWeight: 700, color: "#0A6E46" }}>{combinedRevCur > 0 ? Math.round((collections / combinedRevCur) * 100) : 0}%</span>
                    </div>
                    <div
                      onClick={() => setKpiModal({ type: "payments", filter: "dp_all", title: "DrinkPrime Transactions", sub: `All DrinkPrime transaction records in ${rangeLabel(range)}` })}
                      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                      title="Click to view DrinkPrime transactions"
                    >
                      <span style={{ color: "#555558" }}>DP share:</span>
                      <span style={{ fontWeight: 700, color: "#5B9530" }}>{combinedRevCur > 0 ? Math.round((dpTotalCur / combinedRevCur) * 100) : 0}%</span>
                    </div>
                  </div>
                </>
              ) : <Empty msg="No revenue data for this period." />}
            </div>

            {/* 7-month combined collection bar (v2.29.391: single-color total
                bar, per explicit user request — the Zoho/DP stack + legend +
                subtitle were "not needed"; renamed from "Combined Monthly
                Collection" to "Monthly Collection", still shows the same
                `total` value per month it always did, just as one bar
                instead of a two-color stack). */}
            <div style={{ ...softShadow, padding: 22, minWidth: 0, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 12px 32px rgba(8,128,90,0.05), 0 2px 6px rgba(0,0,0,0.02)" }}>
              <h3 style={{ fontSize: 16, color: "#1D1D1F", fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.01em" }}>Monthly Collection</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dpM7}
                    margin={{ top: 24, right: 12, left: -6, bottom: 0 }}
                    style={{ cursor: "pointer" }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length) {
                        const p = state.activePayload[0].payload;
                        if (p.y != null && p.m != null) {
                          const fromDate = new Date(p.y, p.m, 1);
                          const toDate = new Date(p.y, p.m + 1, 0);
                          setSel({
                            preset: "custom",
                            from: isoDay(fromDate),
                            to: isoDay(toDate)
                          });
                          flash(`Filtered period to ${p.label} (${monthYr(p.y, p.m)})`);
                        }
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="monthlyCollectionBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#046A4A" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 11.5, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#86868B", fontSize: 11.5, fontWeight: 500 }} axisLine={false} tickLine={false} width={54}
                      tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
                    <Tooltip
                      formatter={(v) => [inr(v), "Collected"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", fontSize: 13 }}
                    />
                    <Bar dataKey="total" name="total" fill="url(#monthlyCollectionBarGradient)" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false}>
                      <LabelList dataKey="total" position="top" formatter={v => v ? inr(v) : ""} style={{ fontSize: 10, fontWeight: 700, fill: "#046A4A", letterSpacing: "-0.01em" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── Total Revenue vs Expected Revenue + MoM Growth Trend ───────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 16 }}>
            {/* Total Revenue vs Expected Revenue */}
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(0, 0, 0, 0.07)", borderRadius: 20, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", padding: 22, minWidth: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ fontSize: 16, color: "#1D1D1F", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Total Revenue vs Expected Revenue</h3>
                </div>
                
                {/* Legend */}
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555558", fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0A6E46" }} /> Total (Actual)
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555558", fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#E3EADE" }} /> Expected (Forecast)
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555558", fontWeight: 500 }}>
                    <span style={{ width: 14, height: 0, borderTop: "2px dashed #76C043" }} /> ARPU
                  </span>
                </div>
              </div>

              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={faData}
                    margin={{ top: 18, right: 30, left: -6, bottom: 0 }}
                    style={{ cursor: "pointer" }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length) {
                        const p = state.activePayload[0].payload;
                        if (p.y != null && p.m != null) {
                          const fromDate = new Date(p.y, p.m, 1);
                          const toDate = new Date(p.y, p.m + 1, 0);
                          setSel({
                            preset: "custom",
                            from: isoDay(fromDate),
                            to: isoDay(toDate)
                          });
                          flash(`Filtered period to ${p.label} (${monthYr(p.y, p.m)})`);
                        }
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="warmThemeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A6E46" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#0A6E46" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12, fontWeight: 500 }} axisLine={{ stroke: "rgba(0, 0, 0, 0.08)" }} tickLine={false} />
                    <YAxis yAxisId="rev" domain={["auto", "auto"]} tick={{ fill: "#86868B", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} width={54} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
                    <YAxis yAxisId="arpu" orientation="right" domain={["auto", "auto"]} tick={{ fill: "#609A32", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={50}
                      tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`} />
                    <Tooltip
                      formatter={(v, n) => v == null ? [null, null] : [inr(v), n === "actual" ? "Total (Actual)" : n === "forecast" ? "Expected (Forecast)" : "ARPU"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: 13 }}
                      labelStyle={{ color: "#1D1D1F", fontWeight: 700, marginBottom: 4 }}
                      itemStyle={{ color: "#1D1D1F", fontWeight: 600 }}
                      cursor={{ fill: "rgba(10,110,70,0.04)" }}
                    />
                    {/* Forecast bar's own value label only shown for the future
                        ("Target") month — per explicit user report ("some
                        values are overlapping each other"), printing this
                        label on every past month too collided with the Actual
                        line's own label sitting at nearly the same height;
                        the Actual line already carries the real number for
                        every month that has one. */}
                    <Bar yAxisId="rev" dataKey="forecast" fill="#EEF2E8" radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                      {faData.map((entry, idx) => (
                        <Cell key={`cell-fc-${idx}`} fill={entry.actual == null ? "#DDE5D4" : "#EEF2E8"} />
                      ))}
                      <LabelList dataKey="forecast" position="top" offset={8} formatter={(v, entry, idx) => (faData[idx] && faData[idx].actual == null) ? `Target: ${inr(v)}` : ""} style={{ fontSize: 9.5, fontWeight: 600, fill: "#697D61" }} />
                    </Bar>
                    <Area yAxisId="rev" type="monotone" dataKey="actual" fill="url(#warmThemeGrad)" stroke="none" isAnimationActive={false} />
                    <Line yAxisId="rev" type="monotone" dataKey="actual" stroke="#0A6E46" strokeWidth={2.8} isAnimationActive={false} dot={{ r: 4, fill: "#FFFFFF", stroke: "#0A6E46", strokeWidth: 2.5 }} connectNulls={false}>
                      <LabelList dataKey="actual" position="top" offset={10} formatter={v => v ? inr(v) : ""} style={{ fontSize: 9.5, fontWeight: 700, fill: "#0A6E46" }} />
                    </Line>
                    <Line yAxisId="arpu" type="monotone" dataKey="arpu" stroke="#76C043" strokeWidth={2.2} strokeDasharray="4 4" isAnimationActive={false} dot={{ r: 3, fill: "#76C043" }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* MoM Growth Trend */}
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(0, 0, 0, 0.07)", borderRadius: 20, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)", padding: 22, minWidth: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ fontSize: 16, color: "#1D1D1F", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>MoM Growth Trend</h3>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555558", fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#EEF2E8" }} /> Collections
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555558", fontWeight: 500 }}>
                    <span style={{ width: 14, height: 0, borderTop: "2.5px solid #0A6E46" }} /> Growth Trend
                  </span>
                </div>
              </div>

              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={momData}
                    margin={{ left: 8, right: 12, top: 26, bottom: 0 }}
                    style={{ cursor: "pointer" }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length) {
                        const p = state.activePayload[0].payload;
                        if (p.y != null && p.m != null) {
                          const fromDate = new Date(p.y, p.m, 1);
                          const toDate = new Date(p.y, p.m + 1, 0);
                          setSel({
                            preset: "custom",
                            from: isoDay(fromDate),
                            to: isoDay(toDate)
                          });
                          flash(`Filtered period to ${p.label} (${monthYr(p.y, p.m)})`);
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12, fontWeight: 500 }} axisLine={{ stroke: "rgba(0, 0, 0, 0.08)" }} tickLine={false} />
                    <YAxis tick={{ fill: "#86868B", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} width={56} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
                    <Tooltip
                      formatter={(v, n) => [inr(v), n]}
                      cursor={{ fill: "rgba(10,110,70,0.04)" }}
                      contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: 13 }}
                      labelStyle={{ color: "#1D1D1F", fontWeight: 700, marginBottom: 4 }}
                      itemStyle={{ color: "#1D1D1F", fontWeight: 600 }}
                    />
                    <Bar dataKey="collected" name="Collected" radius={[6, 6, 0, 0]} fill="#EEF2E8" maxBarSize={32} isAnimationActive={false}>
                      {momData.map((entry, idx) => (
                        <Cell key={`mom-cell-${idx}`} fill={idx === momData.length - 1 ? "#DDE5D4" : "#EEF2E8"} />
                      ))}
                      <LabelList
                        dataKey="pct"
                        content={(props) => {
                          const { x, y, width, value, index } = props;
                          if (value == null) return null;
                          const isLast = index === momData.length - 1;
                          const positive = value > 0;
                          const bg = isLast ? "#0A6E46" : positive ? "rgba(10, 110, 70, 0.1)" : "rgba(220, 65, 65, 0.1)";
                          const fg = isLast ? "#FFFFFF" : positive ? "#0A6E46" : "#DC4141";
                          const text = `${value > 0 ? "+" : ""}${value}%`;
                          const bw = Math.max(34, text.length * 6.5 + 14);
                          const cx = x + width / 2;
                          const cy = y - 12;
                          return (
                            <g key={`pct-${index}`} transform={`translate(${cx},${cy})`}>
                              <rect x={-bw / 2} y={-12} width={bw} height={16} rx={4} fill={bg} />
                              <text x={0} y={-1} fill={fg} fontSize={9} fontWeight={700} textAnchor="middle">{text}</text>
                            </g>
                          );
                        }}
                      />
                    </Bar>
                    <Line
                      type="monotone" dataKey="collected" name="Trend" stroke="#0A6E46" strokeWidth={2.8} isAnimationActive={false}
                      dot={(props) => {
                        const { cx, cy, index } = props;
                        const isLast = index === momData.length - 1;
                        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={isLast ? 4 : 3.5} fill={isLast ? "#0A6E46" : "#ffffff"} stroke="#0A6E46" strokeWidth={2.5} />;
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {(() => {
                const momPeak = momData.reduce((best, m) => (best === null || m.collected > best.collected ? m : best), null);
                let momStreak = 0;
                for (let i = momData.length - 1; i >= 1; i--) {
                  if (momData[i].pct != null && momData[i].pct > 0) momStreak++; else break;
                }
                return (
                  <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: "#FAFBF9", border: "1px solid rgba(0, 0, 0, 0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, flexWrap: "wrap", gap: 6 }}>
                    <span style={{ color: "#86868B" }}>Trailing 7M Peak: <strong style={{ color: "#1D1D1F" }}>{momPeak ? `${momPeak.label} (${inr(momPeak.collected)})` : "—"}</strong></span>
                    {momStreak >= 2 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: "#0A6E46" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0A6E46" }} />
                        {momStreak}-Month Consecutive Growth
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── SaaS Analytics: Plan Distribution & Expansion Opportunities ──── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 16 }}>

            {/* Plan Tier Distribution */}
            <div style={{ ...softShadow, padding: 22, minWidth: 0 }}>
              <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: "0 0 4px" }}>Plan Tier Distribution</h3>
              <div style={{ fontSize: 12, color: "#86868B", marginBottom: 16 }}>Active subscription counts by plan amount (Click bar to drill down)</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={planDistributionData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                    style={{ cursor: "pointer" }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length) {
                        const p = state.activePayload[0].payload;
                        if (p && p.name) {
                          setKpiModal({
                            type: "plan_tier",
                            tierName: p.name,
                            title: `Plan Tier: ${p.name}`,
                            sub: `${p.value} active subscriptions (${p.pct}% of active tiers)`
                          });
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#86868B", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip formatter={(v, n, entry) => [`${entry.payload.pct}% (${v} subscriptions) · Click to view`, "Active Subscriptions"]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", fontSize: 13 }} />
                    <Bar
                      dataKey="value"
                      name="Active Tiers"
                      fill="#2A86D6"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={20}
                      isAnimationActive={false}
                      onClick={(entry) => {
                        const target = entry && (entry.payload || entry);
                        if (target && target.name) {
                          setKpiModal({
                            type: "plan_tier",
                            tierName: target.name,
                            title: `Plan Tier: ${target.name}`,
                            sub: `${target.value} active subscriptions (${target.pct}% of active tiers)`
                          });
                        }
                      }}
                    >
                      {planDistributionData.map((entry, index) => (
                        <Cell
                          key={`tier-cell-${index}`}
                          cursor="pointer"
                          fill="#2A86D6"
                          onClick={() => {
                            setKpiModal({
                              type: "plan_tier",
                              tierName: entry.name,
                              title: `Plan Tier: ${entry.name}`,
                              sub: `${entry.value} active subscriptions (${entry.pct}% of active tiers)`
                            });
                          }}
                        />
                      ))}
                      <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#2A86D6", cursor: "pointer" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expansion Opportunities / Under-Penetrated Buildings */}
            <div style={{ ...softShadow, padding: 22, minWidth: 0 }}>
              <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: "0 0 4px" }}>Under-Penetrated Buildings</h3>
              <div style={{ fontSize: 12, color: "#86868B", marginBottom: 16 }}>Low active density apartments (SLA target opportunity)</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {underPenetratedApts.map(apt => (
                  <div key={apt.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0d2119" }}>{apt.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#DC4141" }}>{apt.pct}% active ({apt.active}/{apt.flats} flats)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                      <div style={{ width: `${apt.pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #DC4141, #F59E0B)" }} />
                    </div>
                  </div>
                ))}
                {underPenetratedApts.length === 0 && (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "#86868B", fontSize: 13 }}>No flat metrics found for active apartments.</div>
                )}
              </div>
            </div>

          </div>

          {/* ── All Apartment Performance Table ───────────────────────────────── */}
          {(() => {
            const displayedAptRows = selSource
              ? allAptRows.filter(r => {
                  if (selSource === "Zoho Recharge") return r.zohoRecharge > 0;
                  if (selSource === "Zoho Deposit") return r.zohoDeposit > 0;
                  if (selSource === "DP Recharge") return r.dpRecharge > 0;
                  if (selSource === "DP Deposit") return r.dpDeposit > 0;
                  if (selSource === "Zoho") return (r.zohoRecharge + r.zohoDeposit) > 0;
                  if (selSource === "DrinkPrime" || selSource === "DP") return (r.dpRecharge + r.dpDeposit) > 0;
                  return true;
                })
              : allAptRows;

            const allAptTotalCusts    = displayedAptRows.reduce((s, r) => s + (r.totalCustomers || 0), 0);
            const allAptTotalZohoDep  = displayedAptRows.reduce((s, r) => s + r.zohoDeposit, 0);
            const allAptTotalZohoRech = displayedAptRows.reduce((s, r) => s + r.zohoRecharge, 0);
            const allAptTotalDpDep    = displayedAptRows.reduce((s, r) => s + r.dpDeposit, 0);
            const allAptTotalDpRech   = displayedAptRows.reduce((s, r) => s + r.dpRecharge, 0);
            const allAptTotalCollected = displayedAptRows.reduce((s, r) => s + r.totalCollected, 0);

            return (
              <div style={{ ...softShadow, padding: 0, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "18px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <div>
                    <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>All Apartment Performance</h3>
                    <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Combined Zoho &amp; DrinkPrime metrics · {rangeLabel(range)}{selSource ? ` · Filtered: ${selSource}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {selSource && (
                      <button
                        onClick={() => setSelSource(null)}
                        style={{ ...btnGhost, fontSize: 11, padding: "3px 8px", color: "#08805A", borderColor: "rgba(8,128,90,0.2)" }}
                      >
                        Showing {selSource} (Clear) <X size={11} />
                      </button>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "rgba(30,158,79,0.1)", color: "#1E9E4F" }}>
                      {displayedAptRows.length} apartments
                    </span>
                  </div>
                </div>
                {displayedAptRows.length > 0 ? (
                  <div className="scroll-thin" style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                      <thead>
                        <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                          <th rowSpan={2} style={{ padding: "13px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: "left", verticalAlign: "middle" }}>Apartment Name</th>
                          <th rowSpan={2} style={{ padding: "13px 14px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: "center", verticalAlign: "middle" }}>Total Customer</th>
                          <th colSpan={2} style={{ padding: "8px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: "center", borderBottom: "1px solid rgba(8,128,90,0.12)" }}>Zoho</th>
                          <th colSpan={2} style={{ padding: "8px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: "center", borderBottom: "1px solid rgba(8,128,90,0.12)" }}>DrinkPrime</th>
                          <th rowSpan={2} style={{ padding: "13px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: "center", verticalAlign: "middle" }}>Total</th>
                        </tr>
                        <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                          <th style={{ padding: "6px 18px", fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "#64748B", fontWeight: 700, textAlign: "center" }}>Deposit</th>
                          <th style={{ padding: "6px 18px", fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "#64748B", fontWeight: 700, textAlign: "center" }}>Recharge</th>
                          <th style={{ padding: "6px 18px", fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "#64748B", fontWeight: 700, textAlign: "center" }}>Deposit</th>
                          <th style={{ padding: "6px 18px", fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "#64748B", fontWeight: 700, textAlign: "center" }}>Recharge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedAptRows.map((r, i) => {
                          const isSelected = selSoc && selSoc.includes(r.name);
                          return (
                            <tr
                              key={r.name}
                              onClick={() => setSelSoc(isSelected ? null : [r.name])}
                              style={{
                                borderBottom: "1px solid rgba(0,0,0,0.04)",
                                cursor: "pointer",
                                background: isSelected
                                  ? "rgba(8,128,90,0.06)"
                                  : (i % 2 === 0 ? "transparent" : "rgba(243,248,236,.3)"),
                                transition: "background .15s ease"
                              }}
                            >
                              <td
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAptDetails(r.name);
                                }}
                                style={{
                                  padding: "13px 18px",
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  color: "#08805A",
                                  textDecoration: "underline",
                                  whiteSpace: "nowrap",
                                  textAlign: "left",
                                  cursor: "pointer"
                                }}
                                title="Click to view apartment details & recharge customers"
                              >
                                {r.name}
                              </td>
                              <td
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setKpiModal({
                                    type: "active_customers",
                                    aptFilter: r.name,
                                    title: `${r.name} · Active Customers`,
                                    sub: `${r.totalCustomers || 0} active customers in ${r.name}`
                                  });
                                }}
                                style={{
                                  padding: "13px 14px",
                                  textAlign: "center",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "#08805A",
                                  textDecoration: "underline",
                                  cursor: "pointer"
                                }}
                                title="Click to view active customer directory for this apartment"
                              >
                                {r.totalCustomers || 0}
                              </td>
                              <td
                                onClick={(e) => {
                                  if (r.zohoDeposit > 0) {
                                    e.stopPropagation();
                                    setKpiModal({
                                      type: "payments",
                                      aptFilter: r.name,
                                      filter: "zoho_deposit",
                                      title: `${r.name} · Zoho Deposit`,
                                      sub: `Zoho deposit payments in ${rangeLabel(range)}`
                                    });
                                  }
                                }}
                                style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, color: "#475569", cursor: r.zohoDeposit > 0 ? "pointer" : "default" }}
                                title={r.zohoDeposit > 0 ? "Click to view Zoho deposit payments" : ""}
                              >
                                {r.zohoDeposit > 0 ? inr(Math.round(r.zohoDeposit)) : "—"}
                              </td>
                              <td
                                onClick={(e) => {
                                  if (r.zohoRecharge > 0) {
                                    e.stopPropagation();
                                    setKpiModal({
                                      type: "payments",
                                      aptFilter: r.name,
                                      filter: "zoho_recharge",
                                      title: `${r.name} · Zoho Recharge`,
                                      sub: `Zoho recharge payments in ${rangeLabel(range)}`
                                    });
                                  }
                                }}
                                style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, color: "#08805A", fontWeight: 600, cursor: r.zohoRecharge > 0 ? "pointer" : "default" }}
                                title={r.zohoRecharge > 0 ? "Click to view Zoho recharge payments" : ""}
                              >
                                {r.zohoRecharge > 0 ? inr(Math.round(r.zohoRecharge)) : "—"}
                              </td>
                              <td
                                onClick={(e) => {
                                  if (r.dpDeposit > 0) {
                                    e.stopPropagation();
                                    setKpiModal({
                                      type: "payments",
                                      aptFilter: r.name,
                                      filter: "dp_deposit",
                                      title: `${r.name} · DrinkPrime Deposit`,
                                      sub: `DrinkPrime deposit records in ${rangeLabel(range)}`
                                    });
                                  }
                                }}
                                style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, color: "#475569", cursor: r.dpDeposit > 0 ? "pointer" : "default" }}
                                title={r.dpDeposit > 0 ? "Click to view DrinkPrime deposit records" : ""}
                              >
                                {r.dpDeposit > 0 ? inr(Math.round(r.dpDeposit)) : "—"}
                              </td>
                              <td
                                onClick={(e) => {
                                  if (r.dpRecharge > 0) {
                                    e.stopPropagation();
                                    setKpiModal({
                                      type: "payments",
                                      aptFilter: r.name,
                                      filter: "dp_recharge",
                                      title: `${r.name} · DrinkPrime Recharge`,
                                      sub: `DrinkPrime recharge records in ${rangeLabel(range)}`
                                    });
                                  }
                                }}
                                style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, color: "#08805A", fontWeight: 600, cursor: r.dpRecharge > 0 ? "pointer" : "default" }}
                                title={r.dpRecharge > 0 ? "Click to view DrinkPrime recharge records" : ""}
                              >
                                {r.dpRecharge > 0 ? inr(Math.round(r.dpRecharge)) : "—"}
                              </td>
                              <td
                                onClick={(e) => {
                                  if (r.totalCollected > 0) {
                                    e.stopPropagation();
                                    setKpiModal({
                                      type: "payments",
                                      aptFilter: r.name,
                                      filter: "all",
                                      title: `${r.name} · All Payments`,
                                      sub: `All payments in ${rangeLabel(range)}`
                                    });
                                  }
                                }}
                                style={{ padding: "13px 18px", textAlign: "center", fontSize: 13.5, fontWeight: 800, color: "#1D1D1F", cursor: r.totalCollected > 0 ? "pointer" : "default" }}
                                title="Click to view all payments for this apartment"
                              >
                                {inr(Math.round(r.totalCollected))}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: "rgba(243,248,236,.6)", borderTop: "2px solid rgba(8,128,90,.15)" }}>
                          <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 800, color: "#0d2119", textAlign: "left" }}>Total ({displayedAptRows.length})</td>
                          <td
                            onClick={() => setKpiModal({ type: "active_customers", title: "Active Customers Directory", sub: "All active customer subscriptions across Zoho & DrinkPrime" })}
                            style={{ padding: "13px 14px", textAlign: "center", fontSize: 13, fontWeight: 800, color: "#08805A", textDecoration: "underline", cursor: "pointer" }}
                            title="Click to view all active customers"
                          >
                            {allAptTotalCusts}
                          </td>
                          <td
                            onClick={() => setKpiModal({ type: "payments", filter: "zoho_deposit", title: "All Zoho Deposits", sub: `All Zoho deposit payments in ${rangeLabel(range)}` })}
                            style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            title="Click to view all Zoho deposit payments"
                          >
                            {allAptTotalZohoDep > 0 ? inr(Math.round(allAptTotalZohoDep)) : "—"}
                          </td>
                          <td
                            onClick={() => setKpiModal({ type: "payments", filter: "zoho_recharge", title: "All Zoho Recharges", sub: `All Zoho recharge payments in ${rangeLabel(range)}` })}
                            style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 800, color: "#08805A", cursor: "pointer" }}
                            title="Click to view all Zoho recharge payments"
                          >
                            {allAptTotalZohoRech > 0 ? inr(Math.round(allAptTotalZohoRech)) : "—"}
                          </td>
                          <td
                            onClick={() => setKpiModal({ type: "payments", filter: "dp_deposit", title: "All DrinkPrime Deposits", sub: `All DrinkPrime deposit records in ${rangeLabel(range)}` })}
                            style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            title="Click to view all DrinkPrime deposit records"
                          >
                            {allAptTotalDpDep > 0 ? inr(Math.round(allAptTotalDpDep)) : "—"}
                          </td>
                          <td
                            onClick={() => setKpiModal({ type: "payments", filter: "dp_recharge", title: "All DrinkPrime Recharges", sub: `All DrinkPrime recharge records in ${rangeLabel(range)}` })}
                            style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 800, color: "#08805A", cursor: "pointer" }}
                            title="Click to view all DrinkPrime recharge records"
                          >
                            {allAptTotalDpRech > 0 ? inr(Math.round(allAptTotalDpRech)) : "—"}
                          </td>
                          <td
                            onClick={() => setKpiModal({ type: "payments", filter: "all", title: "Total Collection Transactions", sub: `All Zoho & DrinkPrime paid transactions in ${rangeLabel(range)}` })}
                            style={{ padding: "13px 18px", textAlign: "center", fontSize: 13.5, fontWeight: 800, color: "#1D1D1F", cursor: "pointer" }}
                            title="Click to view all transactions"
                          >
                            {inr(Math.round(allAptTotalCollected))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "28px 0" }}><Empty msg="No society data in this period." /></div>
                )}
              </div>
            );
          })()}

        </>
      )}

      {renderKpiDrilldownModal()}
      {renderAptDetailsModal()}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "#1D1D1F",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
          {toast}
        </div>
      )}
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
  if (!customers) return <Loading title="Loading Credits Analytics" subtitle="Synchronizing referral credit records…" />;

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

  const totalDiscount = filteredNotes.reduce((s, cn) => s + (cn.amount || 0), 0);
  const totalBalance = filteredNotes.reduce((s, cn) => s + (cn.balance || 0), 0);
  const noteCount = filteredNotes.length;
  const custCount = new Set(filteredNotes.map(cn => cn.zohoCustomerId || cn.id)).size;

  // One row per credit note (v2.29.348) — was previously aggregated per
  // customer (summing all of a customer's notes into one row), which had no
  // room for each note's OWN Credit Note # / Invoice #. Per explicit user
  // request (with a Zoho-style reference screenshot), switched to a flat
  // per-note listing so both fields — already parsed by mapCreditNote() as
  // `.number` (creditnote_number) and `.invoicesApplied`/`.invoiceNumber`
  // (invoice_number) — can be shown as their own columns; the same customer
  // can now correctly appear on more than one row, one per note.
  const noteRows = filteredNotes
    .map(cn => {
      const c = noteCust(cn);
      return {
        ...cn,
        custName: c?.name || cn.customerName || cn.zohoCustomerId || "—",
        custEmail: c?.email,
        society: c?.society || "Unknown",
        invoiceDisplay: (cn.invoicesApplied && cn.invoicesApplied.length) ? cn.invoicesApplied.join(",") : (cn.invoiceNumber || ""),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ql = q.trim().toLowerCase();
  const shownRows = ql
    ? noteRows.filter(r => `${r.custName} ${r.custEmail} ${r.society} ${r.number} ${r.invoiceDisplay} ${r.status}`.toLowerCase().includes(ql))
    : noteRows;

  const exportCsv = () => exportToCsv("prowater-credit-notes.csv", [
    { label: "Customer", get: r => r.custName },
    { label: "Email", get: r => r.custEmail },
    { label: "Society", get: r => r.society },
    { label: "Credit Note #", get: r => r.number },
    { label: "Invoice #", get: r => r.invoiceDisplay },
    { label: "Status", get: r => r.status },
    { label: "Amount", get: r => r.amount },
    { label: "Balance", get: r => r.balance },
    { label: "Date", get: r => r.date ? fmtDate(r.date) : "" },
  ], noteRows);


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
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Credit Notes</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{noteCount} credit notes · {custCount} customers · {inr(totalDiscount)} given · {inr(totalBalance)} balance</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 380px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 960 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Customer", "Society", "Credit Note #", "Invoice #", "Status", "Amount", "Balance", "Date"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r, i) => {
                  // "open" gets its own amber treatment (not the shared green/yellow
                  // status-badge palette, per explicit user feedback that its default
                  // yellow-green read poorly) — the whole row is tinted amber, not just
                  // the status cell, so an open note is easy to spot scanning the table.
                  const isOpen = String(r.status || "").toLowerCase() === "open";
                  const isClosed = String(r.status || "").toLowerCase() === "closed";
                  return (
                  <tr key={r.id || i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", background: isOpen ? "rgba(152,99,21,0.07)" : undefined }}>
                    <td style={{ padding: "14px 18px" }}><Person name={r.custName || "—"} email={r.custEmail} /></td>
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.society}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#0d2119", whiteSpace: "nowrap" }}>{r.number || "—"}</td>
                    <td style={{ padding: "14px 18px", color: "#475569", whiteSpace: "nowrap" }}>{r.invoiceDisplay || "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, textTransform: "uppercase", fontSize: 11.5, color: isOpen ? "#986315" : isClosed ? "#08805A" : "#475569" }}>{r.status || "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#986315" }}>{inr(r.amount)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: r.balance > 0 ? "#986315" : "#08805a" }}>{inr(r.balance)}</td>
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap", color: "#86868b", fontSize: 12 }}>{r.date ? fmtDate(r.date) : "—"}</td>
                  </tr>
                  );
                })}
                {shownRows.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119" }} colSpan={5}>Total ({noteCount} notes)</td>
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
  if (!invs || !custs) return <Loading title="Loading Net Revenue" subtitle="Synchronizing invoices and customer records…" />;

  // Join invoices → customer society (customer_id == customer zoho_customer_id),
  // so the apartment filter can scope revenue to a single society.
  const custByZoho = {};
  custs.forEach(c => { [c.zohoId, c.id, c.customerNumber].forEach(k => { if (k) custByZoho[k] = c; }); });
  const custOf = (i) => {
    for (const k of [i.zohoCustomerId, i.zohoId, i.customerNumber]) { if (k && custByZoho[k]) return custByZoho[k]; }
    return null;
  };
  const societyOf = (i) => canonicalSociety(custOf(i)?.society || i.society || "Unknown");

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
            <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(30, 158, 79,.08)" }} />
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, padding: "14px 18px", background: "linear-gradient(135deg, #1E9E4F 0%, #C4E538 100%)", color: "#fff", borderRadius: 12 }}>
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

export function PenetrationTracker({ subsData, custsData, societyFilter = null, stackFilter = null, asOf, embedded = false } = {}) {
  const { user } = useAuth();
  const [, forceRerender] = useState(0);                       // re-render after a launch edit
  const canEditLaunch = user.role === "admin" && !embedded;    // only admins, only in the standalone view
  // When embedded in the Overview, the parent passes already-loaded subs/customers
  // (plus the society filter, stack filter and an as-of date) so this view follows the page filters.
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
  if (!data) return <Loading title="Loading Penetration Tracker" subtitle="Synchronizing subscriber and society data…" />;

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

  // Stack filter & Society filter scoping
  const stackOk = (st) => !stackFilter || stackFilter.length === 0 || stackFilter.includes(st);
  const socFilterSet = societyFilter && societyFilter.length ? new Set(societyFilter) : null;

  const custsFromSubs = stackOk("Zoho")
    ? data.subs
        .map(s => ({ society: canonicalSociety(societyOfSub(s)), since: parseFlexDate(s.createdAt || s.activatedAt) }))
        .filter(x => x.society && x.since && isRealSociety(x.society) && (!socFilterSet || socFilterSet.has(x.society)))
    : [];

  const custsFromDp = stackOk("DP")
    ? (data.custs || [])
        .filter(c => c.isDpCustomer)
        .map(c => ({ society: canonicalSociety(c.society || ""), since: parseFlexDate(c.since) }))
        .filter(x => x.society && x.since && isRealSociety(x.society) && (!socFilterSet || socFilterSet.has(x.society)))
    : [];

  const custs = [...custsFromSubs, ...custsFromDp];

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
  if (!data) return <Loading title="Loading Billing Analytics" subtitle="Synchronizing billing and revenue records…" />;

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
  const societyOf = (rec) => canonicalSociety(custOf(rec)?.society || rec.society || "Unknown");

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
          style={{ ...btnPrimary, background: "linear-gradient(135deg, #1E9E4F 0%, #C4E538 100%)", border: "none", padding: "7px 18px", fontSize: 12.5, boxShadow: "0 6px 16px rgba(8,128,90,0.25)" }}>Update</button>
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
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 18,
              padding: "18px 20px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
              outline: drill === s.key ? "2.5px solid #08805A" : "none",
              outlineOffset: 2,
              transition: "transform .15s ease, boxShadow .15s ease"
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color="#08805A" />
              </div>
            </div>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "#86868B", fontWeight: 500, marginTop: 4 }}>{s.sub}</div>
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
                  <stop offset="100%" stopColor="#1E9E4F" stopOpacity={0.7} />
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
                    <stop offset="100%" stopColor="#1E9E4F" stopOpacity={0.7} />
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
  const socs = ["MJR Clique Hydra Apartment", "Prestige Lakeside", "Sobha Dream Acres", "Brigade Gateway", "Purva Highlands"];
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
  if (!rows) return <Loading title="Loading App Logs" subtitle="Synchronizing the activity audit trail…" />;

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
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", textAlign: "center", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "16%" }}>User</th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "10%" }}>Phone</th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "15%" }}>Apartment</th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "12%" }}>Purifier ID</th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "12%" }}>Device</th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "11%" }}>IP</th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "13%" }}>
                    <SortHeader key="lt" label="Login time" k="loginTime" sort={sort} onSort={toggleSort} />
                  </th>
                  <th style={{ padding: "12px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1, width: "11%" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "12px 10px", overflow: "hidden" }}><Person name={r.name || "—"} email={r.email} /></td>
                    <td style={{ padding: "12px 10px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtPhone(r.phone)}</td>
                    <td style={{ padding: "12px 10px", fontSize: 12.5, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.apartment}>{r.apartment || "—"}</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }}>{r.purifierId && r.purifierId !== "null" ? <Chip>{r.purifierId}</Chip> : "—"}</td>
                    <td style={{ padding: "12px 10px", fontSize: 12, color: "#86868b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.device}>{trunc(r.device, 26)}</td>
                    <td style={{ padding: "12px 10px", fontSize: 12, fontFamily: "ui-monospace,monospace", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.ip}>{trunc(r.ip, 22)}</td>
                    <td style={{ padding: "12px 10px", fontSize: 12.5, whiteSpace: "nowrap", color: "#86868b", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtLogin(r.loginTime)}</td>
                    <td style={{ padding: "12px 10px", overflow: "hidden" }} title={String(r.status || "")}>{renderHigStatusBadge(trunc(r.status, 20))}</td>
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
  const [cnPopup, setCnPopup] = useState(null); // credit note detail popup
  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: (key === "paid" || key === "due" || key === "nextBilling") ? "asc" : "desc" });
  const [search, setSearch] = useState(""); // per-invoice table search (customer / mobile / apartment)
  useEffect(() => {
    api.logView(user.username, "Viewed Earned Revenue");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions(), billingApi.getSubmodules().catch(() => []), customerApi.getCustomers().catch(() => []), billingApi.getPlans().catch(() => [...SEED_PLANS]), creditNoteApi.getCreditNotes().catch(() => [])])
      .then(([inv, subs, mods, cust, plans, creditNotes]) => setData({ inv, subs, mods, cust, plans, creditNotes }))
      .catch(() => setData({ inv: [], subs: [], mods: [], cust: [], plans: [], creditNotes: [] }));
  }, []);
  if (!data) return <Loading title="Loading Earned Revenue" subtitle="Synchronizing recognized revenue data…" />;

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
  const societyOf = (i) => canonicalSociety(custOf(i)?.society || i.society || "Unknown");

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

  // Credit column (v2.29.292, real credit-note number v2.29.293) — indexes
  // GET /admin/get-all-creditnotes by the invoice number(s) it was applied
  // to (a credit note can carry its link either as a top-level
  // invoice_number or inside an invoices_applied array — see mapCreditNote).
  // A given invoice number maps to at most one credit note in practice; if
  // more than one somehow matched, the last one wins (harmless — this is a
  // display enrichment, not the underlying Deposit/Recharge math).
  const creditByInvoiceNumber = {};
  (data.creditNotes || []).forEach(cn => {
    [cn.invoiceNumber, ...(cn.invoicesApplied || [])].filter(Boolean).forEach(num => { creditByInvoiceNumber[num] = cn; });
  });
  // Fallback match: customer + exact amount (v2.29.294) — confirmed via real
  // live data that invoice_number/invoices_applied come back empty on every
  // credit note, so creditByInvoiceNumber above never actually matches
  // anything live (kept anyway — harmless, and starts working for free if
  // the feed is ever fixed upstream). Per explicit user decision: among a
  // customer's own credit notes, prefer the one whose actually-applied
  // amount (totalCreditsUsed, falling back to the note's own total) exactly
  // equals the invoice's total — the strongest signal available without a
  // real invoice link, and safer than picking a customer's most recent note
  // regardless of amount (which could easily be the wrong one when a
  // customer has several notes).
  const creditsByCustomer = {};
  (data.creditNotes || []).forEach(cn => { if (cn.zohoCustomerId) (creditsByCustomer[cn.zohoCustomerId] ||= []).push(cn); });

  // Deposit/Recharge plan lookup (v2.29.280, live-wired v2.29.289) — per
  // explicit user request, confirmed against a real example: invoice
  // INV-000706 (₹2,399 total, plan "ProWater Advance"/pro_advance) was
  // showing Deposit ₹0 / Recharge ₹2,399 because its plan_code never matched;
  // the correct plan has Setup Fee ₹2,000 / Recurring Price ₹399
  // (₹2,000+₹399=₹2,399, confirming the match), so it should read Deposit
  // ₹2,000 / Recharge ₹399 instead.
  //
  // Deliberately a LOCAL helper, not a change to the shared `planInfo`/
  // `depositForCustomer` in shared/core.js — those two are also called by
  // ~8 other reports across this file (Overview, Reconciliation, etc.) that
  // were never part of this request; changing the shared functions would
  // have silently changed numbers in every one of those unrelated reports
  // too. Keeping this scoped to Earned Revenue's own rows only.
  //
  // Also deliberately does NOT blindly set deposit=setupFee/recharge=price
  // for every matched plan regardless of amount — a RECURRING recharge-only
  // invoice (deposit already collected on an earlier invoice) can have a
  // total far below the plan's setupFee, and forcing that fee onto it would
  // show a deposit bigger than the invoice's own total (impossible, and the
  // exact kind of nonsensical number that's worse than the original bug).
  // So: only split into Setup Fee + remainder when the invoice's real total
  // actually covers the fee (a first/setup invoice); otherwise the whole
  // total stays Recharge, same convention the rest of the app already uses.
  //
  // v2.29.283 — real-world case found via the Plan Code column added above:
  // some invoices' plan_code is a real, valid, but WRONG-variant catalog
  // entry for that specific invoice (a data-sync issue between our backend
  // and Zoho, not fixable here) — e.g. a zero-deposit plan code on an
  // invoice whose real line item is actually the deposit-bearing sibling
  // variant. Exact-code matching alone can't tell these apart when two
  // plans share the same display NAME. But we DO know the invoice's own
  // real total, and every plan carries its own expected Total (setup_fee +
  // recurring_price) — so among every candidate plan sharing this code OR
  // this name, prefer whichever one's Total exactly equals what was
  // actually charged, regardless of which one the plan_code field pointed at.
  //
  // v2.29.289 — per explicit user request, the lookup now reads live plan
  // records from `billingApi.getPlans()` (GET /admin/subs-module-get-all-plans,
  // same source as Billing & Subscription > Plans) instead of the static
  // PLAN_CATALOG constant, falling back to SEED_PLANS (PLAN_CATALOG reshaped)
  // when the live fetch is unreachable — same fallback the Plans page uses,
  // so a dead API leaves this lookup working exactly as it did before.
  const lookupPlanEntry = (code, name, amount) => {
    const c = String(code || "").trim().toLowerCase();
    const n = String(name || "").trim().toLowerCase();
    if (!c && !n) return null;
    const plans = (data.plans && data.plans.length) ? data.plans : SEED_PLANS;
    const codeMatch = c && plans.find(v => String(v.code || "").trim().toLowerCase() === c);
    const candidates = plans.filter(v =>
      (c && String(v.code || "").trim().toLowerCase() === c) || (n && String(v.name || "").trim().toLowerCase() === n));
    if (!candidates.length) return null;
    const totalMatch = candidates.find(v => (v.total || 0) === amount);
    // No candidate's Total matches the real invoice amount (e.g. a partial
    // payment) — fall back to the exact code match if there is one, else
    // just the first name match (original priority order).
    return totalMatch || (codeMatch || candidates[0]);
  };

  const rows = data.inv.filter(i => i.status === "paid" && (i.total || 0) > 0).map(i => {
    const sub = subFor(i);
    const plan = sub?.plan || i.plan || "—";
    const planCode = sub?.planCode || i.planCode || "";
    const total = i.total || 0;
    const planEntry = lookupPlanEntry(planCode, plan, total);
    const catalogFee = planEntry?.setupFee || 0;
    // deposit+recharge always sums back to the real invoice total — see the
    // lookupPlanEntry comment above for why this doesn't just always use
    // setupFee/price directly.
    const deposit = (planEntry && catalogFee > 0 && total >= catalogFee) ? catalogFee : (planEntry ? 0 : depositForCustomer(custOf(i), plan, total, planCode));
    const recharge = Math.max(0, total - deposit);
    const months = termMonths(sub || { intervalCount: i.intervalCount, intervalUnit: i.intervalUnit, interval: i.interval, plan }) || 1;
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
    // (e.g. "1 month" / "3 months" / "1 year").
    //
    // v2.29.290 — per explicit user report: this showed "—" for plenty of
    // real invoices even though the exact same plan_code correctly shows a
    // Tenure elsewhere (e.g. prowater_mineral_monthly → "1 months" on
    // Billing & Subscription > Plans) — the submodule feed simply doesn't
    // have a match for every invoice, and until now there was no fallback at
    // all when it didn't. `planEntry` (the same live-plans match already
    // used for Deposit/Recharge above) carries its own billEvery/
    // billingInterval, sourced from the identical live API's interval/
    // interval_unit fields — so when the submodule match is missing, fall
    // back to the matched plan's own tenure instead of a bare dash.
    const intervalLabel = (modMatch?.intervalCount != null && modMatch.intervalUnit)
      ? `${modMatch.intervalCount} ${modMatch.intervalCount === 1 ? modMatch.intervalUnit.replace(/s$/, "") : modMatch.intervalUnit}`
      : (planEntry && planEntry.billEvery && planEntry.billingInterval)
        ? `${planEntry.billEvery} ${planEntry.billEvery === 1 ? String(planEntry.billingInterval).replace(/s$/, "") : planEntry.billingInterval}`
        : null;
    const fallbackDue = i.dueDate ? startOfDay(new Date(i.dueDate)) : null;
    const fallbackDueValid = fallbackDue && !isNaN(fallbackDue.getTime());
    // Start Date is shown for reference only (v2.29.107) — it no longer feeds
    // the earning math, see the tenure model below.
    const dd = (modStart && !isNaN(modStart.getTime())) ? modStart : fallbackDue;
    const dueValid = dd && !isNaN(dd.getTime());
    // Fallback End Date (submodule join miss): due date + the plan's REAL term
    // length, not a hardcoded "+1 month" — `months` (from termMonths(sub), a
    // few lines above) already knows this is a 12-month plan, a 1-month plan,
    // etc. Fixed after a real user report: a 12-month subscription's End Date
    // was showing exactly one month out (07 Sept 2026 -> 06 Oct 2026 instead
    // of ~07 Sept 2027) whenever the submodule join missed for that invoice.
    const nb = (modEnd && !isNaN(modEnd.getTime())) ? modEnd
      : (fallbackDueValid ? new Date(fallbackDue.getFullYear(), fallbackDue.getMonth() + Math.round(months), fallbackDue.getDate() - 1) : null);
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
    // Credit column (v2.29.292, real credit-note number v2.29.293) — per
    // explicit user domain knowledge: a blank Reference Number on an invoice
    // means a credit was applied to it in Zoho (a real invoice can be
    // fully/partially settled by a credit note rather than a payment
    // reference), so a missing reference number is a reliable signal, not a
    // data-quality gap. Read from the RAW invoice field, not
    // `referenceNumber` below — that field already defaults to "—" for
    // display, which would make every row look credited.
    const creditApplied = !i.referenceNumber;
    // When a credit IS implied, look up the specific note so the column can
    // show the real creditnote_number (e.g. "CN-00014") instead of just
    // "Yes". Two strategies, in order: (1) the explicit invoice link
    // (creditByInvoiceNumber — works if the feed ever populates
    // invoice_number/invoices_applied; confirmed live it currently doesn't),
    // (2) per explicit user decision, among this customer's OWN credit
    // notes, the one whose actually-applied amount exactly matches this
    // invoice's total. Falls back to the generic "Yes" when neither finds a
    // confident match — showing a guessed/wrong note would be worse.
    let creditNoteNumber = "", creditNoteObj = null;
    if (creditApplied) {
      if (i.number && creditByInvoiceNumber[i.number]) {
        creditNoteNumber = creditByInvoiceNumber[i.number].number;
        creditNoteObj = creditByInvoiceNumber[i.number];
      } else {
        const custId = i.zohoCustomerId || i.zohoId || "";
        const candidates = custId ? (creditsByCustomer[custId] || []) : [];
        const exact = candidates.find(cn => Math.abs((cn.totalCreditsUsed ?? cn.amount ?? 0) - total) < 0.01);
        if (exact) { creditNoteNumber = exact.number; creditNoteObj = exact; }
      }
    }
    return { invoiceId: i.id || "—", invoiceNumber: i.number || "—", referenceNumber: i.referenceNumber || "—", creditApplied, creditNoteNumber, creditNoteObj, paymentMode: i.paymentMode || "—", customer: i.customerName || "—", phone: custOf(i)?.phone || "", society: societyOf(i), plan, planCode, planMatched: !!planEntry, total, deposit, recharge, months, intervalLabel, earnedPerMonth,
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
  const rawMonths = Array.from({ length: 13 }, (_, k) => _addMonths(anchorY, anchorM, k - 12))
    .filter(([y, m]) => y > 2025 || (y === 2025 && m >= 12));
  
  const monthlyData = rawMonths.map(([y, m]) => {
    const inMonth = aptRows.filter(r => paidInMonth(r, y, m));
    return {
      y, m,
      earned: Math.round(inMonth.reduce((s, r) => s + r.earnedRevenue, 0)),
      recharge: Math.round(inMonth.reduce((s, r) => s + r.recharge, 0)),
    };
  });

  const timeline = [];
  const liveY = new Date().getFullYear();
  const liveM = new Date().getMonth() + 1;

  for (let i = 1; i < monthlyData.length; i++) {
    const curr = monthlyData[i];
    const prev = monthlyData[i - 1];

    if (!(curr.y > 2026 || (curr.y === 2026 && curr.m >= 1))) continue;

    const earnedDelta = prev.earned > 0 ? Math.round(((curr.earned - prev.earned) / prev.earned) * 100) : null;
    const rechargeDelta = prev.recharge > 0 ? Math.round(((curr.recharge - prev.recharge) / prev.recharge) * 100) : null;

    timeline.push({
      label: _monthShort(curr.y, curr.m),
      earned: curr.earned,
      recharge: curr.recharge,
      y: curr.y,
      m: curr.m,
      earnedDelta,
      rechargeDelta,
    });
  }

  const stats = [
    { label: "Total Collection", value: inr(Math.round(totalCollection)), icon: Wallet, sub: rangeText, hero: true, delta: momPct(totalCollection, totalCollectionPrev) },
    { label: "Earned Revenue", value: inr(Math.round(earnedRevenue)), icon: Scale, sub: `recognised · ${periodLabel}`, hero: true, delta: momPct(earnedRevenue, earnedRevenuePrev) },
    { label: "Recharge collected", value: inr(Math.round(rechargeNow)), icon: Repeat, sub: `revenue portion · total ${inr(totalCollection)}`, delta: momPct(rechargeNow, rechargePrev) },
    { label: "Deposit collected", value: inr(Math.round(depositNow)), icon: Coins, sub: "total − recharge" },
    { label: "Contributing recharges", value: collectNow.filter(r => r.recharge > 0).length, icon: Receipt, sub: `paid in ${periodLabel}` },
  ];

  const exportCsv = () => exportToCsv(`prowater-earned-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
    { label: "Invoice #", get: r => r.invoiceNumber }, { label: "Invoice ID", get: r => r.invoiceId },
    { label: "Reference Number", get: r => r.referenceNumber }, { label: "Credit", get: r => r.creditApplied ? (r.creditNoteNumber || "Yes") : "(-)" }, { label: "Payment Mode", get: r => r.paymentMode },
    { label: "Customer", get: r => r.customer }, { label: "Mobile Number", get: r => r.phone }, { label: "Apartment", get: r => r.society }, { label: "Plan", get: r => r.plan },
    { label: "Plan Code", get: r => r.planCode }, { label: "Matched in Plan List", get: r => r.planMatched ? "Yes" : "No" },
    { label: "Start Date", get: r => r.dueDay ? fmtDate(r.dueDay) : "" },
    { label: "Paid on", get: r => (r.payDay && !isNaN(r.payDay.getTime())) ? fmtDate(r.payDay) : "" },
    { label: "End Date", get: r => r.nextBillDay ? fmtDate(r.nextBillDay) : "" },
    { label: "Total paid", get: r => r.total }, { label: "Deposit", get: r => r.deposit }, { label: "Recharge", get: r => r.recharge },
    { label: "Interval", get: r => r.intervalLabel || "" },
    { label: "Earned/month", get: r => r.earnedPerMonth },
    { label: "Tenure days", get: r => r.tenureDays ?? "" },
    { label: "Earned revenue", get: r => r.earnedRevenue.toFixed(2) },
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
        || (r.referenceNumber || "").toLowerCase().includes(searchQ) || (r.invoiceNumber || "").toLowerCase().includes(searchQ)
        || (searchDigits && (r.phone || "").replace(/\D/g, "").includes(searchDigits)))
    : sortedRows;
  const visTotal = tableRows.reduce((a, r) => ({
    total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge,
    earned: a.earned + r.earnedRevenue, remDaysEarned: a.remDaysEarned + r.remainingDaysEarned, remMonthEarned: a.remMonthEarned + r.remainingMonthEarned,
  }), { total: 0, deposit: 0, recharge: 0, earned: 0, remDaysEarned: 0, remMonthEarned: 0 });
  const EarnedRechargeTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const fmtPct = (val) => {
      if (val == null) return null;
      if (val > 0) return ` (▲ +${val}%)`;
      if (val < 0) return ` (▼ ${val}%)`;
      return ` (0%)`;
    };
    return (
      <div style={{ background: "var(--forest)", color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow-lg)", fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif" }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12.5 }}>{label}</div>
        {payload.map((p, i) => {
          const isEarned = p.dataKey === "earned";
          const delta = isEarned ? data.earnedDelta : data.rechargeDelta;
          const deltaStr = fmtPct(delta);
          const color = isEarned ? "#8DC63F" : "#F59E0B";
          const isNeg = delta != null && delta < 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color || color, flexShrink: 0 }} />
              <span>
                {p.name}: <strong>{inr(p.value)}</strong>
                {deltaStr && <span style={{ color: isNeg ? "#ff4d4d" : "#a3e635", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>{deltaStr}</span>}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

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
        {/* v2.29.274: `hero` no longer renders a gradient card — per explicit
            user request to make all hero cards the same white style as
            normal cards, so this delta badge is now always the plain
            tinted-pill treatment the non-hero branch already used. */}
        {stats.map((s, i) => (
          <div key={i} style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>
                {s.label}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(8,128,90,0.12)", display: "grid", placeItems: "center" }}>
                <s.icon size={17} color="#08805A" />
              </div>
            </div>
            <div style={{ fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif", fontWeight: 700, fontSize: 28, color: "#1D1D1F", margin: "10px 0 4px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {s.value}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <div style={{ fontSize: 12, color: "#86868B", fontWeight: 500 }}>{s.sub}</div>
              {s.delta != null && Number.isFinite(s.delta) && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap",
                  background: s.delta > 0 ? "rgba(8,128,90,0.12)" : "rgba(220,38,38,0.1)",
                  color: s.delta > 0 ? "#08805a" : "#dc2626"
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
                <linearGradient id="liveEarnedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08805A">
                    <animate attributeName="stop-opacity" values="0.9;0.3;0.9" dur="1.5s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="#0A7D53">
                    <animate attributeName="stop-opacity" values="0.7;0.15;0.7" dur="1.5s" repeatCount="indefinite" />
                  </stop>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} tickMargin={12} height={38} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#86868B", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={64} tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`} />
              <Tooltip content={<EarnedRechargeTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12.5, color: "#1D1D1F", paddingTop: 10 }} />
              <Bar dataKey="earned" name="Earned" radius={[8, 8, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {timeline.map((entry, index) => {
                  const isLive = entry.y === liveY && entry.m === liveM;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={isLive ? "url(#liveEarnedGrad)" : "url(#earnedHigGrad)"}
                    />
                  );
                })}
                <LabelList dataKey="earned" content={(props) => {
                  const { x, y, width, value, index } = props;
                  if (!value) return null;
                  const item = timeline[index];
                  const delta = item?.earnedDelta;
                  const deltaStr = delta != null ? (delta > 0 ? `+${delta}%` : `${delta}%`) : "";
                  const valStr = value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`;
                  const deltaColor = delta != null && delta < 0 ? "#dc2626" : "#08805A";
                  return (
                    <g>
                      <text x={x + width / 2} y={y - 8} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke fill" fontSize={9.5} fontWeight={800} textAnchor="middle">
                        {valStr}
                        {deltaStr && <tspan dx={4}>({deltaStr})</tspan>}
                      </text>
                      <text x={x + width / 2} y={y - 8} fill="#08805A" fontSize={9.5} fontWeight={800} textAnchor="middle">
                        {valStr}
                        {deltaStr && <tspan fill={deltaColor} dx={4}>({deltaStr})</tspan>}
                      </text>
                    </g>
                  );
                }} />
              </Bar>
              <Line dataKey="recharge" name="Recharge collected" stroke="#F59E0B" strokeWidth={3} activeDot={{ r: 6 }} isAnimationActive={false}
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  if (cx == null || cy == null || !payload) return null;
                  const isLive = payload.y === liveY && payload.m === liveM;
                  if (isLive) {
                    return (
                      <g key={index}>
                        <circle cx={cx} cy={cy} r={6} fill="none" stroke="#F59E0B" strokeWidth={2}>
                          <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="1;0.15;1" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={cx} cy={cy} r={3.5} fill="#F59E0B" stroke="#ffffff" strokeWidth={1.5} />
                      </g>
                    );
                  }
                  return <circle key={index} cx={cx} cy={cy} r={4} fill="#F59E0B" stroke="#ffffff" strokeWidth={1.5} />;
                }}
              >
                <LabelList dataKey="recharge" content={(props) => {
                  const { x, y, value, index } = props;
                  if (!value) return null;
                  const item = timeline[index];
                  const delta = item?.rechargeDelta;
                  const deltaStr = delta != null ? (delta > 0 ? `+${delta}%` : `${delta}%`) : "";
                  const valStr = value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`;
                  const deltaColor = delta != null && delta < 0 ? "#dc2626" : "#D97706";
                  return (
                    <g>
                      <text x={x} y={y + 16} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke fill" fontSize={9.5} fontWeight={800} textAnchor="middle">
                        {valStr}
                        {deltaStr && <tspan dx={4}>({deltaStr})</tspan>}
                      </text>
                      <text x={x} y={y + 16} fill="#D97706" fontSize={9.5} fontWeight={800} textAnchor="middle">
                        {valStr}
                        {deltaStr && <tspan fill={deltaColor} dx={4}>({deltaStr})</tspan>}
                      </text>
                    </g>
                  );
                }} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Toolbar q={search} setQ={setSearch} placeholder="Search customer, mobile number, apartment, invoice # or reference number…" count={tableRows.length} />
        <div style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,.08)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.4)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0d2119" }}>Per-Invoice Recognition</div>
            <div style={{ fontSize: 12.5, color: "#86868b", marginTop: 2 }}>{rangeText} · {tableRows.length} invoices</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 460px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 1200 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                  {["Invoice #", "Reference Number", "Credit", "Customer", "Mobile Number", "Apartment", "Plan"].map(h => (
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
                  {["Remaining Days", "Remaining Days Earned Total Revenue", "Remaining Month Earned Total Revenue"].map(h => (
                    <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", background: r.deposit > 0 ? "rgba(255,149,0,.04)" : undefined }}>
                    <td style={{ padding: "14px 18px", fontSize: 12, whiteSpace: "nowrap", fontWeight: 600, color: "#0d2119" }}>{r.invoiceNumber}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, whiteSpace: "nowrap", color: "#86868b" }}>{r.referenceNumber}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, fontWeight: r.creditApplied ? 700 : 400, color: r.creditApplied ? "#08805a" : "#94a3b8", whiteSpace: "nowrap" }}>
                      {r.creditApplied
                        ? r.creditNoteObj
                          ? <button onClick={() => setCnPopup(r.creditNoteObj)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700, fontSize: 12, textDecoration: "underline", textUnderlineOffset: 3, padding: 0, whiteSpace: "nowrap" }}>{r.creditNoteNumber || "Yes"}</button>
                          : <span style={{ whiteSpace: "nowrap" }}>{r.creditNoteNumber || "Yes"}</span>
                        : "(-)"}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, fontWeight: 600, color: "#0d2119", whiteSpace: "nowrap" }}>{r.customer}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{r.phone ? fmtPhone(r.phone) : "—"}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{r.society}</td>
                    {/* Plan column (v2.29.281) — added per explicit user report that
                        a real invoice (Kavitha Dhinesh, ₹2,399) still showed Deposit
                        ₹0/Recharge ₹2,399 after the v2.29.280 catalog-lookup fix.
                        Making the plan name/code actually visible here (with a
                        title tooltip showing the exact code + whether it matched
                        the catalog) turns "why didn't this match" from invisible
                        into something diagnosable directly in the UI — an
                        unmatched plan gets a muted/dashed-underline treatment so
                        it's obvious at a glance which rows fell back to the old
                        depositForCustomer() estimate instead of a real catalog hit. */}
                    <td style={{ padding: "14px 18px", fontSize: 12, whiteSpace: "nowrap" }}
                      title={`Plan code: ${r.planCode || "(blank)"}${r.planMatched ? " — matched in the live plan list" : " — NOT found in the live plan list (by code or name)"}`}>
                      <span style={r.planMatched ? { color: "#475569" } : { color: "#986315", textDecoration: "underline dashed", textUnderlineOffset: 3 }}>
                        {r.plan}
                      </span>
                      {/* Plan Code shown directly, not just in the hover tooltip —
                          per explicit user request ("add the plan code also
                          instead of plan") — this is the exact string
                          lookupPlanEntry() searches the live plan list for. */}
                      <div style={{ fontSize: 10.5, fontFamily: "ui-monospace,monospace", color: "#94a3b8", marginTop: 2 }}>
                        {r.planCode || "(blank)"}
                      </div>
                    </td>
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
                    <td style={{ padding: "14px 18px", color: "#475569" }}>{r.remainingDays}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: r.remainingDaysEarned ? "#08805a" : "#86868b" }}>{r.remainingDaysEarned ? inr(Math.round(r.remainingDaysEarned)) : "—"}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: r.remainingMonthEarned ? "#08805a" : "#86868b" }}>{r.remainingMonthEarned ? inr(Math.round(r.remainingMonthEarned)) : "—"}</td>
                  </tr>
                ))}
                {tableRows.length > 0 && (
                  <tr style={{ background: "rgba(243,248,236,.5)" }}>
                    <td style={{ padding: "14px 18px", textAlign: "center", fontWeight: 700, color: "#0d2119" }} colSpan={10}>Total ({tableRows.length})</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(visTotal.total)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>{inr(visTotal.deposit)}</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(visTotal.recharge)}</td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px" }}></td>
                    <td style={{ padding: "14px 18px", fontWeight: 700, color: "#08805a" }}>{inr(Math.round(visTotal.earned))}</td>
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
      {/* Credit Note Detail Popup */}
      {cnPopup && (() => {
        const cnPopupDate = (() => {
          if (!cnPopup.date) return "—";
          const ds = cnPopup.date;
          if (ds.includes("T")) {
            const d = new Date(ds);
            if (!isNaN(d.getTime())) return fmtDate(d);
          }
          const clean = ds.split(" ")[0];
          const d = new Date(clean + "T00:00:00");
          if (!isNaN(d.getTime())) return fmtDate(d);
          const fallback = new Date(ds);
          return !isNaN(fallback.getTime()) ? fmtDate(fallback) : "—";
        })();
        return (
          <Modal onClose={() => setCnPopup(null)} title={cnPopup.number || "Credit Note"} sub={`Issued · ${cnPopupDate}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "rgba(243,248,236,.5)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Total Credit</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1D1D1F" }}>{cnPopup.total_formatted || (cnPopup.total != null ? inr(cnPopup.total) : "—")}</div>
                </div>
                <div style={{ background: "rgba(243,248,236,.5)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Balance Left</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: cnPopup.balance > 0 ? "#E8A93A" : "#08805A" }}>{cnPopup.balance_formatted || (cnPopup.balance != null ? inr(cnPopup.balance) : "—")}</div>
                </div>
                <div style={{ background: "rgba(243,248,236,.5)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Credits Used</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#475569" }}>{cnPopup.total_credits_used != null ? inr(cnPopup.total_credits_used) : "—"}</div>
                </div>
                <div style={{ background: "rgba(243,248,236,.5)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Status</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: cnPopup.status === "open" ? "#08805A" : "#86868b", textTransform: "capitalize" }}>{cnPopup.status || "—"}</div>
                </div>
              </div>
              <div style={{ background: "rgba(243,248,236,.5)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13.5, color: "#475569" }}>{cnPopup.description || "—"}</div>
              </div>
              {(cnPopup.invoices_applied || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Applied to {(cnPopup.invoices_applied || []).length} invoice{(cnPopup.invoices_applied.length || 0) > 1 ? "s" : ""}</div>
                  <div style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                          <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0a805a", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>Invoice #</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0a805a", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>Applied On</th>
                          <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#0a805a", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>Amount Applied</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cnPopup.invoices_applied.map((inv, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < (cnPopup.invoices_applied.length - 1) ? "1px solid rgba(0,0,0,.04)" : "none" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1D1D1F" }}>{inv.invoice_number}</td>
                            <td style={{ padding: "10px 14px", color: "#475569" }}>
                              {(() => {
                                if (!inv.date) return "—";
                                const d = new Date(inv.date.includes("T") ? inv.date : inv.date + "T00:00:00");
                                return !isNaN(d.getTime()) ? fmtDate(d) : "—";
                              })()}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "#08805a" }}>{inv.amount_applied > 0 ? inr(inv.amount_applied) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
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
  if (!data) return <Loading title="Loading Reconciliation" subtitle="Synchronizing payment reconciliation records…" />;

  const custByZoho = {};
  (data.cust || []).forEach(c => { [c.zohoId, c.id, c.zohoCustomerId, c.customerNumber].forEach(k => { if (k) custByZoho[k] = c; }); });
  const societyOf = (i) => {
    for (const k of [i.zohoCustomerId, i.zohoId, i.customerNumber]) { if (k && custByZoho[k]) return canonicalSociety(custByZoho[k].society || "Unknown"); }
    return canonicalSociety(i.society || "Unknown");
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
  const [kpiModal, setKpiModal] = useState(null);           // universal drill-down modal
  const [modalQ, setModalQ] = useState("");                 // drill-down search query
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
  if (!state) return <Loading title="Loading DrinkPrime Transactions" subtitle="Synchronizing partner transaction records…" />;

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
    { label: "Total Collected", value: inr(Math.round(totalCollected)), icon: Wallet, sub: rangeLabel(range), hero: true, delta: momPct(totalCollected, totalPrev), modalType: "dp_payments", modalFilter: "all", modalTitle: "Total DP Collections", modalSub: `All collected payments (Recharges & Deposits) in ${rangeLabel(range)}` },
    { label: "Earned Revenue", value: inr(Math.round(totalEarnedRevenue)), icon: Scale, sub: `recognised · ${rangeLabel(range)}`, delta: momPct(totalEarnedRevenue, totalPrevEarned), modalType: "dp_earned", modalFilter: "all", modalTitle: "DP Earned Revenue Recognition", modalSub: `Per-transaction revenue recognised in ${rangeLabel(range)} based on payment date & validity tenure` },
    { label: "Recharge Collected", value: inr(Math.round(rechargeCollected)), icon: Repeat, sub: `${rechargeSplitPct}% of collections`, delta: momPct(rechargeCollected, rechargePrev), modalType: "dp_payments", modalFilter: "recharge", modalTitle: "DP Recharge Collections", modalSub: `All recharge collection transactions in ${rangeLabel(range)}` },
    { label: "Deposit Collected", value: inr(Math.round(depositCollected)), icon: Landmark, sub: `${depositSplitPct}% of collections`, delta: momPct(depositCollected, depositPrev), modalType: "dp_payments", modalFilter: "deposit", modalTitle: "DP Deposit Collections", modalSub: `All security deposit collection transactions in ${rangeLabel(range)}` },
  ];

  const sortField = { paid: "Paid_Date", start: "t.validity_start_date", end: "t.validity_end_date" }[sort.key];
  const searchQ = search.trim().toLowerCase();
  const tableRows = enrichedInRange
    .filter(r => !searchQ ||
      (r.phone || "").toLowerCase().includes(searchQ) ||
      (r.current_device || "").toLowerCase().includes(searchQ) ||
      (r.partner_name || "").toLowerCase().includes(searchQ) ||
      (r.CustomerName || "").toLowerCase().includes(searchQ) ||
      (r.transaction_key || "").toLowerCase().includes(searchQ))
    .sort((a, b) => {
      const ta = a[sortField] ? new Date(a[sortField]).getTime() : 0;
      const tb = b[sortField] ? new Date(b[sortField]).getTime() : 0;
      return (ta - tb) * (sort.dir === "asc" ? 1 : -1);
    });
  const grandDeposit = tableRows.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
  const grandRevenue = tableRows.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
  const grandTotalPaid = tableRows.reduce((s, r) => s + (Number(r.transaction_amount) || ((Number(r.deposit_amount) || 0) + (Number(r.revenue_amount) || 0))), 0);
  const grandEarnedRevenue = tableRows.reduce((s, r) => s + (r.earnedRevenue || 0), 0);
  const grandRemainingEarned = tableRows.reduce((s, r) => s + (r.remainingDaysEarned || 0), 0);

  // Per-apartment performance — stable fleet-wide ranking sequence for the date period
  const aptPeriodRows = rows.filter(r => isRealSociety(r.partner_name) && paidOk(r) && rowTypeOk(r) && txnTypeOk(r));
  const aptStats = aptOptions.map(name => {
    const aptRows = aptPeriodRows.filter(r => r.partner_name === name);
    const dep = aptRows.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
    const rev = aptRows.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
    const tot = dep + rev;
    const depPct = tot > 0 ? Math.round((dep / tot) * 100) : 0;
    const revPct = tot > 0 ? 100 - depPct : 0;
    return { name, dep, rev, tot, depPct, revPct, count: aptRows.length };
  }).sort((a, b) => (b.tot - a.tot) || (b.rev - a.rev) || a.name.localeCompare(b.name));
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
    { label: "Deposit", get: r => r.deposit_amount ?? "" },
    { label: "Recharge", get: r => r.revenue_amount ?? "" },
    { label: "Total Amount", get: r => r.transaction_amount ?? ((r.deposit_amount != null || r.revenue_amount != null) ? ((Number(r.deposit_amount) || 0) + (Number(r.revenue_amount) || 0)) : "") },
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

  const renderKpiModal = () => {
    if (!kpiModal) return null;
    const { modalType, modalFilter, modalTitle, modalSub } = kpiModal;
    const mq = modalQ.toLowerCase().trim();

    if (modalType === "dp_payments") {
      let list = enrichedInRange;
      if (modalFilter === "recharge") {
        list = list.filter(r => (Number(r.revenue_amount) || 0) > 0);
      } else if (modalFilter === "deposit") {
        list = list.filter(r => (Number(r.deposit_amount) || 0) > 0);
      }

      const filtered = mq
        ? list.filter(r =>
            (r.phone || "").toLowerCase().includes(mq) ||
            (r.current_device || "").toLowerCase().includes(mq) ||
            (r.partner_name || "").toLowerCase().includes(mq) ||
            (r.CustomerName || "").toLowerCase().includes(mq) ||
            (r.transaction_key || "").toLowerCase().includes(mq) ||
            (r.Plan || "").toLowerCase().includes(mq)
          )
        : list;

      const totDep = filtered.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
      const totRech = filtered.reduce((s, r) => s + (Number(r.revenue_amount) || 0), 0);
      const totAll = filtered.reduce((s, r) => s + (Number(r.transaction_amount) || ((Number(r.deposit_amount) || 0) + (Number(r.revenue_amount) || 0))), 0);

      const exportModalCsv = () => exportToCsv(`prowater-dp-${modalFilter || "all"}-collections-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
        { label: "Paid Date", get: r => r.Paid_Date || "" },
        { label: "Apartment", get: r => r.partner_name || "" },
        { label: "Customer Name", get: r => r.CustomerName || "" },
        { label: "Phone", get: r => r.phone || "" },
        { label: "Device ID", get: r => r.current_device || "" },
        { label: "Transaction Key", get: r => r.transaction_key || "" },
        { label: "Row Type", get: r => r.row_type || "" },
        { label: "Plan", get: r => r.Plan || "" },
        { label: "Deposit Amount", get: r => r.deposit_amount ?? "" },
        { label: "Recharge Amount", get: r => r.revenue_amount ?? "" },
        { label: "Total Paid", get: r => r.transaction_amount ?? ((r.deposit_amount != null || r.revenue_amount != null) ? ((Number(r.deposit_amount) || 0) + (Number(r.revenue_amount) || 0)) : "") },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={{
          position: "fixed", inset: 0, background: "rgba(10,26,18,0.5)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={{
            width: "min(1150px, 96%)", background: "#fff", borderRadius: 20,
            padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>DP Transactions Drill-Down · {rangeLabel(range)}</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{modalTitle}</h2>
                {modalSub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{modalSub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={{
                width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.05)",
                display: "grid", placeItems: "center", cursor: "pointer", border: "none",
              }}>
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search customer, phone, device, key, apartment…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12.5, color: "#475569" }}>
                  Deposit: <strong style={{ color: "#475569" }}>{inr(Math.round(totDep))}</strong> · Recharge: <strong style={{ color: "#08805A" }}>{inr(Math.round(totRech))}</strong> · Total: <strong style={{ color: "#1D1D1F", fontSize: 14 }}>{inr(Math.round(totAll))}</strong>
                </div>
                <button onClick={exportModalCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Paid Date</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Apartment</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Customer Name</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Phone</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Device</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Transaction Key</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Plan</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Deposit</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Recharge</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={item.id ? `${item.id}-${idx}` : idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#64748B" }}>{item.Paid_Date ? fmtDate(new Date(item.Paid_Date)) : "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#1D1D1F", fontWeight: 600 }}>{item.partner_name || "—"}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 650, color: "#1D1D1F" }}>{item.CustomerName || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B", fontFamily: "monospace" }}>{item.phone || "—"}</td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#08805A", fontWeight: 600 }}>
                          {item.current_device ? (
                            <span style={{ display: "inline-block", fontFamily: "monospace", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "var(--mint)", color: "var(--slate)" }}>
                              {item.current_device}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748B" }}>{item.transaction_key || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B" }}>{item.Plan || "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, color: "#475569" }}>{item.deposit_amount != null ? inr(item.deposit_amount) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, color: "var(--teal-d)" }}>{item.revenue_amount != null ? inr(item.revenue_amount) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: "#08805A" }}>
                          {item.transaction_amount != null ? inr(item.transaction_amount) : ((item.deposit_amount != null || item.revenue_amount != null) ? inr((Number(item.deposit_amount) || 0) + (Number(item.revenue_amount) || 0)) : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "rgba(243,248,236,.6)", fontWeight: 700, borderTop: "2px solid rgba(0,0,0,0.08)" }}>
                      <td colSpan={7} style={{ padding: "12px 14px", textAlign: "left", color: "#1D1D1F" }}>Grand Total ({filtered.length} records)</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#475569" }}>{inr(Math.round(totDep))}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--teal-d)" }}>{inr(Math.round(totRech))}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#08805A", fontSize: 14 }}>{inr(Math.round(totAll))}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>No transaction records found matching the query.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (modalType === "dp_earned") {
      let list = enrichedInRange.filter(r => (r.earnedRevenue || 0) > 0 || (r.recharge || 0) > 0);
      const filtered = mq
        ? list.filter(r =>
            (r.phone || "").toLowerCase().includes(mq) ||
            (r.current_device || "").toLowerCase().includes(mq) ||
            (r.partner_name || "").toLowerCase().includes(mq) ||
            (r.CustomerName || "").toLowerCase().includes(mq) ||
            (r.transaction_key || "").toLowerCase().includes(mq) ||
            (r.Plan || "").toLowerCase().includes(mq)
          )
        : list;

      const totPaid = filtered.reduce((s, r) => s + (r.totalPaid || 0), 0);
      const totRech = filtered.reduce((s, r) => s + (r.recharge || 0), 0);
      const totEarned = filtered.reduce((s, r) => s + (r.earnedRevenue || 0), 0);
      const totFuture = filtered.reduce((s, r) => s + (r.remainingDaysEarned || 0), 0);

      const exportEarnedModalCsv = () => exportToCsv(`prowater-dp-earned-revenue-${isoDay(range.from)}_to_${isoDay(range.to)}.csv`, [
        { label: "Paid Date", get: r => r.Paid_Date || "" },
        { label: "Start Date", get: r => r["t.validity_start_date"] || "" },
        { label: "End Date", get: r => r["t.validity_end_date"] || "" },
        { label: "Apartment", get: r => r.partner_name || "" },
        { label: "Customer Name", get: r => r.CustomerName || "" },
        { label: "Phone", get: r => r.phone || "" },
        { label: "Device ID", get: r => r.current_device || "" },
        { label: "Plan", get: r => r.Plan || "" },
        { label: "Total Paid", get: r => r.totalPaid ?? "" },
        { label: "Recharge", get: r => r.recharge ?? "" },
        { label: "Tenure (Days)", get: r => r.tenureDays ?? "" },
        { label: "Days in Month", get: r => r.daysInPaidMonth ?? "" },
        { label: "Earned Revenue", get: r => Math.round(r.earnedRevenue || 0) },
        { label: "Future Revenue", get: r => Math.round(r.remainingDaysEarned || 0) },
      ], filtered);

      return (
        <div onClick={() => { setKpiModal(null); setModalQ(""); }} style={{
          position: "fixed", inset: 0, background: "rgba(10,26,18,0.5)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 1000,
        }}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={{
            width: "min(1200px, 96%)", background: "#fff", borderRadius: 20,
            padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ margin: 0, color: "#86868B" }}>DP Transactions Drill-Down · {rangeLabel(range)}</p>
                <h2 style={{ fontSize: 21, margin: "3px 0 0", color: "#1D1D1F", fontWeight: 700 }}>{modalTitle}</h2>
                {modalSub && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{modalSub}</div>}
              </div>
              <button onClick={() => { setKpiModal(null); setModalQ(""); }} style={{
                width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.05)",
                display: "grid", placeItems: "center", cursor: "pointer", border: "none",
              }}>
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={15} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search customer, phone, device, apartment, plan…"
                  value={modalQ}
                  onChange={e => setModalQ(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, marginBottom: 0, width: "100%", fontSize: 13, background: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 12.5, color: "#475569" }}>
                  Earned Revenue: <strong style={{ color: "#08805A", fontSize: 14 }}>{inr(Math.round(totEarned))}</strong> · Future: <strong style={{ color: "#D97706" }}>{inr(Math.round(totFuture))}</strong> · Total Paid: <strong style={{ color: "#1D1D1F" }}>{inr(Math.round(totPaid))}</strong>
                </div>
                <button onClick={exportEarnedModalCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "6px 14px", fontSize: 12 }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              {filtered.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.08)", position: "sticky", top: 0, zIndex: 1 }}>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Paid Date</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Start Date</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>End Date</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Apartment</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Customer Name</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Phone</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Device</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em" }}>Plan</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Total Paid</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Recharge</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center" }}>Tenure</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "center" }}>Days</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Earned Revenue</th>
                      <th style={{ padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#08805A", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right" }}>Future Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={item.id ? `modal-earned-${item.id}-${idx}` : `modal-earned-${idx}`} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(243,248,236,.15)" }}>
                        <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#64748B" }}>{item.Paid_Date ? fmtDate(new Date(item.Paid_Date)) : "—"}</td>
                        <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#64748B" }}>{item.startDate ? fmtDate(item.startDate) : "—"}</td>
                        <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "#64748B" }}>{item.endDate ? fmtDate(item.endDate) : "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#1D1D1F", fontWeight: 600 }}>{item.partner_name || "—"}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 650, color: "#1D1D1F" }}>{item.CustomerName || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "#64748B", fontFamily: "monospace" }}>{item.phone || "—"}</td>
                        <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#08805A", fontWeight: 600 }}>
                          {item.current_device ? (
                            <span style={{ display: "inline-block", fontFamily: "monospace", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "var(--mint)", color: "var(--slate)" }}>
                              {item.current_device}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "11px 14px", color: "#64748B" }}>{item.Plan || "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600 }}>{item.totalPaid ? inr(item.totalPaid) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600 }}>{item.recharge ? inr(item.recharge) : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center", color: "#64748B" }}>{item.tenureDays ? `${item.tenureDays}d` : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "center", color: "#64748B" }}>{item.daysInPaidMonth ? `${item.daysInPaidMonth}d` : "—"}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", color: "#08805A", fontWeight: 700 }}>{inr(Math.round(item.earnedRevenue || 0))}</td>
                        <td style={{ padding: "11px 14px", textAlign: "right", color: "#D97706", fontWeight: 600 }}>{item.remainingDaysEarned > 0 ? inr(Math.round(item.remainingDaysEarned)) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "rgba(243,248,236,.6)", fontWeight: 700, borderTop: "2px solid rgba(0,0,0,0.08)" }}>
                      <td colSpan={8} style={{ padding: "12px 14px", textAlign: "left", color: "#1D1D1F" }}>Grand Total ({filtered.length} records)</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{inr(Math.round(totPaid))}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{inr(Math.round(totRech))}</td>
                      <td colSpan={2} style={{ padding: "12px 14px", textAlign: "center" }}>—</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#08805A", fontSize: 14 }}>{inr(Math.round(totEarned))}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#D97706", fontSize: 14 }}>{inr(Math.round(totFuture))}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>No revenue recognition records found matching the query.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

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
          <div key={i}
            onClick={() => { setKpiModal(s); setModalQ(""); }}
            style={{
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 20,
              padding: "20px 22px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
              color: "#1D1D1F",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              cursor: "pointer",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#08805A"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(8, 128, 90, 0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.03)"; }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {s.label}
                  <ExternalLink size={11} style={{ opacity: 0.6 }} />
                </span>
                {s.icon && <s.icon size={18} style={{ color: "#08805A" }} />}
              </div>
              <div style={{ fontSize: 25, fontWeight: 700, color: "#1D1D1F", letterSpacing: "-.02em" }}>{s.value}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 12 }}>
              <span style={{ color: "#86868B" }}>{s.sub}</span>
              {s.delta != null && (
                <span style={{ fontWeight: 700, color: s.delta >= 0 ? "#08805A" : "#DC2626" }}>
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
          <Card hover={false}>
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
                  <div key={a.name} style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 14,
                    background: inactive ? "var(--mint)" : "#fff",
                    transform: "none",
                  }}>
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
        <Toolbar q={search} setQ={setSearch} placeholder="Search phone, device, transaction key, apartment or customer…" count={tableRows.length}
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
              "Apartment", "Customer", "Phone", "Device", "Type", "Transaction Key",
              sortHeader("start", "Start Date"), sortHeader("end", "End Date"),
              "Validity", "Litres", "Plan", "Deposit", "Recharge", "Total Amount"]} maxHeight="calc(100vh - 460px)">
            {pageRows.map((r, i) => (
              <tr key={r.id ? `${r.id}-${i}` : i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.Paid_Date ? fmtDate(new Date(r.Paid_Date)) : "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>{r.partner_name || "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>{r.CustomerName || "—"}</td>
                {/* whiteSpace:"nowrap" fixes phone numbers / device codes wrapping
                    mid-string (e.g. "8127910369" -> "8127910"/"369") — the shared
                    `td` style sets wordBreak:"break-word" (a deliberate convention
                    for long free-text cells like addresses), which breaks ANY
                    single unbroken "word" that doesn't fit the column, including
                    a short fixed-format value like a phone number or device code
                    once this table's columns are narrow (14 columns in one table).
                    Same fix already applied to the Stack column and App Logs
                    table elsewhere in this file. */}
                <td style={{ ...td, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{r.phone || "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>
                  {r.current_device ? <span style={{ display: "inline-block", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "var(--mint)", color: "var(--slate)", whiteSpace: "nowrap" }}>{r.current_device}</span> : "—"}
                </td>
                <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 700, padding: "3px 9px 3px 7px", borderRadius: 999, color: r.row_type === "TRANSACTION" ? "#08805A" : "#2A86D6", background: r.row_type === "TRANSACTION" ? "#E2F3EE" : "#E5F0FA" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: r.row_type === "TRANSACTION" ? "#08805A" : "#2A86D6", flexShrink: 0 }} />
                    {r.row_type || "—"}
                  </span>
                </td>
                <td style={{ ...td, fontSize: 11.5, textAlign: "center", whiteSpace: "nowrap" }}>
                  {r.transaction_key ? (
                    <span style={{ display: "inline-block", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.04)", color: "var(--slate)", whiteSpace: "nowrap" }} title={r.transaction_key}>
                      {r.transaction_key}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r["t.validity_start_date"] ? fmtDate(new Date(r["t.validity_start_date"])) : "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r["t.validity_end_date"] ? fmtDate(new Date(r["t.validity_end_date"])) : "—"}</td>
                <td style={{ ...td, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{validityOf(r) != null ? Number(validityOf(r)).toLocaleString("en-IN") : "—"}</td>
                <td style={{ ...td, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{litresOf(r) != null ? Number(litresOf(r)).toLocaleString("en-IN") : "—"}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>{r.Plan || "—"}</td>
                <td style={{ ...td, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>{r.deposit_amount != null ? inr(r.deposit_amount) : "—"}</td>
                <td style={{ ...td, color: "var(--teal-d)", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>{r.revenue_amount != null ? inr(r.revenue_amount) : "—"}</td>
                <td style={{ ...td, color: "#08805A", fontWeight: 700, textAlign: "center", whiteSpace: "nowrap" }}>
                  {r.transaction_amount != null ? inr(r.transaction_amount) : ((r.deposit_amount != null || r.revenue_amount != null) ? inr((Number(r.deposit_amount) || 0) + (Number(r.revenue_amount) || 0)) : "—")}
                </td>
              </tr>
            ))}
            {tableRows.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={12}>Grand Total ({tableRows.length})</td>
                <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandDeposit))}</td>
                <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandRevenue))}</td>
                <td style={{ ...ftd, textAlign: "center", color: "#08805A", fontWeight: 800 }}>{inr(Math.round(grandTotalPaid))}</td>
              </tr>
            )}
            {tableRows.length === 0 && <tr><td colSpan={15} style={{ padding: 0 }}><Empty msg="No transactions match this filter." /></td></tr>}
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
              sortHeader("paid", "Paid Date"),
              sortHeader("start", "Start Date"),
              sortHeader("end", "End Date"),
              "Apartment", "Customer", "Phone", "Device", "Plan",
              "Total Paid", "Recharge", "Tenure", "Days in Month", "Earned Revenue", "Future Revenue"
            ]} maxHeight="calc(100vh - 460px)">
              {pageRows.map((r, i) => {
                const er = r.earnedRevenue || 0;
                const remEr = r.remainingDaysEarned || 0;
                return (
                  <tr key={r.id ? `earned-${r.id}-${i}` : `earned-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.Paid_Date ? fmtDate(new Date(r.Paid_Date)) : "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.startDate ? fmtDate(r.startDate) : "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.endDate ? fmtDate(r.endDate) : "—"}</td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>{r.partner_name || "—"}</td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>{r.CustomerName || "—"}</td>
                    <td style={{ ...td, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{r.phone || "—"}</td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>
                      {r.current_device ? <span style={{ display: "inline-block", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "var(--mint)", color: "var(--slate)", whiteSpace: "nowrap" }}>{r.current_device}</span> : "—"}
                    </td>
                    <td style={{ ...td, fontSize: 12, textAlign: "center", whiteSpace: "nowrap" }}>{r.Plan || "—"}</td>
                    <td style={{ ...td, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>{r.totalPaid ? inr(r.totalPaid) : "—"}</td>
                    <td style={{ ...td, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>{r.recharge ? inr(r.recharge) : "—"}</td>
                    <td style={{ ...td, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{r.tenureDays ? `${r.tenureDays}d` : "—"}</td>
                    <td style={{ ...td, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{r.daysInPaidMonth ? `${r.daysInPaidMonth}d` : "—"}</td>
                    <td style={{ ...td, color: "#08805A", fontWeight: 700, textAlign: "center", whiteSpace: "nowrap" }}>{inr(Math.round(er))}</td>
                    <td style={{ ...td, color: "#D97706", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>{remEr > 0 ? inr(Math.round(remEr)) : "—"}</td>
                  </tr>
                );
              })}
              {tableRows.length > 0 && (
                <tr>
                  <td style={{ ...ftd, textAlign: "center" }} colSpan={8}>Grand Total ({tableRows.length})</td>
                  <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandTotalPaid))}</td>
                  <td style={{ ...ftd, textAlign: "center" }}>{inr(Math.round(grandRevenue))}</td>
                  <td style={{ ...ftd, textAlign: "center" }} colSpan={2}>—</td>
                  <td style={{ ...ftd, textAlign: "center", color: "#08805A", fontWeight: 800 }}>{inr(Math.round(grandEarnedRevenue))}</td>
                  <td style={{ ...ftd, textAlign: "center", color: "#D97706", fontWeight: 800 }}>{inr(Math.round(grandRemainingEarned))}</td>
                </tr>
              )}
              {tableRows.length === 0 && <tr><td colSpan={14} style={{ padding: 0 }}><Empty msg="No transactions match this filter." /></td></tr>}
            </Table>
          </div>
        </div>
      </div>
      {renderKpiModal()}
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
  if (!data) return <Loading title="Loading Annual Operating Plan" subtitle="Synchronizing budget and target data…" />;

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
  if (!data) return <Loading title="Loading Churn Risk Radar" subtitle="Synchronizing subscriber churn signals…" />;
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
  const [chartSoc, setChartSoc] = useState("__ALL__");
  const PER = 12;
  useEffect(() => {
    api.logView(user?.username, "Viewed Apartment Performance");
    Promise.all([
      billingApi.getInvoices().catch(() => []),
      customerApi.getCustomers().catch(() => []),
      fetchAllDpTransactions().catch(() => ({ rows: [] }))
    ])
      .then(([inv, cust, dpResult]) => setData({ inv, cust, dpRows: dpResult?.rows || [] }))
      .catch(() => setData({ inv: [], cust: [], dpRows: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <Loading title="Loading Apartment Performance" subtitle="Synchronizing society-level performance data…" />;

  const handleQChange = (e) => { setQ(e.target.value); setPage(1); };
  const handleModeChange = (v) => { setMode(v); setPage(1); };
  const handleYmChange = (e) => { setYm(e.target.value); setPage(1); };

  const custBy = {};
  data.cust.forEach(c => { [c.zohoId, c.id, c.zohoCustomerId].filter(Boolean).forEach(k => { custBy[k] = c; }); });
  const custFor = (i) => custBy[i.zohoCustomerId] || custBy[i.zohoId] || custBy[i.customerNumber] || null;

  const dpTxns = (data.dpRows || []).filter(r => r.row_type === "TRANSACTION");

  // Dropdown list of societies for chart internal filter
  const sSet = new Set();
  data.cust.forEach(c => {
    const name = cleanAptName(c.society);
    if (name && isRealSociety(name)) sSet.add(name);
  });
  dpTxns.forEach(r => {
    const name = cleanAptName(r.partner_name);
    if (name && isRealSociety(name)) sSet.add(name);
  });
  const chartSocieties = Array.from(sSet).sort((a, b) => a.localeCompare(b));

  // Trailing 7 months calculation for time series graph
  const curNow = new Date();
  const cY = curNow.getFullYear(), cM = curNow.getMonth();
  const aptMonths = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(cY, cM - k, 1);
    aptMonths.push({
      y: d.getFullYear(),
      m: d.getMonth(),
      label: d.toLocaleDateString("en-IN", { month: "short" })
    });
  }

  // Calculate grand totals across the 7-month window to identify top apartments
  const aptTotalsMap = {};
  chartSocieties.forEach(soc => { aptTotalsMap[soc] = 0; });
  aptMonths.forEach(x => {
    data.inv.forEach(i => {
      if (i.status !== "paid" || !i.date) return;
      const d = new Date(i.date);
      if (isNaN(d) || d.getFullYear() !== x.y || d.getMonth() !== x.m) return;
      const c = custFor(i);
      const soc = cleanAptName(c?.society || i.customerName || "");
      if (soc && isRealSociety(soc)) {
        aptTotalsMap[soc] = (aptTotalsMap[soc] || 0) + (i.total || 0);
      }
    });
    dpTxns.forEach(r => {
      if (!r.Paid_Date) return;
      const d = new Date(r.Paid_Date);
      if (isNaN(d) || d.getFullYear() !== x.y || d.getMonth() !== x.m) return;
      const soc = cleanAptName(r.partner_name || "");
      if (soc && isRealSociety(soc)) {
        aptTotalsMap[soc] = (aptTotalsMap[soc] || 0) + (Number(r.revenue_amount) || 0) + (Number(r.deposit_amount) || 0);
      }
    });
  });

  const allAptsWithRev = Object.keys(aptTotalsMap)
    .filter(k => aptTotalsMap[k] > 0)
    .sort((a, b) => a.localeCompare(b));

  const APT_SERIES_PALETTE = [
    "#08805A", // ProWater Signature Emerald
    "#2563EB", // Cobalt Blue
    "#7C3AED", // Royal Violet
    "#0D9488", // Deep Sea Teal
    "#EA580C", // Warm Tangerine
    "#4F46E5", // Electric Indigo
    "#0284C7", // Ocean Azure
    "#D97706", // Honey Gold
    "#DB2777", // Vivid Rose
    "#059669", // Jade Mint
    "#8B5CF6", // Lavender Purple
    "#06B6D4", // Bright Cyan
    "#64748B", // Slate Grey
    "#E11D48", // Crimson Ruby
    "#10B981", // Light Emerald
    "#6366F1", // Indigo Mist
    "#F59E0B", // Marigold
    "#3B82F6", // Sky Sapphire
    "#A855F7", // Amethyst
    "#14B8A6", // Turquoise
  ];

  let aptChartSeries = [];
  if (chartSoc !== "__ALL__") {
    aptChartSeries = [{ name: chartSoc, color: "#08805A" }];
  } else {
    const targetApts = allAptsWithRev.length > 0 ? allAptsWithRev : chartSocieties;
    aptChartSeries = targetApts.map((name, idx) => ({
      name,
      color: APT_SERIES_PALETTE[idx % APT_SERIES_PALETTE.length]
    }));
  }

  const m7Apt = aptMonths.map(x => {
    const monthAptRev = {};
    chartSocieties.forEach(soc => { monthAptRev[soc] = 0; });
    let monthTotal = 0;

    data.inv.forEach(i => {
      if (i.status !== "paid" || !i.date) return;
      const d = new Date(i.date);
      if (isNaN(d) || d.getFullYear() !== x.y || d.getMonth() !== x.m) return;
      const c = custFor(i);
      const soc = cleanAptName(c?.society || i.customerName || "");
      if (!soc || !isRealSociety(soc)) return;

      if (chartSoc !== "__ALL__") {
        if (soc.toLowerCase() === chartSoc.toLowerCase()) {
          monthAptRev[chartSoc] = (monthAptRev[chartSoc] || 0) + (i.total || 0);
          monthTotal += (i.total || 0);
        }
      } else {
        monthAptRev[soc] = (monthAptRev[soc] || 0) + (i.total || 0);
        monthTotal += (i.total || 0);
      }
    });

    dpTxns.forEach(r => {
      if (!r.Paid_Date) return;
      const d = new Date(r.Paid_Date);
      if (isNaN(d) || d.getFullYear() !== x.y || d.getMonth() !== x.m) return;
      const soc = cleanAptName(r.partner_name || "");
      if (!soc || !isRealSociety(soc)) return;

      const amt = (Number(r.revenue_amount) || 0) + (Number(r.deposit_amount) || 0);
      if (chartSoc !== "__ALL__") {
        if (soc.toLowerCase() === chartSoc.toLowerCase()) {
          monthAptRev[chartSoc] = (monthAptRev[chartSoc] || 0) + amt;
          monthTotal += amt;
        }
      } else {
        monthAptRev[soc] = (monthAptRev[soc] || 0) + amt;
        monthTotal += amt;
      }
    });

    const dataPoint = {
      label: x.label,
      y: x.y,
      m: x.m,
      total: Math.round(monthTotal)
    };

    if (chartSoc !== "__ALL__") {
      dataPoint[chartSoc] = Math.round(monthAptRev[chartSoc] || 0);
    } else {
      aptChartSeries.forEach(s => {
        dataPoint[s.name] = Math.round(monthAptRev[s.name] || 0);
      });
    }

    return dataPoint;
  });

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

      {/* ── Apartment Performance Time Series Chart ───────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", padding: 22, marginTop: 16, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: "0 0 4px" }}>
              Apartment Performance Time Series
            </h3>
            <div style={{ fontSize: 12, color: "#86868B" }}>
              {chartSoc === "__ALL__" ? "All Apartments (by Society)" : chartSoc} · Monthly revenue with apartment breakdown &amp; trend line · trailing 7 months
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/* Legend indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {aptChartSeries.map(s => (
                <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} /> {s.name}
                </span>
              ))}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#86868B", fontWeight: 600 }}>
                <span style={{ width: 14, height: 2.5, borderRadius: 2, background: "#F59E0B" }} /> Trend Line
              </span>
            </div>

            {/* Internal Society Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="apt-perf-soc-filter" style={{ fontSize: 12, fontWeight: 700, color: "#08805A" }}>Society:</label>
              <select
                id="apt-perf-soc-filter"
                value={chartSoc}
                onChange={(e) => setChartSoc(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(8,128,90,0.25)",
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#1D1D1F",
                  outline: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                }}
              >
                <option value="__ALL__">All Apartments (Combined)</option>
                {chartSocieties.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ height: 285 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={m7Apt}
              margin={{ top: 28, right: 16, left: -6, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#86868B", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`}
              />
              <Tooltip
                formatter={(v, n) => [inr(v), n]}
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", fontSize: 13 }}
              />
              {aptChartSeries.map((s, idx) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  name={s.name}
                  stackId="aptStack"
                  fill={s.color}
                  radius={idx === aptChartSeries.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive={false}
                />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                name="Trend"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ r: 4.5, fill: "#F59E0B", stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6.5, fill: "#F59E0B", stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={10}
                  formatter={v => v ? inr(v) : ""}
                  style={{ fontSize: 10.5, fontWeight: 800, fill: "#08805A" }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
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

/* ===========================================================================
   API LOAD TRACKER — performance, response times & system load dashboard
   =========================================================================== */
export function ApiLoadTracker() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [ticker, setTicker] = useState(0);
  const [filterToday, setFilterToday] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pw_api_load_logs");
      const parsed = raw ? JSON.parse(raw) : [];
      setLogs(parsed.reverse()); // Show most recent first
    } catch {}
  }, [ticker]);

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all performance logs?")) {
      localStorage.removeItem("pw_api_load_logs");
      setLogs([]);
      setTicker(t => t + 1);
    }
  };

  const todayStr = new Date().toDateString();
  const displayedLogs = filterToday 
    ? logs.filter(l => l.at && new Date(l.at).toDateString() === todayStr)
    : logs;

  // 1. Calculations for KPIs
  const totalCalls = displayedLogs.length;
  const successCalls = displayedLogs.filter(l => l.type === "success").length;
  const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 100;
  
  const avgLatency = totalCalls > 0 
    ? Math.round(displayedLogs.reduce((s, l) => s + l.duration, 0) / totalCalls) 
    : 0;

  // Find Peak Latency
  let peakLog = null;
  displayedLogs.forEach(l => {
    if (!peakLog || l.duration > peakLog.duration) peakLog = l;
  });

  // 2. Calculations for Hourly Spikes (load distribution)
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, avg: 0, sum: 0 }));
  displayedLogs.forEach(l => {
    const hr = new Date(l.at).getHours();
    hourlyData[hr].count++;
    hourlyData[hr].sum += l.duration;
  });
  hourlyData.forEach(h => {
    h.avg = h.count > 0 ? Math.round(h.sum / h.count) : 0;
  });

  // Format hour label (e.g. "09:00", "14:00")
  const chartData = hourlyData.map(h => ({
    label: `${String(h.hour).padStart(2, "0")}:00`,
    Requests: h.count,
    Latency: h.avg
  }));

  // Find Peak Spike Hour
  let peakHour = null;
  hourlyData.forEach(h => {
    if (!peakHour || h.count > peakHour.count) peakHour = h;
  });
  const peakHourStr = peakHour && peakHour.count > 0 
    ? `${String(peakHour.hour).padStart(2, "0")}:00 - ${String(peakHour.hour + 1).padStart(2, "0")}:00`
    : "—";

  // 3. Group by API path to find slowest endpoints
  const apiGroups = {};
  displayedLogs.forEach(l => {
    const p = l.path || "Other";
    if (!apiGroups[p]) apiGroups[p] = { path: p, count: 0, sum: 0, min: Infinity, max: -Infinity };
    apiGroups[p].count++;
    apiGroups[p].sum += l.duration;
    if (l.duration < apiGroups[p].min) apiGroups[p].min = l.duration;
    if (l.duration > apiGroups[p].max) apiGroups[p].max = l.duration;
  });
  const apiRows = Object.values(apiGroups).map(g => ({
    path: g.path,
    count: g.count,
    avg: Math.round(g.sum / g.count),
    min: g.min,
    max: g.max
  })).sort((a, b) => b.avg - a.avg);

  const softShadow = { background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,.03)" };

  return (
    <div className="fade-up">
      {/* Date Filter Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1D1D1F", margin: 0 }}>System Performance Monitoring</h2>
          <div style={{ fontSize: 12.5, color: "#86868B" }}>Real-time latency metrics from active API requests</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            onClick={() => setFilterToday(true)} 
            style={{ 
              padding: "7px 14px", 
              borderRadius: 10, 
              fontSize: 12.5, 
              fontWeight: 700, 
              cursor: "pointer", 
              border: "1.5px solid " + (filterToday ? "var(--teal)" : "var(--border)"), 
              background: filterToday ? "var(--mint-2)" : "#fff", 
              color: filterToday ? "var(--teal-d)" : "var(--slate)" 
            }}
          >
            Today Only
          </button>
          <button 
            onClick={() => setFilterToday(false)} 
            style={{ 
              padding: "7px 14px", 
              borderRadius: 10, 
              fontSize: 12.5, 
              fontWeight: 700, 
              cursor: "pointer", 
              border: "1.5px solid " + (!filterToday ? "var(--teal)" : "var(--border)"), 
              background: !filterToday ? "var(--mint-2)" : "#fff", 
              color: !filterToday ? "var(--teal-d)" : "var(--slate)" 
            }}
          >
            All Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
        <Stat label="Average Latency" value={`${avgLatency} ms`} icon={CalendarClock} sub="Across all tracked modules" hero />
        <Stat label="Success Rate" value={`${successRate}%`} icon={CheckCircle2} sub={`${successCalls} of ${totalCalls} calls succeeded`} />
        <Stat label="Total API Calls" value={totalCalls} icon={ScrollText} sub={filterToday ? "Today's requests" : "Last 1000 requests"} />
        <Stat 
          label="Peak Latency Event" 
          value={peakLog ? `${peakLog.duration} ms` : "—"} 
          icon={AlertCircle} 
          sub={peakLog ? `${peakLog.path.slice(0, 24)}... at ${new Date(peakLog.at).toLocaleTimeString()}` : "No events recorded"} 
          invert
        />
      </div>

      {/* ── Spikes Widget ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 16 }}>
        
        {/* Hourly Requests Spike Chart */}
        <div style={{ ...softShadow, padding: 22, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: "0 0 4px" }}>API Call Frequency (Spike Tracking)</h3>
          <div style={{ fontSize: 12, color: "#86868B", marginBottom: 14 }}>Requests per hour · Peak: <span style={{ fontWeight: 700, color: "#08805A" }}>{peakHourStr}</span> ({peakHour?.count || 0} hits)</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#86868B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", fontSize: 13 }} />
                <Bar dataKey="Requests" fill="#08805A" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Average Latency Chart */}
        <div style={{ ...softShadow, padding: 22, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Response Latency Spikes</h3>
          <div style={{ fontSize: 12, color: "#86868B", marginBottom: 14 }}>Average response duration (ms) by hour</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#86868B", fontSize: 11 }} axisLine={false} tickLine={false} unit="ms" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,.08)", fontSize: 13 }} />
                <Area type="monotone" dataKey="Latency" name="Avg Latency" stroke="#F59E0B" strokeWidth={2} fill="rgba(245,158,11,0.08)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── API Endpoints Load Table ────────────────────────────────────── */}
      <div style={{ ...softShadow, padding: 0, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>API Endpoints Latency breakdown</h3>
            <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Average, min, and peak duration per endpoint path</div>
          </div>
          {logs.length > 0 && (
            <button onClick={handleClear} style={{ ...btnGhost, color: "#DC4141", borderColor: "rgba(220,65,65,0.2)", background: "rgba(220,65,65,0.03)", cursor: "pointer" }}>
              Clear Performance Logs
            </button>
          )}
        </div>
        {apiRows.length > 0 ? (
          <div className="scroll-thin" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  {["API Endpoint Path", "Hits/Requests", "Avg Latency", "Min Latency", "Peak Latency"].map((h, i) => (
                    <th key={i} style={{ padding: "13px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apiRows.map((r, i) => (
                  <tr key={r.path} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(243,248,236,.3)" }}>
                    <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 700, color: "#0d2119", textAlign: "left", fontFamily: "monospace" }}>{r.path}</td>
                    <td style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>{r.count}</td>
                    <td style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 700, color: r.avg > 800 ? "#DC4141" : r.avg > 400 ? "#D97706" : "#08805A" }}>{r.avg} ms</td>
                    <td style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, color: "#475569" }}>{r.min} ms</td>
                    <td style={{ padding: "13px 18px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>{r.max} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty msg="No performance logs recorded yet. Navigate to other modules to generate traffic." />
        )}
      </div>

      {/* ── Recent Requests Log Table ───────────────────────────────────── */}
      {displayedLogs.length > 0 && (
        <div style={{ ...softShadow, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 17, color: "#1D1D1F", fontWeight: 700, margin: 0 }}>Recent API Request telemetry</h3>
            <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Real-time latency stream (last 30 requests)</div>
          </div>
          <div className="scroll-thin" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "rgba(243,248,236,.92)", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  {["Timestamp", "Endpoint Path", "Latency", "HTTP Status", "Result"].map((h, i) => (
                    <th key={i} style={{ padding: "12px 18px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#08805A", fontWeight: 700, textAlign: i === 1 ? "left" : "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedLogs.slice(0, 30).map((l, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <td style={{ padding: "12px 18px", fontSize: 12.5, color: "#475569", textAlign: "center" }}>{new Date(l.at).toLocaleTimeString()}</td>
                    <td style={{ padding: "12px 18px", fontSize: 13, color: "#0d2119", textAlign: "left", fontFamily: "monospace" }}>{l.path}</td>
                    <td style={{ padding: "12px 18px", textAlign: "center", fontSize: 13, fontWeight: 700, color: l.duration > 800 ? "#DC4141" : l.duration > 400 ? "#D97706" : "#08805A" }}>{l.duration} ms</td>
                    <td style={{ padding: "12px 18px", textAlign: "center", fontSize: 13 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: l.status >= 400 ? "#FBE8E8" : "#E2F3EE", color: l.status >= 400 ? "#DC4141" : "#08805A" }}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 18px", textAlign: "center", fontSize: 13 }}>
                      {renderHigStatusBadge(l.type === "success" ? "Success" : "Failed")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

