# WhataHotel! — Homes Landing Page

A redesigned, conversion-focused landing page for the WhataHotel! **Homes /
Villas & Residences** collection, built as a destination for Google Ads traffic.

It turns the old text-list directory into a premium travel-discovery experience:
inspiration → search → discovery → property selection → live availability — while
**preserving every existing link to the individual WhataHotel property pages**.

> User journey: **Google Ad → this Homes landing page → search / filter →
> select a property → the property's existing WhataHotel page → check availability**

## Deploy (with the AI concierge live)

One click, then paste your **rotated** `LIVEAVATAR_API_KEY` when prompted — that's
the only setup. Both hosts serve the static site *and* the serverless token
function, so the SDK avatar streams on your live https URL.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Vincenzo182631/whathotel-search)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVincenzo182631%2Fwhathotel-search&env=LIVEAVATAR_API_KEY&envDescription=Rotated%20LiveAvatar%20API%20key&envLink=https%3A%2F%2Fapp.liveavatar.com%2Fdevelopers)

> The buttons deploy the repository's **default branch**, which already contains
> this code — so they work as-is. See [AI Concierge](#ai-concierge-liveavatar)
> for the token function and the iframe fallback.

## Quick start

It's a static site — no build step. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8099
# then visit http://localhost:8099/
```

## File structure

```
index.html                          The landing page (all sections + SEO/JSON-LD)
favicon.svg                         Brand favicon
assets/
  css/homes.css                     Mobile-first premium design system
  js/data.js                        GENERATED directory: the 271 Homes properties (do not hand-edit)
  js/images.js                      GENERATED real hero images (og:image per property)
  js/descriptions.js                GENERATED factual descriptions (per property)
  js/homes.js                       Rendering, search, region/collection filters, analytics, video
  js/homes-inventory-filter.js      Residential-inventory keyword logic (documents the availability behavior)
scripts/
  source-homes.json                 AUTHORITATIVE list of the 271 properties on whatahotel.com/homes/
  build-data.mjs                    Generates data.js from source-homes.json
  fetch-images.mjs                  Scrapes each property's og:image + description
```

## Page sections

1. **Hero** — a full-bleed, cinematic **property carousel** (villas · residences · homes · estates). Each slide: high-res image with a slow Ken-Burns drift, a location kicker, the property name, an editorial description, detail pills, and an "Explore Property" CTA. Autoplay (pauses on hover/focus), prev/next arrows, a slide counter with clickable gold progress segments, a desktop thumbnail rail, keyboard arrows, touch-swipe, and full `prefers-reduced-motion` support. Slides are configured in `homes.js` (`HERO`)
2. **Search** — prominent search (destination / city / country / hotel / property) with type & feature filter chips
3. **Explore by region** — 6 regions derived from each property's real country (with live counts)
4. **Why a Home?** — six space/comfort/flexibility benefits
5. **Hotel room vs. home-style stay** — visual comparison
6. **Featured collection** — curated standout stays
7. **Full directory** — every property, searchable / filterable / sortable
8. **Video** — lazy-loaded, positioned after the value story (drop the existing video in — see below)
9. **How it works** — Search → Explore → Check availability → Book
10. **Trust** — secure booking, worldwide, live availability, Lorraine Travel / Signature Travel Network
11. **Final CTA + footer**

## Property data & preserved links

The property collection is the **authoritative list of the 271 properties on the
live WhataHotel Homes page** (`https://whatahotel.com/homes/`), captured verbatim
in `scripts/source-homes.json` (each property's real name, collection/brand, city,
country, hotelID and URL slug). **`assets/js/data.js` is generated from that file
by `scripts/build-data.mjs`** — none added, none removed, none re-classified by
name. Every card links to the site's **canonical** individual page:

```
https://whatahotel.com/hotels/<hotelID>/<slug>.html
```

`homes.js` appends UTM params for paid-traffic attribution.

### No name-keyword classification

This build **does not** decide inclusion or accommodation type from hotel names.
The 271 are taken exactly as they appear on the Homes page. Categorisation for the
UI is derived only from **authoritative fields**:

- **Region** — from each property's real *country*, grouped into 6 regions
  (North America 76 · Latin America & Caribbean 74 · Asia 52 · Europe 34 ·
  Middle East & Africa 20 · Pacific & Indian Ocean 15).
- **Collection / brand** — from each property's real *collection* field
  (Four Seasons, Hyatt, Leading Hotels of the World, Aman, Belmond, Rosewood…).

A hotel's name is **never** used as evidence that it has residential-style
inventory — that is decided per-unit by the availability system below.

**To change the list,** edit `scripts/source-homes.json` (or re-scrape the Homes
page) and re-run `node scripts/build-data.mjs`.

### Property descriptions

`assets/js/descriptions.js` (`window.WAH_DESC`) holds each property's own
**factual description**, scraped from its WhataHotel page by
`scripts/fetch-images.mjs`. Where a page has no usable paragraph, the card falls
back to the property's location line — nothing is invented.

### Property images (real WhataHotel photos)

`assets/js/images.js` (`window.WAH_IMAGES`) holds each property's **real
WhataHotel hero image**, scraped from its property page's `og:image` by
`scripts/fetch-images.mjs` (`node scripts/fetch-images.mjs` to refresh). Cards,
the hero carousel, category cards and the detail modal all use these. The
CSS/SVG scene is the instant placeholder and the automatic fallback if an image
is missing or blocked, so a card is never broken. Per-property override: add an
`image` URL to a record in the data. (No third-party stock imagery is used.)

## Availability filtering (Homes-only inventory)

A visitor who checks availability must see **homes-related inventory** — not
standard hotel rooms. This is handled by WhataHotel's **existing** system, not
reimplemented here. Every "Check Availability" button opens the property's live
availability endpoint with `type=homes`:

```
https://whatahotel.com/booking/showRates.cfm?hotelID=<id>&checkIn=…&checkOut=…&type=homes
```

This is the same entry point the live Homes page uses ("View Rates"): the server
searches the property's Amadeus inventory and returns only units whose **actual
room/unit description** matches the approved residential keywords (residence,
home, villa, …). Eligibility is decided **per unit**, never from the hotel name.

> **Property eligibility** (which hotels appear) comes from the curated 271-item
> list. **Unit eligibility** (which rooms show under Check Availability) comes
> from the Amadeus keyword filtering. The two are kept separate, exactly as on
> the existing page.

`assets/js/homes-inventory-filter.js` (`window.WAHHomesFilter`) documents that
keyword logic (and is unit-testable), mirroring what the server applies when
`type=homes` is present:

```js
// On browse_offers.cfm, when stayType=homes is present:
const result = WAHHomesFilter.filter(liveInventory, { mode: 'prioritize' });
// result.matched -> qualifying homes/villas/residences, most relevant first
// result.other   -> everything else (hidden if mode: 'only')
```

It is deliberately careful about false positives / negatives:

- **Whole-word** matching on residential keywords — `home, residence, residential,
  villa, apartment, condo, condominium, estate, cottage, bungalow, townhome,
  townhouse, casita, chalet, cabana, penthouse`.
- **Exclusion list** for look-alikes — e.g. `Homewood`, `Village`, `Condiment`,
  `Standard Room` won't match on letters alone.
- **Structural fallback** — a unit with **both** a bedroom count and a
  kitchen/living-space signal (e.g. "Two Bedroom Suite with Full Kitchen")
  qualifies even without a keyword.

The module is dependency-free and Node-testable (`module.exports`). A 16-case
matrix (including all the false-friend guards) was verified during development.

## Analytics / conversion tracking

Interactions push to `window.dataLayer` (Google Tag Manager compatible; falls
back to `gtag` if present). Events:

| Event | Fires when |
|---|---|
| `search_initiated` | visitor searches (debounced ≥2 chars, or submits) |
| `filter_selected` | a category / feature / sort filter is applied |
| `property_card_clicked` | an "Explore Property" CTA is clicked |
| `availability_check_initiated` | same click (they're leaving to check availability) |
| `video_played` | the video poster is clicked |
| `cta_clicked` | any other CTA (hero, header, mobile bar, final) |

Set `window.WAH_DEBUG = true` to log events to the console.

## AI Concierge (LiveAvatar)

A floating **AI Concierge** launcher (bottom-right) expands into a panel with a
live avatar host ("Ava"). It runs in one of two modes, chosen automatically:

1. **SDK mode (preferred)** — `@heygen/liveavatar-web-sdk` streams the avatar
   straight into a `<video>` with custom controls (mute, end). Requires the
   serverless token endpoint below.
2. **Iframe mode (fallback)** — the no-backend LiveAvatar embed. Used
   automatically whenever the token endpoint isn't reachable (e.g. before you
   deploy the function, or in the CSP-restricted artifact preview).

Everything is **lazy** — the token request, the SDK script, and the stream only
start when a visitor opens the concierge, so initial page load is unaffected.
Closing (launcher, ✕, End, `Escape`, or outside-click) **stops the stream** so
nothing keeps streaming/billing in the background. Fires `concierge_opened` and
`concierge_avatar_started` (`mode: sdk|iframe`) analytics events.

### Making SDK mode work (keeps the API key secret)

The browser SDK needs a short-lived `session_token` that must be minted
server-side — **the API key never goes in the browser**. A ready-to-deploy
function is included for three hosts (use whichever matches your host):

| Host | File | Route |
|---|---|---|
| Vercel | `api/liveavatar-token.js` | `/api/liveavatar-token` (automatic) |
| Netlify | `netlify/functions/liveavatar-token.js` | mapped via `netlify.toml` |
| Cloudflare Pages | `functions/api/liveavatar-token.js` | `/api/liveavatar-token` (automatic) |

Steps:
1. Deploy this repo to your host (all three functions can coexist; only the one
   matching your host runs).
2. In the host's **Environment variables**, set (see `.env.example`):
   - `LIVEAVATAR_API_KEY` — your **rotated** key from app.liveavatar.com/developers
     (this is the only required variable)
   - `LIVEAVATAR_AVATAR_ID` — optional; defaults to the configured avatar, set
     only to use a different one
   - `LIVEAVATAR_SANDBOX` — optional, `true` while testing
3. Load the site over **https**. The concierge now streams the SDK avatar; if
   the endpoint ever fails it silently falls back to the iframe.

Client config lives in a small `window.WAH_AVATAR` block in `index.html`
(`tokenEndpoint`, `sdkUrl`, `embedUrl`). The SDK is pinned from jsDelivr by
default (`@heygen/liveavatar-web-sdk@0.0.18`); it's also in `node_modules` if
you'd rather self-host `dist/index.umd.js`.

> The claude.ai artifact preview blocks third-party iframes **and** scripts
> (CSP) and isn't a secure context, so the avatar only streams on your deployed
> https site (or a `localhost` dev server). The panel's header has an
> "open in a new window ↗" escape hatch for any blocked context.

## Adding the video

The video is lazy-loaded (nothing is fetched until the visitor clicks play, so it
never hurts page speed). Configure the source on `#video-frame` in `index.html`:

```html
<!-- YouTube / Vimeo -->
<div class="video-frame" id="video-frame" data-embed="https://www.youtube.com/embed/VIDEO_ID"> …
<!-- or self-hosted -->
<div class="video-frame" id="video-frame" data-src="assets/media/homes.mp4"> …
```

## Performance / mobile

- **Mobile-first**, responsive down to 360px, with a sticky mobile search/browse bar.
- **Zero external image requests** — all artwork is CSS/SVG, so LCP stays fast
  (good for Google Ads Quality Score). The only external asset is the Google
  Fonts stylesheet, which degrades gracefully to a system serif/sans stack.
- Cards reveal on scroll; respects `prefers-reduced-motion`.
- SEO: descriptive title/meta, Open Graph, canonical, and `CollectionPage` JSON-LD.

---

*WhataHotel! by Lorraine Travel · Member, Signature Travel Network.*
