/* ============================================================================
   modules/Ticketing.jsx — Ticketing module. Extracted verbatim from App.jsx
   (v2.30 module-split). Zoho Desk support tickets: overview KPIs + a shared
   TicketList component reused for both the Tickets and Ops Tickets tabs.
   ============================================================================ */

import { useState, useEffect } from "react";
import {
  AlertCircle, BarChart3 as BarChartIcon, CheckCircle2, ChevronRight,
  Download, MapPin, Ticket, TrendingUp, X,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Line, Area, LabelList,
} from "recharts";
import {
  useAuth, api, ticketApi, exportToCsv, fmtTime, fmtIST,
  parsePartsUsed, istDateOf, zdStatusColor, zdIsClosed,
  ZD_DEFAULT_STATUSES, ZD_PRIORITIES,
  useDateRange, dateInRange, isoDay, addDays, rangeLabel,
  CHART_PALETTE, tkPriority,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, DefRow, Drawer, TT,
  grid4, axisTick, td, trStyle, selectStyle, btnGhost, btnPrimary,
  renderPieLabel, pieLabelLine, toastStyle, DateRangePicker,
} from "../shared/ui";

/* ===========================================================================
   TICKETING MODULE (sample data) — Overview + Tickets list with detail drawer
   =========================================================================== */
// Zoho Desk statuses/priorities are strings; colour them by keyword.
export const tkStatus = (label) => ({ label: label || "—", color: zdStatusColor(label) });
export function TicketBadge({ value, kind }) {
  const meta = kind === "priority" ? tkPriority(value) : tkStatus(value);
  if (!value) return <span style={{ color: "var(--muted)" }}>—</span>;
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>;
}
export function TicketOverview() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [trendMode, setTrendMode] = useState("ma"); // "ma" | "spline" | "linear" | "off"
  const { sel, setSel, range } = useDateRange("this_month"); // v2.29.317: date filter for the Overview
  useEffect(() => { api.logView(user.username, "Viewed Ticketing overview"); ticketApi.getTickets().then(setTickets).catch(() => setTickets([])); }, []);
  if (!tickets) return <Loading title="Loading Ticket Overview" subtitle="Synchronizing support ticket data…" />;

  // Every KPI/chart below is scoped to the selected date range, matched
  // against when each ticket was created (v2.29.317).
  const filtered = tickets.filter(t => dateInRange(t.created, range));

  const openCount = filtered.filter(t => !zdIsClosed(t.status)).length;
  const urgent = filtered.filter(t => String(t.priority).toLowerCase() === "urgent" && !zdIsClosed(t.status)).length;
  const resolved = filtered.filter(t => zdIsClosed(t.status)).length;
  const resolveRate = filtered.length ? Math.round(resolved / filtered.length * 100) : 0;

  const stats = [
    { label: "Open tickets", value: openCount, icon: Ticket, sub: "needs attention", hero: true },
    { label: "Urgent open", value: urgent, icon: AlertCircle, sub: "high priority" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, sub: "resolved or closed" },
    { label: "Resolution rate", value: resolveRate + "%", icon: TrendingUp, sub: "of all tickets" },
  ];

  // Status distribution built from whatever statuses actually appear.
  const statusOrder = [...ZD_DEFAULT_STATUSES, ...filtered.map(t => t.status)].filter((v, i, a) => a.indexOf(v) === i);
  const byStatus = statusOrder.map(s => ({ name: s, value: filtered.filter(t => t.status === s).length })).filter(x => x.value > 0);
  const byCategory = Object.values(filtered.reduce((acc, t) => {
    const k = t.issueCategory || "—";
    acc[k] = acc[k] || { plan: k, amount: 0 };
    acc[k].amount += 1;
    return acc;
  }, {}));
  const PIE = CHART_PALETTE;

  // Daily count of tickets created, one bucket per calendar day across the
  // whole selected range (zero-filled, so a quiet day shows as 0 rather than a gap).
  const days = [];
  for (let d = new Date(range.from); d <= range.to; d = addDays(d, 1)) days.push(new Date(d));
  const dailyTrend = days.map(d => {
    const key = isoDay(d);
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), count: filtered.filter(t => istDateOf(t.created) === key).length };
  });

  const nD = dailyTrend.length;
  const sumX = dailyTrend.reduce((s, _, i) => s + i, 0);
  const sumY = dailyTrend.reduce((s, r) => s + r.count, 0);
  const sumXY = dailyTrend.reduce((s, r, i) => s + i * r.count, 0);
  const sumX2 = dailyTrend.reduce((s, _, i) => s + i * i, 0);
  const denom = nD * sumX2 - sumX * sumX;
  const slope = denom ? (nD * sumXY - sumX * sumY) / denom : 0;
  const intercept = nD ? (sumY - slope * sumX) / nD : 0;

  // Adaptive Moving Average for a smooth, natural trend curve
  const w = dailyTrend.length <= 7 ? 2 : (dailyTrend.length <= 14 ? 3 : 5);
  dailyTrend.forEach((r, i) => {
    const start = Math.max(0, i - Math.floor(w / 2));
    const end = Math.min(dailyTrend.length, i + Math.ceil(w / 2) + 1);
    const slice = dailyTrend.slice(start, end);
    const avg = slice.reduce((sum, item) => sum + item.count, 0) / slice.length;
    r.ma = Math.round(avg * 10) / 10;
    r.spline = r.count;
    r.linear = Math.round(Math.max(0, slope * i + intercept) * 10) / 10;
    r.activeTrend = trendMode === "ma" ? r.ma : (trendMode === "spline" ? r.spline : (trendMode === "linear" ? r.linear : null));
  });

  const tkTick = Math.max(0, Math.ceil(dailyTrend.length / 10) - 1);
  const maxDaily = dailyTrend.length ? Math.max(...dailyTrend.map(r => r.count)) : 0;
  const totalDaily = dailyTrend.reduce((s, r) => s + r.count, 0);
  const activeDaysCount = dailyTrend.filter(r => r.count > 0).length;
  const avgDaily = dailyTrend.length ? (totalDaily / dailyTrend.length).toFixed(1) : "0.0";

  const renderDailyBarLabel = (props) => {
    const { x, y, width, value } = props;
    if (value == null || value === 0) return null;
    const badgeW = value > 99 ? 28 : (value > 9 ? 22 : 18);
    return (
      <g>
        <rect
          x={x + width / 2 - badgeW / 2}
          y={Math.max(2, y - 20)}
          width={badgeW}
          height={16}
          rx={5}
          fill="#08805A"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <text
          x={x + width / 2}
          y={Math.max(2, y - 20) + 9}
          fill="#ffffff"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontWeight={800}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {value}
        </text>
      </g>
    );
  };

  const trendLabel = trendMode === "ma" ? "Moving Avg" : (trendMode === "spline" ? "Daily Curve" : (trendMode === "linear" ? "Linear Fit" : ""));

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <DateRangePicker value={sel} onChange={setSel} />
        <span style={{ fontSize: 12.5, color: "#86868B" }}>{rangeLabel(range)} · {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} in view</span>
      </div>

      {ticketApi.usedSample && <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#986315", background: "rgba(152,99,21,0.08)", border: "1px solid rgba(152,99,21,0.18)", padding: "12px 16px", borderRadius: 14, marginBottom: 16 }}>
        <AlertCircle size={16} color="#986315" /> Showing sample data — the Zoho Desk endpoint is unreachable. Once connected, this reflects real tickets.
      </div>}

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
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

      {/* Daily trend — tickets created per day, with styled gradients, smooth trend curve, and data labels */}
      <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Daily Tickets Created</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Volume trend for the selected period with dynamic trend curve & data labels</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {dailyTrend.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(8,128,90,0.08)", border: "1px solid rgba(8,128,90,0.18)", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#08805A" }}>
                  <span>Peak:</span> <strong style={{ fontWeight: 800 }}>{maxDaily} tickets</strong>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#6366F1" }}>
                  <span>Daily Avg:</span> <strong style={{ fontWeight: 800 }}>{avgDaily} / day</strong>
                </div>
              </div>
            )}
            <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.05)", padding: 3, borderRadius: 10, gap: 2 }}>
              {[
                { id: "ma", label: "Smooth MA" },
                { id: "spline", label: "Daily Curve" },
                { id: "linear", label: "Linear" },
                { id: "off", label: "Hide Line" },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setTrendMode(m.id)}
                  style={{
                    border: "none",
                    padding: "4px 10px",
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: trendMode === m.id ? "#fff" : "transparent",
                    color: trendMode === m.id ? "#1D1D1F" : "#86868B",
                    boxShadow: trendMode === m.id ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                    transition: "all .15s ease",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {dailyTrend.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={dailyTrend} margin={{ left: -10, right: 14, top: 24, bottom: 0 }}>
              <defs>
                <linearGradient id="tkBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="tkTrendLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
                <linearGradient id="tkTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#86868B", fontSize: 11.5 }} axisLine={false} tickLine={false} interval={tkTick} />
              <YAxis tick={{ fill: "#86868B", fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, maxDaily > 0 ? maxDaily + 1 : 4]} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(8,128,90,0.06)", rx: 6 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12.5, color: "#1D1D1F", paddingTop: 12 }} />
              {trendMode !== "off" && (
                <Area type="monotone" dataKey="activeTrend" name={trendLabel} stroke="none" fill="url(#tkTrendAreaGrad)" isAnimationActive={false} />
              )}
              <Bar dataKey="count" name="Tickets created" radius={[6, 6, 0, 0]} fill="url(#tkBarGrad)" maxBarSize={32} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" content={renderDailyBarLabel} />
              </Bar>
              {trendMode !== "off" && (
                <Line
                  type="monotone"
                  dataKey="activeTrend"
                  name={trendLabel}
                  stroke={trendMode === "linear" ? "#D97706" : "url(#tkTrendLineGrad)"}
                  strokeWidth={3}
                  strokeDasharray={trendMode === "linear" ? "5 4" : undefined}
                  dot={trendMode === "spline" ? { r: 3.5, fill: "#fff", stroke: "#6366F1", strokeWidth: 2 } : false}
                  activeDot={{ r: 6, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : <Empty msg="No tickets in the selected period." />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>

        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Tickets by Status</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Where things stand</div>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} isAnimationActive={false} label={renderPieLabel} labelLine={pieLabelLine}>
                {byStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12.5, color: "#1D1D1F" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F" }}>Tickets by Issue Type</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>What customers contact about</div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 30, right: 16 }}>
              <defs>
                <linearGradient id="tkIssueGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#08805A" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#1E9E4F" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="plan" tick={{ fill: "#86868B", fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(8,128,90,.06)" }} />
              <Bar dataKey="amount" name="tickets" radius={[0, 6, 6, 0]} fill="url(#tkIssueGrad)" maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function SparesTable({ tickets }) {
  const spareCounts = {};
  let totalPartsCount = 0;
  let jobsWithSparesCount = 0;

  for (const t of (tickets || [])) {
    const parts = parsePartsUsed(t.partsUsed);
    if (parts.length > 0) {
      jobsWithSparesCount++;
      for (const p of parts) {
        spareCounts[p] = (spareCounts[p] || 0) + 1;
        totalPartsCount++;
      }
    }
  }

  const rows = Object.entries(spareCounts)
    .map(([name, count]) => ({
      name,
      count,
      pctOfTotal: totalPartsCount > 0 ? Math.round((count / totalPartsCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden", marginTop: 18 }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1D1D1F" }}>Spares Used</div>
          <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>
            Total spare parts consumed across tickets in selected period · {totalPartsCount} part{totalPartsCount !== 1 ? "s" : ""} across {jobsWithSparesCount} job{jobsWithSparesCount !== 1 ? "s" : ""}
          </div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#08805A", background: "rgba(8,128,90,0.1)", padding: "4px 10px", borderRadius: 999 }}>
          {rows.length} unique spare{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      {rows.length === 0 ? (
        <Empty msg="No spares recorded for the tickets in view." />
      ) : (
        <div className="scroll-thin" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "left", whiteSpace: "nowrap" }}>Spare / Part Name</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "center", whiteSpace: "nowrap" }}>Count</th>
                <th style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", textAlign: "center", whiteSpace: "nowrap" }}>Share of Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.name} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", background: idx % 2 === 1 ? "rgba(0,0,0,.01)" : "transparent" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600, color: "#1D1D1F", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 6, fontSize: 10.5, fontWeight: 800, background: idx === 0 ? "var(--green)" : "var(--mint-2)", color: idx === 0 ? "#fff" : "var(--muted)", flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      <span>{r.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}>
                    <span style={{ display: "inline-block", fontWeight: 800, fontSize: 14, color: "#08805A", background: "rgba(8,128,90,0.08)", padding: "3px 12px", borderRadius: 999 }}>
                      {r.count}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 120 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 999, background: "var(--mint-2)", overflow: "hidden" }}>
                        <div style={{ width: `${r.pctOfTotal}%`, height: "100%", borderRadius: 999, background: "#08805A" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{r.pctOfTotal}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(243,248,236,.6)", borderTop: "2px solid rgba(0,0,0,.08)", fontWeight: 700 }}>
                <td style={{ padding: "14px 20px", textAlign: "left", color: "#1D1D1F" }}>Total Spares Used</td>
                <td style={{ padding: "14px 20px", textAlign: "center", color: "#08805A", fontSize: 14 }}>{totalPartsCount}</td>
                <td style={{ padding: "14px 20px", textAlign: "center", color: "#475569", fontSize: 12 }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function TicketList({ isAdmin, preFilter, extraColumns = [], hideColumns = [], hidePriorityFilter = false, dateFilterField, topContent, bottomContent, clickable = true }) {
  const showCustomer = !hideColumns.includes("customer");
  const showSociety = !hideColumns.includes("society");
  const showPriority = !hideColumns.includes("priority");
  const showStatus = !hideColumns.includes("status");
  const { user } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateVal, setDateVal] = useState("");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => ticketApi.getTickets().then(list => setTickets(preFilter ? list.filter(preFilter) : list)).catch(() => setTickets([]));
  useEffect(() => { api.logView(user.username, "Viewed Tickets"); refresh(); }, []);
  if (!tickets) return <Loading title="Loading Tickets" subtitle="Synchronizing ticket records…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, s) => { await ticketApi.updateStatus(user.username, id, s); await refresh(); setSel(p => p ? { ...p, status: s } : p); flash("Ticket updated"); };

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
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

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
          <button onClick={exportCsv} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "7px 16px" }}><Download size={15} /> Export</button>
        </>} />
      {topContent && topContent(filtered)}

      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,.06)", boxShadow: "0 10px 30px rgba(0,0,0,.03)", overflow: "hidden" }}>
        <div className="scroll-thin" style={{ overflowX: "auto", maxHeight: "calc(100vh - 300px)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Ticket", ...(showCustomer ? ["Customer"] : []), ...(showSociety ? ["Society"] : []), "Purifier ID", "Issue Category", ...extraColumns.map(c => c.label), ...(showPriority ? ["Priority"] : []), ...(showStatus ? ["Status"] : []), "Created", ...(clickable ? [""] : [])].map((h, idx) => (
                  <th key={idx} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap", position: "sticky", top: 0, background: "rgba(243,248,236,.92)", zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)", cursor: clickable ? "pointer" : "default" }} onClick={clickable ? () => setSel(t) : undefined}>
                  <td style={{ padding: "14px 18px", fontWeight: 600, color: "#1D1D1F" }}>{t.ticketNo}</td>
                  {showCustomer && <td style={{ padding: "14px 18px", color: "#475569" }}>{t.customer}</td>}
                  {showSociety && <td style={{ padding: "14px 18px", color: "#475569" }}>{t.society}</td>}
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{t.purifierId}</td>
                  <td style={{ padding: "14px 18px", color: "#475569" }}>{t.issueCategory || "—"}</td>
                  {extraColumns.map((c, i) => <td key={i} style={{ padding: "14px 18px", fontSize: 12.5, whiteSpace: "nowrap", color: "#475569" }}>{c.render ? c.render(t) : (c.get(t) ?? "—")}</td>)}
                  {showPriority && <td style={{ padding: "14px 18px" }}><TicketBadge value={t.priority} kind="priority" /></td>}
                  {showStatus && <td style={{ padding: "14px 18px" }}><TicketBadge value={t.status} kind="status" /></td>}
                  <td style={{ padding: "14px 18px", fontSize: 12, color: "#86868B" }}>{fmtTime(t.created)}</td>
                  {clickable && <td style={{ padding: "14px 18px", textAlign: "center" }}><ChevronRight size={16} color="#86868B" /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <Empty msg="No tickets match your filters." />}
      </div>
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
          ? <a href={sel.address} target="_blank" rel="noopener noreferrer" style={{ color: "#08805A", wordBreak: "break-all" }}>{sel.address}</a>
          : sel.address} />
        <DefRow k="Job Start Time" v={fmtIST(sel.jobStartTime)} />
        <DefRow k="Job End Time" v={fmtIST(sel.jobEndTime)} />
        <DefRow k="Work Start Location" v={(sel.workStartLat != null && sel.workStartLat !== "" && sel.workStartLng != null && sel.workStartLng !== "")
          ? <a href={`https://www.google.com/maps?q=${sel.workStartLat},${sel.workStartLng}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: "1.5px solid #08805A", background: "rgba(8,128,90,0.08)", color: "#08805A", fontWeight: 600, fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>
              <MapPin size={14} /> Open in maps
            </a>
          : null} />
        <DefRow k="Work Start Address" v={sel.workStartAddress} />
        <DefRow k="reason for postpone" v={sel.reasonForPostpone} />
        <DefRow k="rescheduled_Date" v={sel.rescheduledDate} />
        <DefRow k="Parts_Used" v={sel.partsUsed} />
        {isAdmin && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B", fontWeight: 600, marginBottom: 8 }}>Update status</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {statusOptions.map(s => { const color = zdStatusColor(s); return (
                <button key={s} onClick={() => move(sel.id, s)} style={{
                  padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  border: `1.5px solid ${sel.status === s ? color : "rgba(0,0,0,0.12)"}`,
                  background: sel.status === s ? color : "#fff",
                  color: sel.status === s ? "#fff" : "#1D1D1F",
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
