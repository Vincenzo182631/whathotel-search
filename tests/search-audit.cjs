/*
 * search-audit.cjs — runs every property through the search bar's logic and
 * reports any that a visitor could not find.
 *
 * For each property it tries: the exact name; the name in lowercase without
 * accents/punctuation; "&" written as "and"; a one-letter typo; the name's
 * distinctive words; and its city, country and brand. Name-style queries must
 * put the property in the top 5 (what the suggestion list under the bar shows);
 * place and brand queries must include it somewhere in the results.
 *
 * Run: node tests/search-audit.cjs   (starts scripts/dev-server.mjs on PORT 8793)
 *      node tests/search-audit.cjs --url=https://pro.whatahotel.com/homes   (checks a live page)
 */
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const PORT = 8793;

function plain(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9&]+/g, " ").replace(/\s+/g, " ").trim(); }
const GENERIC = new Set("the a an of at and & by in resort resorts hotel hotels spa villas villa residences residence suites club private collection estate".split(" "));
function typo(name) {
  const words = plain(name).split(" ").filter((w) => w.length >= 6 && !/\d/.test(w));
  if (!words.length) return null;
  const w = words.sort((a, b) => b.length - a.length)[0];
  const t = w.slice(0, 3) + w.slice(4);           // drop the 4th letter
  return plain(name).replace(w, t);
}

(async () => {
  const urlArg = (process.argv.find((a) => a.startsWith("--url=")) || "").slice(6);
  const srv = urlArg ? null : spawn(process.execPath, [path.join(ROOT, "scripts/dev-server.mjs")], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  if (srv) await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/tavus|leadconnectorhq|wsrv\.nl|whatahotel\.com\/content|googleapis|unpkg|jsdelivr/, (r) => r.abort());
  await page.goto(urlArg || `http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.WAH_SEARCH);
  const props = await page.evaluate(() => (window.WAH_PROPERTIES || []).map((p) => ({ id: p.id, name: p.name, city: p.city, country: p.country, brand: p.brand }))
    .concat((window.WAH_MO_INDEX || []).map((h) => ({ id: h.id, name: h.name, city: (h.location || "").split(",")[0], country: h.country, brand: h.brand || "Mandarin Oriental" }))));

  const cases = [];
  for (const p of props) {
    const n = plain(p.name);
    cases.push({ p, kind: "exact name", q: p.name, top: 5 });
    if (n !== p.name.toLowerCase()) cases.push({ p, kind: "plain name", q: n, top: 5 });
    if (/&/.test(p.name)) cases.push({ p, kind: "& as and", q: p.name.replace(/&/g, "and"), top: 5 });
    const t = typo(p.name); if (t) cases.push({ p, kind: "typo", q: t, top: 5 });
    const dist = n.split(" ").filter((w) => !GENERIC.has(w) && !(p.brand && plain(p.brand).split(" ").includes(w)));
    // The name without brand/generic words ("Reethi Rah", "Costa Palmas"). One word is often a place
    // ("bali", "koh samui") that lists every property there, so it only has to be found. Villas named
    // after a place elsewhere ("Villa Tuscany" is in Spain) are covered by the full-name checks.
    if (dist.length && dist.join(" ") !== n && !/^villa /.test(n)) cases.push({ p, kind: "distinctive words", q: dist.join(" "), top: dist.length > 1 ? 5 : Infinity });
    if (p.city) cases.push({ p, kind: "city", q: p.city, top: Infinity });
    if (p.country) cases.push({ p, kind: "country", q: p.country, top: Infinity });
    if (p.brand) cases.push({ p, kind: "brand", q: p.brand, top: Infinity });
  }
  const results = await page.evaluate((cs) => cs.map((c) => { const ids = window.WAH_SEARCH(c.q); return { rank: ids.map(String).indexOf(String(c.id)), n: ids.length }; }), cases.map((c) => ({ q: c.q, id: c.p.id })));
  const fails = [];
  results.forEach((r, i) => { const c = cases[i]; if (r.rank === -1 || r.rank >= c.top) fails.push({ ...c, rank: r.rank, n: r.n }); });
  const byKind = {};
  cases.forEach((c) => { byKind[c.kind] = byKind[c.kind] || { total: 0, fail: 0 }; byKind[c.kind].total++; });
  fails.forEach((f) => byKind[f.kind].fail++);
  console.log(`Properties: ${props.length}   queries: ${cases.length}   problems: ${fails.length}`);
  for (const k in byKind) console.log(`  ${k.padEnd(18)} ${byKind[k].total - byKind[k].fail}/${byKind[k].total}`);
  if (process.argv.includes("--list")) fails.forEach((f) => console.log(`FAIL [${f.kind}] "${f.q}" → ${f.p.name} (${f.p.id}) ${f.rank === -1 ? "not found" : "rank " + (f.rank + 1)} of ${f.n}`));
  await browser.close(); if (srv) srv.kill();
  process.exitCode = fails.length ? 1 : 0;
})();
