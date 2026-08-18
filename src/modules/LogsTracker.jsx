/* ============================================================================
   modules/LogsTracker.jsx — Logs Tracker module. Extracted verbatim from
   App.jsx (v2.30 module-split). Audit trail (ApiUsageDashboard/Logs) and the
   API-outage monitor (Failures) — thin screens; the real tracking machinery
   (pushLog, _failures, useFailures, apiTracker, etc) lives in shared/core.js.
   ============================================================================ */

import { useState, useEffect } from "react";
import {
  AlertCircle, CheckCircle2, Clock, Download, Globe, MapPin, RefreshCw,
  ScrollText, Trash2,
} from "lucide-react";
import {
  useAuth, api, apiTracker, API_USAGE_LIMITS, APP_VERSION, VERSION_DATE,
  fmtDate, fmtTime, useFailures, fmtDowntime,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, Stat, LogChip,
  grid4, td, btnGhost, selectStyle,
} from "../shared/ui";


/* ============================================================================
   ApiUsageDashboard — the UI widget for the "API Usage" tab. Named differently
   from the imported ApiUsageTracker class on purpose (rendering the class as JSX
   would crash React); this component just reads the tracker's numbers.
   ============================================================================ */
export function ApiUsageDashboard() {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const rows = apiTracker.statusAll();
  const totalUsed = rows.reduce((s, r) => s + r.count, 0);
  const anyOver80 = rows.some(r => r.percent >= 80);
  const barColor = (pct) => pct >= 95 ? "#DC4141" : pct >= 80 ? "#986315" : "#08805A";


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Tracks external APIs called directly from the browser (ipapi.co, ipify.org, bigdatacloud). Counts are per-browser and reset at local midnight — this does not see usage from other visitors' browsers.
      </div>

      <div style={grid4}>
        <Stat label="Tracked APIs" value={rows.length} icon={Globe} sub="registered today" hero />
        <Stat label="Total calls today" value={totalUsed} icon={RefreshCw} sub="across all tracked APIs" />
        <Stat label="Near limit" value={rows.filter(r => r.percent >= 80).length} icon={AlertCircle} sub="≥ 80% of daily cap" />
        <Stat label="Status" value={anyOver80 ? "Watch" : "Healthy"} icon={CheckCircle2} sub={anyOver80 ? "one or more APIs near cap" : "all APIs well under cap"} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Card pad={false} title="Usage by API" sub="Resets daily at local midnight">
          <Table head={["API", "Used today", "Daily limit", "Remaining", "% used"]}>
            {rows.map(r => (
              <tr key={r.api} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{r.api}</td>
                <td style={td}>{r.count}</td>
                <td style={td}>{r.limit === Infinity ? "—" : r.limit}</td>
                <td style={td}>{r.limit === Infinity ? "—" : r.remaining}</td>
                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <div style={{ width: 90, height: 7, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(r.percent, 100)}%`, height: "100%", background: barColor(r.percent) }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: barColor(r.percent) }}>{r.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {rows.length === 0 && <Empty msg="No APIs registered in API_USAGE_LIMITS." />}
        </Card>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.keys(API_USAGE_LIMITS).map(api => (
          <button key={api} onClick={() => { apiTracker.reset(api); force(n => n + 1); }} style={btnGhost}>
            Reset {api} counter
          </button>
        ))}
      </div>
    </div>
  );
}
/* ===========================================================================
   Activity Logs
   =========================================================================== */
export function Logs() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");

  const refresh = () => api.getLogs().then(setRows);
  useEffect(() => { refresh(); }, []);
  if (!rows) return <Loading />;

  const types = ["all", ...Array.from(new Set(rows.map(r => r.type)))];
  const filtered = rows.filter(r =>
    (r.actor + r.detail).toLowerCase().includes(q.toLowerCase()) &&
    (type === "all" || r.type === type))
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const clear = () => {
    if (!window.confirm("Clear the entire activity log? This cannot be undone.")) return;
    api.clearLogs(user.username);
    refresh();
  };

  const exportCsv = () => {
    const head = "timestamp,type,module,version,actor,ip,network,location,location_source,detail\n";
    const body = filtered.map(r => `${r.ts},${r.type},${r.module || ""},${r.version || ""},${r.actor},${r.ip || ""},${r.network || ""},"${[r.city, r.country].filter(Boolean).join(" ")}",${r.source === "gps" ? "GPS" : "IP (approx)"},"${r.detail}"`).join("\n");
    const blob = new Blob([head + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "prowater-logs.csv"; a.click();
  };


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "9px 14px", borderRadius: 11, background: "var(--mint-2)", color: "var(--forest)", fontSize: 12.5, fontWeight: 600 }}>
        <ScrollText size={15} /> Dashboard build v{APP_VERSION} · released {fmtDate(VERSION_DATE)}
      </div>
      <Toolbar q={q} setQ={setQ} placeholder="Search actor or detail…" count={filtered.length}
        right={<>
          <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
            {types.map(t => <option key={t} value={t}>{t === "all" ? "All events" : t.replace(/_/g, " ")}</option>)}
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
          <button onClick={clear} style={{ ...btnGhost, color: "#DC4141", borderColor: "#F5BFBF" }}><Trash2 size={15} /> Clear</button>
        </>} />
      <Card pad={false}>
        <Table head={["Time", "Event", "Module", "Version", "Actor", "IP / Network / Location", "Detail"]} maxHeight="calc(100vh - 240px)">
          {filtered.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12.5, verticalAlign: "top" }}>{fmtTime(r.ts)}</td>
              <td style={{ ...td, verticalAlign: "top" }}><LogChip type={r.type} /></td>
              <td style={{ ...td, verticalAlign: "top", fontSize: 12.5 }}>{r.module || "—"}</td>
              <td style={{ ...td, verticalAlign: "top", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.version ? `v${r.version}` : "—"}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{r.actor}</td>
              <td style={{ ...td, verticalAlign: "top", whiteSpace: "normal" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "ui-monospace,monospace", fontSize: 12.5, color: "var(--slate)" }}>
                    <Globe size={13} color="var(--muted)" />{r.ip || "—"}
                  </span>
                  {r.network && r.network !== "—" && <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 320, textAlign: "center" }}>{r.network}</div>}
                  {(r.city || r.country) && (
                    (r.lat != null && r.lon != null) ? (
                      <a href={`https://www.google.com/maps?q=${r.lat},${r.lon}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "var(--teal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} />{[r.city, r.country].filter(Boolean).join(" · ")}
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} />{[r.city, r.country].filter(Boolean).join(" · ")}
                      </span>
                    )
                  )}
                  {(r.city || r.country) && (
                    r.source === "gps"
                      ? <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", color: "#08805A", background: "#E2F3EE", padding: "1px 6px", borderRadius: 999 }}>GPS{r.accuracy != null ? ` · ±${r.accuracy}m` : ""}</span>
                      : <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".04em", color: "#986315", background: "#FBF0E0", padding: "1px 6px", borderRadius: 999 }}>APPROX · via ISP</span>
                  )}
                </div>
              </td>
              <td style={{ ...td, verticalAlign: "top" }}>{r.detail}</td>
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No activity recorded yet." />}
      </Card>
    </div>
  );
}
/* ===========================================================================
   API Failures (Logs Tracker tab) — live outage list + email-alert note
   =========================================================================== */
export function Failures() {
  const failures = useFailures();                 // re-renders when a failure opens/closes
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const open = failures.filter(f => !f.endedAt);
  const totalDowntime = failures.reduce((s, f) => s + (f.endedAt ? (f.downtimeMs || 0) : (Date.now() - new Date(f.startedAt).getTime())), 0);
  const sorted = [...failures].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());


  return (
    <div className="fade-up">
      <div style={grid4}>
        <Stat label="Currently down" value={open.length} icon={AlertCircle} sub={open.length ? "sources unreachable" : "all systems live"} hero={open.length > 0} />
        <Stat label="Total incidents" value={failures.length} icon={ScrollText} sub="since monitoring began" />
        <Stat label="Total downtime" value={fmtDowntime(totalDowntime)} icon={Clock} sub="across all incidents" />
      </div>
      <Card pad={false}>
        <Table head={["API", "Endpoint", "Failed at", "Reason", "Downtime", "Status"]} maxHeight="calc(100vh - 380px)">
          {sorted.map(f => {
            const live = !f.endedAt;
            const dt = live ? Date.now() - new Date(f.startedAt).getTime() : f.downtimeMs;
            return (
              <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{f.source}</td>
                <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 12, textAlign: "center" }}>{f.endpoint || "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5, color: "var(--muted)" }}>{fmtTime(f.startedAt)}</td>
                <td style={{ ...td, fontSize: 12.5, maxWidth: 280, textAlign: "center" }}>{f.reason || "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: live ? "#DC4141" : "var(--slate)" }}>{fmtDowntime(dt)}</td>
                <td style={td}>
                  {live
                    ? <span style={{ fontSize: 11.5, fontWeight: 600, color: "#DC4141", background: "#FBE8E8", padding: "3px 9px", borderRadius: 999 }}>● Live</span>
                    : <span style={{ fontSize: 11.5, fontWeight: 600, color: "#08805A", background: "#E2F3EE", padding: "3px 9px", borderRadius: 999 }}>Resolved</span>}
                </td>
              </tr>
            );
          })}
        </Table>
        {failures.length === 0 && <Empty msg="No API failures recorded. All systems healthy." />}
      </Card>
    </div>
  );
}
