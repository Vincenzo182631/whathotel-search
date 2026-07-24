/* =====================================================================
   WhataHotel! — Homes landing page behaviour
   - Renders featured rail + full searchable/filterable directory
   - Generates premium SVG "scene" artwork (no external image requests)
   - Fires analytics events (GTM/dataLayer compatible)
   - Preserves the real property links to whatahotel.com
   ===================================================================== */
(function () {
  "use strict";

  var PROPS = (window.WAH_PROPERTIES || []).slice();
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* -----------------------------------------------------------------
     Analytics — push to dataLayer (Google Tag Manager) with a safe
     fallback. Every conversion-relevant interaction is tracked.
     ----------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var payload = Object.assign({ event: event }, params || {});
    try { window.dataLayer.push(payload); } catch (e) {}
    // gtag fallback if present
    if (typeof window.gtag === "function") {
      try { window.gtag("event", event, params || {}); } catch (e) {}
    }
    if (window.WAH_DEBUG) console.log("[track]", event, params || {});
  }
  // expose for inline handlers
  window.wahTrack = track;

  /* -----------------------------------------------------------------
     Property link builder — REAL WhataHotel individual pages.
     Adds `stayType=homes` so the destination page can prioritise
     residential inventory (see homes-inventory-filter.js), plus
     campaign params so paid traffic is attributable end-to-end.
     ----------------------------------------------------------------- */
  var UTM = "utm_source=homes_landing&utm_medium=referral&utm_campaign=homes_directory";

  // Canonical individual WhataHotel property page (photos, description, etc.).
  function buildPropertyUrl(p) {
    var url = p.url || ("https://whatahotel.com/hotels/" + p.id + "/index.html");
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "stayType=homes&" + UTM;
  }

  // "Check Availability" — the EXISTING WhataHotel availability endpoint with
  // type=homes. This is the same entry point the live Homes page uses ("View
  // Rates"): the server searches the property's Amadeus inventory and returns
  // only units whose actual room/unit description matches the approved
  // residential keywords (residence, home, villa, …). We never determine
  // eligibility from the hotel name — we hand off to that existing system.
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function buildAvailabilityUrl(p) {
    var inD = new Date(); inD.setDate(inD.getDate() + 21);
    var outD = new Date(); outD.setDate(outD.getDate() + 23);
    return "https://whatahotel.com/booking/showRates.cfm?hotelID=" + p.id +
      "&checkIn=" + ymd(inD) + "&checkOut=" + ymd(outD) +
      "&guests=2&children=0&rooms=1&type=homes&" + UTM;
  }

  /* -----------------------------------------------------------------
     SVG scene artwork — a small parametric illustration per scene key.
     Instant to render, crisp at any size, and impossible to 404.
     If a property later gets a real `image`, it is used instead and
     the scene becomes the fallback (see renderMedia).
     ----------------------------------------------------------------- */
  var uid = 0;
  function sceneSVG(key) {
    var id = "s" + (++uid);
    var skies = {
      beach:       ["#a7d8e6", "#dff0e4", "#f3e6c8"],
      tropical:    ["#79c6bf", "#bfe0cf", "#eadfb0"],
      mountain:    ["#aec6df", "#d7e2ec", "#f1f4f6"],
      city:        ["#243d57", "#3c5f80", "#d79a63"],
      desert:      ["#f2cf8f", "#eab97c", "#cf8452"],
      countryside: ["#b4d29f", "#d7e7c4", "#eae3bd"]
    };
    var sky = skies[key] || skies.beach;
    var sun = key === "city"
      ? '<circle cx="300" cy="70" r="26" fill="#f6f0e6" opacity=".9"/>'
      : '<circle cx="300" cy="72" r="30" fill="url(#sun' + id + ')"/>';

    var fg = "";
    if (key === "beach") {
      fg = '<rect y="150" width="400" height="120" fill="#2f8bb0"/>' +
           '<path d="M0 168 Q100 158 200 168 T400 168 V270 H0 Z" fill="#3a9ec6" opacity=".7"/>' +
           '<path d="M0 200 Q200 180 400 200 V270 H0 Z" fill="#efdcae"/>' +
           '<path d="M0 224 Q200 210 400 224 V270 H0 Z" fill="#e6cd93"/>';
    } else if (key === "tropical") {
      fg = '<rect y="158" width="400" height="112" fill="#2c9c94"/>' +
           '<path d="M0 210 Q200 188 400 210 V270 H0 Z" fill="#e3d19a"/>' +
           palm(60, 205) + palm(340, 200);
    } else if (key === "mountain") {
      fg = '<path d="M0 200 L90 110 L150 175 L230 95 L320 190 L400 140 V270 H0 Z" fill="#7d94ac"/>' +
           '<path d="M0 230 L120 150 L210 215 L300 150 L400 220 V270 H0 Z" fill="#5c7590"/>' +
           '<path d="M230 95 l22 26 l-44 0 Z" fill="#f2f5f8"/><path d="M90 110 l18 22 l-36 0 Z" fill="#f2f5f8"/>' +
           '<path d="M0 246 Q200 236 400 246 V270 H0 Z" fill="#cfd8b6"/>';
    } else if (key === "city") {
      fg = building(30, 150, 44, 120, "#20374e") + building(84, 120, 40, 150, "#284461") +
           building(132, 170, 52, 100, "#1c3149") +
           building(196, 100, 46, 170, "#2b4a68") + building(252, 160, 40, 110, "#20384f") +
           building(302, 130, 54, 140, "#284461") +
           '<rect y="250" width="400" height="20" fill="#12263d"/>';
    } else if (key === "desert") {
      fg = '<path d="M0 190 Q120 150 250 190 T400 180 V270 H0 Z" fill="#d68a52"/>' +
           '<path d="M0 220 Q160 186 320 222 T400 216 V270 H0 Z" fill="#c2743f"/>' +
           '<path d="M180 190 q6 -40 14 0 z" fill="#3f6b48"/><path d="M176 190 q18 -18 14 6 z" fill="#3f6b48"/>';
    } else { // countryside
      fg = '<path d="M0 175 Q130 140 260 175 T400 165 V270 H0 Z" fill="#8fb676"/>' +
           '<path d="M0 210 Q160 182 320 212 T400 206 V270 H0 Z" fill="#75a35c"/>' +
           '<rect x="250" y="150" width="46" height="34" fill="#b8623f"/><path d="M248 150 l25 -18 l25 18 z" fill="#8f4a30"/>';
    }

    return '' +
      '<svg class="scene-svg" viewBox="0 0 400 270" preserveAspectRatio="xMidYMid slice" ' +
      'role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="sky' + id + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + sky[0] + '"/>' +
            '<stop offset="0.55" stop-color="' + sky[1] + '"/>' +
            '<stop offset="1" stop-color="' + sky[2] + '"/>' +
          '</linearGradient>' +
          '<radialGradient id="sun' + id + '" cx="0.4" cy="0.4" r="0.6">' +
            '<stop offset="0" stop-color="#fff6df"/>' +
            '<stop offset="0.6" stop-color="#ffe6ad"/>' +
            '<stop offset="1" stop-color="#ffe6ad" stop-opacity="0"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<rect width="400" height="270" fill="url(#sky' + id + ')"/>' +
        sun + fg +
        '<rect width="400" height="270" fill="url(#sky' + id + ')" opacity="0.06"/>' +
      '</svg>';

    function palm(x, base) {
      return '<g fill="#1f5f52">' +
        '<path d="M' + x + ' ' + base + ' q3 -34 -1 -50 q5 12 4 50 z"/>' +
        '<path d="M' + x + ' ' + (base - 46) + ' q-26 -8 -40 4 q22 -18 40 -4z"/>' +
        '<path d="M' + x + ' ' + (base - 46) + ' q26 -8 40 4 q-22 -18 -40 -4z"/>' +
        '<path d="M' + x + ' ' + (base - 46) + ' q-18 -20 -34 -22 q18 4 34 22z"/>' +
        '<path d="M' + x + ' ' + (base - 46) + ' q18 -20 34 -22 q-18 4 -34 22z"/>' +
      '</g>';
    }
    function building(x, y, w, h, c) {
      var win = '';
      for (var wy = y + 10; wy < y + h - 6; wy += 18) {
        for (var wx = x + 6; wx < x + w - 6; wx += 14) {
          win += '<rect x="' + wx + '" y="' + wy + '" width="6" height="9" fill="#f4e4b8" opacity="0.5"/>';
        }
      }
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>' + win;
    }
  }

  /* -----------------------------------------------------------------
     Filtering axes — derived from AUTHORITATIVE property data, never from
     guessing residential inventory by name:
       • REGIONS  — the property's real country grouped into 6 regions
       • BRANDS   — the property's real collection/brand
     Both come pre-computed (with counts) from data.js.
     ----------------------------------------------------------------- */
  var REGIONS = (window.WAH_REGIONS || []).slice();
  var BRANDS = (window.WAH_BRANDS || []).slice();
  // Short region labels for compact badges.
  var REGION_SHORT = {
    "north-america": "North America",
    "latam-caribbean": "Latin America & Caribbean",
    "europe": "Europe",
    "asia": "Asia",
    "mea": "Middle East & Africa",
    "pacific": "Pacific & Indian Ocean"
  };
  var REGION_BADGE = {
    "north-america": "North America", "latam-caribbean": "Caribbean & LatAm", "europe": "Europe",
    "asia": "Asia", "mea": "Middle East & Africa", "pacific": "Pacific & Indian Ocean"
  };

  /* ---- Hotel-style line icons (inline SVG, currentColor) ---- */
  function ic(paths) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICONS = {
    all:          ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15 0 18M12 3c-2.6 2.7-2.6 15 0 18"/>'),
    villa:        ic('<path d="M3 20h18M5 20v-8l7-5 7 5v8M9 20v-5h6v5"/><path d="M2 12l10-7 10 7"/>'),
    residence:    ic('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>'),
    home:         ic('<path d="M3 11l9-8 9 8M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'),
    estate:       ic('<path d="M2 21h20M4 21V9l4-2M20 21V9l-4-2M8 7V4l4-2 4 2v3M8 21V11h8v10M11 14h2"/>'),
    beachfront:   ic('<path d="M3 18c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/><path d="M12 14V5M12 5c3 0 5 2 5 4H7c0-2 2-4 5-4z"/>'),
    mountain:     ic('<path d="M3 20l6-11 4 6 2-3 6 8z"/><path d="M9 9l1.5 2.5"/>'),
    family:       ic('<circle cx="8" cy="8" r="2.4"/><circle cx="16" cy="9" r="2"/><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M14 20c0-2 1-3.6 2.6-3.6S19 17 19 20"/>'),
    "multi-bedroom": ic('<path d="M3 18v-5a2 2 0 012-2h14a2 2 0 012 2v5M3 14V8M21 18v-4M7 11V9a1 1 0 011-1h3M13 11V9a1 1 0 011-1h3"/>'),
    kitchen:      ic('<path d="M8 3v6a3 3 0 01-3 3 3 3 0 003 3v6M6 3v4M10 3v4M16 3c-1.5 0-2 2-2 4s.5 4 2 5v9"/>'),
    "private-pool": ic('<path d="M3 18c1.3 1 2.4 1 3.7 0s2.4-1 3.6 0 2.4 1 3.7 0 2.4-1 3.7 0"/><path d="M7 15V6a2 2 0 014 0M11 11h4"/>'),
    pin:          ic('<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>'),
    search:       ic('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    shield:       ic('<path d="M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z"/><path d="M9 12l2 2 4-4"/>'),
    bolt:         ic('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'),
    collection:   ic('<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>'),
    /* region glyphs */
    "north-america":  ic('<path d="M3 20l3-9 4 2 2-5 3 4 3-2 3 10z"/>'),
    "latam-caribbean":ic('<path d="M3 18c1.4 1 2.6 1 4 0s2.6-1 4 0 2.6 1 4 0 2.6-1 4 0"/><path d="M12 14V6M12 6c3 0 5 2 5 4H7c0-2 2-4 5-4z"/>'),
    "europe":         ic('<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M8 9V5l4-2 4 2v4M10 20v-5h4v5"/>'),
    "asia":           ic('<path d="M12 3c2 3 2 5 0 8-2-3-2-5 0-8zM6 21c0-4 2.7-7 6-7s6 3 6 7"/><path d="M9 21v-3M15 21v-3"/>'),
    "mea":            ic('<path d="M3 20c3-6 6-9 9-9s6 3 9 9zM12 11V4M9 6l3-2 3 2"/>'),
    "pacific":        ic('<circle cx="12" cy="12" r="8"/><path d="M4 12c3 2 5 2 8 0s5-2 8 0M12 4c-2 3-2 5 0 8s2 5 0 8"/>')
  };
  function iconFor(key) { return ICONS[key] || ""; }

  /* -----------------------------------------------------------------
     State — cats = selected region keys, brands = selected collections.
     ----------------------------------------------------------------- */
  var state = { query: "", cats: [], brands: [], setting: "", sort: "featured", favs: {} };

  // Region match: a property belongs to exactly one region (its real country).
  function propMatchesCat(p, cat) { return p.regionKey === cat; }

  function filtered() {
    var q = state.query.trim();
    // Base set still honours the "Explore by region" cards (state.cats); the
    // old refine dropdowns are gone in favour of natural-language search.
    var base = PROPS.filter(function (p) {
      if (state.cats.length && state.cats.indexOf(p.regionKey) === -1) return false;
      return true;
    });
    if (q) return smartRank(base, q);              // intelligent, intent-aware ranking
    var list = base.slice();
    if (state.sort === "az") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (state.sort === "destination") list.sort(function (a, b) { return (a.country || "").localeCompare(b.country || "") || (a.city || "").localeCompare(b.city || ""); });
    else list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    return list;
  }

  /* =================================================================
     Intelligent search — turns a free-text query ("a beachfront villa in
     Florida for a family") into ranked results by reading intent from the
     property's REAL data (destination, setting & feature characteristics,
     collection). No dropdowns, no server: a compact local intent parser.
     ================================================================= */
  var SETTING_SYNONYMS = {
    beachfront: ["beachfront", "beach", "oceanfront", "ocean front", "seaside", "seafront", "waterfront", "coastal", "coast", "shore", "shoreline", "sand", "by the sea", "on the water", "ocean"],
    island:     ["private island", "island", "islands", "isle", "cay", "atoll"],
    mountain:   ["mountainside", "mountain", "mountains", "skiing", "ski", "alpine", "alps", "slopes", "slope", "snow", "peak", "chalet"],
    lake:       ["lakefront", "lakeside", "lake", "lakes"],
    countryside:["countryside", "country side", "rural", "wine country", "farmland", "hillside", "hills", "pastoral", "vineyards"],
    city:       ["city centre", "city center", "city", "urban", "downtown", "metropolitan", "skyline"],
    desert:     ["desert", "dunes", "oasis"]
  };
  var FEATURE_SYNONYMS = {
    "private-pool":   ["private pool", "plunge pool", "swimming pool", "pool"],
    golf:             ["golf course", "golfing", "golf", "fairway"],
    spa:              ["spa", "wellness", "massage", "hammam"],
    overwater:        ["overwater", "over-water", "over water", "water villa", "water bungalow"],
    vineyard:         ["vineyard", "vineyards", "winery", "wine estate", "wine country"],
    marina:           ["marina", "yachting", "yacht", "sailing", "boating", "harbour", "harbor"],
    "family-friendly":["family-friendly", "kid-friendly", "family", "families", "kids", "kid", "children", "child"],
    historic:         ["historic", "historical", "heritage", "old-world"],
    culinary:         ["culinary", "fine dining", "dining", "chef", "gastronomy", "michelin", "restaurant"]
  };
  var GROUP_WORDS = ["group", "groups", "party", "people", "guests", "persons", "adults", "everyone", "big", "large", "spacious", "roomy"];
  var QUIET_WORDS = ["quiet", "secluded", "peaceful", "tranquil", "serene", "private", "hideaway", "retreat", "escape", "romantic", "intimate", "off the beaten"];
  var LUX_WORDS   = ["luxury", "luxurious", "five-star", "5-star", "five star", "premium", "exclusive", "opulent", "high-end", "prestige"];
  var STOP_WORDS = {};
  ("a an the in at on of for with and or to near around close nearby by my our we i me you your it that this these those is are be need want looking find get search searching show me somewhere someplace some any place home homes house houses villa villas residence residences estate estates property properties stay stays staying accommodation accommodations trip trips vacation holiday getaway weekend week month long longer extended nights night day days perfect nice great good best lovely beautiful amazing stunning kind type sort where want would like really very just more most people person"
    .split(" ")).forEach(function (w) { STOP_WORDS[w] = 1; });

  var CARIB = {};
  ("anguilla,antigua,bahamas,barbados,bermuda,british virgin islands,cayman,grand cayman,dominican republic,grenada,jamaica,puerto rico,saint lucia,st lucia,turks & caicos,turks and caicos,us virgin islands,saint barthelemy,st barts,nevis,saint kitts,aruba,curacao").split(",").forEach(function (c) { CARIB[c.trim()] = 1; });
  var CITY_WORD_SKIP = { beach: 1, city: 1, island: 1, saint: 1, world: 1, coast: 1, area: 1, north: 1, south: 1, east: 1, west: 1, downtown: 1, resort: 1, national: 1, park: 1 };

  var PLACE_INDEX = null;
  function buildPlaceIndex() {
    if (PLACE_INDEX) return PLACE_INDEX;
    var terms = [], seen = {};
    function add(term, test) { term = (term || "").toLowerCase().trim(); if (term.length < 3 || seen[term]) return; seen[term] = 1; terms.push({ t: term, test: test }); }
    var US = function (p) { return p.country === "United States"; };
    var UK = function (p) { return p.country === "United Kingdom"; };
    var mkField = function (v) { var lv = v.toLowerCase(); return function (p) { return ((p.city || "") + " " + (p.country || "") + " " + (p.region || "")).toLowerCase().indexOf(lv) !== -1; }; };
    var mkWord = function (w) { return function (p) { return (p.city || "").toLowerCase().indexOf(w) !== -1; }; };
    var mkRegion = function (rk) { return function (p) { return p.regionKey === rk; }; };
    // High-value aliases (broader than any single data field)
    add("florida", function (p) { return US(p) && /miami|lauderdale|orlando|naples|palm beach|key |vero|amelia|sarasota|tampa|jacksonville|boca|disney/i.test((p.city || "") + " " + (p.loc || "")); });
    add("hawaii", function (p) { return /maui|oahu|kauai|honolulu|wailea|lanai|waikiki|kona|hawaii|hualalai|lahaina/i.test((p.city || "") + " " + (p.loc || "")); });
    add("caribbean", function (p) { return /caribbean/i.test(p.region || "") || CARIB[(p.country || "").toLowerCase()]; });
    add("mediterranean", mkRegion("europe")); add("europe", mkRegion("europe")); add("asia", mkRegion("asia"));
    add("north america", mkRegion("north-america"));
    ["usa", "u.s.a", "united states", "america", "the states"].forEach(function (t) { add(t, US); });
    ["u.k.", "britain", "england", "united kingdom", "great britain"].forEach(function (t) { add(t, UK); });
    PROPS.forEach(function (p) {
      [p.city, p.country, p.region].forEach(function (v) { if (v) add(v, mkField(v)); });
      (p.city || "").toLowerCase().split(/[^a-z]+/).forEach(function (w) { if (w.length >= 4 && !CITY_WORD_SKIP[w]) add(w, mkWord(w)); });
    });
    terms.sort(function (a, b) { return b.t.length - a.t.length; });  // multi-word terms win first
    return (PLACE_INDEX = terms);
  }

  function parseNL(q) {
    var sig = { places: [], settings: [], features: [], quiet: false, group: false, luxury: false, text: [] };
    var lc = " " + q.toLowerCase().replace(/[^a-z0-9&'\s-]/g, " ").replace(/\s+/g, " ") + " ";
    function eat(word) { // remove a matched phrase so it isn't re-read as a place/text token
      var re = new RegExp("\\b" + word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\b", "g");
      if (re.test(lc)) { lc = lc.replace(re, " "); return true; }
      return false;
    }
    Object.keys(SETTING_SYNONYMS).forEach(function (k) { SETTING_SYNONYMS[k].forEach(function (w) { if (eat(w) && sig.settings.indexOf(k) === -1) sig.settings.push(k); }); });
    Object.keys(FEATURE_SYNONYMS).forEach(function (k) { FEATURE_SYNONYMS[k].forEach(function (w) { if (eat(w) && sig.features.indexOf(k) === -1) sig.features.push(k); }); });
    QUIET_WORDS.forEach(function (w) { if (eat(w)) sig.quiet = true; });
    LUX_WORDS.forEach(function (w) { if (eat(w)) sig.luxury = true; });
    if (/\b\d+\s*(people|guests|persons|adults|pax|bedrooms?|beds?)\b/.test(lc)) sig.group = true;
    GROUP_WORDS.forEach(function (w) { if (eat(w)) sig.group = true; });
    if (sig.features.indexOf("family-friendly") !== -1) sig.group = true;
    // Places (longest terms first) from whatever text remains
    buildPlaceIndex().forEach(function (e) { if (lc.indexOf(" " + e.t + " ") !== -1 || lc.indexOf(e.t) !== -1) { if (new RegExp("\\b" + e.t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).test(lc)) { sig.places.push(e.test); lc = lc.replace(new RegExp(e.t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), " "); } } });
    // Leftover meaningful tokens → free-text (brand / hotel names, unknown places)
    lc.split(/\s+/).forEach(function (w) { w = w.trim(); if (w.length >= 3 && !STOP_WORDS[w] && !/^\d+$/.test(w) && sig.text.indexOf(w) === -1) sig.text.push(w); });
    return sig;
  }

  function nlHay(p) { return (p.name + " " + (p.collection || "") + " " + (p.brand || "") + " " + (p.loc || "") + " " + (p.region || "") + " " + (p.country || "")).toLowerCase(); }
  function placeHit(p, sig) { for (var i = 0; i < sig.places.length; i++) { if (sig.places[i](p)) return true; } return false; }
  function traitHit(p, sig) {
    var ps = settingsFor(p), pf = featuresFor(p);
    for (var i = 0; i < sig.settings.length; i++) if (ps.indexOf(sig.settings[i]) !== -1) return true;
    for (var j = 0; j < sig.features.length; j++) if (pf.indexOf(sig.features[j]) !== -1) return true;
    return false;
  }
  function textHit(p, tokens) { var h = nlHay(p); for (var i = 0; i < tokens.length; i++) if (h.indexOf(tokens[i]) !== -1) return true; return false; }

  function scoreNL(p, sig) {
    var s = 0, ps = settingsFor(p), pf = featuresFor(p), prim = primarySetting(p);
    if (sig.places.length) { var pm = 0; for (var i = 0; i < sig.places.length; i++) if (sig.places[i](p)) pm++; s += pm * 60; }
    sig.settings.forEach(function (k) { if (ps.indexOf(k) !== -1) { s += 25; if (prim === k) s += 12; } });
    sig.features.forEach(function (k) { if (pf.indexOf(k) !== -1) s += 20; });
    if (sig.quiet) { if (ps.indexOf("island") !== -1 || ps.indexOf("countryside") !== -1 || ps.indexOf("lake") !== -1) s += 10; if (ps.indexOf("city") !== -1) s -= 6; }
    if (sig.group && pf.indexOf("family-friendly") !== -1) s += 14;
    if (sig.text.length) { var h = nlHay(p); sig.text.forEach(function (t) { if (h.indexOf(t) !== -1) s += 10; }); }
    if (sig.luxury && p.featured) s += 6;
    if (p.featured) s += 1;
    return s;
  }

  function smartRank(base, q) {
    var sig = parseNL(q), cands;
    if (sig.places.length) {
      cands = base.filter(function (p) { return placeHit(p, sig); });
      if (!cands.length) cands = base.filter(function (p) { return textHit(p, sig.text.concat(q.toLowerCase())); });
    } else if (sig.settings.length || sig.features.length) {
      cands = base.filter(function (p) { return traitHit(p, sig); });
    } else if (sig.text.length) {
      cands = base.filter(function (p) { return textHit(p, sig.text); });
      if (!cands.length) { var ql = q.toLowerCase().trim(); cands = base.filter(function (p) { return nlHay(p).indexOf(ql) !== -1; }); }
    } else {
      cands = base.slice();  // only intent words (e.g. "spacious place") → show the best, ranked
    }
    if (!cands.length) return [];
    return cands
      .map(function (p) { return { p: p, s: scoreNL(p, sig) }; })
      .sort(function (a, b) { return b.s - a.s || ((b.p.featured ? 1 : 0) - (a.p.featured ? 1 : 0)) || a.p.name.localeCompare(b.p.name); })
      .map(function (x) { return x.p; });
  }

  // Description: authoritative WhataHotel copy where available, else location line.
  function blurbText(p) {
    var d = window.WAH_DESC;
    return (d && d[p.id]) ? d[p.id] : (p.blurb || "");
  }

  /* -----------------------------------------------------------------
     Property photography — each property's REAL WhataHotel hero image
     (assets/js/images.js, scraped from its property page). The CSS/SVG scene
     sits behind every photo and shows instantly + as the fallback if an image
     is missing/blocked, so the card is never broken and LCP is never blank.

     Resolution order: explicit p.image → offline-preview data URI (optional
     window.WAH_IMAGE_DATAURI[id]) → real WhataHotel hero → null (scene only).
     ----------------------------------------------------------------- */
  function rawImageFor(p) {
    if (p.image) return p.image;
    var over = window.WAH_IMAGE_DATAURI;
    if (over && over[p.id]) return over[p.id];
    var wi = window.WAH_IMAGES;
    if (wi && wi[p.id] && wi[p.id].hero) return wi[p.id].hero;
    return null;
  }

  /* On-the-fly image optimization: WhataHotel serves full-res JPEGs (~300–400 KB
     each), far larger than a card needs. We route them through a free image CDN
     (weserv.nl) that resizes + serves WebP, cutting weight ~80–94%. Disable with
     window.WAH_IMG_OPT = false; override the proxy with window.WAH_IMG_PROXY. */
  var IMG_OPT = (window.WAH_IMG_OPT !== false);
  var IMG_PROXY = window.WAH_IMG_PROXY || "https://wsrv.nl/?url=";
  var IMG_Q = window.WAH_IMG_QUALITY || 72;
  /* GLOBAL mobile image-width cap. Decoded image memory is width*height*4 bytes
     (independent of file size/quality), so a hard cap on requested width is the
     single most effective way to keep iOS Safari under its per-tab memory limit
     — it shrinks EVERY image on the page (hero, cards, categories, featured,
     modal) at once. 720px is plenty for a phone yet ~5x lighter than 1600px. */
  var IMG_MAX_W = ((window.innerWidth || 1024) <= 820) ? 720 : 100000;
  var IMG_Q_EFF = ((window.innerWidth || 1024) <= 820) ? 64 : IMG_Q;
  function optImg(url, width) {
    if (!IMG_OPT || !url) return url;
    if (/^data:/.test(url) || url.indexOf("wsrv.nl") !== -1) return url; // already inline/optimized
    var w = Math.min(width || IMG_MAX_W, IMG_MAX_W);
    var clean = url.replace(/^https?:\/\//, "");
    return IMG_PROXY + encodeURIComponent(clean) + "&w=" + w + "&output=webp&q=" + IMG_Q_EFF + "&we=1";
  }
  // Optimized URL for a property at a given render width.
  function imageFor(p, width) {
    var b = rawImageFor(p);
    return b && width ? optImg(b, width) : b;
  }
  // Full <img> for a property: optimized src, raw WhataHotel URL as a first
  // fallback, then the CSS scene if even that fails.
  function imgTag(p, width, cls, extra) {
    var raw = rawImageFor(p);
    if (!raw) return "";
    var alt = esc(p.name) + (p.loc ? ", " + esc(p.loc) : "");
    return '<img class="' + cls + '" src="' + optImg(raw, width) + '" data-raw="' + esc(raw) + '" ' +
      'alt="' + alt + '" ' + (extra || "") + ' decoding="async" ' +
      'onload="this.classList.add(\'is-loaded\')" ' +
      'onerror="if(this.dataset.fb){this.remove()}else{this.dataset.fb=1;this.src=this.dataset.raw}">';
  }
  // Hero <img> that loads lazily via data-src (no src yet), so the carousel
  // can keep only a few slides decoded at a time (see hydrateHeroWindow) —
  // essential on iOS Safari, which reloads/"crashes" a tab when the 25 hero
  // images all stay decoded at once.
  function heroImgTag(p, width, extra) {
    var raw = rawImageFor(p);
    if (!raw) return "";
    var alt = esc(p.name) + (p.loc ? ", " + esc(p.loc) : "");
    return '<img class="hslide__photo" data-src="' + optImg(raw, width) + '" data-raw="' + esc(raw) + '" ' +
      'alt="' + alt + '" ' + (extra || "") + ' decoding="async" ' +
      'onload="this.classList.add(\'is-loaded\')" ' +
      'onerror="if(this.dataset.fb){this.removeAttribute(\'src\')}else{this.dataset.fb=1;this.src=this.dataset.raw}">';
  }
  // Representative property (with an image) for a region card.
  function categoryPick(catKey) {
    var list = PROPS.filter(function (p) { return propMatchesCat(p, catKey); });
    var withImg = list.filter(function (p) { return rawImageFor(p); });
    return withImg.filter(function (p) { return p.featured; })[0] || withImg[0] || list[0] || null;
  }

  /* -----------------------------------------------------------------
     Card rendering
     ----------------------------------------------------------------- */
  function renderMedia(p) {
    // Scene sits behind; the optimized photo overlays it, and if it fails it
    // falls back to the raw WhataHotel image, then the scene — never blank.
    return '<div class="scene">' + sceneSVG(p.scene) + '</div>' +
      imgTag(p, 640, "pcard__photo", 'loading="lazy"');
  }

  // Image-overlay badge: the property's real collection/brand, else its region.
  function typeBadge(p) {
    return p.brand || REGION_BADGE[p.regionKey] || p.region || "";
  }
  // Card eyebrow: the property's real collection (brand line).
  function eyebrowFor(p) {
    return p.collection || p.brand || (REGION_SHORT[p.regionKey] || p.region || "");
  }

  /* -----------------------------------------------------------------
     Property CHARACTERISTICS (setting + features). Populated by the
     classifier (assets/js/characteristics.js) — every tag is grounded in
     the property's REAL description + geography, never its name. */
  var TRAITS = window.WAH_TRAITS || {};
  var SETTING_LABELS = window.WAH_SETTINGS || {
    beachfront: "Beachfront", island: "Island", mountain: "Mountain & Ski",
    lake: "Lakeside", countryside: "Countryside", city: "City", desert: "Desert"
  };
  // Professional line-style icons (match the site's SVG icon set: 24x24,
  // stroke, round caps). One per setting — never an emoji.
  function svgIc(paths) {
    return '<svg class="set-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var SETTING_ICON = {
    // sun over gentle surf
    beachfront: svgIc('<circle cx="17.5" cy="6.5" r="2.6"/><path d="M2.5 14.5c1.4 0 1.4 1.4 2.9 1.4s1.4-1.4 2.9-1.4 1.4 1.4 2.9 1.4 1.4-1.4 2.9-1.4 1.4 1.4 2.9 1.4 1.4-1.4 2.6-1.4"/><path d="M2.5 18.6c1.4 0 1.4 1.4 2.9 1.4s1.4-1.4 2.9-1.4 1.4 1.4 2.9 1.4 1.4-1.4 2.9-1.4 1.4 1.4 2.9 1.4 1.4-1.4 2.6-1.4"/>'),
    // palm tree on a shoreline
    island: svgIc('<path d="M12 10.5V20"/><path d="M12 10.5C10 7.5 6 7.5 3.6 9.6c3-1.2 5.4-.3 6.4.9"/><path d="M12 10.5c2-3 6-3 8.4-.9-3-1.2-5.4-.3-6.4.9"/><path d="M12 10.5c0-3.2-2.2-5.6-5.2-5.6 2.4.8 4.2 2.8 4.2 5.6"/><path d="M4 20.4c2.4-1.4 13.6-1.4 16 0"/>'),
    // twin peaks with snow cap
    mountain: svgIc('<path d="M2.5 19.5 9 7l4 7.5 2-3.2 6.5 8.2z"/><path d="M6.6 12.2 9 7l2.3 4.3"/>'),
    // peak reflected in still water
    lake: svgIc('<path d="M4 11 8 5l4.2 6"/><path d="M12 11l2.8-3.6L20.5 12"/><path d="M3.5 15.5h17"/><path d="M3.5 18.6h17"/>'),
    // rolling hills with a rising sun
    countryside: svgIc('<circle cx="7" cy="8" r="2.4"/><path d="M2 19.5c3.2-5.8 7-5.8 10.2 0"/><path d="M9 19.5c3.2-5.8 8-5.8 12.8-.6"/>'),
    // city skyline
    city: svgIc('<path d="M3 20.5V8.5l5.5-3.5v15.5"/><path d="M8.5 20.5V10l5.5-2.8v13.3"/><path d="M14 20.5V12.5l6 2.2v5.8"/><path d="M2.5 20.5h19"/><path d="M6 11v0M6 14v0M11 12v0M11 15v0"/>'),
    // dunes beneath a low sun
    desert: svgIc('<circle cx="16.5" cy="7" r="2.4"/><path d="M2.5 18c3-4 5.5-.5 8.5-2.4S17 13 21.5 16"/><path d="M2.5 20.5c3-3.2 5.5-.4 8.5-2s6-1.6 10.5 1.2"/>')
  };
  var FEATURE_LABELS = {
    golf: "Golf", spa: "Spa", "private-pool": "Private pool", overwater: "Overwater",
    vineyard: "Vineyard", marina: "Marina", "family-friendly": "Family-friendly",
    historic: "Historic", culinary: "Culinary"
  };
  function traitsFor(p) { return TRAITS[p.id] || null; }
  function settingsFor(p) { var t = traitsFor(p); return (t && t.settings) || []; }
  function featuresFor(p) { var t = traitsFor(p); return (t && t.features) || []; }
  function primarySetting(p) { var t = traitsFor(p); return t && t.primary; }
  function settingLabel(k) { return SETTING_LABELS[k] || k; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c];
    });
  }

  function cardHTML(p, i, anim) {
    var delay = ((i || 0) % 3);
    var animAttr = ' data-anim="' + (anim || "rise") + '" style="--d:' + delay + '"';
    // Factual pills: setting (from real description/geography) + region + country.
    var tags = [];
    var pset = primarySetting(p);
    if (pset) tags.push('<span class="tag-pill tag-pill--setting">' + (SETTING_ICON[pset] || "") + esc(settingLabel(pset)) + '</span>');
    tags.push('<span class="tag-pill">' + esc(REGION_BADGE[p.regionKey] || p.region) + '</span>');
    if (p.country) tags.push('<span class="tag-pill">' + esc(p.country) + '</span>');

    var favOn = !!state.favs[p.id];
    return '' +
    '<article class="pcard reveal"' + animAttr + ' data-id="' + p.id + '">' +
      '<button class="pcard__media" type="button" data-action="detail" data-id="' + p.id + '" aria-label="View details for ' + esc(p.name) + '">' +
        renderMedia(p) +
        '<span class="pcard__badge">' + esc(typeBadge(p)) + '</span>' +
        (p.loc ? '<span class="pcard__loc">' + pinSVG() + esc(p.loc) + '</span>' : '') +
        '<span class="pcard__zoom">' + zoomSVG() + '</span>' +
      '</button>' +
      '<button class="pcard__fav" type="button" aria-pressed="' + favOn + '" aria-label="Save ' + esc(p.name) + '">' + heartSVG() + '</button>' +
      '<div class="pcard__body">' +
        '<div class="pcard__hotel">' + esc(eyebrowFor(p)) + '</div>' +
        '<h3 class="pcard__name">' + esc(p.name) + '</h3>' +
        '<p class="pcard__blurb">' + esc(blurbText(p).trim()) + '</p>' +
        '<div class="pcard__tags">' + tags.join("") + '</div>' +
        '<div class="pcard__foot">' +
          '<span class="pcard__cta">' +
            '<button class="btn btn-dark" type="button" data-action="detail" data-id="' + p.id + '">' +
               'View Details' + arrowSVG() +
            '</button>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* Directory is paginated so mobile/desktop only render a first page of
     cards up front (keeps the DOM light and LCP fast on a Google Ads page).
     "Show more" appends the next page; any filter change resets to page 1. */
  // Fewer cards per page on phones so fewer images decode at once (memory).
  var DIR_PAGE = ((window.innerWidth || 1024) <= 820) ? 6 : 12;
  var dirList = [];
  var dirShown = 0;

  function appendDirPage() {
    var grid = $("#directory-grid");
    if (!grid) return;
    var next = dirList.slice(dirShown, dirShown + DIR_PAGE);
    var frag = document.createElement("div");
    frag.innerHTML = next.map(function (p, i) { return cardHTML(p, dirShown + i, "zoom"); }).join("");
    while (frag.firstChild) grid.appendChild(frag.firstChild);
    dirShown += next.length;
    observeReveals(grid);
    syncDirMore();
  }

  function syncDirMore() {
    var more = $("#directory-more");
    var label = $("#directory-more-label");
    if (!more) return;
    var remaining = dirList.length - dirShown;
    if (remaining > 0) {
      more.hidden = false;
      if (label) label.textContent = "Show " + Math.min(DIR_PAGE, remaining) + " more of " + dirList.length;
    } else {
      more.hidden = true;
    }
  }

  function renderDirectory() {
    var list = filtered();
    var grid = $("#directory-grid");
    var count = $("#directory-count");
    if (count) count.innerHTML = "<b>" + list.length + "</b> " + (list.length === 1 ? "property" : "properties");
    if (!grid) return;
    if (!list.length) {
      dirList = []; dirShown = 0; syncDirMore();
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' + searchSVG() +
        '<h3>No properties match those filters</h3>' +
        '<p>Try a different destination or clear a filter to see more homes, villas and residences.</p>' +
        '<button class="btn btn-outline" type="button" id="clear-empty">Clear all filters</button></div>';
      var ce = $("#clear-empty"); if (ce) ce.addEventListener("click", clearAll);
      return;
    }
    dirList = list;
    dirShown = 0;
    grid.innerHTML = "";
    appendDirPage();
  }

  function wireDirMore() {
    var btn = $("#directory-more-btn");
    if (btn) btn.addEventListener("click", function () {
      appendDirPage();
      track("filter_selected", { type: "show_more", shown: dirShown, total: dirList.length });
    });
  }

  function renderFeatured() {
    var rail = $("#featured-grid");
    if (!rail) return;
    var feat = PROPS.filter(function (p) { return p.featured; }).slice(0, 6);
    rail.innerHTML = feat.map(function (p, i) { return cardHTML(p, i, "rise"); }).join("");
    observeReveals(rail);
  }

  /* =================================================================
     HERO CAROUSEL — an immersive, cinematic showcase of marquee
     villas / residences / homes / estates. Autoplay (pauses on hover
     & focus), prev/next, clickable progress segments, a desktop
     thumbnail rail, keyboard arrows, touch swipe, reduced-motion safe.
     ================================================================= */
  // Marquee slides — a geographically diverse set of REAL properties from the
  // 271. All copy (kicker, description, meta) is derived from authoritative
  // data: the property's collection, city/country/region and its own
  // WhataHotel description. Nothing about the accommodation is invented.
  var HERO_IDS = [
    // ---- HERO (first three, shown in this exact order) ----
    3133, // Four Seasons Residences, Anguilla
    3879, // Ritz-Carlton Residences at Dorado Beach
    2706, // Andaz Maui at Wailea Villas
    // ---- FEATURED gallery (the rest) ----
    1354, // Four Seasons Resort Whistler
    2390, // Four Seasons Resort Vail
    6084, // Ritz-Carlton Residences, Orlando
    952,  // Hotel Arts Barcelona
    1569, // Montage Palmetto Bluff
    1325, // Four Seasons Resort Jackson Hole
    1271, // Four Seasons Resort Costa Rica
    1399, // One&Only Reethi Rah
    1736, // Bvlgari Resort Bali
    3705, // Mandarin Oriental, Lago di Como
    2265, // Rosewood Castiglion del Bosco
    3614, // Four Seasons Los Cabos at Costa Palmas
    2314, // Banyan Tree Mayakoba
    1414, // Four Seasons Resort Punta Mita
    2545, // Mandarin Oriental, Canouan
    4746, // Four Seasons Resort Tamarindo
    1532, // Amanpulo
    1422, // Four Seasons Resort Nevis
    2174, // Grand Hotel des Bains Kempinski St. Moritz
    956,  // Grace Bay Club
    3118, // Four Seasons London at Tower Bridge
    3287  // Ritz-Carlton Residences, Waikiki Beach
  ];

  function slideFor(p) {
    var kicker = (p.collection ? p.collection + " · " : "") + (p.loc || p.region);
    var meta = [];
    if (p.country) meta.push({ icon: "pin", label: p.country });
    meta.push({ icon: p.regionKey, label: REGION_SHORT[p.regionKey] || p.region });
    if (p.brand) meta.push({ icon: "collection", label: p.brand });
    return { p: p, kicker: kicker, desc: blurbText(p), meta: meta.slice(0, 3) };
  }
  function heroSlides() {
    var list = HERO_IDS.map(function (id) {
      var p = PROPS.filter(function (x) { return x.id === id; })[0];
      return p ? slideFor(p) : null;
    }).filter(Boolean);
    if (list.length < 3) { // fallback to featured if ids drift
      list = PROPS.filter(function (p) { return p.featured; }).slice(0, 6).map(slideFor);
    }
    return list;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* -----------------------------------------------------------------
     Reusable slide carousel — powers BOTH the hero (first 3 properties,
     looping) and the featured gallery (the rest). Each instance is fully
     self-contained: its own state, controls scoped to its root, and its own
     image "window" (only the current slide ±1 are decoded) so memory stays
     bounded no matter how many slides. Autoplay can be gated to when the
     carousel is actually on screen, so an off-screen gallery never churns.
     ----------------------------------------------------------------- */
  var ARROW_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
  var ARROW_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

  // A small house glyph for the "Homes Away From Home!" tagline badge.
  var HOME_SVG = '<svg class="hero-tagline__ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.4 12 4l9 7.4"/><path d="M5.2 9.8V20h13.6V9.8"/><path d="M9.6 20v-5.2h4.8V20"/></svg>';
  var HERO_TAGLINE = '<span class="hero-tagline">' + HOME_SVG + '<span class="hero-tagline__txt">Homes Away From Home!</span></span>';

  function slideHTML(s, i, imgW, priority, slogan) {
    var p = s.p;
    return '' +
    '<article class="hslide" data-i="' + i + '" aria-hidden="' + (i ? "true" : "false") + '" aria-roledescription="slide">' +
      '<div class="hslide__media">' +
        '<div class="hslide__skel" aria-hidden="true"></div>' +
        heroImgTag(p, imgW, (priority && i === 0 ? 'fetchpriority="high"' : '')) +
      '</div>' +
      '<div class="hslide__scrim"></div>' +
      '<div class="wrap hslide__inner">' +
        '<div class="hslide__content">' +
          (slogan ? HERO_TAGLINE : '') +
          '<span class="hslide__kicker">' + pinSVG() + esc(s.kicker) + '</span>' +
          '<h2 class="hslide__title">' + esc(p.name) + '</h2>' +
          '<p class="hslide__desc">' + esc(s.desc) + '</p>' +
          '<div class="hslide__actions">' +
            '<button class="btn btn-primary btn-lg" type="button" data-action="detail" data-id="' + p.id + '">Explore Property' + arrowSVG() + '</button>' +
            '<a class="hslide__browse" href="#directory" data-scroll="#directory" data-cta="hero-browse">Browse all stays</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  // cfg: { root, heroEl, slides, priority (bool), autoWhenVisible (bool), label }
  function makeCarousel(cfg) {
    var root = cfg.root;
    var heroEl = cfg.heroEl || (root.closest && root.closest(".hero")) || root.parentNode;
    if (!root || !cfg.slides || !cfg.slides.length) return null;
    var st = { i: 0, slides: cfg.slides, raf: null, start: 0, elapsed: 0, paused: false, AUTO: cfg.AUTO || 6400, win: 1 };
    var IMG_W = (window.innerWidth || 1024) <= 700 ? 960 : 1600;
    var q = function (sel) { return root.querySelector(sel); };
    var qa = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

    // Supporting-card deck (hero only). Rendered ONCE — the same 3 cards are
    // repositioned by slot class on every navigation, so no image is ever
    // re-decoded (memory stays bounded; this is what keeps the deck iOS-safe).
    function deckHTML() {
      if (!cfg.deck) return "";
      return '<div class="hero-cards" aria-hidden="true">' +
        st.slides.map(function (s, j) {
          var p = s.p, raw = rawImageFor(p);
          var img = raw
            ? '<img class="hcard__img" src="' + optImg(raw, 520) + '" data-raw="' + esc(raw) + '" alt="" decoding="async" ' +
              'onload="this.classList.add(\'is-loaded\')" onerror="if(this.dataset.fb){this.remove()}else{this.dataset.fb=1;this.src=this.dataset.raw}">'
            : '';
          return '<button class="hcard" type="button" tabindex="-1" data-i="' + j + '" data-slot="' + j + '" aria-label="Show ' + esc(p.name) + '">' +
            '<span class="hcard__media">' + img + '<span class="hcard__grad"></span></span>' +
            '<span class="hcard__meta">' +
              '<span class="hcard__loc">' + esc(p.loc || p.region) + '</span>' +
              '<span class="hcard__name">' + esc(p.name) + '</span>' +
            '</span>' +
          '</button>';
        }).join("") +
      '</div>';
    }

    root.innerHTML =
      '<div class="hero-track">' +
        st.slides.map(function (s, i) { return slideHTML(s, i, IMG_W, cfg.priority, cfg.slogan); }).join("") +
      '</div>' +
      deckHTML() +
      '<div class="wrap hero-controls">' +
        '<div class="hero-nav">' +
          '<button class="hero-arrow hero-prev" type="button" aria-label="Previous property">' + ARROW_PREV + '</button>' +
          '<button class="hero-arrow hero-next" type="button" aria-label="Next property">' + ARROW_NEXT + '</button>' +
          '<div class="hero-line" aria-hidden="true"><span class="hero-line__fill"></span></div>' +
        '</div>' +
        '<div class="hero-bignum" aria-hidden="true">01</div>' +
      '</div>';

    // Reposition the supporting cards for the given active index. Slot 0 = the
    // property currently shown large (its card hides); slots 1 & 2 = the next
    // properties, sliding right-to-left as you advance. The card recycling from
    // the hidden slot has its transform transition suppressed for one frame so
    // it re-enters from the right instead of streaking across.
    function positionDeck(activeI) {
      if (!cfg.deck) return;
      var cards = qa(".hcard"), n = st.slides.length;
      cards.forEach(function (card) {
        var j = +card.getAttribute("data-i");
        var slot = (((j - activeI) % n) + n) % n;
        var prev = card.getAttribute("data-slot");
        if (prev === "0" && slot !== 0) {
          card.classList.add("hcard--recycle");           // jump into place, invisible
          card.setAttribute("data-slot", String(slot));
          requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.remove("hcard--recycle"); }); });
        } else {
          card.setAttribute("data-slot", String(slot));
        }
      });
    }

    function setBar(pp) { var b = q(".hero-line__fill"); if (b) b.style.width = (pp * 100).toFixed(2) + "%"; }

    // Only the current slide ±1 keep a loaded <img>; the rest are released so
    // decoded-image memory stays bounded (the iOS-crash fix).
    function hydrate(center) {
      var slides = qa(".hslide"), n = slides.length;
      for (var i = 0; i < n; i++) {
        var img = slides[i].querySelector(".hslide__photo");
        if (!img) continue;
        var d = Math.min((i - center + n) % n, (center - i + n) % n);
        if (d <= st.win) {
          if (!img.getAttribute("src") && img.getAttribute("data-src")) img.src = img.getAttribute("data-src");
        } else if (img.getAttribute("src")) {
          img.removeAttribute("src"); img.classList.remove("is-loaded");
        }
      }
    }

    function go(idx, userInitiated, dir) {
      var slides = qa(".hslide"), n = slides.length;
      var newI = ((idx % n) + n) % n;
      var nxt = slides[newI], cur = q(".hslide.is-active");
      if (!nxt || cur === nxt) return;
      if (dir === undefined) dir = (newI > st.i) ? 1 : -1;
      if (heroEl) heroEl.setAttribute("data-dir", dir > 0 ? "next" : "prev");
      if (cur) {
        cur.classList.remove("is-active"); cur.classList.add("is-prev"); cur.setAttribute("aria-hidden", "true");
        (function (c) { setTimeout(function () { c.classList.remove("is-prev"); }, 1150); })(cur);
      }
      nxt.classList.add("is-enter"); nxt.classList.add("is-active"); nxt.setAttribute("aria-hidden", "false");
      requestAnimationFrame(function () { requestAnimationFrame(function () { nxt.classList.remove("is-enter"); }); });
      st.i = newI; hydrate(newI); positionDeck(newI);
      if (cfg.onChange) cfg.onChange(newI);
      var num = q(".hero-bignum"); if (num) num.textContent = pad(st.i + 1);
      st.elapsed = 0; st.start = 0; setBar(0);
      if (userInitiated) track("hero_slide_change", { property_id: st.slides[st.i].p.id, property_name: st.slides[st.i].p.name, source: cfg.label || "hero" });
    }

    function startAuto() {
      stopAuto();
      st.raf = requestAnimationFrame(function loop(ts) {
        if (!st.start) st.start = ts;
        if (st.paused) { st.start = ts - st.elapsed; }
        else {
          st.elapsed = ts - st.start;
          var pp = Math.min(1, st.elapsed / st.AUTO);
          setBar(pp);
          if (pp >= 1) { st.start = ts; st.elapsed = 0; go(st.i + 1, false, 1); }
        }
        st.raf = requestAnimationFrame(loop);
      });
    }
    function stopAuto() { if (st.raf) cancelAnimationFrame(st.raf); st.raf = null; }
    function pause() { st.paused = true; }
    function resume() { st.paused = false; }

    // Controls (scoped to this carousel)
    q(".hero-prev").addEventListener("click", function () { go(st.i - 1, true, -1); });
    q(".hero-next").addEventListener("click", function () { go(st.i + 1, true, 1); });
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) { root.addEventListener(ev, pause, { passive: true }); });
    ["mouseleave", "focusout"].forEach(function (ev) { root.addEventListener(ev, resume); });
    root.setAttribute("tabindex", "-1");
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") go(st.i - 1, true, -1);
      else if (e.key === "ArrowRight") go(st.i + 1, true, 1);
    });
    var sx = 0, sy = 0;
    root.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(st.i + (dx < 0 ? 1 : -1), true, dx < 0 ? 1 : -1);
    }, { passive: true });

    // Clicking a supporting card jumps the showcase to that property.
    if (cfg.deck) {
      qa(".hcard").forEach(function (card) {
        card.addEventListener("click", function () {
          var j = +card.getAttribute("data-i"), n = st.slides.length;
          if (j === st.i) return;
          go(j, true, ((j - st.i + n) % n) === 1 ? 1 : -1);
        });
      });
    }

    // Init: activate slide 0, load its window, seat the deck.
    var first = qa(".hslide")[0];
    if (first) { first.classList.add("is-active"); first.setAttribute("aria-hidden", "false"); }
    hydrate(0); setBar(0); positionDeck(0);
    if (cfg.onChange) cfg.onChange(0);

    // Autoplay — only while the carousel is on screen (so an off-screen
    // gallery never decodes images in the background), and only if it has more
    // than one slide.
    if (!prefersReduced() && st.slides.length > 1) {
      if (cfg.autoWhenVisible && ("IntersectionObserver" in window)) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { st.paused = false; if (!st.raf) startAuto(); }
            else { stopAuto(); }
          });
        }, { threshold: 0.4 }).observe(heroEl || root);
      } else {
        startAuto();
      }
    }
    return { go: go, state: st, pause: pause, resume: resume };
  }

  // HERO — the first 3 featured properties, looping back and forth.
  var CAROUSELS = {};
  function pauseCarousels() { for (var k in CAROUSELS) { if (CAROUSELS[k] && CAROUSELS[k].pause) CAROUSELS[k].pause(); } }
  function resumeCarousels() { for (var k in CAROUSELS) { if (CAROUSELS[k] && CAROUSELS[k].resume) CAROUSELS[k].resume(); } }
  function buildHero() {
    var root = $("#hero-carousel");
    if (!root) return;
    var all = heroSlides();
    buildHero._rest = all.slice(3);           // the remaining properties → featured gallery
    var three = all.slice(0, 3);
    CAROUSELS.hero = makeCarousel({
      root: root, heroEl: document.querySelector(".hero"),
      slides: three, priority: true, autoWhenVisible: true, deck: true, slogan: true, label: "hero"
    });
  }

  // FEATURED gallery — the remaining hero properties, as a sliding gallery
  // styled like the hero (replaces the old static featured grid).
  function buildFeaturedGallery() {
    var root = $("#featured-carousel");
    var rest = buildHero._rest || heroSlides().slice(3);
    renderFeaturedDeck(rest);
    if (!root || !rest.length) return;
    CAROUSELS.featured = makeCarousel({
      root: root, heroEl: document.querySelector("#featured-hero"),
      slides: rest, priority: false, autoWhenVisible: true, label: "featured",
      // Keep the 3 preview cards below in step with the big gallery: as it
      // advances, they slide to the next upcoming homes.
      onChange: function (i) { updateFeaturedDeck(rest, i); }
    });
  }

  // The 3 preview cards below the featured carousel. They CYCLE in step with
  // the gallery — always showing the next homes coming up — sliding in from the
  // right on each change. Only ever 3 small images are mounted at once, so the
  // motion adds no unbounded image churn (memory stays bounded).
  var FEAT_CARDS = ((window.innerWidth || 1024) <= 720) ? 2 : 3;
  function featCardContent(p) {
    return '<span class="feat-card__media">' +
        imgTag(p, 460, "feat-card__photo", 'loading="lazy"') +
        '<span class="feat-card__grad"></span>' +
        '<span class="feat-card__zoom">' + zoomSVG() + '</span>' +
      '</span>' +
      '<span class="feat-card__meta">' +
        '<span class="feat-card__loc">' + pinSVG() + esc(p.loc || p.region) + '</span>' +
        '<span class="feat-card__name">' + esc(p.name) + '</span>' +
      '</span>';
  }
  function renderFeaturedDeck(rest) {
    rest = rest || buildHero._rest || heroSlides().slice(3);
    var n = rest.length;
    var countEl = $("#featured-count");
    if (countEl) countEl.textContent = n ? (n + " featured homes to explore") : "";
    var deck = $("#featured-deck");
    if (!deck) return;
    if (!n) { deck.innerHTML = ""; return; }
    var cards = Math.min(FEAT_CARDS, n);
    var html = "";
    for (var k = 0; k < cards; k++) {
      html += '<button class="feat-card" type="button" data-action="detail" data-id="" data-k="' + k + '" style="--k:' + k + '" aria-label="View featured home"></button>';
    }
    deck.innerHTML = html;
    updateFeaturedDeck(rest, 0, true);
  }
  function updateFeaturedDeck(rest, activeI, immediate) {
    var deck = $("#featured-deck");
    if (!deck) return;
    var n = rest.length;
    var cards = Array.prototype.slice.call(deck.querySelectorAll(".feat-card"));
    cards.forEach(function (card, k) {
      var idx = (((activeI + 1 + k) % n) + n) % n;      // the upcoming homes
      var p = rest[idx] && rest[idx].p;
      if (!p) return;
      if (String(card.getAttribute("data-id")) === String(p.id)) return; // no change
      card.setAttribute("data-id", p.id);
      card.setAttribute("aria-label", "View " + p.name);
      card.innerHTML = featCardContent(p);
      if (immediate || prefersReduced()) return;
      card.classList.remove("feat-card--in");
      card.classList.add("feat-card--enter");           // seat off to the right, invisible
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          card.classList.remove("feat-card--enter");
          card.classList.add("feat-card--in");          // ease to rest (staggered via --k)
        });
      });
    });
  }

  // "Explore by region" cards.
  function renderCategories() {
    var wrap = $("#category-grid");
    if (!wrap) return;
    wrap.innerHTML = REGIONS.map(function (c, i) {
      var pick = categoryPick(c.key);
      return '<button class="cat-card reveal" data-anim="zoom" style="--d:' + i + '" type="button" data-cat="' + c.key + '">' +
        '<div class="scene">' + sceneSVG(c.scene) + '</div>' +
        (pick ? imgTag(pick, 800, "cat-card__photo", 'loading="lazy"') : "") +
        '<span class="cat-card__count">' + iconFor(c.key) + c.count + ' stays</span>' +
        '<div class="cat-card__body"><h3>' + esc(c.label) + '</h3><p>' + esc(c.blurb) + '</p></div>' +
      '</button>';
    }).join("");
    $$(".cat-card", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-cat");
        state.cats = [cat];
        syncControls();
        track("filter_selected", { filter_type: "region", filter_value: cat, source: "region_card" });
        renderDirectory();
        scrollToDirectory();
      });
    });
  }

  /* -----------------------------------------------------------------
     Refine — two compact dropdowns (Region + Collection), single-select.
     Both option sets come straight from authoritative property data.
     ----------------------------------------------------------------- */
  var REFINE_BRANDS = BRANDS.filter(function (b) { return b.count >= 2; });

  function buildFilters() {
    var rsel = $("#region-select");
    if (rsel) {
      rsel.innerHTML = '<option value="">All regions · ' + PROPS.length + '</option>' +
        REGIONS.map(function (c) { return '<option value="' + c.key + '">' + esc(c.label) + ' · ' + c.count + '</option>'; }).join("");
      rsel.addEventListener("change", function () { setType(rsel.value); });
    }
    var csel = $("#collection-select");
    if (csel) {
      csel.innerHTML = '<option value="">All collections</option>' +
        REFINE_BRANDS.map(function (b) { return '<option value="' + esc(b.label) + '">' + esc(b.label) + ' · ' + b.count + '</option>'; }).join("");
      csel.addEventListener("change", function () { setBrand(csel.value); });
    }
    var ssel = $("#setting-select");
    if (ssel) {
      // Settings offered = only those actually present in the data, with counts.
      var counts = {};
      PROPS.forEach(function (p) {
        settingsFor(p).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
      });
      var order = Object.keys(SETTING_LABELS).filter(function (k) { return counts[k]; })
        .sort(function (a, b) { return counts[b] - counts[a]; });
      ssel.innerHTML = '<option value="">Any setting</option>' +
        order.map(function (k) {
          return '<option value="' + k + '">' + esc(settingLabel(k)) + ' · ' + counts[k] + '</option>';
        }).join("");
      ssel.addEventListener("change", function () { setSetting(ssel.value); });
    }
  }
  function setSetting(val) {
    state.setting = val || "";
    syncControls();
    if (val) track("filter_selected", { filter_type: "setting", filter_value: val, source: "dropdown" });
    renderDirectory();
  }
  function setType(cat) {
    state.cats = cat ? [cat] : [];
    syncControls();
    if (cat) track("filter_selected", { filter_type: "region", filter_value: cat, source: "dropdown" });
    renderDirectory();
  }
  function setBrand(val) {
    state.brands = val ? [val] : [];
    syncControls();
    if (val) track("filter_selected", { filter_type: "collection", filter_value: val, source: "dropdown" });
    renderDirectory();
  }
  function syncControls() {
    var rsel = $("#region-select"); if (rsel) rsel.value = state.cats[0] || "";
    var csel = $("#collection-select"); if (csel) csel.value = state.brands[0] || "";
    var ssel = $("#setting-select"); if (ssel) ssel.value = state.setting || "";
  }

  function clearAll() {
    state.query = ""; state.cats = []; state.brands = []; state.setting = ""; state.sort = "featured";
    var input = $("#search-input"); if (input) input.value = "";
    var sort = $("#sort-select"); if (sort) sort.value = "featured";
    syncControls();
    renderDirectory();
  }

  /* -----------------------------------------------------------------
     Search wiring
     ----------------------------------------------------------------- */
  var searchTimer, lastTracked = "";
  function wireSearch() {
    var input = $("#search-input");
    var form = $("#search-form");
    if (input) {
      input.addEventListener("input", function () {
        state.query = input.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          renderDirectory();
          var q = input.value.trim();
          if (q.length >= 2 && q !== lastTracked) {
            lastTracked = q;
            track("search_initiated", { search_term: q, results: filtered().length });
          }
        }, 200);
      });
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        renderDirectory();
        track("search_initiated", { search_term: state.query.trim(), results: filtered().length, source: "submit" });
        scrollToDirectory();
      });
    }
    var sort = $("#sort-select");
    if (sort) sort.addEventListener("change", function () {
      state.sort = sort.value;
      track("filter_selected", { filter_type: "sort", filter_value: sort.value });
      renderDirectory();
    });
  }

  /* Typewriter placeholder — cycles example searches until the field is used. */
  function wireTypewriter() {
    var input = $("#search-input");
    if (!input || prefersReduced()) return;
    var samples = ["“a beachfront villa in Florida”", "“luxury residence near Orlando”", "“a home with a pool for a family”", "“somewhere quiet near the beach”", "“a spacious villa in Anguilla”", "“ski residence in the mountains”"];
    var si = 0, ci = 0, deleting = false, active = true, tId;
    var PRE = "Try ", SUF = "…";
    function stop() { active = false; clearTimeout(tId); }
    input.addEventListener("focus", stop);
    input.addEventListener("input", stop);
    function tick() {
      if (!active) return;
      if (input.value) { stop(); return; }
      var word = samples[si];
      ci += deleting ? -1 : 1;
      input.setAttribute("placeholder", PRE + word.slice(0, ci) + (ci < word.length || deleting ? "" : SUF));
      var delay = deleting ? 45 : 85;
      if (!deleting && ci >= word.length) { deleting = false; delay = 1500; deleting = true; }
      else if (deleting && ci <= 0) { deleting = false; si = (si + 1) % samples.length; delay = 350; }
      tId = setTimeout(tick, delay);
    }
    tId = setTimeout(tick, 900);
  }

  /* -----------------------------------------------------------------
     Delegated clicks — property CTAs, favourites, generic CTAs
     ----------------------------------------------------------------- */
  function wireDelegation() {
    document.addEventListener("click", function (e) {
      var hfav = e.target.closest && e.target.closest("[data-hero-fav]");
      if (hfav) {
        var hid = hfav.getAttribute("data-id");
        var hon = hfav.getAttribute("aria-pressed") !== "true";
        hfav.setAttribute("aria-pressed", hon);
        if (hid) state.favs[hid] = hon;
        return;
      }
      var fav = e.target.closest && e.target.closest(".pcard__fav");
      if (fav) {
        var card = fav.closest(".pcard");
        var id = card && card.getAttribute("data-id");
        var on = fav.getAttribute("aria-pressed") !== "true";
        fav.setAttribute("aria-pressed", on);
        if (id) state.favs[id] = on;
        return;
      }
      // Open the zoomed detail view for a property.
      var detailBtn = e.target.closest && e.target.closest('[data-action="detail"]');
      if (detailBtn) {
        e.preventDefault();
        var did = +detailBtn.getAttribute("data-id");
        var dp = PROPS.filter(function (x) { return x.id === did; })[0];
        if (dp) openDetail(dp, detailBtn);
        return;
      }
      // The availability CTA (inside the modal) leaves for the WhataHotel page.
      var propCta = e.target.closest && e.target.closest('[data-cta="explore-property"]');
      if (propCta) {
        track("property_card_clicked", {
          property_id: propCta.getAttribute("data-id"),
          property_name: propCta.getAttribute("data-name")
        });
        track("availability_check_initiated", { property_id: propCta.getAttribute("data-id") });
        return;
      }
      var cta = e.target.closest && e.target.closest("[data-cta]");
      if (cta && cta.getAttribute("data-cta") !== "explore-property") {
        track("cta_clicked", { cta: cta.getAttribute("data-cta"), label: (cta.textContent || "").trim() });
      }
    });
  }

  /* =================================================================
     PROPERTY DETAIL MODAL — a zoomed, editorial view of one property.
     Uses factual enrichment from window.WAH_DETAILS when available and
     always falls back to the property's own known data. Accessible:
     focus trap, ESC to close, backdrop click, scroll lock, restores focus.
     ================================================================= */
  var modalEl = null, modalLastFocus = null, modalKeydown = null;

  function detailsFor(p) { return (window.WAH_DETAILS && window.WAH_DETAILS[p.id]) || null; }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "pmodal";
    modalEl.id = "pmodal";
    modalEl.setAttribute("hidden", "");
    modalEl.innerHTML =
      '<div class="pmodal__backdrop" data-close></div>' +
      '<div class="pmodal__dialog" role="dialog" aria-modal="true" aria-labelledby="pmodal-title">' +
        '<button class="pmodal__close" type="button" data-close aria-label="Close details">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div class="pmodal__scroll" id="pmodal-scroll"></div>' +
      '</div>';
    document.body.appendChild(modalEl);
    $$("[data-close]", modalEl).forEach(function (b) { b.addEventListener("click", closeDetail); });
    return modalEl;
  }

  function chipList(items, kind) {
    return items.map(function (t) {
      var ico = kind === "perk" ? checkSVG() : dotSVG();
      return '<li>' + ico + '<span>' + esc(t) + '</span></li>';
    }).join("");
  }

  function openDetail(p, trigger) {
    ensureModal();
    modalLastFocus = trigger || document.activeElement;
    var d = detailsFor(p);
    var availUrl = buildAvailabilityUrl(p);
    var pageUrl = buildPropertyUrl(p);

    var regionLabel = REGION_SHORT[p.regionKey] || p.region || "";
    var eyebrow = (d && d.collection) ? esc(d.collection) : esc(p.collection || p.brand || regionLabel);
    var locFull = (d && d.locationFull) ? d.locationFull : (p.loc || "");
    var desc = (d && d.desc) ? d.desc : blurbText(p);
    var ratingHTML = (d && d.rating) ? '<span class="pmodal__rating">' + starSVG() + esc(d.rating) + '</span>' : "";

    // Highlights: enriched list when available, else the property's real facts.
    var facts = [];
    if (p.loc) facts.push("Location — " + p.loc);
    if (regionLabel) facts.push("Region — " + regionLabel);
    if (p.collection) facts.push("Collection — " + p.collection);
    var highlights = (d && d.highlights) ? d.highlights : facts;
    var perks = (d && d.perks) ? d.perks : null;

    // Factual chips: region + country + brand (all from the source list).
    var chips = [{ icon: p.regionKey, label: REGION_BADGE[p.regionKey] || p.region }];
    if (p.country) chips.push({ icon: "pin", label: p.country });
    if (p.brand) chips.push({ icon: "collection", label: p.brand });
    var meta = chips.map(function (c) { return '<span class="pmodal__tag">' + iconFor(c.icon) + esc(c.label) + '</span>'; }).join("");

    // Characteristic chips: setting(s) + features (grounded in real
    // description + geography, never the name).
    var tr = traitsFor(p);
    var traitMeta = "";
    if (tr) {
      var sc = (tr.settings || []).map(function (k) {
        return '<span class="pmodal__tag pmodal__tag--trait">' + (SETTING_ICON[k] || "") + esc(settingLabel(k)) + '</span>';
      });
      var fc = (tr.features || []).map(function (k) {
        return '<span class="pmodal__tag pmodal__tag--feat">' + esc(FEATURE_LABELS[k] || k) + '</span>';
      });
      traitMeta = sc.concat(fc).join("");
    }

    var body =
      '<div class="pmodal__media">' +
        '<div class="scene">' + sceneSVG(p.scene) + '</div>' +
        imgTag(p, 1000, "pmodal__photo", "") +
        '<span class="pmodal__typebadge">' + esc(REGION_BADGE[p.regionKey] || p.region) + '</span>' +
      '</div>' +
      '<div class="pmodal__content">' +
        '<div class="pmodal__eyebrow">' + eyebrow + '</div>' +
        '<h2 class="pmodal__title" id="pmodal-title">' + esc(p.name) + '</h2>' +
        '<div class="pmodal__loc">' + pinSVG() + '<span>' + esc(locFull) + '</span>' + ratingHTML + '</div>' +
        (meta ? '<div class="pmodal__tags">' + meta + '</div>' : "") +
        (traitMeta ? '<div class="pmodal__tags pmodal__tags--traits">' + traitMeta + '</div>' : "") +
        '<p class="pmodal__desc">' + esc(desc) + '</p>' +
        ((d && d.stay) ? '<div class="pmodal__stay"><h4>Accommodations</h4><p>' + esc(d.stay) + '</p></div>' : "") +
        '<div class="pmodal__cols">' +
          '<div class="pmodal__col"><h4>' + (d && d.highlights ? "Highlights" : "At a glance") + '</h4><ul class="pmodal__list">' + chipList(highlights, "hl") + '</ul></div>' +
          (perks ? '<div class="pmodal__col pmodal__col--perks"><h4>WhataHotel Signature perks</h4><ul class="pmodal__list">' + chipList(perks, "perk") + '</ul></div>' : "") +
        '</div>' +
        '<p class="pmodal__note">“Check Availability” opens this property’s live WhataHotel availability, filtered to its residential-style units (villas, residences &amp; homes) where offered.</p>' +
        '<div class="pmodal__actions">' +
          '<a class="btn btn-primary btn-lg" href="' + availUrl + '" target="_blank" rel="noopener" ' +
             'data-cta="explore-property" data-id="' + p.id + '" data-name="' + esc(p.name) + '">Check Availability' + arrowSVG() + '</a>' +
          '<button class="btn btn-outline btn-lg" type="button" data-close>Keep browsing</button>' +
        '</div>' +
        '<a class="pmodal__source" href="' + pageUrl + '" target="_blank" rel="noopener">View full property on WhataHotel.com ↗</a>' +
      '</div>';

    $("#pmodal-scroll").innerHTML = body;
    $$("[data-close]", modalEl).forEach(function (b) { if (!b._wired) { b.addEventListener("click", closeDetail); b._wired = true; } });

    modalEl.removeAttribute("hidden");
    document.body.classList.add("modal-open");
    requestAnimationFrame(function () { modalEl.classList.add("is-open"); });
    // focus management
    var focusables = $$('a[href], button:not([disabled])', modalEl);
    (focusables[0] || modalEl).focus();
    modalKeydown = function (e) {
      if (e.key === "Escape") { closeDetail(); return; }
      if (e.key === "Tab" && focusables.length) {
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", modalKeydown);
    pauseCarousels(); // pause carousel autoplay while viewing
    track("property_detail_opened", { property_id: p.id, property_name: p.name, enriched: !!d });
  }

  function closeDetail() {
    if (!modalEl) return;
    modalEl.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    if (modalKeydown) { document.removeEventListener("keydown", modalKeydown); modalKeydown = null; }
    setTimeout(function () { modalEl.setAttribute("hidden", ""); }, 260);
    if (modalLastFocus && modalLastFocus.focus) modalLastFocus.focus();
    resumeCarousels();
  }

  /* -----------------------------------------------------------------
     Smooth scroll to directory / focus search
     ----------------------------------------------------------------- */
  function scrollToDirectory() {
    var el = $("#directory");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function wireScrollLinks() {
    $$('[data-scroll]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var sel = a.getAttribute("data-scroll");
        var el = $(sel);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          if (a.getAttribute("data-focus") === "search") {
            var input = $("#search-input"); if (input) setTimeout(function () { input.focus(); }, 500);
          }
        }
      });
    });
  }

  /* -----------------------------------------------------------------
     Full-bleed video section — the video IS the section background.
     Lazy-loaded: the src is set from data-src and playback starts only
     when the section scrolls into view (page-speed friendly), then plays
     muted + looping. Pauses when scrolled out of view. Honors
     prefers-reduced-motion (loads the poster frame but does not autoplay).
     ----------------------------------------------------------------- */
  function wireVideo() {
    var vid = $("#video-bg");
    if (!vid) return;
    var src = vid.getAttribute("data-src");
    if (!src) return;
    // On phones, NEVER load the mp4 — a full-bleed video decoder on top of the
    // hero pushes iOS Safari past its per-tab memory limit and reloads/"crashes"
    // the tab (white screen). Show the static poster image only; desktop keeps
    // the autoplay video. This is the single biggest mobile memory saver.
    var narrow = (window.innerWidth || 1024) <= 820;
    if (narrow) { vid.classList.add("is-playing"); return; }  // reveal poster, no video load
    var reduce = prefersReduced();
    var loaded = false, tracked = false;

    function load() {
      if (loaded) return;
      loaded = true;
      vid.src = src;
      vid.muted = true;                 // required for autoplay
      vid.addEventListener("playing", function () { vid.classList.add("is-playing"); }, { once: true });
      vid.addEventListener("loadeddata", function () { vid.classList.add("is-playing"); }, { once: true });
      if (reduce) { vid.controls = true; vid.load(); }  // no autoplay; let user play
    }
    function play() {
      if (reduce) return;
      load();
      var pr = vid.play();
      if (pr && pr.catch) pr.catch(function () {});
      if (!tracked) { tracked = true; track("video_played", { location: "homes_video_section", mode: "autoplay" }); }
    }

    if (!("IntersectionObserver" in window)) { play(); return; }
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { play(); }
        else if (loaded && !reduce && !vid.paused) { vid.pause(); }
      });
    }, { threshold: 0.25 });
    vio.observe(vid);
  }

  /* -----------------------------------------------------------------
     "How it works" step numbers — each rolls up from 00 to its own
     number (01..04), staggered so they start in order 01 → 04. Runs once
     when the section scrolls into view. The CSS counter is the no-JS
     fallback; adding .js-count hands rendering to this animation.
     ----------------------------------------------------------------- */
  function wireStepCounters() {
    var grid = $(".steps-grid");
    if (!grid) return;
    var nums = $$(".step__num", grid);
    if (!nums.length) return;
    grid.classList.add("js-count");
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    nums.forEach(function (el) { el.textContent = "00"; });

    if (prefersReduced()) {
      nums.forEach(function (el, i) { el.textContent = two(i + 1); });
      return;
    }

    var START_STAGGER = 240; // ms between each tile starting (01 → 04)
    var TICK = 190;          // ms per increment while rolling up
    function runOne(el, target) {
      var v = 0;
      el.textContent = "00";
      (function tick() {
        v += 1;
        el.textContent = two(v);
        if (v < target) setTimeout(tick, TICK);
      })();
    }
    function runAll() {
      nums.forEach(function (el, i) {
        setTimeout(function () { runOne(el, i + 1); }, i * START_STAGGER);
      });
    }

    if (!("IntersectionObserver" in window)) { runAll(); return; }
    var done = false;
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !done) { done = true; runAll(); sio.disconnect(); }
      });
    }, { threshold: 0.4 });
    sio.observe(grid);
  }

  /* -----------------------------------------------------------------
     Scroll reveal + sticky mobile CTA + header state
     ----------------------------------------------------------------- */
  var io, flushWired = false, flushRaf = 0;
  function observeReveals(scope) {
    if (!("IntersectionObserver" in window)) { $$(".reveal", scope).forEach(function (n) { n.classList.add("in"); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    }
    $$(".reveal:not(.in)", scope || document).forEach(function (n) { io.observe(n); });
    // Safety net: IntersectionObserver can miss elements during very fast or
    // programmatic scrolling. A throttled scroll pass reveals anything whose
    // top has already passed into (or above) the viewport, so nothing stays
    // stuck hidden.
    if (!flushWired) {
      flushWired = true;
      var flush = function () {
        flushRaf = 0;
        var vh = window.innerHeight || 0;
        // Read ALL geometry first, then write — avoids a read/write/read
        // interleave that would force a reflow on every element.
        var nodes = $$(".reveal:not(.in)"), reveal = [];
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].getBoundingClientRect().top < vh * 0.92) reveal.push(nodes[i]);
        }
        reveal.forEach(function (n) { n.classList.add("in"); io.unobserve(n); });
      };
      var onScroll = function () { if (!flushRaf) flushRaf = requestAnimationFrame(flush); };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }
  }
  function wireMobileCta() {
    var bar = $("#mobile-cta");
    var hero = $("#hero");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      bar.classList.toggle("show", !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* -----------------------------------------------------------------
     Header — solid (cream) state on scroll + mobile burger menu.
     The header overlays the hero transparently at the top and turns
     solid once scrolled; the burger reveals the nav on mobile.
     ----------------------------------------------------------------- */
  function wireHeader() {
    var header = $("#site-header");
    if (!header) return;
    var toggle = $("#nav-toggle");
    var mnav = $("#mobile-nav");

    // Solid state once the page is scrolled past the very top.
    var solidRaf = 0;
    function updateSolid() {
      solidRaf = 0;
      header.classList.toggle("is-solid", (window.pageYOffset || 0) > 24);
    }
    window.addEventListener("scroll", function () {
      if (!solidRaf) solidRaf = requestAnimationFrame(updateSolid);
    }, { passive: true });
    updateSolid();

    // Mobile burger menu.
    if (toggle && mnav) {
      mnav.removeAttribute("hidden"); // JS now controls visibility via .nav-open
      var open = function (o) {
        header.classList.toggle("nav-open", o);
        toggle.setAttribute("aria-expanded", o ? "true" : "false");
        toggle.setAttribute("aria-label", o ? "Close menu" : "Open menu");
      };
      toggle.addEventListener("click", function () {
        var willOpen = !header.classList.contains("nav-open");
        open(willOpen);
        if (willOpen) track("nav_menu_opened", { source: "burger" });
      });
      // Close on link tap, Escape, or resize up to desktop.
      $$("[data-mnav]", mnav).forEach(function (a) {
        a.addEventListener("click", function () { open(false); });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && header.classList.contains("nav-open")) open(false);
      });
      window.addEventListener("resize", function () {
        if (window.innerWidth >= 900 && header.classList.contains("nav-open")) open(false);
      });
    }
  }

  /* -----------------------------------------------------------------
     AI Concierge (LiveAvatar) — lazy-loaded on first open so the embed
     and microphone prompt only start when the visitor asks for it.
     ----------------------------------------------------------------- */
  function wireConcierge() {
    var root = $("#concierge"), launch = $("#concierge-launch"), close = $("#concierge-close"),
        panel = $("#concierge-panel"), media = $("#concierge-media"),
        iframe = $("#concierge-iframe"), video = $("#concierge-video"),
        loading = $("#concierge-loading"), controls = $("#concierge-controls"),
        micBtn = $("#concierge-mic"), endBtn = $("#concierge-end");
    if (!root || !launch) return;

    var CFG = window.WAH_AVATAR || {};
    // Disabled for now — the whole widget stays hidden and inert. Set
    // window.WAH_AVATAR.enabled = true (in index.html) to switch it back on.
    if (!CFG.enabled) { root.setAttribute("hidden", ""); return; }
    root.removeAttribute("hidden");

    var started = false, session = null, listening = true;

    function hideLoading() { if (loading) loading.classList.add("hide"); }

    function loadScript(src) {
      return new Promise(function (res, rej) {
        if (window.LiveAvatarSDK) return res();
        if (!src) return rej(new Error("no_sdk_url"));
        var s = document.createElement("script");
        s.src = src; s.async = true;
        s.onload = function () { res(); };
        s.onerror = function () { rej(new Error("sdk_load_failed")); };
        document.head.appendChild(s);
      });
    }

    // Fallback path: the no-backend iframe embed.
    function useIframe(reason) {
      if (media) media.classList.add("mode-iframe");
      if (iframe && !iframe.src && iframe.getAttribute("data-src")) {
        iframe.addEventListener("load", hideLoading);
        iframe.src = iframe.getAttribute("data-src");
      } else { hideLoading(); }
      track("concierge_avatar_started", { mode: "iframe", reason: reason || "" });
    }

    // Preferred path: SDK streams the avatar into <video>.
    function startSdk() {
      var url = CFG.tokenEndpoint || "/api/liveavatar-token";
      return fetch(url, { method: "POST", headers: { "Accept": "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error("token_http_" + r.status); return r.json(); })
        .then(function (t) {
          var token = t.session_token || (t.data && t.data.session_token);
          if (!token) throw new Error("no_token");
          return loadScript(CFG.sdkUrl).then(function () { return token; });
        })
        .then(function (token) {
          var SDK = window.LiveAvatarSDK;
          if (!SDK || !SDK.LiveAvatarSession) throw new Error("sdk_missing");
          session = new SDK.LiveAvatarSession(token);
          if (video) session.attach(video);
          return session.start();
        })
        .then(function () {
          try { session.startListening(); listening = true; } catch (e) {}
          if (media) media.classList.add("mode-sdk");
          if (controls) controls.hidden = false;
          hideLoading();
          track("concierge_avatar_started", { mode: "sdk" });
        });
    }

    function open() {
      root.classList.add("is-open");
      launch.setAttribute("aria-expanded", "true");
      if (panel) panel.setAttribute("aria-hidden", "false");
      if (!started) {
        started = true;
        startSdk().catch(function (err) {
          if (window.WAH_DEBUG) console.warn("[concierge] SDK unavailable → embed:", err && err.message);
          useIframe(err && err.message);
        });
      }
      track("concierge_opened", {});
    }

    // Closing fully ends the session (stops the stream) so nothing keeps
    // streaming — and billing — in the background. Reopening starts fresh.
    function shut() {
      root.classList.remove("is-open");
      launch.setAttribute("aria-expanded", "false");
      if (panel) panel.setAttribute("aria-hidden", "true");
      if (session) { try { session.stop(); } catch (e) {} session = null; }
      if (iframe) iframe.removeAttribute("src");
      if (media) media.classList.remove("mode-sdk", "mode-iframe");
      if (controls) controls.hidden = true;
      if (loading) loading.classList.remove("hide");
      if (micBtn) { micBtn.setAttribute("aria-pressed", "true"); micBtn.classList.remove("is-muted"); }
      started = false; listening = true;
    }

    launch.addEventListener("click", function () { root.classList.contains("is-open") ? shut() : open(); });
    if (close) close.addEventListener("click", shut);
    if (endBtn) endBtn.addEventListener("click", shut);
    if (micBtn) micBtn.addEventListener("click", function () {
      if (!session) return;
      if (listening) { try { session.stopListening(); } catch (e) {} listening = false; }
      else { try { session.startListening(); } catch (e) {} listening = true; }
      micBtn.setAttribute("aria-pressed", String(listening));
      micBtn.classList.toggle("is-muted", !listening);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("is-open")) shut(); });
    document.addEventListener("click", function (e) { if (root.classList.contains("is-open") && !root.contains(e.target)) shut(); });
    window.addEventListener("pagehide", function () { if (session) { try { session.stop(); } catch (e) {} } });
  }

  /* -----------------------------------------------------------------
     Hero + video poster scenes
     ----------------------------------------------------------------- */
  function paintStaticScenes() {
    $$("[data-scene]").forEach(function (el) {
      el.innerHTML = sceneSVG(el.getAttribute("data-scene"));
    });
  }

  /* ---- tiny inline icons ---- */
  function heartSVG() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.6-10-9.3C.7 8.9 2 5.5 5.2 5.1 7.2 4.8 9 6 12 9c3-3 4.8-4.2 6.8-3.9C22 5.5 23.3 8.9 22 11.7 19.5 16.4 12 21 12 21z"/></svg>'; }
  function pinSVG() { return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z"/></svg>'; }
  function arrowSVG() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; }
  function bookmarkSVG() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/></svg>'; }
  function searchSVG() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'; }
  function zoomSVG() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M11 8v6M8 11h6"/></svg>'; }
  function checkSVG() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 7"/></svg>'; }
  function dotSVG() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="3.4"/></svg>'; }
  function starSVG() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.9 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z"/></svg>'; }

  /* -----------------------------------------------------------------
     Init
     ----------------------------------------------------------------- */
  function init() {
    paintStaticScenes();
    buildHero();
    renderCategories();
    buildFilters();
    buildFeaturedGallery();
    renderDirectory();
    wireSearch();
    wireTypewriter();
    wireDirMore();
    wireDelegation();
    wireScrollLinks();
    wireVideo();
    wireStepCounters();
    wireHeader();
    wireMobileCta();
    wireConcierge();
    observeReveals(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
