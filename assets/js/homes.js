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
  var BASE = "https://www.whatahotel.com/browse_offers.cfm";
  function buildPropertyUrl(p) {
    var params = [
      "hotelID=" + encodeURIComponent(p.id),
      "stayType=homes",
      "utm_source=homes_landing",
      "utm_medium=referral",
      "utm_campaign=homes_directory"
    ];
    return BASE + "?" + params.join("&");
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
    { key: "home",      label: "Homes",             blurb: "The comforts of home at exceptional resorts.", scene: "countryside" },
    { key: "villa",     label: "Villas",            blurb: "Private space, pools and resort-style living.", scene: "tropical" },
    { key: "residence", label: "Residences",        blurb: "Multi-bedroom living areas and full kitchens.", scene: "beach" },
    { key: "apartment", label: "Apartments & Condos", blurb: "More room and amenities than a hotel room.", scene: "city" }
  ];
  var CAT_ALIAS = { apartment: ["apartment", "condo"] }; // group condos with apartments
  var FEATURES = [
    { key: "beachfront",    label: "Beachfront" },
    { key: "mountain",      label: "Mountain" },
    { key: "family",        label: "Family-friendly" },
    { key: "multi-bedroom", label: "Multiple bedrooms" },
    { key: "kitchen",       label: "Kitchen" },
    { key: "private-pool",  label: "Private pool" }
  ];
  var TYPE_LABEL = { home:"Home", villa:"Villa", residence:"Residence", apartment:"Apartment", condo:"Condo", estate:"Estate" };

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
        var hay = [p.name, p.hotel, p.city, p.region, p.country, p.types.join(" ")].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (state.sort === "az") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (state.sort === "destination") list.sort(function (a, b) { return a.country.localeCompare(b.country) || a.region.localeCompare(b.region); });
    else list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    return list;
  }

  /* -----------------------------------------------------------------
     Card rendering
     ----------------------------------------------------------------- */
  function renderMedia(p) {
    if (p.image) {
      // Real photo with graceful fallback to the CSS/SVG scene on error.
      return '<img src="' + p.image + '" alt="' + esc(p.name) + ', ' + esc(p.city) + '" ' +
             'loading="lazy" decoding="async" ' +
             'onerror="this.remove()"><div class="scene">' + sceneSVG(p.scene) + '</div>';
    }
    return '<div class="scene">' + sceneSVG(p.scene) + '</div>';
  }

  function typeBadge(p) {
    var t = p.types[0];
    return TYPE_LABEL[t] || "Residence";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c];
    });
  }

  function cardHTML(p) {
    var url = buildPropertyUrl(p);
    var tags = p.types.slice(0, 3).map(function (t) { return '<span class="tag-pill">' + esc(TYPE_LABEL[t] || t) + '</span>'; });
    // add up to one standout feature pill
    var featPill = "";
    if (p.features.indexOf("private-pool") !== -1) featPill = "Private Pool";
    else if (p.features.indexOf("beachfront") !== -1) featPill = "Beachfront";
    else if (p.features.indexOf("multi-bedroom") !== -1) featPill = "Multi-Bedroom";
    if (featPill) tags.push('<span class="tag-pill">' + featPill + '</span>');

    var favOn = !!state.favs[p.id];
    return '' +
    '<article class="pcard reveal" data-id="' + p.id + '">' +
      '<div class="pcard__media">' +
        renderMedia(p) +
        '<span class="pcard__badge">' + esc(typeBadge(p)) + '</span>' +
        '<button class="pcard__fav" type="button" aria-pressed="' + favOn + '" aria-label="Save ' + esc(p.name) + '">' + heartSVG() + '</button>' +
        '<span class="pcard__loc">' + pinSVG() + esc(p.city) + ', ' + esc(p.region) + '</span>' +
      '</div>' +
      '<div class="pcard__body">' +
        '<div class="pcard__hotel">' + esc(p.hotel) + '</div>' +
        '<h3 class="pcard__name">' + esc(p.name) + '</h3>' +
        '<p class="pcard__blurb">' + esc(p.blurb.trim()) + '</p>' +
        '<div class="pcard__tags">' + tags.join("") + '</div>' +
        '<div class="pcard__foot">' +
          '<span class="pcard__cta">' +
            '<a class="btn btn-dark" href="' + url + '" target="_blank" rel="noopener" ' +
               'data-cta="explore-property" data-id="' + p.id + '" data-name="' + esc(p.name) + '">' +
               'Explore Property' + arrowSVG() +
            '</a>' +
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
    grid.innerHTML = list.map(cardHTML).join("");
    observeReveals(grid);
  }

  function renderFeatured() {
    var rail = $("#featured-grid");
    if (!rail) return;
    var feat = PROPS.filter(function (p) { return p.featured; }).slice(0, 6);
    rail.innerHTML = feat.map(cardHTML).join("");
    observeReveals(rail);
  }

  function renderCategories() {
    var wrap = $("#category-grid");
    if (!wrap) return;
    wrap.innerHTML = CATEGORIES.map(function (c) {
      var n = PROPS.filter(function (p) { return propMatchesCat(p, c.key); }).length;
      return '<button class="cat-card" type="button" data-cat="' + c.key + '">' +
        '<div class="scene">' + sceneSVG(c.scene) + '</div>' +
        '<span class="cat-card__count">' + n + ' stays</span>' +
        '<div class="cat-card__body"><h3>' + esc(c.label) + '</h3><p>' + esc(c.blurb) + '</p></div>' +
      '</button>';
    }).join("");
    $$(".cat-card", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-cat");
        state.cats = [cat];
        syncChips();
        track("filter_selected", { filter_type: "category", filter_value: cat, source: "category_card" });
        renderDirectory();
        scrollToDirectory();
      });
    });
  }

  /* -----------------------------------------------------------------
     Filter chips (categories) + feature chips
     ----------------------------------------------------------------- */
  function buildChips() {
    var row = $("#category-chips");
    if (row) {
      row.innerHTML = '<span class="chip-row__label">Type</span>' + CATEGORIES.map(function (c) {
        return chipHTML("cat", c.key, c.label);
      }).join("") + FEATURES.map(function (f) {
        return chipHTML("feat", f.key, f.label);
      }).join("");
      $$(".chip", row).forEach(function (chip) {
        chip.addEventListener("click", function () { toggleChip(chip); });
      });
    }
  }
  function chipHTML(kind, key, label) {
    return '<button class="chip" type="button" data-kind="' + kind + '" data-key="' + key + '" aria-pressed="false">' +
      esc(label) + '<span class="chip-x" aria-hidden="true">✕</span></button>';
  }
  function toggleChip(chip) {
    var kind = chip.getAttribute("data-kind");
    var key = chip.getAttribute("data-key");
    var arr = kind === "cat" ? state.cats : state.feats;
    var i = arr.indexOf(key);
    var on;
    if (i === -1) { arr.push(key); on = true; } else { arr.splice(i, 1); on = false; }
    chip.setAttribute("aria-pressed", on);
    if (on) track("filter_selected", { filter_type: kind === "cat" ? "category" : "feature", filter_value: key, source: "chip" });
    renderDirectory();
  }
  function syncChips() {
    $$("#category-chips .chip").forEach(function (chip) {
      var kind = chip.getAttribute("data-kind");
      var key = chip.getAttribute("data-key");
      var arr = kind === "cat" ? state.cats : state.feats;
      chip.setAttribute("aria-pressed", arr.indexOf(key) !== -1);
    });
  }

  function clearAll() {
    state.query = ""; state.cats = []; state.feats = []; state.sort = "featured";
    var input = $("#search-input"); if (input) input.value = "";
    var sort = $("#sort-select"); if (sort) sort.value = "featured";
    syncChips();
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
      var propCta = e.target.closest && e.target.closest('[data-cta="explore-property"]');
      if (propCta) {
        track("property_card_clicked", {
          property_id: propCta.getAttribute("data-id"),
          property_name: propCta.getAttribute("data-name")
        });
        // This click leaves the landing page → the traveler will check
        // availability on the property page. Record the intent.
        track("availability_check_initiated", { property_id: propCta.getAttribute("data-id") });
        return;
      }
      var cta = e.target.closest && e.target.closest("[data-cta]");
      if (cta && cta.getAttribute("data-cta") !== "explore-property") {
        track("cta_clicked", { cta: cta.getAttribute("data-cta"), label: (cta.textContent || "").trim() });
      }
    });
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
  var io;
  function observeReveals(scope) {
    if (!("IntersectionObserver" in window)) { $$(".reveal", scope).forEach(function (n) { n.classList.add("in"); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    }
    $$(".reveal:not(.in)", scope || document).forEach(function (n) { io.observe(n); });
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

  /* -----------------------------------------------------------------
     Init
     ----------------------------------------------------------------- */
  function init() {
    paintStaticScenes();
    renderCategories();
    buildChips();
    renderFeatured();
    renderDirectory();
    wireSearch();
    wireDelegation();
    wireScrollLinks();
    wireVideo();
    wireMobileCta();
    observeReveals(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
