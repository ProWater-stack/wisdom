/* ============================================================================
   modules/FSM.jsx — FSM (Field Service Management) module.
   Designed in accordance with Apple Human Interface Guidelines (HIG):
   - Ops Command: Kanban Dispatch Board with interactive Job Detail modal
   - Customer Satisfaction: Advanced CSAT/NPS Intelligence, Aspect Ratings,
     interactive sentiment breakdown, Card & Table layouts, & Action Modals
   - Track Technician: Clean live field tracking with map routes, technician
     status, assigned jobs, and direct dispatch actions
   - AMC / Maintenance Schedule: Proactive quarterly service projections
   - Water Quality & Compliance: Device-level input/output TDS monitoring
   ============================================================================ */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AlertCircle, BarChart3, CalendarClock, CheckCircle2, Download, Droplets,
  MapPin, RotateCcw, Search, ShieldCheck, Target, UserRound, Wrench,
  ClipboardList, Truck, XCircle, BellOff, PauseCircle, Ban, MessageSquare, Phone,
  Star, Sparkles, Clock, Check, ChevronRight, X, ExternalLink, ThumbsUp,
  ThumbsDown, MessageCircle, RefreshCw, Eye, LayoutGrid, List, Award,
  Flame, TrendingUp, AlertTriangle, Send, PhoneCall, Filter, ArrowUpRight,
  Navigation, Compass, Route, CheckCircle
} from "lucide-react";
import {
  useAuth, api, customerApi, hashStr, exportToCsv, fmtDate, deviceType, BENGALURU_CENTER,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, Chip, Status,
  Person, DeviceTypeBadge, grid4, btnGhost, td, Modal,
} from "../shared/ui";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ── Apple HIG Glassmorphism and UI Tokens ────────────────────────────────── */
const APPLE_CARD = {
  background: "rgba(255, 255, 255, 0.88)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(0, 0, 0, 0.08)",
  borderRadius: 20,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.03)",
};

const APPLE_SUBTLE_CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(0, 0, 0, 0.06)",
  borderRadius: 14,
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
};

// Shared plain "Export CSV" button style (v2.29.485) — reused by every simple
// Card+Table section across FSM so a export action always looks the same,
// instead of each section re-declaring the same inline style object.
const EXPORT_BTN = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 11,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  background: "#FFFFFF",
  border: "1px solid rgba(0, 0, 0, 0.12)",
  color: "#1D1D1F",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

/* ── Avatar Initial Bubble ────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  { bg: "#EBF5FF", text: "#0066CC" },
  { bg: "#E8F7F0", text: "#08805A" },
  { bg: "#FBF0E0", text: "#986315" },
  { bg: "#F3EEFC", text: "#7C3AED" },
  { bg: "#FCE7F3", text: "#BE185D" },
  { bg: "#E0F2FE", text: "#0369A1" },
];

function AppleAvatar({ name = "", size = 32 }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "•";
  const colorIdx = Math.abs(hashStr(name)) % AVATAR_COLORS.length;
  const col = AVATAR_COLORS[colorIdx];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: col.bg,
        color: col.text,
        fontSize: size * 0.4,
        fontWeight: 700,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      {initials}
    </div>
  );
}

/* ── Apple Segmented Control ──────────────────────────────────────────────── */
function AppleSegmentedControl({ options, value, onChange, style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: 3,
        borderRadius: 12,
        background: "rgba(0, 0, 0, 0.05)",
        border: "1px solid rgba(0, 0, 0, 0.04)",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {options.map((opt) => {
        const id = typeof opt === "string" ? opt : opt.id;
        const label = typeof opt === "string" ? opt : opt.label;
        const count = typeof opt === "object" ? opt.count : undefined;
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "6px 8px",
              borderRadius: 9,
              fontSize: 12,
              fontWeight: active ? 700 : 550,
              cursor: "pointer",
              border: "none",
              background: active ? "#FFFFFF" : "transparent",
              color: active ? "#1D1D1F" : "#6E6E73",
              boxShadow: active ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
              whiteSpace: "nowrap",
            }}
          >
            <span>{label}</span>
            {count !== undefined && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 999,
                  background: active ? "rgba(8, 128, 90, 0.12)" : "rgba(0, 0, 0, 0.06)",
                  color: active ? "#08805A" : "#86868B",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Apple-style Search Bar ───────────────────────────────────────────────── */
function AppleSearchBar({ value, onChange, placeholder = "Search…", style = {} }) {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 360, ...style }}>
      <Search
        size={15}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#86868B",
          pointerEvents: "none",
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 32px 8px 34px",
          borderRadius: 11,
          border: "1px solid rgba(0, 0, 0, 0.1)",
          background: "rgba(0, 0, 0, 0.03)",
          fontSize: 13,
          color: "#1D1D1F",
          outline: "none",
          transition: "all 0.15s ease",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = "#FFFFFF";
          e.currentTarget.style.borderColor = "#08805A";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(8, 128, 90, 0.14)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.background = "rgba(0, 0, 0, 0.03)";
          e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.1)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: "#86868B",
            display: "grid",
            placeItems: "center",
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Apple KPI Card ───────────────────────────────────────────────────────── */
function AppleKpiCard({ label, value, sub, icon: Icon, color = "#08805A", bg = "rgba(8,128,90,0.1)", activeDot = false, badge = null }) {
  return (
    <div
      style={{
        ...APPLE_CARD,
        padding: "18px 20px",
        minHeight: 110,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 34px rgba(0, 0, 0, 0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.03)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#86868B" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {badge && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: badge.bg || "rgba(8, 128, 90, 0.1)",
                color: badge.color || "#08805A",
              }}
            >
              {badge.label}
            </span>
          )}
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 10,
              background: bg,
              color: color,
            }}
          >
            <Icon size={17} />
          </span>
        </div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 2px" }}>
          {activeDot && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
                boxShadow: `0 0 0 3px ${bg}`,
              }}
            />
          )}
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#1D1D1F",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#86868B" }}>{sub}</div>
      </div>
    </div>
  );
}

/* ── Apple-styled Status Pill ─────────────────────────────────────────────── */
function StatusPill({ value, map, emoji }) {
  const conf = map[value] || (Array.isArray(map[value]) ? { color: map[value][0], bg: map[value][1] } : { color: "#6E6E73", bg: "rgba(0,0,0,0.06)" });
  const color = conf.color || (Array.isArray(map[value]) ? map[value][0] : "#6E6E73");
  const bg = conf.bg || (Array.isArray(map[value]) ? map[value][1] : "rgba(0,0,0,0.06)");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 700,
        color,
        background: bg,
        padding: "3px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {emoji ? `${emoji} ` : ""}{value}
    </span>
  );
}

/* ── Star Rating Renderer ─────────────────────────────────────────────────── */
function StarRating({ rating = 5, size = 13, showValue = true }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <div style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            fill={star <= rating ? "#F59E0B" : "rgba(0,0,0,0.08)"}
            color={star <= rating ? "#F59E0B" : "rgba(0,0,0,0.12)"}
          />
        ))}
      </div>
      {showValue && (
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1D1D1F", marginLeft: 3 }}>
          {rating}.0
        </span>
      )}
    </div>
  );
}

/* ===========================================================================
   FSM — OPS COMMAND: Kanban-style Technician Jobs Board
   =========================================================================== */

const JOB_STATUSES = [
  { key: "assigned",      label: "Assigned",          icon: ClipboardList, color: "#0066CC", bg: "rgba(0, 102, 204, 0.05)", border: "rgba(0, 102, 204, 0.2)" },
  { key: "in_transit",    label: "In Transit",        icon: Truck,         color: "#B45309", bg: "rgba(180, 83, 9, 0.05)", border: "rgba(180, 83, 9, 0.2)" },
  { key: "cancelled",     label: "Cancelled",         icon: XCircle,       color: "#DC4141", bg: "rgba(220, 38, 38, 0.05)", border: "rgba(220, 38, 38, 0.2)" },
  { key: "not_ack",       label: "Not Acknowledged",  icon: BellOff,       color: "#6E6E73", bg: "rgba(110, 110, 115, 0.05)", border: "rgba(110, 110, 115, 0.2)" },
  { key: "postponed",     label: "Postponed",         icon: PauseCircle,   color: "#7C3AED", bg: "rgba(124, 58, 237, 0.05)", border: "rgba(124, 58, 237, 0.2)" },
  { key: "not_moving",    label: "Not Moving",        icon: Ban,           color: "#991B1B", bg: "rgba(153, 27, 27, 0.05)", border: "rgba(153, 27, 27, 0.2)" },
];

const CUSTOMER_STATUS_COLORS = {
  Available:   { color: "#08805A", bg: "rgba(8, 128, 90, 0.1)" },
  Unavailable: { color: "#DC4141", bg: "rgba(220, 38, 38, 0.1)" },
  Postponed:   { color: "#986315", bg: "rgba(152, 99, 21, 0.1)" },
};

// `priority`/`repeat`/`spares`/`zone`/`pincode` (v2.29.486) are dummy fields added
// per explicit request to make this board read as ticket-centric (priority, type of
// job, society, spares required, technician assigned) and to support Priority/
// Repeat/Society/Zone/PIN-code filters — neither "zone" nor "PIN code" exist on any
// real ticket/customer/society record yet (confirmed repo-wide), so both are
// placeholders here until the backend feed carries them.
const SAMPLE_TECH_JOBS = [
  { id: "JOB-101", customer: "Abhijit Dey",                    society: "MJR Clique Hydra Apartment",  technician: "Ramesh K", jobType: "Filter Service",         scheduled: "Today, 2:00 PM",         status: "assigned",   customerStatus: "Available",   phone: "+91 98450 11223", email: "abhijit.dey@example.com", priority: "High",   repeat: false, spares: ["Pre-filter"], zone: "South", pincode: "560095" },
  { id: "JOB-102", customer: "Ravi Kumar",                     society: "Prestige Lakeside",            technician: "Suresh M", jobType: "AMC Service",             scheduled: "Today, 4:30 PM",         status: "assigned",   customerStatus: "Postponed",   phone: "+91 98801 44556", email: "ravi.kumar@example.com", priority: "Normal", repeat: false, spares: [], zone: "East", pincode: "560037" },
  { id: "JOB-103", customer: "Sneha Patil",                    society: "Sobha Dream Acres",            technician: "Anil P",   jobType: "Installation",            scheduled: "Tomorrow, 11:00 AM",     status: "assigned",   customerStatus: "Available",   phone: "+91 99002 77889", email: "sneha.patil@example.com", priority: "Normal", repeat: false, spares: ["O-ring"], zone: "East", pincode: "560103" },
  { id: "JOB-104", customer: "Deepa Nair",                     society: "Ashish JK",                    technician: "Vijay R",  jobType: "Repair Visit",            scheduled: "Today, 1:15 PM",         status: "in_transit", customerStatus: "Available",   phone: "+91 97403 99001", email: "deepa.nair@example.com", priority: "High",   repeat: true,  spares: ["RO Membrane"], zone: "North", pincode: "560022" },
  { id: "JOB-105", customer: "Anand Ray",                      society: "CBR Aakruti",                  technician: "Manoj S",  jobType: "Complaint Resolution",    scheduled: "Today, 3:00 PM",         status: "in_transit", customerStatus: "Unavailable", phone: "+91 96112 33445", email: "anand.ray@example.com", priority: "Urgent", repeat: true,  spares: ["Solenoid Valve", "Pre-filter"], zone: "South", pincode: "560078" },
  { id: "JOB-106", customer: "Arun K Sinha",                   society: "MJR Clique Hydra Apartment",   technician: "Ramesh K", jobType: "Filter Service",          scheduled: "Yesterday, 5:00 PM",     status: "cancelled",  customerStatus: "Unavailable", phone: "+91 94480 55667", email: "arun.sinha@example.com", priority: "Normal", repeat: false, spares: [], zone: "South", pincode: "560095" },
  { id: "JOB-107", customer: "Asha Anandan",                   society: "SVS Ananda Nilayam",           technician: "Deepak T", jobType: "AMC Service",             scheduled: "Yesterday, 10:00 AM",    status: "cancelled",  customerStatus: "Postponed",   phone: "+91 93420 88990", email: "asha.anandan@example.com", priority: "Normal", repeat: false, spares: [], zone: "West", pincode: "560040" },
  { id: "JOB-108", customer: "Bikram",                         society: "MJR Clique Hydra Apartment",   technician: "Suresh M", jobType: "Installation",            scheduled: "Today, 6:00 PM",         status: "not_ack",    customerStatus: "Available",   phone: "+91 98451 22334", email: "bikram@example.com", priority: "High",   repeat: false, spares: ["Faucet"], zone: "South", pincode: "560095" },
  { id: "JOB-109", customer: "Bibhuranjan Mohapatra",          society: "Prabhavathi Meghana Towers",   technician: "Prakash N", jobType: "Filter Service",         scheduled: "Tomorrow, 9:30 AM",      status: "not_ack",    customerStatus: "Unavailable", phone: "+91 98802 66778", email: "bibhuranjan@example.com", priority: "Normal", repeat: true,  spares: [], zone: "East", pincode: "560066" },
  { id: "JOB-110", customer: "Binay Pradhan",                  society: "Ashish JK",                    technician: "Anil P",   jobType: "Repair Visit",            scheduled: "Rescheduled → Fri, 12:00 PM", status: "postponed", customerStatus: "Postponed", phone: "+91 99003 11224", email: "binay.pradhan@example.com", priority: "Normal", repeat: false, spares: ["O-ring"], zone: "North", pincode: "560022" },
  { id: "JOB-111", customer: "Chaudari Vipool",                society: "Sai Poorna Premier",           technician: "Vijay R",  jobType: "AMC Service",             scheduled: "Rescheduled → Sat, 2:00 PM",  status: "postponed", customerStatus: "Postponed", phone: "+91 97404 55668", email: "chaudari.vipool@example.com", priority: "Normal", repeat: false, spares: [], zone: "Central", pincode: "560001" },
  { id: "JOB-112", customer: "Dhananjaya Samanta Singhar",     society: "The Green Terraces",           technician: "Manoj S",  jobType: "Complaint Resolution",    scheduled: "Today, 11:00 AM",        status: "not_moving", customerStatus: "Available",   phone: "+91 96113 77880", email: "dhananjaya@example.com", priority: "Urgent", repeat: true,  spares: ["Pump", "Carbon Filter"], zone: "West", pincode: "560010" },
  { id: "JOB-113", customer: "Divya Vijayaraghavan",           society: "CBR Aakruti",                  technician: "Deepak T", jobType: "Filter Service",          scheduled: "Today, 9:00 AM",         status: "not_moving", customerStatus: "Unavailable", phone: "+91 94481 99002", email: "divya.v@example.com", priority: "High",   repeat: false, spares: ["Membrane"], zone: "South", pincode: "560078" },
];

const JOB_PRIORITY_COLORS = {
  Urgent: { color: "#991B1B", bg: "rgba(153, 27, 27, 0.1)" },
  High:   { color: "#DC4141", bg: "rgba(220, 38, 38, 0.1)" },
  Normal: { color: "#0066CC", bg: "rgba(0, 102, 204, 0.1)" },
};

// Weekly ticket-volume + active-technician timeseries for Command Center's trend
// chart — dummy data (8 weeks), same Bar+Line trend-overlay pattern already used
// elsewhere in this app (Ticketing.jsx's "Daily Tickets Created", Sales.jsx's
// monthly trend chart) rather than a new chart style.
const WEEKLY_OPS_TREND = [
  { week: "Wk 1 (Jul 28)", tickets: 42, activeTechs: 8 },
  { week: "Wk 2 (Aug 4)",  tickets: 48, activeTechs: 8 },
  { week: "Wk 3 (Aug 11)", tickets: 51, activeTechs: 9 },
  { week: "Wk 4 (Aug 18)", tickets: 46, activeTechs: 9 },
  { week: "Wk 5 (Aug 25)", tickets: 57, activeTechs: 10 },
  { week: "Wk 6 (Sep 1)",  tickets: 61, activeTechs: 10 },
  { week: "Wk 7 (Sep 8)",  tickets: 55, activeTechs: 9 },
  { week: "Wk 8 (Sep 15)", tickets: 63, activeTechs: 10 },
];

export function OpsCommand() {
  const { user } = useAuth();
  const [custStatusFilter, setCustStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [societyFilter, setSocietyFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [pincodeFilter, setPincodeFilter] = useState("all");
  const [jobQ, setJobQ] = useState("");
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    api.logView(user.username, "Viewed Command Center");
  }, [user]);

  const jobQl = jobQ.toLowerCase();
  const jobsFiltered = useMemo(() => {
    return SAMPLE_TECH_JOBS.filter((j) =>
      (custStatusFilter === "all" || j.customerStatus === custStatusFilter) &&
      (priorityFilter === "all" || (priorityFilter === "high" ? j.priority === "High" || j.priority === "Urgent" : j.repeat)) &&
      (societyFilter === "all" || j.society === societyFilter) &&
      (zoneFilter === "all" || j.zone === zoneFilter) &&
      (pincodeFilter === "all" || j.pincode === pincodeFilter) &&
      (!jobQl || `${j.customer} ${j.technician} ${j.society} ${j.jobType} ${j.id}`.toLowerCase().includes(jobQl))
    );
  }, [custStatusFilter, priorityFilter, societyFilter, zoneFilter, pincodeFilter, jobQl]);

  const custStatusCounts = useMemo(() => ({
    Available: SAMPLE_TECH_JOBS.filter((j) => j.customerStatus === "Available").length,
    Unavailable: SAMPLE_TECH_JOBS.filter((j) => j.customerStatus === "Unavailable").length,
    Postponed: SAMPLE_TECH_JOBS.filter((j) => j.customerStatus === "Postponed").length,
  }), []);

  const priorityCounts = useMemo(() => ({
    high: SAMPLE_TECH_JOBS.filter((j) => j.priority === "High" || j.priority === "Urgent").length,
    repeat: SAMPLE_TECH_JOBS.filter((j) => j.repeat).length,
  }), []);

  // Top-of-funnel ticket-status KPIs, per explicit request (Total Tickets/Assigned/
  // In Progress/Postponed/Cancelled/Unplanned-New — mapped from this board's own 6
  // job statuses; `not_ack` and `not_moving` both fold into "Unplanned / New" since
  // both represent a job that hasn't been properly actioned yet).
  const ticketStatusCounts = useMemo(() => {
    const c = { assigned: 0, in_transit: 0, postponed: 0, cancelled: 0, unplanned: 0 };
    SAMPLE_TECH_JOBS.forEach((j) => {
      if (j.status === "assigned") c.assigned++;
      else if (j.status === "in_transit") c.in_transit++;
      else if (j.status === "postponed") c.postponed++;
      else if (j.status === "cancelled") c.cancelled++;
      else if (j.status === "not_ack" || j.status === "not_moving") c.unplanned++;
    });
    return c;
  }, []);

  const societies = useMemo(() => Array.from(new Set(SAMPLE_TECH_JOBS.map((j) => j.society))).sort(), []);
  const zones = useMemo(() => Array.from(new Set(SAMPLE_TECH_JOBS.map((j) => j.zone))).sort(), []);
  const pincodes = useMemo(() => Array.from(new Set(SAMPLE_TECH_JOBS.map((j) => j.pincode))).sort(), []);

  const exportJobsCsv = () => exportToCsv("prowater-ops-technician-jobs.csv", [
    { label: "Job ID", get: (j) => j.id },
    { label: "Customer", get: (j) => j.customer },
    { label: "Phone", get: (j) => j.phone || "" },
    { label: "Society", get: (j) => j.society },
    { label: "Zone", get: (j) => j.zone },
    { label: "PIN Code", get: (j) => j.pincode },
    { label: "Technician", get: (j) => j.technician },
    { label: "Job Type", get: (j) => j.jobType },
    { label: "Priority", get: (j) => j.priority },
    { label: "Repeat", get: (j) => (j.repeat ? "Yes" : "No") },
    { label: "Spares Required", get: (j) => (j.spares || []).join(", ") },
    { label: "Scheduled", get: (j) => j.scheduled },
    { label: "Job Status", get: (j) => JOB_STATUSES.find((s) => s.key === j.status)?.label || j.status },
    { label: "Customer Status", get: (j) => j.customerStatus },
  ], jobsFiltered);

  const filterOptions = [
    { id: "all", label: "All Jobs", count: SAMPLE_TECH_JOBS.length },
    { id: "Available", label: "Available", count: custStatusCounts.Available },
    { id: "Unavailable", label: "Unavailable", count: custStatusCounts.Unavailable },
    { id: "Postponed", label: "Postponed", count: custStatusCounts.Postponed },
  ];

  const priorityFilterOptions = [
    { id: "all", label: "All Priority", count: SAMPLE_TECH_JOBS.length },
    { id: "high", label: "High Priority", count: priorityCounts.high },
    { id: "repeat", label: "Repeat", count: priorityCounts.repeat },
  ];

  const selectStyle = {
    padding: "7px 10px",
    borderRadius: 11,
    border: "1px solid rgba(0, 0, 0, 0.1)",
    background: "#FFFFFF",
    fontSize: 12.5,
    color: "#1D1D1F",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        .ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;letter-spacing:-.02em}
        .apple-kanban-card {
          transition: transform 0.16s cubic-bezier(0.16,1,0.3,1), box-shadow 0.16s ease, border-color 0.16s ease;
        }
        .apple-kanban-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(0,0,0,0.07);
          border-color: rgba(8, 128, 90, 0.3) !important;
        }
      `}</style>

      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 18px",
          borderRadius: 16,
          background: "rgba(8, 128, 90, 0.06)",
          border: "1px solid rgba(8, 128, 90, 0.15)",
          fontSize: 13,
          color: "#08805A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} />
          <span>
            <strong>Command Center:</strong> Top-of-funnel view of every dispatched job/ticket — the ticket is the source of truth; Technician, Customer, Device and Society drill-down views are a planned next step, not built here yet.
          </span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>Sample Dispatch Feed</span>
      </div>

      {/* KPI Cards — top-of-funnel ticket status, per explicit request */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <AppleKpiCard
          label="Total Tickets (Today)"
          value={SAMPLE_TECH_JOBS.length}
          sub="All dispatched jobs"
          icon={ClipboardList}
          color="#0066CC"
          bg="rgba(0, 102, 204, 0.1)"
        />
        <AppleKpiCard
          label="Assigned"
          value={ticketStatusCounts.assigned}
          sub="Awaiting departure"
          icon={UserRound}
          color="#0066CC"
          bg="rgba(0, 102, 204, 0.1)"
        />
        <AppleKpiCard
          label="In Progress"
          value={ticketStatusCounts.in_transit}
          sub="Technician travelling/on site"
          icon={Truck}
          color="#B45309"
          bg="rgba(180, 83, 9, 0.1)"
          activeDot
        />
        <AppleKpiCard
          label="Postponed"
          value={ticketStatusCounts.postponed}
          sub="Rescheduled"
          icon={PauseCircle}
          color="#7C3AED"
          bg="rgba(124, 58, 237, 0.1)"
        />
        <AppleKpiCard
          label="Cancelled"
          value={ticketStatusCounts.cancelled}
          sub="Closed without service"
          icon={XCircle}
          color="#DC4141"
          bg="rgba(220, 38, 38, 0.1)"
        />
        <AppleKpiCard
          label="Unplanned / New"
          value={ticketStatusCounts.unplanned}
          sub="Not yet acknowledged or moving"
          icon={AlertCircle}
          color="#991B1B"
          bg="rgba(153, 27, 27, 0.1)"
          activeDot={ticketStatusCounts.unplanned > 0}
        />
      </div>

      {/* Main Kanban Board Container */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1 }}>
            <AppleSearchBar value={jobQ} onChange={setJobQ} placeholder="Search customer, technician, society, job…" />
            <div style={{ minWidth: 320 }}>
              <AppleSegmentedControl options={filterOptions} value={custStatusFilter} onChange={setCustStatusFilter} />
            </div>
          </div>
          <button
            type="button"
            onClick={exportJobsCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 11,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: "#FFFFFF",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              color: "#1D1D1F",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Priority/Repeat + Society/Zone/PIN filter row, per explicit request */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ minWidth: 260 }}>
            <AppleSegmentedControl options={priorityFilterOptions} value={priorityFilter} onChange={setPriorityFilter} />
          </div>
          <select style={selectStyle} value={societyFilter} onChange={(e) => setSocietyFilter(e.target.value)}>
            <option value="all">All Societies</option>
            {societies.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={selectStyle} value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="all">All Zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select style={selectStyle} value={pincodeFilter} onChange={(e) => setPincodeFilter(e.target.value)}>
            <option value="all">All PIN Codes</option>
            {pincodes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Horizontal Kanban Columns */}
        <div
          style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 12,
            scrollbarWidth: "thin",
          }}
        >
          {JOB_STATUSES.map((col) => {
            const colJobs = jobsFiltered.filter((j) => j.status === col.key);
            const Icon = col.icon;
            return (
              <div
                key={col.key}
                style={{
                  flex: "0 0 280px",
                  width: 280,
                  background: col.bg,
                  border: `1px solid ${col.border}`,
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: 680,
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: `1px solid ${col.border}`,
                  }}
                >
                  <Icon size={16} color={col.color} />
                  <strong style={{ fontSize: 13.5, color: col.color, fontWeight: 700 }}>
                    {col.label}
                  </strong>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      fontWeight: 800,
                      color: col.color,
                      background: "#FFFFFF",
                      padding: "2px 8px",
                      borderRadius: 999,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    {colJobs.length}
                  </span>
                </div>

                <div
                  style={{
                    overflowY: "auto",
                    flex: 1,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {colJobs.map((j) => (
                    <div
                      key={j.id}
                      className="apple-kanban-card"
                      onClick={() => setActiveJob(j)}
                      style={{
                        ...APPLE_SUBTLE_CARD,
                        padding: "14px 15px",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 750, color: "#86868B", letterSpacing: ".02em" }}>
                          {j.id}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {j.repeat && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: "rgba(124, 58, 237, 0.1)", color: "#7C3AED" }}>
                              REPEAT
                            </span>
                          )}
                          <StatusPill value={j.priority} map={JOB_PRIORITY_COLORS} />
                          <StatusPill value={j.customerStatus} map={CUSTOMER_STATUS_COLORS} />
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <AppleAvatar name={j.customer} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              fontSize: 13.5,
                              color: "#1D1D1F",
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {j.customer}
                          </strong>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          color: "#6E6E73",
                          marginBottom: 8,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <MapPin size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{j.society}</span>
                      </div>

                      <div
                        style={{
                          background: "rgba(0, 0, 0, 0.025)",
                          borderRadius: 10,
                          padding: "8px 10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          fontSize: 11.5,
                          color: "#48484A",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#6E6E73" }}>
                            <UserRound size={12} /> Tech:
                          </span>
                          <strong style={{ color: "#1D1D1F" }}>{j.technician}</strong>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#6E6E73" }}>
                            <CalendarClock size={12} /> Slot:
                          </span>
                          <span>{j.scheduled}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#6E6E73" }}>
                            <Wrench size={12} /> Spares:
                          </span>
                          <span style={{ textAlign: "right" }}>{j.spares?.length ? j.spares.join(", ") : "None required"}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: "rgba(0, 0, 0, 0.04)",
                            color: "#6E6E73",
                          }}
                        >
                          {j.jobType}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#08805A", display: "inline-flex", alignItems: "center", gap: 2 }}>
                          Details <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  ))}

                  {colJobs.length === 0 && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#86868B",
                        textAlign: "center",
                        padding: "36px 12px",
                        background: "rgba(255, 255, 255, 0.4)",
                        borderRadius: 12,
                        border: "1px dashed rgba(0, 0, 0, 0.08)",
                      }}
                    >
                      No jobs in this queue
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Trend Analytics — dummy timeseries, per explicit request */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "#1D1D1F" }}>Weekly Ticket & Technician Trend</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#86868B" }}>Ticket volume vs. active technicians, last 8 weeks</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={WEEKLY_OPS_TREND} margin={{ left: -10, right: 14, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: "#86868B", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: "#86868B", fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#86868B", fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(8,128,90,0.06)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#1D1D1F" }} />
            <Bar yAxisId="left" dataKey="tickets" name="Tickets" fill="#08805A" radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="activeTechs" name="Active Technicians" stroke="#0066CC" strokeWidth={3} dot={{ r: 3.5, fill: "#fff", stroke: "#0066CC", strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Job Details Modal */}
      {activeJob && (
        <Modal
          title={`Job Dispatch · ${activeJob.id}`}
          subtitle={`${activeJob.jobType} for ${activeJob.customer}`}
          onClose={() => setActiveJob(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14, background: "rgba(8, 128, 90, 0.06)" }}>
              <AppleAvatar name={activeJob.customer} size={44} />
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1D1D1F" }}>{activeJob.customer}</h4>
                <div style={{ fontSize: 12.5, color: "#6E6E73", marginTop: 2 }}>{activeJob.society}</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <StatusPill value={activeJob.customerStatus} map={CUSTOMER_STATUS_COLORS} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ ...APPLE_SUBTLE_CARD, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#86868B", fontWeight: 700, textTransform: "uppercase" }}>Assigned Technician</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F", marginTop: 4 }}>{activeJob.technician}</div>
                <div style={{ fontSize: 12, color: "#08805A", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Phone size={12} /> Contactable via phone
                </div>
              </div>
              <div style={{ ...APPLE_SUBTLE_CARD, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#86868B", fontWeight: 700, textTransform: "uppercase" }}>Scheduled Time Slot</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F", marginTop: 4 }}>{activeJob.scheduled}</div>
                <div style={{ fontSize: 12, color: "#6E6E73", marginTop: 2 }}>Estimated duration: 45 min</div>
              </div>
            </div>

            <div style={{ ...APPLE_SUBTLE_CARD, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#86868B", fontWeight: 700, textTransform: "uppercase" }}>Current Job Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1D1D1F" }}>
                  {JOB_STATUSES.find((s) => s.key === activeJob.status)?.label || activeJob.status}
                </span>
                <span style={{ fontSize: 12, color: "#86868B" }}>· Dispatched via Bengaluru Central Hub</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setActiveJob(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#08805A",
                  color: "#FFFFFF",
                  border: "none",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ===========================================================================
   FSM: Customer Satisfaction (Advanced CSAT / NPS Intelligence Hub)
   =========================================================================== */

const SENTIMENT_COLORS = {
  "Good":               { color: "#08805A", bg: "rgba(8, 128, 90, 0.1)", border: "rgba(8, 128, 90, 0.2)" },
  "Neutral":            { color: "#6E6E73", bg: "rgba(110, 110, 115, 0.1)", border: "rgba(110, 110, 115, 0.2)" },
  "Bad":                { color: "#986315", bg: "rgba(152, 99, 21, 0.1)", border: "rgba(152, 99, 21, 0.2)" },
  "Negative":           { color: "#DC4141", bg: "rgba(220, 38, 38, 0.1)", border: "rgba(220, 38, 38, 0.2)" },
  "Extremely Negative": { color: "#FFFFFF", bg: "#B91C1C", border: "#991B1B" },
};

const SENTIMENT_EMOJI = {
  "Good": "😊", "Bad": "🙁", "Neutral": "😐", "Negative": "😠", "Extremely Negative": "😡",
};

const RATING_COLORS = {
  "Positive":     { color: "#08805A", bg: "rgba(8, 128, 90, 0.1)", stars: 5 },
  "Appreciative": { color: "#0066CC", bg: "rgba(0, 102, 204, 0.1)", stars: 5 },
  "Neutral":      { color: "#6E6E73", bg: "rgba(110, 110, 115, 0.1)", stars: 3 },
  "Negative":     { color: "#986315", bg: "rgba(152, 99, 21, 0.1)", stars: 2 },
  "Critical":     { color: "#DC4141", bg: "rgba(220, 38, 38, 0.1)", stars: 1 },
};

const SAMPLE_SENTIMENT = [
  {
    id: "SAT-01",
    customer: "Abhijit Dey",
    society: "MJR Clique Hydra Apartment",
    purifierId: "HAC1F9F778",
    technician: "Ramesh K",
    jobType: "Filter Replacement & TDS Tune",
    sentiment: "Good",
    confidence: 98,
    date: "2026-09-10",
    tags: ["Water Taste", "Polite Tech", "On Time"],
    note: "Happy with the new mineral filter. Water tastes noticeably sweet and clean, TDS calibrated down to 42 ppm perfectly.",
    tdsIn: 440,
    tdsOut: 42,
    status: "Resolved",
  },
  {
    id: "SAT-02",
    customer: "Ravi Kumar",
    society: "Prestige Lakeside",
    purifierId: "PW-00092",
    technician: "Suresh M",
    jobType: "Quarterly AMC Check",
    sentiment: "Neutral",
    confidence: 84,
    date: "2026-09-09",
    tags: ["Routine Check", "Average Visit"],
    note: "No major issues, technician replaced pre-filter and completed test within 25 minutes. Standard service.",
    tdsIn: 380,
    tdsOut: 55,
    status: "Resolved",
  },
  {
    id: "SAT-03",
    customer: "Sneha Patil",
    society: "Sobha Dream Acres",
    purifierId: "PW-00101",
    technician: "Anil P",
    jobType: "Emergency Repair Visit",
    sentiment: "Bad",
    confidence: 89,
    date: "2026-09-08",
    tags: ["Late Arrival", "Communication Gap"],
    note: "Technician was delayed by 2 hours without prior SMS or phone update. Service work was fine but schedule got disrupted.",
    tdsIn: 510,
    tdsOut: 60,
    status: "Follow-up Scheduled",
  },
  {
    id: "SAT-04",
    customer: "Deepa Nair",
    society: "Ashish JK",
    purifierId: "ZB-77",
    technician: "Vijay R",
    jobType: "Membrane Pressure Calibration",
    sentiment: "Negative",
    confidence: 94,
    date: "2026-09-07",
    tags: ["Low Pressure", "Recurring Complaint"],
    note: "Second complaint this month. Input pressure fluctuates and tank fills slowly. Need supervisor inspection.",
    tdsIn: 490,
    tdsOut: 75,
    status: "Supervisor Assigned",
  },
  {
    id: "SAT-05",
    customer: "Anand Ray",
    society: "CBR Aakruti",
    purifierId: "PRSC1FE2C3",
    technician: "Manoj S",
    jobType: "Service Escalation",
    sentiment: "Extremely Negative",
    confidence: 99,
    date: "2026-09-05",
    tags: ["Churn Risk", "Missed Visit", "Urgent"],
    note: "Threatening to cancel subscription due to two missed appointment slots last week. Demanded manager call.",
    tdsIn: 560,
    tdsOut: 110,
    status: "Manager Action Required",
  },
  {
    id: "SAT-06",
    customer: "Arun K Sinha",
    society: "MJR Clique Hydra Apartment",
    purifierId: "PRSM95B3A9",
    technician: "Ramesh K",
    jobType: "TDS Calibration & Health Check",
    sentiment: "Good",
    confidence: 96,
    date: "2026-09-11",
    tags: ["Quick Response", "Clear Report"],
    note: "Appreciated the prompt same-day response and the live digital TDS certificate shown on the technician app.",
    tdsIn: 410,
    tdsOut: 38,
    status: "Resolved",
  },
  {
    id: "SAT-07",
    customer: "Asha Anandan",
    society: "SVS Ananda Nilayam",
    purifierId: "PRSMFB3B8D",
    technician: "Deepak T",
    jobType: "Quarterly AMC Check",
    sentiment: "Neutral",
    confidence: 82,
    date: "2026-09-06",
    tags: ["Standard AMC", "Smooth Process"],
    note: "Routine visit completed smoothly without any hitches. Purifier working normally.",
    tdsIn: 395,
    tdsOut: 48,
    status: "Resolved",
  },
  {
    id: "SAT-08",
    customer: "Bikram",
    society: "MJR Clique Hydra Apartment",
    purifierId: "OWND000003",
    technician: "Suresh M",
    jobType: "Flow Rate Adjustment",
    sentiment: "Bad",
    confidence: 87,
    date: "2026-09-04",
    tags: ["Low Flow", "Flow Restrictor"],
    note: "Water dispensing flow rate is still slightly low after technician visit. Might require booster pump check.",
    tdsIn: 460,
    tdsOut: 62,
    status: "Follow-up Scheduled",
  },
  {
    id: "SAT-09",
    customer: "Bibhuranjan Mohapatra",
    society: "Prabhavathi Meghana Towers",
    purifierId: "OWND000006",
    technician: "Prakash N",
    jobType: "Installation & Onboarding",
    sentiment: "Negative",
    confidence: 92,
    date: "2026-09-03",
    tags: ["Missed Slot", "Support Escalation"],
    note: "Missed the scheduled Saturday morning slot without advance notice. Rescheduled for Monday.",
    tdsIn: 520,
    tdsOut: 70,
    status: "Resolved",
  },
  {
    id: "SAT-10",
    customer: "Chaudari Vipool",
    society: "Sai Poorna Premier",
    purifierId: "HAM77E663C",
    technician: "Vijay R",
    jobType: "New Subscription Setup",
    sentiment: "Good",
    confidence: 97,
    date: "2026-09-12",
    tags: ["Neat Setup", "Great Experience", "Promoter"],
    note: "Very satisfied with the clean under-sink installation and comprehensive demo of the ProWater app features.",
    tdsIn: 430,
    tdsOut: 36,
    status: "Resolved",
  },
  {
    id: "SAT-11",
    customer: "Divya Vijayaraghavan",
    society: "CBR Aakruti",
    purifierId: "PRSM22A901",
    technician: "Deepak T",
    jobType: "Alkaline Post-Filter Upgrade",
    sentiment: "Good",
    confidence: 95,
    date: "2026-09-13",
    tags: ["Alkaline Water", "Polite Tech"],
    note: "The technician explained how the alkaline mineralization works. Water has great mouthfeel and taste.",
    tdsIn: 415,
    tdsOut: 45,
    status: "Resolved",
  },
  {
    id: "SAT-12",
    customer: "Binay Pradhan",
    society: "Ashish JK",
    purifierId: "HAC88F1122",
    technician: "Anil P",
    jobType: "Leakage Inspection",
    sentiment: "Neutral",
    confidence: 86,
    date: "2026-09-14",
    tags: ["Teflon Tape Fixed", "No Leak"],
    note: "Minor elbow valve drip fixed quickly with replacement connector. Checked under cabinet dry.",
    tdsIn: 470,
    tdsOut: 52,
    status: "Resolved",
  }
];

const SAMPLE_RATINGS = [
  {
    id: "RAT-01",
    customer: "Abhijit Dey",
    society: "MJR Clique Hydra Apartment",
    rating: "Positive",
    stars: 5,
    date: "2026-09-10",
    technician: "Ramesh K",
    category: "Filter Service",
    comment: "5-star service! Ramesh arrived on time, was extremely polite, and calibrated the TDS down to 42 ppm.",
    aspects: { taste: 5, punctuality: 5, behavior: 5, speed: 5 },
  },
  {
    id: "RAT-02",
    customer: "Chaudari Vipool",
    society: "Sai Poorna Premier",
    rating: "Positive",
    stars: 5,
    date: "2026-09-12",
    technician: "Vijay R",
    category: "Installation",
    comment: "Extremely happy with the neat plumbing and clear explanation of filter life cycles. 5/5 score.",
    aspects: { taste: 5, punctuality: 5, behavior: 5, speed: 5 },
  },
  {
    id: "RAT-03",
    customer: "Arun K Sinha",
    society: "MJR Clique Hydra Apartment",
    rating: "Appreciative",
    stars: 5,
    date: "2026-09-11",
    technician: "Ramesh K",
    category: "TDS Health Check",
    comment: "Posted an appreciative review on our society community group. Outstanding support turnaround.",
    aspects: { taste: 5, punctuality: 4, behavior: 5, speed: 5 },
  },
  {
    id: "RAT-04",
    customer: "Divya Vijayaraghavan",
    society: "CBR Aakruti",
    rating: "Positive",
    stars: 5,
    date: "2026-09-13",
    technician: "Deepak T",
    category: "Filter Upgrade",
    comment: "Alkaline mineral cartridge was installed in 15 mins. Friendly technician and excellent water quality.",
    aspects: { taste: 5, punctuality: 5, behavior: 5, speed: 4 },
  },
  {
    id: "RAT-05",
    customer: "Ravi Kumar",
    society: "Prestige Lakeside",
    rating: "Appreciative",
    stars: 4,
    date: "2026-09-09",
    technician: "Suresh M",
    category: "AMC Service",
    comment: "Thanked the technician personally for finishing before our evening guests arrived. Solid work.",
    aspects: { taste: 4, punctuality: 4, behavior: 5, speed: 4 },
  },
  {
    id: "RAT-06",
    customer: "Asha Anandan",
    society: "SVS Ananda Nilayam",
    rating: "Positive",
    stars: 4,
    date: "2026-09-06",
    technician: "Deepak T",
    category: "AMC Service",
    comment: "Smooth, professional quarterly visit. Quick filter replacement without any mess.",
    aspects: { taste: 4, punctuality: 4, behavior: 5, speed: 4 },
  },
  {
    id: "RAT-07",
    customer: "Binay Pradhan",
    society: "Ashish JK",
    rating: "Neutral",
    stars: 3,
    date: "2026-09-14",
    technician: "Anil P",
    category: "Repair Visit",
    comment: "Leak was resolved promptly, but had to call support twice to get the ticket acknowledged.",
    aspects: { taste: 4, punctuality: 3, behavior: 4, speed: 3 },
  },
  {
    id: "RAT-08",
    customer: "Sneha Patil",
    society: "Sobha Dream Acres",
    rating: "Negative",
    stars: 2,
    date: "2026-09-08",
    technician: "Anil P",
    category: "Emergency Repair",
    comment: "Delayed arrival affected our afternoon schedule. Technician apologized, but communication needs improvement.",
    aspects: { taste: 4, punctuality: 1, behavior: 3, speed: 3 },
  },
  {
    id: "RAT-09",
    customer: "Deepa Nair",
    society: "Ashish JK",
    rating: "Negative",
    stars: 2,
    date: "2026-09-07",
    technician: "Vijay R",
    category: "Membrane Service",
    comment: "Unhappy with repeated maintenance visits in a short span. Pressure regulator should have been fixed on visit 1.",
    aspects: { taste: 3, punctuality: 3, behavior: 4, speed: 2 },
  },
  {
    id: "RAT-10",
    customer: "Bibhuranjan Mohapatra",
    society: "Prabhavathi Meghana Towers",
    rating: "Negative",
    stars: 2,
    date: "2026-09-03",
    technician: "Prakash N",
    category: "Installation",
    comment: "Frustrated with missed technician slot on the weekend. Monday setup was okay though.",
    aspects: { taste: 4, punctuality: 1, behavior: 3, speed: 3 },
  },
  {
    id: "RAT-11",
    customer: "Bikram",
    society: "MJR Clique Hydra Apartment",
    rating: "Critical",
    stars: 1,
    date: "2026-09-04",
    technician: "Suresh M",
    category: "Flow Calibration",
    comment: "Filed a formal complaint regarding delayed filter replacement and low output flow rate.",
    aspects: { taste: 2, punctuality: 2, behavior: 3, speed: 1 },
  },
  {
    id: "RAT-12",
    customer: "Anand Ray",
    society: "CBR Aakruti",
    rating: "Critical",
    stars: 1,
    date: "2026-09-05",
    technician: "Manoj S",
    category: "Complaint Escalation",
    comment: "Escalated to management. Requested account manager callback to discuss subscription cancellation.",
    aspects: { taste: 2, punctuality: 1, behavior: 2, speed: 1 },
  },
];

export function CustomerSatisfaction() {
  const { user } = useAuth();
  const [sentQ, setSentQ] = useState("");
  const [sentFilter, setSentFilter] = useState("all");
  const [ratingQ, setRatingQ] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Customer Satisfaction");
  }, [user]);

  const sentimentCounts = useMemo(() => {
    const counts = { Good: 0, Neutral: 0, Bad: 0, Negative: 0, "Extremely Negative": 0 };
    SAMPLE_SENTIMENT.forEach((s) => {
      if (counts[s.sentiment] !== undefined) counts[s.sentiment]++;
    });
    return counts;
  }, []);
  const totalSentiments = SAMPLE_SENTIMENT.length;
  const positiveSentimentPct = Math.round((sentimentCounts.Good / totalSentiments) * 100);
  const criticalCount = sentimentCounts.Negative + sentimentCounts["Extremely Negative"];

  const totalRatings = SAMPLE_RATINGS.length;
  const avgStars = (SAMPLE_RATINGS.reduce((acc, r) => acc + r.stars, 0) / totalRatings).toFixed(1);

  const sentQl = sentQ.toLowerCase();
  const sentimentShown = useMemo(() => SAMPLE_SENTIMENT.filter((r) =>
    (sentFilter === "all" || r.sentiment === sentFilter) &&
    (!sentQl || `${r.customer} ${r.society} ${r.purifierId} ${r.note} ${r.technician}`.toLowerCase().includes(sentQl))
  ), [sentFilter, sentQl]);

  const ratingQl = ratingQ.toLowerCase();
  const ratingsShown = useMemo(() => SAMPLE_RATINGS.filter((r) =>
    (ratingFilter === "all" || r.rating === ratingFilter) &&
    (!ratingQl || `${r.customer} ${r.society} ${r.comment} ${r.technician} ${r.category}`.toLowerCase().includes(ratingQl))
  ), [ratingFilter, ratingQl]);

  const sentimentFilterOptions = [
    { id: "all", label: "All", count: SAMPLE_SENTIMENT.length },
    { id: "Good", label: "😊 Good", count: sentimentCounts.Good },
    { id: "Neutral", label: "😐 Neutral", count: sentimentCounts.Neutral },
    { id: "Bad", label: "🙁 Bad", count: sentimentCounts.Bad },
    { id: "Negative", label: "😠 Negative", count: sentimentCounts.Negative },
    { id: "Extremely Negative", label: "😡 Critical", count: sentimentCounts["Extremely Negative"] },
  ];
  const ratingFilterOptions = [
    { id: "all", label: "All", count: SAMPLE_RATINGS.length },
    { id: "Positive", label: "Positive", count: SAMPLE_RATINGS.filter((r) => r.rating === "Positive").length },
    { id: "Appreciative", label: "Appreciative", count: SAMPLE_RATINGS.filter((r) => r.rating === "Appreciative").length },
    { id: "Negative", label: "Negative", count: SAMPLE_RATINGS.filter((r) => r.rating === "Negative").length },
    { id: "Critical", label: "Critical", count: SAMPLE_RATINGS.filter((r) => r.rating === "Critical").length },
  ];

  const exportSentimentCsv = () => exportToCsv("prowater-customer-sentiment.csv", [
    { label: "Customer", get: (r) => r.customer },
    { label: "Society", get: (r) => r.society },
    { label: "Purifier ID", get: (r) => r.purifierId },
    { label: "Technician", get: (r) => r.technician },
    { label: "Sentiment", get: (r) => r.sentiment },
    { label: "Date", get: (r) => r.date },
    { label: "Feedback Note", get: (r) => r.note },
  ], sentimentShown);

  const exportRatingCsv = () => exportToCsv("prowater-customer-ratings.csv", [
    { label: "Customer", get: (r) => r.customer },
    { label: "Society", get: (r) => r.society },
    { label: "Technician", get: (r) => r.technician },
    { label: "Service Category", get: (r) => r.category },
    { label: "Stars", get: (r) => r.stars },
    { label: "Rating Badge", get: (r) => r.rating },
    { label: "Date", get: (r) => r.date },
    { label: "Review Comment", get: (r) => r.comment },
  ], ratingsShown);

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`.ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;letter-spacing:-.02em}`}</style>

      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 18px",
          borderRadius: 16,
          background: "rgba(8, 128, 90, 0.06)",
          border: "1px solid rgba(8, 128, 90, 0.15)",
          fontSize: 13,
          color: "#08805A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} />
          <span>
            <strong>Customer Satisfaction:</strong> Post-visit sentiment and ratings collected from field service encounters.
          </span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>Sample Feedback Feed</span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <AppleKpiCard
          label="Total Feedback Logs"
          value={totalSentiments}
          sub="Sentiment records captured"
          icon={MessageSquare}
          color="#0066CC"
          bg="rgba(0, 102, 204, 0.1)"
        />
        <AppleKpiCard
          label="Positive Sentiment"
          value={`${positiveSentimentPct}%`}
          sub={`${sentimentCounts.Good} of ${totalSentiments} marked Good`}
          icon={ThumbsUp}
          color="#08805A"
          bg="rgba(8, 128, 90, 0.1)"
        />
        <AppleKpiCard
          label="Needs Attention"
          value={criticalCount}
          sub="Negative or Extremely Negative"
          icon={AlertTriangle}
          color="#DC4141"
          bg="rgba(220, 38, 38, 0.1)"
          activeDot={criticalCount > 0}
        />
        <AppleKpiCard
          label="Avg. Customer Rating"
          value={`${avgStars} / 5.0`}
          sub={`${totalRatings} post-service reviews`}
          icon={Star}
          color="#B45309"
          bg="rgba(180, 83, 9, 0.1)"
        />
      </div>

      {/* ── Customer Sentiment ─────────────────────────────────────────────── */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "#1D1D1F" }}>Customer Sentiment</h3>
          <button type="button" onClick={exportSentimentCsv} style={EXPORT_BTN}>
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <AppleSearchBar value={sentQ} onChange={setSentQ} placeholder="Search customer, society, purifier, technician…" />
          <div style={{ flex: 1, minWidth: 280 }}>
            <AppleSegmentedControl options={sentimentFilterOptions} value={sentFilter} onChange={setSentFilter} />
          </div>
        </div>
        <Table head={["Customer & Society", "Purifier ID", "Technician", "Sentiment", "Date", "Feedback Note"]} maxHeight={480}>
          {sentimentShown.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={td}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={r.customer} size={28} />
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: 13, color: "#1D1D1F", display: "block" }}>{r.customer}</strong>
                    <span style={{ fontSize: 11.5, color: "#6E6E73" }}>{r.society}</span>
                  </div>
                </div>
              </td>
              <td style={td}>{r.purifierId}</td>
              <td style={{ ...td, color: "#48484A" }}>{r.technician}</td>
              <td style={td}>
                <StatusPill value={r.sentiment} map={SENTIMENT_COLORS} emoji={SENTIMENT_EMOJI[r.sentiment]} />
              </td>
              <td style={{ ...td, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>{fmtDate(new Date(r.date))}</td>
              <td style={{ ...td, textAlign: "left", maxWidth: 320 }}>{r.note}</td>
            </tr>
          ))}
          {sentimentShown.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 0 }}><Empty msg="No feedback records match this filter." /></td>
            </tr>
          )}
        </Table>
      </div>

      {/* ── Customer Rating ────────────────────────────────────────────────── */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "#1D1D1F" }}>Customer Rating</h3>
          <button type="button" onClick={exportRatingCsv} style={EXPORT_BTN}>
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <AppleSearchBar value={ratingQ} onChange={setRatingQ} placeholder="Search customer, society, comment, technician…" />
          <div style={{ flex: 1, minWidth: 280 }}>
            <AppleSegmentedControl options={ratingFilterOptions} value={ratingFilter} onChange={setRatingFilter} />
          </div>
        </div>
        <Table head={["Customer & Society", "Technician", "Service Category", "Stars", "Rating", "Date", "Review Comment"]} maxHeight={480}>
          {ratingsShown.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={td}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={r.customer} size={28} />
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: 13, color: "#1D1D1F", display: "block" }}>{r.customer}</strong>
                    <span style={{ fontSize: 11.5, color: "#6E6E73" }}>{r.society}</span>
                  </div>
                </div>
              </td>
              <td style={{ ...td, color: "#48484A" }}>{r.technician}</td>
              <td style={td}>{r.category}</td>
              <td style={td}><StarRating rating={r.stars} /></td>
              <td style={td}>
                <StatusPill value={r.rating} map={RATING_COLORS} />
              </td>
              <td style={{ ...td, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>{fmtDate(new Date(r.date))}</td>
              <td style={{ ...td, textAlign: "left", maxWidth: 320 }}>{r.comment}</td>
            </tr>
          ))}
          {ratingsShown.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 0 }}><Empty msg="No customer ratings match this filter." /></td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
}

/* ===========================================================================
   FSM — TRACK TECHNICIAN: Clean Field Live Fleet Radar
   =========================================================================== */

const FLEET_TECHNICIANS = [
  {
    id: "TECH-01",
    name: "Ramesh Kumar",
    status: "en_route", // 'en_route' | 'on_job' | 'delayed' | 'available' | 'unavailable'
    lat: 12.9352,
    lng: 77.6245,
    destLat: 12.9560,
    destLng: 77.7010,
    area: "Koramangala · South Zone",
    phone: "+91 98450 11223",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: null,
    unavailableSince: null,
    currentJob: {
      id: "JOB-101",
      customer: "Abhijit Dey",
      society: "MJR Clique Hydra Apartment",
      flat: "Tower B, Flat 402",
      jobType: "Filter Service & TDS Tune",
      etaMins: 14,
      distanceKm: 4.2,
      timeSlot: "2:00 PM - 2:45 PM",
      progressStep: 2,
      priority: "High",
      customerPhone: "+91 98450 99881",
    },
  },
  {
    id: "TECH-02",
    name: "Suresh Murthy",
    status: "on_job",
    lat: 12.9719,
    lng: 77.6412,
    destLat: 12.9719,
    destLng: 77.6412,
    area: "Indiranagar · East Zone",
    phone: "+91 98801 44556",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: null,
    unavailableSince: null,
    currentJob: {
      id: "JOB-102",
      customer: "Ravi Kumar",
      society: "Prestige Lakeside",
      flat: "Tower 3, Flat 804",
      jobType: "Quarterly AMC Periodic Service",
      etaMins: 0,
      distanceKm: 0,
      timeSlot: "1:30 PM - 2:30 PM",
      progressStep: 3,
      priority: "Normal",
      customerPhone: "+91 98801 77665",
    },
  },
  {
    id: "TECH-03",
    name: "Anil Patel",
    status: "delayed",
    lat: 12.9081,
    lng: 77.6476,
    destLat: 12.9350,
    destLng: 77.6820,
    area: "HSR Layout · South-East",
    phone: "+91 99002 77889",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: "+25 mins",
    unavailableSince: null,
    delayReason: "Heavy ORR Junction Traffic Congestion",
    currentJob: {
      id: "JOB-103",
      customer: "Sneha Patil",
      society: "Sobha Dream Acres",
      flat: "Wing C, Flat 1201",
      jobType: "RO Membrane Replacement",
      etaMins: 35,
      distanceKm: 5.8,
      timeSlot: "2:30 PM - 3:15 PM",
      progressStep: 2,
      priority: "Urgent",
      customerPhone: "+91 99002 33441",
    },
  },
  {
    id: "TECH-04",
    name: "Vijay Raghavan",
    status: "on_job",
    lat: 13.0298,
    lng: 77.5400,
    destLat: 13.0298,
    destLng: 77.5400,
    area: "Malleswaram · North Zone",
    phone: "+91 97403 99001",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: null,
    unavailableSince: null,
    currentJob: {
      id: "JOB-104",
      customer: "Deepa Nair",
      society: "Ashish JK",
      flat: "Block A, Flat 204",
      jobType: "High TDS & Flow Check",
      etaMins: 0,
      distanceKm: 0,
      timeSlot: "1:15 PM - 2:15 PM",
      progressStep: 3,
      priority: "High",
      customerPhone: "+91 97403 11220",
    },
  },
  {
    id: "TECH-05",
    name: "Manoj Sharma",
    status: "available",
    lat: 12.9250,
    lng: 77.5938,
    destLat: null,
    destLng: null,
    area: "Jayanagar 4th Block Hub",
    phone: "+91 96112 33445",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: null,
    unavailableSince: null,
    currentJob: null,
  },
  {
    id: "TECH-06",
    name: "Deepak Thapa",
    status: "delayed",
    lat: 12.9850,
    lng: 77.7280,
    destLat: 12.9920,
    destLng: 77.6950,
    area: "Whitefield · Tech Corridor",
    phone: "+91 93420 88990",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: "+15 mins",
    unavailableSince: null,
    delayReason: "Visitor Gate Clearance Hold",
    currentJob: {
      id: "JOB-106",
      customer: "Anand Ray",
      society: "CBR Aakruti",
      flat: "Tower 2, Flat 501",
      jobType: "Active Carbon Cartridge Replacement",
      etaMins: 20,
      distanceKm: 2.8,
      timeSlot: "3:00 PM - 3:45 PM",
      progressStep: 2,
      priority: "Normal",
      customerPhone: "+91 96112 55441",
    },
  },
  {
    id: "TECH-07",
    name: "Prakash Nayak",
    status: "unavailable",
    lat: 12.9120,
    lng: 77.5850,
    destLat: 12.9120,
    destLng: 77.5850,
    area: "JP Nagar · 6th Phase",
    phone: "+91 98802 66778",
    checkedIn: true, // dummy placeholder for a future technician-app check-in feed
    delayedBy: null,
    unavailableSince: "45 mins ago",
    currentJob: {
      id: "JOB-107",
      customer: "Asha Anandan",
      society: "SVS Ananda Nilayam",
      flat: "Flat 102",
      jobType: "Sanitization & Purge",
      etaMins: 0,
      distanceKm: 0,
      timeSlot: "11:00 AM - 12:30 PM",
      progressStep: 3,
      priority: "Normal",
      customerPhone: "+91 93420 77112",
    },
  },
  {
    id: "TECH-08",
    name: "Kiran Gowda",
    status: "available",
    lat: 12.9610,
    lng: 77.5300,
    destLat: null,
    destLng: null,
    area: "Vijayanagar · West Hub",
    phone: "+91 94480 11992",
    checkedIn: false, // dummy placeholder for a future technician-app check-in feed
    delayedBy: null,
    unavailableSince: null,
    currentJob: null,
  },
];

const TECH_STATUS_LABELS = {
  en_route: "In Transit",
  on_job: "On Site",
  delayed: "Delayed",
  available: "Available",
  unavailable: "Unavailable / Lost Contact",
};

const TECH_STATUS_COLORS = {
  "In Transit": { color: "#B45309", bg: "rgba(180, 83, 9, 0.1)" },
  "On Site": { color: "#08805A", bg: "rgba(8, 128, 90, 0.1)" },
  "Delayed": { color: "#DC4141", bg: "rgba(220, 38, 38, 0.1)" },
  "Available": { color: "#0066CC", bg: "rgba(0, 102, 204, 0.1)" },
  "Unavailable / Lost Contact": { color: "#991B1B", bg: "rgba(153, 27, 27, 0.1)" },
};

// Dummy technician login/logout activity log, per explicit request ("add
// technician logs when they're logging in and logout"). Newest first. Placeholder
// until the technician app exposes a real session/attendance feed.
const TECH_ACTIVITY_LOG = [
  { technician: "Ramesh Kumar", date: "18 Sep 2026", login: "9:02 AM", logout: "—", duration: "In progress" },
  { technician: "Suresh Murthy", date: "18 Sep 2026", login: "8:47 AM", logout: "—", duration: "In progress" },
  { technician: "Anil Patel", date: "18 Sep 2026", login: "9:15 AM", logout: "—", duration: "In progress" },
  { technician: "Vijay Raghavan", date: "18 Sep 2026", login: "8:30 AM", logout: "—", duration: "In progress" },
  { technician: "Manoj Sharma", date: "18 Sep 2026", login: "8:55 AM", logout: "—", duration: "In progress" },
  { technician: "Deepak Thapa", date: "18 Sep 2026", login: "9:20 AM", logout: "—", duration: "In progress" },
  { technician: "Kiran Gowda", date: "17 Sep 2026", login: "9:05 AM", logout: "6:12 PM", duration: "9h 7m" },
  { technician: "Prakash Nayak", date: "17 Sep 2026", login: "8:40 AM", logout: "5:58 PM", duration: "9h 18m" },
  { technician: "Ramesh Kumar", date: "17 Sep 2026", login: "8:58 AM", logout: "6:30 PM", duration: "9h 32m" },
  { technician: "Anil Patel", date: "17 Sep 2026", login: "9:10 AM", logout: "6:05 PM", duration: "8h 55m" },
];

export function TrackTechnician() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const [techs] = useState(FLEET_TECHNICIANS);
  const [selectedTech, setSelectedTech] = useState(FLEET_TECHNICIANS[0]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [msgToast, setMsgToast] = useState("");

  useEffect(() => {
    api.logView(user.username, "Viewed Track Technician");
  }, [user]);

  const statusCounts = useMemo(() => ({
    all: techs.length,
    // Per explicit request, "Total Technicians" should reflect who has marked
    // themselves present today, not the whole roster — `checkedIn` is dummy data
    // until the technician app ships a real check-in feed (tracked separately from
    // the technician-app GPS-ping work).
    checkedIn: techs.filter((t) => t.checkedIn).length,
    en_route: techs.filter((t) => t.status === "en_route").length,
    on_job: techs.filter((t) => t.status === "on_job").length,
    delayed: techs.filter((t) => t.status === "delayed").length,
    available: techs.filter((t) => t.status === "available").length,
    unavailable: techs.filter((t) => t.status === "unavailable").length,
  }), [techs]);

  const searchQl = searchQ.toLowerCase();
  const filteredTechs = useMemo(() => {
    return techs.filter((t) => {
      const matchStatus = (filterStatus === "all" || t.status === filterStatus);
      const matchSearch = (!searchQl ||
        `${t.name} ${t.area} ${t.phone} ${t.delayedBy || ""} ${t.unavailableSince || ""} ${t.currentJob?.customer || ""} ${t.currentJob?.society || ""}`.toLowerCase().includes(searchQl));
      return matchStatus && matchSearch;
    });
  }, [techs, filterStatus, searchQl]);

  const filterOptions = [
    { id: "all", label: "All", count: statusCounts.all },
    { id: "en_route", label: "In Transit", count: statusCounts.en_route },
    { id: "on_job", label: "On Site", count: statusCounts.on_job },
    { id: "delayed", label: "Delayed", count: statusCounts.delayed },
    { id: "available", label: "Available", count: statusCounts.available },
    { id: "unavailable", label: "Unavailable", count: statusCounts.unavailable },
  ];

  // Leaflet CDN Script & Stylesheet loader
  useEffect(() => {
    let cancelled = false;
    const CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    const loadLeaflet = async () => {
      if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = CSS_URL;
        document.head.appendChild(link);
      }

      if (window.L) return window.L;

      return new Promise((resolve, reject) => {
        let script = document.querySelector(`script[src="${JS_URL}"]`);
        if (script) {
          if (window.L) return resolve(window.L);
          script.addEventListener("load", () => resolve(window.L));
          return;
        }
        script = document.createElement("script");
        script.src = JS_URL;
        script.async = true;
        script.onload = () => resolve(window.L);
        script.onerror = () => reject(new Error("Failed to load Leaflet"));
        document.head.appendChild(script);
      });
    };

    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current || mapObj.current) return;

      const map = L.map(mapRef.current, {
        center: [12.9550, 77.6200],
        zoom: 12,
        zoomControl: true,
      });

      // CartoDB Voyager tiles with crisp rendering
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors, © CARTO",
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      mapObj.current = map;
      renderMapEntities(L, map);

      // Invalidate sizes for robust rendering inside flexbox/grid containers
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 350);
      setTimeout(() => map.invalidateSize(), 700);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
  }, []);

  // Update markers and routes whenever filtered technicians or selected technician changes
  useEffect(() => {
    if (window.L && mapObj.current) {
      renderMapEntities(window.L, mapObj.current);
    }
  }, [filteredTechs, selectedTech]);

  const renderMapEntities = (L, map) => {
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => map.removeLayer(p));
    polylinesRef.current = [];

    filteredTechs.forEach((t) => {
      const isSelected = selectedTech?.id === t.id;
      let markerHtml = "";

      if (t.status === "delayed") {
        markerHtml = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(220, 38, 38, 0.3);animation:pulse 1.6s infinite ease-out;"></div>
            <div style="position:relative;width:34px;height:34px;border-radius:50%;background:#DC4141;border:2.5px solid #FFFFFF;box-shadow:0 4px 14px rgba(220, 38, 38, 0.45);display:flex;align-items:center;justify-content:center;font-size:15px;color:#fff;cursor:pointer;transform:${isSelected ? "scale(1.2)" : "scale(1)"};transition:transform 0.2s ease;">
              ⏱️
            </div>
          </div>
        `;
      } else if (t.status === "unavailable") {
        markerHtml = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#6E6E73;border:2.5px solid #FFFFFF;box-shadow:0 4px 12px rgba(110, 110, 115, 0.4);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;cursor:pointer;transform:${isSelected ? "scale(1.2)" : "scale(1)"};transition:transform 0.2s ease;">
              ⚠️
            </div>
          </div>
        `;
      } else if (t.status === "en_route") {
        markerHtml = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(180, 83, 9, 0.25);animation:pulse 2s infinite ease-out;"></div>
            <div style="position:relative;width:34px;height:34px;border-radius:50%;background:#B45309;border:2.5px solid #FFFFFF;box-shadow:0 4px 14px rgba(180, 83, 9, 0.4);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;cursor:pointer;transform:${isSelected ? "scale(1.2)" : "scale(1)"};transition:transform 0.2s ease;">
              🏍️
            </div>
          </div>
        `;
      } else if (t.status === "on_job") {
        markerHtml = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#08805A;border:2.5px solid #FFFFFF;box-shadow:0 4px 14px rgba(8, 128, 90, 0.4);display:flex;align-items:center;justify-content:center;font-size:15px;color:#fff;cursor:pointer;transform:${isSelected ? "scale(1.2)" : "scale(1)"};transition:transform 0.2s ease;">
              🔧
            </div>
          </div>
        `;
      } else {
        markerHtml = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
            <div style="width:30px;height:30px;border-radius:50%;background:#0066CC;border:2.5px solid #FFFFFF;box-shadow:0 4px 12px rgba(0, 102, 204, 0.35);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;font-weight:bold;cursor:pointer;transform:${isSelected ? "scale(1.2)" : "scale(1)"};transition:transform 0.2s ease;">
              ✓
            </div>
          </div>
        `;
      }

      const icon = L.divIcon({
        className: "custom-tech-pin",
        html: markerHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const m = L.marker([t.lat, t.lng], { icon }).addTo(map);

      // Popup formatted cleanly
      const popupHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;padding:6px;min-width:210px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <strong style="font-size:14px;color:#1D1D1F;">${t.name}</strong>
            <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;background:${t.status === "delayed" ? "rgba(220,38,38,0.12)" : t.status === "unavailable" ? "rgba(153,27,27,0.12)" : t.status === "en_route" ? "rgba(180,83,9,0.12)" : t.status === "on_job" ? "rgba(8,128,90,0.12)" : "rgba(0,102,204,0.12)"};color:${t.status === "delayed" ? "#DC4141" : t.status === "unavailable" ? "#991B1B" : t.status === "en_route" ? "#B45309" : t.status === "on_job" ? "#08805A" : "#0066CC"};">
              ${TECH_STATUS_LABELS[t.status]}
            </span>
          </div>
          <div style="font-size:12px;color:#6E6E73;margin-bottom:4px;">📍 ${t.area}</div>
          ${t.delayedBy ? `<div style="font-size:11.5px;color:#DC4141;font-weight:700;margin-bottom:4px;">⚠️ Delayed by: ${t.delayedBy}</div>` : ""}
          ${t.unavailableSince ? `<div style="font-size:11.5px;color:#991B1B;font-weight:700;margin-bottom:4px;">📡 Lost Contact: ${t.unavailableSince}</div>` : ""}
          ${t.currentJob ? `
            <div style="font-size:12px;color:#1D1D1F;font-weight:600;margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.06);">
              ${t.currentJob.customer} · <span style="font-weight:400;color:#6E6E73;">${t.currentJob.society}</span>
            </div>
            <div style="font-size:11px;color:#86868B;margin-top:2px;">
              ${t.status === "delayed" || t.status === "en_route" ? `⏱️ ETA: ${t.currentJob.etaMins} mins (${t.currentJob.distanceKm} km)` : `🛠️ ${t.currentJob.jobType}`}
            </div>
          ` : `
            <div style="font-size:11.5px;color:#08805A;font-weight:600;margin-top:4px;">Standby at Base Hub</div>
          `}
        </div>
      `;
      m.bindPopup(popupHtml);

      m.on("click", () => {
        setSelectedTech(t);
        map.flyTo([t.lat, t.lng], 14, { duration: 0.8 });
      });

      markersRef.current.push(m);

      // If En Route / Delayed and has destination coordinates, draw destination pin and polyline route
      if ((t.status === "en_route" || t.status === "delayed") && t.destLat && t.destLng) {
        const destIcon = L.divIcon({
          className: "custom-dest-pin",
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#1D1D1F;border:2px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:13px;color:#fff;">
              📍
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const destMarker = L.marker([t.destLat, t.destLng], { icon: destIcon }).addTo(map);
        destMarker.bindPopup(`
          <div style="font-family:-apple-system,sans-serif;padding:4px;">
            <div style="font-size:11px;font-weight:700;color:#86868B;text-transform:uppercase;">Customer Destination</div>
            <div style="font-size:13px;font-weight:700;color:#1D1D1F;margin-top:2px;">${t.currentJob.customer}</div>
            <div style="font-size:12px;color:#6E6E73;">${t.currentJob.society}</div>
          </div>
        `);
        markersRef.current.push(destMarker);

        const poly = L.polyline([[t.lat, t.lng], [t.destLat, t.destLng]], {
          color: t.status === "delayed" ? "#DC4141" : "#B45309",
          weight: 3.5,
          dashArray: "6, 8",
          opacity: 0.85,
        }).addTo(map);

        polylinesRef.current.push(poly);
      }
    });
  };

  const handleSelectTech = (t) => {
    setSelectedTech(t);
    if (mapObj.current) {
      mapObj.current.flyTo([t.lat, t.lng], 14, { duration: 0.8 });
    }
  };

  const handleResetMap = () => {
    if (mapObj.current) {
      mapObj.current.flyTo([12.9550, 77.6200], 12, { duration: 0.8 });
    }
  };

  const exportTechCsv = () => exportToCsv("prowater-technician-fleet.csv", [
    { label: "Technician", get: (t) => t.name },
    { label: "Area", get: (t) => t.area },
    { label: "Status", get: (t) => TECH_STATUS_LABELS[t.status] || t.status },
    { label: "Delayed By", get: (t) => t.delayedBy || (t.currentJob ? "On Time" : "—") },
    { label: "Unavailable Since", get: (t) => t.unavailableSince || "Active Now" },
    { label: "Phone", get: (t) => t.phone },
    { label: "Current Customer", get: (t) => t.currentJob?.customer || "" },
    { label: "Society", get: (t) => t.currentJob?.society || "" },
    { label: "Job Type", get: (t) => t.currentJob?.jobType || "" },
    { label: "ETA (mins)", get: (t) => (t.status === "en_route" || t.status === "delayed" ? (t.currentJob?.etaMins ?? "") : "") },
  ], filteredTechs);

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        .ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;letter-spacing:-.02em}
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.9; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-container {
          width: 100% !important;
          height: 100% !important;
          border-radius: 18px;
          z-index: 1;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 16px 36px rgba(0,0,0,0.15) !important;
          padding: 6px !important;
        }
      `}</style>

      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 18px",
          borderRadius: 16,
          background: "rgba(8, 128, 90, 0.06)",
          border: "1px solid rgba(8, 128, 90, 0.15)",
          fontSize: 13,
          color: "#08805A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} />
          <span>
            <strong>Track Technician:</strong> Real-time field locations, delays, lost contact alerts, and customer dispatch journeys.
          </span>
        </div>
        <button
          type="button"
          onClick={handleResetMap}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "#FFFFFF",
            border: "1px solid rgba(8, 128, 90, 0.2)",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 11.5,
            fontWeight: 700,
            color: "#08805A",
            cursor: "pointer",
          }}
        >
          <Compass size={13} /> Reset View
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <AppleKpiCard label="Total Technicians" value={statusCounts.checkedIn} sub={`Marked present today · of ${statusCounts.all} on roster`} icon={UserRound} color="#0066CC" bg="rgba(0, 102, 204, 0.1)" />
        <AppleKpiCard label="In Transit" value={statusCounts.en_route} sub="On schedule to site" icon={Truck} color="#B45309" bg="rgba(180, 83, 9, 0.1)" />
        <AppleKpiCard label="On Site" value={statusCounts.on_job} sub="Currently servicing" icon={Wrench} color="#08805A" bg="rgba(8, 128, 90, 0.1)" />
        <AppleKpiCard label="Delayed" value={statusCounts.delayed} sub="Behind schedule" icon={AlertTriangle} color="#DC4141" bg="rgba(220, 38, 38, 0.1)" activeDot={statusCounts.delayed > 0} />
        <AppleKpiCard label="Lost Contact" value={statusCounts.unavailable} sub="GPS offline" icon={Ban} color="#991B1B" bg="rgba(153, 27, 27, 0.1)" activeDot={statusCounts.unavailable > 0} />
        <AppleKpiCard label="Available" value={statusCounts.available} sub="Ready for dispatch" icon={CheckCircle2} color="#7C3AED" bg="rgba(124, 58, 237, 0.1)" />
      </div>

      {/* Main Tracking Workspace: Left Drawer + Right Live Map */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        {/* Left Drawer: Filter & Technician List */}
        <div
          style={{
            ...APPLE_CARD,
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: 680,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: "#1D1D1F" }}>Field Technicians</h3>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#86868B" }}>
              {filteredTechs.length} shown
            </span>
          </div>

          <AppleSearchBar
            value={searchQ}
            onChange={setSearchQ}
            placeholder="Search tech, area, customer…"
          />

          <div style={{ width: "100%" }}>
            <AppleSegmentedControl
              options={filterOptions}
              value={filterStatus}
              onChange={setFilterStatus}
            />
          </div>

          {/* Technician Cards List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflowY: "auto",
              paddingRight: 4,
              flex: 1,
            }}
          >
            {filteredTechs.map((t) => {
              const isSelected = selectedTech?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTech(t)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: isSelected ? "rgba(8, 128, 90, 0.08)" : "rgba(0, 0, 0, 0.02)",
                    border: `1px solid ${isSelected ? "#08805A" : "rgba(0, 0, 0, 0.06)"}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(0, 0, 0, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AppleAvatar name={t.name} size={30} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 750, color: "#1D1D1F" }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: "#86868B" }}>{t.phone}</div>
                      </div>
                    </div>
                    <StatusPill value={TECH_STATUS_LABELS[t.status]} map={TECH_STATUS_COLORS} />
                  </div>

                  <div style={{ fontSize: 11.5, color: "#48484A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>📍 {t.area}</span>
                    {t.delayedBy && (
                      <span style={{ fontSize: 11, fontWeight: 750, color: "#DC4141", background: "rgba(220,38,38,0.1)", padding: "1px 6px", borderRadius: 999 }}>
                        {t.delayedBy}
                      </span>
                    )}
                    {t.unavailableSince && (
                      <span style={{ fontSize: 11, fontWeight: 750, color: "#991B1B", background: "rgba(153,27,27,0.1)", padding: "1px 6px", borderRadius: 999 }}>
                        Offline {t.unavailableSince}
                      </span>
                    )}
                  </div>

                  {t.currentJob ? (
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: isSelected ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.03)",
                        border: "1px solid rgba(0, 0, 0, 0.04)",
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#1D1D1F" }}>{t.currentJob.customer}</span>
                        {(t.status === "en_route" || t.status === "delayed") && (
                          <span style={{ color: t.status === "delayed" ? "#DC4141" : "#B45309", fontWeight: 750 }}>
                            {t.currentJob.etaMins} min ETA
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#6E6E73", fontSize: 11, marginTop: 1 }}>
                        {t.currentJob.society} · {t.currentJob.jobType}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: "#08805A", fontWeight: 600 }}>
                      ✓ Standby at Hub
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTechs.length === 0 && (
              <Empty msg="No technicians match your search/filter." />
            )}
          </div>
        </div>

        {/* Right Panel: Map Container + Floating Bottom Inspector */}
        <div
          style={{
            ...APPLE_CARD,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "relative",
            minHeight: 680,
          }}
        >
          {/* Leaflet Map DOM Node */}
          <div
            ref={mapRef}
            style={{
              width: "100%",
              flex: 1,
              minHeight: 440,
              borderRadius: 16,
              overflow: "hidden",
              background: "#E5E3DF",
            }}
          />

          {/* Selected Technician Bottom Inspector */}
          {selectedTech && (
            <div
              style={{
                ...APPLE_SUBTLE_CARD,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                background: "rgba(255, 255, 255, 0.96)",
                border: "1px solid rgba(8, 128, 90, 0.2)",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <AppleAvatar name={selectedTech.name} size={40} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1D1D1F" }}>{selectedTech.name}</h4>
                      <StatusPill value={TECH_STATUS_LABELS[selectedTech.status]} map={TECH_STATUS_COLORS} />
                    </div>
                    <div style={{ fontSize: 12, color: "#6E6E73", marginTop: 2 }}>
                      📍 {selectedTech.area} · {selectedTech.phone}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a
                    href={`tel:${selectedTech.phone}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 10,
                      background: "#08805A",
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    <Phone size={13} /> Call Tech ({selectedTech.phone})
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setMsgToast(`Notification dispatched to ${selectedTech.currentJob ? selectedTech.currentJob.customer : selectedTech.name}`);
                      setTimeout(() => setMsgToast(""), 3500);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 10,
                      background: "rgba(0, 0, 0, 0.05)",
                      border: "1px solid rgba(0, 0, 0, 0.1)",
                      color: "#1D1D1F",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <MessageSquare size={13} /> Message
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTech(selectedTech)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 10px",
                      borderRadius: 10,
                      background: "rgba(0, 102, 204, 0.08)",
                      border: "1px solid rgba(0, 102, 204, 0.2)",
                      color: "#0066CC",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Navigation size={13} /> Center
                  </button>
                </div>
              </div>

              {/* Alert Status Banners */}
              {selectedTech.delayedBy && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    color: "#DC4141",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={15} />
                  <span><strong>Schedule Delay:</strong> Technician is delayed by <strong>{selectedTech.delayedBy}</strong> ({selectedTech.delayReason || "Traffic bottleneck"}). Customer notified.</span>
                </div>
              )}

              {selectedTech.unavailableSince && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(153, 27, 27, 0.08)",
                    border: "1px solid rgba(153, 27, 27, 0.2)",
                    color: "#991B1B",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ban size={15} />
                  <span><strong>Lost Contact / Offline:</strong> GPS ping timed out. Technician marked unavailable since <strong>{selectedTech.unavailableSince}</strong>.</span>
                </div>
              )}

              {/* Toast Message */}
              {msgToast && (
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 10,
                    background: "rgba(8, 128, 90, 0.12)",
                    color: "#08805A",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={14} /> {msgToast}
                </div>
              )}

              {/* Current Job Detail */}
              {selectedTech.currentJob ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                    background: "rgba(0, 0, 0, 0.02)",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#86868B", textTransform: "uppercase" }}>Customer & Society</div>
                    <div style={{ fontSize: 13, fontWeight: 750, color: "#1D1D1F", marginTop: 2 }}>{selectedTech.currentJob.customer}</div>
                    <div style={{ fontSize: 11.5, color: "#6E6E73" }}>{selectedTech.currentJob.society} · {selectedTech.currentJob.flat}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#86868B", textTransform: "uppercase" }}>Job Type & Priority</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", marginTop: 2 }}>{selectedTech.currentJob.jobType}</div>
                    <div style={{ fontSize: 11.5, color: selectedTech.currentJob.priority === "Urgent" ? "#DC4141" : "#08805A", fontWeight: 700 }}>
                      Priority: {selectedTech.currentJob.priority}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#86868B", textTransform: "uppercase" }}>Scheduled Time Slot</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", marginTop: 2 }}>{selectedTech.currentJob.timeSlot}</div>
                    <div style={{ fontSize: 11.5, color: selectedTech.status === "delayed" ? "#DC4141" : selectedTech.status === "en_route" ? "#B45309" : "#08805A", fontWeight: 700 }}>
                      {selectedTech.status === "delayed" || selectedTech.status === "en_route" ? `⏱️ ETA: ${selectedTech.currentJob.etaMins} mins (${selectedTech.currentJob.distanceKm} km)` : "🛠️ Service in Progress"}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(0, 102, 204, 0.05)",
                    border: "1px solid rgba(0, 102, 204, 0.15)",
                    fontSize: 12.5,
                    color: "#0066CC",
                  }}
                >
                  ℹ️ Technician is currently in standby mode at the regional hub, ready for instant job dispatch.
                </div>
              )}

              {/* 4-Step Progress Journey */}
              {selectedTech.currentJob && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 750, color: "#86868B", textTransform: "uppercase", marginBottom: 6 }}>
                    Dispatch Journey Progress
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[
                      { step: 1, label: "Dispatched", active: selectedTech.currentJob.progressStep >= 1 },
                      { step: 2, label: selectedTech.status === "delayed" ? "Delayed in Transit" : "In Transit", active: selectedTech.currentJob.progressStep >= 2 },
                      { step: 3, label: "On Site", active: selectedTech.currentJob.progressStep >= 3 },
                      { step: 4, label: "Completed", active: selectedTech.currentJob.progressStep >= 4 },
                    ].map((s) => (
                      <div
                        key={s.step}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          background: s.active ? (selectedTech.status === "delayed" && s.step === 2 ? "rgba(220, 38, 38, 0.12)" : "rgba(8, 128, 90, 0.12)") : "rgba(0, 0, 0, 0.04)",
                          border: `1px solid ${s.active ? (selectedTech.status === "delayed" && s.step === 2 ? "rgba(220, 38, 38, 0.3)" : "rgba(8, 128, 90, 0.3)") : "rgba(0, 0, 0, 0.06)"}`,
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: s.active ? (selectedTech.status === "delayed" && s.step === 2 ? "#DC4141" : "#08805A") : "#86868B",
                        }}
                      >
                        {s.active ? "✓ " : ""}{s.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Fleet Roster Table */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "#1D1D1F" }}>Fleet Technician Directory</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#86868B" }}>Live field records, delay alerts, unavailable tracking, and assignments</p>
          </div>
          <button type="button" onClick={exportTechCsv} style={EXPORT_BTN}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        <Table head={["Technician", "Assigned Zone", "Status", "Delayed By", "Unavailable Since", "Contact", "Current Customer / Assignment", "ETA / Stage"]} maxHeight={480}>
          {filteredTechs.map((t) => (
            <tr
              key={t.id}
              onClick={() => handleSelectTech(t)}
              style={{
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                cursor: "pointer",
                background: selectedTech?.id === t.id ? "rgba(8, 128, 90, 0.04)" : "transparent",
              }}
            >
              <td style={{ ...td, textAlign: "left", whiteSpace: "nowrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={t.name} size={28} />
                  <div>
                    <strong style={{ fontSize: 13, color: "#1D1D1F", display: "block" }}>{t.name}</strong>
                    <div style={{ fontSize: 11, color: "#86868B" }}>{t.id}</div>
                  </div>
                </div>
              </td>
              <td style={{ ...td, color: "#48484A", whiteSpace: "nowrap" }}>{t.area}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                <StatusPill value={TECH_STATUS_LABELS[t.status]} map={TECH_STATUS_COLORS} />
              </td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                {t.delayedBy ? (
                  <span style={{ fontSize: 11.5, fontWeight: 750, color: "#DC4141", background: "rgba(220, 38, 38, 0.1)", padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    ⚠️ {t.delayedBy}
                  </span>
                ) : t.currentJob ? (
                  <span style={{ fontSize: 11.5, color: "#08805A", fontWeight: 600, whiteSpace: "nowrap" }}>On Time</span>
                ) : (
                  <span style={{ color: "#86868B" }}>—</span>
                )}
              </td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                {t.unavailableSince ? (
                  <span style={{ fontSize: 11.5, fontWeight: 750, color: "#991B1B", background: "rgba(153, 27, 27, 0.1)", padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    ⚠️ {t.unavailableSince}
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, color: "#08805A", whiteSpace: "nowrap" }}>Active Now</span>
                )}
              </td>
              <td style={{ ...td, color: "#48484A", whiteSpace: "nowrap" }}>
                <a href={`tel:${t.phone}`} style={{ color: "#08805A", fontWeight: 650, textDecoration: "none", whiteSpace: "nowrap" }}>{t.phone}</a>
              </td>
              <td style={{ ...td, textAlign: "left", minWidth: 220 }}>
                {t.currentJob ? (
                  <div>
                    <div style={{ fontWeight: 650, color: "#1D1D1F" }}>{t.currentJob.customer}</div>
                    <div style={{ fontSize: 11.5, color: "#6E6E73" }}>{t.currentJob.society} · {t.currentJob.jobType}</div>
                  </div>
                ) : (
                  <span style={{ color: "#86868B" }}>Standby at Base</span>
                )}
              </td>
              <td style={{ ...td, color: t.status === "delayed" ? "#DC4141" : t.status === "en_route" ? "#B45309" : "#08805A", fontWeight: 700, whiteSpace: "nowrap" }}>
                {t.status === "delayed" || t.status === "en_route" ? `${t.currentJob.etaMins} mins` : t.status === "on_job" ? "On Site" : t.status === "unavailable" ? "Offline" : "Available"}
              </td>
            </tr>
          ))}
          {filteredTechs.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 0 }}><Empty msg="No technicians match this filter." /></td>
            </tr>
          )}
        </Table>
      </div>

      {/* Technician Activity Log — login/logout, per explicit request */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: "#1D1D1F" }}>Technician Activity Log</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#86868B" }}>Login and logout times, most recent first</p>
        </div>
        <Table head={["Technician", "Date", "Login", "Logout", "Duration"]} maxHeight={380}>
          {TECH_ACTIVITY_LOG.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={{ ...td, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={r.technician} size={26} />
                  <strong style={{ fontSize: 13, color: "#1D1D1F" }}>{r.technician}</strong>
                </div>
              </td>
              <td style={{ ...td, color: "#48484A" }}>{r.date}</td>
              <td style={{ ...td, color: "#08805A", fontWeight: 650 }}>{r.login}</td>
              <td style={{ ...td, color: r.logout === "—" ? "#86868B" : "#1D1D1F", fontWeight: r.logout === "—" ? 400 : 650 }}>{r.logout}</td>
              <td style={{ ...td, color: "#48484A" }}>{r.duration}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

/* ===========================================================================
   FSM: AMC / Maintenance Scheduling
   =========================================================================== */

export const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

export function MaintenanceSchedule() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed AMC / Maintenance");
    customerApi.getCustomers().then(setData).catch((e) => setErr(e.message || "Could not load customers."));
  }, [user]);

  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Maintenance Schedule" subtitle="Synchronizing field service jobs…" />;

  const now = Date.now();
  const MS_DAY = 86400000;
  const INTERVAL = 3;

  const items = data
    .filter((c) => c.status === "active" && c.purifier_id)
    .map((c) => {
      const start = c.since ? new Date(c.since) : null;
      if (!start || isNaN(start.getTime())) return { c, last: null, next: null, days: null };
      const monthsSince = Math.max(0, (now - start.getTime()) / (MS_DAY * 30.44));
      const cycles = Math.floor(monthsSince / INTERVAL);
      const last = addMonths(start, cycles * INTERVAL);
      const next = addMonths(start, (cycles + 1) * INTERVAL);
      return { c, last, next, days: Math.round((next.getTime() - now) / MS_DAY) };
    })
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));

  const statusOf = (d) => (d == null ? "unknown" : d < 0 ? "overdue" : d <= 14 ? "soon" : "upcoming");
  const overdue = items.filter((i) => statusOf(i.days) === "overdue").length;
  const soon = items.filter((i) => statusOf(i.days) === "soon").length;
  const upcoming = items.filter((i) => statusOf(i.days) === "upcoming").length;

  const badge = (d) => {
    const s = statusOf(d);
    const map = {
      overdue: { color: "#DC4141", bg: "rgba(220,38,38,0.1)", lbl: `${-d}d overdue` },
      soon: { color: "#986315", bg: "rgba(152,99,21,0.1)", lbl: `in ${d}d` },
      upcoming: { color: "#08805A", bg: "rgba(8,128,90,0.1)", lbl: `in ${d}d` },
      unknown: { color: "#86868B", bg: "rgba(0,0,0,0.06)", lbl: "no date" },
    };
    const c = map[s];
    return (
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c.color, background: c.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
        {c.lbl}
      </span>
    );
  };

  const ql = q.toLowerCase();
  const shown = items.filter((i) => (bucket === "all" || statusOf(i.days) === bucket) &&
    (!ql || `${i.c.name} ${i.c.purifier_id} ${i.c.society}`.toLowerCase().includes(ql)));

  const filterOptions = [
    { id: "all", label: "All AMC", count: items.length },
    { id: "overdue", label: "Overdue", count: overdue },
    { id: "soon", label: "Due Soon", count: soon },
    { id: "upcoming", label: "Upcoming", count: upcoming },
  ];

  const exportCsv = () => exportToCsv("prowater-amc-schedule.csv", [
    { label: "Customer", get: (i) => i.c.name },
    { label: "Purifier ID", get: (i) => i.c.purifier_id },
    { label: "Device Type", get: (i) => deviceType(i.c.purifier_id) },
    { label: "Society", get: (i) => i.c.society },
    { label: "Last service", get: (i) => (i.last ? fmtDate(i.last) : "") },
    { label: "Next due", get: (i) => (i.next ? fmtDate(i.next) : "") },
    { label: "Status", get: (i) => statusOf(i.days) },
  ], shown);

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <AppleKpiCard label="Under AMC" value={items.length} sub="Active installed purifiers" icon={Wrench} color="#0066CC" bg="rgba(0,102,204,0.1)" />
        <AppleKpiCard label="Overdue" value={overdue} sub="Service past due" icon={AlertCircle} color="#DC4141" bg="rgba(220,38,38,0.1)" activeDot />
        <AppleKpiCard label="Due Soon" value={soon} sub="Within 14 days" icon={CalendarClock} color="#B45309" bg="rgba(180,83,9,0.1)" />
        <AppleKpiCard label="Upcoming" value={upcoming} sub="Scheduled ahead" icon={RotateCcw} color="#08805A" bg="rgba(8,128,90,0.1)" />
      </div>

      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 750, color: "#1D1D1F", margin: 0 }}>AMC / Maintenance Schedule</h3>
            <p style={{ fontSize: 12.5, color: "#86868B", margin: "3px 0 0" }}>Quarterly filter service cadence projected from purifier activation</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 11,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: "#FFFFFF",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              color: "#1D1D1F",
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <AppleSearchBar value={q} onChange={setQ} placeholder="Search customer, purifier or society…" />
          <div style={{ minWidth: 320 }}>
            <AppleSegmentedControl options={filterOptions} value={bucket} onChange={setBucket} />
          </div>
        </div>

        <Table head={["Customer", "Purifier", "Device", "Society", "Last service", "Next due", "Status"]} maxHeight={520}>
          {shown.map((i, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={td}><Person name={i.c.name || "—"} email={i.c.email} /></td>
              <td style={{ ...td, textAlign: "center" }}>{i.c.purifier_id ? <Chip>{i.c.purifier_id}</Chip> : "—"}</td>
              <td style={{ ...td, textAlign: "center" }}><DeviceTypeBadge purifierId={i.c.purifier_id} /></td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.c.society || "—"}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.last ? fmtDate(i.last) : "—"}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, fontWeight: 700 }}>{i.next ? fmtDate(i.next) : "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>{badge(i.days)}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 0 }}><Empty msg="No purifiers match this filter." /></td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
}

/* ===========================================================================
   FSM: Water Quality & Compliance
   =========================================================================== */

export function WaterQuality() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.logView(user.username, "Viewed Water quality & compliance");
    customerApi.getCustomers().then(setData).catch((e) => setErr(e.message || "Could not load devices."));
  }, [user]);

  if (err) return <ApiError msg={err} />;
  if (!data) return <Loading title="Loading Water Quality" subtitle="Synchronizing water quality readings…" />;

  const now = Date.now();
  const MS_DAY = 86400000;

  const items = data.filter((c) => c.purifier_id).map((c) => {
    const h = hashStr(c.purifier_id);
    const inTds = 250 + (h % 400);
    const outTds = 30 + (h % 130);
    const daysAgo = h % 90;
    const lastTest = new Date(now - daysAgo * MS_DAY);
    const testDue = daysAgo > 60;
    const status = outTds <= 100 ? "compliant" : outTds <= 130 ? "watch" : "fail";
    return { c, inTds, outTds, lastTest, testDue, status };
  });

  const compliant = items.filter((i) => i.status === "compliant").length;
  const watch = items.filter((i) => i.status === "watch").length;
  const fail = items.filter((i) => i.status === "fail").length;
  const avgOut = items.length ? Math.round(items.reduce((a, i) => a + i.outTds, 0) / items.length) : 0;
  const testsDue = items.filter((i) => i.testDue).length;

  const statusChip = (s) => {
    const map = {
      compliant: { color: "#08805A", bg: "rgba(8,128,90,0.1)", lbl: "Compliant" },
      watch: { color: "#986315", bg: "rgba(152,99,21,0.1)", lbl: "Watch" },
      fail: { color: "#DC4141", bg: "rgba(220,38,38,0.1)", lbl: "Non-compliant" },
    };
    const c = map[s];
    return (
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c.color, background: c.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
        {c.lbl}
      </span>
    );
  };

  const ql = q.toLowerCase();
  const shown = items.filter((i) => (filter === "all" || i.status === filter) &&
    (!ql || `${i.c.name} ${i.c.purifier_id} ${i.c.society}`.toLowerCase().includes(ql)));

  const filterOptions = [
    { id: "all", label: "All Devices", count: items.length },
    { id: "compliant", label: "Compliant", count: compliant },
    { id: "watch", label: "Watch", count: watch },
    { id: "fail", label: "Non-compliant", count: fail },
  ];

  const exportCsv = () => exportToCsv("prowater-water-quality.csv", [
    { label: "Customer", get: (i) => i.c.name },
    { label: "Purifier ID", get: (i) => i.c.purifier_id },
    { label: "Society", get: (i) => i.c.society },
    { label: "Input TDS", get: (i) => i.inTds },
    { label: "Output TDS", get: (i) => i.outTds },
    { label: "Last test", get: (i) => fmtDate(i.lastTest) },
    { label: "Compliance", get: (i) => i.status },
  ], shown);

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#08805A",
          background: "rgba(8, 128, 90, 0.08)",
          padding: "12px 18px",
          borderRadius: 14,
          border: "1px solid rgba(8, 128, 90, 0.18)",
        }}
      >
        <AlertCircle size={15} /> Target output TDS ≤ 100 ppm (BIS drinking-water guidance). Readings reflect representative calibration baselines.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <AppleKpiCard label="Devices Monitored" value={items.length} sub="Active purifier fleet" icon={Droplets} color="#0066CC" bg="rgba(0,102,204,0.1)" />
        <AppleKpiCard label="Compliant Rate" value={`${items.length ? Math.round((compliant / items.length) * 100) : 0}%`} sub={`${compliant} of ${items.length} within standard`} icon={ShieldCheck} color="#08805A" bg="rgba(8,128,90,0.1)" activeDot />
        <AppleKpiCard label="Avg Output TDS" value={`${avgOut} ppm`} sub="Post-RO membrane purification" icon={BarChart3} color="#B45309" bg="rgba(180,83,9,0.1)" />
        <AppleKpiCard label="Tests Due" value={testsDue} sub="Not tested in >60 days" icon={AlertCircle} color="#DC4141" bg="rgba(220,38,38,0.1)" />
      </div>

      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 750, color: "#1D1D1F", margin: 0 }}>Water Quality & Compliance Fleet</h3>
            <p style={{ fontSize: 12.5, color: "#86868B", margin: "3px 0 0" }}>Per-device input/output TDS levels and health status</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 11,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: "#FFFFFF",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              color: "#1D1D1F",
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <AppleSearchBar value={q} onChange={setQ} placeholder="Search customer, purifier or society…" />
          <div style={{ minWidth: 320 }}>
            <AppleSegmentedControl options={filterOptions} value={filter} onChange={setFilter} />
          </div>
        </div>

        <Table head={["Customer", "Purifier", "Society", "Input TDS", "Output TDS", "Last test", "Compliance"]} maxHeight={520}>
          {shown.map((i, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={td}><Person name={i.c.name || "—"} email={i.c.email} /></td>
              <td style={{ ...td, textAlign: "center" }}>{i.c.purifier_id ? <Chip>{i.c.purifier_id}</Chip> : "—"}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5 }}>{i.c.society || "—"}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "#86868B" }}>{i.inTds} ppm</td>
              <td style={{ ...td, textAlign: "center", fontWeight: 700, color: i.status === "fail" ? "#DC4141" : i.status === "watch" ? "#B45309" : "#08805A" }}>{i.outTds} ppm</td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: i.testDue ? "#B45309" : "#86868B" }}>{fmtDate(i.lastTest)}</td>
              <td style={{ ...td, textAlign: "center" }}>{statusChip(i.status)}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 0 }}><Empty msg="No devices match this filter." /></td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
}
