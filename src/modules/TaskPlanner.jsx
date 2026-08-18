/* ===========================================================================
   modules/TaskPlanner.jsx — Task Planner module.
   ClickUp-style Kanban board: local-first tasks (localStorage pw_tasks),
   assignee/priority/status/sprint/category metadata, drag-and-drop across
   status columns, IndexedDB-backed attachments with Firebase Storage upload.
   =========================================================================== */
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, Bell, CalendarDays, Check, CheckCircle2, ChevronRight,
  GripVertical, Hourglass, Paperclip, Plus, RefreshCw, RotateCcw, Search,
  Tag, Trash2, TrendingUp, X,
} from "lucide-react";
import {
  BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  useAuth, api, norm, LS, API_ORIGIN, fmtDate, fmtTime,
} from "../shared/core";
import {
  btnGhost, btnPrimary, td, trStyle, grid4, axisTick, selectStyle, toastStyle,
  renderPieLabel, pieLabelLine, Card, Empty, Stat, TT, Table, iconBtn, inp,
  overlay,
} from "../shared/ui";

/* ===========================================================================
   TASK PLANNER — ClickUp-style Kanban board (Task Planner module).
   Local-first: tasks persist to localStorage (pw_tasks). Cards carry an
   assignee, email, notes, attachments, start/end dates and a priority, and
   move across 7 status columns via drag-and-drop.
   =========================================================================== */
export const PLAN_STATUSES_DEFAULT = [
  { key: "New",          color: "#2A86D6", bg: "#E5F0FA" },
  { key: "Picked Up",    color: "#2A86D6", bg: "#E5F0FA" },
  { key: "In-Progress",  color: "#986315", bg: "#FBF0E0" },
  { key: "Testing & QA", color: "#2A86D6", bg: "#E5F0FA" },
  { key: "Staging",      color: "#2A86D6", bg: "#E5F0FA" },
  { key: "Live",         color: "#08805A", bg: "#E2F3EE" },
];
export const PLAN_USERS = ["Anis", "Sujan", "Harsh", "Sri", "Arjun", "Pranshu", "Arun", "IQ Labs", "Zoho Vendor", "The Group"];
// Priority scale (P0 = highest). Colours mirror the source sprint sheet.
export const PLAN_PRIORITIES = [
  { key: "P0", color: "#DC4141" },
  { key: "P1", color: "#986315" },
  { key: "P2", color: "#08805A" },
  { key: "P3", color: "#2A86D6" },
];
export const PLAN_SPRINTS_DEFAULT = ["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Backlog"];
// Legacy priority labels → P-scale (for tasks created before the switch).
export const PLAN_PRIO_MIGRATE = { Low: "P3", Medium: "P2", High: "P1", Urgent: "P0" };
export const PLAN_AVATAR_COLORS = ["#0A9D6E", "#0B6F52", "#0B6F52", "#986315", "#DC4141", "#2A86D6", "#2A86D6", "#2A86D6", "#DC4141", "#2A86D6"];
// "The Group" tag means exactly these five people (not the vendors / Arun).
export const PLAN_GROUP = ["Anis", "Sujan", "Harsh", "Sri", "Arjun"];
// Business-requirement categories every task is filed under.
export const PLAN_CATEGORIES_DEFAULT = [
  { key: "Infrastructure",    color: "#2A86D6" },
  { key: "Accounts & Access", color: "#2A86D6" },
  { key: "Marketing",         color: "#986315" },
  { key: "Mobile App",        color: "#0B6F52" },
  { key: "Backend & APIs",    color: "#2A86D6" },
  { key: "IoT",               color: "#986315" },
  { key: "Ticketing",         color: "#DC4141" },
  { key: "Ops & Finance",     color: "#08805A" },
  { key: "Review & QA",       color: "#0B6F52" },
  { key: "Messaging",         color: "#128c7e" },
  { key: "Personal",          color: "#7D8A83" },
  // Sprint-board categories (from the product task sheet).
  { key: "Customer App",      color: "#08805A" },
  { key: "Technician App",    color: "#0B6F52" },
  { key: "PW Website",        color: "#2A86D6" },
  { key: "Zoho CRM",          color: "#986315" },
  { key: "Zoho ERP",          color: "#986315" },
  { key: "Zoho Billing",      color: "#DC4141" },
  { key: "Zoho Inventory",    color: "#2A86D6" },
  { key: "Zoho FSM",          color: "#0B6F52" },
  { key: "Freshdesk",         color: "#2A86D6" },
  { key: "Bug Fixes",         color: "#DC4141" },
  { key: "Form",              color: "#0A9D6E" },
  { key: "Wisdom",            color: "#2A86D6" },
];

/* ---- Editable task config (admins manage via the "Modify Tasks" panel) ------
   Statuses, Sprints and Categories start from the defaults above but can be
   extended/edited by an admin; overrides persist to localStorage. */
export const PLAN_PALETTE = ["#2A86D6", "#2A86D6", "#986315", "#0B6F52", "#2A86D6", "#986315", "#DC4141", "#08805A", "#0B6F52", "#128c7e", "#DC4141", "#0A9D6E", "#2A86D6", "#08805A"];
export const planPickColor = (i) => PLAN_PALETTE[(i >= 0 ? i : 0) % PLAN_PALETTE.length];
// A light background tint of a status colour (for the board column bg).
export const planTint = (hex) => {
  const h = String(hex || "#A9B3AC").replace("#", "");
  const full = h.length === 3 ? h.split("").map(x => x + x).join("") : h;
  const n = parseInt(full, 16) || 0;
  const mix = (c) => Math.round(c + (255 - c) * 0.88);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
};
export let PLAN_STATUSES = LS.get("pw_plan_statuses", null) || PLAN_STATUSES_DEFAULT;
export let PLAN_SPRINTS = LS.get("pw_plan_sprints", null) || PLAN_SPRINTS_DEFAULT;
export let PLAN_CATEGORIES = LS.get("pw_plan_categories", null) || PLAN_CATEGORIES_DEFAULT;
export const setPlanStatuses = (v) => { PLAN_STATUSES = v; LS.set("pw_plan_statuses", v); };
export const setPlanSprints = (v) => { PLAN_SPRINTS = v; LS.set("pw_plan_sprints", v); };
export const setPlanCategories = (v) => { PLAN_CATEGORIES = v; LS.set("pw_plan_categories", v); };
export const planCatMeta = (k) => PLAN_CATEGORIES.find(c => c.key === k) || { key: k || "General", color: "#7D8A83" };

// Seed backlog — the agreed "next steps" list. Imported once into a fresh board
// (see the seeding logic in TaskPlanner). { t: title, n: notes, a: assignees, c: category }.
export const PLAN_SEED_TASKS = [
  { t: "Review Cloud Infrastructure", n: "Verify all cloud services in the master asset reference. Ensure accurate consolidation of infrastructure details.", a: ["The Group"], c: "Infrastructure" },
  { t: "Grant Google Play Access", n: "Provide Sri with the necessary permissions for the application publishing console.", a: ["Arjun"], c: "Accounts & Access" },
  { t: "Setup Twilio Account", n: "Create a new company account for communication services and perform the switch.", a: ["The Group"], c: "Infrastructure" },
  { t: "Share Twitter Access", n: "Invite Anis to the company Twitter account to resolve current access limitations.", a: ["Arjun"], c: "Accounts & Access" },
  { t: "Purchase Cloud Team Plan", n: "Acquire a team subscription for cloud access to enable multi-user usage.", a: ["The Group"], c: "Infrastructure" },
  { t: "Review Backend Invoices", n: "Analyze monthly backend invoices for all active services to ensure budget accuracy.", a: ["Anis"], c: "Ops & Finance" },
  { t: "Migrate to Zoho Desk", n: "Transition ticketing services from Freshdesk to Zoho Desk.", a: ["The Group"], c: "Ticketing" },
  { t: "Renew Passports", n: "Submit applications for personal passport renewal before the expiration dates.", a: ["Arjun", "Anis"], priority: "High", c: "Personal" },
  { t: "Calculate Monthly Costs", n: "Use a tool to aggregate and calculate total recurring monthly expenses.", a: ["The Group"], c: "Ops & Finance" },
  { t: "Review Stories", n: "Evaluate 95 stories to identify those that have been implemented and mark them as complete by highlighting them in yellow.", a: ["Anis"], c: "Review & QA" },
  { t: "Create Social Accounts", n: "Establish official accounts on social media platforms including Facebook and LinkedIn to enhance social presence.", a: ["The Group"], c: "Accounts & Access" },
  { t: "Optimize Website", n: "Investigate the root cause of the increased website load speed and apply required performance improvements.", a: ["Anis"], c: "Marketing" },
  { t: "Review Documentation", n: "Perform a parallel review of the status of documented stories alongside the updates made to the records.", a: ["Arjun"], c: "Review & QA" },
  { t: "Create Staging", n: "Create a subdomain for staging and configure a GitHub action to enable automatic deployment to that environment.", a: ["Harsh"], c: "Backend & APIs" },
  { t: "Get Backlinks", n: "Obtain backlinks from the DrinkTime website to improve the domain page rank.", a: ["Arjun"], c: "Marketing" },
  { t: "Request Keys", n: "Request API keys and secrets from Anis to provide them to Sri for integration purposes.", a: ["Arjun"], c: "Accounts & Access" },
  { t: "Integrate Technician App", n: "Integrate the technician application with the ticketing system to enable ticket assignment and management.", a: ["Sri"], c: "Ticketing" },
  { t: "Review Checklist", n: "Verify the comprehensiveness of the website checklist to ensure all current implementations are included.", a: ["The Group"], c: "Review & QA" },
  { t: "Update APIs", n: "Implement error handling and proper response type management for all API specifications.", a: ["Harsh"], c: "Backend & APIs" },
  { t: "Build Middleware", n: "Develop IoT middleware to detect sensor anomalies and ensure persistent storage of data.", a: ["Harsh"], c: "IoT" },
  { t: "Alert System", n: "Implement an automated alert system for anomalies that triggers WhatsApp notifications, SMS, and outbound calls.", a: ["Harsh"], c: "IoT" },
  { t: "Build Backend", n: "Develop the backend logic to support customer profile updates for email addresses and phone numbers.", a: ["Sri"], c: "Backend & APIs" },
  { t: "Integrate Chat", n: "Incorporate in-app chat service functionality into the application.", a: ["Sri", "Sujan"], c: "Mobile App" },
  { t: "Test Automation", n: "Develop basic test automation within FlutterFlow.", a: ["Sri", "Sujan"], c: "Mobile App" },
  { t: "Explore Firebase", n: "Investigate Firebase Test Labs as a potential solution for automation testing.", a: ["Sri"], c: "Mobile App" },
  { t: "Enable Biometrics", n: "Implement biometric login capabilities on the customer application.", a: ["Sri", "Sujan"], c: "Mobile App" },
  { t: "Update Profile", n: "Complete email address and phone number updates on the customer application.", a: ["Sri", "Sujan"], c: "Mobile App" },
  { t: "Backend Development", n: "Implement backend functionality for all discussed application features.", a: ["Sri", "Sujan"], c: "Backend & APIs" },
  { t: "Fix APIs", n: "Review internal APIs and perform necessary repairs to ensure proper operation.", a: ["Sri"], c: "Backend & APIs" },
  { t: "Develop IoT", n: "Build the IoT core, database, and anomaly detection system.", a: ["Harsh"], c: "IoT" },
  { t: "Automate CI/CD", n: "Explore and implement GitHub actions for continuous integration and deployment.", a: ["Harsh"], c: "Backend & APIs" },
  { t: "Grant Access", n: "Provide Google Play store console access to team members.", a: ["Arjun"], c: "Accounts & Access" },
  { t: "Share Credentials", n: "Provide the new AWS IoT core credentials to other team members.", a: ["Harsh"], c: "Accounts & Access" },
];

// Second batch — WhatsApp/Meta/Twilio integration + Zoho follow-ups (appended
// once to every board, new or existing, via PLAN_IMPORTS below).
export const PLAN_SEED_TASKS_2 = [
  { t: "Configure WhatsApp Number", n: "Disable the 'triple 15' alternate number (already configured for DrinkPrime) from the Freshchat account so it can be linked to the new Facebook + WhatsApp Business infrastructure. A brand-new virtual number isn't feasible for the Indian market via current providers, so we're reusing this existing number. (WhatsApp currently fails on the trial plan — messages sit in the queue undelivered.)", a: ["Anis"], priority: "High", c: "Messaging" },
  { t: "Share Meta URL", n: "Share the Meta Business Manager connection URL so the team can access the required configuration page.", a: ["Arjun"], c: "Messaging" },
  { t: "Verify Twilio Number", n: "Assess the Twilio virtual number's status and configuration for WhatsApp integration. Note: obtaining a new virtual number for the Indian market is not currently feasible through our providers.", a: ["Anis"], c: "Messaging" },
  { t: "Review Meta Account", n: "Confirm the existing Meta / Facebook business account is correctly linked and configured for this project. WhatsApp Business setup via Meta involves a complex, lengthy document-verification review that can be rejected — avoid new-account routes (e.g. LiveChat) that add delay.", a: ["Anis"], c: "Messaging" },
  { t: "Monitor Zoho Limits", n: "Investigate Wisdom 2.0's Zoho API usage — we hit the 1,000-request/day cap and must wait until midnight for a reset. Shift data retrieval to local database caching instead of real-time API calls (data is already synced via webhooks).", a: ["Arjun"], priority: "High", c: "Backend & APIs" },
  { t: "Zoho End-to-End Automation", n: "Zoho Inventory, ERP & Books — end-to-end automation across the stack: Zoho CRM order → create order in Zoho FSM → delivery & issue → create subscription in Billing → technician assignment via Zoho FSM for issues, drawing spares from Zoho Inventory.", a: ["Anis"], c: "Backend & APIs" },
];

// Third batch — the product sprint board (Customer App / Website / Zoho / IoT).
// { t: title, n: notes, a: assignees, c: category, p: P-priority, sp: sprint, st: status }.
export const PLAN_SEED_TASKS_3 = [
  { t: "Dynamic Discounts", n: "3M, 6M, 12M percentage-wise discount for all plans, society-wise.", a: ["Sri", "Harsh"], c: "Customer App", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Referral Pivot", n: "Currency only (no validity extensions).", a: ["Sri"], c: "Customer App", p: "P0", sp: "Sprint 2", st: "Live" },
  { t: "AMC Buyback", n: "Credit amount to wallet for recharge/topup.", a: ["Sri"], c: "Customer App", p: "P1", sp: "Sprint 3", st: "New" },
  { t: "Pause Option", n: "1 day/week free pause; tenure-based logic; 50% carry forward.", a: ["Sri"], c: "Customer App", p: "P2", sp: "Sprint 2", st: "New" },
  { t: "Auto Mandate", n: "Enable recurring payment mandates.", a: ["Arjun"], c: "Customer App", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Points System", n: "Wallet points conversion to currency.", a: ["Sri", "Harsh"], c: "Customer App", p: "P1", sp: "Sprint 2", st: "New" },
  { t: "ERP Subscription", n: "Take Zoho ERP subscription.", a: ["Anis"], c: "Zoho ERP", p: "P3", sp: "Sprint 3", st: "In-Progress" },
  { t: "Offline Process", n: "Start with offline ERP process workflow.", a: ["Anis"], c: "Zoho ERP", p: "P3", sp: "Sprint 3", st: "In-Progress" },
  { t: "Installation Flow", n: "Basic design for installation flow.", a: ["Anis"], c: "Technician App", p: "P0", sp: "Sprint 3", st: "In-Progress" },
  { t: "Device Display", n: "Remove plans; show device types (Own, Normal, Hot).", a: ["Harsh"], c: "PW Website", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "RWA Benefits", n: "Redirect to a different page with content.", a: ["Harsh"], c: "PW Website", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Testimonials", n: "Blocked. Add customer testimonials to the website.", a: ["Harsh"], c: "PW Website", p: "P3", sp: "Sprint 2", st: "In-Progress" },
  { t: "Iconography", n: "Change icons for the 'Benefits of Using ProWater' section.", a: ["Harsh"], c: "PW Website", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Remove Section", n: "Remove the 'Custom-Built with IoT Technology' image/section.", a: ["Harsh"], c: "PW Website", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Comparison Matrix", n: "Modify 'ProWater vs Normal RO' and 'Rental VS Subscribe VS Buy'.", a: ["Harsh"], c: "PW Website", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Lead creation in Firebase", n: "Lead Creation / Modification / Deletion — workflow rules.", a: ["Anis"], c: "Zoho CRM", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Recharge to credit points", n: "3M, 6M, 12M — same points added to wallet. Every recharge credits points; for every ₹100, 1 point is credited.", a: ["Sri", "Arjun", "Anis"], c: "Customer App", p: "P0", sp: "Sprint 3", st: "New" },
  { t: "Monthly Views of the revenue", n: "", a: ["Arjun", "Anis"], c: "Zoho CRM", p: "P1", sp: "Sprint 2", st: "Testing & QA" },
  { t: "Increase regression coverage for the App", n: "Check the app end to end; also add the test cases.", a: ["Sri"], c: "Customer App", p: "P2", sp: "Sprint 1", st: "Live" },
  { t: "Automation testing coverage to be added", n: "", a: [], c: "Customer App", p: "P2", sp: "Sprint 2", st: "Live" },
  { t: "App login logs to be cleaned up", n: "Correct login IP, device model and status should be passed.", a: ["Sri", "Arjun"], c: "Wisdom", p: "P0", sp: "Sprint 2", st: "Live" },
  { t: "Change layout", n: "Blocked. Redesign the apartment-code entry screen to reduce drop-offs.", a: ["Harsh"], c: "Zoho Billing", p: "P3", sp: "Sprint 2", st: "In-Progress" },
  { t: "Login Issues", n: "User unable to login using number (8519801115); doesn't pass through the OTP flow. Also capture logs against unregistered users — once a phone number is entered and validated, logs should be captured against it.", a: ["Sri"], c: "Customer App", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Tracking and Serialization", n: "Capture all inventory stock items in Zoho Inventory to record them.", a: ["Anis", "Arjun"], c: "Zoho Inventory", p: "P3", sp: "Sprint 2", st: "New" },
  { t: "Offline Mobile Content", n: "Over-the-top changes to text/images using remote config.", a: ["Sri"], c: "Customer App", p: "P1", sp: "Sprint 2", st: "Live" },
  { t: "Manage Technicians", n: "Descoped. Track technicians and their installation and service jobs.", a: ["Arjun"], c: "Zoho FSM", p: "P0", sp: "Sprint 3", st: "New" },
  { t: "Migrate old customers", n: "Blocked. Migrate the DP customers to ProWater subscription.", a: ["Anis", "Arjun"], c: "Zoho Billing", p: "P0", sp: "Sprint 2", st: "In-Progress" },
  { t: "Language Translation", n: "Multi-language support on the customer and technician app.", a: ["Anis", "Arjun"], c: "Customer App", p: "P2", sp: "Sprint 3", st: "New" },
  { t: "Society Name", n: "Explicitly show the Society Name in the app.", a: ["Sri"], c: "Customer App", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Device Replacement", n: "Blocked. Show on the CRM when a device has been replaced, with correct installation and uninstallation dates. Benefit transfer also has to be tracked. (App Changes / Inventory-ERP / Zoho Billing / CRM.)", a: ["Anis", "Arjun"], c: "Zoho Billing", p: "P1", sp: "", st: "In-Progress" },
  { t: "Custom App", n: "Build a custom app for churn and lost leads.", a: ["Arjun"], c: "Zoho CRM", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Purifier ID & Apartment Name", n: "Show the details in the app.", a: ["Sri"], c: "Customer App", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "Pass the Purifier ID and Apartment name to be added", n: "Pass the Purifier ID and Apartment name to the relevant fields in Freshdesk.", a: ["Harsh"], c: "Freshdesk", p: "P1", sp: "Sprint 2", st: "Live" },
  { t: "Architecture Revamp", n: "Secure all APIs.", a: ["Harsh"], c: "Bug Fixes", p: "P0", sp: "Sprint 2", st: "Testing & QA" },
  { t: "Technician App", n: "Build the technician app.", a: ["Sri"], c: "Technician App", p: "P0", sp: "Sprint 3", st: "In-Progress" },
  { t: "web Forms", n: "Build the user registration and referral form.", a: ["Harsh"], c: "Form", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "AWS IoT", n: "Set up an IoT instance of the Junction Box.", a: ["Pranshu"], c: "IoT", p: "P0", sp: "Sprint 3", st: "In-Progress" },
  { t: "Leads creation from RWA website", n: "Leads created from the RWA website and stored in Firebase.", a: ["Anis", "Harsh"], c: "PW Website", p: "P0", sp: "Sprint 1", st: "Live" },
  { t: "In-App Notifications", n: "Descoped. Enable push notifications on the app.", a: ["Sri"], c: "Customer App", p: "P3", sp: "Sprint 2", st: "New" },
  { t: "Live TDS", n: "Blocked. Show the live TDS to customers.", a: ["IQ Labs"], c: "IoT", p: "P0", sp: "Sprint 3", st: "In-Progress" },
  { t: "Bug fixes related to Login/Logout", n: "", a: ["Sri"], c: "Bug Fixes", p: "P1", sp: "Sprint 1", st: "Live" },
  { t: "Redesign Website", n: "Revamp the entire website based on the RWA theme.", a: ["Harsh", "Anis"], c: "PW Website", p: "P2", sp: "Sprint 2", st: "Live" },
  { t: "Redesign Customer App", n: "Redesign the entire customer-app UI based on the color theme of the website.", a: ["Anis", "Sri"], c: "Customer App", p: "P2", sp: "Sprint 4", st: "New" },
  { t: "GS service Job", n: "Create a maintenance GS job every 15 days for central RO.", a: ["Anis", "Sri", "Arjun", "Harsh"], c: "Freshdesk", p: "P0", sp: "Sprint 3", st: "New" },
  { t: "UPI Mandate", n: "Descoped. Auto recharge for UPI.", a: ["Anis", "Arjun"], c: "Customer App", p: "P3", sp: "Sprint 2", st: "New" },
  { t: "Registration UI Fix", n: "Move single-page forms into ProWater.in; pull data from the query string.", a: ["Anis", "Harsh"], c: "PW Website", p: "P1", sp: "Sprint 2", st: "Live" },
  { t: "End to end manual QA", n: "", a: ["Arjun"], c: "Customer App", p: "P1", sp: "Sprint 2", st: "New" },
  { t: "Biometrics Authentication — Customer App", n: "Authentication for the Customer App.", a: ["Sri"], c: "Customer App", p: "P1", sp: "Sprint 3", st: "Testing & QA" },
  { t: "Biometrics Authentication — Technician App", n: "Authentication for the Technician App.", a: ["Sri"], c: "Technician App", p: "P1", sp: "Sprint 3", st: "Testing & QA" },
];

// Fourth batch — technician-app build-out + Zoho Desk sync meeting action items.
export const PLAN_SEED_TASKS_4 = [
  { t: "Handle API Errors", n: "Handle Twilio API errors and implement AWS SNS as a fallback service.", a: ["Sri", "Sujan"], c: "Messaging" },
  { t: "Document Meeting Notes", n: "Record all discussion points and requirements in the Soro group.", a: ["Anis"], c: "Ops & Finance" },
  { t: "Map Technicians", n: "Develop a mapping table to assign technicians based on customer society.", a: ["Sri"], c: "Zoho FSM" },
  { t: "Configure Workflow", n: "Set up ticket status categories in Zoho Desk.", a: ["Anis"], c: "Ticketing" },
  { t: "Update Job Interface", n: "Populate job details in the app and implement a Start Job button to trigger a status update.", a: ["Sri", "Sujan"], c: "Technician App" },
  { t: "Integrate OCR", n: "Implement scanning functionality to verify purifier IDs against customer tickets.", a: ["Sri", "Sujan"], c: "Technician App" },
  { t: "Update Spares UI", n: "Change the spares selection input to a multi-select checkbox interface.", a: ["Sri", "Sujan"], c: "Technician App" },
  { t: "Enable Image Uploads", n: "Configure the app to support image attachments and store them via API or file-system reference.", a: ["Sri", "Sujan"], c: "Technician App" },
  { t: "Create Webhooks", n: "Develop webhooks to synchronize ticket data from Zoho Desk to the local system.", a: ["Anis"], c: "Backend & APIs" },
  { t: "Capture Location", n: "Implement location tracking to record coordinates when a technician starts a job.", a: ["Sri", "Sujan"], c: "Technician App" },
  { t: "Update UI", n: "Hide unused interface elements including ratings, edit profile, notifications, and location-verification blocks across the application.", a: ["The Group"], c: "Customer App" },
  { t: "Add Webhooks", n: "Implement webhooks to track ticket statuses and water-quality updates.", a: ["The Group"], c: "Backend & APIs" },
  { t: "Add Flow Rate", n: "Replace the TDS button with a functional flow-rate feature in the system-performance block.", a: ["The Group"], c: "IoT" },
  { t: "Add Logout", n: "Add a log out button to the technician application.", a: ["The Group"], c: "Technician App" },
  { t: "Add Biometric Login", n: "Integrate biometric login functionality into the user authentication flow.", a: ["The Group"], c: "Customer App" },
  { t: "Improve OTP Handling", n: "Develop error-handling logic for OTP verification in the customer application.", a: ["Sri"], c: "Customer App" },
  { t: "Formalize Release Process", n: "Document all new features in release notes and request approval from Arjun prior to pushing updates to production.", a: ["The Group"], c: "Review & QA" },
  { t: "Add Ticket Tracking", n: "Implement a 'Track My Tickets' page on the interface.", a: ["The Group"], c: "Customer App" },
  { t: "Sync Zoho Tickets", n: "Synchronize ticket status data between the application and the Zoho platform.", a: ["The Group"], c: "Ticketing" },
  { t: "Assign Zoho Owner", n: "Configure Sathish as the designated technician owner within the Zoho account.", a: ["The Group"], c: "Zoho FSM" },
  { t: "Share Priority List", n: "Distribute a consolidated, priority-based list of tasks to the team for better focus.", a: ["Arjun"], c: "Ops & Finance" },
  { t: "Consolidate Tasks", n: "Consolidate all action items from the meeting chat into the main tracking list.", a: ["Anis"], c: "Ops & Finance" },
];

// Seed batches. Each imports exactly once per board (tracked in pw_tasks_imported),
// and any task whose title already exists is skipped (no duplicates).
export const PLAN_IMPORTS = [
  { id: "backlog-2026-07-13", tasks: PLAN_SEED_TASKS },
  { id: "whatsapp-zoho-2026-07-13", tasks: PLAN_SEED_TASKS_2 },
  { id: "sprint-board-2026-07-13", tasks: PLAN_SEED_TASKS_3 },
  { id: "tech-app-2026-07-14", tasks: PLAN_SEED_TASKS_4 },
];
export const planStatusMeta = (k) => PLAN_STATUSES.find(s => s.key === k) || PLAN_STATUSES[0];
export const planPrioMeta = (k) => PLAN_PRIORITIES.find(p => p.key === k) || PLAN_PRIORITIES[1];
export const planInitials = (name) => String(name || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
export const planUserColor = (name) => { const i = Math.max(0, PLAN_USERS.indexOf(name)); return PLAN_AVATAR_COLORS[i % PLAN_AVATAR_COLORS.length]; };
export const planReadFile = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: r.result });
  r.onerror = reject;
  r.readAsDataURL(file);
});

/* ---- Attachment store (IndexedDB) ----------------------------------------
   Attachment BYTES live in IndexedDB (hundreds of MB quota), keyed by id. The
   task in localStorage keeps only lightweight metadata { id, name, type, size }
   — so a couple of photos can't overflow the ~5 MB localStorage limit and
   silently break saving. */
const PLAN_IDB_NAME = "pw_planner", PLAN_IDB_STORE = "attachments";
export let _planIdb = null;
export function planIdb() {
  if (_planIdb) return _planIdb;
  _planIdb = new Promise((resolve, reject) => {
    const req = indexedDB.open(PLAN_IDB_NAME, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(PLAN_IDB_STORE)) db.createObjectStore(PLAN_IDB_STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _planIdb;
}
export async function planIdbPut(rec) {
  const db = await planIdb();
  return new Promise((res, rej) => { const tx = db.transaction(PLAN_IDB_STORE, "readwrite"); tx.objectStore(PLAN_IDB_STORE).put(rec); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
export async function planIdbGet(id) {
  const db = await planIdb();
  return new Promise((res, rej) => { const tx = db.transaction(PLAN_IDB_STORE, "readonly"); const r = tx.objectStore(PLAN_IDB_STORE).get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function planIdbDel(id) {
  const db = await planIdb();
  return new Promise((res) => { try { const tx = db.transaction(PLAN_IDB_STORE, "readwrite"); tx.objectStore(PLAN_IDB_STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch { res(); } });
}
/* ---- Task Planner attachments — backend /documents/add --------------------
   Files upload to the ProWater backend (POST /documents/add?email=<user>) as
   multipart form-data under the field name `documents`. The backend stores them
   in Cloud Storage and returns { name, path }; that `path` lives in the app's
   Storage bucket (below), so a media URL is built from it for download. The
   email is the signed-in user's — captured on the sign-in page and kept in the
   session at login. On any failure the file falls back to local IndexedDB so the
   task still saves. */
export const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "backend-prowater.firebasestorage.app";
// The email entered on the sign-in page (persisted in the session at login).
export function currentUserEmail() {
  try { return JSON.parse(sessionStorage.getItem("pw_user") || "{}").email || ""; } catch { return ""; }
}
// A Storage object path → a public media (download) URL in the app's bucket.
export const documentDownloadUrl = (path) => path
  ? `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`
  : "";
// Upload one file to the backend as the signed-in user; returns { name, path, url }.
export async function planUploadDocument(file) {
  const email = currentUserEmail();
  if (!email) throw new Error("no signed-in email");
  const token = sessionStorage.getItem("pw_idToken");
  const fd = new FormData();
  fd.append("documents", file, file.name);
  // NOTE: don't set Content-Type here — the browser adds the multipart boundary.
  const res = await fetch(`${API_ORIGIN}/documents/add?email=${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  if (!res.ok) throw new Error(`Documents ${res.status}`);
  const j = await res.json();
  const f0 = (j.files || [])[0] || {};
  if (!f0.path) throw new Error("no path in response");
  return { name: f0.name || file.name, path: f0.path, url: documentDownloadUrl(f0.path) };
}
export async function fbStorageDelete(path) {
  const token = sessionStorage.getItem("pw_idToken");
  try { await fetch(`https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(path)}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch { /* best effort */ }
}

// Trigger a browser download/open for an attachment. Firebase attachments carry
// a `url`; local ones read bytes from IDB (or an inline legacy dataUrl).
export async function planDownloadAttachment(a) {
  let href = a.url;
  if (!href) {
    const rec = a.dataUrl ? a : await planIdbGet(a.id).catch(() => null);
    if (!rec || !rec.dataUrl) return false;
    href = rec.dataUrl;
  }
  const link = document.createElement("a");
  link.href = href; link.download = a.name || "attachment"; link.target = "_blank"; link.rel = "noopener";
  document.body.appendChild(link); link.click(); link.remove();
  return true;
}


export const PlanAvatar = ({ name, size = 24 }) => (
  <span title={name === "The Group" ? `The Group: ${PLAN_GROUP.join(", ")}` : name} style={{ width: size, height: size, borderRadius: 999, background: planUserColor(name), color: "#fff", fontSize: size * 0.38, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {planInitials(name)}
  </span>
);

// Overlapping avatar stack for a task's assignees (shows up to 3, then +N).
export const AssigneeStack = ({ names, size = 24 }) => {
  const list = names || [];
  if (!list.length) return <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 500 }}>Unassigned</span>;
  const show = list.slice(0, 3);
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }} title={list.join(", ")}>
      {show.map((n, i) => (
        <span key={n} style={{ marginLeft: i ? -7 : 0, boxShadow: "0 0 0 2px #fff", borderRadius: 999, position: "relative", zIndex: show.length - i, display: "inline-flex" }}>
          <PlanAvatar name={n} size={size} />
        </span>
      ))}
      {list.length > 3 && <span style={{ marginLeft: 5, fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>+{list.length - 3}</span>}
    </span>
  );
};

// Normalise a priority to the P-scale (maps legacy Low/Medium/High/Urgent).
export const planPrio = (p) => PLAN_PRIO_MIGRATE[p] || (PLAN_PRIORITIES.some(x => x.key === p) ? p : "P2");
// Normalise legacy tasks to the current shape (assignees[], category, P-scale, sprint).
export const planMigrate = (t) => ({
  ...t,
  assignees: Array.isArray(t.assignees) ? t.assignees : (t.assignee ? [t.assignee] : []),
  category: t.category || "General",
  status: t.status === "Scoping" ? "New" : (t.status || "New"),
  priority: planPrio(t.priority),
  sprint: t.sprint || "",
});
export const planMakeTask = (s) => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: s.t, notes: s.n || "", status: s.st || s.status || "New", assignees: s.a || [], category: s.c || "General", sprint: s.sp || "", email: "", priority: planPrio(s.p || s.priority), startDate: "", endDate: "", attachments: [], createdBy: "Import", createdAt: now, updatedAt: now };
};

/* ===========================================================================
   MODIFY TASKS (admin) — add/remove the Status columns, Sprints and Categories
   available to every task. Persists to localStorage; the board reads it live.
   =========================================================================== */
export function TaskAdmin() {
  const { user } = useAuth();
  const [, force] = useState(0);
  const rerender = () => force(n => n + 1);
  const [nSprint, setNSprint] = useState("");
  const [nCat, setNCat] = useState("");
  const [nStatus, setNStatus] = useState("");
  const [flash, setFlash] = useState("");
  useEffect(() => { api.logView(user.username, "Viewed Modify Tasks"); }, []);
  const toast = (m) => { setFlash(m); setTimeout(() => setFlash(""), 1800); };

  const addSprint = () => { const v = nSprint.trim(); if (!v) return; if (PLAN_SPRINTS.includes(v)) return toast("Sprint already exists"); setPlanSprints([...PLAN_SPRINTS, v]); setNSprint(""); rerender(); toast("Sprint added"); };
  const removeSprint = (s) => { setPlanSprints(PLAN_SPRINTS.filter(x => x !== s)); rerender(); };
  const addCat = () => { const v = nCat.trim(); if (!v) return; if (PLAN_CATEGORIES.some(c => c.key === v)) return toast("Category already exists"); setPlanCategories([...PLAN_CATEGORIES, { key: v, color: planPickColor(PLAN_CATEGORIES.length) }]); setNCat(""); rerender(); toast("Category added"); };
  const removeCat = (k) => { setPlanCategories(PLAN_CATEGORIES.filter(c => c.key !== k)); rerender(); };
  const addStatus = () => { const v = nStatus.trim(); if (!v) return; if (PLAN_STATUSES.some(s => s.key === v)) return toast("Status already exists"); const color = planPickColor(PLAN_STATUSES.length); setPlanStatuses([...PLAN_STATUSES, { key: v, color, bg: planTint(color) }]); setNStatus(""); rerender(); toast("Status added"); };
  const removeStatus = (k) => { if (PLAN_STATUSES.length <= 1) return toast("Keep at least one status"); setPlanStatuses(PLAN_STATUSES.filter(s => s.key !== k)); rerender(); };
  const resetAll = () => { setPlanStatuses(PLAN_STATUSES_DEFAULT); setPlanSprints(PLAN_SPRINTS_DEFAULT); setPlanCategories(PLAN_CATEGORIES_DEFAULT); rerender(); toast("Reset to defaults"); };

  const addRow = (val, setVal, onAdd, placeholder) => (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && onAdd()} placeholder={placeholder} style={{ ...inp, padding: "9px 12px" }} />
      <button onClick={onAdd} style={{ ...btnPrimary, padding: "9px 14px", whiteSpace: "nowrap" }}><Plus size={15} /> Add</button>
    </div>
  );
  const pill = (label, color, onRemove) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff" }}>
      <span style={{ width: 11, height: 11, borderRadius: 4, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)", flex: 1 }}>{label}</span>
      <button onClick={onRemove} title="Remove" style={{ ...iconBtn, padding: 5, background: "var(--mint)" }}><X size={14} /></button>
    </div>
  );


  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Admin</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--f)" }}>Modify Tasks</div>
        </div>
        <button onClick={resetAll} style={{ ...btnGhost, marginLeft: "auto" }}><RotateCcw size={15} /> Reset to defaults</button>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>Manage the options every task can use. Changes save instantly and apply to the board, list and task editor.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
        <Card title="Status columns" sub="Board columns, left → right">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PLAN_STATUSES.map(s => pill(s.key, s.color, () => removeStatus(s.key)))}
          </div>
          {addRow(nStatus, setNStatus, addStatus, "New status…")}
        </Card>

        <Card title="Sprints" sub="Sprint options for every task">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PLAN_SPRINTS.map((s, i) => pill(s, planPickColor(i), () => removeSprint(s)))}
          </div>
          {addRow(nSprint, setNSprint, addSprint, "e.g. Sprint 5")}
        </Card>

        <Card title="Categories" sub="Business-requirement categories">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {PLAN_CATEGORIES.map(c => pill(c.key, c.color, () => removeCat(c.key)))}
          </div>
          {addRow(nCat, setNCat, addCat, "New category…")}
        </Card>
      </div>
      {flash && <div style={toastStyle}><CheckCircle2 size={16} /> {flash}</div>}
    </div>
  );
}

// Timeline view — tasks grouped by the day they were ADDED (createdAt), newest
// first, so you can see the flow of what's being added to the board over time.
export function TaskTimelineView({ tasks, onOpen }) {
  const withDate = (tasks || []).map(t => ({ t, ms: new Date(t.createdAt || t.startDate || 0).getTime() })).filter(x => x.ms && !isNaN(x.ms));
  if (!withDate.length) return <Empty msg="No task-creation dates to show on the timeline yet." />;
  withDate.sort((a, b) => b.ms - a.ms);
  const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); };
  const now = Date.now(), todayK = dayKey(now), yK = dayKey(now - 86400000);
  const dayLabel = (ms) => { const k = dayKey(ms); if (k === todayK) return "Today"; if (k === yK) return "Yesterday"; return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
  const hm = (ms) => { const d = new Date(ms); let h = d.getHours(); const ap = h < 12 ? "AM" : "PM"; h = h % 12 || 12; return h + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap; };
  const groups = []; let cur = null;
  withDate.forEach(x => { const k = dayKey(x.ms); if (!cur || cur.k !== k) { cur = { k, label: dayLabel(x.ms), items: [] }; groups.push(cur); } cur.items.push(x); });
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: gi === groups.length - 1 ? 0 : 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--f)" }}>{g.label}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{g.items.length} task{g.items.length !== 1 ? "s" : ""} added</span>
          </div>
          <div style={{ borderLeft: "2px solid var(--border)", marginLeft: 5, paddingLeft: 16, display: "grid", gap: 10 }}>
            {g.items.map(({ t, ms }, i) => {
              const sm = planStatusMeta(t.status), pm = planPrioMeta(t.priority);
              return (
                <div key={i} onClick={() => onOpen && onOpen(t)} style={{ position: "relative", cursor: "pointer", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 13px" }}>
                  <span style={{ position: "absolute", left: -22, top: 15, width: 11, height: 11, borderRadius: 999, background: sm.color || "var(--brand)", border: "2px solid #fff", boxShadow: "0 0 0 2px var(--border)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--f)" }}>{t.title || "Untitled task"}</span>
                    <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{hm(ms)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: sm.bg || "var(--mint-2)", color: sm.color || "var(--forest)" }}>{t.status}</span>
                    {t.priority && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: pm.color || "var(--slate)", background: (pm.color || "#888") + "1A" }}>{t.priority}</span>}
                    {t.category && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.category}</span>}
                    {(t.assignees && t.assignees.length) ? <span style={{ fontSize: 11.5, color: "var(--muted)" }}>· {t.assignees.join(", ")}</span> : null}
                    {t.createdBy ? <span style={{ fontSize: 11, color: "var(--faint)" }}>· added by {t.createdBy}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
export function TaskPlanner({ initialView = "board" }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(() => {
    const raw = LS.get("pw_tasks", null);
    let list = Array.isArray(raw) ? raw.map(planMigrate) : [];
    // Which seed batches have already landed on this board.
    const imported = new Set(LS.get("pw_tasks_imported", []));
    // Migrate the legacy single-flag: an already-seeded board has the 1st batch.
    if (LS.get("pw_tasks_seeded", false)) imported.add(PLAN_IMPORTS[0].id);
    let changed = false;
    const norm = (s) => String(s || "").trim().toLowerCase();
    const seenTitles = new Set(list.map(t => norm(t.title)));
    for (const batch of PLAN_IMPORTS) {
      if (imported.has(batch.id)) continue;
      // Skip any task whose title already exists on the board (no duplicates).
      const fresh = batch.tasks.filter(s => { const k = norm(s.t); if (seenTitles.has(k)) return false; seenTitles.add(k); return true; });
      list = [...fresh.map(planMakeTask), ...list];
      imported.add(batch.id);
      changed = true;
    }
    if (changed) {
      LS.set("pw_tasks", list);
      LS.set("pw_tasks_imported", [...imported]);
      LS.set("pw_tasks_seeded", true);
    }
    return list;
  });
  const [view, setView] = useState(initialView); // board | list | weekly
  const [editing, setEditing] = useState(null);   // task being edited/created (or null)
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [q, setQ] = useState("");
  const [fAssignee, setFAssignee] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fSprint, setFSprint] = useState("all");
  const [warn, setWarn] = useState("");
  // Status-change notifications (persist so they're waiting at next login).
  const [notifs, setNotifs] = useState(() => LS.get("pw_task_notifications", []));
  const [notifSeen, setNotifSeen] = useState(() => LS.get("pw_task_notifs_seen", 0));
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => { api.logView(user.username, "Viewed Task Planner"); }, []);

  // One-time cleanup: move any pre-IndexedDB inline attachment bytes out of
  // localStorage (they used to overflow quota and break saving) into IDB,
  // leaving only metadata on the task.
  useEffect(() => {
    let dirty = false;
    const migrated = tasks.map(t => {
      if (!t.attachments?.some(a => a.dataUrl)) return t;
      dirty = true;
      return { ...t, attachments: t.attachments.map(a => {
        if (!a.dataUrl) return a;
        const id = a.id || crypto.randomUUID();
        planIdbPut({ id, name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl });
        return { id, name: a.name, type: a.type, size: a.size };
      }) };
    });
    if (dirty) { setTasks(migrated); LS.set("pw_tasks", migrated); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next) => {
    setTasks(next);
    if (!LS.set("pw_tasks", next)) setWarn("Storage is full — the last change (likely a large attachment) may not be saved. Remove some attachments and try again.");
    else setWarn("");
  };
  const pushNotif = (prev, toStatus) => {
    const n = { id: crypto.randomUUID(), ts: Date.now(), taskId: prev.id, title: prev.title || "Untitled task", from: prev.status, to: toStatus, by: user.name, assignees: prev.assignees || [] };
    const next = [n, ...notifs].slice(0, 100);
    setNotifs(next); LS.set("pw_task_notifications", next);
  };
  const upsert = (t) => {
    const prev = tasks.find(x => x.id === t.id);
    const today = new Date().toISOString().slice(0, 10);
    const next = { ...t };
    // Auto-stamp dates on the transition: start when Picked Up, end when Live.
    if (next.status === "Picked Up" && (!prev || prev.status !== "Picked Up") && !next.startDate) next.startDate = today;
    if (next.status === "Live" && (!prev || prev.status !== "Live") && !next.endDate) next.endDate = today;
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    if (prev && prev.status !== next.status) pushNotif(prev, next.status);
    persist(prev ? tasks.map(x => x.id === t.id ? stamped : x) : [stamped, ...tasks]);
  };
  const remove = (id) => persist(tasks.filter(t => t.id !== id));
  const moveTo = (id, status) => { const t = tasks.find(x => x.id === id); if (t && t.status !== status) upsert({ ...t, status }); };

  const toggleNotifs = () => { setNotifOpen(o => !o); const now = Date.now(); setNotifSeen(now); LS.set("pw_task_notifs_seen", now); };
  const clearNotifs = () => { setNotifs([]); LS.set("pw_task_notifications", []); };
  const unread = notifs.filter(n => n.ts > notifSeen).length;

  const blank = (status) => ({
    id: crypto.randomUUID(), title: "", status: status || "New", assignees: [], category: "General", sprint: "",
    email: "", priority: "P2", startDate: "", endDate: "", notes: "", attachments: [],
    createdBy: user.name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _new: true,
  });

  // "The Group" tasks count as belonging to each of the five group members.
  const assignedTo = (t, who) => (t.assignees || []).includes(who) || ((t.assignees || []).includes("The Group") && PLAN_GROUP.includes(who));
  const matches = (t) =>
    (fAssignee === "all" || assignedTo(t, fAssignee)) &&
    (fPriority === "all" || t.priority === fPriority) &&
    (fCategory === "all" || t.category === fCategory) &&
    (fSprint === "all" || (t.sprint || "") === fSprint) &&
    (!q || t.title.toLowerCase().includes(q.toLowerCase()) || (t.notes || "").toLowerCase().includes(q.toLowerCase()) || (t.email || "").toLowerCase().includes(q.toLowerCase()));
  const filtered = tasks.filter(matches);
  const byStatus = (k) => filtered.filter(t => t.status === k);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = (t) => t.endDate && t.endDate < todayStr && t.status !== "Live";

  const seg = (v, label) => (
    <button onClick={() => setView(v)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "1.5px solid var(--border)", background: view === v ? "var(--forest)" : "#fff", color: view === v ? "#fff" : "var(--slate)", borderRadius: 10 }}>{label}</button>
  );


  return (
    <div className="fade-up">
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {seg("board", "Board")}{seg("list", "List")}{seg("weekly", "Weekly View")}{seg("timeline", "Timeline")}
        <div style={{ position: "relative", minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks…" style={{ ...inp, padding: "9px 12px 9px 32px" }} />
        </div>
        <select value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={selectStyle}>
          <option value="all">All assignees</option>
          {PLAN_USERS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={fCategory} onChange={e => setFCategory(e.target.value)} style={selectStyle}>
          <option value="all">All categories</option>
          {PLAN_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
        </select>
        <select value={fPriority} onChange={e => setFPriority(e.target.value)} style={selectStyle}>
          <option value="all">All priorities</option>
          {PLAN_PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.key}</option>)}
        </select>
        <select value={fSprint} onChange={e => setFSprint(e.target.value)} style={selectStyle}>
          <option value="all">All sprints</option>
          {PLAN_SPRINTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ position: "relative", marginLeft: "auto" }}>
          <button onClick={toggleNotifs} title="Status-change notifications" style={{ ...btnGhost, padding: "9px 11px", position: "relative" }}>
            <Bell size={16} />
            {unread > 0 && <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: "#DC4141", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
          </button>
          {notifOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-lg)", zIndex: 30 }}>
              <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--f)" }}>Notifications</span>
                {notifs.length > 0 && <button onClick={clearNotifs} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Clear all</button>}
              </div>
              {notifs.length === 0 ? <Empty msg="No status changes yet." /> : notifs.map(n => { const to = planStatusMeta(n.to); return (
                <div key={n.id} style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: to.color, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--f)", fontWeight: 600, lineHeight: 1.35 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>{n.from} → <b style={{ color: to.color }}>{n.to}</b></div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>by {n.by} · {fmtTime(n.ts)}{n.assignees?.length ? ` · ${n.assignees.join(", ")}` : ""}</div>
                  </div>
                </div>
              ); })}
            </div>
          )}
        </div>
        <button onClick={() => setEditing(blank("New"))} style={btnPrimary}><Plus size={16} /> New Task</button>
      </div>

      {warn && <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#986315", background: "#FBF0E0", border: "1px solid #F6DEBC", padding: "10px 14px", borderRadius: 11, marginBottom: 14 }}><AlertCircle size={16} />{warn}</div>}

      {/* count chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--f)", background: "var(--mint-2)", padding: "5px 11px", borderRadius: 999 }}>{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
        {PLAN_STATUSES.map(s => { const n = byStatus(s.key).length; return (
          <span key={s.key} style={{ fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, padding: "5px 11px", borderRadius: 999 }}>{s.key} · {n}</span>
        ); })}
      </div>

      {view === "board" && (
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
          {PLAN_STATUSES.map(s => {
            const col = byStatus(s.key);
            const active = overCol === s.key;
            return (
              <div key={s.key}
                onDragOver={e => { e.preventDefault(); if (overCol !== s.key) setOverCol(s.key); }}
                onDragLeave={() => setOverCol(c => c === s.key ? null : c)}
                onDrop={() => { if (dragId) moveTo(dragId, s.key); setDragId(null); setOverCol(null); }}
                style={{ flex: "0 0 288px", width: 288, background: active ? s.bg : "var(--mint)", border: `1.5px solid ${active ? s.color : "var(--border)"}`, borderRadius: 14, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 300px)", transition: "background .12s, border-color .12s" }}>
                {/* pinned column header — stays visible while the cards scroll */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 10px 11px 12px", flexShrink: 0, background: active ? s.bg : "var(--mint)", borderBottom: `1px solid ${active ? s.color : "var(--border)"}`, borderTopLeftRadius: 13, borderTopRightRadius: 13 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: s.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--f)" }}>{s.key}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.color, background: "#fff", borderRadius: 999, padding: "1px 8px" }}>{col.length}</span>
                  <button onClick={() => setEditing(blank(s.key))} title="Add task" style={{ marginLeft: "auto", ...iconBtn, background: "#fff", border: "1px solid var(--border)", padding: 5 }}><Plus size={14} /></button>
                </div>
                {/* scrollable card list */}
                <div style={{ overflowY: "auto", flex: 1, minHeight: 64, padding: 10, display: "flex", flexDirection: "column", gap: 9 }}>
                  {col.map(t => (
                    <TaskCard key={t.id} t={t} overdue={isOverdue(t)}
                      onOpen={() => setEditing(t)}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      dragging={dragId === t.id} />
                  ))}
                  {col.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "14px 0" }}>Drop tasks here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <Card pad={false}>
          <Table head={["Task", "Category", "Sprint", "Status", "Assignees", "Priority", "Start", "Due", "Files"]} maxHeight="calc(100vh - 380px)">
            {filtered.map(t => { const sm = planStatusMeta(t.status), pm = planPrioMeta(t.priority), cm = planCatMeta(t.category); return (
              <tr key={t.id} style={trStyle} onClick={() => setEditing(t)}>
                <td style={{ ...td, textAlign: "left", fontWeight: 600, color: "var(--f)" }}>{t.title || <span style={{ color: "var(--muted)" }}>Untitled</span>}</td>
                <td style={td}><span style={{ fontSize: 11.5, fontWeight: 600, color: cm.color, background: `${cm.color}18`, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{t.category || "—"}</span></td>
                <td style={{ ...td, fontSize: 12.5, whiteSpace: "nowrap", color: t.sprint ? "var(--slate)" : "var(--muted)" }}>{t.sprint || "—"}</td>
                <td style={td}><span style={{ fontSize: 12, fontWeight: 600, color: sm.color, background: sm.bg, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>{t.status}</span></td>
                <td style={td}><AssigneeStack names={t.assignees} size={22} /></td>
                <td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: pm.color }}>{t.priority}</span></td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{t.startDate ? fmtDate(t.startDate) : "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5, color: isOverdue(t) ? "#DC4141" : undefined, fontWeight: isOverdue(t) ? 700 : 400 }}>{t.endDate ? fmtDate(t.endDate) : "—"}</td>
                <td style={td}>{t.attachments?.length ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--teal)" }}><Paperclip size={13} />{t.attachments.length}</span> : "—"}</td>
              </tr>
            ); })}
          </Table>
          {filtered.length === 0 && <Empty msg="No tasks yet. Click “New Task” to add one." />}
        </Card>
      )}

      {view === "weekly" && <TaskWeeklyView tasks={filtered} onOpen={setEditing} isOverdue={isOverdue} />}
      {view === "timeline" && <TaskTimelineView tasks={filtered} onOpen={setEditing} />}

      {editing && (
        <TaskEditor task={editing} onClose={() => setEditing(null)}
          onSave={t => { upsert(t); setEditing(null); }}
          onDelete={t => { remove(t.id); setEditing(null); }}
          onWarn={setWarn} />
      )}
    </div>
  );
}

// Weekly View — a business-facing analytics dashboard: high-level delivery
// KPIs + charts, with each scope (category) expandable to its tasks on click.
export function TaskWeeklyView({ tasks, onOpen, isOverdue }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (k) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  if (!tasks.length) return <Empty msg="No tasks match your filters." />;

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Live").length;
  const notStarted = tasks.filter(t => t.status === "New").length;
  const inProgress = total - done - notStarted;
  const pct = total ? Math.round(done / total * 100) : 0;

  const buckets = [
    { name: "Done", value: done, color: "#08805A" },
    { name: "In progress", value: inProgress, color: "#986315" },
    { name: "Not started", value: notStarted, color: "#7D8A83" },
  ].filter(b => b.value > 0);

  const cats = [...PLAN_CATEGORIES.map(c => c.key), "General"];
  const catStats = cats.map(key => {
    const items = tasks.filter(t => (t.category || "General") === key);
    return { key, meta: planCatMeta(key), items, done: items.filter(t => t.status === "Live").length, total: items.length };
  }).filter(g => g.total > 0).sort((a, b) => b.total - a.total);
  const catBars = catStats.map(g => ({ name: g.key, value: g.total, color: g.meta.color }));

  const stats = [
    { label: "Completed", value: done, icon: CheckCircle2, sub: `of ${total} tasks`, hero: true },
    { label: "In progress", value: inProgress, icon: RefreshCw, sub: "actively moving" },
    { label: "Not started", value: notStarted, icon: Hourglass, sub: "in the backlog" },
    { label: "Completion", value: pct + "%", icon: TrendingUp, sub: "across all scopes" },
  ];


  return (
    <div className="fade-up">
      <div style={grid4}>{stats.map((s, i) => <Stat key={i} {...s} />)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="an-grid">
        <style>{`@media(max-width:820px){.an-grid{grid-template-columns:1fr!important}}`}</style>
        <Card title="Delivery status" sub="Where all work stands right now">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={buckets} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} isAnimationActive={false} label={renderPieLabel} labelLine={pieLabelLine}>
                {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Pie>
              <Tooltip content={<TT />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Scope size by category" sub="How the work is distributed">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={catBars} layout="vertical" margin={{ left: 20, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEED" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={112} />
              <Tooltip content={<TT />} cursor={{ fill: "rgba(168,217,64,.08)" }} />
              <Bar dataKey="value" name="tasks" radius={[0, 6, 6, 0]} maxBarSize={26} isAnimationActive={false}>
                {catBars.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card pad={false} title="Scope breakdown" sub="Click any scope to expand its tasks">
          <div>
            {catStats.map(g => {
              const open = expanded.has(g.key);
              const p = Math.round(g.done / g.total * 100);
              return (
                <div key={g.key} style={{ borderTop: "1px solid var(--border)" }}>
                  <div onClick={() => toggle(g.key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}>
                    <ChevronRight size={16} style={{ color: "var(--muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: g.meta.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--f)", minWidth: 130 }}>{g.key}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--mint-2)", overflow: "hidden", minWidth: 70 }}>
                      <div style={{ width: `${p}%`, height: "100%", background: g.meta.color }} />
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: g.meta.color, width: 92, textAlign: "right", flexShrink: 0 }}>{g.done}/{g.total} done</span>
                  </div>
                  {open && (
                    <div style={{ background: "var(--mint)" }}>
                      {g.items.map(t => { const sm = planStatusMeta(t.status); return (
                        <div key={t.id} onClick={() => onOpen(t)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px 9px 46px", cursor: "pointer", borderTop: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: sm.color, background: sm.bg, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0 }}>{t.status}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{t.title || "Untitled task"}</span>
                          {t.endDate && <span style={{ fontSize: 11.5, color: isOverdue(t) ? "#DC4141" : "var(--muted)", whiteSpace: "nowrap" }}>due {fmtDate(t.endDate)}</span>}
                          <AssigneeStack names={t.assignees} size={22} />
                        </div>
                      ); })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function TaskCard({ t, overdue, onOpen, onDragStart, onDragEnd, dragging }) {
  const sm = planStatusMeta(t.status), pm = planPrioMeta(t.priority), cm = planCatMeta(t.category);
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      style={{ background: "#fff", border: "1px solid var(--border)", borderLeft: `3px solid ${sm.color}`, borderRadius: 11, padding: "11px 12px", boxShadow: "var(--shadow)", cursor: "pointer", opacity: dragging ? 0.4 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <GripVertical size={14} style={{ color: "var(--muted)", marginTop: 2, flexShrink: 0, cursor: "grab" }} />
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--f)", lineHeight: 1.3 }}>{t.title || "Untitled task"}</div>
      </div>
      {t.notes && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.notes}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: pm.color, background: `${pm.color}18`, padding: "2px 8px", borderRadius: 999 }}>{t.priority}</span>
        {t.category && t.category !== "General" && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, color: cm.color, background: `${cm.color}14`, padding: "2px 8px", borderRadius: 999 }}><Tag size={10} />{t.category}</span>}
        {t.sprint && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--slate)", background: "var(--mint-2)", padding: "2px 8px", borderRadius: 999 }}>{t.sprint}</span>}
        {t.endDate && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: overdue ? "#DC4141" : "var(--slate)" }}><CalendarDays size={12} />{fmtDate(t.endDate)}</span>}
        {t.attachments?.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "var(--teal)" }}><Paperclip size={12} />{t.attachments.length}</span>}
        <span style={{ marginLeft: "auto" }}><AssigneeStack names={t.assignees} size={24} /></span>
      </div>
    </div>
  );
}

export function TaskEditor({ task, onClose, onSave, onDelete, onWarn }) {
  const [t, setT] = useState(task);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setT(prev => ({ ...prev, [k]: v }));
  const toggleAssignee = (u) => setT(prev => { const cur = prev.assignees || []; return { ...prev, assignees: cur.includes(u) ? cur.filter(x => x !== u) : [...cur, u] }; });
  const isNew = !!task._new;

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    const LIMIT = 15 * 1024 * 1024; // per-file cap (IndexedDB handles the volume)
    const tooBig = files.filter(f => f.size > LIMIT);
    if (tooBig.length) onWarn?.(`Skipped ${tooBig.length} file(s) over 15 MB.`);
    const ok = files.filter(f => f.size <= LIMIT);
    try {
      // Upload each file to the backend (/documents/add, shared/cloud); if that
      // fails, stash the bytes in IndexedDB (local). Either way the task keeps
      // only lightweight metadata.
      const metas = [];
      let usedLocal = false;
      for (const f of ok) {
        const id = crypto.randomUUID();
        const base = { id, name: f.name, type: f.type, size: f.size };
        try {
          const { path, url } = await planUploadDocument(f);
          metas.push({ ...base, store: "server", path, url });
          continue;
        } catch { /* fall through to local */ usedLocal = true; }
        const r = await planReadFile(f);
        await planIdbPut({ id, name: r.name, type: r.type, size: r.size, dataUrl: r.dataUrl });
        metas.push({ ...base, store: "idb" });
      }
      if (usedLocal) onWarn?.("Some files couldn't reach the server and were saved to this browser instead.");
      if (metas.length) setT(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...metas] }));
    } catch { onWarn?.("Could not read one of the files."); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeAttachment = (i) => setT(prev => {
    const target = (prev.attachments || [])[i];
    if (target?.path) fbStorageDelete(target.path);
    else if (target?.id) planIdbDel(target.id);
    return { ...prev, attachments: prev.attachments.filter((_, idx) => idx !== i) };
  });
  const openAttachment = async (a) => { if (!(await planDownloadAttachment(a))) onWarn?.("Attachment not found in this browser."); };

  const label = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6, display: "block" };
  const fmtSize = (b) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  const canSave = t.title.trim().length > 0;

  return createPortal(
    <div onClick={onClose} style={{ ...overlay, alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} className="pw-pop" style={{ width: "min(680px,100%)", background: "#fff", borderRadius: "var(--radius)", padding: 26, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 80px)", overflowY: "auto", fontFamily: "'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
          <div><p className="eyebrow">{isNew ? "New task" : "Edit task"}</p><h2 style={{ fontSize: 22 }}>{isNew ? "Create a task" : (t.title || "Task")}</h2></div>
          <button onClick={onClose} style={{ ...iconBtn, flexShrink: 0 }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Title</label>
          <input autoFocus value={t.title} onChange={e => set("title", e.target.value)} placeholder="What needs to be done?" style={inp} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Assignees</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {PLAN_USERS.map(u => { const on = (t.assignees || []).includes(u); return (
              <button key={u} type="button" onClick={() => toggleAssignee(u)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px 5px 6px", borderRadius: 999, border: `1.5px solid ${on ? "var(--forest)" : "var(--border)"}`, background: on ? "var(--mint-2)" : "#fff", fontSize: 12.5, fontWeight: 600, color: on ? "var(--forest)" : "var(--slate)" }}>
                <PlanAvatar name={u} size={20} /> {u} {on && <Check size={13} />}
              </button>
            ); })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 7 }}>“The Group” = {PLAN_GROUP.join(", ")}.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>Status</label>
            <select value={t.status} onChange={e => set("status", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {PLAN_STATUSES.map(s => <option key={s.key} value={s.key}>{s.key}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Priority</label>
            <select value={t.priority} onChange={e => set("priority", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {PLAN_PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.key}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Category</label>
            <input list="plan-cat-list" value={t.category === "General" ? "" : (t.category || "")} onChange={e => set("category", e.target.value || "General")} placeholder="Pick or type a category" style={inp} />
            <datalist id="plan-cat-list">{PLAN_CATEGORIES.map(c => <option key={c.key} value={c.key} />)}</datalist>
          </div>
          <div>
            <label style={label}>Sprint</label>
            <input list="plan-sprint-list" value={t.sprint || ""} onChange={e => set("sprint", e.target.value)} placeholder="Pick or type a sprint" style={inp} />
            <datalist id="plan-sprint-list">{PLAN_SPRINTS.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label style={label}>Start date</label>
            <input type="date" value={t.startDate} onChange={e => set("startDate", e.target.value)} style={{ ...inp, cursor: "pointer" }} />
          </div>
          <div>
            <label style={label}>End date</label>
            <input type="date" value={t.endDate} min={t.startDate || undefined} onChange={e => set("endDate", e.target.value)} style={{ ...inp, cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Notes</label>
          <textarea value={t.notes} onChange={e => set("notes", e.target.value)} placeholder="Add details, context, checklist…" rows={4} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Attachments</label>
          <input ref={fileRef} type="file" multiple onChange={e => addFiles(e.target.files)} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}><Paperclip size={15} /> {busy ? "Reading…" : "Add files"}</button>
          {(t.attachments?.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
              {t.attachments.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--mint)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 11px" }}>
                  <Paperclip size={14} style={{ color: "var(--teal)", flexShrink: 0 }} />
                  <button onClick={() => openAttachment(a)} title="Download" style={{ fontSize: 13, color: "var(--f)", fontWeight: 600, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{a.name}</button>
                  {(() => { const cloud = a.store !== "idb"; return (
                  <span title={cloud ? "Stored on the server (cloud)" : "Stored in this browser"} style={{ fontSize: 10, fontWeight: 700, color: cloud ? "#0B6F52" : "#7D8A83", background: cloud ? "#E2F3EE" : "#ECEEED", borderRadius: 999, padding: "2px 7px", flexShrink: 0 }}>{cloud ? "CLOUD" : "LOCAL"}</span>
                  ); })()}
                  <span style={{ fontSize: 11.5, color: "var(--muted)", flexShrink: 0 }}>{fmtSize(a.size)}</span>
                  <button onClick={() => removeAttachment(i)} title="Remove" style={{ ...iconBtn, padding: 5, background: "#fff" }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isNew && (t.updatedAt || t.createdAt) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
            {t.createdAt && <span>Created {fmtTime(t.createdAt)}{t.createdBy ? ` · ${t.createdBy}` : ""}</span>}
            {t.updatedAt && <span>Last edited {fmtTime(t.updatedAt)}</span>}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isNew && <button onClick={() => onDelete(t)} style={{ ...btnGhost, color: "#DC4141", borderColor: "#F5BFBF" }}><Trash2 size={15} /> Delete</button>}
          <button onClick={onClose} style={{ ...btnGhost, marginLeft: "auto" }}>Cancel</button>
          <button onClick={() => { const clean = { ...t }; delete clean._new; onSave(clean); }} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}><Check size={16} /> {isNew ? "Create task" : "Save changes"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
