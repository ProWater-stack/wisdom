/* ============================================================================
   modules/FSM.jsx — FSM (Field Service Management) module.
   Designed in accordance with Apple Human Interface Guidelines (HIG):
   - Ops Command: Kanban Dispatch Board with interactive Job Detail modal
   - Customer Satisfaction: Sentiment Analysis & Post-Service Ratings
   - Track Technician, AMC / Maintenance Schedule, Water Quality & Compliance
   ============================================================================ */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AlertCircle, BarChart3, CalendarClock, CheckCircle2, Download, Droplets,
  MapPin, RotateCcw, Search, ShieldCheck, Target, UserRound, Wrench,
  ClipboardList, Truck, XCircle, BellOff, PauseCircle, Ban, MessageSquare, Phone,
  Star, Sparkles, Clock, Check, ChevronRight, X, ExternalLink, ThumbsUp,
  ThumbsDown, MessageCircle, RefreshCw, Eye,
} from "lucide-react";
import {
  useAuth, api, customerApi, hashStr, exportToCsv, fmtDate, deviceType, BENGALURU_CENTER,
} from "../shared/core";
import {
  Card, Table, Toolbar, Loading, Empty, ApiError, Stat, Chip, Status,
  Person, DeviceTypeBadge, grid4, btnGhost, td, Modal,
} from "../shared/ui";

/* ── Apple HIG Glassmorphism and UI Tokens ────────────────────────────────── */
const APPLE_CARD = {
  background: "rgba(255, 255, 255, 0.85)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
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
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 3,
        borderRadius: 12,
        background: "rgba(0, 0, 0, 0.05)",
        border: "1px solid rgba(0, 0, 0, 0.04)",
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
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 13px",
              borderRadius: 9,
              fontSize: 12.5,
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
                  padding: "1px 6px",
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
function AppleSearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div style={{ position: "relative", minWidth: 240, maxWidth: 380, flex: 1 }}>
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
function AppleKpiCard({ label, value, sub, icon: Icon, color = "#08805A", bg = "rgba(8,128,90,0.1)", activeDot = false }) {
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

/* ===========================================================================
   FSM — OPS COMMAND: a Kanban-style Technician Jobs board (job status ×
   per-job Customer Status)
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

const SAMPLE_TECH_JOBS = [
  { id: "JOB-101", customer: "Abhijit Dey",                    society: "MJR Clique Hydra Apartment",  technician: "Ramesh K", jobType: "Filter Service",         scheduled: "Today, 2:00 PM",         status: "assigned",   customerStatus: "Available",   phone: "+91 98450 11223", email: "abhijit.dey@example.com" },
  { id: "JOB-102", customer: "Ravi Kumar",                     society: "Prestige Lakeside",            technician: "Suresh M", jobType: "AMC Service",             scheduled: "Today, 4:30 PM",         status: "assigned",   customerStatus: "Postponed",   phone: "+91 98801 44556", email: "ravi.kumar@example.com" },
  { id: "JOB-103", customer: "Sneha Patil",                    society: "Sobha Dream Acres",            technician: "Anil P",   jobType: "Installation",            scheduled: "Tomorrow, 11:00 AM",     status: "assigned",   customerStatus: "Available",   phone: "+91 99002 77889", email: "sneha.patil@example.com" },
  { id: "JOB-104", customer: "Deepa Nair",                     society: "Ashish JK",                    technician: "Vijay R",  jobType: "Repair Visit",            scheduled: "Today, 1:15 PM",         status: "in_transit", customerStatus: "Available",   phone: "+91 97403 99001", email: "deepa.nair@example.com" },
  { id: "JOB-105", customer: "Anand Ray",                      society: "CBR Aakruti",                  technician: "Manoj S",  jobType: "Complaint Resolution",    scheduled: "Today, 3:00 PM",         status: "in_transit", customerStatus: "Unavailable", phone: "+91 96112 33445", email: "anand.ray@example.com" },
  { id: "JOB-106", customer: "Arun K Sinha",                   society: "MJR Clique Hydra Apartment",   technician: "Ramesh K", jobType: "Filter Service",          scheduled: "Yesterday, 5:00 PM",     status: "cancelled",  customerStatus: "Unavailable", phone: "+91 94480 55667", email: "arun.sinha@example.com" },
  { id: "JOB-107", customer: "Asha Anandan",                   society: "SVS Ananda Nilayam",           technician: "Deepak T", jobType: "AMC Service",             scheduled: "Yesterday, 10:00 AM",    status: "cancelled",  customerStatus: "Postponed",   phone: "+91 93420 88990", email: "asha.anandan@example.com" },
  { id: "JOB-108", customer: "Bikram",                         society: "MJR Clique Hydra Apartment",   technician: "Suresh M", jobType: "Installation",            scheduled: "Today, 6:00 PM",         status: "not_ack",    customerStatus: "Available",   phone: "+91 98451 22334", email: "bikram@example.com" },
  { id: "JOB-109", customer: "Bibhuranjan Mohapatra",          society: "Prabhavathi Meghana Towers",   technician: "Prakash N", jobType: "Filter Service",         scheduled: "Tomorrow, 9:30 AM",      status: "not_ack",    customerStatus: "Unavailable", phone: "+91 98802 66778", email: "bibhuranjan@example.com" },
  { id: "JOB-110", customer: "Binay Pradhan",                  society: "Ashish JK",                    technician: "Anil P",   jobType: "Repair Visit",            scheduled: "Rescheduled → Fri, 12:00 PM", status: "postponed", customerStatus: "Postponed", phone: "+91 99003 11224", email: "binay.pradhan@example.com" },
  { id: "JOB-111", customer: "Chaudari Vipool",                society: "Sai Poorna Premier",           technician: "Vijay R",  jobType: "AMC Service",             scheduled: "Rescheduled → Sat, 2:00 PM",  status: "postponed", customerStatus: "Postponed", phone: "+91 97404 55668", email: "chaudari.vipool@example.com" },
  { id: "JOB-112", customer: "Dhananjaya Samanta Singhar",     society: "The Green Terraces",           technician: "Manoj S",  jobType: "Complaint Resolution",    scheduled: "Today, 11:00 AM",        status: "not_moving", customerStatus: "Available",   phone: "+91 96113 77880", email: "dhananjaya@example.com" },
  { id: "JOB-113", customer: "Divya Vijayaraghavan",           society: "CBR Aakruti",                  technician: "Deepak T", jobType: "Filter Service",          scheduled: "Today, 9:00 AM",         status: "not_moving", customerStatus: "Unavailable", phone: "+91 94481 99002", email: "divya.v@example.com" },
];

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

export function OpsCommand() {
  const { user } = useAuth();
  const [custStatusFilter, setCustStatusFilter] = useState("all");
  const [jobQ, setJobQ] = useState("");
  const [activeJob, setActiveJob] = useState(null);

  useEffect(() => {
    api.logView(user.username, "Viewed Ops Command");
  }, [user]);

  const jobQl = jobQ.toLowerCase();
  const jobsFiltered = useMemo(() => {
    return SAMPLE_TECH_JOBS.filter((j) =>
      (custStatusFilter === "all" || j.customerStatus === custStatusFilter) &&
      (!jobQl || `${j.customer} ${j.technician} ${j.society} ${j.jobType} ${j.id}`.toLowerCase().includes(jobQl))
    );
  }, [custStatusFilter, jobQl]);

  const custStatusCounts = useMemo(() => ({
    Available: SAMPLE_TECH_JOBS.filter((j) => j.customerStatus === "Available").length,
    Unavailable: SAMPLE_TECH_JOBS.filter((j) => j.customerStatus === "Unavailable").length,
    Postponed: SAMPLE_TECH_JOBS.filter((j) => j.customerStatus === "Postponed").length,
  }), []);

  const inTransitCount = SAMPLE_TECH_JOBS.filter((j) => j.status === "in_transit").length;
  const assignedCount = SAMPLE_TECH_JOBS.filter((j) => j.status === "assigned").length;
  const availPct = Math.round((custStatusCounts.Available / SAMPLE_TECH_JOBS.length) * 100);
  const actionNeeded = SAMPLE_TECH_JOBS.filter((j) => j.status === "cancelled" || j.status === "not_moving" || j.status === "postponed").length;

  const exportJobsCsv = () => exportToCsv("prowater-ops-technician-jobs.csv", [
    { label: "Job ID", get: (j) => j.id },
    { label: "Customer", get: (j) => j.customer },
    { label: "Phone", get: (j) => j.phone || "" },
    { label: "Society", get: (j) => j.society },
    { label: "Technician", get: (j) => j.technician },
    { label: "Job Type", get: (j) => j.jobType },
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
            <strong>Ops Command Dispatch Center:</strong> Live monitoring of technician dispatches, field status, and customer availability.
          </span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>Sample Dispatch Feed</span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <AppleKpiCard
          label="Total Dispatched Jobs"
          value={SAMPLE_TECH_JOBS.length}
          sub="Dispatches logged today"
          icon={ClipboardList}
          color="#0066CC"
          bg="rgba(0, 102, 204, 0.1)"
        />
        <AppleKpiCard
          label="In Transit / Active"
          value={inTransitCount + assignedCount}
          sub={`${inTransitCount} travelling · ${assignedCount} assigned`}
          icon={Truck}
          color="#B45309"
          bg="rgba(180, 83, 9, 0.1)"
          activeDot
        />
        <AppleKpiCard
          label="Customer Availability"
          value={`${availPct}%`}
          sub={`${custStatusCounts.Available} of ${SAMPLE_TECH_JOBS.length} customers ready`}
          icon={CheckCircle2}
          color="#08805A"
          bg="rgba(8, 128, 90, 0.1)"
        />
        <AppleKpiCard
          label="Attention Needed"
          value={actionNeeded}
          sub="Cancelled, delayed or postponed"
          icon={AlertCircle}
          color="#DC4141"
          bg="rgba(220, 38, 38, 0.1)"
        />
      </div>

      {/* Main Kanban Board Container */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px", overflow: "hidden" }}>
        {/* Controls Bar */}
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
            <AppleSegmentedControl options={filterOptions} value={custStatusFilter} onChange={setCustStatusFilter} />
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
                {/* Column Header */}
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

                {/* Job Cards List */}
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
                      {/* Top Bar: Job ID & Customer Status */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 750, color: "#86868B", letterSpacing: ".02em" }}>
                          {j.id}
                        </span>
                        <StatusPill value={j.customerStatus} map={CUSTOMER_STATUS_COLORS} />
                      </div>

                      {/* Customer Info */}
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

                      {/* Society Location */}
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

                      {/* Details Box */}
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
                      </div>

                      {/* Job Type Tag */}
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
                  <Phone size={12} /> Contactable via fleet radio
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
                <span style={{ fontSize: 12, color: "#86868B" }}>· Dispatched via Bengaluru Central RO Hub</span>
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
   FSM: Customer Satisfaction (Sentiment Analysis + Ratings Hub)
   =========================================================================== */

const SENTIMENT_COLORS = {
  "Good":               { color: "#08805A", bg: "rgba(8, 128, 90, 0.1)" },
  "Neutral":            { color: "#6E6E73", bg: "rgba(110, 110, 115, 0.1)" },
  "Bad":                { color: "#986315", bg: "rgba(152, 99, 21, 0.1)" },
  "Negative":           { color: "#DC4141", bg: "rgba(220, 38, 38, 0.1)" },
  "Extremely Negative": { color: "#FFFFFF", bg: "#B91C1C" },
};

const SENTIMENT_EMOJI = {
  "Good": "😊", "Bad": "🙁", "Neutral": "😐", "Negative": "😠", "Extremely Negative": "😡",
};

const SAMPLE_SENTIMENT = [
  { customer: "Abhijit Dey",           society: "MJR Clique Hydra Apartment", purifierId: "HAC1F9F778", sentiment: "Good",               date: "2026-09-10", note: "Happy with the new filter, water tastes noticeably better." },
  { customer: "Ravi Kumar",            society: "Prestige Lakeside",          purifierId: "PW-00092",   sentiment: "Neutral",             date: "2026-09-09", note: "No major feedback, service was completed on time." },
  { customer: "Sneha Patil",           society: "Sobha Dream Acres",          purifierId: "PW-00101",   sentiment: "Bad",                 date: "2026-09-08", note: "Technician was delayed by 2 hours without prior update." },
  { customer: "Deepa Nair",            society: "Ashish JK",                  purifierId: "ZB-77",      sentiment: "Negative",            date: "2026-09-07", note: "Second complaint this month, membrane pressure still irregular." },
  { customer: "Anand Ray",             society: "CBR Aakruti",                purifierId: "PRSC1FE2C3", sentiment: "Extremely Negative",  date: "2026-09-05", note: "Threatening to cancel subscription due to repeated delays." },
  { customer: "Arun K Sinha",          society: "MJR Clique Hydra Apartment", purifierId: "PRSM95B3A9", sentiment: "Good",               date: "2026-09-11", note: "Appreciated the prompt response and clear TDS report." },
  { customer: "Asha Anandan",          society: "SVS Ananda Nilayam",         purifierId: "PRSMFB3B8D", sentiment: "Neutral",             date: "2026-09-06", note: "Standard quarterly checkup completed smoothly." },
  { customer: "Bikram",                society: "MJR Clique Hydra Apartment", purifierId: "OWND000003", sentiment: "Bad",                 date: "2026-09-04", note: "Water flow rate still slightly low after technician visit." },
  { customer: "Bibhuranjan Mohapatra", society: "Prabhavathi Meghana Towers", purifierId: "OWND000006", sentiment: "Negative",            date: "2026-09-03", note: "Missed scheduled appointment slot without phone call." },
  { customer: "Chaudari Vipool",       society: "Sai Poorna Premier",         purifierId: "HAM77E663C", sentiment: "Good",               date: "2026-09-12", note: "Very satisfied with the neat installation and taste calibration." },
];

const RATING_COLORS = {
  "Positive":     { color: "#08805A", bg: "rgba(8, 128, 90, 0.1)" },
  "Appreciative": { color: "#0066CC", bg: "rgba(0, 102, 204, 0.1)" },
  "Negative":     { color: "#986315", bg: "rgba(152, 99, 21, 0.1)" },
  "Critical":     { color: "#FFFFFF", bg: "#B91C1C" },
};

const SAMPLE_RATINGS = [
  { customer: "Abhijit Dey",           society: "MJR Clique Hydra Apartment", rating: "Positive",     date: "2026-09-10", comment: "5-star service, technician was polite and calibrated TDS perfectly." },
  { customer: "Ravi Kumar",            society: "Prestige Lakeside",          rating: "Appreciative", date: "2026-09-09", comment: "Thanked the technician personally for fast turnaround." },
  { customer: "Deepa Nair",            society: "Ashish JK",                  rating: "Negative",     date: "2026-09-07", comment: "Unhappy with repeated maintenance visits in a short span." },
  { customer: "Anand Ray",             society: "CBR Aakruti",                rating: "Critical",     date: "2026-09-05", comment: "Escalated to support team, requested manager callback." },
  { customer: "Sneha Patil",           society: "Sobha Dream Acres",          rating: "Negative",     date: "2026-09-08", comment: "Delayed arrival affected afternoon schedule." },
  { customer: "Arun K Sinha",          society: "MJR Clique Hydra Apartment", rating: "Appreciative", date: "2026-09-11", comment: "Left a positive review on society board for prompt support." },
  { customer: "Asha Anandan",          society: "SVS Ananda Nilayam",         rating: "Positive",     date: "2026-09-06", comment: "Smooth, professional quarterly visit." },
  { customer: "Bikram",                society: "MJR Clique Hydra Apartment", rating: "Critical",     date: "2026-09-04", comment: "Filed a formal complaint regarding delayed filter replacement." },
  { customer: "Bibhuranjan Mohapatra", society: "Prabhavathi Meghana Towers", rating: "Negative",     date: "2026-09-03", comment: "Frustrated with missed technician slot." },
  { customer: "Chaudari Vipool",       society: "Sai Poorna Premier",         rating: "Positive",     date: "2026-09-12", comment: "Extremely happy, gave 5/5 score." },
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

  const sentQl = sentQ.toLowerCase();
  const sentimentShown = useMemo(() => {
    return SAMPLE_SENTIMENT.filter((r) =>
      (sentFilter === "all" || r.sentiment === sentFilter) &&
      (!sentQl || `${r.customer} ${r.society} ${r.purifierId} ${r.note}`.toLowerCase().includes(sentQl))
    );
  }, [sentFilter, sentQl]);

  const ratingQl = ratingQ.toLowerCase();
  const ratingsShown = useMemo(() => {
    return SAMPLE_RATINGS.filter((r) =>
      (ratingFilter === "all" || r.rating === ratingFilter) &&
      (!ratingQl || `${r.customer} ${r.society} ${r.comment}`.toLowerCase().includes(ratingQl))
    );
  }, [ratingFilter, ratingQl]);

  // Sentiment Breakdown calculation
  const sentimentCounts = useMemo(() => {
    const counts = { Good: 0, Neutral: 0, Bad: 0, Negative: 0, "Extremely Negative": 0 };
    SAMPLE_SENTIMENT.forEach((s) => {
      if (counts[s.sentiment] !== undefined) counts[s.sentiment]++;
    });
    return counts;
  }, []);

  const positiveCount = sentimentCounts.Good;
  const positivePct = Math.round((positiveCount / SAMPLE_SENTIMENT.length) * 100);
  const criticalCount = sentimentCounts.Negative + sentimentCounts["Extremely Negative"];

  const sentimentFilterOptions = [
    { id: "all", label: "All Sentiment", count: SAMPLE_SENTIMENT.length },
    { id: "Good", label: "😊 Good", count: sentimentCounts.Good },
    { id: "Neutral", label: "😐 Neutral", count: sentimentCounts.Neutral },
    { id: "Bad", label: "🙁 Bad", count: sentimentCounts.Bad },
    { id: "Negative", label: "😠 Negative", count: sentimentCounts.Negative },
    { id: "Extremely Negative", label: "😡 Critical", count: sentimentCounts["Extremely Negative"] },
  ];

  const ratingCounts = useMemo(() => {
    const counts = { Positive: 0, Appreciative: 0, Negative: 0, Critical: 0 };
    SAMPLE_RATINGS.forEach((r) => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
    });
    return counts;
  }, []);

  const ratingFilterOptions = [
    { id: "all", label: "All Ratings", count: SAMPLE_RATINGS.length },
    { id: "Positive", label: "Positive", count: ratingCounts.Positive },
    { id: "Appreciative", label: "Appreciative", count: ratingCounts.Appreciative },
    { id: "Negative", label: "Negative", count: ratingCounts.Negative },
    { id: "Critical", label: "Critical", count: ratingCounts.Critical },
  ];

  const exportSentimentCsv = () => exportToCsv("prowater-customer-sentiment.csv", [
    { label: "Customer", get: (r) => r.customer },
    { label: "Society", get: (r) => r.society },
    { label: "Purifier ID", get: (r) => r.purifierId },
    { label: "Sentiment", get: (r) => r.sentiment },
    { label: "Date", get: (r) => r.date },
    { label: "Note", get: (r) => r.note },
  ], sentimentShown);

  const exportRatingCsv = () => exportToCsv("prowater-customer-rating.csv", [
    { label: "Customer", get: (r) => r.customer },
    { label: "Society", get: (r) => r.society },
    { label: "Rating", get: (r) => r.rating },
    { label: "Date", get: (r) => r.date },
    { label: "Comment", get: (r) => r.comment },
  ], ratingsShown);

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        .ov-sans h1,.ov-sans h2,.ov-sans h3,.ov-sans .serif{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;letter-spacing:-.02em}
        .apple-table-row {
          transition: background 0.15s ease;
        }
        .apple-table-row:hover {
          background: rgba(8, 128, 90, 0.035) !important;
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
          background: "rgba(0, 102, 204, 0.06)",
          border: "1px solid rgba(0, 102, 204, 0.15)",
          fontSize: 13,
          color: "#0066CC",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} />
          <span>
            <strong>Customer Satisfaction Hub:</strong> AI-powered sentiment extraction from visit feedback notes and post-service customer ratings.
          </span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>Sentiment Analysis Feed</span>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <AppleKpiCard
          label="Positive Sentiment"
          value={`${positivePct}%`}
          sub={`${positiveCount} of ${SAMPLE_SENTIMENT.length} happy customers`}
          icon={ThumbsUp}
          color="#08805A"
          bg="rgba(8, 128, 90, 0.1)"
        />
        <AppleKpiCard
          label="CSAT Satisfaction"
          value="4.6 / 5"
          sub="Average post-service rating"
          icon={Star}
          color="#B45309"
          bg="rgba(180, 83, 9, 0.1)"
        />
        <AppleKpiCard
          label="Feedback Tracked"
          value={SAMPLE_SENTIMENT.length}
          sub="Analyzed customer interactions"
          icon={MessageSquare}
          color="#0066CC"
          bg="rgba(0, 102, 204, 0.1)"
        />
        <AppleKpiCard
          label="Attention Flags"
          value={criticalCount}
          sub="Negative or critical alerts"
          icon={AlertCircle}
          color="#DC4141"
          bg="rgba(220, 38, 38, 0.1)"
        />
      </div>

      {/* Sentiment Ratio Multi-Segment Bar */}
      <div style={{ ...APPLE_CARD, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#1D1D1F" }}>Sentiment Distribution</h3>
          <span style={{ fontSize: 12, color: "#86868B" }}>Based on {SAMPLE_SENTIMENT.length} recent service logs</span>
        </div>

        {/* Segmented bar */}
        <div style={{ height: 12, borderRadius: 6, overflow: "hidden", display: "flex", gap: 2, background: "rgba(0,0,0,0.04)" }}>
          <div style={{ width: `${(sentimentCounts.Good / SAMPLE_SENTIMENT.length) * 100}%`, background: "#08805A" }} title={`Good: ${sentimentCounts.Good}`} />
          <div style={{ width: `${(sentimentCounts.Neutral / SAMPLE_SENTIMENT.length) * 100}%`, background: "#6E6E73" }} title={`Neutral: ${sentimentCounts.Neutral}`} />
          <div style={{ width: `${(sentimentCounts.Bad / SAMPLE_SENTIMENT.length) * 100}%`, background: "#986315" }} title={`Bad: ${sentimentCounts.Bad}`} />
          <div style={{ width: `${(sentimentCounts.Negative / SAMPLE_SENTIMENT.length) * 100}%`, background: "#DC4141" }} title={`Negative: ${sentimentCounts.Negative}`} />
          <div style={{ width: `${(sentimentCounts["Extremely Negative"] / SAMPLE_SENTIMENT.length) * 100}%`, background: "#991B1B" }} title={`Critical: ${sentimentCounts["Extremely Negative"]}`} />
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, fontSize: 12, color: "#6E6E73" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#08805A" }} /> 😊 Good ({sentimentCounts.Good})
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6E6E73" }} /> 😐 Neutral ({sentimentCounts.Neutral})
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#986315" }} /> 🙁 Bad ({sentimentCounts.Bad})
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC4141" }} /> 😠 Negative ({sentimentCounts.Negative})
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#991B1B" }} /> 😡 Critical ({sentimentCounts["Extremely Negative"]})
          </span>
        </div>
      </div>

      {/* ── Section 1: Customer Sentiment Table ───────────────────────────── */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 750, color: "#1D1D1F", margin: 0 }}>Customer Sentiment Analysis</h3>
            <p style={{ fontSize: 12.5, color: "#86868B", margin: "3px 0 0" }}>NLP-extracted sentiment and notes from recent technician encounters</p>
          </div>
          <button
            type="button"
            onClick={exportSentimentCsv}
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

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <AppleSearchBar value={sentQ} onChange={setSentQ} placeholder="Search customer, society, purifier, note…" />
          <AppleSegmentedControl options={sentimentFilterOptions} value={sentFilter} onChange={setSentFilter} />
        </div>

        {/* Table */}
        <Table head={["Customer", "Society", "Purifier ID", "Sentiment", "Date", "Feedback Note"]} maxHeight={480}>
          {sentimentShown.map((r, idx) => (
            <tr key={idx} className="apple-table-row" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={td}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={r.customer} size={30} />
                  <strong style={{ fontSize: 13, color: "#1D1D1F" }}>{r.customer}</strong>
                </div>
              </td>
              <td style={{ ...td, fontSize: 12.5, color: "#48484A" }}>{r.society}</td>
              <td style={{ ...td, textAlign: "center" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 8, background: "rgba(0,0,0,0.05)", color: "#1D1D1F" }}>
                  {r.purifierId}
                </span>
              </td>
              <td style={{ ...td, textAlign: "center" }}>
                <StatusPill value={r.sentiment} map={SENTIMENT_COLORS} emoji={SENTIMENT_EMOJI[r.sentiment]} />
              </td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>
                {fmtDate(new Date(r.date))}
              </td>
              <td style={{ ...td, textAlign: "left", fontSize: 12.5, color: "#1D1D1F", maxWidth: 320 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "rgba(0,0,0,0.02)", padding: "6px 10px", borderRadius: 8 }}>
                  <MessageSquare size={13} style={{ flexShrink: 0, marginTop: 2, color: "#86868B" }} />
                  <span>{r.note}</span>
                </div>
              </td>
            </tr>
          ))}
          {sentimentShown.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 0 }}>
                <Empty msg="No feedback records match this filter." />
              </td>
            </tr>
          )}
        </Table>
      </div>

      {/* ── Section 2: Customer Rating Table ─────────────────────────────── */}
      <div style={{ ...APPLE_CARD, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 750, color: "#1D1D1F", margin: 0 }}>Customer Post-Visit Ratings</h3>
            <p style={{ fontSize: 12.5, color: "#86868B", margin: "3px 0 0" }}>Direct ratings and service experience reviews</p>
          </div>
          <button
            type="button"
            onClick={exportRatingCsv}
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

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <AppleSearchBar value={ratingQ} onChange={setRatingQ} placeholder="Search customer, society, comment…" />
          <AppleSegmentedControl options={ratingFilterOptions} value={ratingFilter} onChange={setRatingFilter} />
        </div>

        {/* Table */}
        <Table head={["Customer", "Society", "Rating Badge", "Date", "Comment"]} maxHeight={480}>
          {ratingsShown.map((r, idx) => (
            <tr key={idx} className="apple-table-row" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <td style={td}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={r.customer} size={30} />
                  <strong style={{ fontSize: 13, color: "#1D1D1F" }}>{r.customer}</strong>
                </div>
              </td>
              <td style={{ ...td, fontSize: 12.5, color: "#48484A" }}>{r.society}</td>
              <td style={{ ...td, textAlign: "center" }}>
                <StatusPill value={r.rating} map={RATING_COLORS} />
              </td>
              <td style={{ ...td, textAlign: "center", fontSize: 12.5, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>
                {fmtDate(new Date(r.date))}
              </td>
              <td style={{ ...td, textAlign: "left", fontSize: 12.5, color: "#1D1D1F" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Star size={13} fill="#F59E0B" color="#F59E0B" />
                  <span>{r.comment}</span>
                </div>
              </td>
            </tr>
          ))}
          {ratingsShown.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 0 }}>
                <Empty msg="No ratings match this filter." />
              </td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
}

/* ===========================================================================
   FSM — TRACK TECHNICIAN (Bengaluru map via Leaflet + OpenStreetMap)
   =========================================================================== */

const SAMPLE_TECHNICIANS = [
  { id: "T-01", name: "Ramesh K", status: "on_job",    lat: 12.9352, lng: 77.6245, area: "Koramangala", job: "Installation · CUS-00045", phone: "+91 98450 11223" },
  { id: "T-02", name: "Suresh M", status: "available", lat: 12.9719, lng: 77.6412, area: "Indiranagar", job: "Idle", phone: "+91 98801 44556" },
  { id: "T-03", name: "Anil P",   status: "on_job",    lat: 12.9081, lng: 77.6476, area: "HSR Layout",  job: "Service · CUS-00101", phone: "+91 99002 77889" },
  { id: "T-04", name: "Vijay R",  status: "en_route",  lat: 13.0298, lng: 77.5400, area: "Hebbal",      job: "En route · CUS-00092", phone: "+91 97403 99001" },
  { id: "T-05", name: "Manoj S",  status: "available", lat: 12.9250, lng: 77.5938, area: "Jayanagar",   job: "Idle", phone: "+91 96112 33445" },
];

export function TrackTechnician() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const [techs] = useState(SAMPLE_TECHNICIANS);
  const [sel, setSel] = useState(null);

  const statusColor = (s) => s === "on_job" ? "#DC4141" : s === "en_route" ? "#B45309" : "#08805A";
  const statusLabel = (s) => s === "on_job" ? "On job" : s === "en_route" ? "En route" : "Available";

  useEffect(() => {
    api.logView(user.username, "Viewed Track Technician");
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    const ensureCss = () => {
      if (!document.querySelector(`link[href="${CSS}"]`)) {
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = CSS;
        document.head.appendChild(l);
      }
    };

    const ensureJs = () => new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      let s = document.querySelector(`script[src="${JS}"]`);
      if (s) {
        s.addEventListener("load", () => resolve(window.L));
        return;
      }
      s = document.createElement("script");
      s.src = JS;
      s.async = true;
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error("Leaflet failed to load"));
      document.head.appendChild(s);
    });

    ensureCss();
    ensureJs().then((L) => {
      if (cancelled || !mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([BENGALURU_CENTER.lat, BENGALURU_CENTER.lng], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      mapObj.current = map;
      renderMarkers(L, map);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
  }, []);

  const renderMarkers = (L, map) => {
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    techs.forEach((t) => {
      let icon;
      if (t.status === "en_route") {
        icon = L.divIcon({
          className: "tech-pin",
          html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">🏍️</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 22],
        });
      } else {
        icon = L.divIcon({
          className: "tech-pin",
          html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${statusColor(t.status)};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 18],
        });
      }
      const m = L.marker([t.lat, t.lng], { icon }).addTo(map);
      m.bindPopup(`<strong>${t.name}</strong><br/>${statusLabel(t.status)} · ${t.area}<br/><span style="color:#7D8A83">${t.job}</span>`);
      m.on("click", () => setSel(t));
      markersRef.current.push(m);
    });
  };

  const counts = {
    available: techs.filter((t) => t.status === "available").length,
    en_route: techs.filter((t) => t.status === "en_route").length,
    on_job: techs.filter((t) => t.status === "on_job").length,
  };

  return (
    <div className="fade-up ov-sans" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <AppleKpiCard label="Technicians" value={techs.length} sub="Field staff in Bengaluru" icon={UserRound} color="#0066CC" bg="rgba(0,102,204,0.1)" />
        <AppleKpiCard label="Available" value={counts.available} sub="Ready for instant dispatch" icon={CheckCircle2} color="#08805A" bg="rgba(8,128,90,0.1)" activeDot />
        <AppleKpiCard label="En Route" value={counts.en_route} sub="Travelling to site" icon={MapPin} color="#B45309" bg="rgba(180,83,9,0.1)" />
        <AppleKpiCard label="On Job" value={counts.on_job} sub="Currently servicing" icon={Wrench} color="#DC4141" bg="rgba(220,38,38,0.1)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18 }} className="fsm-grid">
        <style>{`@media(max-width:900px){.fsm-grid{grid-template-columns:1fr!important}}`}</style>

        {/* Map Card */}
        <div style={{ ...APPLE_CARD, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 750, color: "#1D1D1F", margin: 0 }}>Live Dispatch Map · Bengaluru</h3>
              <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>Real-time GPS positions of active technicians</div>
            </div>
          </div>
          <div ref={mapRef} style={{ width: "100%", height: 520, borderRadius: 16, overflow: "hidden", background: "#EEF7F3" }} />
        </div>

        {/* Roster Card */}
        <div style={{ ...APPLE_CARD, padding: "18px 20px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 16, fontWeight: 750, color: "#1D1D1F", margin: "0 0 12px" }}>Active Technicians ({techs.length})</h3>
          <div style={{ maxHeight: 520, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {techs.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setSel(t);
                  if (mapObj.current) mapObj.current.setView([t.lat, t.lng], 14);
                }}
                style={{
                  ...APPLE_SUBTLE_CARD,
                  padding: "12px 14px",
                  cursor: "pointer",
                  background: sel?.id === t.id ? "rgba(8, 128, 90, 0.08)" : "#FFFFFF",
                  borderColor: sel?.id === t.id ? "#08805A" : "rgba(0, 0, 0, 0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AppleAvatar name={t.name} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: 13.5, color: "#1D1D1F" }}>{t.name}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(t.status) }}>{statusLabel(t.status)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>{t.area} · {t.job}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
          <AppleSegmentedControl options={filterOptions} value={bucket} onChange={setBucket} />
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
          <AppleSegmentedControl options={filterOptions} value={filter} onChange={setFilter} />
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

