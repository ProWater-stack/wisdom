/* ============================================================================
   shared/ui.jsx — generic JSX UI primitives used across every module: Table,
   Card, Modal, Stat, Toolbar, Drawer, Field, Chip, Status, Person, date-range
   pickers, Login/ForgotPassword, chart-label helpers, and the shared inline
   style-object constants. Extracted verbatim from App.jsx (v2.30 split).
   ============================================================================ */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, ArrowUpDown, ArrowUpRight, Camera, CheckCircle2, Eye, EyeOff,
  Filter, Image as ImageIcon, Lock, Search, X,
  Briefcase, Receipt, Boxes, Wrench, GitBranch, BarChart3, UserCog,
  ScrollText, Ticket, UserRound, Cpu, Landmark, CalendarClock, Repeat, Info,
  LayoutGrid,
} from "lucide-react";
import {
  APP_VERSION, DATE_PRESETS, DEVICE_TYPE_STYLE, api, deviceType,
  pluralise, useAuth,
} from "./core";

export const PIE_LABEL_OFFSET = 14;
export const renderPieLabel = ({ cx, cy, midAngle, outerRadius, value, percent }) => {
  if (!value) return null;
  const rad = Math.PI / 180;
  const r = outerRadius + PIE_LABEL_OFFSET;
  const x = cx + r * Math.cos(-midAngle * rad);
  const y = cy + r * Math.sin(-midAngle * rad);
  return (
    <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, fill: "var(--f)" }}>
      {value.toLocaleString("en-IN")} · {Math.round(percent * 100)}%
    </text>
  );
};
export const pieLabelLine = { stroke: "var(--faint)", strokeWidth: 1 };
export function DateRangePicker({ value, onChange }) {
  return (
    <>
      <select value={value.preset} onChange={e => onChange({ ...value, preset: e.target.value })} style={selectStyle}>
        {DATE_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {value.preset === "custom" && (
        <>
          <input type="date" value={value.from || ""} max={value.to || undefined}
            onChange={e => onChange({ ...value, from: e.target.value })} style={selectStyle} />
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>to</span>
          <input type="date" value={value.to || ""} min={value.from || undefined}
            onChange={e => onChange({ ...value, to: e.target.value })} style={selectStyle} />
        </>
      )}
    </>
  );
}
export function MultiSelectFilter({ label, options, value, onChange, plural: pluralProp, width = 240 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Dropdown position (v2.29.308) — this panel is now portalled to
  // document.body (see below), so it needs its own viewport coordinates
  // instead of being positioned via `position: absolute` relative to the
  // toggle button. Computed fresh every time it opens.
  const [pos, setPos] = useState(null);
  const box = useRef(null);   // the toggle button wrapper
  const panel = useRef(null); // the portalled dropdown panel
  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (box.current && !box.current.contains(e.target) && panel.current && !panel.current.contains(e.target)) setOpen(false);
    };
    // Also close on scroll — a `position:fixed` portalled panel doesn't
    // track the toggle button's position as the page scrolls, so it would
    // otherwise visually "detach" from the button instead of following it.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);
  const toggleOpen = () => {
    if (!open && box.current) {
      const r = box.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };

  const plural = pluralProp || pluralise(label);
  const all = value === null;
  const sel = all ? options : value;
  const has = (o) => sel.includes(o);
  const toggle = (o) => {
    const next = has(o) ? sel.filter(x => x !== o) : [...sel, o];
    onChange(next.length === options.length ? null : next); // back to "all" → null
  };
  const out = options.filter(o => !has(o));
  const summary = all ? `All ${plural} (${options.length})`
    : sel.length === 0 ? `No ${label.toLowerCase()} selected`
    : out.length <= 2 ? `Excluding ${out.join(", ")}`
    : `${sel.length} of ${options.length} ${plural}`;
  const shown = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button onClick={toggleOpen} title={summary}
        style={{ ...selectStyle, display: "inline-flex", alignItems: "center", gap: 7, maxWidth: width, textAlign: "left", fontWeight: 500 }}>
        <Filter size={14} style={{ flexShrink: 0, color: all ? "var(--muted)" : "var(--teal)" }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
      </button>
      {open && pos && createPortal(
        // Portalled to document.body (v2.29.308) — this panel used to be
        // `position: absolute` inside the button's own wrapper, which put it
        // in the DOM under whichever scrollable ancestor happens to contain
        // this filter (e.g. the page's <main>). <main> sets overflowY:auto
        // for its own scrolling, and per the CSS spec that silently forces
        // overflowX to also compute as non-visible — clipping this panel at
        // main's own left edge whenever a filter sits close enough to it
        // (confirmed live: "half of the dropdown going inside the sidebar").
        // A z-index bump alone (tried at v2.29.305/307 for a different,
        // real dropdown-vs-topbar issue) can't fix this — the panel was
        // being clipped before z-index/paint-order even applies. Portalling
        // to body removes it from every ancestor's overflow entirely;
        // `pos` (viewport coordinates, computed from the toggle button's own
        // rect at open time) replaces the old parent-relative absolute
        // positioning.
        <div ref={panel} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 1000, width, background: "#fff",
          border: "1.5px solid var(--border)", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.12)", padding: 10 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${plural}…`}
            style={{ ...inp, padding: "7px 10px", fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => onChange(null)} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12 }}>Select all</button>
            <button onClick={() => onChange([])} style={{ ...btnGhost, padding: "4px 10px", fontSize: 12 }}>Clear</button>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {shown.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 4px" }}>No matches</div>}
            {shown.map(o => (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 4px", cursor: "pointer", fontSize: 13, color: "var(--f)" }}>
                <input type="checkbox" checked={has(o)} onChange={() => toggle(o)} style={{ width: 15, height: 15, accentColor: "var(--teal)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o}>{o}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
export function Drop() {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--grad-btn)", display: "grid", placeItems: "center", boxShadow: "0 6px 14px -6px rgba(168,217,64,.6)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12Z" fill="#fff" /></svg>
    </div>
  );
}
export function Stat({ label, value, icon: Icon, sub, hero, delta }) {
  // v2.29.274: `hero` used to render a green-to-lime gradient card — every
  // attempt to keep a legible delta badge on top of it (lightened text,
  // then a white pill) kept surfacing new contrast bugs, because no single
  // treatment survives a badge landing at an arbitrary point along a
  // gradient that spans dark green to bright lime. Per explicit user
  // request ("make all the hero cards in same color with white background
  // like other normal cards, it becomes easy to check the percentages going
  // up or down"), hero cards now render identically to normal ones — same
  // white background, same text colors — so the delta badge is just plain
  // green/red text on white, exactly as legible as every non-hero card
  // already was. `hero` is still accepted (existing call sites pass it) but
  // no longer changes any styling.
  const hasDelta = delta != null && Number.isFinite(delta);
  const up = hasDelta && delta > 0, down = hasDelta && delta < 0;
  const deltaColor = up ? "#08805A" : down ? "#DC4141" : "#7D8A83";
  return (
    <div style={{
      background: "#fff", color: "inherit", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)", position: "relative", overflow: "hidden"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span className="eyebrow" style={{ color: "var(--muted)" }}>{label}</span>
        <Icon size={18} color="var(--teal)" />
      </div>
      <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: "var(--f)", margin: "8px 0 2px", lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</div>
        {hasDelta && <span style={{ fontSize: 11.5, fontWeight: 700, color: deltaColor, whiteSpace: "nowrap" }}>
          {up ? "▲" : down ? "▼" : "—"} {up ? "+" : ""}{delta}%
        </span>}
      </div>
    </div>
  );
}
export function Card({ title, sub, children, pad = true, hover = true, style }) {
  // `hover` (default true) toggles the global .pw-card hover lift+zoom (App.jsx)
  // — set false for cards that are mostly a big scrollable data table, where
  // that zoom-on-hover reads as an unwanted jitter rather than a nice lift.
  return (
    <div className={hover ? "pw-card" : undefined} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden", ...style }}>
      {title && <div style={{ padding: "16px 18px 8px" }}>
        <h3 style={{ fontSize: 17 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
      </div>}
      <div style={{ padding: pad ? (title ? "0 18px 18px" : 18) : 0 }}>{children}</div>
    </div>
  );
}
export function PhotoUploader({ username, current, onClose, onSaved }) {
  const [mode, setMode] = useState("choose"); // choose | camera
  const [preview, setPreview] = useState(current || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stopCamera(), []); // cleanup on unmount

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.onerror = () => setErr("Could not read that file.");
    reader.readAsDataURL(f);
  };

  // Downscale to keep storage small.
  const resizeToDataUrl = (source, w = 256) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = w / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = source;
  });

  const startCamera = async () => {
    setErr(""); setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { setErr("Couldn't access the camera. Check browser permissions, or use Choose file."); setMode("choose"); }
  };

  const capture = () => {
    const v = videoRef.current; if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = Math.round((v.videoHeight / v.videoWidth) * 256) || 256;
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera(); setMode("choose");
  };

  const save = async () => {
    if (!preview) { setErr("Add a photo first."); return; }
    setBusy(true);
    try {
      const finalUrl = await resizeToDataUrl(preview, 256);
      await api.savePhoto(username, finalUrl);
      onSaved(finalUrl);
    } catch { setErr("Could not save the photo."); setBusy(false); }
  };

  return (
    <div onClick={() => { stopCamera(); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(13,40,24,.45)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 24px 60px rgba(13,40,24,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 20 }}>Profile photo</h3>
          <button onClick={() => { stopCamera(); onClose(); }} style={{ color: "var(--muted)" }}><X size={20} /></button>
        </div>

        {mode === "camera" ? (
          <div>
            <video ref={videoRef} style={{ width: "100%", borderRadius: 12, background: "#0A1A12", aspectRatio: "1", objectFit: "cover" }} muted playsInline />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={capture} style={{ ...btnPrimary, flex: 1 }}><Camera size={16} /> Capture</button>
              <button onClick={() => { stopCamera(); setMode("choose"); }} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", placeItems: "center", marginBottom: 16 }}>
              <div style={{ width: 120, height: 120, borderRadius: 999, overflow: "hidden", background: "var(--mint-2)", display: "grid", placeItems: "center", border: "2px solid var(--border)" }}>
                {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Camera size={34} color="var(--muted)" />}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <button onClick={startCamera} style={{ ...btnGhost, flex: 1 }}><Camera size={16} /> Take photo</button>
              <button onClick={() => fileRef.current?.click()} style={{ ...btnGhost, flex: 1 }}><ImageIcon size={16} /> Choose file</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            {err && <div style={{ color: "#DC4141", fontSize: 13, margin: "6px 0", display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} />{err}</div>}
            <button onClick={save} disabled={busy || !preview} style={{ ...btnPrimary, width: "100%", marginTop: 8, opacity: (busy || !preview) ? .6 : 1 }}>{busy ? "Saving…" : "Save photo"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
export function DeviceTypeBadge({ purifierId }) {
  const t = deviceType(purifierId);
  if (!t) return <span style={{ color: "var(--muted)" }}>—</span>;
  const [c, bg] = DEVICE_TYPE_STYLE[t] || ["#7D8A83", "#ECEEED"];
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{t}</span>;
}
export function SortHeader({ label, k, sort, onSort }) {
  const active = sort.key === k;
  return (
    <button onClick={() => onSort(k)} title="Sort"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", letterSpacing: "inherit", textTransform: "inherit", fontWeight: 700, padding: 0 }}>
      {label}
      {active
        ? <span style={{ fontSize: 10, color: "var(--teal)" }}>{sort.dir === "asc" ? "▲" : "▼"}</span>
        : <ArrowUpDown size={12} style={{ opacity: .4 }} />}
    </button>
  );
}
export function Login() {
  const { setUser } = useAuth();
  // Pre-fill the ID if "Remember me" was ticked last time. We never store the
  // password — the browser's own (OS-encrypted) password manager handles that.
  const rememberedId = (() => { try { return localStorage.getItem("pw_rememberId") || ""; } catch { return ""; } })();
  const [username, setUsername] = useState(rememberedId);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(false); // open the reset modal
  const [remember, setRemember] = useState(Boolean(rememberedId));
  const [animating, setAnimating] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim()) { setErr("Enter your ID."); return; }
    if (animating || success) return;
    setErr(""); setBusy(true);
    try {
      const u = await api.login(username.trim(), pw);
      try {
        if (remember) localStorage.setItem("pw_rememberId", username.trim());
        else localStorage.removeItem("pw_rememberId");
      } catch { /* storage unavailable — ignore */ }
      setAnimating(true);
      setTimeout(() => {
        setAnimating(false);
        setSuccess(true);
        setTimeout(() => {
          setUser(u);
        }, 600);
      }, 1300);
    }
    catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="pw-login-wrapper" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", background: "linear-gradient(135deg, #f5f0e6, #e8dcc3)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif' }}>
      <style>{`
        .pw-glow { position: absolute; border-radius: 50%; filter: blur(100px); animation: pw-float 12s infinite alternate ease-in-out; pointer-events: none; }
        .pw-glow.green { width: 450px; height: 450px; background: #1E9E4F; top: -150px; right: -100px; opacity: .35; }
        .pw-glow.blue { width: 420px; height: 420px; background: #C4E538; bottom: -150px; left: -120px; opacity: .35; }
        @keyframes pw-float { from { transform: translateY(0) scale(1); } to { transform: translateY(70px) scale(1.08); } }

        .pw-bubble { position: absolute; border-radius: 50%; background: rgba(255,255,255,.35); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); animation: pw-rise 18s infinite linear; pointer-events: none; }
        .pw-b1 { width: 70px; height: 70px; left: 15%; bottom: -100px; }
        .pw-b2 { width: 110px; height: 110px; right: 20%; bottom: -150px; animation-delay: 5s; }
        .pw-b3 { width: 45px; height: 45px; left: 50%; bottom: -100px; animation-delay: 9s; }
        @keyframes pw-rise { 0% { transform: translateY(0); opacity: 0.6; } 100% { transform: translateY(-130vh); opacity: 0; } }

        .pw-login-card { width: min(430px, 92%); padding: 35px 45px 45px; border-radius: 34px; background: rgba(255,255,255,.62); backdrop-filter: blur(45px) saturate(180%); -webkit-backdrop-filter: blur(45px) saturate(180%); border: 1px solid rgba(255,255,255,.8); box-shadow: 0 40px 100px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.8); animation: pw-show .7s ease; position: relative; z-index: 10; }
        @keyframes pw-show { from { opacity: 0; transform: translateY(30px) scale(.95); } to { opacity: 1; transform: none; } }

        .pw-login-logo { width: 170px; margin: 0 auto 10px; position: relative; display: flex; align-items: center; justify-content: center; }
        .pw-login-logo img { width: 100%; display: block; mix-blend-mode: multiply; filter: drop-shadow(0 12px 24px rgba(0,0,0,.12)); }
        .pw-login-logo:before { content: ""; position: absolute; width: 140px; height: 140px; background: rgba(30, 158, 79,.25); filter: blur(50px); z-index: -1; }

        .pw-login-h1 { margin: 10px 0 25px; font-size: 38px; letter-spacing: -.05em; color: #1d1d1f; font-weight: 800; text-align: center; }
        .pw-login-desc { font-size: 15px; color: #86868b; margin-bottom: 35px; text-align: center; }

        .pw-login-field { margin-bottom: 22px; }
        .pw-login-label { font-size: 13px; font-weight: 700; display: block; margin-bottom: 8px; color: #1d1d1f; }
        .pw-login-box { height: 56px; display: flex; align-items: center; background: rgba(255,255,255,.75); border-radius: 18px; border: 1px solid rgba(0,0,0,.06); transition: all 0.3s ease; position: relative; }
        .pw-login-box:focus-within { border-color: #1E9E4F; box-shadow: 0 0 0 5px rgba(30, 158, 79,.15); background: #ffffff; }

        .pw-login-box input { width: 100%; height: 100%; border: 0; outline: 0; background: none!important; padding: 0 15px; font-size: 16px; color: #1d1d1f!important; font-family: inherit; }
        .pw-login-box input:-webkit-autofill,
        .pw-login-box input:-webkit-autofill:hover, 
        .pw-login-box input:-webkit-autofill:focus { -webkit-box-shadow: 0 0px 0px 1000px #ffffff inset!important; -webkit-text-fill-color: #1d1d1f!important; transition: background-color 5000s ease-in-out 0s; }

        .pw-login-options { display: flex; justify-content: space-between; align-items: center; margin: 25px 0; }
        .pw-login-remember { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #1d1d1f; cursor: pointer; user-select: none; }
        
        .pw-login-switch { width: 44px; height: 25px; border-radius: 20px; background: #e5e5ea; position: relative; cursor: pointer; transition: background .25s; display: inline-block; }
        .pw-login-switch.active { background: #1E9E4F; }
        .pw-login-switch:after { content: ""; position: absolute; width: 21px; height: 21px; background: white; border-radius: 50%; left: 2px; top: 2px; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.25s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .pw-login-switch.active:after { transform: translateX(19px); }

        .pw-login-forgot { color: #1E9E4F; font-weight: 600; font-size: 14px; background: none; border: none; cursor: pointer; padding: 0; transition: color 0.2s; }
        .pw-login-forgot:hover { color: #147339; text-decoration: underline; }

        .pw-root button.pw-login-btn, button.pw-login-btn, .pw-login-btn {
          position: relative!important;
          height: 58px!important;
          width: 100%!important;
          border: 0!important;
          border-radius: 20px!important;
          background: linear-gradient(135deg, #1E9E4F 0%, #8DC63F 50%, #C4E538 100%)!important;
          background-size: 200% 200%!important;
          background-position: 0% 50%!important;
          color: white!important;
          font-size: 17px!important;
          font-weight: 700!important;
          cursor: pointer!important;
          overflow: hidden!important;
          display: flex!important;
          align-items: center!important;
          justify-content: center!important;
          box-shadow: 0 15px 35px rgba(196, 229, 56,.3)!important;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1)!important;
        }
        
        .pw-login-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: -120%;
          width: 70%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
          transform: skewX(-25deg);
          transition: left 0.75s ease-in-out;
          pointer-events: none;
          z-index: 5;
        }

        .pw-root button.pw-login-btn:hover:not(.animating):not(.success),
        button.pw-login-btn:hover:not(.animating):not(.success),
        .pw-login-btn:hover:not(.animating):not(.success) {
          background-position: 100% 50%!important;
          transform: translateY(-3px)!important;
          box-shadow: 0 20px 40px rgba(196, 229, 56,.4)!important;
        }
        
        .pw-login-btn:hover:not(.animating):not(.success)::after {
          left: 170%;
        }

        .pw-btn-arrow {
          display: inline-block;
          font-size: 18px;
          line-height: 1;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .pw-login-btn:hover:not(.animating) .pw-btn-arrow {
          transform: translate(3px, -3px) scale(1.2);
        }

        .pw-door-wrap {
          position: absolute;
          right: 28px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 40px;
          perspective: 350px;
          perspective-origin: right center;
        }

        .pw-door-frame {
          position: absolute;
          inset: 0;
          border: 2.5px solid rgba(255, 255, 255, 0.95);
          border-radius: 4px 4px 0 0;
          background: rgba(10, 26, 18, 0.6);
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }

        .pw-door-panel {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, #0d381e, #14532d);
          border-right: 1.5px solid rgba(255, 255, 255, 0.4);
          transform-origin: left center;
          transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .pw-door-knob {
          position: absolute;
          right: 3px;
          top: 50%;
          width: 3.5px;
          height: 3.5px;
          background: #C4E538;
          border-radius: 50%;
          box-shadow: 0 0 4px #C4E538;
        }

        .pw-runner {
          position: absolute;
          left: 15px;
          bottom: 10px;
          width: 32px;
          height: 38px;
          transform: translateX(0);
        }

        .runner-torso {
          animation: runner-bob 0.24s ease-in-out infinite alternate;
          transform-origin: center bottom;
        }

        .runner-leg-left {
          transform-origin: 16px 20px;
          animation: runner-leg-l 0.3s ease-in-out infinite alternate;
        }

        .runner-leg-right {
          transform-origin: 16px 20px;
          animation: runner-leg-r 0.3s ease-in-out infinite alternate;
        }

        .runner-arm-left {
          transform-origin: 16px 12px;
          animation: runner-arm-l 0.3s ease-in-out infinite alternate;
        }

        .runner-arm-right {
          transform-origin: 16px 12px;
          animation: runner-arm-r 0.3s ease-in-out infinite alternate;
        }

        @keyframes runner-bob {
          0% { transform: translateY(0) rotate(8deg); }
          100% { transform: translateY(-3px) rotate(14deg); }
        }

        @keyframes runner-leg-l {
          0% { transform: rotate(-45deg); }
          100% { transform: rotate(45deg); }
        }

        @keyframes runner-leg-r {
          0% { transform: rotate(45deg); }
          100% { transform: rotate(-45deg); }
        }

        @keyframes runner-arm-l {
          0% { transform: rotate(50deg); }
          100% { transform: rotate(-50deg); }
        }

        @keyframes runner-arm-r {
          0% { transform: rotate(-50deg); }
          100% { transform: rotate(50deg); }
        }

        .pw-login-btn.animating {
          cursor: wait!important;
          background-position: 100% 50%!important;
        }

        .pw-login-btn.animating .pw-runner {
          animation: run-to-door 1.25s cubic-bezier(0.35, 0, 0.25, 1) forwards;
        }

        @keyframes run-to-door {
          0% { transform: translateX(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          82% { transform: translateX(280px) scale(0.95); opacity: 1; }
          96% { transform: translateX(298px) scale(0.4); opacity: 0.8; }
          100% { transform: translateX(304px) scale(0.1); opacity: 0; }
        }

        .pw-login-btn.animating .pw-door-panel {
          animation: door-open-close 1.25s ease-in-out forwards;
        }

        @keyframes door-open-close {
          0%, 40% { transform: rotateY(0deg); }
          60%, 88% { transform: rotateY(-80deg); }
          98%, 100% { transform: rotateY(0deg); }
        }

        .pw-login-btn.success {
          background: linear-gradient(135deg, #059669 0%, #10B981 100%)!important;
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6)!important;
          transform: scale(1.02)!important;
        }

        @media(max-width:500px){
          .pw-login-card { padding: 30px; }
          .pw-login-h1 { font-size: 32px; }
          @keyframes run-to-door {
            0% { transform: translateX(0); opacity: 0; }
            10% { opacity: 1; }
            82% { transform: translateX(200px); opacity: 1; }
            100% { transform: translateX(220px) scale(0.1); opacity: 0; }
          }
        }
      `}</style>

      {/* Ambient Glows */}
      <div className="pw-glow green" />
      <div className="pw-glow blue" />

      {/* Blended Double-Exposure Background Image */}
      <div 
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/wisdom/login_bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
          opacity: 0.35,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          maskImage: "radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 80%)",
          WebkitMaskImage: "radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 80%)"
        }}
      />

      {/* Glass Bubbles */}
      <div className="pw-bubble pw-b1" />
      <div className="pw-bubble pw-b2" />
      <div className="pw-bubble pw-b3" />

      {/* Glass Login Card */}
      <div className="pw-login-card">
        <div className="pw-login-logo">
          <img src="prowater_logo_transparent_1200x1200.png" alt="ProWater Logo" />
        </div>

        <h1 className="pw-login-h1">Sign In</h1>
        <div className="pw-login-desc">Access your ProWater intelligent workspace.</div>

        <form onSubmit={submit}>
          <div className="pw-login-field">
            <label className="pw-login-label">User ID</label>
            <div className="pw-login-box">
              <div style={{ paddingLeft: 18, color: "#86868b", display: "flex", alignItems: "center" }}>
                <UserRound size={20} />
              </div>
              <input name="username" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter your ID" autoComplete="username" />
            </div>
          </div>

          <div className="pw-login-field">
            <label className="pw-login-label">Password</label>
            <div className="pw-login-box">
              <div style={{ paddingLeft: 18, color: "#86868b", display: "flex", alignItems: "center" }}>
                <Lock size={20} />
              </div>
              <input name="password" type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" />
              <div style={{ paddingRight: 18, cursor: "pointer", color: "#86868b", display: "flex", alignItems: "center" }}
                onClick={() => setShow(s => !s)} aria-label="toggle password">
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
            </div>
          </div>

          <div className="pw-login-options">
            <div className="pw-login-remember" onClick={() => setRemember(r => !r)}>
              <span className={`pw-login-switch ${remember ? "active" : ""}`} />
              Remember ID
            </div>
            <button type="button" className="pw-login-forgot" onClick={() => setForgot(true)}>
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={busy} className={`pw-login-btn ${animating ? "animating" : ""} ${success ? "success" : ""}`} style={{ opacity: busy ? 0.7 : 1 }}>
            {/* Default State Label */}
            <div className="pw-btn-content" id="btnContent" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              zIndex: 2,
              opacity: animating ? 0 : 1,
              transform: animating ? "scale(0.85)" : "scale(1)"
            }}>
              <span id="btnText">{success ? "Welcome!" : (busy && !animating ? "Signing in…" : "Sign In")}</span>
              {!success && !(busy && !animating) && <span className="pw-btn-arrow" id="btnArrow">↗</span>}
            </div>

            {/* Animation Track Stage */}
            <div className="pw-anim-stage" aria-hidden="true" style={{
              position: "absolute",
              inset: 0,
              opacity: animating ? 1 : 0,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              zIndex: 3,
              transition: "opacity 0.25s ease"
            }}>
              {/* Running SVG Character */}
              <div className="pw-runner">
                <svg viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Head & Torso */}
                  <g className="runner-torso">
                    <circle cx="16" cy="6" r="4.5" fill="#ffffff" />
                    <path d="M16 11 L16 22" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
                  </g>
                  {/* Arms */}
                  <g className="runner-arm-left">
                    <path d="M16 12.5 L10 17 L7 22" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <g className="runner-arm-right">
                    <path d="M16 12.5 L22 17 L25 14" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  {/* Legs */}
                  <g className="runner-leg-left">
                    <path d="M16 21 L10 27 L6 34" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <g className="runner-leg-right">
                    <path d="M16 21 L22 26 L27 33" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </svg>
              </div>

              {/* Doorway */}
              <div className="pw-door-wrap">
                <div className="pw-door-frame">
                  <div className="pw-door-panel">
                    <div className="pw-door-knob"></div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </form>

        {err && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", background: "rgba(220,65,65,0.08)", border: "1px solid rgba(220,65,65,0.2)", borderRadius: 14, padding: "12px 16px", color: "#DC4141", fontSize: 13.5, fontWeight: 600, marginTop: 22, animation: "pw-show .3s ease" }}>
            <AlertCircle size={18} />{err}
          </div>
        )}
      </div>

      {forgot && <ForgotPassword initialUsername={username} onClose={() => setForgot(false)} />}
    </div>
  );
}
export function ForgotPassword({ initialUsername = "", onClose }) {
  const [step, setStep] = useState(1); // 1=id+password+confirm, 2=done
  const [username, setUsername] = useState(initialUsername);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [countdown, setCountdown] = useState(3); // 3,2,1 → auto-return to sign in

  const doReset = async () => {
    if (!username.trim()) { setErr("Enter your User ID."); return; }
    if (newPw.length < 6) { setErr("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setErr("Passwords don't match."); return; }
    setErr(""); setBusy(true);
    try { await api.resetPassword(username.trim(), newPw); setStep(2); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Step 2 success screen counts down 3→2→1 and then returns to sign in on
  // its own, so the user isn't stuck needing to click anything.
  useEffect(() => {
    if (step !== 2) return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); onClose(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,40,24,.45)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 24px 60px rgba(13,40,24,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 22 }}>Reset password</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}><X size={20} /></button>
        </div>

        {step === 1 && <>
          <p style={{ fontSize: 13.5, color: "var(--slate)", marginBottom: 18 }}>Enter your User ID and a new password.</p>
          <Field label="User ID">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your-id" style={inp} />
          </Field>
          <Field label="New password">
            <div style={{ display: "flex" }}>
              <input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 6 characters"
                style={{ ...inp, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none" }} />
              <span onClick={() => setShowPw(s => !s)} style={{ display: "flex", alignItems: "center", padding: "0 12px", background: "var(--mint-2)", border: "1px solid var(--border)", borderLeft: "none", borderTopRightRadius: 11, borderBottomRightRadius: 11, color: "var(--muted)", cursor: "pointer" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
            </div>
          </Field>
          <Field label="Confirm new password">
            <input type={showPw ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doReset()} placeholder="Re-enter the same password" style={inp} />
          </Field>
          {newPw && confirmPw && newPw !== confirmPw && (
            <div style={{ color: "#986315", fontSize: 12.5, marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={14} />Passwords don't match yet.</div>
          )}
          {err && <div style={{ color: "#DC4141", fontSize: 13, marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} />{err}</div>}
          <button onClick={doReset} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Resetting…" : "Reset password"}</button>
        </>}

        {step === 2 && <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 999, background: "#E2F3EE", color: "#08805A", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><CheckCircle2 size={26} /></div>
          <h4 style={{ fontSize: 18, marginBottom: 6 }}>Password updated</h4>
          <p style={{ fontSize: 13.5, color: "var(--slate)", marginBottom: 18 }}>You can now sign in with your new password.</p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: "var(--mint-2)", color: "var(--forest)", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {countdown}
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Returning to sign in…</span>
          </div>
          <button onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>Back to sign in now</button>
        </div>}
      </div>
    </div>
  );
}
export function Table({ head, children, maxHeight }) {
  return (
    <div className="scroll-thin" style={{ overflowX: "auto", overflowY: maxHeight ? "auto" : "visible", maxHeight: maxHeight || "none" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} style={{ textAlign: "center", padding: "13px 16px", fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: "#0A1A12", fontWeight: 700, borderBottom: "2px solid #ECEEED", background: "#E2F0EA", whiteSpace: "nowrap", verticalAlign: "middle", position: maxHeight ? "sticky" : "static", top: 0, zIndex: 1 }}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Toolbar({ q, setQ, placeholder, count, right }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
          style={{ ...inp, paddingLeft: 36, margin: 0 }} />
      </div>
      {right}
      {count != null && <span style={{ fontSize: 12.5, color: "var(--muted)", marginLeft: "auto" }}>{count} result{count !== 1 ? "s" : ""}</span>}
    </div>
  );
}
export function Person({ name, email }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", textAlign: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--mint-2)", color: "var(--teal)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {name.split(" ").map(s => s[0]).slice(0, 2).join("")}
      </div>
      <div style={{ lineHeight: 1.25, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", wordBreak: "break-word" }}>{email}</div>
      </div>
    </div>
  );
}
export function Chip({ children }) {
  return <span style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", background: "var(--mint-2)", color: "var(--teal-d)", padding: "3px 8px", borderRadius: 7, fontWeight: 600 }}>{children}</span>;
}
export function Status({ s }) {
  const map = {
    active: ["#08805A", "#E2F3EE"], paid: ["#08805A", "#E2F3EE"], approved: ["#08805A", "#E2F3EE"], converted: ["#08805A", "#E2F3EE"],
    pending: ["#986315", "#FBF0E0"], paused: ["#986315", "#FBF0E0"],
    failed: ["#DC4141", "#FBE8E8"], rejected: ["#DC4141", "#FBE8E8"], disabled: ["#7D8A83", "#ECEEED"],
  };
  const [c, bg] = map[s] || ["#7D8A83", "#ECEEED"];
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, textTransform: "capitalize" }}>{s}</span>;
}
export function LogChip({ type }) {
  const palette = {
    login_success: ["#08805A", "#E2F3EE"], login_failed: ["#DC4141", "#FBE8E8"],
    logout: ["#7D8A83", "#ECEEED"], user_created: ["#0B6F52", "#E2F3EE"],
    password_reset: ["#986315", "#FBF0E0"], user_deleted: ["#DC4141", "#FBE8E8"],
    user_toggled: ["#0B6F52", "#E2F3EE"],
    api_failure: ["#DC4141", "#FBE8E8"], api_recovery: ["#08805A", "#E2F3EE"], logs_cleared: ["#986315", "#FBF0E0"],
    credit_approved: ["#08805A", "#E2F3EE"], credit_rejected: ["#DC4141", "#FBE8E8"],
    credit_manual: ["#0B6F52", "#E2F3EE"],
    reverted: ["#986315", "#FBF0E0"],
  };
  const [c, bg] = palette[type] || ["#7D8A83", "#ECEEED"];
  return <span style={{ fontSize: 11, fontWeight: 600, color: c, background: bg, padding: "3px 8px", borderRadius: 7 }}>{type.replace(/_/g, " ")}</span>;
}
export function DefRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{k}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)", textAlign: "right" }}>{v == null || v === "" ? "—" : v}</span>
    </div>
  );
}
export function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14, textAlign: "left" }}>
      <span style={{ display: "block", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, marginBottom: 6, textAlign: "left" }}>{label}</span>
      {children}
    </label>
  );
}
// Shared font stacks (v2.29.314) — `Modal`/`Drawer` are portalled straight to
// `document.body`, entirely outside `.pw-root` (the div that actually
// carries the app's real fonts: DM Sans body / Playfair Display headings,
// set in App.jsx). Without their own explicit font-family, every popup was
// silently falling back to the browser default (Times) instead of matching
// the rest of the CRM — confirmed live via getComputedStyle. Applied
// directly here so every Modal/Drawer in the app is fixed at once, not just
// one call site.
export const PW_BODY_FONT = "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const PW_HEADING_FONT = "'Playfair Display',Georgia,'Times New Roman',serif";
export function Drawer({ title, sub, children, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{ ...overlay, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="scroll-thin" style={{
        marginLeft: "auto", width: "min(440px,100%)", height: "100%", background: "#fff", padding: 26, overflowY: "auto",
        boxShadow: "var(--shadow-lg)", animation: "slideIn .25s ease both", fontFamily: PW_BODY_FONT
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:.6}to{transform:none;opacity:1}}`}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
          <div><p className="eyebrow">{sub}</p><h2 style={{ fontSize: 24, fontFamily: PW_HEADING_FONT }}>{title}</h2></div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
export function Modal({ title, sub, children, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{ ...overlay, alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="pw-pop" style={{ width: "min(440px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 26, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 80px)", overflowY: "auto", fontFamily: PW_BODY_FONT }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
          <div>{sub && <p className="eyebrow">{sub}</p>}<h2 style={{ fontSize: 22, fontFamily: PW_HEADING_FONT }}>{title}</h2></div>
          <button onClick={onClose} style={{ ...iconBtn, flexShrink: 0 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
export const TT = ({ active, payload, label, prefix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--forest)", color: "#fff", padding: "9px 12px", borderRadius: 9, fontSize: 12, boxShadow: "var(--shadow-lg)" }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color }} />
          {p.name}: <strong>{prefix}{p.value.toLocaleString("en-IN")}</strong>
        </div>
      ))}
    </div>
  );
};
export const WowMomTT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload || {};
  const pct = p.pct;
  const pctColor = pct == null ? "#fff" : pct > 0 ? "#1E9E4F" : pct < 0 ? "#F5BFBF" : "#fff";
  return (
    <div style={{ background: "var(--forest)", color: "#fff", padding: "9px 12px", borderRadius: 9, fontSize: 12, boxShadow: "var(--shadow-lg)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>Collected: <strong>₹{(p.collected || 0).toLocaleString("en-IN")}</strong></div>
      {pct != null && <div style={{ color: pctColor, marginTop: 2 }}>{pct > 0 ? "▲" : pct < 0 ? "▼" : "—"} {pct > 0 ? "+" : ""}{pct}% vs prev</div>}
    </div>
  );
};
export function ProWaterLogo({ size = 36, style = {}, className = "", badge = false }) {
  const logoImg = (
    <img
      src="prowater_logo_transparent_1200x1200.png"
      alt="ProWater Logo"
      className={`pw-official-logo ${className}`}
      style={{
        height: size,
        width: "auto",
        maxHeight: size,
        objectFit: "contain",
        display: "block",
        filter: "drop-shadow(0 2px 8px rgba(30, 158, 79,0.25))",
        ...style
      }}
    />
  );

  if (!badge) return logoImg;

  return (
    <div className={`pw-logo-badge ${className}`} style={{
      background: "rgba(255, 255, 255, 0.94)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderRadius: Math.round(size * (10 / 36)),
      padding: "3px 8px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 14px rgba(30, 158, 79, 0.25), inset 0 1px 0 #ffffff",
      border: "1px solid rgba(255, 255, 255, 0.8)",
      flex: "0 0 auto",
      ...style
    }}>
      {logoImg}
    </div>
  );
}

export const Loading = ({ title = "Loading Workspace Data", subtitle = "Synchronizing live records & telemetry…", showSkeleton = true }) => (
  <div className="fade-up ov-sans" style={{ minHeight: "calc(100vh - 200px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "50px 20px" }}>
    <style>{`
      @keyframes pw-ripple {
        0% { transform: scale(0.88); opacity: 0.85; box-shadow: 0 0 0 0 rgba(30, 158, 79, 0.4); }
        50% { transform: scale(1.08); opacity: 1; box-shadow: 0 0 0 20px rgba(30, 158, 79, 0); }
        100% { transform: scale(0.88); opacity: 0.85; box-shadow: 0 0 0 0 rgba(30, 158, 79, 0); }
      }
      @keyframes pw-spin-ring {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes pw-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .pw-skeleton-bar {
        background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%);
        background-size: 200% 100%;
        animation: pw-shimmer 1.8s infinite ease-in-out;
        border-radius: 8px;
      }
    `}</style>

    {/* Main Animated Water Droplet Spinner Emblem with ProWater Logo */}
    <div style={{ position: "relative", width: 84, height: 84, display: "grid", placeItems: "center", marginBottom: 24 }}>
      {/* Outer Rotating Dotted Ring */}
      <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: "2px dashed rgba(30, 158, 79, 0.3)", animation: "pw-spin-ring 12s linear infinite" }} />

      {/* Conic Gradient Spinner Ring */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "conic-gradient(from 0deg, #1E9E4F, #036EA9, #1E9E4F 80%, transparent 100%)",
        WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 4px))",
        mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), #fff calc(100% - 4px))",
        animation: "pw-spin-ring 1.2s linear infinite",
      }} />

      {/* Center Glowing Orb with Official ProWater Logo */}
      <div style={{
        width: 58, height: 58, borderRadius: "50%",
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 8px 24px rgba(30, 158, 79, 0.38)",
        display: "grid", placeItems: "center",
        animation: "pw-ripple 2.4s infinite ease-in-out",
        padding: 6
      }}>
        <ProWaterLogo size={38} badge={false} />
      </div>
    </div>

    {/* Text Readout & Sync Status */}
    <div style={{ textAlign: "center", marginBottom: showSkeleton ? 32 : 0 }}>
      <h3 style={{ fontSize: 17, fontWeight: 750, color: "var(--f, #1D1D1F)", margin: 0, letterSpacing: "-.02em" }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--muted, #86868B)", marginTop: 5, marginBottom: 0 }}>
        {subtitle}
      </p>
    </div>

    {/* HIG Skeleton Layout Preview */}
    {showSkeleton && (
      <div style={{ width: "100%", maxWidth: 860, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid var(--border, rgba(0,0,0,0.06))", borderRadius: 20, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          <div className="pw-skeleton-bar" style={{ height: 60 }} />
          <div className="pw-skeleton-bar" style={{ height: 60 }} />
          <div className="pw-skeleton-bar" style={{ height: 60 }} />
        </div>
        <div className="pw-skeleton-bar" style={{ height: 38, marginBottom: 12, width: "100%" }} />
        <div className="pw-skeleton-bar" style={{ height: 24, marginBottom: 8, width: "95%" }} />
        <div className="pw-skeleton-bar" style={{ height: 24, marginBottom: 8, width: "88%" }} />
        <div className="pw-skeleton-bar" style={{ height: 24, width: "92%" }} />
      </div>
    )}
  </div>
);
export const Empty = ({ msg }) => <div style={{ padding: "28px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>{msg}</div>;
export const ApiError = ({ msg }) => (
  <div style={{ padding: "40px 28px", textAlign: "center", color: "var(--slate)" }}>
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 999, background: "#FBE8E8", color: "#DC4141", marginBottom: 12 }}>
      <AlertCircle size={24} />
    </div>
    <h3 style={{ fontSize: 18, marginBottom: 6 }}>Couldn't load data</h3>
    <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 420, margin: "0 auto 16px" }}>{msg}</p>
    <button onClick={() => window.location.reload()} style={btnGhost}>Retry</button>
  </div>
);
export const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 11, fontSize: 14, color: "var(--f)", background: "#fff", outline: "none", marginBottom: 0, fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" };
export const selectStyle = { ...inp, width: "auto", padding: "9px 12px", cursor: "pointer" };
export const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, background: "var(--grad-btn)", color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 8px 18px -8px rgba(22,84,92,.6)", justifyContent: "center" };
export const btnGhost = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 11, border: "1.5px solid var(--border)", background: "#fff", color: "var(--slate)", fontWeight: 600, fontSize: 13 };
export const iconBtn = { display: "inline-flex", padding: 7, borderRadius: 9, color: "var(--slate)", background: "var(--mint)", marginLeft: 5 };
export const td = { padding: "12px 16px", fontSize: 13.5, color: "var(--slate)", borderBottom: "1px solid var(--border)", whiteSpace: "normal", wordBreak: "break-word", textAlign: "center", verticalAlign: "middle" };
export const ftd = { ...td, position: "sticky", bottom: 0, background: "var(--mint-2)", fontWeight: 700, borderTop: "2px solid var(--border)" };
export const trStyle = { borderBottom: "1px solid var(--border)", cursor: "pointer" };
export const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 };
export const axisTick = { fontSize: 11, fill: "#A9B3AC" };
export const overlay = { position: "fixed", inset: 0, background: "rgba(13,40,24,.46)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", zIndex: 50 };
export const toastStyle = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--forest)", color: "#fff", padding: "11px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, boxShadow: "var(--shadow-lg)", zIndex: 60 };

// Reconstructed (see shared/core.js's note on keyLc/rangeFilter — same v2.30
// module-split incident, same recovery method: exact usage-site analysis).
// A plain from/to date-input filter bar (distinct from the preset-based
// DateRangePicker above) — `range` is a raw {from, to} string pair from two
// <input type="date">s, `onChange` replaces the whole object, `right` is an
// optional trailing content slot (search result counts, export buttons, etc).
export function DateRangeFilter({ range, onChange, right }) {
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <input type="date" value={range.from || ""} onChange={e => onChange({ ...range, from: e.target.value })} style={{ ...inp, width: 170 }} />
      <span style={{ color: "var(--muted)", fontSize: 12.5 }}>to</span>
      <input type="date" value={range.to || ""} onChange={e => onChange({ ...range, to: e.target.value })} style={{ ...inp, width: 170 }} />
      {(range.from || range.to) && <button onClick={() => onChange({ from: "", to: "" })} style={btnGhost}>Clear</button>}
      {right}
    </div>
  );
}

// Editable inline table cell (or plain text when not editable) — shared by
// Auto Scheduler's society editor and Analytics' PenetrationTracker flat-count
// override.
export function GsTextCell({ value, editable, onCommit, type = "text", width = 120, placeholder = "" }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  if (!editable) return (value === "" || value == null) ? "—" : String(value);
  return (
    <input type={type} value={v} placeholder={placeholder} min={type === "number" ? "0" : undefined}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (String(v) !== String(value ?? "")) onCommit(v); }}
      style={{ ...inp, width, padding: "6px 8px", fontSize: 12.5, marginBottom: 0, textAlign: "center" }} />
  );
}

// Module id -> icon component, for anywhere a module needs to render its own
// nav icon generically (e.g. About's module-docs cards).
export const MODULE_ICONS = { Briefcase, Receipt, Boxes, Wrench, GitBranch, BarChart3, UserCog, ScrollText, Ticket, UserRound, Cpu, Landmark, CalendarClock, Repeat, Info, LayoutGrid };
