import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Users, GitBranch, BarChart3, ScrollText, UserCog,
  LogOut, Search, Plus, Eye, EyeOff, Shield, ShieldCheck, Filter,
  TrendingUp, Award, Wallet, ChevronRight, X, CheckCircle2, Clock,
  AlertCircle, Download, Lock, ArrowUpRight, Trash2, KeyRound, Menu,
  Coins, Check, Ban, Hourglass, Globe, MapPin, Undo2, RotateCcw, RefreshCw, Camera, Image as ImageIcon, Trophy, Medal, MessageCircle, Phone, ArrowUpDown, ChevronLeft, Moon, Sun, Printer, Briefcase, Receipt, Boxes, Wrench, Home as HomeIcon, LayoutGrid, Construction, Ticket, UserRound, PencilLine, Cpu, Landmark, Scale, ArrowLeftRight, Droplets, CalendarClock, Repeat, Info, Paperclip, GripVertical, CalendarDays, Bell, Tag, CalendarRange, Rocket, Target, ArrowUp, ArrowDown, ChevronDown, ChevronUp, SlidersHorizontal, Sparkles, Thermometer, FlaskConical, Gauge, Waves, Upload, PlayCircle
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  ComposedChart, Line, ReferenceLine, ReferenceArea, LineChart
} from "recharts";
import { ApiUsageTracker, makeCache } from "./lib/apiUsageTracker";
import {
  API_BASE, API_ORIGIN, API_USAGE_LIMITS, APP_VERSION, Auth, BILLING_CYCLES,
  CACHE_MS, CUSTOMER_FIELDS, DATE_PRESETS, DEVICE_TYPE_STYLE, EMAIL_DOMAIN,
  EXISTING_CREDIT, IS_LOCAL, LOGS_EPOCH, LS, MODULES, MODULE_SOURCES,
  NEW_CREDIT, PERSIST_TTL, PLANS, PRESET_UNIT, RANGE_MONTHS, SEED_CUSTOMERS,
  SESSION_IDLE_MS, TAB_SOURCES, THEMES, VERSION_DATE, ZOHO_MAX_CONCURRENT, ZOHO_MIN_GAP_MS,
  _apiCache, _apiCacheAt, _creditOverrides, _currentModule, setCurrentModule, _custCache, _customers,
  _dpCache, _emptySession, _failureListeners, _failures, _inflight,
  _logs, _manualCredits, _memCache, _notifyFailureListeners, _otpStore, _photos,
  _rateLimitedUntil, _sampleListeners, _sampleSources, _session, _undoStack, _users,
  _zohoAcquire, _zohoActive, _zohoNextAt, _zohoQueue, _zohoRelease, addDays,
  allAccess, api, apiTracker, applyTheme, authHeaders, bucketKeyOf,
  bucketsFor, clearSessionStorage, customerApi, dateInRange, deviceType, dmy,
  endOfDay, exportToCsv, failingSourcesNow, fetchAllDpTransactions, fetchAllPaged,
  fetchAllPagesFast, fetchAllReferrals, fetchPage, fmtDate, fmtDowntime, fmtPhone,
  fmtTime, freeLabel, getCached, getClientNetwork, getGpsCoords, getIpNetwork,
  getStoredTheme, inRateLimitCooldown, inr, ipCache, isRateLimit, isoDay,
  DR_FS_PROJECT, DR_FS_DB, _drScalar, _drToFsFields, hashStr, keyLc, loadPersistedRows, markSample, momPct, monthEnd, norm,
  apartmentApi, pickAptField, mapApartment,
  ticketApi, mapZohoDeskTicket, mapWisdomTicket, tdsNum, isWisdomTicketShape, SEED_TICKETS,
  ZD_DEFAULT_STATUSES, zdStatusColor, zdIsClosed, ZD_PRIORITIES, zdPriorityColor, zdPriorityLabel, fmtIST,
  parsePartsUsed, jobDurationMin, fmtDuration, istDateOf,
  _tickets, _tkCache, _tkCacheAt,
  parseApiDate, parseFlexDate, pluralise, presetLabel, prevRange, pushLog,
  rangeFilter, rangeLabel, recordApiFailure, recordApiRecovery, resolveRange,
  reverseGeocode, saveFailures, saveLogs, savePersistedRows, savePhotos, saveSession,
  saveUsers, seedUsers, sessionDayStr, spanDays, startOfDay, startOfWeek,
  toCredits, toReferees, toReferrers, toTrend, useAuth, useDateRange,
  useFailures, useSampleData, wait, yoyRange,
  billingApi, creditNoteApi, depositForCustomer, termMonths, monthlyOf,
} from "./shared/core";
import {
  ApiError, CHART_PALETTE, Card, Chip, DateRangeFilter, DateRangePicker,
  DefRow, DeviceTypeBadge, Drawer, Drop, Empty, Field,
  ForgotPassword, Loading, LogChip, Login, Modal, MultiSelectFilter,
  PIE_LABEL_OFFSET, Person, PhotoUploader, SortHeader, Stat, Status,
  TT, Table, Toolbar, WowMomTT, axisTick, btnGhost,
  btnPrimary, ftd, grid4, iconBtn, inp, overlay,
  pieLabelLine, renderPieLabel, selectStyle, td, toastStyle, trStyle, GsTextCell, MODULE_ICONS
} from "./shared/ui";
import { AssetLifecycle } from "./modules/ERP";
import { UsersAdmin } from "./modules/Employee";
import { DeviceReplacement } from "./modules/DeviceReplacement";
import { TrackTechnician, MaintenanceSchedule, WaterQuality } from "./modules/FSM";
import { AutoGSSociety, IoTAlerts } from "./modules/AutoScheduler";
import { tkStatus, tkPriority, TicketBadge, TicketOverview, OpsKpis, OpsSparesTable, OpsTdsTable, TicketList } from "./modules/Ticketing";
import { ApiUsageDashboard, Logs, Failures } from "./modules/LogsTracker";
import { ReleaseManager, ReleasePopup, AboutModule } from "./modules/About";
import { SalesLeads, SalesTrendAnalysis, SalesErrorCorrection, ApartmentLeads, salesApi, notHiddenLead } from "./modules/Sales";
import { TaskPlanner, TaskAdmin } from "./modules/TaskPlanner";
import { CustomerSocieties, AllCustomers, Customers, CustomerDrawer } from "./modules/Customer";
import { Overview, Referrers, Referees, Credits, AddManualCredit, Analytics as ReferralAnalyticsTab, Backtrack, Tracker } from "./modules/Referral";
import { BillingOverview, Subscriptions, Invoices, DepositRefunds, Plans } from "./modules/Billing";
import { IoTDevices, IoTAlertsPage } from "./modules/IoT";
import {
  AnalyticsOverview, SalesInsights, CreditsAnalytics, NetRevenue,
  PenetrationTracker, BillingAnalytics, AppLogs, EarnedRevenue,
  Reconciliation, DPTransactions, AOP, ChurnRiskRadar, ApartmentPerformance,
} from "./modules/Analytics";

/* ============================================================================
   ProWater Referral Dashboard
   ----------------------------------------------------------------------------
   Single-file frontend. Mock data layer (`api`) is isolated so you can swap
   each function for a real Zoho Billing / Firebase call later. Search for
   "// >>> WIRE:" comments to find every integration point.
   ============================================================================ */

/* Categorical chart colors, drawn only from the brand palette and ordered so
   adjacent series stay tellable apart. Seven is the ceiling — past that the
   palette has no further distinct hues, so prefer grouping to an 8th slice. */

/* Donut slice label: absolute value + share, set outside the ring with a leader
   line. Recharts hands `percent` back as a 0..1 fraction. Zero-value slices are
   skipped — Recharts still calls this for them and the label would sit orphaned
   on the ring with no slice under it. */

/* ---------- Design tokens (injected once) ---------- */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  /* ProWater palette. The 11 brand hexes are the source of truth; everything
     below is either one of them or a documented derivation (tints ≈ 12% of the
     hue over Surface, tint-borders ≈ 30%). Don't introduce new hues — map to a
     token instead, so a palette change stays a one-file edit. */
  :root{
    --brand:#0A9D6E;        /* brand green — primary actions, positive series */
    --green:#08805A;        /* green · text — success text, strong accents      */
    --deep:#0B6F52;         /* deep green — dark accents, second green series   */
    --mint:#EEF7F3;         /* mint — app background                            */
    --f:#0A1A12;            /* ink · text — headings                            */
    --slate:#0A1A12;        /* ink · text — body                                */
    --muted:#7D8A83;        /* muted text — labels / captions                   */
    --faint:#A9B3AC;        /* faint text — disabled / placeholder              */
    --border:#ECEEED;       /* hairline                                         */
    --white:#FFFFFF;        /* surface                                          */
    --amber:#986315;        /* amber · warn — the brand amber (#E0921F) darkened
                               to the same hue/sat until it passes AA as text     */
    --danger:#DC4141;       /* red · danger                                     */
    --blue:#2A86D6;         /* blue · progress                                  */

    /* derived — washes for status rows/badges and their borders */
    --mint-2:#E2F0EA;
    --green-t:#E2F3EE; --amber-t:#FBF0E0; --danger-t:#FBE8E8; --blue-t:#E5F0FA;
    --green-b:#B5E2D4; --amber-b:#F6DEBC; --danger-b:#F5BFBF;

    /* shell — the palette's ink, stepped for depth. Deep green #0B6F52 was
       tried here and rejected as too light; ink keeps the dark shell the app
       has always had. Deep green stays a content accent. */
    --shell:#0A1A12; --shell-2:#16261D; --shell-0:#06100B;

    /* legacy aliases — older code still reads these names */
    --forest:var(--shell); --forest-2:var(--shell-2);
    --teal:var(--brand); --teal-d:var(--green);
    --lime:var(--brand); --lime-d:var(--green);

    --grad:linear-gradient(135deg,#0A9D6E 0%, #0B6F52 140%);
    --grad-btn:linear-gradient(120deg,#0A9D6E 0%, #08805A 130%);
    --shadow:0 1px 2px rgba(10,26,18,.04), 0 8px 24px -12px rgba(10,26,18,.16);
    --shadow-lg:0 24px 60px -20px rgba(10,26,18,.28);
    --radius:16px;
  }
  /* ---- Dark theme (neutral black; keeps the green accent) ---- */
  :root[data-theme="dark"]{
    --mint:#0c0d0f; --mint-2:#191b1f;
    --f:#eaeef2; --slate:#dfe4ea; --muted:#8b95a1; --faint:#5f6874;
    --border:#262a31; --white:#15171b;
    --green-t:#14231b; --amber-t:#2a2213; --danger-t:#2a1616; --blue-t:#132231;
    --shell:#0e0f12; --shell-2:#181a1e; --shell-0:#060607;
    --forest:#0e0f12; --forest-2:#181a1e;
  }
  /* ---- Aesthetic theme (violet accent on white; no green) ---- */
  :root[data-theme="aesthetic"]{
    --brand:#6D5EF0; --green:#5A49E0; --deep:#4A3CCB;
    --teal:#6D5EF0; --teal-d:#5A49E0; --lime:#6D5EF0; --lime-d:#5A49E0;
    --mint:#F6F5FC; --mint-2:#ECEAFB; --border:#E7E5F3;
    --green-t:#ECEAFB; --green-b:#D8D3F6;
    --grad:linear-gradient(135deg,#6D5EF0 0%,#5A49E0 140%);
    --grad-btn:linear-gradient(120deg,#6D5EF0 0%,#5A49E0 130%);
    --shell:#241F45; --shell-2:#332A63; --shell-0:#171334;
    --forest:#241F45; --forest-2:#332A63;
  }
  *{box-sizing:border-box}
  html,body,#root{margin:0;padding:0;width:100%;min-height:100vh}
  body{margin:0;padding:0;background:var(--shell-0)}
#root{margin:0;padding:0;background:var(--shell-0);min-height:100vh;width:100%}

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
  .pw-root input:focus,.pw-root select:focus,.pw-root textarea:focus{border-color:var(--lime-d);box-shadow:0 0 0 3px rgba(10,157,110,.20);outline:none}
  .pw-root select{appearance:none;-webkit-appearance:none;padding-right:32px!important;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237D8A83' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
    background-repeat:no-repeat;background-position:right 11px center}
  /* alive, hover-highlighted table rows (inline-styled rows keep their own bg) */
  .pw-root tbody tr{transition:background .12s ease}
  .pw-root tbody tr:hover{background:#EEF7F3}
  /* Card hover — subtle zoom + brand-green highlight so it's clear which card you're on */
  .pw-root .pw-card{transition:transform .16s ease, box-shadow .18s ease, border-color .16s ease}
  .pw-root .pw-card:hover{transform:translateY(-3px) scale(1.012); border-color:var(--lime-d)!important; box-shadow:0 22px 40px -22px rgba(5,48,30,.55), 0 0 0 1px rgba(10,157,110,.30)!important}
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

// Default access for an admin: admin on everything.

// Home page grouping of modules under section headers. Every module id maps to
// exactly one group; a group only renders if the user can see ≥1 of its modules.
const MODULE_GROUPS = [
  { title: "Marketing / Growth", ids: ["sales", "customer", "referral"] },
  { title: "Ops / Logistics / ERP", ids: ["erp", "fsm"] },
  { title: "Analytics", ids: ["analytics"] },
  { title: "IoT & Communications", ids: ["iot", "autoscheduler"] },
  { title: "Customer Support", ids: ["ticketing", "devicereplace", "billing"] },
  { title: "Tech", ids: ["planner", "employee", "logtracker", "about"] },
];


// A user's per-section override for a module/tab, or null when it should inherit
// the module level. Stored at user.sections[moduleId][tabId] as
// "hidden" | "view" | "edit". Absent everywhere => full access (all shown),
// so users created before this feature are unaffected.
function sectionOverride(user, moduleId, tabId) {
  const m = user && user.sections && user.sections[moduleId];
  return (m && m[tabId]) || null;
}

/* ---------- App version + changelog ----------
   Convention (user requirement): bump APP_VERSION and PREPEND a VERSION_HISTORY
   entry on EVERY change. The version is shown in the sidebar / home / login
   footers, the Logs Tracker banner, and the About module changelog. */




/* ---- DP Transactions (deposit/recharge collection feed) -------------------
   GET /dp-transactions on the same origin as billing, but unauthenticated and
   cursor-paginated ({ transactions, has_more, next_cursor } — not page-number
   based like the admin endpoints above, so it needs its own fetch loop rather
   than fetchAllPagesFast). Each collection event appears as TWO raw rows — a
   COLLECTION_SUMMARY (Deposit/Recharge_received/collection_total populated,
   deposit_amount/revenue_amount null) and a TRANSACTION (the reverse) — kept
   as-is, unmerged, since the module shows raw records. Capped at 80 pages
   (~2000 rows) as a sane ceiling; flips `truncated` if the feed had more. */

/* ---- DP Customers (device/customer registry feed) -------------------------
   GET /dp-customers — same origin as DP Transactions, unauthenticated,
   cursor-paginated ({ customers, has_more, next_cursor } — confirmed live,
   identical shape/pagination convention to /dp-transactions above), so it
   reuses the exact same fetch-loop pattern. Customer > DP Customers tab
   (v2.29.109). */




// Generic CSV export: columns = [{ label, get(row) }], rows = array.


/* ---------- Persistent store (localStorage, survives reloads on this device) ----------
   NOTE: In a preview/sandbox, localStorage may be unavailable and these fall back to
   in-memory. In your real Vite app on localhost it persists across reloads.
   For true cross-device/cross-user history, these move to your backend (Firestore). */

// Logs epoch: if the stored epoch differs from this build's, wipe the log ONCE
// (start fresh) so stale pre-fix rows don't linger. Bump LOGS_EPOCH to clear.
// Persist the session (IP/network/geo) so token-restored reloads keep real IP
// on their logs instead of "—". Cleared on logout.



/* ============================================================================
   PERSISTENT CACHES + RATE-LIMIT COOLDOWN (v1.9.5)
   Zoho re-queries per request and rate-limits (429 / 500). We keep the last good
   rows in localStorage (pw_cache_*) so a reload — or a rate-limited fetch — can
   serve real data instead of failing. Defined AFTER LS so it can use it.
   ============================================================================ */
// Long windows so a normal work session never auto-refetches (use the Refresh
// button for a manual, forced update). Trades a little staleness for zero rate-limit risk.


// Matches Zoho's rate-limit signals, incl. code 45 ("exceeded the maximum call
// rate limit of 1,000") which the backend returns as a 500 body.

// Shared cache wrapper for the four heavy Zoho lists (customers/subs/invoices/leads).
//  • in-flight dedup   • persisted seed   • TTL freshness   • cooldown-serve
//  • on failure: serve cache if we have it (no sample); else fall back to seed + sample.

/* ============================================================================
   API FAILURE TRACKING (v1.8.0) — records outages, powers the Failures tab +
   Server Down popup. Defined AFTER LS + pushLog. (The email-alert attempt this
   used to also fire, POST /admin/notify-failure, was removed in v2.29.110 — the
   backend route never existed, so it just 404'd on every failure forever.)
   NOTE: autoscheduler is intentionally NOT a monitored source (it's local-first).
   ============================================================================ */
// Per-TAB override of MODULE_SOURCES (v2.29.97) — a module-wide gate was blocking
// every sub-tab whenever ANY of its module's sources were down, even sub-tabs that
// don't touch that source at all (e.g. one dead Zoho endpoint used to lock a user
// out of the entire Analytics module, including tabs like DP Transaction that read
// a completely separate, untracked feed). Listed per the actual fetch calls each
// tab's component makes; a tab not listed here falls back to MODULE_SOURCES[module].

// A source is "down" if it has an open (unresolved) failure.


// >>> WIRE: In production the BACKEND should record the real client IP + network from the request
// (e.g. req.headers['x-forwarded-for'] and a GeoIP lookup). This browser-side lookup is a stand-in.
//
// IP geolocation only resolves to the ISP's *registered* city — e.g. it reports
// "Bengaluru" for connections backhauled through a metro POP even when the user
// is elsewhere (Andaman & Nicobar, etc.). So we prefer the browser's GPS/Wi-Fi
// location when the user consents, and fall back to the (approximate) IP city.

// External API usage tracker + persistent IP cache (fixes ipapi.co 1,000/day
// exhaustion; ipCache is SEPARATE from the session so logout doesn't force a
// re-fetch). See src/lib/apiUsageTracker.js.

// IP address + ISP/network + coarse (ISP-registered) location.

// Accurate physical location via the browser Geolocation API (needs user consent
// + HTTPS). Resolves null if unsupported, denied, or it takes too long — never
// throws, so it can't block login.

// Turn GPS coordinates into a city/region name (BigDataCloud — no API key needed).

// Hybrid: always capture IP + ISP; upgrade location to GPS when the user allows.
// `source` records which one we used so the audit log can flag "approximate".

/* ============================================================================
   REAL DATA LAYER — ProWater Referral API
   The admin endpoint returns all referrers with nested referees in one call.
   We fetch once, cache briefly, and transform into the shapes the UI expects.
   ============================================================================ */
// On localhost we go through Vite's dev proxy (API_BASE empty → "/api/..."), which
// avoids browser CORS during development. On the deployed site there's no proxy, so
// we call the real API directly — this REQUIRES the API to send CORS headers
// (Access-Control-Allow-Origin) for the deployed origin. See deploy notes.








/* ---------- API (real data + local user/log management) ---------- */

/* ===========================================================================
   App shell
   =========================================================================== */

// Auto-logout after 1h of inactivity; also log out when the calendar day rolls
// over. Both are checked on load and on a periodic timer (see the effect below).
// The Firebase ID token's own ~1h life is renewed silently in the background
// for an active session (v2.29.100, api.refreshIdToken) — it is NOT a third
// logout trigger on its own anymore.
// Clear every session key on logout / expiry so nothing is silently restored.

// Theme — persisted, applied as data-theme on <html>, so it affects the whole
// CRM (everything colour-driven by CSS variables). Themes: light · dark (black)
// · aesthetic (violet accent on white). Chrome (sidebar/topbar/Home) is fully
// themed; some deep module screens still carry hardcoded colours (follow-up).
// Dark + Aesthetic disabled for now (dark broke module screens' hardcoded
// colours; violet aesthetic was disliked). Light only until a proper themeable
// refactor is agreed. The dormant theme CSS stays but never matches.

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const expiry = Number(sessionStorage.getItem("pw_tokenExpiry"));
      const saved = sessionStorage.getItem("pw_user");
      const lastAct = Number(sessionStorage.getItem("pw_last_activity")) || 0;
      const day = sessionStorage.getItem("pw_session_day");
      // Restore only if within the token life, under the idle limit, and still the same day.
      if (saved && expiry && Date.now() < expiry
        && (Date.now() - lastAct) < SESSION_IDLE_MS
        && (!day || day === sessionDayStr())) return JSON.parse(saved);
      clearSessionStorage();
    } catch { /* ignore */ }
    return null;
  });
  // Persist the open module so a hard refresh stays on the same page (not Home).
  const [activeModule, setActiveModule] = useState(() => sessionStorage.getItem("pw_active_module") || null);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Apply the saved light/dark theme once on load.
  useEffect(() => { applyTheme(getStoredTheme()); }, []);

  const onSetActiveModule = (m) => {
    setActiveModule(m);
    if (m) sessionStorage.setItem("pw_active_module", m);
    else sessionStorage.removeItem("pw_active_module");
  };

  const onSetUser = (u) => {
    setUser(u);
    setActiveModule(null);
    if (u) {
      sessionStorage.setItem("pw_user", JSON.stringify(u));
      sessionStorage.setItem("pw_last_activity", String(Date.now()));
      if (!sessionStorage.getItem("pw_session_day")) sessionStorage.setItem("pw_session_day", sessionDayStr());
      sessionStorage.removeItem("pw_active_module"); // fresh login lands on Home
    } else {
      clearSessionStorage();
    }
  };

  // ── Idle (1h) + next-day auto-logout + silent token refresh (v2.29.100) ──
  // The ONLY real logout paths now are genuine 1h inactivity and the calendar
  // day rolling over. The Firebase ID token itself still only lives ~1h, but
  // instead of hard-cutting an active session at that mark, it's silently
  // refreshed in the background a few minutes before it expires (as long as
  // the user isn't already past the idle window) — see api.refreshIdToken.
  // This fixes active users being logged out mid-session purely because 60
  // minutes of wall-clock time had passed since login.
  useEffect(() => {
    if (!user) { setSessionWarning(false); return; }
    const bump = () => sessionStorage.setItem("pw_last_activity", String(Date.now()));
    let lastBump = 0;
    const onActivity = () => { const now = Date.now(); if (now - lastBump > 15000) { lastBump = now; bump(); } };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    bump(); // count the reload/login itself as activity

    const logout = () => { api.logout(user.username); onSetUser(null); };
    let refreshing = false;
    const check = async () => {
      const lastAct = Number(sessionStorage.getItem("pw_last_activity")) || 0;
      const day = sessionStorage.getItem("pw_session_day");
      const idleMs = Date.now() - lastAct;
      if (idleMs >= SESSION_IDLE_MS) { logout(); return; }         // idle for 1h — real inactivity
      if (day && day !== sessionDayStr()) { logout(); return; }    // calendar day rolled over

      const expiry = Number(sessionStorage.getItem("pw_tokenExpiry"));
      const msLeft = expiry - Date.now();
      if (msLeft > 5 * 60 * 1000 || refreshing) { setSessionWarning(false); return; }
      refreshing = true;
      const ok = await api.refreshIdToken();
      refreshing = false;
      if (ok) { setSessionWarning(false); return; }
      // Refresh failed (offline / refresh token expired) — warn, then only
      // actually force a logout once the original token has truly expired.
      setSessionWarning(true);
      if (msLeft <= 0) logout();
    };
    check(); // covers a reload where the token is already near/at expiry
    const timer = setInterval(check, 30000);

    return () => { events.forEach(e => window.removeEventListener(e, onActivity)); clearInterval(timer); };
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
      <Auth.Provider value={{ user, setUser: onSetUser, activeModule, setActiveModule: onSetActiveModule }}>
        {sessionWarning && user && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            background: "#986315", color: "#fff",
            padding: "10px 20px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 12, fontSize: 13.5, fontWeight: 500
          }}>
            <Clock size={16} />
            Trouble renewing your session — check your connection. You'll be signed out if this doesn't resolve shortly.
            <button
              onClick={() => setSessionWarning(false)}
              style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
            >
              Dismiss
            </button>
          </div>
        )}
        {!user ? <Login />
          : activeModule ? <Shell module={activeModule} onHome={() => onSetActiveModule(null)} />
          : <Home onPick={onSetActiveModule} />}
        {user && <ReleasePopup />}
      </Auth.Provider>
    </div>
  );
}


/* ---------- Home (module launcher) ---------- */

function Home({ onPick }) {
  const { user, setUser } = useAuth();
  const access = user.access || (user.role === "admin" ? allAccess("admin") : { referral: "view", analytics: "view" });
  const visible = MODULES.filter(m => (access[m.id] || "none") !== "none");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState(new Date());
  const [photo, setPhoto] = useState(() => api.getPhoto(user.username));
  const [photoOpen, setPhotoOpen] = useState(false);
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pw_recent_modules") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const openModule = (moduleItem) => {
    const next = [moduleItem.id, ...recentIds.filter(id => id !== moduleItem.id)].slice(0, 4);
    setRecentIds(next);
    localStorage.setItem("pw_recent_modules", JSON.stringify(next));
    onPick(moduleItem.id);
  };

  const filtered = visible.filter(m => `${m.label} ${m.desc}`.toLowerCase().includes(query.trim().toLowerCase()));
  const recentModules = recentIds.map(id => visible.find(m => m.id === id)).filter(Boolean);
  const elevatedCount = visible.filter(m => ["admin", "devops"].includes(access[m.id])).length;
  const readyCount = visible.filter(m => m.built && !m.soon).length;
  const firstName = String(user.name || user.username || "there").split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const initials = String(user.name || user.username || "PW").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const primaryModule = recentModules[0] || visible[0];

  return (
    <div className="premium-home">
      <style>{`
        .premium-home{min-height:100vh;background:#f3f7f5;display:grid;grid-template-columns:272px minmax(0,1fr);color:var(--f)}
        .premium-sidebar{position:sticky;top:0;height:100vh;padding:24px 16px 18px;background:
          radial-gradient(circle at 18% 0%,rgba(10,157,110,.20),transparent 28%),
          linear-gradient(180deg,#07150e 0%,#0a1a12 55%,#0d2418 100%);display:flex;flex-direction:column;overflow:hidden;z-index:40}
        .premium-brand{display:flex;align-items:center;gap:12px;padding:0 8px 22px;border-bottom:1px solid rgba(255,255,255,.08)}
        .premium-brand-mark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,#16b985,#087451);box-shadow:0 12px 28px -12px rgba(10,157,110,.9)}
        .premium-side-label{padding:22px 12px 8px;color:#71857a;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
        .premium-modules-scroll{scrollbar-width:none;-ms-overflow-style:none}
        .premium-modules-scroll::-webkit-scrollbar{display:none;width:0;height:0}
        .premium-side-item{width:100%;display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:12px;color:#b8c9c0;font-size:13.5px;font-weight:550;text-align:left;transition:background .16s ease,color .16s ease,transform .16s ease}
        .premium-side-item:hover{background:rgba(255,255,255,.07);color:#fff;transform:translateX(2px)}
        .premium-side-item.active{background:linear-gradient(135deg,rgba(10,157,110,.24),rgba(10,157,110,.10));color:#fff;border:1px solid rgba(42,210,158,.18);box-shadow:inset 0 1px rgba(255,255,255,.04)}
        .premium-side-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.055);flex:0 0 auto}
        .premium-profile{margin-top:auto;padding:14px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);border-radius:16px}
        .premium-avatar{width:40px;height:40px;border-radius:12px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,#1bb987,#087753);color:#fff;font-size:13px;font-weight:800;box-shadow:0 8px 18px -10px #000}
        .premium-main{min-width:0;display:flex;flex-direction:column}
        .premium-topbar{height:76px;padding:0 32px;display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.84);border-bottom:1px solid rgba(10,26,18,.07);backdrop-filter:blur(18px);position:sticky;top:0;z-index:30}
        .premium-content{padding:28px 32px 38px;max-width:1600px;width:100%;margin:0 auto}
        .premium-hero{position:relative;padding:11px 20px;border-radius:16px;margin-bottom:20px;max-width:calc(100% - 340px);overflow:hidden;background:
          radial-gradient(circle at 85% 5%,rgba(72,227,174,.23),transparent 30%),
          radial-gradient(circle at 62% 120%,rgba(42,134,214,.20),transparent 34%),
          linear-gradient(135deg,#07160f 0%,#0d2b1e 55%,#0b4c37 100%);box-shadow:0 28px 60px -32px rgba(4,28,18,.65);color:#fff;display:block}
        .premium-hero:after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to left,#000,transparent 75%);pointer-events:none}
        .premium-hero-copy,.premium-hero-panel{position:relative;z-index:1}
        .premium-hero h1{font-family:'DM Sans',system-ui,sans-serif!important;color:#fff!important;font-size:clamp(17px,2vw,22px);letter-spacing:-.03em;line-height:1.1;margin:4px 0 4px;max-width:760px}
        .premium-hero p{max-width:680px;color:#b9cbc2;font-size:11.8px;line-height:1.45}
        .premium-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;background:rgba(30,206,147,.12);border:1px solid rgba(63,223,169,.18);color:#75e3bd;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
        .premium-hero-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px}
        .premium-cta{display:inline-flex;align-items:center;gap:8px;padding:12px 17px;border-radius:12px;background:#fff;color:#0a1a12;font-size:13.5px;font-weight:750;box-shadow:0 10px 24px -14px #000}
        .premium-cta.secondary{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#dceae3;box-shadow:none}
        .premium-hero-panel{padding:20px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.065);backdrop-filter:blur(14px);border-radius:18px;box-shadow:inset 0 1px rgba(255,255,255,.06)}
        .premium-progress{height:7px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:11px}
        .premium-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#13b880,#5cddb6);box-shadow:0 0 16px rgba(69,221,170,.45)}
        .premium-stats{display:grid;grid-template-columns:1fr;gap:12px}
        .premium-stat{background:#fff;border:1px solid rgba(10,26,18,.07);border-radius:17px;padding:17px 18px;box-shadow:0 10px 30px -24px rgba(8,37,24,.55);display:flex;align-items:center;gap:13px;transition:transform .16s ease,box-shadow .18s ease,border-color .16s ease}
        .premium-stat:hover{transform:translateY(-3px) scale(1.02);border-color:var(--lime-d);box-shadow:0 20px 38px -22px rgba(5,48,30,.5)}
        .premium-stat-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#edf7f3;color:#07815b;flex:0 0 auto}
        .premium-stat-value{font-size:22px;font-weight:800;letter-spacing:-.035em;line-height:1;color:#0a1a12}
        .premium-stat-label{font-size:11.5px;color:#7d8a83;margin-top:5px}
        .premium-dashboard-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start}
        .premium-section{background:#fff;border:1px solid rgba(10,26,18,.07);border-radius:20px;padding:20px;box-shadow:0 18px 44px -34px rgba(8,37,24,.55)}
        .premium-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:17px}
        .premium-section-title{font-family:'DM Sans',system-ui,sans-serif!important;font-size:18px!important;font-weight:800!important;letter-spacing:-.025em!important}
        .premium-search{position:relative;min-width:250px}
        .premium-search input{width:100%;height:40px;padding:0 13px 0 38px;border:1px solid #e3e9e6;border-radius:11px;background:#f8faf9;color:#0a1a12;font-size:13px;outline:none}
        .premium-module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .premium-module{position:relative;min-height:138px;padding:13px;border:1px solid #e9eeeb;border-radius:14px;background:linear-gradient(180deg,#fff 0%,#fbfcfb 100%);text-align:left;display:flex;flex-direction:column;overflow:hidden;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
        .premium-module:before{content:"";position:absolute;width:78px;height:78px;border-radius:50%;right:-36px;top:-36px;background:var(--module-color);opacity:.075;transition:transform .2s ease,opacity .2s ease}
        .premium-module:hover{transform:translateY(-4px) scale(1.02);border-color:var(--module-color);box-shadow:0 22px 40px -22px rgba(5,48,30,.6)}
        .premium-module:hover:before{transform:scale(1.4);opacity:.18}
        .premium-module-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--module-color) 11%,white);color:var(--module-color);margin-bottom:10px}
        .premium-module-name{font-size:13.5px;font-weight:800;letter-spacing:-.015em;color:#0a1a12;line-height:1.25;padding-right:22px}
        .premium-module-desc{font-size:11.3px;color:#7d8a83;line-height:1.4;margin-top:5px}
        .premium-module-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:11px}
        .premium-access{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#78877f}
        .premium-module-chev{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:#f1f5f3;color:#577166}
        .premium-greeting{font-family:'DM Sans',system-ui,sans-serif!important;font-size:23px!important;font-weight:800!important;letter-spacing:-.025em;color:var(--f);margin:0 0 18px}
        .premium-group{margin-bottom:20px}
        .premium-group:last-child{margin-bottom:0}
        .premium-group-title{font-size:13px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--brand);margin:0 0 13px;padding:9px 15px;border-radius:10px;background:linear-gradient(90deg,color-mix(in srgb,var(--brand) 22%,transparent) 0%,color-mix(in srgb,var(--brand) 6%,transparent) 45%,transparent 82%)}
        .premium-side-stack{display:flex;flex-direction:column;gap:14px}
        /* theme picker (top-right of the topbar) */
        .premium-theme-picker{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:var(--mint-2);border:1px solid var(--border)}
        .premium-theme-btn{width:30px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--muted)}
        .premium-theme-btn:hover{color:var(--f)}
        .premium-theme-btn.active{background:var(--white);color:var(--brand);box-shadow:0 2px 6px -3px rgba(0,0,0,.35)}

        /* ---- Dark theme chrome (variables come from :root[data-theme=dark]) ---- */
        :root[data-theme="dark"] .premium-home{background:var(--mint);color:var(--f)}
        :root[data-theme="dark"] .premium-sidebar{background:linear-gradient(180deg,#0a0b0d 0%,#0e0f12 55%,#121317 100%)}
        :root[data-theme="dark"] .premium-topbar{background:rgba(16,18,21,.86);border-bottom-color:rgba(255,255,255,.06)}
        :root[data-theme="dark"] .premium-section{background:var(--white);border-color:var(--border)}
        :root[data-theme="dark"] .premium-module{background:linear-gradient(180deg,#191c20 0%,#141619 100%);border-color:var(--border)}
        :root[data-theme="dark"] .premium-module-name{color:var(--f)}
        :root[data-theme="dark"] .premium-module-desc,:root[data-theme="dark"] .premium-access{color:var(--muted)}
        :root[data-theme="dark"] .premium-module-icon{background:color-mix(in srgb,var(--module-color) 22%,#101114)}
        :root[data-theme="dark"] .premium-module-chev{background:#1c1f24;color:#9aa6ad}
        :root[data-theme="dark"] .premium-quick-item:hover{background:rgba(255,255,255,.05)}

        /* ---- Aesthetic theme chrome (violet accent, white surfaces) ---- */
        :root[data-theme="aesthetic"] .premium-home{background:var(--mint);color:var(--f)}
        :root[data-theme="aesthetic"] .premium-sidebar{background:radial-gradient(circle at 18% 0%,rgba(109,94,240,.30),transparent 30%),linear-gradient(180deg,#1a1540 0%,#241f52 55%,#2d2668 100%)}
        :root[data-theme="aesthetic"] .premium-brand-mark{background:linear-gradient(145deg,#8878ff,#5a49e0)}
        :root[data-theme="aesthetic"] .premium-side-item.active{background:linear-gradient(135deg,rgba(109,94,240,.30),rgba(109,94,240,.12));border-color:rgba(140,124,255,.28)}
        :root[data-theme="aesthetic"] .premium-module-icon{background:color-mix(in srgb,var(--module-color) 13%,white)}
        .premium-quick-item{width:100%;display:flex;align-items:center;gap:11px;padding:10px;border-radius:12px;text-align:left;transition:background .14s ease}
        .premium-quick-item:hover{background:#f4f8f6}
        .premium-quick-icon{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto}
        .premium-access-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #edf0ee;font-size:12.5px}
        .premium-access-row:last-child{border-bottom:none}
        .premium-mobile-menu{display:none;width:38px;height:38px;border-radius:10px;background:#f0f5f2;color:#0a1a12;place-items:center}
        .premium-overlay{display:none}
        @media(max-width:1180px){.premium-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.premium-dashboard-grid{grid-template-columns:minmax(0,1fr) 290px}}
        @media(max-width:980px){.premium-home{grid-template-columns:1fr}.premium-sidebar{position:fixed;left:0;top:0;bottom:0;width:272px;transform:translateX(-105%);transition:transform .22s ease}.premium-sidebar.open{transform:none}.premium-mobile-menu{display:grid}.premium-overlay.open{display:block;position:fixed;inset:0;background:rgba(3,16,10,.45);backdrop-filter:blur(3px);z-index:35}.premium-topbar{padding:0 20px}.premium-content{padding:22px 20px 32px}}
        @media(max-width:820px){.premium-hero{max-width:none}.premium-dashboard-grid{grid-template-columns:1fr}.premium-side-stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){.premium-topbar{height:68px}.premium-content{padding:16px 14px 28px}.premium-hero{padding:20px;border-radius:18px}.premium-hero h1{font-size:29px}.premium-stats{gap:10px}.premium-stat{padding:14px;align-items:flex-start;flex-direction:column}.premium-section{padding:15px;border-radius:17px}.premium-section-head{flex-direction:column}.premium-search{width:100%;min-width:0}.premium-module-grid{grid-template-columns:1fr}.premium-module{min-height:128px}.premium-side-stack{grid-template-columns:1fr}.premium-topbar-date{display:none}}
      `}</style>

      <div className={`premium-overlay ${mobileNav ? "open" : ""}`} onClick={() => setMobileNav(false)} />

      <aside className={`premium-sidebar ${mobileNav ? "open" : ""}`}>
        <div className="premium-brand">
          <div className="premium-brand-mark"><Droplets size={22} color="#fff" /></div>
          <div>
            <div style={{ color: "#fff", fontSize: 15.5, fontWeight: 800, letterSpacing: "-.02em" }}>ProWater</div>
            <div style={{ color: "#6f8a7c", fontSize: 9.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 2 }}>Wisdom 2.0</div>
          </div>
        </div>

        <div className="premium-side-label">Workspace</div>
        <button className="premium-side-item active" onClick={() => setMobileNav(false)}>
          <span className="premium-side-icon"><LayoutDashboard size={16} /></span>
          <span style={{ flex: 1 }}>Overview</span>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#3ed3a1", boxShadow: "0 0 0 4px rgba(62,211,161,.10)" }} />
        </button>

        <div className="premium-side-label">Your modules</div>
        <div className="premium-modules-scroll" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
          {visible.map(m => {
            const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
            return (
              <button key={m.id} className="premium-side-item" onClick={() => openModule(m)}>
                <span className="premium-side-icon"><Icon size={16} /></span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
                {m.soon && <span style={{ color: "#d3a760", fontSize: 8.5, fontWeight: 800, letterSpacing: ".08em" }}>BETA</span>}
              </button>
            );
          })}
        </div>

        <div className="premium-profile">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <button className="premium-avatar" onClick={() => setPhotoOpen(true)} title="Update profile photo" style={{ position: "relative", flex: "0 0 auto" }}>
              {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
              <span style={{ position: "absolute", right: -3, bottom: -3, width: 16, height: 16, borderRadius: 999, background: "var(--brand)", border: "2px solid #0a1a12", display: "grid", placeItems: "center", color: "#fff" }}><Camera size={8} /></span>
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#7ee0bd", fontSize: 10.5, textTransform: "capitalize", marginTop: 3 }}>
                <ShieldCheck size={11} /> {user.role} workspace
              </div>
            </div>
          </div>
          <button onClick={() => setUser(null)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 13, padding: "9px 10px", borderRadius: 10, background: "rgba(255,255,255,.06)", color: "#bdcbc4", fontSize: 12.5, fontWeight: 650 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="premium-main">
        <header className="premium-topbar">
          <button className="premium-mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="premium-topbar-title" style={{ fontSize: 14, fontWeight: 800, color: "var(--f)", letterSpacing: "-.01em" }}>Operations Command Center</div>
            <div className="premium-topbar-date" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{dateLabel}</div>
          </div>
          <div className="premium-ready" style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 10, background: "var(--mint-2)", border: "1px solid var(--border)" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--brand)", boxShadow: "0 0 0 4px rgba(10,157,110,.10)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--brand)" }}>Workspace ready</span>
          </div>
          <button onClick={() => setPhotoOpen(true)} className="premium-avatar" style={{ width: 38, height: 38, borderRadius: 11, background: "var(--grad-btn)" }}>
            {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </button>
        </header>

        <div className="premium-content">
          <h1 className="premium-greeting fade-up">{greeting}, {firstName}.</h1>

          <div className="premium-dashboard-grid">
            <section className="premium-section" id="module-directory">
              <div className="premium-section-head">
                <div>
                  <p className="eyebrow" style={{ color: "var(--brand)", marginBottom: 5 }}>Workspace directory</p>
                  <h2 className="premium-section-title">Choose where to work</h2>
                  <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 5 }}>Only modules assigned to your account are shown.</p>
                </div>
              </div>

              {MODULE_GROUPS.map(group => {
                const mods = visible.filter(m => group.ids.includes(m.id));
                if (!mods.length) return null;
                return (
                  <div key={group.title} className="premium-group">
                    <div className="premium-group-title">{group.title}</div>
                    <div className="premium-module-grid">
                      {mods.map(m => {
                        const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
                        const lvl = access[m.id];
                        return (
                          <button key={m.id} className="premium-module" onClick={() => openModule(m)} style={{ "--module-color": m.color }}>
                            <div className="premium-module-icon"><Icon size={17} /></div>
                            <div className="premium-module-name">{m.label}</div>
                            <div className="premium-module-desc">{m.desc}</div>
                            <div className="premium-module-foot">
                              <span className="premium-access">{lvl} access</span>
                              <span className="premium-module-chev"><ChevronRight size={15} /></span>
                            </div>
                            {m.soon && <span style={{ position: "absolute", right: 13, top: 13, padding: "3px 7px", borderRadius: 999, background: "#fbf0e0", color: "#986315", fontSize: 8.5, fontWeight: 850, letterSpacing: ".07em" }}>BETA</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {visible.length === 0 && (
                <div style={{ padding: "52px 20px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 15, color: "var(--muted)" }}>
                  No modules are assigned to your account yet.
                </div>
              )}
            </section>

            <aside className="premium-side-stack">
              <section className="premium-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                  <div>
                    <p className="eyebrow" style={{ color: "var(--brand)", marginBottom: 4 }}>Quick access</p>
                    <h3 className="premium-section-title" style={{ fontSize: "16px!important" }}>Recent modules</h3>
                  </div>
                  <Clock size={17} color="#8a9991" />
                </div>
                {(recentModules.length ? recentModules : visible.slice(0, 3)).map(m => {
                  const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
                  return (
                    <button className="premium-quick-item" key={m.id} onClick={() => openModule(m)}>
                      <span className="premium-quick-icon" style={{ background: `${m.color}14`, color: m.color }}><Icon size={17} /></span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", color: "var(--f)", fontSize: 12.5, fontWeight: 750, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
                        <span style={{ display: "block", color: "var(--muted)", fontSize: 10.5, marginTop: 2 }}>{access[m.id]} access</span>
                      </span>
                      <ChevronRight size={15} color="#9aa69f" />
                    </button>
                  );
                })}
              </section>

              <section className="premium-section">
                <p className="eyebrow" style={{ color: "var(--brand)", marginBottom: 5 }}>Account controls</p>
                <h3 className="premium-section-title" style={{ fontSize: "16px!important", marginBottom: 8 }}>Access summary</h3>
                <div className="premium-access-row"><span style={{ color: "var(--muted)" }}>Role</span><strong style={{ textTransform: "capitalize", color: "var(--f)" }}>{user.role}</strong></div>
                <div className="premium-access-row"><span style={{ color: "var(--muted)" }}>Admin modules</span><strong style={{ color: "var(--f)" }}>{elevatedCount}</strong></div>
                <div className="premium-access-row"><span style={{ color: "var(--muted)" }}>Standard modules</span><strong style={{ color: "var(--f)" }}>{Math.max(visible.length - elevatedCount, 0)}</strong></div>
                <div className="premium-access-row"><span style={{ color: "var(--muted)" }}>Session</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--brand)", fontWeight: 750 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--brand)" }} /> Secure</span></div>
              </section>

              <section className="premium-section" style={{ background: "linear-gradient(145deg,#e9f7f1,#f7fbf9)", borderColor: "#d8eee5" }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "#fff", color: "var(--brand)", boxShadow: "0 9px 20px -15px rgba(5,67,42,.8)", marginBottom: 13 }}><Info size={18} /></div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#163729" }}>Wisdom 2.0 workspace</div>
                <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "#668074", marginTop: 6 }}>A unified internal platform for managing the full ProWater operating lifecycle.</p>
                <button onClick={() => visible.find(m => m.id === "about") && openModule(visible.find(m => m.id === "about"))} disabled={!visible.some(m => m.id === "about")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, color: "#087955", fontSize: 11.5, fontWeight: 800, opacity: visible.some(m => m.id === "about") ? 1 : .5 }}>
                  View release notes <ArrowUpRight size={13} />
                </button>
              </section>
            </aside>
          </div>

          <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "24px 4px 0", color: "#8a9790", fontSize: 10.5 }}>
            <span>© {new Date().getFullYear()} ProWater Internal Systems</span>
            <span>Wisdom 2.0 · Build {APP_VERSION}</span>
          </footer>
        </div>
      </main>

      {photoOpen && <PhotoUploader username={user.username} current={photo}
        onClose={() => setPhotoOpen(false)}
        onSaved={(url) => { setPhoto(url); setPhotoOpen(false); }} />}
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

/* ---------- Forgot password (4-digit OTP, simulated email) ---------- */

/* ---------- Shell + nav ---------- */
// Warns when any on-screen data is seed/sample because a live endpoint failed.
function SampleDataBanner() {
  const sources = useSampleData();
  if (!sources.length) return null;
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#986315", background: "#FBF0E0", border: "1px solid #F6DEBC", padding: "10px 14px", borderRadius: 11, marginBottom: 16 }}>
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
  const defaultTab =
    module === "sales" ? "sales_leads"
    : module === "planner" ? "plan_weekly"
    : module === "analytics" ? "an_overview"
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
    : "overview";
  // Restore the last-open sub-tab so a hard refresh stays on the same page. An
  // invalid/stale tab is corrected to the first visible section by the effect below.
  const [tab, setTab] = useState(() => sessionStorage.getItem("pw_tab_" + module) || defaultTab);
  useEffect(() => { sessionStorage.setItem("pw_tab_" + module, tab); }, [module, tab]);
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState(new Date());          // system clock (top-right)
  const [loginAt] = useState(() => Date.now());        // session start for the timer
  const [elapsed, setElapsed] = useState(0);           // seconds since login
  const [refreshKey, setRefreshKey] = useState(0);     // bump to re-mount pages
  const [refreshing, setRefreshing] = useState(false);
  const [photo, setPhoto] = useState(() => api.getPhoto(user.username)); // profile photo
  const [photoOpen, setPhotoOpen] = useState(false);
  useFailures(); // re-render when an API source goes down / recovers
  // Gate per the ACTIVE TAB's real data dependencies, not the whole module's — a
  // module can have sub-tabs with very different sources (see TAB_SOURCES above).
  const tabSources = tab in TAB_SOURCES ? TAB_SOURCES[tab] : (MODULE_SOURCES[module] || []);
  const downSources = tabSources.filter(s => failingSourcesNow().includes(s));
  // The down-sources popup is a dismissible heads-up (v2.29.101), not a hard
  // block — "Continue anyway" just hides it for this tab; switching tabs (or a
  // fresh failure) re-arms it so a genuinely new outage still gets surfaced.
  const [dismissedDown, setDismissedDown] = useState(false);
  useEffect(() => { setDismissedDown(false); }, [tab]);

  // Tell the logger which module we're in (so logs record the Module column).
  useEffect(() => { setCurrentModule(moduleMeta.label); return () => { setCurrentModule("—"); }; }, [moduleMeta.label]);

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
      else if (module === "analytics" || module === "customer") {
        await Promise.all([
          billingApi.forceRefresh(),
          salesApi.forceRefresh(),
          customerApi.forceRefresh(),
          api.forceRefresh(),
        ]);
      }
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
      { id: "sales_leads", label: "Leads & Deals", icon: Briefcase },
      { id: "sales_apartments", label: "Apartment Leads", icon: Boxes },
      { id: "sales_trend", label: "Trend Analysis", icon: TrendingUp },
      { id: "sales_errors", label: "Error Correction", icon: AlertCircle },
    ],
    planner: [
      { id: "plan_board", label: "Task Board", icon: LayoutGrid },
      { id: "plan_weekly", label: "Weekly View", icon: CalendarRange },
      ...(isModuleAdmin ? [{ id: "plan_admin", label: "Modify Tasks", icon: PencilLine }] : []),
    ],
    analytics: [
      { id: "an_overview", label: "Overview", icon: LayoutGrid },
      { id: "analytics", label: "Referral", icon: BarChart3 },
      { id: "an_sales", label: "Sales", icon: Briefcase },
      { id: "an_earned", label: "Earned Revenue", icon: Scale },
      { id: "an_reconciliation", label: "Reconciliation", icon: ArrowLeftRight },
      { id: "an_dptxn", label: "DP Transaction", icon: Landmark },
      ...(isModuleAdmin ? [{ id: "an_aop", label: "AOP", icon: Target }] : []),
      { id: "an_apartment", label: "Apartment Performance", icon: Boxes },
      { id: "an_churn", label: "Renewal & Churn Risk", icon: AlertCircle },
      { id: "an_billing", label: "Billing", icon: Receipt },
      { id: "an_revenue", label: "Revenue", icon: TrendingUp },
      { id: "an_penetration", label: "Penetration Tracker", icon: Boxes },
      { id: "an_credits", label: "Credits", icon: Coins },
      { id: "an_applogs", label: "App Logs", icon: ScrollText },
    ],
    employee: [
      { id: "emp_users", label: "Users", icon: UserCog },
    ],
    ticketing: [
      { id: "tk_overview", label: "Overview", icon: LayoutDashboard },
      { id: "tk_tickets", label: "Tickets", icon: Ticket },
      { id: "tk_ops", label: "Ops Tickets", icon: Wrench },
    ],
    customer: [
      { id: "cust_list", label: "Customers", icon: UserRound },
      { id: "cust_all", label: "All Customers", icon: Users },
      { id: "cust_societies", label: "Societies", icon: Boxes },
    ],
    billing: [
      { id: "bill_overview", label: "Overview", icon: LayoutDashboard },
      { id: "bill_subs", label: "Subscriptions", icon: RefreshCw },
      { id: "bill_invoices", label: "Invoices", icon: Receipt },
      { id: "bill_deposits", label: "Deposits & Refunds", icon: Wallet },
      { id: "bill_plans", label: "Plans", icon: Tag },
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
      { id: "iot_alerts", label: "Alerts", icon: AlertCircle },
    ],
    devicereplace: [
      { id: "dr_list", label: "Replacements", icon: Repeat },
    ],
    about: [
      { id: "about_docs", label: "About", icon: Info },
      { id: "about_app_rel", label: "App Releases", icon: Rocket },
      { id: "about_tech_rel", label: "Technician Releases", icon: Wrench },
    ],
    logtracker: [
      { id: "log_all", label: "All Logs", icon: ScrollText },
      { id: "log_failures", label: "Failures", icon: AlertCircle },
      { id: "log_api", label: "API Usage", icon: BarChart3 },
    ],
  };

  const sharesAdminTabs = false; // User Management → Employee module; logs → Logs Tracker module
  const nav = (!moduleMeta.built ? [] : [
    ...(moduleTabs[module] || []),
    ...(isModuleAdmin && sharesAdminTabs ? [
      { id: "logs", label: "Activity Logs", icon: ScrollText },
      { id: "users", label: "User Management", icon: UserCog },
    ] : []),
  ]).filter(n => sectionOverride(user, module, n.id) !== "hidden"); // per-user section visibility

  // Effective View/Edit for the CURRENT section: a "view" override forces
  // read-only even on an admin module; an "edit" override grants editing even on
  // a view-only module; no override inherits the module level.
  const secOv = sectionOverride(user, module, tab);
  const tabIsAdmin = secOv === "edit" ? true : secOv === "view" ? false : isModuleAdmin;
  const tabAccess = secOv === "edit" ? (isModuleAdmin ? moduleAccess : "admin")
    : secOv === "view" ? "view"
    : moduleAccess;

  // If the landing/last tab was hidden for this user, fall back to the first
  // section they can see (keeps the content area from rendering blank).
  useEffect(() => {
    if (nav.length && !nav.some(n => n.id === tab)) setTab(nav[0].id);
  }, [module, nav.length, tab]);

  const signOut = async () => { await api.logout(user.username); setUser(null); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", width: "100%" }} className="shell-grid">
      <style>{`@media(max-width:860px){.shell-grid{grid-template-columns:1fr!important}.pw-side{position:fixed;z-index:40;height:100%;transform:translateX(-100%);transition:.25s}.pw-side.open{transform:none}.pw-topbar-burger{display:inline-flex!important}.iot-apt-badge{display:none!important}}`}</style>

      {/* sidebar */}
      <aside className={`pw-side ${mobileNav ? "open" : ""}`} style={{
        background: "linear-gradient(180deg,var(--forest) 0%, var(--forest-2) 100%)",
        color: "#B5E2D4", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 6
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 14px" }}>
          <Drop />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>ProWater</div>
            <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--brand)" }}>{moduleMeta.label}</div>
          </div>
        </div>

        <button onClick={onHome} style={{
          display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11,
          color: "#B5E2D4", fontWeight: 500, background: "rgba(255,255,255,.05)", textAlign: "left", fontSize: 14, marginBottom: 6
        }}>
          <HomeIcon size={18} /> All modules
        </button>

        {nav.map(n => (
          <button key={n.id} onClick={() => { setTab(n.id); setMobileNav(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11,
              color: tab === n.id ? "var(--shell)" : "var(--green-b)", fontWeight: tab === n.id ? 600 : 500,
              background: tab === n.id ? "var(--brand)" : "transparent", textAlign: "left", fontSize: 14, transition: ".15s"
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
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 8px 8px", color: "#B5E2D4", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
            <Clock size={13} /> Session {fmtElapsed(elapsed)}
          </div>
          <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 9, color: "#B5E2D4", fontSize: 13, padding: "8px 8px" }}>
            <LogOut size={16} /> Sign out
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 8, paddingTop: 10, padding: "10px 8px 2px", color: "#7D8A83", fontSize: 10.5, lineHeight: 1.4 }}>
            © 2026 ProWater Internal Systems · v{APP_VERSION}
          </div>
        </div>
      </aside>

      {/* main */}
      <main style={{ minWidth: 0 }}>
        <div className="pw-topbar" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 28px", borderBottom: "1px solid var(--border)", background: "rgba(243,248,236,.92)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20 }}>
          <button className="pw-topbar-burger" onClick={() => setMobileNav(s => !s)} style={{ display: "none", color: "var(--f)" }}><Menu /></button>
          {module === "iot" && (
            <div className="iot-apt-badge" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 999, background: "var(--mint-2)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(16,40,28,.05)", pointerEvents: "none", whiteSpace: "nowrap" }}>
              <MapPin size={15} color="var(--teal)" />
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)" }}>Apartment</span>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--forest)", letterSpacing: ".01em" }}>Prabhavati</span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p className="eyebrow">{moduleMeta.label} · {tabIsAdmin ? "Admin access" : "View access"}</p>
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
          {!moduleMeta.built ? <ComingSoon module={moduleMeta} onHome={onHome} /> : nav.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--muted)" }}>
              <Lock size={26} style={{ opacity: .5 }} />
              <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--f)" }}>No sections enabled</p>
              <p style={{ marginTop: 4, fontSize: 12.5 }}>Your access to this module doesn't include any visible sections. Ask an admin to adjust it.</p>
            </div>
          ) : <>
            {tab === "overview" && <Overview key={refreshKey} />}
            {tab === "referrers" && <Referrers key={refreshKey} />}
            {tab === "referees" && <Referees key={refreshKey} />}
            {tab === "credits" && <Credits key={refreshKey} />}
            {tab === "tracker" && <Tracker key={refreshKey} />}
            {tab === "an_overview" && <AnalyticsOverview key={refreshKey} isAdmin={tabIsAdmin} />}
            {tab === "analytics" && <ReferralAnalyticsTab key={refreshKey} />}
            {tab === "an_sales" && <SalesInsights key={refreshKey} />}
            {tab === "an_earned" && <EarnedRevenue key={refreshKey} />}
            {tab === "an_reconciliation" && <Reconciliation key={refreshKey} />}
            {tab === "an_dptxn" && <DPTransactions key={refreshKey} />}
            {tab === "an_aop" && isModuleAdmin && <AOP key={refreshKey} accessLevel={tabAccess} />}
            {tab === "an_apartment" && <ApartmentPerformance key={refreshKey} />}
            {tab === "an_churn" && <ChurnRiskRadar key={refreshKey} />}
            {tab === "an_billing" && <BillingAnalytics key={refreshKey} />}
            {tab === "an_revenue" && <NetRevenue key={refreshKey} />}
            {tab === "an_penetration" && <PenetrationTracker key={refreshKey} />}
            {tab === "an_credits" && <CreditsAnalytics key={refreshKey} />}
            {tab === "an_applogs" && <AppLogs key={refreshKey} />}
            {tab === "plan_board" && <TaskPlanner key={`board-${refreshKey}`} />}
            {tab === "plan_weekly" && <TaskPlanner key={`weekly-${refreshKey}`} initialView="weekly" />}
            {tab === "plan_admin" && isModuleAdmin && <TaskAdmin key={refreshKey} />}
            {tab === "sales_leads" && <SalesLeads key={refreshKey} isAdmin={tabIsAdmin} />}
            {tab === "sales_apartments" && <ApartmentLeads key={refreshKey} />}
            {tab === "sales_trend" && <SalesTrendAnalysis key={refreshKey} />}
            {tab === "sales_errors" && <SalesErrorCorrection key={refreshKey} isAdmin={tabIsAdmin} />}
            {tab === "emp_users" && <UsersAdmin key={refreshKey} accessLevel={tabAccess} />}
            {tab === "dr_list" && <DeviceReplacement key={refreshKey} />}
            {tab === "about_docs" && <AboutModule key={refreshKey} />}
            {tab === "about_app_rel" && <ReleaseManager key={refreshKey} kind="app" isAdmin={tabIsAdmin} />}
            {tab === "about_tech_rel" && <ReleaseManager key={refreshKey} kind="technician" isAdmin={tabIsAdmin} />}
            {tab === "log_all" && <Logs key={refreshKey} />}
            {tab === "log_failures" && <Failures key={refreshKey} />}
            {tab === "log_api" && <ApiUsageDashboard key={refreshKey} />}
            {tab === "tk_overview" && <TicketOverview key={refreshKey} />}
            {tab === "tk_tickets" && <TicketList key={refreshKey} isAdmin={tabIsAdmin}
              hidePriorityFilter
              dateFilterField={t => t.created} />}
            {tab === "tk_ops" && <TicketList key={`ops-${refreshKey}`} isAdmin={tabIsAdmin}
              preFilter={t => String(t.issueCategory || "").trim().toLowerCase() !== "complaint"}
              hideColumns={["customer", "society", "priority", "status"]}
              hidePriorityFilter
              dateFilterField={t => t.created}
              extraColumns={[
                { label: "Technician Visit Date", get: t => t.technicianVisitDate },
                { label: "Technician Visit Slot", get: t => t.technicianVisitSlot },
                { label: "Job Start Time", get: t => fmtIST(t.jobStartTime) },
                { label: "Job End Time", get: t => fmtIST(t.jobEndTime) },
              ]}
              topContent={filtered => <OpsKpis tickets={filtered} />}
              bottomContent={filtered => <><OpsSparesTable tickets={filtered} /><OpsTdsTable tickets={filtered} /></>}
            />}
            {tab === "cust_list" && <Customers key={refreshKey} accessLevel={tabAccess} />}
            {tab === "cust_all" && <AllCustomers key={refreshKey} />}
            {tab === "cust_societies" && <CustomerSocieties key={refreshKey} />}
            {tab === "bill_overview" && <BillingOverview key={refreshKey} />}
            {tab === "bill_subs" && <Subscriptions key={refreshKey} />}
            {tab === "bill_invoices" && <Invoices key={refreshKey} />}
            {tab === "bill_deposits" && <DepositRefunds key={refreshKey} />}
            {tab === "bill_plans" && <Plans key={refreshKey} />}
            {tab === "fsm_track" && <TrackTechnician key={refreshKey} />}
            {tab === "fsm_amc" && <MaintenanceSchedule key={refreshKey} />}
            {tab === "fsm_quality" && <WaterQuality key={refreshKey} />}
            {tab === "erp_assets" && <AssetLifecycle key={refreshKey} />}
            {tab === "as_society" && <AutoGSSociety key={refreshKey} accessLevel={tabAccess} />}
            {tab === "as_iot" && <IoTAlerts key={refreshKey} />}
            {tab === "iot_devices" && <IoTDevices key={refreshKey} />}
            {tab === "iot_alerts" && <IoTAlertsPage key={refreshKey} />}
            {tab === "backtrack" && isModuleAdmin && <Backtrack key={refreshKey} />}
            {tab === "logs" && isModuleAdmin && <Logs key={refreshKey} />}
            {tab === "users" && isModuleAdmin && <UsersAdmin key={refreshKey} />}
          </>}
        </div>
      </main>
      {photoOpen && <PhotoUploader username={user.username} current={photo}
        onClose={() => setPhotoOpen(false)}
        onSaved={(url) => { setPhoto(url); setPhotoOpen(false); }} />}
      {downSources.length > 0 && !dismissedDown && <ServerDownModal sources={downSources} onDismiss={() => setDismissedDown(true)} onCloseModule={onHome} />}
    </div>
  );
}






// Heads-up popup shown when the current section's data sources are unreachable.
// Dismissible (v2.29.101) — it used to hard-block the whole module with only a
// "Close Module" escape; now it's an FYI the user can dismiss and keep browsing
// (the section will just show sample/cached data + its own inline banner),
// with "Close Module" kept as a secondary way out for anyone who'd rather leave.
function ServerDownModal({ sources, onDismiss, onCloseModule }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const recs = sources.map(s => _failures.find(f => f.source === s && !f.endedAt)).filter(Boolean);
  return createPortal(
    <div style={{ ...overlay, alignItems: "center", justifyContent: "center", padding: "40px 20px", zIndex: 2000 }}>
      <div className="pw-pop" style={{ width: "min(460px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 26, boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: "#FBE8E8", color: "#DC4141", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><AlertCircle size={28} /></div>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Server unavailable</h2>
        <p style={{ fontSize: 13.5, color: "var(--slate)", marginBottom: 16 }}>We can't reach the data service for this section right now. You can still go in — live numbers are paused and any cached values may be stale.</p>
        <div style={{ display: "grid", gap: 8, marginBottom: 18, textAlign: "left" }}>
          {recs.map(r => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 12px", background: "var(--mint)", borderRadius: 10, fontSize: 12.5 }}>
              <span style={{ fontWeight: 600, color: "var(--f)" }}>{r.source}</span>
              <span style={{ color: "#DC4141", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>down {fmtDowntime(Date.now() - new Date(r.startedAt).getTime())}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCloseModule} style={{ ...btnGhost, padding: "11px 20px" }}>Close Module</button>
          <button onClick={onDismiss} style={{ ...btnPrimary, width: "auto", padding: "11px 26px" }}>Continue anyway</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

