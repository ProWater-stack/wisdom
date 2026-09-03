/* ============================================================================
   modules/Vault.jsx — Password Vault module (v2.29.331).
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
import { useState, useEffect, useMemo } from "react";
import {
  AlertCircle, AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff,
  Folder, Globe, KeyRound, Lock, PencilLine, Plus, RefreshCw, Search, Shield,
  ShieldCheck, Sparkles, Tag, Trash2, User, X,
} from "lucide-react";
import { useAuth, api, pushLog, vaultApi, vaultPinApi, verifyPassword, fmtDate } from "../shared/core";
import {
  Loading, Empty, Modal, Field, btnGhost, btnPrimary, inp, toastStyle,
} from "../shared/ui";

export const VAULT_CATEGORIES = [
  "All",
  "DevOps & Cloud",
  "Payment & Billing",
  "Internal Tools",
  "Email & Comm",
  "Vendors & Social",
  "General",
];

export const CATEGORY_COLORS = {
  "DevOps & Cloud": { bg: "rgba(59,130,246,0.09)", text: "#2563EB", border: "rgba(59,130,246,0.22)" },
  "Payment & Billing": { bg: "rgba(16,185,129,0.09)", text: "#059669", border: "rgba(16,185,129,0.22)" },
  "Internal Tools": { bg: "rgba(139,92,246,0.09)", text: "#7C3AED", border: "rgba(139,92,246,0.22)" },
  "Email & Comm": { bg: "rgba(245,158,11,0.09)", text: "#D97706", border: "rgba(245,158,11,0.22)" },
  "Vendors & Social": { bg: "rgba(236,72,153,0.09)", text: "#DB2777", border: "rgba(236,72,153,0.22)" },
  "General": { bg: "rgba(100,116,139,0.09)", text: "#475569", border: "rgba(100,116,139,0.22)" },
};

// Generate deterministic avatar gradient and initials from service name
export function getServiceAvatar(name = "") {
  const clean = (name || "SV").trim().toUpperCase();
  const initials = clean.slice(0, 2);
  const palettes = [
    ["#3B82F6", "#1D4ED8"], // Blue
    ["#08805A", "#059669"], // Emerald
    ["#8B5CF6", "#6D28D9"], // Purple
    ["#F59E0B", "#D97706"], // Amber
    ["#EC4899", "#BE185D"], // Pink
    ["#06B6D4", "#0E7490"], // Cyan
    ["#F97316", "#C2410C"], // Orange
  ];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  const [c1, c2] = palettes[Math.abs(hash) % palettes.length];
  return { initials, bg: `linear-gradient(135deg, ${c1}, ${c2})` };
}

// Generate random cryptographically strong 16-char password
export function generateStrongPassword(len = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()_+-=[]{};:?";
  const all = upper + lower + numbers + symbols;
  let pass = "";
  pass += upper[Math.floor(Math.random() * upper.length)];
  pass += lower[Math.floor(Math.random() * lower.length)];
  pass += numbers[Math.floor(Math.random() * numbers.length)];
  pass += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = pass.length; i < len; i++) {
    pass += all[Math.floor(Math.random() * all.length)];
  }
  return pass.split("").sort(() => 0.5 - Math.random()).join("");
}

// Evaluate password strength
export function checkPasswordStrength(pass = "") {
  if (!pass) return { score: 0, label: "Empty", color: "#94A3B8" };
  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;

  const meta = [
    { label: "Very Weak", color: "#EF4444" },
    { label: "Weak", color: "#F87171" },
    { label: "Fair", color: "#F59E0B" },
    { label: "Strong", color: "#10B981" },
    { label: "Very Strong", color: "#059669" },
  ];
  return { score, ...meta[score] };
}

const emptyEntry = { service: "", username: "", password: "", url: "", notes: "", category: "General" };

/* ===========================================================================
   Vault PIN gate (v2.29.329/v2.29.331) — Interactive 4-digit PIN security lock
   =========================================================================== */
function VaultPinGate({ username, onUnlocked }) {
  const [mode, setMode] = useState(() => (vaultPinApi.hasPin(username) ? "enter" : "create"));
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, forceTick] = useState(0);
  const digits = (v) => v.replace(/\D/g, "").slice(0, 4);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => forceTick(x => x + 1), 500);
    return () => clearInterval(t);
  }, [lockedUntil]);
  const cooldownLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));

  const submitCreate = async () => {
    setErr("");
    if (!/^\d{4}$/.test(pin)) { setErr("Enter exactly 4 digits."); return; }
    if (pin !== confirmPin) { setErr("PINs don't match."); return; }
    setBusy(true);
    try { await vaultPinApi.setPin(username, pin); vaultPinApi.unlock(); onUnlocked(); }
    finally { setBusy(false); }
  };

  const submitEnter = async () => {
    if (cooldownLeft > 0) return;
    setErr("");
    if (!/^\d{4}$/.test(pin)) { setErr("Enter exactly 4 digits."); return; }
    setBusy(true);
    try {
      const ok = await vaultPinApi.checkPin(username, pin);
      if (ok) { vaultPinApi.unlock(); onUnlocked(); return; }
      const next = attempts + 1;
      setAttempts(next);
      setPin("");
      if (next >= 5) { setLockedUntil(Date.now() + 15000); setErr("Too many wrong attempts — wait 15 seconds."); }
      else setErr("Incorrect PIN. Please try again.");
    } finally { setBusy(false); }
  };

  const submitForgot = async () => {
    setErr("");
    if (!password) { setErr("Enter your account password."); return; }
    setBusy(true);
    try {
      const { ok, message } = await verifyPassword(username, password);
      if (!ok) { setErr(message); return; }
      vaultPinApi.clearPin(username);
      setMode("create"); setPin(""); setConfirmPin(""); setPassword(""); setAttempts(0); setLockedUntil(0);
    } finally { setBusy(false); }
  };

  const card = {
    width: 350,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(0,0,0,.08)",
    borderRadius: 24,
    boxShadow: "0 16px 40px rgba(0,0,0,.08)",
    padding: "32px 28px",
    textAlign: "center"
  };
  const linkBtn = { ...btnGhost, width: "100%", marginTop: 10, border: "none", background: "transparent", color: "#86868B", fontSize: 12.5 };

  // Render 4 interactive visual PIN boxes
  const renderPinBoxes = (currentVal) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, margin: "14px 0" }}>
      {[0, 1, 2, 3].map((idx) => {
        const isFilled = currentVal.length > idx;
        const isCurrent = currentVal.length === idx;
        return (
          <div
            key={idx}
            style={{
              width: 44,
              height: 48,
              borderRadius: 12,
              border: `2px solid ${isCurrent ? "#08805A" : isFilled ? "rgba(8,128,90,0.4)" : "rgba(0,0,0,0.12)"}`,
              background: isFilled ? "rgba(8,128,90,0.06)" : "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              fontWeight: 800,
              color: "#08805A",
              boxShadow: isCurrent ? "0 0 0 3px rgba(8,128,90,0.15)" : "none",
              transition: "all .15s ease"
            }}
          >
            {isFilled ? "•" : ""}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fade-up ov-sans" style={{ display: "grid", placeItems: "center", minHeight: 400, padding: 20 }}>
      <div style={card}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(8,128,90,0.1)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <Lock size={24} color="#08805A" />
        </div>

        {mode === "create" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1D1D1F" }}>Create Vault PIN</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 4, marginBottom: 14 }}>
              Set a 4-digit device PIN to secure your internal credentials on this browser.
            </div>
            
            <div style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em" }}>New PIN</div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={e => setPin(digits(e.target.value))}
              placeholder="••••"
              style={{ ...inp, textAlign: "center", letterSpacing: 8, fontSize: 20, marginBottom: 12 }}
            />
            {renderPinBoxes(pin)}

            <div style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em" }}>Confirm PIN</div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={e => setConfirmPin(digits(e.target.value))}
              onKeyDown={e => e.key === "Enter" && submitCreate()}
              placeholder="••••"
              style={{ ...inp, textAlign: "center", letterSpacing: 8, fontSize: 20 }}
            />
            {renderPinBoxes(confirmPin)}

            {err && <div style={{ color: "#DC4141", fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>{err}</div>}
            
            {pin.length === 4 && confirmPin.length === 4 && (
              <button onClick={submitCreate} disabled={busy} style={{ ...btnPrimary, width: "100%", marginTop: 14, background: "#08805A", color: "#fff", border: "none", opacity: busy ? .7 : 1 }}>
                {busy ? "Saving…" : "Set Vault PIN"}
              </button>
            )}
          </>
        )}

        {mode === "enter" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1D1D1F" }}>Enter Vault PIN</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 4, marginBottom: 16 }}>
              This section is locked on this device. Enter your 4-digit PIN to unlock.
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={e => setPin(digits(e.target.value))}
              onKeyDown={e => e.key === "Enter" && submitEnter()}
              disabled={cooldownLeft > 0}
              placeholder="••••"
              style={{ ...inp, textAlign: "center", letterSpacing: 10, fontSize: 22, opacity: cooldownLeft > 0 ? 0.5 : 1 }}
            />

            {renderPinBoxes(pin)}

            {err && (
              <div style={{ color: "#DC4141", fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>
                {err}{cooldownLeft > 0 ? ` (${cooldownLeft}s cooldown)` : ""}
              </div>
            )}

            {pin.length === 4 && (
              <button
                onClick={submitEnter}
                disabled={busy || cooldownLeft > 0}
                style={{ ...btnPrimary, width: "100%", marginTop: 14, background: "#08805A", color: "#fff", border: "none", opacity: (busy || cooldownLeft > 0) ? .7 : 1 }}
              >
                {busy ? "Checking…" : "Unlock Vault"}
              </button>
            )}

            <button onClick={() => { setMode("forgot"); setErr(""); setPassword(""); }} style={linkBtn}>
              Forgot PIN?
            </button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1D1D1F" }}>Reset Vault PIN</div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 4, marginBottom: 16 }}>
              Confirm your identity by entering your CRM account password to reset this device's PIN.
            </div>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitForgot()}
              placeholder="Enter your account password"
              style={{ ...inp, textAlign: "center" }}
            />
            {err && <div style={{ color: "#DC4141", fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>{err}</div>}
            <button onClick={submitForgot} disabled={busy} style={{ ...btnPrimary, width: "100%", marginTop: 16, background: "#08805A", color: "#fff", border: "none", opacity: busy ? .7 : 1 }}>
              {busy ? "Verifying…" : "Verify & Reset PIN"}
            </button>
            <button onClick={() => { setMode("enter"); setErr(""); setPassword(""); }} style={linkBtn}>
              Back to PIN entry
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ===========================================================================
   PasswordVault Main Component
   =========================================================================== */
export function PasswordVault() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(() => vaultPinApi.isUnlocked());
  const [entries, setEntries] = useState(vaultApi.local());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // entry or null
  const [form, setForm] = useState(emptyEntry);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // entry to delete
  const [revealed, setRevealed] = useState(() => new Set());   // _docIds currently showing plaintext
  const [copied, setCopied] = useState("");                    // "docId:field"
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    api.logView(user.username, "Viewed Password Vault");
    vaultApi.fetch().then(r => { setEntries(r); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const matchQ = !q.trim() || `${e.service} ${e.username} ${e.url} ${e.category || ""} ${e.notes || ""}`.toLowerCase().includes(q.trim().toLowerCase());
      const matchCat = activeCategory === "All" || (e.category || "General") === activeCategory;
      return matchQ && matchCat;
    });
  }, [entries, q, activeCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { All: entries.length };
    VAULT_CATEGORIES.forEach(c => { if (c !== "All") counts[c] = 0; });
    entries.forEach(e => {
      const cat = e.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [entries]);

  const toggleReveal = (id) => setRevealed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copyField = async (id, field, value) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
    setCopied(`${id}:${field}`);
    flash(`Copied ${field === "user" ? "username" : "password"} to clipboard`);
    setTimeout(() => setCopied(c => (c === `${id}:${field}` ? "" : c)), 1500);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyEntry);
    setShowFormPassword(false);
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({
      service: e.service,
      username: e.username,
      password: e.password,
      url: e.url || "",
      notes: e.notes || "",
      category: e.category || "General"
    });
    setShowFormPassword(false);
    setShowForm(true);
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGeneratePassword = () => {
    const generated = generateStrongPassword(16);
    setF("password", generated);
    setShowFormPassword(true);
    flash("Generated secure 16-character password");
  };

  const submit = async () => {
    const service = form.service.trim();
    if (!service || !form.username.trim() || !form.password) {
      flash("Please provide service name, username, and password.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        service,
        username: form.username.trim(),
        password: form.password,
        url: form.url.trim(),
        notes: form.notes.trim(),
        category: form.category || "General"
      };
      const { saved, message } = editing
        ? await vaultApi.update(user.username, editing._docId, body)
        : await vaultApi.add(user.username, body);
      setEntries(vaultApi.local());
      pushLog({
        type: editing ? "vault_updated" : "vault_added",
        actor: user.username,
        module: "Password Vault",
        detail: `${editing ? "Updated" : "Added"} credential: ${service}`
      });
      flash(saved ? `Credential ${editing ? "updated" : "saved"} · ${service}` : `Saved locally — ${message}`);
      setShowForm(false);
      setEditing(null);
      setForm(emptyEntry);
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { saved, message } = await vaultApi.remove(deleteTarget._docId);
      setEntries(vaultApi.local());
      pushLog({
        type: "vault_removed",
        actor: user.username,
        module: "Password Vault",
        detail: `Removed credential: ${deleteTarget.service}`
      });
      flash(saved ? `Credential deleted · ${deleteTarget.service}` : `Removed locally — ${message}`);
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  if (!unlocked) return <VaultPinGate username={user.username} onUnlocked={() => setUnlocked(true)} />;
  if (loading) return <Loading title="Loading Password Vault" subtitle="Synchronizing internal credentials…" />;

  const formStrength = checkPasswordStrength(form.password);

  return (
    <div className="fade-up ov-sans">
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,SF Pro Display,system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      {/* Security notice */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13, color: "#986315", background: "rgba(152,99,21,0.08)", border: "1px solid rgba(152,99,21,0.18)", padding: "12px 18px", borderRadius: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={16} color="#986315" />
          <span><strong>Admin/DevOps Only</strong> — Shared credentials are masked in this view. Keep this section confidential and never share raw screenshots.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#08805A", background: "rgba(8,128,90,0.1)", padding: "3px 10px", borderRadius: 999 }}>
          <ShieldCheck size={14} color="#08805A" /> Device PIN Active
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.03)", padding: 22 }}>
        
        {/* Header Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#1D1D1F", display: "flex", alignItems: "center", gap: 8 }}>
              <KeyRound size={20} color="#08805A" /> Password Vault
            </div>
            <div style={{ fontSize: 12.5, color: "#86868B", marginTop: 2 }}>
              Secure internal credentials repository · {entries.length} credential{entries.length !== 1 ? "s" : ""} recorded
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color="#86868B" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search service, username, URL, tags…"
                style={{ ...inp, paddingLeft: 32, width: 250, borderRadius: 12 }}
              />
              {q && (
                <button onClick={() => setQ("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#86868B" }}>
                  <X size={13} />
                </button>
              )}
            </div>
            <button onClick={openAdd} style={{ ...btnPrimary, background: "#08805A", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 12, fontWeight: 700 }}>
              <Plus size={16} /> Add Credential
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", paddingBottom: 12, marginBottom: 10 }}>
          {VAULT_CATEGORIES.map(cat => {
            const isSelected = activeCategory === cat;
            const count = categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  border: isSelected ? "1px solid #08805A" : "1px solid rgba(0,0,0,0.08)",
                  background: isSelected ? "#08805A" : "#fff",
                  color: isSelected ? "#fff" : "#475569",
                  padding: "5px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all .15s ease"
                }}
              >
                <span>{cat}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isSelected ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                  color: isSelected ? "#fff" : "#86868B"
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Credentials Table */}
        <div className="scroll-thin" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: 13.5, minWidth: 1180 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,.06)", background: "rgba(243,248,236,.92)" }}>
                {["Service", "Category", "Username / Email", "Password", "URL", "Notes", "Created", "Created By", "Updated", "Updated By", ""].map(h => (
                  <th key={h} style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a805a", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const id = e._docId;
                const shown = revealed.has(id);
                const avatar = getServiceAvatar(e.service);
                const cat = e.category || "General";
                const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.General;

                return (
                  <tr key={id} style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}>
                    
                    {/* Service Name & Avatar */}
                    <td style={{ padding: "12px 18px", textAlign: "left", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 9,
                          background: avatar.bg,
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 11,
                          display: "grid",
                          placeItems: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                          flexShrink: 0
                        }}>
                          {avatar.initials}
                        </div>
                        <span style={{ fontWeight: 700, color: "#1D1D1F", fontSize: 14 }}>{e.service}</span>
                      </div>
                    </td>

                    {/* Category Chip */}
                    <td style={{ padding: "12px 18px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: catStyle.bg,
                        color: catStyle.text,
                        border: `1px solid ${catStyle.border}`
                      }}>
                        {cat}
                      </span>
                    </td>

                    {/* Username / Email */}
                    <td style={{ padding: "12px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>{e.username || "—"}</span>
                        {e.username && (
                          <button
                            onClick={() => copyField(id, "user", e.username)}
                            title="Copy username"
                            style={{ ...btnGhost, padding: "4px 6px", border: "none", background: copied === `${id}:user` ? "rgba(8,128,90,0.1)" : "transparent", borderRadius: 6 }}
                          >
                            {copied === `${id}:user` ? <Check size={13} color="#08805A" /> : <Copy size={13} color="#86868B" />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Password */}
                    <td style={{ padding: "12px 18px", fontSize: 12.5, color: "#475569", whiteSpace: "nowrap", fontFamily: shown ? "ui-monospace,monospace" : "inherit" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.03)", padding: "3px 8px", borderRadius: 8 }}>
                        <span style={{ fontWeight: shown ? 700 : 400, color: shown ? "#1D1D1F" : "#86868B" }}>
                          {shown ? e.password : "••••••••"}
                        </span>
                        <button
                          onClick={() => toggleReveal(id)}
                          title={shown ? "Hide password" : "Show password"}
                          style={{ ...btnGhost, padding: "3px 5px", border: "none", background: "transparent" }}
                        >
                          {shown ? <EyeOff size={13} color="#08805A" /> : <Eye size={13} color="#86868B" />}
                        </button>
                        <button
                          onClick={() => copyField(id, "pass", e.password)}
                          title="Copy password"
                          style={{ ...btnGhost, padding: "3px 5px", border: "none", background: copied === `${id}:pass` ? "rgba(8,128,90,0.1)" : "transparent", borderRadius: 6 }}
                        >
                          {copied === `${id}:pass` ? <Check size={13} color="#08805A" /> : <Copy size={13} color="#86868B" />}
                        </button>
                      </div>
                    </td>

                    {/* URL Link */}
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "#475569" }}>
                      {e.url ? (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{
                            color: "#08805A",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 700,
                            textDecoration: "none",
                            background: "rgba(8,128,90,0.06)",
                            padding: "4px 8px",
                            borderRadius: 6
                          }}
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span style={{ color: "#CBD5E1" }}>—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "#475569", maxWidth: 220, whiteSpace: "normal", textAlign: "left" }}>
                      {e.notes || <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>

                    {/* Timestamps */}
                    <td style={{ padding: "12px 18px", fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap" }}>{e.createdAt ? fmtDate(e.createdAt) : "—"}</td>
                    <td style={{ padding: "12px 18px", fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap" }}>{e.createdBy || "—"}</td>
                    <td style={{ padding: "12px 18px", fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap" }}>{e.updatedAt ? fmtDate(e.updatedAt) : "—"}</td>
                    <td style={{ padding: "12px 18px", fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap" }}>{e.updatedBy || "—"}</td>

                    {/* Row Actions */}
                    <td style={{ padding: "12px 18px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => openEdit(e)}
                          title="Edit"
                          style={{ ...btnGhost, padding: "5px 9px", borderRadius: 8 }}
                        >
                          <PencilLine size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(e)}
                          title="Delete"
                          style={{ ...btnGhost, padding: "5px 9px", color: "#DC4141", borderColor: "rgba(220,65,65,0.2)", borderRadius: 8 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 0 }}>
                    <Empty msg={entries.length ? "No credentials match your filters." : "No credentials saved yet — click 'Add Credential' to record your first login."} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Add / Edit Credential Modal */}
      {showForm && (
        <Modal
          title={editing ? "Edit Credential" : "Add Credential"}
          sub="Password Vault · Shared Admin Repository"
          onClose={() => { setShowForm(false); setEditing(null); }}
        >
          <div style={{ display: "grid", gap: 14, paddingTop: 4 }}>
            
            {/* Service & Category Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <Field label="Service / Portal Name">
                <div style={{ position: "relative" }}>
                  <Globe size={14} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={form.service}
                    onChange={e => setF("service", e.target.value)}
                    placeholder="e.g. AWS Console, Zoho CRM"
                    style={{ ...inp, paddingLeft: 34, borderRadius: 12 }}
                  />
                </div>
              </Field>
              <Field label="Category">
                <select
                  value={form.category || "General"}
                  onChange={e => setF("category", e.target.value)}
                  style={{ ...inp, borderRadius: 12, cursor: "pointer", background: "#fff" }}
                >
                  {VAULT_CATEGORIES.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Username Field */}
            <Field label="Username / Email">
              <div style={{ position: "relative" }}>
                <User size={14} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={form.username}
                  onChange={e => setF("username", e.target.value)}
                  placeholder="admin@prowater.in or username"
                  style={{ ...inp, paddingLeft: 34, borderRadius: 12 }}
                />
              </div>
            </Field>

            {/* Password Field with Integrated Generator & Strength Meter */}
            <Field label="Password">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Lock size={14} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={form.password}
                    onChange={e => setF("password", e.target.value)}
                    placeholder="Enter password"
                    style={{ ...inp, paddingLeft: 34, paddingRight: 40, borderRadius: 12, fontFamily: showFormPassword ? "ui-monospace, monospace" : "inherit" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    title={showFormPassword ? "Hide password" : "Show password"}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "#86868B" }}
                  >
                    {showFormPassword ? <EyeOff size={15} color="#08805A" /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  title="Generate a secure 16-character password"
                  style={{
                    ...btnGhost,
                    borderRadius: 12,
                    padding: "9px 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#08805A",
                    borderColor: "rgba(8,128,90,0.3)",
                    background: "rgba(8,128,90,0.06)",
                    whiteSpace: "nowrap"
                  }}
                >
                  <Sparkles size={14} /> Generate
                </button>
              </div>

              {/* Password Strength Meter */}
              {form.password && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(0,0,0,0.03)", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#86868B" }}>Strength:</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: formStrength.color }}>{formStrength.label}</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: "#86868B" }}>{form.password.length} characters</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, height: 4 }}>
                    {[1, 2, 3, 4].map(idx => (
                      <div
                        key={idx}
                        style={{
                          borderRadius: 999,
                          background: formStrength.score >= idx ? formStrength.color : "rgba(0,0,0,0.1)",
                          transition: "background .2s ease"
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Field>

            {/* URL Field */}
            <Field label="URL / Login Link (optional)">
              <div style={{ position: "relative" }}>
                <ExternalLink size={14} color="#86868B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={form.url}
                  onChange={e => setF("url", e.target.value)}
                  placeholder="https://console.aws.amazon.com"
                  style={{ ...inp, paddingLeft: 34, borderRadius: 12 }}
                />
              </div>
            </Field>

            {/* Notes Field */}
            <Field label="Notes / 2FA / Instructions (optional)">
              <textarea
                value={form.notes}
                onChange={e => setF("notes", e.target.value)}
                placeholder="Recovery codes, specific organization IDs, PINs, or secondary owner info"
                rows={3}
                style={{ ...inp, resize: "vertical", fontFamily: "inherit", borderRadius: 12 }}
              />
            </Field>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                style={{ ...btnGhost, padding: "9px 18px", borderRadius: 12, fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                style={{ ...btnPrimary, padding: "9px 24px", background: "#08805A", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, opacity: saving ? .7 : 1 }}
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Save Credential"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          title="Delete Credential"
          sub="Password Vault Confirmation"
          onClose={() => setDeleteTarget(null)}
        >
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ width: 50, height: 50, borderRadius: 16, background: "rgba(220,65,65,0.1)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <AlertTriangle size={24} color="#DC4141" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1D1D1F", marginBottom: 6 }}>
              Delete "{deleteTarget.service}"?
            </div>
            <div style={{ fontSize: 13, color: "#64748B", maxWidth: 360, margin: "0 auto 20px", lineHeight: 1.4 }}>
              Are you sure you want to remove this credential from the shared vault? This action cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ ...btnGhost, padding: "9px 18px", borderRadius: 12, fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{ ...btnPrimary, padding: "9px 22px", background: "#DC4141", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, opacity: deleting ? .7 : 1 }}
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div style={toastStyle}><Check size={16} /> {toast}</div>}
    </div>
  );
}

