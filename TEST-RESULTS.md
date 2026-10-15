# Verification results

Verified October 15, 2026 on revision `a7d1b2efc9a245a0a424fa485895efdb021ebb10` (merged PR #15). PRs #1–#15 are merged. These results distinguish automated coverage from the production checks actually performed.

## Automated checks

| Check | Result |
| --- | --- |
| `npm ci` | Passed; lockfile unchanged |
| `npm run format:check` | Passed |
| `npm test` — Worker suite | 94 passed across 2 files |
| `npm test` — frontend/email suite | 13 passed |
| `npx wrangler deploy --dry-run` | Passed |
| `git diff --exit-code` before deployment | Passed |

Worker tests apply `migrations/0001_init.sql` and `0002_decision_token.sql` to isolated local Miniflare D1 storage. No seed file is applied. Test R2 is local. Every variable/secret is overridden with fake data, and outbound Turnstile, Google Routes, Resend and Access-certificate calls use `fetchMock`; unmocked outbound Worker requests are disabled.

Coverage includes delivery boundaries and integer-cent arithmetic; quote caching and provider failures; booking validation, rate limits, idempotency and server totals; confirmation races and rollback; Access JWT validation, allowlists and write guards; notification outbox and retries; soft deletion and photo cleanup; upload magic bytes/size limits; blocked dates; and retention. The frontend/email regressions load actual page modules in jsdom and check photos, admin payloads, error handling, queued-notification copy and email escaping/logistics. They do not establish visual layout correctness.

## Production deployment and checks

After explicit approval, `npx wrangler deploy` deployed revision `a7d1b2e` to `aatbky.us` in business account `714af045eb67c3d815a7f9551b61d21b`.

Worker version: `a158beed-632e-4a4a-a565-3802a0b3eb63`. Assets uploaded from `public/` only. The 15-minute scheduled trigger remains configured. No remote D1 command, migration or seed was run during deployment.

| Production check | Observed result |
| --- | --- |
| `GET /about` | 200; heading “Meet the Arnolds.” and Matthew/Rena copy |
| `GET /api/units` | 200 JSON array, empty |
| `GET /api/settings` | 200 JSON: 15 free miles, $0.35/mile, multiplier 4, no maximum |
| `GET /api/units/:id/blocked-dates` | 200 JSON array via existing smoke test with a missing-unit ID |
| Unauthenticated `GET /admin.html` | 302 to the configured Cloudflare Access team hostname |
| Unauthenticated `GET /api/admin/units` | 302 to the same Access team hostname |
| Production Turnstile widget | Configured in the business account for `aatbky.us`, managed mode |
| `wrangler secret list` | `GOOGLE_MAPS_API_KEY`, `IP_HASH_SECRET`, `ORIGIN_ADDRESS`, `TURNSTILE_SECRET` present; `RESEND_API_KEY` absent |

The GET-only smoke test passed before and after deployment. It checks response shapes for units, settings and blocked dates; an empty inventory exercises the third route using a missing-unit ID. This is not an end-to-end booking or a complete API contract test. Secret names establish presence only, not correct values, restrictions or provider operation.

## Remaining verification and limitations

- The installed test workerd supports compatibility dates only through 2025-09-06 and falls back from production's 2026-10-14 setting. Production compatibility-date behavior is not covered by this runtime. Test-only `nodejs_compat` enables the harness.
- `npm ci` reports dependency advisories (1 moderate, 5 high, 2 critical) and deprecation of `@cloudflare/vitest-pool-workers`. No automatic/breaking dependency fix was applied as part of the About deployment.
- `RESEND_API_KEY` is missing and `FROM_EMAIL` remains a placeholder. Sending-domain verification and delivery to both owner and customer are pending.
- Production secret values, Google API restrictions, real Routes requests, a live Turnstile token, R2 upload/retrieval and a complete booking have not been verified.
- Remote D1 migration status has not been inspected; it requires explicit confirmation. Working public GET routes do not prove that every migration is applied.
- The catalog remains empty, pending owner approval of listings, prices, specifications, configurations and photos. Review/sample seeds have not been run remotely.
- No new mobile/desktop visual or interactive browser regression was performed in this check. Historical demo browser evidence is not evidence of current production booking readiness.

## Historical context

The initial backend report recorded 84 Worker tests and an open PR #1. Those are historical results; current results above replace that status. The former `public/_redirects` rule (`/ /index.html 200`) was removed in merged PR #13 because Cloudflare rejected the loop. Static asset HTML handling now serves `/`; the removed redirect warning is not an outstanding issue.
