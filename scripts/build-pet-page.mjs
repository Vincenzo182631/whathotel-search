/*
 * build-pet-page.mjs — writes pet-friendly.html, the standalone "Pet-Friendly Luxury Hotels"
 * page for https://pro.whatahotel.com/pet-friendly (paste into a GoHighLevel Custom Code
 * element, like gohighlevel.html for /homes).
 *
 * Content comes only from WhataHotel:
 *   scripts/pet-collection.json — every hotel on whatahotel.com/collection/pet-friendly-luxury-hotels.html
 *     (name, brand program, country, state/region, city) and its intro paragraphs;
 *   scripts/pet-images.json — each hotel's main photo (og:image of its WhataHotel page);
 *   assets/js/pets.js + data.js + images.js — the Homes-page properties that welcome pets.
 * Every hotel card is written into the HTML (readable without JavaScript and by search
 * engines); a small script adds filters, "show all" per country and dated "View Rates" links.
 *
 * Run: node scripts/build-pet-page.mjs   (part of npm run build)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const load = (...files) => { const sb = { window: {} }; files.forEach((f) => vm.runInNewContext(read(f), sb)); return sb.window; };

const PAGE_URL = "https://pro.whatahotel.com/pet-friendly";
const HOMES_URL = "https://pro.whatahotel.com/homes";
const UTM = "utm_source=pet_friendly_page&utm_medium=referral&utm_campaign=pet_friendly";
const PHONE = "+1-877-782-9281", EMAIL = "Reservations@WhataHotel.com";
const SOCIAL = { instagram: "https://www.instagram.com/whatahotel/", facebook: "https://www.facebook.com/profile.php?id=100064053673563" };
const LOGO = "https://wsrv.nl/?url=ssl:assets.cdn.filesafe.space/fBHK0xDUEFQL6rOoyKnY/media/6a237895da24932f122f104e.png&h=88&output=webp";
const PET_PHOTO = "https://www.whatahotel.com/content/pets_header.jpg";
// Lifestyle photos supplied by WhataHotel! (hosted on its GoHighLevel media library).
const LS = {
  lobby: "https://files.leadconnectorhq.com/file/6b01098bd40dd20617575aae/877f1d18-1cd1-4c3e-b1cc-ae92e81cbd6a-converted.webp",
  golden: "https://files.leadconnectorhq.com/file/6b01098bd50d9db79631edd7/e715f028-c45b-48ef-8e3b-729794a7b9a9-converted.webp",
  cat: "https://files.leadconnectorhq.com/file/6b01098bd40dd20617575ab0/5d01edf7-6db6-4fc9-88ec-65cb9a365f33-converted.webp",
  balconyBed: "https://files.leadconnectorhq.com/file/6b01098bd40dd20617575aaf/9adb1e74-ac6a-44e4-b514-148ca75d044b-converted.webp",
  pool: "https://files.leadconnectorhq.com/file/6b01098bd40dd20617575a8f/1bdfff99-e384-4c05-b6d6-f1a626d72623-converted.webp",
  amenities: "https://files.leadconnectorhq.com/file/6b01098b2c68ebcf4643a45c/d84570e9-5f60-4f57-8fc0-307205dffbfd-converted.webp",
  seaview: "https://files.leadconnectorhq.com/file/6b01098e306ac237513eee2b/e400181f-9977-4f6b-b011-57852e9944e5-converted.webp",
};

const COLL = JSON.parse(read("scripts/pet-collection.json"));
// Same GoHighLevel Inbound Webhook as the Homes "Request Availability" form (and Greg's
// advisor requests): the GHL workflow emails Reservations@WhataHotel.com.
const HOOK = process.env.GHL_WEBHOOK_URL || ((read("index.html").match(/<meta name="wah-ghl-webhook" content="([^"]*)"/) || [])[1] || "");
if (HOOK && !/^https:\/\/(services|backend)\.leadconnectorhq\.com\/hooks\/[A-Za-z0-9_\-\/]+$/.test(HOOK)) throw new Error("GHL webhook URL must look like https://services.leadconnectorhq.com/hooks/…");
if (!HOOK) console.warn("  ! No GHL webhook found — the Ask an advisor form will fall back to email links.");
// Researched pet policies (scripts/fetch-pet-details.mjs). Short facts go on the cards; the
// full policy with quotes and sources loads on demand from assets/js/pet-details.js.
const PD = existsSync(join(root, "scripts/pet-details.json")) ? JSON.parse(read("scripts/pet-details.json")) : {};
const tidy = (v, k) => { v = String(v).replace(/(\d)\.0+(?!\d)/g, "$1").replace(/\s+/g, " ").trim(); return k === "max_pets" && /^(\d+|one|two|three|four)$/i.test(v) ? "Up to " + v.toLowerCase() : v; };
const POL_FIELDS = ["fee", "max_pets", "weight_limit", "species", "deposit", "rooms", "areas", "amenities", "rules", "service_animals"];
{
  const compact = {};
  for (const [id, r] of Object.entries(PD)) {
    const f = {};
    for (const k of POL_FIELDS) if (r[k]) { const e = (r.evidence || []).find((x) => x.field === k) || {}; f[k] = [tidy(r[k], k), Math.max(0, (r.sources || []).findIndex((x) => x.url === e.url)), e.quote || ""]; }
    if (Object.keys(f).length) compact[id] = { c: r.checked, f, s: (r.sources || []).map((x) => [x.url, x.official ? 1 : 0]) };
  }
  writeFileSync(join(root, "assets/js/pet-details.js"), "/* Pet policies researched from hotel and pet-travel websites (scripts/fetch-pet-details.mjs).\n * f: {field: [value, source index, exact quote]}, s: [[url, official 1/0]], c: date checked. AUTO-GENERATED. */\nwindow.WAH_PET_DETAILS = " + JSON.stringify(compact) + ";\n");
}
let PD_URL = process.env.PET_DETAILS_URL || "";
if (!PD_URL) try {
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const sha = git("log", "-1", "--format=%H", "--", "assets/js/pet-details.js");
  git("diff", "--quiet", sha, "--", "assets/js/pet-details.js");
  if (sha) PD_URL = `https://cdn.jsdelivr.net/gh/Vincenzo182631/whathotel-search@${sha}/assets/js/pet-details.js`;
} catch (e) { console.warn("  ! assets/js/pet-details.js has uncommitted changes — commit and push it, then rebuild, so the page can load full policies."); }
const IMAGES = existsSync(join(root, "scripts/pet-images.json")) ? JSON.parse(read("scripts/pet-images.json")) : {};
const W = load("assets/js/data.js", "assets/js/pets.js", "assets/js/images.js");
const PETS = W.WAH_PETS || {};
const PROPS = W.WAH_PROPERTIES || [];
const homesIds = new Set(PROPS.map((p) => p.id));
const homesPetCount = Object.values(PETS).filter((v) => v.ok).length;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// "Autograph Collection under the Marriott Luminous Program" → "Autograph Collection"
const brandOf = (program) => program.split(/\s+under\s+/i)[0].replace(/\s+(programs?|progams?)$/i, "").replace(/[\s,;]+$/, "").replace(/^ALiLa$/, "Alila").trim();
const hotelUrl = (h) => `https://whatahotel.com/hotels/${h.id}/${h.slug}.html?${UTM}`;
// Resized WebP through the same image CDN the Homes page uses.
const img = (url, w, h) => url ? "https://wsrv.nl/?url=" + encodeURIComponent(url.replace(/^https?:\/\//, "").replace(/^whatahotel\.com\//, "www.whatahotel.com/")) + `&w=${w}` + (h ? `&h=${h}&fit=cover` : "") + "&output=webp&q=70" : "";

// <img> for a lifestyle photo: a light resized copy for phones, the original for large screens.
const lsImg = (url, alt, sizes, extra = "") => `<img src="${esc(url)}" srcset="${esc(img(url, 760))} 760w, ${esc(url)} 1600w" sizes="${sizes}" alt="${esc(alt)}" decoding="async" ${extra}>`;
const hotels = COLL.hotels.map((h) => Object.assign({}, h, { brand: brandOf(h.program), photo: IMAGES[h.id] || "" }));
const countries = [];
hotels.forEach((h) => { if (!countries.includes(h.country)) countries.push(h.country); });
const byCountry = Object.fromEntries(countries.map((c) => [c, hotels.filter((h) => h.country === c)]));
const N = hotels.length, NC = countries.length;
const brandCounts = {};
hotels.forEach((h) => { brandCounts[h.brand] = (brandCounts[h.brand] || 0) + 1; });
const brands = Object.keys(brandCounts).sort((a, b) => brandCounts[b] - brandCounts[a] || a.localeCompare(b));
const NB = brands.length;
const hayOf = (h) => [h.name, h.brand, h.city, h.region, h.country].filter(Boolean).join(" ").toLowerCase();

/* ---------- picks for the visual sections (all real hotels from the list) ---------- */
const FLAGSHIP = /four seasons|ritz|st\.? regis|park hyatt|bvlgari|rosewood|peninsula|mandarin|waldorf|edition|langham|six senses|w hotel|\bw\b/i;
function photoFor(test) {
  const list = hotels.filter((h) => h.photo && test(h));
  return list.find((h) => FLAGSHIP.test(h.name)) || list[0] || null;
}
const DESTS = ["New York", "Paris", "London", "San Francisco", "Washington DC", "Chicago", "Rome", "Milan", "Miami", "Mexico City", "Nashville", "Austin"]
  .map((city) => {
    const q = city.toLowerCase();
    const count = hotels.filter((h) => hayOf(h).includes(q)).length;
    const pick = photoFor((h) => (h.city || "").toLowerCase().includes(q));
    return pick && count ? { city, count, pick } : null;
  }).filter(Boolean);
const MARQUEE = ["Four Seasons", "Ritz Carlton Hotels & Resorts", "St. Regis Hotels & Resorts", "Park Hyatt Hotels", "Kimpton Hotels", "W Hotels", "The Luxury Collection",
  "Rosewood Hotels & Resorts", "Bvlgari", "EDITION Hotels", "Waldorf Astoria Hotels", "Six Senses Hotels & Resorts", "Andaz Hotels", "Small Luxury Hotels of The World", "Thompson Hotels"]
  .filter((b) => brandCounts[b]);
const niceBrand = (b) => b.replace(/^Ritz Carlton Hotels & Resorts$/, "The Ritz-Carlton").replace(/ Hotels & Resorts$| Hotels$/, "");
const petHomes = [2706, 4839, 2206, 2760, 3231, 3692].map((id) => PROPS.find((p) => p.id === id))
  .filter((p) => p && PETS[p.id] && PETS[p.id].ok && W.WAH_IMAGES[p.id] && W.WAH_IMAGES[p.id].hero).slice(0, 4);

/* ---------- FAQ: WhataHotel's own statements, answer first ---------- */
const FAQ = [
  ["How many pet-friendly hotels does WhataHotel! offer?",
    `${N} luxury hotels in ${NC} countries welcome pets, from Kimpton and Thompson to Four Seasons, The Ritz-Carlton, St. Regis, Park Hyatt and independent country houses across Europe.`],
  ["Who sets the pet rules, and how do I know they apply to my pet?",
    "Pet rules are set by each hotel, and they change. Before you book, a Lorraine Travel advisor will confirm the details for your pet: the fee, the weight limit, how many pets are allowed and which room types qualify."],
  ["What rate do I pay when I book through WhataHotel!?",
    "You pay the hotel's own rate, with WhataHotel!'s preferred-partner perks added where the hotel offers them."],
  ["Are there pet-friendly villas and residences?",
    `Yes. ${homesPetCount} villas, residences and homes in the WhataHotel! Homes collection welcome pets. Each shows a Pet-friendly tag and its pet policy on the Homes page.`],
  ["How do I book a pet-friendly hotel?",
    `Find the hotel on this page and select View Rates to see live rates for your dates on WhataHotel.com, or contact an advisor at ${EMAIL} or ${PHONE}.`],
];

/* ---------- icons ---------- */
const PAW = '<svg class="pf-paw" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="10" r="2.2"/><circle cx="9.5" cy="5.8" r="2.2"/><circle cx="14.5" cy="5.8" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M12 11.5c-3 0-6 4.3-6 6.5 0 1.6 1.3 2.5 3 2.5 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-.9 3-2.5 0-2.2-3-6.5-6-6.5z"/></svg>';
const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  fee: ic('<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>'),
  weight: ic('<path d="M6.5 8h11l2 11h-15z"/><circle cx="12" cy="5.5" r="2"/><path d="M12 12v3.5l2 1"/>'),
  count: PAW.replace('class="pf-paw" ', ''),
  room: ic('<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v2M21 18v2"/><path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/>'),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  pin: ic('<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  mail: ic('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>'),
  phone: ic('<path d="M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.6 6.6l1.4-2.3 4.5 1.8V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>'),
  arrow: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};
const IG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
const FB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9z"/></svg>';

/* ---------- hotel cards, grouped by country (WhataHotel's order) ---------- */
const short = (v, n = 38) => { v = String(v).replace(/\s+/g, " ").trim(); return v.length > n ? v.slice(0, n - 1).replace(/[\s,;]+\S*$/, "") + "…" : v; };
// Long fee sentences: the first amount and its basis on the card; the full sentence is in the policy panel.
function cardFee(v) {
  if (v.length <= 36) return v;
  const a = v.match(/((?:[A-Z]{1,3}\s?)?[$€£¥฿₹]\s?\d[\d,.]*|\b(?:USD|EUR|GBP|CAD|AUD|AED|CHF|JPY|INR|THB|MXN)\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:USD|EUR|GBP|CAD|AUD|AED|CHF|JPY|INR|THB|MXN|€))/);
  if (!a) return v;
  const b = v.slice(a.index).match(/\b(per (?:pet,? )?(?:night|day|stay|pet|room)|nightly|one[- ]time)\b/i);
  return a[1].trim() + (b ? " " + b[1].toLowerCase() : "") + " …";
}
function polLine(h) {
  const r = PD[h.id]; if (!r) return "";
  const items = [];
  if (r.fee) items.push(["Fee", cardFee(tidy(r.fee, "fee"))]);
  if (r.max_pets) items.push(["Pets", tidy(r.max_pets, "max_pets")]);
  if (r.weight_limit) items.push(["Weight", tidy(r.weight_limit, "weight_limit")]);
  if (!items.length && r.species) items.push(["Pets", r.species]);
  if (!items.length) return "";
  return `<dl class="pf-pol">${items.slice(0, 3).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(short(v))}</dd></div>`).join("")}</dl>`;
}
function card(h) {
  // Text and link only: the page script adds the photo, icons and buttons, which keeps
  // 751 cards under GoHighLevel's 1 MB custom-code limit (and the text stays readable by
  // search engines and without JavaScript).
  const loc = [h.city, h.region && h.region !== h.city ? h.region : ""].filter(Boolean).join(", ");
  const pre = `https://www.whatahotel.com/content/hotels/${h.id}/`;
  const p = !h.photo ? "" : h.photo.startsWith(pre) ? h.photo.slice(pre.length) : h.photo;
  const hasPol = PD[h.id] && POL_FIELDS.some((k) => PD[h.id][k]);
  return `<li class="pf-card" data-id="${h.id}"${p ? ` data-p="${esc(p)}"` : ""}${hasPol ? " data-pol" : ""}><div class="pf-card__body"><span class="pf-card__brand">${esc(h.brand)}</span>` +
    `<h3 class="pf-card__name"><a href="https://whatahotel.com/hotels/${h.id}/${h.slug}.html">${esc(h.name)}</a></h3><p class="pf-card__loc">${esc(loc)}</p>` + polLine(h) +
    `${homesIds.has(h.id) ? `<a class="pf-card__homes" href="${HOMES_URL}">Also villas &amp; residences</a>` : ""}</div></li>`;
}
const countrySection = (c) => `<section class="pf-country" id="${slug(c)}" data-country="${esc(c)}"><div class="pf-country__head"><h2>${esc(c)}</h2><span class="pf-count">${byCountry[c].length} ${byCountry[c].length === 1 ? "hotel" : "hotels"}</span></div>` +
  `<ul class="pf-grid">${byCountry[c].map(card).join("")}</ul><button type="button" class="pf-more" hidden>Show all ${byCountry[c].length} hotels in ${esc(c)}</button></section>`;

/* ---------- structured data ---------- */
const ld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", "@id": PAGE_URL + "#page", url: PAGE_URL, name: "Pet-Friendly Luxury Hotels",
      description: `${N} luxury hotels in ${NC} countries that welcome pets, bookable through WhataHotel! by Lorraine Travel.`,
      isPartOf: { "@type": "WebSite", url: "https://pro.whatahotel.com", name: "WhataHotel!" },
      provider: { "@type": "TravelAgency", name: "WhataHotel! by Lorraine Travel", url: "https://www.whatahotel.com", telephone: PHONE, email: EMAIL },
      primaryImageOfPage: LS.lobby, dateModified: COLL.fetched, mainEntity: { "@id": PAGE_URL + "#hotels" } },
    { "@type": "ItemList", "@id": PAGE_URL + "#hotels", name: "Pet-friendly luxury hotels", numberOfItems: N,
      itemListElement: hotels.map((h, i) => ({ "@type": "ListItem", position: i + 1, item: Object.assign({ "@type": "Hotel", name: h.name,
        url: `https://whatahotel.com/hotels/${h.id}/${h.slug}.html`, petsAllowed: true },
        h.photo ? { image: h.photo } : {},
        { address: Object.assign({ "@type": "PostalAddress", addressLocality: h.city, addressCountry: h.country }, h.region ? { addressRegion: h.region } : {}) }) })) },
    { "@type": "FAQPage", "@id": PAGE_URL + "#faq", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ],
};

const intro = COLL.intro || [];

const CSS = String.raw`
:root{--ink:#0d1b2a;--ink-2:#17293d;--ivory:#f8f5ef;--cream:#f1ebe0;--paper:#fff;--champ:#8f723f;--gold:#c9a96a;--gold-2:#e8d6a8;--sage:#3e5d4c;--mint:#edf2ec;--mint-line:#d4e1d6;
--line:rgba(13,27,42,.1);--hair:rgba(184,151,90,.5);--text:#1d2b39;--soft:#55636f;--mut:#7b8794;
--serif:"Fraunces",Georgia,"Times New Roman",serif;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
--r:14px;--ease:cubic-bezier(.2,.7,.2,1);--shadow:0 1px 2px rgba(13,27,42,.04),0 18px 40px -22px rgba(13,27,42,.28);--shadow-lg:0 40px 80px -36px rgba(13,27,42,.45)}
*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-behavior:smooth}body{margin:0;background:var(--ivory)}
.pf-root{background:var(--ivory);color:var(--text);font:400 16px/1.65 var(--sans);-webkit-font-smoothing:antialiased;text-align:left;overflow-x:clip}
.pf-root p{line-height:1.65;margin:0}.pf-root h1,.pf-root h2,.pf-root h3,.pf-root h4{letter-spacing:normal;text-transform:none;margin:0}
.pf-root a{color:inherit}.pf-root a.pf-btn{color:var(--ink)}.pf-root a.pf-btn--ink{color:var(--ivory)}.pf-root .pf-know__foot a.pf-btn:not(.pf-btn--gold){color:#fff}
.pf-root img{max-width:100%}.pf-root button{font:inherit;cursor:pointer}.pf-root svg{flex:none}.pf-root figure{margin:0}
/* GoHighLevel wraps custom code in a section, row and column with padding: let the page run edge to edge. */
.c-section:has(.pf-root),.c-row:has(.pf-root),.c-column:has(.pf-root),.c-custom-code:has(.pf-root){padding:0!important;margin:0!important;max-width:none!important}
.pf-wrap{width:min(1240px,100% - 48px);margin-inline:auto}
/* type */
.pf-eyebrow{display:inline-flex;align-items:center;gap:.9rem;font:600 .68rem/1 var(--sans);letter-spacing:.3em;text-transform:uppercase;color:var(--champ)}
.pf-eyebrow .pf-paw{width:.95rem;height:.95rem}
.pf-n{display:inline-flex;align-items:center;gap:.9rem;font:italic 400 1.05rem/1 var(--serif);letter-spacing:0;text-transform:none}
.pf-n::after{content:"";width:40px;height:1px;background:currentColor;opacity:.55}
.pf-h2{font:300 clamp(2.3rem,4.8vw,3.75rem)/1.06 var(--serif);color:var(--ink);letter-spacing:-.015em}
.pf-h2 em{font-style:italic;color:var(--champ)}
.pf-lead{color:var(--soft);font-size:1.05rem;max-width:58ch}
.pf-sec{padding:clamp(72px,10vw,136px) 0}.pf-sec--tight{padding-top:clamp(64px,8vw,110px)}
.pf-sec__head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:1.2rem 3rem;margin-bottom:clamp(30px,4vw,48px)}
.pf-sec__head>div{display:grid;gap:1rem;max-width:760px}
/* buttons */
.pf-btn{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;padding:.85rem 1.55rem;border-radius:999px;border:1px solid var(--line);background:transparent;font:600 .74rem/1.2 var(--sans);letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--ink);white-space:nowrap;transition:background .35s var(--ease),color .35s,border-color .35s,transform .35s var(--ease)}
.pf-btn:hover{border-color:var(--gold);transform:translateY(-1px)}.pf-btn svg{width:1rem;height:1rem}
.pf-btn--gold{background:linear-gradient(135deg,#dcc28a,#c4a265);border-color:transparent;color:var(--ink)}.pf-btn--gold:hover{background:linear-gradient(135deg,#e6d09c,#cdab6e)}
.pf-btn--ink{background:var(--ink);border-color:var(--ink);color:var(--ivory)}.pf-btn--ink:hover{background:var(--ink-2);border-color:var(--gold)}
.pf-link{font:600 .74rem/1.2 var(--sans);letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--ink);padding-bottom:.35rem;border-bottom:1px solid var(--hair)}
.pf-link:hover{border-color:var(--ink)}
.pf-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border-radius:999px;border:1px solid var(--line);background:transparent;font:500 .8rem/1.1 var(--sans);letter-spacing:.04em;color:var(--ink);text-decoration:none;transition:background .3s,color .3s,border-color .3s}
.pf-chip:hover,.pf-chip.is-on{background:var(--ink);border-color:var(--ink);color:#fff}.pf-chip b{font-weight:500;opacity:.55}
/* header */
.pf-header{position:sticky;top:0;z-index:30;background:rgba(248,245,239,.9);backdrop-filter:saturate(1.3) blur(16px);-webkit-backdrop-filter:saturate(1.3) blur(16px);border-bottom:1px solid var(--line);transition:box-shadow .4s}
.pf-header.is-stuck{box-shadow:0 10px 30px -24px rgba(13,27,42,.5)}
.pf-header__in{display:flex;align-items:center;gap:1.4rem;min-height:76px}.pf-logo img{display:block;height:30px;width:auto}
.pf-nav{display:flex;gap:2rem;margin-left:auto;font:500 .72rem/1 var(--sans);letter-spacing:.18em;text-transform:uppercase}.pf-nav a{text-decoration:none;color:var(--soft);transition:color .3s}.pf-nav a:hover{color:var(--ink)}
/* hero */
.pf-hero{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:min(92vh,900px);color:#fff;background:var(--ink);overflow:hidden;isolation:isolate}
.pf-hero__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:47% 42%;z-index:-2;animation:pf-zoom 2.8s var(--ease) both}
@keyframes pf-zoom{from{transform:scale(1.08)}}
.pf-hero__shade{position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse 60% 45% at 50% 62%,rgba(8,14,22,.38),rgba(8,14,22,0) 70%),linear-gradient(180deg,rgba(8,14,22,.3) 0%,rgba(8,14,22,.1) 28%,rgba(8,14,22,.5) 55%,rgba(8,14,22,.9) 100%)}
.pf-hero__in{display:grid;justify-items:center;text-align:center;padding:clamp(110px,14vh,170px) 0 clamp(40px,6vh,64px)}
.pf-kicker{display:inline-flex;align-items:center;gap:1rem;text-shadow:0 1px 12px rgba(0,0,0,.6);font:600 .68rem/1 var(--sans);letter-spacing:.34em;text-transform:uppercase;color:var(--gold-2)}
.pf-kicker::before,.pf-kicker::after{content:"";width:44px;height:1px;background:currentColor;opacity:.6}
.pf-hero h1{font:300 clamp(3rem,7.6vw,6.4rem)/.98 var(--serif);letter-spacing:-.025em;margin:1.4rem 0 1.3rem;color:#fff;text-shadow:0 2px 30px rgba(0,0,0,.25)}
.pf-hero h1 em{font-style:italic;color:var(--gold-2)}
.pf-hero__sub{text-shadow:0 1px 14px rgba(0,0,0,.45);font-size:clamp(1.02rem,1.5vw,1.2rem);color:rgba(255,255,255,.88);max-width:46ch}
.pf-find{display:flex;align-items:center;gap:.4rem;width:min(640px,100%);margin:2.2rem 0 1.1rem;padding:.4rem .4rem .4rem 1.3rem;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.38);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:background .3s,border-color .3s}
.pf-find:focus-within{background:rgba(255,255,255,.22);border-color:var(--gold-2)}
.pf-find svg{width:19px;height:19px;color:var(--gold-2)}
.pf-find input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;padding:.8rem .3rem;color:#fff}
.pf-find input::placeholder{color:rgba(255,255,255,.78)}
.pf-find .pf-btn{padding:.95rem 1.6rem}
.pf-quick{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem}
.pf-hero .pf-chip{border-color:rgba(255,255,255,.35);color:#fff;background:rgba(255,255,255,.06);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pf-hero .pf-chip:hover,.pf-hero .pf-chip.is-on{background:#fff;color:var(--ink);border-color:#fff}
.pf-hero__stats{border-top:1px solid rgba(255,255,255,.18);background:rgba(8,14,22,.32);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.pf-hero__stats .pf-wrap{display:grid;grid-template-columns:repeat(4,1fr)}
.pf-hero__stats span{display:grid;justify-items:center;gap:.35rem;padding:1.3rem .5rem;font:500 .64rem/1 var(--sans);letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.7)}
.pf-hero__stats span+span{border-left:1px solid rgba(255,255,255,.14)}
.pf-hero__stats b{font:300 clamp(1.6rem,2.6vw,2.2rem)/1 var(--serif);letter-spacing:0;color:#fff}
/* brand strip */
.pf-marquee{background:var(--ivory);border-bottom:1px solid var(--line);overflow:hidden;padding:1.3rem 0;-webkit-mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.pf-marquee__track{display:flex;gap:3.2rem;width:max-content;animation:pf-scroll 60s linear infinite}
.pf-marquee:hover .pf-marquee__track{animation-play-state:paused}
.pf-marquee button{display:inline-flex;align-items:center;gap:3.2rem;border:0;background:none;padding:0;font:italic 300 1.4rem/1 var(--serif);color:var(--ink);white-space:nowrap;opacity:.62;transition:opacity .3s,color .3s}
.pf-marquee button:hover{opacity:1;color:var(--champ)}.pf-marquee button::after{content:"";width:5px;height:5px;transform:rotate(45deg);background:var(--gold);opacity:.8}
@keyframes pf-scroll{to{transform:translateX(-50%)}}
/* 01 story */
.pf-story__grid{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(40px,7vw,110px);align-items:center}
.pf-story__pics{position:relative;padding:0 0 16% 0}
.pf-story__a{width:80%;aspect-ratio:4/5;border-radius:999px 999px 10px 10px;overflow:hidden;box-shadow:var(--shadow-lg)}
.pf-story__a img,.pf-story__b img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.6s var(--ease)}
.pf-story__a img{object-position:62% center}.pf-story__pics:hover img{transform:scale(1.04)}
.pf-story__b{position:absolute;right:0;bottom:0;width:50%;aspect-ratio:1;border-radius:10px;overflow:hidden;border:10px solid var(--ivory);box-shadow:var(--shadow-lg)}
.pf-story__b img{object-position:70% center}
.pf-seal{position:absolute;left:62%;top:6%;display:grid;place-items:center;align-content:center;gap:.15rem;width:118px;height:118px;border-radius:50%;background:var(--ink);color:var(--gold-2);text-align:center;font:600 .58rem/1 var(--sans);letter-spacing:.26em;text-transform:uppercase;box-shadow:var(--shadow-lg);border:1px solid var(--hair)}
.pf-seal em{font:italic 300 1.35rem/1 var(--serif);letter-spacing:0;text-transform:none;color:#fff}.pf-seal .pf-paw{width:1.1rem;height:1.1rem;margin-bottom:.2rem}
.pf-story__txt{display:grid;gap:1.4rem}
.pf-ticks{list-style:none;margin:.4rem 0 0;padding:0;display:grid;gap:.75rem}
.pf-ticks li{display:flex;gap:.9rem;align-items:baseline;color:var(--text);font-size:.98rem}
.pf-ticks li::before{content:"";flex:none;width:7px;height:7px;transform:translateY(-2px) rotate(45deg);border:1px solid var(--gold)}
.pf-story__cta{display:flex;flex-wrap:wrap;align-items:center;gap:1.6rem;margin-top:.8rem}
/* 02 destinations */
.pf-dest-nav{display:flex;align-items:end;gap:1.8rem}.pf-arrows{display:flex;gap:.6rem}
.pf-arrow{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);transition:background .3s,color .3s,border-color .3s}
.pf-arrow:hover{background:var(--ink);color:#fff;border-color:var(--ink)}.pf-arrow svg{width:18px;height:18px}.pf-arrow[data-dir="-1"] svg{transform:rotate(180deg)}
.pf-dests{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(230px,23.5%,300px);gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 24px 20px;margin:0 -24px;scrollbar-width:none}
.pf-dests::-webkit-scrollbar{display:none}
.pf-dest{position:relative;scroll-snap-align:start;height:380px;border-radius:var(--r);overflow:hidden;border:0;padding:0;background:var(--ink);text-align:left;color:#fff}
.pf-dest img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1.4s var(--ease)}
.pf-dest::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,14,22,0) 45%,rgba(8,14,22,.85))}
.pf-dest:hover img{transform:scale(1.06)}
.pf-dest__t{position:absolute;z-index:1;left:22px;right:22px;bottom:20px}.pf-dest__t b{display:block;font:300 1.8rem/1.05 var(--serif)}
.pf-dest__t span{display:inline-flex;align-items:center;gap:.45rem;margin-top:.55rem;font:500 .64rem/1 var(--sans);letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.pf-dest__t .pf-paw{width:.85rem;height:.85rem;color:var(--gold-2)}
/* sea-view band */
.pf-band{position:relative;display:grid;align-items:center;min-height:clamp(440px,68vh,680px);overflow:hidden;color:#fff;background:var(--ink);isolation:isolate}
.pf-band__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:40% 50%;z-index:-2;transform:scale(1.06);transition:transform 2.4s var(--ease)}
.pf-band.is-in .pf-band__bg,.pf-band:hover .pf-band__bg{transform:scale(1)}
.pf-band__shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(8,14,22,.05) 0%,rgba(8,14,22,.25) 45%,rgba(8,14,22,.72) 100%)}
.pf-band__in{display:grid;justify-items:end;text-align:right;gap:1.2rem}
.pf-rule{width:56px;height:1px;background:var(--gold-2)}
.pf-root .pf-band__q{font:300 clamp(2.5rem,5.8vw,4.8rem)/1.02 var(--serif);letter-spacing:-.02em;max-width:12ch;text-shadow:0 2px 30px rgba(0,0,0,.25)}
.pf-band__q em{font-style:italic;color:var(--gold-2)}
.pf-band__s{max-width:38ch;color:rgba(255,255,255,.85);font-size:1.04rem}
/* 03 before you book */
.pf-know{position:relative;overflow:hidden;background:var(--ink);color:#fff;border-radius:28px;padding:clamp(36px,6vw,80px)}
.pf-know::before{content:"";position:absolute;left:-160px;bottom:-200px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(201,169,106,.18),rgba(201,169,106,0) 70%)}
.pf-know .pf-h2{color:#fff}.pf-know .pf-h2 em{color:var(--gold-2)}.pf-know .pf-lead{color:rgba(255,255,255,.72)}.pf-know .pf-eyebrow{color:var(--gold-2)}
.pf-know__top{position:relative;display:grid;grid-template-columns:1fr .92fr;gap:clamp(32px,5vw,72px);align-items:center}
.pf-know__pic{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:4/3.2;box-shadow:0 40px 80px -40px rgba(0,0,0,.7)}
.pf-know__pic img{width:100%;height:100%;object-fit:cover;display:block}
.pf-know__pic figcaption{position:absolute;left:14px;right:14px;bottom:14px;padding:.6rem .9rem;border-radius:10px;background:rgba(8,14,22,.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:italic 300 .92rem/1.4 var(--serif);color:rgba(255,255,255,.9)}
.pf-know__grid{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(18px,3vw,36px);margin-top:clamp(36px,5vw,60px)}
.pf-know__item{padding-top:1.3rem;border-top:1px solid rgba(232,214,168,.3)}
.pf-know__item i{display:block;color:var(--gold-2);margin-bottom:.9rem}.pf-know__item i svg{width:26px;height:26px}
.pf-know__item b{display:block;font:400 1.3rem/1.2 var(--serif);margin-bottom:.4rem;color:#fff}.pf-know__item p{font-size:.9rem;color:rgba(255,255,255,.62)}
.pf-know__foot{position:relative;display:flex;flex-wrap:wrap;gap:.9rem;align-items:center;margin-top:clamp(30px,4vw,48px)}
.pf-know__foot .pf-btn:not(.pf-btn--gold){color:#fff;border-color:rgba(255,255,255,.28)}
/* 04 collection */
.pf-tools{position:sticky;top:76px;z-index:20;background:rgba(248,245,239,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);padding:.9rem 0;border-block:1px solid var(--line)}
.pf-tools__in{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
.pf-search{flex:1 1 300px;display:flex;align-items:center;gap:.6rem;background:#fff;border:1px solid var(--line);border-radius:999px;padding:0 1.15rem;transition:border-color .3s,box-shadow .3s}
.pf-search:focus-within{border-color:var(--gold);box-shadow:0 0 0 4px rgba(201,169,106,.16)}.pf-search svg{width:18px;height:18px;color:var(--champ)}
.pf-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;padding:.8rem 0;color:var(--ink)}
.pf-select{flex:0 1 220px;min-width:0;font:inherit;font-size:16px;padding:.78rem 2.4rem .78rem 1.1rem;border:1px solid var(--line);border-radius:999px;color:var(--ink);appearance:none;-webkit-appearance:none;
background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238f723f' stroke-width='1.8'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") right 1rem center/15px no-repeat}
.pf-shown{font-size:.86rem;color:var(--mut);white-space:nowrap;letter-spacing:.02em}.pf-shown b{font:400 1.15rem var(--serif);color:var(--ink)}
.pf-reset{border:0;background:none;color:var(--champ);font:600 .72rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;padding:.5rem}.pf-reset:hover{color:var(--ink)}
.pf-countries{display:flex;flex-wrap:wrap;gap:.5rem;margin:1.8rem 0 0}
.pf-country{margin-top:clamp(44px,6vw,72px);scroll-margin-top:160px}
.pf-country__head{display:flex;align-items:baseline;gap:1rem;margin-bottom:1.4rem}
.pf-country__head::after{content:"";flex:1;height:1px;background:var(--line);transform:translateY(-6px)}
.pf-country__head h2{font:300 clamp(1.8rem,3.2vw,2.5rem)/1.1 var(--serif);color:var(--ink);letter-spacing:-.01em}
.pf-count{font:italic 300 1.05rem var(--serif);color:var(--champ);white-space:nowrap}
.pf-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px}
.pf-card{display:flex;flex-direction:column;background:#fff;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);transition:transform .6s var(--ease),box-shadow .6s var(--ease),border-color .6s}
.pf-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg);border-color:transparent}
.pf-card__img{position:relative;aspect-ratio:4/3;background:linear-gradient(135deg,var(--cream),var(--mint));overflow:hidden}
.pf-card__img img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .7s,transform 1.4s var(--ease)}
.pf-card__img img.is-in{opacity:1}.pf-card:hover .pf-card__img img{transform:scale(1.06)}
.pf-card__ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--champ);opacity:.4}.pf-card__ph .pf-paw{width:44px;height:44px}
.pf-card__pet{position:absolute;left:14px;top:14px;display:inline-flex;align-items:center;gap:.4rem;padding:.42rem .75rem;border-radius:999px;background:rgba(248,245,239,.94);color:var(--ink);font:600 .58rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase}
.pf-card__pet .pf-paw{width:.8rem;height:.8rem;color:var(--champ)}
.pf-card__body{flex:1;display:flex;flex-direction:column;gap:.45rem;padding:1.3rem 1.35rem 0}
.pf-card__brand{font:600 .6rem/1.4 var(--sans);letter-spacing:.22em;text-transform:uppercase;color:var(--champ)}
.pf-card__name{font:400 1.28rem/1.22 var(--serif)!important;color:var(--ink);letter-spacing:-.005em}.pf-card__name a{text-decoration:none}.pf-card__name a:hover{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}
.pf-card__loc{display:flex;align-items:center;gap:.4rem;font-size:.84rem;color:var(--mut)}.pf-card__loc svg{width:14px;height:14px;color:var(--champ)}
.pf-card__homes{align-self:flex-start;margin-top:.2rem;padding:.3rem .65rem;border-radius:999px;background:var(--mint);color:var(--sage);font:600 .6rem/1.2 var(--sans);letter-spacing:.14em;text-transform:uppercase;text-decoration:none}
.pf-card__ask{align-self:flex-start;margin-top:.35rem;padding:0 0 .15rem;border:0;border-bottom:1px solid var(--hair);background:none;color:var(--ink);font:500 .8rem/1.3 var(--sans);cursor:pointer;transition:border-color .3s,color .3s}
.pf-card__ask:hover{color:var(--champ);border-color:var(--champ)}
.pf-card__act{display:grid;grid-template-columns:1fr 1fr;gap:.55rem;padding:1.2rem 1.35rem 1.35rem;margin-top:auto}
.pf-card__act .pf-btn{padding:.75rem .5rem;font-size:.66rem}
.pf-more{display:flex;align-items:center;gap:.6rem;margin:1.6rem auto 0;padding:.9rem 1.8rem;border-radius:999px;border:1px solid var(--ink);background:transparent;color:var(--ink);font:600 .72rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;transition:background .3s,color .3s}
.pf-more:hover{background:var(--ink);color:#fff}
.pf-empty{margin:2.6rem 0;padding:2.2rem;border-radius:var(--r);background:#fff;border:1px dashed var(--hair);text-align:center;color:var(--soft)}
.pf-filtering .pf-countries{display:none}
/* 05 homes */
#homes{background:var(--cream);margin-top:clamp(72px,10vw,136px)}
.pf-homes{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,7vw,110px);align-items:center}.pf-homes__pics img{background:var(--ivory)}
.pf-homes__hero{aspect-ratio:4/5;border-radius:999px 999px 10px 10px;overflow:hidden;box-shadow:var(--shadow-lg)}
.pf-homes__hero img{width:100%;height:100%;object-fit:cover;object-position:36% center;display:block;transition:transform 1.6s var(--ease)}.pf-homes__hero:hover img{transform:scale(1.04)}
.pf-homes__pics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:1.8rem 0 2rem}
.pf-homes__pics a{display:grid;gap:.5rem;text-decoration:none}
.pf-homes__pics img{width:100%;height:auto;aspect-ratio:7/5;object-fit:cover;display:block;border-radius:10px;transition:opacity .3s}.pf-homes__pics a:hover img{opacity:.85}
.pf-homes__pics span{font:400 .95rem/1.3 var(--serif);color:var(--ink)}
/* 06 faq */
.pf-faq{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(36px,6vw,96px);align-items:start}
.pf-advisor{margin-top:2rem;padding:1.8rem;border-radius:var(--r);background:var(--ink);color:#fff;display:grid;gap:.8rem;border-top:2px solid var(--gold)}
.pf-advisor b{font:300 1.6rem/1.15 var(--serif);color:#fff}.pf-advisor p{color:rgba(255,255,255,.7);font-size:.92rem}
.pf-advisor a{display:flex;align-items:center;gap:.7rem;text-decoration:none;font-weight:500;color:#fff}.pf-advisor a svg{width:19px;height:19px;color:var(--gold-2)}
.pf-advisor a:not(.pf-btn):hover{color:var(--gold-2)}
.pf-qa details{border-bottom:1px solid var(--line);padding:1.45rem 0}.pf-qa details:first-child{border-top:1px solid var(--line)}
.pf-qa summary{display:flex;justify-content:space-between;align-items:center;gap:1.2rem;cursor:pointer;list-style:none}.pf-qa summary::-webkit-details-marker{display:none}
.pf-qa summary h3{font:400 1.28rem/1.35 var(--serif)!important;color:var(--ink)}
.pf-qa summary::after{content:"";flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--hair);background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238f723f' stroke-width='1.5'%3E%3Cpath d='M12 6v12M6 12h12'/%3E%3C/svg%3E") center/14px no-repeat;transition:transform .4s var(--ease)}
.pf-qa details[open] summary::after{transform:rotate(45deg)}.pf-qa details p{margin-top:.8rem;color:var(--soft)}
/* footer */
.pf-footer{background:#09131e;color:rgba(244,239,230,.66);padding:clamp(56px,7vw,88px) 0 2.2rem;font-size:.9rem}
.pf-footer__in{display:grid;grid-template-columns:1.4fr 1fr auto;gap:2.4rem;align-items:start}
.pf-footer a{color:#fff;text-decoration:none}.pf-footer a:hover{color:var(--gold-2)}.pf-footer b{color:#fff;font:300 1.7rem/1.15 var(--serif);display:block;margin-bottom:.7rem}
.pf-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:.55rem}
.pf-social{display:flex;gap:.7rem}.pf-social a{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;border:1px solid rgba(232,214,168,.3);transition:background .3s,border-color .3s}.pf-social a:hover{background:rgba(255,255,255,.06);border-color:var(--gold-2)}.pf-social svg{width:18px;height:18px}
.pf-legal{margin-top:2.8rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.08);font-size:.78rem;color:rgba(244,239,230,.45)}
/* researched pet policy: card facts + full policy panel */
.pf-pol{display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:.2rem 1.1rem;margin:.55rem 0 .1rem;padding:.65rem 0 0;border-top:1px solid var(--line)}
.pf-pol div{min-width:0}.pf-pol dt{font:600 .56rem/1.2 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--mut)}
.pf-pol dd{margin:.15rem 0 0;font:400 .92rem/1.25 var(--serif);color:var(--ink)}
.pf-card__links{display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;margin-top:.35rem}
.pf-polbox{width:min(720px,100%);padding-top:clamp(28px,4vw,42px)}
.pf-polrow{display:grid;grid-template-columns:150px 1fr;gap:.3rem 1.2rem;padding:1rem 0;border-top:1px solid var(--line)}
.pf-polrow:first-child{border-top:0}
.pf-polrow dt{font:600 .62rem/1.4 var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--champ);padding-top:.25rem}
.pf-polrow dd{margin:0}.pf-polrow b{display:block;font:400 1.08rem/1.35 var(--serif);color:var(--ink)}
.pf-polrow q{display:block;margin-top:.35rem;font:italic 300 .9rem/1.5 var(--serif);color:var(--soft);quotes:"“" "”"}
.pf-polnote{margin:1.2rem 0 0!important;padding:.85rem 1rem;border-radius:12px;background:#fff;border:1px solid var(--hair);font-size:.86rem;color:var(--soft)}
.pf-polact{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.4rem}
@media (max-width:600px){.pf-polrow{grid-template-columns:1fr;gap:.2rem}.pf-polbox{padding-top:30px}}
/* ask-an-advisor form (moved to <body> by the script, so it carries its own base styles) */
.pf-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;font:400 16px/1.55 var(--sans);color:var(--text);text-align:left;-webkit-font-smoothing:antialiased}
.pf-modal *{box-sizing:border-box}.pf-modal p{margin:0}.pf-modal h2{margin:0;letter-spacing:normal;text-transform:none}.pf-modal figure{margin:0}
.pf-modal__bg{position:absolute;inset:0;background:rgba(8,14,22,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:pf-fade .3s ease}
.pf-modal__box{position:relative;width:min(660px,100%);max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow:auto;overscroll-behavior:contain;background:var(--ivory);border-radius:24px;padding:0 clamp(24px,4vw,42px) clamp(24px,4vw,40px);box-shadow:0 50px 100px -40px rgba(0,0,0,.6);animation:pf-pop .45s var(--ease)}
@keyframes pf-fade{from{opacity:0}}@keyframes pf-pop{from{opacity:0;transform:translateY(20px) scale(.98)}}
.pf-modal .pf-modal__pic{height:200px;margin:0 calc(-1 * clamp(24px,4vw,42px)) 1.6rem;overflow:hidden;position:relative}
.pf-modal__pic::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,14,22,0) 55%,rgba(248,245,239,.95))}
.pf-modal__pic img{width:100%;height:100%;object-fit:cover;object-position:60% 38%;display:block}
.pf-modal__x{position:absolute;right:14px;top:14px;z-index:2;width:42px;height:42px;border-radius:50%;border:0;background:rgba(248,245,239,.92);font:300 26px/1 var(--sans);color:var(--ink);cursor:pointer;transition:background .3s,color .3s}
.pf-modal__x:hover{background:var(--ink);color:#fff}
.pf-modal .pf-eyebrow{font-size:.64rem}
.pf-modal__h{font:300 clamp(1.9rem,4.4vw,2.6rem)/1.08 var(--serif)!important;color:var(--ink);margin:.8rem 0 .7rem!important;letter-spacing:-.01em}
.pf-modal__lead{color:var(--soft);font-size:.95rem}
#pf-ask-form{display:grid;grid-template-columns:1fr 1fr;gap:16px 14px;margin-top:1.6rem}
.pf-f{display:grid;gap:.35rem;min-width:0}.pf-f--full{grid-column:1 / -1}
.pf-f label,.pf-pet legend{font:600 .66rem/1.3 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}.pf-f label i{color:#b0573a;font-style:normal}.pf-f label span{font-weight:500;color:var(--mut);letter-spacing:.08em;text-transform:none}
.pf-f input,.pf-f select,.pf-f textarea{width:100%;font:inherit;font-size:16px;padding:.75rem .95rem;border:1px solid rgba(13,27,42,.14);border-radius:12px;background:#fff;color:var(--ink);outline:0;margin:0;box-shadow:none;height:auto}
.pf-f input:focus,.pf-f select:focus,.pf-f textarea:focus{border-color:var(--gold);box-shadow:0 0 0 4px rgba(201,169,106,.16)}
.pf-f textarea{resize:vertical;min-height:84px}.pf-f input[type=date]{min-width:0;max-width:100%;-webkit-appearance:none;appearance:none;min-height:48px;display:block}
.pf-f small{font-size:.78rem;color:#b0573a}.pf-f small:empty{display:none}
.pf-f.is-bad input,.pf-f.is-bad select{border-color:#c8735a}
.pf-pet{display:grid;grid-template-columns:1fr .7fr 1fr;gap:12px;margin:0;padding:16px;border:1px solid var(--hair);border-radius:16px;background:#fff}
.pf-pet legend{display:inline-flex;align-items:center;gap:.45rem;padding:0 .5rem;color:var(--champ)}.pf-pet legend .pf-paw{width:.95rem;height:.95rem}
.pf-consent label{display:flex;gap:.65rem;align-items:flex-start;font:400 .86rem/1.5 var(--sans);letter-spacing:0;text-transform:none;color:var(--soft);cursor:pointer}
.pf-consent input{width:18px;height:18px;margin:.15rem 0 0;flex:none;accent-color:var(--ink);padding:0}
.pf-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.pf-form-err{grid-column:1 / -1;padding:.85rem 1rem;border-radius:12px;background:#fbece6;color:#8a3a22;font-size:.9rem}.pf-form-err a{color:inherit;font-weight:600}
.pf-submit{grid-column:1 / -1;padding:1.05rem 1.4rem!important;font-size:.78rem!important}.pf-submit[disabled]{opacity:.7;cursor:progress}
.pf-modal__alt{grid-column:1 / -1;text-align:center;font-size:.84rem;color:var(--mut)}.pf-modal__alt a{color:var(--ink);font-weight:500}
.pf-ok{text-align:center;display:grid;justify-items:center;gap:.5rem;padding:.5rem 0 .5rem}
.pf-ok__ic{display:grid;place-items:center;width:68px;height:68px;border-radius:50%;background:var(--ink);color:var(--gold-2)}.pf-ok__ic .pf-paw{width:30px;height:30px}
.pf-ok__ref{font-size:.82rem;letter-spacing:.06em;color:var(--mut);margin:.3rem 0 1.1rem!important}
html.pf-lock,html.pf-lock body{overflow:hidden}
/* paw-print section transition (overlay appended to <body>) */
.pf-trans{position:fixed;inset:0;z-index:2147482000;pointer-events:none;opacity:0;visibility:hidden;background:rgba(248,245,239,.94);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:opacity .35s ease,visibility 0s linear .35s}
.pf-trans.is-on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .3s ease}
.pf-trans__paw{position:absolute;width:32px;height:32px;color:#b8975a;opacity:0;transform:rotate(90deg) scale(.5);animation:pf-step .9s cubic-bezier(.2,.7,.2,1) forwards}
.pf-trans__paw svg{width:100%;height:100%;display:block}
@keyframes pf-step{0%{opacity:0;transform:rotate(90deg) scale(.5)}22%{opacity:1;transform:rotate(90deg) scale(1.08)}38%{transform:rotate(90deg) scale(1)}70%{opacity:.85}100%{opacity:.15;transform:rotate(90deg) scale(1)}}
.pf-trans__label{position:absolute;left:0;right:0;top:calc(46% + 58px);text-align:center;font:italic 300 clamp(1.3rem,3vw,1.9rem)/1.2 "Fraunces",Georgia,serif;color:#0d1b2a;opacity:0;animation:pf-label .5s ease .15s forwards}
@keyframes pf-label{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pf-trans{display:none}}
/* reveal */
.pf-js .pf-rv{opacity:0;transform:translateY(26px);transition:opacity 1.1s var(--ease),transform 1.1s var(--ease)}
.pf-js .pf-rv.is-in{opacity:1;transform:none}
.pf-js .pf-hero .pf-rv{transition-duration:1.4s}.pf-js .pf-hero .pf-rv:nth-child(2){transition-delay:.12s}.pf-js .pf-hero .pf-rv:nth-child(3){transition-delay:.24s}.pf-js .pf-hero .pf-rv:nth-child(4){transition-delay:.36s}.pf-js .pf-hero .pf-rv:nth-child(5){transition-delay:.48s}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.pf-js .pf-rv{opacity:1;transform:none}html{scroll-behavior:auto}}
/* responsive */
@media (max-width:1000px){.pf-story__grid,.pf-homes,.pf-faq,.pf-know__top{grid-template-columns:1fr}.pf-know__grid{grid-template-columns:1fr 1fr}.pf-footer__in{grid-template-columns:1fr 1fr}
.pf-story__pics{max-width:560px}.pf-homes__hero{aspect-ratio:4/3.4;border-radius:180px 180px 10px 10px}}
@media (max-width:700px){.pf-wrap{width:calc(100% - 32px)}.pf-nav{display:none}.pf-header__in{min-height:62px;justify-content:space-between}.pf-logo img{height:25px}.pf-header .pf-btn{padding:.65rem 1rem;font-size:.64rem}
.pf-hero{min-height:calc(100svh - 62px)}.pf-hero__in{padding:90px 0 34px}.pf-hero h1{font-size:clamp(2.7rem,12vw,3.4rem)}.pf-kicker{font-size:.58rem;letter-spacing:.26em;gap:.6rem}.pf-kicker::before,.pf-kicker::after{width:22px}.pf-kicker__a{display:none}
.pf-find{margin-top:1.6rem}.pf-find .pf-btn span{display:none}.pf-find .pf-btn{padding:.85rem}.pf-hero .pf-chip{padding:.42rem .8rem;font-size:.76rem}
.pf-hero__stats .pf-wrap{grid-template-columns:repeat(4,1fr);width:100%}.pf-hero__stats span{padding:1rem .2rem;font-size:.5rem;letter-spacing:.16em}.pf-hero__stats b{font-size:1.45rem}
.pf-marquee button{font-size:1.15rem}
.pf-seal{width:92px;height:92px;left:58%}.pf-seal em{font-size:1.1rem}
.pf-dests{grid-auto-columns:74%;padding-inline:16px;margin-inline:-16px}.pf-dest{height:330px}.pf-arrows{display:none}
.pf-band{min-height:440px}.pf-band__shade{background:linear-gradient(180deg,rgba(8,14,22,.1) 20%,rgba(8,14,22,.78) 100%)}.pf-band__in{justify-items:start;text-align:left;align-self:end;padding-bottom:40px}.pf-band__bg{object-position:30% 50%}
.pf-know{border-radius:22px;padding:30px 22px}.pf-know__grid{grid-template-columns:1fr 1fr;gap:22px 16px}.pf-know__item b{font-size:1.1rem}
.pf-tools{position:static;padding:.7rem 0}.pf-search{flex-basis:100%}.pf-select{flex:1 1 0;padding:.7rem 2.1rem .7rem .95rem}.pf-shown{flex:1}
.pf-grid{grid-template-columns:1fr;gap:14px}
.pf-root:not(.pf-filtering) .pf-country:not(.is-open) .pf-grid{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:82%;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:2px 16px 12px;scroll-padding:0 16px;scrollbar-width:none}
.pf-root:not(.pf-filtering) .pf-country:not(.is-open) .pf-grid::-webkit-scrollbar{display:none}
.pf-root:not(.pf-filtering) .pf-country:not(.is-open) .pf-card{scroll-snap-align:start}
.pf-country{scroll-margin-top:76px}.pf-country__head::after{display:none}
.pf-homes__hero{border-radius:140px 140px 10px 10px}.pf-footer__in{grid-template-columns:1fr}}
@media (max-width:600px){.pf-modal{padding:0;place-items:end stretch}.pf-modal__box{width:100%;max-height:94vh;max-height:94dvh;border-radius:22px 22px 0 0;padding:0 18px calc(22px + env(safe-area-inset-bottom))}
.pf-modal .pf-modal__pic{height:150px;margin:0 -18px 1.2rem}
#pf-ask-form{grid-template-columns:1fr 1fr;gap:13px}.pf-f:not(.pf-f--full):nth-of-type(n+4){grid-column:1 / -1}.pf-pet{grid-template-columns:1fr 1fr}.pf-pet .pf-f:last-child{grid-column:1 / -1}}
`;

const JS = String.raw`(function(){"use strict";
var D=document,root=D.querySelector(".pf-root");root.classList.add("pf-js");
try{if(!(window.CSS&&CSS.supports&&CSS.supports("selector(:has(*))"))){var e=root;while(e&&e.parentElement&&e.parentElement!==D.body){e=e.parentElement;if(/\bc-(section|row|column|custom-code)\b/.test(e.className)){e.style.padding="0";e.style.margin="0";e.style.maxWidth="none"}}}}catch(x){}
var UTM="__UTM__",LIMIT=6,hd=D.querySelector(".pf-header");
function pad(n){return(n<10?"0":"")+n}function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
var a=new Date();a.setDate(a.getDate()+21);var b=new Date();b.setDate(b.getDate()+23);
function link(cls,href,label){var x=D.createElement("a");x.className=cls;x.href=href;x.target="_blank";x.rel="noopener";x.textContent=label;return x}
function norm(s){s=String(s||"").toLowerCase();return s.normalize?s.normalize("NFD").replace(/[̀-ͯ]/g,""):s}
var cards=[].slice.call(D.querySelectorAll(".pf-card")),secs=[].slice.call(D.querySelectorAll(".pf-country"));
var PAWH=root.querySelector(".pf-paw").outerHTML,PINH=D.getElementById("pf-pin").innerHTML;
cards.forEach(function(li){var nm=li.querySelector(".pf-card__name a"),id=li.getAttribute("data-id"),p=li.getAttribute("data-p"),body=li.querySelector(".pf-card__body");
 nm.href=nm.href+(nm.href.indexOf("?")<0?"?":"&")+UTM;nm.target="_blank";nm.rel="noopener";
 var box=D.createElement("div");box.className="pf-card__img";
 if(p){var src=/^https?:/.test(p)?p:"https://www.whatahotel.com/content/hotels/"+id+"/"+p;var im=D.createElement("img");
  im.src="https://wsrv.nl/?url="+encodeURIComponent(src.replace(/^https?:\/\//,""))+"&w=640&h=440&fit=cover&output=webp&q=70";im.alt=nm.textContent;im.loading="lazy";im.decoding="async";im.width=640;im.height=440;box.appendChild(im)}
 else box.innerHTML='<span class="pf-card__ph">'+PAWH+"</span>";
 box.insertAdjacentHTML("beforeend",'<span class="pf-card__pet">'+PAWH+"Pets welcome</span>");li.insertBefore(box,body);
 var loc=li.querySelector(".pf-card__loc");loc.insertAdjacentHTML("afterbegin",PINH);var hp=li.hasAttribute("data-pol");body.insertAdjacentHTML("beforeend",'<div class="pf-card__links">'+(hp?'<button type="button" class="pf-card__ask" data-pol-open>Full pet policy</button>':"")+'<button type="button" class="pf-card__ask" data-ask-hotel>'+(hp?"Ask an advisor":"Ask about this hotel\u2019s pet rules")+'</button></div>');
 var d=D.createElement("div");d.className="pf-card__act";
 d.appendChild(link("pf-btn pf-btn--gold","https://whatahotel.com/booking/showRates.cfm?hotelID="+id+"&checkIn="+ymd(a)+"&checkOut="+ymd(b)+"&guests=2&children=0&rooms=1&"+UTM,"View Rates"));
 d.appendChild(link("pf-btn",nm.href,"Details"));li.appendChild(d);
 li._hay=norm(body.textContent+" "+li.closest(".pf-country").getAttribute("data-country"));li._b=li.querySelector(".pf-card__brand").textContent});
// photos fade in; a photo that fails to load falls back to the original file, then to the paw placeholder
function shown(im){im.classList.add("is-in")}
[].forEach.call(D.querySelectorAll(".pf-card__img img,.pf-dest img,.pf-homes__pics img"),function(im){if(im.complete&&im.naturalWidth)shown(im);else im.addEventListener("load",function(){shown(im)})});
D.addEventListener("error",function(ev){var im=ev.target;if(!im||im.tagName!=="IMG"||!root.contains(im))return;
 var m=/[?&]url=([^&]+)/.exec(im.src);if(m&&!im._fb){im._fb=1;im.src="https://"+decodeURIComponent(m[1]);return}
 var box=im.parentNode;im.remove();if(box&&box.classList.contains("pf-card__img")){var s=D.createElement("span");s.className="pf-card__ph";s.innerHTML=root.querySelector(".pf-paw").outerHTML;box.insertBefore(s,box.firstChild)}},true);
// filters
var q=D.getElementById("pf-q"),sel=D.getElementById("pf-country"),br=D.getElementById("pf-brand"),out=D.getElementById("pf-shown"),empty=D.getElementById("pf-empty"),reset=D.getElementById("pf-reset"),open={};
function apply(){var words=norm(q.value).split(/\s+/).filter(Boolean),c=sel.value,bb=br.value,filt=!!(words.length||c||bb),n=0;
 secs.forEach(function(s){var ok=!c||s.getAttribute("data-country")===c,k=0,tot=0,more=s.querySelector(".pf-more");
  [].forEach.call(s.querySelectorAll(".pf-card"),function(li){var m=ok&&(!bb||li._b===bb)&&words.every(function(w){return li._hay.indexOf(w)!==-1});
   if(m)tot++;li.hidden=!m||(!filt&&!open[s.id]&&tot>LIMIT);if(m)n++});
  s.hidden=!tot;more.hidden=filt||open[s.id]||tot<=LIMIT;var cn=s.querySelector(".pf-count");if(cn._t==null)cn._t=cn.textContent;cn.textContent=filt?tot+(tot===1?" match":" matches"):cn._t});
 out.innerHTML="<b>"+n+"</b> "+(n===1?"hotel":"hotels");empty.hidden=n!==0;reset.hidden=!filt;root.classList.toggle("pf-filtering",filt);
 [].forEach.call(D.querySelectorAll("[data-q]"),function(x){x.classList.toggle("is-on",!!words.length&&norm(x.getAttribute("data-q"))===words.join(" "))});
 try{if(window.dataLayer&&filt)window.dataLayer.push({event:"pet_page_filter",results:n})}catch(x){}}
function go(){var t=D.querySelector(".pf-tools");if(!t)return;var hh=(hd.getBoundingClientRect().height||0),wide=innerWidth>700;var y=t.getBoundingClientRect().top+(window.scrollY||0)-(wide?0:hh)-(wide?-1:6);if(wide){var f=D.querySelector(".pf-country:not([hidden])");if(f)y=f.getBoundingClientRect().top+(window.scrollY||0)-hh-t.offsetHeight-12}window.scrollTo({top:Math.max(0,y),behavior:"smooth"})}
var t;q.addEventListener("input",function(){clearTimeout(t);t=setTimeout(apply,120)});
sel.addEventListener("change",apply);br.addEventListener("change",apply);
reset.addEventListener("click",function(){q.value="";sel.value="";br.value="";apply()});
D.getElementById("pf-form").addEventListener("submit",function(ev){ev.preventDefault();apply();go()});
secs.forEach(function(s){s.querySelector(".pf-more").addEventListener("click",function(){open[s.id]=1;s.classList.add("is-open");apply()})});
var dl=D.querySelector(".pf-dests");[].forEach.call(D.querySelectorAll(".pf-arrow"),function(x){x.addEventListener("click",function(){dl.scrollBy({left:(+x.getAttribute("data-dir"))*dl.clientWidth*.8,behavior:"smooth"})})});
var hf=D.getElementById("pf-find");hf.addEventListener("submit",function(ev){ev.preventDefault();q.value=hf.querySelector("input").value;sel.value="";br.value="";apply();go()});
[].forEach.call(D.querySelectorAll("[data-q]"),function(x){x.addEventListener("click",function(ev){ev.preventDefault();q.value=x.getAttribute("data-q");sel.value="";br.value="";apply();go()})});
[].forEach.call(D.querySelectorAll("[data-brand]"),function(x){x.addEventListener("click",function(ev){ev.preventDefault();q.value="";sel.value="";br.value=x.getAttribute("data-brand");apply();go()})});
[].forEach.call(D.querySelectorAll("[data-country-pick]"),function(x){x.addEventListener("click",function(ev){ev.preventDefault();q.value="";br.value="";sel.value=x.getAttribute("data-country-pick");apply();go()})});
apply();

/* ---------- Ask an advisor: form posted to the GoHighLevel webhook (same as the Homes page) ---------- */
var HOOK="__HOOK__",NOTIFY="__EMAIL__",PHONE="__PHONE__",PD_URL="__PDURL__",modal=D.getElementById("pf-ask");
D.body.appendChild(modal);
var form=D.getElementById("pf-ask-form"),errBox=D.getElementById("pf-ask-err"),sendBtn=D.getElementById("pf-ask-send"),lastFocus=null,openedAt=0,subId="",busy=false;
function $i(id){return D.getElementById(id)}function val(id){return($i(id).value||"").trim()}
function escH(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
var HOTELS={},dl=$i("pf-hotels");
cards.forEach(function(li){var nm=li.querySelector(".pf-card__name a"),n=nm.textContent;HOTELS[norm(n)]={id:li.getAttribute("data-id"),name:n,loc:li.querySelector(".pf-card__loc").textContent,country:li.closest(".pf-country").getAttribute("data-country"),url:nm.href.split("?")[0]};
 var o=D.createElement("option");o.value=n;dl.appendChild(o)});
/* ---------- researched pet policies (loaded on demand) ---------- */
var POL_NOTE="Pet policies are set by each hotel and may change without prior notice. Please ask your travel advisor to confirm the details for your pet before you book.";
var LABELS={fee:"Pet fee",max_pets:"Number of pets",weight_limit:"Weight limit",species:"Which pets",deposit:"Deposit",rooms:"Rooms",areas:"Where pets can go",amenities:"Pet amenities",rules:"House rules",service_animals:"Service animals"};
var pdWait=[];function loadPD(cb){if(window.WAH_PET_DETAILS){cb&&cb(true);return}if(!PD_URL){cb&&cb(false);return}pdWait.push(cb||function(){});if(pdWait.length>1)return;
 var sc=D.createElement("script");sc.src=PD_URL;sc.async=true;sc.onload=function(){var w=pdWait;pdWait=[];w.forEach(function(f){f(!!window.WAH_PET_DETAILS)})};sc.onerror=function(){var w=pdWait;pdWait=[];w.forEach(function(f){f(false)})};D.head.appendChild(sc)}
function host(u){try{return new URL(u).hostname.replace(/^www\./,"")}catch(x){return u}}
var pol=D.getElementById("pf-pol");D.body.appendChild(pol);var polCard=null,polLast=null;
function openPol(li){polCard=li;polLast=D.activeElement;var id=li.getAttribute("data-id"),nm=li.querySelector(".pf-card__name a").textContent;
 $i("pf-pol-t").textContent=nm;$i("pf-pol-sub").textContent=li.querySelector(".pf-card__loc").textContent;$i("pf-pol-body").innerHTML='<p class="pf-modal__lead">Loading\u2026</p>';$i("pf-pol-note").textContent=POL_NOTE;
 $i("pf-pol-rates").href=li.querySelector(".pf-card__act .pf-btn--gold").href;pol.hidden=false;D.documentElement.classList.add("pf-lock");setTimeout(function(){pol.querySelector(".pf-modal__box").focus()},40);
 loadPD(function(ok){var r=ok&&window.WAH_PET_DETAILS[id];if(!r){$i("pf-pol-body").innerHTML='<p class="pf-modal__lead">The detailed policy could not be loaded. An advisor can confirm it for you.</p>';return}
  var order=["fee","max_pets","weight_limit","species","deposit","rooms","areas","amenities","rules","service_animals"],h="";
  order.forEach(function(k){var v=r.f[k];if(!v)return;
   h+='<div class="pf-polrow"><dt>'+LABELS[k]+'</dt><dd><b>'+escH(v[0])+'</b>'+(v[2]&&norm(v[2]).replace(/[.\s]+$/,"")!==norm(v[0]).replace(/[.\s]+$/,"")?'<q>'+escH(v[2])+'</q>':"")+"</dd></div>"});
  $i("pf-pol-body").innerHTML="<dl>"+h+"</dl>";
  $i("pf-pol-note").textContent=POL_NOTE;
  track("pet_page_policy_open",{hotel_id:id})})}
function closePol(){pol.hidden=true;D.documentElement.classList.remove("pf-lock");if(polLast&&polLast.focus)try{polLast.focus({preventScroll:true})}catch(x){}}
D.addEventListener("click",function(ev){var t=ev.target.closest&&ev.target.closest("[data-pol-open],[data-close-pol],#pf-pol-ask");if(!t)return;ev.preventDefault();
 if(t.hasAttribute("data-pol-open"))openPol(t.closest(".pf-card"));else if(t.id==="pf-pol-ask"){var li=polCard;closePol();if(li)openAsk(li.querySelector(".pf-card__name a").textContent)}else closePol()});
D.addEventListener("keydown",function(ev){if(!pol.hidden&&ev.key==="Escape")closePol()});
function track(ev,o){try{if(window.dataLayer)window.dataLayer.push(Object.assign({event:ev},o||{}))}catch(x){}}
function openAsk(where){loadPD();lastFocus=D.activeElement;$i("pf-ask-main").hidden=false;$i("pf-ask-ok").hidden=true;errBox.hidden=true;[].forEach.call(form.querySelectorAll("input,select,textarea"),function(x){if(x.id)fieldErr(x.id,"")});
 if(where!=null)$i("pf-a-where").value=where;openedAt=Date.now();subId="s"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
 var t=new Date();var mn=t.getFullYear()+"-"+pad(t.getMonth()+1)+"-"+pad(t.getDate());$i("pf-a-in").min=mn;$i("pf-a-out").min=mn;
 modal.hidden=false;D.documentElement.classList.add("pf-lock");
 setTimeout(function(){var f=where?$i("pf-a-name"):$i("pf-a-where");try{f.focus({preventScroll:true})}catch(x){f.focus()}},60);track("pet_page_ask_open",{prefilled:!!where})}
function closeAsk(){modal.hidden=true;D.documentElement.classList.remove("pf-lock");if(lastFocus&&lastFocus.focus)try{lastFocus.focus({preventScroll:true})}catch(x){}}
D.addEventListener("click",function(ev){var t=ev.target.closest&&ev.target.closest("[data-ask],[data-ask-hotel],[data-close]");if(!t)return;
 if(t.hasAttribute("data-close")){ev.preventDefault();closeAsk();return}
 if(!HOOK)return; // no webhook configured: let the email link work
 ev.preventDefault();if(t.hasAttribute("data-ask-hotel")){var c=t.closest(".pf-card");openAsk(c.querySelector(".pf-card__name a").textContent)}else openAsk(null)});
D.addEventListener("keydown",function(ev){if(modal.hidden)return;if(ev.key==="Escape"){closeAsk();return}
 if(ev.key==="Tab"){var f=[].filter.call(modal.querySelectorAll("button,input,select,textarea,a[href]"),function(x){return!x.disabled&&x.offsetParent&&x.tabIndex>=0});if(!f.length)return;
  var a1=f[0],z=f[f.length-1];if(ev.shiftKey&&D.activeElement===a1){ev.preventDefault();z.focus()}else if(!ev.shiftKey&&D.activeElement===z){ev.preventDefault();a1.focus()}}});
form.addEventListener("input",function(ev){var t=ev.target;if(t.id&&t.closest(".pf-f.is-bad"))fieldErr(t.id,"")});form.addEventListener("change",function(ev){var t=ev.target;if(t.id&&t.closest(".pf-f.is-bad"))fieldErr(t.id,"")});
function fieldErr(id,msg){var box=$i(id).closest(".pf-f");if(!box)return;box.classList.toggle("is-bad",!!msg);var sm=box.querySelector("small");if(sm)sm.textContent=msg||"";$i(id).setAttribute("aria-invalid",msg?"true":"false")}
function dParse(x){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(x||"");return m?Date.UTC(+m[1],+m[2]-1,+m[3]):null}
function validate(){var e={},today=dParse(ymd(new Date()));
 if(!val("pf-a-where"))e["pf-a-where"]="Please tell us the hotel or destination.";
 if(!val("pf-a-name"))e["pf-a-name"]="Please enter your name.";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("pf-a-email")))e["pf-a-email"]="Please enter a valid email address.";
 var ci=dParse(val("pf-a-in")),co=dParse(val("pf-a-out"));
 if(val("pf-a-in")&&(ci==null||ci<today))e["pf-a-in"]="Please choose a date from today on.";
 if(val("pf-a-out")&&(co==null||(ci!=null&&co<=ci)))e["pf-a-out"]="Check-out must be after check-in.";
 var ad=parseInt(val("pf-a-adults")||"0",10);if(!(ad>=1&&ad<=20))e["pf-a-adults"]="Please enter 1 to 20 guests.";
 if(!$i("pf-a-consent").checked)e["pf-a-consent"]="Please confirm we may contact you about this inquiry.";
 ["pf-a-where","pf-a-name","pf-a-email","pf-a-in","pf-a-out","pf-a-adults","pf-a-consent"].forEach(function(id){fieldErr(id,e[id])});return e}
var SEND_KEY="wah_pet_sends";function recent(){try{return(JSON.parse(localStorage.getItem(SEND_KEY)||"[]")||[]).filter(function(t){return Date.now()-t<6e5})}catch(x){return[]}}
function noteSend(){try{var r=recent();r.push(Date.now());localStorage.setItem(SEND_KEY,JSON.stringify(r))}catch(x){}}
function showErr(html){errBox.innerHTML=html;errBox.hidden=!html;if(html)errBox.focus()}
function contact(){return' Please try again, or email <a href="mailto:'+NOTIFY+'">'+NOTIFY+'</a> or call <a href="tel:'+PHONE.replace(/[^+\d]/g,"")+'">'+PHONE+"</a>."}
function inquiryId(){var d=new Date(),c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",r="";for(var i=0;i<6;i++)r+=c.charAt(Math.floor(Math.random()*c.length));return"PET-"+d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"-"+r}
function build(){var where=val("pf-a-where"),h=HOTELS[norm(where)]||null,name=val("pf-a-name"),parts=name.split(/\s+/),email=val("pf-a-email"),phone=val("pf-a-phone"),
 ci=val("pf-a-in"),co=val("pf-a-out"),nights=(dParse(ci)!=null&&dParse(co)!=null)?Math.round((dParse(co)-dParse(ci))/864e5):"",adults=parseInt(val("pf-a-adults"),10)||2,
 pet=val("pf-a-pet"),pets=val("pf-a-pets"),weight=val("pf-a-weight"),msg=val("pf-a-msg"),id=inquiryId(),at=new Date().toISOString(),
 dest=h?(h.name+" ("+h.loc+", "+h.country+")"):where,subject="New Pet-Friendly Hotel Inquiry — "+(h?h.name:where);
 var rows=[["Hotel or destination",dest]].concat(h?[["Hotel page",h.url]]:[]).concat([["Guest name",name],["Guest email",email],["Guest phone",phone||"Not provided"],
  ["Check-in",ci||"Not given"],["Check-out",co||"Not given"],["Nights",nights===""?"":String(nights)],["Guests",String(adults)],
  ["Pet",pet],["Number of pets",pets],["Approx. weight",weight||"Not given"],["Message",msg||"None"],["Submitted",at],["Inquiry ID",id]]);
 var known=h&&window.WAH_PET_DETAILS&&window.WAH_PET_DETAILS[h.id];
 if(known){rows.push(["Researched pet policy","(checked "+known.c+"; confirm with the hotel)"]);["fee","max_pets","weight_limit","species","deposit","rooms","areas","amenities","rules"].forEach(function(k){var v=known.f[k];if(!v)return;var s=known.s[v[1]]||["",0];rows.push([" \u2022 "+LABELS[k],v[0]+"  ["+(s[1]?"hotel website":"third-party")+": "+s[0]+"]"])})}
 var note=known?"Researched details are above with their sources. Please confirm them with the hotel and reply to the guest.":"Please confirm the hotel's pet rules (fee, weight limit, number of pets, room types) and reply to the guest.";
 var text=[subject,"","This is an inquiry from the Pet-Friendly Luxury Hotels page. Nothing has been booked or confirmed.",""].concat(rows.map(function(r){return r[0]+": "+r[1]})).concat(["",note,"Reply to the guest at "+email+"."]).join("\n");
 var html='<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0c1a2b"><p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#2f5d46">Pet-friendly hotels · Advisor request</p>'+
  '<h2 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal">'+escH(h?h.name:where)+'</h2><p style="margin:0 0 14px;padding:8px 10px;background:#eaf3ec;border-left:3px solid #2f5d46">This is an <b>inquiry</b>. Nothing has been booked or confirmed. '+escH(note)+'</p>'+
  '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">'+rows.map(function(r){var v=r[0]==="Guest email"?'<a href="mailto:'+escH(r[1])+'">'+escH(r[1])+"</a>":r[0]==="Hotel page"?'<a href="'+escH(r[1])+'">'+escH(r[1])+"</a>":escH(r[1]).replace(/\n/g,"<br>");
  return'<tr><td style="padding:4px 14px 4px 0;color:#728394;vertical-align:top;white-space:nowrap">'+escH(r[0])+'</td><td style="padding:4px 0">'+v+"</td></tr>"}).join("")+"</table></div>";
 var pmsg="Pet: "+pet+" · "+pets+(weight?" · approx. "+weight:"")+(msg?"\n"+msg:"");
 return{event:"pet_friendly_hotel_inquiry",inquiry_id:id,submitted_at:at,submission_id:subId,source_page:location.href.split(/[?#]/)[0],notify_to:NOTIFY,reply_to:email,subject:subject,email_text:text,email_html:html,
  property_id:h?h.id:"",property_name:h?h.name:where,property_country:h?h.country:"",property_location:h?h.loc:"",property_destination:dest,property_source_url:h?h.url:"",
  full_name:name,first_name:parts[0]||"",last_name:parts.slice(1).join(" "),email:email,phone:phone,check_in:ci,check_out:co,nights:nights,adults:adults,children:0,infants:0,total_guests:adults,
  pet_type:pet,pet_count:pets,pet_weight:weight,message:pmsg,over_published_capacity:"No",consent:"Yes",tags:"pet-friendly-inquiry"}}
function post(body,attempt){attempt=attempt||0;var ctrl=window.AbortController?new AbortController():null,tm=setTimeout(function(){if(ctrl)ctrl.abort()},2e4);
 return fetch(HOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:ctrl?ctrl.signal:undefined})
  .then(function(r){clearTimeout(tm);return{ok:r.ok,status:r.status}},function(){clearTimeout(tm);return{ok:false,status:0}})
  .then(function(r){if(!r.ok&&(r.status===0||r.status===429||r.status>=500)&&attempt<2)return new Promise(function(z){setTimeout(z,800*Math.pow(3,attempt))}).then(function(){return post(body,attempt+1)});return r})}
form.addEventListener("submit",function(ev){ev.preventDefault();if(busy)return;showErr("");
 var e=validate(),k=Object.keys(e);if(k.length){$i(k[0]).focus();return}
 if($i("pf-a-website").value){done("",val("pf-a-email"));return} // honeypot: look normal, send nothing
 if(Date.now()-openedAt<1500){showErr("Please take a moment to review your details, then send again.");return}
 if(recent().length>=3){showErr("You've sent several requests in the last few minutes."+contact());return}
 var body=build();busy=true;sendBtn.disabled=true;sendBtn.textContent="Sending…";
 post(body).then(function(r){if(r.ok){noteSend();done(body.inquiry_id,body.email);track("pet_page_ask_sent",{matched_hotel:!!body.property_id})}
  else{showErr("We couldn't send your request just now."+contact());track("pet_page_ask_failed",{status:r.status})}})
 .then(function(){busy=false;sendBtn.disabled=false;sendBtn.textContent="Send request"})});
function done(ref,email){$i("pf-ok-email").textContent=email;$i("pf-ok-ref").textContent=ref?"Reference: "+ref:"";$i("pf-ask-main").hidden=true;var ok=$i("pf-ask-ok");ok.hidden=false;ok.focus();
 form.reset();$i("pf-a-adults").value="2";[].forEach.call(form.querySelectorAll(".pf-f"),function(b){b.classList.remove("is-bad")})}
// header shadow + reveal on scroll
/* menu links: a short paw-print transition instead of a fast scroll */
var REDUCED=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,trans=null,busyT=false;
function jumpTo(y){var de=D.documentElement,prev=de.style.scrollBehavior;de.style.scrollBehavior="auto";
 try{window.scrollTo({top:Math.max(0,y),left:0,behavior:"instant"})}catch(x){window.scrollTo(0,Math.max(0,y))}
 requestAnimationFrame(function(){requestAnimationFrame(function(){de.style.scrollBehavior=prev})})}
function pawWalk(y,label){
 if(REDUCED){jumpTo(y);return}
 if(busyT)return;busyT=true;
 if(!trans){trans=D.createElement("div");trans.className="pf-trans";trans.setAttribute("aria-hidden","true");D.body.appendChild(trans)}
 var paw=root.querySelector(".pf-paw").outerHTML,w=innerWidth,h=innerHeight,n=w<700?6:8,html="";
 for(var i=0;i<n;i++){var x=w*(.5-(.34*(w<700?1.15:1)))+i*(w*.68*(w<700?1.15:1)/(n-1)),yy=h*.46+(i%2?22:-22);
  html+='<span class="pf-trans__paw" style="left:'+Math.round(x-16)+"px;top:"+Math.round(yy-16)+"px;animation-delay:"+(i*95)+'ms">'+paw+"</span>"}
 trans.innerHTML=html+(label?'<span class="pf-trans__label">'+escT(label)+"</span>":"");
 void trans.offsetWidth;trans.classList.add("is-on");
 setTimeout(function(){jumpTo(y)},n*95+120);
 setTimeout(function(){trans.classList.remove("is-on");busyT=false;setTimeout(function(){if(!trans.classList.contains("is-on"))trans.innerHTML=""},420)},n*95+520)}
function escT(x){return String(x).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function sectionY(id){var t=id?D.getElementById(id):null;if(!t)return root.getBoundingClientRect().top+(window.scrollY||0);var hh=D.querySelector(".pf-header").getBoundingClientRect().height||0;return t.getBoundingClientRect().top+(window.scrollY||0)-hh}
[].forEach.call(D.querySelectorAll('.pf-logo,.pf-nav a[href^="#"],.pf-footer a[href^="#"],.pf-story__cta a[href^="#"]'),function(a){a.addEventListener("click",function(ev){
 var id=(a.getAttribute("href")||"").slice(1);ev.preventDefault();var top=a.classList.contains("pf-logo")||id==="pf-top";
 pawWalk(top?0:sectionY(id),top?"Back to the top":(a.textContent||"").trim());
 try{history.replaceState(null,"",location.pathname+location.search)}catch(x){}})});
function onScroll(){hd.classList.toggle("is-stuck",hd.getBoundingClientRect().top<=0&&(window.scrollY||0)>8)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
var rv=[].slice.call(D.querySelectorAll(".pf-rv,.pf-rv-band"));
if("IntersectionObserver"in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("is-in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});rv.forEach(function(x){io.observe(x)})}
else rv.forEach(function(x){x.classList.add("is-in")});
})();`.replace("__UTM__", UTM).replace("__HOOK__", HOOK).replace("__EMAIL__", EMAIL).replace("__PHONE__", PHONE).replace("__PDURL__", PD_URL);

const topCountries = countries.slice().sort((x, y) => byCountry[y].length - byCountry[x].length).slice(0, 10);
const knowItems = [
  ["fee", "The pet fee", "Per night or per stay, and any deposit."],
  ["weight", "The weight limit", "Some hotels welcome dogs of any size; others set a limit."],
  ["count", "How many pets", "One, two, or more — and whether cats are included."],
  ["room", "Which rooms qualify", "Pets are often limited to certain room types."],
];
const marqueeItems = MARQUEE.map((b) => `<button type="button" data-brand="${esc(b)}">${esc(niceBrand(b))}</button>`).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Pet-Friendly Luxury Hotels | WhataHotel! by Lorraine Travel</title>
<meta name="description" content="${esc(`${N} luxury hotels in ${NC} countries that welcome dogs and cats, from Four Seasons and The Ritz-Carlton to Kimpton and Park Hyatt. Live rates and preferred-partner perks through WhataHotel!.`)}">
<link rel="canonical" href="${PAGE_URL}">
<meta property="og:type" content="website"><meta property="og:url" content="${PAGE_URL}"><meta property="og:title" content="Pet-Friendly Luxury Hotels | WhataHotel!">
<meta property="og:description" content="${esc(`${N} luxury hotels in ${NC} countries that welcome pets.`)}"><meta property="og:image" content="${LS.lobby}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preconnect" href="https://wsrv.nl">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<div class="pf-root">
<template id="pf-pin">${ICONS.pin}</template>
<!-- Generated by scripts/build-pet-page.mjs from WhataHotel's Pet-Friendly Luxury Hotels collection (${COLL.source}, read ${COLL.fetched}). Do not edit by hand. -->
<header class="pf-header"><div class="pf-wrap pf-header__in">
  <a class="pf-logo" href="#pf-top" aria-label="WhataHotel! Pet-Friendly Luxury Hotels, back to top"><img src="${LOGO}" alt="WhataHotel!" width="133" height="30"></a>
  <nav class="pf-nav" aria-label="Primary"><a href="#destinations">Destinations</a><a href="#browse">All hotels</a><a href="#homes">Villas &amp; homes</a><a href="#faq">FAQ</a></nav>
  <a class="pf-btn pf-btn--ink" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask>Ask an advisor</a>
</div></header>

<main>
<section class="pf-hero" id="pf-top">
  ${lsImg(LS.lobby, "A guest walking her golden retriever through a luxury hotel lobby", "100vw", 'class="pf-hero__bg" fetchpriority="high" width="1672" height="941"')}
  <div class="pf-hero__shade"></div>
  <div class="pf-wrap pf-hero__in">
    <span class="pf-kicker pf-rv"><span class="pf-kicker__a">WhataHotel! &nbsp;·&nbsp;&nbsp;</span>The Pet-Friendly Collection</span>
    <h1 class="pf-rv">Pet-Friendly <em>Luxury Hotels</em></h1>
    <p class="pf-hero__sub pf-rv">${N} of the world's finest hotels that welcome your dog or cat, in ${NC} countries.</p>
    <form class="pf-find pf-rv" id="pf-find" role="search"><span>${ICONS.search}</span><label style="position:absolute;left:-9999px" for="pf-find-q">Search pet-friendly hotels</label>
      <input id="pf-find-q" type="search" placeholder="Where are you traveling with your pet?" autocomplete="off" enterkeyhint="search">
      <button class="pf-btn pf-btn--gold" type="submit" aria-label="Search">${ICONS.arrow}<span>Search</span></button></form>
    <div class="pf-quick pf-rv">${DESTS.slice(0, 5).map((d) => `<a class="pf-chip" href="#browse" data-q="${esc(d.city)}">${esc(d.city)}</a>`).join("")}</div>
  </div>
  <div class="pf-hero__stats"><div class="pf-wrap"><span><b>${N}</b>Hotels</span><span><b>${NC}</b>Countries</span><span><b>${NB}</b>Brands</span><span><b>${homesPetCount}</b>Villas &amp; homes</span></div></div>
</section>

<div class="pf-marquee" aria-label="Brands"><div class="pf-marquee__track">${marqueeItems}<span aria-hidden="true" style="display:contents">${marqueeItems.replace(/<button /g, '<button tabindex="-1" ')}</span></div></div>

<section class="pf-sec pf-story"><div class="pf-wrap pf-story__grid">
  <div class="pf-story__pics pf-rv">
    <figure class="pf-story__a">${lsImg(LS.golden, "A golden retriever relaxing on a hotel bed with a mountain view", "(max-width:700px) 90vw, 46vw", 'loading="lazy" width="1536" height="1024"')}</figure>
    <figure class="pf-story__b">${lsImg(LS.cat, "A cat lounging by the window of a city-view suite", "(max-width:700px) 60vw, 26vw", 'loading="lazy" width="1536" height="1024"')}</figure>
    <span class="pf-seal">${PAW}<em>Pets</em>welcome</span>
  </div>
  <div class="pf-story__txt pf-rv">
    <span class="pf-eyebrow"><b class="pf-n">01</b>Travel together</span>
    <h2 class="pf-h2">Your dog or cat <em>doesn't have to stay home</em></h2>
    ${intro[0] ? `<p class="pf-lead">${esc(intro[0].replace(/^Your dog or cat doesn['’]t have to stay home\.\s*/i, ""))}</p>` : ""}
    <ul class="pf-ticks"><li>Grand hotels, city hideaways and country houses</li><li>The hotel's own rate, with preferred-partner perks where offered</li><li>Every pet rule confirmed by a Lorraine Travel advisor</li></ul>
    <div class="pf-story__cta"><a class="pf-btn pf-btn--ink" href="#browse">Explore the collection ${ICONS.arrow}</a><a class="pf-link" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask>Ask an advisor</a></div>
  </div>
</div></section>

<section class="pf-sec" id="destinations"><div class="pf-wrap">
  <div class="pf-sec__head pf-rv"><div><span class="pf-eyebrow"><b class="pf-n">02</b>Top destinations</span><h2 class="pf-h2">Where pets are <em>most welcome</em></h2></div>
    <div class="pf-dest-nav"><p class="pf-lead" style="max-width:36ch">The cities with the most pet-friendly hotels in the collection. Tap one to see them all.</p>
    <div class="pf-arrows"><button type="button" class="pf-arrow" data-dir="-1" aria-label="Previous destinations">${ICONS.arrow}</button><button type="button" class="pf-arrow" data-dir="1" aria-label="Next destinations">${ICONS.arrow}</button></div></div></div>
  <div class="pf-dests pf-rv">${DESTS.map((d) => `<button type="button" class="pf-dest" data-q="${esc(d.city)}"><img src="${esc(img(d.pick.photo, 560, 700))}" alt="${esc(d.pick.name)}" loading="lazy" decoding="async" width="560" height="700"><span class="pf-dest__t"><b>${esc(d.city)}</b><span>${PAW}${d.count} pet-friendly ${d.count === 1 ? "hotel" : "hotels"}</span></span></button>`).join("")}</div>
</div></section>

<section class="pf-band pf-rv-band">
  ${lsImg(LS.seaview, "A dog resting on a sea-view hotel balcony", "100vw", 'class="pf-band__bg" loading="lazy" width="1672" height="941"')}
  <div class="pf-band__shade"></div>
  <div class="pf-wrap pf-band__in pf-rv"><span class="pf-rule"></span><p class="pf-band__q">Luxury travel, <em>paws included.</em></p><p class="pf-band__s">Sea-view suites, garden terraces and city penthouses, at hotels that welcome your pet.</p></div>
</section>

<section class="pf-sec pf-sec--tight"><div class="pf-wrap"><div class="pf-know pf-rv">
  <div class="pf-know__top"><div>
  <span class="pf-eyebrow"><b class="pf-n">03</b>Before you book</span>
  <h2 class="pf-h2" style="margin-top:1rem;max-width:16ch">Every pet rule, <em>confirmed for you</em></h2>
  ${intro[1] ? `<p class="pf-lead" style="margin-top:1.1rem">${esc(intro[1])}</p>` : ""}</div>
  <figure class="pf-know__pic">${lsImg(LS.amenities, "A pet bed, bowls, leash and treats laid out in a hotel suite", "(max-width:1000px) 90vw, 40vw", 'loading="lazy" width="1536" height="1024"')}<figcaption>Amenities differ by hotel. Your advisor will tell you what to expect.</figcaption></figure></div>
  <div class="pf-know__grid">${knowItems.map(([k, t, d]) => `<div class="pf-know__item"><i>${ICONS[k]}</i><b>${t}</b><p>${d}</p></div>`).join("")}</div>
  <div class="pf-know__foot"><a class="pf-btn pf-btn--gold" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask>${ICONS.mail}Ask an advisor</a><a class="pf-btn" href="tel:${PHONE.replace(/[^+\d]/g, "")}">${ICONS.phone}${PHONE}</a></div>
</div></div></section>

<section class="pf-sec" id="browse" style="padding-bottom:0">
  <div class="pf-wrap pf-sec__head pf-rv"><div><span class="pf-eyebrow"><b class="pf-n">04</b>The full collection</span><h2 class="pf-h2">All ${N} <em>pet-friendly hotels</em></h2></div>
    <p class="pf-lead" style="max-width:44ch">Search by hotel, city, country or brand. View Rates opens live rates on WhataHotel.com.</p></div>
  <div class="pf-tools"><div class="pf-wrap"><form class="pf-tools__in" id="pf-form" role="search">
    <label class="pf-search">${ICONS.search}<span style="position:absolute;left:-9999px">Search pet-friendly hotels</span><input id="pf-q" type="search" placeholder="Hotel, city, country or brand" autocomplete="off" enterkeyhint="search"></label>
    <select id="pf-country" class="pf-select" aria-label="Country"><option value="">All ${NC} countries</option>${countries.slice().sort().map((c) => `<option value="${esc(c)}">${esc(c)} (${byCountry[c].length})</option>`).join("")}</select>
    <select id="pf-brand" class="pf-select" aria-label="Brand"><option value="">All ${NB} brands</option>${brands.map((b) => `<option value="${esc(b)}">${esc(b)} (${brandCounts[b]})</option>`).join("")}</select>
    <span class="pf-shown" id="pf-shown" aria-live="polite"><b>${N}</b> hotels</span><button type="button" class="pf-reset" id="pf-reset" hidden>Clear filters</button>
  </form></div></div>
  <div class="pf-wrap">
    <div class="pf-countries">${topCountries.map((c) => `<a class="pf-chip" href="#${slug(c)}" data-country-pick="${esc(c)}">${esc(c)} <b>${byCountry[c].length}</b></a>`).join("")}</div>
    <div class="pf-empty" id="pf-empty" hidden><p>No pet-friendly hotels match that search. Try a city, country or brand, or <a href="mailto:${EMAIL}" data-ask>ask an advisor</a>.</p></div>
    ${countries.map(countrySection).join("\n")}
  </div>
</section>

<section class="pf-sec" id="homes"><div class="pf-wrap pf-homes pf-rv">
  <figure class="pf-homes__hero">${lsImg(LS.pool, "A dog relaxing by a resort pool", "(max-width:1000px) 90vw, 50vw", 'loading="lazy" width="1672" height="941"')}</figure>
  <div class="pf-homes__txt"><span class="pf-eyebrow"><b class="pf-n">05</b>Villas, residences &amp; homes</span>
    <h2 class="pf-h2" style="margin:1rem 0 1.1rem">Prefer a villa? <em>Bring the whole family.</em></h2>
    <p class="pf-lead">${homesPetCount} villas, residences and homes in the WhataHotel! Homes collection welcome pets, each with its pet policy from the property's own page.</p>
    <div class="pf-homes__pics">${petHomes.map((p) => `<a href="${HOMES_URL}"><img src="${esc(img(W.WAH_IMAGES[p.id].hero, 420, 300))}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="420" height="300"><span>${esc(p.name)}</span></a>`).join("")}</div>
    <a class="pf-btn pf-btn--ink" href="${HOMES_URL}">See pet-friendly homes ${ICONS.arrow}</a></div>
</div></section>

<section class="pf-sec" id="faq" style="padding-top:0"><div class="pf-wrap pf-faq">
  <div class="pf-rv"><span class="pf-eyebrow"><b class="pf-n">06</b>Good to know</span><h2 class="pf-h2" style="margin-top:.9rem">Questions, <em>answered</em></h2>
    <div class="pf-advisor"><b>Talk to an advisor</b><p>We'll confirm the pet rules for your dates and your pet before you book.</p>
      <a class="pf-btn pf-btn--gold" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask style="justify-self:start;color:var(--ink)">${ICONS.mail}Send a request</a>
      <a href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry">${ICONS.mail}${EMAIL}</a><a href="tel:${PHONE.replace(/[^+\d]/g, "")}">${ICONS.phone}${PHONE}</a></div></div>
  <div class="pf-qa pf-rv">${FAQ.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join("")}</div>
</div></section>
</main>

<div class="pf-modal" id="pf-pol" hidden>
  <div class="pf-modal__bg" data-close-pol></div>
  <div class="pf-modal__box pf-polbox" role="dialog" aria-modal="true" aria-labelledby="pf-pol-t" tabindex="-1">
    <button type="button" class="pf-modal__x" data-close-pol aria-label="Close">&times;</button>
    <span class="pf-eyebrow">${PAW}Pet policy</span>
    <h2 class="pf-modal__h" id="pf-pol-t"></h2>
    <p class="pf-modal__lead" id="pf-pol-sub"></p>
    <div id="pf-pol-body"></div>
    <p class="pf-polnote" id="pf-pol-note"></p>
    <div class="pf-polact"><a class="pf-btn pf-btn--gold" id="pf-pol-rates" target="_blank" rel="noopener">View Rates</a><button type="button" class="pf-btn pf-btn--ink" id="pf-pol-ask">Ask an advisor</button></div>
  </div>
</div>
<div class="pf-modal" id="pf-ask" hidden>
  <div class="pf-modal__bg" data-close></div>
  <div class="pf-modal__box" role="dialog" aria-modal="true" aria-labelledby="pf-ask-t" tabindex="-1">
    <button type="button" class="pf-modal__x" data-close aria-label="Close">&times;</button>
    <figure class="pf-modal__pic">${lsImg(LS.balconyBed, "A golden retriever on a hotel bed beside a sunny balcony", "(max-width:600px) 100vw, 640px", 'loading="lazy" width="1672" height="941"')}</figure>
    <div id="pf-ask-main">
      <span class="pf-eyebrow">${PAW}Ask an advisor</span>
      <h2 class="pf-modal__h" id="pf-ask-t">Traveling with your pet?</h2>
      <p class="pf-modal__lead">Tell us where you're going and about your pet. A Lorraine Travel advisor will confirm the hotel's pet rules (the fee, the weight limit, how many pets and which rooms qualify) and reply by email. Nothing is booked yet.</p>
      <form id="pf-ask-form" novalidate>
        <div class="pf-f pf-f--full"><label for="pf-a-where">Hotel or destination <i>*</i></label><input id="pf-a-where" list="pf-hotels" autocomplete="off" placeholder="e.g. Four Seasons Paris, or Napa Valley"><datalist id="pf-hotels"></datalist><small></small></div>
        <div class="pf-f"><label for="pf-a-in">Check-in</label><input id="pf-a-in" type="date"><small></small></div>
        <div class="pf-f"><label for="pf-a-out">Check-out</label><input id="pf-a-out" type="date"><small></small></div>
        <div class="pf-f"><label for="pf-a-name">Full name <i>*</i></label><input id="pf-a-name" autocomplete="name"><small></small></div>
        <div class="pf-f"><label for="pf-a-email">Email <i>*</i></label><input id="pf-a-email" type="email" autocomplete="email" inputmode="email"><small></small></div>
        <div class="pf-f"><label for="pf-a-phone">Phone <span>(optional)</span></label><input id="pf-a-phone" type="tel" autocomplete="tel"><small></small></div>
        <div class="pf-f"><label for="pf-a-adults">Guests</label><input id="pf-a-adults" type="number" min="1" max="20" value="2" inputmode="numeric"><small></small></div>
        <fieldset class="pf-f--full pf-pet"><legend>${PAW}Your pet</legend>
          <div class="pf-f"><label for="pf-a-pet">Pet</label><select id="pf-a-pet"><option>Dog</option><option>Cat</option><option>Dog and cat</option><option>Other</option></select></div>
          <div class="pf-f"><label for="pf-a-pets">How many</label><select id="pf-a-pets"><option>1</option><option>2</option><option>3</option><option>4+</option></select></div>
          <div class="pf-f"><label for="pf-a-weight">Approx. weight <span>(optional)</span></label><input id="pf-a-weight" placeholder="e.g. 25 lb"></div>
        </fieldset>
        <div class="pf-f pf-f--full"><label for="pf-a-msg">Anything else? <span>(optional)</span></label><textarea id="pf-a-msg" rows="3" placeholder="Breed, room preferences, special occasions…"></textarea></div>
        <div class="pf-hp" aria-hidden="true"><label for="pf-a-website">Website</label><input id="pf-a-website" tabindex="-1" autocomplete="off"></div>
        <div class="pf-f pf-f--full pf-consent"><label><input id="pf-a-consent" type="checkbox"> I agree to be contacted by WhataHotel! / Lorraine Travel about this inquiry.</label><small></small></div>
        <p class="pf-form-err" id="pf-ask-err" role="alert" tabindex="-1" hidden></p>
        <button type="submit" class="pf-btn pf-btn--gold pf-submit" id="pf-ask-send">Send request</button>
        <p class="pf-modal__alt">Prefer to call? <a href="tel:${PHONE.replace(/[^+\d]/g, "")}">${PHONE}</a> · <a href="mailto:${EMAIL}">${EMAIL}</a></p>
      </form>
    </div>
    <div id="pf-ask-ok" class="pf-ok" hidden tabindex="-1">
      <span class="pf-ok__ic">${PAW}</span>
      <h2 class="pf-modal__h">Request sent</h2>
      <p class="pf-modal__lead">Thank you. An advisor will confirm the pet rules and reply to <b id="pf-ok-email"></b>, usually within one business day.</p>
      <p class="pf-ok__ref" id="pf-ok-ref"></p>
      <button type="button" class="pf-btn pf-btn--ink" data-close>Close</button>
    </div>
  </div>
</div>
<footer class="pf-footer"><div class="pf-wrap">
  <div class="pf-footer__in">
    <div><b>WhataHotel! by Lorraine Travel</b><p>Luxury hotels, villas and homes, with preferred-partner perks.</p></div>
    <ul><li><a href="${HOMES_URL}">Homes &amp; Villas</a></li><li><a href="#browse">Pet-friendly hotels</a></li><li><a href="mailto:${EMAIL}">${EMAIL}</a></li><li><a href="tel:${PHONE.replace(/[^+\d]/g, "")}">${PHONE}</a></li></ul>
    <div class="pf-social"><a href="${SOCIAL.instagram}" target="_blank" rel="noopener" aria-label="WhataHotel! on Instagram">${IG}</a><a href="${SOCIAL.facebook}" target="_blank" rel="noopener" aria-label="WhataHotel! on Facebook">${FB}</a></div>
  </div>
  <p class="pf-legal">© ${new Date().getFullYear()} WhataHotel! by Lorraine Travel. Pet rules are set by each hotel and can change; an advisor confirms the details for your pet before you book.</p>
</div></footer>
</div>
<script>${JS}</script>
</body>
</html>
`;
const BYTES = Buffer.byteLength(html);
if (BYTES > 950000) throw new Error(`pet-friendly.html would be ${BYTES} bytes — over the 950,000-byte safety limit (GoHighLevel truncates at 1,000,000).`);
writeFileSync(join(root, "pet-friendly.html"), html);
console.log(`Wrote pet-friendly.html (${BYTES} bytes): ${N} hotels in ${NC} countries, ${Object.keys(IMAGES).length} with photos; ${DESTS.length} destinations; ${petHomes.length} home photos; ${homesPetCount} pet-friendly homes on /homes`);
