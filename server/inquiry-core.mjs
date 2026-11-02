/*
 * inquiry-core.mjs — platform-neutral handler for Mandarin Oriental Exceptional
 * Homes "Request Availability" inquiries. Thin adapters wire it to each host:
 *   Vercel      api/request-availability.mjs
 *   Netlify     netlify/functions/request-availability.mjs  (+ netlify.toml redirect)
 *   Cloudflare  functions/api/request-availability.js
 *
 * These homes are NOT bookable online: this records a request for a travel
 * advisor to follow up. Nothing here checks availability, takes payment or
 * confirms a reservation.
 *
 * Delivery: POSTs the inquiry (plus a ready-to-send subject / HTML / text email)
 * to a GoHighLevel inbound-webhook workflow, which creates the contact and sends
 * the notification email. See docs/exceptional-homes-inquiries.md.
 *
 * Environment (server-side only — never shipped to the browser):
 *   GHL_INQUIRY_WEBHOOK_URL  GHL workflow "Inbound Webhook" trigger URL (required for real delivery)
 *   INQUIRY_TO               notification recipient passed to the workflow (default Reservations@WhataHotel.com)
 *   ALLOWED_ORIGINS          comma-separated origins allowed to submit (e.g. https://pro.whatahotel.com,https://rawcdn.githack.com)
 *   INQUIRY_DELIVERY         "ghl" (default) | "log" — "log" = local testing only: validates and logs, delivers nothing
 */
import { MO_HOMES_REGISTRY } from "./mo-homes-registry.mjs";

export const DEFAULT_RECIPIENT = "Reservations@WhataHotel.com";
export const SUCCESS_MESSAGE = "Thank you for your inquiry. Our travel advisors will review your preferred dates and contact you regarding availability and rates. Your reservation is not confirmed.";

const LIMITS = { name: 120, email: 254, phone: 32, message: 3000 };
const MIN_FILL_MS = 1500;            // faster than this is almost certainly automated
const RATE_WINDOW_MS = 10 * 60 * 1000, RATE_MAX = 5;   // per client IP, per server instance
const DEDUPE_MS = 15 * 60 * 1000;

const rateHits = new Map();          // ip -> [timestamps]   (best effort: per warm instance)
const recentSubmissions = new Map(); // submissionId -> { inquiryId, at }
const inFlight = new Map();          // submissionId -> Promise<reply>  (concurrent double-submits)

/* ---------------- validation ---------------- */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

function str(v) { return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : ""; }
function intOr(v, dflt) {
  if (v === "" || v == null) return dflt;
  const n = typeof v === "number" ? v : (/^\s*\d+\s*$/.test(String(v)) ? Number(v) : NaN);
  return Number.isInteger(n) ? n : NaN;
}
/** Parse a strict YYYY-MM-DD calendar date (rejects 2026-02-30 etc). Returns UTC ms or null. */
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? t : null;
}

/**
 * Validate and normalise a submission. The home is identified ONLY by
 * propertyId, which must exist in the server registry; any name/country the
 * client sends is ignored.
 */
export function validateInquiry(body, opts = {}) {
  const b = body && typeof body === "object" ? body : {};
  const errors = {};
  const now = opts.now || Date.now();
  const home = MO_HOMES_REGISTRY[str(b.propertyId)];
  if (!home) errors.propertyId = "This home could not be found. Please reopen the request from the home's card.";

  const fullName = str(b.fullName);
  if (!fullName) errors.fullName = "Please enter your full name.";
  else if (fullName.length > LIMITS.name) errors.fullName = "Please shorten your name.";

  const email = str(b.email);
  if (!email) errors.email = "Please enter your email address.";
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = "Please enter a valid email address.";

  const phone = str(b.phone);
  if (phone && (phone.length > LIMITS.phone || !/^\+?[\d\s().-]{6,}$/.test(phone) || (phone.match(/\d/g) || []).length < 6)) errors.phone = "Please enter a valid phone number, including the country code.";

  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const ci = parseDate(b.checkIn), co = parseDate(b.checkOut);
  if (!b.checkIn) errors.checkIn = "Please choose your preferred check-in date.";
  else if (ci == null) errors.checkIn = "Please enter a valid check-in date.";
  else if (ci < today - 86400000) errors.checkIn = "Check-in can't be in the past.";      // 1-day grace for time zones
  else if (ci > today + 3 * 366 * 86400000) errors.checkIn = "Please choose a check-in date within the next three years.";
  if (!b.checkOut) errors.checkOut = "Please choose your preferred check-out date.";
  else if (co == null) errors.checkOut = "Please enter a valid check-out date.";
  else if (ci != null && co <= ci) errors.checkOut = "Check-out must be after check-in.";
  else if (ci != null && co - ci > 365 * 86400000) errors.checkOut = "Please choose a stay of one year or less.";

  const adults = intOr(b.adults, NaN), children = intOr(b.children, 0), infants = intOr(b.infants, 0);
  if (!Number.isInteger(adults) || adults < 1) errors.adults = "Please enter at least 1 adult.";
  else if (adults > 60) errors.adults = "Please contact us directly for groups of more than 60 adults.";
  if (!Number.isInteger(children) || children < 0 || children > 40) errors.children = "Please enter a valid number of children.";
  if (!Number.isInteger(infants) || infants < 0 || infants > 20) errors.infants = "Please enter a valid number of infants.";

  const message = str(b.message);
  if (message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;
  if (b.consent !== true && b.consent !== "true" && b.consent !== "on") errors.consent = "Please confirm you agree to be contacted about this inquiry.";

  if (Object.keys(errors).length) return { ok: false, errors };
  const nights = Math.round((co - ci) / 86400000);
  const total = adults + children + infants;
  // Capacity is informational only — never an availability guarantee or a hard block.
  const overCapacity = home.maxGuests != null && adults + children > home.maxGuests;
  return {
    ok: true,
    home: { id: str(b.propertyId), ...home },
    inquiry: { fullName, email, phone: phone || null, checkIn: str(b.checkIn), checkOut: str(b.checkOut), nights, adults, children, infants, totalGuests: total, message: message || null, overCapacity },
  };
}

/* ---------------- anti-spam ---------------- */
export function spamCheck(body, opts = {}) {
  const b = body || {};
  if (str(b.website) || str(b.company_website)) return "honeypot";           // hidden field filled
  const elapsed = Number(b.elapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < (opts.minFillMs ?? MIN_FILL_MS)) return "too_fast";
  return null;
}
export function rateLimited(ip, now = Date.now()) {
  if (!ip) return false;
  const hits = (rateHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) { rateHits.set(ip, hits); return true; }
  hits.push(now); rateHits.set(ip, hits);
  if (rateHits.size > 5000) rateHits.clear();   // bound memory
  return false;
}
export function _resetForTests() { rateHits.clear(); recentSubmissions.clear(); inFlight.clear(); }
function isProduction(env) { return env.VERCEL_ENV === "production" || env.CONTEXT === "production" || env.CF_PAGES_BRANCH === "main" || env.NODE_ENV === "production"; }

/* ---------------- email ---------------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
export function makeInquiryId(now = Date.now(), rand = Math.random) {
  const d = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
  const r = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("");
  return `MOH-${d}-${r}`;
}
function placeLine(home) {
  const loc = home.location || "";
  return loc && loc.toLowerCase().includes(String(home.country).toLowerCase()) ? loc : [loc, home.country].filter(Boolean).join(" · ");
}
export function renderEmail(home, q, meta) {
  const subject = `New Exceptional Home Availability Request — ${home.name}`;
  const rows = [
    ["Property", home.name], ["Destination", placeLine(home)],
    ["Source property page", home.sourceUrl],
    ["Guest name", q.fullName], ["Guest email", q.email], ["Guest phone", q.phone || "Not provided"],
    ["Preferred check-in", q.checkIn], ["Preferred check-out", q.checkOut], ["Nights", String(q.nights)],
    ["Adults", String(q.adults)], ["Children", String(q.children)], ["Infants", String(q.infants)], ["Total guests", String(q.totalGuests)],
    ["Additional requests", q.message || "None"], ["Submitted", meta.submittedAt], ["Inquiry ID", meta.inquiryId],
  ];
  const capacityNote = q.overCapacity ? `Note: the guest count (adults + children) exceeds the home's published capacity of ${home.maxGuests}. Please review with the guest.` : null;
  const text = [
    subject, "", "This is an availability REQUEST. Nothing has been booked or confirmed.", "",
    ...rows.map(([k, v]) => `${k}: ${v}`), ...(capacityNote ? ["", capacityNote] : []), "",
    "Reply to this email to respond to the guest directly.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:Georgia,'Times New Roman',serif;color:#0c1a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7dfcf">
<tr><td style="background:#0c1a2b;padding:22px 28px;color:#e3c887;font:600 12px/1.4 Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase">Mandarin Oriental Exceptional Homes · Availability request</td></tr>
<tr><td style="padding:24px 28px 8px"><h1 style="margin:0 0 6px;font-size:22px;font-weight:normal">${esc(home.name)}</h1>
<p style="margin:0;color:#4d5f70;font:14px/1.5 Arial,sans-serif">${esc(placeLine(home))}</p>
<p style="margin:14px 0 0;padding:10px 12px;background:#fbf6ea;border-left:3px solid #c6a35a;font:13px/1.5 Arial,sans-serif;color:#4d3d17">This is an availability <b>request</b>. Nothing has been booked or confirmed.</p></td></tr>
<tr><td style="padding:8px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:14px/1.5 Arial,sans-serif">
${rows.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#728394;width:38%;vertical-align:top;border-bottom:1px solid #f0ebe0">${esc(k)}</td><td style="padding:7px 0;vertical-align:top;border-bottom:1px solid #f0ebe0">${k === "Source property page" ? `<a href="${esc(v)}" style="color:#9c7c3a">${esc(v)}</a>` : k === "Guest email" ? `<a href="mailto:${esc(v)}" style="color:#9c7c3a">${esc(v)}</a>` : esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("\n")}
</table></td></tr>
${capacityNote ? `<tr><td style="padding:10px 28px 0;font:13px/1.5 Arial,sans-serif;color:#8a4b12">${esc(capacityNote)}</td></tr>` : ""}
<tr><td style="padding:18px 28px 24px;font:12px/1.5 Arial,sans-serif;color:#728394">Reply to this email to respond to the guest directly.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

/* ---------------- delivery (GoHighLevel inbound webhook) ---------------- */
async function postWithRetry(url, payload, fetchImpl, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 10000) : null;
    try {
      const r = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined });
      if (r.ok) return { ok: true, status: r.status, attempts: i + 1 };
      lastErr = `HTTP ${r.status}`;
      if (r.status < 500 && r.status !== 429) break;     // 4xx (except 429) won't improve on retry
    } catch (e) { lastErr = e && e.name === "AbortError" ? "timeout" : "network error"; }
    finally { if (timer) clearTimeout(timer); }
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 400 * Math.pow(3, i)));
  }
  return { ok: false, error: lastErr, attempts };
}

function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = { "Vary": "Origin", "Cache-Control": "no-store" };
  if (origin && allowed.indexOf(origin) !== -1) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return { headers: h, allowed, originOk: !origin || allowed.length === 0 || allowed.indexOf(origin) !== -1 };
}

/**
 * Handle one request. Returns { status, headers, body } for the adapter to send.
 * @param {{method:string, origin?:string, ip?:string, body:any, env:object, fetchImpl?:Function, now?:number, log?:Function}} req
 */
export async function handleInquiryRequest(req) {
  const env = req.env || {};
  const log = req.log || ((...a) => console.log(...a));
  const { headers, originOk } = corsHeaders(req.origin, env);
  const reply = (status, body) => ({ status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }, body });

  if (req.method === "OPTIONS") return { status: originOk ? 204 : 403, headers, body: null };
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
  if (!originOk) return reply(403, { ok: false, error: "origin_not_allowed" });
  if (rateLimited(req.ip, req.now)) return reply(429, { ok: false, error: "rate_limited", message: "Too many requests. Please wait a few minutes and try again." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const spam = spamCheck(body);
  if (spam === "honeypot") { log("[inquiry] dropped: honeypot"); return reply(200, { ok: true, message: SUCCESS_MESSAGE }); }   // don't tip off bots
  if (spam === "too_fast") return reply(400, { ok: false, error: "too_fast", message: "Please take a moment to review your details, then submit again." });

  const v = validateInquiry(body, { now: req.now });
  if (!v.ok) return reply(422, { ok: false, error: "validation", fields: v.errors });

  // Duplicate submissions (double-clicks / retries) return the original inquiry ID.
  const sid = str(body.submissionId).slice(0, 64);
  const t = req.now || Date.now();
  for (const [k, val] of recentSubmissions) if (t - val.at > DEDUPE_MS) recentSubmissions.delete(k);
  if (sid && recentSubmissions.has(sid)) return reply(200, { ok: true, inquiryId: recentSubmissions.get(sid).inquiryId, message: SUCCESS_MESSAGE, duplicate: true });
  if (sid && inFlight.has(sid)) { const first = await inFlight.get(sid); return first.status === 200 ? reply(200, { ...first.body, duplicate: true }) : first; }
  if (!sid) return deliver();
  const p = deliver();
  inFlight.set(sid, p);
  try { return await p; } finally { inFlight.delete(sid); }

  async function deliver() {

  const inquiryId = makeInquiryId(t);
  const submittedAt = new Date(t).toISOString();
  const email = renderEmail(v.home, v.inquiry, { inquiryId, submittedAt });
  const [firstName, ...restName] = v.inquiry.fullName.split(/\s+/);
  const payload = {
    event: "exceptional_home_availability_request",
    inquiry_id: inquiryId, submitted_at: submittedAt,
    notify_to: env.INQUIRY_TO || DEFAULT_RECIPIENT,
    reply_to: v.inquiry.email,
    subject: email.subject, email_html: email.html, email_text: email.text,
    property_id: v.home.id, property_name: v.home.name, property_country: v.home.country, property_location: v.home.location, property_source_url: v.home.sourceUrl,
    full_name: v.inquiry.fullName, first_name: firstName, last_name: restName.join(" "), email: v.inquiry.email, phone: v.inquiry.phone || "",
    check_in: v.inquiry.checkIn, check_out: v.inquiry.checkOut, nights: v.inquiry.nights,
    adults: v.inquiry.adults, children: v.inquiry.children, infants: v.inquiry.infants, total_guests: v.inquiry.totalGuests,
    message: v.inquiry.message || "", over_published_capacity: v.inquiry.overCapacity, consent: true,
    tags: ["exceptional-homes-inquiry"],
  };

  const mode = (env.INQUIRY_DELIVERY || "ghl").toLowerCase();
  // "log" is for local/preview testing only: it reports success without sending,
  // so it is refused on production deployments.
  if (mode === "log" && isProduction(env)) {
    log(`[inquiry] ${inquiryId} not delivered: INQUIRY_DELIVERY=log is not allowed in production`);
    return reply(503, { ok: false, error: "not_configured", message: "Online requests are temporarily unavailable." });
  }
  if (mode === "log") {
    log(`[inquiry] ${inquiryId} ${v.home.id} — LOG MODE, not delivered`);
    if (sid) recentSubmissions.set(sid, { inquiryId, at: t });
    return reply(200, { ok: true, inquiryId, message: SUCCESS_MESSAGE, delivery: "log" });
  }
  if (!env.GHL_INQUIRY_WEBHOOK_URL) {
    log(`[inquiry] ${inquiryId} not delivered: GHL_INQUIRY_WEBHOOK_URL is not configured`);
    return reply(503, { ok: false, error: "not_configured", message: "Online requests are temporarily unavailable." });
  }
  const sent = await postWithRetry(env.GHL_INQUIRY_WEBHOOK_URL, payload, req.fetchImpl || fetch);
  if (!sent.ok) {
    log(`[inquiry] ${inquiryId} ${v.home.id} delivery FAILED after ${sent.attempts} attempt(s): ${sent.error}`);   // no personal data in logs
    return reply(502, { ok: false, error: "delivery_failed", message: "We couldn't send your request just now." });
  }
  log(`[inquiry] ${inquiryId} ${v.home.id} delivered (attempts: ${sent.attempts})`);
  if (sid) recentSubmissions.set(sid, { inquiryId, at: t });
  return reply(200, { ok: true, inquiryId, message: SUCCESS_MESSAGE });
  }
}
