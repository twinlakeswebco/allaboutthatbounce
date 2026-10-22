import { test, expect } from "vitest";
import { env } from "cloudflare:test";
import catalog from "../seeds/seed_catalog_v2.sql?raw";
import { createBooking, decide, request, seedBooking, futureDate } from "./helpers.mjs";

async function sharedInventory() {
  for (const id of ["part-a", "part-b", "package", "part-a-wet"]) {
    await env.DB.prepare(
      "INSERT INTO units(id,name,description,size,mode,price_cents) VALUES(?,?,'Test rental','Test size','dry',20000)",
    )
      .bind(id, id)
      .run();
  }
  await env.DB.batch([
    env.DB.prepare("INSERT INTO unit_components VALUES('package','part-a')"),
    env.DB.prepare("INSERT INTO unit_components VALUES('package','part-b')"),
    env.DB.prepare("INSERT INTO unit_components VALUES('part-a-wet','part-a')"),
  ]);
}
test("a confirmed component blocks its package and wet option, but not the other piece", async () => {
  await sharedInventory();
  await seedBooking({ unit_id: "part-a", status: "confirmed" });
  for (const id of ["package", "part-a-wet"]) {
    expect((await request(`/api/units/${id}/blocked-dates`)).body).toContain(futureDate);
    expect((await createBooking({ unit_id: id })).status).toBe(409);
  }
  expect((await createBooking({ unit_id: "part-b" })).status).toBe(201);
});
test("concurrent confirmations cannot reserve a package and one of its pieces", async () => {
  await sharedInventory();
  const a = await seedBooking({ unit_id: "package" });
  const b = await seedBooking({ unit_id: "part-a-wet" });
  const decisions = await Promise.all([decide(a.id), decide(b.id)]);
  expect(decisions.map((r) => r.status).sort()).toEqual([200, 409]);
  const mails = await env.DB.prepare(
    "SELECT count(*) AS n FROM notification_outbox WHERE kind='confirmed'",
  ).first();
  expect(mails.n).toBe(1);
});
test("blocking a package blocks either piece and prevents confirmation", async () => {
  await sharedInventory();
  const r = await seedBooking({ unit_id: "part-b" });
  await env.DB.prepare("INSERT INTO blocks(unit_id,date) VALUES('package',?)")
    .bind(futureDate)
    .run();
  expect((await request("/api/units/part-b/blocked-dates")).body).toContain(futureDate);
  expect((await decide(r.id)).status).toBe(409);
});
test("v2 import is repeatable, preserves photos, and prices components and wet rentals correctly", async () => {
  // D1 exec accepts one statement per line; catalog statements contain no embedded newlines.
  const statements = catalog.split("\n").filter((line) => line.trim() && !line.startsWith("--"));
  const apply = () => env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
  await apply();
  await env.DB.prepare(
    "INSERT INTO unit_photos(id,unit_id,r2_key,position) VALUES('photo-test','castle','castle/photo.jpg',0)",
  ).run();
  await apply();
  expect(
    (await env.DB.prepare("SELECT count(*) AS n FROM unit_photos WHERE id='photo-test'").first()).n,
  ).toBe(1);
  const units = (await request("/api/units")).body;
  expect(units.find((u) => u.id === "big-kahuna").price).toBe(675);
  expect(units.find((u) => u.id === "big-kahuna-slip-slide").price).toBe(225);
  expect(units.find((u) => u.id === "level-up-package").price).toBe(450);
  expect(units.find((u) => u.id === "princess-combo-wet").price).toBe(300);
  expect(units.every((u) => !("deposit_required" in u))).toBe(true);
  expect(units.find((u) => u.id === "sunset-splash").photos).toEqual([
    "/media/catalog/sunset-splash.jpeg",
  ]);
  expect(units.some((u) => u.id === "fire-n-ice" || u.id === "fire-n-ice-wet")).toBe(false);
  expect(units.every((u) => !u.size.includes("riders"))).toBe(true);
});
