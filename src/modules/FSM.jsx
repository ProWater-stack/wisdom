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
  ClipboardList, Truck, XCircle, BellOff, PauseCircle, Ban, MessageSquare, Phone,
} from "lucide-react";
import { useAuth, api, customerApi, hashStr, exportToCsv, fmtDate, deviceType, BENGALURU_CENTER } from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, Chip, Status,
  Person, DeviceTypeBadge, grid4, btnGhost, td,
} from "../shared/ui";

/* ===========================================================================
   FSM — TRACK TECHNICIAN (Bengaluru map via Leaflet + OpenStreetMap, no key)
   =========================================================================== */

// Bengaluru centre + a few sample technicians. Replace SAMPLE_TECHNICIANS with
// your live technician-location API when ready (keep the same field shape).
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

/* ===========================================================================
   FSM — OPS COMMAND: a Kanban-style Technician Jobs board (job status ×
   per-job Customer Status), plus Customer Sentiment and Customer Rating
   tables. All three are populated with SAMPLE_* dummy data below — replace
   each with your live feed when ready (keep the same field shape); the
   Customer Sentiment table in particular is meant to be sourced from a
   real sentiment-analysis API per the original request, not entered by hand.
   =========================================================================== */

// Technician Jobs — one entry per dispatched job. `status` drives which
// Kanban column it sits in; `customerStatus` is shown as its own badge on
// the card (independent of the job's own status).
const JOB_STATUSES = [
  { key: "assigned",      label: "Assigned",          icon: ClipboardList, color: "#2A86D6", bg: "#EAF3FC" },
  { key: "in_transit",    label: "In Transit",        icon: Truck,         color: "#B45309", bg: "#FDF3E7" },
  { key: "cancelled",     label: "Cancelled",         icon: XCircle,       color: "#DC4141", bg: "#FBE8E8" },
  { key: "not_ack",       label: "Not Acknowledged",  icon: BellOff,       color: "#6B7280", bg: "#F1F2F4" },
  { key: "postponed",     label: "Postponed",         icon: PauseCircle,   color: "#7C3AED", bg: "#F3EEFC" },
  { key: "not_moving",    label: "Not Moving",        icon: Ban,           color: "#8C1D1D", bg: "#F5E4E4" },
];
const CUSTOMER_STATUS_COLORS = {
  Available:   ["#08805A", "#E2F3EE"],
  Unavailable: ["#DC4141", "#FBE8E8"],
  Postponed:   ["#986315", "#FBF0E0"],
};
const SAMPLE_TECH_JOBS = [
  { id: "JOB-101", customer: "Abhijit Dey",                    society: "MJR Clique Hydra Apartment",  technician: "Ramesh K", jobType: "Filter Service",         scheduled: "Today, 2:00 PM",         status: "assigned",   customerStatus: "Available" },
  { id: "JOB-102", customer: "Ravi Kumar",                     society: "Prestige Lakeside",            technician: "Suresh M", jobType: "AMC Service",             scheduled: "Today, 4:30 PM",         status: "assigned",   customerStatus: "Postponed" },
  { id: "JOB-103", customer: "Sneha Patil",                    society: "Sobha Dream Acres",            technician: "Anil P",   jobType: "Installation",            scheduled: "Tomorrow, 11:00 AM",     status: "assigned",   customerStatus: "Available" },
  { id: "JOB-104", customer: "Deepa Nair",                     society: "Ashish JK",                    technician: "Vijay R",  jobType: "Repair Visit",            scheduled: "Today, 1:15 PM",         status: "in_transit", customerStatus: "Available" },
  { id: "JOB-105", customer: "Anand Ray",                      society: "CBR Aakruti",                  technician: "Manoj S",  jobType: "Complaint Resolution",    scheduled: "Today, 3:00 PM",         status: "in_transit", customerStatus: "Unavailable" },
  { id: "JOB-106", customer: "Arun K Sinha",                   society: "MJR Clique Hydra Apartment",   technician: "Ramesh K", jobType: "Filter Service",          scheduled: "Yesterday, 5:00 PM",     status: "cancelled",  customerStatus: "Unavailable" },
  { id: "JOB-107", customer: "Asha Anandan",                   society: "SVS Ananda Nilayam",           technician: "Deepak T", jobType: "AMC Service",             scheduled: "Yesterday, 10:00 AM",    status: "cancelled",  customerStatus: "Postponed" },
  { id: "JOB-108", customer: "Bikram",                         society: "MJR Clique Hydra Apartment",   technician: "Suresh M", jobType: "Installation",            scheduled: "Today, 6:00 PM",         status: "not_ack",    customerStatus: "Available" },
  { id: "JOB-109", customer: "Bibhuranjan Mohapatra",          society: "Prabhavathi Meghana Towers",   technician: "Prakash N", jobType: "Filter Service",         scheduled: "Tomorrow, 9:30 AM",      status: "not_ack",    customerStatus: "Unavailable" },
  { id: "JOB-110", customer: "Binay Pradhan",                  society: "Ashish JK",                    technician: "Anil P",   jobType: "Repair Visit",            scheduled: "Rescheduled → Fri, 12:00 PM", status: "postponed", customerStatus: "Postponed" },
  { id: "JOB-111", customer: "Chaudari Vipool",                society: "Sai Poorna Premier",           technician: "Vijay R",  jobType: "AMC Service",             scheduled: "Rescheduled → Sat, 2:00 PM",  status: "postponed", customerStatus: "Postponed" },
  { id: "JOB-112", customer: "Dhananjaya Samanta Singhar",     society: "The Green Terraces",           technician: "Manoj S",  jobType: "Complaint Resolution",    scheduled: "Today, 11:00 AM",        status: "not_moving", customerStatus: "Available" },
  { id: "JOB-113", customer: "Divya Vijayaraghavan",           society: "CBR Aakruti",                  technician: "Deepak T", jobType: "Filter Service",          scheduled: "Today, 9:00 AM",         status: "not_moving", customerStatus: "Unavailable" },
];

// Customer Sentiment — per the original request, this is meant to be
// sourced from a real sentiment-analysis API once connected; SAMPLE_SENTIMENT
// below is dummy data standing in until then (same "replace when live"
// convention as SAMPLE_TECHNICIANS above).
const SENTIMENT_COLORS = {
  "Good":               ["#08805A", "#E2F3EE"],
  "Neutral":            ["#6B7280", "#F1F2F4"],
  "Bad":                ["#986315", "#FBF0E0"],
  "Negative":           ["#DC4141", "#FBE8E8"],
  "Extremely Negative": ["#FFFFFF", "#B91C1C"],
};
const SAMPLE_SENTIMENT = [
  { customer: "Abhijit Dey",           society: "MJR Clique Hydra Apartment", purifierId: "HAC1F9F778", sentiment: "Good",               date: "2026-09-10", note: "Happy with the new filter, water tastes better." },
  { customer: "Ravi Kumar",            society: "Prestige Lakeside",          purifierId: "PW-00092",   sentiment: "Neutral",             date: "2026-09-09", note: "No major feedback, service was on time." },
  { customer: "Sneha Patil",           society: "Sobha Dream Acres",          purifierId: "PW-00101",   sentiment: "Bad",                 date: "2026-09-08", note: "Technician was late by 2 hours." },
  { customer: "Deepa Nair",            society: "Ashish JK",                  purifierId: "ZB-77",      sentiment: "Negative",            date: "2026-09-07", note: "Second complaint this month, not resolved." },
  { customer: "Anand Ray",             society: "CBR Aakruti",                purifierId: "PRSC1FE2C3", sentiment: "Extremely Negative",  date: "2026-09-05", note: "Threatening to cancel subscription, very upset." },
  { customer: "Arun K Sinha",          society: "MJR Clique Hydra Apartment", purifierId: "PRSM95B3A9", sentiment: "Good",               date: "2026-09-11", note: "Appreciated the quick response." },
  { customer: "Asha Anandan",          society: "SVS Ananda Nilayam",         purifierId: "PRSMFB3B8D", sentiment: "Neutral",             date: "2026-09-06", note: "Standard service, nothing notable." },
  { customer: "Bikram",                society: "MJR Clique Hydra Apartment", purifierId: "OWND000003", sentiment: "Bad",                 date: "2026-09-04", note: "Water flow still low after service." },
  { customer: "Bibhuranjan Mohapatra", society: "Prabhavathi Meghana Towers", purifierId: "OWND000006", sentiment: "Negative",            date: "2026-09-03", note: "Missed appointment without notice." },
  { customer: "Chaudari Vipool",       society: "Sai Poorna Premier",         purifierId: "HAM77E663C", sentiment: "Good",               date: "2026-09-12", note: "Very satisfied with the installation." },
];

// Customer Rating — dummy data, same "replace when live" convention.
const RATING_COLORS = {
  "Positive":     ["#08805A", "#E2F3EE"],
  "Appreciative": ["#2A86D6", "#EAF3FC"],
  "Negative":     ["#986315", "#FBF0E0"],
  "Critical":     ["#FFFFFF", "#B91C1C"],
};
const SAMPLE_RATINGS = [
  { customer: "Abhijit Dey",           society: "MJR Clique Hydra Apartment", rating: "Positive",     date: "2026-09-10", comment: "5-star service, will recommend." },
  { customer: "Ravi Kumar",            society: "Prestige Lakeside",          rating: "Appreciative", date: "2026-09-09", comment: "Thanked the technician personally." },
  { customer: "Deepa Nair",            society: "Ashish JK",                  rating: "Negative",     date: "2026-09-07", comment: "Unhappy with repeated visits." },
  { customer: "Anand Ray",             society: "CBR Aakruti",                rating: "Critical",     date: "2026-09-05", comment: "Escalated to support, considering cancellation." },
  { customer: "Sneha Patil",           society: "Sobha Dream Acres",          rating: "Negative",     date: "2026-09-08", comment: "Delayed service impacted rating." },
  { customer: "Arun K Sinha",          society: "MJR Clique Hydra Apartment", rating: "Appreciative", date: "2026-09-11", comment: "Left a thank-you note for the technician." },
  { customer: "Asha Anandan",          society: "SVS Ananda Nilayam",         rating: "Positive",     date: "2026-09-06", comment: "Smooth, professional visit." },
  { customer: "Bikram",                society: "MJR Clique Hydra Apartment", rating: "Critical",     date: "2026-09-04", comment: "Filed a formal complaint." },
  { customer: "Bibhuranjan Mohapatra", society: "Prabhavathi Meghana Towers", rating: "Negative",     date: "2026-09-03", comment: "Frustrated with the no-show." },
  { customer: "Chaudari Vipool",       society: "Sai Poorna Premier",         rating: "Positive",     date: "2026-09-12", comment: "Extremely happy, gave positive review." },
];

// Small pill badge shared by all three sections below — `map` is one of
// the *_COLORS lookups above.
function StatusPill({ value, map }) {
  const [color, bg] = map[value] || ["#6B7280", "#F1F2F4"];
  return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-block" }}>{value}</span>;
}

export function OpsCommand() {
  const { user } = useAuth();
  const [custStatusFilter, setCustStatusFilter] = useState("all"); // all | Available | Unavailable | Postponed
  const [jobQ, setJobQ] = useState("");
  const [sentQ, setSentQ] = useState("");
  const [sentFilter, setSentFilter] = useState("all");
  const [ratingQ, setRatingQ] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => { api.logView(user.username, "Viewed Ops Command"); }, []);

  const jobQl = jobQ.toLowerCase();
  const jobsFiltered = SAMPLE_TECH_JOBS.filter(j =>
    (custStatusFilter === "all" || j.customerStatus === custStatusFilter) &&
    (!jobQl || `${j.customer} ${j.technician} ${j.society} ${j.jobType}`.toLowerCase().includes(jobQl))
  );
  const custStatusCounts = {
    Available: SAMPLE_TECH_JOBS.filter(j => j.customerStatus === "Available").length,
    Unavailable: SAMPLE_TECH_JOBS.filter(j => j.customerStatus === "Unavailable").length,
    Postponed: SAMPLE_TECH_JOBS.filter(j => j.customerStatus === "Postponed").length,
  };

  const sentQl = sentQ.toLowerCase();
  const sentimentShown = SAMPLE_SENTIMENT.filter(r =>
    (sentFilter === "all" || r.sentiment === sentFilter) &&
    (!sentQl || `${r.customer} ${r.society} ${r.purifierId}`.toLowerCase().includes(sentQl))
  );
  const sentimentChips = ["all", "Good", "Neutral", "Bad", "Negative", "Extremely Negative"];

  const ratingQl = ratingQ.toLowerCase();
  const ratingsShown = SAMPLE_RATINGS.filter(r =>
    (ratingFilter === "all" || r.rating === ratingFilter) &&
    (!ratingQl || `${r.customer} ${r.society}`.toLowerCase().includes(ratingQl))
  );
  const ratingChips = ["all", "Positive", "Appreciative", "Negative", "Critical"];

  const exportJobsCsv = () => exportToCsv("prowater-ops-technician-jobs.csv", [
    { label: "Job ID", get: j => j.id }, { label: "Customer", get: j => j.customer },
    { label: "Society", get: j => j.society }, { label: "Technician", get: j => j.technician },
    { label: "Job Type", get: j => j.jobType }, { label: "Scheduled", get: j => j.scheduled },
    { label: "Job Status", get: j => JOB_STATUSES.find(s => s.key === j.status)?.label || j.status },
    { label: "Customer Status", get: j => j.customerStatus },
  ], jobsFiltered);
  const exportSentimentCsv = () => exportToCsv("prowater-ops-customer-sentiment.csv", [
    { label: "Customer", get: r => r.customer }, { label: "Society", get: r => r.society },
    { label: "Purifier ID", get: r => r.purifierId }, { label: "Sentiment", get: r => r.sentiment },
    { label: "Date", get: r => r.date }, { label: "Note", get: r => r.note },
  ], sentimentShown);
  const exportRatingCsv = () => exportToCsv("prowater-ops-customer-rating.csv", [
    { label: "Customer", get: r => r.customer }, { label: "Society", get: r => r.society },
    { label: "Rating", get: r => r.rating }, { label: "Date", get: r => r.date }, { label: "Comment", get: r => r.comment },
  ], ratingsShown);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 18 }}>
        <AlertCircle size={15} /> All three sections below show sample data — wire up the live dispatch feed and sentiment-analysis API to replace SAMPLE_TECH_JOBS / SAMPLE_SENTIMENT / SAMPLE_RATINGS with real values.
      </div>

      {/* ---- Technician Jobs (Kanban) ---- */}
      <Card pad={false} title="Technician Jobs" sub="Job status × Customer Status, per dispatched job">
        <div style={{ padding: "0 20px 16px" }}>
          <Toolbar q={jobQ} setQ={setJobQ} placeholder="Search customer, technician, society…" count={jobsFiltered.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 2 }}>Customer Status:</span>
                {["all", "Available", "Unavailable", "Postponed"].map(v => (
                  <button key={v} onClick={() => setCustStatusFilter(v)}
                    style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (custStatusFilter === v ? "var(--teal)" : "var(--border)"), background: custStatusFilter === v ? "var(--mint-2)" : "#fff", color: custStatusFilter === v ? "var(--teal-d)" : "var(--slate)" }}>
                    {v === "all" ? `All (${SAMPLE_TECH_JOBS.length})` : `${v} (${custStatusCounts[v]})`}
                  </button>
                ))}
                <button onClick={exportJobsCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
        </div>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 20px 20px" }}>
          {JOB_STATUSES.map(col => {
            const colJobs = jobsFiltered.filter(j => j.status === col.key);
            const Icon = col.icon;
            return (
              <div key={col.key} style={{ flex: "0 0 260px", width: 260, background: col.bg, border: `1.5px solid ${col.color}33`, borderRadius: 14, display: "flex", flexDirection: "column", maxHeight: 640 }}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${col.color}33`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={15} color={col.color} />
                  <strong style={{ fontSize: 13, color: col.color }}>{col.label}</strong>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: col.color, background: "#fff", padding: "2px 8px", borderRadius: 999 }}>{colJobs.length}</span>
                </div>
                <div style={{ overflowY: "auto", flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 9 }}>
                  {colJobs.map(j => (
                    <div key={j.id} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderLeft: `3.5px solid ${col.color}`, borderRadius: 12, padding: "11px 13px", boxShadow: "0 3px 10px rgba(0,0,0,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                        <strong style={{ fontSize: 13, color: "var(--f)" }}>{j.customer}</strong>
                        <StatusPill value={j.customerStatus} map={CUSTOMER_STATUS_COLORS} />
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{j.society}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, fontSize: 12, color: "var(--slate)" }}>
                        <UserRound size={12} /> {j.technician}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: 12, color: "var(--slate)" }}>
                        <CalendarClock size={12} /> {j.scheduled}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{j.jobType}</div>
                    </div>
                  ))}
                  {colJobs.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "20px 8px" }}>No jobs</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---- Customer Sentiment ---- */}
      <div style={{ marginTop: 20 }}>
        <Card title="Customer Sentiment" sub="From the sentiment-analysis API (dummy data shown until connected)">
          <Toolbar q={sentQ} setQ={setSentQ} placeholder="Search customer, society, purifier…" count={sentimentShown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {sentimentChips.map(v => (
                  <button key={v} onClick={() => setSentFilter(v)}
                    style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (sentFilter === v ? "var(--teal)" : "var(--border)"), background: sentFilter === v ? "var(--mint-2)" : "#fff", color: sentFilter === v ? "var(--teal-d)" : "var(--slate)" }}>
                    {v === "all" ? `All (${SAMPLE_SENTIMENT.length})` : v}
                  </button>
                ))}
                <button onClick={exportSentimentCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
          <Table head={["Customer", "Society", "Purifier ID", "Sentiment", "Date", "Note"]} maxHeight={480}>
            {sentimentShown.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}><Person name={r.customer} /></td>
                <td style={{ ...td, fontSize: 12.5 }}>{r.society}</td>
                <td style={{ ...td, textAlign: "center" }}><Chip>{r.purifierId}</Chip></td>
                <td style={{ ...td, textAlign: "center" }}><StatusPill value={r.sentiment} map={SENTIMENT_COLORS} /></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{fmtDate(new Date(r.date))}</td>
                <td style={{ ...td, textAlign: "left", fontSize: 12.5, color: "var(--slate)" }}><MessageSquare size={12} style={{ verticalAlign: "-1px", marginRight: 4, opacity: .6 }} />{r.note}</td>
              </tr>
            ))}
            {sentimentShown.length === 0 && <tr><td colSpan={6} style={{ padding: 0 }}><Empty msg="No feedback matches this filter." /></td></tr>}
          </Table>
        </Card>
      </div>

      {/* ---- Customer Rating ---- */}
      <div style={{ marginTop: 20 }}>
        <Card title="Customer Rating" sub="Per-visit customer rating">
          <Toolbar q={ratingQ} setQ={setRatingQ} placeholder="Search customer, society…" count={ratingsShown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {ratingChips.map(v => (
                  <button key={v} onClick={() => setRatingFilter(v)}
                    style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (ratingFilter === v ? "var(--teal)" : "var(--border)"), background: ratingFilter === v ? "var(--mint-2)" : "#fff", color: ratingFilter === v ? "var(--teal-d)" : "var(--slate)" }}>
                    {v === "all" ? `All (${SAMPLE_RATINGS.length})` : v}
                  </button>
                ))}
                <button onClick={exportRatingCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
          <Table head={["Customer", "Society", "Rating", "Date", "Comment"]} maxHeight={480}>
            {ratingsShown.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}><Person name={r.customer} /></td>
                <td style={{ ...td, fontSize: 12.5 }}>{r.society}</td>
                <td style={{ ...td, textAlign: "center" }}><StatusPill value={r.rating} map={RATING_COLORS} /></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{fmtDate(new Date(r.date))}</td>
                <td style={{ ...td, textAlign: "left", fontSize: 12.5, color: "var(--slate)" }}><MessageSquare size={12} style={{ verticalAlign: "-1px", marginRight: 4, opacity: .6 }} />{r.comment}</td>
              </tr>
            ))}
            {ratingsShown.length === 0 && <tr><td colSpan={5} style={{ padding: 0 }}><Empty msg="No ratings match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}
