import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Users, GitBranch, BarChart3, ScrollText, UserCog,
  LogOut, Search, Plus, Eye, EyeOff, Shield, ShieldCheck, Filter,
  TrendingUp, Award, Wallet, ChevronRight, X, CheckCircle2, Clock,
  AlertCircle, Download, Lock, ArrowUpRight, Trash2, KeyRound, Menu,
  Coins, Check, Ban, Hourglass, Globe, MapPin, Undo2, RotateCcw, RefreshCw, Camera, Image as ImageIcon, Trophy, Medal, MessageCircle, Phone, ArrowUpDown, ChevronLeft, Mail, Moon, Sun, Printer, Briefcase, Receipt, Boxes, Wrench, Home as HomeIcon, LayoutGrid, Construction, Ticket, UserRound, PencilLine, Cpu, Landmark, Scale, ArrowLeftRight, Droplets, CalendarClock, Repeat, Info
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  ComposedChart, Line, ReferenceLine, LineChart
} from "recharts";

/* ============================================================================
   ProWater Referral Dashboard
   ----------------------------------------------------------------------------
   Single-file frontend. Mock data layer (`api`) is isolated so you can swap
   each function for a real Zoho Billing / Firebase call later. Search for
   "// >>> WIRE:" comments to find every integration point.
   ============================================================================ */

/* ---------- Design tokens (injected once) ---------- */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  :root{
    --forest:#1a2f1e; --forest-2:#243d28; --teal:#5a7863; --teal-d:#4c6654;
    --lime:#90ab8b; --lime-d:#7d9a78;
    --mint:#f3f8ec; --mint-2:#ebf4dd;
    --f:#28323a;            /* ink for headings (from slate charcoal) */
    --slate:#46555d;        /* body text */
    --muted:#8a968f;        /* labels / captions */
    --border:#dde7da;
    --white:#ffffff;
    --grad:linear-gradient(135deg,var(--teal) 0%, var(--lime) 140%);
    --grad-btn:linear-gradient(120deg,#5a7863 0%, #90ab8b 130%);
    --shadow:0 1px 2px rgba(40,50,58,.04), 0 8px 24px -12px rgba(40,50,58,.18);
    --shadow-lg:0 24px 60px -20px rgba(40,50,58,.32);
    --radius:16px;
  }
  *{box-sizing:border-box}
  html,body,#root{margin:0;padding:0;width:100%;min-height:100vh}
  body{margin:0;padding:0;background:#0a1a0f}
#root{margin:0;padding:0;background:#0a1a0f;min-height:100vh;width:100%}

  .pw-root{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--slate);
    background:var(--mint);min-height:100vh;width:100%;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;letter-spacing:-.003em}
  /* Display serif for headings + the .serif class (big KPI numbers) */
  .pw-root h1,.pw-root h2,.pw-root h3,.pw-root .serif{font-family:'Playfair Display',Georgia,'Times New Roman',serif;color:var(--f);font-weight:800;letter-spacing:-.015em;line-height:1.14}
  .pw-root code,.pw-root .mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
  .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}
  .lime-word{color:var(--lime-d)}
  ::selection{background:var(--lime);color:var(--forest)}
  .pw-root button{font-family:inherit;cursor:pointer;border:none;background:none;transition:transform .12s ease, filter .14s ease, box-shadow .16s ease, background .14s ease}
  .pw-root button:disabled{cursor:not-allowed}
  .pw-root button:not(:disabled):hover{filter:brightness(1.03)}
  .pw-root button:not(:disabled):active{transform:scale(.985)}
  .pw-root input,.pw-root select,.pw-root textarea{font-family:inherit;transition:border-color .15s ease, box-shadow .15s ease}
  .pw-root input:focus,.pw-root select:focus,.pw-root textarea:focus{border-color:var(--lime-d);box-shadow:0 0 0 3px rgba(144,171,139,.22);outline:none}
  .pw-root select{appearance:none;-webkit-appearance:none;padding-right:32px!important;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a968f' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
    background-repeat:no-repeat;background-position:right 11px center}
  /* alive, hover-highlighted table rows (inline-styled rows keep their own bg) */
  .pw-root tbody tr{transition:background .12s ease}
  .pw-root tbody tr:hover{background:#eef5e2}
  .scroll-thin::-webkit-scrollbar{width:9px;height:9px}
  .pw-root ::-webkit-scrollbar{width:11px;height:11px}
  .pw-root ::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px;border:2px solid transparent;background-clip:content-box}
  .pw-root ::-webkit-scrollbar-thumb:hover{background:var(--lime-d);background-clip:content-box}
  .pw-root ::-webkit-scrollbar-track{background:transparent}
  /* ---- Weather animations ---- */
  @keyframes wx-spin{to{transform:rotate(360deg)}}
  @keyframes wx-pulse{0%,100%{opacity:1}50%{opacity:.55}}
  @keyframes wx-drift{0%{transform:translateX(-2px)}50%{transform:translateX(2px)}100%{transform:translateX(-2px)}}
  @keyframes wx-rain{0%{transform:translateY(-3px);opacity:0}30%{opacity:1}100%{transform:translateY(7px);opacity:0}}
  @keyframes wx-flash{0%,92%,100%{opacity:0}94%,98%{opacity:1}}
  @keyframes wx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
  .wx-sun{transform-origin:center;animation:wx-spin 9s linear infinite}
  .wx-sun-core{animation:wx-pulse 2.4s ease-in-out infinite}
  .wx-cloud{animation:wx-drift 3.5s ease-in-out infinite}
  .wx-drop{animation:wx-rain 1.1s linear infinite}
  .wx-bolt{animation:wx-flash 3s linear infinite}
  .biker{animation:wx-bob 0.6s ease-in-out infinite}
  .scroll-thin::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px}
  *:focus-visible{outline:2px solid var(--lime-d);outline-offset:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes pw-pop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
  .pw-pop{animation:pw-pop .22s cubic-bezier(.2,.8,.2,1) both}
  @keyframes pw-spin{to{transform:rotate(360deg)}}
  @keyframes pw-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes pw-fade{from{opacity:0}to{opacity:1}}
  @keyframes pw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes pw-glow{0%,100%{opacity:.4}50%{opacity:1}}
  @keyframes pw-float-a{0%{transform:translate(0,0) scale(1)}33%{transform:translate(80px,-90px) scale(1.25)}66%{transform:translate(-60px,50px) scale(.85)}100%{transform:translate(0,0) scale(1)}}
  @keyframes pw-float-b{0%{transform:translate(0,0) scale(1)}50%{transform:translate(110px,-70px) scale(1.35)}100%{transform:translate(0,0) scale(1)}}
  @keyframes pw-float-c{0%{transform:translate(0,0)}50%{transform:translate(-90px,80px) scale(1.2)}100%{transform:translate(0,0)}}
  @keyframes pw-drift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  @keyframes pw-pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}
  @keyframes pw-ring{0%{transform:scale(.6);opacity:.7}100%{transform:scale(3);opacity:0}}
  @keyframes pw-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes pw-particle{0%{transform:translateY(100vh) scale(.6);opacity:0}10%{opacity:.7}90%{opacity:.7}100%{transform:translateY(-10vh) scale(1.1);opacity:0}}
  .pw-stagger>*{opacity:0;animation:pw-rise .6s ease both}
  .pw-stagger>*:nth-child(1){animation-delay:.05s}
  .pw-stagger>*:nth-child(2){animation-delay:.15s}
  .pw-stagger>*:nth-child(3){animation-delay:.25s}
  .pw-stagger>*:nth-child(4){animation-delay:.35s}
  .pw-stagger>*:nth-child(5){animation-delay:.45s}
  .pw-stagger>*:nth-child(6){animation-delay:.55s}
  .pw-stagger>*:nth-child(7){animation-delay:.65s}
  @media (prefers-reduced-motion:reduce){.pw-stagger>*{animation:none;opacity:1}}
  .fade-up{animation:fadeUp .4s ease both}
  @media (prefers-reduced-motion:reduce){.fade-up{animation:none}}
  /* Print / Save-as-PDF: drop the app chrome and interactive controls, keep the report. */
  @media print{
    .pw-side,.pw-topbar,.no-print{display:none!important}
    .shell-grid{grid-template-columns:1fr!important}
    main{min-width:0!important}
    body{background:#fff!important}
    .fade-up{animation:none!important}
    .print-head{display:block!important}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:14mm}
  }
  .print-head{display:none}
`;

/* ===========================================================================
   MOCK DATA  (replace with real fetches — see WIRE notes)
   =========================================================================== */

// The platform modules. `access` per user maps module id → "none" | "view" | "admin".
const MODULES = [
  { id: "sales",     label: "Sales",                  icon: "Briefcase",  desc: "Leads, pipeline & deals",          built: true,  color: "#5a7863" },
  { id: "customer",  label: "Customer",               icon: "UserRound",  desc: "Accounts & plan management",       built: true,  color: "#2b7a78" },
  { id: "billing",   label: "Billing & Subscription", icon: "Receipt",    desc: "Invoices, plans & renewals",       built: true,  color: "#0f6e3f" },
  { id: "erp",       label: "ERP & Inventory",        icon: "Boxes",      desc: "Stock, purifiers & supply",        built: true,  soon: true, color: "#8a5a2b" },
  { id: "fsm",       label: "FSM System",             icon: "Wrench",     desc: "Field service & installations",    built: true,  soon: true, color: "#9a3b6e" },
  { id: "iot",       label: "IoT Core",               icon: "Cpu",        desc: "Device telemetry & connectivity",  built: true,  color: "#0d7a8c" },
  { id: "referral",  label: "Referral",               icon: "GitBranch",  desc: "Referrers, referees & rewards",    built: true,  color: "#90ab8b" },
  { id: "ticketing", label: "Ticketing",              icon: "Ticket",     desc: "Support tickets & resolution",     built: true,  color: "#c2671e" },
  { id: "autoscheduler", label: "Auto Scheduler",     icon: "CalendarClock", desc: "Recurring service scheduling & IoT alerts", built: true, color: "#16545c" },
  { id: "analytics", label: "Analytics",              icon: "BarChart3",  desc: "Cross-module reporting",           built: true,  color: "#3a6ea5" },
  { id: "employee",  label: "Employee",               icon: "UserCog",    desc: "Add & manage dashboard users",     built: true,  color: "#7a4fb5" },
  { id: "devicereplace", label: "Device Replacement", icon: "Repeat",     desc: "Swap an old purifier for a new one", built: true, color: "#4f6f8f" },
  { id: "logtracker",label: "Logs Tracker",           icon: "ScrollText", desc: "Audit trail across all modules",   built: true,  color: "#b5694f" },
  { id: "about",     label: "About",                  icon: "Info",       desc: "Version history & module docs",    built: true,  color: "#5a7863" },
];

// Default access for an admin: admin on everything.
const allAccess = (level) => Object.fromEntries(MODULES.map(m => [m.id, level]));

/* ---------- App version + changelog ----------
   Convention (user requirement): bump APP_VERSION and PREPEND a VERSION_HISTORY
   entry on EVERY change. The version is shown in the sidebar / home / login
   footers, the Logs Tracker banner, and the About module changelog. */
const APP_VERSION = "2.0.5";
const VERSION_DATE = "2026-07-10";
const VERSION_HISTORY = [
  { v: "2.0.5", note: "Rate-limit hardening 2: removed the eager on-login prefetch of all 4 datasets (now fetched on-demand per module); detect Zoho code-45 (\"exceeded maximum call rate limit of 1,000\") returned as 500 and back off 5 min while serving cache; cache windows extended to 3h (leads 1h); paginator read-ahead reduced to 2 so a rate-limit stops paging immediately." },
  { v: "2.0.4", note: "Rate-limit fix: dropped the heavy _raw payload from leads/apartments so the localStorage cache no longer silently overflows quota (which was forcing a full Zoho refetch on every reload); LS.set now reports write failures; added a GLOBAL request gate (max 2 concurrent Zoho requests, ~150ms apart) so a cold load can't burst into a 429; extended cache TTL to 60m (leads 30m)." },
  { v: "2.0.3", note: "Device Replacement popup redesigned into a shorter 2-step window (Old device details → New device details) with clearer labels/placeholders (Name, Phone “10-digit”, Email ID, Device Type “Select…”, auto uninstall date) and a live old-device ageing line; the irreversible confirm is now a compact separate popup. Device Type is required." },
  { v: "2.0.2", note: "Device Replacement now persists each confirmed swap to the DB via POST /device-replacement/add (old_device/new_device payload); phone is now a required field to match the backend; a toast confirms DB save or reports the server message." },
  { v: "2.0.1", note: "All data tables now fully centre-aligned — flipped every per-cell left/right override (names, addresses, POC, totals rows, chevron & detail columns) to centre; form labels & the Net-Revenue day-matrix keep their intentional alignment." },
  { v: "2.0.0", note: "Apartment Leads: removed the Manager Name column and added a POC column (order: Apartment Name, Manager Number, Meeting Status, POC, Address, Pincode, Flats, Created)." },
  { v: "1.9.9", note: "Display numbers (KPIs/stats) switched from Playfair serif to DM Sans to match the body text; Playfair kept for headings only." },
  { v: "1.9.8", note: "Design polish: real typography (Playfair Display headings + DM Sans body, dropped the Arial override), focus-glow inputs, custom select chevrons, hover-highlighted table rows, tactile button press, deeper blurred modal backdrops with a pop-in animation." },
  { v: "1.9.7", note: "Sales Analytics defaults to “Only apartments with leads” checked; Auto Scheduler rows all use the same white background (no red/amber row tinting)." },
  { v: "1.9.6", note: "UI polish: About changelog is now a horizontal timeline strip with module docs below; Device Replacement “New Entry” opens a stepped modal popup instead of taking over the screen." },
  { v: "1.9.5", note: "Persistent localStorage caches (pw_cache_*, 15–30m TTL) survive reloads; serve cached data on Zoho rate-limit (500) instead of failing; 1-min shared cooldown." },
  { v: "1.9.4", note: "Sales Analytics: removed 2 charts; pivot got created-date filter + Export; removed apartment search." },
  { v: "1.9.3", note: "Pivot expanded panel = scrollable zebra card, sticky header, count." },
  { v: "1.9.2", note: "Sales Analytics apartment × lead-status pivot, expandable to individual leads (join apartment name = Society Name)." },
  { v: "1.9.1", note: "Apartment Leads purpose-built table (columns + created-date/meeting-status filters + sortable Created)." },
  { v: "1.9.0", note: "Apartment Leads tab (adaptive table) via /admin/zoho/get-all-apartments/data." },
  { v: "1.8.9", note: "Show Convert Done again (emptied HIDDEN_LEAD_STATUSES)." },
  { v: "1.8.8", note: "Auto Scheduler no longer flags Server Down (local-first)." },
  { v: "1.8.7", note: "Server Down popup button → \"Close Module\"." },
  { v: "1.8.6", note: "Rate-limit hardening (bounded concurrency, 429 backoff, in-flight dedup)." },
  { v: "1.8.5", note: "Login matches email → Employee-module user (username/role/access)." },
  { v: "1.8.4", note: "Sales Error Correction tab." },
  { v: "1.8.3", note: "Analytics Sales section (lead-status numbers, society dropdown, plan value by society)." },
  { v: "1.8.2", note: "Removed Finance module; About history scrollable." },
  { v: "1.8.1", note: "Apartment Performance month selector." },
  { v: "1.8.0", note: "API failure monitoring (Failures tab, Server Down popup, email alerts)." },
  { v: "1.7.0", note: "Earned Revenue: MoM % + deposit/recharge = total; day-based recognition; deposit-collected card." },
  { v: "1.6.0", note: "Parallel pagination + totals rows everywhere." },
  { v: "1.5.0", note: "Removed DP Customers + Finance rename; performance (prefetch, cache) prep." },
  { v: "1.4.0", note: "Apartment Performance tab." },
  { v: "1.3.0", note: "Earned Revenue tab." },
  { v: "1.2.0", note: "Logs Tracker IP/version/clear fixes." },
  { v: "1.1.0", note: "Device Replacement + About modules; Auto Scheduler columns; version footer; removed Convert Done card + Defaulters." },
  { v: "1.0.0", note: "Initial." },
];

// Case/space-insensitive normaliser used across lead ↔ society/status matching.
const norm = (s) => String(s ?? "").trim().toLowerCase();

// Lead statuses to hide from the Sales tables. EMPTY on purpose — "Convert Done"
// is shown again (was briefly hidden mid-development). Keep the plumbing so a
// status can be hidden later by adding its normalised value to this set.
const HIDDEN_LEAD_STATUSES = new Set();
const notHiddenLead = (d) => !HIDDEN_LEAD_STATUSES.has(norm(d.rawStatus));

/* ---- Sales module SAMPLE data (replace with a real Sales API later) ----
   >>> WIRE: swap salesApi.getDeals() to fetch from your Sales/CRM backend. */
const SALES_STAGES = [
  { id: "new",        label: "New Lead",     color: "#869089" },
  { id: "contacted",  label: "Contacted",    color: "#3a6ea5" },
  { id: "demo",       label: "Demo Booked",  color: "#9a6a16" },
  { id: "proposal",   label: "Proposal",     color: "#8a5a2b" },
  { id: "won",        label: "Won",          color: "#1f7a3f" },
  { id: "lost",       label: "Lost",         color: "#b4232a" },
];
const SEED_DEALS = [
  { id: "d1", customer: "Aarav Mehta", email: "aarav.m@example.com", phone: "9876500011", flatNo: "A-1203", existingRo: "Yes - Kent", referralCode: "PW-REF-8821", society: "Prestige Lakeside", plan: "Home Annual", value: 9600, stage: "demo", rawStatus: "Pre-Qualified", owner: "anis", updated: "2026-06-16T09:20:00Z", note: "Wants a weekend demo slot." },
  { id: "d2", customer: "Divya Nair", email: "divya.n@example.com", phone: "9876500022", flatNo: "T4-0908", existingRo: "No", referralCode: "", society: "Sobha Dream Acres", plan: "Plus Annual", value: 14400, stage: "proposal", rawStatus: "Qualified", owner: "anis", updated: "2026-06-15T14:00:00Z", note: "Comparing with a competitor." },
  { id: "d3", customer: "Rohit Khanna", email: "rohit.k@example.com", phone: "9876500033", flatNo: "B-506", existingRo: "Yes - Aquaguard", referralCode: "PW-REF-4410", society: "Brigade Gateway", plan: "Home Quarterly", value: 2800, stage: "won", rawStatus: "Won", owner: "anis", updated: "2026-06-14T11:10:00Z", note: "Installed; happy customer." },
  { id: "d4", customer: "Sana Kapoor", email: "sana.k@example.com", phone: "9876500044", flatNo: "C-1710", existingRo: "No", referralCode: "PW-REF-9033", society: "Mantri Espana", plan: "Home Annual", value: 9600, stage: "contacted", rawStatus: "Contacted", owner: "anis", updated: "2026-06-17T08:05:00Z", note: "Asked to call after 6pm." },
  { id: "d5", customer: "Imran Sheikh", email: "imran.s@example.com", phone: "9876500055", flatNo: "D-204", existingRo: "Yes - Pureit", referralCode: "", society: "Purva Highlands", plan: "Home Monthly", value: 999, stage: "new", rawStatus: "Not Contacted", owner: "anis", updated: "2026-06-17T07:40:00Z", note: "Inbound web lead." },
  { id: "d6", customer: "Lakshmi Rao", email: "lakshmi.r@example.com", phone: "9876500066", flatNo: "E-1102", existingRo: "Yes - Livpure", referralCode: "PW-REF-2255", society: "Salarpuria Sattva", plan: "Plus Annual", value: 14400, stage: "lost", rawStatus: "Junk Lead", owner: "anis", updated: "2026-06-12T16:30:00Z", note: "Went with in-house RO." },
  { id: "d7", customer: "Vivek Anand", email: "vivek.a@example.com", phone: "9876500077", flatNo: "F-808", existingRo: "No", referralCode: "PW-REF-7719", society: "Prestige Shantiniketan", plan: "Home Annual", value: 9600, stage: "demo", rawStatus: "Pre-Qualified", owner: "anis", updated: "2026-06-16T13:25:00Z", note: "Demo done, deciding." },
  { id: "d8", customer: "Neha Joshi", email: "neha.j@example.com", phone: "9876500088", flatNo: "G-311", existingRo: "No", referralCode: "PW-REF-6642", society: "Godrej Woodsman", plan: "Home Quarterly", value: 2800, stage: "won", rawStatus: "Won", owner: "anis", updated: "2026-06-13T10:00:00Z", note: "Referred by existing customer." },
];
let _deals = [...SEED_DEALS];

/* Map a Zoho CRM Lead record to the shape the Sales UI uses.
   Zoho field API names are on the LEFT; adjust if your org uses custom names.
   Common Zoho Lead fields: Full_Name/Last_Name, Phone/Mobile, Company,
   Lead_Status, Created_Time, Owner.name. Your screenshot also shows custom
   fields: "Plan Value", "Plan Name", "Device Label", "Amount to be Collected". */
// Pull a value from a Zoho lead: try exact API names first, then any key whose
// normalised name contains one of the keywords. Skips nested objects/blanks.
function pickLeadField(z, exact, ...keywords) {
  const ok = (v) => v != null && v !== "" && typeof v !== "object";
  for (const k of exact) if (ok(z[k])) return z[k];
  const keys = Object.keys(z || {});
  for (const kw of keywords) {
    const k = keys.find(key => key.toLowerCase().replace(/[_\s-]/g, "").includes(kw) && ok(z[key]));
    if (k) return z[k];
  }
  return "";
}

function mapZohoLead(z) {
  // The backend returns lowercase snake_case (full_name, mobile, lead_status,
  // society_name, flat_no, existing_ro, referral_code, created_time). We keep
  // TitleCase fallbacks so it also survives a Zoho-native response.
  const clean = (s) => String(s ?? "").replace(/["\t]+/g, " ").replace(/\s+/g, " ").trim();
  const name = clean(z.full_name || z.Full_Name || [z.first_name || z.First_Name, z.last_name || z.Last_Name].filter(Boolean).join(" ")) || "—";
  const rawStatus = z.lead_status || z.Lead_Status || "—";
  const statusMap = {
    "not contacted": "new", "new": "new", "new lead": "new", "fresh lead": "new",
    "attempted to contact": "contacted", "contacted": "contacted", "contact in future": "contacted",
    "connect later": "contacted", "rnr": "contacted", "call back": "contacted",
    "junk lead": "lost", "lost lead": "lost", "not qualified": "lost", "not interested": "lost",
    "pre-qualified": "demo", "demo scheduled": "demo", "demo done": "demo", "interested": "demo",
    "qualified": "proposal", "convert done": "proposal", "convert pending": "proposal",
    "won": "won", "converted": "won", "installed": "won", "active": "won",
  };
  const stage = statusMap[String(rawStatus).toLowerCase()] || "new";
  const planValue = z.plan_value ?? z.Plan_Value ?? z.amount_to_be_collected ?? z.Amount_to_be_Collected ?? 0;
  return {
    id: z.id || crypto.randomUUID(),
    customer: name,
    email: z.email || z.Email || "",
    phone: z.mobile || z.phone || z.Mobile || z.Phone || "—",   // prefer mobile
    flatNo: z.flat_no || pickLeadField(z, ["Flat_No", "Flat_Number", "Door_No"], "flatno", "flatnumber", "doorno", "flat") || "",
    existingRo: z.existing_ro || pickLeadField(z, ["Existing_RO", "Existing_Ro"], "existingro", "existingpurifier") || "",
    referralCode: z.referral_code || pickLeadField(z, ["Referral_Code", "Referal_Code"], "referralcode", "referral") || "",
    society: z.society_name || z.company || z.Society_Name || z.Company || "—",
    plan: z.plan_name || z.Plan_Name || "—",
    planTenure: z.plan_tenure || z.Plan_Tenure || "—",
    value: Number(planValue) || 0,
    deposit: Number(z.deposit_amount ?? z.Deposit_Amount ?? z.deposit) || 0,
    amountToCollect: Number(z.amount_to_be_collected ?? z.Amount_to_be_Collected ?? planValue) || 0,
    deviceLabel: z.device_label || z.Device_Label || "—",
    address: z.address || z.Address || z.billing_address || "",
    stage,
    rawStatus,
    owner: z.owner?.name || z.Owner?.name || z.owner || "—",
    updated: z.modified_time || z.Modified_Time || z.created_time || z.Created_Time || "",
    created: z.created_time || z.Created_Time || "",
    note: z.description || z.Description || "",
  };
}

// ░░░ ZOHO CRM LEADS via your backend (same auth as customers/invoices) ░░░
// The backend proxies to Zoho CRM v7 /Leads using the session you already
// have from login — exactly like /admin/get-all-customers. No separate Zoho
// token is needed here; authHeaders() carries your login idToken.
// >>> If your backend names the route differently, change the path below.
const ZOHO_LEADS_PATH = "/admin/zoho/get-all-leads";
// Leads: per_page 500 + total-based parallel pagination + dedup by id (§3).
const salesEndpoint = (page = 1) => `${API_ORIGIN}${ZOHO_LEADS_PATH}?page=${page}&per_page=500`;

const salesApi = {
  // Live Zoho CRM Leads via the backend (/admin/zoho/get-all-leads → {status,cached,total,leads}).
  // Persistent-cached; serves cached rows on rate-limit, falls back to sample only if nothing cached.
  getDeals: async (force = false) => getCached("leads", "leads", ZOHO_LEADS_PATH, async () => {
    const raw = await fetchAllPagesFast(
      salesEndpoint,
      (json) => Array.isArray(json) ? json : (json.leads || json.data || []),
    );
    const mapped = raw.map(r => r.customer ? r : mapZohoLead(r));
    const seen = new Set(); const out = [];
    for (const d of mapped) { const k = d.id ?? JSON.stringify(d); if (seen.has(k)) continue; seen.add(k); out.push(d); }
    return out;
  }, [..._deals], force),
  updateStage: async (actor, id, stage) => {
    await wait(150);
    // >>> WIRE: PUT /api/sales/leads/:id to update Lead_Status in Zoho.
    _deals = _deals.map(d => d.id === id ? { ...d, stage, updated: new Date().toISOString() } : d);
    if (_memCache.leads?.rows) _memCache.leads.rows = _memCache.leads.rows.map(d => d.id === id ? { ...d, stage, updated: new Date().toISOString() } : d);
    const d = (_memCache.leads?.rows || _deals).find(x => x.id === id);
    pushLog({ type: "deal_stage_changed", actor, module: "Sales", detail: `Moved ${d?.customer} to ${SALES_STAGES.find(s => s.id === stage)?.label}` });
  },
  forceRefresh: async () => { _memCache.leads = null; _inflight.leads = null; await salesApi.getDeals(true); },
};

/* ---- Apartment leads (Zoho) — /admin/zoho/get-all-apartments/data (§14) ---- */
// Case/space-insensitive field picker for apartment rows.
function pickAptField(row, ...cands) {
  if (!row) return "";
  const keys = Object.keys(row);
  for (const c of cands) {
    const target = String(c).toLowerCase().replace(/[_\s-]/g, "");
    const k = keys.find(key => key.toLowerCase().replace(/[_\s-]/g, "") === target);
    if (k != null && row[k] != null && row[k] !== "") return row[k];
  }
  return "";
}
function mapApartment(r) {
  return {
    name:          pickAptField(r, "apartment_name", "name", "society", "society_name") || "—",
    managerNumber: pickAptField(r, "manager_number", "manager_phone", "phone", "mobile", "contact_number") || "—",
    meetingStatus: pickAptField(r, "meeting_status", "status") || "—",
    poc:           pickAptField(r, "poc", "poc_name", "point_of_contact", "contact_person", "spoc", "contact_name", "manager_name", "manager") || "—",
    address:       pickAptField(r, "address", "location", "full_address") || "",
    pincode:       pickAptField(r, "pincode", "pin_code", "zip", "postal_code") || "",
    flats:         Number(pickAptField(r, "number_of_flats", "no_of_flats", "flats", "total_flats")) || 0,
    createdTime:   pickAptField(r, "created_time", "created_at", "createdon", "created") || "",
  };
}
const apartmentApi = {
  getAll: async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/admin/zoho/get-all-apartments/data`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Apartments ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json
        : (json.apartments || json.data || json.leads || json.rows
          || (Object.values(json).find(v => Array.isArray(v)) || []));
      return rows.map(mapApartment);
    } catch (e) {
      console.warn("Apartments endpoint unavailable:", e.message);
      return [];
    }
  },
};

/* ---- Ticketing module — Freshdesk integration ----
   >>> WIRE: DevOps exposes GET /api/tickets that proxies
   https://prowater.freshdesk.com/api/v2/tickets (Freshdesk needs the API key
   server-side; the browser can't call it directly).
   Status numbers come from Freshdesk's ticket_fields; the full map is below. */

// Freshdesk status id → label. Built from your /api/v2/ticket_fields response.
const FD_STATUS = {
  2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed",
  6: "Waiting on Customer", 7: "Waiting on Third Party",
  8: "Delivery Created", 9: "Delivery Assigned", 10: "Delivery In-Progress",
  11: "Delivery Postponed", 12: "Delivery Cancelled", 13: "Delivery Completed",
  14: "Installation Scheduled", 15: "Installation Postponed",
  16: "Installation Cancelled", 17: "Installation Completed",
  9000: "Assigned to AI Agent",
};
// Color each status by family so the list stays readable.
const fdStatusColor = (id) => {
  if (id === 2) return "#b4232a";                       // Open
  if (id === 3 || id === 6 || id === 7) return "#9a6a16"; // Pending / waiting
  if (id === 4) return "#1f7a3f";                        // Resolved
  if (id === 5) return "#6a7670";                        // Closed
  if (id >= 8 && id <= 13) return "#3a6ea5";             // Delivery
  if (id >= 14 && id <= 17) return "#7a4fb5";            // Installation
  if (id === 9000) return "#16545c";                     // AI agent
  return "#6a7670";
};
// Build the status dropdown options from the map.
const TICKET_STATUSES = Object.entries(FD_STATUS).map(([id, label]) => ({ id: Number(id), label, color: fdStatusColor(Number(id)) }));

// Freshdesk priority id → label (matches your screenshot).
const FD_PRIORITY = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };
const fdPriorityColor = (id) => ({ 1: "#6a7670", 2: "#9a6a16", 3: "#c2671e", 4: "#b4232a" }[id] || "#6a7670");
const TICKET_PRIORITIES = Object.entries(FD_PRIORITY).map(([id, label]) => ({ id: Number(id), label, color: fdPriorityColor(Number(id)) }));

// Map a raw Freshdesk ticket → the shape the UI uses.
// Freshdesk returns custom fields either at the top level or nested under
// `custom_fields`, so we check both.
function mapFreshdeskTicket(t) {
  const cf = t.custom_fields || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (t[k] != null && t[k] !== "") return t[k];
      if (cf[k] != null && cf[k] !== "") return cf[k];
    }
    return null;
  };
  return {
    id: t.id,
    ticketNo: `#${t.id}`,
    purifierId: pick("cf_purifier_id") || "—",
    society: pick("cf_society_name766799", "cf_society_name") || "—",
    customer: pick("cf_customer_name") || t.name || "—",
    issueType: pick("cf_l1_issue_type") || "—",
    fieldAppIssueType: pick("cf_field_app_issue_type") || "—",
    type: t.type || pick("cf_type") || "—",
    status: Number(t.status),
    priority: Number(t.priority) || 1,
    subject: t.subject || pick("cf_l1_issue_type") || `Ticket ${t.id}`,
    created: t.created_at,
    updated: t.updated_at || t.created_at,
    note: t.description_text || t.description || "",
  };
}

// Sample tickets (Freshdesk shape) for fallback before the endpoint is live.
const SEED_TICKETS = [
  { id: 299, type: "Service Request", cf_purifier_id: "TEST89789", cf_society_name766799: "MJR", cf_customer_name: "uondu", cf_l1_issue_type: "No water output", cf_field_app_issue_type: "Low water flow", status: 2, priority: 4, subject: "No water output", created_at: "2026-06-13T07:34:55Z", updated_at: "2026-06-17T08:10:00Z", description_text: "Purifier not dispensing since morning." },
  { id: 301, type: "Billing", cf_purifier_id: "PW-44120", cf_society_name766799: "Prestige Lakeside", cf_customer_name: "Divya Nair", cf_l1_issue_type: "Billing dispute", status: 3, priority: 3, subject: "Wrong plan charged", created_at: "2026-06-16T15:30:00Z", updated_at: "2026-06-17T09:00:00Z", description_text: "Billed for Plus but on Home plan." },
  { id: 305, type: "Installation", cf_purifier_id: "PW-77810", cf_society_name766799: "Brigade Gateway", cf_customer_name: "Rohit Khanna", cf_l1_issue_type: "Installation", status: 14, priority: 2, subject: "Reschedule installation", created_at: "2026-06-16T11:00:00Z", updated_at: "2026-06-16T12:30:00Z", description_text: "Wants a weekend slot." },
  { id: 308, type: "Maintenance", cf_purifier_id: "PW-90233", cf_society_name766799: "Sobha Dream Acres", cf_customer_name: "Sana Kapoor", cf_l1_issue_type: "Filter replacement", cf_field_app_issue_type: "Filter life expired", status: 4, priority: 1, subject: "Filter replacement reminder", created_at: "2026-06-14T10:00:00Z", updated_at: "2026-06-15T14:20:00Z", description_text: "Filter dispatched." },
  { id: 312, type: "Service Request", cf_purifier_id: "PW-11567", cf_society_name766799: "Purva Highlands", cf_customer_name: "Imran Sheikh", cf_l1_issue_type: "App login", status: 2, priority: 2, subject: "App login not working", created_at: "2026-06-17T07:05:00Z", updated_at: "2026-06-17T07:05:00Z", description_text: "OTP not received." },
  { id: 315, type: "Billing", cf_purifier_id: "PW-33890", cf_society_name766799: "Salarpuria Sattva", cf_customer_name: "Lakshmi Rao", cf_l1_issue_type: "Cancellation", status: 5, priority: 3, subject: "Cancellation request", created_at: "2026-06-10T09:00:00Z", updated_at: "2026-06-12T16:00:00Z", description_text: "Unit picked up." },
  { id: 318, type: "Service Request", cf_purifier_id: "PW-55012", cf_society_name766799: "Godrej Woodsman", cf_customer_name: "Vivek Anand", cf_l1_issue_type: "Water taste", status: 10, priority: 2, subject: "Water tastes different", created_at: "2026-06-15T13:40:00Z", updated_at: "2026-06-16T10:15:00Z", description_text: "Technician visit scheduled." },
];
let _tickets = SEED_TICKETS.map(mapFreshdeskTicket);
const ticketsEndpoint = () => `${API_BASE}/api/tickets`;
let _tkCache = null, _tkCacheAt = 0;
const ticketApi = {
  // Fetches Freshdesk tickets via your backend; falls back to sample data.
  getTickets: async (force = false) => {
    const now = Date.now();
    if (!force && _tkCache && (now - _tkCacheAt) < 30000) return _tkCache;
    try {
      const res = await fetch(ticketsEndpoint());
      if (!res.ok) throw new Error(`Tickets API ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.tickets || json.data || []);
      if (!rows.length) throw new Error("empty");
      // Accept raw Freshdesk rows or already-mapped rows.
      const mapped = rows.map(r => r.ticketNo ? r : mapFreshdeskTicket(r));
      _tkCache = mapped; _tkCacheAt = now;
      return mapped;
    } catch (e) {
      console.warn("Tickets endpoint unavailable, using sample data:", e.message);
      return [..._tickets];
    }
  },
  updateStatus: async (actor, id, status) => {
    await wait(150);
    // >>> WIRE: PUT /api/tickets/:id { status } → Freshdesk.
    const s = Number(status);
    _tickets = _tickets.map(t => t.id === id ? { ...t, status: s, updated: new Date().toISOString() } : t);
    if (_tkCache) _tkCache = _tkCache.map(t => t.id === id ? { ...t, status: s, updated: new Date().toISOString() } : t);
    pushLog({ type: "ticket_status_changed", actor, module: "Ticketing", detail: `#${id} → ${FD_STATUS[s] || s}` });
  },
  // Create a real Freshdesk ticket. Freshdesk's POST /api/v2/tickets requires a
  // requester (email/phone/requester_id), subject, description, status &
  // priority — and CUSTOM FIELDS MUST BE NESTED under `custom_fields`, not at the
  // top level (top-level cf_* fields return a 400 "invalid field").
  createTicket: async (actor, info) => {
    // Freshdesk only allows these ticket types; anything else 400s. Coerce.
    const FD_TYPES = ["Installation", "Delivery", "Support", "Uninstallation"];
    const body = {
      subject: info.subject,
      description: info.description || info.subject,
      email: info.email || FRESHDESK_REQUESTER_EMAIL,   // requester is mandatory
      status: 2,                                        // Open
      priority: info.priority || 2,
      type: FD_TYPES.includes(info.type) ? info.type : "Support",
      custom_fields: {
        ...(info.society ? { cf_society_name766799: info.society } : {}),
        ...(info.purifierId ? { cf_purifier_id: info.purifierId } : {}),
        ...(info.issueType ? { cf_l1_issue_type: info.issueType } : {}),
      },
    };
    // >>> WIRE: on localhost this reaches Freshdesk via the Vite proxy (see
    //     vite.config.js). On the DEPLOYED site there is NO Freshdesk proxy —
    //     API_BASE points at the Zoho backend — so DevOps must expose a real
    //     POST /api/tickets that forwards to Freshdesk POST /api/v2/tickets.
    const res = await fetch(ticketsEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `Freshdesk returned ${res.status}`;
      try {
        const j = await res.json();
        if (Array.isArray(j.errors) && j.errors.length) msg = j.errors.map(e => `${e.field}: ${e.message}`).join("; ");
        else if (j.description) msg = j.description;
      } catch { /* keep status message */ }
      throw new Error(msg);
    }
    const created = await res.json();
    const id = created.id;
    const mapped = mapFreshdeskTicket(created);
    _tickets = [mapped, ..._tickets];
    if (_tkCache) _tkCache = [mapped, ..._tkCache];
    pushLog({ type: "ticket_created", actor, module: "Auto Scheduler", detail: `Created Freshdesk ticket #${id} — ${info.society || info.subject}` });
    return id;
  },
};
// Fallback requester for auto-generated tickets (society GS visits have no single
// customer). >>> WIRE: set this to a real Freshdesk contact / ops mailbox.
const FRESHDESK_REQUESTER_EMAIL = "ops@prowater.in";

/* ---- Customer module — real data from Zoho via backend API ---- */
const PLANS = ["Home Monthly", "Home Quarterly", "Home Annual", "Plus Annual"];
const BILLING_CYCLES = ["Monthly", "Quarterly", "Half-yearly", "Annual"];
const CUSTOMER_FIELDS = [
  { key: "email",   label: "Email",         type: "email", roles: ["supervisor", "admin", "devops"] },
  { key: "phone",   label: "Phone",         type: "tel",   roles: ["supervisor", "admin", "devops"] },
  { key: "address", label: "Address",       type: "text",  roles: ["supervisor", "admin", "devops"] },
  { key: "plan",    label: "Plan",          type: "select", options: PLANS,          roles: ["admin", "devops"] },
  { key: "billing", label: "Billing cycle", type: "select", options: BILLING_CYCLES, roles: ["admin", "devops"] },
];

// Fallback seed data — used only if the API is unreachable
const SEED_CUSTOMERS = [
  { id: "CUS-00045", name: "Anis Emmanual", email: "anis@drinkprime.in", phone: "918839452234", address: "MJR Clique Hydra Apartment, Hyderabad", society: "MJR Clique Hydra", plan: "Plus Annual", billing: "Annual", status: "active", zohoId: "ZB-45", purifier_id: "HAC-00045", unused_credits: 1150, since: "2026-07-01" },
  { id: "CUS-00084", name: "harshpvt", email: "harshlokhande486@gmail.com", phone: "917821907069", address: "Ashish JK, Pune", society: "Ashish JK", plan: "Home Quarterly", billing: "Quarterly", status: "active", zohoId: "ZB-84", purifier_id: "OWN-00084", unused_credits: 0, since: "2026-07-02" },
  { id: "CUS-00092", name: "Ravi Kumar", email: "ravi.k@example.com", phone: "", address: "Prestige Lakeside, Bengaluru", society: "Prestige Lakeside", plan: "Plus Half-Yearly", billing: "Half-Yearly", status: "active", zohoId: "ZB-92", purifier_id: "PW-00092", unused_credits: 600, since: "2026-06-10" },
  { id: "CUS-00101", name: "Sneha Patil", email: "sneha.p@example.com", phone: "", address: "Sobha Dream Acres, Bengaluru", society: "Sobha Dream Acres", plan: "Home Quarterly", billing: "Quarterly", status: "active", zohoId: "ZB-101", purifier_id: "PW-00101", unused_credits: 300, since: "2026-06-18" },
  { id: "CUS-00110", name: "Imran Shaikh", email: "imran.s@example.com", phone: "", address: "MJR Clique Hydra, Hyderabad", society: "MJR Clique Hydra", plan: "Home Monthly", billing: "Monthly", status: "active", zohoId: "ZB-110", purifier_id: "", unused_credits: 99, since: "2026-07-03" },
  { id: "CUS-00077", name: "Deepa Nair", email: "deepa.n@example.com", phone: "", address: "Prestige Lakeside, Bengaluru", society: "Prestige Lakeside", plan: "Plus Annual", billing: "Annual", status: "active", zohoId: "ZB-77", purifier_id: "PW-00077", unused_credits: 1200, since: "2026-03-12" },
];
let _customers = [...SEED_CUSTOMERS];

let _custCache = null, _custCacheAt = 0;

// ── Sample-data tracker ────────────────────────────────────────────────────
// When a live endpoint is unreachable the APIs fall back to seed data. We flag
// which sources are on sample data so the UI can warn that numbers aren't live.
const _sampleSources = new Set();
const _sampleListeners = new Set();
function markSample(source, on, meta) {
  const had = _sampleSources.has(source);
  if (on) _sampleSources.add(source); else _sampleSources.delete(source);
  if (had !== on) {
    _sampleListeners.forEach(fn => fn());
    // On transition, open/close the matching API-failure record (§11).
    if (on) recordApiFailure(source, meta); else recordApiRecovery(source);
  }
}
function useSampleData() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    _sampleListeners.add(fn);
    return () => _sampleListeners.delete(fn);
  }, []);
  return Array.from(_sampleSources);
}
// ───────────────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = sessionStorage.getItem("pw_idToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}

const customerApi = {
  getCustomers: async (force = false) => getCached("customers", "customers", "/admin/get-all-customers", async () => {
    const allRaw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-customers?page=${page}&per_page=300`,
      (json) => Array.isArray(json.customers) ? json.customers : (Array.isArray(json.data) ? json.data : []),
    );
    return allRaw.map(c => {
      const p = c.customer_profile || c;
      return {
        id:      p.customer_number  || p.zoho_customer_id || "",
        name:    p.name             || "",
        email:   p.email            || "",
        phone:   p.phone            || "",
        address: p.billing_address?.full_address_string || "",
        society: p.society          || "",
        plan:    p.plan             || "",
        billing: "",
        status:
          p.subscription_status === "live"           ? "active"
          : p.subscription_status === "non_renewing" ? "active"
          : p.subscription_status === "past_due"     ? "paused"
          : p.subscription_status === "none"         ? "inactive"
          : p.subscription_status                    || "inactive",
        zohoId:            p.zoho_customer_id  || "",
        referral_code:     p.referral_code     || "",
        purifier_id:       p.purifier_id       || "",
        total_outstanding: p.total_outstanding || 0,
        unused_credits:    p.unused_credits    || 0,
        // Sign-up / created date — used for month-on-month growth.
        since: p.created_time || p.created_at || p.signup_date || p.customer_created_time || p.since || "",
      };
    });
  }, [..._customers], force),

  // >>> WIRE: PUT /api/customers/:id to persist changes to Zoho Billing.
  updateCustomer: async (actor, id, changes) => {
    await wait(200);
    _customers = _customers.map(c => c.id === id ? { ...c, ...changes } : c);
    if (_memCache.customers?.rows) _memCache.customers.rows = _memCache.customers.rows.map(c => c.id === id ? { ...c, ...changes } : c);
    const fields = Object.keys(changes).join(", ");
    pushLog({ type: "customer_updated", actor, module: "Customer", detail: `Updated ${id} (${fields})` });
  },
};

const refresh = (force = false) => customerApi.getCustomers(force).then(setRows).catch(() => setRows([]));

/* ===========================================================================
   BILLING & SUBSCRIPTION MODULE — real data from Zoho Billing via backend
   Endpoints (admin, Bearer-token auth — same as customers):
     GET /admin/get-all-subscriptions?page=&per_page=
     GET /admin/get-all-invoices?page=&per_page=
   Both are paginated like get-all-customers ({ ..., pagination: { has_more } }).
   The mappers are defensive: Zoho field names vary by org, so we check several
   likely keys and fall back gracefully. Tweak the picks if your payload differs.
   =========================================================================== */

// Normalise a Zoho subscription status → our status chip vocabulary.
function mapSubStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["live", "active"].includes(v)) return "active";
  if (["non_renewing", "non-renewing"].includes(v)) return "active";
  if (["trial", "future"].includes(v)) return "pending";
  if (["past_due", "unpaid", "dunning"].includes(v)) return "paused";
  if (["paused", "on_hold"].includes(v)) return "paused";
  if (["cancelled", "canceled", "expired"].includes(v)) return "failed";
  return v || "inactive";
}

// Normalise a Zoho invoice status → our status chip vocabulary.
function mapInvoiceStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["paid"].includes(v)) return "paid";
  if (["sent", "viewed", "open", "unpaid"].includes(v)) return "pending";
  if (["partially_paid", "partially paid"].includes(v)) return "pending";
  if (["overdue"].includes(v)) return "failed";
  if (["draft"].includes(v)) return "pending";
  if (["void", "voided", "cancelled", "canceled"].includes(v)) return "disabled";
  return v || "pending";
}

const SEED_SUBSCRIPTIONS = [
  { id: "SUB-1001", customerName: "Upendiran S", customerNumber: "3399543000001633014", email: "upendiran.s@gmail.com", phone: "", plan: "ADV_PRABHAVATI_SD_6M", planCode: "ADV_PRA_299_6M_SD", amount: 594, interval: "months", status: "active", nextBilling: "2026-12-20", activatedAt: "2026-06-20", zohoId: "" },
  { id: "SUB-1002", customerName: "Anis Emmanual", customerNumber: "CUS-00045", email: "anis@drinkprime.in", phone: "918839452234", plan: "ADV_PLUS_12M", planCode: "ADV_PLUS_1199_12M", amount: 14400, interval: "months", status: "active", nextBilling: "2027-06-01", activatedAt: "2026-06-15", zohoId: "ZB-45" },
  { id: "SUB-1003", customerName: "Ravi Kumar", customerNumber: "CUS-00092", email: "ravi.k@example.com", phone: "", plan: "ADV_HALF_6M", planCode: "ADV_HALF_599_6M", amount: 3600, interval: "months", status: "active", nextBilling: "2026-12-10", activatedAt: "2026-06-10", zohoId: "ZB-92" },
  { id: "SUB-1004", customerName: "Sneha Patil", customerNumber: "CUS-00101", email: "sneha.p@example.com", phone: "", plan: "ADV_QTR_3M", planCode: "ADV_QTR_399_3M", amount: 1200, interval: "months", status: "active", nextBilling: "2026-09-18", activatedAt: "2026-06-18", zohoId: "ZB-101" },
  { id: "SUB-1005", customerName: "harshpvt", customerNumber: "CUS-00084", email: "harshlokhande486@gmail.com", phone: "917821907069", plan: "Home Monthly", planCode: "HOME_199_1M", amount: 199, interval: "months", status: "paused", nextBilling: "2026-07-05", activatedAt: "2026-06-05", zohoId: "ZB-84" },
  { id: "SUB-1006", customerName: "Deepa Nair", customerNumber: "CUS-00077", email: "deepa.n@example.com", phone: "", plan: "ADV_PLUS_12M", planCode: "ADV_PLUS_1199_12M", amount: 12000, interval: "months", status: "active", nextBilling: "2027-03-12", activatedAt: "2026-03-12", zohoId: "ZB-77" },
];
const SEED_INVOICES = [
  { id: "INV-2001", number: "INV-000045", customerName: "Anis Emmanual", customerNumber: "CUS-00045", email: "anis@drinkprime.in", total: 14400, balance: 0, status: "paid", date: "2026-06-15", dueDate: "2026-06-22", plan: "Plus Annual", interval: "Annual", zohoId: "ZB-45" },
  { id: "INV-2002", number: "INV-000084", customerName: "harshpvt", customerNumber: "CUS-00084", email: "harshlokhande486@gmail.com", total: 2800, balance: 2800, status: "overdue", date: "2026-06-05", dueDate: "2026-06-12", plan: "Home Quarterly", interval: "Quarterly", zohoId: "ZB-84" },
  { id: "INV-2003", number: "INV-000092", customerName: "Ravi Kumar", customerNumber: "CUS-00092", email: "ravi.k@example.com", total: 7200, balance: 0, status: "paid", date: "2026-06-10", dueDate: "2026-06-17", plan: "Plus Half-Yearly", interval: "Half-Yearly", zohoId: "ZB-92" },
  { id: "INV-2004", number: "INV-000101", customerName: "Sneha Patil", customerNumber: "CUS-00101", email: "sneha.p@example.com", total: 4200, balance: 0, status: "paid", date: "2026-06-18", dueDate: "2026-06-25", plan: "Home Quarterly", interval: "Quarterly", zohoId: "ZB-101" },
  { id: "INV-2005", number: "INV-000110", customerName: "Imran Shaikh", customerNumber: "CUS-00110", email: "imran.s@example.com", total: 1200, balance: 0, status: "paid", date: "2026-06-20", dueDate: "2026-06-27", plan: "Home Monthly", interval: "Monthly", zohoId: "ZB-110" },
  { id: "INV-2006", number: "INV-000077", customerName: "Deepa Nair", customerNumber: "CUS-00077", email: "deepa.n@example.com", total: 12000, balance: 0, status: "paid", date: "2026-03-12", dueDate: "2026-03-19", plan: "Plus Annual", interval: "Annual", zohoId: "ZB-77" },
  { id: "INV-2007", number: "INV-000064", customerName: "Mohan Das", customerNumber: "CUS-00064", email: "mohan.d@example.com", total: 1500, balance: 1500, status: "sent", date: "2026-06-08", dueDate: "2026-06-15", plan: "Home Monthly", interval: "Monthly", zohoId: "ZB-64" },
];

function mapSubscription(s) {
  const p = s.subscription_profile || s.subscription || s;
  return {
    id:             p.subscription_number || p.subscription_id || p.zoho_subscription_id || p.id || "",
    customerName:   p.customer_name || p.name || p.display_name || "",
    customerNumber: p.customer_number || p.customer_id || "",
    email:          p.email || p.customer_email || "",
    phone:          p.phone || p.customer_phone || "",
    plan:           p.plan_name || p.plan?.name || p.plan || "",
    planCode:       p.plan_code || p.plan?.plan_code || "",
    amount:         Number(p.amount ?? p.recurring_amount ?? p.sub_total ?? 0) || 0,
    interval:       p.interval_unit || p.billing_interval || p.interval || "",
    intervalCount:  Number(p.interval) || null,   // Zoho: numeric term count (e.g. 6) paired with interval_unit
    intervalUnit:   p.interval_unit || "",
    status:         mapSubStatus(p.status || p.subscription_status),
    rawStatus:      p.status || p.subscription_status || "",
    nextBilling:    p.next_billing_at || p.next_billing_date || p.current_term_ends_at || "",
    activatedAt:    p.activated_at || p.created_at || p.created_time || "",
    zohoId:         p.customer_id || p.zoho_customer_id || p.zoho_subscription_id || "",
    // Join key to customers: invoices/subscriptions expose customer_id, which
    // equals the customer endpoint's zoho_customer_id.
    zohoCustomerId: p.customer_id || p.zoho_customer_id || "",
  };
}

function mapInvoice(iv) {
  const p = iv.invoice_profile || iv.invoice || iv;
  return {
    id:             p.invoice_id || p.invoice_number || p.zoho_invoice_id || p.id || "",
    number:         p.invoice_number || p.number || p.invoice_id || "",
    customerName:   p.customer_name || p.name || "",
    customerNumber: p.customer_number || p.customer_id || "",
    email:          p.email || p.customer_email || "",
    total:          Number(p.total ?? p.amount ?? p.invoice_total ?? 0) || 0,
    balance:        Number(p.balance ?? p.amount_due ?? 0) || 0,
    status:         mapInvoiceStatus(p.status || p.invoice_status),
    rawStatus:      p.status || p.invoice_status || "",
    date:           p.invoice_date || p.date || p.created_at || p.created_time || "",
    dueDate:        p.due_date || p.due_at || "",
    plan:           p.plan_name || p.plan || "",
    interval:       p.interval_unit || p.billing_interval || p.interval || p.plan_interval || "",
    zohoId:         p.customer_id || p.zoho_customer_id || p.zoho_invoice_id || "",
    // Join key to customers: invoice customer_id == customer zoho_customer_id.
    zohoCustomerId: p.customer_id || p.zoho_customer_id || "",
  };
}

// Refundable security deposit, tiered by amount. A plain recharge (≤ ₹1500)
// has no deposit → 0. One rule used everywhere (invoices, reconciliation,
// balance sheet): >4000 → 4000, >2000 → 2000, >1500 → 1500, else 0.
function depositFor(amount) {
  const a = Number(amount) || 0;
  if (a > 4000) return 4000;
  if (a > 2000) return 2000;
  if (a > 1500) return 1500;
  return 0;
}

// Deposit split that also handles the Prabhavati plans (lower deposit tiers).
function depositForPlan(plan, amount) {
  const a = Number(amount) || 0;
  if (/prabhav/i.test(String(plan || ""))) {
    if (a > 4000) return 3000;
    if (a > 2000) return 2000;
    return 0;
  }
  return depositFor(a);
}

/* ---- Plan-term helpers (shared by Billing Analytics, Earned Revenue, Apartment
   Performance). Real plans encode the term in the name/code, e.g.
   ADV_PRABHAVATI_SD_6M / ADV_PRA_299_6M_SD -> 6 months. ---- */
const parseTermToken = (str) => {
  const m = String(str || "").toUpperCase().match(/(\d+)\s*M(?![A-Z])/); // 6M, 12 M, 3M
  if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 36) return n; }
  const y = String(str || "").toUpperCase().match(/(\d+)\s*Y/);          // 1Y
  if (y) return parseInt(y[1], 10) * 12;
  return null;
};
const termFromWord = (interval) => {
  const u = String(interval || "").toLowerCase();
  if (u.includes("year") || u.includes("annual")) return 12;
  if (u.includes("half")) return 6;
  if (u.includes("quarter")) return 3;
  if (u.includes("month")) return null; // "months" is just the unit, not the term
  if (u.includes("week")) return 0.25;
  return null;
};
const monthsBetween = (a, b) => {
  if (!a || !b) return null;
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  const m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  return m >= 1 && m <= 36 ? m : null;
};
const termMonths = (src) => {
  if (src && typeof src === "object") {
    if (src.intervalCount && src.intervalCount >= 1) {
      const unit = String(src.intervalUnit || src.interval || "months").toLowerCase();
      const mult = unit.includes("year") ? 12 : unit.includes("week") ? 0.25 : 1;
      const t = src.intervalCount * mult;
      if (t >= 1 && t <= 36) return t;
    }
    return parseTermToken(src.plan) || parseTermToken(src.planCode)
      || monthsBetween(src.activatedAt, src.nextBilling)
      || termFromWord(src.interval) || 1;
  }
  return termFromWord(src) || 1;
};
const monthlyOf = (s) => (s.amount || 0) / (termMonths(s) || 1);

// Generic paginated fetch for the admin billing endpoints.
async function fetchAllPaged(path, listKeys) {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const res = await fetch(`${API_ORIGIN}${path}?page=${page}&per_page=300`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    const json = await res.json();
    let batch = [];
    for (const k of listKeys) { if (Array.isArray(json[k])) { batch = json[k]; break; } }
    if (!batch.length && Array.isArray(json)) batch = json; // bare array response
    all.push(...batch);
    hasMore = json.pagination?.has_more === true;
    page++;
    if (page > 50) break; // safety cap
  }
  return all;
}

/* ============================================================================
   RATE-LIMIT-HARDENED PARALLEL PAGINATION (v1.8.6)
   Fetch page 1, and if the response carries a `total`, fetch pages 2..N in
   BOUNDED concurrent batches (default 4) — fast without hammering Zoho into a
   429. Each page retries on 429 (Retry-After / exponential backoff); a 500 is
   NOT retried (it's a hard Zoho error). Falls back to sequential has_more paging
   when no total is known.
   ============================================================================ */
// ── GLOBAL Zoho request gate ────────────────────────────────────────────────
// Every paginated Zoho fetch funnels through fetchPage. This gate caps how many
// run CONCURRENTLY across ALL endpoints (customers+subs+invoices+leads together)
// and enforces a minimum gap between request starts, so even a cold load can't
// burst into Zoho's per-second/per-minute rate limit.
const ZOHO_MAX_CONCURRENT = 2;   // never more than 2 Zoho requests in flight at once
const ZOHO_MIN_GAP_MS = 150;     // and space their starts ~150ms apart
let _zohoActive = 0;
let _zohoNextAt = 0;
const _zohoQueue = [];
function _zohoAcquire() {
  return new Promise(resolve => {
    const attempt = () => {
      if (_zohoActive < ZOHO_MAX_CONCURRENT) {
        _zohoActive++;
        const now = Date.now();
        const wait = Math.max(0, _zohoNextAt - now);
        _zohoNextAt = Math.max(now, _zohoNextAt) + ZOHO_MIN_GAP_MS;
        setTimeout(resolve, wait);
      } else {
        _zohoQueue.push(attempt);
      }
    };
    attempt();
  });
}
function _zohoRelease() {
  _zohoActive = Math.max(0, _zohoActive - 1);
  const next = _zohoQueue.shift();
  if (next) next();
}

async function fetchPage(url) {
  for (let attempt = 0; ; attempt++) {
    await _zohoAcquire();
    let res;
    try { res = await fetch(url, { headers: authHeaders() }); }
    finally { _zohoRelease(); }
    if (res.status === 429) {
      if (attempt >= 5) throw new Error(`429: too many requests`);
      const ra = Number(res.headers.get("Retry-After"));
      const backoff = ra ? ra * 1000 : Math.min(8000, 600 * 2 ** attempt) + Math.floor(Math.random() * 300);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }
    if (!res.ok) {
      let msg = "";
      try { const j = await res.json(); msg = j.message || j.error || j.detail || JSON.stringify(j); }
      catch { try { msg = await res.text(); } catch { /* ignore */ } }
      throw new Error(`${res.status}: ${String(msg).slice(0, 200)}`);   // no retry on 500 etc.
    }
    return res.json();
  }
}

async function fetchAllPagesFast(urlFor, pickRows, { maxPages = 60, concurrency = 2 } = {}) {
  const first = await fetchPage(urlFor(1));
  const rows = pickRows(first) || [];
  const total = Number(first.total ?? first.pagination?.total ?? first.info?.count);
  const perPage = rows.length || 1;
  if (Number.isFinite(total) && total > rows.length) {
    const pages = Math.min(maxPages, Math.ceil(total / perPage));
    for (let p = 2; p <= pages; p += concurrency) {
      const batch = [];
      for (let i = p; i < p + concurrency && i <= pages; i++) batch.push(fetchPage(urlFor(i)).then(pickRows));
      const results = await Promise.all(batch);
      results.forEach(r => rows.push(...(r || [])));
    }
    return rows;
  }
  // Sequential fallback via has_more / more_records when total isn't provided.
  let hasMore = first.pagination?.has_more === true || first.info?.more_records === true;
  let page = 2;
  while (hasMore && page <= maxPages) {
    const json = await fetchPage(urlFor(page));
    rows.push(...(pickRows(json) || []));
    hasMore = json.pagination?.has_more === true || json.info?.more_records === true;
    page++;
  }
  return rows;
}

let _subCache = null, _subCacheAt = 0;
let _invCache = null, _invCacheAt = 0;
const BILL_CACHE_MS = 5 * 60 * 1000;

const billingApi = {
  getSubscriptions: async (force = false) => getCached("subscriptions", "subscriptions", "/admin/get-all-subscriptions", async () => {
    const raw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-subscriptions?page=${page}&per_page=300`,
      (json) => json.subscriptions || json.data || (Array.isArray(json) ? json : []),
    );
    return raw.map(r => r.customerName ? r : mapSubscription(r));
  }, [...SEED_SUBSCRIPTIONS], force),
  getInvoices: async (force = false) => getCached("invoices", "invoices", "/admin/get-all-invoices", async () => {
    const raw = await fetchAllPagesFast(
      (page) => `${API_ORIGIN}/admin/get-all-invoices?page=${page}&per_page=300`,
      (json) => json.invoices || json.data || (Array.isArray(json) ? json : []),
    );
    return raw.map(r => r.number ? r : mapInvoice(r));
  }, [...SEED_INVOICES], force),
  forceRefresh: async () => {
    _memCache.subscriptions = null; _memCache.invoices = null; _inflight.subscriptions = null; _inflight.invoices = null;
    await Promise.all([billingApi.getSubscriptions(true), billingApi.getInvoices(true)]);
  },
};


const seedUsers = [
  { id: "s1ROXksmBYS6nAmo8h3rPssirHY2", name: "Anis", username: "anis", email: "harshlokhande486@gmail.com", role: "admin", active: true, created: "2025-09-01T09:00:00Z", access: allAccess("admin") },
];

const EXISTING_CREDIT = 2; // existing customer → 2 months free
const NEW_CREDIT = 1;      // new customer → 1 month free
const freeLabel = (n) => `${n} FREE`; // e.g. "2 FREE" = 2 months free

// Generic CSV export: columns = [{ label, get(row) }], rows = array.
function exportToCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => esc(c.label)).join(",");
  const body = rows.map(r => columns.map(c => esc(c.get(r))).join(",")).join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const EMAIL_DOMAIN = "@prowater.in"; // fixed login domain

/* ---------- Persistent store (localStorage, survives reloads on this device) ----------
   NOTE: In a preview/sandbox, localStorage may be unavailable and these fall back to
   in-memory. In your real Vite app on localhost it persists across reloads.
   For true cross-device/cross-user history, these move to your backend (Firestore). */
const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  },
};

let _users = LS.get("pw_users", null) || [...seedUsers];
// Logs epoch: if the stored epoch differs from this build's, wipe the log ONCE
// (start fresh) so stale pre-fix rows don't linger. Bump LOGS_EPOCH to clear.
const LOGS_EPOCH = "2026-07-06";
if (LS.get("pw_logs_epoch", null) !== LOGS_EPOCH) { LS.set("pw_logs", []); LS.set("pw_logs_epoch", LOGS_EPOCH); }
let _logs = LS.get("pw_logs", null) || [];           // persisted; never auto-cleared
let _photos = LS.get("pw_photos", null) || {};       // { username: dataURL }
let _creditOverrides = {};   // session-only (would be backend-backed in prod)
let _manualCredits = [];     // session-only
let _undoStack = [];         // session-only (Backtrack)
let _otpStore = {};          // { username: { otp, expires } } — simulated OTP codes
const _emptySession = { ip: "—", network: "—", city: "", country: "", lat: null, lon: null, source: "", accuracy: null };
// Persist the session (IP/network/geo) so token-restored reloads keep real IP
// on their logs instead of "—". Cleared on logout.
let _session = LS.get("pw_session", null) || { ..._emptySession };
let _currentModule = "—"; // set when a user enters a module; recorded on every log

const saveUsers = () => LS.set("pw_users", _users);
const saveLogs = () => LS.set("pw_logs", _logs);
const savePhotos = () => LS.set("pw_photos", _photos);
const saveSession = () => LS.set("pw_session", _session);

function pushLog(entry) {
  const { ip, network, city, country, lat, lon, source, accuracy, module, ...rest } = entry;
  _logs = [{
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    version: APP_VERSION,
    module: module || _currentModule || "—",
    ip: ip || _session.ip || "—",
    network: network || _session.network || "—",
    city: city || _session.city || "",
    country: country || _session.country || "",
    lat: lat ?? _session.lat ?? null,
    lon: lon ?? _session.lon ?? null,
    source: source || _session.source || "",
    accuracy: accuracy ?? _session.accuracy ?? null,
    ...rest,
  }, ..._logs];
  saveLogs(); // persist every log so history is kept from day 1
}

/* ============================================================================
   PERSISTENT CACHES + RATE-LIMIT COOLDOWN (v1.9.5)
   Zoho re-queries per request and rate-limits (429 / 500). We keep the last good
   rows in localStorage (pw_cache_*) so a reload — or a rate-limited fetch — can
   serve real data instead of failing. Defined AFTER LS so it can use it.
   ============================================================================ */
// Long windows so a normal work session never auto-refetches (use the Refresh
// button for a manual, forced update). Trades a little staleness for zero rate-limit risk.
const PERSIST_TTL = { customers: 3 * 60 * 60 * 1000, subscriptions: 3 * 60 * 60 * 1000, invoices: 3 * 60 * 60 * 1000, leads: 60 * 60 * 1000 };
const _memCache = {};    // { key: { rows, at } } — session mirror of the persisted cache
const _inflight = {};    // { key: Promise } — in-flight dedup (_custInflight/_subInflight/…)

function loadPersistedRows(key) {
  const o = LS.get("pw_cache_" + key, null);
  return o && Array.isArray(o.rows) ? o : null;
}
function savePersistedRows(key, rows) {
  // Strip any heavy _raw payload defensively so the cache stays small enough for
  // localStorage — a silent quota failure here means every reload refetches Zoho.
  const slim = rows.map(r => (r && r._raw !== undefined) ? (({ _raw, ...rest }) => rest)(r) : r);
  const ok = LS.set("pw_cache_" + key, { rows: slim, at: Date.now() });
  if (!ok) console.warn(`[cache] pw_cache_${key} too big to persist — will refetch on reload`);
  return ok;
}

// Matches Zoho's rate-limit signals, incl. code 45 ("exceeded the maximum call
// rate limit of 1,000") which the backend returns as a 500 body.
const isRateLimit = (msg) => /429|rate limit|too many request|exceeded the maximum call|"code"\s*:\s*45\b/i.test(String(msg || ""));
let _rateLimitedUntil = 0;                                   // shared cooldown across all sources
const inRateLimitCooldown = () => Date.now() < _rateLimitedUntil;

// Shared cache wrapper for the four heavy Zoho lists (customers/subs/invoices/leads).
//  • in-flight dedup   • persisted seed   • TTL freshness   • cooldown-serve
//  • on failure: serve cache if we have it (no sample); else fall back to seed + sample.
async function getCached(key, source, endpoint, doFetch, fallback, force = false) {
  if (_inflight[key]) return _inflight[key];
  if (!_memCache[key]) { const p = loadPersistedRows(key); if (p) _memCache[key] = p; }
  const cached = _memCache[key];
  const ttl = PERSIST_TTL[key] || 5 * 60 * 1000;
  // During a rate-limit cooldown, serve cached rows immediately if we have them.
  if (!force && inRateLimitCooldown() && cached?.rows?.length) return cached.rows;
  // Fresh enough → serve without hitting the network.
  if (!force && cached && (Date.now() - cached.at) < ttl && cached.rows?.length) return cached.rows;

  const promise = (async () => {
    try {
      const rows = await doFetch();
      if (!rows.length) throw new Error("empty");
      _memCache[key] = { rows, at: Date.now() };
      savePersistedRows(key, rows);
      markSample(source, false);
      return rows;
    } catch (e) {
      if (isRateLimit(e.message)) _rateLimitedUntil = Date.now() + 5 * 60 * 1000; // back off 5 min on a Zoho rate-limit
      if (cached?.rows?.length) { markSample(source, false); return cached.rows; }  // serve stale, don't flag sample
      markSample(source, true, { endpoint, reason: e.message });
      return fallback;
    } finally { _inflight[key] = null; }
  })();
  _inflight[key] = promise;
  return promise;
}

/* ============================================================================
   API FAILURE TRACKING (v1.8.0) — records outages, powers the Failures tab +
   Server Down popup + email alerts. Defined AFTER LS + pushLog.
   NOTE: autoscheduler is intentionally NOT a monitored source (it's local-first).
   ============================================================================ */
const MODULE_SOURCES = {
  customer: ["customers"],
  billing: ["subscriptions", "invoices"],
  sales: ["leads"],
  analytics: ["customers", "subscriptions", "invoices", "leads"],
};
const FAILURE_ALERT_TO = ["anis@drinkprime.in", "harsh@soroai.com"];

let _failures = LS.get("pw_failures", null) || [];
// Close any failure left open by a previous session (we can't track across reloads).
_failures = _failures.map(f => f.endedAt ? f : { ...f, endedAt: f.startedAt, downtimeMs: 0 });
const saveFailures = () => LS.set("pw_failures", _failures);
const _failureListeners = new Set();
const _notifyFailureListeners = () => _failureListeners.forEach(fn => fn());

function useFailures() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    _failureListeners.add(fn);
    return () => _failureListeners.delete(fn);
  }, []);
  return _failures;
}
// A source is "down" if it has an open (unresolved) failure.
const failingSourcesNow = () => _failures.filter(f => !f.endedAt).map(f => f.source);

function recordApiFailure(source, meta) {
  if (_failures.some(f => f.source === source && !f.endedAt)) return; // one open per source
  const rec = { id: crypto.randomUUID(), source, endpoint: meta?.endpoint || "", reason: meta?.reason || "", startedAt: new Date().toISOString(), endedAt: null, downtimeMs: null };
  _failures = [rec, ..._failures];
  saveFailures();
  pushLog({ type: "api_failure", actor: "system", module: "Logs Tracker", detail: `${source} unreachable — ${rec.reason || rec.endpoint || "error"}` });
  notifyFailureEmail(rec);
  _notifyFailureListeners();
}
function recordApiRecovery(source) {
  const rec = _failures.find(f => f.source === source && !f.endedAt);
  if (!rec) return;
  rec.endedAt = new Date().toISOString();
  rec.downtimeMs = new Date(rec.endedAt).getTime() - new Date(rec.startedAt).getTime();
  saveFailures();
  pushLog({ type: "api_recovery", actor: "system", module: "Logs Tracker", detail: `${source} recovered after ${fmtDowntime(rec.downtimeMs)}` });
  _notifyFailureListeners();
}
// >>> WIRE: needs a backend route POST /admin/notify-failure that emails FAILURE_ALERT_TO.
async function notifyFailureEmail(rec) {
  try {
    await fetch(`${API_ORIGIN}/admin/notify-failure`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ to: FAILURE_ALERT_TO, source: rec.source, endpoint: rec.endpoint, reason: rec.reason, startedAt: rec.startedAt }),
    });
  } catch { /* best-effort; route may not exist yet */ }
}
function fmtDowntime(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60), min = m % 60;
  return `${h}h ${min}m`;
}

// >>> WIRE: In production the BACKEND should record the real client IP + network from the request
// (e.g. req.headers['x-forwarded-for'] and a GeoIP lookup). This browser-side lookup is a stand-in.
//
// IP geolocation only resolves to the ISP's *registered* city — e.g. it reports
// "Bengaluru" for connections backhauled through a metro POP even when the user
// is elsewhere (Andaman & Nicobar, etc.). So we prefer the browser's GPS/Wi-Fi
// location when the user consents, and fall back to the (approximate) IP city.

// IP address + ISP/network + coarse (ISP-registered) location.
async function getIpNetwork() {
  try {
    const r = await fetch("https://ipapi.co/json/");
    const j = await r.json();
    return {
      ip: j.ip || "—",
      network: j.org || j.asn || "—",
      city: [j.city, j.region].filter(Boolean).join(", "),
      country: j.country_name || "",
      lat: j.latitude ?? null,
      lon: j.longitude ?? null,
    };
  } catch {
    // Fallback: at least get the IP if the richer lookup is blocked.
    try {
      const r2 = await fetch("https://api.ipify.org?format=json");
      const j2 = await r2.json();
      return { ip: j2.ip || "—", network: "—", city: "", country: "", lat: null, lon: null };
    } catch { return { ip: "—", network: "—", city: "", country: "", lat: null, lon: null }; }
  }
}

// Accurate physical location via the browser Geolocation API (needs user consent
// + HTTPS). Resolves null if unsupported, denied, or it takes too long — never
// throws, so it can't block login.
function getGpsCoords(timeout = 6000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 5 * 60 * 1000 }
    );
  });
}

// Turn GPS coordinates into a city/region name (BigDataCloud — no API key needed).
async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const j = await r.json();
    const city = [j.city || j.locality, j.principalSubdivision].filter(Boolean).join(", ");
    return { city, country: j.countryName || "" };
  } catch { return null; }
}

// Hybrid: always capture IP + ISP; upgrade location to GPS when the user allows.
// `source` records which one we used so the audit log can flag "approximate".
async function getClientNetwork() {
  const [ipData, coords] = await Promise.all([getIpNetwork(), getGpsCoords()]);
  if (coords && coords.latitude != null) {
    const geo = await reverseGeocode(coords.latitude, coords.longitude);
    return {
      ...ipData,
      lat: coords.latitude,
      lon: coords.longitude,
      city: (geo && geo.city) || ipData.city,
      country: (geo && geo.country) || ipData.country,
      accuracy: coords.accuracy != null ? Math.round(coords.accuracy) : null,
      source: "gps",
    };
  }
  return { ...ipData, source: "ip", accuracy: null };
}

/* ============================================================================
   REAL DATA LAYER — ProWater Referral API
   The admin endpoint returns all referrers with nested referees in one call.
   We fetch once, cache briefly, and transform into the shapes the UI expects.
   ============================================================================ */
// On localhost we go through Vite's dev proxy (API_BASE empty → "/api/..."), which
// avoids browser CORS during development. On the deployed site there's no proxy, so
// we call the real API directly — this REQUIRES the API to send CORS headers
// (Access-Control-Allow-Origin) for the deployed origin. See deploy notes.
const IS_LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const API_ORIGIN = "https://api-7ca73ntgua-el.a.run.app";
const API_BASE = IS_LOCAL ? "" : API_ORIGIN;

let _apiCache = null;
let _apiCacheAt = 0;
const CACHE_MS = 30 * 1000;

async function fetchAllReferrals(force = false) {
  const now = Date.now();
  if (!force && _apiCache && (now - _apiCacheAt) < CACHE_MS) return _apiCache;
  const res = await fetch(`${API_BASE}/api/admin/all-referrals`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  if (!json || json.success !== true || !Array.isArray(json.data)) throw new Error("Unexpected API response");
  _apiCache = json;
  _apiCacheAt = now;
  return json;
}

function parseApiDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toReferrers(json) {
  return json.data.map((row, i) => {
    const r = row.referrer || {};
    return {
      id: row.referral_lead_id || `ref-${i}`,
      name: r.customer_name || "—",
      email: r.customer_email || "—",
      phone: r.customer_phone || "—",
      code: r.customer_key || r.customer_number || "—",
      society: r.society_name || "",
      customerNumber: r.customer_number || "",
      purifierId: r.purifier_id || "",
      zohoId: r.zoho_customer_id || "",
      joined: row.created_at || "",
      totalReferred: row.total_referrals ?? (row.referees?.length || 0),
      converted: row.total_converted ?? 0,
      pending: row.total_pending ?? 0,
      freeMonthsEarned: row.referrer_free_months ?? 0,
      status: "active",
    };
  });
}

function toReferees(json) {
  const out = [];
  json.data.forEach((row, i) => {
    const referrerId = row.referral_lead_id || `ref-${i}`;
    (row.referees || []).forEach((e, j) => {
      out.push({
        id: `${referrerId}-${j}`,
        referrerId,
        name: e.name || "—",
        email: e.email || "—",
        phone: e.phone || "—",
        flat: e.flat_number || "",
        society: e.society_name || "",
        status: e.status === "converted" ? "paid" : (e.status || "pending"),
        rawStatus: e.status || "",
        refereeFreeMonths: e.referee_free_months ?? 0,
        referrerGetsFreeMonths: e.referrer_gets_free_months ?? 0,
        date: e.referral_timestamp || "",
        convertedAt: e.converted_at || "",
        invoice: e.flat_number ? `Flat ${e.flat_number}` : "—",
        plan: e.society_name || "—",
        amount: 0,
        reward: e.referrer_gets_free_months ?? 0,
      });
    });
  });
  return out;
}

function toCredits(json) {
  const out = [];
  json.data.forEach((row, i) => {
    const referrerId = row.referral_lead_id || `ref-${i}`;
    (row.referees || []).forEach((e, j) => {
      const months = e.referrer_gets_free_months ?? 0;
      out.push({
        id: `${referrerId}-${j}`,
        referrerId,
        refereeName: e.name || "—",
        invoice: e.flat_number ? `Flat ${e.flat_number}` : "—",
        type: months >= 2 ? "existing" : "new",
        credits: months || (e.status === "converted" ? EXISTING_CREDIT : NEW_CREDIT),
        status: e.status === "converted" ? "approved" : "pending",
        date: e.referral_timestamp || "",
      });
    });
  });
  return out;
}

function toTrend(json) {
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const buckets = {};
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}`;
  const ensure = (d) => {
    const k = key(d);
    buckets[k] = buckets[k] || { y: d.getFullYear(), m: d.getMonth(), referrals: 0, conversions: 0, rewards: 0 };
    return buckets[k];
  };
  json.data.forEach(row => {
    // Count referrals & conversions per referee (by their dates).
    let latestConv = null;
    (row.referees || []).forEach(e => {
      const made = parseApiDate(e.referral_timestamp);
      const conv = parseApiDate(e.converted_at);
      if (made) ensure(made).referrals += 1;
      if (conv) {
        ensure(conv).conversions += 1;
        if (!latestConv || conv > latestConv) latestConv = conv;
      }
    });
    // Attribute this referrer's TOTAL free months (source of truth) to the month
    // of their most recent conversion, so the chart total matches the KPI card.
    const months = row.referrer_free_months ?? 0;
    if (months > 0) {
      const when = latestConv || parseApiDate(row.updated_at) || parseApiDate(row.created_at);
      if (when) ensure(when).rewards += months;
    }
  });
  const arr = Object.values(buckets).sort((a, b) => (a.y - b.y) || (a.m - b.m));
  if (arr.length === 0) {
    const now = new Date();
    return [{ month: MON[now.getMonth()], year: now.getFullYear(), label: `${MON[now.getMonth()]} ${now.getFullYear()}`, referrals: 0, conversions: 0, rewards: 0 }];
  }
  return arr.map(b => ({ month: MON[b.m], year: b.y, label: `${MON[b.m]} ${b.y}`, referrals: b.referrals, conversions: b.conversions, rewards: b.rewards }));
}

/* ---------- API (real data + local user/log management) ---------- */
const api = {
  // >>> WIRE: replace with Firebase Auth / your auth endpoint
login: async (username, password) => {
  const net = await getClientNetwork();
  const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
  const email = username.includes("@") ? username : `${username}@prowater.in`;

  let firebaseRes;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }) }
    );
    firebaseRes = await res.json();
  } catch {
    throw new Error("Network error. Check your connection.");
  }

  if (firebaseRes.error) {
    _session = net;
    pushLog({ type: "login_failed", actor: username, detail: "Invalid credentials" });
    _session = { ..._emptySession }; saveSession();
    throw new Error("Invalid username or password.");
  }

  // Firebase verified ✅ — Firebase does the password auth; the Employee module
  // supplies profile/role/access. Match the verified email → an Employee user (§13).
  const emp = _users.find(u => norm(u.email) === norm(firebaseRes.email));
  if (emp && emp.active === false) {
    _session = net;
    pushLog({ type: "login_failed", actor: emp.username, detail: "Account disabled" });
    _session = { ..._emptySession }; saveSession();
    throw new Error("Your account has been disabled. Contact an admin.");
  }

  _session = net; saveSession();
  sessionStorage.setItem("pw_idToken", firebaseRes.idToken);
  sessionStorage.setItem("pw_tokenExpiry", Date.now() + 55 * 60 * 1000);

  if (emp) {
    pushLog({ type: "login_success", actor: emp.username, detail: `Signed in as ${emp.role} (${emp.username})` });
    const { password, ...rest } = emp;                    // never carry the password into the session
    return { ...rest, id: firebaseRes.localId, email: firebaseRes.email };
  }

  // No Employee record → default admin identity (username derived from the email).
  pushLog({ type: "login_success", actor: firebaseRes.email, detail: "Admin signed in via Firebase" });
  return {
    id: firebaseRes.localId,
    name: firebaseRes.email.split("@")[0],
    username: email.split("@")[0],
    email: firebaseRes.email,
    role: "admin",
    active: true,
    access: allAccess("admin"),
  };
},
logout: async (username) => {
  sessionStorage.removeItem("pw_idToken");
  sessionStorage.removeItem("pw_tokenExpiry");
  pushLog({ type: "logout", actor: username, detail: "Signed out" });
  _session = { ..._emptySession }; saveSession();
},
// Repopulate _session (IP/network/geo) for token-restored reloads whose session
// was lost — so their logs record a real IP instead of "—" (§5).
ensureSession: async () => {
  if (_session && _session.ip && _session.ip !== "—") return;
  try { const net = await getClientNetwork(); _session = net; saveSession(); } catch { /* ignore */ }
},
// Clear the audit log (admin action, from the Logs toolbar).
clearLogs: (actor) => {
  _logs = [];
  saveLogs();
  pushLog({ type: "logs_cleared", actor, module: "Logs Tracker", detail: "Cleared all logs" });
},
  // Real data from the ProWater admin API (referrers + nested referees).
  getReferrers: async () => { const j = await fetchAllReferrals(); return toReferrers(j); },
  getReferees: async () => { const j = await fetchAllReferrals(); return toReferees(j); },
  getTrend: async () => { const j = await fetchAllReferrals(); return toTrend(j); },
  forceRefresh: async () => { await fetchAllReferrals(true); }, // bypass cache
  getCredits: async () => {
    const j = await fetchAllReferrals();
    const base = toCredits(j);
    // Apply admin actions made in this session (approve/reject), plus any manual additions.
    const merged = base.map(c => _creditOverrides[c.id] ? { ...c, status: _creditOverrides[c.id] } : c);
    return [..._manualCredits, ...merged];
  },
  addManualCredit: async (actor, data) => {
    await wait(320);
    const c = { id: "manual-" + crypto.randomUUID(), status: "approved", date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), manual: true, ...data };
    _manualCredits = [c, ..._manualCredits];
    // >>> WIRE: POST this manual credit to your backend / Zoho here
    pushLog({ type: "credit_manual", actor, detail: `Added ${data.credits} free month(s) for ${data.refereeName} (${data.invoice || "no invoice"})` });
    _undoStack = [{ id: crypto.randomUUID(), ts: new Date().toISOString(), actor, kind: "add_manual",
      label: `Added manual credit · ${data.refereeName} (${data.credits} free months)`,
      restore: () => { _manualCredits = _manualCredits.filter(x => x.id !== c.id); } }, ..._undoStack];
    return c;
  },
  approveCredit: async (actor, creditId) => {
    await wait(200);
    const prev = _creditOverrides[creditId] ?? null; // remember prior state
    _creditOverrides[creditId] = "approved";
    // >>> WIRE: POST approval to your backend so the free months are granted in Zoho
    pushLog({ type: "credit_approved", actor, detail: `Approved free months (credit ${creditId})` });
    _undoStack = [{ id: crypto.randomUUID(), ts: new Date().toISOString(), actor, kind: "approve",
      label: `Approved credit ${creditId}`,
      restore: () => { if (prev === null) delete _creditOverrides[creditId]; else _creditOverrides[creditId] = prev; } }, ..._undoStack];
  },
  rejectCredit: async (actor, creditId) => {
    await wait(200);
    const prev = _creditOverrides[creditId] ?? null;
    _creditOverrides[creditId] = "rejected";
    // >>> WIRE: POST rejection to your backend
    pushLog({ type: "credit_rejected", actor, detail: `Rejected free months (credit ${creditId})` });
    _undoStack = [{ id: crypto.randomUUID(), ts: new Date().toISOString(), actor, kind: "reject",
      label: `Rejected credit ${creditId}`,
      restore: () => { if (prev === null) delete _creditOverrides[creditId]; else _creditOverrides[creditId] = prev; } }, ..._undoStack];
  },

  // Backtrack — list reversible actions and revert them.
  getUndoable: async () => { await wait(120); return _undoStack.map(({ id, ts, actor, kind, label }) => ({ id, ts, actor, kind, label })); },
  revertAction: async (actor, undoId) => {
    await wait(200);
    const entry = _undoStack.find(u => u.id === undoId);
    if (!entry) return;
    entry.restore();                                  // undo the change
    _undoStack = _undoStack.filter(u => u.id !== undoId); // remove from stack
    // >>> WIRE: POST the reversal to your backend so it's reflected in Zoho too
    pushLog({ type: "reverted", actor, detail: `Reverted: ${entry.label}` });
  },

  // user management (admin)
  getUsers: async () => { await wait(200); return _users.map(u => ({ ...u, password: undefined, photo: _photos[u.username] || null })); },
  createUser: async (actor, data) => {
    await wait(350);
    if (_users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) throw new Error("A user with that username already exists.");
    const u = { id: crypto.randomUUID(), active: true, created: new Date().toISOString(), ...data };
    _users = [..._users, u];
    saveUsers();
    pushLog({ type: "user_created", actor, detail: `Created ${data.role} ${data.username}` });
    return { ...u, password: undefined };
  },
  resetPassword: async (actor, userId, newPw) => {
    await wait(300);
    _users = _users.map(u => u.id === userId ? { ...u, password: newPw } : u);
    saveUsers();
    const t = _users.find(u => u.id === userId);
    pushLog({ type: "password_reset", actor, detail: `Reset password for ${t?.username}` });
  },
  toggleUser: async (actor, userId) => {
    await wait(250);
    _users = _users.map(u => u.id === userId ? { ...u, active: !u.active } : u);
    saveUsers();
    const t = _users.find(u => u.id === userId);
    pushLog({ type: "user_toggled", actor, detail: `${t?.active ? "Enabled" : "Disabled"} ${t?.username}` });
    return t?.active;
  },
  deleteUser: async (actor, userId) => {
    await wait(250);
    const t = _users.find(u => u.id === userId);
    _users = _users.filter(u => u.id !== userId);
    saveUsers();
    pushLog({ type: "user_deleted", actor, detail: `Removed ${t?.username}` });
  },

  // Profile photo (stored as a data URL in browser storage).
  getPhoto: (username) => _photos[username] || null,
  savePhoto: async (username, dataUrl) => {
    await wait(150);
    _photos = { ..._photos, [username]: dataUrl };
    savePhotos();
    pushLog({ type: "photo_updated", actor: username, detail: "Updated profile photo" });
  },

  // Forgot-password OTP flow (SIMULATED — real email needs a backend mail service).
  // >>> WIRE: replace with POST /api/auth/request-otp that emails a real code.
  requestOtp: async (username) => {
    await wait(300);
    const key = String(username || "").trim().toLowerCase();
    const u = _users.find(x => x.username.toLowerCase() === key);
    if (!u) throw new Error("No account found with that ID.");
    const otp = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
    _otpStore[key] = { otp, expires: Date.now() + 5 * 60 * 1000 };
    pushLog({ type: "otp_requested", actor: u.username, detail: `Password reset OTP requested (${u.username}${EMAIL_DOMAIN})` });
    return otp; // returned only because we simulate on-screen; a real backend would NOT return it
  },
  // >>> WIRE: replace with POST /api/auth/verify-otp + reset.
  resetPasswordWithOtp: async (username, otp, newPw) => {
    await wait(300);
    const key = username.toLowerCase();
    const rec = _otpStore[key];
    if (!rec) throw new Error("Request a new code.");
    if (Date.now() > rec.expires) { delete _otpStore[key]; throw new Error("That code has expired. Request a new one."); }
    if (rec.otp !== String(otp).trim()) throw new Error("Incorrect code. Try again.");
    _users = _users.map(u => u.username.toLowerCase() === key ? { ...u, password: newPw } : u);
    saveUsers();
    delete _otpStore[key];
    pushLog({ type: "password_reset", actor: username, detail: "Password reset via email OTP" });
  },

  getLogs: async () => { await wait(150); return [..._logs]; },
  // List of active usernames for the login dropdown.
  getUsernames: async () => { await wait(120); return _users.filter(u => u.active).map(u => u.username); },
  // Page views are intentionally NOT logged — only real activity (logins, logouts, user/password changes).
  logView: (_actor, _detail) => {},
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ===========================================================================
   App shell
   =========================================================================== */
const Auth = createContext(null);
const useAuth = () => useContext(Auth);

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const expiry = Number(sessionStorage.getItem("pw_tokenExpiry"));
      const saved = sessionStorage.getItem("pw_user");
      if (saved && expiry && Date.now() < expiry) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  });
  const [activeModule, setActiveModule] = useState(null);
  const [sessionWarning, setSessionWarning] = useState(false);

  const onSetUser = (u) => {
    setUser(u);
    setActiveModule(null);
    if (u) sessionStorage.setItem("pw_user", JSON.stringify(u));
    else {
      sessionStorage.removeItem("pw_user");
      sessionStorage.removeItem("pw_idToken");
      sessionStorage.removeItem("pw_tokenExpiry");
    }
  };

  // ── Auto-logout when Firebase token expires ──────────────────────────────
  useEffect(() => {
    if (!user) { setSessionWarning(false); return; }

    const expiry = Number(sessionStorage.getItem("pw_tokenExpiry"));
    const msLeft = expiry - Date.now();
    if (msLeft <= 0) { onSetUser(null); return; }

    const warnMs = msLeft - 5 * 60 * 1000;
    const warnTimer = warnMs > 0 ? setTimeout(() => setSessionWarning(true), warnMs) : null;

    const logoutTimer = setTimeout(() => {
      api.logout(user.username);
      onSetUser(null);
    }, msLeft);

    return () => { clearTimeout(logoutTimer); if (warnTimer) clearTimeout(warnTimer); };
  }, [user]);
  // ─────────────────────────────────────────────────────────────────────────

  // On login (or token-restored reload): just repopulate the session IP.
  // NOTE: we deliberately do NOT eagerly prefetch customers/subs/invoices/leads
  // here — that fired 4 full Zoho pulls even for modules the user never opened,
  // burning the org's shared Zoho rate limit. Each module fetches (and caches)
  // its own data on demand instead.
  useEffect(() => {
    if (!user) return;
    api.ensureSession();
  }, [user]);

  return (
    <div className="pw-root">
      <style>{TOKENS}</style>
      <Auth.Provider value={{ user, setUser: onSetUser, activeModule, setActiveModule }}>
        {sessionWarning && user && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            background: "#9a6a16", color: "#fff",
            padding: "10px 20px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 12, fontSize: 13.5, fontWeight: 500
          }}>
            <Clock size={16} />
            Your session expires in 5 minutes. Please save your work.
            <button
              onClick={() => setSessionWarning(false)}
              style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
            >
              Dismiss
            </button>
          </div>
        )}
        {!user ? <Login />
          : activeModule ? <Shell module={activeModule} onHome={() => setActiveModule(null)} />
          : <Home onPick={setActiveModule} />}
      </Auth.Provider>
    </div>
  );
}

/* ---------- Module icon resolver ---------- */
const MODULE_ICONS = { Briefcase, Receipt, Boxes, Wrench, GitBranch, BarChart3, UserCog, ScrollText, Ticket, UserRound, Cpu, Landmark, CalendarClock, Repeat, Info };

/* ---------- Home (module launcher) ---------- */
function Home({ onPick }) {
  const { user, setUser } = useAuth();
  // Fallback: legacy users (created before module access existed) — admins see all, others see referral.
  const access = user.access || (user.role === "admin" ? allAccess("admin") : { referral: "view", analytics: "view" });
  // Modules this user can see (access !== "none").
  const visible = MODULES.filter(m => (access[m.id] || "none") !== "none");

  return (
    <div style={{ minHeight: "100vh", background: "var(--mint)", display: "grid", gridTemplateColumns: "248px 1fr" }} className="home-grid">
      <style>{`
        .pw-modcard:hover{transform:translateY(-3px);box-shadow:0 14px 30px -16px rgba(13,40,24,.4)}
        .home-side-link:hover{background:rgba(255,255,255,.07)}
        @media(max-width:820px){.home-grid{grid-template-columns:1fr!important}.home-side{display:none!important}}
      `}</style>

      {/* Left sidebar menu */}
      <aside className="home-side" style={{ background: "var(--forest)", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 18px" }}>
          <Drop />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>ProWater</div>
            <div style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lime)" }}>Internal Systems</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11, color: "var(--forest)", fontWeight: 600, background: "var(--lime)", fontSize: 13.5, marginBottom: 4 }}>
          <HomeIcon size={17} /> Home
        </div>

        <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#7e9a87", fontWeight: 700, padding: "10px 12px 6px" }}>Modules</div>
        {visible.map(m => {
          const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
          return (
            <button key={m.id} onClick={() => onPick(m.id)} className="home-side-link" style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 10,
              color: "#cfe0d5", fontWeight: 500, background: "transparent", textAlign: "left", fontSize: 13.5, transition: ".15s", cursor: "pointer"
            }}>
              <Icon size={16} /> <span style={{ flex: 1 }}>{m.label}</span>
              {(!m.built || m.soon) && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--lime)" }}>SOON</span>}
            </button>
          );
        })}

        <button onClick={() => setUser(null)} className="home-side-link" style={{
          display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 10,
          color: "#cfe0d5", fontWeight: 500, background: "transparent", textAlign: "left", fontSize: 13.5, marginTop: "auto", cursor: "pointer"
        }}>
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      {/* Main area */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--f)" }}>Unified Operations Platform</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--f)" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>{user.role}</div>
            </div>
            <button onClick={() => setUser(null)} style={{ ...btnGhost, padding: "8px 14px" }}><LogOut size={15} /> Sign out</button>
          </div>
        </header>

        {/* Welcome */}
        <div style={{ width: "100%", padding: "40px 32px 12px" }}>
          <p className="eyebrow" style={{ color: "var(--teal)" }}>Welcome back, {user.name}</p>
          <h1 style={{ fontSize: "clamp(26px,3.5vw,38px)", margin: "6px 0 6px", color: "var(--f)" }}>Choose a module</h1>
          <p style={{ color: "var(--slate)", fontSize: 14.5 }}>Pick where you want to work today. You'll only see the modules you have access to.</p>
        </div>

        {/* Module grid — fixed columns so cards align and gaps fill evenly */}
        <div style={{ width: "100%", padding: "16px 32px 48px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 18, alignContent: "start" }}>
          {visible.map(m => {
            const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
            const lvl = access[m.id];
            return (
              <button key={m.id} onClick={() => onPick(m.id)} className="pw-modcard" style={{
                textAlign: "left", background: "#fff", border: "1px solid var(--border)", borderRadius: 18, padding: 22,
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 13, position: "relative", overflow: "hidden",
                minHeight: 188, transition: "transform .15s ease, box-shadow .15s ease"
              }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: m.color + "1a", color: m.color, display: "grid", placeItems: "center" }}>
                  <Icon size={25} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16.5, color: "var(--f)", display: "flex", alignItems: "center", gap: 8 }}>
                    {m.label}
                    {(!m.built || m.soon) && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", color: "#9a6a16", background: "#fdf3e0", padding: "2px 7px", borderRadius: 999 }}>SOON</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{m.desc}</div>
                </div>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: (lvl === "admin" || lvl === "devops") ? "var(--teal)" : "var(--muted)" }}>{lvl} access</span>
                  <ChevronRight size={18} color="var(--muted)" />
                </div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--muted)" }}>
              You don't have access to any modules yet. Ask an admin to grant access.
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "0 0 24px", marginTop: "auto" }}>© {new Date().getFullYear()} ProWater Internal Systems · v{APP_VERSION}</p>
      </div>
    </div>
  );
}

/* ---------- Coming soon placeholder for not-yet-built modules ---------- */
function ComingSoon({ module, onHome }) {
  return (
    <div className="fade-up" style={{ display: "grid", placeItems: "center", padding: "60px 20px", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: module.color + "1a", color: module.color, display: "grid", placeItems: "center", marginBottom: 18 }}>
        <Construction size={34} />
      </div>
      <h2 style={{ fontSize: 26, marginBottom: 8 }}>{module.label} is coming soon</h2>
      <p style={{ color: "var(--slate)", fontSize: 14.5, maxWidth: 460, marginBottom: 22 }}>
        This module is part of the ProWater Internal Systems roadmap. The structure and access controls are ready — the screens and data connections will be added next.
      </p>
      <button onClick={onHome} style={btnPrimary}><HomeIcon size={16} /> Back to modules</button>
    </div>
  );
}

/* ---------- Login ---------- */
function Login() {
  const { setUser } = useAuth();
  // Pre-fill the ID if "Remember me" was ticked last time. We never store the
  // password — the browser's own (OS-encrypted) password manager handles that.
  const rememberedId = (() => { try { return localStorage.getItem("pw_rememberId") || ""; } catch { return ""; } })();
  const [username, setUsername] = useState(rememberedId);
  const [usernames, setUsernames] = useState([]);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(false); // open the reset modal
  const [remember, setRemember] = useState(Boolean(rememberedId));

  useEffect(() => { api.getUsernames().then(setUsernames); }, []);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim()) { setErr("Enter your ID."); return; }
    setErr(""); setBusy(true);
    try {
      const u = await api.login(username.trim(), pw);
      try {
        if (remember) localStorage.setItem("pw_rememberId", username.trim());
        else localStorage.removeItem("pw_rememberId");
      } catch { /* storage unavailable — ignore */ }
      setUser(u);
    }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr 1fr" }} className="login-grid">
      <style>{`@media(max-width:880px){.login-grid{grid-template-columns:1fr!important}.login-aside{display:none!important}}`}</style>
      {/* brand side */}
      <aside className="login-aside" style={{
background: "linear-gradient(135deg, #1a3320, #0f2318 55%, #061209)",
        backgroundSize: "200% 200%", animation: "pw-drift 14s ease-in-out infinite",
        color: "#dfeee4", padding: "56px 56px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden", minHeight: "100vh"
      }}>
        {/* Always-running ambient layers */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 40% at 90% 90%, rgba(168,217,64,.25), transparent)", animation: "pw-glow 5s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "12%", right: "8%", width: 300, height: 300, borderRadius: 999, background: "radial-gradient(circle, rgba(168,217,64,.28), transparent 70%)", animation: "pw-float-a 11s ease-in-out infinite", filter: "blur(8px)" }} />
        <div style={{ position: "absolute", bottom: "6%", left: "-6%", width: 360, height: 360, borderRadius: 999, background: "radial-gradient(circle, rgba(22,84,92,.5), transparent 70%)", animation: "pw-float-b 14s ease-in-out infinite", filter: "blur(8px)" }} />
        <div style={{ position: "absolute", top: "40%", left: "50%", width: 200, height: 200, borderRadius: 999, background: "radial-gradient(circle, rgba(168,217,64,.22), transparent 70%)", animation: "pw-float-c 9s ease-in-out infinite", filter: "blur(6px)" }} />
        {/* Rising particles */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            position: "absolute", bottom: 0, left: `${10 + i * 15}%`,
            width: 6 + (i % 3) * 3, height: 6 + (i % 3) * 3, borderRadius: 999,
            background: "rgba(168,217,64,.6)",
            animation: `pw-particle ${8 + i * 2}s linear infinite`, animationDelay: `${i * 1.5}s`
          }} />
        ))}
        {/* Expanding ring pulses */}
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 140, height: 140, marginLeft: -70, marginTop: -70, borderRadius: 999, border: "1.5px solid rgba(168,217,64,.5)", animation: "pw-ring 4s ease-out infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 140, height: 140, marginLeft: -70, marginTop: -70, borderRadius: 999, border: "1.5px solid rgba(168,217,64,.5)", animation: "pw-ring 4s ease-out infinite", animationDelay: "2s" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "absolute", top: 56, left: 56, animation: "pw-pulse 4s ease-in-out infinite", zIndex: 2 }}>
          <Drop />
          <span style={{ fontWeight: 700, letterSpacing: ".02em" }}>ProWater</span>
        </div>
        <div className="pw-stagger" style={{ position: "relative", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
          <p className="eyebrow" style={{ color: "var(--lime)", textAlign: "center" }}>Unified Operations Platform</p>
          <h1 style={{ color: "#fff", fontSize: "clamp(40px,5vw,64px)", lineHeight: 1.04, margin: "12px 0 18px", fontWeight: 900, textAlign: "center" }}>
            One platform.<br />Every <span style={{ background: "linear-gradient(90deg, var(--lime-d), #d4f06a, var(--lime-d))", backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "pw-shimmer 3s linear infinite" }}>operation.</span>
          </h1>
          <p style={{ maxWidth: 440, lineHeight: 1.7, color: "#b9d2c4", textAlign: "center" }}>
            Sales, billing, inventory, field service and referrals — managed together in ProWater Internal Systems, connected live to your business data.
          </p>
        </div>
        <p style={{ fontSize: 12, color: "#7fa08e", position: "absolute", bottom: 56, left: 56, zIndex: 1 }}>© {new Date().getFullYear()} ProWater Internal Systems · v{APP_VERSION}</p>
      </aside>

      {/* form side */}
<main style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 24px", minHeight: "100vh", background: "var(--mint)" }}>        <form className="pw-stagger" onSubmit={submit} style={{ width: "100%", maxWidth: 460 }}>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2 style={{ fontSize: 34, margin: "6px 0 4px" }}>Sign in</h2>
            <p style={{ fontSize: 14, marginBottom: 28 }}>Enter your credentials to access the dashboard.</p>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Field label="User ID">
                <input name="username" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your ID" autoComplete="username" style={inp} />
              </Field>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Field label="Password">
                <div style={{ position: "relative" }}>
                  <input name="password" type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" style={inp} />
                  <button type="button" onClick={() => setShow(s => !s)} aria-label="toggle password"
                    style={{ position: "absolute", right: 10, top: 10, color: "var(--muted)" }}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 2 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--teal)", cursor: "pointer" }} />
              Remember me
            </label>
            <button type="button" onClick={() => setForgot(true)} style={{ fontSize: 12.5, color: "var(--teal)", fontWeight: 600 }}>Forgot password?</button>
          </div>

          <button type="submit" disabled={busy} style={{ ...btnPrimary, width: "auto", alignSelf: "flex-start", padding: "10px 28px", marginTop: 10, opacity: busy ? .7 : 1 }}>
            {busy ? "Signing in…" : "Sign in"} <ArrowUpRight size={18} />
          </button>

          <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
            Need an account? Ask an admin to create one.
          </p>
        </form>
        {err && <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", color: "#b4232a", fontSize: 13, marginTop: 14, animation: "pw-fade .3s ease" }}>
          <AlertCircle size={16} />{err}</div>}
      </main>
      {forgot && <ForgotPassword usernames={usernames} onClose={() => setForgot(false)} />}
    </div>
  );
}

/* ---------- Forgot password (4-digit OTP, simulated email) ---------- */
function ForgotPassword({ usernames, onClose }) {
  const [step, setStep] = useState(1); // 1=email, 2=otp+newpw, 3=done
  const [username, setUsername] = useState("");
  const [sentOtp, setSentOtp] = useState(""); // shown on-screen since email is simulated
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sendCode = async () => {
    if (!username) { setErr("Select your email."); return; }
    setErr(""); setBusy(true);
    try { const code = await api.requestOtp(username); setSentOtp(code); setStep(2); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const doReset = async () => {
    if (otp.length !== 4) { setErr("Enter the 4-digit code."); return; }
    if (newPw.length < 6) { setErr("New password must be at least 6 characters."); return; }
    setErr(""); setBusy(true);
    try { await api.resetPasswordWithOtp(username, otp, newPw); setStep(3); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,40,24,.45)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 24px 60px rgba(13,40,24,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 22 }}>Reset password</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}><X size={20} /></button>
        </div>

        {step === 1 && <>
          <p style={{ fontSize: 13.5, color: "var(--slate)", marginBottom: 18 }}>Enter your login ID and we'll send a 4-digit verification code to your registered email.</p>
          <Field label="Email">
            <div style={{ display: "flex" }}>
              <input value={username} onChange={e => setUsername(e.target.value.replace(/[@\s]/g, ""))}
                onKeyDown={e => e.key === "Enter" && sendCode()} placeholder="your-id"
                style={{ ...inp, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none" }} />
              <span style={{ display: "flex", alignItems: "center", padding: "0 12px", background: "var(--mint-2)", border: "1px solid var(--border)", borderLeft: "none", borderTopRightRadius: 11, borderBottomRightRadius: 11, color: "var(--slate)", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>{EMAIL_DOMAIN}</span>
            </div>
          </Field>
          {err && <div style={{ color: "#b4232a", fontSize: 13, marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} />{err}</div>}
          <button onClick={sendCode} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Sending…" : "Send code"}</button>
        </>}

        {step === 2 && <>
          <div style={{ fontSize: 13, background: "var(--mint-2)", borderRadius: 10, padding: "10px 12px", marginBottom: 16, color: "var(--forest)" }}>
            A code was sent to <strong>{username}{EMAIL_DOMAIN}</strong>.<br />
            <span style={{ color: "var(--muted)" }}>Demo mode — your code is</span> <strong style={{ letterSpacing: 2, fontSize: 16 }}>{sentOtp}</strong>
          </div>
          <Field label="4-digit code">
            <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" inputMode="numeric"
              style={{ ...inp, letterSpacing: 8, fontSize: 18, textAlign: "center", fontWeight: 700 }} />
          </Field>
          <Field label="New password">
            <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 6 characters" style={inp} />
          </Field>
          {err && <div style={{ color: "#b4232a", fontSize: 13, marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} />{err}</div>}
          <button onClick={doReset} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Resetting…" : "Reset password"}</button>
          <button onClick={() => { setStep(1); setOtp(""); setErr(""); }} style={{ width: "100%", marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>Use a different email</button>
        </>}

        {step === 3 && <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 999, background: "#e6f4ea", color: "#1f7a3f", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><CheckCircle2 size={26} /></div>
          <h4 style={{ fontSize: 18, marginBottom: 6 }}>Password updated</h4>
          <p style={{ fontSize: 13.5, color: "var(--slate)", marginBottom: 18 }}>You can now sign in with your new password.</p>
          <button onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>Back to sign in</button>
        </div>}
      </div>
    </div>
  );
}

/* ---------- Shell + nav ---------- */
// Warns when any on-screen data is seed/sample because a live endpoint failed.
function SampleDataBanner() {
  const sources = useSampleData();
  if (!sources.length) return null;
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#9a6a16", background: "#fdf3e0", border: "1px solid #f0dcae", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
      <AlertCircle size={16} />
      <span>
        <b>Showing sample data</b> — the live {sources.join(", ")} {sources.length > 1 ? "endpoints are" : "endpoint is"} unreachable, so these numbers are placeholders, not real. Try <b>Refresh</b>, or check your connection / API access.
      </span>
    </div>
  );
}

function Shell({ module = "referral", onHome }) {
  const { user, setUser } = useAuth();
  const moduleMeta = MODULES.find(m => m.id === module) || MODULES.find(m => m.id === "referral");
  const moduleAccess = (user.access && user.access[module]) || (user.role === "admin" ? "admin" : "view");
  const isModuleAdmin = moduleAccess === "admin" || moduleAccess === "devops";
  const [tab, setTab] = useState(
    module === "sales" ? "sales_leads"
    : module === "analytics" ? "analytics"
    : module === "employee" ? "emp_users"
    : module === "devicereplace" ? "dr_list"
    : module === "about" ? "about_docs"
    : module === "logtracker" ? "log_all"
    : module === "ticketing" ? "tk_overview"
    : module === "customer" ? "cust_list"
    : module === "billing" ? "bill_subs"
    : module === "fsm" ? "fsm_track"
    : module === "erp" ? "erp_assets"
    : module === "autoscheduler" ? "as_society"
    : module === "iot" ? "iot_devices"
    : "overview"
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState(new Date());          // system clock (top-right)
  const [loginAt] = useState(() => Date.now());        // session start for the timer
  const [elapsed, setElapsed] = useState(0);           // seconds since login
  const [refreshKey, setRefreshKey] = useState(0);     // bump to re-mount pages
  const [refreshing, setRefreshing] = useState(false);
  const [photo, setPhoto] = useState(() => api.getPhoto(user.username)); // profile photo
  const [photoOpen, setPhotoOpen] = useState(false);
  useFailures(); // re-render when an API source goes down / recovers
  const downSources = (MODULE_SOURCES[module] || []).filter(s => failingSourcesNow().includes(s));

  // Tell the logger which module we're in (so logs record the Module column).
  useEffect(() => { _currentModule = moduleMeta.label; return () => { _currentModule = "—"; }; }, [moduleMeta.label]);

  // Tick the clock and the session timer every second.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setElapsed(Math.floor((Date.now() - loginAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [loginAt]);

  // Refresh: clear the API cache, then re-mount the current page so it re-fetches.
  const doRefresh = async () => {
    setRefreshing(true);
    try {
      if (module === "billing") await billingApi.forceRefresh();
      else if (module === "sales") await salesApi.forceRefresh();
      else await api.forceRefresh();
    } catch { /* page will show its own error */ }
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 400);
  };

  const fmtClock = (d) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const fmtElapsed = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const moduleTabs = {
    referral: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "referrers", label: "Referrers", icon: Users },
      { id: "referees", label: "Referees", icon: GitBranch },
      { id: "credits", label: "Credits", icon: Coins },
      { id: "tracker", label: "Tracker", icon: Trophy },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      ...(isModuleAdmin ? [{ id: "backtrack", label: "Backtrack", icon: Undo2 }] : []),
    ],
    sales: [
      { id: "sales_overview", label: "Pipeline", icon: LayoutDashboard },
      { id: "sales_leads", label: "Leads & Deals", icon: Briefcase },
      { id: "sales_apartments", label: "Apartment Leads", icon: Boxes },
      { id: "sales_analytics", label: "Sales Analytics", icon: BarChart3 },
      { id: "sales_errors", label: "Error Correction", icon: AlertCircle },
    ],
    analytics: [
      { id: "analytics", label: "Referral", icon: BarChart3 },
      { id: "an_sales", label: "Sales", icon: Briefcase },
      { id: "an_earned", label: "Earned Revenue", icon: Scale },
      { id: "an_apartment", label: "Apartment Performance", icon: Boxes },
      { id: "an_billing", label: "Billing", icon: Receipt },
      { id: "an_revenue", label: "Revenue", icon: TrendingUp },
      { id: "an_credits", label: "Credits", icon: Coins },
      { id: "an_applogs", label: "App Logs", icon: ScrollText },
    ],
    employee: [
      { id: "emp_users", label: "Users", icon: UserCog },
    ],
    ticketing: [
      { id: "tk_overview", label: "Overview", icon: LayoutDashboard },
      { id: "tk_tickets", label: "Tickets", icon: Ticket },
    ],
    customer: [
      { id: "cust_list", label: "Customers", icon: UserRound },
    ],
    billing: [
      { id: "bill_overview", label: "Overview", icon: LayoutDashboard },
      { id: "bill_subs", label: "Subscriptions", icon: RefreshCw },
      { id: "bill_invoices", label: "Invoices", icon: Receipt },
      { id: "bill_deposits", label: "Deposits & Refunds", icon: Wallet },
    ],
    fsm: [
      { id: "fsm_track", label: "Track Technician", icon: MapPin },
      { id: "fsm_amc", label: "AMC / Maintenance", icon: CalendarClock },
      { id: "fsm_quality", label: "Water Quality", icon: Droplets },
    ],
    erp: [
      { id: "erp_assets", label: "Asset Lifecycle", icon: Boxes },
    ],
    autoscheduler: [
      { id: "as_society", label: "Auto GS - Society", icon: CalendarClock },
      { id: "as_iot", label: "IoT Alerts", icon: Cpu },
    ],
    iot: [
      { id: "iot_devices", label: "Device Monitor", icon: Cpu },
    ],
    devicereplace: [
      { id: "dr_list", label: "Replacements", icon: Repeat },
    ],
    about: [
      { id: "about_docs", label: "About", icon: Info },
    ],
    logtracker: [
      { id: "log_all", label: "All Logs", icon: ScrollText },
      { id: "log_failures", label: "Failures", icon: AlertCircle },
    ],
  };

  const sharesAdminTabs = false; // User Management → Employee module; logs → Logs Tracker module
  const nav = !moduleMeta.built ? [] : [
    ...(moduleTabs[module] || []),
    ...(isModuleAdmin && sharesAdminTabs ? [
      { id: "logs", label: "Activity Logs", icon: ScrollText },
      { id: "users", label: "User Management", icon: UserCog },
    ] : []),
  ];

  const signOut = async () => { await api.logout(user.username); setUser(null); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", width: "100%" }} className="shell-grid">
      <style>{`@media(max-width:860px){.shell-grid{grid-template-columns:1fr!important}.pw-side{position:fixed;z-index:40;height:100%;transform:translateX(-100%);transition:.25s}.pw-side.open{transform:none}.pw-topbar-burger{display:inline-flex!important}}`}</style>

      {/* sidebar */}
      <aside className={`pw-side ${mobileNav ? "open" : ""}`} style={{
        background: "linear-gradient(180deg,var(--forest) 0%, var(--forest-2) 100%)",
        color: "#cfe3d6", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 6
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 14px" }}>
          <Drop />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>ProWater</div>
            <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--lime)" }}>{moduleMeta.label}</div>
          </div>
        </div>

        <button onClick={onHome} style={{
          display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11,
          color: "#bcd4c4", fontWeight: 500, background: "rgba(255,255,255,.05)", textAlign: "left", fontSize: 14, marginBottom: 6
        }}>
          <HomeIcon size={18} /> All modules
        </button>

        {nav.map(n => (
          <button key={n.id} onClick={() => { setTab(n.id); setMobileNav(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11,
              color: tab === n.id ? "var(--forest)" : "#bcd4c4", fontWeight: tab === n.id ? 600 : 500,
              background: tab === n.id ? "var(--lime)" : "transparent", textAlign: "left", fontSize: 14, transition: ".15s"
            }}>
            <n.icon size={18} /> {n.label}
          </button>
        ))}

        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 12px" }}>
            <button onClick={() => setPhotoOpen(true)} title="Update profile photo"
              style={{ position: "relative", width: 34, height: 34, borderRadius: 999, overflow: "hidden", background: "var(--grad)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0, cursor: "pointer" }}>
              {photo
                ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : user.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
              <span style={{ position: "absolute", bottom: 0, right: 0, background: "rgba(13,40,24,.85)", borderRadius: "6px 0 0 0", padding: "1px 2px", display: "grid", placeItems: "center" }}><Camera size={9} color="#fff" /></span>
            </button>
            <div style={{ lineHeight: 1.2, minWidth: 0 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--lime)", display: "flex", alignItems: "center", gap: 4 }}>
                {user.role === "admin" ? <ShieldCheck size={12} /> : <Shield size={12} />}{user.role}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 8px 8px", color: "#9fc0a9", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
            <Clock size={13} /> Session {fmtElapsed(elapsed)}
          </div>
          <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 9, color: "#bcd4c4", fontSize: 13, padding: "8px 8px" }}>
            <LogOut size={16} /> Sign out
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 8, paddingTop: 10, padding: "10px 8px 2px", color: "#7f9d89", fontSize: 10.5, lineHeight: 1.4 }}>
            © 2026 ProWater Internal Systems · v{APP_VERSION}
          </div>
        </div>
      </aside>

      {/* main */}
      <main style={{ minWidth: 0 }}>
        <div className="pw-topbar" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 28px", borderBottom: "1px solid var(--border)", background: "rgba(243,248,236,.92)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20 }}>
          <button className="pw-topbar-burger" onClick={() => setMobileNav(s => !s)} style={{ display: "none", color: "var(--f)" }}><Menu /></button>
          <div style={{ flex: 1 }}>
            <p className="eyebrow">{moduleMeta.label} · {isModuleAdmin ? "Admin access" : "View access"}</p>
            <h2 style={{ fontSize: 22, lineHeight: 1 }}>{moduleMeta.built ? (nav.find(n => n.id === tab)?.label || moduleMeta.label) : moduleMeta.label}</h2>
          </div>
          {moduleMeta.built && <button onClick={doRefresh} disabled={refreshing} title="Refresh data"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "#fff", color: "var(--teal)", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: refreshing ? .6 : 1 }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "pw-spin .8s linear infinite" : "none" }} /> Refresh
          </button>}
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "var(--mint-2)", color: "var(--forest)", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            <Clock size={15} /> {fmtClock(now)}
          </div>
        </div>
        <div style={{ padding: "28px 40px", maxWidth: "100%", margin: "0 auto" }}>
          {moduleMeta.built && <SampleDataBanner />}
          {!moduleMeta.built ? <ComingSoon module={moduleMeta} onHome={onHome} /> : <>
            {tab === "overview" && <Overview key={refreshKey} />}
            {tab === "referrers" && <Referrers key={refreshKey} />}
            {tab === "referees" && <Referees key={refreshKey} />}
            {tab === "credits" && <Credits key={refreshKey} />}
            {tab === "tracker" && <Tracker key={refreshKey} />}
            {tab === "analytics" && <Analytics key={refreshKey} />}
            {tab === "an_sales" && <SalesInsights key={refreshKey} />}
            {tab === "an_earned" && <EarnedRevenue key={refreshKey} />}
            {tab === "an_apartment" && <ApartmentPerformance key={refreshKey} />}
            {tab === "an_billing" && <BillingAnalytics key={refreshKey} />}
            {tab === "an_revenue" && <NetRevenue key={refreshKey} />}
            {tab === "an_credits" && <CreditsAnalytics key={refreshKey} />}
            {tab === "an_applogs" && <AppLogs key={refreshKey} />}
            {tab === "sales_overview" && <SalesPipeline key={refreshKey} />}
            {tab === "sales_leads" && <SalesLeads key={refreshKey} isAdmin={isModuleAdmin} />}
            {tab === "sales_apartments" && <ApartmentLeads key={refreshKey} />}
            {tab === "sales_analytics" && <SalesAnalytics key={refreshKey} />}
            {tab === "sales_errors" && <SalesErrorCorrection key={refreshKey} isAdmin={isModuleAdmin} />}
            {tab === "emp_users" && <UsersAdmin key={refreshKey} />}
            {tab === "dr_list" && <DeviceReplacement key={refreshKey} />}
            {tab === "about_docs" && <AboutModule key={refreshKey} />}
            {tab === "log_all" && <Logs key={refreshKey} />}
            {tab === "log_failures" && <Failures key={refreshKey} />}
            {tab === "tk_overview" && <TicketOverview key={refreshKey} />}
            {tab === "tk_tickets" && <TicketList key={refreshKey} isAdmin={isModuleAdmin} />}
            {tab === "cust_list" && <Customers key={refreshKey} accessLevel={moduleAccess} />}
            {tab === "bill_overview" && <BillingOverview key={refreshKey} />}
            {tab === "bill_subs" && <Subscriptions key={refreshKey} />}
            {tab === "bill_invoices" && <Invoices key={refreshKey} />}
            {tab === "bill_deposits" && <DepositRefunds key={refreshKey} />}
            {tab === "fsm_track" && <TrackTechnician key={refreshKey} />}
            {tab === "fsm_amc" && <MaintenanceSchedule key={refreshKey} />}
            {tab === "fsm_quality" && <WaterQuality key={refreshKey} />}
            {tab === "erp_assets" && <AssetLifecycle key={refreshKey} />}
            {tab === "as_society" && <AutoGSSociety key={refreshKey} />}
            {tab === "as_iot" && <IoTAlerts key={refreshKey} />}
            {tab === "iot_devices" && <IoTDevices key={refreshKey} />}
            {tab === "backtrack" && isModuleAdmin && <Backtrack key={refreshKey} />}
            {tab === "logs" && isModuleAdmin && <Logs key={refreshKey} />}
            {tab === "users" && isModuleAdmin && <UsersAdmin key={refreshKey} />}
          </>}
        </div>
      </main>
      {photoOpen && <PhotoUploader username={user.username} current={photo}
        onClose={() => setPhotoOpen(false)}
        onSaved={(url) => { setPhoto(url); setPhotoOpen(false); }} />}
      {downSources.length > 0 && <ServerDownModal sources={downSources} onClose={onHome} />}
    </div>
  );
}

/* ===========================================================================
   Overview
   =========================================================================== */
function Overview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.logView(user.username, "Viewed Overview");
    Promise.all([api.getReferrers(), api.getReferees(), api.getTrend()])
      .then(([refs, rees, tr]) => setData({ refs, rees, tr }))
      .catch(e => setErr(e.message || "Could not load data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const totalRefs = data.refs.length;
  const totalReees = data.rees.length;
  const converted = data.rees.filter(r => r.status === "paid").length;
  const freeMonths = data.refs.reduce((s, r) => s + (r.freeMonthsEarned || 0), 0);
  const convRate = totalReees ? Math.round((converted / totalReees) * 100) : 0;

  const stats = [
    { label: "Active referrers", value: totalRefs, icon: Users, sub: "live from API" },
    { label: "Referees tracked", value: totalReees, icon: GitBranch, sub: `${converted} converted` },
    { label: "Conversion rate", value: convRate + "%", icon: TrendingUp, sub: "converted referees" },
    { label: "Free months granted", value: freeMonths + " mo", icon: Wallet, sub: "to referrers", hero: true },
  ];

  return (
    <div className="fade-up">
      <div style={grid4}>
        {stats.map(s => <Stat key={s.label} {...s} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginTop: 18 }} className="ov-grid">
        <style>{`@media(max-width:820px){.ov-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Referral momentum" sub="Referrals vs. conversions, last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.tr} margin={{ left: -18, right: 6, top: 8 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5a7863" stopOpacity={.35} /><stop offset="100%" stopColor="#5a7863" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#90ab8b" stopOpacity={.5} /><stop offset="100%" stopColor="#90ab8b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="referrals" stroke="#5a7863" strokeWidth={2.5} fill="url(#g1)" />
              <Area type="monotone" dataKey="conversions" stroke="#90ab8b" strokeWidth={2.5} fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top referrers" sub="By free months earned">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...data.refs].sort((a, b) => b.freeMonthsEarned - a.freeMonthsEarned).slice(0, 5).map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 22, fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, color: i === 0 ? "var(--lime-d)" : "var(--muted)", fontSize: 18 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.converted}/{r.totalReferred} converted</div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--f)", fontSize: 13.5, whiteSpace: "nowrap" }}>{r.freeMonthsEarned}M / {r.freeMonthsEarned * 30} days</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   Referrers
   =========================================================================== */
function Referrers() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [referees, setReferees] = useState([]);

  useEffect(() => {
    api.logView(user.username, "Viewed Referrers");
    api.getReferrers().then(setRows).catch(() => setRows([]));
    api.getReferees().then(setReferees);
  }, []);
  if (!rows) return <Loading />;

  const filtered = rows.filter(r => (r.name + r.email + r.code).toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => exportToCsv("prowater-referrers.csv", [
    { label: "Name", get: r => r.name },
    { label: "Email", get: r => r.email },
    { label: "Phone", get: r => r.phone },
    { label: "Customer key", get: r => r.code },
    { label: "Society", get: r => r.society },
    { label: "Referred", get: r => r.totalReferred },
    { label: "Converted", get: r => r.converted },
    { label: "Pending", get: r => r.pending },
    { label: "Free months", get: r => r.freeMonthsEarned },
    { label: "Status", get: r => r.status },
  ], filtered);

  return (
    <div className="fade-up">
      <div>
     
      </div>
      <Toolbar q={q} setQ={setQ} placeholder="Search referrers, code, email…" count={filtered.length}
  right={<>
    <button onClick={() => refresh(true)} style={btnGhost}><RefreshCw size={15} /> Refresh</button>
    <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
  </>}
/>
      <Card pad={false}>
        <Table head={["Referrer", "Customer key", "Referred", "Converted", "Free months", "Status", ""]}>
          {filtered.map(r => (
            <tr key={r.id} style={trStyle} onClick={() => setSel(r)}>
              <td style={td}><Person name={r.name} email={r.email} /></td>
              <td style={td}><Chip>{r.code}</Chip></td>
              <td style={td}>{r.totalReferred}</td>
              <td style={td}><strong style={{ color: "var(--f)" }}>{r.converted}</strong></td>
              <td style={td}>{r.freeMonthsEarned}M / {r.freeMonthsEarned * 30} days</td>
              <td style={td}><Status s={r.status} /></td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
        </Table>
      </Card>



      {sel && <Drawer onClose={() => setSel(null)} title={sel.name} sub={sel.code}>
        <DefRow k="Email" v={sel.email} />
        <DefRow k="Phone" v={sel.phone} />
        <DefRow k="Customer number" v={sel.customerNumber || "—"} />
        <DefRow k="Society" v={sel.society || "—"} />
        <DefRow k="Purifier ID" v={sel.purifierId || "—"} />
        <DefRow k="Joined" v={sel.joined || "—"} />
        <DefRow k="Total referred" v={sel.totalReferred} />
        <DefRow k="Converted" v={sel.converted} />
        <DefRow k="Pending" v={sel.pending} />
        <DefRow k="Free months earned" v={sel.freeMonthsEarned + " months"} />
        <DefRow k="Status" v={<Status s={sel.status} />} />
        <h3 style={{ fontSize: 15, margin: "22px 0 8px" }}>Referees</h3>
        {referees.filter(e => e.referrerId === sel.id).map(e => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{e.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.plan}</div></div>
            <Status s={e.status} />
          </div>
        ))}
        {referees.filter(e => e.referrerId === sel.id).length === 0 && <Empty msg="No referees yet." />}
      </Drawer>}
    </div>
  );
}




/* ===========================================================================
   Referees
   =========================================================================== */
function Referees() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [refs, setRefs] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Referees");
    api.getReferees().then(setRows).catch(() => setRows([]));
    api.getReferrers().then(setRefs);
  }, []);
  if (!rows) return <Loading />;

  const nameOf = id => refs.find(r => r.id === id)?.name || "—";
  const filtered = rows.filter(r =>
    (r.name + r.email + r.phone + r.society).toLowerCase().includes(q.toLowerCase()) &&
    (status === "all" || r.status === status))
    .sort((a, b) => {
      const da = parseApiDate(a.convertedAt) || parseApiDate(a.date) || 0;
      const db = parseApiDate(b.convertedAt) || parseApiDate(b.date) || 0;
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0); // newest first
    });

  const exportCsv = () => exportToCsv("prowater-referees.csv", [
    { label: "Referee", get: e => e.name },
    { label: "Email", get: e => e.email },
    { label: "Referred by", get: e => nameOf(e.referrerId) },
    { label: "Phone", get: e => e.phone },
    { label: "Flat", get: e => e.flat },
    { label: "Society", get: e => e.society },
    { label: "Free months", get: e => e.refereeFreeMonths },
    { label: "Status", get: e => e.status === "paid" ? "converted" : e.status },
    { label: "Date", get: e => e.date },
  ], filtered);

  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search referees, phone, society…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="paid">Converted</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Referee", "Referred by", "Phone", "Flat", "Society", "Free months", "Status", "Date"]}>
          {filtered.map(e => (
            <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}><Person name={e.name} email={e.email} /></td>
              <td style={td}>{nameOf(e.referrerId)}</td>
              <td style={td}>{e.phone}</td>
              <td style={td}>{e.flat || "—"}</td>
              <td style={td}>{e.society || "—"}</td>
              <td style={td}>{e.refereeFreeMonths ? e.refereeFreeMonths + " mo" : "—"}</td>
              <td style={td}><Status s={e.status === "paid" ? "converted" : e.status} /></td>
              <td style={td}>{e.date || "—"}</td>
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No referees match your filters." />}
      </Card>
    </div>
  );
}

/* ===========================================================================
   Credits  (admins approve/reject; viewers read-only)
   =========================================================================== */
function Credits() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [rows, setRows] = useState(null);
  const [refs, setRefs] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => api.getCredits().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); api.getReferrers().then(setRefs); }, []);
  if (!rows) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const nameOf = id => refs.find(r => r.id === id)?.name || "—";

  const act = async (id, kind) => {
    setBusyId(id);
    try {
      if (kind === "approve") { await api.approveCredit(user.username, id); flash("Credit approved"); }
      else { await api.rejectCredit(user.username, id); flash("Credit rejected"); }
      await refresh();
    } finally { setBusyId(null); }
  };

  const filtered = rows.filter(c =>
    (nameOf(c.referrerId) + c.refereeName + c.invoice).toLowerCase().includes(q.toLowerCase()) &&
    (status === "all" || c.status === status))
    .sort((a, b) => {
      const da = parseApiDate(a.date) || 0, db = parseApiDate(b.date) || 0;
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });

  const pending = rows.filter(c => c.status === "pending").length;
  const approvedMonths = rows.filter(c => c.status === "approved").reduce((s, c) => s + c.credits, 0);
  const pendingMonths = rows.filter(c => c.status === "pending").reduce((s, c) => s + c.credits, 0);

  return (
    <div className="fade-up">
      <div style={grid4}>
        <Stat label="Pending review" value={pending} icon={Hourglass} sub={`${pendingMonths} free months awaiting`} hero />
        <Stat label="Approved" value={`${approvedMonths} months`} icon={CheckCircle2} sub="free months pushed to Zoho" />
        <Stat label="Existing customer" value={freeLabel(EXISTING_CREDIT)} icon={Coins} sub="2 months free per referral" />
        <Stat label="New customer" value={freeLabel(NEW_CREDIT)} icon={Coins} sub="1 month free per referral" />
        {isAdmin && (
          <button onClick={() => setAdding(true)} style={{
            border: "2px dashed var(--teal)", borderRadius: "var(--radius)", background: "var(--mint-2)",
            padding: 18, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
            gap: 8, cursor: "pointer", textAlign: "left", color: "var(--teal)", minHeight: 110
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 11, background: "var(--grad-btn)", color: "#fff" }}><Plus size={20} /></span>
            <span style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 18, color: "var(--f)" }}>Add manual credit</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Grant free months for a special case</span>
          </button>
        )}
      </div>

      <div style={{ height: 18 }} />
      <Toolbar q={q} setQ={setQ} placeholder="Search referrer, referee, invoice…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={() => exportToCsv("prowater-credits.csv", [
            { label: "Referrer", get: c => nameOf(c.referrerId) },
            { label: "Referee", get: c => c.refereeName },
            { label: "Invoice", get: c => c.invoice },
            { label: "Type", get: c => c.type },
            { label: "Free months", get: c => c.credits },
            { label: "Status", get: c => c.status },
            { label: "Date", get: c => c.date },
          ], filtered)} style={btnGhost}><Download size={15} /> Export</button>
        </>} />

      {!isAdmin && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)", background: "var(--mint-2)", padding: "9px 14px", borderRadius: 11, marginBottom: 14 }}>
        <Eye size={15} /> View-only access — only admins can approve or reject credits.
      </div>}

      <Card pad={false}>
        <Table head={["Referrer", "Referee", "Invoice", "Type", "Free months", "Status", "Date", ...(isAdmin ? ["Action"] : [])]} maxHeight="calc(100vh - 320px)">
          {filtered.map(c => (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}><strong style={{ color: "var(--f)" }}>{nameOf(c.referrerId)}</strong></td>
              <td style={td}>{c.refereeName}</td>
              <td style={td}><Chip>{c.invoice}</Chip></td>
              <td style={td}>
                <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "capitalize", color: c.type === "new" ? "var(--teal)" : "var(--slate)" }}>{c.type}</span>
              </td>
              <td style={td}><strong style={{ color: "var(--f)" }}>{freeLabel(c.credits)}</strong></td>
              <td style={td}><Status s={c.status} /></td>
              <td style={td}>{fmtDate(c.date)}</td>
              {isAdmin && <td style={{ ...td, whiteSpace: "nowrap" }}>
                {c.status === "pending" ? (
                  <span style={{ display: "inline-flex", gap: 8 }}>
                    <button onClick={() => act(c.id, "approve")} disabled={busyId === c.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, background: "var(--grad-btn)", color: "#fff", fontWeight: 600, fontSize: 12.5, opacity: busyId === c.id ? .6 : 1 }}>
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => act(c.id, "reject")} disabled={busyId === c.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "#fff", color: "#b4232a", fontWeight: 600, fontSize: 12.5, opacity: busyId === c.id ? .6 : 1 }}>
                      <Ban size={14} /> Reject
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>—</span>
                )}
              </td>}
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No credits match your filters." />}
      </Card>
      {adding && <AddManualCredit refs={refs} actor={user.username}
        onClose={() => setAdding(false)}
        onDone={() => { refresh(); flash("Manual credit added"); }} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

function AddManualCredit({ refs, actor, onClose, onDone }) {
  const [form, setForm] = useState({ referrerId: "", refereeName: "", invoice: "", type: "existing", credits: EXISTING_CREDIT });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickType = t => setForm(f => ({ ...f, type: t, credits: t === "existing" ? EXISTING_CREDIT : NEW_CREDIT }));

  const submit = async () => {
    if (!form.referrerId || !form.refereeName || !form.credits) { setErr("Pick a referrer, enter a referee, and a credit amount."); return; }
    setErr(""); setBusy(true);
    try { await api.addManualCredit(actor, { ...form, credits: Number(form.credits) }); onDone(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title="Add manual credits" sub="Created as approved">
      <Field label="Referrer">
        <select value={form.referrerId} onChange={e => set("referrerId", e.target.value)} style={{ ...inp, cursor: "pointer", appearance: "auto" }}>
          <option value="" disabled>Select a referrer</option>
          {refs.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
        </select>
      </Field>
      <Field label="Referee name"><input style={inp} value={form.refereeName} onChange={e => set("refereeName", e.target.value)} placeholder="e.g. Rohan Sharma" /></Field>
      <Field label="Invoice (optional)"><input style={inp} value={form.invoice} onChange={e => set("invoice", e.target.value)} placeholder="e.g. ZB-10123" /></Field>
      <Field label="Customer type">
        <div style={{ display: "flex", gap: 10 }}>
          {[["existing", `Existing · ${freeLabel(EXISTING_CREDIT)}`], ["new", `New · ${freeLabel(NEW_CREDIT)}`]].map(([t, lbl]) => (
            <button key={t} onClick={() => pickType(t)} style={{
              flex: 1, padding: "11px", borderRadius: 11, border: `1.5px solid ${form.type === t ? "var(--teal)" : "var(--border)"}`,
              background: form.type === t ? "var(--mint-2)" : "#fff", color: form.type === t ? "var(--teal)" : "var(--slate)",
              fontWeight: 600, fontSize: 13, textTransform: "capitalize"
            }}>{lbl}</button>
          ))}
        </div>
      </Field>
      <Field label="Free months"><input type="number" min="0" style={inp} value={form.credits} onChange={e => set("credits", e.target.value)} /></Field>
      {err && <div style={{ color: "#b4232a", fontSize: 13, display: "flex", gap: 6, alignItems: "center", margin: "2px 0 10px" }}><AlertCircle size={15} />{err}</div>}
      <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Adding…" : "Add free months"}</button>
    </Modal>
  );
}

/* ===========================================================================
   Analytics
   =========================================================================== */
function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(0);
  const [phone, setPhone] = useState("");      // phone search box
  const [scope, setScope] = useState(null);     // matched referrer (null = all)
  useEffect(() => {
    api.logView(user.username, "Viewed Analytics");
    Promise.all([api.getReferrers(), api.getReferees(), api.getTrend()])
      .then(([refs, rees, tr]) => { setData({ refs, rees, tr }); setToIdx(tr.length - 1); })
      .catch(e => setErr(e.message || "Could not load data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const searchPhone = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) { setScope(null); return; }
    const found = data.refs.find(r => (r.phone || "").replace(/\D/g, "").includes(digits));
    setScope(found || "none");
  };

  // Scope data to the matched referrer (or all referrers if no search).
  const scopedRefs = scope && scope !== "none" ? [scope] : data.refs;
  const scopedReferees = scope && scope !== "none"
    ? data.rees.filter(e => e.referrerId === scope.id)
    : data.rees;

  // Date-range slicer applied to the trend chart.
  const lo = Math.min(fromIdx, toIdx), hi = Math.max(fromIdx, toIdx);
  const trendInRange = data.tr.slice(lo, hi + 1);

  const statusBreak = [
    { name: "Converted", value: scopedReferees.filter(r => r.status === "paid").length },
    { name: "Pending", value: scopedReferees.filter(r => r.status === "pending").length },
  ].filter(x => x.value > 0);
  const PIE = ["#8fbf2e", "#16545c", "#c98a3a"];

  // Free months granted per referrer (top contributors).
  const bySociety = Object.values(scopedRefs.reduce((acc, r) => {
    const key = r.society || "Other";
    acc[key] = acc[key] || { plan: key, amount: 0 };
    acc[key].amount += (r.freeMonthsEarned || 0);
    return acc;
  }, {}));

  const totalFreeMonths = scopedRefs.reduce((s, r) => s + (r.freeMonthsEarned || 0), 0);
  const totalConverted = scopedReferees.filter(r => r.status === "paid").length;
  const totalReferees = scopedReferees.length;
  const rangeRewards = trendInRange.reduce((s, r) => s + r.rewards, 0);

  return (
    <div className="fade-up">
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && searchPhone()}
              placeholder="Filter analytics by phone number…" style={{ ...inp, paddingLeft: 36, margin: 0 }} />
          </div>
          <button onClick={searchPhone} style={btnPrimary}><Search size={16} /> Search</button>
          {scope && scope !== "none" && <button onClick={() => { setPhone(""); setScope(null); }} style={btnGhost}>Clear</button>}
        </div>
        {scope === "none" && <div style={{ marginTop: 10, fontSize: 13, color: "#b4232a", display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} /> No referrer found with that phone number.</div>}
        {scope && scope !== "none" && <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--forest)", fontWeight: 600 }}>Showing analytics for {scope.name} · {scope.phone}</div>}
      </Card>

      <div style={grid4}>
        <Stat label="Free months granted" value={totalFreeMonths} icon={Award} sub="total months to referrers" hero />
        <Stat label="Converted referees" value={totalConverted} icon={TrendingUp} sub={`out of ${totalReferees} referred`} />
        <Stat label="Conversion rate" value={(totalReferees ? Math.round(totalConverted / totalReferees * 100) : 0) + "%"} icon={ArrowUpRight} sub={`${totalConverted} of ${totalReferees} referees converted`} />
        <Stat label="Active referrers" value={data.refs.length} icon={Users} sub="live from API" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>

        <Card title="Free months trend" sub={`Free months granted · ${data.tr[lo]?.label} – ${data.tr[hi]?.label}`} style={{ gridColumn: "1/-1" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>Date range</span>
            <select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))} style={selectStyle}>
              {data.tr.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
            <span style={{ color: "var(--muted)" }}>→</span>
            <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))} style={selectStyle}>
              {data.tr.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>
              Free months in range: <strong style={{ color: "var(--f)" }}>{rangeRewards}</strong>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendInRange} margin={{ left: -8, right: 6, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={46} allowDecimals={false} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="rewards" name="free months" radius={[6, 6, 0, 0]} fill="#5a7863" maxBarSize={90} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Referee status mix" sub="Converted vs pending">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusBreak} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                {statusBreak.map((e, i) => <Cell key={i} fill={PIE[i]} />)}
              </Pie>
              <Tooltip content={<TT />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Free months by society" sub="Where referrers are earning">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bySociety} layout="vertical" margin={{ left: 40, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="amount" name="free months" radius={[0, 6, 6, 0]} fill="#90ab8b" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   Backtrack — undo / revert recent admin actions (admin only)
   =========================================================================== */
function Backtrack() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => api.getUndoable().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); }, []);
  if (!rows) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const revert = async (id) => {
    if (!confirm("Revert this action? This restores the previous state.")) return;
    setBusyId(id);
    try { await api.revertAction(user.username, id); await refresh(); flash("Action reverted"); }
    finally { setBusyId(null); }
  };

  const kindChip = (kind) => {
    const map = { approve: ["#1f7a3f", "#e6f4ea"], reject: ["#b4232a", "#fbe9e9"], add_manual: ["#16545c", "#e2eff0"] };
    const [c, bg] = map[kind] || ["#6a7670", "#eceeed"];
    return <span style={{ fontSize: 11, fontWeight: 600, color: c, background: bg, padding: "3px 8px", borderRadius: 7, textTransform: "capitalize" }}>{kind.replace("_", " ")}</span>;
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--slate)", background: "var(--mint-2)", padding: "11px 16px", borderRadius: 12, marginBottom: 16 }}>
        <Undo2 size={16} /> Recent reversible actions. Reverting restores the previous state and logs the change. Newest actions appear first.
      </div>

      <Card pad={false}>
        <Table head={["Time", "Action", "Type", "By", ""]} maxHeight="calc(100vh - 260px)">
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12.5, verticalAlign: "top" }}>{fmtTime(r.ts)}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{r.label}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{kindChip(r.kind)}</td>
              <td style={{ ...td, verticalAlign: "top" }}>{r.actor}</td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top" }}>
                <button onClick={() => revert(r.id)} disabled={busyId === r.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1.5px solid var(--border)", background: "#fff", color: "var(--teal)", fontWeight: 600, fontSize: 12.5, opacity: busyId === r.id ? .6 : 1 }}>
                  <RotateCcw size={14} /> Revert
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && <Empty msg="No actions to revert yet. Approve, reject, or add a manual credit and it will appear here." />}
      </Card>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   Activity Logs
   =========================================================================== */
function Logs() {
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
          <button onClick={clear} style={{ ...btnGhost, color: "#b4232a", borderColor: "#f2d0d0" }}><Trash2 size={15} /> Clear</button>
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
                      ? <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", color: "#1f7a3f", background: "#e6f4ea", padding: "1px 6px", borderRadius: 999 }}>GPS{r.accuracy != null ? ` · ±${r.accuracy}m` : ""}</span>
                      : <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".04em", color: "#9a6a16", background: "#fdf3e0", padding: "1px 6px", borderRadius: 999 }}>APPROX · via ISP</span>
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
function Failures() {
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
        <Stat label="Alert recipients" value={FAILURE_ALERT_TO.length} icon={Mail} sub="emailed on failure" />
      </div>
      <div style={{ margin: "14px 0", fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 7 }}>
        <Mail size={14} /> On a new failure an alert is emailed to {FAILURE_ALERT_TO.join(", ")} — needs the backend <code>POST /admin/notify-failure</code> route.
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
                <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: live ? "#b4232a" : "var(--slate)" }}>{fmtDowntime(dt)}</td>
                <td style={td}>
                  {live
                    ? <span style={{ fontSize: 11.5, fontWeight: 600, color: "#b4232a", background: "#fbe9e9", padding: "3px 9px", borderRadius: 999 }}>● Live</span>
                    : <span style={{ fontSize: 11.5, fontWeight: 600, color: "#1f7a3f", background: "#e6f4ea", padding: "3px 9px", borderRadius: 999 }}>Resolved</span>}
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

// Blocking popup shown when the current module's data sources are unreachable.
function ServerDownModal({ sources, onClose }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const recs = sources.map(s => _failures.find(f => f.source === s && !f.endedAt)).filter(Boolean);
  return createPortal(
    <div style={{ ...overlay, alignItems: "center", justifyContent: "center", padding: "40px 20px", zIndex: 2000 }}>
      <div className="pw-pop" style={{ width: "min(460px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 26, boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: "#fbe9e9", color: "#b4232a", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><AlertCircle size={28} /></div>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Server unavailable</h2>
        <p style={{ fontSize: 13.5, color: "var(--slate)", marginBottom: 16 }}>We can't reach the data service for this module right now. Live numbers are paused; any cached values may be stale.</p>
        <div style={{ display: "grid", gap: 8, marginBottom: 18, textAlign: "left" }}>
          {recs.map(r => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 12px", background: "var(--mint)", borderRadius: 10, fontSize: 12.5 }}>
              <span style={{ fontWeight: 600, color: "var(--f)" }}>{r.source}</span>
              <span style={{ color: "#b4232a", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>down {fmtDowntime(Date.now() - new Date(r.startedAt).getTime())}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ ...btnPrimary, width: "auto", padding: "11px 26px" }}>Close Module</button>
      </div>
    </div>,
    document.body
  );
}

/* ===========================================================================
   DEVICE REPLACEMENT (local-only module) — swap an old purifier for a new one
   3-step wizard: old device → new device → irreversible confirm. No API.
   =========================================================================== */
const DEVICE_TYPES = ["Own Device", "Normal", "Hot & Cold"];
let _drStore = []; // in-memory replacement records (local-only, survives tab re-mounts)

// Shape the record for the backend DB (snake_case, flattened old/new devices).
const drPayload = (full, actor) => ({
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

const deviceReplaceApi = {
  list: () => [..._drStore],
  // Records the swap locally AND persists it to the backend DB.
  // >>> WIRE: POST ${API_ORIGIN}/device-replacement/add
  create: async (actor, rec) => {
    const full = { id: crypto.randomUUID(), replacedAt: new Date().toISOString(), ...rec };
    _drStore = [full, ..._drStore];
    pushLog({ type: "device_replaced", actor, module: "Device Replacement", detail: `Replaced ${rec.old?.purifierId || "device"} → ${rec.neu?.purifierId || "new device"} for ${rec.old?.name || "customer"}` });
    try {
      const res = await fetch(`${API_ORIGIN}/device-replacement/add`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(drPayload(full, actor)),
      });
      if (res.ok) return { saved: true, record: full };
      let message = `Server error ${res.status}`;
      try { const j = await res.json(); if (j?.message) message = j.message; } catch { /* keep status */ }
      console.warn("device-replacement/add failed:", message);
      return { saved: false, record: full, message };
    } catch (e) {
      console.warn("device-replacement/add error:", e.message);
      return { saved: false, record: full, message: "couldn't reach the server" };
    }
  },
};

// Age of the old device from install → uninstall, as { days, label:"1y 2mo" }.
function deviceAgeing(install, uninstall) {
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

const _drEmptyDevice = { name: "", phone: "", email: "", plan: "", purifierId: "", deviceType: "", installDate: "" };

function DrRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{k}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)", textAlign: "right", wordBreak: "break-word" }}>{v || "—"}</span>
    </div>
  );
}

function DeviceReplacement() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState(deviceReplaceApi.list());
  const [step, setStep] = useState(0);                 // 0=list, 1=old, 2=new, 3=confirm
  const [old, setOld] = useState({ ..._drEmptyDevice, uninstallDate: today });
  const [neu, setNeu] = useState({ ..._drEmptyDevice });
  const [view, setView] = useState(null);              // record shown in the read-only drawer
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const flash = m => { setToast(m); setTimeout(() => setToast(""), 3000); };

  useEffect(() => { api.logView(user.username, "Viewed Device Replacement"); }, []);

  const reset = () => { setOld({ ..._drEmptyDevice, uninstallDate: today }); setNeu({ ..._drEmptyDevice }); setStep(0); };
  const oldValid = old.name.trim() && old.phone.trim() && old.purifierId.trim() && old.deviceType && old.installDate;
  const newValid = neu.name.trim() && neu.phone.trim() && neu.purifierId.trim() && neu.deviceType && neu.installDate;

  const commit = async () => {
    const ageing = deviceAgeing(old.installDate, old.uninstallDate);
    setSaving(true);
    try {
      const { saved, message } = await deviceReplaceApi.create(user.username, { old, neu, ageing });
      setRecords(deviceReplaceApi.list());
      reset();
      flash(saved ? "Replacement saved to the database ✓" : `Saved locally — ${message}`);
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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap", background: "linear-gradient(135deg,var(--forest) 0%, var(--teal-d) 100%)", color: "#eaf5ee", borderRadius: "var(--radius)", padding: "18px 22px", boxShadow: "var(--shadow)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.35),transparent 70%)" }} />
        <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flexShrink: 0 }}><Repeat size={24} color="#fff" /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Device Replacement</div>
          <div style={{ fontSize: 12.5, color: "#bfe0cb" }}>Swap an old purifier for a new one · {swaps} recorded · records are final</div>
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
        {records.length === 0 && <Empty msg="No replacements recorded yet. Click “New Entry” to start." />}
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
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "#fbe9e9", color: "#b4232a", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><AlertCircle size={26} /></div>
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
              <button onClick={commit} disabled={saving} style={{ ...btnPrimary, flex: 1, background: "#b4232a", boxShadow: "0 8px 18px -8px rgba(180,35,42,.6)", opacity: saving ? .7 : 1 }}><CheckCircle2 size={16} /> {saving ? "Saving…" : "Confirm & save"}</button>
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

      {toast && <div style={{ ...toastStyle, background: /couldn't|local/i.test(toast) ? "#9a6a16" : toastStyle.background }}>{/couldn't|local/i.test(toast) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   ABOUT — version badge + scrollable changelog + searchable module docs
   =========================================================================== */
const MODULE_DOCS = [
  { id: "sales", label: "Sales", summary: "Zoho CRM leads: pipeline, leads & deals, analytics, error correction, apartment leads.", points: ["Live leads via /admin/zoho/get-all-leads (per_page 500)", "Kanban pipeline + full leads table with status filter", "Apartment × lead-status pivot", "Error Correction flags installed leads missing money fields"], source: "/admin/zoho/get-all-leads" },
  { id: "customer", label: "Customer", summary: "Zoho Billing customer accounts, plans and credits.", points: ["Paginated customer list with search", "Editable plan/billing per role", "Grand-total row on plan amount"], source: "/admin/get-all-customers" },
  { id: "billing", label: "Billing & Subscription", summary: "Subscriptions, invoices, deposits and analytics.", points: ["Subscriptions + invoices from Zoho Billing", "Earned Revenue & Apartment Performance analytics", "Deposits & refunds"], source: "/admin/get-all-subscriptions · /admin/get-all-invoices" },
  { id: "erp", label: "ERP & Inventory", summary: "Purifier asset lifecycle, cost & depreciation.", points: ["Asset register with book value", "Cost / depreciation totals"], source: "local" },
  { id: "fsm", label: "FSM System", summary: "Field service: technician tracking, AMC, water quality.", points: ["Track technician location", "AMC / maintenance schedule"], source: "local" },
  { id: "iot", label: "IoT Core", summary: "Live device telemetry — pressure, flow, valve state.", points: ["Device monitor with status polling", "Valve + channel telemetry"], source: "AWS IoT API" },
  { id: "referral", label: "Referral", summary: "Referrers, referees, credits and the rewards tracker.", points: ["Referral momentum charts", "Credit approvals + backtrack"], source: "/api/admin/all-referrals" },
  { id: "ticketing", label: "Ticketing", summary: "Freshdesk support tickets & resolution.", points: ["Ticket list with status/priority", "Create Freshdesk tickets"], source: "Freshdesk API" },
  { id: "autoscheduler", label: "Auto Scheduler", summary: "15-day general-service scheduling with auto-raised tickets. Local-first.", points: ["CRO type, backwash & dozing tracking", "Auto Freshdesk ticket on day 14", "Does NOT flag Server Down (local-first)"], source: "local seed / optional /api/gs-schedules" },
  { id: "analytics", label: "Analytics", summary: "Cross-module reporting: referral, sales, billing, earned revenue, apartment performance.", points: ["Referral + Sales insights", "Earned Revenue (day-based accrual)", "Apartment Performance by society / purifier"], source: "aggregates" },
  { id: "employee", label: "Employee", summary: "Add & manage dashboard users; login matches email → user for role/access.", points: ["Create / disable users", "Role & module access control"], source: "localStorage pw_users" },
  { id: "logtracker", label: "Logs Tracker", summary: "Audit trail with IP/geo, version stamp, and an API Failures monitor.", points: ["Every log stamped with app version", "Clear log + CSV export", "Failures tab + Server Down popup + email alerts"], source: "localStorage pw_logs / pw_failures" },
  { id: "devicereplace", label: "Device Replacement", summary: "Record an old→new purifier swap via a 3-step irreversible wizard.", points: ["Captures old + new device details", "Computes old-device ageing", "Records are final (no edit/undo)"], source: "local (in-memory)" },
  { id: "about", label: "About", summary: "This page — version history and per-module documentation.", points: ["Full changelog", "Searchable module docs"], source: "in-app" },
];

function AboutModule() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  useEffect(() => { api.logView(user.username, "Viewed About"); }, []);
  const docs = MODULE_DOCS.filter(d => (d.label + " " + d.summary + " " + d.points.join(" ")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--forest)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
          <Info size={15} /> ProWater Dashboard v{APP_VERSION}
        </div>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Released {fmtDate(VERSION_DATE)} · {VERSION_HISTORY.length} versions</span>
      </div>
      <style>{`
        .about-doc{transition:transform .15s ease, box-shadow .15s ease}
        .about-doc:hover{transform:translateY(-3px);box-shadow:0 14px 30px -16px rgba(13,40,24,.35)}
        .cl-card{transition:transform .15s ease, box-shadow .15s ease}
        .cl-card:hover{transform:translateY(-3px)}
      `}</style>

      {/* Changelog — horizontal timeline strip, newest first (left → right) */}
      <Card title="Changelog" sub="Every version, newest first — scroll right for older builds">
        <div className="scroll-thin" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x proximity" }}>
          {VERSION_HISTORY.map((h, i) => {
            const latest = i === 0;
            return (
              <div key={h.v} className="cl-card" style={{
                flex: "0 0 240px", scrollSnapAlign: "start", borderRadius: 14, padding: 16, position: "relative", overflow: "hidden",
                background: latest ? "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)" : "#fff",
                color: latest ? "#eaf5ee" : "inherit", border: latest ? "none" : "1px solid var(--border)", boxShadow: "var(--shadow)"
              }}>
                {latest && <div style={{ position: "absolute", right: -18, top: -18, width: 80, height: 80, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.4),transparent 70%)" }} />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 22, color: latest ? "#fff" : "var(--f)", lineHeight: 1 }}>v{h.v}</span>
                  {latest
                    ? <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--forest)", background: "var(--lime)", padding: "2px 8px", borderRadius: 999 }}>Current</span>
                    : <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>#{VERSION_HISTORY.length - i}</span>}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: latest ? "#c9e4d3" : "var(--slate)" }}>{h.note}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Module documentation cards */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 17 }}>Modules</h3>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>What each module does & where its data comes from</span>
          <div style={{ marginLeft: "auto", minWidth: 220, flex: "0 1 300px" }}>
            <Toolbar q={q} setQ={setQ} placeholder="Search modules…" count={docs.length} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {docs.map(d => {
            const m = MODULES.find(x => x.id === d.id);
            const Icon = (m && MODULE_ICONS[m.icon]) || Info;
            const color = m?.color || "#5a7863";
            return (
              <div key={d.id} className="about-doc" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow)", overflow: "hidden" }}>
                <div style={{ height: 4, background: color }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: color + "1a", color, display: "grid", placeItems: "center" }}><Icon size={18} /></div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--f)" }}>{d.label}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--slate)", marginBottom: 8, lineHeight: 1.5 }}>{d.summary}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                    {d.points.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                  {d.source && <div style={{ marginTop: 10, fontSize: 10.5, color: color, background: color + "12", display: "inline-block", padding: "3px 8px", borderRadius: 7, fontFamily: "ui-monospace,monospace", wordBreak: "break-word" }}>{d.source}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {docs.length === 0 && <Empty msg="No modules match." />}
      </div>
    </div>
  );
}

/* ===========================================================================
   User management (admin only)
   =========================================================================== */
function UsersAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => api.getUsers().then(setRows);
  useEffect(() => { api.logView(user.username, "Viewed User Management"); refresh(); }, []);
  if (!rows) return <Loading />;

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
                    <span key={m.id} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: u.access[m.id] === "admin" ? "var(--mint-2)" : "#eef1f4", color: u.access[m.id] === "admin" ? "var(--teal)" : "var(--slate)" }}>
                      {m.label.split(" ")[0]}{u.access[m.id] === "admin" ? " ✦" : ""}
                    </span>
                  ))}
                  {(!u.access || MODULES.every(m => (u.access?.[m.id] || "none") === "none")) && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>None</span>}
                </div>
              </td>
              <td style={td}><Status s={u.active ? "active" : "disabled"} /></td>
              <td style={td}>{fmtDate(u.created)}</td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                <button onClick={() => setResetFor(u)} style={iconBtn} title="Reset password"><KeyRound size={15} /></button>
                <button onClick={async () => { await api.toggleUser(user.username, u.id); refresh(); flash("User updated"); }} style={iconBtn} title="Enable / disable">
                  {u.active ? <Lock size={15} /> : <CheckCircle2 size={15} />}
                </button>
                {u.username !== user.username && <button onClick={async () => { if (confirm(`Remove ${u.username}?`)) { await api.deleteUser(user.username, u.id); refresh(); flash("User removed"); } }} style={{ ...iconBtn, color: "#b4232a" }} title="Delete"><Trash2 size={15} /></button>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {creating && <CreateUser onClose={() => setCreating(false)} onDone={() => { refresh(); flash("User created"); }} actor={user.username} />}
      {resetFor && <ResetPw target={resetFor} onClose={() => setResetFor(null)} onDone={() => flash("Password reset")} actor={user.username} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

function CreateUser({ onClose, onDone, actor }) {
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "", role: "viewer",
    access: Object.fromEntries(MODULES.map(m => [m.id, "none"])),
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAccess = (id, lvl) => setForm(f => ({ ...f, access: { ...f.access, [id]: lvl } }));

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

  const LEVELS = [
    { v: "none", label: "None" },
    { v: "view", label: "View" },
    { v: "supervisor", label: "Supervisor" },
    { v: "admin", label: "Admin" },
    { v: "devops", label: "DevOps" },
  ];

  return (
    <Modal onClose={onClose} title="Create new user">
      <Field label="Full name"><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jane Doe" /></Field>
      <Field label="User ID"><input style={inp} value={form.username} onChange={e => set("username", e.target.value)} placeholder="jane" autoCapitalize="none" autoCorrect="off" /></Field>
      <Field label="Email address"><input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@prowater.in" autoCapitalize="none" autoCorrect="off" /></Field>
      <Field label="Temporary password"><input style={inp} value={form.password} onChange={e => set("password", e.target.value)} placeholder="min 6 characters" /></Field>

      <div style={{ marginBottom: 14 }}>
        <span style={{ display: "block", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>Module access</span>
        <div style={{ display: "grid", gap: 8 }}>
          {MODULES.map(m => (
            <div key={m.id} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--f)", marginBottom: 8 }}>{m.label}{(!m.built || m.soon) && <span style={{ fontSize: 9, color: "#9a6a16", marginLeft: 6 }}>SOON</span>}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LEVELS.map(l => (
                  <button key={l.v} onClick={() => setAccess(m.id, l.v)} style={{
                    padding: "5px 11px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                    border: `1.5px solid ${form.access[m.id] === l.v ? "var(--teal)" : "var(--border)"}`,
                    background: form.access[m.id] === l.v ? "var(--mint-2)" : "#fff",
                    color: form.access[m.id] === l.v ? "var(--teal)" : "var(--muted)",
                  }}>{l.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Modules set above None appear on the user's home screen. View = read-only · Supervisor = edit allowed fields · Admin/DevOps = full control.</p>
      </div>

      {err && <div style={{ color: "#b4232a", fontSize: 13, display: "flex", gap: 6, alignItems: "center", margin: "2px 0 10px" }}><AlertCircle size={15} />{err}</div>}
      <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", opacity: busy ? .7 : 1 }}>{busy ? "Creating…" : "Create user"}</button>
    </Modal>
  );
}

function ResetPw({ target, onClose, onDone, actor }) {
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

/* ===========================================================================
   Reusable UI bits
   =========================================================================== */
function Drop() {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--grad-btn)", display: "grid", placeItems: "center", boxShadow: "0 6px 14px -6px rgba(168,217,64,.6)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12Z" fill="#fff" /></svg>
    </div>
  );
}

function Stat({ label, value, icon: Icon, sub, hero, delta }) {
  // Optional MoM delta badge: green ▲ for up, red ▼ for down (lightened on hero).
  const hasDelta = delta != null && Number.isFinite(delta);
  const up = hasDelta && delta > 0, down = hasDelta && delta < 0;
  const deltaColor = hero
    ? (up ? "#a8d940" : down ? "#ff9a9a" : "#c3f0cf")
    : (up ? "#1f7a3f" : down ? "#b4232a" : "#6a7670");
  return (
    <div style={{
      background: hero ? "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)" : "#fff",
      color: hero ? "#eaf5ee" : "inherit", border: hero ? "none" : "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)", position: "relative", overflow: "hidden"
    }}>
      {hero && <div style={{ position: "absolute", right: -20, top: -20, width: 90, height: 90, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.4),transparent 70%)" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span className="eyebrow" style={{ color: hero ? "var(--lime)" : "var(--muted)" }}>{label}</span>
        <Icon size={18} color={hero ? "var(--lime)" : "var(--teal)"} />
      </div>
      <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: hero ? "#fff" : "var(--f)", margin: "8px 0 2px", lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: hero ? "#a9c9b6" : "var(--muted)" }}>{sub}</div>
        {hasDelta && <span style={{ fontSize: 11.5, fontWeight: 700, color: deltaColor, whiteSpace: "nowrap" }}>
          {up ? "▲" : down ? "▼" : "—"} {up ? "+" : ""}{delta}%
        </span>}
      </div>
    </div>
  );
}

function Card({ title, sub, children, pad = true, style }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden", ...style }}>
      {title && <div style={{ padding: "16px 18px 8px" }}>
        <h3 style={{ fontSize: 17 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
      </div>}
      <div style={{ padding: pad ? (title ? "0 18px 18px" : 18) : 0 }}>{children}</div>
    </div>
  );
}

/* ===========================================================================
   Profile photo uploader (Take photo / Choose file) — saved to browser storage
   =========================================================================== */
function PhotoUploader({ username, current, onClose, onSaved }) {
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
            <video ref={videoRef} style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "1", objectFit: "cover" }} muted playsInline />
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
            {err && <div style={{ color: "#b4232a", fontSize: 13, margin: "6px 0", display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={15} />{err}</div>}
            <button onClick={save} disabled={busy || !preview} style={{ ...btnPrimary, width: "100%", marginTop: 8, opacity: (busy || !preview) ? .6 : 1 }}>{busy ? "Saving…" : "Save photo"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===========================================================================
   Tracker — search a referrer by phone, show their tier + progress (animated)
   Tiers are based on CONVERTED referrals.
   =========================================================================== */
const TIERS = [
  { key: "none", label: "No tier yet", min: 0, color: "#869089", bg: "#eceeed" },
  { key: "bronze", label: "Bronze Tier", min: 1, color: "#a9712e", bg: "#f6ecdf" },
  { key: "silver", label: "Silver Tier", min: 2, color: "#6c7a86", bg: "#eef1f4" },
  { key: "gold", label: "Gold Tier", min: 6, color: "#b8860b", bg: "#fbf3d6" },
];
function tierFor(converted) {
  let t = TIERS[0];
  for (const tier of TIERS) if (converted >= tier.min) t = tier;
  return t;
}
function nextTier(converted) {
  return TIERS.find(t => t.min > converted) || null;
}

// Build a WhatsApp click-to-chat link with a pre-filled pitch.
function waLink(phone, text) {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function pitchFor(r) {
  const next = nextTier(r.converted || 0);
  const need = next ? next.min - (r.converted || 0) : 0;
  if (next && need > 0) {
    return `Hi ${r.name}, thanks for being a ProWater customer! You're just ${need} successful referral${need !== 1 ? "s" : ""} away from ${next.label} and more free months. Refer friends with your code ${r.code} and earn rewards. 💧`;
  }
  return `Hi ${r.name}, thanks for being a top ProWater referrer! Keep referring friends with your code ${r.code} to keep earning free months. 💧`;
}

/* ===========================================================================
   SALES MODULE (sample data) — Pipeline, Leads & Deals, Sales Analytics
   =========================================================================== */
const inr = (n) => "₹" + (n || 0).toLocaleString("en-IN");

function SalesPipeline() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  useEffect(() => { api.logView(user.username, "Viewed Sales pipeline"); salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([])); }, []);
  if (!deals) return <Loading />;

  const open = deals.filter(d => !["won", "lost"].includes(d.stage));
  const won = deals.filter(d => d.stage === "won");
  const openValue = open.reduce((s, d) => s + d.value, 0);
  const wonValue = won.reduce((s, d) => s + d.value, 0);
  const winRate = (won.length + deals.filter(d => d.stage === "lost").length) > 0
    ? Math.round(won.length / (won.length + deals.filter(d => d.stage === "lost").length) * 100) : 0;

  const stats = [
    { label: "Open deals", value: open.length, icon: Briefcase, sub: inr(openValue) + " in pipeline", hero: true },
    { label: "Won this period", value: won.length, icon: CheckCircle2, sub: inr(wonValue) + " closed" },
    { label: "Win rate", value: winRate + "%", icon: TrendingUp, sub: "won / decided" },
    { label: "Total leads", value: deals.length, icon: Users, sub: "all stages" },
  ];

  return (
    <div className="fade-up">
      <div style={grid4}>
        {stats.map((s, i) => <Stat key={i} {...s} />)}
      </div>

      {/* Kanban columns */}
      <div className="scroll-thin" style={{ display: "flex", gap: 14, overflowX: "auto", marginTop: 18, paddingBottom: 8 }}>
        {SALES_STAGES.map(stage => {
          const items = deals.filter(d => d.stage === stage.id);
          const val = items.reduce((s, d) => s + d.value, 0);
          return (
            <div key={stage.id} style={{ flex: "0 0 240px", background: "var(--mint)", borderRadius: 14, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13, color: "var(--f)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: stage.color }} />{stage.label}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{items.length}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>{inr(val)}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {items.map(d => (
                  <div key={d.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--f)" }}>{d.customer}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 6px" }}>{d.society}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{inr(d.value)}</span>
                      <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.plan.replace("Home ", "").replace("Plus ", "+")}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", padding: 10 }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Palette for the lead-status cards / badges, keyed by mapped pipeline stage.
const LEAD_STATUS_COLOR = { new: "#5a7863", contacted: "#9a6a16", demo: "#3a6ea5", proposal: "#16545c", won: "#1f7a3f", lost: "#b4232a" };

function SalesLeads({ isAdmin }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // filters on rawStatus (Lead Status)
  const [range, setRange] = useState({ from: "", to: "" });  // date filter on created
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const PER_PAGE = 25;
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });

  const refresh = () => salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([]));
  useEffect(() => { api.logView(user.username, "Viewed Sales leads"); refresh(); }, []);
  useEffect(() => { setPage(1); }, [q, statusFilter, range]);
  if (!deals) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, newStage) => { await salesApi.updateStage(user.username, id, newStage); await refresh(); flash("Stage updated"); };
  const colorOf = (d) => LEAD_STATUS_COLOR[d.stage] || "#869089";

  // Date filter first — cards & dropdown counts reflect the selected window.
  const inR = rangeFilter(range);
  const dateScoped = deals.filter(d => inR(d.created));

  // Distinct Lead Status values + counts (over the date-scoped set).
  const statusCounts = {};
  dateScoped.forEach(d => { const s = d.rawStatus || "—"; statusCounts[s] = (statusCounts[s] || 0) + 1; });
  const statuses = Object.keys(statusCounts).sort((a, b) => statusCounts[b] - statusCounts[a]);
  const stageForStatus = (s) => (deals.find(d => d.rawStatus === s) || {}).stage;

  // Total leads within the date window.
  const totalLeads = dateScoped.length;

  const filtered = dateScoped.filter(d =>
    (d.customer + d.society + d.phone + (d.email || "") + (d.flatNo || "") + (d.referralCode || "")).toLowerCase().includes(q.toLowerCase())
    && (statusFilter === "all" || d.rawStatus === statusFilter));

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.created).getTime(), tb = new Date(b.created).getTime();
    const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
    return (va - vb) * (sort.dir === "asc" ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const startIdx = (curPage - 1) * PER_PAGE;
  const pageRows = sorted.slice(startIdx, startIdx + PER_PAGE);

  const exportCsv = () => exportToCsv("prowater-sales-leads.csv", [
    { label: "Full Name", get: d => d.customer }, { label: "Phone", get: d => d.phone }, { label: "Flat No", get: d => d.flatNo },
    { label: "Lead Status", get: d => d.rawStatus }, { label: "Society Name", get: d => d.society },
    { label: "Tenure", get: d => d.planTenure }, { label: "Plan Value", get: d => d.value },
    { label: "Deposit", get: d => d.deposit }, { label: "To Collect", get: d => d.amountToCollect },
    { label: "Created", get: d => d.created },
  ], filtered);

  return (
    <div className="fade-up">
      {/* Lead-status cards — click to filter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setStatusFilter("all")} title="All leads"
          style={{ textAlign: "left", cursor: "pointer", color: "#eaf5ee", border: "none", borderRadius: 12, padding: "11px 13px", background: "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)", outline: statusFilter === "all" ? "2px solid var(--lime)" : "2px solid transparent", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--lime)" }}>Total Leads</div>
          <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 23, color: "#fff", lineHeight: 1.1 }}>{totalLeads}</div>
          <div style={{ fontSize: 11, color: "#c3f0cf", fontWeight: 600 }}>in view</div>
        </button>
        {statuses.map(s => {
          const c = LEAD_STATUS_COLOR[stageForStatus(s)] || "#869089";
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(active ? "all" : s)} title="Filter by this status"
              style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid var(--border)", borderLeft: `3px solid ${c}`, borderRadius: 12, padding: "11px 13px", outline: active ? "2px solid var(--teal)" : "2px solid transparent", transition: ".15s" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
              <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 23, color: "var(--f)", lineHeight: 1.1 }}>{statusCounts[s]}</div>
            </button>
          );
        })}
      </div>

      <DateRangeFilter range={range} onChange={setRange} right={
        <span className="no-print" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}{filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </span>
      } />

      <Toolbar q={q} setQ={setQ} placeholder="Search name, society, phone, email…" count={filtered.length}
        right={<>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="all">All statuses ({dateScoped.length})</option>
            {statuses.map(s => <option key={s} value={s}>{s} ({statusCounts[s]})</option>)}
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Full Name", "Phone", "Flat No", "Lead Status", "Society Name", "Tenure", "Plan Value", "Deposit", "To Collect",
          <SortHeader key="cr" label="Created" k="created" sort={sort} onSort={toggleSort} />, ...(isAdmin ? ["Move to"] : [])]} maxHeight="calc(100vh - 400px)">
          {pageRows.map(d => (
            <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{d.customer}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.phone || "—"}</td>
              <td style={td}>{d.flatNo || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: colorOf(d), whiteSpace: "nowrap" }}>
                  {d.rawStatus || SALES_STAGES.find(s => s.id === d.stage)?.label}
                </span>
              </td>
              <td style={td}>{d.society || "—"}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.planTenure || "—"}</td>
              <td style={{ ...td, fontWeight: 600 }}>{d.value ? inr(d.value) : "—"}</td>
              <td style={td}>{d.deposit ? inr(d.deposit) : "—"}</td>
              <td style={{ ...td, fontWeight: 600, color: "var(--teal-d)" }}>{d.amountToCollect ? inr(d.amountToCollect) : "—"}</td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.created ? fmtTime(d.created) : "—"}</td>
              {isAdmin && <td style={td}>
                <select value={d.stage} onChange={e => move(d.id, e.target.value)} style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }}>
                  {SALES_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </td>}
            </tr>
          ))}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={6}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.value || 0), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.deposit || 0), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.amountToCollect || 0), 0))}</td>
              <td style={ftd}></td>
              {isAdmin && <td style={ftd}></td>}
            </tr>
          )}
        </Table>
        {sorted.length === 0 && <Empty msg="No leads match your filters." />}
        {sorted.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{startIdx + 1}–{Math.min(startIdx + PER_PAGE, sorted.length)} of {sorted.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage <= 1 ? .5 : 1, cursor: curPage <= 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /> Prev</button>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--f)" }}>Page {curPage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage >= totalPages ? .5 : 1, cursor: curPage >= totalPages ? "not-allowed" : "pointer" }}>Next <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </Card>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* §15 — Sales Analytics: apartment × lead-status pivot (join on Society Name),
   expandable to the individual leads. Charts removed; stat cards kept. */
function SalesAnalytics() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [apts, setApts] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [onlyWith, setOnlyWith] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => {
    api.logView(user.username, "Viewed Sales analytics");
    Promise.all([salesApi.getDeals(), apartmentApi.getAll()])
      .then(([d, a]) => { setDeals(d.filter(notHiddenLead)); setApts(a); })
      .catch(() => { setDeals([]); setApts([]); });
  }, []);
  if (!deals || !apts) return <Loading />;

  const inR = rangeFilter(range);
  const scopedDeals = deals.filter(d => inR(d.created));

  const leadsBySociety = {};
  scopedDeals.forEach(d => { const k = norm(d.society); (leadsBySociety[k] = leadsBySociety[k] || []).push(d); });
  const statuses = Array.from(new Set(scopedDeals.map(d => d.rawStatus || "—")));

  const seen = new Set(); const aptRows = [];
  apts.forEach(a => { const k = norm(a.name); if (a.name && !seen.has(k)) { seen.add(k); aptRows.push(a); } });

  let pivot = aptRows.map(a => {
    const leads = leadsBySociety[norm(a.name)] || [];
    const counts = {}; leads.forEach(d => { const s = d.rawStatus || "—"; counts[s] = (counts[s] || 0) + 1; });
    return { apt: a, leads, counts, total: leads.length };
  });
  const withLeadsCount = pivot.filter(p => p.total > 0).length;
  if (onlyWith) pivot = pivot.filter(p => p.total > 0);
  pivot.sort((a, b) => b.total - a.total);

  const pipelineValue = scopedDeals.filter(d => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0);
  const wonValue = scopedDeals.filter(d => d.stage === "won").reduce((s, d) => s + d.value, 0);
  const avg = Math.round(scopedDeals.reduce((s, d) => s + d.value, 0) / (scopedDeals.length || 1));
  const stats = [
    { label: "Pipeline value", value: inr(pipelineValue), icon: Briefcase, sub: "open deals", hero: true },
    { label: "Won value", value: inr(wonValue), icon: Award, sub: "closed deals" },
    { label: "Avg deal size", value: inr(avg), icon: TrendingUp, sub: "scoped deals" },
    { label: "Total deals", value: scopedDeals.length, icon: Users, sub: "in range" },
  ];

  const toggle = (k) => setExpanded(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const exportCsv = () => exportToCsv("prowater-apartment-pivot.csv",
    [{ label: "Apartment", get: p => p.apt.name }, ...statuses.map(s => ({ label: s, get: p => p.counts[s] || 0 })), { label: "Total", get: p => p.total }],
    pivot);

  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 16 }}>
        <DateRangeFilter range={range} onChange={setRange} right={
          <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--slate)", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyWith} onChange={e => setOnlyWith(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--teal)" }} />
            Only apartments with leads ({withLeadsCount})
          </label>
        } />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{pivot.length} apartment{pivot.length !== 1 ? "s" : ""} · {scopedDeals.length} leads · {statuses.length} statuses</span>
          <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
        </div>
        <Card pad={false} title="Leads by apartment × status" sub="Join key: apartment name = lead Society Name. Click a row with leads to expand.">
          <Table head={["Apartment", ...statuses, "Total"]} maxHeight="calc(100vh - 430px)">
            {pivot.map((p) => {
              const k = norm(p.apt.name);
              const open = expanded.has(k);
              return (
                <React.Fragment key={k}>
                  <tr style={{ ...trStyle, cursor: p.total > 0 ? "pointer" : "default", background: open ? "var(--mint)" : "transparent" }} onClick={() => p.total > 0 && toggle(k)}>
                    <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {p.total > 0 && <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: ".15s" }} />}
                        {p.apt.name}
                      </span>
                    </td>
                    {statuses.map(s => <td key={s} style={td}>{p.counts[s] || "—"}</td>)}
                    <td style={{ ...td, fontWeight: 700 }}>{p.total || "—"}</td>
                  </tr>
                  {open && p.total > 0 && (
                    <tr>
                      <td colSpan={statuses.length + 2} style={{ padding: "0 12px 12px" }}>
                        <div className="scroll-thin" style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                            <thead><tr>{["Customer", "Phone", "Lead Status", "Flat", "Plan Value", "Created"].map(h => <th key={h} style={{ position: "sticky", top: 0, background: "#ebf4dd", zIndex: 1, textAlign: "center", padding: "9px 12px", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#28323a", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                            <tbody>
                              {p.leads.map((d, i) => (
                                <tr key={d.id} style={{ background: i % 2 ? "#f7fbf1" : "#fff" }}>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{d.customer}</td>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, whiteSpace: "nowrap", textAlign: "center" }}>{d.phone || "—"}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "center" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, color: "#fff", background: LEAD_STATUS_COLOR[d.stage] || "#869089", whiteSpace: "nowrap" }}>{d.rawStatus || "—"}</span></td>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, textAlign: "center" }}>{d.flatNo || "—"}</td>
                                  <td style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 600, textAlign: "center" }}>{d.value ? inr(d.value) : "—"}</td>
                                  <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", textAlign: "center" }}>{d.created ? fmtTime(d.created) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </Table>
          {pivot.length === 0 && <Empty msg="No apartments to show." />}
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   TICKETING MODULE (sample data) — Overview + Tickets list with detail drawer
   =========================================================================== */
const tkStatus = (id) => TICKET_STATUSES.find(s => s.id === Number(id)) || { id, label: FD_STATUS[id] || "—", color: "#6a7670" };
const tkPriority = (id) => TICKET_PRIORITIES.find(p => p.id === Number(id)) || TICKET_PRIORITIES[0];

function TicketBadge({ id, kind }) {
  const meta = kind === "priority" ? tkPriority(id) : tkStatus(id);
  return <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: meta.color, whiteSpace: "nowrap" }}>{meta.label}</span>;
}

function TicketOverview() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState(null);
  useEffect(() => { api.logView(user.username, "Viewed Ticketing overview"); ticketApi.getTickets().then(setTickets).catch(() => setTickets([])); }, []);
  if (!tickets) return <Loading />;

  const DONE = [4, 5]; // Resolved, Closed
  const openCount = tickets.filter(t => !DONE.includes(t.status)).length;
  const urgent = tickets.filter(t => t.priority === 4 && !DONE.includes(t.status)).length;
  const resolved = tickets.filter(t => DONE.includes(t.status)).length;
  const resolveRate = tickets.length ? Math.round(resolved / tickets.length * 100) : 0;

  const stats = [
    { label: "Open tickets", value: openCount, icon: Ticket, sub: "needs attention", hero: true },
    { label: "Urgent open", value: urgent, icon: AlertCircle, sub: "high priority" },
    { label: "Resolved", value: resolved, icon: CheckCircle2, sub: "resolved or closed" },
    { label: "Resolution rate", value: resolveRate + "%", icon: TrendingUp, sub: "of all tickets" },
  ];

  const byStatus = TICKET_STATUSES.map(s => ({ name: s.label, value: tickets.filter(t => t.status === s.id).length })).filter(x => x.value > 0);
  const byCategory = Object.values(tickets.reduce((acc, t) => {
    const k = t.issueType || "—";
    acc[k] = acc[k] || { plan: k, amount: 0 };
    acc[k].amount += 1;
    return acc;
  }, {}));
  const PIE = ["#b4232a", "#9a6a16", "#3a6ea5", "#1f7a3f", "#6a7670", "#7a4fb5", "#16545c"];

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Showing sample data until the Freshdesk endpoint is live. Once connected, this reflects real tickets.
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Tickets by status" sub="Where things stand">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                {byStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Tickets by issue type" sub="What customers contact about">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 30, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="amount" name="tickets" radius={[0, 6, 6, 0]} fill="#c2671e" maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function TicketList({ isAdmin }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");

  const refresh = () => ticketApi.getTickets().then(setTickets).catch(() => setTickets([]));
  useEffect(() => { api.logView(user.username, "Viewed Tickets"); refresh(); }, []);
  if (!tickets) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, s) => { await ticketApi.updateStatus(user.username, id, s); await refresh(); setSel(p => p ? { ...p, status: s } : p); flash("Ticket updated"); };

  const filtered = tickets
    .filter(t => `${t.ticketNo} ${t.customer} ${t.subject} ${t.society} ${t.purifierId} ${t.issueType} ${t.fieldAppIssueType}`.toLowerCase().includes(q.toLowerCase())
      && (status === "all" || t.status === Number(status))
      && (priority === "all" || t.priority === Number(priority)))
    .sort((a, b) => new Date(b.updated) - new Date(a.updated));

  const exportCsv = () => exportToCsv("prowater-tickets.csv", [
    { label: "Ticket", get: t => t.id },
    { label: "Customer", get: t => t.customer },
    { label: "Society", get: t => t.society },
    { label: "Purifier ID", get: t => t.purifierId },
    { label: "Type", get: t => t.type },
    { label: "Issue Type", get: t => t.issueType },
    { label: "Field App Issue Type", get: t => t.fieldAppIssueType },
    { label: "Priority", get: t => tkPriority(t.priority).label },
    { label: "Status", get: t => tkStatus(t.status).label },
    { label: "Created", get: t => t.created },
  ], filtered);

  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search ticket #, customer, society, purifier…" count={filtered.length}
        right={<>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
            <option value="all">All priorities</option>
            {TICKET_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Ticket", "Customer", "Society", "Purifier ID", "Type", "Issue Type", "Priority", "Status", "Created", ""]} maxHeight="calc(100vh - 300px)">
          {filtered.map(t => (
            <tr key={t.id} style={trStyle} onClick={() => setSel(t)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{t.ticketNo}</td>
              <td style={td}>{t.customer}</td>
              <td style={td}>{t.society}</td>
              <td style={td}>{t.purifierId}</td>
              <td style={td}>{t.type}</td>
              <td style={td}>{t.issueType}</td>
              <td style={td}><TicketBadge id={t.priority} kind="priority" /></td>
              <td style={td}><TicketBadge id={t.status} kind="status" /></td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)" }}>{fmtTime(t.created)}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No tickets match your filters." />}
      </Card>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.subject} sub={sel.ticketNo}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <TicketBadge id={sel.priority} kind="priority" />
          <TicketBadge id={sel.status} kind="status" />
        </div>
        <DefRow k="Customer" v={sel.customer} />
        <DefRow k="Society" v={sel.society} />
        <DefRow k="Purifier ID" v={sel.purifierId} />
        <DefRow k="Type" v={sel.type} />
        <DefRow k="Issue Type" v={sel.issueType} />
        <DefRow k="Field App Issue Type" v={sel.fieldAppIssueType} />
        <DefRow k="Created" v={fmtTime(sel.created)} />
        <DefRow k="Last update" v={fmtTime(sel.updated)} />
        <div style={{ marginTop: 14, padding: 14, background: "var(--mint)", borderRadius: 12 }}>
          <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>Notes</div>
          <p style={{ fontSize: 13.5, color: "var(--slate)", lineHeight: 1.6 }}>{sel.note}</p>
        </div>
        {isAdmin && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>Update status</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TICKET_STATUSES.map(s => (
                <button key={s.id} onClick={() => move(sel.id, s.id)} style={{
                  padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  border: `1.5px solid ${sel.status === s.id ? s.color : "var(--border)"}`,
                  background: sel.status === s.id ? s.color : "#fff",
                  color: sel.status === s.id ? "#fff" : "var(--slate)",
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}
      </Drawer>}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   CUSTOMER MODULE (Zoho Billing) — list + editable detail with role gating
   accessLevel: "view" | "supervisor" | "admin" | "devops"
   =========================================================================== */
// Device type derived from the purifier ID prefix: HAC → Hot & Cold,
// OWN → Own Device, anything else → Normal Device. Empty ID = no device.
const deviceType = (purifierId) => {
  const id = String(purifierId || "").trim().toUpperCase();
  if (!id) return "";
  if (id.startsWith("HAC")) return "Hot & Cold";
  if (id.startsWith("OWN")) return "Own Device";
  return "Normal Device";
};
const DEVICE_TYPE_STYLE = {
  "Hot & Cold":    ["#c2671e", "#fdf3e0"],
  "Own Device":    ["#16545c", "#e2eff0"],
  "Normal Device": ["#4c6654", "#e6f4ea"],
};
function DeviceTypeBadge({ purifierId }) {
  const t = deviceType(purifierId);
  if (!t) return <span style={{ color: "var(--muted)" }}>—</span>;
  const [c, bg] = DEVICE_TYPE_STYLE[t] || ["#6a7670", "#eceeed"];
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{t}</span>;
}

// Show a phone number without the +91 / 91 country code — just the local digits.
const fmtPhone = (p) => {
  const digits = String(p || "").replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  return local || "—";
};

// Clickable table header that toggles ascending / descending sort on `k`.
function SortHeader({ label, k, sort, onSort }) {
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

function Customers({ accessLevel = "view" }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [subs, setSubs] = useState([]);
  const [q, setQ] = useState("");
  const [societyFilter, setSocietyFilter] = useState("all");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState("");
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" });

  // Customers + subscriptions (the latter gives us each plan's amount).
  const refresh = () => Promise.all([
    customerApi.getCustomers(),
    billingApi.getSubscriptions().catch(() => []),
  ]).then(([custs, s]) => { setRows(custs); setSubs(s); }).catch(() => setRows([]));
  useEffect(() => { api.logView(user.username, "Viewed Customers"); refresh(); }, []);
  if (!rows) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const canEditAnything = ["supervisor", "admin", "devops"].includes(accessLevel);

  // Plan amount: join subscriptions by any shared key (customer no. / zoho id / email).
  const amtByKey = {};
  subs.forEach(s => [s.customerNumber, s.zohoCustomerId, s.email].forEach(k => {
    if (k && s.amount) amtByKey[String(k).toLowerCase()] = s.amount;
  }));
  const planAmount = (c) =>
    amtByKey[String(c.id).toLowerCase()] ??
    amtByKey[String(c.zohoId).toLowerCase()] ??
    amtByKey[String(c.email).toLowerCase()] ?? null;

  // Society filter options.
  const societies = Array.from(new Set(rows.map(c => c.society).filter(Boolean))).sort();

  // Active-customers KPI + month-on-month growth in new sign-ups (by `since`).
  const activeCount = rows.filter(c => c.status === "active").length;
  const now = new Date();
  const inMonth = (dateStr, y, m) => { const d = new Date(dateStr); return !isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m; };
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const newThis = rows.filter(c => inMonth(c.since, now.getFullYear(), now.getMonth())).length;
  const newPrev = rows.filter(c => inMonth(c.since, prevMonth.getFullYear(), prevMonth.getMonth())).length;
  const hasSignupDates = newThis > 0 || newPrev > 0;
  const growthPct = newPrev === 0 ? (newThis > 0 ? 100 : 0) : Math.round((newThis - newPrev) / newPrev * 100);

  const filtered = rows.filter(c =>
    (societyFilter === "all" || c.society === societyFilter) &&
    (c.name + c.email + c.phone + c.id + c.society + (c.purifier_id || "") + deviceType(c.purifier_id)).toLowerCase().includes(q.toLowerCase()));

  // Sortable by Customer ID (natural order) and Plan Amount (numeric).
  const sorted = [...filtered];
  if (sort.key) {
    const dir = sort.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) =>
      sort.key === "amount"
        ? ((planAmount(a) || 0) - (planAmount(b) || 0)) * dir
        : String(a.id).localeCompare(String(b.id), undefined, { numeric: true }) * dir);
  }

  const exportCsv = () => exportToCsv("prowater-customers.csv", [
    { label: "Customer ID", get: c => c.id },
    { label: "Purifier ID", get: c => c.purifier_id },
    { label: "Device Type", get: c => deviceType(c.purifier_id) },
    { label: "Name", get: c => c.name },
    { label: "Email", get: c => c.email },
    { label: "Phone", get: c => c.phone },
    { label: "Society", get: c => c.society },
    { label: "Plan", get: c => c.plan },
    { label: "Plan Amount", get: c => planAmount(c) ?? "" },
    { label: "Status", get: c => c.status },
  ], filtered);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} />
        {canEditAnything
          ? <span>You can edit customer accounts ({accessLevel}). Plan & billing changes are Admin-only. Every change is logged.</span>
          : <span>View-only access — you can browse customer accounts but not edit them.</span>}
      </div>
      {/* Active-customers KPI card with month-on-month sign-up growth */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "linear-gradient(150deg,var(--forest) 0%, var(--teal-d) 100%)", color: "#eaf5ee", borderRadius: "var(--radius)", padding: 18, boxShadow: "var(--shadow)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -20, top: -20, width: 90, height: 90, borderRadius: 999, background: "radial-gradient(circle,rgba(168,217,64,.4),transparent 70%)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="eyebrow" style={{ color: "var(--lime)" }}>Active Customers</span>
            <UserRound size={18} color="var(--lime)" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "8px 0 2px" }}>
            <span style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 30, color: "#fff", lineHeight: 1 }}>{activeCount.toLocaleString("en-IN")}</span>
            <span style={{ fontSize: 12, color: "#a9c9b6" }}>of {rows.length.toLocaleString("en-IN")} total</span>
          </div>
          {hasSignupDates ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: growthPct >= 0 ? "#c3f0cf" : "#ffc9c9", display: "inline-flex", alignItems: "center", gap: 3 }}>
                {growthPct >= 0 ? "▲" : "▼"} {growthPct >= 0 ? "+" : ""}{growthPct}%
              </span>
              <span style={{ color: "#a9c9b6" }}>new sign-ups vs last month ({newThis} vs {newPrev})</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "#a9c9b6", marginTop: 4 }}>No dated sign-ups to compare month-on-month.</div>
          )}
        </div>
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Search customer, email, phone, ID…" count={filtered.length}
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={societyFilter} onChange={e => setSocietyFilter(e.target.value)} style={selectStyle}>
              <option value="all">All societies ({societies.length})</option>
              {societies.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
          </div>
        } />
      <Card pad={false}>
        <Table head={[
          <SortHeader key="id" label="Customer ID" k="id" sort={sort} onSort={toggleSort} />,
          "Purifier ID", "Device Type", "Name", "Phone", "Society",
          <SortHeader key="amt" label="Plan Amount" k="amount" sort={sort} onSort={toggleSort} />,
          "Status", ""]} maxHeight="calc(100vh - 340px)">
          {sorted.map(c => {
            const amt = planAmount(c);
            return (
            <tr key={c.id} style={trStyle} onClick={() => setSel(c)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{c.id}</td>
              <td style={td}>{c.purifier_id ? <Chip>{c.purifier_id}</Chip> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
              <td style={td}><DeviceTypeBadge purifierId={c.purifier_id} /></td>
              <td style={{ ...td, textAlign: "center" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)" }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", wordBreak: "break-word" }}>{c.email}</div>
              </td>
              <td style={td}>{fmtPhone(c.phone)}</td>
              <td style={td}>{c.society || "—"}</td>
              <td style={{ ...td, fontWeight: 600 }}>{amt != null ? inr(amt) : "—"}</td>
              <td style={td}><Status s={c.status} /></td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
            );
          })}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={6}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, c) => s + (planAmount(c) || 0), 0))}</td>
              <td style={ftd}></td><td style={ftd}></td>
            </tr>
          )}
        </Table>
        {filtered.length === 0 && <Empty msg="No customers match your search." />}
      </Card>

      {sel && <CustomerDrawer customer={sel} amount={planAmount(sel)} accessLevel={accessLevel} actor={user.username}
        onClose={() => setSel(null)}
        onSaved={(updated) => { setSel(updated); refresh(); flash("Customer updated"); }} />}
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

function CustomerDrawer({ customer, amount, accessLevel, actor, onClose, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(customer);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canEditField = (f) => f.roles.includes(accessLevel);
  const anyEditable = CUSTOMER_FIELDS.some(canEditField);

  const save = async () => {
    // Only send fields this role is allowed to edit and that actually changed.
    const changes = {};
    CUSTOMER_FIELDS.forEach(f => {
      if (canEditField(f) && form[f.key] !== customer[f.key]) changes[f.key] = form[f.key];
    });
    if (Object.keys(changes).length === 0) { setEdit(false); return; }
    setBusy(true);
    try { await customerApi.updateCustomer(actor, customer.id, changes); onSaved({ ...customer, ...changes }); setEdit(false); }
    finally { setBusy(false); }
  };

  return (
    <Drawer onClose={onClose} title={customer.name} sub={customer.id}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <Status s={customer.status} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Zoho: {customer.zohoId || "—"}</span>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>Since {customer.since}</span>
      </div>

      {!edit ? <>
        <DefRow k="Purifier ID" v={customer.purifier_id || "—"} />
        <DefRow k="Device Type" v={deviceType(customer.purifier_id) || "—"} />
        <DefRow k="Email" v={customer.email} />
        <DefRow k="Phone" v={fmtPhone(customer.phone)} />
        <DefRow k="Address" v={customer.address} />
        <DefRow k="Plan" v={customer.plan} />
        <DefRow k="Plan amount" v={amount != null ? inr(amount) : "—"} />
        <DefRow k="Billing cycle" v={customer.billing} />
        <DefRow k="Society" v={customer.society} />
        {anyEditable && (
          <button onClick={() => { setForm(customer); setEdit(true); }} style={{ ...btnPrimary, width: "100%", marginTop: 18 }}>
            <PencilLine size={16} /> Edit account
          </button>
        )}
      </> : <>
        <div style={{ display: "grid", gap: 4 }}>
          {CUSTOMER_FIELDS.map(f => {
            const allowed = canEditField(f);
            return (
              <Field key={f.key} label={f.label + (allowed ? "" : " (admin only)")}>
                {f.type === "select"
                  ? <select disabled={!allowed} value={form[f.key]} onChange={e => set(f.key, e.target.value)} style={{ ...inp, opacity: allowed ? 1 : .55, cursor: allowed ? "pointer" : "not-allowed" }}>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  : <input disabled={!allowed} type={f.type} value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)} style={{ ...inp, opacity: allowed ? 1 : .55, cursor: allowed ? "text" : "not-allowed" }} />}
              </Field>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={save} disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? .7 : 1 }}>{busy ? "Saving…" : "Save changes"}</button>
          <button onClick={() => setEdit(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>Changes are logged with your name and pushed to Zoho Billing via the backend.</p>
      </>}
    </Drawer>
  );
}

/* ===========================================================================
   BILLING & SUBSCRIPTION MODULE (Zoho Billing) — Overview, Subscriptions, Invoices
   =========================================================================== */
function BillingOverview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.logView(user.username, "Viewed Billing overview");
    Promise.all([billingApi.getSubscriptions(), billingApi.getInvoices()])
      .then(([subs, invs]) => setData({ subs, invs }))
      .catch(e => setErr(e.message || "Could not load billing data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const { subs, invs } = data;
  const activeSubs = subs.filter(s => s.status === "active").length;
  const mrr = subs.filter(s => s.status === "active").reduce((sum, s) => {
    const u = String(s.interval || "").toLowerCase();
    const monthly = u.includes("year") || u.includes("annual") ? s.amount / 12
      : u.includes("quarter") ? s.amount / 3
      : u.includes("half") ? s.amount / 6
      : s.amount; // monthly / weekly treated as-is
    return sum + monthly;
  }, 0);
  const outstanding = invs.reduce((sum, i) => sum + (i.balance || 0), 0);
  const overdue = invs.filter(i => i.status === "failed" || (i.balance > 0 && i.rawStatus?.toLowerCase() === "overdue")).length;
  const collected = invs.filter(i => i.status === "paid").reduce((sum, i) => sum + i.total, 0);

  const stats = [
    { label: "Active subscriptions", value: activeSubs, icon: RefreshCw, sub: `${subs.length} total`, hero: true },
    { label: "Est. MRR", value: inr(Math.round(mrr)), icon: TrendingUp, sub: "from active plans" },
    { label: "Outstanding", value: inr(outstanding), icon: Wallet, sub: `${overdue} overdue invoice${overdue !== 1 ? "s" : ""}` },
    { label: "Collected", value: inr(collected), icon: CheckCircle2, sub: "paid invoices" },
  ];

  const subByStatus = Object.values(subs.reduce((acc, s) => {
    acc[s.status] = acc[s.status] || { name: s.status, value: 0 };
    acc[s.status].value += 1; return acc;
  }, {}));
  const revByPlan = Object.values(subs.reduce((acc, s) => {
    const k = s.plan || "—";
    acc[k] = acc[k] || { plan: k, amount: 0 };
    if (s.status === "active") acc[k].amount += s.amount;
    return acc;
  }, {}));
  const PIE = ["#1f7a3f", "#9a6a16", "#3a6ea5", "#b4232a", "#6a7670", "#16545c"];

  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Subscriptions by status" sub="Live, paused, cancelled & more">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={subByStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                {subByStatus.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Active revenue by plan" sub="Recurring amount per plan">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revByPlan} layout="vertical" margin={{ left: 30, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="amount" name="recurring value" radius={[0, 6, 6, 0]} fill="#0f6e3f" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   Finance — recharge reconciliation & balance sheet
   Reuses the billing data (paid invoices = recharges collected; subscriptions =
   recurring commitments) to reconcile money in against active plans and to
   present a simple accrual-basis balance sheet.
   =========================================================================== */

// Term length of a subscription in months, derived from its plan code (…_6M),
// then the plan/interval text as a fallback. Defaults to 1 (monthly).
function subTermMonths(s) {
  const code = String(s.planCode || "").match(/_(\d+)\s*M\b/i);
  if (code) return Math.max(1, Number(code[1]));
  const t = `${s.plan || ""} ${s.interval || ""}`.toLowerCase();
  if (t.includes("annual") || t.includes("year") || t.includes("12")) return 12;
  if (t.includes("half") || t.includes("6")) return 6;
  if (t.includes("quarter") || t.includes("qtr") || t.includes("3")) return 3;
  return 1;
}

// Months elapsed (fractional) between an ISO date and now.
function monthsSince(iso, now) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, (now - d.getTime()) / (1000 * 60 * 60 * 24 * (365.25 / 12)));
}

const keyLc = (x) => String(x || "").toLowerCase().trim();

// Build an inclusive date-range predicate. Blank bound = open-ended; both
// blank = pass everything. Same semantics as the Billing analytics filter.
function rangeFilter(range) {
  const fromTs = range.from ? new Date(range.from + "T00:00:00").getTime() : null;
  const toTs = range.to ? new Date(range.to + "T23:59:59").getTime() : null;
  return (dateStr) => {
    if (!fromTs && !toTs) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return false;
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    return true;
  };
}

// From/To date-range bar. Keeps its own drafts and applies on "Apply".
function DateRangeFilter({ range, onChange, right }) {
  const [fromDraft, setFromDraft] = useState(range.from || "");
  const [toDraft, setToDraft] = useState(range.to || "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>From</span>
      <input type="date" value={fromDraft} onChange={e => setFromDraft(e.target.value)} style={{ ...selectStyle, padding: "6px 10px" }} />
      <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>To</span>
      <input type="date" value={toDraft} onChange={e => setToDraft(e.target.value)} style={{ ...selectStyle, padding: "6px 10px" }} />
      <button onClick={() => onChange({ from: fromDraft, to: toDraft })} style={{ ...btnPrimary, padding: "6px 16px", fontSize: 12.5 }}>Apply</button>
      {(range.from || range.to) && (
        <button onClick={() => { setFromDraft(""); setToDraft(""); onChange({ from: "", to: "" }); }} style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}>Clear</button>
      )}
      {right}
    </div>
  );
}

// Report actions: CSV download + browser Print / Save-as-PDF. Carries
// .no-print so the buttons never appear in the exported PDF.
function ExportBar({ csv }) {
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
      {csv && <button onClick={csv} style={btnGhost}><Download size={15} /> CSV</button>}
      <button onClick={() => window.print()} style={btnGhost}><Printer size={15} /> Print / PDF</button>
    </div>
  );
}

// Report title that shows only on the printed page (hidden on screen).
function PrintHead({ title, sub }) {
  return (
    <div className="print-head" style={{ marginBottom: 14, borderBottom: "2px solid #1a2f1e", paddingBottom: 8 }}>
      <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", fontWeight: 800, fontSize: 22, color: "#1a2f1e" }}>ProWater — {title}</div>
      {sub && <div style={{ fontSize: 12, color: "#46555d", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Aging bucket for a number of days past due (null/negative = not yet due).
const AGING_BUCKETS = [
  { key: "current", label: "Current",   test: (d) => d == null || d < 0, color: "#1f7a3f" },
  { key: "b1_30",   label: "1–30 days", test: (d) => d >= 0 && d <= 30,   color: "#5a7863" },
  { key: "b31_60",  label: "31–60 days", test: (d) => d >= 31 && d <= 60,  color: "#9a6a16" },
  { key: "b61_90",  label: "61–90 days", test: (d) => d >= 61 && d <= 90,  color: "#c2671e" },
  { key: "b90",     label: "90+ days",  test: (d) => d > 90,              color: "#b4232a" },
];
const bucketFor = (days) => AGING_BUCKETS.find(b => b.test(days)) || AGING_BUCKETS[0];

// "2026-06" → "Jun 2026"
const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

function ReconBadge({ state }) {
  const map = {
    matched:     ["Reconciled",      "#1f7a3f", "#e6f4ea"],
    outstanding: ["Outstanding",     "#9a6a16", "#fdf3e0"],
    overdue:     ["Overdue",         "#b4232a", "#fbe9e9"],
    unmatched:   ["No subscription", "#b4232a", "#fbe9e9"],
  };
  const [label, c, bg] = map[state] || ["—", "#6a7670", "#eceeed"];
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{label}</span>;
}

function Reconciliation() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | matched | outstanding | unmatched
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    api.logView(user.username, "Viewed Finance reconciliation");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions()])
      .then(([invs, subs]) => setData({ invs, subs }))
      .catch(e => setErr(e.message || "Could not load finance data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  // Date range scopes recharges by invoice date; the full subscription list is
  // kept for matching so every in-window invoice can still resolve its plan.
  const inR = rangeFilter(range);
  const subsAll = data.subs;
  const invs = data.invs.filter(i => inR(i.date));

  // Index subscriptions by every join key we can match an invoice on.
  const subIndex = new Map();
  subsAll.forEach(s => [s.customerNumber, s.zohoCustomerId, s.email].forEach(k => {
    if (k) subIndex.set(keyLc(k), s);
  }));
  const findSub = (iv) =>
    subIndex.get(keyLc(iv.customerNumber)) ||
    subIndex.get(keyLc(iv.zohoCustomerId)) ||
    subIndex.get(keyLc(iv.email)) || null;

  const rows = invs.map(iv => {
    const sub = findSub(iv);
    const collected = (iv.total || 0) - (iv.balance || 0);
    const state = (iv.balance || 0) > 0 ? "outstanding" : (sub ? "matched" : "unmatched");
    return { iv, sub, collected, state };
  });

  // Active subscriptions with no paid invoice on record → a recharge we expected
  // but can't see money for.
  const paidKeys = new Set(
    invs.filter(i => i.status === "paid")
      .flatMap(i => [i.customerNumber, i.zohoCustomerId, i.email].map(keyLc).filter(Boolean))
  );
  const subsMissingRecharge = subsAll.filter(s =>
    s.status === "active" && inR(s.activatedAt) &&
    ![s.customerNumber, s.zohoCustomerId, s.email].some(k => k && paidKeys.has(keyLc(k)))
  );

  const collectedTotal = rows.reduce((a, r) => a + r.collected, 0);
  const outstandingTotal = rows.reduce((a, r) => a + (r.iv.balance || 0), 0);
  const paidCount = rows.filter(r => r.iv.status === "paid").length;
  const matchedCount = rows.filter(r => r.state === "matched").length;
  const outstandingCount = rows.filter(r => r.state === "outstanding").length;
  const unmatchedCount = rows.filter(r => r.state === "unmatched").length;
  const discrepancies = unmatchedCount + subsMissingRecharge.length;

  const stats = [
    { fk: "all", label: "Recharges collected", value: inr(collectedTotal), icon: Wallet, sub: `${paidCount} paid invoice${paidCount !== 1 ? "s" : ""}`, hero: true },
    { fk: "matched", label: "Reconciled", value: matchedCount, icon: CheckCircle2, sub: "paid & linked to a plan" },
    { fk: "outstanding", label: "Outstanding", value: inr(outstandingTotal), icon: Hourglass, sub: `${outstandingCount} invoice${outstandingCount !== 1 ? "s" : ""} unpaid` },
    { fk: "unmatched", label: "Discrepancies", value: discrepancies, icon: AlertCircle, sub: `${unmatchedCount} orphan · ${subsMissingRecharge.length} missing recharge` },
  ];

  const ql = q.toLowerCase();
  const shown = rows.filter(r =>
    (filter === "all" || r.state === filter) &&
    (!ql || r.iv.customerName.toLowerCase().includes(ql) || String(r.iv.number).toLowerCase().includes(ql) || (r.iv.email || "").toLowerCase().includes(ql))
  );

  const chips = [
    ["all", `All (${rows.length})`],
    ["matched", `Reconciled (${matchedCount})`],
    ["outstanding", `Outstanding (${outstandingCount})`],
    ["unmatched", `Orphan (${unmatchedCount})`],
  ];

  const exportCsv = () => exportToCsv("prowater-reconciliation.csv", [
    { label: "Customer", get: r => r.iv.customerName },
    { label: "Email", get: r => r.iv.email },
    { label: "Invoice", get: r => r.iv.number },
    { label: "Recharge amount", get: r => (r.iv.total || 0) - depositFor(r.iv.total) },
    { label: "Term (months)", get: r => r.sub ? subTermMonths(r.sub) : 1 },
    { label: "Recharge/month", get: r => { const t = r.sub ? subTermMonths(r.sub) : 1; return Math.round(((r.iv.total || 0) - depositFor(r.iv.total)) / t); } },
    { label: "Deposit", get: r => depositFor(r.iv.total) },
    { label: "Collected", get: r => r.collected },
    { label: "Balance", get: r => r.iv.balance },
    { label: "Status", get: r => r.iv.status },
    { label: "Subscription", get: r => r.sub ? (r.sub.plan || r.sub.id) : "" },
    { label: "Reconciliation", get: r => r.state },
  ], shown);

  return (
    <div className="fade-up">
      <PrintHead title="Recharge Reconciliation" sub={(range.from || range.to) ? `${range.from || "start"} → ${range.to || "today"}` : "All time"} />
      <DateRangeFilter range={range} onChange={setRange} right={
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="no-print" style={{ fontSize: 12, color: "var(--muted)" }}>
            {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}
            {invs.length} recharge{invs.length !== 1 ? "s" : ""} in view
          </span>
          <ExportBar csv={exportCsv} />
        </div>
      } />
      <div style={grid4}>{stats.map((s) => {
        const { fk, ...stat } = s;
        return (
          <div key={fk} onClick={() => setFilter(fk)} title="Filter the table"
            style={{ cursor: "pointer", borderRadius: "var(--radius)", outline: filter === fk ? "2px solid var(--teal)" : "2px solid transparent", outlineOffset: 1, transition: "outline-color .15s" }}>
            <Stat {...stat} />
          </div>
        );
      })}</div>

      <div style={{ marginTop: 18 }}>
        <Card title="Recharge reconciliation" sub="Each invoice matched to a subscription. Outstanding = balance still due; orphan = paid with no plan on record.">
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, invoice # or email…" count={shown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {chips.map(([id, label]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{
                    padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"),
                    background: filter === id ? "var(--mint-2)" : "#fff",
                    color: filter === id ? "var(--teal-d)" : "var(--slate)"
                  }}>{label}</button>
                ))}
              </div>
            } />
          <Table head={["Customer", "Invoice", "Recharge", "Deposit", "Collected", "Balance", "Status", "Subscription", "Reconciliation"]} maxHeight={520}>
            {shown.map((r, i) => {
              const overdue = ["failed", "overdue"].includes(r.iv.status) || (r.iv.rawStatus || "").toLowerCase() === "overdue";
              const outstanding = (r.iv.balance || 0) > 0;
              // Overdue → red tint, other outstanding → amber tint.
              const bg = overdue ? "#fdf2f2" : (outstanding ? "#fdfaf0" : "transparent");
              const dep = depositFor(r.iv.total);
              const rechargeTotal = (r.iv.total || 0) - dep;
              // Term (months) from the matched plan; show per-month recharge for multi-month plans.
              const term = r.sub ? subTermMonths(r.sub) : 1;
              const perMonth = term > 1 ? Math.round(rechargeTotal / term) : null;
              return (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: bg }}>
                <td style={td}><Person name={r.iv.customerName || "—"} email={r.iv.email} /></td>
                <td style={{ ...td, textAlign: "center" }}><Chip>{r.iv.number}</Chip></td>
                <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>
                  {inr(rechargeTotal)}
                  {perMonth != null && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{inr(perMonth)}/mo · {term} mo</div>}
                </td>
                <td style={{ ...td, textAlign: "center", fontWeight: 600, color: "var(--teal-d)" }}>{inr(dep)}</td>
                <td style={{ ...td, textAlign: "center", color: "var(--teal-d)", fontWeight: 600 }}>{inr(r.collected)}</td>
                <td style={{ ...td, textAlign: "center", color: outstanding ? (overdue ? "#b4232a" : "#9a6a16") : "var(--muted)", fontWeight: 600 }}>{inr(r.iv.balance)}</td>
                <td style={{ ...td, textAlign: "center" }}><Status s={r.iv.status} /></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: r.sub ? "var(--f)" : "var(--muted)" }}>{r.sub ? (r.sub.plan || r.sub.id) : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}><ReconBadge state={overdue ? "overdue" : r.state} /></td>
              </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={9} style={{ padding: 0 }}><Empty msg="No invoices match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Active plans without a recharge" sub="Subscriptions marked active but with no paid invoice found — money we should have collected.">
          {subsMissingRecharge.length === 0
            ? <Empty msg="Every active subscription has a matching recharge. Fully reconciled." />
            : (
              <Table head={["Customer", "Subscription", "Plan", "Expected", "Next billing"]}>
                {subsMissingRecharge.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}><Person name={s.customerName || "—"} email={s.email} /></td>
                    <td style={{ ...td, textAlign: "center" }}><Chip>{s.id}</Chip></td>
                    <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{s.plan || "—"}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{inr(s.amount)}</td>
                    <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{s.nextBilling || "—"}</td>
                  </tr>
                ))}
              </Table>
            )}
        </Card>
      </div>
    </div>
  );
}

/* ---- AR Aging: outstanding balances bucketed by days past due ---- */
function ARAging() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [q, setQ] = useState("");
  const [bucketSel, setBucketSel] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Finance AR aging");
    billingApi.getInvoices()
      .then(invs => setData({ invs }))
      .catch(e => setErr(e.message || "Could not load finance data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const now = Date.now();
  const MS_DAY = 86400000;
  const inR = rangeFilter(range);

  // Outstanding invoices (balance > 0), aged by days past their due date.
  const items = data.invs
    .filter(i => (i.balance || 0) > 0 && inR(i.date))
    .map(i => {
      const due = i.dueDate ? new Date(i.dueDate).getTime() : NaN;
      const days = isNaN(due) ? null : Math.floor((now - due) / MS_DAY);
      return { ...i, _days: days, _bucket: bucketFor(days) };
    })
    .sort((a, b) => (b._days ?? -1) - (a._days ?? -1) || b.balance - a.balance);

  const totalAR = items.reduce((s, i) => s + i.balance, 0);
  const summary = AGING_BUCKETS.map(b => {
    const inB = items.filter(i => i._bucket.key === b.key);
    const amount = inB.reduce((s, i) => s + i.balance, 0);
    return { ...b, count: inB.length, amount, pct: totalAR ? (amount / totalAR) * 100 : 0 };
  });
  const overdueAmt = items.filter(i => (i._days ?? -1) >= 0).reduce((s, i) => s + i.balance, 0);
  const b90 = summary.find(b => b.key === "b90").amount;
  const weightedDays = totalAR ? Math.round(items.reduce((s, i) => s + i.balance * Math.max(0, i._days ?? 0), 0) / totalAR) : 0;

  const stats = [
    { label: "Total receivable", value: inr(totalAR), icon: Wallet, sub: `${items.length} open invoice${items.length !== 1 ? "s" : ""}`, hero: true },
    { label: "Overdue", value: inr(overdueAmt), icon: AlertCircle, sub: `${((overdueAmt / (totalAR || 1)) * 100).toFixed(0)}% of AR past due` },
    { label: "90+ days", value: inr(b90), icon: Hourglass, sub: "high-risk balance" },
    { label: "Avg days overdue", value: weightedDays + "d", icon: Clock, sub: "balance-weighted" },
  ];

  const ql = q.toLowerCase();
  const shown = items.filter(i =>
    (bucketSel === "all" || i._bucket.key === bucketSel) &&
    (!ql || `${i.customerName} ${i.email} ${i.number}`.toLowerCase().includes(ql))
  );

  const exportCsv = () => exportToCsv("prowater-ar-aging.csv", [
    { label: "Customer", get: i => i.customerName },
    { label: "Email", get: i => i.email },
    { label: "Invoice", get: i => i.number },
    { label: "Invoice date", get: i => i.date },
    { label: "Due date", get: i => i.dueDate },
    { label: "Days overdue", get: i => i._days ?? "" },
    { label: "Bucket", get: i => i._bucket.label },
    { label: "Balance", get: i => i.balance },
  ], shown);

  const daysLabel = (d) => d == null ? "no due date" : d < 0 ? `${-d}d to due` : d === 0 ? "due today" : `${d}d overdue`;

  return (
    <div className="fade-up">
      <PrintHead title="Accounts Receivable Aging" sub={(range.from || range.to) ? `${range.from || "start"} → ${range.to || "today"}` : "All time · as of today"} />
      <DateRangeFilter range={range} onChange={setRange} right={
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="no-print" style={{ fontSize: 12, color: "var(--muted)" }}>{items.length} open · {inr(totalAR)}</span>
          <ExportBar csv={exportCsv} />
        </div>
      } />
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Aging summary" sub="Outstanding balance by age bucket · click a row to filter">
          <Table head={["Bucket", "Invoices", "Amount", "% of AR"]}>
            {summary.map(b => (
              <tr key={b.key} onClick={() => setBucketSel(bucketSel === b.key ? "all" : b.key)}
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: bucketSel === b.key ? "var(--mint-2)" : "transparent" }}>
                <td style={{ ...td, textAlign: "center" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />{b.label}</span></td>
                <td style={td}>{b.count}</td>
                <td style={{ ...td, fontWeight: 600 }}>{inr(b.amount)}</td>
                <td style={td}>{b.pct.toFixed(1)}%</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>Total</td>
              <td style={{ ...td, fontWeight: 700 }}>{items.length}</td>
              <td style={{ ...td, fontWeight: 800 }}>{inr(totalAR)}</td>
              <td style={td}>100%</td>
            </tr>
          </Table>
        </Card>
        <Card title="Balance by age" sub="Where the receivables sit">
          {totalAR === 0 ? <Empty msg="No outstanding receivables." /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summary} margin={{ left: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
                <Bar dataKey="amount" name="outstanding" radius={[6, 6, 0, 0]} maxBarSize={54} isAnimationActive={false}>
                  {summary.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Open receivables" sub={bucketSel === "all" ? "All outstanding invoices" : `Filtered to ${AGING_BUCKETS.find(b => b.key === bucketSel)?.label}`}>
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, invoice # or email…" count={shown.length}
            right={bucketSel !== "all" && <button className="no-print" onClick={() => setBucketSel("all")} style={{ ...btnGhost, padding: "7px 12px" }}>Clear bucket</button>} />
          <Table head={["Customer", "Invoice", "Invoice date", "Due date", "Age", "Balance"]} maxHeight={520}>
            {shown.map((i, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}><Person name={i.customerName || "—"} email={i.email} /></td>
                <td style={{ ...td, textAlign: "center" }}><Chip>{i.number}</Chip></td>
                <td style={{ ...td, fontSize: 12.5 }}>{i.date ? fmtDate(i.date) : "—"}</td>
                <td style={{ ...td, fontSize: 12.5 }}>{i.dueDate ? fmtDate(i.dueDate) : "—"}</td>
                <td style={{ ...td, fontWeight: 600, color: i._bucket.color }}>{daysLabel(i._days)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{inr(i.balance)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} style={{ padding: 0 }}><Empty msg="No receivables in this view." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}

/* ---- Collections & DSO: billed vs collected over time ---- */
function Collections() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    api.logView(user.username, "Viewed Finance collections");
    billingApi.getInvoices()
      .then(invs => setData({ invs }))
      .catch(e => setErr(e.message || "Could not load finance data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const inR = rangeFilter(range);
  const invs = data.invs.filter(i => inR(i.date));

  const totalBilled = invs.reduce((s, i) => s + (i.total || 0), 0);
  const totalCollected = invs.reduce((s, i) => s + ((i.total || 0) - (i.balance || 0)), 0);
  const totalOutstanding = totalBilled - totalCollected;
  const efficiency = totalBilled ? (totalCollected / totalBilled) * 100 : 0;

  // DSO = outstanding / billed-per-day. Day count = selected window, else a
  // 365-day annualised basis when no range is set.
  const periodDays = (range.from && range.to)
    ? Math.max(1, Math.round((new Date(range.to) - new Date(range.from)) / 86400000))
    : 365;
  const dso = totalBilled ? Math.round(totalOutstanding / totalBilled * periodDays) : 0;

  // Billed vs collected, grouped by invoice month.
  const ym = (d) => { const x = new Date(d); return isNaN(x.getTime()) ? null : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
  const byMonth = {};
  invs.forEach(i => {
    const k = ym(i.date); if (!k) return;
    byMonth[k] = byMonth[k] || { month: k, billed: 0, collected: 0, outstanding: 0 };
    byMonth[k].billed += i.total || 0;
    byMonth[k].collected += (i.total || 0) - (i.balance || 0);
    byMonth[k].outstanding += i.balance || 0;
  });
  const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, label: monthLabel(m.month), efficiency: m.billed ? Math.round(m.collected / m.billed * 100) : 0 }));

  const stats = [
    { label: "Billed", value: inr(totalBilled), icon: Receipt, sub: `${invs.length} invoice${invs.length !== 1 ? "s" : ""}`, hero: true },
    { label: "Collected", value: inr(totalCollected), icon: CheckCircle2, sub: "cash received" },
    { label: "Collection efficiency", value: efficiency.toFixed(1) + "%", icon: TrendingUp, sub: inr(totalOutstanding) + " still due" },
    { label: "DSO", value: dso + "d", icon: Clock, sub: (range.from && range.to) ? "over selected window" : "annualised" },
  ];

  const exportCsv = () => exportToCsv("prowater-collections.csv", [
    { label: "Month", get: m => m.label },
    { label: "Billed", get: m => m.billed },
    { label: "Collected", get: m => m.collected },
    { label: "Outstanding", get: m => m.outstanding },
    { label: "Efficiency %", get: m => m.efficiency },
  ], months);

  const labelFmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : (v > 0 ? `₹${v}` : "");

  return (
    <div className="fade-up">
      <PrintHead title="Collections & DSO" sub={(range.from || range.to) ? `${range.from || "start"} → ${range.to || "today"}` : "All time"} />
      <DateRangeFilter range={range} onChange={setRange} right={
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="no-print" style={{ fontSize: 12, color: "var(--muted)" }}>{invs.length} invoice{invs.length !== 1 ? "s" : ""} in view</span>
          <ExportBar csv={exportCsv} />
        </div>
      } />
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>

      <div style={{ marginTop: 18 }}>
        <Card title="Billed vs collected by month" sub="Bars = amounts, line = collection efficiency %">
          {months.length === 0 ? <Empty msg="No invoices in this window." /> : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={months} margin={{ left: 10, right: 16, top: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 120]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="billed" name="Billed" fill="#c9dcc0" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                  <LabelList dataKey="billed" position="top" formatter={labelFmt} style={{ fontSize: 9, fill: "#8a968f" }} />
                </Bar>
                <Bar yAxisId="l" dataKey="collected" name="Collected" fill="#1f7a3f" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                  <LabelList dataKey="collected" position="top" formatter={labelFmt} style={{ fontSize: 9, fill: "#0f6e3f", fontWeight: 600 }} />
                </Bar>
                <Line yAxisId="r" type="monotone" dataKey="efficiency" name="Efficiency %" stroke="#c2671e" strokeWidth={3} dot={{ r: 4, fill: "#c2671e", stroke: "#fff", strokeWidth: 1.5 }} activeDot={{ r: 6 }} isAnimationActive={false}>
                  <LabelList dataKey="efficiency" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fill: "#c2671e", fontWeight: 700 }} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Monthly collections" sub="Billed, collected, outstanding and efficiency per month">
          <Table head={["Month", "Billed", "Collected", "Outstanding", "Efficiency"]} maxHeight={460}>
            {months.map((m, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{m.label}</td>
                <td style={td}>{inr(m.billed)}</td>
                <td style={{ ...td, color: "var(--teal-d)", fontWeight: 600 }}>{inr(m.collected)}</td>
                <td style={{ ...td, color: m.outstanding > 0 ? "#b4232a" : "var(--muted)" }}>{inr(m.outstanding)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{m.efficiency}%</td>
              </tr>
            ))}
            {months.length === 0 && <tr><td colSpan={5} style={{ padding: 0 }}><Empty msg="No data." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}

function BalanceSheet() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    api.logView(user.username, "Viewed Finance balance sheet");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions()])
      .then(([invs, subs]) => setData({ invs, subs }))
      .catch(e => setErr(e.message || "Could not load finance data."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  // Scope recharges by invoice date and plans by activation date.
  const inR = rangeFilter(range);
  const invs = data.invs.filter(i => inR(i.date));
  const subs = data.subs.filter(s => inR(s.activatedAt));
  const now = Date.now();

  // ── Assets ──────────────────────────────────────────────────────────────
  const cash = invs.reduce((a, i) => a + ((i.total || 0) - (i.balance || 0)), 0); // cash actually received from recharges
  const receivable = invs.reduce((a, i) => a + (i.balance || 0), 0);              // unpaid invoice balances
  const totalAssets = cash + receivable;

  // ── Liabilities ─────────────────────────────────────────────────────────
  // Deferred (unearned) revenue: for each active plan, the slice of the term
  // still ahead of us is money collected upfront but not yet delivered.
  const activeSubs = subs.filter(s => s.status === "active");
  const deferred = activeSubs.reduce((a, s) => {
    const term = subTermMonths(s);
    const remaining = Math.min(term, Math.max(0, term - monthsSince(s.activatedAt, now)));
    return a + (s.amount || 0) * (remaining / term);
  }, 0);
  // Refundable security deposits held against active plans (a liability to us).
  const deposits = activeSubs.reduce((a, s) => a + depositFor(s.amount), 0);
  const totalLiabilities = deferred + deposits;

  // ── Equity (balancing figure) ───────────────────────────────────────────
  const retained = totalAssets - totalLiabilities;

  const stats = [
    { label: "Total assets", value: inr(Math.round(totalAssets)), icon: Landmark, sub: "cash + receivables", hero: true },
    { label: "Deferred revenue", value: inr(Math.round(deferred)), icon: Hourglass, sub: "unearned recharge income" },
    { label: "Security deposits", value: inr(Math.round(deposits)), icon: Lock, sub: `${activeSubs.length} active plans` },
    { label: "Retained earnings", value: inr(Math.round(retained)), icon: TrendingUp, sub: "recognized to date" },
  ];

  const chartData = [
    { name: "Recognized", value: Math.round(cash + receivable - deferred - deposits < 0 ? 0 : cash - deferred) },
    { name: "Deferred", value: Math.round(deferred) },
    { name: "Deposits", value: Math.round(deposits) },
    { name: "Receivable", value: Math.round(receivable) },
  ].filter(d => d.value > 0);
  const PIE = ["#1f7a3f", "#9a6a16", "#16545c", "#3a6ea5"];

  const BRow = ({ k, v, strong }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: strong ? 13.5 : 13, color: strong ? "var(--f)" : "var(--slate)", fontWeight: strong ? 700 : 500 }}>{k}</span>
      <span style={{ fontSize: strong ? 14.5 : 13.5, fontWeight: strong ? 800 : 600, color: "var(--f)", fontVariantNumeric: "tabular-nums" }}>{inr(Math.round(v))}</span>
    </div>
  );

  const exportCsv = () => exportToCsv("prowater-balance-sheet.csv", [
    { label: "Section", get: r => r.section },
    { label: "Line item", get: r => r.item },
    { label: "Amount (₹)", get: r => r.value },
  ], [
    { section: "Assets", item: "Cash from recharges (collected)", value: Math.round(cash) },
    { section: "Assets", item: "Accounts receivable (unpaid invoices)", value: Math.round(receivable) },
    { section: "Assets", item: "Total assets", value: Math.round(totalAssets) },
    { section: "Liabilities", item: "Deferred revenue (unearned)", value: Math.round(deferred) },
    { section: "Liabilities", item: "Refundable security deposits", value: Math.round(deposits) },
    { section: "Equity", item: "Retained earnings (recognized)", value: Math.round(retained) },
    { section: "Total", item: "Total liabilities & equity", value: Math.round(totalLiabilities + retained) },
  ]);

  return (
    <div className="fade-up">
      <PrintHead title="Balance Sheet (recharges)" sub={(range.from || range.to) ? `${range.from || "start"} → ${range.to || "today"}` : "All time"} />
      <DateRangeFilter range={range} onChange={setRange} right={
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="no-print" style={{ fontSize: 12, color: "var(--muted)" }}>
            {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : "All time · "}
            {invs.length} invoice{invs.length !== 1 ? "s" : ""} · {subs.length} plan{subs.length !== 1 ? "s" : ""}
          </span>
          <ExportBar csv={exportCsv} />
        </div>
      } />
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>

        <Card title="Assets" sub="What the recharge book owns">
          <BRow k="Cash from recharges (collected)" v={cash} />
          <BRow k="Accounts receivable (unpaid invoices)" v={receivable} />
          <BRow k="Total assets" v={totalAssets} strong />
        </Card>

        <Card title="Liabilities & Equity" sub="Obligations plus what's been earned">
          <BRow k="Deferred revenue (unearned)" v={deferred} />
          <BRow k="Refundable security deposits" v={deposits} />
          <BRow k="Retained earnings (recognized)" v={retained} />
          <BRow k="Total liabilities & equity" v={totalLiabilities + retained} strong />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <Card title="Recharge revenue split" sub="Recognized vs deferred vs deposits held">
          {chartData.length === 0 ? <Empty msg="No recharge activity yet." /> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                  {chartData.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip content={<TT prefix="₹" />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="How this is calculated" sub="Accrual basis assumptions">
          <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6 }}>
            <p style={{ margin: "2px 0 10px" }}><b>Cash</b> is the amount actually received on every invoice (total − balance). <b>Receivables</b> are the unpaid balances still owed.</p>
            <p style={{ margin: "0 0 10px" }}><b>Deferred revenue</b> prorates each active plan over its term (from the plan code, e.g. <code>_6M</code>) — the months still ahead are money collected but not yet earned.</p>
            <p style={{ margin: "0 0 10px" }}><b>Security deposits</b> are refundable, so they sit as a liability. <b>Retained earnings</b> is the balancing figure — revenue recognized to date.</p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12.5 }}>Assets always equal liabilities + equity by construction.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Subscriptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState(null);

  useEffect(() => { api.logView(user.username, "Viewed Subscriptions"); billingApi.getSubscriptions().then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <Loading />;

  const filtered = rows.filter(s =>
    (`${s.customerName} ${s.email} ${s.phone} ${s.id} ${s.plan} ${s.customerNumber}`).toLowerCase().includes(q.toLowerCase())
    && (status === "all" || s.status === status));

  const exportCsv = () => exportToCsv("prowater-subscriptions.csv", [
    { label: "Subscription", get: s => s.id },
    { label: "Customer", get: s => s.customerName },
    { label: "Customer #", get: s => s.customerNumber },
    { label: "Email", get: s => s.email },
    { label: "Phone", get: s => s.phone },
    { label: "Plan", get: s => s.plan },
    { label: "Amount", get: s => s.amount },
    { label: "Interval", get: s => s.interval },
    { label: "Status", get: s => s.rawStatus || s.status },
    { label: "Next billing", get: s => s.nextBilling },
  ], filtered);

  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search subscription, customer, plan…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Trial / Future</option>
            <option value="paused">Past due / Paused</option>
            <option value="failed">Cancelled</option>
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Subscription", "Customer", "Plan", "Amount", "Interval", "Status", "Next billing", ""]} maxHeight="calc(100vh - 300px)">
          {filtered.map(s => (
            <tr key={s.id} style={trStyle} onClick={() => setSel(s)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{s.id}</td>
              <td style={td}><Person name={s.customerName || "—"} email={s.email} /></td>
              <td style={td}>{s.plan || "—"}</td>
              <td style={td}>{inr(s.amount)}</td>
              <td style={td}>{s.interval || "—"}</td>
              <td style={td}><Status s={s.status} /></td>
              <td style={td}>{s.nextBilling ? fmtDate(s.nextBilling) : "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={3}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.amount || 0), 0))}</td>
              <td style={ftd}></td><td style={ftd}></td><td style={ftd}></td><td style={ftd}></td>
            </tr>
          )}
        </Table>
        {filtered.length === 0 && <Empty msg="No subscriptions match your filters." />}
      </Card>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.customerName || sel.id} sub={sel.id}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <Status s={sel.status} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Zoho: {sel.zohoId || "—"}</span>
        </div>
        <DefRow k="Customer number" v={sel.customerNumber || "—"} />
        <DefRow k="Email" v={sel.email || "—"} />
        <DefRow k="Phone" v={sel.phone || "—"} />
        <DefRow k="Plan" v={sel.plan || "—"} />
        <DefRow k="Plan code" v={sel.planCode || "—"} />
        <DefRow k="Amount" v={inr(sel.amount)} />
        <DefRow k="Interval" v={sel.interval || "—"} />
        <DefRow k="Raw status" v={sel.rawStatus || "—"} />
        <DefRow k="Activated" v={sel.activatedAt ? fmtDate(sel.activatedAt) : "—"} />
        <DefRow k="Next billing" v={sel.nextBilling ? fmtDate(sel.nextBilling) : "—"} />
      </Drawer>}
    </div>
  );
}

function Invoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState(null);

  useEffect(() => { api.logView(user.username, "Viewed Invoices"); billingApi.getInvoices().then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <Loading />;

  const filtered = rows.filter(i =>
    (`${i.number} ${i.customerName} ${i.email} ${i.customerNumber} ${i.plan}`).toLowerCase().includes(q.toLowerCase())
    && (status === "all" || i.status === status))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const exportCsv = () => exportToCsv("prowater-invoices.csv", [
    { label: "Invoice", get: i => i.number },
    { label: "Customer", get: i => i.customerName },
    { label: "Customer #", get: i => i.customerNumber },
    { label: "Email", get: i => i.email },
    { label: "Total", get: i => i.total },
    { label: "Security Deposit", get: i => depositFor(i.total) },
    { label: "Balance", get: i => i.balance },
    { label: "Status", get: i => i.rawStatus || i.status },
    { label: "Date", get: i => i.date },
    { label: "Due date", get: i => i.dueDate },
  ], filtered);

  return (
    <div className="fade-up">
      <Toolbar q={q} setQ={setQ} placeholder="Search invoice #, customer, email…" count={filtered.length}
        right={<>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Sent / Unpaid</option>
            <option value="failed">Overdue</option>
            <option value="disabled">Void</option>
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </>} />
      <Card pad={false}>
        <Table head={["Invoice", "Customer", "Total", "Security Deposit", "Balance", "Status", "Date", "Due", ""]} maxHeight="calc(100vh - 300px)">
          {filtered.map(i => (
            <tr key={i.id} style={trStyle} onClick={() => setSel(i)}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}><Chip>{i.number || i.id}</Chip></td>
              <td style={td}><Person name={i.customerName || "—"} email={i.email} /></td>
              <td style={td}>{inr(i.total)}</td>
              <td style={td}>{depositFor(i.total) ? inr(depositFor(i.total)) : "—"}</td>
              <td style={td}>{i.balance > 0 ? <strong style={{ color: "#b4232a" }}>{inr(i.balance)}</strong> : inr(0)}</td>
              <td style={td}><Status s={i.status} /></td>
              <td style={td}>{i.date ? fmtDate(i.date) : "—"}</td>
              <td style={td}>{i.dueDate ? fmtDate(i.dueDate) : "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><ChevronRight size={16} color="var(--muted)" /></td>
            </tr>
          ))}
          {filtered.length > 0 && (
            <tr>
              <td style={{ ...ftd, textAlign: "center" }} colSpan={2}>Total ({filtered.length})</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.total || 0), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + depositFor(r.total), 0))}</td>
              <td style={ftd}>{inr(filtered.reduce((s, r) => s + (r.balance || 0), 0))}</td>
              <td style={ftd}></td><td style={ftd}></td><td style={ftd}></td><td style={ftd}></td>
            </tr>
          )}
        </Table>
        {filtered.length === 0 && <Empty msg="No invoices match your filters." />}
      </Card>

      {sel && <Drawer onClose={() => setSel(null)} title={sel.number || sel.id} sub={sel.customerName}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <Status s={sel.status} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Zoho: {sel.zohoId || "—"}</span>
        </div>
        <DefRow k="Customer" v={sel.customerName || "—"} />
        <DefRow k="Customer number" v={sel.customerNumber || "—"} />
        <DefRow k="Email" v={sel.email || "—"} />
        <DefRow k="Plan" v={sel.plan || "—"} />
        <DefRow k="Total" v={inr(sel.total)} />
        <DefRow k="Security deposit" v={depositFor(sel.total) ? inr(depositFor(sel.total)) : "—"} />
        <DefRow k="Balance" v={inr(sel.balance)} />
        <DefRow k="Raw status" v={sel.rawStatus || "—"} />
        <DefRow k="Invoice date" v={sel.date ? fmtDate(sel.date) : "—"} />
        <DefRow k="Due date" v={sel.dueDate ? fmtDate(sel.dueDate) : "—"} />
      </Drawer>}
    </div>
  );
}

/* ===========================================================================
   DEFAULTERS — all outstanding invoices, with WhatsApp reminder (wa.me)
   =========================================================================== */
function Defaulters() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [sel, setSel] = useState(null);          // invoice chosen for messaging
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.logView(user.username, "Viewed Defaulters");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions(), customerApi.getCustomers().catch(() => [])])
      .then(([invs, subs, customers]) => setData({ invs, subs, customers }))
      .catch(() => setData({ invs: [], subs: [], customers: [] }));
  }, []);
  if (!data) return <Loading />;

  const now = new Date();
  const MS_DAY = 86400000;

  // Phone lookup. The customer endpoint carries "phone" (e.g. "+91-99004...").
  // Customers expose zoho_customer_id (.zohoId) and customer_number (.id);
  // invoices carry customer_id (.zohoCustomerId) and customerNumber. Build a
  // map keyed on every id we have, so a match lands regardless of which the
  // invoice uses. Subscriptions are a secondary source.
  const phoneByCustomer = {};
  (data.customers || []).forEach(c => {
    if (!c.phone) return;
    [c.zohoId, c.id, c.customerNumber].forEach(k => { if (k) phoneByCustomer[k] = c.phone; });
  });
  data.subs.forEach(s => {
    if (!s.phone) return;
    [s.zohoCustomerId, s.customerNumber].forEach(k => { if (k && !phoneByCustomer[k]) phoneByCustomer[k] = s.phone; });
  });
  const phoneOf = (i) => i.phone || phoneByCustomer[i.zohoCustomerId] || phoneByCustomer[i.customerNumber] || "";

  // Outstanding = any invoice with a positive balance.
  const defaulters = data.invs
    .filter(i => (i.balance || 0) > 0)
    .map(i => {
      const due = i.dueDate ? new Date(i.dueDate) : null;
      const daysOver = due && !isNaN(due) ? Math.floor((now - due) / MS_DAY) : null;
      return { ...i, _phone: phoneOf(i), _daysOver: daysOver };
    })
    .sort((a, b) => (b._daysOver ?? -1) - (a._daysOver ?? -1) || b.balance - a.balance);

  const inBucket = (d) => {
    if (bucket === "all") return true;
    const dv = d._daysOver ?? -1;
    if (bucket === "notdue") return dv < 0;
    if (bucket === "1_30") return dv >= 0 && dv <= 30;
    if (bucket === "31_60") return dv >= 31 && dv <= 60;
    if (bucket === "60plus") return dv > 60;
    return true;
  };
  const filtered = defaulters.filter(d =>
    inBucket(d) &&
    (`${d.customerName} ${d.email} ${d.number} ${d.customerNumber} ${d._phone}`).toLowerCase().includes(q.toLowerCase()));

  const totalOutstanding = defaulters.reduce((s, d) => s + d.balance, 0);
  const overdueCount = defaulters.filter(d => (d._daysOver ?? -1) >= 0).length;
  const noPhoneCount = defaulters.filter(d => !d._phone).length;

  // --- WhatsApp helpers --------------------------------------------------
  const defaultMsg = (d) => {
    const name = d.customerName ? d.customerName.split(" ")[0] : "there";
    const amt = `₹${(d.balance || 0).toLocaleString("en-IN")}`;
    const overdue = (d._daysOver ?? -1) > 0;
    return (
      `Hi ${name}, 👋\n\n` +
      `This is a gentle reminder from *ProWater* about your water purifier subscription. ` +
      `Your invoice *${d.number || d.id}* has a pending balance of *${amt}*` +
      (d.dueDate ? (overdue ? ` which was due on ${fmtDate(d.dueDate)}.` : ` due on ${fmtDate(d.dueDate)}.`) : `.`) +
      `\n\n` +
      `Kindly clear the payment at your earliest convenience to keep your service running without interruption. ` +
      `If you've already paid, please ignore this message.\n\n` +
      `For any help, just reply here. Thank you! 🙏\n— Team ProWater`
    );
  };

  // wa.me needs digits only, with country code. Assume India (91) if a bare
  // 10-digit number is supplied.
  const waNumber = (raw) => {
    let n = String(raw || "").replace(/\D/g, "");
    if (n.length === 10) n = "91" + n;
    return n;
  };
  const openWhatsApp = (d, text) => {
    const n = waNumber(d._phone);
    if (!n) return;
    const url = `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
    pushLog({ type: "defaulter_reminder", actor: user.username, module: "Billing", detail: `WhatsApp reminder opened for ${d.customerName || d.id} (${d.number || d.id}, ₹${d.balance})` });
    window.open(url, "_blank", "noopener");
    // >>> WIRE: to send automatically instead, POST to your WhatsApp Business
    //     API / backend here with { to: n, template, params } and skip window.open.
  };
  const openCompose = (d) => { setSel(d); setMsg(defaultMsg(d)); };

  const overColor = (dv) => dv == null ? "var(--muted)" : dv < 0 ? "#1f7a3f" : dv <= 30 ? "#9a6a16" : "#b4232a";
  const overLabel = (dv) => dv == null ? "—" : dv < 0 ? `${-dv}d to due` : dv === 0 ? "Due today" : `${dv}d overdue`;

  const exportCsv = () => exportToCsv("prowater-defaulters.csv", [
    { label: "Customer", get: d => d.customerName },
    { label: "Customer #", get: d => d.customerNumber },
    { label: "Phone", get: d => d._phone },
    { label: "Email", get: d => d.email },
    { label: "Invoice", get: d => d.number },
    { label: "Total", get: d => d.total },
    { label: "Balance", get: d => d.balance },
    { label: "Due date", get: d => d.dueDate },
    { label: "Days overdue", get: d => d._daysOver ?? "" },
  ], filtered);

  return (
    <div className="fade-up">
      <div style={grid4}>
        <Stat label="Total outstanding" value={inr(totalOutstanding)} icon={Wallet} sub={`${defaulters.length} invoices`} hero />
        <Stat label="Overdue" value={overdueCount} icon={AlertCircle} sub="past due date" />
        <Stat label="Defaulters" value={new Set(defaulters.map(d => d.customerNumber || d.email)).size} icon={Users} sub="unique customers" />
        <Stat label="No phone on file" value={noPhoneCount} icon={Phone} sub="can't WhatsApp" />
      </div>

      <div style={{ marginTop: 18 }}>
        <Toolbar q={q} setQ={setQ} placeholder="Search customer, invoice, phone…" count={filtered.length}
          right={<>
            <select value={bucket} onChange={e => setBucket(e.target.value)} style={selectStyle}>
              <option value="all">All</option>
              <option value="notdue">Not yet due</option>
              <option value="1_30">1–30 days overdue</option>
              <option value="31_60">31–60 days overdue</option>
              <option value="60plus">60+ days overdue</option>
            </select>
            <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
          </>} />
        <Card pad={false}>
          <Table head={["Customer", "Invoice", "Balance", "Due", "Status", "Phone", "Remind"]} maxHeight="calc(100vh - 320px)">
            {filtered.map(d => (
              <tr key={d.id} style={trStyle}>
                <td style={td}><Person name={d.customerName || "—"} email={d.email} /></td>
                <td style={td}><Chip>{d.number || d.id}</Chip></td>
                <td style={{ ...td, fontWeight: 700, color: "#b4232a" }}>{inr(d.balance)}</td>
                <td style={td}>
                  <div>{d.dueDate ? fmtDate(d.dueDate) : "—"}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: overColor(d._daysOver) }}>{overLabel(d._daysOver)}</div>
                </td>
                <td style={td}><Status s={d.status} /></td>
                <td style={td}>{d._phone || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td style={td}>
                  <button
                    onClick={() => openCompose(d)}
                    disabled={!d._phone}
                    title={d._phone ? "Compose WhatsApp reminder" : "No phone number on file"}
                    style={{
                      ...btnGhost, padding: "5px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6,
                      opacity: d._phone ? 1 : .45, cursor: d._phone ? "pointer" : "not-allowed",
                      borderColor: d._phone ? "#25D366" : "var(--border)", color: d._phone ? "#128C7E" : "var(--muted)",
                    }}>
                    <MessageCircle size={15} /> WhatsApp
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          {filtered.length === 0 && <Empty msg="No outstanding invoices match your filters." />}
        </Card>
      </div>

      {/* Compose drawer */}
      {sel && (
        <Drawer onClose={() => setSel(null)} title="WhatsApp reminder" sub={`${sel.customerName || sel.id} · ${sel.number || sel.id}`}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Chip>Balance {inr(sel.balance)}</Chip>
            {sel.dueDate && <Chip>Due {fmtDate(sel.dueDate)}</Chip>}
            <Chip>{sel._phone}</Chip>
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Message</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={7}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 16px" }}>
            Opens WhatsApp with this text prefilled. You review and hit send inside WhatsApp — nothing is sent automatically.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { openWhatsApp(sel, msg); setSel(null); }}
              style={{ ...btnPrimary, flex: 1, background: "#25D366", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <MessageCircle size={16} /> Open WhatsApp
            </button>
            <button onClick={() => setMsg(defaultMsg(sel))} style={{ ...btnGhost, flex: "0 0 auto" }}>Reset text</button>
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ===========================================================================
   CREDITS — customer unused_credits dashboard (Analytics > Credits tab)
   =========================================================================== */
function CreditsAnalytics() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Credits analytics");
    customerApi.getCustomers()
      .then(setCustomers)
      .catch(e => setErr(e.message || "Could not load customer credits."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!customers) return <Loading />;

  const planList = Array.from(new Set(customers.map(c => c.plan).filter(Boolean))).sort();

  const holders = customers
    .filter(c => planFilter === "all" || c.plan === planFilter)
    .map(c => ({ id: c.id, name: c.name, email: c.email, society: c.society || "Unknown", plan: c.plan || "—", credits: Number(c.unused_credits) || 0 }))
    .filter(c => c.credits > 0)
    .filter(c => (`${c.name} ${c.email} ${c.society} ${c.plan} ${c.id}`).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.credits - a.credits);

  const totalCredits = holders.reduce((s, c) => s + c.credits, 0);
  const creditCount = holders.length;
  const avgCredit = creditCount ? Math.round(totalCredits / creditCount) : 0;
  const maxCredit = holders.length ? holders[0].credits : 0;

  const bySociety = Object.values(holders.reduce((acc, c) => {
    const k = c.society || "Unknown";
    acc[k] = acc[k] || { society: k, credits: 0, count: 0 };
    acc[k].credits += c.credits; acc[k].count += 1;
    return acc;
  }, {})).sort((a, b) => b.credits - a.credits);

  const byPlan = Object.values(holders.reduce((acc, c) => {
    const k = c.plan || "—";
    acc[k] = acc[k] || { plan: k, credits: 0, count: 0 };
    acc[k].credits += c.credits; acc[k].count += 1;
    return acc;
  }, {})).sort((a, b) => b.credits - a.credits).slice(0, 10);

  const labelFmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${v}`;

  const exportCsv = () => exportToCsv("prowater-credits.csv", [
    { label: "Customer", get: c => c.name },
    { label: "Email", get: c => c.email },
    { label: "Society", get: c => c.society },
    { label: "Plan", get: c => c.plan },
    { label: "Unused credits", get: c => c.credits },
  ], holders);

  return (
    <div className="fade-up">
      {/* filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Plan</span>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={selectStyle}>
          <option value="all">All plans ({planList.length})</option>
          {planList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {planFilter !== "all" && <button onClick={() => setPlanFilter("all")} style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}>Reset</button>}
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>

      <div style={grid4}>
        <Stat label="Total credits outstanding" value={inr(totalCredits)} icon={Coins} sub="unused customer credits" hero />
        <Stat label="Customers with credits" value={creditCount} icon={Users} sub="holding a balance" />
        <Stat label="Avg credit / customer" value={inr(avgCredit)} icon={Wallet} sub="among those with credits" />
        <Stat label="Largest balance" value={inr(maxCredit)} icon={TrendingUp} sub="single customer" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <style>{`@media(max-width:900px){.ba-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Credits by society" sub="Where unused credits sit">
          {bySociety.length === 0 ? <Empty msg="No customer credits found." /> : (
            <ResponsiveContainer width="100%" height={Math.max(240, bySociety.slice(0, 10).length * 32 + 40)}>
              <BarChart data={bySociety.slice(0, 10)} layout="vertical" margin={{ left: 30, right: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="society" tick={axisTick} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(154,106,22,.08)" }} />
                <Bar dataKey="credits" name="Credits" radius={[0, 6, 6, 0]} fill="#9a6a16" maxBarSize={28} isAnimationActive={false}>
                  <LabelList dataKey="credits" position="right" formatter={labelFmt} style={{ fontSize: 10, fill: "var(--f)", fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Credits by plan" sub="Top plans by credit balance">
          {byPlan.length === 0 ? <Empty msg="No customer credits found." /> : (
            <ResponsiveContainer width="100%" height={Math.max(240, byPlan.length * 32 + 40)}>
              <BarChart data={byPlan} layout="vertical" margin={{ left: 30, right: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(58,110,165,.08)" }} />
                <Bar dataKey="credits" name="Credits" radius={[0, 6, 6, 0]} fill="#3a6ea5" maxBarSize={28} isAnimationActive={false}>
                  <LabelList dataKey="credits" position="right" formatter={labelFmt} style={{ fontSize: 10, fill: "var(--f)", fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Toolbar q={q} setQ={setQ} placeholder="Search customer, society, plan…" count={holders.length} />
        <Card pad={false} title="Customers holding credits" sub={`${creditCount} customers · ${inr(totalCredits)} total`}>
          <Table head={["Customer", "Society", "Plan", "Unused credits"]} maxHeight="calc(100vh - 420px)">
            {holders.map(c => (
              <tr key={c.id} style={trStyle}>
                <td style={td}><Person name={c.name || "—"} email={c.email} /></td>
                <td style={td}>{c.society}</td>
                <td style={td}>{c.plan}</td>
                <td style={{ ...td, fontWeight: 700, color: "#9a6a16" }}>{inr(c.credits)}</td>
              </tr>
            ))}
            {holders.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={3}>Total ({holders.length})</td>
                <td style={ftd}>{inr(totalCredits)}</td>
              </tr>
            )}
          </Table>
          {holders.length === 0 && <Empty msg="No customers are holding unused credits." />}
        </Card>
      </div>
    </div>
  );
}

/* ===========================================================================
   FSM — TRACK TECHNICIAN (Bengaluru map via Leaflet + OpenStreetMap, no key)
   =========================================================================== */

// Bengaluru centre + a few sample technicians. Replace SAMPLE_TECHNICIANS with
// your live technician-location API when ready (keep the same field shape).
const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };
const SAMPLE_TECHNICIANS = [
  { id: "T-01", name: "Ramesh K", status: "on_job",    lat: 12.9352, lng: 77.6245, area: "Koramangala", job: "Installation · CUS-00045" },
  { id: "T-02", name: "Suresh M", status: "available", lat: 12.9719, lng: 77.6412, area: "Indiranagar", job: "Idle" },
  { id: "T-03", name: "Anil P",   status: "on_job",    lat: 12.9081, lng: 77.6476, area: "HSR Layout",  job: "Service · CUS-00101" },
  { id: "T-04", name: "Vijay R",  status: "en_route",  lat: 13.0298, lng: 77.5400, area: "Hebbal",      job: "En route · CUS-00092" },
  { id: "T-05", name: "Manoj S",  status: "available", lat: 12.9250, lng: 77.5938, area: "Jayanagar",   job: "Idle" },
];


function TrackTechnician() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const [techs] = useState(SAMPLE_TECHNICIANS);
  const [sel, setSel] = useState(null);

  const statusColor = (s) => s === "on_job" ? "#b4232a" : s === "en_route" ? "#9a6a16" : "#1f7a3f";
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
      m.bindPopup(`<strong>${t.name}</strong><br/>${statusLabel(t.status)} · ${t.area}<br/><span style="color:#666">${t.job}</span>`);
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
          <div ref={mapRef} style={{ width: "100%", height: 520, borderRadius: 12, overflow: "hidden", background: "#e8efe9" }} />
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

/* ===========================================================================
   NET REVENUE — daily collected cash, This Month / MoM / YoY (Analytics > Revenue)
   =========================================================================== */
function NetRevenue() {
  const { user } = useAuth();
  const [invs, setInvs] = useState(null);
  const [err, setErr] = useState("");
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() }); // selected month

  useEffect(() => {
    api.logView(user.username, "Viewed Net Revenue");
    billingApi.getInvoices(true).then(setInvs).catch(e => setErr(e.message || "Could not load revenue."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!invs) return <Loading />;

  const paid = invs.filter(i => i.status === "paid" && i.date);
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Sum collected cash for a given year/month.
  const collectedIn = (y, m) => paid.reduce((s, i) => {
    const d = new Date(i.date); if (isNaN(d)) return s;
    return (d.getFullYear() === y && d.getMonth() === m) ? s + i.total : s;
  }, 0);

  const thisMonth = collectedIn(ym.y, ym.m);
  const prevM = ym.m === 0 ? { y: ym.y - 1, m: 11 } : { y: ym.y, m: ym.m - 1 };
  const prevMonth = collectedIn(prevM.y, prevM.m);
  const lastYear = collectedIn(ym.y - 1, ym.m);

  const pct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;
  const momPct = pct(thisMonth, prevMonth);
  const yoyPct = pct(thisMonth, lastYear);

  // Daily series for the selected month.
  const dim = daysInMonth(ym.y, ym.m);
  const daily = [];
  for (let day = 1; day <= dim; day++) {
    const label = String(day).padStart(2, "0");
    daily.push({ day, label, dateLabel: `${label} ${MONTHS[ym.m]}`, revenue: 0 });
  }
  paid.forEach(i => {
    const d = new Date(i.date); if (isNaN(d)) return;
    if (d.getFullYear() === ym.y && d.getMonth() === ym.m) {
      daily[d.getDate() - 1].revenue += i.total;
    }
  });
  const activeDays = daily.filter(x => x.revenue > 0).length;
  const avgPerActiveDay = activeDays ? Math.round(thisMonth / activeDays) : 0;
  const bestDay = daily.reduce((b, x) => x.revenue > (b?.revenue || 0) ? x : b, null);

  const labelFmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : (v > 0 ? `₹${v}` : "");
  const fromLabel = `01/${String(ym.m + 1).padStart(2, "0")}/${ym.y}`;
  const toLabel = `${dim}/${String(ym.m + 1).padStart(2, "0")}/${ym.y}`;

  // Month options: last 12 months.
  const monthOpts = [];
  for (let k = 0; k < 12; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    monthOpts.push({ y: d.getFullYear(), m: d.getMonth(), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }

  const Delta = ({ p }) => {
    if (p == null) return <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>— 0%</span>;
    const up = p >= 0;
    return <span style={{ fontSize: 12.5, fontWeight: 700, color: up ? "#1f7a3f" : "#b4232a" }}>{up ? "▲" : "▼"} {up ? "+" : ""}{p}%</span>;
  };

  const exportCsv = () => exportToCsv(`prowater-net-revenue-${ym.y}-${String(ym.m + 1).padStart(2, "0")}.csv`, [
    { label: "Date", get: r => r.dateLabel },
    { label: "Net Revenue", get: r => r.revenue },
  ], daily);

  return (
    <div className="fade-up">
      {/* header / controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Revenue</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--f)" }}>Net Revenue <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>· From {fromLabel} To {toLabel}</span></div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select value={`${ym.y}-${ym.m}`} onChange={e => { const [y, m] = e.target.value.split("-").map(Number); setYm({ y, m }); }} style={selectStyle}>
            {monthOpts.map(o => <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.label}</option>)}
          </select>
          <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
        </div>
      </div>

      {/* summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="nr-cards">
        <style>{`@media(max-width:760px){.nr-cards{grid-template-columns:1fr!important}}`}</style>
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>This Month</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--f)", marginTop: 6 }}>{inr(thisMonth)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{activeDays} active days · avg {inr(avgPerActiveDay)}/day</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Month on Month</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--f)", marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
            {inr(prevMonth)} <Delta p={momPct} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>vs {MONTHS[prevM.m]} {prevM.y}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Year on Year</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--f)", marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
            {inr(lastYear)} <Delta p={yoyPct} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>vs {MONTHS[ym.m]} {ym.y - 1}</div>
        </Card>
      </div>

      {/* daily bars */}
      <Card style={{ marginTop: 18 }} title="Daily net revenue" sub={bestDay && bestDay.revenue > 0 ? `Best day: ${bestDay.dateLabel} · ${inr(bestDay.revenue)}` : "Collected cash by day"}>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={daily} margin={{ left: 8, right: 12, top: 22 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={v => v >= 1000 ? `${v/1000}K` : v} />
            <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(15,110,63,.08)" }} />
            <Bar dataKey="revenue" name="Net Revenue" radius={[4, 4, 0, 0]} fill="#1f7a3f" maxBarSize={26} isAnimationActive={false}>
              <LabelList dataKey="revenue" position="top" formatter={labelFmt} style={{ fontSize: 8.5, fill: "var(--muted)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* daily breakdown table */}
      <Card pad={false} style={{ marginTop: 18 }} title="Daily breakdown" sub={`${MONTHS[ym.m]} ${ym.y} · ${inr(thisMonth)} total`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--mint-2)", fontWeight: 700, textAlign: "left", padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>Date</th>
                {daily.map(d => (
                  <th key={d.day} style={{ fontWeight: 700, color: "var(--muted)", padding: "10px 14px", fontSize: 11.5, whiteSpace: "nowrap", textAlign: "right", minWidth: 78, borderBottom: "1px solid var(--border)" }}>{d.dateLabel}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--white)", fontWeight: 700, padding: "12px 16px", fontSize: 12.5, whiteSpace: "nowrap", borderRight: "1px solid var(--border)" }}>Net Revenue</td>
                {daily.map(d => (
                  <td key={d.day} style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap", fontSize: 12.5, color: d.revenue > 0 ? "var(--f)" : "var(--muted)", fontWeight: d.revenue > 0 ? 600 : 400 }}>{inr(d.revenue)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ===========================================================================
   BILLING ANALYTICS — revenue dashboard (cash + accrual), renewals & long-term
   recharges, with clickable KPI drill-downs. (under Analytics module)
   =========================================================================== */
function BillingAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [drill, setDrill] = useState(null); // which KPI card is selected
  const [planFilter, setPlanFilter] = useState("all");
  // Date range: draft (in the inputs) vs applied (filtering happens on Update).
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    api.logView(user.username, "Viewed Billing analytics");
    Promise.all([
      billingApi.getSubscriptions(true),
      billingApi.getInvoices(true),
      customerApi.getCustomers().catch(() => []),  // for society VLOOKUP by Zoho customer id
    ])
      .then(([subs, invs, customers]) => setData({ subs, invs, customers }))
      .catch(e => setErr(e.message || "Could not load billing analytics."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  // VLOOKUP table: Zoho customer id -> { society, name, credits }. Customers
  // carry society + unused_credits; invoices/subscriptions expose customer_id
  // which equals the customer's zoho_customer_id, so we join on it.
  // VLOOKUP table keyed on BOTH zoho_customer_id and customer_number, so a
  // match lands whichever id the invoice/subscription carries.
  // Customer endpoint: zoho_customer_id + customer_number (mapped to .id).
  // Invoice/subscription endpoint: customer_id (mapped to .zohoCustomerId).
  const custByZoho = {};
  (data.customers || []).forEach(c => {
    const entry = { society: c.society || "", name: c.name || "", credits: Number(c.unused_credits) || 0, outstanding: Number(c.total_outstanding) || 0 };
    [c.zohoId, c.id, c.customerNumber].forEach(k => { if (k) custByZoho[k] = entry; });
  });
  const custOf = (rec) => {
    const keys = [rec.zohoCustomerId, rec.zohoId, rec.customerNumber];
    for (const k of keys) { if (k && custByZoho[k]) return custByZoho[k]; }
    return null;
  };
  const societyOf = (rec) => custOf(rec)?.society || rec.society || "Unknown";

  const raw = data;
  // Plan + date-range filtering. Invoices filter on invoice date; subs on
  // activation date. Range is inclusive; blank bound = open-ended.
  const fromTs = range.from ? new Date(range.from + "T00:00:00").getTime() : null;
  const toTs = range.to ? new Date(range.to + "T23:59:59").getTime() : null;
  const inRange = (dateStr) => {
    if (!fromTs && !toTs) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return false;
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    return true;
  };
  const matchPlan = (x) => planFilter === "all" || x.plan === planFilter;

  const subs = raw.subs.filter(s => matchPlan(s) && inRange(s.activatedAt));
  const invs = raw.invs.filter(i => matchPlan(i) && inRange(i.date));
  const now = new Date();
  const MS_DAY = 86400000;
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  // --- term length (in months) ------------------------------------------
  // Plan-term helpers (parseTermToken/termFromWord/monthsBetween/termMonths/
  // monthlyOf) + depositForPlan are now shared at module scope.

  // --- core figures ------------------------------------------------------
  const activeSubs = subs.filter(s => s.status === "active");
  const mrr = Math.round(activeSubs.reduce((sum, s) => sum + monthlyOf(s), 0));
  const arr = mrr * 12;

  const paid = invs.filter(i => i.status === "paid");
  const collectedAll = paid.reduce((sum, i) => sum + i.total, 0);
  const outstanding = invs.reduce((sum, i) => sum + (i.balance || 0), 0);
  const outstandingInvs = invs.filter(i => (i.balance || 0) > 0);
  const cancelled = subs.filter(s => s.status === "failed").length;
  const churnRate = subs.length ? Math.round((cancelled / subs.length) * 1000) / 10 : 0;

  // =====================================================================
  // CASH vs RECOGNIZED revenue for the CURRENT month
  // Cash  = full invoice total collected this calendar month.
  // Recog = prorated accrual: each paid invoice's amount is spread evenly
  //         across its term (months); the current month earns only the
  //         day-weighted slice from the recharge date onward.
  // =====================================================================
  const curY = now.getFullYear(), curM = now.getMonth();
  const dim = daysInMonth(curY, curM);

  // Map customerNumber -> subscription term (months), so invoices that don't
  // carry the term can borrow it from the customer's subscription.
  const termByCustomer = {};
  subs.forEach(s => { const t = termMonths(s); if (s.customerNumber && t) termByCustomer[s.customerNumber] = t; });
  const invoiceTerm = (i) => termByCustomer[i.customerNumber] || termMonths(i.interval) || 1;

  let cashThisMonth = 0;
  let recognizedThisMonth = 0;
  let deferredFromThisMonth = 0; // collected now but earned in future months

  paid.forEach(i => {
    if (!i.date) return;
    const d = new Date(i.date);
    if (isNaN(d)) return;
    const sameMonth = d.getFullYear() === curY && d.getMonth() === curM;

    // CASH: counted in the month the money was collected
    if (sameMonth) cashThisMonth += i.total;

    // RECOGNIZED: spread total across term, prorate first month by day
    const months = invoiceTerm(i);
    const perMonth = i.total / months;
    // recognized portion of the month containing the recharge date
    if (sameMonth) {
      const startDay = d.getDate();
      const earnedDays = dim - startDay + 1;     // 15 Jun..30 Jun => 16 days
      const firstMonthRecog = perMonth * (earnedDays / dim);
      recognizedThisMonth += firstMonthRecog;
      deferredFromThisMonth += (i.total - firstMonthRecog);
    } else if (months > 1) {
      // a recharge from a prior month still earns its slice this month
      // if the current month falls within its term window.
      const term0 = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthsElapsed = (curY - term0.getFullYear()) * 12 + (curM - term0.getMonth());
      if (monthsElapsed >= 1 && monthsElapsed < months) {
        recognizedThisMonth += perMonth;
      }
    }
  });
  cashThisMonth = Math.round(cashThisMonth);
  recognizedThisMonth = Math.round(recognizedThisMonth);
  deferredFromThisMonth = Math.round(deferredFromThisMonth);

  // --- monthly billed vs collected (last 6 months) -----------------------
  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (d) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const months6 = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(curY, curM - k, 1);
    months6.push({ key: monthKey(d), label: monthLabel(d), collected: 0, billed: 0 });
  }
  const idxByKey = Object.fromEntries(months6.map((m, i) => [m.key, i]));
  invs.forEach(i => {
    if (!i.date) return;
    const d = new Date(i.date); if (isNaN(d)) return;
    const k = monthKey(d);
    if (k in idxByKey) {
      months6[idxByKey[k]].billed += i.total;
      if (i.status === "paid") months6[idxByKey[k]].collected += i.total;
    }
  });
  // average collected across the 6 months (for the reference line)
  const nonZero = months6.filter(m => m.collected > 0);
  const avgCollected = nonZero.length ? Math.round(nonZero.reduce((s, m) => s + m.collected, 0) / nonZero.length) : 0;

  // --- Month-over-Month (MoM) collected, last 6 months, with % change ----
  const mom = months6.map((m, idx) => {
    const prev = idx > 0 ? months6[idx - 1].collected : 0;
    const pct = prev > 0 ? Math.round(((m.collected - prev) / prev) * 1000) / 10 : null;
    return { label: m.label, collected: m.collected, pct };
  });

  // --- Week-over-Week (WoW) collected, last 8 weeks ----------------------
  const weekStart = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; }; // Monday
  const thisWeekStart = weekStart(now);
  const weeks = [];
  for (let k = 7; k >= 0; k--) {
    const ws = new Date(thisWeekStart); ws.setDate(ws.getDate() - k * 7);
    weeks.push({ start: ws, label: `${ws.getDate()} ${ws.toLocaleDateString("en-IN", { month: "short" })}`, collected: 0 });
  }
  paid.forEach(i => {
    if (!i.date) return; const d = new Date(i.date); if (isNaN(d)) return;
    const ws = weekStart(d).getTime();
    const w = weeks.find(x => x.start.getTime() === ws);
    if (w) w.collected += i.total;
  });
  const wow = weeks.map((w, idx) => {
    const prev = idx > 0 ? weeks[idx - 1].collected : 0;
    const pct = prev > 0 ? Math.round(((w.collected - prev) / prev) * 1000) / 10 : null;
    return { label: w.label, collected: w.collected, pct };
  });

  // --- plan list for the plan-wise filter (from unfiltered data) ---------
  const planList = Array.from(new Set([...raw.subs, ...raw.invs].map(x => x.plan).filter(Boolean))).sort();

  // --- renewals due (next 30 days) ---------------------------------------
  const renewals = subs
    .filter(s => s.status !== "failed" && s.nextBilling)
    .map(s => ({ ...s, _due: new Date(s.nextBilling) }))
    .filter(s => !isNaN(s._due))
    .map(s => ({ ...s, _days: Math.ceil((s._due - now) / MS_DAY) }))
    .filter(s => s._days >= 0 && s._days <= 30)
    .sort((a, b) => a._days - b._days);
  const due7 = renewals.filter(s => s._days <= 7);
  const renewalValue = renewals.reduce((sum, s) => sum + s.amount, 0);

  // --- LONG-TERM recharges (term >= 3 months) ----------------------------
  // Sourced from SUBSCRIPTIONS, where the term is encoded in the plan name
  // (e.g. ..._6M). amount = total for the whole term (confirmed). The recharge
  // date is the activation date; recognition is prorated by day for the first
  // month, then a full per-month slice for each subsequent in-term month.
  const longTerm = subs
    .map(s => {
      const m = termMonths(s);                 // parsed from plan/code
      if (!m || m < 3) return null;
      const total = s.amount || 0;
      const perMonth = total / m;
      const d = s.activatedAt ? new Date(s.activatedAt) : null;
      let recogThis = 0, earnedToDate = 0;
      if (d && !isNaN(d)) {
        const startDay = d.getDate();
        const startDim = daysInMonth(d.getFullYear(), d.getMonth());
        const elapsed = (curY - d.getFullYear()) * 12 + (curM - d.getMonth());
        // recognized THIS month
        if (d.getFullYear() === curY && d.getMonth() === curM) {
          recogThis = perMonth * ((dim - startDay + 1) / dim);
        } else if (elapsed >= 1 && elapsed < m) {
          recogThis = perMonth;
        }
        // earned-to-date (for deferred balance)
        if (elapsed >= 0) {
          earnedToDate = perMonth * ((startDim - startDay + 1) / startDim);     // first partial month
          earnedToDate += perMonth * Math.min(Math.max(elapsed, 0), m - 1);      // whole months since
        }
      }
      const deferred = Math.max(0, total - earnedToDate);
      return {
        id: s.id, customerName: s.customerName, email: s.email, customerNumber: s.customerNumber,
        plan: s.plan, term: m, total, perMonth: Math.round(perMonth),
        recogThis: Math.round(recogThis), deferred: Math.round(deferred),
        date: s.activatedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.term - a.term || b.total - a.total);

  const ltCount = longTerm.length;
  const ltCash = longTerm.reduce((s, x) => s + x.total, 0);
  const ltByTerm = { 3: 0, 6: 0, 12: 0 };
  longTerm.forEach(x => { if (ltByTerm[x.term] != null) ltByTerm[x.term] += 1; });

  // --- KPI cards (clickable) ---------------------------------------------
  const stats = [
    { key: "mrr",       label: "MRR",              value: inr(mrr),                  icon: TrendingUp,   sub: `ARR ${inr(arr)}`,             hero: true },
    { key: "cash",      label: "Cash this month",  value: inr(cashThisMonth),        icon: Wallet,       sub: "collected (bank)" },
    { key: "recog",     label: "Recognized (MTD)", value: inr(recognizedThisMonth),  icon: CheckCircle2, sub: `${inr(deferredFromThisMonth)} deferred` },
    { key: "outstanding", label: "Outstanding",    value: inr(outstanding),          icon: AlertCircle,  sub: `${outstandingInvs.length} unpaid` },
  ];

  // --- drill-down table config per card ----------------------------------
  const drillViews = {
    outstanding: {
      title: "Outstanding customers",
      sub: `${outstandingInvs.length} invoices with a balance · ${inr(outstanding)} total`,
      head: ["Customer", "Invoice", "Total", "Balance", "Status", "Date"],
      rows: outstandingInvs.sort((a, b) => b.balance - a.balance).map(i => (
        <tr key={i.id} style={trStyle}>
          <td style={td}><Person name={i.customerName || "—"} email={i.email} /></td>
          <td style={td}><Chip>{i.number || i.id}</Chip></td>
          <td style={td}>{inr(i.total)}</td>
          <td style={{ ...td, fontWeight: 700, color: "#b4232a" }}>{inr(i.balance)}</td>
          <td style={td}><Status s={i.status} /></td>
          <td style={td}>{i.date ? fmtDate(i.date) : "—"}</td>
        </tr>
      )),
      empty: "No outstanding balances — everyone's paid up.",
    },
    cash: {
      title: "Cash collected this month",
      sub: `Invoices paid in ${monthLabel(now)} · ${inr(cashThisMonth)}`,
      head: ["Customer", "Invoice", "Amount", "Plan", "Date"],
      rows: paid.filter(i => { const d = i.date && new Date(i.date); return d && !isNaN(d) && d.getFullYear() === curY && d.getMonth() === curM; })
        .sort((a, b) => new Date(b.date) - new Date(a.date)).map(i => (
        <tr key={i.id} style={trStyle}>
          <td style={td}><Person name={i.customerName || "—"} email={i.email} /></td>
          <td style={td}><Chip>{i.number || i.id}</Chip></td>
          <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{inr(i.total)}</td>
          <td style={td}>{i.plan || "—"}</td>
          <td style={td}>{i.date ? fmtDate(i.date) : "—"}</td>
        </tr>
      )),
      empty: "No cash collected yet this month.",
    },
    recog: {
      title: "Recognized revenue this month",
      sub: `Accrual basis · prorated from recharge date · ${inr(recognizedThisMonth)} earned, ${inr(deferredFromThisMonth)} deferred`,
      head: ["Customer", "Plan", "Term", "Paid", "Per month", "Earned this month"],
      rows: longTerm.filter(x => x.recogThis > 0).concat(
          paid.filter(i => invoiceTerm(i) < 3 && i.date && new Date(i.date).getMonth() === curM && new Date(i.date).getFullYear() === curY)
            .map(i => ({ id: i.id, customerName: i.customerName, email: i.email, plan: i.plan, term: invoiceTerm(i), total: i.total, perMonth: Math.round(i.total / (invoiceTerm(i) || 1)), recogThis: Math.round((i.total / (invoiceTerm(i) || 1)) * ((dim - new Date(i.date).getDate() + 1) / dim)) }))
        )
        .sort((a, b) => b.recogThis - a.recogThis).map(x => (
        <tr key={x.id} style={trStyle}>
          <td style={td}><Person name={x.customerName || "—"} email={x.email} /></td>
          <td style={td}>{x.plan || "—"}</td>
          <td style={td}>{x.term >= 1 ? `${x.term} mo` : "—"}</td>
          <td style={td}>{inr(x.total)}</td>
          <td style={td}>{inr(x.perMonth)}</td>
          <td style={{ ...td, fontWeight: 700, color: "#0f6e3f" }}>{inr(x.recogThis)}</td>
        </tr>
      )),
      empty: "No revenue recognized this month.",
    },
    mrr: {
      title: "Active subscriptions (MRR base)",
      sub: `${activeSubs.length} active · ${inr(mrr)} monthly recurring`,
      head: ["Customer", "Plan", "Amount", "Interval", "Monthly value", "Next billing"],
      rows: activeSubs.slice().sort((a, b) => monthlyOf(b) - monthlyOf(a)).map(s => (
        <tr key={s.id} style={trStyle}>
          <td style={td}><Person name={s.customerName || "—"} email={s.email} /></td>
          <td style={td}>{s.plan || "—"}</td>
          <td style={td}>{inr(s.amount)}</td>
          <td style={td}>{s.interval || "—"}</td>
          <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{inr(Math.round(monthlyOf(s)))}</td>
          <td style={td}>{s.nextBilling ? fmtDate(s.nextBilling) : "—"}</td>
        </tr>
      )),
      empty: "No active subscriptions.",
    },
  };
  const view = drill && drillViews[drill];

  // Revenue by plan (active recurring value)
  const revByPlan = Object.values(activeSubs.reduce((acc, s) => {
    const k = s.plan || "—";
    acc[k] = acc[k] || { plan: k, value: 0 };
    acc[k].value += Math.round(monthlyOf(s));
    return acc;
  }, {})).sort((a, b) => b.value - a.value);

  // Society-wise revenue: collected cash from paid invoices, grouped by the
  // customer's society (VLOOKUP on Zoho customer id). Unmatched -> "Unknown".
  const revBySocietyMap = paid.reduce((acc, i) => {
    const soc = societyOf(i) || "Unknown";
    acc[soc] = acc[soc] || { society: soc, collected: 0, count: 0 };
    acc[soc].collected += i.total;
    acc[soc].count += 1;
    return acc;
  }, {});
  const revBySociety = Object.values(revBySocietyMap).sort((a, b) => b.collected - a.collected);
  const revBySocietyTop = revBySociety.slice(0, 10); // chart top 10
  const societyMatched = paid.length ? Math.round((paid.filter(i => societyOf(i) !== "Unknown").length / paid.length) * 100) : 0;

  // --- DISCOUNTS / CREDITS: unused_credits sitting on customer accounts -----
  // These are credits (free balance) customers hold — a liability / discount
  // pool. Sourced from the customer endpoint; filtered to plan if a plan is
  // selected (by matching the customer's plan field).
  const custForCredits = (data.customers || [])
    .filter(c => planFilter === "all" || c.plan === planFilter)
    .map(c => ({ id: c.id, name: c.name, email: c.email, society: c.society || "Unknown", plan: c.plan || "—", credits: Number(c.unused_credits) || 0 }))
    .filter(c => c.credits > 0)
    .sort((a, b) => b.credits - a.credits);
  const totalCredits = custForCredits.reduce((s, c) => s + c.credits, 0);
  const creditCount = custForCredits.length;
  const avgCredit = creditCount ? Math.round(totalCredits / creditCount) : 0;
  // credits grouped by society
  const creditsBySociety = Object.values(custForCredits.reduce((acc, c) => {
    const k = c.society || "Unknown";
    acc[k] = acc[k] || { society: k, credits: 0, count: 0 };
    acc[k].credits += c.credits; acc[k].count += 1;
    return acc;
  }, {})).sort((a, b) => b.credits - a.credits).slice(0, 10);

  const dueChipColor = (d) => d <= 3 ? "#b4232a" : d <= 7 ? "#9a6a16" : "#1f7a3f";
  const labelFmt = (v) => v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${v}`;

  return (
    <div className="fade-up">
      {/* Plan + date-range filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Plan</span>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setDrill(null); }} style={selectStyle}>
          <option value="all">All plans ({planList.length})</option>
          {planList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {planFilter !== "all" && (
          <button onClick={() => setPlanFilter("all")} style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}>Reset</button>
        )}

        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginLeft: 8 }}>From</span>
        <input type="date" value={fromDraft} onChange={e => setFromDraft(e.target.value)}
          style={{ ...selectStyle, padding: "6px 10px" }} />
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>To</span>
        <input type="date" value={toDraft} onChange={e => setToDraft(e.target.value)}
          style={{ ...selectStyle, padding: "6px 10px" }} />
        <button onClick={() => { setRange({ from: fromDraft, to: toDraft }); setDrill(null); }}
          style={{ ...btnPrimary, padding: "6px 16px", fontSize: 12.5 }}>Update</button>
        {(range.from || range.to) && (
          <button onClick={() => { setFromDraft(""); setToDraft(""); setRange({ from: "", to: "" }); }}
            style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}>Clear dates</button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}
          {subs.length} sub{subs.length !== 1 ? "s" : ""} · {invs.length} inv{invs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Clickable KPI cards */}
      <div style={grid4}>
        {stats.map((s) => (
          <div key={s.key} onClick={() => setDrill(drill === s.key ? null : s.key)}
            style={{ cursor: "pointer", borderRadius: 16, outline: drill === s.key ? "2px solid var(--brand, #0f6e3f)" : "2px solid transparent", transition: "outline-color .15s" }}>
            <Stat {...s} />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 2px 0" }}>
        Tip: click a card to drill into its customers below. {drill && <button onClick={() => setDrill(null)} style={{ ...btnGhost, padding: "2px 10px", fontSize: 12, marginLeft: 6 }}>Clear ✕</button>}
      </p>

      {/* Drill-down table (appears when a card is selected) */}
      {view && (
        <div style={{ marginTop: 16 }}>
          <Card pad={false} title={view.title} sub={view.sub}>
            <Table head={view.head} maxHeight="42vh">{view.rows}</Table>
            {view.rows.length === 0 && <Empty msg={view.empty} />}
          </Card>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <style>{`@media(max-width:900px){.ba-grid{grid-template-columns:1fr!important}}`}</style>

        <Card title="Revenue trend" sub={`Billed vs collected · last 6 months · avg ${inr(avgCollected)}`}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={months6} margin={{ left: 8, right: 12, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(58,110,165,.08)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={avgCollected} stroke="#9a6a16" strokeDasharray="5 4"
                label={{ value: `avg ${labelFmt(avgCollected)}`, position: "right", fill: "#9a6a16", fontSize: 10 }} />
              <Bar dataKey="billed" name="Billed" radius={[5, 5, 0, 0]} fill="#cfe0d6" maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="billed" position="top" formatter={labelFmt} style={{ fontSize: 10, fill: "var(--muted)" }} />
              </Bar>
              <Bar dataKey="collected" name="Collected" radius={[5, 5, 0, 0]} fill="#0f6e3f" maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="collected" position="top" formatter={labelFmt} style={{ fontSize: 10, fill: "#0f6e3f", fontWeight: 600 }} />
              </Bar>
              <Line type="monotone" dataKey="collected" name="Trend" stroke="#b4232a" strokeWidth={2} dot={{ r: 3, fill: "#b4232a" }} isAnimationActive={false} legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="MRR by plan" sub="Monthly recurring value">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revByPlan} layout="vertical" margin={{ left: 30, right: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plan" tick={axisTick} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(15,110,63,.08)" }} />
              <Bar dataKey="value" name="MRR" radius={[0, 6, 6, 0]} fill="#3a6ea5" maxBarSize={34} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" formatter={labelFmt} style={{ fontSize: 10, fill: "var(--f)", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Week-over-Week & Month-over-Month */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <Card title="Week-over-Week" sub="Collected · last 8 weeks (Mon start)">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={wow} margin={{ left: 8, right: 12, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<WowMomTT />} cursor={{ fill: "rgba(15,110,63,.06)" }} />
              <Bar dataKey="collected" name="Collected" radius={[5, 5, 0, 0]} fill="#3a6ea5" maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="collected" position="top" formatter={labelFmt} style={{ fontSize: 9.5, fill: "var(--muted)" }} />
              </Bar>
              <Line type="monotone" dataKey="collected" stroke="#0f6e3f" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Month-over-Month" sub="Collected · last 6 months with % change">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={mom} margin={{ left: 8, right: 12, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<WowMomTT />} cursor={{ fill: "rgba(15,110,63,.06)" }} />
              <Bar dataKey="collected" name="Collected" radius={[5, 5, 0, 0]} fill="#0f6e3f" maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="pct" position="top" formatter={(v) => v == null ? "" : `${v > 0 ? "+" : ""}${v}%`} style={{ fontSize: 9.5, fontWeight: 700 }} />
              </Bar>
              <Line type="monotone" dataKey="collected" stroke="#9a6a16" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Society-wise revenue */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, marginTop: 18 }} className="ba-grid">
        <Card title="Revenue by society" sub={`Collected cash · top ${revBySocietyTop.length} · ${societyMatched}% matched to a society`}>
          {revBySocietyTop.length === 0 ? <Empty msg="No collected revenue to group by society yet." /> : (
            <ResponsiveContainer width="100%" height={Math.max(260, revBySocietyTop.length * 34 + 40)}>
              <BarChart data={revBySocietyTop} layout="vertical" margin={{ left: 30, right: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="society" tick={axisTick} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<TT prefix="₹" />} cursor={{ fill: "rgba(15,110,63,.08)" }} />
                <Bar dataKey="collected" name="Collected" radius={[0, 6, 6, 0]} fill="#0f6e3f" maxBarSize={30} isAnimationActive={false}>
                  <LabelList dataKey="collected" position="right" formatter={labelFmt} style={{ fontSize: 10, fill: "var(--f)", fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card pad={false} title="Society breakdown" sub={`${revBySociety.length} societ${revBySociety.length !== 1 ? "ies" : "y"}`}>
          <Table head={["Society", "Invoices", "Collected"]} maxHeight={360}>
            {revBySociety.map((r, idx) => (
              <tr key={idx} style={trStyle}>
                <td style={{ ...td, fontWeight: r.society === "Unknown" ? 400 : 600, color: r.society === "Unknown" ? "var(--muted)" : "var(--f)" }}>{r.society}</td>
                <td style={td}>{r.count}</td>
                <td style={{ ...td, fontWeight: 600 }}>{inr(r.collected)}</td>
              </tr>
            ))}
          </Table>
          {revBySociety.length === 0 && <Empty msg="No data." />}
        </Card>
      </div>

      {/* Long-term recharges */}
      <div style={{ marginTop: 18 }}>
        <Card pad={false}
          title="Long-term recharges (3 / 6 / 12 months)"
          sub={`${ltCount} recharge${ltCount !== 1 ? "s" : ""} · ${inr(ltCash)} cash collected · ${ltByTerm[3]} × 3mo · ${ltByTerm[6]} × 6mo · ${ltByTerm[12]} × 12mo`}>
          <Table head={["Customer", "Plan", "Term", "Total paid", "Per month", "Earned this month", "Deferred"]} maxHeight="calc(100vh - 470px)">
            {longTerm.map(x => (
              <tr key={x.id} style={trStyle}>
                <td style={td}><Person name={x.customerName || "—"} email={x.email} /></td>
                <td style={td}>{x.plan || "—"}</td>
                <td style={td}><Chip>{x.term} mo</Chip></td>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{inr(x.total)}</td>
                <td style={td}>{inr(x.perMonth)}</td>
                <td style={{ ...td, fontWeight: 700, color: "#0f6e3f" }}>{x.recogThis > 0 ? inr(x.recogThis) : "—"}</td>
                <td style={td}>{x.deferred > 0 ? inr(x.deferred) : "—"}</td>
              </tr>
            ))}
          </Table>
          {longTerm.length === 0 && <Empty msg="No long-term (3+ month) recharges found." />}
        </Card>
      </div>

      {/* Renewals due */}
      <div style={{ marginTop: 18 }}>
        <Card pad={false}
          title="Renewals due — next 30 days"
          sub={`${renewals.length} subscription${renewals.length !== 1 ? "s" : ""} · ${due7.length} within 7 days · ${inr(renewalValue)} expected`}>
          <Table head={["Customer", "Plan", "Amount", "Interval", "Renews on", "In", "Status"]} maxHeight="calc(100vh - 470px)">
            {renewals.map(s => (
              <tr key={s.id} style={trStyle}>
                <td style={td}><Person name={s.customerName || "—"} email={s.email} /></td>
                <td style={td}>{s.plan || "—"}</td>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)" }}>{inr(s.amount)}</td>
                <td style={td}>{s.interval || "—"}</td>
                <td style={td}>{fmtDate(s.nextBilling)}</td>
                <td style={td}>
                  <span style={{ fontWeight: 700, color: dueChipColor(s._days) }}>
                    {s._days === 0 ? "Today" : s._days === 1 ? "1 day" : `${s._days} days`}
                  </span>
                </td>
                <td style={td}><Status s={s.status} /></td>
              </tr>
            ))}
          </Table>
          {renewals.length === 0 && <Empty msg="No renewals due in the next 30 days." />}
        </Card>
      </div>
    </div>
  );
}

function Tracker() {
  const { user } = useAuth();
  const [refs, setRefs] = useState(null);
  const [phone, setPhone] = useState("");
  const [match, setMatch] = useState(undefined); // undefined=no search yet, null=not found
  const [anim, setAnim] = useState(0);            // animated progress 0..1
  const [tierFilter, setTierFilter] = useState("all"); // call-list tier filter
  const [maxNeeded, setMaxNeeded] = useState("all");    // how many referrals needed

  useEffect(() => { api.logView(user.username, "Viewed Tracker"); api.getReferrers().then(setRefs).catch(() => setRefs([])); }, []);

  const search = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) { setMatch(undefined); return; }
    const found = (refs || []).find(r => (r.phone || "").replace(/\D/g, "").includes(digits));
    setMatch(found || null);
    setAnim(0);
  };

  const converted = match?.converted || 0;
  const tier = tierFor(converted);
  const next = nextTier(converted);
  const goldTarget = 6;
  const toGold = Math.max(0, goldTarget - converted);
  const targetPct = next ? Math.min(1, converted / next.min) : 1;

  // Animate the progress bar whenever a match is found.
  useEffect(() => {
    if (!match) return;
    let raf, start;
    const dur = 900;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setAnim(eased * targetPct);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [match, targetPct]);

  if (!refs) return <Loading />;

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--slate)", background: "var(--mint-2)", padding: "11px 16px", borderRadius: 12, marginBottom: 16 }}>
        <Trophy size={16} /> Search a customer by phone number to see their referral tier and how close they are to the next reward — handy for pitching referrals.
      </div>

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Enter phone number (e.g. 918839452234)" style={{ ...inp, paddingLeft: 36, margin: 0 }} />
          </div>
          <button onClick={search} style={btnPrimary}><Search size={16} /> Search</button>
        </div>
      </Card>

      {match === null && (
        <Card style={{ marginTop: 18 }}>
          <Empty msg="No referrer found with that phone number. Try the full number or a partial match." />
        </Card>
      )}

      {match && (
        <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--f)", fontFamily: "'DM Sans',system-ui,sans-serif" }}>{match.name}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{match.phone} · {match.society || "—"}</div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: tier.bg, color: tier.color, fontWeight: 700, fontSize: 15 }}>
                <Medal size={18} /> {tier.label}
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 7 }}>
                <span>{converted} converted referral{converted !== 1 ? "s" : ""}</span>
                {next ? <span>Next: {next.label} at {next.min}</span> : <span style={{ color: tier.color, fontWeight: 700 }}>Top tier reached</span>}
              </div>
              <div style={{ height: 16, borderRadius: 999, background: "var(--mint-2)", overflow: "hidden", position: "relative" }}>
                <div style={{ height: "100%", width: `${anim * 100}%`, background: "linear-gradient(90deg, var(--lime), var(--lime-d))", borderRadius: 999, boxShadow: "0 0 12px rgba(168,217,64,.5)" }} />
              </div>
              {toGold > 0
                ? <div style={{ marginTop: 12, fontSize: 14, color: "var(--f)", fontWeight: 600 }}>
                    <span style={{ color: "var(--lime-d)" }}>{toGold} more</span> converted referral{toGold !== 1 ? "s" : ""} to reach <strong>Gold Tier</strong>.
                  </div>
                : <div style={{ marginTop: 12, fontSize: 14, color: "var(--lime-d)", fontWeight: 700 }}>Gold Tier achieved — top referrer!</div>}
            </div>
          </Card>

          <Card title="Tier ladder" sub="Based on converted referrals">
            <div style={{ display: "grid", gap: 10 }}>
              {TIERS.filter(t => t.key !== "none").map(t => {
                const reached = converted >= t.min;
                return (
                  <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: reached ? t.bg : "#fafcfb", border: `1px solid ${reached ? t.color + "44" : "var(--border)"}`, opacity: reached ? 1 : .7 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, background: reached ? t.color : "var(--border)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {reached ? <Check size={18} /> : <Medal size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--f)" }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.min}+ converted referral{t.min !== 1 ? "s" : ""}</div>
                    </div>
                    {reached && <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>Reached</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ---- Call list: customers closest to the next tier (for inside sales) ---- */}
      <Card style={{ marginTop: 18 }} title="Call list" sub="Customers closest to their next tier — pitch these first">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={selectStyle}>
            <option value="all">All current tiers</option>
            <option value="none">No tier yet (0 converted)</option>
            <option value="bronze">Bronze (1+)</option>
            <option value="silver">Silver (2+)</option>
            <option value="gold">Gold (6+)</option>
          </select>
          <select value={maxNeeded} onChange={e => setMaxNeeded(e.target.value)} style={selectStyle}>
            <option value="all">Any distance to next tier</option>
            <option value="1">1 referral away</option>
            <option value="2">≤ 2 referrals away</option>
            <option value="3">≤ 3 referrals away</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>Tap WhatsApp to pitch</span>
        </div>

        {(() => {
          const list = refs
            .map(r => {
              const conv = r.converted || 0;
              const nt = nextTier(conv);
              const need = nt ? nt.min - conv : 0;
              return { ...r, conv, currentTier: tierFor(conv), nt, need };
            })
            .filter(r => tierFilter === "all" || r.currentTier.key === tierFilter)
            .filter(r => maxNeeded === "all" || (r.nt && r.need <= Number(maxNeeded)))
            .sort((a, b) => {
              // Closest to next tier first; those at top tier go last.
              if (!a.nt && !b.nt) return 0;
              if (!a.nt) return 1;
              if (!b.nt) return -1;
              return a.need - b.need || b.conv - a.conv;
            });

          if (list.length === 0) return <Empty msg="No customers match these filters." />;

          return (
            <div style={{ display: "grid", gap: 10 }}>
              {list.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "#fff", flexWrap: "wrap" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: r.currentTier.bg, color: r.currentTier.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Medal size={17} />
                  </div>
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--f)" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.phone} · {r.currentTier.label}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--slate)", flex: "0 0 auto" }}>
                    {r.nt
                      ? <span><strong style={{ color: "var(--lime-d)" }}>{r.need}</strong> to {r.nt.label}</span>
                      : <span style={{ color: r.currentTier.color, fontWeight: 700 }}>Top tier</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                    <a href={waLink(r.phone, pitchFor(r))} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: "#25D366", color: "#fff", fontWeight: 600, fontSize: 12.5, textDecoration: "none" }}>
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                    <a href={`tel:${(r.phone || "").replace(/\D/g, "")}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1.5px solid var(--border)", color: "var(--teal)", fontWeight: 600, fontSize: 12.5, textDecoration: "none" }}>
                      <Phone size={14} /> Call
                    </a>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}

/* ===========================================================================
   FSM / ERP / Billing add-on screens
   AMC scheduling, water-quality compliance, and deposit/refund management.
   These derive representative values from the customer/subscription data until
   live device-telemetry and water-test feeds are connected.
   =========================================================================== */

// Small deterministic hash so derived demo values (TDS, test dates) stay stable.
const hashStr = (s) => { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

/* ---- FSM: AMC / Maintenance scheduling ---- */
function MaintenanceSchedule() {
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
  if (!data) return <Loading />;

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
    const map = { overdue: ["#b4232a", "#fbe9e9", `${-d}d overdue`], soon: ["#9a6a16", "#fdf3e0", `in ${d}d`], upcoming: ["#1f7a3f", "#e6f4ea", `in ${d}d`], unknown: ["#6a7670", "#eceeed", "no date"] };
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
              const bg = s === "overdue" ? "#fdf2f2" : s === "soon" ? "#fdfaf0" : "transparent";
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
function WaterQuality() {
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
  if (!data) return <Loading />;

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
    const map = { compliant: ["#1f7a3f", "#e6f4ea", "Compliant"], watch: ["#9a6a16", "#fdf3e0", "Watch"], fail: ["#b4232a", "#fbe9e9", "Non-compliant"] };
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
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: i.status === "fail" ? "#fdf2f2" : "transparent" }}>
                <td style={td}><Person name={i.c.name || "—"} email={i.c.email} /></td>
                <td style={{ ...td, textAlign: "center" }}>{i.c.purifier_id ? <Chip>{i.c.purifier_id}</Chip> : "—"}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.c.society || "—"}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{i.inTds} ppm</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 600, color: i.status === "fail" ? "#b4232a" : i.status === "watch" ? "#9a6a16" : "var(--teal-d)" }}>{i.outTds} ppm</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: i.testDue ? "#9a6a16" : "var(--muted)" }}>{fmtDate(i.lastTest)}</td>
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

/* ---- ERP: Asset lifecycle (deployed → repair → refurbished → retired) + depreciation ---- */
const ASSET_STATES = {
  deployed:    ["Deployed",    "#1f7a3f", "#e6f4ea"],
  in_repair:   ["In Repair",   "#9a6a16", "#fdf3e0"],
  refurbished: ["Refurbished", "#3a6ea5", "#e7eef7"],
  retired:     ["Retired",     "#6a7670", "#eceeed"],
};
const DEPRECIATION_MONTHS = 60; // straight-line over 5 years

function AssetLifecycle() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Asset lifecycle");
    customerApi.getCustomers().then(setData).catch(e => setErr(e.message || "Could not load assets."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const now = Date.now();
  const MS_MONTH = 86400000 * 30.44;

  const assets = data.filter(c => c.purifier_id).map(c => {
    const h = hashStr(c.purifier_id);
    // Distribution: mostly deployed, a few in repair / refurbished / retired.
    const bucket = h % 10;
    const state = bucket === 0 ? "retired" : bucket === 1 ? "refurbished" : bucket === 2 ? "in_repair" : "deployed";
    const cost = 8000 + (h % 7000);                       // purchase cost ₹8k–15k
    const start = c.since ? new Date(c.since) : null;
    const ageMonths = start && !isNaN(start.getTime()) ? Math.max(0, (now - start.getTime()) / MS_MONTH) : 0;
    const deprPct = state === "retired" ? 1 : Math.min(ageMonths / DEPRECIATION_MONTHS, 1);
    const depreciation = Math.round(cost * deprPct);
    const bookValue = cost - depreciation;
    return { c, state, cost, depreciation, bookValue, deployed: start };
  });

  const gross = assets.reduce((a, x) => a + x.cost, 0);
  const accDepr = assets.reduce((a, x) => a + x.depreciation, 0);
  const nbv = assets.reduce((a, x) => a + x.bookValue, 0);
  const countBy = (s) => assets.filter(x => x.state === s).length;

  const stats = [
    { label: "Total assets", value: assets.length, icon: Boxes, sub: `${countBy("deployed")} deployed · ${countBy("in_repair")} in repair`, hero: true },
    { label: "Gross asset value", value: inr(gross), icon: Landmark, sub: "purchase cost" },
    { label: "Accumulated depreciation", value: inr(accDepr), icon: TrendingUp, sub: "written off to date" },
    { label: "Net book value", value: inr(nbv), icon: Wallet, sub: "current carrying value" },
  ];

  const stChip = (s) => {
    const [lbl, c, bg] = ASSET_STATES[s] || ["—", "#6a7670", "#eceeed"];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const ql = q.toLowerCase();
  const shown = assets.filter(x => (filter === "all" || x.state === filter) &&
    (!ql || `${x.c.name} ${x.c.purifier_id} ${x.c.society}`.toLowerCase().includes(ql)));

  const chips = [["all", `All (${assets.length})`], ...Object.keys(ASSET_STATES).map(s => [s, `${ASSET_STATES[s][0]} (${countBy(s)})`])];

  const exportCsv = () => exportToCsv("prowater-asset-lifecycle.csv", [
    { label: "Purifier ID", get: x => x.c.purifier_id },
    { label: "Device Type", get: x => deviceType(x.c.purifier_id) },
    { label: "Location", get: x => x.c.society },
    { label: "Deployed", get: x => x.deployed ? fmtDate(x.deployed) : "" },
    { label: "State", get: x => ASSET_STATES[x.state][0] },
    { label: "Cost", get: x => x.cost },
    { label: "Depreciation", get: x => x.depreciation },
    { label: "Book value", get: x => x.bookValue },
  ], shown);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Lifecycle: Deployed → In Repair → Refurbished → Retired. Straight-line depreciation over {DEPRECIATION_MONTHS / 12} years. Values are illustrative until an asset register is connected.
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Purifier asset register" sub="Each deployed unit with its lifecycle state and depreciated book value.">
          <Toolbar q={q} setQ={setQ} placeholder="Search purifier, customer or location…" count={shown.length}
            right={
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {chips.map(([id, lbl]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"), background: filter === id ? "var(--mint-2)" : "#fff", color: filter === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>
                ))}
                <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
              </div>
            } />
          <Table head={["Purifier", "Device", "Location", "Deployed", "State", "Cost", "Depreciation", "Book value"]} maxHeight={520}>
            {shown.map((x, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: x.state === "in_repair" ? "#fdfaf0" : "transparent" }}>
                <td style={{ ...td, textAlign: "center" }}>{x.c.purifier_id ? <Chip>{x.c.purifier_id}</Chip> : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}><DeviceTypeBadge purifierId={x.c.purifier_id} /></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{x.c.society || "—"}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{x.deployed ? fmtDate(x.deployed) : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{stChip(x.state)}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{inr(x.cost)}</td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>{inr(x.depreciation)}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, color: x.bookValue > 0 ? "var(--teal-d)" : "var(--muted)" }}>{inr(x.bookValue)}</td>
              </tr>
            ))}
            {shown.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={5}>Total ({shown.length})</td>
                <td style={ftd}>{inr(shown.reduce((a, x) => a + x.cost, 0))}</td>
                <td style={ftd}>{inr(shown.reduce((a, x) => a + x.depreciation, 0))}</td>
                <td style={ftd}>{inr(shown.reduce((a, x) => a + x.bookValue, 0))}</td>
              </tr>
            )}
            {shown.length === 0 && <tr><td colSpan={8} style={{ padding: 0 }}><Empty msg="No assets match this filter." /></td></tr>}
          </Table>
        </Card>
      </div>
    </div>
  );
}

/* ---- Billing: Deposit & Refund management ---- */
function DepositRefunds() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [refunds, setRefunds] = useState({}); // subId -> requested | approved | refunded
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.logView(user.username, "Viewed Deposits & Refunds");
    billingApi.getSubscriptions().then(subs => setData(subs)).catch(e => setErr(e.message || "Could not load subscriptions."));
  }, []);
  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const rows = data
    .map(s => {
      const dep = depositFor(s.amount);
      const state = refunds[s.id] || (s.status === "active" ? "held" : "eligible");
      return { s, dep, state };
    })
    .filter(r => r.dep > 0);

  const totalHeld = rows.filter(r => ["held", "eligible", "requested", "approved"].includes(r.state)).reduce((a, r) => a + r.dep, 0);
  const heldCount = rows.filter(r => r.state === "held").length;
  const pending = rows.filter(r => ["requested", "approved"].includes(r.state)).length;
  const refundedTotal = rows.filter(r => r.state === "refunded").reduce((a, r) => a + r.dep, 0);

  const stats = [
    { label: "Deposits held", value: inr(totalHeld), icon: Wallet, sub: `${heldCount} active`, hero: true },
    { label: "Refund requests", value: pending, icon: Undo2, sub: "awaiting action" },
    { label: "Refunded", value: inr(refundedTotal), icon: RotateCcw, sub: "returned to customers" },
    { label: "Avg deposit", value: inr(rows.length ? Math.round(rows.reduce((a, r) => a + r.dep, 0) / rows.length) : 0), icon: Landmark, sub: "per plan" },
  ];

  const advance = (r, next, verb) => {
    setRefunds(prev => ({ ...prev, [r.s.id]: next }));
    pushLog({ type: "deposit_refund", actor: user.username, module: "Billing", detail: `${verb}: ${inr(r.dep)} deposit for ${r.s.customerName || r.s.id}` });
    flash(`${verb} · ${r.s.customerName || r.s.id}`);
  };

  const stChip = (state) => {
    const map = { held: ["#16545c", "#e2eff0", "Held"], eligible: ["#9a6a16", "#fdf3e0", "Refund eligible"], requested: ["#9a6a16", "#fdf3e0", "Requested"], approved: ["#3a6ea5", "#e7eef7", "Approved"], refunded: ["#1f7a3f", "#e6f4ea", "Refunded"] };
    const [c, bg, lbl] = map[state] || ["#6a7670", "#eceeed", state];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const action = (r) => {
    if (["held", "eligible"].includes(r.state)) return <button onClick={() => advance(r, "requested", "Refund requested")} style={{ ...btnGhost, padding: "6px 12px" }}><Undo2 size={14} /> Request</button>;
    if (r.state === "requested") return <button onClick={() => advance(r, "approved", "Refund approved")} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12.5 }}><Check size={14} /> Approve</button>;
    if (r.state === "approved") return <button onClick={() => advance(r, "refunded", "Refund completed")} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12.5 }}><Check size={14} /> Mark refunded</button>;
    return <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>;
  };

  const ql = q.toLowerCase();
  const shown = rows.filter(r => !ql || `${r.s.customerName} ${r.s.email} ${r.s.id} ${r.s.plan}`.toLowerCase().includes(ql));

  const exportCsv = () => exportToCsv("prowater-deposits.csv", [
    { label: "Customer", get: r => r.s.customerName },
    { label: "Subscription", get: r => r.s.id },
    { label: "Plan", get: r => r.s.plan },
    { label: "Deposit", get: r => r.dep },
    { label: "Status", get: r => r.state },
  ], shown);

  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Deposits & Refunds" sub="Refundable security deposits held per plan. Request → approve → refund on cancellation.">
          <Toolbar q={q} setQ={setQ} placeholder="Search customer, plan or subscription…" count={shown.length}
            right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
          <Table head={["Customer", "Subscription", "Plan", "Deposit", "Status", "Action"]} maxHeight={520}>
            {shown.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}><Person name={r.s.customerName || "—"} email={r.s.email} /></td>
                <td style={{ ...td, textAlign: "center" }}><Chip>{r.s.id}</Chip></td>
                <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{r.s.plan || "—"}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{inr(r.dep)}</td>
                <td style={{ ...td, textAlign: "center" }}>{stChip(r.state)}</td>
                <td style={{ ...td, textAlign: "center" }}>{action(r)}</td>
              </tr>
            ))}
            {shown.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={3}>Total ({shown.length})</td>
                <td style={ftd}>{inr(shown.reduce((a, r) => a + r.dep, 0))}</td>
                <td style={ftd}></td><td style={ftd}></td>
              </tr>
            )}
            {shown.length === 0 && <tr><td colSpan={6} style={{ padding: 0 }}><Empty msg="No deposits found (plans at or below ₹1,500 carry no deposit)." /></td></tr>}
          </Table>
        </Card>
      </div>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   AUTO SCHEDULER — recurring society general-service (GS) + IoT alerts
   =========================================================================== */
const GS_INTERVAL_DAYS = 15;
// Seed societies with install metadata. `offset` = days since last GS (demo).
const AUTO_GS_SEED = [
  { name: "CBR Aakruti",                installedDate: "2026-01-15", totalFlats: 108, numTowers: 2, croType: "Eco crystal", lastBackwash: "2026-06-28", lastDozing: "NA",             offset: 11 },
  { name: "SVS Ananda Nilayam",         installedDate: "2026-02-10", totalFlats: 168, numTowers: 5, croType: "Alfa Enviro", lastBackwash: "2026-06-25", lastDozing: "2026-06-25",     offset: 14 },
  { name: "MJR Clique Hydra",           installedDate: "2025-11-20", totalFlats: 300, numTowers: 5, croType: "Eco crystal", lastBackwash: "2026-07-01", lastDozing: "Yet to install", offset: 8 },
  { name: "Ashish JK",                  installedDate: "2026-03-05", totalFlats: 206, numTowers: 6, croType: "Alfa Enviro", lastBackwash: "2026-07-06", lastDozing: "2026-07-06",     offset: 3 },
  { name: "Prabhavathi Meghana Towers", installedDate: "2026-01-28", totalFlats: 80,  numTowers: 1, croType: "Eco crystal", lastBackwash: "2026-06-22", lastDozing: "NA",             offset: 17 },
];
// Session memory so ticket ids and newly-added societies survive tab re-mounts.
const _gsTickets = {};   // society -> ticket id
const _iotTickets = {};  // purifier id -> ticket id
const _gsAdded = [];     // societies added locally when the endpoint is offline

// GS schedule store — the SAME data the cron job reads/writes. Falls back to the
// local seed until DevOps exposes the endpoint (see cron/README.md §4).
const GS_ENDPOINT = () => `${API_BASE}/api/gs-schedules`;
const schedulerApi = {
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
        ticketId:      r.cycleTicketId || r.ticketId || r.ticket_id || null,
      }));
    } catch (e) {
      console.warn("GS schedules endpoint unavailable, using local data:", e.message);
      return [...AUTO_GS_SEED, ..._gsAdded];
    }
  },
  // >>> WIRE: POST /api/gs-schedules persists a society to the store the cron
  //     reads, which auto-puts it on the 15-day ticket cycle.
  addSociety: async (actor, meta) => {
    const payload = { society: meta.name, installedDate: meta.installedDate, totalFlats: meta.totalFlats, numTowers: meta.numTowers, cro_type: meta.croType, last_backwash: meta.lastBackwash, last_dozing: meta.lastDozing, lastService: meta.lastBackwash || meta.installedDate };
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

/* ---- Auto GS - Society: 15-day service schedule with auto-raised tickets ---- */
const DAY_MS = 86400000;
// Build a schedule row from a society meta object. Seed societies date the last
// service from `offset` (days ago); added ones start their cycle at install.
const validGsDate = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const buildGsRow = (s) => {
  const now = Date.now();
  // Cycle is driven by the last BACKWASH service date (valid date); then fall back
  // to lastService, the demo offset, and finally the install date.
  const last = validGsDate(s.lastBackwash) || (s.lastService ? new Date(s.lastService) : null)
    || (s.offset != null ? new Date(now - s.offset * DAY_MS) : null)
    || new Date(s.installedDate);
  const next = new Date(last.getTime() + GS_INTERVAL_DAYS * DAY_MS);
  return {
    society: s.name, installedDate: s.installedDate, totalFlats: s.totalFlats, numTowers: s.numTowers,
    croType: s.croType || "", lastBackwash: s.lastBackwash || "", lastDozing: s.lastDozing || "",
    last, next, daysLeft: Math.ceil((next.getTime() - now) / DAY_MS), ticketId: _gsTickets[s.name] || s.ticketId || null,
  };
};

function AutoGSSociety() {
  const { user } = useAuth();
  const [societyFilter, setSocietyFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", installedDate: "", totalFlats: "", numTowers: "", croType: "Eco crystal", lastBackwash: "", lastDozing: "" });
  const [rows, setRows] = useState(null);

  // Render a service date cell: "NA" / "Yet to install" pass through; else format.
  const fmtServiceVal = (v) => { if (v == null || v === "") return "—"; if (String(v).toUpperCase() === "NA") return "NA"; if (/yet to install/i.test(v)) return "Yet to install"; return fmtDate(v); };
  // Dozing text colour: amber for "yet to install", muted for NA, normal otherwise.
  const dozingColor = (v) => /yet to install/i.test(v) ? "#9a6a16" : (String(v).toUpperCase() === "NA" ? "var(--muted)" : "var(--slate)");

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
    };
    setSaving(true);
    try {
      const { saved } = await schedulerApi.addSociety(user.username, meta);
      setRows(rs => [...(rs || []), buildGsRow(meta)]);
      setAddOpen(false);
      setForm({ name: "", installedDate: "", totalFlats: "", numTowers: "", croType: "Eco crystal", lastBackwash: "", lastDozing: "" });
      flash(saved ? `Society "${meta.name}" saved to schedule` : `Society "${meta.name}" added (saved locally — backend offline)`);
    } finally { setSaving(false); }
  };

  if (!rows) return <Loading />;

  const createTicketFor = async (society) => {
    setBusy(society);
    const r = rows.find(x => x.society === society);
    try {
      const id = await ticketApi.createTicket(user.username, {
        subject: `[Auto GS] ${GS_INTERVAL_DAYS}-day service — ${society}`,
        email: user.email,
        society, type: "Maintenance", issueType: "General Service", priority: 2,
        description: `Scheduled ${GS_INTERVAL_DAYS}-day general service for ${society}. Technician visit due ${fmtDate(r.next)}.`,
      });
      _gsTickets[society] = id;
      setRows(rs => rs.map(x => x.society === society ? { ...x, ticketId: id } : x));
      flash(`Freshdesk ticket #${id} created for ${society}`);
    } catch (e) {
      flash(`Couldn't create ticket: ${e.message}`);
    } finally { setBusy(null); }
  };

  const dueCount = rows.filter(r => r.daysLeft <= 1 && !r.ticketId).length;
  const ticketsCreated = rows.filter(r => r.ticketId).length;
  const nearest = [...rows].sort((a, b) => a.daysLeft - b.daysLeft)[0];

  const stats = [
    { label: "Societies on schedule", value: rows.length, icon: CalendarClock, sub: `every ${GS_INTERVAL_DAYS} days`, hero: true },
    { label: "Due for service", value: dueCount, icon: AlertCircle, sub: "raise ticket (day 14)" },
    { label: "Tickets raised", value: ticketsCreated, icon: Ticket, sub: "for upcoming visits" },
    { label: "Next visit", value: nearest ? `${nearest.daysLeft}d` : "—", icon: MapPin, sub: nearest ? nearest.society : "" },
  ];

  const daysBadge = (d) => {
    const [c, bg, lbl] = d < 0 ? ["#b4232a", "#fbe9e9", `${-d}d overdue`]
      : d <= 1 ? ["#9a6a16", "#fdf3e0", d <= 0 ? "due today" : "due tomorrow"]
      : ["#1f7a3f", "#e6f4ea", `${d} days`];
    return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{lbl}</span>;
  };

  const shown = societyFilter === "all" ? rows : rows.filter(r => r.society === societyFilter);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", background: "var(--mint-2)", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> A general service runs every {GS_INTERVAL_DAYS} days per society. On day 14 a Freshdesk ticket is raised so a technician visits on day 15.
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Auto GS — Society schedule" sub="Last & next service per society, with the ticket auto-raised for the upcoming visit.">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Society</span>
            <select value={societyFilter} onChange={e => setSocietyFilter(e.target.value)} style={selectStyle}>
              <option value="all">All societies ({rows.length})</option>
              {rows.map(r => <option key={r.society} value={r.society}>{r.society}</option>)}
            </select>
            {dueCount > 0 && <span style={{ fontSize: 12.5, color: "#9a6a16", fontWeight: 600 }}>{dueCount} due — raise ticket</span>}
            <button onClick={() => setAddOpen(true)} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 13, marginLeft: "auto" }}><Plus size={15} /> Add new society</button>
          </div>
          <Table head={["Apartments", "No of Flats", "No of Towers", "CRO Installed Date", "CRO - 250 LPH Type", "Last service Date For Backwash", "Last service Date For Dozing", "Next service", "Days left", "Ticket ID"]}>
            {shown.map((r, idx) => {
              const due = r.daysLeft <= 1;
              return (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.society}</td>
                  <td style={{ ...td, textAlign: "center" }}>{r.totalFlats || "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{r.numTowers || "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{r.installedDate ? fmtDate(r.installedDate) : "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{r.croType || "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13 }}>{fmtServiceVal(r.lastBackwash) === "—" ? fmtDate(r.last) : fmtServiceVal(r.lastBackwash)}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13, color: dozingColor(r.lastDozing) }}>{fmtServiceVal(r.lastDozing)}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{fmtDate(r.next)}</td>
                  <td style={{ ...td, textAlign: "center" }}>{daysBadge(r.daysLeft)}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                    {r.ticketId
                      ? <Chip>#{r.ticketId}</Chip>
                      : due
                        ? <button onClick={() => createTicketFor(r.society)} disabled={busy === r.society} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12.5, whiteSpace: "nowrap", opacity: busy === r.society ? .6 : 1 }}><Ticket size={14} /> {busy === r.society ? "Creating…" : "Create ticket"}</button>
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

      {toast && <div style={{ ...toastStyle, background: /couldn't|failed|error|returned/i.test(toast) ? "#b4232a" : toastStyle.background }}>{/couldn't|failed|error|returned/i.test(toast) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}

/* ---- IoT Alerts: device telemetry alerts, raise a ticket to dispatch ---- */
const IOT_ALERTS = [
  { key: "leak", label: "Leak detected", severity: "critical" },
  { key: "offline", label: "Device offline", severity: "critical" },
  { key: "filter", label: "Filter clogged", severity: "warning" },
  { key: "flow", label: "Low water flow", severity: "warning" },
  { key: "tds", label: "High output TDS", severity: "warning" },
  { key: "ok1", label: "Healthy", severity: "ok" },
  { key: "ok2", label: "Healthy", severity: "ok" },
];

function IoTAlerts() {
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
  if (!data) return <Loading />;

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
    const map = { critical: ["#b4232a", "#fbe9e9", "Critical"], warning: ["#9a6a16", "#fdf3e0", "Warning"] };
    const [c, bg, lbl] = map[s] || ["#6a7670", "#eceeed", s];
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
      flash(`Freshdesk ticket #${id} raised for ${x.c.name}`);
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
        <Card title="IoT device alerts" sub="Device telemetry alerts — raise a Freshdesk ticket to dispatch a technician.">
          <Toolbar q={q} setQ={setQ} placeholder="Search device, customer, society or alert…" count={shown.length}
            right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {chips.map(([id, lbl]) => <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"), background: filter === id ? "var(--mint-2)" : "#fff", color: filter === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>)}
            </div>} />
          <Table head={["Device", "Customer", "Society", "Alert", "Severity", "Since", "Action"]} maxHeight={520}>
            {shown.map((x, idx) => {
              const key = x.c.purifier_id;
              return (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: x.alert.severity === "critical" ? "#fdf2f2" : "transparent" }}>
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
      {toast && <div style={{ ...toastStyle, background: /couldn't|failed|error|returned/i.test(toast) ? "#b4232a" : toastStyle.background }}>{/couldn't|failed|error|returned/i.test(toast) ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}

/* ===========================================================================
   APP LOGS — Firestore `logs` collection in prowaterdb (mobile/web app events)
   Tries a backend endpoint first, then a direct Firestore read with the login
   idToken (needs security rules that allow the client), else sample data.
   =========================================================================== */
const APP_LOGS_PROJECT = "backend-prowater";
const APP_LOGS_DB = "prowaterdb";

// Pull a scalar out of a Firestore REST field wrapper ({stringValue}, {timestampValue}, …).
const _fsVal = (f) => {
  if (!f || typeof f !== "object") return "";
  if (f.stringValue != null) return f.stringValue;
  if (f.timestampValue != null) return f.timestampValue;
  if (f.integerValue != null) return f.integerValue;
  if (f.doubleValue != null) return String(f.doubleValue);
  if (f.booleanValue != null) return String(f.booleanValue);
  return "";
};
function mapAppLog(doc) {
  const f = doc.fields || {};
  return {
    id: (doc.name || "").split("/").pop(),
    name: _fsVal(f.name), email: _fsVal(f.email), phone: _fsVal(f.phone_number),
    apartment: _fsVal(f.Apartment_Name), purifierId: _fsVal(f.Purifier_ID),
    device: _fsVal(f.device), ip: _fsVal(f.ip),
    loginTime: _fsVal(f.logintime), status: _fsVal(f.error_desc), zohoId: _fsVal(f.zohocustid),
  };
}

const SEED_APP_LOGS = (() => {
  const base = [
    { id: "s1", name: "Sri lingeshwar", email: "sri@soroai.com", phone: "+91-9440744631", apartment: "MJR Clique Hydra Apartment", purifierId: "null", device: "iPhone 12", ip: "192.168.1.5", loginTime: "2026-07-02T11:13:54+05:30", status: "Login Sucessfull", zohoId: "3399543000001480513" },
    { id: "s2", name: "srilingeshwar", email: "sri@soroai.com", phone: "+91-9440744631", apartment: "", purifierId: "", device: "Device: Web/Desktop", ip: "Error: getWifiIP() not supported on Web", loginTime: "2026-04-03T00:03:28+05:30", status: "{status: success, count: 1, docs: [{society_name: HSR, tds: 85, ph: 7.5, flow_rate: 85}]}", zohoId: "3399543000000350099" },
    { id: "s3", name: "Divya Nair", email: "divya.n@example.com", phone: "+91-9900412345", apartment: "Prestige Lakeside", purifierId: "PW-44120", device: "Samsung Galaxy S23", ip: "192.168.0.14", loginTime: "2026-07-04T09:22:10+05:30", status: "Login Sucessfull", zohoId: "3399543000000350120" },
    { id: "s4", name: "Rohit Khanna", email: "rohit.k@example.com", phone: "+91-9812345678", apartment: "Brigade Gateway", purifierId: "PW-77810", device: "iPhone 14 Pro", ip: "10.0.0.7", loginTime: "2026-07-04T18:41:02+05:30", status: "Invalid credentials", zohoId: "3399543000000350142" },
    { id: "s5", name: "Sana Kapoor", email: "sana.k@example.com", phone: "+91-9765432100", apartment: "Sobha Dream Acres", purifierId: "PW-90233", device: "Web/Desktop", ip: "49.36.221.10", loginTime: "2026-07-05T07:05:33+05:30", status: "Login Sucessfull", zohoId: "3399543000000350155" },
  ];
  const names = ["Aarav Sharma", "Diya Patel", "Vivaan Reddy", "Ananya Rao", "Kabir Nair", "Ishaan Gupta", "Myra Iyer", "Arjun Menon", "Saanvi Bose", "Reyansh Jain"];
  const socs = ["MJR Clique Hydra", "Prestige Lakeside", "Sobha Dream Acres", "Brigade Gateway", "Purva Highlands"];
  const devs = ["iPhone 12", "Samsung Galaxy S23", "Web/Desktop", "OnePlus 11", "iPhone 14 Pro"];
  const gen = [];
  const t0 = Date.parse("2026-07-05T08:30:00+05:30");
  for (let i = 0; i < 22; i++) {
    const d = new Date(t0 - i * 9 * 3600000); // ~9h apart, going back in time
    gen.push({
      id: "g" + i, name: names[i % names.length], email: `user${i + 1}@example.com`,
      phone: `+91-98${String(70000000 + i * 137).slice(0, 8)}`, apartment: socs[i % socs.length],
      purifierId: i % 3 === 0 ? "" : "PW-" + (44100 + i), device: devs[i % devs.length],
      ip: `192.168.${i % 6}.${11 + i}`, loginTime: d.toISOString(),
      status: i % 5 === 0 ? "Invalid credentials" : "Login Sucessfull", zohoId: "339954300000" + (350160 + i),
    });
  }
  return [...base, ...gen];
})();

async function fetchFirestoreAppLogs(limit) {
  const token = sessionStorage.getItem("pw_idToken");
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${APP_LOGS_PROJECT}/databases/${APP_LOGS_DB}/documents:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "logs" }], orderBy: [{ field: { fieldPath: "logintime" }, direction: "DESCENDING" }], limit } }),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const json = await res.json();
  return (json || []).filter(r => r.document).map(r => mapAppLog(r.document));
}

const appLogsApi = {
  getLogs: async (limit = 250) => {
    // 1) Preferred: a backend endpoint (admin-side, secure). Optional — add it later.
    try {
      const res = await fetch(`${API_ORIGIN}/admin/get-app-logs?limit=${limit}`, { headers: authHeaders() });
      if (res.ok) {
        const j = await res.json();
        const list = Array.isArray(j) ? j : (j.logs || j.data || []);
        if (list.length) { markSample("app logs", false); return list.map(r => r.email !== undefined ? r : mapAppLog(r)); }
      }
    } catch { /* try Firestore */ }
    // 2) Direct Firestore read (works if security rules permit the logged-in client).
    try {
      const docs = await fetchFirestoreAppLogs(limit);
      if (docs.length) { markSample("app logs", false); return docs; }
    } catch (e) { console.warn("Firestore app logs unavailable:", e.message); }
    // 3) Sample data.
    markSample("app logs", true);
    return [...SEED_APP_LOGS];
  },
};

function AppLogs() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "loginTime", dir: "desc" }); // newest first
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    api.logView(user.username, "Viewed App Logs");
    appLogsApi.getLogs().then(setRows).catch(e => setErr(e.message || "Could not load app logs."));
  }, []);
  // Reset to page 1 whenever the filters change.
  useEffect(() => { setPage(1); }, [q, filter, range]);
  if (err) return <ApiError msg={err} />;
  if (!rows) return <Loading />;

  // Date range scopes everything (KPIs + table) by login time.
  const inR = rangeFilter(range);
  const inRange = rows.filter(r => inR(r.loginTime));

  const statusOf = (s) => /success|sucessful/i.test(s) ? "success" : /fail|invalid|denied|error|unsupported/i.test(s) ? "failed" : "info";
  const success = inRange.filter(r => statusOf(r.status) === "success").length;
  const failed = inRange.filter(r => statusOf(r.status) === "failed").length;
  const uniqueUsers = new Set(inRange.map(r => (r.email || "").toLowerCase()).filter(Boolean)).size;

  const stats = [
    { label: "App log events", value: inRange.length, icon: ScrollText, sub: "most recent first", hero: true },
    { label: "Successful", value: success, icon: CheckCircle2, sub: "logins / actions" },
    { label: "Failed", value: failed, icon: AlertCircle, sub: "errors / denials" },
    { label: "Unique users", value: uniqueUsers, icon: Users, sub: "distinct emails" },
  ];

  const stChip = (s) => {
    const map = { success: ["#1f7a3f", "#e6f4ea", "Success"], failed: ["#b4232a", "#fbe9e9", "Failed"], info: ["#16545c", "#e2eff0", "Info"] };
    const [c, bg, lbl] = map[statusOf(s)];
    return <span title={s} style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", cursor: "help" }}>{lbl}</span>;
  };

  const chips = [["all", `All (${inRange.length})`], ["success", `Success (${success})`], ["failed", `Failed (${failed})`]];
  const ql = q.toLowerCase();
  const shown = inRange.filter(r => (filter === "all" || statusOf(r.status) === filter) &&
    (!ql || `${r.name} ${r.email} ${r.phone} ${r.apartment} ${r.purifierId} ${r.ip} ${r.zohoId}`.toLowerCase().includes(ql)));

  // Sort by login time (invalid dates sink to the bottom).
  const sorted = [...shown].sort((a, b) => {
    const ta = new Date(a.loginTime).getTime(), tb = new Date(b.loginTime).getTime();
    const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
    return (va - vb) * (sort.dir === "asc" ? 1 : -1);
  });

  // Pagination — 20 per page.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const start = (curPage - 1) * PER_PAGE;
  const pageRows = sorted.slice(start, start + PER_PAGE);

  const exportCsv = () => exportToCsv("prowater-app-logs.csv", [
    { label: "Name", get: r => r.name }, { label: "Email", get: r => r.email }, { label: "Phone", get: r => r.phone },
    { label: "Apartment", get: r => r.apartment }, { label: "Purifier ID", get: r => r.purifierId },
    { label: "Device", get: r => r.device }, { label: "IP", get: r => r.ip },
    { label: "Login time", get: r => r.loginTime }, { label: "Status", get: r => r.status }, { label: "Zoho Cust ID", get: r => r.zohoId },
  ], shown);

  const fmtLogin = (t) => { const d = new Date(t); return isNaN(d.getTime()) ? (t || "—") : fmtTime(d); };
  const trunc = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : (s || "—"); };

  return (
    <div className="fade-up">
      <DateRangeFilter range={range} onChange={setRange} right={
        <span className="no-print" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          {(range.from || range.to) ? `${range.from || "…"} → ${range.to || "…"} · ` : ""}{inRange.length} event{inRange.length !== 1 ? "s" : ""}
        </span>
      } />
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="App Logs" sub="Login & activity events from the ProWater mobile / web app (Firestore · logs).">
          <Toolbar q={q} setQ={setQ} placeholder="Search name, email, phone, apartment, IP…" count={shown.length}
            right={<div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {chips.map(([id, lbl]) => <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (filter === id ? "var(--teal)" : "var(--border)"), background: filter === id ? "var(--mint-2)" : "#fff", color: filter === id ? "var(--teal-d)" : "var(--slate)" }}>{lbl}</button>)}
              <button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>
            </div>} />
          <Table head={["User", "Phone", "Apartment", "Purifier ID", "Device", "IP",
            <SortHeader key="lt" label="Login time" k="loginTime" sort={sort} onSort={toggleSort} />, "Status"]} maxHeight="calc(100vh - 360px)">
            {pageRows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}><Person name={r.name || "—"} email={r.email} /></td>
                <td style={{ ...td, fontSize: 12.5 }}>{fmtPhone(r.phone)}</td>
                <td style={{ ...td, fontSize: 12.5 }}>{r.apartment || "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{r.purifierId && r.purifierId !== "null" ? <Chip>{r.purifierId}</Chip> : "—"}</td>
                <td style={{ ...td, fontSize: 12, color: "var(--muted)", maxWidth: 170 }} title={r.device}>{trunc(r.device, 26)}</td>
                <td style={{ ...td, fontSize: 12, fontFamily: "ui-monospace,monospace", color: "var(--slate)", maxWidth: 160 }} title={r.ip}>{trunc(r.ip, 22)}</td>
                <td style={{ ...td, fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtLogin(r.loginTime)}</td>
                <td style={{ ...td, textAlign: "center" }}>{stChip(r.status)}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} style={{ padding: 0 }}><Empty msg="No app logs match your search." /></td></tr>}
          </Table>
          {sorted.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{start + 1}–{Math.min(start + PER_PAGE, sorted.length)} of {sorted.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage <= 1 ? .5 : 1, cursor: curPage <= 1 ? "not-allowed" : "pointer" }}><ChevronLeft size={15} /> Prev</button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--f)" }}>Page {curPage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: curPage >= totalPages ? .5 : 1, cursor: curPage >= totalPages ? "not-allowed" : "pointer" }}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}


/* ===========================================================================
   IOT CORE — live device monitoring (AWS API). Device list + pressure / flow /
   valve telemetry, channels, history. Polls status (10s) and history (15s).
   =========================================================================== */
const IOT_API_BASE = "https://xb2sxpw2k0.execute-api.ap-southeast-2.amazonaws.com/prod";
const iotTimeAgo = (ts) => { if (!ts) return "Unknown"; const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; return `${Math.floor(s / 3600)}h ago`; };
const iotOnline = (ts) => !!ts && (Date.now() - new Date(ts).getTime()) / 1000 < 120;
const iotClock = (ts) => ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const ValveBadge = ({ state }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#fff", background: state === "OPEN" ? "#1f7a3f" : "#b4232a" }}>{state ?? "—"}</span>
);

function IoTDevices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Poll device status every 10s.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${IOT_API_BASE}/devices/status`);
        const data = await res.json();
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setDevices(list); setErr("");
        setSelected(prev => prev || (list[0]?.deviceId ?? null));
      } catch { if (alive) setErr("Could not reach the IoT device API."); }
      finally { if (alive) setLoading(false); }
    };
    api.logView(user.username, "Viewed IoT devices");
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Poll history for the selected device every 15s.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${IOT_API_BASE}/devices/history?deviceId=${selected}`);
        const data = await res.json();
        if (alive) setHistory(Array.isArray(data) ? data.slice().reverse() : []);
      } catch { /* keep previous */ }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [selected]);

  if (loading) return <Loading />;

  const device = devices.find(d => d.deviceId === selected);
  const channels = device?.payload?.units?.[0]?.channels ?? [];
  const chartData = history.map(item => ({
    time: iotClock(item.timestamp),
    pressure: parseFloat(item.payload?.inputPressure ?? 0),
    flow_CH01: parseFloat(item.payload?.units?.[0]?.channels?.find(c => c.channelId === "CH_01")?.flowRateLpm ?? 0),
    flow_CH02: parseFloat(item.payload?.units?.[0]?.channels?.find(c => c.channelId === "CH_02")?.flowRateLpm ?? 0),
  }));

  const online = devices.filter(d => iotOnline(d.timestamp)).length;
  const faulty = devices.filter(d => (d.payload?.units?.[0]?.channels ?? []).some(c => c.fault)).length;
  const stats = [
    { label: "Devices", value: devices.length, icon: Cpu, sub: "monitored", hero: true },
    { label: "Online", value: online, icon: CheckCircle2, sub: "seen in last 120s" },
    { label: "Offline", value: devices.length - online, icon: AlertCircle, sub: "no recent ping" },
    { label: "With faults", value: faulty, icon: AlertCircle, sub: "channel fault active" },
  ];

  return (
    <div className="fade-up">
      {err && <ApiError msg={err} />}
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18, marginTop: 18 }} className="iot-grid">
        <style>{`@media(max-width:900px){.iot-grid{grid-template-columns:1fr!important}}`}</style>

        {/* Device list */}
        <Card title={`Devices (${devices.length})`} pad={false}>
          <div style={{ maxHeight: "68vh", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {devices.map(d => {
              const on = iotOnline(d.timestamp);
              const sel = selected === d.deviceId;
              return (
                <button key={d.deviceId} onClick={() => setSelected(d.deviceId)} style={{
                  textAlign: "left", padding: "11px 12px", borderRadius: 12, cursor: "pointer",
                  border: "1.5px solid " + (sel ? "var(--teal)" : "var(--border)"), background: sel ? "var(--mint-2)" : "#fff", transition: ".15s"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--f)" }}>{d.deviceId}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, color: on ? "#1f7a3f" : "#b4232a" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? "#1f7a3f" : "#b4232a" }} />{on ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{d.roUnitId} · {d.deviceType}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Last seen: {iotTimeAgo(d.timestamp)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--teal-d)", fontWeight: 600, marginTop: 2 }}>{d.payload?.inputPressure} bar pressure</div>
                </button>
              );
            })}
            {devices.length === 0 && <Empty msg="No devices found." />}
          </div>
        </Card>

        {/* Detail */}
        <div style={{ minWidth: 0 }}>
          {!device ? <Card><Empty msg="Select a device from the list." /></Card> : <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 21, lineHeight: 1.1 }}>{device.deviceId}</h2>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{device.roUnitId} · Firmware {device.firmwareVersion || "—"}</div>
            </div>

            <div style={grid4}>
              <Stat label="Water pressure" value={`${device.payload?.inputPressure ?? "—"} bar`} icon={Droplets} sub="input pressure" hero />
              <Stat label="Unit health" value={device.payload?.units?.[0]?.health ?? "—"} icon={CheckCircle2} sub="device condition" />
              <Stat label="Last heartbeat" value={iotTimeAgo(device.timestamp)} icon={Clock} sub="alert if > 120s" />
            </div>

            <div style={{ marginTop: 18 }}>
              <Card title="Channels (pipes)" sub="Each channel is a water pipe with its own valve and flow meter.">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {channels.map(ch => (
                    <div key={ch.channelId} style={{ borderRadius: 12, border: "1px solid " + (ch.fault ? "#f0dcae" : "var(--border)"), background: ch.fault ? "#fdf9ef" : "var(--mint)", padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--f)" }}>{ch.channelId}</span>
                        <ValveBadge state={ch.valveState} />
                      </div>
                      <DefRow k="Flow rate" v={`${ch.flowRateLpm} L/min`} />
                      <DefRow k="Total volume" v={`${ch.totalVolumeLitres} L`} />
                      {ch.fault && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "#9a6a16", background: "#fdf3e0", borderRadius: 8, padding: "5px 9px" }}>⚠ Fault: {ch.fault}</div>}
                    </div>
                  ))}
                  {channels.length === 0 && <div style={{ gridColumn: "1/-1" }}><Empty msg="No channels reported." /></div>}
                </div>
              </Card>
            </div>

            {chartData.length > 1 && (
              <div style={{ marginTop: 18 }}>
                <Card title="Pressure over time" sub={`Input pressure across the last ${chartData.length} readings.`}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ left: 6, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
                      <XAxis dataKey="time" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<TT />} />
                      <Line type="monotone" dataKey="pressure" name="Pressure (bar)" stroke="#0f6e3f" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {chartData.length > 1 && (
              <div style={{ marginTop: 18 }}>
                <Card title="Flow rate over time" sub="Litres per minute through each pipe.">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ left: 6, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
                      <XAxis dataKey="time" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="flow_CH01" name="CH_01 (L/min)" stroke="#0f6e3f" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="flow_CH02" name="CH_02 (L/min)" stroke="#90ab8b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <Card title="Recent heartbeats" sub="Each row is one message from the device · refreshes every 15s." pad={false}>
                <Table head={["Time", "Pressure", "CH_01 Flow", "CH_01 Valve", "CH_02 Flow", "CH_02 Valve", "Fault"]} maxHeight={360}>
                  {[...history].reverse().map((item, i) => {
                    const ch1 = item.payload?.units?.[0]?.channels?.find(c => c.channelId === "CH_01");
                    const ch2 = item.payload?.units?.[0]?.channels?.find(c => c.channelId === "CH_02");
                    const fault = ch1?.fault || ch2?.fault;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: fault ? "#fdf9ef" : "transparent" }}>
                        <td style={{ ...td, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "var(--muted)" }}>{iotClock(item.timestamp)}</td>
                        <td style={{ ...td, color: "var(--teal-d)", fontWeight: 600 }}>{item.payload?.inputPressure} bar</td>
                        <td style={td}>{ch1?.flowRateLpm} L/min</td>
                        <td style={{ ...td, textAlign: "center" }}><ValveBadge state={ch1?.valveState} /></td>
                        <td style={td}>{ch2?.flowRateLpm} L/min</td>
                        <td style={{ ...td, textAlign: "center" }}><ValveBadge state={ch2?.valveState} /></td>
                        <td style={{ ...td, color: "#9a6a16", fontWeight: 600 }}>{fault ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && <tr><td colSpan={7} style={{ padding: 0 }}><Empty msg="No heartbeats yet." /></td></tr>}
                </Table>
              </Card>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   ANALYTICS — Earned Revenue (day-based) · Apartment Performance · Sales
   =========================================================================== */
const momPct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
const inr2 = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _addMonths = (y, m, n) => { const idx = y * 12 + (m - 1) + n; return [Math.floor(idx / 12), (idx % 12) + 1]; };
const _monthShort = (y, m) => new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const _monthLong = (y, m) => new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/* §7 — Earned Revenue: recognise recharge revenue DAY-BY-DAY across the plan term
   (1 month = 30 days). Deposit is not revenue; recharge = total − deposit. */
function EarnedRevenue() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [ym, setYm] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; });
  useEffect(() => {
    api.logView(user.username, "Viewed Earned Revenue");
    Promise.all([billingApi.getInvoices(), billingApi.getSubscriptions()])
      .then(([inv, subs]) => setData({ inv, subs }))
      .catch(() => setData({ inv: [], subs: [] }));
  }, []);
  if (!data) return <Loading />;

  const DAY = 86400000;
  const subByCustomer = {};
  data.subs.forEach(s => { [s.customerNumber, s.zohoCustomerId, s.zohoId].filter(Boolean).forEach(k => { subByCustomer[k] = s; }); });
  const subFor = (i) => subByCustomer[i.customerNumber] || subByCustomer[i.zohoCustomerId] || subByCustomer[i.zohoId] || null;

  const rows = data.inv.filter(i => i.status === "paid" && (i.total || 0) > 0).map(i => {
    const sub = subFor(i);
    const plan = sub?.plan || i.plan || "—";
    const total = i.total || 0;
    const deposit = depositForPlan(plan, total);
    const recharge = Math.max(0, total - deposit);
    const months = termMonths(sub || { interval: i.interval, plan }) || 1;
    const termDays = Math.max(1, Math.round(months * 30));
    const perDay = recharge / termDays;
    const pd = new Date(i.date);
    const valid = !isNaN(pd.getTime());
    const payMid = valid ? new Date(pd.getFullYear(), pd.getMonth(), pd.getDate()).getTime() : null;
    const termStart = payMid;
    const termEnd = payMid != null ? payMid + (termDays - 1) * DAY : null;
    return { customer: i.customerName || "—", plan, total, deposit, recharge, months, termDays, perDay, payDay: pd, payMid, termStart, termEnd };
  });

  const daysInMonthFor = (r, y, m) => {
    if (r.termStart == null || r.termEnd == null) return 0;
    const mStart = new Date(y, m - 1, 1).getTime();
    const mEnd = new Date(y, m, 0).getTime();       // midnight of the month's last day
    const s = Math.max(r.termStart, mStart);
    const e = Math.min(r.termEnd, mEnd);
    if (e < s) return 0;
    return Math.round((e - s) / DAY) + 1;           // inclusive
  };
  const earnedFor = (r, y, m) => r.perDay * daysInMonthFor(r, y, m);
  const paidInMonth = (r, y, m) => { const d = r.payDay; return d && !isNaN(d.getTime()) && d.getFullYear() === y && (d.getMonth() + 1) === m; };

  const [selY, selM] = ym.split("-").map(Number);
  const [pY, pM] = _addMonths(selY, selM, -1);
  const monLabel = _monthLong(selY, selM);

  const earnedThis = rows.reduce((s, r) => s + earnedFor(r, selY, selM), 0);
  const earnedPrev = rows.reduce((s, r) => s + earnedFor(r, pY, pM), 0);
  const collectedThis = rows.filter(r => paidInMonth(r, selY, selM));
  const collectedPrev = rows.filter(r => paidInMonth(r, pY, pM));
  const totalThis = collectedThis.reduce((s, r) => s + r.total, 0);
  const rechargeThis = collectedThis.reduce((s, r) => s + r.recharge, 0);
  const rechargePrev = collectedPrev.reduce((s, r) => s + r.recharge, 0);
  const depositThis = totalThis - rechargeThis;

  const now = new Date();
  const options = Array.from({ length: 19 }, (_, k) => {
    const [y, m] = _addMonths(now.getFullYear(), now.getMonth() + 1, k - 12);
    const future = (y > now.getFullYear()) || (y === now.getFullYear() && m > now.getMonth() + 1);
    return { val: `${y}-${m}`, label: _monthLong(y, m) + (future ? " · projected" : ""), future };
  });
  const timeline = Array.from({ length: 12 }, (_, k) => {
    const [y, m] = _addMonths(selY, selM, k - 6);
    return {
      label: _monthShort(y, m),
      earned: Math.round(rows.reduce((s, r) => s + earnedFor(r, y, m), 0)),
      recharge: Math.round(rows.filter(r => paidInMonth(r, y, m)).reduce((s, r) => s + r.recharge, 0)),
    };
  });

  const stats = [
    { label: "Earned this month", value: inr(Math.round(earnedThis)), icon: Scale, sub: monLabel, hero: true, delta: momPct(earnedThis, earnedPrev) },
    { label: "Recharge collected", value: inr(Math.round(rechargeThis)), icon: Wallet, sub: `revenue portion · total ${inr(totalThis)}`, delta: momPct(rechargeThis, rechargePrev) },
    { label: "Deposit collected", value: inr(Math.round(depositThis)), icon: Coins, sub: "total − recharge" },
    { label: "Contributing recharges", value: collectedThis.filter(r => r.recharge > 0).length, icon: Receipt, sub: `paid in ${monLabel}` },
  ];

  const tableRows = [...rows].sort((a, b) => earnedFor(b, selY, selM) - earnedFor(a, selY, selM));
  const totRow = tableRows.reduce((a, r) => ({ total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge, earnedMonth: a.earnedMonth + earnedFor(r, selY, selM) }), { total: 0, deposit: 0, recharge: 0, earnedMonth: 0 });

  const exportCsv = () => exportToCsv(`prowater-earned-${ym}.csv`, [
    { label: "Customer", get: r => r.customer }, { label: "Plan", get: r => r.plan },
    { label: "Paid on", get: r => (r.payDay && !isNaN(r.payDay.getTime())) ? fmtDate(r.payDay) : "" },
    { label: "Total paid", get: r => r.total }, { label: "Deposit", get: r => r.deposit }, { label: "Recharge", get: r => r.recharge },
    { label: "Term months", get: r => r.months }, { label: "Term days", get: r => r.termDays },
    { label: "Earned/month", get: r => Math.round(r.recharge / (r.months || 1)) }, { label: "Earned/day", get: r => r.perDay.toFixed(2) },
    { label: `Days in ${monLabel}`, get: r => daysInMonthFor(r, selY, selM) }, { label: `Earned in ${monLabel}`, get: r => earnedFor(r, selY, selM).toFixed(2) },
  ], tableRows);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Month</span>
        <select value={ym} onChange={e => setYm(e.target.value)} style={selectStyle}>
          {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Earned vs recharge collected" sub="Bars = revenue recognised that month (accrual) · line = recharge cash collected">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={timeline} margin={{ left: -8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<TT prefix="₹" />} />
              <Legend />
              <Bar dataKey="earned" name="Earned" fill="#5a7863" radius={[5, 5, 0, 0]} isAnimationActive={false} />
              <Line dataKey="recharge" name="Recharge collected" stroke="#c2671e" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div style={{ marginTop: 18 }}>
        <Card pad={false} title={`Per-invoice recognition · ${monLabel}`} sub="Day-based: earned/day × days of the term falling inside the selected month.">
          <Table head={["Customer", "Plan", "Paid on", "Total paid", "Deposit", "Recharge", "Term", "Earned/month", "Earned/day", `Days in ${_monthShort(selY, selM)}`, `Earned in ${_monthShort(selY, selM)}`]} maxHeight="calc(100vh - 460px)">
            {tableRows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.customer}</td>
                <td style={{ ...td, fontSize: 12, textAlign: "center" }}>{r.plan}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{(r.payDay && !isNaN(r.payDay.getTime())) ? fmtDate(r.payDay) : "—"}</td>
                <td style={{ ...td, fontWeight: 600 }}>{inr(r.total)}</td>
                <td style={td}>{inr(r.deposit)}</td>
                <td style={{ ...td, color: "var(--teal-d)", fontWeight: 600 }}>{inr(r.recharge)}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12 }}>{r.months}mo · {r.termDays}d</td>
                <td style={td}>{inr(Math.round(r.recharge / (r.months || 1)))}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{inr2(r.perDay)}</td>
                <td style={td}>{daysInMonthFor(r, selY, selM)}</td>
                <td style={{ ...td, fontWeight: 600, color: "var(--forest)" }}>{inr2(earnedFor(r, selY, selM))}</td>
              </tr>
            ))}
            {tableRows.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }} colSpan={3}>Total ({tableRows.length})</td>
                <td style={ftd}>{inr(totRow.total)}</td>
                <td style={ftd}>{inr(totRow.deposit)}</td>
                <td style={ftd}>{inr(totRow.recharge)}</td>
                <td style={ftd}></td>
                <td style={ftd}></td>
                <td style={ftd}></td>
                <td style={ftd}></td>
                <td style={ftd}>{inr2(totRow.earnedMonth)}</td>
              </tr>
            )}
          </Table>
          {tableRows.length === 0 && <Empty msg="No paid invoices to recognise." />}
        </Card>
      </div>
    </div>
  );
}

/* §8 — Apartment Performance: paid invoices joined to customers, grouped by
   apartment (society) or purifier ID, with deposit/recharge split + MoM. */
function ApartmentPerformance() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("apartment");     // "apartment" | "purifier"
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [ym, setYm] = useState("all");
  const PER = 12;
  useEffect(() => {
    api.logView(user.username, "Viewed Apartment Performance");
    Promise.all([billingApi.getInvoices(), customerApi.getCustomers()])
      .then(([inv, cust]) => setData({ inv, cust }))
      .catch(() => setData({ inv: [], cust: [] }));
  }, []);
  useEffect(() => { setPage(1); }, [q, mode, ym]);
  if (!data) return <Loading />;

  const custBy = {};
  data.cust.forEach(c => { [c.zohoId, c.id, c.zohoCustomerId].filter(Boolean).forEach(k => { custBy[k] = c; }); });
  const custFor = (i) => custBy[i.zohoCustomerId] || custBy[i.zohoId] || custBy[i.customerNumber] || null;

  const paidAll = data.inv.filter(i => i.status === "paid" && (i.total || 0) > 0).map(i => {
    const c = custFor(i);
    const total = i.total || 0;
    const plan = i.plan || c?.plan || "";
    const deposit = depositForPlan(plan, total);
    return { society: c?.society || i.customerName || "—", purifierId: c?.purifier_id || "—", total, deposit, recharge: Math.max(0, total - deposit), date: i.date };
  });

  const monthKeyOf = (d0) => { const d = new Date(d0); return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${d.getMonth() + 1}`; };
  const monthsAvail = Array.from(new Set(paidAll.map(r => monthKeyOf(r.date)).filter(Boolean)))
    .sort((a, b) => { const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number); return by * 12 + bm - (ay * 12 + am); });
  const enriched = ym === "all" ? paidAll : paidAll.filter(r => monthKeyOf(r.date) === ym);

  const keyOf = (r) => mode === "apartment" ? (r.society || "—") : (r.purifierId || "—");
  const groups = {};
  enriched.forEach(r => { const k = keyOf(r); if (!groups[k]) groups[k] = { key: k, count: 0, total: 0, deposit: 0, recharge: 0 }; groups[k].count++; groups[k].total += r.total; groups[k].deposit += r.deposit; groups[k].recharge += r.recharge; });
  const rows = Object.values(groups).sort((a, b) => b.total - a.total);
  const filtered = rows.filter(r => String(r.key).toLowerCase().includes(q.toLowerCase()));
  const tot = filtered.reduce((a, r) => ({ total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge, count: a.count + r.count }), { total: 0, deposit: 0, recharge: 0, count: 0 });

  // MoM: selected vs previous month; all-time = current month vs last month.
  const now = new Date();
  const [cy, cm] = (ym === "all" ? `${now.getFullYear()}-${now.getMonth() + 1}` : ym).split("-").map(Number);
  const [py, pm] = _addMonths(cy, cm, -1);
  const sumFor = (y, m) => paidAll.filter(r => monthKeyOf(r.date) === `${y}-${m}`).reduce((a, r) => ({ total: a.total + r.total, deposit: a.deposit + r.deposit, recharge: a.recharge + r.recharge }), { total: 0, deposit: 0, recharge: 0 });
  const cur = sumFor(cy, cm), prev = sumFor(py, pm);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur1 = Math.min(page, totalPages);
  const start = (cur1 - 1) * PER;
  const pageRows = filtered.slice(start, start + PER);
  const scopeLabel = ym === "all" ? "all time" : _monthLong(cy, cm);

  const stats = [
    { label: "Total collected", value: inr(tot.total), icon: Wallet, sub: scopeLabel, hero: true, delta: momPct(cur.total, prev.total) },
    { label: "Recharge", value: inr(tot.recharge), icon: TrendingUp, sub: "revenue portion", delta: momPct(cur.recharge, prev.recharge) },
    { label: "Deposit", value: inr(tot.deposit), icon: Coins, sub: "refundable", delta: momPct(cur.deposit, prev.deposit) },
    { label: mode === "apartment" ? "Apartments" : "Purifier IDs", value: filtered.length, icon: Boxes, sub: `${tot.count} invoices` },
  ];

  const exportCsv = () => exportToCsv(`prowater-apartment-performance-${ym}.csv`, [
    { label: mode === "apartment" ? "Apartment" : "Purifier ID", get: r => r.key }, { label: "Invoices", get: r => r.count },
    { label: "Total", get: r => r.total }, { label: "Deposit", get: r => r.deposit }, { label: "Recharge", get: r => r.recharge },
  ], filtered);

  const seg = (v, label) => (
    <button onClick={() => setMode(v)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "1.5px solid var(--border)", background: mode === v ? "var(--forest)" : "#fff", color: mode === v ? "#fff" : "var(--slate)", borderRadius: 10, cursor: "pointer" }}>{label}</button>
  );

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {seg("apartment", "By Apartment")}{seg("purifier", "By Purifier ID")}
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginLeft: 8 }}>Month</span>
        <select value={ym} onChange={e => setYm(e.target.value)} style={selectStyle}>
          <option value="all">All time</option>
          {monthsAvail.map(k => { const [y, m] = k.split("-").map(Number); return <option key={k} value={k}>{_monthLong(y, m)}</option>; })}
        </select>
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 16 }}>
        <Toolbar q={q} setQ={setQ} placeholder={mode === "apartment" ? "Search apartment…" : "Search purifier ID…"} count={filtered.length}
          right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
        <Card pad={false}>
          <Table head={[mode === "apartment" ? "Apartment" : "Purifier ID", "Invoices", "Deposit", "Recharge", "Total"]} maxHeight="calc(100vh - 460px)">
            {pageRows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.key}</td>
                <td style={td}>{r.count}</td>
                <td style={td}>{inr(r.deposit)}</td>
                <td style={{ ...td, color: "var(--teal-d)", fontWeight: 600 }}>{inr(r.recharge)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{inr(r.total)}</td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }}>Total ({filtered.length})</td>
                <td style={ftd}>{tot.count}</td>
                <td style={ftd}>{inr(tot.deposit)}</td>
                <td style={ftd}>{inr(tot.recharge)}</td>
                <td style={ftd}>{inr(tot.total)}</td>
              </tr>
            )}
          </Table>
          {filtered.length === 0 && <Empty msg="No paid invoices in scope." />}
          {filtered.length > PER && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{start + 1}–{Math.min(start + PER, filtered.length)} of {filtered.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur1 <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: cur1 <= 1 ? .5 : 1 }}><ChevronLeft size={15} /> Prev</button>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Page {cur1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={cur1 >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: cur1 >= totalPages ? .5 : 1 }}>Next <ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* §9 — Analytics · Sales insights: lead-status numbers + plan value by society. */
function SalesInsights() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [society, setSociety] = useState("all");
  const [sortSoc, setSortSoc] = useState({ key: "value", dir: "desc" });
  useEffect(() => { api.logView(user.username, "Viewed Sales insights"); salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([])); }, []);
  if (!deals) return <Loading />;

  const societies = ["all", ...Array.from(new Set(deals.map(d => d.society).filter(Boolean))).sort()];
  const scoped = society === "all" ? deals : deals.filter(d => d.society === society);

  const byStatus = {};
  scoped.forEach(d => { const s = d.rawStatus || "—"; if (!byStatus[s]) byStatus[s] = { status: s, count: 0, value: 0 }; byStatus[s].count++; byStatus[s].value += d.value || 0; });
  const statusRows = Object.values(byStatus).sort((a, b) => b.count - a.count);
  const totalCount = scoped.length;
  const totalValue = scoped.reduce((s, d) => s + (d.value || 0), 0);

  const bySociety = {};
  deals.forEach(d => { const s = d.society || "—"; if (!bySociety[s]) bySociety[s] = { society: s, count: 0, value: 0 }; bySociety[s].count++; bySociety[s].value += d.value || 0; });
  const toggleSoc = (k) => setSortSoc(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const socRows = Object.values(bySociety).sort((a, b) => (a[sortSoc.key] < b[sortSoc.key] ? -1 : 1) * (sortSoc.dir === "asc" ? 1 : -1));
  const socTotal = socRows.reduce((a, r) => ({ count: a.count + r.count, value: a.value + r.value }), { count: 0, value: 0 });

  const stats = [
    { label: "Leads in view", value: totalCount, icon: Briefcase, sub: society === "all" ? "all societies" : society, hero: true },
    { label: "Plan value", value: inr(totalValue), icon: Wallet, sub: "in view" },
    { label: "Societies", value: Object.keys(bySociety).length, icon: Boxes, sub: "with leads" },
    { label: "Lead statuses", value: statusRows.length, icon: GitBranch, sub: "distinct" },
  ];
  const chartData = statusRows.slice(0, 10).map(r => ({ name: r.status, leads: r.count }));

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Society</span>
        <select value={society} onChange={e => setSociety(e.target.value)} style={selectStyle}>
          {societies.map(s => <option key={s} value={s}>{s === "all" ? `All societies (${deals.length})` : s}</option>)}
        </select>
      </div>
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>
      <div style={{ marginTop: 18 }}>
        <Card title="Leads by status" sub={society === "all" ? "Across all societies" : society}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6efe9" vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="leads" fill="#3a6ea5" radius={[5, 5, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12 }}>
            <Table head={["Status", "Leads", "%", "Plan value"]}>
              {statusRows.map(r => (
                <tr key={r.status} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.status}</td>
                  <td style={td}>{r.count}</td>
                  <td style={td}>{totalCount ? Math.round((r.count / totalCount) * 100) : 0}%</td>
                  <td style={{ ...td, fontWeight: 600 }}>{inr(r.value)}</td>
                </tr>
              ))}
              {statusRows.length > 0 && (
                <tr>
                  <td style={{ ...ftd, textAlign: "center" }}>Total</td>
                  <td style={ftd}>{totalCount}</td>
                  <td style={ftd}>100%</td>
                  <td style={ftd}>{inr(totalValue)}</td>
                </tr>
              )}
            </Table>
            {statusRows.length === 0 && <Empty msg="No leads in view." />}
          </div>
        </Card>
      </div>
      <div style={{ marginTop: 18 }}>
        <Card pad={false} title="Total plan value by society" sub="Click a row to filter the status breakdown above.">
          <Table head={["Society", <SortHeader key="c" label="Leads" k="count" sort={sortSoc} onSort={toggleSoc} />, <SortHeader key="v" label="Plan value" k="value" sort={sortSoc} onSort={toggleSoc} />]} maxHeight="calc(100vh - 300px)">
            {socRows.map(r => (
              <tr key={r.society} style={{ ...trStyle, background: society === r.society ? "var(--mint)" : "transparent" }} onClick={() => setSociety(society === r.society ? "all" : r.society)}>
                <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.society}</td>
                <td style={td}>{r.count}</td>
                <td style={{ ...td, fontWeight: 600 }}>{inr(r.value)}</td>
              </tr>
            ))}
            {socRows.length > 0 && (
              <tr>
                <td style={{ ...ftd, textAlign: "center" }}>Total ({socRows.length})</td>
                <td style={ftd}>{socTotal.count}</td>
                <td style={ftd}>{inr(socTotal.value)}</td>
              </tr>
            )}
          </Table>
          {socRows.length === 0 && <Empty msg="No societies with leads." />}
        </Card>
      </div>
    </div>
  );
}

/* §10 — Sales · Error Correction: Installed leads missing money fields. */
function SalesErrorCorrection({ isAdmin }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const refresh = () => salesApi.getDeals().then(d => setDeals(d.filter(notHiddenLead))).catch(() => setDeals([]));
  useEffect(() => { api.logView(user.username, "Viewed Sales error correction"); refresh(); }, []);
  if (!deals) return <Loading />;

  const flash = m => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const move = async (id, stage) => { await salesApi.updateStage(user.username, id, stage); await refresh(); flash("Stage updated"); };

  const missingMoney = (d) => !(Number(d.value) > 0) || !(Number(d.deposit) > 0) || !(Number(d.amountToCollect) > 0);
  const errored = deals.filter(d => norm(d.rawStatus) === "installed" && missingMoney(d));
  const filtered = errored.filter(d => (d.customer + d.society + d.phone + (d.flatNo || "")).toLowerCase().includes(q.toLowerCase()));

  const Missing = () => <span style={{ fontSize: 11, fontWeight: 700, color: "#b4232a", background: "#fbe9e9", padding: "3px 8px", borderRadius: 7 }}>Missing</span>;
  const money = (v) => Number(v) > 0 ? inr(Number(v)) : <Missing />;

  const exportCsv = () => exportToCsv("prowater-sales-error-correction.csv", [
    { label: "Full Name", get: d => d.customer }, { label: "Phone", get: d => d.phone }, { label: "Flat No", get: d => d.flatNo },
    { label: "Lead Status", get: d => d.rawStatus }, { label: "Society Name", get: d => d.society }, { label: "Tenure", get: d => d.planTenure },
    { label: "Plan Value", get: d => d.value || "" }, { label: "Deposit", get: d => d.deposit || "" }, { label: "To Collect", get: d => d.amountToCollect || "" },
    { label: "Created", get: d => d.created },
  ], filtered);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9a6a16", background: "#fdf3e0", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
        <AlertCircle size={15} /> Installed leads with a missing Plan Value, Deposit or To-Collect amount. Fix these in Zoho — cells flagged <span style={{ fontWeight: 700, color: "#b4232a" }}>Missing</span> are blank/zero.
      </div>
      <Toolbar q={q} setQ={setQ} placeholder="Search name, society, phone, flat…" count={filtered.length}
        right={<button onClick={exportCsv} style={btnGhost}><Download size={15} /> Export</button>} />
      <Card pad={false}>
        <Table head={["Full Name", "Phone", "Flat No", "Lead Status", "Society Name", "Tenure", "Plan Value", "Deposit", "To Collect", "Created", ...(isAdmin ? ["Move to"] : [])]} maxHeight="calc(100vh - 320px)">
          {filtered.map(d => (
            <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{d.customer}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.phone || <Missing />}</td>
              <td style={td}>{d.flatNo || <Missing />}</td>
              <td style={td}><span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: "#fff", background: "#1f7a3f", whiteSpace: "nowrap" }}>{d.rawStatus}</span></td>
              <td style={td}>{d.society || <Missing />}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{d.planTenure || <Missing />}</td>
              <td style={{ ...td, fontWeight: 600 }}>{money(d.value)}</td>
              <td style={td}>{money(d.deposit)}</td>
              <td style={{ ...td, fontWeight: 600, color: "var(--teal-d)" }}>{money(d.amountToCollect)}</td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.created ? fmtTime(d.created) : "—"}</td>
              {isAdmin && <td style={td}>
                <select value={d.stage} onChange={e => move(d.id, e.target.value)} style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }}>
                  {SALES_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </td>}
            </tr>
          ))}
        </Table>
        {filtered.length === 0 && <Empty msg="No installed leads are missing money fields. 🎉" />}
      </Card>
      {toast && <div style={toastStyle}><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* §14 — Sales · Apartment Leads: purpose-built table from the apartments endpoint. */
function ApartmentLeads() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [statusF, setStatusF] = useState("all");
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);
  const PER = 20;
  useEffect(() => { api.logView(user.username, "Viewed Apartment Leads"); apartmentApi.getAll().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { setPage(1); }, [range, statusF]);
  if (!rows) return <Loading />;

  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  const inR = rangeFilter(range);
  const statuses = ["all", ...Array.from(new Set(rows.map(r => r.meetingStatus).filter(s => s && s !== "—")))];
  const filtered = rows.filter(r => inR(r.createdTime) && (statusF === "all" || r.meetingStatus === statusF));
  const sorted = [...filtered].sort((a, b) => { const ta = new Date(a.createdTime).getTime(), tb = new Date(b.createdTime).getTime(); const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb; return (va - vb) * (sort.dir === "asc" ? 1 : -1); });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * PER;
  const pageRows = sorted.slice(start, start + PER);

  const exportCsv = () => exportToCsv("prowater-apartment-leads.csv", [
    { label: "Apartment Name", get: r => r.name }, { label: "Manager Number", get: r => r.managerNumber },
    { label: "Meeting Status", get: r => r.meetingStatus }, { label: "POC", get: r => r.poc },
    { label: "Address", get: r => r.address }, { label: "Pincode", get: r => r.pincode },
    { label: "Flats", get: r => r.flats || "" }, { label: "Created", get: r => r.createdTime },
  ], sorted);

  return (
    <div className="fade-up">
      <DateRangeFilter range={range} onChange={setRange} right={
        <span className="no-print" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{filtered.length} apartment{filtered.length !== 1 ? "s" : ""}</span>
      } />
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Meeting status</span>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={selectStyle}>
          {statuses.map(s => <option key={s} value={s}>{s === "all" ? `All statuses (${rows.length})` : s}</option>)}
        </select>
        <button onClick={exportCsv} style={{ ...btnGhost, marginLeft: "auto" }}><Download size={15} /> Export</button>
      </div>
      <Card pad={false}>
        <Table head={["Apartment Name", "Manager Number", "Meeting Status", "POC", "Address", "Pincode", "Flats",
          <SortHeader key="cr" label="Created" k="created" sort={sort} onSort={toggleSort} />]} maxHeight="calc(100vh - 360px)">
          {pageRows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontWeight: 600, color: "var(--f)", textAlign: "center" }}>{r.name}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{r.managerNumber || "—"}</td>
              <td style={td}>{r.meetingStatus || "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>{r.poc || "—"}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, maxWidth: 260 }}>{r.address || "—"}</td>
              <td style={td}>{r.pincode || "—"}</td>
              <td style={td}>{r.flats || "—"}</td>
              <td style={{ ...td, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.createdTime ? fmtTime(r.createdTime) : "—"}</td>
            </tr>
          ))}
        </Table>
        {sorted.length === 0 && <Empty msg="No apartment leads found." />}
        {sorted.length > PER && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{start + 1}–{Math.min(start + PER, sorted.length)} of {sorted.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={cur <= 1} style={{ ...btnGhost, padding: "6px 12px", opacity: cur <= 1 ? .5 : 1 }}><ChevronLeft size={15} /> Prev</button>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Page {cur} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={cur >= totalPages} style={{ ...btnGhost, padding: "6px 12px", opacity: cur >= totalPages ? .5 : 1 }}>Next <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Table({ head, children, maxHeight }) {
  return (
    <div className="scroll-thin" style={{ overflowX: "auto", overflowY: maxHeight ? "auto" : "visible", maxHeight: maxHeight || "none" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} style={{ textAlign: "center", padding: "13px 16px", fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: "#28323a", fontWeight: 700, borderBottom: "2px solid #dde7da", background: "#ebf4dd", whiteSpace: "nowrap", verticalAlign: "middle", position: maxHeight ? "sticky" : "static", top: 0, zIndex: 1 }}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Toolbar({ q, setQ, placeholder, count, right }) {
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

function Person({ name, email }) {
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

function Chip({ children }) {
  return <span style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", background: "var(--mint-2)", color: "var(--teal-d)", padding: "3px 8px", borderRadius: 7, fontWeight: 600 }}>{children}</span>;
}

function Status({ s }) {
  const map = {
    active: ["#1f7a3f", "#e6f4ea"], paid: ["#1f7a3f", "#e6f4ea"], approved: ["#1f7a3f", "#e6f4ea"], converted: ["#1f7a3f", "#e6f4ea"],
    pending: ["#9a6a16", "#fdf3e0"], paused: ["#9a6a16", "#fdf3e0"],
    failed: ["#b4232a", "#fbe9e9"], rejected: ["#b4232a", "#fbe9e9"], disabled: ["#6a7670", "#eceeed"],
  };
  const [c, bg] = map[s] || ["#6a7670", "#eceeed"];
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, padding: "3px 9px", borderRadius: 999, textTransform: "capitalize" }}>{s}</span>;
}

function LogChip({ type }) {
  const palette = {
    login_success: ["#1f7a3f", "#e6f4ea"], login_failed: ["#b4232a", "#fbe9e9"],
    logout: ["#6a7670", "#eceeed"], user_created: ["#16545c", "#e2eff0"],
    password_reset: ["#9a6a16", "#fdf3e0"], user_deleted: ["#b4232a", "#fbe9e9"],
    user_toggled: ["#16545c", "#e2eff0"],
    api_failure: ["#b4232a", "#fbe9e9"], api_recovery: ["#1f7a3f", "#e6f4ea"], logs_cleared: ["#9a6a16", "#fdf3e0"],
    credit_approved: ["#1f7a3f", "#e6f4ea"], credit_rejected: ["#b4232a", "#fbe9e9"],
    credit_manual: ["#16545c", "#e2eff0"],
    reverted: ["#9a6a16", "#fdf3e0"],
  };
  const [c, bg] = palette[type] || ["#6a7670", "#eceeed"];
  return <span style={{ fontSize: 11, fontWeight: 600, color: c, background: bg, padding: "3px 8px", borderRadius: 7 }}>{type.replace(/_/g, " ")}</span>;
}

function DefRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{k}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14, textAlign: "left" }}>
      <span style={{ display: "block", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, marginBottom: 6, textAlign: "left" }}>{label}</span>
      {children}
    </label>
  );
}

function Drawer({ title, sub, children, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{ ...overlay, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="scroll-thin" style={{
        marginLeft: "auto", width: "min(440px,100%)", height: "100%", background: "#fff", padding: 26, overflowY: "auto",
        boxShadow: "var(--shadow-lg)", animation: "slideIn .25s ease both"
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:.6}to{transform:none;opacity:1}}`}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
          <div><p className="eyebrow">{sub}</p><h2 style={{ fontSize: 24 }}>{title}</h2></div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Modal({ title, sub, children, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{ ...overlay, alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="pw-pop" style={{ width: "min(440px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 26, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
          <div>{sub && <p className="eyebrow">{sub}</p>}<h2 style={{ fontSize: 22 }}>{title}</h2></div>
          <button onClick={onClose} style={{ ...iconBtn, flexShrink: 0 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const TT = ({ active, payload, label, prefix = "" }) => {
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

const WowMomTT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload || {};
  const pct = p.pct;
  const pctColor = pct == null ? "#fff" : pct > 0 ? "#a8d940" : pct < 0 ? "#ff9a9a" : "#fff";
  return (
    <div style={{ background: "var(--forest)", color: "#fff", padding: "9px 12px", borderRadius: 9, fontSize: 12, boxShadow: "var(--shadow-lg)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div>Collected: <strong>₹{(p.collected || 0).toLocaleString("en-IN")}</strong></div>
      {pct != null && <div style={{ color: pctColor, marginTop: 2 }}>{pct > 0 ? "▲" : pct < 0 ? "▼" : "—"} {pct > 0 ? "+" : ""}{pct}% vs prev</div>}
    </div>
  );
};

const Loading = () => <div style={{ display: "grid", placeItems: "center", padding: 80, color: "var(--muted)" }}>
  <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--teal)", borderRadius: 999, animation: "spin 1s linear infinite" }} />
  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
</div>;

const Empty = ({ msg }) => <div style={{ padding: "28px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>{msg}</div>;

const ApiError = ({ msg }) => (
  <div style={{ padding: "40px 28px", textAlign: "center", color: "var(--slate)" }}>
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 999, background: "#fbe9e9", color: "#b4232a", marginBottom: 12 }}>
      <AlertCircle size={24} />
    </div>
    <h3 style={{ fontSize: 18, marginBottom: 6 }}>Couldn't load data</h3>
    <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 420, margin: "0 auto 16px" }}>{msg}</p>
    <button onClick={() => window.location.reload()} style={btnGhost}>Retry</button>
  </div>
);

/* ---------- inline style objects ---------- */
const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 11, fontSize: 14, color: "var(--f)", background: "#fff", outline: "none", marginBottom: 0 };
const selectStyle = { ...inp, width: "auto", padding: "9px 12px", cursor: "pointer" };
const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, background: "var(--grad-btn)", color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 8px 18px -8px rgba(22,84,92,.6)", justifyContent: "center" };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 11, border: "1.5px solid var(--border)", background: "#fff", color: "var(--slate)", fontWeight: 600, fontSize: 13 };
const iconBtn = { display: "inline-flex", padding: 7, borderRadius: 9, color: "var(--slate)", background: "var(--mint)", marginLeft: 5 };
const td = { padding: "12px 16px", fontSize: 13.5, color: "#26302b", borderBottom: "1px solid #eef2f0", whiteSpace: "normal", wordBreak: "break-word", textAlign: "center", verticalAlign: "middle" };
// Sticky grand-total footer cell (money tables).
const ftd = { ...td, position: "sticky", bottom: 0, background: "var(--mint-2)", fontWeight: 700, borderTop: "2px solid var(--border)" };
const trStyle = { borderBottom: "1px solid var(--border)", cursor: "pointer" };
const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 };
const axisTick = { fontSize: 11, fill: "#869089" };
const overlay = { position: "fixed", inset: 0, background: "rgba(13,40,24,.46)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", zIndex: 50 };
const toastStyle = { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--forest)", color: "#fff", padding: "11px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, boxShadow: "var(--shadow-lg)", zIndex: 60 };

/* ---------- helpers ---------- */
const fmtDate = d => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = d => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
