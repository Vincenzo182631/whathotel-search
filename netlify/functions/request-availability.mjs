/*
 * Mandarin Oriental Exceptional Homes — "Request Availability" endpoint
 * (Netlify Functions). netlify.toml maps /api/request-availability → here.
 * Logic: server/inquiry-core.mjs. Env vars (Netlify → Site settings →
 * Environment variables): GHL_INQUIRY_WEBHOOK_URL, INQUIRY_TO, ALLOWED_ORIGINS.
 */
import { handleInquiryRequest } from "../../server/inquiry-core.mjs";

const MAX_BODY = 32 * 1024;

export const handler = async function (event) {
  var raw = event.body || "";
  if (event.isBase64Encoded) raw = Buffer.from(raw, "base64").toString("utf8");
  if (raw.length > MAX_BODY) return { statusCode: 413, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: "too_large" }) };
  var body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch (e) { body = {}; }
  var h = event.headers || {};
  var out = await handleInquiryRequest({
    method: event.httpMethod,
    origin: h.origin || h.Origin,
    ip: h["x-nf-client-connection-ip"] || String(h["x-forwarded-for"] || "").split(",")[0].trim(),
    body: body,
    env: process.env,
  });
  return { statusCode: out.status, headers: out.headers, body: out.body == null ? "" : JSON.stringify(out.body) };
};
