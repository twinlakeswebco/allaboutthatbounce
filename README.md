# All About That Bounce

Inflatable rentals for Oldham, Shelby, Henry, Trimble and Jefferson counties, Kentucky. Matthew and Rena Arnold own the business. Every rental begins as a request and becomes booked only after owner confirmation. Payment is cash or check at delivery, with no advance deposit and no online payment.

Production: https://aatbky.us. Contact: allaboutthatbounce7596@gmail.com · 502-851-7596 · Facebook Allaboutthatbounceky · Instagram allaboutthatbounce502.

## Application

One Cloudflare Worker serves the API and static assets. The frontend uses plain HTML, CSS and vanilla JavaScript, with no build step, remote fonts or third-party scripts except Turnstile. Inventory, requests and settings persist in D1; uploaded unit photos live in R2. This is not a localStorage demo.

| Location | Purpose |
| --- | --- |
| `public/index.html`, `about.html`, `book.html`, `contact.html` | Public pages |
| `public/admin.html`, `admin.js` | Owner dashboard: requests, inventory/photos, delivery settings and blocked dates |
| `public/app.js` | Shared UI, cards, calendar, booking and contact flows |
| `public/api.js` | Sole frontend data layer; calls `/api/*` and rejects HTML fallback responses |
| `public/styles.css` | Mobile-first layout, system fonts and shared color tokens |
| `public/_headers` | Security headers and admin noindex/no-store |
| `worker/index.js` | API router, booking decisions and scheduled work |
| `worker/access.js` | Access JWT validation, email allowlist and admin write guards |
| `worker/distance.js` | Google Routes quotes and hashed-address cache |
| `worker/email.js` | Resend messages, durable outbox and retries |
| `worker/storage.js`, `validation.js` | R2 photos, image checks and input validation |
| `migrations/` | Numbered D1 schema migrations only |
| `seeds/` | Local sample/review data; never run against production |
| `wrangler.jsonc` | Worker, assets, business account, custom domain, D1/R2 bindings and cron |

Only `public/` is served as static assets. Never change the assets directory to the repository root. `aatb-website-reference/` is an untracked capture of the previous public site, used only as a content source; never commit or deploy it. Synced/private reference documents must not be served.

## Local development

Use Node 22 or newer and the locked dependencies:

```sh
npm ci
npx wrangler d1 migrations apply allaboutthatbounce --local
npx wrangler dev
```

Open the localhost URL Wrangler prints. A plain static HTTP server cannot run this application's API. Local Wrangler storage is separate from production.

For local owner tools, put an authorized test email in `DEV_ADMIN_EMAIL` in an ignored `.dev.vars` file. The bypass works only on the exact hostname `localhost`. Keep all real secrets out of source, fixtures and logs; see [BACKEND.md](BACKEND.md) for setup. Automated tests provide fake secret bindings and mock every external service.

Optional local catalog review:

```sh
npx wrangler d1 execute allaboutthatbounce --local --file seeds/seed_catalog_review.sql
```

Neither catalog review data nor `seeds/seed_sample.sql` may run with `--remote`. Owners must confirm inventory, prices, configurations, dimensions, capacities and matching photos; enter approved units through the protected admin UI. Each current unit supports one fixed price and one wet/dry mode. Do not represent an add-on price as a full rental price, or create independent availability for configurations of the same physical unit.

## Checks

```sh
npm run format:check
npm test
```

`npm test` runs the Worker integration suite in Vitest/Miniflare, followed by frontend/email regressions in Node/jsdom. The tests apply the real numbered migrations to isolated local D1 storage and exercise local R2; seeds are excluded. Turnstile, Resend, Google Routes and Access certificate calls are mocked, with unmocked outbound Worker networking disabled.

Against a running local server:

```sh
npm run test:smoke
```

Against production, the same GET-only smoke test is safe:

```sh
API_BASE_URL=https://aatbky.us npm run test:smoke
```

It checks units, settings and blocked dates, including the empty-catalog case. It does not verify real provider credentials, email delivery, photo uploads or a complete booking. See [TEST-RESULTS.md](TEST-RESULTS.md) for verified results and limitations.

## Manual deployment

Deployments are manual; merging does not deploy the Worker. Before deployment, check the intended revision and run `npm ci`, `npm run format:check` and `npm test`. Use `npx wrangler whoami` to check authentication; `wrangler.jsonc` targets business account `714af045eb67c3d815a7f9551b61d21b`.

Obtain explicit confirmation before deploying, merging a pull request, or running any remote D1 command. Schema migration inspection/application is a separate approved action, not an automatic deployment step. Never apply a seed remotely.

After deployment is approved:

```sh
npx wrangler deploy
```

Verify `/about` shows “Meet the Arnolds.”, run the production smoke test, and check unauthenticated `/admin.html` and `/api/admin/*` still redirect to Cloudflare Access. `workers_dev` and preview URLs remain disabled. `/` is served by static asset HTML handling; no `_redirects` rewrite is required.

The nonfunctional GitHub Pages preview workflow has been removed. GitHub Pages cannot run this API and must not be presented as a functional booking preview. A functional preview requires a separate Worker and isolated data/services. Removing the workflow does not itself unpublish any historical Pages deployment.

## API and business rules

Frontend data functions return Promises and reject with human-readable errors. Prices and fees are dollar numbers at the API boundary; the Worker stores and recomputes totals in integer cents. Dates are event-calendar dates in `YYYY-MM-DD`; availability decisions use America/New_York. IDs are opaque strings.

| Method and route | Behavior |
| --- | --- |
| `GET /api/units` | Active units with approved `/media/*` photo URLs |
| `GET /api/settings` | Public delivery settings |
| `GET /api/units/:id/blocked-dates` | Manual blocks and confirmed rentals, excluding past dates |
| `POST /api/delivery-quote` | `{ address }` → `{ distance_miles, fee, status }` |
| `POST /api/booking-requests` | Validated pending request, idempotent by request key; queues owner and customer notifications |
| `POST /api/contact` | Validated contact message; queues owner notification |
| `PUT /api/admin/settings` | Save complete delivery settings |
| `GET /api/admin/booking-requests` | List requests |
| `POST /api/admin/booking-requests/:id/status` | Confirm or decline a pending request |
| `POST /api/admin/units`, `PUT /api/admin/units/:id` | Create/update a unit and up to five photos, each at most 1 MB |
| `DELETE /api/admin/units/:id` | Soft-delete if no pending/confirmed request is dated today or later |
| `PUT`, `DELETE /api/admin/units/:id/blocked-dates/:date` | Add/remove manual block; confirmed rentals cannot be unblocked |

Booking input includes `unit_id`, `date`, `name`, `phone`, `email`, `event_type`, `delivery_address` and `idempotency_key`. Booking/contact also require the corresponding action's `turnstile_token` and an empty `website` honeypot; `api.js` collects these protected fields. HMAC IP buckets rate-limit requests. Pending requests do not hold dates; a unique D1 index permits only one confirmed request per unit/date.

All admin API routes validate the Cloudflare Access JWT and `ADMIN_EMAILS`, with same-origin/content-type checks on writes. Cloudflare Access also protects the admin page at the edge. Do not expose an alternate hostname around that protection.

Delivery is free within the configured radius. Outside it, the fee is **full distance × per-mile rate × trip multiplier**, rounded to cents. Defaults are 15 free miles, $0.35/mile, multiplier 4 and no maximum. Thus 16 miles costs $22.40 and 20 miles costs $28.00. A configured maximum takes precedence; `outside_area` has a zero fee sentinel and disables submission. The private origin exists only as `ORIGIN_ADDRESS`; no frontend, metadata, logs or repository content may reveal it. Quote caches retain address hashes, not raw addresses.

The five named counties describe the business service area. The distance API calculates a route and optional distance cap; it does not validate a customer's county. Owners must check service eligibility when confirming.

Booking creation and decisions queue email in D1. The 15-minute cron retries pending/failed notifications up to five attempts. A successful request response means saved and queued, not delivered. Without `RESEND_API_KEY`, outbox rows remain pending without using attempts. The cron also anonymizes old booking contact details and deletes old contact messages and rate-limit buckets.

## Production status and open decisions

On October 15, 2026, revision `a7d1b2e` was deployed and the About heading, public GET API and Access redirects were verified. The live catalog is empty. All five required secrets are present by name, and the Resend sending domain is verified. The deployed `FROM_EMAIL` is still `bookings@example.com`; PR #18 changes it to the verified domain and directs customer replies to the business Gmail inbox. A live locality-level delivery quote returned a valid result. Real email delivery and an end-to-end booking are not verified; catalog entry was deferred by request. Do not describe the business as ready for online booking until setup and owner approvals are complete.

The working logo and palette remain provisional. Canonical production is currently hosted at `aatbky.us`, while Open Graph metadata still points at the previous domain and uses a placeholder image. Rena is the direct customer contact. Adding Instagram to shared footers and using `aatbky.us` as the canonical domain are approved; the corresponding website changes are reviewed separately. See [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) and [BACKEND.md](BACKEND.md).
