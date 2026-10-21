import { beforeAll, beforeEach, afterAll, afterEach, expect } from "vitest";
import { env, applyD1Migrations, fetchMock } from "cloudflare:test";

export const providers = {
  miles: 16,
  googleStatus: 200,
  googleCalls: [],
  resendStatus: 200,
  emails: [],
};
let privateKey;
const encoder = new TextEncoder();
const encode = (value) =>
  btoa(String.fromCharCode(...value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const encodeJson = (value) => encode(encoder.encode(JSON.stringify(value)));

export async function accessToken(claims = {}, header = {}) {
  const h = encodeJson({ alg: "RS256", kid: "test-key", ...header });
  const p = encodeJson({
    iss: `https://${env.ACCESS_TEAM_DOMAIN}`,
    aud: [env.ACCESS_AUD],
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: "admin@example.test",
    ...claims,
  });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(`${h}.${p}`),
  );
  return `${h}.${p}.${encode(new Uint8Array(signature))}`;
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  expect(env.TEST_MIGRATIONS.map((m) => m.name)).toEqual([
    "0001_init.sql",
    "0002_decision_token.sql",
    "0003_shared_inventory.sql",
  ]);
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM units").first()).n).toBe(0);
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  privateKey = pair.privateKey;
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock
    .get(`https://${env.ACCESS_TEAM_DOMAIN}`)
    .intercept({ path: "/cdn-cgi/access/certs" })
    .reply(200, { keys: [jwk] })
    .persist();
  fetchMock
    .get("https://challenges.cloudflare.com")
    .intercept({ path: "/turnstile/v0/siteverify", method: "POST" })
    .reply((request) => {
      const body = String(request.body);
      const replay = body.includes("used-token");
      return {
        statusCode: 200,
        data: JSON.stringify({
          success: !body.includes("failed-token") && !replay,
          ...(replay ? { "error-codes": ["timeout-or-duplicate"] } : {}),
          hostname: body.includes("wrong-host-token")
            ? "other.example"
            : new URL(env.SITE_ORIGIN).hostname,
          action: body.includes("contact-token") ? "contact" : "booking",
        }),
      };
    })
    .persist();
  fetchMock
    .get("https://api.resend.com")
    .intercept({ path: "/emails", method: "POST" })
    .reply((request) => {
      providers.emails.push(JSON.parse(request.body));
      return {
        statusCode: providers.resendStatus,
        data: JSON.stringify({ id: "fake-message-id" }),
      };
    })
    .persist();
  fetchMock
    .get("https://routes.googleapis.com")
    .intercept({ path: "/directions/v2:computeRoutes", method: "POST" })
    .reply((request) => {
      providers.googleCalls.push(JSON.parse(request.body));
      return {
        statusCode: providers.googleStatus,
        data: JSON.stringify({
          routes: providers.miles === null ? [] : [{ distanceMeters: providers.miles * 1609.344 }],
        }),
      };
    })
    .persist();
});

beforeEach(async () => {
  providers.miles = 16;
  providers.googleStatus = 200;
  providers.googleCalls = [];
  providers.resendStatus = 200;
  providers.emails = [];
  await env.DB.prepare(
    "INSERT INTO units(id,name,description,size,mode,price_cents) VALUES('test-unit','Test Inflatable','Fake test inventory','10 x 10','dry',20000)",
  ).run();
});
afterEach(() => {
  expect(fetchMock.pendingInterceptors().filter((interceptor) => !interceptor.persist)).toEqual([]);
});
afterAll(() => fetchMock.deactivate());
