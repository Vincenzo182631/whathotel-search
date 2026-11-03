# Exceptional Homes: "Request Availability" → GoHighLevel

The Mandarin Oriental Exceptional Homes on the Homes page are **not bookable online**. "Request Availability" sends an inquiry, and an advisor confirms availability and rates.

## How it works

```
Request Availability form ──POST JSON──▶ GHL Inbound Webhook ──▶ GHL workflow
 (validation, spam checks,             (services.leadconnectorhq.com)    • Create/Update Contact
  retries)                                                               • Email → Reservations@WhataHotel.com
```

- The form posts **directly** to the GoHighLevel Inbound Webhook. No server is involved.
- The webhook URL is set in `index.html`: `<meta name="wah-ghl-webhook" content="https://services.leadconnectorhq.com/hooks/…">`.
- `gohighlevel.html` inherits it from `index.html` when you rebuild it with `node scripts/build-standalone.mjs`.
- To change the URL in the embed only, run `GHL_WEBHOOK_URL=… node scripts/build-standalone.mjs`.
- **The guest only sees the success message after GHL accepts the request (HTTP 2xx).**
  - If GHL is unreachable, the form retries twice. Then it shows an error with the Reservations@WhataHotel.com address.
  - The page never shows a false success.

> **Webhook URL is public.** Because the form posts from the browser, the webhook URL is visible in the page source (this was your choice). Anyone who finds it could send fake inquiries. If that happens, create a new Inbound Webhook trigger in GHL, then update the URL in `index.html`. To harden the setup later, switch to the optional server route (see the end of this page).

## Fields the webhook receives

All fields are flat, so each can be mapped in GHL. See the full sample in [`ghl-sample-payload.json`](ghl-sample-payload.json).

| Field | Example |
|---|---|
| `subject` | New Exceptional Home Availability Request — Villa Sa Font |
| `notify_to` | Reservations@WhataHotel.com |
| `reply_to` / `email` | the guest's email |
| `full_name`, `first_name`, `last_name`, `phone` | guest details (phone optional) |
| `property_name`, `property_id`, `property_destination`, `property_country`, `property_location`, `property_source_url` | the home (taken from our dataset, not typed by the guest) |
| `check_in`, `check_out`, `nights` | preferred dates (YYYY-MM-DD) |
| `adults`, `children`, `infants`, `total_guests` | party size |
| `over_published_capacity` | "Yes" if adults + children exceed the home's published capacity |
| `message` | the guest's message (may be empty) |
| `email_text` | ready-made plain-text summary of everything above |
| `email_html` | ready-made HTML summary (guest text escaped) |
| `inquiry_id` | reference shown to the guest, e.g. `MOH-20261103-QJHJK8` |
| `submitted_at`, `source_page`, `consent`, `tags`, `event`, `submission_id` | housekeeping |

## Set up the GHL workflow

1. Go to **Automation → Workflows → + Create Workflow**, then **Start from scratch**.
2. **Trigger:** Inbound Webhook. Its URL must match the one in `index.html`.
3. **Map the fields.** GHL needs one sample request:
   - Keep the workflow in **Draft** so no email goes out.
   - Send one **test** request. Either use the page in a preview, or ask us to post `docs/ghl-sample-payload.json`, which is clearly marked "TEST — please ignore".
   - Click **Fetch Sample Requests** and select it. The fields above now appear as `{{inboundWebhookRequest.<field>}}`.
4. **Action: Create/Update Contact.**
   - Map first name, last name, email and phone.
   - Optionally add the tag `exceptional-homes-inquiry`.
5. **Action: Send Internal Notification** (type: Email). Alternatively use **Send Email** to a custom address.
   - **To:** `Reservations@WhataHotel.com`
   - **Subject:** `{{inboundWebhookRequest.subject}}`
   - **Message:** either use `{{inboundWebhookRequest.email_text}}`, or build your own layout from the individual fields:
     ```
     Property: {{inboundWebhookRequest.property_name}} ({{inboundWebhookRequest.property_destination}})
     Guest: {{inboundWebhookRequest.full_name}} · {{inboundWebhookRequest.email}} · {{inboundWebhookRequest.phone}}
     Dates: {{inboundWebhookRequest.check_in}} → {{inboundWebhookRequest.check_out}} ({{inboundWebhookRequest.nights}} nights)
     Guests: {{inboundWebhookRequest.adults}} adults, {{inboundWebhookRequest.children}} children, {{inboundWebhookRequest.infants}} infants (total {{inboundWebhookRequest.total_guests}})
     Over published capacity: {{inboundWebhookRequest.over_published_capacity}}
     Message: {{inboundWebhookRequest.message}}
     Source: {{inboundWebhookRequest.property_source_url}}
     Reference: {{inboundWebhookRequest.inquiry_id}}
     This is an availability REQUEST. Nothing has been booked or confirmed.
     ```
   - **Reply-To:** `{{inboundWebhookRequest.reply_to}}`, if your GHL version offers a Reply-To field. If it doesn't, the guest's email is in the message.
6. Save and **Publish**, then send one final test (see below).

> Merge-field names come from GHL's field picker after step 3. Use the picker rather than typing them, since the exact syntax can vary between GHL versions.

## Testing

- **Automated tests never contact the live webhook.**
  - `npm test` runs the unit tests.
  - `node tests/e2e-mo-homes.cjs` runs the browser tests against a local mock webhook. It also blocks any request to `leadconnectorhq.com` and fails if one is attempted.
- **First live test (needs your approval):**
  - Submit one request from the preview page using an obviously fake guest ("TEST — please ignore") and your own email.
  - Confirm that Reservations@WhataHotel.com receives it with the right subject, fields and reply address, and that the contact appears in GHL.
  - Delete the test contact afterwards.

## Protections on the page

- **Field checks:** required fields, a valid email, phone optional, dates valid and in the future, check-out after check-in, at least 1 adult, and consent.
- **Trusted home details:** the home's name, location and source link come from the dataset; only its ID comes from the button the guest clicked.
- **Spam checks:**
  - A hidden honeypot field: bots that fill it in see a normal success message, and nothing is sent.
  - Submissions made within 1.5 seconds of opening the form are refused.
  - At most 3 sends per browser in 10 minutes.
- **Duplicate prevention:** the button is disabled while sending, so a double-click sends once.
- **Retries:** network errors, 429 and 5xx responses are retried twice with backoff. Other 4xx responses are not retried.
- **Privacy:** no personal data goes into URLs or analytics. The `dataLayer` events carry only the home ID, country or HTTP status.

## Optional: server route (stronger protection)

`server/inquiry-core.mjs` has adapters for Vercel (`api/request-availability.mjs`), Netlify and Cloudflare. It does the same job behind a server and adds:
- server-side validation;
- per-IP rate limiting and deduplication;
- a hidden webhook URL (`GHL_INQUIRY_WEBHOOK_URL`). See `.env.example`.

To switch to it:
1. Deploy one of the adapters.
2. Empty the `wah-ghl-webhook` meta tag.
3. Set `wah-inquiry-endpoint` to the deployed `/api/request-availability` URL.
