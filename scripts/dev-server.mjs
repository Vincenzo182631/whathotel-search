#!/usr/bin/env node
/*
 * Local preview server: serves the static site and runs the real
 * /api/request-availability handler (server/inquiry-core.mjs).
 *
 *   node scripts/dev-server.mjs                    # INQUIRY_DELIVERY=log (nothing is sent)
 *   GHL_INQUIRY_WEBHOOK_URL=https://… INQUIRY_TO=test@… node scripts/dev-server.mjs
 *
 * Env: PORT (default 8787), plus the same variables as production
 * (GHL_INQUIRY_WEBHOOK_URL, INQUIRY_TO, ALLOWED_ORIGINS, INQUIRY_DELIVERY).
 * Never point this at the live reservations inbox without approval.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleInquiryRequest } from "../server/inquiry-core.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const env = { ...process.env };
if (!env.GHL_INQUIRY_WEBHOOK_URL && !env.INQUIRY_DELIVERY) env.INQUIRY_DELIVERY = "log";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/request-availability") {
    let raw = "";
    for await (const c of req) { raw += c; if (raw.length > 32 * 1024) { res.writeHead(413).end(); return; } }
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { body = {}; }
    const out = await handleInquiryRequest({ method: req.method, origin: req.headers.origin, ip: req.socket.remoteAddress, body, env });
    res.writeHead(out.status, out.headers);
    res.end(out.body == null ? "" : JSON.stringify(out.body));
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (/(^|[/\\])(\.|server[/\\]|data[/\\]\.mo-cache)/.test(rel.slice(1))) { res.writeHead(404).end("Not found"); return; }
  try {
    const buf = await readFile(join(root, rel));
    res.writeHead(200, { "Content-Type": TYPES[extname(rel)] || "application/octet-stream" }).end(buf);
  } catch (e) { res.writeHead(404).end("Not found"); }
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}  (delivery: ${env.INQUIRY_DELIVERY || "ghl"}${env.GHL_INQUIRY_WEBHOOK_URL ? " → webhook configured" : ""})`));
