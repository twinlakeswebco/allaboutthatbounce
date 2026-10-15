# Backend setup

The private distance origin is never stored in this repository. Set it only as the `ORIGIN_ADDRESS` Worker secret. Do not put it in issues, commits, logs, tests, or configuration.

## Cloudflare resources

```sh
npx wrangler d1 create allaboutthatbounce
# Copy the returned database_id into wrangler.jsonc.
npx wrangler d1 migrations apply allaboutthatbounce --local
npx wrangler d1 execute allaboutthatbounce --local --file=seeds/seed_sample.sql
npx wrangler r2 bucket create allaboutthatbounce-photos
```

`seeds/seed_sample.sql` contains sample inventory only and must never be run against the production database.

## Catalog review seed

`seeds/seed_catalog_review.sql` loads the 26 listings from the old public rental page (captured 2026-10-15) so the owner can review real names, prices, sizes, and supervision rules in a local build. `price_cents` is each unit's lowest standalone price; wet, dry, and add-on options are written out in the description. It uses `INSERT OR IGNORE`, so running it twice is safe.

```sh
npx wrangler d1 migrations apply allaboutthatbounce --local
npx wrangler d1 execute allaboutthatbounce --local --file seeds/seed_catalog_review.sql
```

It is review data, not a migration. Tests only read numbered files in `migrations/`, so it never reaches the test suite. Do not run it with `--remote` until the owner has confirmed prices, inventory, and capacities; enter confirmed units through the admin instead.

Set the non-secret values in `wrangler.jsonc` before deployment: `FROM_EMAIL`, `SITE_ORIGIN`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS`, and `TURNSTILE_SITE_KEY`. `OWNER_EMAIL` is already configured. Because the site is static and there is intentionally no public configuration endpoint, copy the same public Turnstile site key into the `data-sitekey` attribute in `public/book.html` and `public/contact.html` when replacing the placeholder.

Set secrets interactively so values never enter shell history or the repository:

```sh
npx wrangler secret put ORIGIN_ADDRESS
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put IP_HASH_SECRET
```

For local admin testing only, `DEV_ADMIN_EMAIL` may be placed in `.dev.vars`; the Worker accepts that bypass only when the request hostname is exactly `localhost`.

Run locally and deploy:

```sh
npx wrangler d1 migrations apply allaboutthatbounce --local
npx wrangler dev
npm run test:smoke
npx wrangler d1 migrations apply allaboutthatbounce --remote
npx wrangler deploy
```

## Manual setup checklist

- Create a Cloudflare Access self-hosted application/policies covering `/admin.html` and `/api/admin/*`. Copy the application AUD to `ACCESS_AUD`, set the team domain, and keep `ADMIN_EMAILS` restricted to authorized owner/admin addresses.
- Create a Cloudflare Turnstile site for the production hostname. Set its public site key in configuration and both static widget attributes; store only its secret with `wrangler secret put TURNSTILE_SECRET`.
- Verify the sending domain in Resend, then set `FROM_EMAIL` to an address on that verified domain.
- In Google Cloud, enable Routes API and restrict the API key to Routes API use. Store it only as `GOOGLE_MAPS_API_KEY`.
- Create D1 and R2, update the D1 database ID, apply production migrations, and do not run the sample seed remotely.
- Set `SITE_ORIGIN` to the exact production origin, including `https://` and no trailing path.

## Worker deployment and static previews

The full application must run as a Cloudflare Worker with static assets using `wrangler.jsonc`. Deploying `public/` to Cloudflare Pages or GitHub Pages publishes the frontend only: those hosts do not execute `worker/index.js`, bind D1/R2, or run the email retry cron. A static fallback can return homepage HTML with status 200 for `/api/units`; that is not a working API. The client rejects HTML responses and shows a phone recovery message instead of reporting success.

After completing the manual setup checklist, authenticate with `npx wrangler login` and check the selected account with `npx wrangler whoami`. Apply only numbered migrations to the intended database, then deploy the Worker:

```sh
npm ci
npm run format:check
npm test
npx wrangler d1 migrations apply allaboutthatbounce --remote
npx wrangler deploy
```

Use the Worker URL printed by deployment as `API_BASE_URL` when running `npm run test:smoke`. `/api/units` must return a JSON array, and `/api/settings` must return JSON settings. Do not send customers to a Pages preview that serves HTML for those routes. For an online preview, use a separately configured Worker with its own D1, R2, secrets, Access policy, and matching site origin; do not connect a public test preview to production data. The review catalog seed remains local-only until approved.

The Worker stores prices as cents and converts to dollar numbers only at the API boundary. Customer delivery addresses are retained only on booking requests for the stated retention period; quote caching stores only a SHA-256 address hash and distance. Client IPs are never stored raw; rate-limit keys use HMAC-SHA-256.
## Unit removal

Units are soft deleted. Pending or confirmed requests block removal only when their event date is today or later in America/New_York. Past requests retain their unit name and price snapshots. Removal also deletes unit photo rows, matching R2 objects, and manual blocks. The blocked-case error message is unchanged.

## Automated verification

`npm ci` followed by `npm test` runs the Worker suite with local Miniflare D1/R2 storage and then the frontend/email regressions in Node/jsdom. Real numbered migrations are applied by `readD1Migrations` and `applyD1Migrations`, with the sample seed excluded before files are read. Every secret and variable is overridden with a fake test value. External Worker calls are mocked with `fetchMock` and real network connections are disabled. Frontend tests stub fetch responses rather than contacting providers.

Against a running `wrangler dev` server, `npm run test:smoke` checks only `/api/units`, `/api/settings`, and `/api/units/:id/blocked-dates`. It is a smoke test, not contract verification. It does not replace the Vitest suite or verify production integrations.

The compatible test pool retains the requested `fetchMock` API. Its installed workerd supports compatibility dates through 2025-09-06, so the local test run falls back from the configured 2026-10-14 date. The suite adds `nodejs_compat` only for the test harness. Production compatibility-date behavior is not verified. An existing `public/_redirects` rule also produces an ignored redirect-loop warning; it was left unchanged. See `TEST-RESULTS.md` for the complete captured test output and verification limits.
