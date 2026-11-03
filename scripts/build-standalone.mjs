/*
 * build-standalone.mjs — bundle the whole landing page into ONE self-contained
 * HTML file (all CSS + JS + data inline), suitable for pasting into GoHighLevel
 * (Custom Code / HTML element or a funnel step) or hosting as a single file.
 *
 * Uses the real WhataHotel image URLs (they load on any https page, incl. GHL).
 *
 * Run:  node scripts/build-standalone.mjs
 *       GHL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/<…> node scripts/build-standalone.mjs
 *       (or INQUIRY_ENDPOINT=https://<your-deployment>/api/request-availability for the server route)
 * Output: gohighlevel.html  (repo root)
 *
 * INQUIRY_ENDPOINT: the Exceptional Homes "Request Availability" form posts here.
 * A GHL-hosted page has no /api, so the embed needs the absolute URL of the
 * deployment that runs api/request-availability. Without it the form shows its
 * error state (with the reservations email); it never shows a false success.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let html = read("index.html");

// Inline every local stylesheet/script (leave third-party CDN/config alone).
const inlines = [
  ['<link rel="stylesheet" href="assets/css/homes.css">', () => "<style>\n" + read("assets/css/homes.css") + "\n</style>"],
  ['<script src="assets/js/data.js"></script>', () => "<script>\n" + read("assets/js/data.js") + "\n</script>"],
  ['<script src="assets/js/images.js"></script>', () => "<script>\n" + read("assets/js/images.js") + "\n</script>"],
  ['<script src="assets/js/descriptions.js"></script>', () => "<script>\n" + read("assets/js/descriptions.js") + "\n</script>"],
  ['<script src="assets/js/characteristics.js"></script>', () => "<script>\n" + read("assets/js/characteristics.js") + "\n</script>"],
  ['<script src="assets/js/details.js"></script>', () => "<script>\n" + read("assets/js/details.js") + "\n</script>"],
  ['<script src="assets/js/homes-inventory-filter.js"></script>', () => "<script>\n" + read("assets/js/homes-inventory-filter.js") + "\n</script>"],
  ['<script src="assets/js/homes.js" defer></script>', () => "<script>\n" + read("assets/js/homes.js") + "\n</script>"],
  ['<link rel="stylesheet" href="assets/css/mo-homes.css">', () => "<style>\n" + read("assets/css/mo-homes.css") + "\n</style>"],
  // Exceptional Homes: data is inlined (no lazy fetch from a relative path inside GHL).
  ['<script src="assets/js/mo-format.js" defer></script>', () => "<script>\n" + read("assets/js/mo-homes.js") + "\n</script>\n<script>\n" + read("assets/js/mo-format.js") + "\n</script>"],
  ['<script src="assets/js/mo-homes-ui.js" defer></script>', () => "<script>\n" + read("assets/js/mo-homes-ui.js") + "\n</script>"],
];
for (const [tag, payload] of inlines) {
  if (html.indexOf(tag) === -1) throw new Error("Tag not found while bundling: " + tag);
  html = html.replace(tag, payload); // function form → no $-substitution surprises
}

// GHL_WEBHOOK_URL: GoHighLevel Inbound Webhook the Request Availability form posts to directly.
const HOOK = process.env.GHL_WEBHOOK_URL;
if (HOOK) {
  if (!/^https:\/\/(services|backend)\.leadconnectorhq\.com\/hooks\/[A-Za-z0-9_\-\/]+$/.test(HOOK)) throw new Error("GHL_WEBHOOK_URL must look like https://services.leadconnectorhq.com/hooks/…");
  const re = /<meta name="wah-ghl-webhook" content="[^"]*">/;
  if (!re.test(html)) throw new Error("Webhook meta tag not found");
  html = html.replace(re, () => `<meta name="wah-ghl-webhook" content="${HOOK}">`);
}
const EP = process.env.INQUIRY_ENDPOINT;
if (EP) {
  if (!/^https:\/\/[^\s"<>]+\/api\/request-availability$/.test(EP)) throw new Error("INQUIRY_ENDPOINT must be https://…/api/request-availability");
  const tag = '<meta name="wah-inquiry-endpoint" content="/api/request-availability">';
  if (html.indexOf(tag) === -1) throw new Error("Endpoint meta tag not found");
  html = html.replace(tag, () => `<meta name="wah-inquiry-endpoint" content="${EP}">`);
} else if (!HOOK && /<meta name="wah-ghl-webhook" content="">/.test(html)) {
  console.warn("Note: neither GHL_WEBHOOK_URL nor INQUIRY_ENDPOINT is set — the embedded Request Availability form will post to /api/request-availability on the GHL domain and show its error state.");
}

const OUT = join(root, "gohighlevel.html");
writeFileSync(OUT, html);
console.log("Wrote", OUT, "(" + Math.round(html.length / 1024) + " KB, self-contained)");
