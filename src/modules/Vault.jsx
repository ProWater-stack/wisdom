/* ============================================================================
   modules/Vault.jsx — Password Vault module (v2.29.325).
   Internal service/tool credentials (Zoho, AWS, hosting, vendor portals,
   WiFi, admin panels, etc), shared across every admin via Cloud Firestore
   (see vaultApi in shared/core.js). Strictly admin/devops-only — gated at
   three layers: hidden from Home's module grid (App.jsx `visible` filter),
   the render itself is guarded by `isModuleAdmin` in App.jsx (this component
   never mounts for anyone else), and the Firestore collection should carry
   its own security rules restricting reads/writes to admin accounts.
   Passwords are plain text at rest (masked in the UI, never logged) — this
   is convenience-level protection, not encryption; see the core.js comment
   above vaultApi for the full tradeoff.
   ============================================================================ */
import { useState, useEffect } from "react";
import {
  AlertCircle, Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, PencilLine,
  Plus, Search, Trash2,
} from "lucide-react";
import { useAuth, api, pushLog, vaultApi, fmtDate } from "../shared/core";
import {
  Loading, Empty, Modal, Field, btnGhost, btnPrimary, inp, toastStyle,
} from "../shared/ui";

const emptyEntry = { service: "", username: "", password: "", url: "", notes: "" };

export function PasswordVault() {
  const { user } = useAuth();
  const [entries, setEntries] = useState(vaultApi.local());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // the entry being edited, or null when adding
  const [form, setForm] = useState(emptyEntry);
  const [revealed, setRevealed] = useState(() => new Set());   // _docIds currently showing plaintext
  const [copied, setCopied] = useState("");                    // "docId:field" briefly flashed
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    api.logView(user.username, "Viewed Password Vault");
    vaultApi.fetch().then(r => { setEntries(r); setLoading(false); });
  }, []);

  const filtered = entries.filter(e =>
    !q.trim() || `${e.service} ${e.username} ${e.url}`.toLowerCase().includes(q.trim().toLowerCase()));

  const toggleReveal = (id) => setRevealed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const copyField = async (id, field, value) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard unavailable — silently ignore */ }
    setCopied(`${id}:${field}`);
    setTimeout(() => setCopied(c => (c === `${id}:${field}` ? "" : c)), 1500);
  };

  const openAdd = () => { setEditing(null); setForm(emptyEntry); setShowForm(true); };
  const openEdit = (e) => { setEditing(e); setForm({ service: e.service, username: e.username, password: e.password, url: e.url, notes: e.notes }); setShowForm(true); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const service = form.service.trim();
    if (!service || !form.username.trim() || !form.password) { flash("Enter a service name, username and password."); return; }
    setSaving(true);
    try {
      const body = { service, username: form.username.trim(), password: form.password, url: form.url.trim(), notes: form.notes.trim() };
      const { saved, record, message } = editing
        ? await vaultApi.update(user.username, editing._docId, body)
        : await vaultApi.add(user.username, body);
      setEntries(vaultApi.local());
      pushLog({ type: editing ? "vault_updated" : "vault_added", actor: user.username, module: "Password Vault", detail: `${editing ? "Updated" : "Added"} credential: ${service}` });
      flash(saved ? `Credential ${editing ? "updated" : "added"} · ${service}` : `Saved locally — ${message}`);
      setShowForm(false); setEditing(null); setForm(emptyEntry);
    } finally { setSaving(false); }
  };

  const remove = async (e) => {
    if (!confirm(`Delete the credential for "${e.service}"? This cannot be undone.`)) return;
    const { saved, message } = await vaultApi.remove(e._docId);
    setEntries(vaultApi.local());
    pushLog({ type: "vault_removed", actor: user.username, module: "Password Vault", detail: `Removed credential: ${e.service}` });
    flash(saved ? `Credential removed · ${e.service}` : `Removed locally — ${message}`);
  };

  if (loading) return <Loading title="Loading Password Vault" subtitle="Synchronizing internal credentials…" />;

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#986315", background: "rgba(152,99,21,0.08)", border: "1px solid rgba(152,99,21,0.18)", padding: "12px 16px", borderRadius: 14, marginBottom: 16 }}>
        <AlertCircle size={16} color="#986315" /> Admin/DevOps only. Credentials are stored as plain text (masked in this view) — treat this page itself as sensitive, and never share screenshots of it.
      </div>

      <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1D1D1F", display: "flex", alignItems: "center", gap: 8 }}><KeyRound size={17} color="#DC4141" /> Password Vault</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>Internal service & tool credentials — {entries.length} saved</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color="#86868B" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search service, username, URL…" style={{ ...inp, paddingLeft: 30, width: 240 }} />
            </div>
            <button onClick={openAdd} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "8px 16px" }}><Plus size={15} /> Add Credential</button>
          </div>
        </div>

        <div className="scroll-thin" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Service", "Username", "Password", "URL", "Notes", "Updated", ""].map(h => (
                  <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const id = e._docId;
                const shown = revealed.has(id);
                return (
                  <tr key={id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "#0d2119", whiteSpace: "nowrap" }}>{e.service}</td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {e.username || "—"}
                        {e.username && <button onClick={() => copyField(id, "user", e.username)} title="Copy username" style={{ ...btnGhost, padding: "3px 6px", border: "none", background: "transparent" }}>
                          {copied === `${id}:user` ? <Check size={12} color="#08805A" /> : <Copy size={12} />}
                        </button>}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap", fontFamily: shown ? "ui-monospace,monospace" : "inherit" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {shown ? e.password : "•".repeat(Math.min(10, Math.max(6, e.password.length)))}
                        <button onClick={() => toggleReveal(id)} title={shown ? "Hide password" : "Show password"} style={{ ...btnGhost, padding: "3px 6px", border: "none", background: "transparent" }}>
                          {shown ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button onClick={() => copyField(id, "pass", e.password)} title="Copy password" style={{ ...btnGhost, padding: "3px 6px", border: "none", background: "transparent" }}>
                          {copied === `${id}:pass` ? <Check size={12} color="#08805A" /> : <Copy size={12} />}
                        </button>
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569" }}>
                      {e.url ? <a href={e.url} target="_blank" rel="noreferrer noopener" style={{ color: "#2A86D6", display: "inline-flex", alignItems: "center", gap: 4 }}>Link <ExternalLink size={11} /></a> : "—"}
                    </td>
                    <td style={{ padding: "14px 18px", fontSize: 12, color: "#475569", maxWidth: 220, whiteSpace: "normal", textAlign: "left" }}>{e.notes || "—"}</td>
                    <td style={{ padding: "14px 18px", fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap" }}>{e.updatedAt ? fmtDate(e.updatedAt) : "—"}<div style={{ fontSize: 10.5 }}>{e.updatedBy || "—"}</div></td>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button onClick={() => openEdit(e)} title="Edit" style={{ ...btnGhost, padding: "5px 9px" }}><PencilLine size={13} /></button>
                        <button onClick={() => remove(e)} title="Delete" style={{ ...btnGhost, padding: "5px 9px", color: "#DC4141", borderColor: "rgba(220,65,65,0.25)" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 0 }}><Empty msg={entries.length ? "No credentials match your search." : "No credentials saved yet — click 'Add Credential' to log one."} /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit Credential" : "Add Credential"} sub="Password Vault" onClose={() => { setShowForm(false); setEditing(null); }}>
          <Field label="Service Name">
            <input value={form.service} onChange={e => setF("service", e.target.value)} placeholder="e.g. Zoho CRM, AWS Console" style={inp} />
          </Field>
          <Field label="Username / Email">
            <input value={form.username} onChange={e => setF("username", e.target.value)} placeholder="Login username or email" style={inp} />
          </Field>
          <Field label="Password">
            <input value={form.password} onChange={e => setF("password", e.target.value)} placeholder="Password" style={inp} />
          </Field>
          <Field label="URL (optional)">
            <input value={form.url} onChange={e => setF("url", e.target.value)} placeholder="https://…" style={inp} />
          </Field>
          <Field label="Notes (optional)">
            <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Anything else worth noting" rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <button onClick={submit} disabled={saving} style={{ ...btnPrimary, width: "100%", marginTop: 8, background: "#08805A", color: "#fff", border: "none", opacity: saving ? .7 : 1 }}>{saving ? "Saving…" : editing ? "Save changes" : "Submit"}</button>
        </Modal>
      )}

      {toast && <div style={toastStyle}><Check size={16} /> {toast}</div>}
    </div>
  );
}
