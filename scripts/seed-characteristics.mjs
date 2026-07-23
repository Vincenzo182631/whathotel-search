/*
 * seed-characteristics.mjs
 * ------------------------------------------------------------------
 * Deterministic, evidence-based seeding of property "settings" (the
 * physical/experiential characteristic of each property: beachfront,
 * mountain & ski, island, lake, countryside, city, desert) plus a
 * short list of features.
 *
 * IMPORTANT — grounding rules (mirrors the live classifier):
 *   • Characteristics are derived ONLY from a property's REAL on-page
 *     description text (assets/js/descriptions.js) and its REAL
 *     geography (city / country / region from assets/js/data.js).
 *   • They are NEVER inferred from the hotel's NAME. A name containing
 *     "Beach", "Mountain", "Island", "Lake" etc. contributes nothing.
 *   • Geography evidence uses a curated city/country gazetteer — real
 *     places, not words that happen to appear in a hotel name.
 *
 * Output: assets/js/characteristics.js  ->  window.WAH_TRAITS = {
 *   "<id>": { settings:[...], features:[...], primary:"<setting>", source:"seed" }
 * }
 *
 * The live classifier (scripts/classify-properties.mjs) can later
 * overwrite this file with richer, LLM-verified tags. Until then this
 * seed makes the "Setting" filter fully live for all 271 properties.
 *
 * Run:  node scripts/seed-characteristics.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/* ---- Load the generated data + descriptions into a fake window ---- */
function loadWindow(...files) {
  const win = {};
  const sandbox = { window: win };
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), "utf8");
    // eslint-disable-next-line no-new-func
    new Function("window", code)(win);
  }
  return win;
}
const win = loadWindow("assets/js/data.js", "assets/js/descriptions.js");
const PROPS = win.WAH_PROPERTIES || [];
const DESC = win.WAH_DESC || {};
if (!PROPS.length) { console.error("No WAH_PROPERTIES loaded"); process.exit(1); }

/* ------------------------------------------------------------------ *
 * SETTING vocabulary (the controlled list the UI filters on).
 * Each setting has:
 *   text  – regexes matched against the REAL description prose
 *   geo   – lower-case city/country tokens (real places) that imply it
 * A property can carry several settings; `primary` is the strongest.
 * ------------------------------------------------------------------ */
const SETTINGS = {
  beachfront: {
    label: "Beachfront",
    text: [
      /\bbeach ?front\b/, /\bon the beach\b/, /\bwhite[- ]sand\b/, /\bsandy beach(es)?\b/,
      /\bocean ?front\b/, /\bbeach club\b/, /\bprivate beach\b/, /\bshoreline\b/,
      /\bstretch(es)? of (white |golden )?sand\b/, /\bpalm[- ]fringed\b/, /\bturquoise (sea|water|lagoon)\b/,
    ],
    geo: [
      "cabo", "los cabos", "cancun", "riviera maya", "playa del carmen", "mayakoba",
      "punta mita", "tulum", "puerto vallarta", "cozumel", "punta cana", "la romana",
      "montego bay", "negril", "ocho rios", "nassau", "paradise island", "grand cayman",
      "cartagena", "tamarindo", "papagayo", "guanacaste", "nosara",
      "phuket", "krabi", "hua hin", "koh samui", "da nang", "hoi an", "nha trang",
      "bali", "nusa dua", "seminyak", "jimbaran", "uluwatu", "lombok",
      "algarve", "marbella", "costa smeralda", "amalfi", "positano", "taormina",
      "santa monica", "malibu", "laguna beach", "santa barbara", "naples", "captiva",
      "palm beach", "miami beach", "key west", "kiawah", "sea island", "amelia island",
      "cabo san lucas", "san jose del cabo", "waikiki", "wailea", "kapalua", "kohala",
    ],
  },
  island: {
    label: "Island",
    text: [
      /\bprivate island\b/, /\bisland resort\b/, /\bown island\b/, /\bisland retreat\b/,
      /\batoll\b/, /\bover[- ]?water (villa|bungalow|suite)/, /\blagoon\b/,
    ],
    geo: [
      "maldives", "bora bora", "moorea", "tahiti", "fiji", "seychelles", "mauritius",
      "turks", "caicos", "anguilla", "nevis", "st. kitts", "antigua", "barbuda",
      "bahamas", "canouan", "mustique", "bermuda", "aruba", "barbados", "st. barth",
      "st barth", "st. lucia", "grenada", "curacao", "pamalican", "palawan",
      "boracay", "phu quoc", "koh samui", "zanzibar", "santorini", "mykonos",
      "capri", "ischia", "sardinia", "sicily", "mallorca", "menorca", "ibiza",
      "hawaii", "maui", "kauai", "lanai", "kona", "oahu", "hamilton island",
    ],
  },
  mountain: {
    label: "Mountain & Ski",
    text: [
      /\bski[- ](in|out|slope|resort|lift)/, /\bslopes?\b/, /\bmountain resort\b/,
      /\balpine\b/, /\bmountainside\b/, /\bsnow[- ]?capped\b/, /\bpiste\b/,
      /\bgondola\b/, /\bpowder\b/, /\bhiking trails?\b/, /\bmountain (peaks?|vista|views)/,
    ],
    geo: [
      "aspen", "vail", "deer valley", "snowmass", "telluride", "park city", "beaver creek",
      "jackson hole", "teton", "big sky", "whistler", "stowe", "lake placid",
      "courchevel", "megeve", "chamonix", "verbier", "st. moritz", "zermatt", "gstaad",
      "kitzbuhel", "cortina", "niseko", "hokkaido", "queenstown", "banff", "whistler",
    ],
  },
  lake: {
    label: "Lakeside",
    text: [/\blakeside\b/, /\blake ?front\b/, /\bon the shores? of lake\b/, /\boverlooking the lake\b/],
    geo: [
      "lake como", "como", "lago di como", "lake garda", "garda", "lake geneva",
      "lugano", "locarno", "lake tahoe", "stresa", "maggiore",
    ],
  },
  countryside: {
    label: "Countryside",
    text: [
      /\bvineyard(s)?\b/, /\brolling hills\b/, /\bcountryside\b/, /\brural\b/,
      /\bestate\b.*\b(acres|hectares|grounds)\b/, /\bwine (country|estate)\b/,
      /\bolive groves?\b/, /\bpastoral\b/, /\bnature reserve\b/, /\bworking farm\b/,
      /\btuscan\b/, /\bchateau\b/, /\bmanor\b/,
    ],
    geo: [
      "tuscany", "chianti", "montalcino", "castiglion", "siena", "florence countryside",
      "napa", "yountville", "sonoma", "provence", "loire", "cotswolds", "umbria",
      "burgundy", "bordeaux", "asolo", "kilkenny", "thomastown", "county",
    ],
  },
  desert: {
    label: "Desert",
    text: [/\bdesert\b/, /\bdune(s)?\b/, /\boasis\b/, /\barid\b/, /\bsahara\b/, /\bsonoran\b/],
    geo: [
      "scottsdale", "paradise valley", "sedona", "phoenix", "tucson", "palm springs",
      "las vegas", "santa fe", "taos", "dubai", "abu dhabi", "doha", "riyadh",
      "al ula", "marrakech", "ras al khaimah",
    ],
  },
  city: {
    label: "City",
    text: [/\bin the heart of\b.*\b(city|downtown)\b/, /\bcity centre\b/, /\bdowntown\b/, /\burban\b/, /\bskyline\b/, /\bcosmopolitan\b/],
    geo: [
      "new york", "manhattan", "london", "paris", "milan", "rome", "madrid", "barcelona",
      "tokyo", "singapore", "hong kong", "shanghai", "bangkok", "boston", "chicago",
      "san francisco", "los angeles", "washington", "toronto", "montreal", "vienna",
      "amsterdam", "berlin", "istanbul", "dubai", "beijing", "seoul", "sydney", "melbourne",
      "geneva", "zurich", "munich", "florence", "venice", "lisbon", "prague", "budapest",
    ],
  },
};

/* Feature vocabulary — grounded ONLY in description prose. */
const FEATURES = {
  golf: [/\bgolf\b/, /\bchampionship (course|links)\b/, /\bfairway/],
  spa: [/\bspa\b/, /\bwellness\b/, /\bthermal\b/, /\bhammam\b/],
  "private-pool": [/\bprivate (plunge |infinity )?pool/, /\bplunge pool/, /\bpool villa/, /\binfinity pool/],
  "overwater": [/\bover[- ]?water (villa|bungalow|suite)/],
  vineyard: [/\bvineyard/, /\bwine (estate|country|cellar)/, /\bwinery\b/],
  golfmarina: [], // placeholder guard (unused)
  marina: [/\bmarina\b/, /\byacht/, /\bsuperyacht/, /\bharbou?r\b/],
  "family-friendly": [/\bfamil(y|ies)\b/, /\bkids? club\b/, /\bchildren'?s?\b/],
  historic: [/\bhistoric\b/, /\b(15th|16th|17th|18th|19th)[- ]century\b/, /\bcenturies[- ]old\b/, /\brenaissance\b/, /\bpalazzo\b/, /\bchateau\b/, /\bcastle\b/, /\bmanor\b/],
  culinary: [/\bmichelin\b/, /\bfine dining\b/, /\bgastronom/, /\bcelebrated chef/],
};
delete FEATURES.golfmarina;

const REGION_FALLBACK = {
  "pacific": "island",
  "latam-caribbean": "beachfront",
  "mea": "desert",
  "europe": "countryside",
  "asia": "beachfront",
  "north-america": "city",
};

function testAny(regexes, text) { return regexes.some((r) => r.test(text)); }
function geoHit(tokens, hay) { return tokens.some((t) => hay.includes(t)); }

let withDesc = 0, geoOnly = 0, fallback = 0;
const traits = {};

for (const p of PROPS) {
  const desc = (DESC[p.id] || "").toLowerCase();
  const geo = ((p.city || "") + " " + (p.country || "")).toLowerCase();
  const settings = [];
  const scored = [];

  for (const [key, def] of Object.entries(SETTINGS)) {
    let score = 0;
    if (desc && testAny(def.text, desc)) score += 2;      // strongest: real prose
    if (def.geo.length && geoHit(def.geo, geo)) score += 2; // real geography
    if (score > 0) scored.push([key, score]);
  }

  // Beachfront/island reinforcement from tropical geography in prose
  if (desc && /\b(beach|ocean|sea|lagoon|shore|coast)\b/.test(desc) && !scored.find((s) => s[0] === "beachfront")) {
    scored.push(["beachfront", 1]);
  }

  scored.sort((a, b) => b[1] - a[1]);
  for (const [k] of scored) settings.push(k);

  let primary = settings[0];
  let source;
  if (desc && scored.length) { withDesc++; source = "description"; }
  else if (scored.length) { geoOnly++; source = "geography"; }
  else {
    primary = REGION_FALLBACK[p.regionKey] || "beachfront";
    settings.push(primary);
    fallback++; source = "region-fallback";
  }

  // Features (prose only)
  const features = [];
  for (const [key, regexes] of Object.entries(FEATURES)) {
    if (desc && testAny(regexes, desc)) features.push(key);
  }

  traits[p.id] = {
    settings: [...new Set(settings)].slice(0, 4),
    primary,
    features: features.slice(0, 5),
    source,
  };
}

/* ---- Emit assets/js/characteristics.js ---- */
const SETTING_META = Object.fromEntries(
  Object.entries(SETTINGS).map(([k, v]) => [k, v.label])
);
const header = `/*
 * WhataHotel! — Homes property CHARACTERISTICS (settings + features)
 * AUTO-GENERATED. Seeded by scripts/seed-characteristics.mjs from each
 * property's REAL on-page description (WAH_DESC) and REAL geography
 * (city/country) — NEVER from the hotel name.
 *
 * The live "agentic" classifier (scripts/classify-properties.mjs) can
 * overwrite this file with LLM-verified tags; the shape is identical.
 *
 * WAH_SETTINGS: label map for the controlled setting vocabulary.
 * WAH_TRAITS:   { "<hotelID>": { settings:[keys], primary, features:[keys], source } }
 */
`;
const out =
  header +
  "window.WAH_SETTINGS = " + JSON.stringify(SETTING_META, null, 2) + ";\n" +
  "window.WAH_TRAITS = " + JSON.stringify(traits, null, 0) + ";\n";

fs.writeFileSync(path.join(root, "assets/js/characteristics.js"), out);

/* ---- Stats ---- */
const dist = {};
for (const t of Object.values(traits)) dist[t.primary] = (dist[t.primary] || 0) + 1;
console.log("Properties classified:", Object.keys(traits).length);
console.log("  from description:", withDesc, "| geography-only:", geoOnly, "| region-fallback:", fallback);
console.log("Primary-setting distribution:", dist);
console.log("Wrote assets/js/characteristics.js");
