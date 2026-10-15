import assert from "node:assert/strict";
const base = process.env.API_BASE_URL || "http://localhost:8787";
async function req(path, options = {}) {
  const r = await fetch(base + path, options);
  const b = await r.json();
  if (!r.ok) throw new Error(b.error);
  return b;
}
const units = await req("/api/units");
assert.ok(Array.isArray(units));
const settings = await req("/api/settings");
assert.equal(typeof settings.free_radius_miles, "number");
assert.equal(typeof settings.per_mile_rate, "number");
assert.equal(typeof settings.trip_multiplier, "number");
const unitId = units[0]?.id || "smoke-missing-unit";
const dates = await req(`/api/units/${encodeURIComponent(unitId)}/blocked-dates`);
assert.ok(Array.isArray(dates));
console.log("API smoke test passed: three GET routes against " + base + ".");
