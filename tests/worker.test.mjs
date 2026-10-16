import { test, expect } from "vitest";
import {
  env,
  fetchMock,
  createExecutionContext,
  waitOnExecutionContext,
  createScheduledController,
} from "cloudflare:test";
import worker from "../worker/index.js";
import { settingsError, nyToday } from "../worker/validation.js";
import { calculateQuote } from "../worker/distance.js";
import { accessToken, providers } from "./setup.mjs";
import {
  request,
  admin,
  bookingInput,
  createBooking,
  decide,
  rows,
  seedBooking,
  scheduled,
  state,
  fakeAddress,
  futureDate,
} from "./helpers.mjs";

const settingsInput = (rate = 0.35) => ({
  free_radius_miles: 15,
  per_mile_rate: rate,
  trip_multiplier: 4,
  max_delivery_miles: null,
});
const quoteRequest = () =>
  request("/api/delivery-quote", { method: "POST", data: { address: fakeAddress } });
const mails = () => rows("notification_outbox");
const requests = () => rows("booking_requests");
const unitInput = (photos = []) => ({
  name: "Test Unit",
  description: "Fake inventory",
  size: "10 x 10",
  mode: "dry",
  price: 200,
  deposit_required: false,
  photos,
});
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=";

for (const [distance, fee, status] of [
  [15, 0, "free"],
  [16, 22.4, "fee"],
  [20, 28, "fee"],
  [15.1, 21.14, "fee"],
]) {
  test(`fee route at ${distance} miles returns ${fee}`, async () => {
    providers.miles = distance;
    const result = await quoteRequest();
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ distance_miles: distance, fee, status });
    expect(calculateQuote(distance, settingsInput())).toEqual(result.body);
    expect(await rows("quote_cache")).toHaveLength(1);
    expect((await rows("quote_cache"))[0].distance_miles).toBeCloseTo(distance, 10);
    expect(await requests()).toHaveLength(0);
  });
}
test("maximum distance takes precedence even inside free radius", async () => {
  await env.DB.prepare("UPDATE settings SET max_delivery_miles=10 WHERE id=1").run();
  providers.miles = 15;
  const result = await quoteRequest();
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ distance_miles: 15, fee: 0, status: "outside_area" });
  expect((await rows("quote_cache"))[0].distance_miles).toBe(15);
  expect((await rows("settings"))[0].max_delivery_miles).toBe(10);
});
for (const rate of [0.29, 0.07, 0.57, 0.58, 0.55]) {
  test(`settings accepts ${rate} and stores integer cents`, async () => {
    const result = await admin("/api/admin/settings", { method: "PUT", data: settingsInput(rate) });
    expect(result.status).toBe(200);
    expect(result.body.per_mile_rate).toBe(rate);
    expect((await rows("settings"))[0].per_mile_rate_cents).toBe(Math.round(rate * 100));
  });
}
for (const rate of [0.355, -1, NaN, "0.35"]) {
  test(`settings rejects invalid ${String(rate)} without mutation`, async () => {
    expect(settingsError(settingsInput(rate))).toBeTruthy();
    const before = await state();
    const result = await admin("/api/admin/settings", { method: "PUT", data: settingsInput(rate) });
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Enter valid delivery settings.");
    expect(await state()).toEqual(before);
  });
}
test("Google quote uses secret binding, caches response, and never exposes origin", async () => {
  // An alternate fake binding distinguishes origin from the fake destination.
  const bindings = { ...env, ORIGIN_ADDRESS: "200 Example St, Anytown, KY" };
  const first = await request("/api/delivery-quote", {
    method: "POST",
    data: { address: fakeAddress },
    bindings,
  });
  const second = await request("/api/delivery-quote", {
    method: "POST",
    data: { address: fakeAddress },
    bindings,
  });
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect(providers.googleCalls).toEqual([
    {
      origin: { address: bindings.ORIGIN_ADDRESS },
      destination: { address: fakeAddress },
      travelMode: "DRIVE",
    },
  ]);
  for (const result of [first, second]) {
    expect(result.text).not.toContain(bindings.ORIGIN_ADDRESS);
    expect(JSON.stringify([...result.headers])).not.toContain(bindings.ORIGIN_ADDRESS);
  }
  expect(await rows("quote_cache")).toHaveLength(1);
  expect(JSON.stringify(await rows("quote_cache"))).not.toContain(bindings.ORIGIN_ADDRESS);
  expect((await rows("rate_limits"))[0].count).toBe(2);
});
test("unresolvable address returns 422 and no cache entry", async () => {
  providers.miles = null;
  const result = await quoteRequest();
  expect(result.status).toBe(422);
  expect(result.body.error).toMatch(/could not find/);
  expect(result.body).not.toHaveProperty("distance_miles");
  expect(await rows("quote_cache")).toHaveLength(0);
});
test("Google 500 returns 503 without guessed distance or cache entry", async () => {
  providers.googleStatus = 500;
  const result = await quoteRequest();
  expect(result.status).toBe(503);
  expect(result.body.error).toMatch(/could not calculate/);
  expect(result.body).not.toHaveProperty("distance_miles");
  expect(await rows("quote_cache")).toHaveLength(0);
});
test("booking happy path recomputes total and queues two distinct emails", async () => {
  const result = await createBooking({
    total: 1,
    delivery_fee: 0,
    delivery_quote: { fee: 0 },
    total_cents: 1,
  });
  expect(result.status).toBe(201);
  expect(result.body).toMatchObject({
    status: "pending",
    total: 222.4,
    unit_price: 200,
    delivery_quote: { fee: 22.4 },
  });
  expect(await requests()).toEqual([
    expect.objectContaining({
      id: result.body.id,
      status: "pending",
      total_cents: 22240,
      delivery_fee_cents: 2240,
    }),
  ]);
  expect((await mails()).map((m) => m.kind).sort()).toEqual(["new_request", "request_received"]);
  expect(providers.emails).toHaveLength(2);
  for (const m of await mails()) expect(m.subject).not.toContain(fakeAddress);
  expect((await rows("rate_limits"))[0].count).toBe(1);
});
for (const [name, extra, code] of [
  ["past date", { date: "2000-01-01" }, 400],
  ["missing Turnstile", { turnstile_token: "" }, 400],
  ["failed Turnstile", { turnstile_token: "failed-token" }, 400],
  ["replayed Turnstile", { turnstile_token: "used-token" }, 400],
  ["Turnstile from another hostname", { turnstile_token: "wrong-host-token" }, 400],
  ["Turnstile issued for another action", { turnstile_token: "fake-contact-token" }, 400],
  ["honeypot", { website: "fake-bot" }, 400],
]) {
  test(`booking rejects ${name} and creates no booking or email`, async () => {
    const result = await createBooking(extra);
    expect(result.status).toBe(code);
    expect(result.body.error).toBeTruthy();
    expect(await requests()).toHaveLength(0);
    expect(await mails()).toHaveLength(0);
    expect(providers.emails).toHaveLength(0);
    expect((await rows("rate_limits"))[0].count).toBe(1);
  });
}
for (const conflict of ["manual block", "confirmed date"]) {
  test(`booking rejects ${conflict} without adding a request or email`, async () => {
    if (conflict === "manual block")
      await env.DB.prepare("INSERT INTO blocks(unit_id,date) VALUES(?,?)")
        .bind("test-unit", futureDate)
        .run();
    else await seedBooking({ status: "confirmed" });
    const before = await requests();
    const result = await createBooking();
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/no longer available/);
    expect(await requests()).toEqual(before);
    expect(await mails()).toHaveLength(0);
    expect(providers.googleCalls).toHaveLength(0);
  });
}
test("booking rejects outside area and retains only quote cache", async () => {
  await env.DB.prepare("UPDATE settings SET max_delivery_miles=25 WHERE id=1").run();
  providers.miles = 26;
  const result = await createBooking();
  expect(result.status).toBe(422);
  expect(result.body.error).toMatch(/outside the delivery area/);
  expect(await requests()).toHaveLength(0);
  expect(await mails()).toHaveLength(0);
  expect((await rows("quote_cache"))[0].distance_miles).toBe(26);
});
test("eleventh booking in an hour from the same IP is rejected", async () => {
  for (let i = 0; i < 10; i++) expect((await createBooking()).status).toBe(201);
  const result = await createBooking();
  expect(result.status).toBe(429);
  expect(result.body.error).toMatch(/Too many booking/);
  expect(await requests()).toHaveLength(10);
  expect(await mails()).toHaveLength(20);
  expect((await rows("rate_limits"))[0].count).toBe(11);
  expect((await rows("rate_limits"))[0].bucket).not.toContain("192.0.2.1");
});
test("idempotent replay returns same row without duplicate email", async () => {
  const input = bookingInput();
  const first = await request("/api/booking-requests", { method: "POST", data: input });
  const second = await request("/api/booking-requests", { method: "POST", data: input });
  expect(first.status).toBe(201);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect(await requests()).toHaveLength(1);
  expect(await mails()).toHaveLength(2);
  expect(providers.emails).toHaveLength(2);
});
test("idempotency key with another email returns 409 without mutation", async () => {
  const input = bookingInput();
  expect((await request("/api/booking-requests", { method: "POST", data: input })).status).toBe(
    201,
  );
  const before = await requests();
  const result = await request("/api/booking-requests", {
    method: "POST",
    data: { ...input, email: "other@example.test" },
  });
  expect(result.status).toBe(409);
  expect(result.body.error).toMatch(/key is already in use/);
  expect(await requests()).toEqual(before);
  expect(await mails()).toHaveLength(2);
});
test("normal confirmation queues exactly one confirmation email", async () => {
  const r = await seedBooking();
  const result = await decide(r.id);
  expect(result.status).toBe(200);
  expect(result.body.status).toBe("confirmed");
  expect(await requests()).toEqual([
    expect.objectContaining({ id: r.id, status: "confirmed", decision_token: expect.any(String) }),
  ]);
  expect(await mails()).toEqual([
    expect.objectContaining({ kind: "confirmed", subject: "Booking confirmed" }),
  ]);
});
test("manual-block confirmation regression returns 409 and leaves no retryable email", async () => {
  const r = await seedBooking();
  await env.DB.prepare("INSERT INTO blocks(unit_id,date) VALUES(?,?)")
    .bind(r.unit_id, r.event_date)
    .run();
  const before = await requests();
  const result = await decide(r.id);
  expect(result.status).toBe(409);
  expect(result.body.error).toMatch(/calendar conflict/);
  expect(await requests()).toEqual(before);
  expect(await mails()).toHaveLength(0);
  await scheduled();
  expect(await mails()).toHaveLength(0);
  expect(providers.emails).toHaveLength(0);
});
test("racing confirmations yield one 200, one 409 and one email with losing batch rolled back", async () => {
  const a = await seedBooking();
  const b = await seedBooking();
  const results = await Promise.all([decide(a.id), decide(b.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const saved = await requests();
  expect(saved.filter((r) => r.status === "confirmed")).toHaveLength(1);
  expect(saved.filter((r) => r.status === "pending")).toEqual([
    expect.objectContaining({ decision_token: null, decided_at: null, decided_by: null }),
  ]);
  expect(await mails()).toEqual([expect.objectContaining({ kind: "confirmed" })]);
  expect(providers.emails).toHaveLength(1);
});
test("unique-violation decision rolls back token, status and outbox insert", async () => {
  await seedBooking({ status: "confirmed" });
  const pending = await seedBooking();
  const before = await requests();
  const result = await decide(pending.id);
  expect(result.status).toBe(409);
  expect(result.body.error).toMatch(/calendar conflict/);
  expect(await requests()).toEqual(before);
  expect(await mails()).toHaveLength(0);
  expect(providers.emails).toHaveLength(0);
});
for (const status of ["confirmed", "declined"]) {
  test(`repeating ${status} on decided request returns 409 without another email`, async () => {
    const r = await seedBooking();
    expect((await decide(r.id, status)).status).toBe(200);
    const before = await requests();
    const again = await decide(r.id, status);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/no longer pending/);
    expect(await requests()).toEqual(before);
    expect(await mails()).toEqual([expect.objectContaining({ kind: status })]);
  });
}
test("decline queues only decline email", async () => {
  const r = await seedBooking();
  const result = await decide(r.id, "declined");
  expect(result.status).toBe(200);
  expect(result.body.status).toBe("declined");
  expect((await requests())[0].status).toBe("declined");
  expect(await mails()).toEqual([
    expect.objectContaining({ kind: "declined", subject: "Booking request update" }),
  ]);
});

const adminRoutes = [
  ["/api/admin/settings", "PUT"],
  ["/api/admin/booking-requests", "GET"],
  ["/api/admin/booking-requests/test-request/status", "POST"],
  ["/api/admin/units", "POST"],
  ["/api/admin/units/test-unit", "PUT"],
  ["/api/admin/units/test-unit", "DELETE"],
  [`/api/admin/units/test-unit/blocked-dates/${futureDate}`, "PUT"],
  [`/api/admin/units/test-unit/blocked-dates/${futureDate}`, "DELETE"],
];
for (const [path, method] of adminRoutes) {
  test(`Access denies no token: ${method} ${path}`, async () => {
    const before = await state();
    const result = await request(path, { method, ...(method !== "GET" ? { data: {} } : {}) });
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("Authentication required.");
    expect(await state()).toEqual(before);
  });
}
for (const kind of [
  "expired",
  "wrong issuer",
  "wrong audience",
  "tampered signature",
  "alg none",
  "unknown kid",
  "missing expiry",
  "future not-before",
]) {
  test(`Access rejects ${kind} with 401 and unchanged database`, async () => {
    const claims =
      kind === "expired"
        ? { exp: 1 }
        : kind === "missing expiry"
          ? { exp: undefined }
          : kind === "future not-before"
            ? { nbf: Math.floor(Date.now() / 1000) + 3600 }
            : kind === "wrong issuer"
              ? { iss: "https://wrong.example.test" }
              : kind === "wrong audience"
                ? { aud: ["wrong-audience"] }
                : {};
    const header =
      kind === "alg none" ? { alg: "none" } : kind === "unknown kid" ? { kid: "unknown-key" } : {};
    let token = await accessToken(claims, header);
    if (kind === "tampered signature") {
      const parts = token.split(".");
      parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
      token = parts.join(".");
    }
    const before = await state();
    const result = await request("/api/admin/booking-requests", { token });
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("Authentication required.");
    expect(await state()).toEqual(before);
  });
}
test("valid disallowed email returns 403", async () => {
  const before = await state();
  const result = await request("/api/admin/booking-requests", {
    token: await accessToken({ email: "outsider@example.test" }),
  });
  expect(result.status).toBe(403);
  expect(result.body.error).toBe("Access denied.");
  expect(await state()).toEqual(before);
});
test("valid allowed Access token returns stored requests", async () => {
  const r = await seedBooking();
  const before = await state();
  const result = await admin("/api/admin/booking-requests");
  expect(result.status).toBe(200);
  expect(result.body).toEqual([expect.objectContaining({ id: r.id })]);
  expect(await state()).toEqual(before);
});
for (const [kind, headers, code] of [
  ["mismatched Origin", { origin: "https://other.example.test" }, 403],
  ["wrong content type", { "content-type": "text/plain" }, 415],
]) {
  test(`admin write rejects ${kind}`, async () => {
    const before = await state();
    const result = await admin("/api/admin/settings", {
      method: "PUT",
      data: settingsInput(),
      headers,
    });
    expect(result.status).toBe(code);
    expect(result.body.error).toBeTruthy();
    expect(await state()).toEqual(before);
  });
}
test("admin API base path requires Access", async () => {
  const result = await request("/api/admin");
  expect(result.status).toBe(401);
  expect(result.body.error).toBe("Authentication required.");
});
test("Turnstile fails closed without a configured secret", async () => {
  const result = await request("/api/booking-requests", {
    method: "POST",
    data: bookingInput(),
    bindings: { ...env, TURNSTILE_SECRET: "" },
  });
  expect(result.status).toBe(400);
  expect(await rows("booking_requests")).toEqual([]);
  expect(await rows("notification_outbox")).toEqual([]);
});
test("contact accepts a contact-action Turnstile token and rejects a booking one", async () => {
  const message = { name: "Test Customer", email: "customer@example.test", message: "Hello" };
  const wrong = await request("/api/contact", {
    method: "POST",
    data: { ...message, turnstile_token: "fake-valid-token" },
  });
  expect(wrong.status).toBe(400);
  const ok = await request("/api/contact", {
    method: "POST",
    data: { ...message, turnstile_token: "fake-contact-token" },
  });
  expect(ok.status).toBeLessThan(300);
  expect(await rows("contact_messages")).toHaveLength(1);
});
test("contact rejects a filled honeypot and stores nothing, and accepts the empty one the page sends", async () => {
  const message = {
    name: "Test Customer",
    email: "customer@example.test",
    message: "Hello",
    turnstile_token: "fake-contact-token",
  };
  const bot = await request("/api/contact", {
    method: "POST",
    data: { ...message, website: "fake-bot" },
  });
  expect(bot.status).toBe(400);
  expect(await rows("contact_messages")).toEqual([]);
  expect(await rows("notification_outbox")).toEqual([]);
  expect(providers.emails).toHaveLength(0);
  const human = await request("/api/contact", {
    method: "POST",
    data: { ...message, website: "" },
  });
  expect(human.status).toBe(201);
  expect(await rows("contact_messages")).toHaveLength(1);
});
test("booking accepts the empty honeypot value the page always sends", async () => {
  const result = await createBooking({ website: "" });
  expect(result.status).toBe(201);
  expect(await requests()).toHaveLength(1);
});
test("outbox rows stay pending with no attempts used while email is unconfigured", async () => {
  const unconfigured = { ...env, RESEND_API_KEY: "" };
  const result = await request("/api/booking-requests", {
    method: "POST",
    data: bookingInput(),
    bindings: unconfigured,
  });
  expect(result.status).toBe(201);
  const ctx = createExecutionContext();
  await worker.scheduled(createScheduledController(), unconfigured, ctx);
  await waitOnExecutionContext(ctx);
  const outbox = await rows("notification_outbox");
  expect(outbox.length).toBeGreaterThan(0);
  for (const m of outbox) expect(m).toMatchObject({ status: "pending", attempts: 0 });
  expect(providers.emails).toHaveLength(0);
});
test("DEV_ADMIN_EMAIL never bypasses Access on non-localhost", async () => {
  const before = await state();
  const result = await request("/api/admin/booking-requests", {
    host: "https://non-local.example.test",
    bindings: { ...env, DEV_ADMIN_EMAIL: "admin@example.test" },
  });
  expect(result.status).toBe(401);
  expect(result.body.error).toBe("Authentication required.");
  expect(await state()).toEqual(before);
});

test("Resend failure preserves 201 booking; scheduled retry sends failed rows", async () => {
  providers.resendStatus = 500;
  const result = await createBooking();
  expect(result.status).toBe(201);
  expect(result.body.status).toBe("pending");
  expect(await requests()).toHaveLength(1);
  expect(await mails()).toEqual([
    expect.objectContaining({ status: "failed", attempts: 1 }),
    expect.objectContaining({ status: "failed", attempts: 1 }),
  ]);
  providers.resendStatus = 200;
  await scheduled();
  expect(await mails()).toEqual([
    expect.objectContaining({ status: "sent", attempts: 2, last_error: null }),
    expect.objectContaining({ status: "sent", attempts: 2, last_error: null }),
  ]);
  expect(providers.emails).toHaveLength(4);
});
test("outbox stops retrying after five attempts", async () => {
  providers.resendStatus = 500;
  const result = await createBooking();
  expect(result.status).toBe(201);
  for (let i = 0; i < 4; i++) await scheduled();
  expect(await mails()).toEqual([
    expect.objectContaining({ status: "failed", attempts: 5 }),
    expect.objectContaining({ status: "failed", attempts: 5 }),
  ]);
  const before = await mails();
  providers.resendStatus = 200;
  await scheduled();
  expect(await mails()).toEqual(before);
  expect(providers.emails).toHaveLength(10);
  expect((await requests())[0].status).toBe("pending");
});
test("unblocking confirmed rental returns 409 and keeps block", async () => {
  await seedBooking({ status: "confirmed" });
  await env.DB.prepare("INSERT INTO blocks(unit_id,date) VALUES(?,?)")
    .bind("test-unit", futureDate)
    .run();
  const before = await state();
  const result = await admin(`/api/admin/units/test-unit/blocked-dates/${futureDate}`, {
    method: "DELETE",
    data: {},
  });
  expect(result.status).toBe(409);
  expect(result.body.error).toMatch(/cannot be unblocked/);
  expect(await state()).toEqual(before);
});
for (const status of ["pending", "confirmed"]) {
  test(`past ${status} permits soft delete with R2, photo and block cleanup`, async () => {
    const r = await seedBooking({ status, event_date: "2020-01-01" });
    const saved = await admin("/api/admin/units/test-unit", {
      method: "PUT",
      data: unitInput([photo]),
    });
    expect(saved.status).toBe(200);
    const key = saved.body.photos[0].slice(7);
    expect(await env.PHOTOS.head(key)).not.toBeNull();
    await env.DB.prepare("INSERT INTO blocks(unit_id,date) VALUES(?,?)")
      .bind("test-unit", futureDate)
      .run();
    const before = await requests();
    const result = await admin("/api/admin/units/test-unit", { method: "DELETE", data: {} });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ deleted: true });
    expect((await rows("units"))[0].deleted_at).toBeTruthy();
    expect(await requests()).toEqual(before);
    expect((await requests())[0]).toMatchObject({
      id: r.id,
      unit_name: "Test Inflatable",
      unit_price_cents: 20000,
    });
    expect(await rows("blocks")).toHaveLength(0);
    expect(await rows("unit_photos")).toHaveLength(0);
    expect(await env.PHOTOS.head(key)).toBeNull();
    expect((await request("/api/units")).body).toEqual([]);
  });
  for (const date of [futureDate, "today"]) {
    test(`${date} ${status} blocks deletion without mutation`, async () => {
      await seedBooking({ status, event_date: date === "today" ? nyToday() : date });
      const before = await state();
      const result = await admin("/api/admin/units/test-unit", { method: "DELETE", data: {} });
      expect(result.status).toBe(409);
      expect(result.body.error).toBe(
        "This inflatable has pending or confirmed requests. Keep it until those requests are resolved.",
      );
      expect(await state()).toEqual(before);
    });
  }
}
for (const [kind, photos, error] of [
  ["wrong PNG magic", ["data:image/png;base64,bm90IGFuIGltYWdl"], /PNG, JPEG, or WebP/],
  ["more than five photos", Array(6).fill(photo), /no more than 5/],
  ["over 1 MB", ["data:image/png;base64," + btoa("x".repeat(1048577))], /1 MB or smaller/],
]) {
  test(`photo upload rejects ${kind} and stores no photo or R2 object`, async () => {
    const result = await admin("/api/admin/units", { method: "POST", data: unitInput(photos) });
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(error);
    expect(await rows("units")).toHaveLength(1);
    expect(await rows("unit_photos")).toHaveLength(0);
    expect((await env.PHOTOS.list()).objects).toHaveLength(0);
  });
}
test("valid tiny PNG is accepted; replacement deletes orphaned R2 object", async () => {
  const first = await admin("/api/admin/units/test-unit", {
    method: "PUT",
    data: unitInput([photo]),
  });
  expect(first.status).toBe(200);
  expect(first.body.photos).toHaveLength(1);
  const oldKey = first.body.photos[0].slice(7);
  expect((await rows("unit_photos"))[0].r2_key).toBe(oldKey);
  const oldObject = await env.PHOTOS.get(oldKey);
  expect(oldObject.httpMetadata.contentType).toBe("image/png");
  expect(new Uint8Array(await oldObject.arrayBuffer()).slice(0, 4)).toEqual(
    new Uint8Array([137, 80, 78, 71]),
  );
  const second = await admin("/api/admin/units/test-unit", {
    method: "PUT",
    data: unitInput([photo]),
  });
  expect(second.status).toBe(200);
  const newKey = second.body.photos[0].slice(7);
  expect(newKey).not.toBe(oldKey);
  expect(await env.PHOTOS.head(oldKey)).toBeNull();
  expect(await env.PHOTOS.head(newKey)).not.toBeNull();
  expect(await rows("unit_photos")).toEqual([expect.objectContaining({ r2_key: newKey })]);
  expect((await env.PHOTOS.list()).objects).toHaveLength(1);
});
test("empty photo list removes all photos and their R2 objects", async () => {
  const first = await admin("/api/admin/units/test-unit", {
    method: "PUT",
    data: unitInput([photo]),
  });
  const key = first.body.photos[0].slice(7);
  expect(await env.PHOTOS.head(key)).not.toBeNull();
  const placeholder = await admin("/api/admin/units/test-unit", {
    method: "PUT",
    data: unitInput(["placeholder.svg"]),
  });
  expect(placeholder.status).toBe(400);
  expect(await env.PHOTOS.head(key)).not.toBeNull();
  const cleared = await admin("/api/admin/units/test-unit", {
    method: "PUT",
    data: unitInput([]),
  });
  expect(cleared.status).toBe(200);
  expect(cleared.body.photos).toEqual([]);
  expect(await rows("unit_photos")).toHaveLength(0);
  expect((await env.PHOTOS.list()).objects).toHaveLength(0);
});
test("scheduled retention anonymizes old bookings and deletes old messages and stale IP buckets", async () => {
  const old = await seedBooking({ event_date: "2000-01-01" });
  const recent = await seedBooking();
  await env.DB.prepare(
    "INSERT INTO contact_messages(id,name,email,message,created_at) VALUES('old','Test Customer','customer@example.test','Fake message','2000-01-01'),('recent','Test Customer','customer@example.test','Fake message',datetime('now'))",
  ).run();
  await env.DB.prepare(
    "INSERT INTO rate_limits(bucket,window_start,count) VALUES('old','2000-01-01',1),('recent',datetime('now'),1)",
  ).run();
  const result = await admin("/api/admin/booking-requests");
  expect(result.status).toBe(200);
  expect(result.body).toHaveLength(2);
  await scheduled();
  const saved = await requests();
  expect(saved.find((r) => r.id === old.id)).toMatchObject({
    name: null,
    phone: null,
    email: null,
    delivery_address: null,
    anonymized_at: expect.any(String),
    unit_name: "Test Inflatable",
    unit_price_cents: 20000,
  });
  expect(saved.find((r) => r.id === recent.id)).toMatchObject({
    name: "Test Customer",
    email: "customer@example.test",
    anonymized_at: null,
  });
  expect(await rows("contact_messages")).toEqual([expect.objectContaining({ id: "recent" })]);
  expect(await rows("rate_limits")).toEqual([expect.objectContaining({ bucket: "recent" })]);
});
test("outbound networking is disabled for unmocked hosts", async () => {
  await expect(fetch("https://unmocked.example.test/")).rejects.toThrow();
  expect(await requests()).toHaveLength(0);
  expect(await mails()).toHaveLength(0);
});

test("racing decisions on one pending request queue only the winning email", async () => {
  const r = await seedBooking();
  const results = await Promise.all([decide(r.id, "confirmed"), decide(r.id, "declined")]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  const saved = (await requests())[0];
  expect(["confirmed", "declined"]).toContain(saved.status);
  expect(saved.decision_token).toEqual(expect.any(String));
  expect(await mails()).toEqual([expect.objectContaining({ kind: saved.status })]);
  expect(providers.emails).toHaveLength(1);
});
