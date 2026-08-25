/* ============================================================================
   modules/FSM.jsx — FSM (Field Service Management) module. Extracted verbatim
   from App.jsx (v2.30 module-split). Technician tracking (sample map data),
   AMC/maintenance scheduling, and water-quality compliance — all derive
   representative values from customer data until live feeds are connected.
   ============================================================================ */

import { useState, useEffect, useRef } from "react";
import {
  AlertCircle, BarChart3, CalendarClock, CheckCircle2, Download, Droplets,
  MapPin, RotateCcw, Search, ShieldCheck, Target, UserRound, Wrench,
} from "lucide-react";
import { useAuth, api, customerApi, hashStr, exportToCsv, fmtDate, deviceType } from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, Chip, Status,
  Person, DeviceTypeBadge, grid4, btnGhost, td,
} from "../shared/ui";

/* ===========================================================================
   FSM — TRACK TECHNICIAN (Bengaluru map via Leaflet + OpenStreetMap, no key)
   =========================================================================== */

// Bengaluru centre + a few sample technicians. Replace SAMPLE_TECHNICIANS with
// your live technician-location API when ready (keep the same field shape).
export const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };
const SAMPLE_TECHNICIANS = [
  { id: "T-01", name: "Ramesh K", status: "on_job",    lat: 12.9352, lng: 77.6245, area: "Koramangala", job: "Installation · CUS-00045" },
  { id: "T-02", name: "Suresh M", status: "available", lat: 12.9719, lng: 77.6412, area: "Indiranagar", job: "Idle" },
  { id: "T-03", name: "Anil P",   status: "on_job",    lat: 12.9081, lng: 77.6476, area: "HSR Layout",  job: "Service · CUS-00101" },
  { id: "T-04", name: "Vijay R",  status: "en_route",  lat: 13.0298, lng: 77.5400, area: "Hebbal",      job: "En route · CUS-00092" },
  { id: "T-05", name: "Manoj S",  status: "available", lat: 12.9250, lng: 77.5938, area: "Jayanagar",   job: "Idle" },
];


export function TrackTechnician() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const [techs] = useState(SAMPLE_TECHNICIANS);
  const [sel, setSel] = useState(null);

  const statusColor = (s) => s === "on_job" ? "#DC4141" : s === "en_route" ? "#986315" : "#08805A";
  const statusLabel = (s) => s === "on_job" ? "On job" : s === "en_route" ? "En route" : "Available";

  useEffect(() => { api.logView(user.username, "Viewed Track Technician"); }, []);

  // Load Leaflet from CDN (once), then init the Bengaluru map.
  useEffect(() => {
    let cancelled = false;
    const CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    const ensureCss = () => {
      if (!document.querySelector(`link[href="${CSS}"]`)) {
        const l = document.createElement("link");
        l.rel = "stylesheet"; l.href = CSS; document.head.appendChild(l);
      }
    };
    const ensureJs = () => new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      let s = document.querySelector(`script[src="${JS}"]`);
      if (s) { s.addEventListener("load", () => resolve(window.L)); return; }
      s = document.createElement("script");
      s.src = JS; s.async = true;
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error("Leaflet failed to load"));
      document.head.appendChild(s);
    });

    ensureCss();
    ensureJs().then((L) => {
      if (cancelled || !mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([BENGALURU_CENTER.lat, BENGALURU_CENTER.lng], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", maxZoom: 19,
      }).addTo(map);
      mapObj.current = map;
      renderMarkers(L, map);
    }).catch(() => {});

    return () => { cancelled = true; if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, []);

  const renderMarkers = (L, map) => {
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    techs.forEach(t => {
      let icon;
      if (t.status === "en_route") {
        // Animated biker for technicians travelling to site.
        icon = L.divIcon({
          className: "tech-pin",
          html: `<div class="biker" style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">🏍️</div>`,
          iconSize: [26, 26], iconAnchor: [13, 22],
        });
      } else {
        icon = L.divIcon({
          className: "tech-pin",
          html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${statusColor(t.status)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 16],
        });
      }
      const m = L.marker([t.lat, t.lng], { icon }).addTo(map);
      m.bindPopup(`<strong>${t.name}</strong><br/>${statusLabel(t.status)} · ${t.area}<br/><span style="color:#7D8A83">${t.job}</span>`);
      m.on("click", () => setSel(t));
      markersRef.current.push(m);
    });
  };

  const counts = {
    available: techs.filter(t => t.status === "available").length,
    en_route: techs.filter(t => t.status === "en_route").length,
    on_job: techs.filter(t => t.status === "on_job").length,
  };


  return (
    <div className="fade-up">
      <div style={grid4}>
        <Stat label="Technicians" value={techs.length} icon={UserRound} sub="in Bengaluru" hero />
        <Stat label="Available" value={counts.available} icon={CheckCircle2} sub="ready for dispatch" />
        <Stat label="En route" value={counts.en_route} icon={MapPin} sub="travelling to site" />
        <Stat label="On job" value={counts.on_job} icon={Wrench} sub="currently servicing" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, marginTop: 18 }} className="fsm-grid">
        <style>{`@media(max-width:900px){.fsm-grid{grid-template-columns:1fr!important}}`}</style>
        <Card pad={false} title="Live map · Bengaluru" sub="Technician positions">
          <div ref={mapRef} style={{ width: "100%", height: 520, borderRadius: 12, overflow: "hidden", background: "#EEF7F3" }} />
        </Card>

        <Card pad={false} title="Technicians" sub={`${techs.length} active`}>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {techs.map(t => (
              <div key={t.id} onClick={() => { setSel(t); if (mapObj.current) mapObj.current.setView([t.lat, t.lng], 14); }}
                style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: sel?.id === t.id ? "var(--mint-2)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusColor(t.status) }} />
                  <strong style={{ fontSize: 13.5 }}>{t.name}</strong>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: statusColor(t.status) }}>{statusLabel(t.status)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{t.area} · {t.job}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
        Map data © OpenStreetMap. Technician positions are sample data — replace SAMPLE_TECHNICIANS in the code with your live location feed.
      </p>
    </div>
  );
}
export const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
/* ---- FSM: AMC / Maintenance scheduling ---- */
export function MaintenanceSchedule() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all"); // all | overdue | soon | upcoming

  useEffect(() => {
    api.logView(user.username, "Viewed AMC / Maintenance");
    customerApi.getCustomers().then(setData).catch(e => setErr(e.message || "Could not load customers."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Maintenance Schedule" subtitle="Synchronizing field service jobs…" />;

  const now = Date.now();
  const MS_DAY = 86400000;
  const INTERVAL = 3; // quarterly filter service

  const items = data
    .filter(c => c.status === "active" && c.purifier_id)
    .map(c => {
      const start = c.since ? new Date(c.since) : null;
      if (!start || isNaN(start.getTime())) return { c, last: null, next: null, days: null };
      const monthsSince = Math.max(0, (now - start.getTime()) / (MS_DAY * 30.44));
      const cycles = Math.floor(monthsSince / INTERVAL);
      const last = addMonths(start, cycles * INTERVAL);
      const next = addMonths(start, (cycles + 1) * INTERVAL);
      return { c, last, next, days: Math.round((next.getTime() - now) / MS_DAY) };
    })
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));

  const statusOf = (d) => d == null ? "unknown" : d < 0 ? "overdue" : d <= 14 ? "soon" : "upcoming";
  const overdue = items.filter(i => statusOf(i.days) === "overdue").length;
  const soon = items.filter(i => statusOf(i.days) === "soon").length;
  const upcoming = items.filter(i => statusOf(i.days) === "upcoming").length;

  const stats = [
    { label: "Under AMC", value: items.length, icon: Wrench, sub: "active purifiers", hero: true },
    { label: "Overdue", value: overdue, icon: AlertCircle, sub: "service past due" },
    { label: "Due soon", value: soon, icon: CalendarClock, sub: "within 14 days" },
    { label: "Upcoming", value: upcoming, icon: RotateCcw, sub: "scheduled ahead" },
  ];

  const badge = (d) => {
    const s = statusOf(d);
    const map = { overdue: ["#DC4141", "#FBE8E8", `${-d}d overdue`], soon: ["#986315", "#FBF0E0", `in ${d}d`], upcoming: ["#08805A", "#E2F3EE", `in ${d}d`], unknown: ["#7D8A83", "#ECEEED", "no date"] };
    const [c, bg, lbl] = map[s];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const ql = q.toLowerCase();
  const shown = items.filter(i => (bucket === "all" || statusOf(i.days) === bucket) &&
    (!ql || `${i.c.name} ${i.c.purifier_id} ${i.c.society}`.toLowerCase().includes(ql)));

  const chips = [["all", `All (${items.length})`], ["overdue", `Overdue (${overdue})`], ["soon", `Due soon (${soon})`], ["upcoming", `Upcoming (${upcoming})`]];

  const exportCsv = () => exportToCsv("prowater-amc-schedule.csv", [
    { label: "Customer", get: i => i.c.name },
    { label: "Purifier ID", get: i => i.c.purifier_id },
    { label: "Device Type", get: i => deviceType(i.c.purifier_id) },
    { label: "Society", get: i => i.c.society },
    { label: "Last service", get: i => i.last ? fmtDate(i.last) : "" },
    { label: "Next due", get: i => i.next ? fmtDate(i.next) : "" },
    { label: "Status", get: i => statusOf(i.days) },
  ], shown);


  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="AMC / Maintenance schedule" sub="Quarterly filter service projected from each purifier's install date.">
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, purifier or society…" count={shown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {chips.map(([id, lbl]) => (
                  <button key={id} onClick={() => setBucket(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (bucket === id ? "var(--teal)" : "var(--border)"), background: bucket === id ? "var(--mint-2)" : "#fff", color: bucket === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>
                ))}
                <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
          <Table head={["Customer", "Purifier", "Device", "Society", "Last service", "Next due", "Status"]} maxHeight={520}>
            {shown.map((i, idx) => {
              const s = statusOf(i.days);
              const bg = s === "overdue" ? "#FBE8E8" : s === "soon" ? "#FBF0E0" : "transparent";
              return (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: bg }}>
                  <td style={td}><Person name={i.c.name || "—"} email={i.c.email} /></td>
                  <td style={{ ...td, textAlign: "center" }}>{i.c.purifier_id ? <Chip>{i.c.purifier_id}</Chip> : "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}><DeviceTypeBadge purifierId={i.c.purifier_id} /></td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.c.society || "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.last ? fmtDate(i.last) : "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5, fontWeight: 600 }}>{i.next ? fmtDate(i.next) : "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{badge(i.days)}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={7} style={{ padding: 0 }}><Empty msg="No purifiers match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}
/* ---- FSM / ERP: Water quality & compliance ---- */
export function WaterQuality() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | compliant | watch | fail

  useEffect(() => {
    api.logView(user.username, "Viewed Water quality & compliance");
    customerApi.getCustomers().then(setData).catch(e => setErr(e.message || "Could not load devices."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Water Quality" subtitle="Synchronizing water quality readings…" />;

  const now = Date.now();
  const MS_DAY = 86400000;

  const items = data.filter(c => c.purifier_id).map(c => {
    const h = hashStr(c.purifier_id);
    const inTds = 250 + (h % 400);   // raw input TDS (250–649 ppm)
    const outTds = 30 + (h % 130);   // purified output TDS (30–159 ppm)
    const daysAgo = h % 90;
    const lastTest = new Date(now - daysAgo * MS_DAY);
    const testDue = daysAgo > 60;
    const status = outTds <= 100 ? "compliant" : outTds <= 130 ? "watch" : "fail";
    return { c, inTds, outTds, lastTest, testDue, status };
  });

  const compliant = items.filter(i => i.status === "compliant").length;
  const watch = items.filter(i => i.status === "watch").length;
  const fail = items.filter(i => i.status === "fail").length;
  const avgOut = items.length ? Math.round(items.reduce((a, i) => a + i.outTds, 0) / items.length) : 0;
  const testsDue = items.filter(i => i.testDue).length;

  const stats = [
    { label: "Devices monitored", value: items.length, icon: Droplets, sub: "with purifier ID", hero: true },
    { label: "Compliant", value: `${items.length ? Math.round(compliant / items.length * 100) : 0}%`, icon: ShieldCheck, sub: `${compliant} of ${items.length}` },
    { label: "Avg output TDS", value: `${avgOut} ppm`, icon: BarChart3, sub: "post-purification" },
    { label: "Tests due", value: testsDue, icon: AlertCircle, sub: "not tested in 60d" },
  ];

  const statusChip = (s) => {
    const map = { compliant: ["#08805A", "#E2F3EE", "Compliant"], watch: ["#986315", "#FBF0E0", "Watch"], fail: ["#DC4141", "#FBE8E8", "Non-compliant"] };
    const [c, bg, lbl] = map[s];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const ql = q.toLowerCase();
  const shown = items.filter(i => (filter === "all" || i.status === filter) &&
    (!ql || `${i.c.name} ${i.c.purifier_id} ${i.c.society}`.toLowerCase().includes(ql)));

  const chips = [["all", `All (${items.length})`], ["compliant", `Compliant (${compliant})`], ["watch", `Watch (${watch})`], ["fail", `Non-compliant (${fail})`]];

  const exportCsv = () => exportToCsv("prowater-water-quality.csv", [
    { label: "Customer", get: i => i.c.name },
    { label: "Purifier ID", get: i => i.c.purifier_id },
    { label: "Society", get: i => i.c.society },
    { label: "Input TDS", get: i => i.inTds },
    { label: "Output TDS", get: i => i.outTds },
    { label: "Last test", get: i => fmtDate(i.lastTest) },
    { label: "Compliance", get: i => i.status },
  ], shown);


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Target output TDS ≤ 100 ppm (BIS drinking-water guidance). Readings are illustrative until live device/water-test data is connected.
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Water quality & compliance" sub="Per-device TDS readings and compliance status.">
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, purifier or society…" count={shown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {chips.map(([id, lbl]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"), background: filter === id ? "var(--mint-2)" : "#fff", color: filter === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>
                ))}
                <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
          <Table head={["Customer", "Purifier", "Society", "Input TDS", "Output TDS", "Last test", "Compliance"]} maxHeight={520}>
            {shown.map((i, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: i.status === "fail" ? "#FBE8E8" : "transparent" }}>
                <td style={td}><Person name={i.c.name || "—"} email={i.c.email} /></td>
                <td style={{ ...td, textAlign: "center" }}>{i.c.purifier_id ? <Chip>{i.c.purifier_id}</Chip> : "—"}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.c.society || "—"}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{i.inTds} ppm</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 600, color: i.status === "fail" ? "#DC4141" : i.status === "watch" ? "#986315" : "var(--teal-d)" }}>{i.outTds} ppm</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: i.testDue ? "#986315" : "var(--muted)" }}>{fmtDate(i.lastTest)}</td>
                <td style={{ ...td, textAlign: "center" }}>{statusChip(i.status)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} style={{ padding: 0 }}><Empty msg="No devices match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}
