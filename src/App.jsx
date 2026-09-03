import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Users, GitBranch, BarChart3, ScrollText, UserCog,
  LogOut, Search, Plus, Eye, EyeOff, ShieldCheck, Filter,
  TrendingUp, Award, Wallet, ChevronRight, X, CheckCircle2, Clock,
  AlertCircle, Download, Lock, ArrowUpRight, Trash2, KeyRound, Menu,
  Coins, Check, Ban, Hourglass, Globe, MapPin, Undo2, RotateCcw, RefreshCw, Camera, Image as ImageIcon, Trophy, Medal, MessageCircle, Phone, ArrowUpDown, ChevronLeft, Moon, Sun, Printer, Briefcase, Receipt, Boxes, Wrench, Home as HomeIcon, LayoutGrid, Construction, Ticket, UserRound, PencilLine, Cpu, Landmark, Scale, ArrowLeftRight, Droplets, CalendarClock, Repeat, Info, Paperclip, GripVertical, CalendarDays, Bell, Tag, CalendarRange, Rocket, Target, ArrowUp, ArrowDown, ChevronDown, ChevronUp, SlidersHorizontal, Sparkles, Thermometer, FlaskConical, Gauge, Waves, Upload, PlayCircle, Monitor, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  ComposedChart, Line, ReferenceLine, ReferenceArea, LineChart
} from "recharts";
import { ApiUsageTracker, makeCache } from "./lib/apiUsageTracker";
import {
  API_BASE, API_ORIGIN, API_USAGE_LIMITS, APP_VERSION, Auth, BILLING_CYCLES,
  CACHE_MS, CUSTOMER_FIELDS, DATE_PRESETS, DEVICE_TYPE_STYLE,
  EXISTING_CREDIT, IS_LOCAL, LOGS_EPOCH, LS, MODULES, MODULE_SOURCES,
  NEW_CREDIT, PERSIST_TTL, PLANS, PRESET_UNIT, RANGE_MONTHS, SEED_CUSTOMERS,
  SESSION_IDLE_MS, TAB_SOURCES, THEMES, VERSION_DATE, ZOHO_MAX_CONCURRENT, ZOHO_MIN_GAP_MS,
  _apiCache, _apiCacheAt, _creditOverrides, _currentModule, setCurrentModule, _custCache, _customers,
  _dpCache, _emptySession, _failureListeners, _failures, _inflight,
  _logs, _manualCredits, _memCache, _notifyFailureListeners, _photos,
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
  CHART_PALETTE, tkPriority, titleCaseName, checkDeployInProgress,
} from "./shared/core";
import {
  ApiError, Card, Chip, DateRangeFilter, DateRangePicker,
  DefRow, DeviceTypeBadge, Drawer, Drop, Empty, Field,
  ForgotPassword, Loading, LogChip, Login, Modal, MultiSelectFilter,
  PIE_LABEL_OFFSET, Person, PhotoUploader, SortHeader, Stat, Status,
  TT, Table, Toolbar, WowMomTT, axisTick, btnGhost,
  btnPrimary, ftd, grid4, iconBtn, inp, overlay,
  pieLabelLine, renderPieLabel, selectStyle, td, toastStyle, trStyle, GsTextCell, MODULE_ICONS, ProWaterLogo
} from "./shared/ui";
import { AssetLifecycle } from "./modules/ERP";
import { UsersAdmin } from "./modules/Employee";
import { DeviceReplacement } from "./modules/DeviceReplacement";
import { PasswordVault } from "./modules/Vault";
import { TrackTechnician, MaintenanceSchedule, WaterQuality } from "./modules/FSM";
import { AutoGSSociety, IoTAlerts } from "./modules/AutoScheduler";
import { tkStatus, TicketBadge, TicketOverview, SparesTable, TicketList } from "./modules/Ticketing";
import { ApiUsageDashboard, Logs, Failures } from "./modules/LogsTracker";
import { ReleaseManager, ReleasePopup, AboutModule } from "./modules/About";
import { SalesLeads, SalesTrendAnalysis, SalesErrorCorrection, ApartmentLeads, salesApi, notHiddenLead } from "./modules/Sales";
import { TaskPlanner, TaskAdmin } from "./modules/TaskPlanner";
import { CustomerSocieties, AllCustomers, CustomerDrawer } from "./modules/Customer";
import { Overview, Referrers, Referees, Credits, AddManualCredit, Analytics as ReferralAnalyticsTab, Backtrack, Tracker } from "./modules/Referral";
import { Subscriptions, Invoices, DepositRefunds, Plans } from "./modules/Billing";
import { IoTDevices, IoTAlertsPage } from "./modules/IoT";
import {
  AnalyticsOverview, CreditsAnalytics, NetRevenue,
  PenetrationTracker, BillingAnalytics, AppLogs, EarnedRevenue,
  Reconciliation, DPTransactions, AOP, ChurnRiskRadar, ApartmentPerformance,
  ApiLoadTracker,
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
    --brand:#1E9E4F;        /* brand green — primary actions, positive series */
    --green:#08805A;        /* green · text — success text, strong accents      */
    --deep:#0B6F52;         /* deep green — dark accents, second green series   */
    --mint:#F7F5EF;         /* warm sand — app background (#F7F5EF)            */
    --f:#0A1A12;            /* ink · text — headings                            */
    --slate:#0A1A12;        /* ink · text — body                                */
    --muted:#8A8375;        /* muted text — labels / captions (warm-neutral)    */
    --faint:#B3AC9C;        /* faint text — disabled / placeholder (warm-neutral)*/
    --border:#ECE6D8;       /* hairline — warm-tinted                           */
    --white:#FFFFFF;        /* surface                                          */
    --amber:#986315;        /* amber · warn — the brand amber (#E0921F) darkened
                               to the same hue/sat until it passes AA as text     */
    --danger:#DC4141;       /* red · danger                                     */
    --blue:#2A86D6;         /* blue · progress                                  */

    /* derived — washes for status rows/badges and their borders */
    --mint-2:#EFE9DC;
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

    --grad:linear-gradient(135deg, #1E9E4F 0%, #C4E538 100%);
    --grad-btn:linear-gradient(135deg, #1E9E4F 0%, #C4E538 100%);
    --shadow:0 1px 2px rgba(10,26,18,.04), 0 8px 24px -12px rgba(10,26,18,.16);
    --shadow-lg:0 24px 60px -20px rgba(10,26,18,.28);
    --radius:16px;
    --pw-topbar-bg:rgba(247,245,239,.95);
  }
  /* ---- Dark theme (rich executive dark mode; matching Home & Modules) ---- */
  :root[data-theme="dark"], html[data-theme="dark"], body[data-theme="dark"]{
    --mint:#161310; --mint-2:#211c16;
    --f:#f8f6f1; --slate:#e8e2d6; --muted:#a89f8d; --faint:#6e675a;
    --border:rgba(255,255,255,0.12); --white:#1e1913;
    --green-t:#1a2620; --amber-t:#2c2214; --danger-t:#2c1616; --blue-t:#13263a;
    --shell:#161310; --shell-2:#211c16; --shell-0:#0d0b08;
    --forest:#161310; --forest-2:#211c16;
    --pw-topbar-bg:rgba(22,19,16,0.85);
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
    --pw-topbar-bg:rgba(246,245,252,0.92);
  }
  *{box-sizing:border-box}
  html,body,#root{margin:0;padding:0;width:100%;min-height:100vh}
  body{margin:0;padding:0;background:var(--mint);color:var(--slate)}
  #root{margin:0;padding:0;background:var(--mint);min-height:100vh;width:100%}

  /* Global Dark Mode Contrast, Card Backgrounds & Typography */
  html[data-theme="dark"] body,
  html[data-theme="dark"] #root,
  html[data-theme="dark"] .pw-root,
  html[data-theme="dark"] .premium-home,
  html[data-theme="dark"] .shell-grid,
  html[data-theme="dark"] main {
    background-color: #161310 !important;
    color: #f8f6f1;
  }

  /* Dark mode card container surfaces (prevents white cards from blinding in dark mode) */
  html[data-theme="dark"] .pw-card,
  html[data-theme="dark"] .premium-module,
  html[data-theme="dark"] .premium-section,
  html[data-theme="dark"] [style*="background: #fff"],
  html[data-theme="dark"] [style*="background: white"],
  html[data-theme="dark"] [style*="background:#fff"],
  html[data-theme="dark"] [style*="background: #ffffff"],
  html[data-theme="dark"] [style*="background: rgba(255, 255, 255"],
  html[data-theme="dark"] [style*="background: rgba(255,255,255"],
  html[data-theme="dark"] [style*="background: #f8fbf9"],
  html[data-theme="dark"] [style*="background: #eef4f0"],
  html[data-theme="dark"] [style*="background: #F6FAF8"],
  html[data-theme="dark"] [style*="background: #f0f7f4"],
  html[data-theme="dark"] [style*="rgb(255, 255, 255)"],
  html[data-theme="dark"] [style*="rgb(248, 252, 250)"],
  html[data-theme="dark"] [style*="linear-gradient(rgb(255, 255, 255)"],
  html[data-theme="dark"] [style*="linear-gradient(180deg,#fff"] {
    background: #1e1913 !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
    color: #f8f6f1 !important;
  }

  html[data-theme="dark"] .pw-topbar {
    background-color: rgba(22, 19, 16, 0.85) !important;
    border-bottom-color: rgba(255, 255, 255, 0.1) !important;
  }
  html[data-theme="dark"] h1,
  html[data-theme="dark"] h2,
  html[data-theme="dark"] h3,
  html[data-theme="dark"] h4,
  html[data-theme="dark"] .serif,
  html[data-theme="dark"] .premium-topbar-title,
  html[data-theme="dark"] .premium-greeting {
    color: #f8f6f1 !important;
  }
  html[data-theme="dark"] p:not([class*="tag"]):not([class*="pill"]):not([class*="badge"]),
  html[data-theme="dark"] label:not([class*="tag"]):not([class*="pill"]):not([class*="badge"]) {
    color: #e8e2d6;
  }
  html[data-theme="dark"] .eyebrow {
    color: #a89f8d !important;
  }

  /* Table styling in dark mode */
  html[data-theme="dark"] table {
    background-color: #1e1913 !important;
    color: #f8f6f1 !important;
  }
  html[data-theme="dark"] th,
  html[data-theme="dark"] td {
    border-color: rgba(255, 255, 255, 0.08) !important;
    color: #f8f6f1 !important;
  }
  html[data-theme="dark"] tr {
    background-color: transparent !important;
  }
  html[data-theme="dark"] tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.05) !important;
  }
  html[data-theme="dark"] thead th {
    background-color: #2a2318 !important;
    color: #d6cfc0 !important;
  }
  html[data-theme="dark"] input,
  html[data-theme="dark"] select,
  html[data-theme="dark"] textarea {
    background-color: #241f17 !important;
    color: #f8f6f1 !important;
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  /* High-Contrast Recharts, SVG Graphs & Data Labels in Dark Mode */
  html[data-theme="dark"] .recharts-cartesian-axis-tick text,
  html[data-theme="dark"] .recharts-text,
  html[data-theme="dark"] .recharts-legend-item-text,
  html[data-theme="dark"] svg text {
    fill: #e8e2d6 !important;
    color: #e8e2d6 !important;
    font-weight: 600 !important;
    font-size: 11px;
  }
  html[data-theme="dark"] .recharts-label,
  html[data-theme="dark"] text[class*="recharts-line-dot"],
  html[data-theme="dark"] text.recharts-label {
    fill: #ffffff !important;
    color: #ffffff !important;
    font-weight: 700 !important;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  }
  html[data-theme="dark"] .recharts-cartesian-grid line {
    stroke: rgba(255, 255, 255, 0.1) !important;
  }
  html[data-theme="dark"] .recharts-default-tooltip {
    background-color: #2a2318 !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    color: #ffffff !important;
    border-radius: 12px !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
  }

  /* Floating Frosted Glass Sidebar v3 (available globally in Home and Shell).
     Split across two elements so the dark card visually reaches the same
     bottom edge as the module grid instead of a flat 96vh: .pw-sidebar-rail
     (outer) is a plain grid item with no explicit height, so it stretches
     to match whichever of the sidebar/main-content column is taller (the
     grid's default align-items:stretch) — it carries the background/
     border/radius/shadow and the theme CSS variables. .pw-sidebar-v3
     (inner) is height:100% of that — NOT a fixed px cap, so it never
     clips the nav list the way an earlier attempt at this did — plus
     position:sticky so the nav content still tracks the viewport while
     scrolling, with the user-card's margin-top:auto correctly pinning it
     to the bottom of however tall the rail ends up being. */
  .pw-sidebar-rail{margin:2vh 0 2vh 16px;border-radius:20px;font-family:-apple-system,BlinkMacSystemFont,"Plus Jakarta Sans","SF Pro Display",sans-serif;transition:background .3s ease,border-color .3s ease,box-shadow .3s ease}
  .pw-sidebar-rail[data-theme="dark"]{--pw-bg-surface:rgba(30,42,32,.92);--pw-border:rgba(255,255,255,.08);--pw-hover-bg:rgba(255,255,255,.09);--pw-card-bg:rgba(255,255,255,.04);--pw-text-main:#f1f5f9;--pw-text-muted:#a89f8d;--pw-text-active:#ffffff;--pw-accent-gradient:linear-gradient(135deg,#1E9E4F 0%,#C4E538 100%);--pw-accent-glow:rgba(30, 158, 79,.35);--pw-shadow:0 20px 50px rgba(0,0,0,.4);--pw-inset-shadow:inset 0 1px 0 rgba(255,255,255,.1);--pw-badge-bg:rgba(245,158,11,.15);--pw-badge-text:#fbbf24;--pw-badge-border:rgba(245,158,11,.25)}
  .pw-sidebar-rail[data-theme="light"]{--pw-bg-surface:rgba(247,245,239,.85);--pw-border:rgba(255,255,255,.8);--pw-hover-bg:rgba(255,255,255,.6);--pw-card-bg:rgba(255,255,255,.5);--pw-text-main:#1e293b;--pw-text-muted:#8a8375;--pw-text-active:#ffffff;--pw-accent-gradient:linear-gradient(135deg,#1E9E4F 0%,#C4E538 100%);--pw-accent-glow:rgba(30, 158, 79,.25);--pw-shadow:0 20px 40px rgba(0,0,0,.06);--pw-inset-shadow:inset 0 1px 0 rgba(255,255,255,.9);--pw-badge-bg:rgba(217,119,6,.12);--pw-badge-text:#d97706;--pw-badge-border:rgba(217,119,6,.2)}
  .pw-sidebar-rail{background:var(--pw-bg-surface);backdrop-filter:blur(24px) saturate(200%);-webkit-backdrop-filter:blur(24px) saturate(200%);border:1px solid var(--pw-border);box-shadow:var(--pw-shadow),var(--pw-inset-shadow);color:var(--pw-text-main)}
  .pw-sidebar-v3{width:100%;height:100%;position:sticky;top:2vh;display:flex;flex-direction:column;padding:16px 12px;box-sizing:border-box;z-index:40}
  .pw-brand-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 18px;border-bottom:1px solid var(--pw-border);margin-bottom:12px}
  .pw-brand-content{display:flex;align-items:center;gap:12px}
  .pw-brand-logo{width:36px;height:36px;border-radius:10px;background:var(--pw-accent-gradient);display:grid;place-items:center;box-shadow:0 0 20px var(--pw-accent-glow);flex:0 0 auto}
  .pw-brand-title{font-size:15px;font-weight:700;color:var(--pw-text-main)}
  .pw-version-pill{font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;background:var(--pw-badge-bg);color:var(--pw-badge-text);border:1px solid var(--pw-badge-border)}
  .pw-theme-switcher{display:flex;background:var(--pw-card-bg);border:1px solid var(--pw-border);border-radius:12px;padding:3px;margin-bottom:12px;gap:2px}
  .pw-theme-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 0;border:none;background:transparent;color:var(--pw-text-muted);font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .2s ease}
  .pw-theme-btn:hover{color:var(--pw-text-main)}
  .pw-theme-btn.active{background:var(--pw-hover-bg);color:var(--pw-text-main);box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .pw-category-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pw-text-muted);padding:10px 10px 4px}
  .pw-nav-container{flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:3px;scrollbar-width:none;-ms-overflow-style:none;min-height:0}
  .pw-nav-container::-webkit-scrollbar{display:none;width:0;height:0}
  .pw-item{width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border:none;background:transparent;border-radius:10px;color:var(--pw-text-muted);font-size:13px;font-weight:500;text-align:left;cursor:pointer;transition:all .2s ease;transform-origin:left center}
  .pw-item:hover{background:var(--pw-hover-bg);color:var(--pw-text-main);transform:translateX(2px) scale(1.04)}
  .pw-item.active:hover{transform:translateX(2px) scale(1.02)}
  .pw-item.active{background:var(--pw-accent-gradient);color:var(--pw-text-active);font-weight:600;box-shadow:0 8px 20px var(--pw-accent-glow)}
  .pw-user-card{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:#1E2A20;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.25);transition:all .25s ease;overflow:hidden}
  .pw-user-card:hover{border-color:rgba(66,154,56,.4);box-shadow:0 6px 24px rgba(30,42,32,.4)}
  .pw-avatar-wrap{position:relative;display:flex;flex:0 0 auto}
  .pw-root .pw-avatar{width:38px;height:38px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#1E9E4F,#C4E538);display:grid;place-items:center;font-weight:700;font-size:14px;color:#fff;border:none;cursor:pointer;flex:0 0 auto;box-shadow:inset 0 1px 1px rgba(255,255,255,.3);transition:transform .2s ease}
  .pw-avatar:hover{transform:scale(1.06)}
  .pw-status-dot{position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;background:#8DC63F;border:2px solid #1E2A20;border-radius:50%}
  .pw-user-info{flex:1;display:flex;flex-direction:column;gap:2px;overflow:hidden;min-width:0}
  .pw-name-badge{display:flex;align-items:center;gap:6px}
  .pw-name{font-size:13px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pw-tag{display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;padding:1px 5px;background:rgba(141,198,63,.15);color:#8DC63F;border-radius:4px;border:1px solid rgba(141,198,63,.3);font-family:ui-monospace,monospace;flex:0 0 auto}
  .pw-role{font-size:11px;color:rgba(232,245,233,.6);text-transform:capitalize}
  .pw-sidebar-footer{text-align:center;font-size:9px;color:rgba(232,245,233,.4);margin-top:10px;line-height:1.5}
  .pw-sidebar-footer div:last-child{margin-top:1px}
  .pw-root .pw-action-btn{background:rgba(255,92,92,.1);border:1px solid rgba(255,92,92,.2);color:#ff8080;cursor:pointer;width:32px;height:32px;padding:0;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;transition:all .2s ease}
  .pw-root .pw-action-btn:hover{color:#ffffff;background:#ff5c5c;border-color:#ff5c5c}
  /* Topbar header row (greeting + session timer + avatar + logout) — used by
     both Home's greeting row and Shell's topbar cluster, on the light main
     canvas (so a lighter palette than the dark sidebar's pw-avatar/pw-tag).
     .pw-top-header itself (the card shell) is Home-only — Shell's topbar is
     a separate full-width sticky bar (.pw-topbar) that isn't card-ified. */
  .pw-top-header{display:flex;justify-content:space-between;align-items:center;padding:8px 34px;background:linear-gradient(135deg,#ffffff 0%,#f4fff1 100%);border-radius:26px;border:1px solid rgba(30,158,79,.15);box-shadow:0 15px 40px rgba(30,158,79,.12);margin-bottom:16px}
  .pw-greeting{margin:0;font-size:30px;font-weight:750;letter-spacing:-.7px;color:#102a18}
  .pw-greeting span{background:linear-gradient(90deg,#1E9E4F,#C4E538);-webkit-background-clip:text;background-clip:text;color:transparent}
  .pw-header-actions{display:flex;align-items:center;gap:14px}
  .pw-session-badge{display:flex;align-items:center;gap:12px;padding:10px 18px;background:#ffffff;border-radius:18px;border:1px solid rgba(30,158,79,.15);white-space:nowrap}
  .pw-session-icon{width:38px;height:38px;display:flex;justify-content:center;align-items:center;border-radius:14px;background:linear-gradient(135deg,#1E9E4F,#C4E538);color:#fff;flex:0 0 auto}
  .pw-session-badge small{display:block;font-size:11px;color:#718096}
  .pw-session-badge strong{color:#102a18;font-size:15px;font-variant-numeric:tabular-nums}
  /* Solid brand gradient + white text (not the earlier pale mint-on-cream)
     so this reads as a clear button against the light topbar/canvas instead
     of nearly disappearing into it. */
  .pw-root .pw-avatar-btn{width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#1E9E4F,#7ED321);color:#ffffff;border:none;font-size:20px;font-weight:700;display:grid;place-items:center;cursor:pointer;padding:0;overflow:hidden;box-shadow:0 8px 22px rgba(30,158,79,.35)}
  .pw-camera-dot{position:absolute;bottom:0;right:0;width:19px;height:19px;border-radius:50%;background:#C4E538;border:2px solid #fff;color:#14532d;display:grid;place-items:center;cursor:pointer}
  /* Logout button — used by both Home's greeting row and Shell's topbar. */
  .pw-root .pw-logout-btn{display:flex;align-items:center;gap:8px;padding:13px 22px;border-radius:16px;background:linear-gradient(135deg,#1E9E4F,#16753b);border:none;color:#ffffff;font-size:14px;font-weight:650;cursor:pointer;transition:all .25s ease}
  .pw-root .pw-logout-btn:hover{background:linear-gradient(135deg,#ef4444,#dc2626);color:#ffffff;transform:translateY(-2px);box-shadow:0 12px 25px rgba(220,38,38,.35)}
  .pw-root .pw-logout-btn:active{transform:scale(.97)}
  /* Collapse/expand toggle + collapsed state — moved here from Home's own
     local <style> block (v2.29.219) since it was only ever mounted while
     Home was on screen, so the identical .pw-sidebar-v3.collapsed class
     toggled by Shell (module views) had no matching rule and did nothing —
     that's why "Hide/Show Sidebar" silently failed inside every module.
     .pw-sidebar-toggle-btn was missing from here for the same reason, so
     that button also rendered as a bare unstyled default <button> in Shell.

     v2.29.220: "collapsed" is a narrow ICON RAIL, not width:0/opacity:0 —
     per explicit correction ("i should be able to see the icon on the left
     side when it hides i should be able to expand it... at the same time i
     should be able to unhide it also"). The old width:0 + pointer-events:
     none + opacity:0 treatment threw away JSX that was already built for
     exactly this icon-only mode (labels hidden, hover tooltips added via
     title= on every nav button when collapsed) — it just made the whole
     thing, toggle button included, invisible and unclickable, leaving only
     the separate topbar button as a way back in. Now the rail itself stays
     visible/interactive so its own toggle button works too — both ways to
     expand it (the rail's own button and the topbar's) call the same
     toggleSidebarCollapsed, so either one un-hides it. */
  .pw-root .pw-sidebar-toggle-btn{width:26px;height:26px;border-radius:8px;background:var(--pw-card-bg);border:1px solid var(--pw-border);color:var(--pw-text-muted);display:grid;place-items:center;cursor:pointer;transition:all .2s ease;flex:0 0 auto}
  .pw-root .pw-sidebar-toggle-btn:hover{color:var(--pw-text-main);background:var(--pw-hover-bg);box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .pw-sidebar-v3.collapsed{width:52px!important;min-width:52px!important;padding:14px 4px!important;align-items:center}
  .pw-sidebar-v3.collapsed .pw-brand-header{flex-direction:column;gap:8px;padding:0 0 12px;justify-content:center;align-items:center;border-bottom:1px solid var(--pw-border);width:100%;margin-bottom:8px}
  .pw-sidebar-v3.collapsed .pw-brand-content{justify-content:center;width:100%}
  .pw-sidebar-v3.collapsed .pw-nav-container{width:100%;align-items:center;gap:2px}
  .pw-sidebar-v3.collapsed .pw-item{justify-content:center;padding:9px 0;width:40px;min-width:40px;border-radius:10px;gap:0}
  .pw-sidebar-v3.collapsed .pw-category-title{display:none}
  .pw-sidebar-v3.collapsed .pw-user-card{flex-direction:column;padding:8px 4px;gap:6px;width:44px;min-width:44px;justify-content:center;align-items:center;border-radius:12px}
  .pw-sidebar-v3.collapsed .pw-sidebar-footer{display:none}
  .pw-sidebar-v3.collapsed .pw-version-pill{display:none}

  .pw-root{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--slate);
    background:var(--mint);min-height:100vh;width:100%;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;letter-spacing:-.003em}
  /* Display serif for headings + the .serif class (big KPI numbers) */
  .pw-root h1,.pw-root h2,.pw-root h3,.pw-root .serif{font-family:'Playfair Display',Georgia,'Times New Roman',serif;color:var(--f);font-weight:800;letter-spacing:-.015em;line-height:1.14}
  .pw-root code,.pw-root .mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
  .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}
  .lime-word{color:var(--lime-d)}
  ::selection{background:var(--lime);color:var(--forest)}
  /* NOTE: .pw-root button (0,1,1 specificity — a class plus an element) beats
     any single-class button rule like .pw-item's background regardless of
     source order, silently zeroing it out. Any new button component style
     that sets its own background must be scoped as .pw-root .some-btn
     (0,2,0) to survive this reset — found this the hard way when
     .pw-avatar, .pw-action-btn, .pw-avatar-btn, .pw-logout-btn, and
     .pw-sidebar-toggle-btn all silently lost their backgrounds to this rule. */
  .pw-root button{font-family:inherit;cursor:pointer;border:none;background:none;transition:transform .12s ease, filter .14s ease, box-shadow .16s ease, background .14s ease}
  .pw-root button:disabled{cursor:not-allowed}
  .pw-root button:not(:disabled):hover{filter:brightness(1.03)}
  .pw-root button:not(:disabled):active{transform:scale(.985)}
  .pw-root input,.pw-root select,.pw-root textarea{font-family:inherit;transition:border-color .15s ease, box-shadow .15s ease}
  .pw-root input:focus,.pw-root select:focus,.pw-root textarea:focus{border-color:var(--lime-d);box-shadow:0 0 0 3px rgba(30, 158, 79,.20);outline:none}
  .pw-root select{appearance:none;-webkit-appearance:none;padding-right:32px!important;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237D8A83' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
    background-repeat:no-repeat;background-position:right 11px center}
  /* alive, hover-highlighted table rows (inline-styled rows keep their own bg) */
  .pw-root tbody tr{transition:background .12s ease}
  .pw-root tbody tr:hover{background:#EEF7F3}
  /* Card hover — subtle zoom + brand-green highlight so it's clear which card you're on */
  .pw-root .pw-card{transition:transform .16s ease, box-shadow .18s ease, border-color .16s ease}
  .pw-root .pw-card:hover{transform:translateY(-3px) scale(1.012); border-color:var(--lime-d)!important; box-shadow:0 22px 40px -22px rgba(5,48,30,.55), 0 0 0 1px rgba(30, 158, 79,.30)!important}
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



class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary caught error:", error, info); }
  resetSession = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("pw_recent_modules");
      localStorage.removeItem("pw_sidebar_theme");
    } catch {}
    window.location.href = window.location.origin + window.location.pathname;
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8faf9", fontFamily: "system-ui, sans-serif", padding: 20 }}>
          <div style={{ maxWidth: 460, width: "100%", background: "#ffffff", padding: 36, borderRadius: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(30, 158, 79,0.1)", color: "#1E9E4F", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
              <RefreshCw size={28} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1D1D1F", margin: "0 0 8px" }}>Workspace Auto-Recovery</h2>
            <p style={{ fontSize: 13.5, color: "#86868B", lineHeight: 1.5, margin: "0 0 24px" }}>
              Your session state has been updated. Click below to launch your ProWater workspace.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={this.resetSession} style={{ padding: "12px 24px", borderRadius: 14, background: "linear-gradient(135deg, #1E9E4F, #C4E538)", border: "none", fontSize: 14, fontWeight: 700, color: "#ffffff", cursor: "pointer", boxShadow: "0 8px 22px rgba(30, 158, 79,0.3)" }}>
                Launch ProWater Workspace ↗
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
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

  // Deploy-in-progress banner (v2.29.342) — polls GitHub Actions' public API
  // for the deploy workflow's latest run every 3 minutes (deliberately not
  // more often: GitHub's unauthenticated API is capped at 60 requests/hour
  // PER IP, shared across everyone at the same office/network with this tab
  // open, so a tighter interval risks the whole team hitting that limit
  // together). Shown regardless of login state — anyone loading the site
  // mid-deploy should see it, not just logged-in users.
  const [deployInProgress, setDeployInProgress] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const poll = () => checkDeployInProgress().then(v => { if (!cancelled) setDeployInProgress(v); });
    poll();
    const t = setInterval(poll, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("pw_sidebar_collapsed") === "true"; }
    catch { return false; }
  });
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("pw_sidebar_collapsed", String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="pw-root">
      <style>{TOKENS}</style>
      <Auth.Provider value={{ user, setUser: onSetUser, activeModule, setActiveModule: onSetActiveModule, sidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed }}>
        {deployInProgress && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
            background: "#08805A", color: "#fff",
            padding: "10px 20px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10, fontSize: 13.5, fontWeight: 500
          }}>
            <RefreshCw size={16} style={{ animation: "pw-spin .8s linear infinite" }} />
            Dashboard upgrade in progress — some things may look out of date until it finishes.
          </div>
        )}
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
  const { user, setUser, sidebarCollapsed, toggleSidebarCollapsed } = useAuth();
  if (!user) return null;
  const access = user.access || (user.role === "admin" ? allAccess("admin") : { referral: "view", analytics: "view" });
  const visible = MODULES.filter(m => (access[m.id] || "none") !== "none");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [now, setNow] = useState(new Date());
  const [loginAt] = useState(() => Date.now());        // session start for the timer
  const [elapsed, setElapsed] = useState(0);            // seconds since login
  const [photo, setPhoto] = useState(() => user ? api.getPhoto(user.username) : "");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pw_recent_modules") || "[]"); }
    catch { return []; }
  });
  // Sidebar is a fixed dark rail (SaaS convention: dark nav + light canvas) —
  // the old light/dark/system toggle (v2.29.183) was already removed from the
  // UI in v2.29.217, and its leftover state kept re-flipping the GLOBAL
  // `data-theme` attribute to dark on every load (defaulted to "dark"), which
  // fought the app's deliberate light-only theme (`THEMES=["light"]` in
  // `shared/core.js`) and was the actual cause of the sidebar/app randomly
  // rendering dark — not a real toggle, since nothing could set it back.
  const sidebarEffectiveTheme = "dark";

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setElapsed(Math.floor((Date.now() - loginAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [loginAt]);

  const openModule = (moduleItem) => {
    const next = [moduleItem.id, ...recentIds.filter(id => id !== moduleItem.id)].slice(0, 4);
    setRecentIds(next);
    localStorage.setItem("pw_recent_modules", JSON.stringify(next));
    onPick(moduleItem.id);
  };

  const filtered = visible.filter(m => `${m.label} ${m.desc}`.toLowerCase().includes(query.trim().toLowerCase()));
  const firstNameRaw = String(user.name || user.username || "there").split(" ")[0];
  const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const initials = String(user.name || user.username || "P").trim().charAt(0).toUpperCase();
  const fmtElapsed = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  return (
    <div className="premium-home" style={{ gridTemplateColumns: sidebarCollapsed ? "68px minmax(0, 1fr)" : "290px minmax(0, 1fr)", transition: "grid-template-columns .25s ease" }}>
      <style>{`
        .premium-home{background:linear-gradient(135deg,#FBFAF7 0%,#F7F5EF 55%,#F3F0E8 100%);display:grid;align-items:stretch;min-height:100vh;grid-template-columns:290px minmax(0,1fr);color:var(--f);position:relative;overflow:hidden}
        .pw-app-glow{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;animation:pw-app-float 14s ease-in-out infinite alternate}
        .pw-app-glow.green{width:500px;height:500px;background:#1E9E4F;top:-120px;right:-80px;opacity:.10}
        .pw-app-glow.blue{width:460px;height:460px;background:#C4E538;bottom:-140px;left:20%;opacity:.08;animation-delay:4s}
        .pw-app-glow.mint{width:400px;height:400px;background:#C4E538;top:45%;right:15%;opacity:.07;animation-delay:8s}
        @keyframes pw-app-float{0%{transform:translateY(0) scale(1)}50%{transform:translateY(45px) scale(1.08)}100%{transform:translateY(-25px) scale(.95)}}

        /* The sidebar (pw-sidebar-v3 and every pw-brand, pw-item and pw-user
           class it contains) used to have its OWN copy here, sized slightly
           smaller than the shared global TOKENS stylesheet Shell relies on —
           that's why the sidebar looked a different size on Home vs. inside
           a module. Removed entirely so Home renders from the same single
           global definition as Shell (see the "Floating Frosted Glass
           Sidebar v3" block near the top of TOKENS) — one source of truth,
           identical size everywhere. pw-home-logout-btn moved there too. */

        /* Override sidebar rail margin inside Home so its top/bottom edges
           align exactly with the white card: 18px top = premium-content
           padding-top; 26px bottom = premium-content padding-bottom. */
        .premium-home .pw-sidebar-rail{margin:18px 0 26px 16px}

        .premium-main{min-width:0;display:flex;flex-direction:column;position:relative;z-index:10}
        /* Make the content column and card stretch so they always match
           the sidebar rail height — flex:1 propagates the full column
           height down to the white card. */
        .premium-content{flex:1;display:flex;flex-direction:column;padding:0 32px 0;max-width:1550px;width:100%;margin:0 auto;position:relative;z-index:10}
        .premium-section{flex:1;background:rgba(255,255,255,.72)!important;backdrop-filter:blur(28px) saturate(190%);-webkit-backdrop-filter:blur(28px) saturate(190%);border:1px solid rgba(255,255,255,.85)!important;border-radius:22px!important;padding:22px 24px!important;box-shadow:0 20px 50px rgba(10,26,18,.06),inset 0 1px 0 rgba(255,255,255,.9)!important;position:relative;z-index:10}
        .premium-module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        @media(min-width:1550px){.premium-module-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
        .premium-module{position:relative;min-height:72px!important;padding:18px 20px!important;border:1px solid rgba(255,255,255,.85)!important;border-radius:18px!important;background:rgba(255,255,255,.78)!important;backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);box-shadow:0 7px 20px rgba(10,26,18,.04),inset 0 1px 0 #ffffff!important;text-align:left;display:flex;flex-direction:column;justify-content:center;overflow:hidden;transition:all .2s cubic-bezier(.16,1,.3,1)}
        .premium-module:before{content:"";position:absolute;width:100px;height:100px;border-radius:50%;right:-38px;top:-38px;background:var(--module-color);opacity:.09;transition:transform .2s ease}
        .premium-module:hover{transform:translateY(-3px) scale(1.018);border-color:var(--module-color)!important;box-shadow:0 18px 38px rgba(30, 158, 79,.2),inset 0 1px 0 #ffffff!important;background:rgba(255,255,255,.95)!important}
        .premium-module:hover:before{transform:scale(1.4);opacity:.22}
        .premium-module-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--module-color) 14%,white);color:var(--module-color);flex:0 0 auto}
        .premium-module-name{font-size:15px;font-weight:800;letter-spacing:-.015em;color:#0a1a12;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .premium-module-desc{font-size:12px;color:#64748b;line-height:1.4;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .premium-module-chev{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(30, 158, 79,.08);color:var(--brand);flex:0 0 auto;transition:all .2s ease}
        .premium-module:hover .premium-module-chev{background:var(--brand);color:#fff;transform:translateX(3px)}
        .premium-greeting{font-family:'DM Sans',system-ui,sans-serif!important;font-size:23px!important;font-weight:800!important;letter-spacing:-.025em;color:var(--f);margin:0 0 14px!important;display:flex;align-items:center;justify-content:space-between}
        .premium-group{margin-bottom:20px}
        .premium-group:last-child{margin-bottom:0}
        .premium-group-title{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--brand);margin:0 0 10px;padding:4px 11px;border-radius:7px;background:linear-gradient(90deg,rgba(30, 158, 79,.14) 0%,rgba(196, 229, 56,.06) 100%);border:1px solid rgba(30, 158, 79,.2);display:inline-flex;align-items:center;gap:5px}

        /* ---- Dark theme chrome ---- */
        .premium-home[data-theme="dark"]{
          --f:#f8fafc; --muted:#94a3b8; --border:rgba(255,255,255,0.12);
        }
        .premium-home[data-theme="dark"]{background:linear-gradient(135deg,#090e17 0%,#0d1524 50%,#0b111d 100%);color:var(--f)}
        .premium-home[data-theme="dark"] .premium-section{background:rgba(20,26,36,.75)!important;border-color:rgba(255,255,255,.12)!important;box-shadow:0 30px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)!important}
        .premium-home[data-theme="dark"] .premium-module{background:rgba(20,26,36,.78)!important;border-color:rgba(255,255,255,.1)!important;box-shadow:0 10px 30px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08)!important}
        .premium-home[data-theme="dark"] .premium-module-name{color:var(--f)}
        .premium-home[data-theme="dark"] .premium-module-desc,.premium-home[data-theme="dark"] .premium-access{color:var(--muted)}
        .premium-home[data-theme="dark"] .premium-module-icon{background:color-mix(in srgb,var(--module-color) 25%,#141a24)}
      `}</style>

      <div className="pw-app-glow green" />
      <div className="pw-app-glow blue" />
      <div className="pw-app-glow mint" />

      {/* Floating Frosted Glass Sidebar — outer <aside> stretches to match
          the content column's height, inner div is height:100% of that. */}
      <aside className="pw-sidebar-rail" data-theme={sidebarEffectiveTheme}>
      <div className={`pw-sidebar-v3 ${sidebarCollapsed ? "collapsed" : ""} ${mobileNav ? "open" : ""}`}>
        <div className="pw-brand-header">
          <div className="pw-brand-content" style={{ display: "flex", alignItems: "center" }}>
            <ProWaterLogo size={sidebarCollapsed ? 30 : 38} badge={true} />
          </div>
          <button onClick={toggleSidebarCollapsed} className="pw-sidebar-toggle-btn" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div className="pw-nav-container">
          {!sidebarCollapsed && <div className="pw-category-title">Main Menu</div>}
          <button className="pw-item active" onClick={() => setMobileNav(false)} title={sidebarCollapsed ? "Overview" : undefined}>
            <LayoutDashboard size={16} />
            {!sidebarCollapsed && <span>Overview</span>}
          </button>

          {!sidebarCollapsed && <div className="pw-category-title">Modules</div>}
          {visible.map(m => {
            const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
            return (
              <button
                key={m.id}
                onClick={() => { openModule(m); setMobileNav(false); }}
                className="pw-item"
                title={sidebarCollapsed ? m.label : undefined}
              >
                <Icon size={16} />
                {!sidebarCollapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>}
                {!sidebarCollapsed && m.soon && <span className="pw-version-pill">BETA</span>}
              </button>
            );
          })}
        </div>

        {!sidebarCollapsed && (
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <span className="pw-version-pill">v{APP_VERSION}</span>
          </div>
        )}
        <div className="pw-user-card" title={sidebarCollapsed ? `${titleCaseName(user.name)} (${user.role})` : undefined}>
          <div className="pw-avatar-wrap">
            <button className="pw-avatar" onClick={() => setPhotoOpen(true)} title="Update profile photo">
              {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
            </button>
            <span className="pw-status-dot" />
          </div>
          {!sidebarCollapsed && (
            <div className="pw-user-info">
              <div className="pw-name-badge">
                <span className="pw-name">{titleCaseName(user.name)}</span>
                <span className="pw-tag">
                  {user.role === "admin" ? <ShieldCheck size={10} /> : <Eye size={10} />}
                  {String(user.role || "").toUpperCase()}
                </span>
              </div>
              <div className="pw-role">{user.role} workspace</div>
            </div>
          )}
          {!sidebarCollapsed && (
            <button className="pw-action-btn" onClick={() => setUser(null)} title="Sign out">
              <LogOut size={15} />
            </button>
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="pw-sidebar-footer">
            <div>© {new Date().getFullYear()} ProWater Internal Systems</div>
            <div>Wisdom 2.0</div>
          </div>
        )}
      </div>
      </aside>

      <main className="premium-main">
        <div className="premium-content" style={{ paddingTop: 18, paddingBottom: 26 }}>
          <div className="pw-top-header">
            <div>
              <h1 className="pw-greeting fade-up">{greeting}, <span>{firstName}</span> 👋</h1>
            </div>
            <div className="pw-header-actions">
              <div className="pw-session-badge" title="Session duration">
                <div className="pw-session-icon"><Clock size={18} /></div>
                <div><small>Session</small><strong>{fmtElapsed(elapsed)}</strong></div>
              </div>
              <div className="pw-avatar-wrap">
                <button className="pw-avatar-btn" onClick={() => setPhotoOpen(true)} title="Update profile photo">
                  {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
                </button>
                <span className="pw-camera-dot" onClick={() => setPhotoOpen(true)} title="Update profile photo">
                  <Camera size={10} />
                </span>
              </div>
              <button onClick={() => setUser(null)} className="pw-logout-btn" title="Sign Out">
                <LogOut size={14} /> <span>Logout</span>
              </button>
            </div>
          </div>

          <section className="premium-section" id="module-directory">
            {MODULE_GROUPS.map(group => {
              const mods = visible.filter(m => group.ids.includes(m.id));
              if (!mods.length) return null;
              return (
                <div key={group.title} className="premium-group">
                  <div className="premium-group-title">{group.title}</div>
                  <div className="premium-module-grid">
                    {mods.map(m => {
                      const Icon = MODULE_ICONS[m.icon] || LayoutGrid;
                      return (
                        <button key={m.id} className="premium-module" onClick={() => openModule(m)} style={{ "--module-color": m.color }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0, flex: 1 }}>
                              <div className="premium-module-icon"><Icon size={22} /></div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="premium-module-name">{m.label}</div>
                                <div className="premium-module-desc">{m.desc}</div>
                              </div>
                            </div>
                            <span className="premium-module-chev"><ChevronRight size={17} /></span>
                          </div>
                          {m.soon && <span style={{ position: "absolute", right: 8, top: 8, padding: "2px 6px", borderRadius: 999, background: "var(--amber-t)", color: "var(--amber)", fontSize: 8, fontWeight: 850, letterSpacing: ".07em" }}>BETA</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {visible.length === 0 && (
              <div style={{ padding: "30px 20px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 12, color: "var(--muted)" }}>
                No modules are assigned to your account yet.
              </div>
            )}
          </section>
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
  const { user, setUser, sidebarCollapsed, toggleSidebarCollapsed } = useAuth();
  const moduleMeta = MODULES.find(m => m.id === module) || MODULES.find(m => m.id === "referral");
  const moduleAccess = (user.access && user.access[module]) || (user.role === "admin" ? "admin" : "view");
  const isModuleAdmin = moduleAccess === "admin" || moduleAccess === "devops";
  const defaultTab =
    module === "sales" ? "sales_leads"
    : module === "planner" ? "plan_weekly"
    : module === "analytics" ? "an_overview_v2"
    : module === "employee" ? "emp_users"
    : module === "devicereplace" ? "dr_list"
    : module === "about" ? "about_docs"
    : module === "logtracker" ? "log_all"
    : module === "ticketing" ? "tk_overview"
    : module === "customer" ? "cust_all"
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
      // { id: "an_overview", label: "Overview", icon: LayoutGrid },
      { id: "an_overview_v2", label: "Overview V2", icon: Sparkles },
      { id: "analytics", label: "Referral", icon: BarChart3 },
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
      // Password Vault (v2.29.326) — moved here from its own top-level module
      // per explicit user request. Admin-only, same conditional-spread pattern
      // as Referral's Backtrack / Analytics' AOP / Planner's Modify Tasks.
      ...(isModuleAdmin ? [{ id: "vault_creds", label: "Password Vault", icon: Lock }] : []),
    ],
    ticketing: [
      { id: "tk_overview", label: "Overview", icon: LayoutDashboard },
      { id: "tk_tickets", label: "Tickets", icon: Ticket },
      { id: "tk_ops", label: "Ops Tickets", icon: Wrench },
    ],
    customer: [
      { id: "cust_all", label: "All Customers", icon: Users },
      { id: "cust_societies", label: "Societies", icon: Boxes },
    ],
    billing: [
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
      { id: "about_system_load", label: "System Load", icon: Cpu },
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

  const secOv = sectionOverride(user, module, tab);
  const tabIsAdmin = secOv === "edit" ? true : secOv === "view" ? false : isModuleAdmin;
  const tabAccess = secOv === "edit" ? (isModuleAdmin ? moduleAccess : "admin")
    : secOv === "view" ? "view"
    : moduleAccess;

  useEffect(() => {
    if (nav.length && !nav.some(n => n.id === tab)) setTab(nav[0].id);
  }, [module, nav.length, tab]);

  // Sidebar is a fixed dark rail — see the matching comment in Home() for why
  // the old light/dark/system toggle state was removed instead of reused.
  const sidebarEffectiveTheme = "dark";

  const signOut = async () => { await api.logout(user.username); setUser(null); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: sidebarCollapsed ? "68px 1fr" : "312px 1fr", transition: "grid-template-columns .25s ease", height: "100vh", width: "100%", overflow: "hidden" }} className="shell-grid">
      <style>{`@media(max-width:860px){.shell-grid{grid-template-columns:1fr!important}.pw-sidebar-rail{position:relative;z-index:100}.pw-sidebar-v3{position:fixed;z-index:40;height:100vh;margin:0;border-radius:0;transform:translateX(-105%);transition:transform .22s ease}.pw-sidebar-v3.open{transform:none}.pw-topbar-burger{display:inline-flex!important}.iot-apt-badge{display:none!important}}`}</style>

      {/* sidebar — outer <aside> stretches to match the content column's
          height (see the matching comment in Home()). */}
      <aside className="pw-sidebar-rail" data-theme={sidebarEffectiveTheme}>
      <div className={`pw-sidebar-v3 ${sidebarCollapsed ? "collapsed" : ""} ${mobileNav ? "open" : ""}`}>
        <div className="pw-brand-header">
          <div className="pw-brand-content" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ProWaterLogo size={sidebarCollapsed ? 30 : 36} badge={true} />
            {!sidebarCollapsed && (
              <div style={{ fontSize: 10, fontWeight: 750, color: "var(--pw-text-muted)", letterSpacing: ".06em", textTransform: "uppercase", borderLeft: "1.5px solid var(--pw-border)", paddingLeft: 8 }}>
                {moduleMeta.label}
              </div>
            )}
          </div>
          <button onClick={toggleSidebarCollapsed} className="pw-sidebar-toggle-btn" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div className="pw-nav-container">
          {!sidebarCollapsed && <div className="pw-category-title">Navigation</div>}
          <button onClick={onHome} className="pw-item" style={{ marginBottom: 4 }} title={sidebarCollapsed ? "All Modules" : undefined}>
            <HomeIcon size={18} />
            {!sidebarCollapsed && <span>All Modules</span>}
          </button>

          {!sidebarCollapsed && <div className="pw-category-title">{moduleMeta.label} Sections</div>}
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => { setTab(n.id); setMobileNav(false); }}
              className={`pw-item ${tab === n.id ? "active" : ""}`}
              title={sidebarCollapsed ? n.label : undefined}
            >
              <n.icon size={18} />
              {!sidebarCollapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>}
            </button>
          ))}
        </div>

        {!sidebarCollapsed && (
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <span className="pw-version-pill">v{APP_VERSION}</span>
          </div>
        )}
        <div className="pw-user-card" title={sidebarCollapsed ? `${titleCaseName(user.name)} (${user.role})` : undefined}>
          <div className="pw-avatar-wrap">
            <button className="pw-avatar" onClick={() => setPhotoOpen(true)} title="Update profile photo">
              {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : String(user.name || "P").trim().charAt(0).toUpperCase()}
            </button>
            <span className="pw-status-dot" />
          </div>
          {!sidebarCollapsed && (
            <div className="pw-user-info">
              <div className="pw-name-badge">
                <span className="pw-name">{titleCaseName(user.name)}</span>
                <span className="pw-tag">
                  {user.role === "admin" ? <ShieldCheck size={10} /> : <Eye size={10} />}
                  {String(user.role || "").toUpperCase()}
                </span>
              </div>
              <div className="pw-role" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {user.role === "admin" ? <ShieldCheck size={11} /> : <Eye size={11} />}{user.role} workspace
              </div>
            </div>
          )}
          {!sidebarCollapsed && (
            <button className="pw-action-btn" onClick={signOut} title="Sign out">
              <LogOut size={16} />
            </button>
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="pw-sidebar-footer">
            <div>© {new Date().getFullYear()} ProWater Internal Systems</div>
            <div>Wisdom 2.0</div>
          </div>
        )}
      </div>
      </aside>

      {/* main */}
      <main style={{ minWidth: 0, background: "linear-gradient(135deg, #FBFAF7 0%, #F7F5EF 55%, #F3F0E8 100%)", height: "100vh", position: "relative", overflowY: "auto", zIndex: 50 }}>
        <div className="pw-app-glow green" />
        <div className="pw-app-glow blue" />
        <div className="pw-topbar" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 28px", borderBottom: "1px solid var(--border)", background: "var(--pw-topbar-bg)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20 }}>
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
          {moduleMeta.built && tabIsAdmin && <button onClick={doRefresh} disabled={refreshing} title="Refresh data"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "#fff", color: "var(--teal)", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: refreshing ? .6 : 1 }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "pw-spin .8s linear infinite" : "none" }} /> Refresh
          </button>}
          <div className="pw-session-badge" title="Session duration">
            <div className="pw-session-icon"><Hourglass size={18} /></div>
            <div><small>Session</small><strong>{fmtElapsed(elapsed)}</strong></div>
          </div>
          <div className="pw-avatar-wrap">
            <button className="pw-avatar-btn" onClick={() => setPhotoOpen(true)} title="Update profile photo">
              {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : String(user.name || "P").trim().charAt(0).toUpperCase()}
            </button>
            <span className="pw-camera-dot" onClick={() => setPhotoOpen(true)} title="Update profile photo">
              <Camera size={10} />
            </span>
          </div>
          <button onClick={signOut} className="pw-logout-btn" title="Sign Out">
            <LogOut size={14} /> <span>Logout</span>
          </button>
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
            {tab === "an_overview" && <AnalyticsOverview key={refreshKey} isAdmin={tabIsAdmin} combined={false} />}
            {tab === "an_overview_v2" && <AnalyticsOverview key={refreshKey} isAdmin={tabIsAdmin} combined={true} />}
            {tab === "analytics" && <ReferralAnalyticsTab key={refreshKey} />}
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
            {tab === "about_system_load" && <ApiLoadTracker key={refreshKey} />}
            {tab === "plan_board" && <TaskPlanner key={`board-${refreshKey}`} />}
            {tab === "plan_weekly" && <TaskPlanner key={`weekly-${refreshKey}`} initialView="weekly" />}
            {tab === "plan_admin" && isModuleAdmin && <TaskAdmin key={refreshKey} />}
            {tab === "sales_leads" && <SalesLeads key={refreshKey} isAdmin={tabIsAdmin} />}
            {tab === "sales_apartments" && <ApartmentLeads key={refreshKey} />}
            {tab === "sales_trend" && <SalesTrendAnalysis key={refreshKey} />}
            {tab === "sales_errors" && <SalesErrorCorrection key={refreshKey} isAdmin={tabIsAdmin} />}
            {tab === "emp_users" && <UsersAdmin key={refreshKey} accessLevel={tabAccess} />}
            {tab === "dr_list" && <DeviceReplacement key={refreshKey} />}
            {tab === "vault_creds" && isModuleAdmin && <PasswordVault key={refreshKey} />}
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
              preFilter={t =>
                String(t.issueCategory || "").trim().toLowerCase() !== "complaint" &&
                Boolean(t.technicianVisitDate && String(t.technicianVisitDate).trim() && t.technicianVisitDate !== "—") &&
                Boolean(t.technicianVisitSlot && String(t.technicianVisitSlot).trim() && t.technicianVisitSlot !== "—")
              }
              hideColumns={["customer", "society", "priority", "status"]}
              hidePriorityFilter
              dateFilterField={t => t.created}
              extraColumns={[
                { label: "Technician Visit Date", get: t => t.technicianVisitDate },
                { label: "Technician Visit Slot", get: t => t.technicianVisitSlot },
                { label: "Job Start Time", get: t => fmtIST(t.jobStartTime) },
                { label: "Job End Time", get: t => fmtIST(t.jobEndTime) },
              ]}
              bottomContent={filtered => <SparesTable tickets={filtered} />}
            />}
            {tab === "cust_all" && <AllCustomers key={refreshKey} />}
            {tab === "cust_societies" && <CustomerSocieties key={refreshKey} />}
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

