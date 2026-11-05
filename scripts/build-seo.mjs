#!/usr/bin/env node
/*
 * build-seo.mjs — search (SEO), answer-engine (AEO) and AI-engine (GEO) content
 * for the Homes landing page, generated from the REAL property data.
 *
 * Why: the page's cards are drawn by JavaScript. Google renders that later (if
 * at all), and AI crawlers (GPTBot, ClaudeBot, PerplexityBot …) don't run
 * JavaScript, so they saw no property names. This writes plain HTML + JSON-LD
 * into index.html between markers, so every property and every answer is in
 * the HTML itself:
 *
 *   <!-- WAH:SEO-HEAD:START --> … <!-- WAH:SEO-HEAD:END -->   JSON-LD: ItemList (all properties) + FAQPage
 *       (placed just before </body> so the ~110 KB list doesn't delay rendering;
 *        search engines read JSON-LD anywhere in the page)
 *   <!-- WAH:SEO-BODY:START --> … <!-- WAH:SEO-BODY:END -->   "The full collection" (by region/country) + FAQ
 *
 * Also writes llms.txt sections and llms-full.txt (every property), for AI tools.
 *
 * Every fact comes from assets/js/data.js (WhataHotel pages), the Exceptional
 * Homes index (Mandarin Oriental) or copy already published on the page.
 * No prices, ratings or availability claims are emitted.
 *
 * Run after build-data / import-mo-homes:   node scripts/build-seo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
function loadWindow(...files) { const w = {}; for (const f of files) new Function("window", read(f))(w); return w; }

export const PAGE_URL = "https://pro.whatahotel.com/homes";
const ORG_ID = "https://www.whatahotel.com/#org";

const W = loadWindow("assets/js/data.js", "assets/js/mo-homes-index.js");
const HOTELS = W.WAH_PROPERTIES || [];
const HOMES = W.WAH_MO_INDEX || [];
const REGIONS = W.WAH_REGIONS || [];
if (!HOTELS.length) throw new Error("No properties in assets/js/data.js");

const REGION_KEY_OF = { Europe: "europe", Asia: "asia" };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/* ---------- one list: hotels + Exceptional Homes ---------- */
const ALL = HOTELS.map((p) => ({ id: p.id, kind: "hotel", name: p.name, brand: p.brand || "", collection: p.collection || "", city: p.city || "", country: p.country, regionKey: p.regionKey, url: p.url }))
  .concat(HOMES.map((h) => ({ id: h.id, kind: "home", name: h.name, brand: h.brand || "Mandarin Oriental", collection: "Mandarin Oriental Exceptional Homes", city: h.location || "", country: h.country, regionKey: REGION_KEY_OF[h.siteRegion] || "europe", url: null, bedrooms: h.bedroomsDisplay })));

const regionOrder = REGIONS.map((r) => r.key);
const regionLabel = Object.fromEntries(REGIONS.map((r) => [r.key, r.label]));
const counts = {}; ALL.forEach((p) => { counts[p.regionKey] = (counts[p.regionKey] || 0) + 1; });
const brandCounts = {}; ALL.forEach((p) => { if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1; });
const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b]) => b);
const homeCountries = [...new Set(HOMES.map((h) => h.country))];
const placeOf = (p) => { const c = p.city || ""; return c && c.toLowerCase().indexOf(String(p.country).toLowerCase()) === -1 ? `${c}, ${p.country}` : (c || p.country); };
const listJoin = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

/* ---------- FAQ (answer-first; facts only from the page / data) ---------- */
const FAQ = [
  ["What is a hotel residence, villa or home-style stay?",
    "It's a private residence, villa or home at a hotel or resort — with separate bedrooms and living areas, and often a full kitchen, dining area and laundry — plus the hotel's service, such as housekeeping, dining, spas and amenities. It gives families, groups and longer stays far more space than a single hotel room."],
  ["How many properties are in the WhataHotel! Homes collection?",
    `${ALL.length} in total: ${HOTELS.length} hotels and resorts with villas, residences and homes, plus ${HOMES.length} Mandarin Oriental Exceptional Homes. By region: ${regionOrder.filter((k) => counts[k]).map((k) => `${regionLabel[k]} ${counts[k]}`).join(", ")}.`],
  ["Which hotel brands are included?",
    `Brands include ${listJoin(topBrands)}, among others. Every property shows its brand or collection on its card.`],
  ["How do I book a villa or residence?",
    "Search by destination, open a property and select Check Availability. You'll see live availability on the property's WhataHotel! page, filtered to its residential-style accommodation (villas, residences and homes), then choose the one that suits your trip."],
  ["What are the Mandarin Oriental Exceptional Homes?",
    `They are ${HOMES.length} private villas and estates from Mandarin Oriental's Exceptional Homes collection, in ${listJoin(homeCountries)}. Each home lists its bedrooms, bathrooms, guest capacity and an indicative starting rate where Mandarin Oriental publishes one.`],
  ["Can I book a Mandarin Oriental Exceptional Home online?",
    "No. These homes are not bookable online. Select Request Availability, share your preferred dates and party size, and a WhataHotel! travel advisor will contact you about availability and rates. Submitting a request does not confirm a reservation, and published rates are indicative and subject to confirmation."],
  ["Are these homes good for families and groups?",
    "Yes. With multiple bedrooms and separate living and dining areas, everyone can stay together in one home instead of booking several hotel rooms. Guest capacity varies by property."],
  ["Who is WhataHotel!?",
    "WhataHotel! is operated by Lorraine Travel, a luxury travel agency in business since 1948 and a member of Signature Travel Network, giving travelers access to exclusive complimentary perks at many of the world's finest hotels and resorts. Contact: +1-877-782-9281 or Reservations@WhataHotel.com."],
];

/* ---------- JSON-LD (head) ---------- */
function itemLd(p, i) {
  const address = { "@type": "PostalAddress", addressCountry: p.country };
  if (p.city) address.addressLocality = p.city;
  const item = { "@type": p.kind === "hotel" ? "Hotel" : "LodgingBusiness", name: p.name, address };
  if (p.url) item.url = p.url;
  if (p.brand) item.brand = { "@type": "Brand", name: p.brand };
  if (p.kind === "home") item.description = "Mandarin Oriental Exceptional Home (private villa). Not bookable online; availability on request.";
  return { "@type": "ListItem", position: i + 1, item };
}
const sorted = ALL.slice().sort((a, b) => regionOrder.indexOf(a.regionKey) - regionOrder.indexOf(b.regionKey) || a.country.localeCompare(b.country) || byName(a, b));
const today = new Date().toISOString().slice(0, 10);
const headLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "ItemList", "@id": `${PAGE_URL}#collection`, name: "WhataHotel! Homes — villas, residences and private homes", numberOfItems: sorted.length, itemListOrder: "https://schema.org/ItemListUnordered", itemListElement: sorted.map(itemLd) },
    { "@type": "FAQPage", "@id": `${PAGE_URL}#faq`, mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ],
};
const HEAD = `<!-- WAH:SEO-HEAD:START (generated by scripts/build-seo.mjs — do not edit) -->\n<script type="application/ld+json">${JSON.stringify(headLd)}</script>\n<!-- WAH:SEO-HEAD:END -->`;

/* ---------- Visible HTML (body) ---------- */
function liHtml(p) {
  const place = esc(p.city || p.country);
  const brand = p.brand ? ` <span class="seo-dir__brand">${esc(p.brand)}</span>` : "";
  if (p.kind === "home") {
    return `<li><a href="#exceptional-homes" data-action="detail" data-id="${esc(p.id)}">${esc(p.name)}</a> <span class="seo-dir__meta">${place}</span>${brand} <span class="seo-dir__tag">Exceptional Home${p.bedrooms ? ` · ${esc(p.bedrooms)} bedrooms` : ""}</span></li>`;
  }
  return `<li><a href="${esc(p.url)}" data-action="detail" data-id="${esc(p.id)}">${esc(p.name)}</a> <span class="seo-dir__meta">${place}</span>${brand}</li>`;
}
const regionBlocks = regionOrder.filter((k) => counts[k]).map((k) => {
  const inRegion = sorted.filter((p) => p.regionKey === k);
  const countries = [...new Set(inRegion.map((p) => p.country))].sort((a, b) => a.localeCompare(b));
  return `<details class="seo-dir__region">\n<summary><span>${esc(regionLabel[k])}</span> <span class="seo-dir__n">${inRegion.length} properties</span></summary>\n` +
    countries.map((c) => { const l = inRegion.filter((p) => p.country === c); return `<h4 class="seo-dir__country">${esc(c)} <span>(${l.length})</span></h4>\n<ul class="seo-dir__list">\n${l.map(liHtml).join("\n")}\n</ul>`; }).join("\n") +
    `\n</details>`;
}).join("\n");

const BODY = `<!-- WAH:SEO-BODY:START (generated by scripts/build-seo.mjs — do not edit) -->
<section class="section seo-dir" id="full-collection" aria-labelledby="full-collection-title">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow center">The full collection</span>
      <h2 id="full-collection-title">All ${ALL.length} villas, residences &amp; homes by destination</h2>
      <p>${HOTELS.length} hotels and resorts with residential-style stays, plus ${HOMES.length} Mandarin Oriental Exceptional Homes. Open a region to see every property, its location and its brand.</p>
    </div>
    <div class="seo-dir__regions">
${regionBlocks}
    </div>
  </div>
</section>

<section class="section seo-faq" id="faq" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow center">Good to know</span>
      <h2 id="faq-title">Frequently asked questions</h2>
    </div>
    <div class="seo-faq__list">
${FAQ.map(([q, a]) => `      <details class="seo-faq__item"><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join("\n")}
    </div>
  </div>
</section>
<!-- WAH:SEO-BODY:END -->`;

/* ---------- write into index.html ---------- */
let html = read("index.html");
function put(src, start, end, block, anchor) {
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (re.test(src)) return src.replace(re, () => block);
  if (src.indexOf(anchor) === -1) throw new Error("Anchor not found: " + anchor);
  return src.replace(anchor, () => block + "\n" + anchor);
}
html = html.replace(/\n?<!-- WAH:SEO-HEAD:START[\s\S]*?<!-- WAH:SEO-HEAD:END -->/, "");   // re-insert at the end of <body>
html = put(html, "<!-- WAH:SEO-HEAD:START", "<!-- WAH:SEO-HEAD:END -->", HEAD, "</body>");
html = put(html, "<!-- WAH:SEO-BODY:START", "<!-- WAH:SEO-BODY:END -->", BODY, "<!-- ============================ FINAL CTA ============================ -->");
html = html.replace(/("dateModified":\s*")[^"]*(")/, `$1${today}$2`).replace(/("numberOfItems":\s*)\d+/, `$1${ALL.length}`);
writeFileSync(join(root, "index.html"), html);

/* ---------- llms-full.txt (every property) ---------- */
const full = [
  "# WhataHotel! Homes — full collection", "",
  `> Every property on ${PAGE_URL} (${ALL.length} total): ${HOTELS.length} hotels and resorts with villas, residences and homes, and ${HOMES.length} Mandarin Oriental Exceptional Homes (not bookable online; availability on request via the page's Request Availability form). Generated ${today} from the page data.`, "",
];
regionOrder.filter((k) => counts[k]).forEach((k) => {
  full.push(`## ${regionLabel[k]} (${counts[k]})`, "");
  const inRegion = sorted.filter((p) => p.regionKey === k);
  [...new Set(inRegion.map((p) => p.country))].sort().forEach((c) => {
    full.push(`### ${c}`, "");
    inRegion.filter((p) => p.country === c).forEach((p) => {
      const brand = p.brand ? ` — ${p.brand}` : "";
      full.push(p.kind === "hotel" ? `- [${p.name}](${p.url}): ${placeOf(p)}${brand}` : `- ${p.name}: ${placeOf(p)}${brand} — Mandarin Oriental Exceptional Home${p.bedrooms ? `, ${p.bedrooms} bedrooms` : ""}; request availability at ${PAGE_URL}#exceptional-homes`);
    });
    full.push("");
  });
});
writeFileSync(join(root, "llms-full.txt"), full.join("\n"));

/* ---------- FAQ block inside llms.txt ---------- */
let llms = read("llms.txt");
const faqMd = `<!-- WAH:FAQ:START -->\n## Frequently asked questions\n\n${FAQ.map(([q, a]) => `**${q}**\n${a}`).join("\n\n")}\n<!-- WAH:FAQ:END -->`;
llms = /<!-- WAH:FAQ:START -->[\s\S]*?<!-- WAH:FAQ:END -->/.test(llms) ? llms.replace(/<!-- WAH:FAQ:START -->[\s\S]*?<!-- WAH:FAQ:END -->/, () => faqMd) : llms.replace("## About", () => faqMd + "\n\n## About");
writeFileSync(join(root, "llms.txt"), llms);

/* ---------- llms-ghl-page.html: the same content as a normal web page ----------
   whatahotel.com's DNS is not on Cloudflare, so /llms.txt can't be served on
   pro.whatahotel.com. Publish this as a GoHighLevel page at /llms instead.  */
function inline(md) {
  return esc(md).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}
function mdToHtml(md) {
  const out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } if (list) { out.push(`<${list}>`, ...listItems, `</${list}>`); list = null; listItems = []; } };
  let listItems = [];
  for (const line of md.split("\n")) {
    if (/^<!--.*-->$/.test(line.trim())) continue;
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3}) (.*)/))) { flush(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = line.match(/^> (.*)/))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = line.match(/^- (.*)/)) || (m = line.match(/^\d+\. (.*)/))) { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } const t = /^\d/.test(line) ? "ol" : "ul"; if (list && list !== t) flush(); list = t; listItems.push(`  <li>${inline(m[1])}</li>`); continue; }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.join("\n");
}
{
  const page = read("llms-ghl-page.html");
  const headEnd = page.indexOf("<body>");
  if (headEnd === -1) throw new Error("llms-ghl-page.html: <body> not found");
  const body = `<body>\n<main>\n${mdToHtml(llms)}\n<hr>\n${mdToHtml(full.join("\n")).replace(/<h1>/, "<h1 id=\"full\">")}\n</main>\n</body>\n</html>\n`;
  const head = page.slice(0, headEnd).replace(/<title>[^<]*<\/title>/, "<title>WhataHotel! Homes — villas, residences &amp; Exceptional Homes (llms)</title>")
    .replace(/<link rel="canonical"[^>]*>\n?/, "") .replace("</head>", `<link rel="canonical" href="https://pro.whatahotel.com/llms">\n</head>`);
  writeFileSync(join(root, "llms-ghl-page.html"), head + body);
}

/* ---------- keep the Cloudflare llms Worker in sync ---------- */
let worker = read("cloudflare-llms-worker.js");
worker = worker.replace(/const LLMS_FULL_TXT = .*;\n/, () => `const LLMS_FULL_TXT = ${JSON.stringify(full.join("\n"))};\n`)
               .replace(/const LLMS_TXT = .*;\n/, () => `const LLMS_TXT = ${JSON.stringify(llms)};\n`);
writeFileSync(join(root, "cloudflare-llms-worker.js"), worker);

console.log(`SEO content: ${ALL.length} properties (${HOTELS.length} hotels + ${HOMES.length} homes), ${FAQ.length} FAQs → index.html, llms.txt, llms-full.txt`);
