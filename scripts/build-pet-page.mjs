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

const COLL = JSON.parse(read("scripts/pet-collection.json"));
// Same GoHighLevel Inbound Webhook as the Homes "Request Availability" form (and Greg's
// advisor requests): the GHL workflow emails Reservations@WhataHotel.com.
const HOOK = process.env.GHL_WEBHOOK_URL || ((read("index.html").match(/<meta name="wah-ghl-webhook" content="([^"]*)"/) || [])[1] || "");
if (HOOK && !/^https:\/\/(services|backend)\.leadconnectorhq\.com\/hooks\/[A-Za-z0-9_\-\/]+$/.test(HOOK)) throw new Error("GHL webhook URL must look like https://services.leadconnectorhq.com/hooks/…");
if (!HOOK) console.warn("  ! No GHL webhook found — the Ask an advisor form will fall back to email links.");
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
const heroA = hotels.find((h) => h.id === 1453 && h.photo) || photoFor((h) => /four seasons/i.test(h.name));
const heroB = hotels.find((h) => h.id === 984 && h.photo) || photoFor((h) => /st\.? regis/i.test(h.name));
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
function card(h) {
  // Text and link only: the page script adds the photo, icons and buttons, which keeps
  // 751 cards under GoHighLevel's 1 MB custom-code limit (and the text stays readable by
  // search engines and without JavaScript).
  const loc = [h.city, h.region && h.region !== h.city ? h.region : ""].filter(Boolean).join(", ");
  const pre = `https://www.whatahotel.com/content/hotels/${h.id}/`;
  const p = !h.photo ? "" : h.photo.startsWith(pre) ? h.photo.slice(pre.length) : h.photo;
  return `<li class="pf-card" data-id="${h.id}"${p ? ` data-p="${esc(p)}"` : ""}><div class="pf-card__body"><span class="pf-card__brand">${esc(h.brand)}</span>` +
    `<h3 class="pf-card__name"><a href="https://whatahotel.com/hotels/${h.id}/${h.slug}.html">${esc(h.name)}</a></h3><p class="pf-card__loc">${esc(loc)}</p>` +
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
      primaryImageOfPage: PET_PHOTO, dateModified: COLL.fetched, mainEntity: { "@id": PAGE_URL + "#hotels" } },
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
:root{--ink:#0c1a2b;--ink-2:#14283f;--cream:#fbf8f2;--sand:#f3ece0;--paper:#fff;--gold:#c6a35a;--gold-2:#e6cc8f;--gold-deep:#93733a;
--sage:#2f5d46;--sage-2:#447a5e;--mint:#e7f1ea;--mint-line:#cfe2d5;--blush:#f6e9e1;--line:rgba(12,26,43,.09);--text:#1b2b3a;--soft:#4d5f70;--mut:#738394;
--serif:"Fraunces",Georgia,"Times New Roman",serif;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
--r:22px;--shadow:0 1px 2px rgba(12,26,43,.05),0 12px 32px -12px rgba(12,26,43,.18);--shadow-lg:0 30px 60px -24px rgba(12,26,43,.35)}
*{box-sizing:border-box}[hidden]{display:none!important}html{scroll-behavior:smooth}body{margin:0;background:var(--cream)}
.pf-root{background:var(--cream);color:var(--text);font:400 16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;text-align:left;overflow-x:clip}
.pf-root p{line-height:1.6;margin:0}.pf-root h1,.pf-root h2,.pf-root h3,.pf-root h4{letter-spacing:normal;text-transform:none;margin:0}
.pf-root a{color:inherit}.pf-root a.pf-btn{color:var(--ink)}.pf-root a.pf-btn--ink{color:#fff}.pf-root .pf-know__foot a.pf-btn:not(.pf-btn--gold){color:#fff}.pf-root img{max-width:100%}.pf-root button{font:inherit;cursor:pointer}
.pf-root svg{flex:none}
/* GoHighLevel wraps custom code in a section, row and column with padding: let the page run edge to edge. */
.c-section:has(.pf-root),.c-row:has(.pf-root),.c-column:has(.pf-root),.c-custom-code:has(.pf-root){padding:0!important;margin:0!important;max-width:none!important}
.pf-wrap{width:min(1200px,100% - 40px);margin-inline:auto}
.pf-eyebrow{display:inline-flex;align-items:center;gap:.5rem;font:700 .74rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep)}
.pf-eyebrow .pf-paw{width:1rem;height:1rem}
.pf-h2{font:500 clamp(2rem,4.2vw,3.1rem)/1.08 var(--serif);color:var(--ink);letter-spacing:-.01em}
.pf-h2 em,.pf-hero h1 em{font-style:italic;color:var(--sage)}
.pf-lead{color:var(--soft);font-size:1.06rem;max-width:62ch}
.pf-sec{padding:clamp(64px,9vw,112px) 0}
.pf-sec__head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:1rem 2rem;margin-bottom:clamp(26px,4vw,40px)}
.pf-sec__head>div{display:grid;gap:.8rem;max-width:720px}
.pf-btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;padding:.72rem 1.25rem;border-radius:999px;border:1px solid var(--line);background:#fff;font:600 .9rem/1.2 var(--sans);text-decoration:none;color:var(--ink);white-space:nowrap;transition:transform .2s,box-shadow .2s,background .2s,border-color .2s}
.pf-btn:hover{transform:translateY(-1px);border-color:var(--gold);box-shadow:var(--shadow)}
.pf-btn svg{width:1.05rem;height:1.05rem}
.pf-btn--gold{background:linear-gradient(135deg,var(--gold-2),var(--gold));border-color:transparent}
.pf-btn--ink{background:var(--ink);color:#fff;border-color:var(--ink)}.pf-btn--ink:hover{background:var(--ink-2)}
/* header */
.pf-header{position:sticky;top:0;z-index:30;background:rgba(251,248,242,.86);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid transparent;transition:border-color .3s,box-shadow .3s}
.pf-header.is-stuck{border-color:var(--line);box-shadow:0 8px 24px -18px rgba(12,26,43,.4)}
.pf-header__in{display:flex;align-items:center;gap:1.2rem;min-height:70px}.pf-logo img{display:block;height:30px;width:auto}
.pf-nav{display:flex;gap:1.6rem;margin-left:auto;font-size:.92rem;font-weight:500}.pf-nav a{text-decoration:none;color:var(--soft)}.pf-nav a:hover{color:var(--ink)}
/* hero */
.pf-hero{position:relative;padding:clamp(36px,6vw,72px) 0 clamp(56px,8vw,96px);overflow:hidden}
.pf-hero::before{content:"";position:absolute;width:780px;height:780px;right:-220px;top:-260px;border-radius:50%;background:radial-gradient(circle at 40% 40%,var(--mint),rgba(231,241,234,0) 68%);pointer-events:none}
.pf-hero::after{content:"";position:absolute;width:560px;height:560px;left:-260px;bottom:-280px;border-radius:50%;background:radial-gradient(circle,var(--blush),rgba(246,233,225,0) 70%);pointer-events:none}
.pf-hero__grid{position:relative;z-index:1;display:grid;grid-template-columns:1.02fr 1fr;gap:clamp(32px,5vw,72px);align-items:center}
.pf-hero h1{font:500 clamp(2.7rem,6.4vw,5.1rem)/1.02 var(--serif);color:var(--ink);letter-spacing:-.02em;margin:1.1rem 0 1.3rem}
.pf-hero h1 em{display:block}
.pf-hero__lead{font-size:clamp(1.02rem,1.5vw,1.14rem);color:var(--soft);max-width:54ch}
.pf-find{display:flex;align-items:center;gap:.4rem;margin:2rem 0 1rem;padding:.4rem .4rem .4rem 1.1rem;background:#fff;border:1px solid var(--line);border-radius:999px;box-shadow:var(--shadow);max-width:560px}
.pf-find:focus-within{border-color:var(--gold);box-shadow:0 0 0 5px rgba(198,163,90,.18),var(--shadow)}
.pf-find svg{width:20px;height:20px;color:var(--gold-deep)}
.pf-find input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;padding:.7rem .3rem;color:var(--ink)}
.pf-find .pf-btn{padding:.8rem 1.4rem}
.pf-quick{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;font-size:.85rem;color:var(--mut)}
.pf-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.42rem .85rem;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.7);font:500 .85rem/1.1 var(--sans);color:var(--ink);text-decoration:none;transition:background .2s,border-color .2s}
.pf-chip:hover,.pf-chip.is-on{background:var(--ink);border-color:var(--ink);color:#fff}
.pf-chip b{font-weight:600;opacity:.6}
.pf-mosaic{position:relative;display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:1fr 1fr;gap:14px;height:clamp(420px,46vw,580px)}
.pf-mosaic figure{margin:0;position:relative;border-radius:26px;overflow:hidden;background:var(--sand);box-shadow:var(--shadow-lg)}
.pf-mosaic figure:first-child{grid-row:1 / span 2}
.pf-mosaic img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.pf-mosaic figure:hover img{transform:scale(1.05)}
.pf-mosaic figcaption{position:absolute;left:12px;bottom:12px;right:12px;padding:.45rem .7rem;border-radius:12px;background:rgba(12,26,43,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font:500 .78rem/1.3 var(--sans)}
.pf-badge{position:absolute;z-index:2;display:flex;align-items:center;gap:.7rem;padding:.75rem 1rem;border-radius:18px;background:#fff;box-shadow:var(--shadow-lg);animation:pf-float 6s ease-in-out infinite}
.pf-badge b{display:block;font:600 1.45rem/1 var(--serif);color:var(--ink)}.pf-badge span{display:block;font-size:.78rem;color:var(--mut)}
.pf-badge i{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--mint);color:var(--sage)}.pf-badge i svg{width:22px;height:22px}
.pf-badge--a{left:-26px;bottom:42px}.pf-badge--b{right:-14px;top:-18px;animation-delay:-3s}.pf-badge--b i{background:var(--blush);color:#b0573a}
@keyframes pf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
/* brand marquee */
.pf-marquee{border-block:1px solid var(--line);background:#fff;overflow:hidden;padding:1.05rem 0;-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.pf-marquee__track{display:flex;gap:3rem;width:max-content;animation:pf-scroll 48s linear infinite}
.pf-marquee:hover .pf-marquee__track{animation-play-state:paused}
.pf-marquee button{display:inline-flex;align-items:center;gap:3rem;border:0;background:none;padding:0;font:500 1.25rem/1 var(--serif);color:var(--ink);white-space:nowrap;opacity:.78;transition:opacity .2s,color .2s}
.pf-marquee button:hover{opacity:1;color:var(--sage)}.pf-marquee button::after{content:"✦";font-size:.7rem;color:var(--gold)}
@keyframes pf-scroll{to{transform:translateX(-50%)}}
/* destinations */
.pf-dests{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(220px,23%,280px);gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 20px 18px;margin:0 -20px;scrollbar-width:thin}
.pf-dest{position:relative;scroll-snap-align:start;height:340px;border-radius:var(--r);overflow:hidden;border:0;padding:0;background:var(--ink);text-align:left;color:#fff;box-shadow:var(--shadow)}
.pf-dest img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.pf-dest::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,16,26,0) 40%,rgba(8,16,26,.82))}
.pf-dest:hover img{transform:scale(1.07)}
.pf-dest__t{position:absolute;z-index:1;left:18px;right:18px;bottom:16px}.pf-dest__t b{display:block;font:500 1.55rem/1.1 var(--serif)}
.pf-dest__t span{display:inline-flex;align-items:center;gap:.35rem;margin-top:.35rem;font-size:.84rem;opacity:.9}.pf-dest__t .pf-paw{width:.9rem;height:.9rem;color:var(--gold-2)}
.pf-dest-nav{display:flex;align-items:end;gap:1.5rem}.pf-arrows{display:flex;gap:.5rem}
.pf-arrow{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--ink);transition:background .2s,color .2s}
.pf-arrow:hover{background:var(--ink);color:#fff}.pf-arrow svg{width:20px;height:20px}.pf-arrow[data-dir="-1"] svg{transform:rotate(180deg)}
/* before you book */
.pf-know{background:var(--ink);color:#fff;border-radius:clamp(24px,3vw,36px);padding:clamp(36px,6vw,72px);position:relative;overflow:hidden}
.pf-know::before{content:"";position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(198,163,90,.28),rgba(198,163,90,0) 70%)}
.pf-know .pf-h2{color:#fff}.pf-know .pf-h2 em{color:var(--gold-2)}.pf-know .pf-lead{color:rgba(255,255,255,.75)}.pf-know .pf-eyebrow{color:var(--gold-2)}
.pf-know__grid{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:clamp(28px,4vw,44px)}
.pf-know__item{padding:1.4rem 1.3rem;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);transition:background .3s,transform .3s}
.pf-know__item:hover{background:rgba(255,255,255,.1);transform:translateY(-3px)}
.pf-know__item i{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(230,204,143,.15);color:var(--gold-2);margin-bottom:1rem}.pf-know__item i svg{width:24px;height:24px}
.pf-know__item b{display:block;font:600 1.02rem/1.3 var(--sans);margin-bottom:.3rem}.pf-know__item p{font-size:.9rem;color:rgba(255,255,255,.68)}
.pf-know__foot{position:relative;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;margin-top:clamp(24px,3vw,36px)}
.pf-know__foot .pf-btn:not(.pf-btn--gold){background:transparent;color:#fff;border-color:rgba(255,255,255,.3)}
/* browse */
.pf-tools{position:sticky;top:70px;z-index:20;background:rgba(251,248,242,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:.8rem 0;border-bottom:1px solid var(--line)}
.pf-tools__in{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
.pf-search{flex:1 1 280px;display:flex;align-items:center;gap:.55rem;background:#fff;border:1px solid var(--line);border-radius:14px;padding:0 .95rem}
.pf-search:focus-within{border-color:var(--gold);box-shadow:0 0 0 4px rgba(198,163,90,.18)}.pf-search svg{width:18px;height:18px;color:var(--gold-deep)}
.pf-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;padding:.78rem 0;color:var(--ink)}
.pf-select{flex:0 1 210px;min-width:0;font:inherit;font-size:16px;padding:.75rem 2.2rem .75rem .9rem;border:1px solid var(--line);border-radius:14px;color:var(--ink);appearance:none;-webkit-appearance:none;
background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393733a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") right .8rem center/16px no-repeat}
.pf-shown{font-size:.9rem;color:var(--mut);white-space:nowrap}.pf-shown b{color:var(--ink)}
.pf-reset{border:0;background:none;color:var(--sage);font-weight:600;font-size:.88rem;padding:.4rem}.pf-reset:hover{text-decoration:underline}
.pf-countries{display:flex;flex-wrap:wrap;gap:.45rem;margin:1.6rem 0 0}
.pf-country{margin-top:clamp(36px,5vw,56px);scroll-margin-top:150px}
.pf-country__head{display:flex;align-items:baseline;gap:.8rem;margin-bottom:1.1rem}
.pf-country__head h2{font:500 clamp(1.6rem,3vw,2.15rem)/1.15 var(--serif);color:var(--ink)}.pf-count{font-size:.9rem;color:var(--mut)}
.pf-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:18px}
.pf-card{display:flex;flex-direction:column;background:#fff;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);box-shadow:0 1px 2px rgba(12,26,43,.04);transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
.pf-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.pf-card__img{position:relative;aspect-ratio:16/11;background:linear-gradient(135deg,var(--mint),var(--sand));overflow:hidden}
.pf-card__img img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .5s,transform 1s cubic-bezier(.2,.7,.2,1)}
.pf-card__img img.is-in{opacity:1}.pf-card:hover .pf-card__img img{transform:scale(1.06)}
.pf-card__ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--sage);opacity:.45}.pf-card__ph .pf-paw{width:46px;height:46px}
.pf-card__pet{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:.35rem;padding:.32rem .65rem;border-radius:999px;background:rgba(255,255,255,.92);color:var(--sage);font:600 .72rem/1 var(--sans);letter-spacing:.02em;box-shadow:0 4px 14px -6px rgba(0,0,0,.3)}
.pf-card__pet .pf-paw{width:.85rem;height:.85rem}
.pf-card__body{flex:1;display:flex;flex-direction:column;gap:.35rem;padding:1.05rem 1.1rem 0}
.pf-card__brand{font:700 .68rem/1.3 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep)}
.pf-card__name{font:500 1.18rem/1.25 var(--serif)!important;color:var(--ink)}.pf-card__name a{text-decoration:none}.pf-card__name a:hover{text-decoration:underline;text-underline-offset:3px}
.pf-card__loc{display:flex;align-items:center;gap:.35rem;font-size:.86rem;color:var(--mut)}.pf-card__loc svg{width:15px;height:15px;color:var(--gold-deep)}
.pf-card__homes{align-self:flex-start;margin-top:.15rem;padding:.25rem .6rem;border-radius:999px;background:var(--mint);color:var(--sage);font:600 .74rem/1.2 var(--sans);text-decoration:none}
.pf-card__act{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;padding:1rem 1.1rem 1.1rem;margin-top:auto}
.pf-card__act .pf-btn{padding:.62rem .5rem;font-size:.84rem}
.pf-more{display:flex;align-items:center;gap:.5rem;margin:1.2rem auto 0;padding:.75rem 1.4rem;border-radius:999px;border:1px solid var(--ink);background:transparent;color:var(--ink);font-weight:600;font-size:.9rem;transition:background .2s,color .2s}
.pf-more:hover{background:var(--ink);color:#fff}
.pf-empty{margin:2.4rem 0;padding:2rem;border-radius:var(--r);background:#fff;border:1px dashed var(--mint-line);text-align:center;color:var(--soft)}
.pf-filtering .pf-countries{display:none}
/* homes band */
.pf-homes{display:grid;grid-template-columns:1fr 1.15fr;gap:clamp(28px,5vw,64px);align-items:center;padding:clamp(32px,5vw,56px);border-radius:clamp(24px,3vw,36px);background:var(--mint);border:1px solid var(--mint-line)}
.pf-homes .pf-h2 em{color:var(--sage-2)}
.pf-homes__pics{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pf-homes__pics a{position:relative;display:block;aspect-ratio:4/3;border-radius:18px;overflow:hidden;background:var(--sand);box-shadow:var(--shadow)}
.pf-homes__pics a:nth-child(2){transform:translateY(22px)}.pf-homes__pics a:nth-child(4){transform:translateY(22px)}
.pf-homes__pics img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .9s}.pf-homes__pics a:hover img{transform:scale(1.06)}
.pf-homes__pics span{position:absolute;left:10px;right:10px;bottom:10px;padding:.35rem .6rem;border-radius:10px;background:rgba(255,255,255,.92);font:600 .76rem/1.3 var(--sans);color:var(--ink)}
.pf-homes .pf-btn{margin-top:1.6rem}
/* faq */
.pf-faq{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(28px,5vw,72px);align-items:start}
.pf-advisor{margin-top:1.6rem;padding:1.5rem;border-radius:var(--r);background:#fff;border:1px solid var(--line);box-shadow:var(--shadow);display:grid;gap:.7rem}
.pf-advisor b{font:500 1.3rem/1.2 var(--serif);color:var(--ink)}.pf-advisor p{color:var(--soft);font-size:.92rem}
.pf-advisor a{display:flex;align-items:center;gap:.6rem;text-decoration:none;font-weight:600;color:var(--ink)}.pf-advisor a svg{width:20px;height:20px;color:var(--gold-deep)}
.pf-advisor a:hover{color:var(--sage)}
.pf-qa details{border-bottom:1px solid var(--line);padding:1.25rem 0}.pf-qa details:first-child{border-top:1px solid var(--line)}
.pf-qa summary{display:flex;justify-content:space-between;gap:1rem;cursor:pointer;list-style:none}.pf-qa summary::-webkit-details-marker{display:none}
.pf-qa summary h3{font:500 1.15rem/1.35 var(--serif)!important;color:var(--ink)}
.pf-qa summary::after{content:"";flex:none;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230c1a2b' stroke-width='2'%3E%3Cpath d='M12 5v14M5 12h14'/%3E%3C/svg%3E") center/14px no-repeat;transition:transform .3s}
.pf-qa details[open] summary::after{transform:rotate(45deg)}.pf-qa details p{margin-top:.7rem;color:var(--soft)}
/* footer */
.pf-footer{background:#081420;color:rgba(244,239,230,.7);padding:clamp(44px,6vw,64px) 0 2rem;font-size:.92rem}
.pf-footer__in{display:grid;grid-template-columns:1.4fr 1fr auto;gap:2rem;align-items:start}
.pf-footer a{color:#fff;text-decoration:none}.pf-footer a:hover{text-decoration:underline}.pf-footer b{color:#fff;font:500 1.3rem/1.2 var(--serif);display:block;margin-bottom:.6rem}
.pf-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:.45rem}
.pf-social{display:flex;gap:.7rem}.pf-social a{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.22);transition:background .2s}.pf-social a:hover{background:rgba(255,255,255,.1)}.pf-social svg{width:19px;height:19px}
.pf-legal{margin-top:2.4rem;padding-top:1.4rem;border-top:1px solid rgba(255,255,255,.1);font-size:.8rem;color:rgba(244,239,230,.5)}
/* ask-an-advisor form (moved to <body> by the script, so it carries its own base styles) */
.pf-card__ask{align-self:flex-start;margin-top:.2rem;padding:0;border:0;background:none;color:var(--sage);font:600 .8rem/1.3 var(--sans);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pf-card__ask:hover{color:var(--ink)}
.pf-modal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;font:400 16px/1.55 var(--sans);color:var(--text);text-align:left;-webkit-font-smoothing:antialiased}
.pf-modal *{box-sizing:border-box}.pf-modal p{margin:0}.pf-modal h2{margin:0;letter-spacing:normal;text-transform:none}
.pf-modal__bg{position:absolute;inset:0;background:rgba(8,16,26,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:pf-fade .25s ease}
.pf-modal__box{position:relative;width:min(640px,100%);max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow:auto;overscroll-behavior:contain;background:var(--cream);border-radius:26px;padding:clamp(24px,4vw,38px);box-shadow:0 40px 80px -30px rgba(0,0,0,.5);animation:pf-pop .3s cubic-bezier(.2,.7,.2,1)}
@keyframes pf-fade{from{opacity:0}}@keyframes pf-pop{from{opacity:0;transform:translateY(16px) scale(.98)}}
.pf-modal__x{position:absolute;right:14px;top:14px;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:#fff;font:400 24px/1 var(--sans);color:var(--ink);cursor:pointer}
.pf-modal__x:hover{background:var(--ink);color:#fff}
.pf-modal__h{font:500 clamp(1.6rem,4vw,2.1rem)/1.15 var(--serif)!important;color:var(--ink);margin:.7rem 0 .6rem!important}
.pf-modal__lead{color:var(--soft);font-size:.95rem}
#pf-ask-form{display:grid;grid-template-columns:1fr 1fr;gap:14px 14px;margin-top:1.4rem}
.pf-f{display:grid;gap:.3rem;min-width:0}.pf-f--full{grid-column:1 / -1}
.pf-f label,.pf-pet legend{font:600 .82rem/1.3 var(--sans);color:var(--ink)}.pf-f label i{color:#b0573a;font-style:normal}.pf-f label span{font-weight:400;color:var(--mut)}
.pf-f input,.pf-f select,.pf-f textarea{width:100%;font:inherit;font-size:16px;padding:.7rem .85rem;border:1px solid rgba(12,26,43,.16);border-radius:12px;background:#fff;color:var(--ink);outline:0;margin:0;box-shadow:none;height:auto}
.pf-f input:focus,.pf-f select:focus,.pf-f textarea:focus{border-color:var(--gold);box-shadow:0 0 0 4px rgba(198,163,90,.18)}
.pf-f textarea{resize:vertical;min-height:80px}.pf-f input[type=date]{min-width:0;max-width:100%;-webkit-appearance:none;appearance:none;min-height:46px;display:block}
.pf-f small{min-height:0;font-size:.78rem;color:#b0573a}.pf-f small:empty{display:none}
.pf-f.is-bad input,.pf-f.is-bad select{border-color:#c8735a}
.pf-pet{display:grid;grid-template-columns:1fr .7fr 1fr;gap:12px;margin:0;padding:14px;border:1px solid var(--mint-line);border-radius:16px;background:var(--mint)}
.pf-pet legend{display:inline-flex;align-items:center;gap:.4rem;padding:0 .4rem;color:var(--sage)}.pf-pet legend .pf-paw{width:1rem;height:1rem}
.pf-consent label{display:flex;gap:.6rem;align-items:flex-start;font-weight:400;color:var(--soft);font-size:.86rem;cursor:pointer}
.pf-consent input{width:18px;height:18px;margin:.15rem 0 0;flex:none;accent-color:var(--sage);padding:0}
.pf-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.pf-form-err{grid-column:1 / -1;padding:.8rem 1rem;border-radius:12px;background:#fbece6;color:#8a3a22;font-size:.9rem}.pf-form-err a{color:inherit;font-weight:600}
.pf-submit{grid-column:1 / -1;padding:.95rem 1.4rem!important;font-size:1rem!important;color:var(--ink)}.pf-submit[disabled]{opacity:.7;cursor:progress}
.pf-modal__alt{grid-column:1 / -1;text-align:center;font-size:.85rem;color:var(--mut)}.pf-modal__alt a{color:var(--ink);font-weight:600}
.pf-ok{text-align:center;display:grid;justify-items:center;gap:.4rem;padding:1rem 0}
.pf-ok__ic{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--mint);color:var(--sage)}.pf-ok__ic .pf-paw{width:32px;height:32px}
.pf-ok__ref{font-size:.85rem;color:var(--mut);margin:.2rem 0 1rem!important}
html.pf-lock,html.pf-lock body{overflow:hidden}
@media (max-width:600px){.pf-modal{padding:0;place-items:end stretch}.pf-modal__box{width:100%;max-height:94vh;max-height:94dvh;border-radius:24px 24px 0 0;padding:26px 18px calc(22px + env(safe-area-inset-bottom))}
#pf-ask-form{grid-template-columns:1fr 1fr;gap:12px}.pf-f:not(.pf-f--full):nth-of-type(n+4){grid-column:1 / -1}.pf-pet{grid-template-columns:1fr 1fr}.pf-pet .pf-f:last-child{grid-column:1 / -1}}
/* reveal */
.pf-js .pf-rv{opacity:0;transform:translateY(22px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.pf-js .pf-rv.is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.pf-js .pf-rv{opacity:1;transform:none}html{scroll-behavior:auto}}
/* responsive */
@media (max-width:1000px){.pf-hero__grid,.pf-homes,.pf-faq{grid-template-columns:1fr}.pf-know__grid{grid-template-columns:1fr 1fr}.pf-mosaic{height:440px}.pf-badge--a{left:10px}.pf-badge--b{right:10px}
.pf-footer__in{grid-template-columns:1fr 1fr}}
@media (max-width:700px){.pf-wrap{width:calc(100% - 32px)}.pf-nav{display:none}.pf-header__in{min-height:60px;justify-content:space-between}.pf-logo img{height:26px}.pf-header .pf-btn{padding:.55rem 1rem;font-size:.84rem}
.pf-hero{padding-top:24px}.pf-hero h1{font-size:2.6rem}.pf-find{margin-top:1.5rem}.pf-find .pf-btn span{display:none}.pf-find .pf-btn{padding:.8rem}
.pf-mosaic{height:360px;grid-template-columns:1.3fr 1fr;gap:10px}.pf-mosaic figure{border-radius:20px}.pf-badge{padding:.55rem .75rem}.pf-badge b{font-size:1.15rem}.pf-badge i{width:32px;height:32px}.pf-badge--b{top:-12px}
.pf-mosaic figcaption{display:none}.pf-arrows{display:none}.pf-dests{grid-auto-columns:72%;padding-inline:16px;margin-inline:-16px}.pf-dest{height:300px}
.pf-know__grid{grid-template-columns:1fr}.pf-know__item{display:grid;grid-template-columns:auto 1fr;gap:0 1rem;padding:1.1rem}.pf-know__item i{margin:0;grid-row:span 2}
.pf-tools{position:static;padding:.6rem 0}.pf-search{flex-basis:100%}.pf-select{flex:1 1 0;padding:.65rem 2rem .65rem .8rem}.pf-shown{flex:1}
.pf-grid{grid-template-columns:1fr;gap:14px}.pf-homes__pics span{font-size:.7rem;padding:.3rem .5rem}
.pf-root:not(.pf-filtering) .pf-country:not(.is-open) .pf-grid{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:82%;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:2px 16px 12px;scroll-padding:0 16px;scrollbar-width:none}
.pf-root:not(.pf-filtering) .pf-country:not(.is-open) .pf-grid::-webkit-scrollbar{display:none}
.pf-root:not(.pf-filtering) .pf-country:not(.is-open) .pf-card{scroll-snap-align:start}.pf-homes{padding:22px}.pf-homes__pics a:nth-child(2n){transform:translateY(14px)}.pf-footer__in{grid-template-columns:1fr}.pf-country{scroll-margin-top:76px}}
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
 var loc=li.querySelector(".pf-card__loc");loc.insertAdjacentHTML("afterbegin",PINH);body.insertAdjacentHTML("beforeend",'<button type="button" class="pf-card__ask" data-ask-hotel>Ask about this hotel\u2019s pet rules</button>');
 var d=D.createElement("div");d.className="pf-card__act";
 d.appendChild(link("pf-btn pf-btn--gold","https://whatahotel.com/booking/showRates.cfm?hotelID="+id+"&checkIn="+ymd(a)+"&checkOut="+ymd(b)+"&guests=2&children=0&rooms=1&"+UTM,"View Rates"));
 d.appendChild(link("pf-btn",nm.href,"Details"));li.appendChild(d);
 li._hay=norm(body.textContent+" "+li.closest(".pf-country").getAttribute("data-country"));li._b=li.querySelector(".pf-card__brand").textContent});
// photos fade in; a photo that fails to load falls back to the original file, then to the paw placeholder
function shown(im){im.classList.add("is-in")}
[].forEach.call(D.querySelectorAll(".pf-card__img img,.pf-mosaic img,.pf-dest img,.pf-homes__pics img"),function(im){if(im.complete&&im.naturalWidth)shown(im);else im.addEventListener("load",function(){shown(im)})});
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
var HOOK="__HOOK__",NOTIFY="__EMAIL__",PHONE="__PHONE__",modal=D.getElementById("pf-ask");
D.body.appendChild(modal);
var form=D.getElementById("pf-ask-form"),errBox=D.getElementById("pf-ask-err"),sendBtn=D.getElementById("pf-ask-send"),lastFocus=null,openedAt=0,subId="",busy=false;
function $i(id){return D.getElementById(id)}function val(id){return($i(id).value||"").trim()}
function escH(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
var HOTELS={},dl=$i("pf-hotels");
cards.forEach(function(li){var nm=li.querySelector(".pf-card__name a"),n=nm.textContent;HOTELS[norm(n)]={id:li.getAttribute("data-id"),name:n,loc:li.querySelector(".pf-card__loc").textContent,country:li.closest(".pf-country").getAttribute("data-country"),url:nm.href.split("?")[0]};
 var o=D.createElement("option");o.value=n;dl.appendChild(o)});
function track(ev,o){try{if(window.dataLayer)window.dataLayer.push(Object.assign({event:ev},o||{}))}catch(x){}}
function openAsk(where){lastFocus=D.activeElement;$i("pf-ask-main").hidden=false;$i("pf-ask-ok").hidden=true;errBox.hidden=true;[].forEach.call(form.querySelectorAll("input,select,textarea"),function(x){if(x.id)fieldErr(x.id,"")});
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
 var note="Please confirm the hotel's pet rules (fee, weight limit, number of pets, room types) and reply to the guest.";
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
function onScroll(){hd.classList.toggle("is-stuck",hd.getBoundingClientRect().top<=0&&(window.scrollY||0)>8)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
var rv=[].slice.call(D.querySelectorAll(".pf-rv"));
if("IntersectionObserver"in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("is-in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});rv.forEach(function(x){io.observe(x)})}
else rv.forEach(function(x){x.classList.add("is-in")});
})();`.replace("__UTM__", UTM).replace("__HOOK__", HOOK).replace("__EMAIL__", EMAIL).replace("__PHONE__", PHONE);

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
<meta property="og:description" content="${esc(`${N} luxury hotels in ${NC} countries that welcome pets.`)}"><meta property="og:image" content="${PET_PHOTO}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preconnect" href="https://wsrv.nl">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<div class="pf-root">
<template id="pf-pin">${ICONS.pin}</template>
<!-- Generated by scripts/build-pet-page.mjs from WhataHotel's Pet-Friendly Luxury Hotels collection (${COLL.source}, read ${COLL.fetched}). Do not edit by hand. -->
<header class="pf-header"><div class="pf-wrap pf-header__in">
  <a class="pf-logo" href="${HOMES_URL}" aria-label="WhataHotel! Homes"><img src="${LOGO}" alt="WhataHotel!" width="133" height="30"></a>
  <nav class="pf-nav" aria-label="Primary"><a href="#destinations">Destinations</a><a href="#browse">All hotels</a><a href="#homes">Villas &amp; homes</a><a href="#faq">FAQ</a></nav>
  <a class="pf-btn pf-btn--ink" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask>Ask an advisor</a>
</div></header>

<main>
<section class="pf-hero"><div class="pf-wrap pf-hero__grid">
  <div class="pf-rv">
    <span class="pf-eyebrow">${PAW}Travel with your pet</span>
    <h1>Pet-Friendly <em>Luxury Hotels</em></h1>
    ${intro[0] ? `<p class="pf-hero__lead">${esc(intro[0])}</p>` : ""}
    <form class="pf-find" id="pf-find" role="search"><span>${ICONS.search}</span><label style="position:absolute;left:-9999px" for="pf-find-q">Search pet-friendly hotels</label>
      <input id="pf-find-q" type="search" placeholder="Where are you going with your pet?" autocomplete="off" enterkeyhint="search">
      <button class="pf-btn pf-btn--gold" type="submit" aria-label="Search">${ICONS.arrow}<span>Search</span></button></form>
    <div class="pf-quick"><span>Popular:</span>${DESTS.slice(0, 5).map((d) => `<a class="pf-chip" href="#browse" data-q="${esc(d.city)}">${esc(d.city)}</a>`).join("")}</div>
  </div>
  <div class="pf-mosaic pf-rv" aria-hidden="true">
    <figure><img src="${esc(img(PET_PHOTO, 900, 1100))}" alt="" width="900" height="1100" fetchpriority="high"></figure>
    ${heroA ? `<figure><img src="${esc(img(heroA.photo, 640, 480))}" alt="" width="640" height="480"><figcaption>${esc(heroA.name)}</figcaption></figure>` : ""}
    ${heroB ? `<figure><img src="${esc(img(heroB.photo, 640, 480))}" alt="" width="640" height="480"><figcaption>${esc(heroB.name)}</figcaption></figure>` : ""}
    <div class="pf-badge pf-badge--a"><i>${PAW}</i><div><b>${N}</b><span>hotels welcome pets</span></div></div>
    <div class="pf-badge pf-badge--b"><i>${ICONS.pin}</i><div><b>${NC}</b><span>countries</span></div></div>
  </div>
</div></section>

<div class="pf-marquee" aria-label="Brands"><div class="pf-marquee__track">${marqueeItems}<span aria-hidden="true" style="display:contents">${marqueeItems.replace(/<button /g, '<button tabindex="-1" ')}</span></div></div>

<section class="pf-sec" id="destinations"><div class="pf-wrap">
  <div class="pf-sec__head pf-rv"><div><span class="pf-eyebrow">${PAW}Top destinations</span><h2 class="pf-h2">Where pets are <em>most welcome</em></h2></div>
    <div class="pf-dest-nav"><p class="pf-lead" style="max-width:36ch">The cities with the most pet-friendly hotels in the collection. Tap one to see them all.</p>
    <div class="pf-arrows"><button type="button" class="pf-arrow" data-dir="-1" aria-label="Previous destinations">${ICONS.arrow}</button><button type="button" class="pf-arrow" data-dir="1" aria-label="Next destinations">${ICONS.arrow}</button></div></div></div>
  <div class="pf-dests pf-rv">${DESTS.map((d) => `<button type="button" class="pf-dest" data-q="${esc(d.city)}"><img src="${esc(img(d.pick.photo, 560, 700))}" alt="${esc(d.pick.name)}" loading="lazy" decoding="async" width="560" height="700"><span class="pf-dest__t"><b>${esc(d.city)}</b><span>${PAW}${d.count} pet-friendly ${d.count === 1 ? "hotel" : "hotels"}</span></span></button>`).join("")}</div>
</div></section>

<section class="pf-wrap"><div class="pf-know pf-rv">
  <span class="pf-eyebrow">${PAW}Before you book</span>
  <h2 class="pf-h2" style="margin-top:.9rem;max-width:18ch">Every pet rule, <em>confirmed for you</em></h2>
  ${intro[1] ? `<p class="pf-lead" style="margin-top:1rem">${esc(intro[1])}</p>` : ""}
  <div class="pf-know__grid">${knowItems.map(([k, t, d]) => `<div class="pf-know__item"><i>${ICONS[k]}</i><b>${t}</b><p>${d}</p></div>`).join("")}</div>
  <div class="pf-know__foot"><a class="pf-btn pf-btn--gold" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask>${ICONS.mail}Ask an advisor</a><a class="pf-btn" href="tel:${PHONE.replace(/[^+\d]/g, "")}">${ICONS.phone}${PHONE}</a></div>
</div></section>

<section class="pf-sec" id="browse" style="padding-bottom:0">
  <div class="pf-wrap pf-sec__head pf-rv"><div><span class="pf-eyebrow">${PAW}The full collection</span><h2 class="pf-h2">All ${N} <em>pet-friendly hotels</em></h2></div>
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

<section class="pf-sec" id="homes"><div class="pf-wrap"><div class="pf-homes pf-rv">
  <div><span class="pf-eyebrow" style="color:var(--sage)">${PAW}Villas, residences &amp; homes</span>
    <h2 class="pf-h2" style="margin:.9rem 0 1rem">Prefer a villa? <em>Bring the whole family.</em></h2>
    <p class="pf-lead">${homesPetCount} villas, residences and homes in the WhataHotel! Homes collection welcome pets, each with its pet policy from the property's own page.</p>
    <a class="pf-btn pf-btn--ink" href="${HOMES_URL}">See pet-friendly homes ${ICONS.arrow}</a></div>
  <div class="pf-homes__pics">${petHomes.map((p) => `<a href="${HOMES_URL}"><img src="${esc(img(W.WAH_IMAGES[p.id].hero, 520, 390))}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="520" height="390"><span>${esc(p.name)}</span></a>`).join("")}</div>
</div></div></section>

<section class="pf-sec" id="faq" style="padding-top:0"><div class="pf-wrap pf-faq">
  <div class="pf-rv"><span class="pf-eyebrow">${PAW}Good to know</span><h2 class="pf-h2" style="margin-top:.9rem">Questions, <em>answered</em></h2>
    <div class="pf-advisor"><b>Talk to an advisor</b><p>We'll confirm the pet rules for your dates and your pet before you book.</p>
      <a class="pf-btn pf-btn--gold" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry" data-ask style="justify-self:start;color:var(--ink)">${ICONS.mail}Send a request</a>
      <a href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry">${ICONS.mail}${EMAIL}</a><a href="tel:${PHONE.replace(/[^+\d]/g, "")}">${ICONS.phone}${PHONE}</a></div></div>
  <div class="pf-qa pf-rv">${FAQ.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join("")}</div>
</div></section>
</main>

<div class="pf-modal" id="pf-ask" hidden>
  <div class="pf-modal__bg" data-close></div>
  <div class="pf-modal__box" role="dialog" aria-modal="true" aria-labelledby="pf-ask-t" tabindex="-1">
    <button type="button" class="pf-modal__x" data-close aria-label="Close">&times;</button>
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
