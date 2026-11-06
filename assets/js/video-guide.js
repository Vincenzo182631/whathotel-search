/*
 * video-guide.js — our own small launcher + compact call window for the Tavus guide.
 *
 * Why not <tavus-widget>: its call popup has no size setting and covers almost the
 * whole phone screen. <tavus-embed> fills whatever box it is given, so the page sets
 * the size (see .vguide in homes.css) and the visitor can keep browsing during a call.
 *
 * - The Tavus embed script loads on the first tap only (nothing loads for visitors
 *   who never open it). Version tracks the "latest" tag, as with the old widget.
 * - Tapping the button opens the window and starts the call; × ends it and closes.
 * - Until the call connects the window is 300px wide so Tavus's "Verify you are
 *   human" check fits; once live it shrinks to the small call size.
 * - Everything inside <tavus-embed> is Tavus's own UI and is not styled here.
 * - No API key or backend: the deployment id is public and only accepts
 *   requests from pro.whatahotel.com.
 */
(function () {
  "use strict";
  var launch = document.getElementById("vguide-launch");
  var panel = document.getElementById("vguide");
  var stage = document.getElementById("vguide-stage");
  var closeBtn = document.getElementById("vguide-close");
  if (!launch || !panel || !stage) return;

  var DEPLOYMENT = launch.getAttribute("data-deployment");
  var SCRIPT = "https://unpkg.com/@tavus/embed@latest";
  var el = null, ready = false, wantStart = false, scriptAdded = false;

  function track(name) { try { if (window.dataLayer) window.dataLayer.push({ event: name }); } catch (e) {} }

  function loadScript() {
    if (scriptAdded) return;
    scriptAdded = true;
    var s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    s.onerror = function () { stage.setAttribute("data-state", "error"); };
    document.head.appendChild(s);
  }

  function mount() {
    if (el) return;
    el = document.createElement("tavus-embed");
    el.setAttribute("deployment-id", DEPLOYMENT);
    el.addEventListener("tavus:ready", function () {
      ready = true;
      stage.removeAttribute("data-state");
      if (wantStart) start();
    });
    stage.appendChild(el);
    // tavus-context.js copies the open property's facts onto the element.
    try { document.dispatchEvent(new CustomEvent("wah:guide-mounted")); } catch (e) {}
    loadScript();
  }

  function start() {
    wantStart = false;
    if (el && typeof el.startConversation === "function") {
      try { el.startConversation(); } catch (e) {}
    }
  }

  function open() {
    if (!panel.hidden) return;
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    document.body.classList.add("vguide-open");
    if (!el) { stage.setAttribute("data-state", "loading"); mount(); }
    if (ready) start(); else wantStart = true;
    track("video_guide_opened");
  }

  function close() {
    if (panel.hidden) return;
    wantStart = false;
    if (el && typeof el.endConversation === "function") {
      try { el.endConversation(); } catch (e) {}
    }
    panel.hidden = true;
    panel.classList.remove("is-live");
    launch.setAttribute("aria-expanded", "false");
    document.body.classList.remove("vguide-open");
    launch.focus();
  }

  // Shrink to the small call size once the call is live (CSS .vguide.is-live).
  document.addEventListener("tavus:conversation-started", function () { panel.classList.add("is-live"); });
  document.addEventListener("tavus:conversation-ended", function () { panel.classList.remove("is-live"); });

  launch.addEventListener("click", function () { if (panel.hidden) open(); else close(); });
  if (closeBtn) closeBtn.addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  window.WAH_GUIDE = { open: open, close: close };
})();
