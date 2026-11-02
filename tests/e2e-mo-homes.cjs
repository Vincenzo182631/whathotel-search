/*
 * End-to-end check of the Exceptional Homes section and the Request Availability
 * flow: browser → real /api handler (scripts/dev-server.mjs) → MOCK GoHighLevel
 * webhook on localhost. Nothing leaves the machine; no real inbox is contacted.
 *
 *   node tests/e2e-mo-homes.cjs        (needs Playwright + Chromium)
 * Screenshots → tests/screenshots/
 */
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
let pw; for (const id of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"]) { if (!id) continue; try { pw = require(id); break; } catch (e) {} }
if (!pw) { console.error("Playwright not found"); process.exit(1); }

const ROOT = path.join(__dirname, "..");
const SHOTS = path.join(__dirname, "screenshots"); fs.mkdirSync(SHOTS, { recursive: true });
const HOOK_PORT = 8799, PORT = 8788;
const received = []; let hookMode = "ok";
const results = []; const check = (name, cond, extra) => { results.push({ name, ok: !!cond }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

function startHook() {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
        if (hookMode === "fail") { rsp.writeHead(500).end("down"); return; }
        try { received.push(JSON.parse(b)); } catch (e) {}
        rsp.writeHead(200, { "Content-Type": "application/json" }).end('{"status":"Success: request sent to trigger execution server"}');
      });
    }).listen(HOOK_PORT, () => res(s));
  });
}
function startServer() {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [path.join(ROOT, "scripts/dev-server.mjs")], { env: { ...process.env, PORT: String(PORT), GHL_INQUIRY_WEBHOOK_URL: `http://127.0.0.1:${HOOK_PORT}/hook`, INQUIRY_TO: "test-inbox@example.test", INQUIRY_DELIVERY: "ghl" }, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (d) => { if (/Preview:/.test(String(d))) res(p); });
    p.stderr.on("data", (d) => process.stderr.write(d));
    setTimeout(() => rej(new Error("server did not start")), 8000);
  });
}
function isoIn(days) { const d = new Date(Date.now() + days * 86400000); return d.toISOString().slice(0, 10); }

async function run(browser, label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const dl = []; await page.exposeFunction("__dl", (e) => dl.push(e));
  await page.addInitScript(() => { window.dataLayer = []; const push = window.dataLayer.push.bind(window.dataLayer); window.dataLayer.push = (e) => { try { window.__dl(JSON.parse(JSON.stringify(e))); } catch (x) {} return push(e); }; });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  // Regression: existing page still renders.
  await page.waitForFunction(() => document.querySelectorAll("#directory a, #directory article, #directory .card").length > 0, null, { timeout: 20000 }).catch(() => {});
  check(`${label}: existing directory still renders`, await page.locator("#directory").count() === 1);
  const dataBefore = await page.evaluate(() => !!window.WAH_MO_HOMES);
  check(`${label}: MO data not loaded before the section is near`, !dataBefore);

  await page.locator("#exceptional-homes").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll(".mo-card").length > 0, null, { timeout: 20000 });
  const chips = await page.locator(".mo-chip").evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  check(`${label}: filter counts`, chips.join("|") === "All Homes 42|Indonesia 1|Thailand 2|United Kingdom 3|Italy 10|France 5|Spain 13|Greece 7|Croatia 1", chips.join(" | "));
  check(`${label}: 42 cards under All Homes`, (await page.locator(".mo-card").count()) === 42);
  await page.locator('.mo-chip[data-country="Greece"]').click();
  check(`${label}: Greece filter → 7 cards, aria-pressed`, (await page.locator(".mo-card").count()) === 7 && (await page.locator('.mo-chip[data-country="Greece"]').getAttribute("aria-pressed")) === "true");
  await page.locator('.mo-chip[data-country="all"]').click();
  // Missing rate renders as "on request", never $0.
  const casanova = page.locator('.mo-card[data-id="mo-villa-casanova"] .mo-rate');
  check(`${label}: missing rate → "on request"`, /on request/i.test(await casanova.textContent()) && !/\$0/.test(await casanova.textContent()));
  await page.locator(".mo-grid").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, `${label}-1-collection.png`) });

  // Detail dialog + More Info.
  await page.locator('.mo-card[data-id="mo-tatvani"] .mo-btn[data-mo-detail]').click();
  await page.waitForSelector("#mo-detail[open]");
  const more = page.locator('#mo-detail .mo-more:not([hidden])').first();
  check(`${label}: detail shows DETAILS + ACTIVITIES NEARBY`, (await page.locator("#mo-detail .mo-sec__title").allTextContents()).join("|") === "Details|Activities Nearby");
  check(`${label}: More Info appears only when needed (aria-expanded=false)`, (await more.count()) === 1 && (await more.getAttribute("aria-expanded")) === "false");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, `${label}-2-detail.png`) });
  await more.click();
  check(`${label}: More Info expands → Show Less`, (await more.getAttribute("aria-expanded")) === "true" && (await more.textContent()) === "Show Less");
  await more.click();
  check(`${label}: Show Less collapses`, (await more.getAttribute("aria-expanded")) === "false");
  await page.keyboard.press("Escape");
  check(`${label}: Escape closes detail`, (await page.locator("#mo-detail[open]").count()) === 0);

  // Request form: preselection + validation.
  await page.locator('.mo-card[data-id="mo-tatvani"] .mo-btn[data-mo-request]').click();
  await page.waitForSelector("#mo-request[open]");
  check(`${label}: home preselected (name, hidden id)`, (await page.locator("#mo-req-home").textContent()) === "Tatvani" && (await page.locator("#mo-f-property-id").inputValue()) === "mo-tatvani");
  check(`${label}: focus moves into the form`, await page.evaluate(() => document.activeElement && document.activeElement.id === "mo-f-name"));
  const base = received.length;
  await page.locator("#mo-f-submit").click();
  await page.waitForTimeout(300);
  const errs = await page.locator(".mo-field__err").evaluateAll((els) => els.filter((e) => e.textContent).length);
  check(`${label}: empty submit shows field errors, nothing sent`, errs >= 4 && received.length === base, `${errs} errors`);
  check(`${label}: invalid fields flagged with aria-invalid`, (await page.locator('#mo-f-name[aria-invalid="true"]').count()) === 1);
  await page.fill("#mo-f-name", "E2E Test Guest");
  await page.fill("#mo-f-email", "e2e-guest@example.test");
  await page.fill("#mo-f-phone", "+44 20 7946 0000");
  await page.fill("#mo-f-checkin", isoIn(60));
  await page.fill("#mo-f-checkout", isoIn(55));
  await page.fill("#mo-f-adults", "16"); await page.fill("#mo-f-children", "3"); await page.fill("#mo-f-infants", "1");
  check(`${label}: total guests calculated`, (await page.locator("#mo-f-total").textContent()) === "20");
  check(`${label}: soft capacity note when above published capacity`, await page.locator("#mo-cap-note").isVisible());
  await page.fill("#mo-f-message", "E2E test — please ignore.");
  await page.locator("#mo-f-consent").check();
  await page.locator("#mo-f-submit").click();
  check(`${label}: check-out before check-in rejected`, /after check-in/.test(await page.locator("#mo-f-checkout-err").textContent()));
  await page.fill("#mo-f-checkout", isoIn(67));
  await page.screenshot({ path: path.join(SHOTS, `${label}-3-request-form.png`), fullPage: false });

  // Delivery failure → error state, no success message.
  hookMode = "fail"; const before = received.length;
  await page.waitForTimeout(1600);
  await page.locator("#mo-f-submit").click();
  await page.waitForSelector("#mo-form-error:not([hidden])", { timeout: 15000 });
  check(`${label}: webhook failure → error state, success hidden`, await page.locator("#mo-req-success").isHidden() && received.length === before);
  check(`${label}: submit re-enabled after failure`, await page.locator("#mo-f-submit").isEnabled());

  // Delivery success (double click must send once).
  hookMode = "ok";
  await page.locator("#mo-f-submit").dblclick();
  await page.waitForSelector("#mo-req-success:not([hidden])", { timeout: 15000 });
  const ok = (await page.locator(".mo-req__ok").textContent()).trim();
  check(`${label}: exact success message after delivery`, ok === "Thank you for your inquiry. Our travel advisors will review your preferred dates and contact you regarding availability and rates. Your reservation is not confirmed.");
  check(`${label}: exactly one webhook delivery`, received.length === before + 1, `${received.length - before} received`);
  const p = received[received.length - 1] || {};
  check(`${label}: payload subject/notify_to/reply_to/property`, p.subject === "New Exceptional Home Availability Request — Tatvani" && p.notify_to === "test-inbox@example.test" && p.reply_to === "e2e-guest@example.test" && p.property_id === "mo-tatvani" && p.total_guests === 20 && p.over_published_capacity === true);
  check(`${label}: email HTML + text present`, /<html/.test(p.email_html || "") && /Guest email: e2e-guest@example.test/.test(p.email_text || ""));
  await page.screenshot({ path: path.join(SHOTS, `${label}-4-success.png`) });
  check(`${label}: no personal data in URL`, !/e2e-guest|E2E/.test(page.url()));
  const dlStr = JSON.stringify(dl);
  check(`${label}: analytics events carry no personal data`, dl.length > 0 && !/e2e-guest|E2E Test|7946/.test(dlStr), dl.map((e) => e.event).join(","));
  await page.keyboard.press("Escape");
  check(`${label}: no page errors`, errors.length === 0, errors.join("; "));
  await ctx.close();
}

(async () => {
  const hook = await startHook(); const srv = await startServer();
  const browser = await pw.chromium.launch();
  try {
    await run(browser, "desktop", { viewport: { width: 1366, height: 900 } });
    await run(browser, "mobile", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  } catch (e) { console.error(e); results.push({ name: "crash", ok: false }); }
  finally { await browser.close(); srv.kill(); hook.close(); }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
