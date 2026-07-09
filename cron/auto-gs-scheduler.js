/* =============================================================================
 * Auto GS Scheduler — daily cron job
 * -----------------------------------------------------------------------------
 * For each society on a 15-day general-service (GS) cycle, this job creates a
 * Freshdesk ticket on DAY 14 so a technician visits on day 15.
 *
 * Runtime : Google Cloud Function (Node 18+, has global fetch) OR any Node cron.
 * Trigger : Cloud Scheduler → HTTP → this function, once a day. See README.md.
 *
 * It is IDEMPOTENT: it raises at most one ticket per society per 15-day cycle,
 * even if the scheduler fires twice or a day was missed.
 * ===========================================================================*/

// ── Config (env) ─────────────────────────────────────────────────────────────
const FRESHDESK_DOMAIN     = process.env.FRESHDESK_DOMAIN;                    // e.g. prowater.freshdesk.com
const FRESHDESK_API_KEY    = process.env.FRESHDESK_API_KEY;                   // Freshdesk API key
const REQUESTER_EMAIL      = process.env.FRESHDESK_REQUESTER_EMAIL || "ops@prowater.in";

const GS_INTERVAL_DAYS = 15;   // one general service every 15 days
const CREATE_ON_DAY    = 14;   // raise the ticket on day 14 (visit on day 15)
const DAY_MS = 86400000;

// ── Data access — REPLACE with your real store (Firestore shown) ─────────────
// Each schedule doc: { society, lastService: "YYYY-MM-DD", cycleKey?, cycleTicketId? }
//   - lastService : date of the most recent completed GS (resets the cycle).
//   - cycleKey     : idempotency marker = the lastService we already ticketed.
//   - cycleTicketId: the Freshdesk id raised for the current cycle.
const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const COLLECTION = "gs_schedules";

async function getSchedules() {
  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function saveTicket(docId, ticketId, cycleKey) {
  await db.collection(COLLECTION).doc(docId).set(
    { cycleTicketId: ticketId, cycleKey, ticketedAt: new Date().toISOString() },
    { merge: true }
  );
}
// <<< WIRE: if you store schedules in Cloud SQL / another DB, swap the two
//     functions above for your queries. Everything below stays the same.

// ── Freshdesk create (matches the validated frontend payload) ────────────────
async function createFreshdeskTicket({ society, nextServiceDate }) {
  if (!FRESHDESK_DOMAIN || !FRESHDESK_API_KEY) throw new Error("FRESHDESK_DOMAIN / FRESHDESK_API_KEY not set");
  const auth = Buffer.from(`${FRESHDESK_API_KEY}:X`).toString("base64");
  const body = {
    subject: `[Auto GS] ${GS_INTERVAL_DAYS}-day service — ${society}`,
    description: `Scheduled ${GS_INTERVAL_DAYS}-day general service for ${society}. Technician visit due ${nextServiceDate}.`,
    email: REQUESTER_EMAIL,      // requester is mandatory
    status: 2,                    // Open
    priority: 2,                  // Medium
    type: "Support",              // MUST be one of Installation/Delivery/Support/Uninstallation
    custom_fields: {              // custom fields MUST be nested here (not top-level)
      cf_society_name766799: society,
      cf_l1_issue_type: "General Service",
    },
  };
  const res = await fetch(`https://${FRESHDESK_DOMAIN}/api/v2/tickets`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Freshdesk ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

// ── Core logic ───────────────────────────────────────────────────────────────
function daysBetween(from, to) { return Math.floor((to - from) / DAY_MS); }

async function run(now = new Date()) {
  const schedules = await getSchedules();
  const results = [];
  for (const s of schedules) {
    const last = new Date(s.lastService);
    if (isNaN(last.getTime())) { results.push({ society: s.society, status: "skip:no-date" }); continue; }

    const daysSince = daysBetween(last, now);
    const cycleKey  = String(s.lastService);          // one ticket per cycle
    const dueWindow = daysSince >= CREATE_ON_DAY && daysSince <= GS_INTERVAL_DAYS + 2; // day 14..17 (missed-run tolerance)
    const alreadyDone = s.cycleKey === cycleKey;

    if (!dueWindow) { results.push({ society: s.society, status: "skip:not-due", daysSince }); continue; }
    if (alreadyDone) { results.push({ society: s.society, status: "skip:already-ticketed", ticketId: s.cycleTicketId }); continue; }

    const nextService = new Date(last.getTime() + GS_INTERVAL_DAYS * DAY_MS).toISOString().slice(0, 10);
    try {
      const ticketId = await createFreshdeskTicket({ society: s.society, nextServiceDate: nextService });
      await saveTicket(s.id, ticketId, cycleKey);
      results.push({ society: s.society, status: "created", ticketId });
    } catch (e) {
      results.push({ society: s.society, status: "error", error: e.message });
    }
  }
  return results;
}

// ── Entry points ─────────────────────────────────────────────────────────────
// Cloud Function HTTP entrypoint (Cloud Scheduler calls this daily).
exports.autoGsScheduler = async (req, res) => {
  try {
    const results = await run();
    console.log("[auto-gs] run", JSON.stringify(results));
    res.status(200).json({ ok: true, ranAt: new Date().toISOString(), results });
  } catch (e) {
    console.error("[auto-gs] fatal", e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

// Local run: `node auto-gs-scheduler.js`
if (require.main === module) {
  run().then(r => { console.log(JSON.stringify(r, null, 2)); }).catch(e => { console.error(e); process.exit(1); });
}

module.exports.run = run; // exported for tests
