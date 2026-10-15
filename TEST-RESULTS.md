# Backend branch verification

PR #1 remains open and unmerged. This report covers local verification of the requested changes; it does not establish production readiness.

## Commits and per-step tests

A preliminary commit removes the PDF from the index and ignores PDFs and `private/`; no history rewrite was performed. Six separate commits implement the six requested steps.

| Checkpoint | Result |
| --- | --- |
| Before step 1 | 4 passed, 0 failed |
| Step 1: formatting | 4 passed, 0 failed |
| Step 2: conditional outbox | 4 passed, 0 failed |
| Step 3: cent validation and arithmetic | 14 passed, 0 failed |
| Step 4: unit deletion | 14 passed, 0 failed |
| Step 5: Turnstile reset | 14 passed, 0 failed |
| Step 6: complete Vitest suite | 84 passed, 0 failed; 2 test files |

The original tests are retained in Vitest. Formatting checks and `git diff --check` pass. The formatting-only step was checked with a parsed HTML comparison of `book.html` and `contact.html`: visible text, tag sequence, and attributes were identical after normalizing void-tag spelling and inline CSS whitespace. No behavior changes were included in that commit.

## Migrations

- `migrations/0001_init.sql`
- `migrations/0002_decision_token.sql`

`migrations/seed_sample.sql` is a sample inventory seed, not an applied test migration. The test config presents only numbered migration files to `readD1Migrations`; setup applies them using `applyD1Migrations`. Neither the automated suite nor the local smoke database loaded the seed.

## Verified

The suite checks HTTP results and relevant D1/R2 state for fee boundaries and rates, Google delivery quotes/cache/error handling and fake secret usage, booking validation/server totals/rate limits, idempotency, normal and blocked decisions, same-date and same-request races, unique-constraint rollback, all eight supported admin route/method combinations without a token, signed Access token validation and write guards, failed email retries and the five-attempt limit, confirmed-date unblock protection, past/today/future deletion rules, photo validation and orphan removal, and retention. The NaN case is asserted directly against validation; its HTTP JSON serialization becomes null and is also rejected.

All secrets and variables in tests have fake bindings. RSA keys are generated locally for signed JWT tests. Turnstile, Resend, Google Routes, and Access certificates are intercepted by `fetchMock`; `disableNetConnect` prevents real outbound fetches, with an explicit rejection test for an unmocked host. No real addresses or personal details are used as fixtures.

The GET-only smoke test passed against a running local Wrangler server initialized with the two numbered migrations. It checks `/api/units`, `/api/settings`, and `/api/units/:id/blocked-dates`; an empty inventory still exercises the third route. It is a smoke test, not contract verification.

## Not verified and warnings

- No production deployment, live D1/R2 resources, credentials, provider delivery, or Cloudflare Access/Turnstile configuration was verified.
- The compatible `@cloudflare/vitest-pool-workers` version retains `fetchMock`; its installed runtime supports compatibility dates through 2025-09-06 and falls back from the Wrangler date 2026-10-14. Full production compatibility-date behavior is not verified. Test-only `nodejs_compat` is enabled for the harness.
- The quote failure test uses a mocked provider 500 returning 503 without a guessed distance; a real elapsed provider timeout was not separately exercised.
- No new browser interaction or live Turnstile token test was run. The frontend changes are limited to the two `finally` resets.
- Wrangler/Miniflare warns about the existing ignored redirect-loop rule in `public/_redirects`; no redirect behavior was changed.
- A default Wrangler launch hit the environment's network-interface restriction. Explicit loopback binding and a disabled inspector allowed startup. The server and smoke client ran within the same isolated execution environment to avoid cross-process network namespace restrictions.
- Repository history cleanup remains separate. The restricted PDF was not opened or read.

No application behavior was changed beyond the requested outbox, fee, deletion, and Turnstile changes. The additional changes are the requested repository exclusions, formatting, migration, development dependencies, tests, smoke-test labeling, and documentation.

## Full Vitest output

Command: `npm test`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> test
> vitest run --reporter=verbose

Proxy environment variables detected. We'll use your proxy for fetch requests.

 RUN  v3.2.7 /workspace/scratch/a163b3e8de43/repo

[vpw:info] Starting isolated runtimes for vitest.config.mjs...
[mf:warn] The latest compatibility date supported by the installed Cloudflare Workers Runtime is "2025-09-06",
but you've requested "2026-10-14". Falling back to "2025-09-06"...
[mf:warn] The latest compatibility date supported by the installed Cloudflare Workers Runtime is "2025-09-06",
but you've requested "2026-10-14". Falling back to "2025-09-06"...
[mf:warn] Found 1 invalid redirect rule:
▶︎ Infinite loop detected in this rule and has been ignored. This will cause a redirect to strip `.html` or `/index` and end up triggering this rule again. Please fix or remove this rule to silence this warning.
    at public/_redirects:1 | / /index.html 200


[mf:warn] Found 1 invalid redirect rule:
▶︎ Infinite loop detected in this rule and has been ignored. This will cause a redirect to strip `.html` or `/index` and end up triggering this rule again. Please fix or remove this rule to silence this warning.
    at public/_redirects:1 | / /index.html 200


 ✓ tests/worker.test.mjs > fee route at 15 miles returns 0 27ms
 ✓ tests/backend.test.mjs > delivery fee examples and boundary 15ms
 ✓ tests/backend.test.mjs > maximum delivery distance 11ms
 ✓ tests/backend.test.mjs > photo magic bytes reject fake image 12ms
 ✓ tests/backend.test.mjs > distance quote object cannot expose origin 7ms
 ✓ tests/backend.test.mjs > fractional mile uses integer cents 12ms
 ✓ tests/backend.test.mjs > accept cent rate 0.29 12ms
 ✓ tests/backend.test.mjs > accept cent rate 0.07 9ms
 ✓ tests/backend.test.mjs > accept cent rate 0.57 8ms
 ✓ tests/backend.test.mjs > accept cent rate 0.58 9ms
 ✓ tests/worker.test.mjs > fee route at 16 miles returns 22.4 19ms
 ✓ tests/worker.test.mjs > fee route at 20 miles returns 28 14ms
 ✓ tests/worker.test.mjs > fee route at 15.1 miles returns 21.14 17ms
 ✓ tests/worker.test.mjs > maximum distance takes precedence even inside free radius 21ms
 ✓ tests/worker.test.mjs > settings accepts 0.29 and stores integer cents 15ms
 ✓ tests/worker.test.mjs > settings accepts 0.07 and stores integer cents 13ms
 ✓ tests/worker.test.mjs > settings accepts 0.57 and stores integer cents 13ms
 ✓ tests/backend.test.mjs > accept cent rate 0.55 11ms
 ✓ tests/backend.test.mjs > reject invalid rate 0.355 12ms
 ✓ tests/backend.test.mjs > reject invalid rate -1 7ms
 ✓ tests/backend.test.mjs > reject invalid rate NaN 10ms
 ✓ tests/backend.test.mjs > reject invalid rate 0.35 10ms
 ✓ tests/worker.test.mjs > settings accepts 0.58 and stores integer cents 12ms
 ✓ tests/worker.test.mjs > settings accepts 0.55 and stores integer cents 14ms
 ✓ tests/worker.test.mjs > settings rejects invalid 0.355 without mutation 17ms
 ✓ tests/worker.test.mjs > settings rejects invalid -1 without mutation 15ms
 ✓ tests/worker.test.mjs > settings rejects invalid NaN without mutation 12ms
 ✓ tests/worker.test.mjs > settings rejects invalid 0.35 without mutation 15ms
 ✓ tests/worker.test.mjs > Google quote uses secret binding, caches response, and never exposes origin 16ms
 ✓ tests/worker.test.mjs > unresolvable address returns 422 and no cache entry 9ms
 ✓ tests/worker.test.mjs > Google 500 returns 503 without guessed distance or cache entry 10ms
 ✓ tests/worker.test.mjs > booking happy path recomputes total and queues two distinct emails 31ms
 ✓ tests/worker.test.mjs > booking rejects past date and creates no booking or email 9ms
 ✓ tests/worker.test.mjs > booking rejects missing Turnstile and creates no booking or email 10ms
 ✓ tests/worker.test.mjs > booking rejects failed Turnstile and creates no booking or email 10ms
 ✓ tests/worker.test.mjs > booking rejects honeypot and creates no booking or email 9ms
 ✓ tests/worker.test.mjs > booking rejects manual block without adding a request or email 12ms
 ✓ tests/worker.test.mjs > booking rejects confirmed date without adding a request or email 14ms
 ✓ tests/worker.test.mjs > booking rejects outside area and retains only quote cache 16ms
 ✓ tests/worker.test.mjs > eleventh booking in an hour from the same IP is rejected 90ms
 ✓ tests/worker.test.mjs > idempotent replay returns same row without duplicate email 24ms
 ✓ tests/worker.test.mjs > idempotency key with another email returns 409 without mutation 20ms
 ✓ tests/worker.test.mjs > normal confirmation queues exactly one confirmation email 14ms
 ✓ tests/worker.test.mjs > manual-block confirmation regression returns 409 and leaves no retryable email 14ms
 ✓ tests/worker.test.mjs > racing confirmations yield one 200, one 409 and one email with losing batch rolled back 18ms
 ✓ tests/worker.test.mjs > unique-violation decision rolls back token, status and outbox insert 20ms
 ✓ tests/worker.test.mjs > repeating confirmed on decided request returns 409 without another email 15ms
 ✓ tests/worker.test.mjs > repeating declined on decided request returns 409 without another email 18ms
 ✓ tests/worker.test.mjs > decline queues only decline email 25ms
 ✓ tests/worker.test.mjs > Access denies no token: PUT /api/admin/settings 19ms
 ✓ tests/worker.test.mjs > Access denies no token: GET /api/admin/booking-requests 16ms
 ✓ tests/worker.test.mjs > Access denies no token: POST /api/admin/booking-requests/test-request/status 17ms
 ✓ tests/worker.test.mjs > Access denies no token: POST /api/admin/units 14ms
 ✓ tests/worker.test.mjs > Access denies no token: PUT /api/admin/units/test-unit 11ms
 ✓ tests/worker.test.mjs > Access denies no token: DELETE /api/admin/units/test-unit 13ms
 ✓ tests/worker.test.mjs > Access denies no token: PUT /api/admin/units/test-unit/blocked-dates/2099-06-15 13ms
 ✓ tests/worker.test.mjs > Access denies no token: DELETE /api/admin/units/test-unit/blocked-dates/2099-06-15 16ms
 ✓ tests/worker.test.mjs > Access rejects expired with 401 and unchanged database 15ms
 ✓ tests/worker.test.mjs > Access rejects wrong issuer with 401 and unchanged database 19ms
 ✓ tests/worker.test.mjs > Access rejects wrong audience with 401 and unchanged database 16ms
 ✓ tests/worker.test.mjs > Access rejects tampered signature with 401 and unchanged database 16ms
 ✓ tests/worker.test.mjs > Access rejects alg none with 401 and unchanged database 17ms
 ✓ tests/worker.test.mjs > Access rejects unknown kid with 401 and unchanged database 19ms
 ✓ tests/worker.test.mjs > valid disallowed email returns 403 15ms
 ✓ tests/worker.test.mjs > valid allowed Access token returns stored requests 19ms
 ✓ tests/worker.test.mjs > admin write rejects mismatched Origin 15ms
 ✓ tests/worker.test.mjs > admin write rejects wrong content type 13ms
 ✓ tests/worker.test.mjs > DEV_ADMIN_EMAIL never bypasses Access on non-localhost 13ms
 ✓ tests/worker.test.mjs > Resend failure preserves 201 booking; scheduled retry sends failed rows 21ms
 ✓ tests/worker.test.mjs > outbox stops retrying after five attempts 36ms
 ✓ tests/worker.test.mjs > unblocking confirmed rental returns 409 and keeps block 15ms
 ✓ tests/worker.test.mjs > past pending permits soft delete with R2, photo and block cleanup 31ms
 ✓ tests/worker.test.mjs > 2099-06-15 pending blocks deletion without mutation 25ms
 ✓ tests/worker.test.mjs > today pending blocks deletion without mutation 16ms
 ✓ tests/worker.test.mjs > past confirmed permits soft delete with R2, photo and block cleanup 25ms
 ✓ tests/worker.test.mjs > 2099-06-15 confirmed blocks deletion without mutation 18ms
 ✓ tests/worker.test.mjs > today confirmed blocks deletion without mutation 16ms
 ✓ tests/worker.test.mjs > photo upload rejects wrong PNG magic and stores no photo or R2 object 12ms
 ✓ tests/worker.test.mjs > photo upload rejects more than five photos and stores no photo or R2 object 11ms
 ✓ tests/worker.test.mjs > photo upload rejects over 1 MB and stores no photo or R2 object 102ms
 ✓ tests/worker.test.mjs > valid tiny PNG is accepted; replacement deletes orphaned R2 object 24ms
 ✓ tests/worker.test.mjs > scheduled retention anonymizes old bookings and deletes old messages and stale IP buckets 13ms
 ✓ tests/worker.test.mjs > outbound networking is disabled for unmocked hosts 9ms
 ✓ tests/worker.test.mjs > racing decisions on one pending request queue only the winning email 15ms

 Test Files  2 passed (2)
      Tests  84 passed (84)
   Start at  16:35:10
   Duration  2.41s (transform 63ms, setup 177ms, collect 75ms, tests 1.62s, environment 1ms, prepare 371ms)

[vpw:debug] Shutting down runtimes...
```

## Full passing smoke-test output

Server: `npx wrangler dev --local --ip 127.0.0.1 --port 8787 --inspector-port 0`

Client: `API_BASE_URL=http://127.0.0.1:8787 npm run test:smoke`

```text

> test:smoke
> node test-api.mjs

API smoke test passed: three GET routes against http://127.0.0.1:8787.
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
```
