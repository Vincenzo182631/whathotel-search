/*
 * Mandarin Oriental Exceptional Homes — "Request Availability" endpoint
 * (Cloudflare Pages Functions). Route: /api/request-availability
 * Logic: server/inquiry-core.mjs. Env vars (Cloudflare Pages → Settings →
 * Environment variables): GHL_INQUIRY_WEBHOOK_URL, INQUIRY_TO, ALLOWED_ORIGINS.
 */
import { handleInquiryRequest } from "../../server/inquiry-core.mjs";

const MAX_BODY = 32 * 1024;

export async function onRequest(context) {
  var request = context.request;
  var body = {};
  if (request.method === "POST") {
    var raw = await request.text();
    if (raw.length > MAX_BODY) return new Response(JSON.stringify({ ok: false, error: "too_large" }), { status: 413, headers: { "Content-Type": "application/json" } });
    try { body = raw ? JSON.parse(raw) : {}; } catch (e) { body = {}; }
  }
  var out = await handleInquiryRequest({
    method: request.method,
    origin: request.headers.get("Origin"),
    ip: request.headers.get("CF-Connecting-IP") || "",
    body: body,
    env: context.env || {},
  });
  return new Response(out.body == null ? null : JSON.stringify(out.body), { status: out.status, headers: out.headers });
}
