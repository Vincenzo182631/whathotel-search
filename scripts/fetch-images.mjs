/*
 * fetch-images.mjs — scrape each property's REAL WhataHotel hero image AND its
 * authoritative on-page description.
 *
 * Reads the property list from assets/js/data.js, fetches each property page and:
 *   • extracts its og:image (the curated hero, ignoring the WhataHotel logo) →
 *     assets/js/images.js:  window.WAH_IMAGES = { <id>: { hero: "<url>" } }
 *   • extracts the first substantive on-page description paragraph (skipping the
 *     booking/agency boilerplate) → assets/js/descriptions.js:
 *     window.WAH_DESC = { <id>: "<factual description from whatahotel.com>" }
 *
 * Descriptions are WhataHotel's own copy (factual, not invented). Coverage is
 * best-effort — where a page has no usable paragraph the property simply falls
 * back to its location line. Nothing here changes the property list.
 *
 * Run:  node scripts/fetch-images.mjs
 * (uses curl so it goes through the environment's HTTPS proxy)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const IMG_OUT = join(root, "assets", "js", "images.js");
const DESC_OUT = join(root, "assets", "js", "descriptions.js");

const dataSrc = readFileSync(join(root, "assets", "js", "data.js"), "utf8");
const pairs = [];
const re = /"id":\s*(\d+),\s*"url":\s*"([^"]+)"/g;
let m;
while ((m = re.exec(dataSrc)) !== null) pairs.push({ id: Number(m[1]), url: m[2] });
console.log("Properties to fetch:", pairs.length);

function curl(url) {
  return new Promise((resolve) => {
    execFile("curl", ["-sS", "-L", "--max-time", "45", url], { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? "" : stdout);
    });
  });
}

function heroFrom(html) {
  const metas = [...html.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi)].map((x) => x[1]);
  const hero = metas.find((u) => u && !/wah_logo|logo\.png|logo\.svg/i.test(u));
  return hero || null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&nbsp;/g, " ")
    .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&agrave;/g, "à")
    .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&hellip;/g, "…").replace(/&aacute;/g, "á")
    .replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&ccedil;/g, "ç").replace(/&#\d+;/g, "");
}

const BOILER = ["lorraine travel", "whatahotel", "preferred partner", "the perks", "founded in 1948",
  "best way to book", "virtuoso", "signature travel", "*the perks", "verified by", "book ",
  // booking / perk / policy paragraphs — not property descriptions
  "$", "credit", "deposit", "cancellation", "blackout", "excluding", "upgrade upon", "back-to-back",
  "one-time", "resort fee", "per night", "per stay", "valid for", "subject to availability", "early check"];

function descFrom(html) {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => x[1]);
  for (const raw of paras) {
    let t = decodeEntities(raw.replace(/<[^>]+>/g, " "));
    t = t.replace(/\s+/g, " ").trim();
    if (t.length < 90) continue;
    const low = t.toLowerCase();
    if (BOILER.some((b) => low.includes(b))) continue;
    // Reject masked/perk lines and non-prose (e.g. "***** OR *****"): must be
    // mostly letters, have enough alphabetic content, and read like a sentence.
    const alpha = (t.match(/[a-zA-Z]/g) || []).length;
    if (alpha < 60) continue;
    if (alpha / t.length < 0.65) continue;
    if ((t.match(/\*/g) || []).length > 1) continue;
    if (!/[a-z]{3}\s+[a-z]{3}/.test(low)) continue; // has real words
    // Trim to ~2 sentences / 320 chars for card + modal use.
    if (t.length > 340) {
      const cut = t.slice(0, 340);
      const lastDot = cut.lastIndexOf(". ");
      t = (lastDot > 140 ? cut.slice(0, lastDot + 1) : cut.trim() + "…");
    }
    return t;
  }
  return null;
}

async function run(items, worker, concurrency) {
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= items.length) return;
    await worker(items[idx], idx);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

const images = {};
const descs = {};
let okImg = 0, missImg = 0, okDesc = 0;
let done = 0;
await run(pairs, async (p) => {
  const html = await curl(p.url);
  if (html) {
    const hero = heroFrom(html);
    if (hero) { images[p.id] = { hero }; okImg++; } else missImg++;
    const d = descFrom(html);
    if (d) { descs[p.id] = d; okDesc++; }
  } else { missImg++; }
  if (++done % 25 === 0) console.log(`  ...${done}/${pairs.length}`);
}, 8);

console.log(`Heroes: ${okImg} ok, ${missImg} missing.  Descriptions: ${okDesc}/${pairs.length}.`);

// Manual hero overrides (curated by request) — applied last so they survive
// re-scrapes and take precedence over the auto-detected og:image.
const IMAGE_OVERRIDES = {
  3879: "https://assets.cdn.filesafe.space/fBHK0xDUEFQL6rOoyKnY/media/6a61a2a09e476cfa0bafda51.jpg", // The Ritz-Carlton Residences at Dorado Beach
};
for (const [id, hero] of Object.entries(IMAGE_OVERRIDES)) images[id] = { hero };

function emit(path, varName, obj, note) {
  const ordered = {};
  Object.keys(obj).map(Number).sort((a, b) => a - b).forEach((id) => { ordered[id] = obj[id]; });
  writeFileSync(path, `/*\n * ${note}\n * AUTO-GENERATED by scripts/fetch-images.mjs — re-run to refresh.\n */\n${varName} = ` + JSON.stringify(ordered, null, 2) + ";\n");
  console.log("Wrote", path);
}

emit(IMG_OUT, "window.WAH_IMAGES", images, "WhataHotel! — real property hero images (each property's og:image).");
emit(DESC_OUT, "window.WAH_DESC", descs, "WhataHotel! — authoritative on-page property descriptions (factual, from whatahotel.com).");
