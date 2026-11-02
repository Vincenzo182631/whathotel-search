/*
 * Mandarin Oriental Exceptional Homes — "Request Availability" endpoint
 * (Vercel serverless function). Route: /api/request-availability
 *
 * All logic lives in server/inquiry-core.mjs (shared with the Netlify and
 * Cloudflare adapters). Set these in Vercel → Project → Settings →
 * Environment Variables (NEVER in code): GHL_INQUIRY_WEBHOOK_URL, INQUIRY_TO,
 * ALLOWED_ORIGINS — see docs/exceptional-homes-inquiries.md.
 */
import { handleInquiryRequest } from "../server/inquiry-core.mjs";

const MAX_BODY = 32 * 1024;

export default async function handler(req, res) {
  var body = req.body;
  if (typeof body === "string") {
    if (body.length > MAX_BODY) return res.status(413).json({ ok: false, error: "too_large" });
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  var fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  var out = await handleInquiryRequest({
    method: req.method,
    origin: req.headers.origin,
    ip: fwd || (req.socket && req.socket.remoteAddress) || "",
    body: body,
    env: process.env,
  });
  Object.keys(out.headers).forEach(function (k) { res.setHeader(k, out.headers[k]); });
  if (out.body == null) return res.status(out.status).end();
  return res.status(out.status).json(out.body);
}
