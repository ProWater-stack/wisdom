/* ============================================================================
   modules/Employee.jsx — Employee module. Extracted verbatim from App.jsx
   (v2.30 module-split). Add & manage dashboard users; per-module/per-tab
   access control grid.
   ============================================================================ */

import { useState, useEffect } from "react";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, KeyRound, Lock, Plus,
  ShieldCheck, SlidersHorizontal, Trash2,
} from "lucide-react";
import { useAuth, api, fmtDate, MODULES } from "../shared/core";
import {
  Card, Table, Loading, Field, Modal, Status, Person,
  btnPrimary, iconBtn, inp, td, toastStyle,
} from "../shared/ui";

// Immutably apply a section-access choice to a `sections` map. `level` is one of
// "default" | "hidden" | "view" | "edit"; "default" removes the override so the
// section inherits the module level. Empty module maps are pruned so a cleared
// user carries no `sections` cruft. (Employee-only — moved here from App.jsx
// in the v2.30 split; `sectionOverride`, the read-side counterpart used by
// Shell's nav rendering, stays in App.jsx.)
// The sections (tabs) that live under each module. This is the catalog the
// per-user section-access UI reads. It MUST mirror `moduleTabs` inside the
// Dashboard component (which additionally attaches icons + admin-only gating).
// `adminOnly` sections only exist when the user has admin/devops on the module.
export const MODULE_SECTIONS = {
  referral:      [{ id: "overview", label: "Overview" }, { id: "referrers", label: "Referrers" }, { id: "referees", label: "Referees" }, { id: "credits", label: "Credits" }, { id: "tracker", label: "Tracker" }, { id: "analytics", label: "Analytics" }, { id: "backtrack", label: "Backtrack", adminOnly: true }],
  sales:         [{ id: "sales_leads", label: "Leads & Deals" }, { id: "sales_apartments", label: "Apartment Leads" }, { id: "sales_trend", label: "Trend Analysis" }, { id: "sales_errors", label: "Error Correction" }],
  planner:       [{ id: "plan_board", label: "Task Board" }, { id: "plan_weekly", label: "Weekly View" }, { id: "plan_admin", label: "Modify Tasks", adminOnly: true }],
  analytics:     [{ id: "an_overview", label: "Overview" }, { id: "analytics", label: "Referral" }, { id: "an_earned", label: "Earned Revenue" }, { id: "an_reconciliation", label: "Reconciliation" }, { id: "an_dptxn", label: "DP Transaction" }, { id: "an_aop", label: "AOP", adminOnly: true }, { id: "an_apartment", label: "Apartment Performance" }, { id: "an_churn", label: "Renewal & Churn Risk" }, { id: "an_billing", label: "Billing" }, { id: "an_revenue", label: "Revenue" }, { id: "an_penetration", label: "Penetration Tracker" }, { id: "an_credits", label: "Credits" }, { id: "an_applogs", label: "App Logs" }],
  employee:      [{ id: "emp_users", label: "Users" }],
  ticketing:     [{ id: "tk_overview", label: "Overview" }, { id: "tk_tickets", label: "Tickets" }, { id: "tk_ops", label: "Ops Tickets" }],
  customer:      [{ id: "cust_list", label: "Customers" }, { id: "cust_all", label: "All Customers" }, { id: "cust_societies", label: "Societies" }],
  billing:       [{ id: "bill_overview", label: "Overview" }, { id: "bill_subs", label: "Subscriptions" }, { id: "bill_invoices", label: "Invoices" }, { id: "bill_deposits", label: "Deposits & Refunds" }, { id: "bill_plans", label: "Plans" }],
  fsm:           [{ id: "fsm_track", label: "Track Technician" }, { id: "fsm_amc", label: "AMC / Maintenance" }, { id: "fsm_quality", label: "Water Quality" }],
  erp:           [{ id: "erp_assets", label: "Asset Lifecycle" }],
  autoscheduler: [{ id: "as_society", label: "Auto GS - Society" }, { id: "as_iot", label: "IoT Alerts" }],
  iot:           [{ id: "iot_devices", label: "Device Monitor" }, { id: "iot_alerts", label: "Alerts" }],
  devicereplace: [{ id: "dr_list", label: "Replacements" }],
  about:         [{ id: "about_docs", label: "About" }, { id: "about_app_rel", label: "App Releases" }, { id: "about_tech_rel", label: "Technician Releases" }],
  logtracker:    [{ id: "log_all", label: "All Logs" }, { id: "log_failures", label: "Failures" }, { id: "log_api", label: "API Usage" }],
};

function setSectionOverride(sections, moduleId, tabId, level) {
  const modMap = { ...((sections && sections[moduleId]) || {}) };
  if (level === "default") delete modMap[tabId];
  else modMap[tabId] = level;
  const next = { ...sections };
  if (Object.keys(modMap).length) next[moduleId] = modMap;
  else delete next[moduleId];
  return next;
}

/* ===========================================================================
   User management (admin only)
   =========================================================================== */
export function UsersAdmin({ accessLevel = "view" }) {
  const { user } = useAuth();
  const canEditAccess = accessLevel === "admin" || accessLevel === "devops"; // only Admin/DevOps may change module access
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => api.getUsers().then(setRows);
  useEffect(() => { api.logView(user.username, "Viewed User Management"); refresh(); }, []);
  if (!rows) return <Loading title="Loading Employees" subtitle="Synchronizing dashboard user accounts…" />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };


  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--slate)", maxWidth: 620, textAlign: "left", margin: 0 }}>
          Create dashboard accounts and manage access. Admins manage everything; viewers get read-only access.
        </p>
        <button onClick={() => setCreating(true)} style={btnPrimary}><Plus size={17} /> New user</button>
      </div>

      <Card pad={false}>
        <Table head={["User", "Email", "Modules", "Status", "Created", ""]}>
          {rows.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}><Person name={u.name} email={"@" + u.username} /></td>
              <td style={{ ...td, fontSize: 12.5 }}>{u.email || "—"}</td>
              <td style={td}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", maxWidth: 260 }}>
                  {MODULES.filter(m => (u.access?.[m.id] || "none") !== "none").map(m => (
                    <span key={m.id} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: u.access[m.id] === "admin" ? "var(--mint-2)" : "#ECEEED", color: u.access[m.id] === "admin" ? "var(--teal)" : "var(--slate)" }}>
                      {m.label.split(" ")[0]}{u.access[m.id] === "admin" ? " ✦" : ""}
                    </span>
                  ))}
                  {(!u.access || MODULES.every(m => (u.access?.[m.id] || "none") === "none")) && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>None</span>}
                </div>
              </td>
              <td style={td}><Status s={u.active ? "active" : "disabled"} /></td>
              <td style={td}>{fmtDate(u.created)}</td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                {canEditAccess && <button onClick={() => setEditFor(u)} style={iconBtn} title="Edit module access"><ShieldCheck size={15} /></button>}
                <button onClick={() => setResetFor(u)} style={iconBtn} title="Reset password"><KeyRound size={15} /></button>
                <button onClick={async () => { await api.toggleUser(user.username, u.id); refresh(); flash("User updated"); }} style={iconBtn} title="Enable / disable">
                  {u.active ? <Lock size={15} /> : <CheckCircle2 size={15} />}
                </button>
                {u.username !== user.username && <button onClick={async () => { if (confirm(`Remove ${u.username}?`)) { await api.deleteUser(user.username, u.id); refresh(); flash("User removed"); } }} style={{ ...iconBtn, color: "#DC4141" }} title="Delete"><Trash2 size={15} /></button>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {creating && <CreateUser onClose={() => setCreating(false)} onDone={() => { refresh(); flash("User created"); }} actor={user.username} />}
      {resetFor && <ResetPw target={resetFor} onClose={() => setResetFor(null)} onDone={() => flash("Password reset")} actor={user.username} />}
      {editFor && canEditAccess && <EditAccess target={editFor} onClose={() => setEditFor(null)} onDone={() => { refresh(); flash("Access updated"); }} actor={user.username} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
export const ACCESS_LEVELS = [
  { v: "none", label: "None" },
  { v: "view", label: "View" },
  { v: "supervisor", label: "Supervisor" },
  { v: "admin", label: "Admin" },
  { v: "devops", label: "DevOps" },
];
export const SECTION_LEVELS = [
  { v: "default", label: "Default" },
  { v: "hidden", label: "Hidden" },
  { v: "view", label: "View" },
  { v: "edit", label: "Edit" },
];
export function AccessEditor({ access, setAccess, sections = {}, setSection }) {
  const [openSections, setOpenSections] = useState(null); // module id whose sections are expanded
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>Module &amp; section access</span>
      <div style={{ display: "grid", gap: 8 }}>
        {MODULES.map(m => {
          const granted = (access[m.id] || "none") !== "none";
          const isAdminLvl = ["admin", "devops"].includes(access[m.id]);
          // Sections a user with this module level would actually see. Admin-only
          // sections are shown once the module is admin/devops OR while it's still
          // ungranted (so they're discoverable up front); a non-admin grant hides them.
          const secs = (MODULE_SECTIONS[m.id] || []).filter(s => !s.adminOnly || isAdminLvl || !granted);
          // Always offer the Sections control for multi-section modules so it's
          // discoverable even before the module is granted; overrides simply stay
          // inert until the module is set above None.
          const canSection = setSection && secs.length > 1;
          const open = openSections === m.id;
          const overridden = Object.keys(sections[m.id] || {}).length; // # of sections customised
          return (
            <div key={m.id} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--f)", marginBottom: 8 }}>{m.label}{(!m.built || m.soon) && <span style={{ fontSize: 9, color: "#986315", marginLeft: 6 }}>SOON</span>}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {ACCESS_LEVELS.map(l => (
                  <button key={l.v} onClick={() => setAccess(m.id, l.v)} style={{
                    padding: "5px 11px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                    border: `1.5px solid ${(access[m.id] || "none") === l.v ? "var(--teal)" : "var(--border)"}`,
                    background: (access[m.id] || "none") === l.v ? "var(--mint-2)" : "#fff",
                    color: (access[m.id] || "none") === l.v ? "var(--teal)" : "var(--muted)",
                  }}>{l.label}</button>
                ))}
                {canSection && (
                  <button type="button" onClick={() => setOpenSections(open ? null : m.id)} style={{
                    marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px",
                    borderRadius: 8, fontSize: 11.5, fontWeight: 600, border: "1.5px solid var(--border)",
                    background: open ? "var(--mint-2)" : "#fff", color: open ? "var(--teal)" : "var(--muted)",
                  }}>
                    <SlidersHorizontal size={12} /> Sections{overridden ? ` · ${overridden}` : ""} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
              </div>
              {canSection && open && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)", display: "grid", gap: 7 }}>
                  {secs.map(s => {
                    const cur = (sections[m.id] || {})[s.id] || "default";
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--f)" }}>{s.label}{s.adminOnly && <span style={{ fontSize: 8.5, color: "#986315", marginLeft: 5, letterSpacing: ".04em" }}>ADMIN</span>}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {SECTION_LEVELS.map(l => (
                            <button key={l.v} type="button" onClick={() => setSection(m.id, s.id, l.v)} style={{
                              padding: "3px 8px", borderRadius: 7, fontSize: 10.5, fontWeight: 600,
                              border: `1.5px solid ${cur === l.v ? "var(--teal)" : "var(--border)"}`,
                              background: cur === l.v ? "var(--mint-2)" : "#fff",
                              color: cur === l.v ? "var(--teal)" : "var(--muted)",
                            }}>{l.label}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!granted && <p style={{ fontSize: 10.5, color: "#986315", margin: "2px 0 0" }}>This module is set to <strong>None</strong> — grant it (View/Supervisor/Admin/DevOps) above for these section rules to take effect.</p>}
                  <p style={{ fontSize: 10.5, color: "var(--muted)", margin: "2px 0 0" }}>Default = follow the module level above. Hidden removes the section from this user's sidebar.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Modules set above None appear on the user's home screen. View = read-only · Supervisor = edit allowed fields · Admin/DevOps = full control. Use <strong>Sections</strong> to show/hide or override View/Edit per section (default: all sections shown).</p>
    </div>
  );
}
export function CreateUser({ onClose, onDone, actor }) {
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "", role: "viewer",
    access: Object.fromEntries(MODULES.map(m => [m.id, "none"])),
    sections: {}, // per-section overrides; empty = every section shown at the module level
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAccess = (id, lvl) => setForm(f => ({ ...f, access: { ...f.access, [id]: lvl } }));
  const setSection = (mid, tid, level) => setForm(f => ({ ...f, sections: setSectionOverride(f.sections, mid, tid, level) }));

  const submit = async () => {
    if (!form.name || !form.username || form.password.length < 6) { setErr("Fill name, username and a password of at least 6 characters."); return; }
    const vals = Object.values(form.access);
    const anyAccess = vals.some(v => v !== "none");
    if (!anyAccess) { setErr("Give the user access to at least one module."); return; }
    // Overall role reflects the strongest level granted anywhere.
    const role = vals.includes("devops") ? "devops"
      : vals.includes("admin") ? "admin"
      : vals.includes("supervisor") ? "supervisor"
      : "viewer";
    setErr(""); setBusy(true);
    try {
      await api.createUser(actor, { ...form, role, username: form.username.trim().toLowerCase() });
      onDone(); onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title="Create new user">
      <Field label="Full name"><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jane Doe" /></Field>
      <Field label="User ID"><input style={inp} value={form.username} onChange={e => set("username", e.target.value)} placeholder="jane" autoCapitalize="none" autoCorrect="off" /></Field>
      <Field label="Email address"><input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@prowater.in" autoCapitalize="none" autoCorrect="off" /></Field>
      <Field label="Temporary password"><input style={inp} value={form.password} onChange={e => set("password", e.target.value)} placeholder="min 6 characters" /></Field>

      <AccessEditor access={form.access} setAccess={setAccess} sections={form.sections} setSection={setSection} />

      {err && <div style={{ color: "#DC4141", fontSize: 13, display: "flex", gap: 6, alignItems: "center", margin: "2px 0 10px" }}><AlertCircle size={15} />{err}</div>}
      <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Creating…" : "Create user"}</button>
    </Modal>
  );
}
export function EditAccess({ target, onClose, onDone, actor }) {
  const [access, setAccessState] = useState(() => Object.fromEntries(MODULES.map(m => [m.id, target.access?.[m.id] || "none"])));
  // Deep-copy the target's existing section overrides so edits stay local until saved.
  const [sections, setSectionsState] = useState(() => JSON.parse(JSON.stringify(target.sections || {})));
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const setAccess = (id, lvl) => setAccessState(a => ({ ...a, [id]: lvl }));
  const setSection = (mid, tid, level) => setSectionsState(s => setSectionOverride(s, mid, tid, level));

  const submit = async () => {
    if (!Object.values(access).some(v => v !== "none")) { setErr("Give the user access to at least one module."); return; }
    setErr(""); setBusy(true);
    try { await api.updateAccess(actor, target.id, access, sections); onDone(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title={`Edit access · ${target.name}`}>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>@{target.username} · the overall role updates to the highest level granted below.</p>
      <AccessEditor access={access} setAccess={setAccess} sections={sections} setSection={setSection} />
      {err && <div style={{ color: "#DC4141", fontSize: 13, display: "flex", gap: 6, alignItems: "center", margin: "2px 0 10px" }}><AlertCircle size={15} />{err}</div>}
      <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Saving…" : "Save access"}</button>
    </Modal>
  );
}
export function ResetPw({ target, onClose, onDone, actor }) {
  const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw.length < 6) return;
    setBusy(true); await api.resetPassword(actor, target.id, pw); onDone(); onClose();
  };
  return (
    <Modal onClose={onClose} title="Reset password" sub={"@" + target.username}>
      <Field label="New password"><input style={inp} value={pw} onChange={e => setPw(e.target.value)} placeholder="min 6 characters" /></Field>
      <button onClick={submit} disabled={busy || pw.length < 6} style={{ ...btnPrimary, width: "100%", opacity: (busy || pw.length < 6) ? .6 : 1 }}>
        {busy ? "Saving…" : "Set new password"}</button>
    </Modal>
  );
}
