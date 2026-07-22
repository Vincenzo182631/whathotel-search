/*
 * WhataHotel! — Homes Inventory Filter
 * =====================================================================
 * WHY THIS EXISTS
 * When a traveler arrives through the Homes landing page and clicks into a
 * property, they came looking for a *home / villa / residence* — not a
 * standard hotel room. On the individual property page (browse_offers.cfm),
 * detect the `?stayType=homes` flag that the landing page appends to every
 * property link, and use this module to PRIORITISE (or optionally hide) the
 * room/unit types that qualify as residential-style accommodation.
 *
 * DESIGN GOALS
 *   1. Catch qualifying units even when naming conventions differ between
 *      hotels ("2-Bedroom Villa", "Oceanfront Residence", "Garden Cottage",
 *      "Signature Home", "Penthouse Apartment", "Estate Home", ...).
 *   2. Avoid FALSE POSITIVES — a "Homewood Suite", a "Villard King Room" or a
 *      "Condiment-stocked minibar" must NOT match just because the letters
 *      "home / villa / condo" appear inside another word. We therefore match
 *      on WHOLE WORDS only, and maintain an explicit exclusion list.
 *   3. Avoid FALSE NEGATIVES — some residential units are described only by
 *      structure ("Three Bedroom", "Multi-Bedroom Suite with Full Kitchen").
 *      A secondary signal layer catches those.
 *
 * USAGE (on the property page)
 *   const result = WAHHomesFilter.filter(inventory, { mode: 'prioritize' });
 *   // result.matched   -> qualifying units, most-relevant first
 *   // result.other     -> everything else
 *   // result.isHomes   -> convenience for a single unit
 *
 * This file has NO dependencies and is safe to load on any page.
 */
(function (root) {
  "use strict";

  // ---- Primary keywords: the accommodation is explicitly residential ----
  // Stored singular; the matcher also accepts a trailing "s".
  var PRIMARY = [
    "home", "residence", "residential",
    "villa", "apartment", "condo", "condominium",
    "estate", "cottage", "bungalow",
    "townhome", "townhouse", "casita", "chalet", "cabana", "penthouse"
  ];

  // ---- Secondary signals: strong hints even without a primary keyword ----
  // Only counted when combined with a "space" or "kitchen" signal so a plain
  // "One Bedroom King" hotel room does not sweep in.
  var BEDROOM_RE = /\b(one|two|three|four|five|1|2|3|4|5|multi|multiple)[\s-]?bed(room)?s?\b/i;
  var KITCHEN_RE = /\b(full[\s-]?kitchen|kitchenette|kitchen|private\s+pool|living\s+(room|area)|dining\s+(room|area))\b/i;

  // ---- Exclusions: words that CONTAIN a keyword but are not a match, or
  //      unit types that must never be treated as a home even if a keyword
  //      brushes past them. Checked as whole words / phrases. ----
  var EXCLUDE_PHRASES = [
    "homewood", "home2", "homestead",          // "home" false friends
    "condiment",                               // "condo" false friend
    "villard", "villager", "village",          // "villa" false friends
    "aparthotel front desk",                   // guard phrase
    "standard room", "standard king", "standard queen",
    "guest room", "hotel room", "run of house", "run-of-house"
  ];

  function normalize(text) {
    return String(text == null ? "" : text).toLowerCase();
  }

  // Whole-word regex for a keyword, allowing an optional plural "s".
  function wordRe(word) {
    return new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\b", "i");
  }

  var PRIMARY_RES = PRIMARY.map(wordRe);

  /**
   * Score a single unit name/description.
   * @returns {{isHomes:boolean, score:number, reason:string}}
   */
  function score(text) {
    var t = normalize(text);
    if (!t) return { isHomes: false, score: 0, reason: "empty" };

    // 1) Hard exclusions first.
    for (var i = 0; i < EXCLUDE_PHRASES.length; i++) {
      if (t.indexOf(EXCLUDE_PHRASES[i]) !== -1) {
        // An exclusion phrase is present. Only bail out if NO independent
        // primary keyword also matches (e.g. "Homewood Villa" should stay).
        var hasIndependentPrimary = PRIMARY_RES.some(function (re) { return re.test(t); });
        if (!hasIndependentPrimary) {
          return { isHomes: false, score: 0, reason: "excluded:" + EXCLUDE_PHRASES[i] };
        }
      }
    }

    var s = 0;
    var reasons = [];

    // 2) Primary keyword match — strongest signal.
    for (var p = 0; p < PRIMARY.length; p++) {
      if (PRIMARY_RES[p].test(t)) {
        s += 10;
        reasons.push(PRIMARY[p]);
        break; // one primary hit is enough to qualify
      }
    }

    // 3) Structural signals (bedrooms + kitchen/living space).
    var hasBed = BEDROOM_RE.test(t);
    var hasSpace = KITCHEN_RE.test(t);
    if (hasBed) { s += 3; reasons.push("bedrooms"); }
    if (hasSpace) { s += 3; reasons.push("space"); }

    // A unit with NO primary keyword still qualifies if it has BOTH a bedroom
    // count and a kitchen/living-space signal (e.g. "Two Bedroom Suite with
    // Full Kitchen") — a classic residential unit that skipped the keywords.
    var isHomes = s >= 10 || (hasBed && hasSpace);

    return {
      isHomes: isHomes,
      score: s,
      reason: reasons.join("+") || "none"
    };
  }

  /**
   * Extract the text we should test from an inventory item. Accepts a plain
   * string or an object with common WhataHotel field names.
   */
  function textOf(item) {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    return [
      item.roomType, item.roomName, item.name, item.unitType,
      item.category, item.title, item.description
    ].filter(Boolean).join(" ");
  }

  /**
   * Filter / prioritise an inventory list.
   * @param {Array} inventory
   * @param {Object} [opts]
   * @param {('prioritize'|'only')} [opts.mode='prioritize']
   *        'prioritize' — return matched units first, keep the rest in `other`.
   *        'only'       — `other` is emptied; show only qualifying units.
   * @returns {{matched:Array, other:Array, all:Array, mode:string}}
   */
  function filter(inventory, opts) {
    opts = opts || {};
    var mode = opts.mode === "only" ? "only" : "prioritize";
    var matched = [];
    var other = [];

    (inventory || []).forEach(function (item) {
      var r = score(textOf(item));
      var tagged = (item && typeof item === "object")
        ? Object.assign({}, item, { _homesScore: r.score, _homesReason: r.reason })
        : item;
      if (r.isHomes) matched.push({ item: tagged, score: r.score });
      else other.push(tagged);
    });

    matched.sort(function (a, b) { return b.score - a.score; });
    var matchedItems = matched.map(function (m) { return m.item; });

    return {
      matched: matchedItems,
      other: mode === "only" ? [] : other,
      all: mode === "only" ? matchedItems : matchedItems.concat(other),
      mode: mode
    };
  }

  /** Convenience: is a single unit a qualifying home? */
  function isHomes(item) {
    return score(textOf(item)).isHomes;
  }

  var api = { filter: filter, isHomes: isHomes, score: score, PRIMARY: PRIMARY };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // allows unit testing in Node
  }
  root.WAHHomesFilter = api;
})(typeof window !== "undefined" ? window : this);
