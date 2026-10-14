import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import { mkdtemp, readdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// The helper reads every SQL file, so expose only numbered migrations to it.
const directory = await mkdtemp(join(tmpdir(), "bounce-migrations-"));
let migrations;
try {
  for (const name of await readdir("migrations")) {
    if (/^\d+_.*\.sql$/.test(name)) {
      await symlink(resolve("migrations", name), join(directory, name));
    }
  }
  migrations = await readD1Migrations(directory);
} finally {
  await rm(directory, { recursive: true, force: true });
}

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    setupFiles: ["./tests/setup.mjs"],
    testTimeout: 15000,
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            OWNER_EMAIL: "owner@example.test",
            FROM_EMAIL: "Test Sender <sender@example.test>",
            SITE_ORIGIN: "https://example.test",
            ACCESS_TEAM_DOMAIN: "test-team.cloudflareaccess.com",
            ACCESS_AUD: "fake-test-audience",
            ADMIN_EMAILS: "admin@example.test",
            TURNSTILE_SITE_KEY: "fake-site-key",
            TURNSTILE_SECRET: "fake-turnstile-secret",
            GOOGLE_MAPS_API_KEY: "fake-google-key",
            RESEND_API_KEY: "fake-resend-key",
            IP_HASH_SECRET: "fake-ip-hash-secret",
            ORIGIN_ADDRESS: "100 Example St, Anytown, KY",
            DEV_ADMIN_EMAIL: "admin@example.test",
          },
        },
      },
    },
  },
});
