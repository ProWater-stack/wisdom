/* ============================================================================
   modules/DeviceReplacement.jsx — Device Replacement module. Extracted
   verbatim from App.jsx (v2.30 module-split). Record an old→new purifier
   swap via a 3-step irreversible wizard, persisted to Firestore.
   ============================================================================ */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, ArrowLeftRight, CheckCircle2, ChevronLeft, ChevronRight, Plus,
  Repeat, X,
} from "lucide-react";
import {
  useAuth, api, authHeaders, customerApi, fmtDate, fmtTime, deviceType, LS, pushLog,
  API_ORIGIN, _drToFsFields, _drScalar,
  DR_FS_PROJECT, DR_FS_DB, DR_COLLECTION, DR_FS_BASE,
} from "../shared/core";
import {
  Card, Table, Empty, Loading, Field, Drawer, Chip,
  btnPrimary, btnGhost, iconBtn, inp, td, toastStyle, trStyle, overlay,
} from "../shared/ui";

/* ===========================================================================
   DEVICE REPLACEMENT (local-only module) — swap an old purifier for a new one
   3-step wizard: old device → new device → irreversible confirm. No API.
   =========================================================================== */
export const DEVICE_TYPES = ["Own Device", "Normal", "Hot & Cold"];
export const DR_LS_KEY = "pw_device_replacements";      // local copy so saved swaps show + survive reloads
export let _drStore = LS.get(DR_LS_KEY, []) || [];      // the display list of replacement records
export const _drSave = () => LS.set(DR_LS_KEY, _drStore);
export const drPayload = (full, actor) => ({
  actor,
  replaced_at: full.replacedAt,
  old_device: {
    name: full.old?.name || "", phone: full.old?.phone || "", email: full.old?.email || "",
    plan: full.old?.plan || "", purifier_id: full.old?.purifierId || "", device_type: full.old?.deviceType || "",
    installation_date: full.old?.installDate || "", uninstalled_date: full.old?.uninstallDate || "",
  },
  new_device: {
    name: full.neu?.name || "", phone: full.neu?.phone || "", email: full.neu?.email || "",
    plan: full.neu?.plan || "", purifier_id: full.neu?.purifierId || "", device_type: full.neu?.deviceType || "",
    installation_date: full.neu?.installDate || "",
  },
  old_device_age_days: full.ageing?.days ?? null,
  old_device_age_label: full.ageing?.label || "",
});
export function mapDrDoc(doc) {
  const f = doc.fields || {};
  const od = f.old_device?.mapValue?.fields || {};
  const nd = f.new_device?.mapValue?.fields || {};
  return {
    id: (doc.name || "").split("/").pop(),
    replacedAt: _drScalar(f.replaced_at),
    actor: _drScalar(f.actor),
    old: {
      name: _drScalar(od.name), phone: _drScalar(od.phone), email: _drScalar(od.email), plan: _drScalar(od.plan),
      purifierId: _drScalar(od.purifier_id), deviceType: _drScalar(od.device_type),
      installDate: _drScalar(od.installation_date), uninstallDate: _drScalar(od.uninstalled_date),
    },
    neu: {
      name: _drScalar(nd.name), phone: _drScalar(nd.phone), email: _drScalar(nd.email), plan: _drScalar(nd.plan),
      purifierId: _drScalar(nd.purifier_id), deviceType: _drScalar(nd.device_type),
      installDate: _drScalar(nd.installation_date),
    },
    ageing: { days: Number(_drScalar(f.old_device_age_days)) || 0, label: _drScalar(f.old_device_age_label) },
  };
}
export const deviceReplaceApi = {
  list: () => [..._drStore],
  // Read every saved replacement from Firestore (newest first). Falls back to
  // the in-memory cache if Firestore is unreachable / refused.
  fetch: async () => {
    const token = sessionStorage.getItem("pw_idToken");
    try {
      const res = await fetch(`${DR_FS_BASE}:runQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: DR_COLLECTION }],
          orderBy: [{ field: { fieldPath: "replaced_at" }, direction: "DESCENDING" }],
          limit: 500,
        } }),
      });
      if (!res.ok) throw new Error(`Firestore ${res.status}`);
      const json = await res.json();
      const rows = (json || []).filter(r => r.document).map(r => mapDrDoc(r.document));
      if (rows.length) { _drStore = rows; _drSave(); }   // backend stores swaps here → cross-device list
      return [..._drStore];
    } catch (e) {
      console.warn("device-replacement fetch failed:", e.message);
      return [..._drStore];   // fall back to the local copy
    }
  },
  // Transfer one swap to Firebase via the backend API (POST /device-replacement/add).
  // The record is cached locally first so it shows immediately and survives reloads.
  create: async (actor, rec) => {
    const full = { id: crypto.randomUUID(), replacedAt: new Date().toISOString(), ...rec };
    pushLog({ type: "device_replaced", actor, module: "Device Replacement", detail: `Replaced ${rec.old?.purifierId || "device"} → ${rec.neu?.purifierId || "new device"} for ${rec.old?.name || "customer"}` });
    _drStore = [full, ..._drStore]; _drSave();
    try {
      const res = await fetch(`${API_ORIGIN}/device-replacement/add`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(drPayload(full, actor)),
      });
      if (res.ok) return { saved: true, record: full };
      let message = `Server error ${res.status}`;
      try { const j = await res.json(); if (j?.message || j?.error) message = j.message || j.error; } catch { /* keep status */ }
      console.warn("device-replacement/add failed:", message);
      return { saved: false, record: full, message };
    } catch (e) {
      console.warn("device-replacement/add error:", e.message);
      return { saved: false, record: full, message: "couldn't reach the server" };
    }
  },
};
export function deviceAgeing(install, uninstall) {
  const a = new Date(install), b = new Date(uninstall || Date.now());
  if (isNaN(a.getTime())) return { days: 0, label: "—" };
  const days = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  const years = Math.floor(days / 365), months = Math.floor((days % 365) / 30);
  const parts = [];
  if (years) parts.push(`${years}y`);
  if (months) parts.push(`${months}mo`);
  if (!parts.length) parts.push(`${days}d`);
  return { days, label: parts.join(" ") };
}
export const _drEmptyDevice = { name: "", phone: "", email: "", plan: "", purifierId: "", deviceType: "", installDate: "" };
export function DrRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{k}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)", textAlign: "right", wordBreak: "break-word" }}>{v || "—"}</span>
    </div>
  );
}
export function DeviceReplacement() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState(deviceReplaceApi.list());
  const [loading, setLoading] = useState(true);        // first Firestore read in flight
  const [step, setStep] = useState(0);                 // 0=list, 1=old, 2=new, 3=confirm
  const [old, setOld] = useState({ ..._drEmptyDevice, uninstallDate: today });
  const [neu, setNeu] = useState({ ..._drEmptyDevice });
  const [view, setView] = useState(null);              // record shown in the read-only drawer
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const flash = m => { setToast(m); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    api.logView(user.username, "Viewed Device Replacement");
    deviceReplaceApi.fetch().then(r => { setRecords(r); setLoading(false); });
  }, []);

  const reset = () => { setOld({ ..._drEmptyDevice, uninstallDate: today }); setNeu({ ..._drEmptyDevice }); setStep(0); };
  const oldValid = old.name.trim() && old.phone.trim() && old.purifierId.trim() && old.deviceType && old.installDate;
  const newValid = neu.name.trim() && neu.phone.trim() && neu.purifierId.trim() && neu.deviceType && neu.installDate;

  const commit = async () => {
    const ageing = deviceAgeing(old.installDate, old.uninstallDate);
    setSaving(true);
    try {
      const { saved, message } = await deviceReplaceApi.create(user.username, { old, neu, ageing });
      // On success re-read Firestore (authoritative); on failure keep the cached
      // copy so the just-entered record still shows for this session.
      setRecords(saved ? await deviceReplaceApi.fetch() : deviceReplaceApi.list());
      reset();
      flash(saved ? "Replacement saved to Firebase ✓" : `Saved locally — ${message}`);
    } finally { setSaving(false); }
  };

  const deviceField = (obj, setObj, key, label, opts = {}) => (
    <Field label={label}>
      {opts.type === "select"
        ? <select value={obj[key]} onChange={e => setObj(o => ({ ...o, [key]: e.target.value }))} style={{ ...inp, cursor: "pointer", color: obj[key] ? "var(--f)" : "var(--muted)" }}>
            <option value="" disabled>Select…</option>
            {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        : <input type={opts.type || "text"} value={obj[key]} readOnly={opts.readOnly}
            onChange={e => setObj(o => ({ ...o, [key]: e.target.value }))}
            style={{ ...inp, ...(opts.readOnly ? { background: "var(--mint)", color: "var(--muted)" } : {}) }} placeholder={opts.placeholder || ""} />}
    </Field>
  );

  const deviceForm = (obj, setObj, withUninstall) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
      <div style={{ gridColumn: "1 / -1" }}>{deviceField(obj, setObj, "name", "Name", { placeholder: "Customer name" })}</div>
      {deviceField(obj, setObj, "phone", "Phone", { type: "tel", placeholder: "10-digit" })}
      {deviceField(obj, setObj, "email", "Email ID", { type: "email", placeholder: "name@email.com" })}
      <div style={{ gridColumn: "1 / -1" }}>{deviceField(obj, setObj, "plan", "Plan", { placeholder: "e.g. Plus Annual" })}</div>
      {deviceField(obj, setObj, "purifierId", "Purifier ID", { placeholder: "e.g. PW-44120" })}
      {deviceField(obj, setObj, "deviceType", "Device Type", { type: "select" })}
      {deviceField(obj, setObj, "installDate", "Installation Date", { type: "date" })}
      {withUninstall && deviceField(obj, setObj, "uninstallDate", "Uninstalled Date (auto — today)", { type: "date", readOnly: true })}
    </div>
  );

  const swaps = records.length;


  return (
    <div className="fade-up">
      {/* Hero header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap", background: "linear-gradient(135deg,var(--forest) 0%, var(--teal-d) 100%)", color: "#E2F3EE", borderRadius: "var(--radius)", padding: "18px 22px", boxShadow: "var(--shadow)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.35),transparent 70%)" }} />
        <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flexShrink: 0 }}><Repeat size={24} color="#fff" /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Device Replacement</div>
          <div style={{ fontSize: 12.5, color: "#B5E2D4" }}>Swap an old purifier for a new one · {swaps} recorded · records are final</div>
        </div>
        <button onClick={() => setStep(1)} style={{ ...btnPrimary, padding: "10px 18px", marginLeft: "auto", background: "#fff", color: "var(--forest)", boxShadow: "0 8px 18px -8px rgba(0,0,0,.35)" }}><Plus size={16} /> New Entry</button>
      </div>

      <Card pad={false}>
        <Table head={["Replaced on", "Customer", "Old Purifier ID", "New Purifier ID", "Old device age", "New Device Type"]} maxHeight="calc(100vh - 300px)">
          {records.map(r => (
            <tr key={r.id} style={{ ...trStyle }} onClick={() => setView(r)}>
              <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5, color: "var(--muted)" }}>{fmtTime(r.replacedAt)}</td>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.old?.name || "—"}</td>
              <td style={td}><Chip>{r.old?.purifierId || "—"}</Chip></td>
              <td style={td}><Chip>{r.neu?.purifierId || "—"}</Chip></td>
              <td style={{ ...td, fontWeight: 600 }}>{r.ageing?.label || "—"}</td>
              <td style={td}>{r.neu?.deviceType || "—"}</td>
            </tr>
          ))}
        </Table>
        {records.length === 0 && (loading ? <Loading /> : <Empty msg="No replacements recorded yet. Click “New Entry” to start." />)}
      </Card>

      {/* Wizard popup — 2 short steps */}
      {(step === 1 || step === 2) && createPortal(
        <div onClick={reset} style={{ ...overlay, alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} className="pw-pop scroll-thin" style={{ width: "min(600px,100%)", background: "#fff", borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ padding: "22px 24px 0", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p className="eyebrow">Step {step} of 2 · {step === 1 ? "Device being replaced" : "Replacement device"}</p>
                  <h2 style={{ fontSize: 22, marginTop: 2 }}>{step === 1 ? "Old device details" : "New device details"}</h2>
                </div>
                <button onClick={reset} style={iconBtn}><X size={18} /></button>
              </div>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              {step === 1 ? <>
                {deviceForm(old, setOld, true)}
                {old.installDate && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>Old-device ageing: <strong style={{ color: "var(--f)" }}>{deviceAgeing(old.installDate, old.uninstallDate).label}</strong></div>}
                <button onClick={() => setStep(2)} disabled={!oldValid} style={{ ...btnPrimary, width: "100%", marginTop: 18, opacity: oldValid ? 1 : .6 }}>Submit <ChevronRight size={16} /></button>
              </> : <>
                {deviceForm(neu, setNeu, false)}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button onClick={() => setStep(1)} style={btnGhost}><ChevronLeft size={16} /> Go back</button>
                  <button onClick={() => setStep(3)} disabled={!newValid} style={{ ...btnPrimary, flex: 1, opacity: newValid ? 1 : .6 }}>Submit <ChevronRight size={16} /></button>
                </div>
              </>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Compact irreversible-confirm popup */}
      {step === 3 && createPortal(
        <div onClick={() => !saving && setStep(2)} style={{ ...overlay, alignItems: "center", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1100 }}>
          <div onClick={e => e.stopPropagation()} className="pw-pop" style={{ width: "min(420px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 24, boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "#FBE8E8", color: "#DC4141", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><AlertCircle size={26} /></div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Confirm replacement</h2>
            <p style={{ fontSize: 13, color: "var(--slate)", marginBottom: 14 }}>This is final — the record can't be edited or undone once saved.</p>
            <div style={{ background: "var(--mint)", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                <Chip>{old.purifierId || "—"}</Chip>
                <ArrowLeftRight size={15} color="var(--muted)" />
                <Chip>{neu.purifierId || "—"}</Chip>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>{old.name || "—"} · old-device age {deviceAgeing(old.installDate, old.uninstallDate).label}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} disabled={saving} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}><ChevronLeft size={16} /> Go back</button>
              <button onClick={commit} disabled={saving} style={{ ...btnPrimary, flex: 1, background: "#DC4141", boxShadow: "0 8px 18px -8px rgba(180,35,42,.6)", opacity: saving ? .7 : 1 }}><CheckCircle2 size={16} /> {saving ? "Saving…" : "Confirm & save"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {view && <Drawer title={view.old?.name || "Replacement"} sub="Replacement record (read-only)" onClose={() => setView(null)}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>Recorded {fmtTime(view.replacedAt)}</div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Old device</div>
        <DrRow k="Customer" v={view.old?.name} /><DrRow k="Phone" v={view.old?.phone} /><DrRow k="Email" v={view.old?.email} />
        <DrRow k="Plan" v={view.old?.plan} /><DrRow k="Purifier ID" v={view.old?.purifierId} /><DrRow k="Device Type" v={view.old?.deviceType} />
        <DrRow k="Installed" v={view.old?.installDate ? fmtDate(view.old.installDate) : "—"} /><DrRow k="Uninstalled" v={view.old?.uninstallDate ? fmtDate(view.old.uninstallDate) : "—"} />
        <DrRow k="Age at removal" v={view.ageing?.label} />
        <div className="eyebrow" style={{ margin: "16px 0 6px" }}>New device</div>
        <DrRow k="Customer" v={view.neu?.name} /><DrRow k="Phone" v={view.neu?.phone} /><DrRow k="Email" v={view.neu?.email} />
        <DrRow k="Plan" v={view.neu?.plan} /><DrRow k="Purifier ID" v={view.neu?.purifierId} /><DrRow k="Device Type" v={view.neu?.deviceType} />
        <DrRow k="Installed" v={view.neu?.installDate ? fmtDate(view.neu.installDate) : "—"} />
      </Drawer>}

      {toast && <div style={{ ...toastStyle, background: /couldn't|local/i.test(toast) ? "#986315" : toastStyle.background }}>{/couldn't|local/i.test(toast) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}
