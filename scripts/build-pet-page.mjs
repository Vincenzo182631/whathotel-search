/*
 * build-pet-page.mjs — writes pet-friendly.html, the standalone "Pet-Friendly Luxury Hotels"
 * page for https://pro.whatahotel.com/pet-friendly (paste into a GoHighLevel Custom Code
 * element, like gohighlevel.html for /homes).
 *
 * Content comes only from WhataHotel:
 *   scripts/pet-collection.json — every hotel on whatahotel.com/collection/pet-friendly-luxury-hotels.html
 *     (name, brand program, country, state/region, city) and its intro paragraphs;
 *   assets/js/pets.js + data.js — the Homes-page properties that welcome pets (for the
 *     "villas & residences" callout and tags).
 * The hotel list is written into the HTML (readable without JavaScript and by search
 * engines); a small script adds search, a country filter and dated "View Rates" links.
 *
 * Run: node scripts/build-pet-page.mjs   (part of npm run build)
 */
import { readFileSync, writeFileSync } from "node:fs";
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
const HERO_IMG = "https://wsrv.nl/?url=" + encodeURIComponent("www.whatahotel.com/content/pets_header.jpg") + "&w=1800&output=webp&q=70";
const LOGO = "https://wsrv.nl/?url=ssl:assets.cdn.filesafe.space/fBHK0xDUEFQL6rOoyKnY/media/6a237895da24932f122f104e.png&h=88&output=webp";

const COLL = JSON.parse(read("scripts/pet-collection.json"));
const W = load("assets/js/data.js", "assets/js/pets.js", "assets/js/mo-homes-index.js");
const PETS = W.WAH_PETS || {};
const homesIds = new Set((W.WAH_PROPERTIES || []).map((p) => p.id));
const homesPetCount = Object.values(PETS).filter((v) => v.ok).length;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// "Autograph Collection under the Marriott Luminous Program" → "Autograph Collection"
const brandOf = (program) => program.split(/\s+under\s+/i)[0].replace(/\s+(programs?|progams?)$/i, "").replace(/[\s,;]+$/, "").replace(/^ALiLa$/, "Alila").trim();
const hotelUrl = (h) => `https://whatahotel.com/hotels/${h.id}/${h.slug}.html?${UTM}`;

const hotels = COLL.hotels;
const countries = [];
hotels.forEach((h) => { if (!countries.includes(h.country)) countries.push(h.country); });
const byCountry = Object.fromEntries(countries.map((c) => [c, hotels.filter((h) => h.country === c)]));
const N = hotels.length, NC = countries.length;

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

/* ---------- the list, grouped country → state/region → city (as on WhataHotel) ---------- */
function hotelRow(h) {
  // One link per hotel in the HTML (the name — readable by search engines and without JS);
  // the page script adds the View Rates / Hotel Details buttons from it, which keeps the
  // file under GoHighLevel's 1 MB custom-code limit.
  const inHomes = homesIds.has(h.id);
  return `<li class="pf-hotel" data-id="${h.id}"><div class="pf-hotel__main"><a class="pf-hotel__name" href="${esc(hotelUrl(h))}">${esc(h.name)}</a>` +
    `<span class="pf-hotel__meta">${esc(brandOf(h.program))}${inHomes ? ` · <a class="pf-tag" href="${HOMES_URL}">Villas &amp; residences</a>` : ""}</span></div></li>`;
}
function countrySection(c) {
  const list = byCountry[c];
  const groups = [];
  list.forEach((h) => {
    const key = (h.region || "") + "|" + (h.city || "");
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, region: h.region, city: h.city, items: [] }));
    g.items.push(h);
  });
  let lastRegion = null;
  const inner = groups.map((g) => {
    const head = (g.region && g.region !== lastRegion ? `<h3 class="pf-region">${esc(g.region)}</h3>` : "") + `<h4 class="pf-city">${esc(g.city)}</h4>`;
    lastRegion = g.region;
    return `<div class="pf-group" data-hay="${esc([g.city, g.region, c].filter(Boolean).join(" "))}">${head}<ul class="pf-list">${g.items.map(hotelRow).join("")}</ul></div>`;
  }).join("");
  return `<section class="pf-country" id="${slug(c)}" data-country="${esc(c)}"><h2>${esc(c)} <span class="pf-count">${list.length} ${list.length === 1 ? "hotel" : "hotels"}</span></h2>${inner}</section>`;
}

/* ---------- structured data ---------- */
const ld = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage", "@id": PAGE_URL + "#page", url: PAGE_URL, name: "Pet-Friendly Luxury Hotels",
      description: `${N} luxury hotels in ${NC} countries that welcome pets, bookable through WhataHotel! by Lorraine Travel.`,
      isPartOf: { "@type": "WebSite", url: "https://pro.whatahotel.com", name: "WhataHotel!" },
      provider: { "@type": "TravelAgency", name: "WhataHotel! by Lorraine Travel", url: "https://www.whatahotel.com", telephone: PHONE, email: EMAIL },
      dateModified: COLL.fetched, mainEntity: { "@id": PAGE_URL + "#hotels" } },
    { "@type": "ItemList", "@id": PAGE_URL + "#hotels", name: "Pet-friendly luxury hotels", numberOfItems: N,
      itemListElement: hotels.map((h, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Hotel", name: h.name,
        url: `https://whatahotel.com/hotels/${h.id}/${h.slug}.html`, petsAllowed: true,
        address: Object.assign({ "@type": "PostalAddress", addressLocality: h.city, addressCountry: h.country }, h.region ? { addressRegion: h.region } : {}) } })) },
    { "@type": "FAQPage", "@id": PAGE_URL + "#faq", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ],
};

const intro = COLL.intro.length ? COLL.intro : [];
const PAW = '<svg class="pf-paw" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="10" r="2.2"/><circle cx="9.5" cy="5.8" r="2.2"/><circle cx="14.5" cy="5.8" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M12 11.5c-3 0-6 4.3-6 6.5 0 1.6 1.3 2.5 3 2.5 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-.9 3-2.5 0-2.2-3-6.5-6-6.5z"/></svg>';

const CSS = `
:root{--ink:#0c1a2b;--ink-2:#12263d;--sand:#f6f1e7;--cream:#fbf9f4;--paper:#fff;--gold:#c6a35a;--gold-2:#e3c887;--gold-deep:#9c7c3a;--pet:#2f5d46;--pet-bg:#eaf3ec;--pet-line:#c9dfcf;
--line:rgba(12,26,43,.10);--text:#1b2b3a;--text-soft:#4d5f70;--text-mut:#728394;--serif:"Fraunces",Georgia,"Times New Roman",serif;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}[hidden]{display:none!important}
.pf-root{background:var(--cream);color:var(--text);font:400 16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;text-align:left}
.pf-root p{line-height:1.6;margin-top:0}.pf-root h1,.pf-root h2,.pf-root h3,.pf-root h4{letter-spacing:normal;text-transform:none}
.pf-root .pf-region{text-transform:uppercase;letter-spacing:.14em}
/* GoHighLevel wraps custom code in a section, row and column with padding: let the page run edge to edge. */
.c-section:has(.pf-root),.c-row:has(.pf-root),.c-column:has(.pf-root),.c-custom-code:has(.pf-root){padding:0!important;margin:0!important;max-width:none!important}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--text);font:400 16px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit}.pf-wrap{width:min(1120px,100% - 32px);margin-inline:auto}
.pf-header{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line)}
.pf-header__in{display:flex;align-items:center;gap:1rem;min-height:64px}.pf-logo img{display:block;height:30px;width:auto}
.pf-nav{display:flex;gap:1.2rem;margin-left:auto;font-size:.92rem}.pf-nav a{text-decoration:none;color:var(--text-soft)}.pf-nav a:hover{color:var(--ink)}
.pf-cta{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem 1.1rem;border-radius:999px;background:linear-gradient(145deg,var(--gold-2),var(--gold));color:var(--ink);font-weight:700;font-size:.9rem;text-decoration:none;white-space:nowrap}
.pf-hero{position:relative;color:#fff;background:var(--ink) center/cover no-repeat;padding:clamp(56px,9vw,110px) 0 clamp(48px,7vw,80px)}
.pf-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,16,26,.55),rgba(8,16,26,.78))}
.pf-hero .pf-wrap{position:relative}.pf-eyebrow{display:inline-flex;align-items:center;gap:.45rem;font-size:.76rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-2)}
.pf-eyebrow .pf-paw{width:1rem;height:1rem}.pf-hero h1{font:500 clamp(2.2rem,5.5vw,3.8rem)/1.08 var(--serif);margin:.5rem 0 1rem;max-width:16ch}
.pf-hero p{max-width:68ch;margin:0 0 .9rem;color:rgba(255,255,255,.88);font-size:1.02rem}
.pf-stats{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1.3rem}.pf-stat{padding:.4rem .9rem;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);font-size:.88rem}
.pf-tools{position:sticky;top:64px;z-index:15;background:rgba(251,249,244,.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.pf-tools__in{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;padding:.8rem 0}
.pf-search{flex:1 1 260px;display:flex;align-items:center;gap:.5rem;background:#fff;border:1px solid var(--line);border-radius:14px;padding:0 .9rem}
.pf-search:focus-within{border-color:var(--gold);box-shadow:0 0 0 4px rgba(198,163,90,.18)}.pf-search svg{width:18px;height:18px;color:var(--gold-deep);flex:none}
.pf-search input{flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:16px;padding:.75rem 0;min-width:0}
.pf-select{flex:0 1 220px;font:inherit;font-size:16px;padding:.72rem .9rem;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--text)}
.pf-shown{font-size:.88rem;color:var(--text-mut);white-space:nowrap}
.pf-callout{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem 1.2rem;margin:1.6rem 0 0;padding:1rem 1.2rem;border-radius:16px;background:var(--pet-bg);border:1px solid var(--pet-line);color:var(--pet)}
.pf-callout .pf-paw{width:1.4rem;height:1.4rem;flex:none}.pf-callout p{margin:0;flex:1 1 320px}.pf-callout a{font-weight:700}
.pf-index{display:flex;flex-wrap:wrap;gap:.4rem;margin:1.6rem 0 .4rem}.pf-index a{padding:.3rem .7rem;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:.82rem;text-decoration:none;color:var(--text-soft)}
.pf-index a:hover{border-color:var(--gold);color:var(--ink)}.pf-index b{color:var(--ink);font-weight:600}
.pf-country{margin:2.4rem 0 0;scroll-margin-top:140px}.pf-country h2{font:500 clamp(1.5rem,3vw,2rem)/1.2 var(--serif);color:var(--ink);margin:0 0 .4rem;padding-bottom:.6rem;border-bottom:1px solid var(--line)}
.pf-count{font:500 .85rem var(--sans);color:var(--text-mut);margin-left:.4rem}
.pf-region{font:700 .78rem var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep);margin:1.4rem 0 .2rem}
.pf-city{font:600 1rem var(--sans);color:var(--ink);margin:.9rem 0 .3rem}
.pf-list{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}
.pf-hotel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.6rem 1rem;padding:.8rem 1rem;background:#fff;border:1px solid var(--line);border-radius:14px}
.pf-hotel__main{flex:1 1 320px;min-width:0;display:flex;flex-direction:column}.pf-hotel__name{font-weight:600;color:var(--ink);text-decoration:none}.pf-hotel__name:hover{text-decoration:underline}
.pf-hotel__meta{font-size:.85rem;color:var(--text-mut)}.pf-tag{color:var(--pet);font-weight:600;text-decoration:none}.pf-tag:hover{text-decoration:underline}
.pf-hotel__actions{display:flex;gap:.45rem;flex:none}
.pf-btn{display:inline-flex;align-items:center;padding:.5rem .9rem;border-radius:999px;border:1px solid var(--line);background:#fff;font-size:.85rem;font-weight:600;text-decoration:none;color:var(--ink);white-space:nowrap}
.pf-btn:hover{border-color:var(--gold)}.pf-btn--gold{background:linear-gradient(145deg,var(--gold-2),var(--gold));border-color:transparent}
.pf-empty{margin:2rem 0;padding:1.2rem;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--text-soft)}
.pf-faq{margin:3.5rem 0 0;padding:clamp(28px,4vw,44px);background:#fff;border-radius:22px;border:1px solid var(--line)}
.pf-faq h2{font:500 clamp(1.5rem,3vw,2rem)/1.2 var(--serif);margin:0 0 1rem;color:var(--ink)}
.pf-faq details{border-top:1px solid var(--line);padding:.9rem 0}.pf-faq summary{cursor:pointer;list-style:none}.pf-faq summary::-webkit-details-marker{display:none}
.pf-faq summary h3{display:inline;font:600 1.02rem var(--sans);color:var(--ink)}.pf-faq summary::after{content:"+";float:right;color:var(--gold-deep);font-weight:700}
.pf-faq details[open] summary::after{content:"–"}.pf-faq p{margin:.6rem 0 0;color:var(--text-soft)}
.pf-footer{margin-top:4rem;background:#081420;color:rgba(244,239,230,.72);padding:2.6rem 0 2rem;font-size:.9rem}
.pf-footer__in{display:flex;flex-wrap:wrap;gap:1.2rem 2rem;align-items:center;justify-content:space-between}.pf-footer a{color:#fff;text-decoration:none}.pf-footer a:hover{text-decoration:underline}
.pf-social{display:flex;gap:.8rem}.pf-social a{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25)}.pf-social svg{width:18px;height:18px}
.pf-filtering .pf-index,.pf-filtering .pf-callout,.pf-filtering .pf-count{display:none}
@media (max-width:700px){.pf-nav{display:none}.pf-header__in{min-height:56px}.pf-cta{margin-left:auto;padding:.5rem .9rem;font-size:.85rem}.pf-hero p{font-size:.95rem}
.pf-tools{position:static}.pf-tools__in{gap:.5rem;padding:.7rem 0}.pf-search{flex-basis:100%}.pf-select{flex:1 1 auto;padding:.6rem .8rem}
.pf-hotel{padding:.75rem .85rem}.pf-hotel__actions{width:100%}.pf-hotel__actions .pf-btn{flex:1;justify-content:center}.pf-country{scroll-margin-top:70px}}
`;

const JS = `(function(){"use strict";
try{if(!(window.CSS&&CSS.supports&&CSS.supports("selector(:has(*))"))){var e=document.querySelector(".pf-root");while(e&&e.parentElement&&e.parentElement!==document.body){e=e.parentElement;if(/\\bc-(section|row|column|custom-code)\\b/.test(e.className)){e.style.padding="0";e.style.margin="0";e.style.maxWidth="none"}}}}catch(x){}
var UTM=${JSON.stringify(UTM)};
function pad(n){return(n<10?"0":"")+n}function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
var a=new Date();a.setDate(a.getDate()+21);var b=new Date();b.setDate(b.getDate()+23);
function btn(cls,href,label){var x=document.createElement("a");x.className=cls;x.href=href;x.target="_blank";x.rel="noopener";x.textContent=label;return x}
[].forEach.call(document.querySelectorAll(".pf-hotel"),function(li){var nm=li.querySelector(".pf-hotel__name"),id=li.getAttribute("data-id");nm.target="_blank";nm.rel="noopener";
var d=document.createElement("div");d.className="pf-hotel__actions";
d.appendChild(btn("pf-btn pf-btn--gold","https://whatahotel.com/booking/showRates.cfm?hotelID="+id+"&checkIn="+ymd(a)+"&checkOut="+ymd(b)+"&guests=2&children=0&rooms=1&"+UTM,"View Rates"));
d.appendChild(btn("pf-btn",nm.href,"Hotel Details"));li.appendChild(d)});
var input=document.getElementById("pf-q"),sel=document.getElementById("pf-country"),shown=document.getElementById("pf-shown"),empty=document.getElementById("pf-empty");
var rows=[].slice.call(document.querySelectorAll(".pf-hotel")),groups=[].slice.call(document.querySelectorAll(".pf-group")),secs=[].slice.call(document.querySelectorAll(".pf-country"));
function norm(s){s=String(s||"").toLowerCase();return s.normalize?s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,""):s}
rows.forEach(function(r){r._hay=norm(r.querySelector(".pf-hotel__main").textContent+" "+r.closest(".pf-group").getAttribute("data-hay"))});
function apply(){var words=norm(input.value).split(/\\s+/).filter(Boolean),c=sel.value,n=0;
secs.forEach(function(s){s._show=!c||s.getAttribute("data-country")===c});
rows.forEach(function(r){var sec=r.closest(".pf-country");var ok=sec._show&&words.every(function(w){return r._hay.indexOf(w)!==-1});r.hidden=!ok;if(ok)n++});
groups.forEach(function(g){g.hidden=!g.querySelector(".pf-hotel:not([hidden])")});
secs.forEach(function(s){s.hidden=!s.querySelector(".pf-hotel:not([hidden])")});
shown.textContent=n+(n===1?" hotel":" hotels");empty.hidden=n!==0;document.body.classList.toggle("pf-filtering",!!(words.length||c));
try{if(window.dataLayer&&words.length)window.dataLayer.push({event:"pet_page_search",results:n})}catch(e){}}
var t;input.addEventListener("input",function(){clearTimeout(t);t=setTimeout(apply,120)});sel.addEventListener("change",function(){apply();if(sel.value){var s=document.getElementById(sel.options[sel.selectedIndex].getAttribute("data-id"));if(s)s.scrollIntoView({block:"start"})}});
document.getElementById("pf-form").addEventListener("submit",function(e){e.preventDefault();apply();var first=document.querySelector(".pf-hotel:not([hidden])");if(first)first.closest(".pf-country").scrollIntoView({block:"start"})});
})();`;

const IG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
const FB = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9z"/></svg>';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Pet-Friendly Luxury Hotels | WhataHotel! by Lorraine Travel</title>
<meta name="description" content="${esc(`${N} luxury hotels in ${NC} countries that welcome dogs and cats, from Four Seasons and The Ritz-Carlton to Kimpton and Park Hyatt. Live rates and preferred-partner perks through WhataHotel!.`)}">
<link rel="canonical" href="${PAGE_URL}">
<meta property="og:type" content="website"><meta property="og:url" content="${PAGE_URL}"><meta property="og:title" content="Pet-Friendly Luxury Hotels | WhataHotel!">
<meta property="og:description" content="${esc(`${N} luxury hotels in ${NC} countries that welcome pets.`)}"><meta property="og:image" content="https://www.whatahotel.com/content/pets_header.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<div class="pf-root">
<!-- Generated by scripts/build-pet-page.mjs from WhataHotel's Pet-Friendly Luxury Hotels collection (${COLL.source}, read ${COLL.fetched}). Do not edit by hand. -->
<header class="pf-header"><div class="pf-wrap pf-header__in">
  <a class="pf-logo" href="${HOMES_URL}" aria-label="WhataHotel! Homes"><img src="${LOGO}" alt="WhataHotel!" width="133" height="30"></a>
  <nav class="pf-nav" aria-label="Primary"><a href="${HOMES_URL}">Homes &amp; Villas</a><a href="#hotels">Pet-friendly hotels</a><a href="#faq">FAQ</a></nav>
  <a class="pf-cta" href="mailto:${EMAIL}?subject=Pet-friendly%20hotel%20inquiry">Ask an advisor</a>
</div></header>

<main>
<section class="pf-hero" style="background-image:url('${HERO_IMG}')"><div class="pf-wrap">
  <span class="pf-eyebrow">${PAW}Travel with your pet</span>
  <h1>Pet-Friendly Luxury Hotels</h1>
  ${intro.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  <div class="pf-stats"><span class="pf-stat"><b>${N}</b> hotels</span><span class="pf-stat"><b>${NC}</b> countries</span><span class="pf-stat"><b>${homesPetCount}</b> pet-friendly villas &amp; residences</span></div>
</div></section>

<div class="pf-tools" id="hotels"><div class="pf-wrap"><form class="pf-tools__in" id="pf-form" role="search">
  <label class="pf-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    <span class="visually-hidden" style="position:absolute;left:-9999px">Search pet-friendly hotels</span>
    <input id="pf-q" type="search" placeholder="Hotel, city, country or brand" autocomplete="off" enterkeyhint="search"></label>
  <select id="pf-country" class="pf-select" aria-label="Country"><option value="">All ${NC} countries</option>${countries.map((c) => `<option value="${esc(c)}" data-id="${slug(c)}">${esc(c)} (${byCountry[c].length})</option>`).join("")}</select>
  <span class="pf-shown" id="pf-shown" aria-live="polite">${N} hotels</span>
</form></div></div>

<div class="pf-wrap">
  <div class="pf-callout">${PAW}<p>Prefer a villa or residence? <b>${homesPetCount}</b> homes, villas and residences in the WhataHotel! Homes collection welcome pets, each with its pet policy.</p><a href="${HOMES_URL}">See pet-friendly homes →</a></div>
  <nav class="pf-index" aria-label="Countries">${countries.map((c) => `<a href="#${slug(c)}">${esc(c)} <b>${byCountry[c].length}</b></a>`).join("")}</nav>
  <p class="pf-empty" id="pf-empty" hidden>No pet-friendly hotels match that search. Try a city, country or brand, or <a href="mailto:${EMAIL}">ask an advisor</a>.</p>
  ${countries.map(countrySection).join("\n")}

  <section class="pf-faq" id="faq" aria-labelledby="pf-faq-t"><h2 id="pf-faq-t">Frequently asked questions</h2>
  ${FAQ.map(([q, a]) => `<details><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join("\n  ")}
  </section>
</div>
</main>

<footer class="pf-footer"><div class="pf-wrap pf-footer__in">
  <div><b style="color:#fff">WhataHotel! by Lorraine Travel</b><br><a href="mailto:${EMAIL}">${EMAIL}</a> · <a href="tel:${PHONE.replace(/[^+\d]/g, "")}">${PHONE}</a><br><a href="${HOMES_URL}">Homes &amp; Villas</a> · <a href="#hotels">Pet-friendly hotels</a></div>
  <div class="pf-social"><a href="${SOCIAL.instagram}" target="_blank" rel="noopener" aria-label="WhataHotel! on Instagram">${IG}</a><a href="${SOCIAL.facebook}" target="_blank" rel="noopener" aria-label="WhataHotel! on Facebook">${FB}</a></div>
  <div style="width:100%;font-size:.8rem">© ${new Date().getFullYear()} WhataHotel! by Lorraine Travel. Pet rules are set by each hotel and can change; an advisor confirms the details for your pet before you book.</div>
</div></footer>
</div>
<script>${JS}</script>
</body>
</html>
`;
writeFileSync(join(root, "pet-friendly.html"), html);
console.log(`Wrote pet-friendly.html (${Buffer.byteLength(html)} bytes): ${N} hotels in ${NC} countries; ${homesPetCount} pet-friendly homes on /homes`);
