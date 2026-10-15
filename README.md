# All About That Bounce — frontend demo

Plain HTML, CSS, and vanilla JavaScript. Four public pages plus a separate owner dashboard. No framework, CMS, payment form, backend, third-party scripts, or remote fonts.

## Files

All deployed files are flat inside `public/`:

- `index.html`, `about.html`, `book.html`, `contact.html`: public pages.
- `admin.html`: owner dashboard; no login UI.
- `styles.css`: responsive styles and centralized color/font variables.
- `app.js`: shared helpers, public-page rendering, date picker, booking/contact flows.
- `admin.js`: requests, units/photos, delivery settings, blocked dates.
- `api.js`: the only data layer; replace its async implementations with HTTP requests.
- `placeholder.svg`, `favicon.svg`, `share.svg`, `share.png`: lightweight local placeholder assets.
- `_headers`: security headers and admin noindex/no-store.

Root files: `wrangler.jsonc` deploy configuration, `test-api.mjs` three-route GET smoke test, and product/design notes. Existing reference documents at repository root are **not** included in deployed assets. Never change the assets directory to the repository root.

## Run locally

```sh
python3 -m http.server 8080 --directory public
```

Open http://localhost:8080/index.html and http://localhost:8080/admin.html in the same browser. ES modules require HTTP, not `file://`. Demo changes persist in localStorage under `aatb-demo-v1`. To reset, clear this key using browser developer tools. Different browsers/devices do not share requests or inventory. No messages or requests are sent to the owner.

Run checks with Node 20+:

```sh
npm run test:smoke
```

## GitHub Pages frontend preview

Enable GitHub Pages in repository Settings → Pages, with GitHub Actions as the
publishing source. `.github/workflows/preview-pages.yml` publishes only `public/`
when website files change on `main`, or when run manually. Repository-root
reference documents and backend files are excluded.

Preview URL: `https://twinlakeswebco.github.io/allaboutthatbounce/` (no `/public`
suffix). This publishes the browser-storage frontend demo on `main`; the Worker
backend is deployed separately to Cloudflare. GitHub Pages cannot run the Worker.

## Cloudflare Workers static assets

```sh
npx wrangler dev
npx wrangler deploy
```

No build step. Wrangler serves only `public/`. `/` serves the index page; links use `.html` routes. This configuration has no Worker API code or D1 binding yet. Put Cloudflare Access in front of `/admin.html` and **all future admin API routes** before production use. No client-side login or security claim is made by this demo.

## API contract

All data functions return Promises and reject on failure (human-readable `Error.message`). Dollar values are numbers in dollars, not integer cents. Dates are local event-calendar dates in `YYYY-MM-DD` form. IDs are opaque strings. Frontend code imports only this module for data operations.

| Function | Input | Output |
|---|---|---|
| `listUnits()` | None | `Unit[]` |
| `getSettings()` | None | `DeliverySettings` |
| `updateSettings(settings)` | Complete `DeliverySettings` | Saved `DeliverySettings` |
| `getBlockedDates(unitId)` | Unit ID string | `string[]` of unavailable dates, including manual blocks and confirmed requests |
| `getDeliveryQuote(address)` | Complete customer delivery-address string | `DeliveryQuote` (exact contract below) |
| `createBookingRequest(input)` | `BookingInput` | `BookingRequest`, status `pending` |
| `listBookingRequests()` | None | `BookingRequest[]` for admin |
| `setBookingStatus(id, status)` | Request ID, `"confirmed"` or `"declined"` | Updated `BookingRequest`; confirmation blocks that unit/date |
| `saveUnit(unit)` | `Unit` without ID for creation; with ID for update | Saved `Unit` |
| `deleteUnit(id)` | Unit ID | `{ "deleted": true }`; rejects for pending/confirmed requests dated today or later in America/New_York |
| `blockDate(unitId, date)` | Unit ID and date string | `{ "unit_id": string, "date": string, "blocked": true }` |
| `unblockDate(unitId, date)` | Unit ID and date string | Same shape with `blocked: false`; rejects for confirmed rentals |
| `sendContactMessage(input)` | `{ name: string, email: string, message: string }` | `{ id: string, status: "received" }`; future stub route `POST /api/contact` |

`localDate(date = new Date())` is a synchronous formatting helper, not an endpoint. `defaultSettings` is a demo seed, not an endpoint.

```ts
type Unit = {
  id: string;
  name: string;
  description: string;
  size: string;
  mode: "dry" | "wet";
  price: number;
  photos: string[]; // demo data URLs or placeholder; real backend returns approved image URLs
  deposit_required: boolean; // all seeds false; notice only, no payment implementation
};
type DeliverySettings = {
  free_radius_miles: number; // 15
  per_mile_rate: number; // 0.35
  trip_multiplier: number; // 4
  max_delivery_miles: number | null; // null: no maximum
};
type DeliveryQuote = {
  distance_miles: number;
  fee: number;
  status: "free" | "fee" | "outside_area";
};
type BookingInput = {
  unit_id: string;
  date: string;
  name: string;
  phone: string;
  email: string;
  event_type: string;
  delivery_address: string;
  idempotency_key: string;
};
type BookingRequest = BookingInput & {
  id: string;
  status: "pending" | "confirmed" | "declined";
  created_at: string; // ISO timestamp
  unit_name: string;
  unit_price: number;
  delivery_quote: DeliveryQuote;
  total: number;
};
```

### Exact delivery quote request/response

The function signature is `getDeliveryQuote(address: string): Promise<DeliveryQuote>`.
Recommended real endpoint: `POST /api/delivery-quote`, JSON body:

```json
{ "address": "CUSTOMER_DELIVERY_ADDRESS" }
```

Response, for a 16-mile address:

```json
{ "distance_miles": 16, "fee": 22.4, "status": "fee" }
```

Other examples:

```json
{ "distance_miles": 15, "fee": 0, "status": "free" }
```

```json
{ "distance_miles": 20, "fee": 28, "status": "fee" }
```

With maximum 25 miles and distance 26:

```json
{ "distance_miles": 26, "fee": 0, "status": "outside_area" }
```

The zero fee in `outside_area` is a sentinel, not free delivery. The UI displays “Unavailable,” disables submission, and provides phone/email links.

The mock recognizes `demo 15 miles`, `demo 16 miles`, `demo 20 miles`, etc. in the address field. Otherwise it deterministically invents 10–35 miles from the entered text. This is not geographic lookup and must be replaced. The backend alone calculates real distance from a private origin stored in server configuration. No origin is provided to the frontend.

Mock calculation is contained only in `api.js`: distances within the configured radius are free; outside that radius, **full distance × per-mile rate × trip multiplier**, rounded to cents. Maximum distance is checked before an eligible fee is returned. Page code only adds the returned delivery fee to the unit price. The booking implementation re-quotes and validates availability rather than trusting the displayed total.

## Backend handoff

Validate customer input server-side, protect admin endpoints with Access, and use D1 transactions/unique constraints to ensure concurrent confirmation cannot reserve the same unit/date twice. Keep booking creation idempotent. Pending requests do not hold dates. Confirmation and manual blocks must affect availability immediately. Real booking totals must be recomputed from server inventory/settings, never trusted from a client. Implement photo uploads/storage behind `saveUnit` or a private helper inside `api.js` so pages do not need endpoint knowledge. Demo photos are limited to three files, 500 KB each, to avoid overflowing localStorage.

## Assumptions and pre-launch content

- One unit per request; rental price covers the requested date. Duration/times are not supplied.
- A request remains pending until a human confirms; confirmation does not send notifications in this frontend demo.
- Cash or check only. Deposit toggle enables a notice, never online collection.
- Unit removal is a soft delete, blocked only for pending or confirmed requests with an event date of today or later in America/New_York. Past requests retain their unit name and price snapshots. Removal deletes unit photo rows, matching R2 objects, and manual blocks.
- The palette is provisional; edit variables at the top of `styles.css`. System fonts satisfy the no-unnecessary-font-dependencies requirement.
- Public copy comes from the sources listed under “Content sources” below. Catalog prices still need owner approval before launch.
- Open Graph assumes the existing `allaboutthatbounceky.net` domain from supplied notes; change the absolute `og:image` URL on each HTML page if the final domain changes. `share.png` is a local 1200×630 placeholder image.
- Company geography is limited to the five served counties (see “Content sources”). No private origin or business street address is in deployed code or metadata.
- Public demo banners must be replaced with truthful live messages only when the real API and notifications exist.

## Content sources

- **Reference capture.** Business facts, policies, and catalog details come from the previous public site, captured on 2026-10-15 into `aatb-website-reference/`. That folder stays untracked and outside `public/`; never commit or deploy it. Policy copy follows that site's FAQ.
- **Contact.** `allaboutthatbounce7596@gmail.com` is the canonical email everywhere, with phone 502-851-7596 and the Facebook page `Allaboutthatbounceky`. Older addresses from the previous site are retired; do not reintroduce them.
- **Service area.** Oldham, Shelby, Henry, Trimble, and Jefferson counties (La Grange, Shelbyville). Grayson County and Leitchfield are intentionally excluded until the business is ready to serve them.
- **Catalog seed.** `seeds/seed_catalog_review.sql` is review-only: its prices and specs await owner confirmation and it is never applied by migrations or tests.

## Historical frontend demo verification

The original frontend demo checks passed. Headless Chromium checks passed for all five routes at 360px with no horizontal overflow or JavaScript errors; booking → pending request → admin confirmation → unavailable date; 15/16/20-mile fee examples; outside-area submission blocking; inventory CRUD; manual blocking/unblocking; contact validation and demo save. Mobile route screenshots and a desktop homepage screenshot were inspected. These checks verify the browser-local demo, not a future Worker/D1 implementation or production deployment.

## Automated checks

Run `npm ci`, `npm run format:check`, and `npm test`. The test command runs both the Worker integration suite and the frontend/email regressions. These same checks run in `.github/workflows/tests.yml` for pull requests to `backend-worker` and `main`; a successful Cloudflare Pages deployment alone is not a passing test run.

`npm run test:worker` runs the unit and D1/R2 integration coverage in Vitest with Miniflare. `vitest.config.mjs` loads `wrangler.jsonc`, supplies fake values for every variable and secret, and exposes only numbered files from `migrations/` to `readD1Migrations`. Setup applies them using `applyD1Migrations`; it never reads or loads `seed_sample.sql`. Each test receives isolated D1 and R2 storage.

Outbound requests are intercepted with `fetchMock` from `cloudflare:test`, with `disableNetConnect` enabled. Turnstile, Resend, Google Routes, and Access certificates use mocks. Access JWTs are signed with an RSA key generated in test setup. The suite checks responses and stored data, including decision races and rollback.

`npm run test:frontend` uses Node’s test runner and jsdom to load the actual HTML and ES modules. It exercises photo rendering, admin save/remove payloads, queued-notification copy, special-arrangements copy, and HTML fallback failures. It also checks customer email logistics, escaping, and subjects. It does not verify visual layout in a browser.

`npm run test:smoke` checks only the three public GET routes against a running `wrangler dev` server, or the origin set in `API_BASE_URL`. It is a smoke test, not contract verification. These tests do not verify real provider credentials or services. See `BACKEND.md` for Worker deployment and the distinction between a static Pages preview and the running backend.

The compatible test pool retains the requested `fetchMock` API. Its installed workerd supports compatibility dates through 2025-09-06, so the local test run falls back from the configured 2026-10-14 date. The suite adds `nodejs_compat` only for the test harness. Production compatibility-date behavior is not verified. The former `public/_redirects` rule (`/ /index.html 200`) was removed because Cloudflare rejects it as a redirect loop at deploy; `html_handling: auto-trailing-slash` already serves `index.html` at `/`. See `TEST-RESULTS.md` for the complete captured test output and verification limits.
