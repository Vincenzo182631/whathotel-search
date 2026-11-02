/*
 * import-mo-homes.mjs — repeatable import of Mandarin Oriental Exceptional Homes.
 *
 * Reads the official collection page (https://www.mandarinoriental.com/en/
 * exceptional-homes) in a real browser, applies the selection rules in
 * scripts/mo-homes.config.json, then renders each selected home's page and
 * reads the data that page itself loads (spec line, description, photos,
 * currency) plus the publicly displayed "from" rate.
 *
 * Writes (all derived from one normalised dataset):
 *   data/mo-exceptional-homes.json   normalised dataset (source of truth)
 *   assets/js/mo-homes.js            browser bundle  → window.WAH_MO_HOMES
 *   server/mo-homes-registry.mjs     server-side ID registry for inquiry checks
 *   docs/mo-import-report.md         what was imported, excluded, changed, missing
 *   data/.mo-cache/<slug>.json       raw source snapshot (gitignored; may contain
 *                                    third-party personal data — never committed)
 *
 * Idempotent: homes are merged by stable id ("mo-<slug>"), so re-running never
 * duplicates. If a page fails this run, the last verified copy is kept and the
 * failure is reported. Requests are sequential-ish and paced (config.politeDelayMs);
 * nothing here bypasses logins, CAPTCHAs or rate limits. robots.txt allows
 * /en/exceptional-homes (checked 2026-11-02).
 *
 * Run (needs Playwright + Chromium):
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/import-mo-homes.mjs            # full import
 *   node scripts/import-mo-homes.mjs --dry-run  # listing + selection only, no writes
 * This is a maintainer tool: the website never contacts the source at runtime.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { selectHomes, parseHeadline, parseRate, htmlToBlocks, splitSections, reconcile, bedroomsBase, normalizeCount } from "./lib/mo-homes-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(join(root, "scripts", "mo-homes.config.json"), "utf8"));
const OUT = {
  data: join(root, "data", "mo-exceptional-homes.json"),
  bundle: join(root, "assets", "js", "mo-homes.js"),
  registry: join(root, "server", "mo-homes-registry.mjs"),
  report: join(root, "docs", "mo-import-report.md"),
  cache: join(root, "data", ".mo-cache"),
};
const DRY = process.argv.includes("--dry-run");
// --from-cache: rebuild every output from data/.mo-cache (no requests to the source
// except the listing page when _listing.json is missing). Useful after changing
// normalisation or selection code without re-scraping 40+ pages.
const FROM_CACHE = process.argv.includes("--from-cache");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 LorraineTravelHomesImporter/1.0 (+https://www.whatahotel.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = new Date().toISOString();

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  for (const id of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"]) {
    if (!id) continue;
    try { return req(id); } catch (e) { /* try next */ }
  }
  throw new Error("Playwright not found. Install it with:  npm i -D playwright && npx playwright install chromium  (or set PLAYWRIGHT_MODULE).");
}

/* ---------- 1. Listing: order, destination heading, card bedrooms ---------- */
async function readListing(ctx) {
  const page = await ctx.newPage();
  const res = await page.goto(CONFIG.source, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!res || res.status() >= 400) throw new Error(`Listing returned HTTP ${res && res.status()}`);
  await page.waitForSelector('a[href*="/en/exceptional-homes/"]', { timeout: 30000 });
  await sleep(1500);
  const raw = await page.evaluate(() => {
    const out = [], seen = new Set();
    let heading = null, n;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    const slugOf = (a) => ((a.getAttribute("href") || "").match(/\/en\/exceptional-homes\/([a-z0-9-]+)/) || [])[1];
    while ((n = walker.nextNode())) {
      if (n.tagName === "H2") { heading = (n.textContent || "").replace(/\s+/g, " ").trim(); continue; }
      if (n.tagName !== "A") continue;
      const slug = slugOf(n);
      if (!slug || slug === "interest-form" || seen.has(slug)) continue;
      let el = n, card = null;
      for (let i = 0; i < 9 && el.parentElement; i++) {
        el = el.parentElement;
        const slugs = new Set([...el.querySelectorAll('a[href*="/exceptional-homes/"]')].map(slugOf).filter(Boolean));
        if (slugs.size > 1) break;
        if (/bedroom/i.test(el.textContent || "")) card = el;
      }
      // Leaf-element text in document order: keeps the source's own casing
      // (innerText would apply CSS text-transform) and keeps each field separate.
      const lines = [];
      if (card) card.querySelectorAll("*").forEach((e) => {
        if (e.children.length) return;
        const t = (e.textContent || "").replace(/\s+/g, " ").trim();
        if (t && lines[lines.length - 1] !== t) lines.push(t);
      });
      seen.add(slug);
      out.push({ slug, destination: heading, lines });
    }
    return out;
  });
  await page.close();
  return raw.map((r, i) => {
    const bedLine = r.lines.find((l) => /bedroom/i.test(l)) || null;
    const rest = r.lines.filter((l) => l !== bedLine && !/^(see inside|see more|discover|view|explore)$/i.test(l));
    const location = rest.find((l) => /,/.test(l)) || null;
    const name = rest.filter((l) => l !== location).pop() || null;
    return {
      slug: r.slug, destination: r.destination, country: CONFIG.destinationToCountry[r.destination] || null,
      name, location, bedroomsDisplay: bedLine ? normalizeCount(bedLine.replace(/\s*bedrooms?\s*$/i, "")) : null,
      sourceOrder: i + 1,
    };
  });
}

/* ---------- 2. One home: the record the page loads + the displayed rate ---------- */
async function readHome(ctx, slug) {
  const page = await ctx.newPage();
  let record = null;
  page.on("response", async (r) => {
    if (record) return;
    if (/letsway\.com\/v1\/brands\/[^/]+\/experiences\/[^/?]+\?/.test(r.url())) {
      try { const j = await r.json(); record = j && (j.data || j); } catch (e) { /* ignore */ }
    }
  });
  const url = CONFIG.homeUrlBase + slug;
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!res || res.status() >= 400) { await page.close(); throw new Error(`HTTP ${res && res.status()}`); }
  for (let i = 0; i < 40 && !record; i++) await sleep(500);
  await page.waitForFunction(() => /from\s*\S{0,3}\s?[\d.,]+\s*\//i.test(document.body.innerText || ""), null, { timeout: 15000 }).catch(() => {});
  const shown = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    const m = txt.match(/from\s*[^\d\s]{0,3}\s?[\d.,]+\s*\/\s*[A-Za-z]+/i);
    const h1 = document.querySelector("h1");
    return { rateText: m ? m[0] : null, h1: h1 ? h1.textContent.trim() : null };
  });
  await page.close();
  return { url, record, shown };
}

/* ---------- 3. Normalise ---------- */
function regionOf(location, country) {
  if (!location) return null;
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] || null;
  const last = parts[parts.length - 1];
  return last.toLowerCase() === String(country).toLowerCase() ? parts[0] : last;
}
function factsOnly(blocks) { // fallback when content.mode = "facts": keep factual lists, drop source prose
  return blocks.filter((b) => b.type === "labelled" && /suitable|amenit|sleep|bed|bath/i.test(b.label));
}
function landmarks(items) {
  return items.map((t) => { const m = t.match(/^(.*?\(\s*\d[\d.,]*\s*(?:km|kms|mi|miles?|m|min|mins|minutes?)[^)]*\))/i); return m ? m[1].trim() : null; }).filter(Boolean);
}

function normaliseHome(listed, got, config) {
  const issues = [];
  const rec = got.record;
  if (!rec) issues.push("Source data record not loaded; spec line, description and photos unavailable — verify manually.");
  const head = parseHeadline(rec && rec.headline);
  if (!rec || !rec.headline) issues.push("Spec line (bedrooms | bathrooms | guests) not shown on source.");
  const bedroomsDisplay = head.bedroomsDisplay || listed.bedroomsDisplay;
  if (head.bedroomsDisplay && listed.bedroomsDisplay && head.bedroomsDisplay !== listed.bedroomsDisplay) issues.push(`Bedrooms differ between listing (${listed.bedroomsDisplay}) and home page (${head.bedroomsDisplay}); using the home page.`);
  if (!head.bathroomsDisplay) issues.push("Bathroom count not shown on source.");
  if (head.maxGuests == null) issues.push(head.maxGuestsDisplay ? `Guest capacity shown as "${head.maxGuestsDisplay}" (not a plain number).` : "Maximum guest count not shown on source.");

  let rate = null;
  if (rec && rec.hidePrice) issues.push("Source hides the price for this home (price on request).");
  else {
    rate = parseRate(got.shown.rateText, rec && rec.currency);
    if (!rate) issues.push("No public 'from' rate shown on source.");
    else if (rate.currencyIssue) issues.push(`Rate currency unverified: ${rate.currencyIssue}.`);
  }

  const blocks = htmlToBlocks(rec && rec.description);
  let { details, activitiesNearby } = splitSections(blocks);
  if (!details.length) issues.push("DETAILS content not found on source.");
  if (!activitiesNearby.length) issues.push("ACTIVITIES NEARBY section not found on source.");

  const medias = rec ? (rec.medias || []).filter((m) => m.type === "image") : [];
  medias.sort((a, b) => (a.kind === "cover" ? -1 : 0) - (b.kind === "cover" ? -1 : 0));
  const name = String((rec && rec.title) || listed.name || "").replace(/\s+/g, " ").trim();
  const location = head.location || listed.location;
  let imageAssets = medias.slice(0, config.maxImagesPerHome).map((m, i) => {
    const orig = (m.links || []).find((l) => l.resolution === "original") || (m.links || [])[0];
    return orig ? { url: orig.url, alt: (m.altText && m.altText.trim()) || `${name}${location ? `, ${location}` : ""} — photograph ${i + 1}`, credit: "© Mandarin Oriental Hotel Group", kind: m.kind || "gallery" } : null;
  }).filter(Boolean);
  if (!imageAssets.length) issues.push("No photographs available from source.");

  if (config.content.mode === "facts") {
    details = factsOnly(details);
    const lm = landmarks(activitiesNearby.flatMap((b) => b.items || []));
    activitiesNearby = lm.length ? [{ type: "list", items: lm }] : [];
    imageAssets = [];
  }

  return {
    id: `mo-${listed.slug}`,
    slug: listed.slug,
    name,
    country: listed.country,
    destination: listed.destination,
    region: regionOf(location, listed.country),
    location,
    bedroomsDisplay,
    bedroomsBase: bedroomsBase(bedroomsDisplay),
    bathroomsDisplay: head.bathroomsDisplay,
    maxGuests: head.maxGuests,
    maxGuestsDisplay: head.maxGuestsDisplay,
    startingRate: rate ? rate.startingRate : null,
    startingRateDisplay: rate ? rate.startingRateDisplay : null,
    currency: rate ? rate.currency : null,
    rateUnit: rate ? rate.rateUnit : null,
    details,
    activitiesNearby,
    imageAssets,
    imageCountOnSource: medias.length,
    sourceUrl: got.url,
    sourceOrder: listed.sourceOrder,
    lastVerified: got.fetchedAt || now,
    issues,
  };
}

/* ---------- 4. Outputs ---------- */
function stable(obj) { return JSON.stringify(obj, null, 2) + "\n"; }
function writeOutputs(dataset, report) {
  mkdirSync(dirname(OUT.data), { recursive: true });
  mkdirSync(dirname(OUT.registry), { recursive: true });
  mkdirSync(dirname(OUT.report), { recursive: true });
  writeFileSync(OUT.data, stable(dataset));
  writeFileSync(OUT.bundle, `/*\n * Mandarin Oriental Exceptional Homes — AUTO-GENERATED by scripts/import-mo-homes.mjs\n * from data/mo-exceptional-homes.json. Do not hand-edit; re-run the importer.\n * ${CONFIG.content.attribution}\n */\nwindow.WAH_MO_HOMES = ${JSON.stringify(dataset)};\n`);
  const reg = {};
  for (const h of dataset.homes) reg[h.id] = { name: h.name, country: h.country, location: h.location, sourceUrl: h.sourceUrl, maxGuests: h.maxGuests };
  writeFileSync(OUT.registry, `/*\n * AUTO-GENERATED by scripts/import-mo-homes.mjs — server-side registry of the\n * homes that may receive inquiries. The inquiry endpoint trusts ONLY this list\n * (never the name/country a browser sends).\n */\nexport const MO_DATASET_IMPORTED_AT = ${JSON.stringify(dataset.meta.importedAt)};\nexport const MO_HOMES_REGISTRY = ${JSON.stringify(reg, null, 2)};\n`);
  writeFileSync(OUT.report, report);
}

function buildReport(ds, ctx) {
  const L = [];
  const by = {}; ds.homes.forEach((h) => { (by[h.country] = by[h.country] || []).push(h); });
  L.push("# Mandarin Oriental Exceptional Homes — import report", "");
  L.push(`- **Run:** ${ds.meta.importedAt}`, `- **Source:** ${CONFIG.source}`, `- **Homes on source:** ${ctx.listing.length}`, `- **Homes imported:** ${ds.homes.length} (maximum ${CONFIG.selection.maxTotal})`, `- **Content mode:** \`${CONFIG.content.mode}\` — ${CONFIG.content.permission.note}`, "");
  L.push("## Selection rules", "", CONFIG.selection.notes, "");
  L.push("| Country | Rule applied | Imported |", "|---|---|---|");
  CONFIG.countries.forEach((c) => L.push(`| ${c} | ${ctx.rules[c] || "—"} | ${(by[c] || []).length} |`));
  L.push("", "## Imported homes (source order within each country)", "");
  L.push("| # | Home | Country | Location | Bedrooms | Bathrooms | Guests | From | Photos | Issues |", "|---|---|---|---|---|---|---|---|---|---|");
  ds.homes.forEach((h, i) => L.push(`| ${i + 1} | [${h.name}](${h.sourceUrl}) | ${h.country} | ${h.location || "—"} | ${h.bedroomsDisplay || "—"} | ${h.bathroomsDisplay || "—"} | ${h.maxGuestsDisplay || "—"} | ${h.startingRate != null ? `${h.startingRateDisplay} ${h.currency || "(currency unverified)"} / ${h.rateUnit || "?"}` : "—"} | ${h.imageAssets.length}/${h.imageCountOnSource} | ${h.issues.length ? h.issues.join("<br>") : "none"} |`));
  L.push("", "## On source but not imported", "");
  if (ctx.excluded.length) ctx.excluded.forEach((e) => L.push(`- **${e.name || e.slug}** (${e.country}) — ${e.reason}`));
  else L.push("- none");
  if (ctx.unmapped.length) { L.push("", "## Source destinations outside the 8 countries (ignored)", ""); ctx.unmapped.forEach((h) => L.push(`- ${h.name || h.slug} — heading "${h.destination}"`)); }
  L.push("", "## Changes vs. the planned selection", "");
  if (ctx.changes.length) ctx.changes.forEach((c) => L.push(`- ${c.country}: **${c.name}** — ${c.change}${c.why ? ` (${c.why})` : ""}`));
  else L.push("- none");
  if (ctx.failures.length) { L.push("", "## Pages that failed this run", ""); ctx.failures.forEach((f) => L.push(`- ${f.slug}: ${f.error}${f.kept ? " — previous verified copy kept" : " — NOT imported"}`)); }
  L.push("", "## Notes", "",
    "- Bedrooms are shown exactly as the source writes them (e.g. `8+1`). The 4–8 bedroom rule uses the base number (`5+1` → 5).",
    "- The starting rate is the public \"from … / Night\" figure displayed on each home's page on the run date. It can change with season and date, and it is not the widget's internal base tier. The currency code comes from the source record, and it is only accepted when it matches the displayed symbol.",
    "- Availability is never read from, or shown from, the source calendar.",
    `- ${CONFIG.content.attribution}`, "");
  return L.join("\n");
}

/* ---------- main ---------- */
async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US", viewport: { width: 1366, height: 900 } });
  try {
    const listingCache = join(OUT.cache, "_listing.json");
    let listing;
    if (FROM_CACHE && existsSync(listingCache)) { listing = JSON.parse(readFileSync(listingCache, "utf8")).listing; console.log("Listing from cache."); }
    else { console.log("Reading listing…"); listing = await readListing(ctx); }
    if (!DRY) { mkdirSync(OUT.cache, { recursive: true }); writeFileSync(listingCache, JSON.stringify({ fetchedAt: now, listing }, null, 1)); }
    const unmapped = listing.filter((h) => !h.country);
    console.log(`  ${listing.length} homes on source; ${unmapped.length} outside the configured destinations.`);
    const { selected, excluded, rulesByCountry } = selectHomes(listing.filter((h) => h.country), CONFIG);
    console.log(`  Selected ${selected.length}:`, CONFIG.countries.map((c) => `${c} ${selected.filter((h) => h.country === c).length}`).join(", "));
    if (DRY) { console.log(JSON.stringify({ rulesByCountry, excluded }, null, 2)); return; }

    const prev = existsSync(OUT.data) ? JSON.parse(readFileSync(OUT.data, "utf8")) : { homes: [] };
    const prevById = new Map((prev.homes || []).map((h) => [h.id, h]));
    mkdirSync(OUT.cache, { recursive: true });
    const homes = [], failures = [];
    let idx = 0;
    async function worker() {
      while (idx < selected.length) {
        const listed = selected[idx++];
        try {
          const cached = join(OUT.cache, `${listed.slug}.json`);
          let got;
          if (FROM_CACHE && existsSync(cached)) {
            const c = JSON.parse(readFileSync(cached, "utf8"));
            got = { url: CONFIG.homeUrlBase + listed.slug, record: c.record, shown: { rateText: c.rateText }, fetchedAt: c.fetchedAt };
          } else got = await readHome(ctx, listed.slug);
          if (got.record && !got.fetchedAt) writeFileSync(join(OUT.cache, `${listed.slug}.json`), JSON.stringify({ fetchedAt: now, rateText: got.shown.rateText, record: got.record }, null, 1));
          const home = normaliseHome(listed, got, CONFIG);
          homes.push(home);
          console.log(`  ✓ ${home.name} — ${home.bedroomsDisplay} bd / ${home.bathroomsDisplay} ba / ${home.maxGuestsDisplay} guests / ${home.startingRateDisplay || "no rate"}${home.issues.length ? `  [${home.issues.length} issue(s)]` : ""}`);
        } catch (e) {
          const old = prevById.get(`mo-${listed.slug}`);
          failures.push({ slug: listed.slug, error: e.message, kept: !!old });
          if (old) homes.push({ ...old, sourceOrder: listed.sourceOrder, issues: [...(old.issues || []).filter((x) => !/^Not re-verified/.test(x)), `Not re-verified on ${now.slice(0, 10)}: ${e.message}`] });
          console.log(`  ✗ ${listed.slug}: ${e.message}`);
        }
        if (!FROM_CACHE) await sleep(CONFIG.politeDelayMs);
      }
    }
    await Promise.all(Array.from({ length: CONFIG.concurrency }, worker));

    // Stable order: configured country order, then source order. No duplicates by construction (Map by id).
    const uniq = [...new Map(homes.map((h) => [h.id, h])).values()];
    uniq.sort((a, b) => CONFIG.countries.indexOf(a.country) - CONFIG.countries.indexOf(b.country) || a.sourceOrder - b.sourceOrder);
    const perCountryIdx = {};
    uniq.forEach((h, i) => { h.sortOrder = i + 1; perCountryIdx[h.country] = (perCountryIdx[h.country] || 0) + 1; h.countryOrder = perCountryIdx[h.country]; });

    const counts = {}; CONFIG.countries.forEach((c) => { counts[c] = uniq.filter((h) => h.country === c).length; });
    const dataset = {
      meta: {
        source: CONFIG.source, importedAt: now, contentMode: CONFIG.content.mode, attribution: CONFIG.content.attribution,
        permission: CONFIG.content.permission, selectionRules: CONFIG.selection.notes, countries: CONFIG.countries, counts, total: uniq.length,
        rateNote: "Indicative public 'from' rate shown on the source on the import date; subject to confirmation.",
      },
      homes: uniq,
    };
    const changes = reconcile(CONFIG.plannedSelection, uniq, listing);
    writeOutputs(dataset, buildReport(dataset, { listing, excluded, unmapped, rules: rulesByCountry, changes, failures }));
    console.log(`\nWrote ${uniq.length} homes → data/mo-exceptional-homes.json, assets/js/mo-homes.js, server/mo-homes-registry.mjs, docs/mo-import-report.md`);
    if (failures.length) { console.log(`${failures.length} page(s) failed — see report.`); process.exitCode = 2; }
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
