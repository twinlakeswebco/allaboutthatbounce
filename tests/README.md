# Worker test runtime

The Worker suite uses Vitest 3 and `@cloudflare/vitest-pool-workers` 0.12.21, the last release in the series that retains `fetchMock`, `defineWorkersConfig` and per-test isolated storage.

Its workerd supports compatibility dates through **2026-03-10**. This is newer than the former 2025-09-06 runtime, but the production configuration remains **2026-10-14** and the tests still fall back. Do not describe this upgrade as full production compatibility-date coverage or lower the production date to hide the warning.

The later Vitest 4 integration removes `fetchMock` and changes the configuration and storage-isolation model. Moving to the current `@cloudflare/vitest-plugin` therefore requires a separate test-harness migration, including replacement outbound mocks and explicit isolation checks.

- [Cloudflare's Vitest migration guidance](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-vitest-3-to-vitest-4/)
- [Migration to the renamed plugin](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/)

Run `npm ci`, `npm run format:check` and `npm test`. Numbered migrations are applied only to isolated local Miniflare storage. Seeds are excluded, fake secret values override production bindings, and unmocked outbound Worker networking is disabled. The upgrade passed all 94 Worker tests and 13 frontend/email tests on the main baseline; the separate email sender PR adds two more frontend/email regressions.

The dependency audit still reports advisories; this compatibility upgrade is not a complete dependency-security remediation. Keep any broader dependency/harness migration separately reviewed.
