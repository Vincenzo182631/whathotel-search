/*
 * mo-format.js — display formatting for Mandarin Oriental Exceptional Homes.
 * Plain ES5, usable in the browser (window.WAH_MO_FORMAT) and in Node tests
 * (module.exports). Never invents data: a missing value renders as a clear
 * "not published" state, never as 0 or a placeholder price.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WAH_MO_FORMAT = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function hasCents(n) { return Math.round(n * 100) % 100 !== 0; }

  function money(amount, currency) {
    var digits = hasCents(amount) ? 2 : 0;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
    } catch (e) {
      return currency + " " + amount.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
  }

  /**
   * Starting rate → { text, amount, unit, missing, currencyKnown }.
   *   {startingRate:3380, currency:"USD", rateUnit:"Night"} → "$3,380 USD", unit "per night"
   *   no rate → { text:"Rate on request", missing:true }
   *   rate without a verified currency → shows the source's own figure + "(currency to be confirmed)"
   */
  function formatRate(home) {
    if (!home || home.startingRate == null || !(home.startingRate > 0)) {
      return { text: "Rate on request", amount: null, unit: null, missing: true, currencyKnown: false };
    }
    var unit = home.rateUnit ? "per " + String(home.rateUnit).toLowerCase() : null;
    if (home.currency && /^[A-Z]{3}$/.test(home.currency)) {
      return { text: money(home.startingRate, home.currency) + " " + home.currency, amount: home.startingRate, unit: unit, missing: false, currencyKnown: true };
    }
    return { text: (home.startingRateDisplay || String(home.startingRate)) + " (currency to be confirmed)", amount: home.startingRate, unit: unit, missing: false, currencyKnown: false };
  }

  /** Count field → { text, missing }. Keeps qualifiers such as "8+1". */
  function formatCount(display, singular, plural) {
    if (display == null || display === "") return { text: "Not published", missing: true };
    var n = Number(display);
    var label = (n === 1) ? singular : plural;
    return { text: display + " " + label, missing: false };
  }

  /** { All: n, <country>: n, ... } in the configured country order. */
  function countryCounts(homes, countries) {
    var counts = { all: homes.length };
    (countries || []).forEach(function (c) { counts[c] = 0; });
    homes.forEach(function (h) { counts[h.country] = (counts[h.country] || 0) + 1; });
    return counts;
  }

  /** Filter, preserving source order (sortOrder) within each country. */
  function filterHomes(homes, country) {
    var list = homes.slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
    return (!country || country === "all") ? list : list.filter(function (h) { return h.country === country; });
  }

  /** Optimised image URL (WebP, resized) via the site's existing image CDN. */
  function imageUrl(url, width) {
    if (!url) return null;
    if (/^data:/.test(url)) return url;
    return "https://wsrv.nl/?url=" + encodeURIComponent(url.replace(/^https?:\/\//, "")) + "&w=" + width + "&output=webp&q=72&we=1";
  }

  return { formatRate: formatRate, formatCount: formatCount, countryCounts: countryCounts, filterHomes: filterHomes, imageUrl: imageUrl, money: money };
});
