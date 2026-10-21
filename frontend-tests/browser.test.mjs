import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const root = new URL("../public/", import.meta.url);
const photo = "/media/00000000-0000-4000-8000-000000000001";
const exampleUnit = {
  id: "example-unit",
  name: "Example Castle",
  description: "Example inventory for testing.",
  size: "10 × 10 ft",
  mode: "dry",
  price: 160,
  photos: [photo],
  deposit_required: false,
};
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
async function eventually(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("The page did not reach the expected state.");
}
async function page(t, name, entry = "app.js", fetcher = async () => json([])) {
  const dom = new JSDOM(await readFile(new URL(`${name}.html`, root), "utf8"), {
    url: `https://example.test/${name}.html`,
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  dom.window.fetch = fetcher;
  dom.window.crypto.randomUUID = randomUUID;
  dom.window.confirm = () => true;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const context = dom.getInternalVMContext();
  const modules = new Map();
  async function module(url) {
    if (!modules.has(url.href)) {
      modules.set(
        url.href,
        new vm.SourceTextModule(await readFile(url, "utf8"), {
          context,
          identifier: url.href,
        }),
      );
    }
    return modules.get(url.href);
  }
  const main = await module(new URL(entry, root));
  await main.link((specifier, parent) => module(new URL(specifier, parent.identifier)));
  await main.evaluate();
  return { window: dom.window, document: dom.window.document, exports: main.namespace };
}
function adminApi(initialUnits = [exampleUnit], initialRequests = []) {
  let units = structuredClone(initialUnits);
  let requests = structuredClone(initialRequests);
  const writes = [];
  return {
    writes,
    async fetch(path, options = {}) {
      if (options.method === "POST" || options.method === "PUT") {
        const payload = JSON.parse(options.body);
        writes.push({ path, payload });
        if (path.includes("/booking-requests/")) {
          requests = requests.map((r) => ({ ...r, status: payload.status }));
          return json({ status: payload.status });
        }
        const saved = { ...payload, id: payload.id || "new-example-unit" };
        units = [saved];
        return json(saved);
      }
      if (path === "/api/units") return json(units);
      if (path === "/api/admin/booking-requests") return json(requests);
      if (path === "/api/settings")
        return json({
          free_radius_miles: 15,
          per_mile_rate: 0.35,
          trip_multiplier: 4,
          max_delivery_miles: null,
        });
      if (path.endsWith("/blocked-dates")) return json([]);
      assert.fail(`Unexpected test request: ${path}`);
    },
  };
}

test("unit cards display R2 media URLs and update alt text on image failure", async (t) => {
  const p = await page(t, "about");
  const image = p.exports.unitCard(exampleUnit).querySelector("img");
  assert.equal(image.getAttribute("src"), photo);
  assert.equal(image.alt, "Example Castle inflatable");
  image.dispatchEvent(new p.window.Event("error"));
  assert.equal(image.getAttribute("src"), "placeholder.svg");
  assert.equal(image.alt, "Photo of Example Castle coming soon");
  const empty = p.exports.unitCard({ ...exampleUnit, photos: [] }).querySelector("img");
  assert.equal(empty.alt, "Photo of Example Castle coming soon");
});

test("media allowlist rejects traversal, protocol-relative URLs and executable URLs", async (t) => {
  const p = await page(t, "about");
  for (const src of [
    "/media/../admin.html",
    "/media/%2e%2e",
    "//example.test/photo",
    "javascript:alert(1)",
    "placeholder.svg/other",
  ])
    assert.equal(p.exports.safePhoto(src), "placeholder.svg");
  assert.equal(p.exports.safePhoto(photo), photo);
  assert.equal(p.exports.safePhoto("assets/castle1.jpg"), "assets/castle1.jpg");
  assert.equal(p.exports.safePhoto("assets/../admin.html"), "placeholder.svg");
});

test("public pages have one logo link, one menu and unique element IDs", async () => {
  for (const name of ["index", "about", "book", "contact", "admin"]) {
    const dom = new JSDOM(await readFile(new URL(`${name}.html`, root), "utf8"));
    try {
      const document = dom.window.document;
      assert.equal(document.querySelectorAll("#menu").length, 1, name);
      assert.equal(document.querySelectorAll("header .brand").length, 1, name);
      const logo = document.querySelector("header .brand img");
      assert.equal(logo?.getAttribute("src"), "assets/aatbky-logo.png", name);
      await access(new URL(logo.getAttribute("src"), root));
      const ids = Array.from(document.querySelectorAll("[id]"), (el) => el.id);
      assert.equal(ids.length, new Set(ids).size, name);
    } finally {
      dom.window.close();
    }
  }
});

test("admin creates a unit without sending a placeholder as a photo", async (t) => {
  const api = adminApi([]);
  const p = await page(t, "admin", "admin.js", api.fetch);
  await eventually(() =>
    p.document.getElementById("unit-list").textContent.includes("No inflatables"),
  );
  p.document.getElementById("add-unit").click();
  const form = p.document.getElementById("unit-form");
  for (const [key, value] of Object.entries({
    name: "Example Castle",
    description: "Example inventory",
    size: "10 × 10 ft",
    price: "160",
  }))
    form.elements.namedItem(key).value = value;
  form.dispatchEvent(new p.window.Event("submit", { bubbles: true, cancelable: true }));
  await eventually(
    () => p.document.getElementById("admin-status").textContent === "Inflatable saved.",
  );
  assert.equal(api.writes[0].path, "/api/admin/units");
  assert.deepEqual(api.writes[0].payload.photos, []);
});

for (const remove of [false, true]) {
  test(`admin ${remove ? "removes" : "preserves"} existing photos on save`, async (t) => {
    const api = adminApi();
    const p = await page(t, "admin", "admin.js", api.fetch);
    await eventually(() => p.document.querySelector("#unit-list button"));
    p.document.querySelector("#unit-list button").click();
    p.document.getElementById("remove-photos").checked = remove;
    p.document
      .getElementById("unit-form")
      .dispatchEvent(new p.window.Event("submit", { bubbles: true, cancelable: true }));
    await eventually(
      () => p.document.getElementById("admin-status").textContent === "Inflatable saved.",
    );
    assert.deepEqual(api.writes[0].payload.photos, remove ? [] : [photo]);
  });
}

test("admin reports a real queued customer email after confirming a request", async (t) => {
  const api = adminApi(
    [exampleUnit],
    [
      {
        id: "example-request",
        unit_id: exampleUnit.id,
        unit_name: exampleUnit.name,
        date: "2099-06-15",
        name: "Example Customer",
        phone: "5550100100",
        email: "customer@example.test",
        event_type: "Example event",
        delivery_address: "100 Example St, Anytown, KY",
        total: 160,
        status: "pending",
      },
    ],
  );
  const p = await page(t, "admin", "admin.js", api.fetch);
  await eventually(() => p.document.querySelector("#pending button"));
  p.document.querySelector("#pending button").click();
  await eventually(() => p.document.getElementById("admin-status").textContent.includes("queued"));
  assert.equal(
    p.document.getElementById("admin-status").textContent,
    "Request confirmed. A customer email has been queued.",
  );
});

test("a static HTML fallback shows a recovery message instead of a broken booking list", async (t) => {
  const p = await page(
    t,
    "book",
    "app.js",
    async () =>
      new Response("<html>Static preview</html>", {
        headers: { "content-type": "text/html" },
      }),
  );
  await eventually(() => p.document.getElementById("units").textContent.includes("unavailable"));
  assert.match(p.document.getElementById("units").textContent, /502-851-7596/);
  assert.equal(p.document.querySelector("#units button"), null);
});

test("HTML on contact submission cannot produce a false message-sent confirmation", async (t) => {
  const p = await page(
    t,
    "contact",
    "app.js",
    async () =>
      new Response("<html>Static preview</html>", {
        headers: { "content-type": "text/html" },
      }),
  );
  const form = p.document.getElementById("contact-form");
  for (const [key, value] of Object.entries({
    name: "Example Customer",
    email: "customer@example.test",
    message: "Example question",
  }))
    form.elements.namedItem(key).value = value;
  form.dispatchEvent(new p.window.Event("submit", { bubbles: true, cancelable: true }));
  await eventually(() =>
    p.document.getElementById("contact-status").textContent.includes("unavailable"),
  );
  assert.equal(form.elements.namedItem("message").value, "Example question");
  assert.doesNotMatch(p.document.getElementById("contact-status").textContent, /Message sent/);
});

test("special arrangements explain deposits after approval", async (t) => {
  const p = await page(t, "book", "app.js", async () =>
    json([{ ...exampleUnit, deposit_required: true }]),
  );
  await eventually(() => p.document.querySelector("#units button"));
  p.document.querySelector("#units button").click();
  await eventually(() => p.document.querySelector("#calendar button"));
  assert.equal(p.document.getElementById("deposit").hidden, false);
  assert.match(
    p.document.getElementById("deposit").textContent,
    /payment instructions after approving/,
  );
  assert.doesNotMatch(p.document.getElementById("deposit").textContent, /any deposit or/);
});
