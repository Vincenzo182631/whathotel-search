/*
 * tavus-context.js — tells Ava (the Tavus PAL in <tavus-widget>) which property
 * the visitor has open, so she can say more about it and point to the right button.
 *
 * The detail views dispatch:
 *   document "wah:property-viewed"  { kind: "hotel"|"home", name, brand, location, ... }
 *   document "wah:property-closed"
 * Before a call: the facts go into the widget's conversational-context attribute
 *   (read when the conversation starts).
 * During a call (after tavus:conversation-started): sent with
 *   conversation.append_llm_context (attributes are not re-read mid-call).
 * Only property facts are sent — never anything the visitor typed.
 */
(function () {
  "use strict";
  var el = document.querySelector("tavus-widget");
  if (!el) return;

  var BASE = "The visitor is browsing the WhataHotel! Homes page (pro.whatahotel.com/homes).";
  var live = false, lastSent = "", current = null;

  function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }

  function describe(p) {
    var lines = [];
    if (p.kind === "home") {
      lines.push("Property open: " + p.name + " — a Mandarin Oriental Exceptional Home (private villa) in " + p.location + ".");
      var spec = [p.bedrooms && p.bedrooms + " bedrooms", p.bathrooms && p.bathrooms + " bathrooms", p.guests && "up to " + p.guests + " guests"].filter(Boolean).join(", ");
      if (spec) lines.push("Size: " + spec + ".");
      if (p.description) lines.push("About it: " + clip(p.description, 700));
      if (p.activities && p.activities.length) lines.push("Nearby: " + clip(p.activities.join("; "), 350));
      if (p.perks && p.perks.length) lines.push("Included with every Exceptional Home: " + p.perks.join(", ") + "." + (p.perkNote ? " " + clip(p.perkNote, 300) : ""));
      lines.push("Not bookable online: the Request Availability button opens the inquiry form; View Details shows photos, Details and Activities Nearby.");
    } else {
      lines.push("Property open: " + p.name + (p.brand ? " (" + p.brand + ")" : "") + " in " + p.location + ".");
      if (p.collection && p.collection !== p.brand) lines.push("Collection: " + p.collection + ".");
      if (p.setting) lines.push("Setting: " + p.setting + ".");
      if (p.description) lines.push("About it: " + clip(p.description, 700));
      if (p.highlights && p.highlights.length) lines.push("Highlights: " + clip(p.highlights.join("; "), 350));
      lines.push("In its details, Check Availability opens live villa and residence availability on WhataHotel.com; View full property on WhataHotel.com opens its full page.");
    }
    return lines.join(" ");
  }

  function setStartContext() {
    var ctx = current ? BASE + " " + describe(current) : "";
    if (ctx) el.setAttribute("conversational-context", ctx);
    else el.removeAttribute("conversational-context");
  }

  function sendLive(text) {
    if (!live || typeof el.sendMessage !== "function" || text === lastSent) return;
    lastSent = text;
    try { el.sendMessage({ event_type: "conversation.append_llm_context", properties: { context: text } }); } catch (e) {}
  }

  document.addEventListener("wah:property-viewed", function (e) {
    current = e.detail || null;
    if (!current || !current.name) return;
    if (live) sendLive("Update: " + describe(current));
    else setStartContext();
  });
  document.addEventListener("wah:property-closed", function () {
    if (!current) return;
    if (live) sendLive("Update: the visitor closed " + current.name + " and is back on the main page.");
    current = null;
    if (!live) setStartContext();
  });
  document.addEventListener("tavus:conversation-started", function () { live = true; lastSent = ""; });
  document.addEventListener("tavus:conversation-ended", function () { live = false; lastSent = ""; setStartContext(); });
})();
