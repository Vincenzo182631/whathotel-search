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

  /* ------------------------------------------------------------------
     GoHighLevel inquiry payload (form → GHL Inbound Webhook, no server).
     Flat snake_case fields so each one can be mapped in the GHL workflow.
     The home's name/country/location come from the dataset, never from
     what the browser typed.
     ------------------------------------------------------------------ */
  var NOTIFY_TO = "Reservations@WhataHotel.com";
  function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function placeLine(home) {
    var loc = home.location || "";
    return loc && loc.toLowerCase().indexOf(String(home.country || "").toLowerCase()) !== -1 ? loc : [loc, home.country].filter(Boolean).join(" · ");
  }
  function inquiryId(now, rand) {
    var d = new Date(now), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    var r = "", chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", rnd = rand || Math.random;
    for (var i = 0; i < 6; i++) r += chars.charAt(Math.floor(rnd() * chars.length));
    return "MOH-" + d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + "-" + r;
  }
  function dayDiff(a, b) {
    var pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a), pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
    if (!pa || !pb) return null;
    return Math.round((Date.UTC(+pb[1], +pb[2] - 1, +pb[3]) - Date.UTC(+pa[1], +pa[2] - 1, +pa[3])) / 86400000);
  }
  /**
   * @param home  dataset record (id, name, country, location, sourceUrl, maxGuests)
   * @param f     { fullName, email, phone, checkIn, checkOut, adults, children, infants, message }
   * @param meta  { now, pageUrl, submissionId, rand }
   */
  function buildInquiry(home, f, meta) {
    meta = meta || {};
    var now = meta.now || Date.now();
    var adults = Number(f.adults) || 0, children = Number(f.children) || 0, infants = Number(f.infants) || 0;
    var total = adults + children + infants;
    var over = home.maxGuests != null && adults + children > home.maxGuests;
    var nights = dayDiff(f.checkIn, f.checkOut);
    var name = String(f.fullName || "").trim(), parts = name.split(/\s+/);
    var id = inquiryId(now, meta.rand);
    var submitted = new Date(now).toISOString();
    var subject = "New Exceptional Home Availability Request — " + home.name;
    var rows = [
      ["Property", home.name], ["Destination", placeLine(home)], ["Property ID", home.id], ["Source property page", home.sourceUrl],
      ["Guest name", name], ["Guest email", f.email], ["Guest phone", f.phone || "Not provided"],
      ["Preferred check-in", f.checkIn], ["Preferred check-out", f.checkOut], ["Nights", nights == null ? "" : String(nights)],
      ["Adults", String(adults)], ["Children", String(children)], ["Infants", String(infants)], ["Total guests", String(total)],
      ["Additional requests", f.message || "None"], ["Submitted", submitted], ["Inquiry ID", id]
    ];
    var capNote = over ? "Note: adults + children exceed this home's published capacity of " + home.maxGuests + " guests. Please review with the guest." : "";
    var text = [subject, "", "This is an availability REQUEST. Nothing has been booked or confirmed.", ""]
      .concat(rows.map(function (r) { return r[0] + ": " + r[1]; }))
      .concat(capNote ? ["", capNote] : []).concat(["", "Reply to the guest at " + f.email + "."]).join("\n");
    var html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0c1a2b">' +
      '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9c7c3a">Mandarin Oriental Exceptional Homes · Availability request</p>' +
      '<h2 style="margin:0 0 4px;font-family:Georgia,serif;font-weight:normal">' + escHtml(home.name) + '</h2>' +
      '<p style="margin:0 0 12px;color:#4d5f70">' + escHtml(placeLine(home)) + '</p>' +
      '<p style="margin:0 0 14px;padding:8px 10px;background:#fbf6ea;border-left:3px solid #c6a35a">This is an availability <b>request</b>. Nothing has been booked or confirmed.</p>' +
      '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + rows.map(function (r) {
        var v = r[0] === "Guest email" ? '<a href="mailto:' + escHtml(r[1]) + '">' + escHtml(r[1]) + '</a>' : r[0] === "Source property page" ? '<a href="' + escHtml(r[1]) + '">' + escHtml(r[1]) + '</a>' : escHtml(r[1]).replace(/\n/g, "<br>");
        return '<tr><td style="padding:4px 14px 4px 0;color:#728394;vertical-align:top;white-space:nowrap">' + escHtml(r[0]) + '</td><td style="padding:4px 0">' + v + '</td></tr>';
      }).join("") + '</table>' +
      (capNote ? '<p style="margin:12px 0 0;color:#8a4b12">' + escHtml(capNote) + '</p>' : "") + '</div>';
    return {
      event: "exceptional_home_availability_request",
      inquiry_id: id, submitted_at: submitted, submission_id: meta.submissionId || "",
      source_page: meta.pageUrl ? String(meta.pageUrl).split(/[?#]/)[0] : "",
      notify_to: NOTIFY_TO, reply_to: f.email, subject: subject, email_text: text, email_html: html,
      property_id: home.id, property_name: home.name, property_country: home.country, property_location: home.location || "",
      property_destination: placeLine(home), property_source_url: home.sourceUrl,
      full_name: name, first_name: parts[0] || "", last_name: parts.slice(1).join(" "), email: f.email, phone: f.phone || "",
      check_in: f.checkIn, check_out: f.checkOut, nights: nights,
      adults: adults, children: children, infants: infants, total_guests: total,
      message: f.message || "", over_published_capacity: over ? "Yes" : "No",
      consent: "Yes", tags: "exceptional-homes-inquiry"
    };
  }

  return { formatRate: formatRate, formatCount: formatCount, countryCounts: countryCounts, filterHomes: filterHomes, imageUrl: imageUrl, money: money,
    buildInquiry: buildInquiry, inquiryId: inquiryId, placeLine: placeLine, NOTIFY_TO: NOTIFY_TO };
});
