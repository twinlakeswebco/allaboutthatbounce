# Backend setup

The private distance origin is never stored in this repository. Set it only as the `ORIGIN_ADDRESS` Worker secret. Do not put it in issues, commits, logs, tests, or configuration.

## Cloudflare resources

```sh
npx wrangler d1 create allaboutthatbounce
# Copy the returned database_id into wrangler.jsonc.
npx wrangler d1 migrations apply allaboutthatbounce --local
npx wrangler d1 execute allaboutthatbounce --local --file=migrations/seed_sample.sql
npx wrangler r2 bucket create allaboutthatbounce-photos
```

`migrations/seed_sample.sql` contains sample inventory only and must never be run against the production database.

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

The Worker stores prices as cents and converts to dollar numbers only at the API boundary. Customer delivery addresses are retained only on booking requests for the stated retention period; quote caching stores only a SHA-256 address hash and distance. Client IPs are never stored raw; rate-limit keys use HMAC-SHA-256.
## Unit removal

Units are soft deleted. Pending or confirmed requests block removal only when their event date is today or later in America/New_York. Past requests retain their unit name and price snapshots. Removal also deletes unit photo rows, matching R2 objects, and manual blocks. The blocked-case error message is unchanged.

## Automated verification

`npm ci` followed by `npm test` runs the complete Vitest suite with local Miniflare D1/R2 storage. Real numbered migrations are applied by `readD1Migrations` and `applyD1Migrations`, with the sample seed excluded before files are read. Every secret and variable is overridden with a fake test value. External calls are mocked with `fetchMock` and real network connections are disabled.

Against a running `wrangler dev` server, `npm run test:smoke` checks only `/api/units`, `/api/settings`, and `/api/units/:id/blocked-dates`. It is a smoke test, not contract verification. It does not replace the Vitest suite or verify production integrations.

The compatible test pool retains the requested `fetchMock` API. Its installed workerd supports compatibility dates through 2025-09-06, so the local test run falls back from the configured 2026-10-14 date. The suite adds `nodejs_compat` only for the test harness. Production compatibility-date behavior is not verified. An existing `public/_redirects` rule also produces an ignored redirect-loop warning; it was left unchanged. See `TEST-RESULTS.md` for the complete captured test output and verification limits.
