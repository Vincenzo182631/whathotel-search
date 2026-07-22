/*
 * build-data.mjs — generate assets/js/data.js from the AUTHORITATIVE
 * WhataHotel "Villas & Residences" (Homes) collection.
 *
 * SOURCE OF TRUTH: scripts/source-homes.json, parsed verbatim from
 * https://whatahotel.com/homes/ (the exact 271 properties on the live Homes
 * page, each with its real name, collection/brand, city, country, hotelID and
 * canonical URL slug).
 *
 * IMPORTANT — this build does NOT classify or include/exclude properties by
 * name keywords. The property list is taken exactly as provided; every one of
 * the 271 appears, none are added, none are removed, and each keeps its correct
 * link. Categorisation for the UI is by REGION (derived from the property's real
 * country) and by COLLECTION/brand (from the property's real collection field) —
 * never by guessing residential inventory from the hotel's name.
 *
 * Run:  node scripts/build-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(root, "assets", "js", "data.js");

const source = JSON.parse(readFileSync(join(__dirname, "source-homes.json"), "utf8"));

/* ---- Region: derived from the property's real country (geography, not names) ---- */
const REGION_OF = {
  "United States": "North America", "Canada": "North America",
  "Mexico": "Latin America & Caribbean", "Belize": "Latin America & Caribbean",
  "Costa Rica": "Latin America & Caribbean", "Honduras": "Latin America & Caribbean",
  "Brazil": "Latin America & Caribbean", "Peru": "Latin America & Caribbean",
  "Turks and Caicos Islands": "Latin America & Caribbean", "Anguilla, BWI": "Latin America & Caribbean",
  "Bahamas": "Latin America & Caribbean", "Dominican Republic": "Latin America & Caribbean",
  "Jamaica": "Latin America & Caribbean", "Barbados": "Latin America & Caribbean",
  "British Virgin Islands": "Latin America & Caribbean", "Grand Cayman": "Latin America & Caribbean",
  "Puerto Rico": "Latin America & Caribbean", "St. Kitts and Nevis": "Latin America & Caribbean",
  "Antigua": "Latin America & Caribbean", "Bermuda": "Latin America & Caribbean",
  "Grenada": "Latin America & Caribbean", "Saint Lucia": "Latin America & Caribbean",
  "Saint Vincent and the Grenadines": "Latin America & Caribbean", "St. Martin": "Latin America & Caribbean",
  "Italy": "Europe", "Greece": "Europe", "Spain": "Europe", "Switzerland": "Europe",
  "Turkey": "Europe", "Croatia": "Europe", "France": "Europe", "Montenegro": "Europe",
  "Portugal": "Europe", "Scotland": "Europe", "United Kingdom": "Europe",
  "Indonesia": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "China": "Asia",
  "Japan": "Asia", "Cambodia": "Asia", "Philippines": "Asia", "Malaysia": "Asia",
  "India": "Asia", "Singapore": "Asia",
  "United Arab Emirates": "Middle East & Africa", "Qatar": "Middle East & Africa",
  "Saudi Arabia": "Middle East & Africa", "Egypt": "Middle East & Africa",
  "Seychelles": "Middle East & Africa", "Mauritius": "Middle East & Africa",
  "Morocco": "Middle East & Africa", "South Africa": "Middle East & Africa",
  "Tanzania": "Middle East & Africa",
  "Maldives": "Pacific & Indian Ocean", "French Polynesia (Tahiti)": "Pacific & Indian Ocean",
  "Australia": "Pacific & Indian Ocean", "Fiji Islands": "Pacific & Indian Ocean",
};
// short region key (slug) for filtering + a display label
const REGION_KEY = {
  "North America": "north-america",
  "Latin America & Caribbean": "latam-caribbean",
  "Europe": "europe",
  "Asia": "asia",
  "Middle East & Africa": "mea",
  "Pacific & Indian Ocean": "pacific",
};

/* ---- Country display normalisation (tidy a couple of source quirks) ---- */
const COUNTRY_DISPLAY = {
  "Anguilla, BWI": "Anguilla",
  "French Polynesia (Tahiti)": "French Polynesia",
  "Turks and Caicos Islands": "Turks & Caicos",
  "Fiji Islands": "Fiji",
};

/* ---- Collection cleaning + brand (from the real collection field) ---- */
function cleanCollection(s) {
  if (!s) return "";
  s = s.split(/\s+under\s+/i)[0];               // drop "under <loyalty> Program"
  s = s.replace(/\s*(programs?|progams?)\s*$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
// Ordered brand rules; matched against "<name> <collection>". First hit wins.
const BRAND_RULES = [
  [/ritz-?carlton/i, "Ritz-Carlton"],
  [/four seasons/i, "Four Seasons"],
  [/\baman/i, "Aman"],
  [/belmond/i, "Belmond"],
  [/rosewood/i, "Rosewood"],
  [/mandarin oriental/i, "Mandarin Oriental"],
  [/six senses/i, "Six Senses"],
  [/st\.? regis/i, "St. Regis"],
  [/waldorf/i, "Waldorf Astoria"],
  [/one\s*&\s*only|one and only/i, "One&Only"],
  [/auberge/i, "Auberge Resorts"],
  [/oetker/i, "Oetker Collection"],
  [/banyan tree/i, "Banyan Tree"],
  [/anantara/i, "Anantara"],
  [/raffles/i, "Raffles"],
  [/fairmont/i, "Fairmont"],
  [/regent/i, "Regent"],
  [/peninsula/i, "Peninsula"],
  [/shangri-?la/i, "Shangri-La"],
  [/jw marriott/i, "JW Marriott"],
  [/w hotels|w doha|w algarve|\bw \b/i, "W Hotels"],
  [/luxury collection/i, "Luxury Collection"],
  [/autograph collection/i, "Autograph Collection"],
  [/andaz|park hyatt|grand hyatt|hyatt/i, "Hyatt"],
  [/conrad|waldorf|hilton/i, "Hilton"],
  [/sofitel|mgallery|fairmont|raffles|accor/i, "Accor"],
  [/leading hotels/i, "Leading Hotels of the World"],
  [/preferred/i, "Preferred"],
  [/relais\s*&?\s*ch/i, "Relais & Châteaux"],
];
function brandFor(name, collection) {
  const hay = (name + " " + collection);
  for (const [re, label] of BRAND_RULES) if (re.test(hay)) return label;
  return "";
}

/* ---- Scene (placeholder art behind the real photo) from city/country/region ---- */
const SCENE_KW = [
  ["mountain", ["aspen", "vail", "deer valley", "snowmass", "telluride", "niseko", "hokkaido", "teton village", "stowe", "park city", "courchevel", "verbier", "st. moritz", "zermatt", "gstaad", "queenstown", "lugano", "locarno", "merano"]],
  ["desert", ["scottsdale", "paradise valley", "sedona", "phoenix", "palm springs", "tucson", "las vegas", "dubai", "abu dhabi", "doha", "riyadh", "al ula", "marrakech", "taos"]],
  ["tropical", ["maldives", "bora bora", "tahiti", "moorea", "seychelles", "mauritius", "bali", "nusa dua", "phuket", "koh samui", "krabi", "hua hin", "pattaya", "da nang", "phu quoc", "nha trang", "hawaii", "maui", "kauai", "kona", "big island", "honolulu", "waikiki", "turks", "caicos", "anguilla", "montego bay", "jamaica", "punta cana", "la romana", "nevis", "st. kitts", "barbados", "bahamas", "cancun", "riviera maya", "los cabos", "cabo", "cartagena", "fiji", "zanzibar"]],
  ["beach", ["santorini", "oia", "mykonos", "naxos", "milos", "corfu", "crete", "chania", "elounda", "halkidiki", "dubrovnik", "sveti stefan", "positano", "amalfi", "taormina", "sicily", "sardinia", "mallorca", "balearic", "menorca", "ibiza", "algarve", "cape coral", "miami", "captiva", "charleston", "coronado", "yalikavak", "bodrum", "palermo", "phu quoc"]],
  ["countryside", ["lake como", "tuscany", "florence", "chianti", "napa", "yountville", "sonoma", "galway", "belfast", "thomastown", "kilkenny", "provence", "asolo", "stresa", "verona", "loire", "cotswolds", "scotland", "umbria"]],
];
function sceneFor(city, country, region) {
  const l = ((city || "") + " " + (country || "")).toLowerCase();
  for (const [scene, kws] of SCENE_KW) if (kws.some((k) => l.includes(k))) return scene;
  // Region defaults
  if (region === "Pacific & Indian Ocean") return "tropical";
  if (region === "Latin America & Caribbean") return "tropical";
  if (region === "Middle East & Africa") return "desert";
  if (region === "Europe") return "countryside";
  if (region === "Asia") return "tropical";
  return "city";
}

/* ---- Featured marquee (must be IDs that exist in the source list) ---- */
const FEATURED = new Set([
  1055, // Villa La Massa — Florence
  2944, // Amanoi — Vietnam
  1124, // Jumby Bay Island — Antigua
  1031, // One&Only Palmilla — Los Cabos
  1073, // Belmond La Residencia — Mallorca
  3705, // Mandarin Oriental, Lago di Como
  1057, // COMO Parrot Cay — Turks & Caicos
  946,  // Belmond Villa San Michele — Florence
  935,  // Sandy Lane — Barbados
  993,  // Villa d'Este — Lake Como
  1051, // Raffles Hotel Singapore
]);

/* ---- Build records ---- */
const props = source.map((s) => {
  const region = REGION_OF[s.country] || "Other";
  const country = COUNTRY_DISPLAY[s.country] || s.country;
  const city = s.city || "";
  const loc = city ? city + ", " + country : country;
  const collection = cleanCollection(s.collection);
  const brand = brandFor(s.name, s.collection);
  const scene = sceneFor(city, s.country, region);
  const url = "https://whatahotel.com/hotels/" + s.id + "/" + s.slug + ".html";
  return {
    id: s.id,
    url,
    name: s.name,
    loc,
    city,
    country,
    region,
    regionKey: REGION_KEY[region] || "other",
    collection,
    brand,
    scene,
    blurb: "In " + loc + ".",   // factual fallback; real description overrides at runtime (WAH_DESC)
    featured: FEATURED.has(s.id),
  };
});

/* Sort: featured first, then by name (stable browsing order). */
props.sort((a, b) => (b.featured - a.featured) || a.name.localeCompare(b.name));

/* ---- Region + brand metadata for the UI (counts computed here) ---- */
const REGION_ORDER = ["North America", "Latin America & Caribbean", "Europe", "Asia", "Middle East & Africa", "Pacific & Indian Ocean"];
const REGION_BLURB = {
  "North America": "Villas, residences & estates across the U.S. and Canada.",
  "Latin America & Caribbean": "Beachfront homes & villas across Mexico, the Caribbean and beyond.",
  "Europe": "Historic villas & residences across the Mediterranean and countryside.",
  "Asia": "Private pool villas & residences across Southeast Asia and beyond.",
  "Middle East & Africa": "Desert residences & island villas across the region.",
  "Pacific & Indian Ocean": "Overwater villas & island residences on remote lagoons.",
};
const REGION_SCENE = {
  "North America": "mountain", "Latin America & Caribbean": "tropical", "Europe": "countryside",
  "Asia": "tropical", "Middle East & Africa": "desert", "Pacific & Indian Ocean": "beach",
};
const regionCounts = {};
props.forEach((p) => { regionCounts[p.region] = (regionCounts[p.region] || 0) + 1; });
const REGIONS = REGION_ORDER.filter((r) => regionCounts[r]).map((r) => ({
  key: REGION_KEY[r], label: r, blurb: REGION_BLURB[r], scene: REGION_SCENE[r], count: regionCounts[r],
}));

const brandCounts = {};
props.forEach((p) => { if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1; });
const BRANDS = Object.keys(brandCounts).map((b) => ({ label: b, count: brandCounts[b] }))
  .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

/* ---- Stats ---- */
console.log("Properties (must be 271):", props.length);
console.log("Unique IDs:", new Set(props.map((p) => p.id)).size);
console.log("Region counts:", regionCounts);
console.log("Featured:", props.filter((p) => p.featured).length);
console.log("Top brands:", BRANDS.slice(0, 10).map((b) => b.label + "(" + b.count + ")").join(", "));

/* ---- Emit data.js ---- */
const header = `/*
 * WhataHotel! — Homes (Villas & Residences) collection data
 * AUTO-GENERATED by scripts/build-data.mjs from scripts/source-homes.json,
 * the AUTHORITATIVE list of the 271 properties on https://whatahotel.com/homes/.
 * Do not hand-edit. To change the list, edit source-homes.json and re-run:
 *   node scripts/build-data.mjs
 *
 * Every property here is exactly one of the 271 on the live Homes page — none
 * added, none removed. \`url\` is the canonical individual property page.
 * Categorisation (region, brand) is derived from each property's REAL country
 * and collection — never from guessing residential inventory from its name.
 * "Check Availability" is handled at runtime by linking to the property's
 * existing showRates.cfm?...&type=homes endpoint, which applies WhataHotel's
 * Amadeus residential-inventory keyword filtering on the actual unit
 * descriptions (see homes-inventory-filter.js for the documented keyword logic).
 */
window.WAH_REGIONS = ${JSON.stringify(REGIONS, null, 2)};
window.WAH_BRANDS = ${JSON.stringify(BRANDS, null, 2)};
window.WAH_PROPERTIES = `;
writeFileSync(OUT, header + JSON.stringify(props, null, 2) + ";\n");
console.log("Wrote", OUT);
