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
  js/data.js                        GENERATED property directory (do not hand-edit)
  js/homes.js                       Rendering, search, filters, analytics, video
  js/homes-inventory-filter.js      Residential-inventory keyword logic (for the property page)
scripts/
  build-data.mjs                    Generates data.js from the real WhataHotel search results
```

## Page sections

1. **Hero** — a full-bleed, cinematic **property carousel** (villas · residences · homes · estates). Each slide: high-res image with a slow Ken-Burns drift, a location kicker, the property name, an editorial description, detail pills, and an "Explore Property" CTA. Autoplay (pauses on hover/focus), prev/next arrows, a slide counter with clickable gold progress segments, a desktop thumbnail rail, keyboard arrows, touch-swipe, and full `prefers-reduced-motion` support. Slides are configured in `homes.js` (`HERO`)
2. **Search** — prominent search (destination / city / country / hotel / property) with type & feature filter chips
3. **Categories** — Villas · Residences · Homes · Estates (with live counts; condos/apartments fold into related filters)
4. **Why a Home?** — six space/comfort/flexibility benefits
5. **Hotel room vs. home-style stay** — visual comparison
6. **Featured collection** — curated standout stays
7. **Full directory** — every property, searchable / filterable / sortable
8. **Video** — lazy-loaded, positioned after the value story (drop the existing video in — see below)
9. **How it works** — Search → Explore → Check availability → Book
10. **Trust** — secure booking, worldwide, live availability, Lorraine Travel / Signature Travel Network
11. **Final CTA + footer**

## Property data & preserved links

`assets/js/data.js` is **generated** by `scripts/build-data.mjs` from the real
WhataHotel category search results (Homes / Residences / Villas / Condos /
Estate). Every property is a real WhataHotel property and each card links to the
site's **canonical** individual page:

```
https://whatahotel.com/hotels/<hotelID>/<slug>.html
```

`homes.js` appends `?stayType=homes` (plus UTM params for paid-traffic
attribution) so the traveler's "Homes" intent is carried through to the property
page.

### Curation: removing the search's false positives

WhataHotel's own keyword search **substring-matches**, so it returns false
positives that the brief explicitly warns against. The build script drops them by
classifying each property on **whole-word** name keywords. Examples removed:

| Search | False positives dropped |
|---|---|
| Homes | the 9 **Domes** resorts, **Omni Homestead**, **Holmes Beach** |
| Condos | **Condesa** / **Las Condes** (0 real condos remained) |
| Villas | "**Village**" hotels (Standard East Village, Westlake Village, Niseko Village) |
| Estate | ~125 city hotels that aren't estates (1 Hotel, Aman, Marriott Marquis…) |

Result: **113** genuine residential properties (68 villas, 34 residences, 10
estates, 4 homes, 1 condo). A small allowlist re-includes genuinely residential
properties whose names lack a keyword (e.g. Viceroy Snowmass, Beach Village at
The Del, Kona Village).

**To add / edit properties or tune the rules,** edit `scripts/build-data.mjs`
and re-run `node scripts/build-data.mjs`. To show a real photograph on a card,
add an `image` URL to a property record; the CSS/SVG scene is the instant,
zero-request placeholder and the fallback if the image fails.

## Availability filtering (Homes-only inventory)

The brief requires that a visitor who arrives via Homes sees **homes-related
inventory** when they check availability — not standard hotel rooms.

`assets/js/homes-inventory-filter.js` (`window.WAHHomesFilter`) implements the
keyword logic to run **on the individual property page** when it detects the
`?stayType=homes` flag this landing page adds to every link:

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
