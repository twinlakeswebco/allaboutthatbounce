import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "navigator", {
  value: {},
  configurable: true,
});
let value = null;
globalThis.localStorage = {
  getItem: () => value,
  setItem: (_, v) => (value = v),
};
globalThis.crypto ??= webcrypto;
const api = await import(
  "data:text/javascript;base64," +
    Buffer.from(await readFile("public/api.js", "utf8")).toString("base64")
);
assert.equal((await api.getDeliveryQuote("demo 15 miles")).fee, 0);
assert.equal((await api.getDeliveryQuote("demo 16 miles")).fee, 22.4);
assert.equal((await api.getDeliveryQuote("demo 20 miles")).fee, 28);
await api.updateSettings({ ...api.defaultSettings, max_delivery_miles: 20 });
assert.equal(
  (await api.getDeliveryQuote("demo 21 miles")).status,
  "outside_area",
);
await api.updateSettings(api.defaultSettings);
const input = {
  unit_id: "rainbow",
  date: "2099-06-01",
  name: "Demo",
  phone: "5025550100",
  email: "demo@example.com",
  event_type: "Other",
  delivery_address: "demo 16 miles",
  idempotency_key: "demo-request",
};
const r = await api.createBookingRequest(input);
assert.equal(r.total, 197.4);
assert.equal(r.status, "pending");
assert.deepEqual(await api.getBlockedDates("rainbow"), []);
assert.equal((await api.createBookingRequest(input)).id, r.id);
const competing = await api.createBookingRequest({
  ...input,
  idempotency_key: "second",
});
await api.setBookingStatus(r.id, "confirmed");
assert.deepEqual(await api.getBlockedDates("rainbow"), [input.date]);
await assert.rejects(api.setBookingStatus(competing.id, "confirmed"));
await assert.rejects(api.unblockDate("rainbow", input.date));
await assert.rejects(
  api.createBookingRequest({ ...input, idempotency_key: "third" }),
);
await api.setBookingStatus(competing.id, "declined");
await api.blockDate("splash", "2099-06-02");
assert.deepEqual(await api.getBlockedDates("splash"), ["2099-06-02"]);
await api.unblockDate("splash", "2099-06-02");
assert.deepEqual(await api.getBlockedDates("splash"), []);
const u = await api.saveUnit({
  name: "Demo unit",
  description: "Sample",
  size: "Sample",
  price: 12,
  mode: "dry",
  photos: [],
  deposit_required: false,
});
assert.equal((await api.listUnits()).length, 4);
await api.saveUnit({ ...u, price: 20 });
assert.equal((await api.listUnits()).find((x) => x.id === u.id).price, 20);
await api.deleteUnit(u.id);
assert.equal((await api.listUnits()).length, 3);
assert.equal(
  (
    await api.sendContactMessage({
      name: "Demo",
      email: "demo@example.com",
      message: "Hello",
    })
  ).status,
  "received",
);
console.log(
  "API checks passed: fee boundaries, maximum, request/idempotency, conflict protection, blocks, inventory CRUD, contact.",
);
