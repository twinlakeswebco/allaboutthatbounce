import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  createScheduledController,
} from "cloudflare:test";
import worker from "../worker/index.js";
import { accessToken } from "./setup.mjs";

export const fakeAddress = "100 Example St, Anytown, KY";
export const futureDate = "2099-06-15";
export const bookingInput = (extra = {}) => ({
  unit_id: "test-unit",
  date: futureDate,
  name: "Test Customer",
  phone: "2025550100",
  email: "customer@example.test",
  event_type: "Test party",
  delivery_address: fakeAddress,
  idempotency_key: crypto.randomUUID(),
  turnstile_token: "fake-valid-token",
  ...extra,
});
export async function request(
  path,
  { method = "GET", data, token, headers = {}, bindings = env, host = env.SITE_ORIGIN } = {},
) {
  const ctx = createExecutionContext();
  const req = new Request(host + path, {
    method,
    headers: {
      "CF-Connecting-IP": "192.0.2.1",
      ...(method !== "GET" ? { "content-type": "application/json", origin: env.SITE_ORIGIN } : {}),
      ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
      ...headers,
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const response = await worker.fetch(req, bindings, ctx);
  await waitOnExecutionContext(ctx);
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), text, headers: response.headers };
}
export async function admin(path, options = {}) {
  return request(path, { token: await accessToken(), ...options });
}
export const createBooking = (extra = {}) =>
  request("/api/booking-requests", { method: "POST", data: bookingInput(extra) });
export const decide = (id, status = "confirmed") =>
  admin(`/api/admin/booking-requests/${id}/status`, { method: "POST", data: { status } });
export const rows = async (table) =>
  (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
export async function seedBooking(extra = {}) {
  const r = {
    id: crypto.randomUUID(),
    unit_id: "test-unit",
    event_date: futureDate,
    status: "pending",
    ...extra,
  };
  await env.DB.prepare(
    "INSERT INTO booking_requests(id,idempotency_key,unit_id,unit_name,unit_price_cents,event_date,status,name,phone,email,event_type,delivery_address,distance_miles,delivery_fee_cents,total_cents) VALUES(?,?,?,'Test Inflatable',20000,?,?, 'Test Customer','2025550100','customer@example.test','Test party',?,16,2240,22240)",
  )
    .bind(r.id, crypto.randomUUID(), r.unit_id, r.event_date, r.status, fakeAddress)
    .run();
  return r;
}
export async function scheduled() {
  const ctx = createExecutionContext();
  await worker.scheduled(createScheduledController(), env, ctx);
  await waitOnExecutionContext(ctx);
}
export async function state() {
  const tables = [
    "units",
    "unit_photos",
    "blocks",
    "booking_requests",
    "notification_outbox",
    "settings",
    "contact_messages",
    "rate_limits",
    "quote_cache",
  ];
  return Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await rows(t)])));
}
