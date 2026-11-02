# Exceptional Homes: "Request Availability" setup

The Mandarin Oriental Exceptional Homes section on the Homes page is **not bookable online**. "Request Availability" sends an inquiry to the reservations team, and an advisor confirms availability and rates by email. Nothing checks live availability, takes payment or confirms a booking.

```
Browser form ──POST JSON──▶ /api/request-availability ──POST──▶ GoHighLevel Inbound Webhook ──▶ GHL workflow emails the team
 (validation, honeypot)     (server/inquiry-core.mjs:            (GHL_INQUIRY_WEBHOOK_URL)        To {{notify_to}}, Reply-To {{reply_to}}
                             re-validates, checks the home ID,
                             rate-limits, dedupes, retries)
```

The guest only sees the success message after the webhook accepts the request (HTTP 2xx). If delivery fails, the form shows an error and the reservations email address instead.

## 1. Create the GoHighLevel workflow

1. In GHL, go to **Automation → Workflows → Create workflow** and start from scratch.
2. Add the trigger **Inbound Webhook**, then copy its URL. This is `GHL_INQUIRY_WEBHOOK_URL`.
3. Send one test request so GHL can map the fields (see step 4). The fields arrive as `inquiry_id`, `subject`, `notify_to`, `reply_to`, `email_html`, `email_text`, `property_*`, `full_name`, `first_name`, `last_name`, `email`, `phone`, `check_in`, `check_out`, `nights`, `adults`, `children`, `infants`, `total_guests`, `message`, `over_published_capacity` and `tags`.
4. Add the action **Create/Update Contact** with first name, last name, email and phone taken from the webhook fields. Optionally add the tag `exceptional-homes-inquiry`.
5. Add the action **Send Email** (an internal notification, not to the contact):
   - **To:** `{{inboundWebhookRequest.notify_to}}` (or type `Reservations@WhataHotel.com`)
   - **Subject:** `{{inboundWebhookRequest.subject}}`, which reads "New Exceptional Home Availability Request — [Property Name]"
   - **Body:** switch to HTML or code mode and insert `{{inboundWebhookRequest.email_html}}`. `email_text` is the plain-text version.
   - **Reply-To:** `{{inboundWebhookRequest.reply_to}}` (the guest's email)
6. Save, then publish the workflow.

> The exact merge-field syntax depends on your GHL version. Use the field picker in the Send Email action after the first test request has arrived.

## 2. Configure the endpoint

Set these variables in the host's dashboard. Never put them in code. See `.env.example`.

| Variable | Purpose |
|---|---|
| `GHL_INQUIRY_WEBHOOK_URL` | The Inbound Webhook URL from step 1. Without it the endpoint replies `503`, and the form shows an error. |
| `INQUIRY_TO` | The notification recipient (`{{notify_to}}`). Defaults to `Reservations@WhataHotel.com`. **Use a test inbox until a live send is approved.** |
| `ALLOWED_ORIGINS` | Other sites allowed to post to the endpoint, e.g. `https://pro.whatahotel.com,https://rawcdn.githack.com`. Same-origin requests always work. |
| `INQUIRY_DELIVERY` | `ghl` (default), or `log` for local testing. `log` is refused on production deployments. |

The same handler is wired for every host:
- **Vercel:** `api/request-availability.mjs`
- **Netlify:** `netlify/functions/request-availability.mjs` plus the `netlify.toml` redirect
- **Cloudflare Pages:** `functions/api/request-availability.js`

### GoHighLevel embed (`gohighlevel.html`)

A page hosted inside GHL has no `/api`. Build the embed with the absolute URL of the deployment that runs the endpoint:

```
INQUIRY_ENDPOINT=https://<your-deployment>/api/request-availability node scripts/build-standalone.mjs
```

Then add the embed's origin to `ALLOWED_ORIGINS`. Without `INQUIRY_ENDPOINT`, the embedded form shows its error state; it never shows a false success.

## 3. Test safely before going live

1. Set `INQUIRY_TO` to a test inbox, never the live reservations inbox, until a real send is approved.
2. Deploy to a **preview** environment, not production.
3. Submit one inquiry. Use a clearly fake guest name ("TEST — please ignore") and your own test email.
4. Confirm that:
   - the email arrived with the right subject;
   - Reply-To is set to the guest;
   - the HTML and plain-text versions both render;
   - the contact was created in GHL.
5. Switch `INQUIRY_TO` to `Reservations@WhataHotel.com` (or clear it) only after approval.

Local checks, which never contact a real inbox:
- `npm test` runs the unit tests, with delivery mocked.
- `node tests/e2e-mo-homes.cjs` drives the browser against the real handler and a local mock webhook.
- `npm run dev` gives a local preview with `INQUIRY_DELIVERY=log`.

## Protections

- **Server-side validation:** the server re-checks every field. The home is identified only by its ID, which must exist in `server/mo-homes-registry.mjs`; any name the client sends is ignored.
- **Honeypot field (`website`):** filled-in submissions are silently dropped. Submissions completed in under 1.5 seconds are rejected.
- **Rate limit:** 5 requests per 10 minutes per IP. This is best effort, counted per warm serverless instance. For a hard limit, add the host's firewall or WAF rate limiting.
- **Duplicate prevention:** the browser disables the button while sending, and the server dedupes by `submissionId` for 15 minutes, including two requests arriving at the same time.
- **Delivery:** 3 attempts with backoff on network errors, 5xx and 429. Other 4xx responses are not retried.
- **Privacy:**
  - Logs contain only the inquiry ID and home ID.
  - No personal data goes into URLs or analytics. The `dataLayer` events are `mo_filter`, `mo_view_details`, `mo_request_opened`, `mo_request_submitted` and `mo_request_failed`, carrying only the home ID, country or HTTP status.
  - Data is not stored on the server; it lives in GHL.

## Status

The handler, the form and the webhook payload have passed the unit and browser tests with a **mock** webhook. **Delivery to a real GoHighLevel workflow and inbox has not been tested yet.** That needs the webhook URL, a test inbox and a preview deployment (section 3).
