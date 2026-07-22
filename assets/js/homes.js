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
  // Each property carries its real canonical WhataHotel URL. We append the
  // Homes-intent flag + campaign params so availability filtering and paid-
  // traffic attribution carry through to the property page.
  function buildPropertyUrl(p) {
    var url = p.url || ("https://www.whatahotel.com/browse_offers.cfm?hotelID=" + p.id);
    var params = "stayType=homes&utm_source=homes_landing&utm_medium=referral&utm_campaign=homes_directory";
    return url + (url.indexOf("?") === -1 ? "?" : "&") + params;
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
     Categories used for filter chips & category cards.
     ----------------------------------------------------------------- */
  var CATEGORIES = [
    { key: "villa",     label: "Villas",     blurb: "Private space, pools and resort-style living.", scene: "tropical" },
    { key: "residence", label: "Residences", blurb: "Multi-bedroom living with full residential comforts.", scene: "city" },
    { key: "home",      label: "Homes",      blurb: "The comforts of home at exceptional resorts.", scene: "beach" },
    { key: "estate",    label: "Estates",    blurb: "Expansive private estates for the whole group.", scene: "countryside" }
  ];
  // Condos & apartments are surfaced within their related categories/filters.
  var CAT_ALIAS = { home: ["home"], villa: ["villa"], residence: ["residence", "apartment", "condo"], estate: ["estate"] };
  var FEATURES = [
    { key: "beachfront",    label: "Beachfront" },
    { key: "mountain",      label: "Mountain" },
    { key: "family",        label: "Family-friendly" },
    { key: "multi-bedroom", label: "Multiple bedrooms" },
    { key: "kitchen",       label: "Kitchen" },
    { key: "private-pool",  label: "Private pool" }
  ];
  var TYPE_LABEL = { home:"Home", villa:"Villa", residence:"Residence", apartment:"Apartment", condo:"Condo", estate:"Estate" };

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
    bolt:         ic('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>')
  };
  function iconFor(key) { return ICONS[key] || ""; }

  /* -----------------------------------------------------------------
     State
     ----------------------------------------------------------------- */
  var state = { query: "", cats: [], feats: [], sort: "featured", favs: {} };

  function propMatchesCat(p, cat) {
    var wanted = CAT_ALIAS[cat] || [cat];
    return p.types.some(function (t) { return wanted.indexOf(t) !== -1; });
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    var list = PROPS.filter(function (p) {
      if (state.cats.length && !state.cats.some(function (c) { return propMatchesCat(p, c); })) return false;
      if (state.feats.length && !state.feats.every(function (f) { return p.features.indexOf(f) !== -1; })) return false;
      if (q) {
        var hay = [p.name, p.loc, p.types.join(" ")].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (state.sort === "az") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (state.sort === "destination") list.sort(function (a, b) { return (a.loc || "").localeCompare(b.loc || ""); });
    else list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    return list;
  }

  /* -----------------------------------------------------------------
     Splash photography — curated, scene-matched Unsplash images used as an
     attractive placeholder until real WhataHotel property photos are wired in
     (add an `image` field to a property to override). The CSS/SVG scene sits
     behind every photo and shows instantly + as the fallback if an image is
     blocked or 404s, so the card is never broken and LCP is never blank.
     ----------------------------------------------------------------- */
  var UNSPLASH = "https://images.unsplash.com/photo-";
  var IMG_PARAMS = "?w=900&q=70&auto=format&fit=crop";
  var SCENE_IMAGES = {
    beach:       ["1520250497591-112f2f40a3f4", "1507525428034-b723cf961d3e", "1519046904884-53103b34b206", "1512100356356-de1b84283e18"],
    tropical:    ["1540541338287-41700207dee6", "1571896349842-33c89424de2d", "1582719508461-905c673771fd", "1596436889106-be35e843f974"],
    mountain:    ["1502784444187-359ac186c5bb", "1520984032042-162d526883e0"],
    city:        ["1551882547-ff40c63fe5fa", "1522708323590-d24dbb6b0267", "1560448204-e02f11c3d0e2", "1502672260266-1c1ef2d93688"],
    desert:      ["1539020140153-e479b8c22e70", "1445019980597-93fa8acb246c", "1558449028-b53a39d100fc", "1566073771259-6a8506099945"],
    countryside: ["1505693416388-ac5ce068fe85", "1470071459604-3b5ec3a7fe05", "1512918728675-ed5a9ecdebfd"],
    estate:      ["1613977257363-707ba9348227", "1600585154340-be6161a56a0c", "1600596542815-ffad4c1539a9", "1600607687939-ce8a6c25118c"]
  };
  // Optional: a self-contained preview can define window.WAH_IMAGE_MAP =
  // { scene: [dataURI, ...] } so photos render with no external requests
  // (used by the offline/artifact preview). Production omits it and uses the
  // Unsplash CDN URLs below.
  function sceneImage(scene, seed, width) {
    var map = window.WAH_IMAGE_MAP;
    if (map && map[scene] && map[scene].length) {
      return map[scene][Math.abs(seed) % map[scene].length];
    }
    var pool = SCENE_IMAGES[scene] || SCENE_IMAGES.beach;
    var params = width ? ("?w=" + width + "&q=72&auto=format&fit=crop") : IMG_PARAMS;
    return UNSPLASH + pool[Math.abs(seed) % pool.length] + params;
  }
  function imageFor(p) {
    if (p.image) return p.image;
    return sceneImage(p.scene, p.id);
  }

  /* -----------------------------------------------------------------
     Card rendering
     ----------------------------------------------------------------- */
  function renderMedia(p) {
    // Scene sits behind; the photo overlays it and is removed on error so the
    // scene shows through — never a broken image.
    return '<div class="scene">' + sceneSVG(p.scene) + '</div>' +
           '<img class="pcard__photo" src="' + imageFor(p) + '" ' +
           'alt="' + esc(p.name) + (p.loc ? ", " + esc(p.loc) : "") + '" ' +
           'loading="lazy" decoding="async" onerror="this.remove()">';
  }

  function typeBadge(p) {
    var t = p.types[0];
    return TYPE_LABEL[t] || "Residence";
  }
  var TYPE_PLURAL = { home: "Homes", villa: "Villas", residence: "Residences", apartment: "Apartments", condo: "Condos", estate: "Estate" };
  function eyebrowFor(p) {
    // e.g. "VILLAS" or "VILLAS · RESIDENCES" when a property offers both.
    return p.types.slice(0, 2).map(function (t) { return TYPE_PLURAL[t] || TYPE_LABEL[t] || t; }).join(" · ");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c];
    });
  }

  function cardHTML(p, i, anim) {
    var url = buildPropertyUrl(p);
    var delay = ((i || 0) % 3);
    var animAttr = ' data-anim="' + (anim || "rise") + '" style="--d:' + delay + '"';
    var tags = p.types.slice(0, 3).map(function (t) { return '<span class="tag-pill">' + esc(TYPE_LABEL[t] || t) + '</span>'; });
    // add up to one standout feature pill
    var featPill = "";
    if (p.features.indexOf("private-pool") !== -1) featPill = "Private Pool";
    else if (p.features.indexOf("beachfront") !== -1) featPill = "Beachfront";
    else if (p.features.indexOf("multi-bedroom") !== -1) featPill = "Multi-Bedroom";
    if (featPill) tags.push('<span class="tag-pill">' + featPill + '</span>');

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
        '<p class="pcard__blurb">' + esc((p.blurb || "").trim()) + '</p>' +
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

  function renderDirectory() {
    var list = filtered();
    var grid = $("#directory-grid");
    var count = $("#directory-count");
    if (count) count.innerHTML = "<b>" + list.length + "</b> " + (list.length === 1 ? "property" : "properties");
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' + searchSVG() +
        '<h3>No properties match those filters</h3>' +
        '<p>Try a different destination or clear a filter to see more homes, villas and residences.</p>' +
        '<button class="btn btn-outline" type="button" id="clear-empty">Clear all filters</button></div>';
      var ce = $("#clear-empty"); if (ce) ce.addEventListener("click", clearAll);
      return;
    }
    grid.innerHTML = list.map(function (p, i) { return cardHTML(p, i, "zoom"); }).join("");
    observeReveals(grid);
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
  // Curated, type- and scene-diverse marquee slides. Editorial copy is kept
  // grounded in each property's real location & type (no invented amenities).
  var HERO = [
    { id: 6796, kicker: "Overwater Villas · Maldives",
      desc: "Beachfront and overwater villas on a private Indian Ocean lagoon — each with its own pool and unhurried space to spread out." },
    { id: 6282, kicker: "Ski Residences · Deer Valley",
      desc: "Ski-in, ski-out mountain residences with fireplaces and full kitchens, moments from Deer Valley's celebrated slopes." },
    { id: 1000, kicker: "Country Estate · Ireland",
      desc: "A sweeping Irish country estate of manor residences, wrapped in ancient woodland, formal gardens and riverbank." },
    { id: 6558, kicker: "Beach Homes & Villas · Charleston",
      desc: "Beachfront homes and villas on a barrier island minutes from historic Charleston — room enough for the whole family." },
    { id: 3287, kicker: "Beachfront Residences · Waikiki",
      desc: "Full-kitchen residences on the sand at Waikiki, with sweeping Pacific and Diamond Head views." },
    { id: 3022, kicker: "Cliffside Villa · Dubrovnik",
      desc: "An intimate Adriatic villa perched above the sea, a short stroll from the storied walls of old-town Dubrovnik." }
  ];
  var META_KEYS = ["multi-bedroom", "private-pool", "kitchen", "beachfront", "mountain", "family"];
  var META_LABEL = { "multi-bedroom": "Multiple bedrooms", "private-pool": "Private pool", kitchen: "Full kitchen", beachfront: "Beachfront", mountain: "Mountain", family: "Family-friendly" };

  function heroSlides() {
    var list = HERO.map(function (h) {
      var p = PROPS.filter(function (x) { return x.id === h.id; })[0];
      return p ? { p: p, kicker: h.kicker, desc: h.desc } : null;
    }).filter(Boolean);
    if (list.length < 3) { // fallback to featured if ids drift
      list = PROPS.filter(function (p) { return p.featured; }).slice(0, 6)
        .map(function (p) { return { p: p, kicker: eyebrowFor(p) + " · " + (p.loc || ""), desc: p.blurb }; });
    }
    return list;
  }

  var hero = { i: 0, slides: [], timer: null, raf: null, start: 0, elapsed: 0, paused: false, AUTO: 6400 };

  function buildHero() {
    var root = $("#hero-carousel");
    if (!root) return;
    hero.slides = heroSlides();
    if (!hero.slides.length) return;

    var slidesHTML = hero.slides.map(function (s, i) {
      var p = s.p;
      var meta = META_KEYS.filter(function (k) { return p.features.indexOf(k) !== -1; }).slice(0, 3)
        .map(function (k) { return '<li>' + iconFor(k) + '<span>' + esc(META_LABEL[k]) + '</span></li>'; }).join("");
      return '' +
      '<article class="hslide" data-i="' + i + '" aria-hidden="' + (i ? "true" : "false") + '" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + hero.slides.length + '">' +
        '<div class="hslide__media">' +
          '<div class="scene">' + sceneSVG(p.scene) + '</div>' +
          '<img class="hslide__photo" src="' + sceneImage(p.scene, p.id, 1680) + '" alt="' + esc(p.name) + (p.loc ? ", " + esc(p.loc) : "") + '" ' +
            (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async" onerror="this.remove()">' +
        '</div>' +
        '<div class="hslide__scrim"></div>' +
        '<div class="wrap hslide__inner">' +
          '<div class="hslide__content">' +
            '<span class="hslide__kicker">' + pinSVG() + esc(s.kicker) + '</span>' +
            '<h2 class="hslide__title">' + esc(p.name) + '</h2>' +
            '<p class="hslide__desc">' + esc(s.desc) + '</p>' +
            '<ul class="hslide__meta">' + meta + '</ul>' +
            '<div class="hslide__actions">' +
              '<button class="btn btn-primary btn-lg" type="button" data-action="detail" data-id="' + p.id + '">Explore Property' + arrowSVG() + '</button>' +
              '<a class="btn btn-ghost btn-lg" href="#directory" data-scroll="#directory" data-cta="hero-browse">Browse all stays</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join("");

    var thumbs = hero.slides.map(function (s, i) {
      return '<button class="hthumb" type="button" data-go="' + i + '" aria-label="' + esc(s.p.name) + '">' +
        '<img src="' + sceneImage(s.p.scene, s.p.id, 240) + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0">' +
        '<span class="hthumb__label">' + esc(s.p.name) + '</span>' +
      '</button>';
    }).join("");

    var segs = hero.slides.map(function (s, i) {
      return '<button class="hseg" type="button" data-go="' + i + '" aria-label="Go to slide ' + (i + 1) + '"><span class="hseg__fill"></span></button>';
    }).join("");

    root.innerHTML =
      '<div class="hero-track">' + slidesHTML + '</div>' +
      '<div class="hero-progress" aria-hidden="true"><span class="hero-progress__bar" id="hero-bar"></span></div>' +
      '<div class="wrap hero-controls">' +
        '<div class="hero-controls__left">' +
          '<div class="hero-count"><b id="hero-index">01</b><span>/ ' + pad(hero.slides.length) + '</span></div>' +
          '<div class="hero-segs">' + segs + '</div>' +
        '</div>' +
        '<div class="hero-controls__right">' +
          '<button class="hero-arrow" id="hero-prev" type="button" aria-label="Previous property">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>' +
          '<button class="hero-arrow" id="hero-next" type="button" aria-label="Next property">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="hero-thumbs" aria-hidden="true">' + thumbs + '</div>';

    // wire controls
    $("#hero-prev").addEventListener("click", function () { go(hero.i - 1, true); });
    $("#hero-next").addEventListener("click", function () { go(hero.i + 1, true); });
    $$(".hseg, .hthumb", root).forEach(function (b) {
      b.addEventListener("click", function () { go(+b.getAttribute("data-go"), true); });
    });
    // pause on hover / focus / touch
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) { root.addEventListener(ev, pause, { passive: true }); });
    ["mouseleave", "focusout"].forEach(function (ev) { root.addEventListener(ev, resume); });
    // keyboard
    root.setAttribute("tabindex", "-1");
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { go(hero.i - 1, true); }
      else if (e.key === "ArrowRight") { go(hero.i + 1, true); }
    });
    // swipe
    var sx = 0, sy = 0;
    root.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(hero.i + (dx < 0 ? 1 : -1), true);
    }, { passive: true });

    go(0, false);
    if (!prefersReduced()) startAuto();
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function go(idx, userInitiated) {
    var n = hero.slides.length;
    hero.i = ((idx % n) + n) % n;
    $$("#hero-carousel .hslide").forEach(function (el) {
      var on = +el.getAttribute("data-i") === hero.i;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    $$("#hero-carousel .hseg").forEach(function (el, i) { el.classList.toggle("is-active", i === hero.i); });
    $$("#hero-carousel .hthumb").forEach(function (el, i) { el.setAttribute("aria-current", i === hero.i ? "true" : "false"); });
    var idxEl = $("#hero-index"); if (idxEl) idxEl.textContent = pad(hero.i + 1);
    // reset autoplay progress
    hero.elapsed = 0; hero.start = 0;
    setBar(0);
    if (userInitiated) {
      track("hero_slide_change", { property_id: hero.slides[hero.i].p.id, property_name: hero.slides[hero.i].p.name, source: "user" });
    }
  }
  function setBar(p) { var b = $("#hero-bar"); if (b) b.style.width = (p * 100).toFixed(2) + "%"; }

  function startAuto() {
    stopAuto();
    hero.raf = requestAnimationFrame(function loop(ts) {
      if (!hero.start) hero.start = ts;
      if (hero.paused) { hero.start = ts - hero.elapsed; }
      else {
        hero.elapsed = ts - hero.start;
        var p = Math.min(1, hero.elapsed / hero.AUTO);
        setBar(p);
        if (p >= 1) { hero.start = ts; hero.elapsed = 0; go(hero.i + 1, false); }
      }
      hero.raf = requestAnimationFrame(loop);
    });
  }
  function stopAuto() { if (hero.raf) cancelAnimationFrame(hero.raf); hero.raf = null; }
  function pause() { hero.paused = true; }
  function resume() { hero.paused = false; }

  function renderCategories() {
    var wrap = $("#category-grid");
    if (!wrap) return;
    wrap.innerHTML = CATEGORIES.map(function (c, i) {
      var n = PROPS.filter(function (p) { return propMatchesCat(p, c.key); }).length;
      var img = sceneImage(c.scene, 0);
      return '<button class="cat-card reveal" data-anim="zoom" style="--d:' + i + '" type="button" data-cat="' + c.key + '">' +
        '<div class="scene">' + sceneSVG(c.scene) + '</div>' +
        '<img class="cat-card__photo" src="' + img + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' +
        '<span class="cat-card__count">' + iconFor(c.key) + n + ' stays</span>' +
        '<div class="cat-card__body"><h3>' + esc(c.label) + '</h3><p>' + esc(c.blurb) + '</p></div>' +
      '</button>';
    }).join("");
    $$(".cat-card", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-cat");
        state.cats = [cat];
        syncControls();
        track("filter_selected", { filter_type: "category", filter_value: cat, source: "category_card" });
        renderDirectory();
        scrollToDirectory();
      });
    });
  }

  /* -----------------------------------------------------------------
     Type tabs (segmented, single-select incl. "All") + feature chips.
     Both use hotel-style icons.
     ----------------------------------------------------------------- */
  function buildFilters() {
    // Type tabs
    var tabs = $("#type-tabs");
    if (tabs) {
      var all = '<button class="type-tab" type="button" data-cat="" aria-pressed="true">' +
                iconFor("all") + '<span>All stays</span></button>';
      tabs.innerHTML = all + CATEGORIES.map(function (c) {
        var n = PROPS.filter(function (p) { return propMatchesCat(p, c.key); }).length;
        return '<button class="type-tab" type="button" data-cat="' + c.key + '" aria-pressed="false">' +
          iconFor(c.key) + '<span>' + esc(c.label) + '</span><em>' + n + '</em></button>';
      }).join("");
      $$(".type-tab", tabs).forEach(function (tab) {
        tab.addEventListener("click", function () { setType(tab.getAttribute("data-cat")); });
      });
    }
    // Feature chips
    var row = $("#feature-chips");
    if (row) {
      row.innerHTML = '<span class="chip-row__label">Refine</span>' + FEATURES.map(function (f) {
        return '<button class="chip" type="button" data-key="' + f.key + '" aria-pressed="false">' +
          iconFor(f.key) + esc(f.label) + '<span class="chip-x" aria-hidden="true">✕</span></button>';
      }).join("");
      $$(".chip", row).forEach(function (chip) {
        chip.addEventListener("click", function () { toggleFeature(chip); });
      });
    }
  }
  function setType(cat) {
    state.cats = cat ? [cat] : [];
    syncControls();
    if (cat) track("filter_selected", { filter_type: "category", filter_value: cat, source: "tab" });
    renderDirectory();
  }
  function toggleFeature(chip) {
    var key = chip.getAttribute("data-key");
    var i = state.feats.indexOf(key);
    var on;
    if (i === -1) { state.feats.push(key); on = true; } else { state.feats.splice(i, 1); on = false; }
    chip.setAttribute("aria-pressed", on);
    if (on) track("filter_selected", { filter_type: "feature", filter_value: key, source: "chip" });
    renderDirectory();
  }
  function syncControls() {
    var cur = state.cats[0] || "";
    $$("#type-tabs .type-tab").forEach(function (tab) {
      tab.setAttribute("aria-pressed", tab.getAttribute("data-cat") === cur);
    });
    $$("#feature-chips .chip").forEach(function (chip) {
      chip.setAttribute("aria-pressed", state.feats.indexOf(chip.getAttribute("data-key")) !== -1);
    });
  }

  function clearAll() {
    state.query = ""; state.cats = []; state.feats = []; state.sort = "featured";
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

  /* -----------------------------------------------------------------
     Delegated clicks — property CTAs, favourites, generic CTAs
     ----------------------------------------------------------------- */
  function wireDelegation() {
    document.addEventListener("click", function (e) {
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
    var url = buildPropertyUrl(p);

    var typeLine = p.types.map(function (t) { return TYPE_LABEL[t] || t; }).join(" · ");
    var eyebrow = (d && d.collection) ? esc(d.collection) : typeLine;
    var locFull = (d && d.locationFull) ? d.locationFull : (p.loc || "");
    var desc = (d && d.desc) ? d.desc : (p.blurb || "");
    var ratingHTML = (d && d.rating) ? '<span class="pmodal__rating">' + starSVG() + esc(d.rating) + '</span>' : "";

    // Highlights: use enriched list, else derive honestly from known features.
    var highlights = (d && d.highlights) ? d.highlights
      : p.features.map(function (f) { return META_LABEL[f] || f; });
    var perks = (d && d.perks) ? d.perks : null;

    var meta = META_KEYS.filter(function (k) { return p.features.indexOf(k) !== -1; })
      .map(function (k) { return '<span class="pmodal__tag">' + iconFor(k) + esc(META_LABEL[k]) + '</span>'; }).join("");

    var body =
      '<div class="pmodal__media">' +
        '<div class="scene">' + sceneSVG(p.scene) + '</div>' +
        '<img class="pmodal__photo" src="' + sceneImage(p.scene, p.id, 1280) + '" alt="' + esc(p.name) + '" decoding="async" onerror="this.remove()">' +
        '<span class="pmodal__typebadge">' + esc(typeLine) + '</span>' +
      '</div>' +
      '<div class="pmodal__content">' +
        '<div class="pmodal__eyebrow">' + eyebrow + '</div>' +
        '<h2 class="pmodal__title" id="pmodal-title">' + esc(p.name) + '</h2>' +
        '<div class="pmodal__loc">' + pinSVG() + '<span>' + esc(locFull) + '</span>' + ratingHTML + '</div>' +
        (meta ? '<div class="pmodal__tags">' + meta + '</div>' : "") +
        '<p class="pmodal__desc">' + esc(desc) + '</p>' +
        ((d && d.stay) ? '<div class="pmodal__stay"><h4>Accommodations</h4><p>' + esc(d.stay) + '</p></div>' : "") +
        '<div class="pmodal__cols">' +
          '<div class="pmodal__col"><h4>Highlights</h4><ul class="pmodal__list">' + chipList(highlights, "hl") + '</ul></div>' +
          (perks ? '<div class="pmodal__col pmodal__col--perks"><h4>WhataHotel Signature perks</h4><ul class="pmodal__list">' + chipList(perks, "perk") + '</ul></div>' : "") +
        '</div>' +
        (!d ? '<p class="pmodal__note">Full description, photos and live availability are on the property’s WhataHotel page.</p>' : "") +
        '<div class="pmodal__actions">' +
          '<a class="btn btn-primary btn-lg" href="' + url + '" target="_blank" rel="noopener" ' +
             'data-cta="explore-property" data-id="' + p.id + '" data-name="' + esc(p.name) + '">Check Availability' + arrowSVG() + '</a>' +
          '<button class="btn btn-outline btn-lg" type="button" data-close>Keep browsing</button>' +
        '</div>' +
        '<a class="pmodal__source" href="' + url + '" target="_blank" rel="noopener">View on WhataHotel.com ↗</a>' +
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
    pause(); // pause hero autoplay while viewing
    track("property_detail_opened", { property_id: p.id, property_name: p.name, enriched: !!d });
  }

  function closeDetail() {
    if (!modalEl) return;
    modalEl.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    if (modalKeydown) { document.removeEventListener("keydown", modalKeydown); modalKeydown = null; }
    setTimeout(function () { modalEl.setAttribute("hidden", ""); }, 260);
    if (modalLastFocus && modalLastFocus.focus) modalLastFocus.focus();
    resume();
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
     Video — lazy load only on demand (page-speed friendly).
     Configure the source on #video-frame via data-embed (YouTube/Vimeo
     URL) or data-src (self-hosted mp4). Falls back to a poster CTA.
     ----------------------------------------------------------------- */
  function wireVideo() {
    var poster = $("#video-poster");
    var frame = $("#video-frame");
    if (!poster || !frame) return;
    poster.addEventListener("click", function () {
      var embed = frame.getAttribute("data-embed");
      var src = frame.getAttribute("data-src");
      var node;
      if (embed) {
        node = document.createElement("iframe");
        node.src = embed + (embed.indexOf("?") === -1 ? "?" : "&") + "autoplay=1&rel=0";
        node.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        node.setAttribute("allowfullscreen", "");
        node.title = "WhataHotel Homes, Villas & Residences";
      } else if (src) {
        node = document.createElement("video");
        node.src = src; node.controls = true; node.autoplay = true; node.playsInline = true;
      }
      if (node) {
        poster.replaceWith(node);
        track("video_played", { location: "homes_video_section" });
      } else {
        // No source configured yet — take the traveler to the directory.
        track("video_played", { location: "homes_video_section", note: "no_source" });
        scrollToDirectory();
      }
    });
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
        $$(".reveal:not(.in)").forEach(function (n) {
          if (n.getBoundingClientRect().top < vh * 0.92) { n.classList.add("in"); io.unobserve(n); }
        });
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
    renderFeatured();
    renderDirectory();
    wireSearch();
    wireDelegation();
    wireScrollLinks();
    wireVideo();
    wireMobileCta();
    wireConcierge();
    observeReveals(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
