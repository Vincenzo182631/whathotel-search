// Unit tests for the Mandarin Oriental Exceptional Homes integration.
// Run:  node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { bedroomsBase, normalizeCount, selectHomes, parseHeadline, parseRate, htmlToBlocks, splitSections } from "../scripts/lib/mo-homes-lib.mjs";
import { validateInquiry, spamCheck, handleInquiryRequest, renderEmail, parseDate, _resetForTests, SUCCESS_MESSAGE, DEFAULT_RECIPIENT } from "../server/inquiry-core.mjs";
import { MO_HOMES_REGISTRY } from "../server/mo-homes-registry.mjs";

const require = createRequire(import.meta.url);
const F = require("../assets/js/mo-format.js");
const CONFIG = JSON.parse(readFileSync(new URL("../scripts/mo-homes.config.json", import.meta.url), "utf8"));
const DATA = JSON.parse(readFileSync(new URL("../data/mo-exceptional-homes.json", import.meta.url), "utf8"));

const NOW = Date.UTC(2026, 10, 2, 12);           // 2026-11-02
const ID = "mo-tatvani";
function goodBody(over = {}) {
  return { propertyId: ID, fullName: "Test Guest", email: "guest@example.com", phone: "+1 212 555 0100", checkIn: "2027-02-10", checkOut: "2027-02-17",
    adults: "4", children: "2", infants: "1", message: "Anniversary", consent: true, website: "", elapsedMs: 9000, submissionId: "sid-" + Math.random(), ...over };
}
const okFetch = (calls) => async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
const ENV = { GHL_INQUIRY_WEBHOOK_URL: "https://hooks.example.test/ghl", INQUIRY_TO: "test-inbox@example.test" };
const quiet = () => {};

/* ---------------- 1. Selection rules ---------------- */
test("selection: <=8 all, 9-12 full dozen, >12 only 4-8 bedrooms, source order kept, max 64", () => {
  const mk = (country, n, beds) => Array.from({ length: n }, (_, i) => ({ slug: `${country}-${i}`, name: `${country} ${i}`, country, bedroomsDisplay: beds(i), sourceOrder: i }));
  const listing = [
    ...mk("Indonesia", 3, () => "5"),
    ...mk("Italy", 10, () => "12"),                                        // 9-12 → all, regardless of bedrooms
    ...mk("Spain", 15, (i) => (i === 0 ? "10+1" : i === 1 ? "11" : i === 2 ? "3" : `${4 + (i % 5)}`)),
  ];
  const { selected, excluded } = selectHomes(listing, CONFIG);
  const by = (c) => selected.filter((h) => h.country === c);
  assert.equal(by("Indonesia").length, 3);
  assert.equal(by("Italy").length, 10);
  assert.equal(by("Spain").length, 12);
  assert.deepEqual(excluded.map((e) => e.slug).sort(), ["Spain-0", "Spain-1", "Spain-2"]);
  assert.deepEqual(by("Spain").map((h) => h.sourceOrder), [...by("Spain").map((h) => h.sourceOrder)].sort((a, b) => a - b));
  const big = Array.from({ length: 8 }, (_, k) => CONFIG.countries[k]).flatMap((c) => mk(c, 12, () => "5"));
  assert.equal(selectHomes(big, CONFIG).selected.length, 64);
});
test("bedrooms: base count and display preserved", () => {
  assert.equal(bedroomsBase("8+1"), 8);
  assert.equal(normalizeCount("8 + 1"), "8+1");
  assert.equal(bedroomsBase(null), null);
});

/* ---------------- 2. Parsing ---------------- */
test("headline parsing keeps qualifiers and never guesses", () => {
  const h = parseHeadline("Chiang Rai, Thailand | 5+4 Bedrooms | 11 Bathrooms | 18 Guests");
  assert.equal(h.bedroomsDisplay, "5+4"); assert.equal(h.bathroomsDisplay, "11"); assert.equal(h.maxGuests, 18);
  const m = parseHeadline("Uluwatu, Bali | 8+1 Bedrooms | 9 Bathrooms | 16+2 Guests");
  assert.equal(m.maxGuests, null); assert.equal(m.maxGuestsDisplay, "16+2");
  const missing = parseHeadline("Somewhere | 4 Bedrooms");
  assert.equal(missing.bathroomsDisplay, null); assert.equal(missing.maxGuests, null);
});
test("rate parsing: amount, currency, unit; missing → null (never 0)", () => {
  const r = parseRate("from $3,380.00 / Night", "USD");
  assert.equal(r.startingRate, 3380); assert.equal(r.currency, "USD"); assert.equal(r.rateUnit, "Night");
  assert.equal(parseRate(null, "USD"), null);
  assert.equal(parseRate("Price on request", "USD"), null);
  assert.equal(parseRate("from $0 / Night", "USD"), null);
  assert.equal(parseRate("from €5,000 / Night", "USD").currency, null);     // symbol/currency mismatch is not silently accepted
});
test("rich text → DETAILS and ACTIVITIES NEARBY sections", () => {
  const blocks = htmlToBlocks("<p>Intro &amp; more.</p><p><strong>Activities nearby:</strong></p><ul><li>Beach (2 km)</li><li>Golf</li></ul><p><b>Amenities:</b> Pool</p>");
  const { details, activitiesNearby } = splitSections(blocks);
  assert.ok(details.some((b) => b.text && b.text.includes("Intro & more.")));
  assert.ok(activitiesNearby.some((b) => b.type === "list" && b.items.includes("Golf")));
  assert.ok(!JSON.stringify(blocks).includes("<"), "no raw HTML survives");
});

/* ---------------- 3. Dataset integrity ---------------- */
test("dataset: 42 homes, unique ids, registry matches, no invented values", () => {
  assert.equal(DATA.homes.length, 42);
  assert.ok(DATA.homes.length <= CONFIG.selection.maxTotal);
  const ids = DATA.homes.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(MO_HOMES_REGISTRY).sort(), [...ids].sort());
  for (const h of DATA.homes) {
    assert.ok(h.name && h.name === h.name.trim(), `name trimmed: ${h.id}`);
    assert.ok(CONFIG.countries.includes(h.country));
    assert.ok(h.startingRate == null || h.startingRate > 0, `rate never 0: ${h.id}`);
    assert.ok(/^https:\/\/www\.mandarinoriental\.com\/en\/exceptional-homes\//.test(h.sourceUrl));
    assert.ok(h.lastVerified);
    for (const a of h.imageAssets) assert.ok(a.url && a.alt && a.credit);
  }
});

/* ---------------- 4. Formatting ---------------- */
test("format: rate, missing rate, counts, country counts, filter order", () => {
  assert.deepEqual([F.formatRate({ startingRate: 3380, currency: "USD", rateUnit: "Night" }).text, F.formatRate({ startingRate: 3380, currency: "USD", rateUnit: "Night" }).unit], ["$3,380 USD", "per night"]);
  assert.equal(F.formatRate({ startingRate: 5311.25, currency: "USD" }).text, "$5,311.25 USD");
  const miss = F.formatRate({ startingRate: null });
  assert.equal(miss.missing, true); assert.ok(!/\$|0/.test(miss.text));
  assert.match(F.formatRate({ startingRate: 10, startingRateDisplay: "$10" }).text, /currency to be confirmed/);
  assert.equal(F.formatCount("8+1", "Bedroom", "Bedrooms").text, "8+1 Bedrooms");
  assert.equal(F.formatCount("1", "Bedroom", "Bedrooms").text, "1 Bedroom");
  assert.equal(F.formatCount(null, "Bathroom", "Bathrooms").missing, true);
  const counts = F.countryCounts(DATA.homes, CONFIG.countries);
  assert.equal(counts.all, 42);
  assert.deepEqual(CONFIG.countries.map((c) => counts[c]), [1, 2, 3, 10, 5, 13, 7, 1]);
  const spain = F.filterHomes(DATA.homes, "Spain");
  assert.equal(spain.length, 13);
  assert.ok(spain.every((h, i) => i === 0 || h.sortOrder > spain[i - 1].sortOrder));
});

/* ---------------- 5. Validation ---------------- */
test("validation: good request passes and computes totals", () => {
  const v = validateInquiry(goodBody(), { now: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.inquiry.totalGuests, 7); assert.equal(v.inquiry.nights, 7);
  assert.equal(v.home.name, "Tatvani");
});
test("validation: rejects unknown property, bad email/phone/dates/guests, missing consent", () => {
  const cases = [
    [{ propertyId: "mo-not-a-home" }, "propertyId"], [{ fullName: "" }, "fullName"], [{ email: "nope" }, "email"],
    [{ phone: "12" }, "phone"], [{ checkIn: "2026-02-30" }, "checkIn"], [{ checkIn: "2025-01-01" }, "checkIn"],
    [{ checkOut: "2027-02-10" }, "checkOut"], [{ adults: "0" }, "adults"], [{ children: "-1" }, "children"],
    [{ infants: "x" }, "infants"], [{ consent: false }, "consent"], [{ message: "x".repeat(3001) }, "message"],
  ];
  for (const [over, field] of cases) {
    const v = validateInquiry(goodBody(over), { now: NOW });
    assert.equal(v.ok, false, JSON.stringify(over)); assert.ok(v.errors[field], `${field} for ${JSON.stringify(over)}`);
  }
  assert.equal(parseDate("2028-02-29") != null, true);
  assert.equal(parseDate("2027-02-29"), null);
});
test("validation: client-sent name/country are ignored (server registry is the authority)", () => {
  const v = validateInquiry(goodBody({ propertyName: "Fake Palace", country: "Mars" }), { now: NOW });
  assert.equal(v.home.name, "Tatvani"); assert.equal(v.home.country, "Thailand");
});
test("spam: honeypot and too-fast submissions", () => {
  assert.equal(spamCheck({ website: "http://spam" }), "honeypot");
  assert.equal(spamCheck({ elapsedMs: 300 }), "too_fast");
  assert.equal(spamCheck({ elapsedMs: 5000 }), null);
});

/* ---------------- 6. Email ---------------- */
test("email: subject, escaping, plain-text fallback, not-confirmed wording", () => {
  const v = validateInquiry(goodBody({ fullName: "<script>x</script> Guest", message: "Hi & <b>bye</b>" }), { now: NOW });
  const e = renderEmail(v.home, v.inquiry, { inquiryId: "MOH-1", submittedAt: "2026-11-02T12:00:00Z" });
  assert.equal(e.subject, "New Exceptional Home Availability Request — Tatvani");
  assert.ok(!e.html.includes("<script>x</script>")); assert.ok(e.html.includes("&lt;script&gt;"));
  assert.ok(e.text.includes("Guest email: guest@example.com"));
  assert.ok(/Nothing has been booked or confirmed/.test(e.text));
});

/* ---------------- 7. Handler (mocked delivery) ---------------- */
test("handler: delivers to the webhook with Reply-To = guest, notify_to from env", async () => {
  _resetForTests(); const calls = [];
  const r = await handleInquiryRequest({ method: "POST", ip: "1.1.1.1", body: goodBody(), env: ENV, fetchImpl: okFetch(calls), now: NOW, log: quiet });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.message, SUCCESS_MESSAGE);
  assert.match(r.body.inquiryId, /^MOH-\d{8}-[A-Z0-9]{6}$/);
  assert.equal(calls.length, 1);
  const p = calls[0].body;
  assert.equal(p.notify_to, "test-inbox@example.test"); assert.equal(p.reply_to, "guest@example.com");
  assert.equal(p.subject, "New Exceptional Home Availability Request — Tatvani");
  assert.equal(p.total_guests, 7); assert.ok(p.email_html && p.email_text);
});
test("handler: default recipient is Reservations@WhataHotel.com", async () => {
  _resetForTests(); const calls = [];
  await handleInquiryRequest({ method: "POST", ip: "1.1.1.2", body: goodBody(), env: { GHL_INQUIRY_WEBHOOK_URL: ENV.GHL_INQUIRY_WEBHOOK_URL }, fetchImpl: okFetch(calls), now: NOW, log: quiet });
  assert.equal(calls[0].body.notify_to, DEFAULT_RECIPIENT); assert.equal(DEFAULT_RECIPIENT, "Reservations@WhataHotel.com");
});
test("handler: retries 5xx, then reports failure (no false success)", async () => {
  _resetForTests(); let n = 0;
  const flaky = async () => { n++; return n < 3 ? { ok: false, status: 502 } : { ok: true, status: 200 }; };
  const r1 = await handleInquiryRequest({ method: "POST", ip: "2.2.2.2", body: goodBody(), env: ENV, fetchImpl: flaky, now: NOW, log: quiet });
  assert.equal(r1.status, 200); assert.equal(n, 3);
  const down = async () => ({ ok: false, status: 500 });
  const r2 = await handleInquiryRequest({ method: "POST", ip: "2.2.2.3", body: goodBody(), env: ENV, fetchImpl: down, now: NOW, log: quiet });
  assert.equal(r2.status, 502); assert.equal(r2.body.ok, false);
  const thrower = async () => { throw new Error("boom"); };
  const r3 = await handleInquiryRequest({ method: "POST", ip: "2.2.2.4", body: goodBody(), env: ENV, fetchImpl: thrower, now: NOW, log: quiet });
  assert.equal(r3.status, 502);
});
test("handler: 4xx from webhook is not retried", async () => {
  _resetForTests(); let n = 0;
  const r = await handleInquiryRequest({ method: "POST", ip: "2.2.2.5", body: goodBody(), env: ENV, fetchImpl: async () => { n++; return { ok: false, status: 404 }; }, now: NOW, log: quiet });
  assert.equal(r.status, 502); assert.equal(n, 1);
});
test("handler: not configured → 503; log mode refused in production", async () => {
  _resetForTests();
  const r = await handleInquiryRequest({ method: "POST", ip: "3.3.3.3", body: goodBody(), env: {}, now: NOW, log: quiet });
  assert.equal(r.status, 503);
  const r2 = await handleInquiryRequest({ method: "POST", ip: "3.3.3.4", body: goodBody(), env: { INQUIRY_DELIVERY: "log", VERCEL_ENV: "production" }, now: NOW, log: quiet });
  assert.equal(r2.status, 503);
  const r3 = await handleInquiryRequest({ method: "POST", ip: "3.3.3.5", body: goodBody(), env: { INQUIRY_DELIVERY: "log" }, now: NOW, log: quiet });
  assert.equal(r3.status, 200); assert.equal(r3.body.delivery, "log");
});
test("handler: honeypot silently accepted but not delivered; too-fast rejected", async () => {
  _resetForTests(); const calls = [];
  const r = await handleInquiryRequest({ method: "POST", ip: "4.4.4.4", body: goodBody({ website: "spam.example" }), env: ENV, fetchImpl: okFetch(calls), now: NOW, log: quiet });
  assert.equal(r.status, 200); assert.equal(calls.length, 0);
  const r2 = await handleInquiryRequest({ method: "POST", ip: "4.4.4.5", body: goodBody({ elapsedMs: 200 }), env: ENV, fetchImpl: okFetch(calls), now: NOW, log: quiet });
  assert.equal(r2.status, 400); assert.equal(calls.length, 0);
});
test("handler: unknown property id → 422 and nothing sent", async () => {
  _resetForTests(); const calls = [];
  const r = await handleInquiryRequest({ method: "POST", ip: "5.5.5.5", body: goodBody({ propertyId: "mo-made-up" }), env: ENV, fetchImpl: okFetch(calls), now: NOW, log: quiet });
  assert.equal(r.status, 422); assert.ok(r.body.fields.propertyId); assert.equal(calls.length, 0);
});
test("handler: rate limit (5 per 10 minutes per IP)", async () => {
  _resetForTests(); const calls = [];
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await handleInquiryRequest({ method: "POST", ip: "6.6.6.6", body: goodBody(), env: ENV, fetchImpl: okFetch(calls), now: NOW + i, log: quiet })).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});
test("handler: duplicate submissionId (sequential and concurrent) sends once", async () => {
  _resetForTests(); const calls = [];
  let release; const gate = new Promise((r) => { release = r; });
  const slow = async (url, init) => { await gate; calls.push(JSON.parse(init.body)); return { ok: true, status: 200 }; };
  const body = goodBody({ submissionId: "same-1" });
  const a = handleInquiryRequest({ method: "POST", ip: "7.7.7.7", body, env: ENV, fetchImpl: slow, now: NOW, log: quiet });
  const b = handleInquiryRequest({ method: "POST", ip: "7.7.7.8", body, env: ENV, fetchImpl: slow, now: NOW, log: quiet });
  release();
  const [ra, rb] = await Promise.all([a, b]);
  const rc = await handleInquiryRequest({ method: "POST", ip: "7.7.7.9", body, env: ENV, fetchImpl: slow, now: NOW + 1000, log: quiet });
  assert.equal(calls.length, 1);
  assert.equal(ra.body.inquiryId, rb.body.inquiryId); assert.equal(rc.body.inquiryId, ra.body.inquiryId); assert.equal(rc.body.duplicate, true);
});
test("handler: CORS — allowed origin echoed, unknown origin refused, GET → 405", async () => {
  _resetForTests();
  const env = { ...ENV, ALLOWED_ORIGINS: "https://pro.whatahotel.com" };
  const pre = await handleInquiryRequest({ method: "OPTIONS", origin: "https://pro.whatahotel.com", env, log: quiet });
  assert.equal(pre.status, 204); assert.equal(pre.headers["Access-Control-Allow-Origin"], "https://pro.whatahotel.com");
  const bad = await handleInquiryRequest({ method: "POST", origin: "https://evil.example", ip: "8.8.8.8", body: goodBody(), env, fetchImpl: okFetch([]), now: NOW, log: quiet });
  assert.equal(bad.status, 403);
  const get = await handleInquiryRequest({ method: "GET", env, log: quiet });
  assert.equal(get.status, 405);
});
test("handler: logs contain no personal data", async () => {
  _resetForTests(); const lines = [];
  await handleInquiryRequest({ method: "POST", ip: "9.9.9.9", body: goodBody(), env: ENV, fetchImpl: okFetch([]), now: NOW, log: (s) => lines.push(s) });
  await handleInquiryRequest({ method: "POST", ip: "9.9.9.8", body: goodBody(), env: ENV, fetchImpl: async () => ({ ok: false, status: 500 }), now: NOW, log: (s) => lines.push(s) });
  const all = lines.join("\n");
  for (const pii of ["guest@example.com", "Test Guest", "555 0100", "Anniversary"]) assert.ok(!all.includes(pii), pii);
});
