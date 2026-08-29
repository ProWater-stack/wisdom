/* ============================================================================
   modules/AutoScheduler.jsx — Auto Scheduler module. Extracted verbatim from
   App.jsx (v2.30 module-split). Recurring society general-service (GS)
   scheduling with auto-raised tickets (local-first), plus IoT device alerts
   (as_iot tab — distinct from IoT Core's own IoTAlertsPage/iot_alerts tab).
   ============================================================================ */

import { useState, useEffect } from "react";
import {
  AlertCircle, CalendarClock, CheckCircle2, Cpu, Eye, Hourglass,
  MapPin, Plus, RefreshCw, Ticket,
} from "lucide-react";
import {
  useAuth, api, customerApi, apartmentApi, ticketApi, hashStr, fmtDate,
  fmtTime, isoDay, pushLog, API_BASE, LS,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, Chip,
  Person, Field, Modal, btnPrimary, btnGhost, inp, selectStyle, td,
  toastStyle, grid4, GsTextCell,
} from "../shared/ui";

/* ===========================================================================
   AUTO SCHEDULER — recurring society general-service (GS) + IoT alerts
   =========================================================================== */
export const GS_INTERVAL_DAYS = 15;
export const AUTO_GS_SEED = [
  { name: "CBR Aakruti",                installedDate: "2026-01-15", totalFlats: 108, numTowers: 2, croType: "Eco crystal", lastBackwash: "2026-06-28", lastDozing: "NA",             offset: 11 },
  { name: "SVS Ananda Nilayam",         installedDate: "2026-02-10", totalFlats: 168, numTowers: 5, croType: "Alfa Enviro", lastBackwash: "2026-06-25", lastDozing: "2026-06-25",     offset: 14 },
  { name: "MJR Clique Hydra",           installedDate: "2025-11-20", totalFlats: 300, numTowers: 5, croType: "Eco crystal", lastBackwash: "2026-07-01", lastDozing: "Yet to install", offset: 8 },
  { name: "Ashish JK",                  installedDate: "2026-03-05", totalFlats: 206, numTowers: 6, croType: "Alfa Enviro", lastBackwash: "2026-07-06", lastDozing: "2026-07-06",     offset: 3 },
  { name: "Prabhavathi Meghana Towers", installedDate: "2026-01-28", totalFlats: 80,  numTowers: 1, croType: "Eco crystal", lastBackwash: "2026-06-22", lastDozing: "NA",             offset: 17 },
];
export const _gsTickets = {};   // society -> ticket id
export const _iotTickets = {};  // purifier id -> ticket id
export const _gsAdded = [];     // societies added locally when the endpoint is offline
export const _gsDateOverrides = LS.get("pw_gs_date_overrides", {}) || {};
export const saveGsOverrides = () => LS.set("pw_gs_date_overrides", _gsDateOverrides);
export const applyGsOverrides = (row) => {
  const o = _gsDateOverrides[row.name || row.society];
  return o ? { ...row, ...o } : row;
};
// GS schedule store — the SAME data the cron job reads/writes. Falls back to the
// local seed until DevOps exposes the endpoint (see cron/README.md §4).
export const GS_ENDPOINT = () => `${API_BASE}/api/gs-schedules`;
export const schedulerApi = {
  getSchedules: async () => {
    try {
      const res = await fetch(GS_ENDPOINT());
      if (!res.ok) throw new Error(`GS schedules ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.schedules || json.data || []);
      if (!list.length) throw new Error("empty");
      // NOTE: Auto Scheduler is LOCAL-FIRST — it does NOT markSample / flag Server
      // Down when the (optional) endpoint is offline; the local seed is authoritative.
      return list.map(r => ({
        name:          r.society || r.name || "",
        installedDate: r.installedDate || r.installed_date || "",
        totalFlats:    Number(r.totalFlats ?? r.total_flats) || 0,
        numTowers:     Number(r.numTowers ?? r.num_towers) || 0,
        croType:       r.croType || r.cro_type || r.cro_250_lph_type || "",
        lastBackwash:  r.lastBackwash || r.last_backwash || r.lastService || "",
        lastDozing:    r.lastDozing || r.last_dozing || "",
        lastService:   r.lastService || r.last_service || "",
        address:       r.address || r.apartment_address || r.location || "",
        ticketId:      r.cycleTicketId || r.ticketId || r.ticket_id || null,
      })).map(applyGsOverrides);
    } catch (e) {
      console.warn("GS schedules endpoint unavailable, using local data:", e.message);
      return [...AUTO_GS_SEED, ..._gsAdded].map(applyGsOverrides);
    }
  },
  // >>> WIRE: PATCH /api/gs-schedules/:society updates the backwash/dozing dates
  //     the cron reads. Until it exists we persist the edit locally (localStorage)
  //     so it survives reloads. Admin/DevOps only — gated in the UI.
  updateSocietyDates: async (actor, society, fields) => {
    _gsDateOverrides[society] = { ...(_gsDateOverrides[society] || {}), ...fields };
    saveGsOverrides();
    const nm = { lastBackwash: "Backwash date", lastDozing: "Dozing date", address: "Address", totalFlats: "No of Flats", numTowers: "No of Towers", installedDate: "CRO Installed Date", croType: "CRO type", nextManual: "Next service" };
    const detail = `Updated ${society} — ${Object.entries(fields).map(([k, v]) => `${nm[k] || k}: ${v || "cleared"}`).join(", ")}`;
    try {
      const res = await fetch(`${GS_ENDPOINT()}/${encodeURIComponent(society)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, last_backwash: fields.lastBackwash, last_dozing: fields.lastDozing,
          total_flats: fields.totalFlats, num_towers: fields.numTowers, installed_date: fields.installedDate,
          cro_type: fields.croType, next_service: fields.nextManual }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      pushLog({ type: "society_updated", actor, module: "Auto Scheduler", detail });
      return { saved: true };
    } catch {
      pushLog({ type: "society_updated", actor, module: "Auto Scheduler", detail: `${detail} (saved locally — endpoint offline)` });
      return { saved: false };
    }
  },
  // >>> WIRE: POST /api/gs-schedules persists a society to the store the cron
  //     reads, which auto-puts it on the 15-day ticket cycle.
  addSociety: async (actor, meta) => {
    const payload = { society: meta.name, installedDate: meta.installedDate, totalFlats: meta.totalFlats, numTowers: meta.numTowers, cro_type: meta.croType, last_backwash: meta.lastBackwash, last_dozing: meta.lastDozing, address: meta.address, lastService: meta.lastBackwash || meta.installedDate };
    try {
      const res = await fetch(GS_ENDPOINT(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`${res.status}`);
      pushLog({ type: "society_added", actor, module: "Auto Scheduler", detail: `Added society ${meta.name} — ${meta.totalFlats} flats, ${meta.numTowers} towers` });
      return { saved: true, ...(await res.json().catch(() => ({}))) };
    } catch (e) {
      _gsAdded.push(meta); // local fallback so it persists this session until the endpoint is live
      pushLog({ type: "society_added", actor, module: "Auto Scheduler", detail: `Added society ${meta.name} (saved locally — endpoint offline)` });
      return { saved: false };
    }
  },
};
export const DAY_MS = 86400000;
export const validGsDate = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
export const buildGsRow = (s) => {
  const now = Date.now();
  // Cycle is driven by the last BACKWASH service date (valid date); then fall back
  // to lastService, the demo offset, and finally the install date.
  const last = validGsDate(s.lastBackwash) || (s.lastService ? new Date(s.lastService) : null)
    || (s.offset != null ? new Date(now - s.offset * DAY_MS) : null)
    || new Date(s.installedDate);
  // Next service is normally last backwash + 15 days, but a manual override wins
  // (lets Admin reschedule a visit).
  const next = validGsDate(s.nextManual) || new Date(last.getTime() + GS_INTERVAL_DAYS * DAY_MS);
  return {
    society: s.name, installedDate: s.installedDate, totalFlats: s.totalFlats, numTowers: s.numTowers,
    croType: s.croType || "", lastBackwash: s.lastBackwash || "", lastDozing: s.lastDozing || "", address: s.address || "",
    nextManual: s.nextManual || "",
    last, next, daysLeft: Math.ceil((next.getTime() - now) / DAY_MS), ticketId: _gsTickets[s.name] || s.ticketId || null,
  };
};
export const toGsMeta = (r) => ({
  name: r.society, installedDate: r.installedDate, totalFlats: r.totalFlats, numTowers: r.numTowers,
  croType: r.croType, lastBackwash: r.lastBackwash, lastDozing: r.lastDozing, address: r.address,
  nextManual: r.nextManual, ticketId: r.ticketId,
  lastService: r.last instanceof Date ? r.last.toISOString() : r.lastService,
});
export function AutoGSSociety({ accessLevel = "view" }) {
  const { user } = useAuth();
  // Only Admin-level access (admin / devops) may edit the schedule inline; others view only.
  const canEdit = accessLevel === "admin" || accessLevel === "devops";
  const [societyFilter, setSocietyFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", installedDate: "", totalFlats: "", numTowers: "", croType: "Eco crystal", lastBackwash: "", lastDozing: "", address: "" });
  const [rows, setRows] = useState(null);

  // Render a service date cell: "NA" / "Yet to install" pass through; else format.
  const fmtServiceVal = (v) => { if (v == null || v === "") return "—"; if (String(v).toUpperCase() === "NA") return "NA"; if (/yet to install/i.test(v)) return "Yet to install"; return fmtDate(v); };
  // Dozing text colour: amber for "yet to install", muted for NA, normal otherwise.
  const dozingColor = (v) => /yet to install/i.test(v) ? "#986315" : (String(v).toUpperCase() === "NA" ? "var(--muted)" : "var(--slate)");

  useEffect(() => {
    api.logView(user.username, "Viewed Auto GS - Society");
    schedulerApi.getSchedules()
      .then(list => setRows(list.map(buildGsRow)))
      .catch(() => setRows([...AUTO_GS_SEED, ..._gsAdded].map(buildGsRow)));
  }, []);

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const addSociety = async () => {
    const meta = {
      name: form.name.trim(),
      installedDate: form.installedDate,
      totalFlats: Number(form.totalFlats) || 0,
      numTowers: Number(form.numTowers) || 0,
      croType: form.croType,
      lastBackwash: form.lastBackwash,
      lastDozing: form.lastDozing,
      address: form.address.trim(),
    };
    setSaving(true);
    try {
      const { saved } = await schedulerApi.addSociety(user.username, meta);
      setRows(rs => [...(rs || []), buildGsRow(meta)]);
      setAddOpen(false);
      setForm({ name: "", installedDate: "", totalFlats: "", numTowers: "", croType: "Eco crystal", lastBackwash: "", lastDozing: "", address: "" });
      flash(saved ? `Society "${meta.name}" saved to schedule` : `Society "${meta.name}" added (saved locally — backend offline)`);
    } finally { setSaving(false); }
  };

  // Inline edit of a society field (Backwash / Dozing dates, or Address). Rebuilds
  // the row so Next service & Days left — both driven by the backwash date — update
  // immediately; address just passes through.
  const updateField = async (society, field, value) => {
    if (!canEdit) return; // defence in depth; the input isn't rendered otherwise
    setRows(rs => rs.map(r => r.society === society ? buildGsRow({ ...toGsMeta(r), [field]: value }) : r));
    const { saved } = await schedulerApi.updateSocietyDates(user.username, society, { [field]: value });
    const label = field === "lastBackwash" ? "Backwash date" : field === "lastDozing" ? "Dozing date" : "Address";
    flash(saved ? `${society}: ${label} updated` : `${society}: ${label} saved locally (endpoint offline)`);
  };

  // A Backwash/Dozing date cell: an inline date picker for Admin/DevOps, plain
  // read-only text (the original rendering) for everyone else.
  const dateCell = (r, field) => {
    const raw = r[field];
    const d = validGsDate(raw);
    if (!canEdit) {
      if (field === "lastBackwash") return fmtServiceVal(raw) === "—" ? fmtDate(r.last) : fmtServiceVal(raw);
      return <span style={{ color: dozingColor(raw) }}>{fmtServiceVal(raw)}</span>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <input type="date" value={d ? isoDay(d) : ""}
          onChange={e => updateField(r.society, field, e.target.value)}
          style={{ ...inp, width: 148, padding: "6px 8px", fontSize: 12.5, marginBottom: 0, cursor: "pointer" }} />
        {!d && raw ? <span style={{ fontSize: 10.5, color: dozingColor(raw) }}>currently: {fmtServiceVal(raw)}</span> : null}
      </div>
    );
  };

  if (!rows) return <Loading title="Loading Recurring Schedules" subtitle="Synchronizing society service schedules…" />;

  const createTicketFor = async (society) => {
    setBusy(society);
    const r = rows.find(x => x.society === society);
    try {
      const id = await apartmentApi.createTicket(user.username, {
        apName: society,                         // apartment name → ticket Society Name field
        address: r.address?.trim() || "Testing", // society's address (falls back so the endpoint's non-blank check passes)
        technicianPhoneNumber: "9876543210",     // hardcoded
        subject: "Auto GS Schedule",             // ticket subject (backend now reads this field)
      });
      if (id) {
        _gsTickets[society] = id;
        setRows(rs => rs.map(x => x.society === society ? { ...x, ticketId: id } : x));
        flash(`Ticket ${id} created for ${society}`);
      } else {
        flash(`Ticket created for ${society}, but no ID was returned.`);
      }
    } catch (e) {
      flash(`Couldn't create ticket: ${e.message}`);
    } finally { setBusy(null); }
  };

  const dueCount = rows.filter(r => r.daysLeft <= 1 && !r.ticketId).length;
  const ticketsCreated = rows.filter(r => r.ticketId).length;
  const nearest = [...rows].sort((a, b) => a.daysLeft - b.daysLeft)[0];

  const daysBadge = (d) => {
    const [c, bg, lbl] = d < 0 ? ["#DC4141", "#FBE8E8", `${-d}d overdue`]
      : d <= 1 ? ["#986315", "#FBF0E0", d <= 0 ? "due today" : "due tomorrow"]
      : ["#08805A", "#E2F3EE", `${d} days`];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const shown = societyFilter === "all" ? rows : rows.filter(r => r.society === societyFilter);


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> A general service runs every {GS_INTERVAL_DAYS} days per society. On day 14 a ticket is raised so a technician visits on day 15.
      </div>
      <div style={{ marginTop: 18 }}>
        <Card title="Auto GS — Society schedule" sub="Last & next service per society, with the ticket auto-raised for the upcoming visit.">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Society</span>
            <select value={societyFilter} onChange={e => setSocietyFilter(e.target.value)} style={selectStyle}>
              <option value="all">All societies ({rows.length})</option>
              {rows.map(r => <option key={r.society} value={r.society}>{r.society}</option>)}
            </select>
            {dueCount > 0 && <span style={{ fontSize: 12.5, color: "#986315", fontWeight: 600 }}>{dueCount} due — raise ticket</span>}
            {canEdit
              ? <button onClick={() => setAddOpen(true)} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 13, marginLeft: "auto" }}><Plus size={15} /> Add new society</button>
              : <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}><Eye size={14} /> View only</span>}
          </div>
          <Table head={["Apartments", "Address", "No of Flats", "No of Towers", "CRO Installed Date", "CRO - 250 LPH Type", "Last service Date For Backwash", "Last service Date For Dozing", "Next service", "Days left", "Ticket ID"]}>
            {shown.map((r, idx) => {
              const due = r.daysLeft <= 1;
              return (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.society}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}><GsTextCell value={r.address} editable={canEdit} onCommit={v => updateField(r.society, "address", v)} width={180} placeholder="Add address" /></td>
                  <td style={{ ...td, textAlign: "center" }}><GsTextCell value={r.totalFlats || ""} editable={canEdit} type="number" width={80} placeholder="0" onCommit={v => updateField(r.society, "totalFlats", Number(v) || 0)} /></td>
                  <td style={{ ...td, textAlign: "center" }}><GsTextCell value={r.numTowers || ""} editable={canEdit} type="number" width={80} placeholder="0" onCommit={v => updateField(r.society, "numTowers", Number(v) || 0)} /></td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>
                    {canEdit
                      ? <input type="date" value={validGsDate(r.installedDate) ? isoDay(new Date(r.installedDate)) : ""} onChange={e => updateField(r.society, "installedDate", e.target.value)} style={{ ...inp, width: 148, padding: "6px 8px", fontSize: 12.5, marginBottom: 0, cursor: "pointer" }} />
                      : (r.installedDate ? fmtDate(r.installedDate) : "—")}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>
                    {canEdit
                      ? <select value={r.croType || ""} onChange={e => updateField(r.society, "croType", e.target.value)} style={{ ...inp, width: 140, padding: "6px 8px", fontSize: 12.5, marginBottom: 0, cursor: "pointer" }}>
                          {Array.from(new Set(["Eco crystal", "Alfa Enviro", r.croType].filter(Boolean))).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      : (r.croType || "—")}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13 }}>{dateCell(r, "lastBackwash")}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13 }}>{dateCell(r, "lastDozing")}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
                    {canEdit
                      ? <input type="date" value={r.next instanceof Date && !isNaN(r.next) ? isoDay(r.next) : ""} onChange={e => updateField(r.society, "nextManual", e.target.value)} style={{ ...inp, width: 148, padding: "6px 8px", fontSize: 12.5, marginBottom: 0, cursor: "pointer" }} />
                      : fmtDate(r.next)}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{daysBadge(r.daysLeft)}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                    {r.ticketId
                      ? <Chip>#{r.ticketId}</Chip>
                      : due
                        ? <button onClick={() => createTicketFor(r.society)} disabled={busy === r.society} style={{ ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12.5, whiteSpace: "nowrap", opacity: busy === r.society ? .75 : 1 }}>
                            {busy === r.society
                              ? <><RefreshCw size={14} style={{ animation: "pw-spin 0.7s linear infinite" }} /> Creating…</>
                              : <><Ticket size={14} /> Create ticket</>}
                          </button>
                        : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      {addOpen && (
        <Modal title="Add new society" sub="Register a society for the 15-day auto GS schedule" onClose={() => setAddOpen(false)}>
          <Field label="Society Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="e.g. Prestige Lakeside" />
          </Field>
          <Field label="Address">
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inp} placeholder="e.g. Whitefield, Bengaluru" />
          </Field>
          <Field label="CRO Installed Date">
            <input type="date" value={form.installedDate} onChange={e => setForm(f => ({ ...f, installedDate: e.target.value }))} style={inp} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="No of Flats">
              <input type="number" min="0" value={form.totalFlats} onChange={e => setForm(f => ({ ...f, totalFlats: e.target.value }))} style={inp} placeholder="e.g. 108" />
            </Field>
            <Field label="No of Towers">
              <input type="number" min="0" value={form.numTowers} onChange={e => setForm(f => ({ ...f, numTowers: e.target.value }))} style={inp} placeholder="e.g. 2" />
            </Field>
          </div>
          <Field label="CRO - 250 LPH Type">
            <select value={form.croType} onChange={e => setForm(f => ({ ...f, croType: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
              <option value="Eco crystal">Eco crystal</option>
              <option value="Alfa Enviro">Alfa Enviro</option>
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Last service Date For Backwash">
              <input type="date" value={form.lastBackwash} onChange={e => setForm(f => ({ ...f, lastBackwash: e.target.value }))} style={inp} />
            </Field>
            <Field label="Last service Date For Dozing">
              <input type="date" value={form.lastDozing} onChange={e => setForm(f => ({ ...f, lastDozing: e.target.value }))} style={inp} />
            </Field>
          </div>
          <button onClick={addSociety} disabled={saving || !form.name.trim() || !form.installedDate}
            style={{ ...btnPrimary, width: "100%", marginTop: 6, opacity: (saving || !form.name.trim() || !form.installedDate) ? .6 : 1 }}>
            <Plus size={16} /> {saving ? "Saving…" : "Add society"}
          </button>
        </Modal>
      )}

      {toast && <div style={{ ...toastStyle, background: /couldn't|failed|error|returned/i.test(toast) ? "#DC4141" : toastStyle.background }}>{/couldn't|failed|error|returned/i.test(toast) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}
export const IOT_ALERTS = [
  { key: "leak", label: "Leak detected", severity: "critical" },
  { key: "offline", label: "Device offline", severity: "critical" },
  { key: "filter", label: "Filter clogged", severity: "warning" },
  { key: "flow", label: "Low water flow", severity: "warning" },
  { key: "tds", label: "High output TDS", severity: "warning" },
  { key: "ok1", label: "Healthy", severity: "ok" },
  { key: "ok2", label: "Healthy", severity: "ok" },
];
export function IoTAlerts() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | critical | warning
  const [busy, setBusy] = useState(null);
  const [tickets, setTickets] = useState({ ..._iotTickets });
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.logView(user.username, "Viewed IoT Alerts");
    customerApi.getCustomers().then(setData).catch(e => setErr(e.message || "Could not load devices."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading IoT Alerts" subtitle="Synchronizing device alert history…" />;

  const now = Date.now();
  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2400); };

  const alerts = data.filter(c => c.purifier_id).map(c => {
    const h = hashStr(c.purifier_id + "iot");
    const a = IOT_ALERTS[h % IOT_ALERTS.length];
    return { c, alert: a, since: new Date(now - (h % 72) * 3600000) };
  }).filter(x => x.alert.severity !== "ok");

  const critical = alerts.filter(a => a.alert.severity === "critical").length;
  const warning = alerts.filter(a => a.alert.severity === "warning").length;

  const stats = [
    { label: "Active alerts", value: alerts.length, icon: Cpu, sub: "across devices", hero: true },
    { label: "Critical", value: critical, icon: AlertCircle, sub: "immediate attention" },
    { label: "Warnings", value: warning, icon: Hourglass, sub: "monitor / schedule" },
    { label: "Tickets raised", value: Object.keys(tickets).length, icon: Ticket, sub: "from alerts" },
  ];

  const sevChip = (s) => {
    const map = { critical: ["#DC4141", "#FBE8E8", "Critical"], warning: ["#986315", "#FBF0E0", "Warning"] };
    const [c, bg, lbl] = map[s] || ["#7D8A83", "#ECEEED", s];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999 }}>{lbl}</span>;
  };

  const raise = async (x) => {
    const key = x.c.purifier_id;
    setBusy(key);
    try {
      const id = await ticketApi.createTicket(user.username, {
        subject: `[IoT Alert] ${x.alert.label} — ${x.c.purifier_id}`,
        email: x.c.email || user.email,
        society: x.c.society, purifierId: x.c.purifier_id, type: "Service Request", issueType: x.alert.label,
        priority: x.alert.severity === "critical" ? 4 : 3,
        description: `Automated IoT alert: ${x.alert.label} on ${x.c.purifier_id} (${x.c.name}).`,
      });
      _iotTickets[key] = id;
      setTickets(t => ({ ...t, [key]: id }));
      flash(`Ticket ${id} raised for ${x.c.name}`);
    } catch (e) {
      flash(`Couldn't create ticket: ${e.message}`);
    } finally { setBusy(null); }
  };

  const ql = q.toLowerCase();
  const shown = alerts.filter(x => (filter === "all" || x.alert.severity === filter) &&
    (!ql || `${x.c.name} ${x.c.purifier_id} ${x.c.society} ${x.alert.label}`.toLowerCase().includes(ql)));

  const chips = [["all", `All (${alerts.length})`], ["critical", `Critical (${critical})`], ["warning", `Warning (${warning})`]];


  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="IoT device alerts" sub="Device telemetry alerts — raise a ticket to dispatch a technician.">
          <Toolbar q={q} setQ={setQ} placeholder="Search device, customer, society or alert…" count={shown.length}
            right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {chips.map(([id, lbl]) => <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"), background: filter === id ? "var(--mint-2)" : "#fff", color: filter === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>)}
            </div>} />
          <Table head={["Device", "Customer", "Society", "Alert", "Severity", "Since", "Action"]} maxHeight={520}>
            {shown.map((x, idx) => {
              const key = x.c.purifier_id;
              return (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: x.alert.severity === "critical" ? "#FBE8E8" : "transparent" }}>
                  <td style={{ ...td, textAlign: "center" }}>{x.c.purifier_id ? <Chip>{x.c.purifier_id}</Chip> : "—"}</td>
                  <td style={td}><Person name={x.c.name || "—"} email={x.c.email} /></td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{x.c.society || "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{x.alert.label}</td>
                  <td style={{ ...td, textAlign: "center" }}>{sevChip(x.alert.severity)}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{fmtTime(x.since)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {tickets[key] ? <Chip>#{tickets[key]}</Chip>
                      : <button onClick={() => raise(x)} disabled={busy === key} style={{ ...btnGhost, padding: "6px 12px", opacity: busy === key ? .6 : 1 }}><Ticket size={14} /> {busy === key ? "…" : "Raise"}</button>}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={7} style={{ padding: 0 }}><Empty msg="No alerts match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>
      {toast && <div style={{ ...toastStyle, background: /couldn't|failed|error|returned/i.test(toast) ? "#DC4141" : toastStyle.background }}>{/couldn't|failed|error|returned/i.test(toast) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}
