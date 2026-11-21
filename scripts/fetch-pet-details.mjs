/*
 * fetch-pet-details.mjs — the specific pet policy of every hotel in WhataHotel's
 * Pet-Friendly collection (fee, deposit, weight limit, number of pets, species, room and
 * area rules, amenities), sourced from the web, preferring the hotel's own or its brand's
 * official site.
 *
 * Per hotel:
 *   1. Firecrawl search "<hotel> <city> pet policy" (top results, scraped to markdown).
 *   2. Keep only the pet-related passages of each page; label each source official
 *      (hotel/brand domain) or third-party.
 *   3. The best one or two pages (official first) are scraped again with Firecrawl's JSON
 *      extraction into a fixed schema. Every fact must come with a verbatim quote; the script
 *      keeps a fact only if its quote is really on that page AND supports it (the numbers
 *      match, the key words appear). Nothing is inferred or invented.
 *      (With --claude and a funded WH_ANTHROPIC_API_KEY, Claude reads the excerpts instead.)
 *
 * Output: scripts/pet-details.json  { "<hotel id>": { status, fee, deposit, weight, ... ,
 *         sources: [{url, official}], evidence: [...], checked } }
 * Raw search results are cached in scripts/.cache/pet-search/ (not committed).
 *
 * Keys (never printed): FIRECRAWL_API_KEY; WH_ANTHROPIC_API_KEY only with --claude.
 * Run:   node scripts/fetch-pet-details.mjs --only=3402,1197     (specific hotels)
 *        node scripts/fetch-pet-details.mjs --limit=12           (first N not yet done)
 *        node scripts/fetch-pet-details.mjs                      (all hotels not yet done)
 *        add --refresh to redo hotels already in pet-details.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(dir, "pet-details.json");
const CACHE = join(dir, ".cache", "pet-search");
mkdirSync(CACHE, { recursive: true });

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : null; };
const ONLY = arg("only") ? new Set(arg("only").split(",").map(Number)) : null;
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const REFRESH = process.argv.includes("--refresh");
const REDO = REFRESH || process.argv.includes("--redo");   // --redo: re-read cached pages, no new searches
const CONCURRENCY = Number(arg("concurrency") || 4);

const USE_CLAUDE = process.argv.includes("--claude");
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const ANTHROPIC_KEY = process.env.WH_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!FIRECRAWL_KEY) throw new Error("Set FIRECRAWL_API_KEY.");
if (USE_CLAUDE && !ANTHROPIC_KEY) throw new Error("--claude needs WH_ANTHROPIC_API_KEY.");
const client = USE_CLAUDE ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
const MODEL = "claude-opus-5-5";

const COLL = JSON.parse(readFileSync(join(dir, "pet-collection.json"), "utf8"));
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

/* ---------- sources ---------- */
// Official brand domains (the hotel's own domain is also recognised from its name).
const BRAND_DOMAINS = ["hyatt.com", "marriott.com", "ritzcarlton.com", "fourseasons.com", "ihg.com", "kimptonhotels.com", "hilton.com", "waldorfastoria.com",
  "conradhotels.com", "rosewoodhotels.com", "aman.com", "belmond.com", "sixsenses.com", "peninsula.com", "mandarinoriental.com", "langhamhotels.com",
  "kempinski.com", "aubergeresorts.com", "loewshotels.com", "jumeirah.com", "sbe.com", "slshotels.com", "all.accor.com", "accor.com", "fairmont.com",
  "sofitel.com", "raffles.com", "editionhotels.com", "thompsonhotels.com", "andaz.com", "parkhyatt.com", "whotels.com", "stregis.com",
  "theluxurycollection.com", "jwmarriott.com", "lemeridien.com", "westin.com", "sheratonhotels.com", "autographcollection.com", "tributeportfolio.com",
  "regenthotels.com", "vignettecollection.com", "hotelindigo.com", "intercontinental.com", "bulgarihotels.com", "lxrhotels.com", "alilahotels.com",
  "slh.com", "lhw.com", "relaischateaux.com", "preferredhotels.com", "oetkercollection.com", "dorchestercollection.com", "roccofortehotels.com",
  "omnihotels.com", "pendry.com", "montage.com", "viceroyhotelsandresorts.com", "1hotels.com", "nobuhotels.com", "destinationhotels.com", "curiocollection.com",
  "fairmont.com", "swissotel.com", "mgallery.com", "proper.com", "thehoxton.com", "grandbohemianhotels.com",
  "kesslercollection.com", "noblehousehotels.com", "salamanderhotels.com", "acehotel.com", "graduatehotels.com", "virginhotels.com", "thecapitalhotel.com",
  "fairmontsanfrancisco.com", "omnihotels.com", "lottehotel.com", "shangri-la.com", "rosewood.com", "capellahotels.com", "anantara.com", "oberoihotels.com", "tajhotels.com",
  "melia.com", "barcelo.com", "iberostar.com", "hyattinclusivecollection.com", "nh-hotels.com", "nh-collection.com", "radissonhotels.com", "steigenberger.com",
  "lindner.de", "falkensteiner.com", "lafayette-hotels.com", "gleneagles.com"];
const THIRD_PARTY_LOW = /(^|\.)(tripadvisor\.|booking\.com|expedia\.|hotels\.com|kayak\.|trivago\.|agoda\.|priceline\.|yelp\.|reddit\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|h-rez\.com)/i;
const GENERIC = new Set("hotel hotels resort resorts spa the and collection autograph luxury residence residences suites club golf beach house inn lodge palace grand park city".split(" "));
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }
function isOfficial(url, h) {
  const host = hostOf(url);
  if (!host || THIRD_PARTY_LOW.test(host)) return false;
  if (BRAND_DOMAINS.some((d) => host === d || host.endsWith("." + d))) return true;
  const words = h.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !GENERIC.has(w));
  const bare = host.replace(/[^a-z0-9]/g, "");
  return words.some((w) => bare.includes(w));
}

/* ---------- Firecrawl ---------- */
async function firecrawlSearch(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST", headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
    }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); return { results: (j.data && (j.data.web || j.data)) || [], credits: j.creditsUsed || 0 }; }
    if (r && r.status < 500 && r.status !== 429) throw new Error(`Firecrawl ${r.status}: ${(await r.text()).slice(0, 200)}`);
    await new Promise((s) => setTimeout(s, 2000 * (attempt + 1)));
  }
  throw new Error("Firecrawl search failed after retries");
}

/* ---------- pet passages ---------- */
const PET = /\b(pets?|pet-friendly|dogs?|cats?|canine|puppy|puppies|four-legged|furry|animals?)\b/i;
const DETAIL = /\b(fee|fees|charge|charged|deposit|weigh|weight|lbs?|pounds?|kg|kilos?|per (night|stay|day)|non-?refundable|leash|unattended|vaccin|carrier|crate|bed|bowls?|treats?|walk|room types?|floors?|maximum|max\.?|up to|limit)\b|[$€£]\s?\d|\d+\s?(€|eur|usd|gbp|chf|aed)/i;
function clean(md) {
  return String(md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")            // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")          // links -> text
    .replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
}
function petPassages(md, cap = 3500) {
  const lines = clean(md).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const keep = new Set();
  lines.forEach((l, i) => { if (PET.test(l)) { for (let k = i - 1; k <= i + 3; k++) if (k >= 0 && k < lines.length && (k === i || DETAIL.test(lines[k]) || PET.test(lines[k]) || k === i + 1)) keep.add(k); } });
  let text = [...keep].sort((a, b) => a - b).map((i) => lines[i]).join("\n");
  return text.length > cap ? text.slice(0, cap) : text;
}

/* ---------- Claude extraction ---------- */
const FIELDS = ["status", "species", "max_pets", "weight_limit", "fee", "deposit", "rooms", "areas", "amenities", "rules", "service_animals"];
const Policy = z.object({
  about_this_hotel: z.boolean().describe("true only if the excerpts describe this exact hotel (not a sister property or the brand in general)"),
  status: z.enum(["welcome", "restricted", "not_allowed", "unclear"]).describe("welcome = pets allowed; restricted = allowed with notable limits (e.g. small dogs only, certain rooms only); not_allowed = only service animals; unclear = sources do not say"),
  species: z.string().nullable().describe("Which animals, as stated (e.g. 'Dogs and cats', 'Dogs only')"),
  max_pets: z.string().nullable().describe("Maximum number of pets per room, as stated"),
  weight_limit: z.string().nullable().describe("Weight or size limit, as stated with units"),
  fee: z.string().nullable().describe("Pet fee exactly as stated, with currency, amount and basis (per night / per stay / per pet)"),
  deposit: z.string().nullable().describe("Refundable or damage deposit, as stated"),
  rooms: z.string().nullable().describe("Room types or floors where pets may or may not stay"),
  areas: z.string().nullable().describe("Public areas, restaurants, pool or beach where pets are or are not allowed"),
  amenities: z.string().nullable().describe("Pet amenities provided (bed, bowls, treats, walking, menu)"),
  rules: z.string().nullable().describe("Other rules: leash, not left unattended, vaccination records, advance notice, cleaning"),
  service_animals: z.string().nullable().describe("What the sources say about service or assistance animals"),
  evidence: z.array(z.object({
    field: z.enum(FIELDS),
    source: z.number().int().describe("Source number, e.g. 1 for [S1]"),
    quote: z.string().describe("Exact words copied from that source's excerpt that support the field (5-40 words, no paraphrase)"),
  })).describe("At least one verbatim quote for every non-null field and for status"),
  conflicts: z.string().nullable().describe("If sources disagree, say how (prefer the official source)"),
});
const SYSTEM = `You extract hotel pet policies for WhataHotel!, a luxury travel agency, so advisors don't have to research them.
Use ONLY the source excerpts given. Never use outside knowledge, never guess, never generalise from the brand.
- Prefer official sources ([official]) over third-party ones; note disagreements in "conflicts".
- If the excerpts are about a different property or are too vague, set the field to null.
- Copy fees, weights and numbers exactly as written (keep currency and basis).
- For every non-null field, add an evidence item whose quote is copied word for word from that source's excerpt.`;

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‘’“”"'`*_#>|]/g, "").replace(/\s+/g, " ").trim();

async function extract(h, sources) {
  const block = sources.map((s, i) => `[S${i + 1}] ${s.official ? "[official]" : "[third-party]"} ${s.url}\n${s.text}`).join("\n\n---\n\n");
  const res = await client.beta.messages.parse({
    model: MODEL, max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Policy) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Hotel: ${h.name}\nLocation: ${[h.city, h.region, h.country].filter(Boolean).join(", ")}\n\nSource excerpts:\n\n${block}` }],
  });
  if (res.stop_reason === "refusal") return { refused: true, usage: res.usage };
  return { policy: res.parsed_output, usage: res.usage, model: res.model };
}

/* ---------- rule-based reading of policy sentences (exact, repeatable) ---------- */
const CUR = String.raw`(?:[$€£]|USD|US\$|EUR|GBP|CHF|AED|CAD|AUD|MXN|SGD|JPY|THB)`;
const AMOUNT = new RegExp(String.raw`(${CUR}\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?${CUR})`, "i");
const BASIS = /\b(per (?:pet,? )?(?:per )?(?:night|day|stay|visit|pet)|each night|a night|nightly|one[- ]time|for stays? of (?:up to )?[\w-]+(?: (?:to|through) [\w-]+)? nights?)\b/gi;
function sentencesOf(md) {
  return clean(md).split(/\n+/).flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z0-9$€£])/)).map((x) => x.replace(/^[-*•\s]+/, "").trim()).filter((x) => x.length > 6 && x.length < 400);
}
const nameTokens = (h) => h.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERIC.has(w));
const OTHER_PROPERTY = /\b(Hotel|Resort|Inn|Lodge|Suites|Collection|Palace)\b/;
function aboutThisHotel(sentence, h, official) {
  if (official) return true;
  const low = sentence.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (nameTokens(h).some((t) => low.includes(t))) return true;
  return !OTHER_PROPERTY.test(sentence);      // third-party sentence naming some other property: skip
}
function ruleFields(md, h, official) {
  const f = {};
  const put = (k, value, quote) => { if (!f[k]) f[k] = { value, quotes: [quote] }; };
  for (const s0 of sentencesOf(md)) {
    if (!/\b(pets?|dogs?|cats?|animals?|canine)\b/i.test(s0) && !/\b(pet fee|per pet)\b/i.test(s0)) continue;
    if (!aboutThisHotel(s0, h, official)) continue;
    if (/\bservice animals?\b/i.test(s0) && !/\bpets?\b/i.test(s0)) continue;
    let m;
    if ((m = s0.match(/\bup to (\d+|one|two|three|four) (?:pets?|dogs?|cats?|animals?)\b/i)) || (m = s0.match(/maximum (?:number of )?pets?(?: in (?:the )?room| per room)?\s*[:\-]?\s*(\d+)/i)) ||
        (m = s0.match(/\b(\d+|one|two|three) (?:pets?|dogs?) (?:per room|maximum|max\.?)\b/i)) || (m = s0.match(/\b(?:welcomes?|accepts?|allows?)\s+(\d+|one|two|three|four)\s+(?:pets?|dogs?)\b/i)))
      put("max_pets", m[1], s0);
    if ((m = s0.match(/\b(\d+(?:[.,]\d+)?)\s?(lbs?|pounds|kg|kgs|kilograms?|kilos)\b/i)) && /\b(weigh|weight|up to|under|maximum|max|limit|less than|not exceed)\b/i.test(s0))
      put("weight_limit", `up to ${m[1]} ${m[2].toLowerCase()}`, s0);
    else if (/\bno (?:pet )?(?:weight|size) (?:limit|restriction)s?\b|\bany size\b|\ball sizes\b/i.test(s0)) put("weight_limit", "No weight limit", s0);
    const amt = s0.match(AMOUNT);
    const nAmt = (s0.match(new RegExp(AMOUNT.source, "gi")) || []).length;
    if (/\bno (?:[a-z-]+ )?deposit\b|\bdeposit (?:is )?not required\b|\bwithout (?:a )?deposit\b/i.test(s0)) put("deposit", "No deposit", s0);
    else if (/\b(deposit|pre-?authori[sz]ation|hold)\b/i.test(s0) && amt) put("deposit", (s0.match(/\b(non-?)?refundable\b/i) ? s0.match(/\b(non-?)?refundable\b/i)[0].toLowerCase() + " " : "") + amt[1], s0);
    else if (/\b(fee|charge|surcharge|supplement|cost|rate)\b/i.test(s0) && amt) {
      const basis = [...new Set((s0.match(BASIS) || []).map((x) => x.toLowerCase()))].slice(0, 2).join(", ");
      if (nAmt > 1) put("fee", s0.replace(/^(?:pet )?fees?:\s*/i, "").replace(/\s+/g, " ").slice(0, 140), s0);
      else put("fee", amt[1].replace(/\s+/g, " ") + (basis ? " " + basis.toLowerCase() : ""), s0);
    } else if (/\b(no (?:additional |extra )?(?:pet )?(?:fee|charge)|free of charge|complimentary for pets|at no (?:extra |additional )?(?:cost|charge))\b/i.test(s0)) put("fee", "No pet fee", s0);
    if (/\b(dogs and cats|cats and dogs)\b/i.test(s0)) put("species", "Dogs and cats", s0);
    else if (/\b(dogs only|only dogs|cats are not (?:permitted|allowed)|no cats)\b/i.test(s0)) put("species", "Dogs only", s0);
  }
  return f;
}

/* ---------- Firecrawl JSON extraction (default) ---------- */
const NULLISH = (v) => v == null || /^\s*(null|none|n\/a|not (stated|specified|mentioned)|unknown|-)?\s*$/i.test(String(v));
const JSON_SCHEMA = (() => { const js = z.toJSONSchema(Policy.omit({ about_this_hotel: true, conflicts: true })); delete js.$schema; return js; })();
const FC_PROMPT = `Extract this hotel's PET policy exactly as the page states it, for the hotel named in the page. Use null when the page does not say (never the word "null" in a string, never a guess).
Copy fees, weights and numbers exactly with currency and basis. For EVERY non-null field add evidence items whose quote is copied word for word from the page and actually states that fact. status: welcome / restricted / not_allowed / unclear.`;
async function firecrawlExtract(url) {
  const cf = join(CACHE, "x-" + createHash("sha1").update(url).digest("hex").slice(0, 16) + ".json");
  if (existsSync(cf) && !REFRESH) return JSON.parse(readFileSync(cf, "utf8"));
  const r0 = await firecrawlExtractLive(url);
  if (r0.json) writeFileSync(cf, JSON.stringify(r0));
  return r0;
}
async function firecrawlExtractLive(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST", headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, onlyMainContent: false, formats: ["markdown", { type: "json", prompt: FC_PROMPT, schema: JSON_SCHEMA }] }),
    }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); const d = j.data || {}; credits += (d.metadata && d.metadata.creditsUsed) || 5; return { json: d.json || null, markdown: d.markdown || "" }; }
    if (r && r.status < 500 && r.status !== 429) return { json: null, markdown: "", error: r.status };
    await new Promise((s2) => setTimeout(s2, 2000 * (attempt + 1)));
  }
  return { json: null, markdown: "", error: "retries" };
}

// A quote supports a value when the value's numbers are all in the quote and at least
// half of its meaningful words (4+ letters) appear there too.
const STOP = new Set("with that this from they your their there have will must only also each other than into upon when where which while about after before".split(" "));
function supports(value, quotes) {
  const v = norm(value), q = norm(quotes.join(" "));
  const nums = v.match(/\d+(?:[.,]\d+)?/g) || [];
  if (nums.length && !nums.every((n) => q.includes(n))) return false;
  const words = v.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  if (!words.length) return nums.length > 0;
  const hit = words.filter((w) => q.includes(w.slice(0, Math.max(4, w.length - 2)))).length;
  return hit / words.length >= 0.5;
}
// What each field must look like (a quote can be on the page and still be filed under the wrong field).
const NUMWORD = /\b(\d+|one|two|three|four|five|single|no (limit|maximum|restriction)s?|any number|unlimited)\b/i;
const SHAPE = {
  species: (v) => /\b(dogs?|cats?|pets?|animals?|canine|feline|birds?)\b/i.test(v),
  max_pets: (v) => NUMWORD.test(v) && !/\b(fee|charge|cost|price|eur|usd|\$|€|£)\b/i.test(v),
  weight_limit: (v) => (/\d/.test(v) && /\b(kg|kgs|kilo|kilos|kilograms?|lb|lbs|pounds?)\b/i.test(v)) || /\b(no weight|any size|all sizes|no size)\b/i.test(v),
  fee: (v) => /\d|[$€£]|\b(free|no (additional |extra |pet )?(fee|charge)|complimentary|without charge|at no (extra |additional )?(cost|charge))\b/i.test(v),
  deposit: (v) => /\d|[$€£]|\bno deposit\b/i.test(v),
};
const onPage = (quote, pageNorm) => { const parts = norm(quote).split(/\s*(?:\.\.\.|…)\s*/).filter((x) => x.length >= 8); return parts.length > 0 && parts.every((x) => pageNorm.includes(x)); };

// Firecrawl JSON from one page -> verified fields {field: {value, quotes}}
function verifyPage(json, markdown) {
  const page = norm(clean(markdown));
  const byField = {};
  for (const e of (json && json.evidence) || []) {
    if (!e || NULLISH(e.quote) || !FIELDS.includes(e.field)) continue;
    if (onPage(e.quote, page)) (byField[e.field] = byField[e.field] || []).push(e.quote);
  }
  const fields = {};
  for (const f of FIELDS) {
    if (f === "status") continue;
    const val = json && json[f];
    if (NULLISH(val) || !byField[f]) continue;
    const sv = String(val).trim();
    if (SHAPE[f] && !SHAPE[f](sv)) continue;
    if (supports(sv, byField[f])) fields[f] = { value: sv, quotes: byField[f] };
  }
  // A one-time cleaning or pet fee reported as a "deposit" is a fee.
  if (fields.deposit && !/\bdeposit\b/i.test(fields.deposit.value + " " + fields.deposit.quotes.join(" ")) && /\bfee\b/i.test(fields.deposit.value)) {
    if (!fields.fee) fields.fee = fields.deposit;
    delete fields.deposit;
  }
  const st = json && json.status;
  const statusOk = st && st !== "unclear" && (byField.status || []).some((q) => PET.test(q));
  return { fields, status: statusOk ? st : null };
}

// Keep a field only if one of its quotes really appears in the cited source.
function verify(policy, sources) {
  const texts = sources.map((s) => norm(s.text));
  const ok = {}, kept = [], dropped = [];
  for (const e of policy.evidence || []) {
    const src = texts[e.source - 1];
    const q = norm(e.quote);
    const hit = src && q.length >= 8 && src.includes(q);
    (hit ? kept : dropped).push(e);
    if (hit) ok[e.field] = true;
  }
  const result = {};
  for (const f of FIELDS) {
    if (f === "status") continue;
    result[f] = policy[f] && ok[f] ? policy[f] : null;
  }
  result.status = policy.status !== "unclear" && ok.status ? policy.status
    : (policy.status !== "unclear" && FIELDS.some((f) => f !== "status" && result[f])) ? policy.status : "unclear";
  return { result, kept, dropped };
}

/* ---------- per hotel ---------- */
let credits = 0, inTok = 0, outTok = 0;
async function work(h) {
  const cacheFile = join(CACHE, `${h.id}.json`);
  let raw;
  if (existsSync(cacheFile) && !REFRESH) raw = JSON.parse(readFileSync(cacheFile, "utf8"));
  else {
    const q = `${h.name} ${h.city || ""} pet policy`.replace(/\s+/g, " ").trim();
    const r = await firecrawlSearch(q);
    credits += r.credits;
    raw = { query: q, fetched: new Date().toISOString(), results: r.results.map((x) => ({ url: x.url, title: x.title || "", markdown: x.markdown || "" })) };
    writeFileSync(cacheFile, JSON.stringify(raw));
  }
  const sources = raw.results
    .map((x) => ({ url: x.url, official: isOfficial(x.url, h), text: petPassages(x.markdown) }))
    .filter((s) => s.text.length > 40)
    .sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0))
    .slice(0, 4);
  const base = { name: h.name, checked: new Date().toISOString().slice(0, 10) };
  if (!sources.length) return (out[h.id] = { ...base, status: "unclear", note: "No pet information found in search results.", sources: [] });

  if (!USE_CLAUDE) return workFirecrawl(h, sources, base, raw);
  const x = await extract(h, sources);
  inTok += x.usage?.input_tokens || 0; outTok += x.usage?.output_tokens || 0;
  if (x.refused || !x.policy) return (out[h.id] = { ...base, status: "unclear", note: x.refused ? "Model declined." : "No parsable answer.", sources: [] });
  if (!x.policy.about_this_hotel) return (out[h.id] = { ...base, status: "unclear", note: "Sources did not describe this exact hotel.", sources: sources.map((s) => ({ url: s.url, official: s.official })) });

  const v = verify(x.policy, sources);
  const used = [...new Set(v.kept.map((e) => e.source))].sort();
  out[h.id] = {
    ...base, ...v.result,
    conflicts: x.policy.conflicts || null,
    sources: used.map((n) => ({ url: sources[n - 1].url, official: sources[n - 1].official })),
    evidence: v.kept.map((e) => ({ field: e.field, quote: e.quote, url: sources[e.source - 1].url })),
    dropped: v.dropped.length || undefined,
  };
}

// Firecrawl path: extract from the best official page, then the next best page if fields are missing.
const PET_LOW_VALUE = /tripadvisor\.|reddit\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|yelp\./i;
async function workFirecrawl(h, sources, base, raw) {
  const merged = {}, used = [];
  const useSrc = (url, official) => { let i = used.findIndex((u) => u.url === url); if (i < 0) { used.push({ url, official }); i = used.length - 1; } return i; };
  const take = (fields, url, official, how) => { for (const [k, x] of Object.entries(fields)) if (!merged[k] || (official && !merged[k].official)) merged[k] = { ...x, src: useSrc(url, official), official, how }; };
  const pages = raw.results.filter((x) => x.markdown && !PET_LOW_VALUE.test(hostOf(x.url))).map((x) => ({ url: x.url, md: x.markdown, official: isOfficial(x.url, h) }));
  // 1. rule-based, official pages first
  for (const p of pages.filter((x) => x.official)) take(ruleFields(p.md, h, true), p.url, true, "rule");
  // 2. AI on the best pages (official first) for what's still missing, plus amenities / rules / areas
  let status = null;
  const ranked = sources.filter((x) => !PET_LOW_VALUE.test(hostOf(x.url))).sort((a, b) => (b.official - a.official) || (b.text.length - a.text.length));
  for (const [i, src] of ranked.slice(0, 3).entries()) {
    const missing = ["fee", "weight_limit", "max_pets", "species", "amenities", "rules"].filter((f) => !merged[f]);
    if (!missing.length) break;
    if (i === 2 && merged.fee) break;
    const r = await firecrawlExtract(src.url);
    if (!r.json) continue;
    const v = verifyPage(r.json, r.markdown);
    if (!src.official) for (const k of Object.keys(v.fields)) if (!v.fields[k].quotes.some((q) => aboutThisHotel(q, h, false))) delete v.fields[k];
    for (const [k, x] of Object.entries(v.fields)) if (!merged[k]) merged[k] = { ...x, src: useSrc(src.url, src.official), official: src.official, how: "ai" };
    if (!status && v.status) status = v.status;
  }
  // 3. rule-based on third-party pages for anything still missing
  for (const p of pages.filter((x) => !x.official)) { const f = ruleFields(p.md, h, false); for (const [k, x] of Object.entries(f)) if (!merged[k]) merged[k] = { ...x, src: useSrc(p.url, false), official: false, how: "rule" }; }
  // same text filed as both fee and deposit: keep it where its quote says it belongs
  if (merged.fee && merged.deposit && merged.fee.value === merged.deposit.value) delete merged[/deposit|pre-?authori|hold/i.test(merged.fee.quotes.join(" ")) ? "fee" : "deposit"];

  const keep = new Set(Object.values(merged).map((x) => x.src));
  const remap = {}; const srcs = [];
  used.forEach((u, i) => { if (keep.has(i)) { remap[i] = srcs.length; srcs.push(u); } });
  const rec = { ...base, status: status || (Object.keys(merged).length ? "welcome" : "unclear") };
  for (const f of FIELDS) if (f !== "status") rec[f] = merged[f] ? merged[f].value : null;
  rec.from = Object.fromEntries(Object.entries(merged).map(([k, x]) => [k, x.official ? "official" : "third-party"]));
  rec.sources = srcs;
  rec.evidence = Object.entries(merged).map(([k, x]) => ({ field: k, quote: x.quotes[0], url: used[x.src].url, how: x.how }));
  if (!Object.keys(merged).length) rec.note = "No verifiable pet details found.";
  out[h.id] = rec;
}

const todo = COLL.hotels.filter((h) => (ONLY ? ONLY.has(h.id) : true) && (REDO || !out[h.id])).slice(0, LIMIT);
console.log(`Pet details: ${todo.length} hotels to check (${Object.keys(out).length} already done)`);
let done = 0, failed = 0;
const queue = todo.slice();
function save() { writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.keys(out).sort((a, b) => a - b).map((k) => [k, out[k]])), null, 1) + "\n"); }
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const h = queue.shift();
    try { await work(h); } catch (e) { failed++; console.warn(`  ! ${h.id} ${h.name}: ${String(e.message || e).slice(0, 160)}`); }
    if (++done % 10 === 0) { save(); console.log(`  ${done}/${todo.length}  (Firecrawl credits ${credits}, Claude tokens in ${inTok} / out ${outTok})`); }
  }
}));
save();
const all = Object.values(out);
const count = (f) => all.filter((r) => r[f]).length;
console.log(`Done: ${done} checked, ${failed} failed. Firecrawl credits ${credits}; Claude tokens in ${inTok} / out ${outTok} (~$${((inTok * 4 + outTok * 20) / 1e6).toFixed(2)}).`);
console.log(`Totals in pet-details.json (${all.length}): fee ${count("fee")}, weight ${count("weight_limit")}, max pets ${count("max_pets")}, species ${count("species")}, deposit ${count("deposit")}, official source ${all.filter((r) => (r.sources || []).some((s) => s.official)).length}, unclear ${all.filter((r) => r.status === "unclear").length}`);
