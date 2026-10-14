import { test } from "vitest";
import assert from "node:assert/strict";
import { calculateQuote } from "../worker/distance.js";
import { decodePhoto } from "../worker/storage.js";
const s = {
  free_radius_miles: 15,
  per_mile_rate: 0.35,
  trip_multiplier: 4,
  max_delivery_miles: null,
};
test("delivery fee examples and boundary", () => {
  assert.deepEqual(calculateQuote(15, s), { distance_miles: 15, fee: 0, status: "free" });
  assert.deepEqual(calculateQuote(16, s), { distance_miles: 16, fee: 22.4, status: "fee" });
  assert.deepEqual(calculateQuote(20, s), { distance_miles: 20, fee: 28, status: "fee" });
});
test("maximum delivery distance", () =>
  assert.deepEqual(calculateQuote(26, { ...s, max_delivery_miles: 25 }), {
    distance_miles: 26,
    fee: 0,
    status: "outside_area",
  }));
test("photo magic bytes reject fake image", () => {
  const fake = "data:image/png;base64," + Buffer.from("not an image").toString("base64");
  assert.throws(() => decodePhoto(fake), /PNG, JPEG, or WebP/);
});
test("distance quote object cannot expose origin", () => {
  const origin = "private-origin-sentinel";
  const body = JSON.stringify(calculateQuote(16, s));
  assert.equal(body.includes(origin), false);
});

test("fractional mile uses integer cents", () => assert.equal(calculateQuote(15.1, s).fee, 21.14));

import { settingsError } from "../worker/validation.js";
for (const rate of [0.29, 0.07, 0.57, 0.58, 0.55]) {
  test(`accept cent rate ${rate}`, () =>
    assert.equal(settingsError({ ...s, per_mile_rate: rate }), null));
}
for (const rate of [0.355, -1, NaN, "0.35"]) {
  test(`reject invalid rate ${rate}`, () =>
    assert.ok(settingsError({ ...s, per_mile_rate: rate })));
}
