/*
 * fetch-pet-collection.mjs — reads WhataHotel's "Pet-Friendly Luxury Hotels" collection
 * (https://www.whatahotel.com/collection/pet-friendly-luxury-hotels.html) and saves every
 * hotel on it, exactly as listed: name, brand program, country, state/region, city,
 * hotel ID and page slug.
 *
 * Output: scripts/pet-collection.json  { source, fetched, intro: [..], hotels: [..] }
 * Used by: scripts/build-pet-page.mjs (the /pet-friendly page) and
 *          scripts/build-pets.mjs (Pet-friendly tags on the Homes page).
 *
 * Run:  node scripts/fetch-pet-collection.mjs     (npm run pets:collection)
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SOURCE = "https://www.whatahotel.com/collection/pet-friendly-luxury-hotels.html";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "pet-collection.json");

const html = execFileSync("curl", ["-sL", "--max-time", "60", "-A", "Mozilla/5.0 (WhataHotel pet-friendly page build)", SOURCE],
  { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
  .replace(/&#39;|&rsquo;|&#8217;/g, "’").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Intro paragraphs (WhataHotel's own words about pet rules).
const introStart = html.indexOf("Pet-Friendly Luxury Hotels</h1>");
const introEnd = html.indexOf('class="callOut"');
const intro = (html.slice(introStart, introEnd).match(/<p[^>]*>[\s\S]*?<\/p>/g) || []).map(decode).filter(Boolean);

// The list: <h2> country, <h3> state/region, <h4> city, <li><b>name</b> - program – links</li>
const body = html.slice(introEnd, html.indexOf("</section>", introEnd));
const tok = /<h2>([\s\S]*?)<\/h2>|<h3>([\s\S]*?)<\/h3>|<h4>([\s\S]*?)<\/h4>|<li>\s*<b>([\s\S]*?)<\/b>([\s\S]*?)<\/li>/g;
let country = null, region = null, city = null, m;
const hotels = [];
while ((m = tok.exec(body))) {
  const [, h2, h3, h4, name, rest] = m;
  if (h2 !== undefined) { country = decode(h2); region = null; city = null; }
  else if (h3 !== undefined) { region = decode(h3); city = null; }
  else if (h4 !== undefined) { city = decode(h4); }
  else {
    const link = rest.match(/href="\/hotels\/(\d+)\/([^"]+)\.html"/);
    if (!link) continue;
    const program = (rest.match(/^\s*-\s*([\s\S]*?)\s*&ndash;/) || [])[1] || "";
    hotels.push({ id: Number(link[1]), slug: link[2], name: decode(name), program: decode(program), country, region, city });
  }
}
if (hotels.length < 100) throw new Error(`Only ${hotels.length} hotels found — the page layout may have changed; nothing written.`);
const stated = Number((html.match(/We found <b>(\d+)<\/b> Hotels/i) || [])[1] || 0);
writeFileSync(OUT, JSON.stringify({ source: SOURCE, fetched: new Date().toISOString().slice(0, 10), intro, hotels }, null, 1) + "\n");
console.log(`Pet-friendly collection: ${hotels.length} hotels in ${new Set(hotels.map((h) => h.country)).size} countries` + (stated && stated !== hotels.length ? ` (page says ${stated})` : ""));
