/*
 * mo-homes-lib.mjs — pure, browser-free logic for the Mandarin Oriental
 * Exceptional Homes import: selection rules, spec/rate parsing, and rich-text
 * normalisation. Kept separate from the Playwright importer so it can be unit
 * tested (tests/mo-homes.test.mjs) and reasoned about on its own.
 *
 * Ground rules (from the brief):
 *   • Never guess a missing bathroom/guest count or rate — return null and let
 *     the importer record an issue. Never turn a missing rate into 0.
 *   • Preserve qualifiers exactly ("8+1", "5 + 4", "6 +1" stay as shown).
 *   • Source order is the authority; selection never reorders.
 */

/** First integer in a bedroom expression: "10+1" → 10, "8 + 1" → 8. */
export function bedroomsBase(display) {
  if (display == null) return null;
  const m = String(display).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Tidy a count expression for display without changing its meaning: "8 + 1" → "8+1". */
export function normalizeCount(display) {
  if (display == null) return null;
  const s = String(display).replace(/\s*\+\s*/g, "+").replace(/\s+/g, " ").trim();
  return s || null;
}

/**
 * Apply the selection rules per country, in source order.
 *   count <= perCountry        → all
 *   count <= fullDozenUpTo     → all ("do the full dozen")
 *   count >  fullDozenUpTo     → only homes whose base bedrooms are within
 *                                [bedroomsMin, bedroomsMax]; optional cap.
 * @param {Array<{slug,destination,country,bedroomsDisplay,sourceOrder}>} listing
 * @returns {{selected:Array, excluded:Array<{slug,name,country,reason}>, rulesByCountry:Object}}
 */
export function selectHomes(listing, config) {
  const sel = config.selection;
  const selected = [], excluded = [], rulesByCountry = {};
  for (const country of config.countries) {
    const homes = listing.filter((h) => h.country === country).sort((a, b) => a.sourceOrder - b.sourceOrder);
    let picked;
    if (homes.length <= sel.perCountry) {
      picked = homes; rulesByCountry[country] = `${homes.length} on source (≤ ${sel.perCountry}): all`;
    } else if (homes.length <= sel.fullDozenUpTo) {
      picked = homes; rulesByCountry[country] = `${homes.length} on source (≤ ${sel.fullDozenUpTo}): full dozen — all`;
    } else {
      const { bedroomsMin, bedroomsMax, cap } = sel.overDozen;
      picked = [];
      for (const h of homes) {
        const b = bedroomsBase(h.bedroomsDisplay);
        if (b == null) { excluded.push({ ...brief(h), reason: "bedroom count not shown on source; cannot apply the 4–8 bedroom rule" }); continue; }
        if (b < bedroomsMin || b > bedroomsMax) { excluded.push({ ...brief(h), reason: `${h.bedroomsDisplay} bedrooms — outside the ${bedroomsMin}–${bedroomsMax} bedroom rule (${homes.length} homes on source)` }); continue; }
        if (cap && picked.length >= cap) { excluded.push({ ...brief(h), reason: `beyond the cap of ${cap}` }); continue; }
        picked.push(h);
      }
      rulesByCountry[country] = `${homes.length} on source (> ${sel.fullDozenUpTo}): ${bedroomsMin}–${bedroomsMax} bedrooms${cap ? `, capped at ${cap}` : ""} → ${picked.length}`;
    }
    selected.push(...picked);
  }
  if (selected.length > sel.maxTotal) {
    for (const h of selected.splice(sel.maxTotal)) excluded.push({ ...brief(h), reason: `beyond the maximum of ${sel.maxTotal} homes` });
  }
  return { selected, excluded, rulesByCountry };
}
function brief(h) { return { slug: h.slug, name: h.name, country: h.country }; }

/**
 * Parse the source spec line, e.g.
 *   "Chiang Rai, Thailand | 5+4 Bedrooms | 11 Bathrooms | 18 Guests"
 * Missing parts come back null (never guessed).
 */
export function parseHeadline(headline) {
  const out = { location: null, bedroomsDisplay: null, bathroomsDisplay: null, maxGuests: null, maxGuestsDisplay: null };
  if (!headline) return out;
  const parts = String(headline).split("|").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const part of parts) {
    let m;
    if ((m = part.match(/^(.+?)\s*bedrooms?$/i))) out.bedroomsDisplay = normalizeCount(m[1]);
    else if ((m = part.match(/^(.+?)\s*bath(room)?s?$/i))) out.bathroomsDisplay = normalizeCount(m[1]);
    else if ((m = part.match(/^(.+?)\s*(guests?|people|persons|sleeps)$/i))) {
      out.maxGuestsDisplay = normalizeCount(m[1]);
      out.maxGuests = /^\d+$/.test(out.maxGuestsDisplay) ? Number(out.maxGuestsDisplay) : null;
    } else if (!out.location) out.location = part;
  }
  return out;
}

const SYMBOL_CURRENCIES = { "$": ["USD", "AUD", "CAD", "SGD", "HKD", "NZD"], "€": ["EUR"], "£": ["GBP"], "฿": ["THB"], "Rp": ["IDR"] };

/**
 * Parse the public "from" price shown on the page, e.g. "from $3,380.00 / Night".
 * The currency code comes from the source record (recordCurrency), and is only
 * accepted when it is consistent with the displayed symbol. Returns null when
 * no price is shown — never 0.
 */
export function parseRate(text, recordCurrency) {
  if (!text) return null;
  const m = String(text).replace(/\s+/g, " ").match(/from\s*([^\d\s]{0,3})\s?([\d.,]+)\s*(?:\/\s*([A-Za-z][A-Za-z ]*?))?\s*$/i)
    || String(text).replace(/\s+/g, " ").match(/from\s*([^\d\s]{0,3})\s?([\d.,]+)\s*(?:\/\s*([A-Za-z][A-Za-z ]*))?/i);
  if (!m) return null;
  const symbol = m[1] || "";
  const amount = Number(m[2].replace(/,/g, ""));
  if (!isFinite(amount) || amount <= 0) return null;
  const unit = m[3] ? m[3].trim() : null;
  let currency = null, currencyIssue = null;
  if (recordCurrency && /^[A-Z]{3}$/.test(recordCurrency)) {
    const allowed = SYMBOL_CURRENCIES[symbol];
    if (!symbol || !allowed || allowed.indexOf(recordCurrency) !== -1) currency = recordCurrency;
    else currencyIssue = `displayed symbol "${symbol}" does not match source currency ${recordCurrency}`;
  } else {
    currencyIssue = "source does not state a currency code";
  }
  return { startingRate: amount, startingRateDisplay: `${symbol}${m[2]}`, currencySymbol: symbol || null, currency, rateUnit: unit, currencyIssue };
}

/* ---------------- Rich text → safe structured blocks ---------------- */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", eacute: "é", egrave: "è", agrave: "à", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç", ouml: "ö", uuml: "ü", auml: "ä", ocirc: "ô", ecirc: "ê", acirc: "â", icirc: "î", euro: "€", pound: "£", deg: "°", middot: "·", bull: "•", times: "×" };
export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n) => (Object.prototype.hasOwnProperty.call(ENTITIES, n.toLowerCase()) ? ENTITIES[n.toLowerCase()] : all));
}
function textOf(html) {
  return decodeEntities(String(html).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/[ \t\r\n ]+/g, " ").trim();
}

/**
 * Convert source description HTML into plain-text blocks (no HTML survives, so
 * nothing from the source can inject markup into our page):
 *   {type:"p", text} · {type:"note", text} · {type:"heading", text}
 *   {type:"labelled", label, text} · {type:"list", items:[...]}
 */
export function htmlToBlocks(html) {
  const blocks = [];
  if (!html) return blocks;
  const re = /<(p|ul|ol|h[1-6]|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(String(html)))) {
    const tag = m[1].toLowerCase(), inner = m[2];
    if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => textOf(x[1])).filter(Boolean);
      if (items.length) blocks.push({ type: "list", items });
      continue;
    }
    if (/^h[1-6]$/.test(tag)) { const t = textOf(inner); if (t) blocks.push({ type: "heading", text: t.replace(/:\s*$/, "") }); continue; }
    const lead = inner.match(/^\s*<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*)$/i);
    if (lead) {
      const label = textOf(lead[2]).replace(/:\s*$/, "");
      const rest = textOf(lead[3]).replace(/^:\s*/, "");
      if (label && !rest) { blocks.push({ type: "heading", text: label }); continue; }
      if (label && rest) { blocks.push({ type: "labelled", label, text: rest }); continue; }
    }
    const t = textOf(inner);
    if (!t) continue;
    const isNote = /^\s*<(em|i)\b[^>]*>[\s\S]*<\/\1>\s*$/i.test(inner);
    blocks.push({ type: isNote ? "note" : "p", text: t });
  }
  return blocks;
}

/**
 * Split blocks into DETAILS and ACTIVITIES NEARBY. The activities section is the
 * block headed "Activities nearby" up to the next heading/labelled block.
 */
export function splitSections(blocks) {
  const details = [], activitiesNearby = [];
  let inAct = false;
  for (const b of blocks) {
    const head = b.type === "heading" ? b.text : (b.type === "labelled" ? b.label : null);
    if (head != null) {
      if (/^activit(y|ies)\s+(nearby|near by|in the area)|^nearby activities|^things to do/i.test(head)) {
        inAct = true;
        if (b.type === "labelled") activitiesNearby.push({ type: "p", text: b.text });
        continue;
      }
      inAct = false;
    }
    (inAct ? activitiesNearby : details).push(b);
  }
  return { details, activitiesNearby };
}

/** Compare the planned selection with what the source shows now. */
export function reconcile(planned, selected, listing) {
  const norm = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’'`]/g, "'").replace(/\s+/g, " ").trim();
  const changes = [];
  for (const country of Object.keys(planned)) {
    const plan = planned[country].map(norm);
    const now = selected.filter((h) => h.country === country);
    const nowNames = now.map((h) => norm(h.name));
    for (const h of now) if (plan.indexOf(norm(h.name)) === -1) changes.push({ country, change: "added", name: h.name });
    for (const name of planned[country]) {
      if (nowNames.indexOf(norm(name)) !== -1) continue;
      const onSource = listing.find((h) => norm(h.name) === norm(name));
      changes.push({ country, change: "not selected", name, why: onSource ? "still on source but excluded by the selection rules" : "no longer found on source" });
    }
  }
  return changes;
}
